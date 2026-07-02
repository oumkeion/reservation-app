# 夜間スクレイパーを「部アカウントで完全無料」で回す手順

決定: **部アカウント(handai.mail.okuruyou@gmail.com)所有の公開リポジトリ + 支出上限$0**。
git 履歴に秘密情報が無いことを確認済みのため公開しても安全（認証情報は GitHub Secrets＝暗号化 と `.env`＝gitignore のみ）。

## なぜ無料になるのか（根拠）

- **公開リポジトリの GitHub Actions は分数無制限で完全無料**（標準ランナー）。
- 仮に非公開でも、夜間ジョブは1回2〜3分 ≒ 月90分で、無料枠(月2,000分)の5%未満。
- GitHub の **Actions 支出上限は既定で$0**。超過しても課金されず、ワークフローが停止するだけ。
  課金には「上限引き上げ＋支払い方法登録」を自分で行う必要がある＝放置していれば絶対に課金されない。
- Firestore への書き込みは **SA キー（Firebase プロジェクト単位）** で行うため、GitHub の所有者が誰でも動く。

## セットアップ手順（あなたが実施）

### 1. 部アカウントの GitHub 準備
- handai.mail.okuruyou@gmail.com で GitHub アカウントを作成（または既存の部アカウント）。
- 現リポジトリ `takos-mone/reservation-app` を部アカウントへ **Transfer**
  （Settings → General → Danger Zone → Transfer ownership）。
  もしくは部アカウントで新規リポジトリを作り push し直す。

### 2. 公開リポジトリにする
- Settings → General → Danger Zone → **Change repository visibility → Public**。
- 公開前チェック（済）: `.env`・SAキー(`*adminsdk*.json`)は `.gitignore` 済みで履歴にも無い。

### 3. 支出上限を$0に固定（保険）
- 部アカウントの Settings → Billing and plans → **Spending limit** を $0 のまま維持（既定）。
- 支払い方法は登録しない。これで構造的に課金不可。

### 4. Secrets を設定（スクレイパー復旧の必須作業）
リポジトリ Settings → Secrets and variables → Actions → New repository secret:

| 名前 | 値 |
|---|---|
| `RESV_USER_ID` | `1188` |
| `RESV_PASSWORD` | `cB8V` |
| `FIREBASE_SERVICE_ACCOUNT` | **再生成した** SA キー JSON の中身（下記） |

### 5. SA キーの再生成（現在0バイトで壊れている）
- Firebase コンソール → プロジェクト設定 → サービスアカウント → **新しい秘密鍵を生成**。
- ダウンロードした JSON の中身を丸ごと `FIREBASE_SERVICE_ACCOUNT` に貼り付け。
- ローカルの0バイトファイル `oumkeion-reservation-app-firebase-adminsdk-*.json` は使わない（gitignore済み）。

### 6. 動作確認
- Actions タブ → 「Nightly Scrape」→ **Run workflow**（手動実行 `workflow_dispatch`）。
- 成功すれば `public/htmls/lecture-hall.json` が更新コミットされ、
  アプリ上部の「36時間以上更新されていません」警告が消える（Firestore `settings/lectureHall` も更新）。

## 注意
- 公開リポジトリでは Actions ログも公開される。ログに認証情報を出力しないこと（現状のスクレイパーは出力していない）。
- 60日間コミットが無いと GitHub がスケジュールを自動停止する。本ワークフローは毎晩JSONをコミットするため回避済み。
