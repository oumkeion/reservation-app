#!/usr/bin/env python3
"""講義棟予約状況スクレイパー。

大阪大学医学部の予約システムにログインし、今日から60日分の日次ビューをパースして
構造化データ lecture-hall.json を生成する。FIREBASE_SERVICE_ACCOUNT 環境変数が
あれば Firestore（settings/lectureHall）にも書き込む。

旧バージョンはHTMLスナップショット（約34MB/日）をコミットしていたが、
現在はJSONのみを扱う（アプリは Firestore を直接読む）。
"""
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# 部共有のログイン情報（GitHub Actions では Secrets で上書き可能）
USER_ID = os.environ.get("RESV_USER_ID", "1188")
PASSWORD = os.environ.get("RESV_PASSWORD", "cB8V")
BASE = "https://www.med.osaka-u.ac.jp/pub/resv"
OUT_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "htmls", "lecture-hall.json"
)
DAYS_TO_FETCH = 60

# --- 構造化抽出 ---
# 日次ビューでは予約が left/width のピクセル値で表現されている:
#   時間軸 07:00〜22:00、54px = 1時間（dana-unit=10分 → 9px = 10分）
GRID_START_HOUR = 7
PX_PER_10MIN = 9

ROOM_RE = re.compile(
    r'<a href="\./rsvMainMonth\.php\?t=0&e=(\d+)[^"]*">([^<]+)</a>'
)
SCBOX_RE = re.compile(
    r'<div class="scBox" dana-id="(\d+)"[^>]*>(.*?)</div></div>', re.S
)
SCHEDULE_RE = re.compile(
    r'<div class="scScheduleBox[^"]*"[^>]*style="left:(\d+)px;width:(\d+)px;"'
)


def make_session() -> requests.Session:
    s = requests.Session()
    retries = Retry(
        total=3, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504]
    )
    s.mount("https://", HTTPAdapter(max_retries=retries))
    s.headers.update({"User-Agent": "Mozilla/5.0"})
    return s


def login(session: requests.Session) -> None:
    """ログインしてセッションを確立する（以降のリクエストで再利用）。"""
    session.get(f"{BASE}/index.php", timeout=10)
    resp = session.post(
        f"{BASE}/index.php",
        data={"uid": USER_ID, "upw": PASSWORD},
        allow_redirects=True,
        timeout=10,
    )
    if "logInBox" in resp.text:
        raise RuntimeError("ログインに失敗しました。ID/PWを確認してください。")


def fetch_day_html(session: requests.Session, date_str: str) -> str:
    y, m, d = date_str.split("-")
    url = f"{BASE}/rsvMain.php?t=0&y={y}&m={int(m)}&d={int(d)}"
    resp = session.get(url, timeout=10)
    resp.raise_for_status()
    return resp.text


def _px_to_time(px: int) -> str:
    """left/width のピクセル値を 07:00 起点の HH:MM に変換する。"""
    minutes = round(px / PX_PER_10MIN) * 10
    total = GRID_START_HOUR * 60 + minutes
    return f"{total // 60:02d}:{total % 60:02d}"


def parse_day_html(html: str) -> Tuple[List[Dict], Dict[str, List[Dict]]]:
    """日次ビューHTMLから部屋一覧と予約時間帯を抽出する。

    Returns:
        (rooms, schedules):
            rooms: [{"id": 1, "name": "1階 A講堂"}, ...]
            schedules: {"1": [{"start": "16:00", "end": "20:00"}, ...], ...}
    """
    rooms = [{"id": int(rid), "name": name} for rid, name in ROOM_RE.findall(html)]
    schedules: Dict[str, List[Dict]] = {str(r["id"]): [] for r in rooms}
    for dana_id, inner in SCBOX_RE.findall(html):
        slots = [
            {
                "start": _px_to_time(int(left)),
                "end": _px_to_time(int(left) + int(width)),
            }
            for left, width in SCHEDULE_RE.findall(inner)
        ]
        slots.sort(key=lambda s: s["start"])
        schedules[dana_id] = slots
    return rooms, schedules


def scrape_all() -> Dict:
    """今日から60日分を取得・パースして構造化データを返す。"""
    session = make_session()
    login(session)

    days: Dict[str, Dict[str, List[Dict]]] = {}
    rooms: List[Dict] = []
    failed: List[str] = []
    today = datetime.today()
    for delta in range(DAYS_TO_FETCH):
        date_str = (today + timedelta(days=delta)).strftime("%Y-%m-%d")
        try:
            html = fetch_day_html(session, date_str)
            day_rooms, schedules = parse_day_html(html)
        except (requests.RequestException, RuntimeError) as e:
            print(f"⚠️ {date_str} の取得に失敗: {e}")
            failed.append(date_str)
            continue
        if day_rooms:
            rooms = day_rooms
        days[date_str] = schedules
        print(f"✅ {date_str}: 予約 {sum(len(s) for s in schedules.values())} 件")

    # 妥当性チェック: サイト構造が変わるとここで検知できる（Actions が失敗扱いになる）
    if not rooms:
        print("❌ 部屋一覧を1件も抽出できませんでした。サイト構造が変わった可能性があります。")
        sys.exit(1)
    if len(failed) > DAYS_TO_FETCH // 2:
        print(f"❌ {len(failed)}/{DAYS_TO_FETCH} 日分の取得に失敗しました。")
        sys.exit(1)

    return {
        "updatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "gridStart": "07:00",
        "gridEnd": "22:00",
        "rooms": rooms,
        "days": days,
    }


def write_json(data: Dict) -> None:
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"✅ JSON保存完了: {OUT_PATH} ({len(data['days'])}日分, {len(data['rooms'])}部屋)")


def upload_to_firestore(data: Dict) -> None:
    """FIREBASE_SERVICE_ACCOUNT があれば Firestore に書き込む（無ければスキップ）。"""
    sa_json: Optional[str] = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
    if not sa_json:
        print("FIREBASE_SERVICE_ACCOUNT 未設定のため Firestore への書き込みをスキップ")
        return
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
    except ImportError:
        print("⚠️ firebase-admin 未インストールのため Firestore への書き込みをスキップ")
        return
    try:
        cred = credentials.Certificate(json.loads(sa_json))
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        db.collection("settings").document("lectureHall").set(data)
        print("✅ Firestore (settings/lectureHall) へ書き込み完了")
    except (ValueError, json.JSONDecodeError) as e:
        print(f"❌ Firestore への書き込みに失敗: {e}")
        sys.exit(1)


if __name__ == "__main__":
    result = scrape_all()
    write_json(result)
    upload_to_firestore(result)
    print("\n処理が完了しました.")
