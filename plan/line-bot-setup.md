# LINE bot セットアップ手順

コードは `functions/` に実装済み。動かすには以下の手順が必要です（すべてあなたのアカウントでの操作）。

## できること（v1）

| トークで送る | botの応答 |
|---|---|
| `今日` | 今日の部室予約一覧＋音出し禁止時間 |
| `今週` | 今週7日分の部室予約一覧 |
| `音出し` | 今日・明日の音出し禁止時間（それ以外=音出し可能） |
| `通知オン` | そのトークに**毎朝7:30**、当日のまとめを自動配信 |
| `通知オフ` | 配信停止 |
| `ヘルプ` | 使い方 |

- バンドのLINEグループに招待すれば、グループ内で上記コマンドが使えます
- コマンド以外の雑談には反応しません（グループの邪魔をしない）
- データは予約サイトと同じ Firestore をリアルタイム参照（常に最新）

## 手順

### 1. Firebase を Blaze プランに変更（Cloud Functions に必須）

- [Firebase Console](https://console.firebase.google.com/) → プロジェクト `oumkeion-reservation-app` → 左下「アップグレード」→ Blaze（従量課金）
- クレジットカード登録が必要。**この規模の利用なら実質無料枠内**（Functions 月200万回呼び出しまで無料）

### 2. LINE Developers でチャネル作成

1. https://developers.line.biz/ にログイン（LINEアカウントでOK）
2. プロバイダーを作成（例: 「軽音部」）
3. **Messaging API チャネル**を作成（名前例: 軽音部bot）
4. 「Messaging API設定」タブで:
   - **チャネルアクセストークン（長期）**を発行 → 控える
   - 「グループ・複数人トークへの参加を許可する」を**オン**
   - 応答メッセージ（自動応答）を**オフ**、Webhookを**オン**
5. 「チャネル基本設定」タブの**チャネルシークレット**を控える

### 3. シークレット登録とデプロイ（ローカルのターミナルで）

```bash
cd final_reservation_system
npm install -g firebase-tools   # 未インストールなら
firebase login

# シークレット登録（対話で値を貼り付け）
firebase functions:secrets:set LINE_CHANNEL_SECRET
firebase functions:secrets:set LINE_CHANNEL_ACCESS_TOKEN

# デプロイ（firestore.rules も未反映なら一緒に）
firebase deploy --only functions,firestore:rules
```

デプロイ完了時に表示される `lineWebhook` のURL（`https://asia-northeast1-oumkeion-reservation-app.cloudfunctions.net/lineWebhook`）を控える。

### 4. Webhook URL を設定

- LINE Developers → Messaging API設定 → Webhook URL に上記URLを入力 → 「検証」ボタンで成功を確認

### 5. 動作確認

1. QRコードからbotを友だち追加 → 「今日」と送って予約一覧が返ることを確認
2. バンドのグループにbotを招待 → あいさつが届く → 「通知オン」で毎朝配信を登録

## 運用メモ

- 配信先は Firestore の `lineNotifyTargets` コレクションに保存されます（クライアントからは読み書き不可、Functions のみ）
- 応答が返らない場合: Firebase Console → Functions → ログ を確認
- 将来の拡張候補: LINEから予約作成、予約前日のリマインド、狙い表明の競合通知
