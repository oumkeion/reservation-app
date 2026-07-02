# 夜間スクレイパーを「GitHub Organization + 完全無料」で回す手順

決定: **GitHub Organization を新設し、あなたと部アカウント(handai.mail.okuruyou@gmail.com)を
両方 Owner として登録。リポジトリはその Organization 所有の公開リポジトリ + 支出上限$0**。

個人アカウント1つには「所有者」を2つ設定できない（GitHubのリポジトリは常に単一の所有者＝個人 or Organization）ため、
双方が対等な管理権限を持てる Organization を所有者にする方式にした。部活は代替わりするため、
特定個人に依存しない体制にもなる（引退時は Owner を入れ替えるだけで運営継続可能）。

git 履歴に秘密情報が無いことを確認済みのため公開しても安全（認証情報は GitHub Secrets＝暗号化 と `.env`＝gitignore のみ）。

## なぜ無料になるのか（根拠）

- **公開リポジトリの GitHub Actions は分数無制限で完全無料**（標準ランナー）。
- 仮に非公開でも、夜間ジョブは1回2〜3分 ≒ 月90分で、無料枠(月2,000分)の5%未満。
- GitHub の **Actions 支出上限は既定で$0**（Organization も同様）。超過しても課金されず、ワークフローが停止するだけ。
  課金には「上限引き上げ＋支払い方法登録」を自分で行う必要がある＝放置していれば絶対に課金されない。
- Firestore への書き込みは **SA キー（Firebase プロジェクト単位）** で行うため、GitHub の所有者が誰でも動く。

## セットアップ手順（あなたが実施）

### 1. Organization を新規作成
- あなたの GitHub アカウントでログインした状態で、右上「+」→ **New organization**。
- プラン: **Free**（人数無制限、Actions無料枠あり）を選択。
- Organization 名の例: `oumkeion` や `handai-keion` など部を表す名前（後から変更可）。
- 作成者のあなたが自動的に最初の Owner になる。

### 2. 部アカウントを Owner として招待
- Organization → Settings → **People** → **Invite member**。
- `handai.mail.okuruyou@gmail.com` を招待し、ロールを **Owner** に設定。
- 部アカウント側でメール招待を承認すれば、あなたと部アカウントが対等な Owner になる（＝実質的な二重所有）。
- 部の代替わり時はここで Owner を追加/削除するだけで引き継げる。

### 3. 既存リポジトリを Organization へ Transfer
- 現リポジトリ `takos-mone/reservation-app` の Settings → General → Danger Zone → **Transfer ownership**。
- 転送先に作成した Organization を指定。Issue・Star・Actions の実行履歴などはそのまま引き継がれる。
- Transfer後の新しい場所: `<organization名>/reservation-app`。以降のコマンド例やGit remoteのURLはこの新パスに変わる
  （ローカルの `origin` は `git remote set-url origin git@github.com:<organization名>/reservation-app.git` で更新）。

### 4. 公開リポジトリにする
- Organization配下のリポジトリの Settings → General → Danger Zone → **Change repository visibility → Public**。
- 公開前チェック（済）: `.env`・SAキー(`*adminsdk*.json`)は `.gitignore` 済みで履歴にも無い。

### 5. 支出上限を$0に固定（保険）
- Organization の Settings → Billing and plans → **Spending limit** を $0 のまま維持（既定）。
- 支払い方法は登録しない。これで構造的に課金不可。

### 6. Secrets を設定（スクレイパー復旧の必須作業）
Transfer後のリポジトリ Settings → Secrets and variables → Actions → New repository secret:

| 名前 | 値 |
|---|---|
| `RESV_USER_ID` | `1188` |
| `RESV_PASSWORD` | `cB8V` |
| `FIREBASE_SERVICE_ACCOUNT` | **再生成した** SA キー JSON の中身（下記） |

Organization への Transfer では Secrets は引き継がれないため、Transfer後に再設定が必要。

### 7. SA キーの再生成（現在0バイトで壊れている）
- Firebase コンソール → プロジェクト設定 → サービスアカウント → **新しい秘密鍵を生成**。
- ダウンロードした JSON の中身を丸ごと `FIREBASE_SERVICE_ACCOUNT` に貼り付け。
- ローカルの0バイトファイル `oumkeion-reservation-app-firebase-adminsdk-*.json` は使わない（gitignore済み）。

### 8. 動作確認
- Actions タブ → 「Nightly Scrape」→ **Run workflow**（手動実行 `workflow_dispatch`）。
- 成功すれば `public/htmls/lecture-hall.json` が更新コミットされ、
  アプリ上部の「36時間以上更新されていません」警告が消える（Firestore `settings/lectureHall` も更新）。

## 注意
- 公開リポジトリでは Actions ログも公開される。ログに認証情報を出力しないこと（現状のスクレイパーは出力していない）。
- 60日間コミットが無いと GitHub がスケジュールを自動停止する。本ワークフローは毎晩JSONをコミットするため回避済み。
