# 本番デプロイ手順（Firebase Hosting + Firestore）

新しい React アプリ（`app/`）を Firebase Hosting に公開する手順。LINE bot（`gas/`）は
含めず、後から追加できる。デプロイは作業者の Firebase ログインが必要（CI 不要）。

## 構成

- **Hosting**: `app/dist`（Vite ビルド成果物）を配信。`firebase.json` で SPA リライト設定済み
- **Firestore**: `firestore.rules` を適用。予約・バンド・部誌・狙い表明は匿名読み書き、
  固定枠/音出し禁止と `settings/lectureHall` は管理者/サーバーのみ
- **講義棟データ**: アプリは Firestore `settings/lectureHall` を優先し、無ければビルド時に
  同梱した `app/dist/htmls/lecture-hall.json` にフォールバック

## 初回デプロイ

```bash
cd final_reservation_system

# 1. Firebase CLI（未インストールなら）
npm install -g firebase-tools
firebase login

# 2. アプリをビルド（public/htmls/lecture-hall.json も dist にコピーされる）
npm --prefix app install   # 初回のみ
npm --prefix app run build

# 3. Firestore ルール + Hosting をデプロイ
firebase deploy --only firestore:rules,hosting
```

公開URL: `https://oumkeion-reservation-app.web.app`（および `.firebaseapp.com`）

## 更新時（コード修正後）

```bash
npm --prefix app run build
firebase deploy --only hosting
# ルールを変えたときは: firebase deploy --only firestore:rules
```

## デプロイ前チェック

```bash
npm --prefix app run lint
npm --prefix app run build   # エラーなくビルドできること
```

## 講義棟データを「常に最新」にする（任意・推奨）

現状アプリはビルド時同梱の JSON をフォールバック表示する。ライブ更新するには
GitHub Actions「Nightly Scrape」を有効化し、Firestore に書き込ませる:

1. リポジトリ Settings → Secrets and variables → Actions に登録:
   - `RESV_USER_ID` = 講義棟予約サイトのID
   - `RESV_PASSWORD` = 同パスワード
   - `FIREBASE_SERVICE_ACCOUNT` = サービスアカウントJSON全文（鍵の再発行は line-bot-setup.md 手順0参照）
2. Actions タブ →「Nightly Scrape」を Enable → 一度手動 Run で成功を確認

これで毎晩 `settings/lectureHall` が更新され、再デプロイなしでライブ反映される。

## ロールバック

Firebase Console → Hosting → リリース履歴から以前のバージョンに戻せる。
旧バニラ版サイト（`public/`）に戻す場合は `firebase.json` の hosting.public を
`public` に戻して再デプロイ。

## 後で追加するもの（このデプロイには含めない）

- **LINE bot**: `gas/` を Google Apps Script に別途デプロイ（`plan/line-bot-setup.md`）。
  Firebase 側の変更は不要で、いつでも追加できる。
