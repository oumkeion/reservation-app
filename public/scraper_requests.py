#!/usr/bin/env python3
import os, re, requests
from datetime import datetime, timedelta

USER_ID   = "1188"
PASSWORD  = "cB8V"
BASE      = "https://www.med.osaka-u.ac.jp/pub/resv"
OUT_DIR   = "htmls"

def get_full_url(path: str) -> str:
    if path.startswith("http"):
        return path
    if path.startswith("/"):
        return f"https://www.med.osaka-u.ac.jp{path}"
    return f"https://www.med.osaka-u.ac.jp/pub/resv/{path}"

def inline_resources(html: str) -> str:
    # CSS
    html = re.sub(
        r'<link[^>]+rel=["\']stylesheet["\'][^>]+href=["\']([^"\']+)["\']',
        lambda m: "<style>\n" + requests.get(get_full_url(m.group(1))).text + "\n</style>",
        html, flags=re.IGNORECASE
    )
    # JS
    html = re.sub(
        r'<script[^>]+src=["\']([^"\']+)["\'][^>]*></script>',
        lambda m: "<script>\n" + requests.get(get_full_url(m.group(1))).text + "\n</script>",
        html, flags=re.IGNORECASE
    )
    return html

def save_reservation_html(date_str: str):
    """
    追加：YYYY-MM-DD を受け取って rsvMain.php の日次ビューを取得・保存
    """
    y, m, d = date_str.split("-")
    os.makedirs(OUT_DIR, exist_ok=True)
    out_path = f"{OUT_DIR}/{date_str}.html"

    with requests.Session() as s:
        s.headers.update({"User-Agent":"Mozilla/5.0"})
        # 1) ログインページをGET
        s.get(f"{BASE}/index.php")
        # 2) POSTでログイン
        resp = s.post(
            f"{BASE}/index.php",
            data={"uid":USER_ID, "upw":PASSWORD},
            allow_redirects=True
        )
        if "logInBox" in resp.text:
            raise RuntimeError("ログインに失敗しました。ID/PWを確認してください。")
        # 3) 日次ビュー取得
        url = f"{BASE}/rsvMain.php?t=0&y={y}&m={int(m)}&d={int(d)}"
        resp2 = s.get(url)
        html = resp2.text.replace(
            "<head>",
            '<head><base href="https://www.med.osaka-u.ac.jp/pub/resv/">'
        )
        html = inline_resources(html)
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(html)
        print("✅ 日次ビュー保存完了:", out_path)

if __name__ == "__main__":
    # ── 今日から30日分の日次ビューを取得 ──
    today = datetime.today()
    for delta in range(0, 30):
        d = today + timedelta(days=delta)
        date_str = d.strftime("%Y-%m-%d")
        save_reservation_html(date_str)

    # （必要に応じて月間ビューも取得するなら追加で↓）
    # for delta in range(0, 2):
    #     # たとえば今月と来月の２ヶ月分
    #     m = (today + timedelta(days=delta*30)).strftime("%Y-%m")
    #     save_reservation_month_html(m)
