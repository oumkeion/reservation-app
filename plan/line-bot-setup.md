# LINE bot セットアップ手順（Google Apps Script 版・完全無料）

コードは `gas/` に実装済み。要件と設計は `plan/line-bot-requirements.md` を参照。
以下はすべてあなたのGoogleアカウント/LINEアカウントでの操作です（所要 約30分）。

## できること

| トークで送る | botの応答 |
|---|---|
| `今日` / `今週` / `音出し` | 予約状況・音出し禁止時間の照会 |
| `予約 6/15 19:00-21:00 バンド名 記入者名` | 部室確定枠の予約（Webと同じルールで検証） |
| `調整 バンド名` | 調エモンシートを自動作成して共有リンクを返信 |
| `調整結果` | 全員が参加できる時間帯を集計して返信 |
| `通知オン` / `通知オフ` | 予約前日20時のリマインド配信を設定 |
| `ヘルプ` | 使い方 |

## 手順

### 0. 事前準備: サービスアカウント鍵の再発行
ローカルの `oumkeion-...-adminsdk-...json` は**中身が空**でした。新しい鍵が必要です:
- [Firebase Console](https://console.firebase.google.com/) → `oumkeion-reservation-app` → ⚙️ プロジェクトの設定 → サービスアカウント → **新しい秘密鍵の生成**
- ダウンロードしたJSONは安全な場所に保管（**リポジトリに置かない**。GitHub Secrets の `FIREBASE_SERVICE_ACCOUNT` にも同じものを登録すると講義棟スクレイプのFirestore連携も動き出します）

### 1. GAS プロジェクト作成とコード反映

```bash
cd final_reservation_system/gas
npx @google/clasp login          # ブラウザでGoogleログイン
npx @google/clasp create --type webapp --title "軽音部LINEbot"
npx @google/clasp push           # gas/ のコードをアップロード
```

※ https://script.google.com/home/usersettings で「Google Apps Script API」をオンにしておくこと。

### 2. Script Properties の設定
GASエディタ（`npx @google/clasp open`）→ ⚙️ プロジェクトの設定 → スクリプト プロパティ:

| キー | 値 |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | 手順0のサービスアカウントJSONの中身（全文貼り付け） |
| `LINE_CHANNEL_ACCESS_TOKEN` | 手順4で取得 |
| `WEBHOOK_TOKEN` | 長いランダム文字列（例: `openssl rand -hex 24` の出力） |
| `CHOEMON_TEMPLATE_ID` | 調エモンテンプレのID（URLの `/d/` と `/edit` の間の文字列） |

### 3. Web App デプロイ
GASエディタ → デプロイ → 新しいデプロイ → 種類: ウェブアプリ
- 実行ユーザー: **自分**
- アクセスできるユーザー: **全員**
- デプロイ後のURLを控える → Webhook URL は `<URL>?token=<WEBHOOK_TOKEN>`

### 4. LINE Developers でチャネル作成
1. https://developers.line.biz/ にLINEアカウントでログイン → プロバイダー作成（例: 軽音部）
2. **Messaging API チャネル**を作成（名前例: 軽音部bot）
3. 「Messaging API設定」タブ:
   - チャネルアクセストークン（長期）を発行 → Script Properties に登録
   - Webhook URL に手順3のURL（token付き）を設定 → 「検証」で成功を確認 → Webhook **オン**
   - 応答メッセージ（自動応答）を**オフ**
   - 「グループ・複数人トークへの参加を許可」を**オン**

### 5. トリガー設置（前日リマインド用）
GASエディタで `setupTriggers` 関数を選択して1回実行（初回は権限承認ダイアログが出る）。

### 6. 動作確認
1. QRコードでbotを友だち追加 → `ヘルプ` → 使い方が返る
2. `今日` → 予約一覧が返る（Firestoreアクセスの確認）
3. `調整 テストバンド` → シートが作成されリンクが返る（Drive権限の確認）
4. バンドのグループにbotを招待 → `通知オン`

## トラブルシューティング
- 返信が来ない → GASエディタ左メニュー「実行数」で doPost のエラーログを確認
- `Firestore API 403` → サービスアカウントJSONの貼り付けミス、または鍵が無効
- `調整` が失敗 → CHOEMON_TEMPLATE_ID の確認、テンプレシートへのアクセス権を確認
- コード更新時は `clasp push` → デプロイ → **デプロイを管理 → 編集 → 新バージョン**で反映
