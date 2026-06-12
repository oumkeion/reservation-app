#!/usr/bin/env python3
import json
import os, re, sys, requests
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

USER_ID   = "1188"
PASSWORD  = "cB8V"
BASE      = "https://www.med.osaka-u.ac.jp/pub/resv"
# スクリプトの場所を基準にhtmlsディレクトリのパスを構築
OUT_DIR   = os.path.join(os.path.dirname(os.path.abspath(__file__)), "htmls")

# --- 正規表現を事前にコンパイル ---
CSS_RE = re.compile(
    r'<link[^>]+rel=["\']stylesheet["\'][^>]+href=["\']([^"]+)["\']',
    re.IGNORECASE
)
JS_RE = re.compile(
    r'<script[^>]+src=["\']([^"]+)["\'][^>]*></script>',
    re.IGNORECASE
)


def make_session():
    s = requests.Session()
    retries = Retry(total=3, backoff_factor=1,
                    status_forcelist=[429, 500, 502, 503, 504])
    s.mount("https://", HTTPAdapter(max_retries=retries))
    return s

def get_full_url(path: str) -> str:
    if path.startswith("http"):
        return path
    if path.startswith("/"):
        return f"https://www.med.osaka-u.ac.jp{path}"
    return f"https://www.med.osaka-u.ac.jp/pub/resv/{path}"

def inline_resources(html: str, session: requests.Session) -> str:
    # CSS
    def repl_css(m):
        url = get_full_url(m.group(1))
        try:
            txt = session.get(url, timeout=10).text
        except Exception as e:
            print(f"⚠️ CSSロード失敗 {url}: {e}")
            return ""  # 空に置き換えて続行
        return f"<style>\n{txt}\n</style>"
    html = CSS_RE.sub(repl_css, html)

    # JS
    def repl_js(m):
        url = get_full_url(m.group(1))
        try:
            txt = session.get(url, timeout=10).text
        except Exception as e:
            print(f"⚠️ JSロード失敗 {url}: {e}")
            return ""
        return f"<script>\n{txt}\n</script>"
    html = JS_RE.sub(repl_js, html)

    return html

def save_reservation_html(date_str: str):
    """
    追加：YYYY-MM-DD を受け取って rsvMain.php の日次ビューを取得・保存
    """
    y, m, d = date_str.split("-")
    os.makedirs(OUT_DIR, exist_ok=True)
    out_path = os.path.join(OUT_DIR, f"{date_str}.html")

    s = make_session()
    s.headers.update({"User-Agent":"Mozilla/5.0"})
    # 1) ログインページをGET
    s.get(f"{BASE}/index.php", timeout=10)
    # 2) POSTでログイン
    resp = s.post(
        f"{BASE}/index.php",
        data={"uid":USER_ID, "upw":PASSWORD},
        allow_redirects=True,
        timeout=10
    )
    if "logInBox" in resp.text:
        raise RuntimeError("ログインに失敗しました。ID/PWを確認してください。")
    # 3) 日次ビュー取得
    url = f"{BASE}/rsvMain.php?t=0&y={y}&m={int(m)}&d={int(d)}"
    resp2 = s.get(url, timeout=10)
    resp2.raise_for_status() # HTTPエラーがあれば例外を発生させる
    html = resp2.text.replace(
        "<head>",
        f'<head><base href="{BASE}/">'
    )
    html = inline_resources(html, s)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)
    print("✅ 日次ビュー保存完了:", out_path)

# --- 構造化抽出（lecture-hall.json 生成） ---
# 日次ビューのHTMLでは、予約は left/width のピクセル値で表現されている:
#   時間軸 07:00〜22:00、54px = 1時間（dana-unit=10分 → 9px = 10分）
GRID_START_HOUR = 7
PX_PER_10MIN = 9

ROOM_RE = re.compile(
    r'<a href="\./rsvMainMonth\.php\?t=0&e=(\d+)[^"]*">([^<]+)</a>'
)
SCBOX_RE = re.compile(r'<div class="scBox" dana-id="(\d+)"[^>]*>(.*?)</div></div>', re.S)
SCHEDULE_RE = re.compile(
    r'<div class="scScheduleBox[^"]*"[^>]*style="left:(\d+)px;width:(\d+)px;"'
)


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


def build_lecture_hall_json() -> None:
    """OUT_DIR 内の全日次HTMLをパースして lecture-hall.json を出力する。"""
    days: Dict[str, Dict[str, List[Dict]]] = {}
    rooms: List[Dict] = []
    if not os.path.exists(OUT_DIR):
        print(f"ディレクトリが見つかりません: {OUT_DIR}")
        return
    for filename in sorted(os.listdir(OUT_DIR)):
        if not filename.endswith(".html"):
            continue
        date_str = filename[:-5]
        try:
            datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            continue
        path = os.path.join(OUT_DIR, filename)
        try:
            with open(path, encoding="utf-8") as f:
                html = f.read()
            day_rooms, schedules = parse_day_html(html)
        except OSError as e:
            print(f"⚠️ パース失敗 {filename}: {e}")
            continue
        if day_rooms:
            rooms = day_rooms
        days[date_str] = schedules
    out_path = os.path.join(OUT_DIR, "lecture-hall.json")
    data = {
        "updatedAt": datetime.now().isoformat(timespec="seconds"),
        "gridStart": "07:00",
        "gridEnd": "22:00",
        "rooms": rooms,
        "days": days,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"✅ 構造化データ保存完了: {out_path} ({len(days)}日分, {len(rooms)}部屋)")


def cleanup_old_htmls():
    """過去の日付のHTMLファイルを削除する"""
    print("古いHTMLファイルをクリーンアップしています...")
    today = datetime.today().date()

    if not os.path.exists(OUT_DIR):
        print(f"ディレクトリが見つかりません: {OUT_DIR}")
        return

    for filename in os.listdir(OUT_DIR):
        if filename.endswith('.html'):
            try:
                file_date_str = filename.replace('.html', '')
                file_date = datetime.strptime(file_date_str, '%Y-%m-%d').date()
                if file_date < today:
                    file_path = os.path.join(OUT_DIR, filename)
                    os.remove(file_path)
                    print(f"古いファイルを削除しました: {file_path}")
            except ValueError:
                print(f"日付形式でないためスキップ: {filename}")

if __name__ == "__main__":
    # --rebuild-json: スクレイピングせず、既存HTMLから lecture-hall.json を再生成するだけ
    if "--rebuild-json" in sys.argv:
        build_lecture_hall_json()
        sys.exit(0)

    # 1. 古いHTMLファイルを削除
    cleanup_old_htmls()

    # 2. 今日から60日分の日次ビューを取得
    print("\n今日から60日分のHTMLを取得します...")
    today = datetime.today()
    for delta in range(0, 60): # 今日から60日分（約2ヶ月分）のHTMLを取得
        d = today + timedelta(days=delta)
        date_str = d.strftime("%Y-%m-%d")
        try:
            save_reservation_html(date_str)
        except Exception as e:
            print(f"エラー: {date_str} の取得に失敗しました - {e}")

    # 3. 取得したHTMLから構造化データ(lecture-hall.json)を生成
    build_lecture_hall_json()

    print("\n処理が完了しました.")
