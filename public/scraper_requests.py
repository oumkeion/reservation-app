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
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

def _load_dotenv() -> None:
    """リポジトリ直下の .env（gitignore対象）から環境変数を補完する。"""
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env")
    if not os.path.exists(env_path):
        return
    with open(env_path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())


_load_dotenv()

# 部共有のログイン情報。コードに直接書かない:
#   ローカル → リポジトリ直下の .env（RESV_USER_ID=... / RESV_PASSWORD=...）
#   GitHub Actions → Secrets RESV_USER_ID / RESV_PASSWORD
USER_ID = os.environ.get("RESV_USER_ID", "")
PASSWORD = os.environ.get("RESV_PASSWORD", "")
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
    r'<div class="scScheduleBox[^"]*" id="(\d+)" style="left:(\d+)px;width:(\d+)px;"'
)
# 詳細ページ（rsvDetail.php）のラベル/値ペア
DETAIL_ROW_RE = re.compile(
    r'<div class="rsvDetailBox">\s*<div><p>(.*?)</p></div>\s*<div><p[^>]*>(.*?)</p></div>',
    re.S,
)
TAG_RE = re.compile(r"<[^>]+>")


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
    if not USER_ID or not PASSWORD:
        raise RuntimeError(
            "RESV_USER_ID / RESV_PASSWORD が未設定です。"
            "ローカルでは .env、GitHub Actions では Secrets に設定してください。"
        )
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
            schedules: {"1": [{"rid": "140819", "start": "16:00", "end": "20:00"}, ...], ...}
    """
    rooms = [{"id": int(rid), "name": name} for rid, name in ROOM_RE.findall(html)]
    schedules: Dict[str, List[Dict]] = {str(r["id"]): [] for r in rooms}
    for dana_id, inner in SCBOX_RE.findall(html):
        slots = [
            {
                "rid": rid,
                "start": _px_to_time(int(left)),
                "end": _px_to_time(int(left) + int(width)),
            }
            for rid, left, width in SCHEDULE_RE.findall(inner)
        ]
        slots.sort(key=lambda s: s["start"])
        schedules[dana_id] = slots
    return rooms, schedules


def _strip_tags(html: str) -> str:
    text = TAG_RE.sub("", html)
    return text.replace("&nbsp;", " ").strip()


def fetch_reservation_detail(session: requests.Session, rid: str) -> Dict:
    """詳細ページから団体名・使用内容・音出し可否を取得する。

    取得失敗時は音出し「不可」扱い（安全側に倒す）。
    """
    resp = session.get(f"{BASE}/rsvDetail.php?a={rid}", timeout=10)
    resp.raise_for_status()
    fields = {
        _strip_tags(label): _strip_tags(value)
        for label, value in DETAIL_ROW_RE.findall(resp.text)
    }
    org = fields.get("使用講座", "")
    # "事務部 教務課教務係担当者：教務課教務係" のように担当者が連結されるため切り落とす
    org = org.split("担当者：")[0].strip() or "不明"
    return {
        "org": org,
        "label": fields.get("使用内容（会議名称など）", ""),
        "sound": "可" if fields.get("課外活動の音出し") == "可" else "不可",
    }


def merge_intervals(intervals: List[Tuple[str, str]]) -> List[Dict]:
    """[(start, end)] の重なりを統合して [{"start","end"}] を返す（HH:MM文字列のまま比較可能）。"""
    merged: List[Dict] = []
    for start, end in sorted(intervals):
        if merged and start <= merged[-1]["end"]:
            merged[-1]["end"] = max(merged[-1]["end"], end)
        else:
            merged.append({"start": start, "end": end})
    return merged


def scrape_all() -> Dict:
    """今日から60日分の予約＋各予約の詳細（団体名・音出し可否）を取得して返す。"""
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

    # 各予約の詳細を取得（同一予約IDは1回だけ）
    detail_cache: Dict[str, Dict] = {}
    all_slots = [slot for schedules in days.values() for slots in schedules.values() for slot in slots]
    unique_ids = {s["rid"] for s in all_slots}
    print(f"\n予約詳細を取得します（{len(unique_ids)}件）...")
    for rid in sorted(unique_ids):
        try:
            detail_cache[rid] = fetch_reservation_detail(session, rid)
        except requests.RequestException as e:
            print(f"⚠️ 詳細 {rid} の取得に失敗: {e}")
            detail_cache[rid] = {"org": "不明", "label": "", "sound": "不可"}
        time.sleep(0.05)  # 連続アクセスを避ける
    for slot in all_slots:
        detail = detail_cache[slot.pop("rid")]
        slot.update(detail)

    # 音出し禁止帯: 「音出し不可」の予約がどこかの部屋に入っている時間帯（日毎の和集合）
    no_sound: Dict[str, List[Dict]] = {}
    for date_str, schedules in days.items():
        intervals = [
            (s["start"], s["end"])
            for slots in schedules.values()
            for s in slots
            if s["sound"] != "可"
        ]
        if intervals:
            no_sound[date_str] = merge_intervals(intervals)

    return {
        "updatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "gridStart": "07:00",
        "gridEnd": "22:00",
        "rooms": rooms,
        "days": days,
        "noSound": no_sound,
    }


def write_json(data: Dict) -> None:
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"✅ JSON保存完了: {OUT_PATH} ({len(data['days'])}日分, {len(data['rooms'])}部屋)")


AUTO_EVENT_SOURCE = "lectureHallAuto"


def sync_no_sound_events(db, no_sound: Dict[str, List[Dict]]) -> None:
    """音出し禁止帯を events コレクションに同期する（自動生成分のみ毎回入れ替え）。

    自動生成イベントは extendedProps.source で識別する。手動で作成された
    音出し禁止イベントには触れない。管理者がアプリ側で削除しても翌晩復活する点に注意。
    """
    existing = list(
        db.collection("events")
        .where("extendedProps.source", "==", AUTO_EVENT_SOURCE)
        .stream()
    )
    batch = db.batch()
    ops = 0

    def flush(b, n):
        if n:
            b.commit()
        return db.batch(), 0

    for doc in existing:
        batch.delete(doc.reference)
        ops += 1
        if ops >= 400:
            batch, ops = flush(batch, ops)

    created = 0
    for date_str, ranges in sorted(no_sound.items()):
        for r in ranges:
            ref = db.collection("events").document()
            batch.set(ref, {
                "title": "音出し禁止（講義棟使用中）",
                "start": f"{date_str}T{r['start']}:00+09:00",
                "end": f"{date_str}T{r['end']}:00+09:00",
                "allDay": False,
                "extendedProps": {
                    "type": "no-sound",
                    "comment": "講義棟の利用予定から自動生成",
                    "editor": "自動取得",
                    "source": AUTO_EVENT_SOURCE,
                },
            })
            ops += 1
            created += 1
            if ops >= 400:
                batch, ops = flush(batch, ops)
    flush(batch, ops)
    print(f"✅ 音出し禁止イベントを同期: 旧{len(existing)}件を削除、新{created}件を作成")


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
        sync_no_sound_events(db, data.get("noSound", {}))
    except (ValueError, json.JSONDecodeError) as e:
        print(f"❌ Firestore への書き込みに失敗: {e}")
        sys.exit(1)


if __name__ == "__main__":
    result = scrape_all()
    write_json(result)
    upload_to_firestore(result)
    print("\n処理が完了しました.")
