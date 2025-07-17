#!/usr/bin/env python3
import os, re, requests
from datetime import datetime, timedelta
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

USER_ID   = "1188"
PASSWORD  = "cB8V"
BASE      = "https://www.med.osaka-u.ac.jp/pub/resv"
# スクリプトの場所を基準にhtmlsディレクトリのパスを構築
OUT_DIR   = os.path.join(os.path.dirname(os.path.abspath(__file__)), "htmls")

# --- 正規表現を事前にコンパイル ---
CSS_RE = re.compile(r'<link[^>]+rel=["\\]'stylesheet["\\]'[^>]+href=["\\]'([^"]+)["\\]', re.IGNORECASE)
JS_RE  = re.compile(r'<script[^>]+src=["\\]'([^"]+)["\\]'[^>]*></script>', re.IGNORECASE)


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
        '<head><base href="https://www.med.osaka-u.ac.jp/pub/resv/">'
    )
    html = inline_resources(html, s)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(html)
    print("✅ 日次ビュー保存完了:", out_path)

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
    # 1. 古いHTMLファイルを削除
    cleanup_old_htmls()

    # 2. 今日から30日分の日次ビューを取得
    print("\n今日から30日分のHTMLを取得します...")
    today = datetime.today()
    for delta in range(0, 30):
        d = today + timedelta(days=delta)
        date_str = d.strftime("%Y-%m-%d")
        try:
            save_reservation_html(date_str)
        except Exception as e:
            print(f"エラー: {date_str} の取得に失敗しました - {e}")

    print("\n処理が完了しました。")
}
