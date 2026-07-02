# 追加実装計画（2026-07-02 / 承認済み方針）

## 決定事項（ユーザー確認済み）

1. **二重予約**: 希望枠(request)は重複可。それ以外（confirmed / fixed / club-event / personal）は互いに排他。
   音出し禁止(no-sound)は「部屋は使える」ため予約をブロックしない。
2. **スクレイパー課金**: 部アカウント(handai.mail.okuruyou@gmail.com)で **公開リポジトリ化 + 支出上限$0**。
3. **バンド選択**: 確定枠=バンド一覧から選択のみ。固定枠=一覧＋自由入力可。
4. 週1チェック=保留。なりすまし(脆弱性B)=未対応のまま。

## 実装

### A. 二重予約防止（スロットロック）
- 新コレクション `slotLocks`。docID = `YYYY-MM-DD_HHMM`（JST 15分グリッド）。
- ロック取得型（排他）= confirmed / fixed / club-event / personal。request / no-sound は取得しない。
- 予約作成/移動は `writeBatch`（event + 各スロットの lock を set）。
  lock が既存なら set→update 扱いになり rules で `update: if false` → バッチ全体が失敗 → 「その時間帯は既に予約されています」。
- 削除・移動時は lock を差分で解放/再取得。
- クライアント側 validation.js でも重複を事前検出し先約名を提示（UX）。ロックは原子的バックストップ。
- ファイル: `models/slotLocks.js`（キー計算）, `models/events.js`（全書き込み経路）, `features/calendar/validation.js`。

### B. events 購読の境界化 + 60日クリーンアップ
- `subscribeEvents` に `where('start','>=', 60日前ISO)`。
- rules: 60日超過の予約は誰でも delete 可（保護枠含む）。
- クライアント起動時に古い予約(+lock)を best-effort 削除（`cleanupOldEvents`）。

### C. バンド機能強化
- `genre` 廃止 → `songs`（演奏曲・任意）追加。`performanceDate`（ライブ本番日・任意）追加。
- 本番日を過ぎたバンドは自動ハード削除（延期は編集で変更／経過後は再登録）。
- 確定枠 ReserveDialog: バンド名を active バンドのドロップダウン（選択のみ）。
- 固定枠 FixedSlotBulkDialog: ドロップダウン＋自由入力。
- 共有フック `features/bands/useActiveBands.js`。

### D. スクレイパー: 公開リポジトリ＋$0（手順書 `plan/github-actions-free.md`）
- Firestore 書き込みは SA キーで動くため GitHub 所有者に依存しない。
- 0バイトの SA キー再生成 → Secrets 再設定が復旧の必須条件。

## 検証
- firestore.rules をエミュレータでテスト（既存22 + ロック/60日/バンド分を追加）。
- `npm --prefix app run build` → `firebase deploy --only firestore:rules,hosting`。
