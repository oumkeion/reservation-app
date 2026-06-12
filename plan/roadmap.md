# 軽音部予約システム 改良ロードマップ

最終更新: 2026-06-12

このドキュメントは「何を・どの順番で・なぜ作るか」をまとめた計画書です。
代替わりで引き継ぐ後輩も、まずこれを読めば全体像が分かるようにしています。

---

## 1. 目的

既存の部室予約サイトを作り直し、次の機能を追加する。

1. **日程調整ツール** … バンドのメンバーが空き日を出し合い、練習日を自動で見つける（Googleシート相当）
2. **バンド掲示板** … 現在いくつバンドがあるか一覧表示（枠の取りやすさを判断できる）
3. **狙い表明** … 予約ではないが「この時間を狙っている」と表明できる（競合状況が見える）
4. **一般掲示板** … 部内の連絡・お知らせ
5. **LINE連携bot** … 各バンドのLINEグループで事務作業を代替・効率化

---

## 2. 確定した方針

| 項目 | 決定 | 補足 |
|---|---|---|
| フロント基盤 | **React + Vite**（+ FullCalendar React版） | リアルタイム表示が多く、資料・AI支援が豊富で引き継ぎやすい |
| バックエンド | **Firebase を維持**（Firestore / Auth / Hosting） | 倉庫はそのまま。引っ越さない |
| デプロイ | **Firebase に一本化** | Netlify・旧prototypeは廃止 |
| LINE連携 | **最終フェーズに後回し** | Cloud Functions想定。まずWebを完成 |
| 最初に作る機能 | **バンド掲示板＋狙い表明** | |
| バンド登録 | **部員が自由に作成** | 重複・幽霊バンド対策で `status`(active/解散) フラグを持つ |
| 狙い表明の粒度 | **15分単位** | 予約と同じ時間軸。枠ごとにピンポイント競合表示 |
| 過去の予約データ | **（未確定）** おすすめ=新規スタート | 後付けでバンド名を貼る方式は手間が大きい |

### なぜ建て直すのか
現行 `public/script.js` は約4,400行の単一ファイルで、同じ処理が18回コピペされている。
この上に新機能5つを足すと破綻するため、先に基盤を整理する（Phase 0）。

---

## 3. 技術構成（目標）

```
reservation-app/
├─ src/
│  ├─ lib/firebase.js        # Firebase modular SDK 初期化（compat脱却）
│  ├─ features/
│  │   ├─ calendar/          # 予約カレンダー（既存ロジック移植）
│  │   ├─ bands/             # バンド掲示板（現存バンド一覧）
│  │   ├─ intents/           # 狙い表明
│  │   ├─ board/             # 一般掲示板
│  │   └─ admin/             # 固定枠・ログ・音出し禁止時間
│  ├─ models/                # Firestore型・変換
│  └─ app.jsx
├─ functions/                # LINE bot 用（Phase 4で追加）
├─ public/                   # ビルド成果物 / 静的ファイル
├─ docs/                     # 引継ぎ資料(.docx) など
├─ plan/                     # 本ファイルなど計画書
├─ archive/                  # 古い試作(prototype)の退避先
├─ firebase.json
└─ firestore.rules
```

---

## 4. データモデル（Firestore）

新機能はすべて「ユーザー／バンド／所属」の上に乗る。これが基盤の核。

| コレクション | 主なフィールド | 用途 |
|---|---|---|
| `users` | uid, displayName, email, role(member/admin), lineUserId?(後) | Google認証のuidを土台に |
| `bands` | name, memberUids[], genre, status(active/解散), createdByUid, createdAt | バンド掲示板＝現存バンド数の可視化 |
| `events`（既存に追加） | + bandId, type, start/end, createdByUid, editorName, comment | 予約。バンドと紐付け |
| `slotIntents`（新） | uid, bandId, date, slot(15分), createdAt, note | 狙い表明＝枠ごとの希望者数を集計表示 |
| `posts`（新） | authorUid, title, body, pinned, createdAt | 一般掲示板 |
| `dailyMemos` / `logs` / `admins` / `settings` | 既存維持 | 日付メモ・操作ログ・管理者・お知らせ |

### 補足
- バンドは誰でも作成可 → 一覧は `status == active` のみカウント。解散ボタンを用意。
- 同名バンド作成時は軽く警告（強制はしない）。
- 狙い表明は予約と同じ15分グリッド → 「予約済み1・狙ってる人3」のように表示可能。

---

## 5. フェーズ計画

| フェーズ | 内容 | ひとことで |
|---|---|---|
| **Phase 0** | React+Vite雛形 / Firebase modular化 / `users`・`bands`・所属モデル / 既存予約カレンダーの移植 | 基礎工事 |
| **Phase 1** | バンド掲示板＋狙い表明（リアルタイム） / 解散フラグ | 最初に欲しい機能 |
| **Phase 2** | 一般掲示板・部室情報 | 連絡まわり |
| **Phase 3** | 日程調整ツール（空き共有→最適枠算出） | Googleシート相当 |
| **Phase 4** | LINE bot連携（Cloud Functions＋Messaging API、要Blazeプラン＋LINE Developers登録） | 仕上げ |

---

## 6. セキュリティ対応の記録

- **2026-06-12**: GitHub履歴（コミット `67064d6` / `93d19ad` / `87fe510`）に
  GCPサービスアカウント秘密鍵 `local/keion-otokinextractor-ai-27cf337ca1fb.json`
  （プロジェクト `keion-otokinextractor-ai`、鍵ID `27cf337ca1fb...`）が含まれていたことを確認。
  リポジトリは **Public**。
- **対応済み**: 該当鍵を Google Cloud Console で**無効化**（ユーザー実施）。
- **未対応（後日・接続環境で）**: git履歴からの鍵ファイル完全削除（`git filter-repo`）＋ force push。
  ※鍵は無効化済みのため、悪用リスクは解消済み。履歴掃除は念のための作業。

### `.gitignore` 注意
現行 `.gitignore` の `*.json` は「全ての.jsonを無視」する設定。
React導入時に `package.json` が無視されないよう、履歴クリーンアップと合わせて修正する。

---

## 7. リポジトリ集約方針

- 唯一の置き場: **https://github.com/takos-mone/reservation-app**（`final_reservation_system` が接続済み）
- コード・資料・計画・過去物をこの1リポジトリに集約（`docs/` `plan/` `archive/`）
- 予約やバンドの**実データは GitHub ではなく Firebase に蓄積**される（GitHubはコードと書類の置き場）

---

## 8. 残課題（着手前に決める / 後日対応）

1. 過去の予約データの扱い（新規スタート推奨）
2. git履歴の鍵クリーンアップ＋ `.gitignore` 修正（接続環境で）
3. 現行版コミット `81e7116`（ローカルのみ）の push（接続環境で）

---

## 9. 進捗ログ

- 2026-06-12: 開発方針を確定。現行版を `81e7116` としてローカル記録。流出鍵を無効化。本ロードマップ作成。
- 2026-06-12: **Phase 0 実装**。`app/` に React + Vite 新アプリを構築（本番 `public/` は無変更で並行稼働）。
  - Firebase modular SDK 初期化 / Google認証 + `users` プロファイル自動作成 / `bands` モデル
  - 予約カレンダー移植（15分選択・種別色分け・予約ルール検証・詳細/削除）
  - `firestore.rules` に users/bands を追加、events の削除条件を `createdByUid` に修正（**デプロイは未実施**）
  - `.gitignore` の `*.json` 全無視を撤廃し、鍵ファイルだけを除外する方式に修正
  - 検証: ESLint ✓ / `npm run build` ✓ / dev サーバ起動・描画・コンソールエラーなし ✓
  - 注意: 新アプリのログイン機能を本番で使うには `firebase deploy --only firestore:rules` が必要
