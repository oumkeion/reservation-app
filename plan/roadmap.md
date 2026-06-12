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
- 2026-06-12: **認証モデル修正＋Phase 1実装**。
  - **重要な修正**: Googleログインは「管理者操作専用」（固定枠・音出し禁止の設定、保護枠の確認なし削除）に限定。
    通常の部室予約はログイン不要・匿名（記入者名を手入力、削除は本人確認の名前一致）に戻した。
    - `validation.js`: シグネチャを `{ type, editor, ... }` に変更、確定枠の週1判定を `editor` 名一致で行う
    - `ReserveDialog.jsx`: 記入者名入力欄を追加、`profile` 依存を廃止
    - `EventDetailDialog.jsx`: 削除ロジックを「保護枠(固定枠/音出し禁止)は管理者のみボタン表示、それ以外は記入者名一致で本人確認」に変更
    - `events.js`: `uid`/`createdByUid` を廃止（予約は匿名）
    - `firestore.rules`: events の create/update/delete を匿名許可に変更。固定枠・音出し禁止のみ `admins` コレクション(メールキー)による管理者チェックを要求
  - **講義棟予約カレンダー埋め込み（必須要件）**: `LectureHallEmbed.jsx` で旧 `#reservationEmbed` を移植。
    `vite.config.js` に dev 用ミドルウェアを追加して `public/htmls/*.html`（34MB）を複製せず `/htmls/*` として配信。
    ビルド後は `scripts/copy-htmls.mjs` で `dist/htmls` にコピー（`package.json` の `build` スクリプトに統合）。
  - **Phase 1: バンド掲示板＋狙い表明**。
    - `bands` モデルをログイン不要に修正（`representative` 代表者名を手入力、`uid`/`memberUids` 廃止）。
      解散は代表者名一致の本人確認後 `status: disbanded` に更新。
    - `BandBoard.jsx` / `CreateBandDialog.jsx`: バンド一覧表示・登録・解散
    - `slotIntents` コレクション新設（`models/intents.js`）。15分グリッドで「狙い表明」を匿名で登録・削除可能（複数バンドが同じ枠を宣言できる）
    - `IntentBoard.jsx` / `IntentDialog.jsx` / `IntentDetailDialog.jsx`: 専用カレンダー（`slotEventOverlap: false` で並列表示）
    - `firestore.rules`: `bands`(create自由・updateはstatus=disbandedのみ) / `slotIntents`(read/create/delete自由) を追加
  - 検証: ESLint ✓ / `npm run build` ✓ / dev サーバでカレンダー予約フロー（ログイン無し・記入者名入力）・講義棟埋め込み(`/htmls/*`配信確認)・バンド一覧/狙い表明カレンダー描画を確認
  - 既知の制約: `bands`/`slotIntents`/`users` を含む新ルールは未デプロイのため、本番Firebaseでは現時点で permission-denied になる（デプロイ時に解消）
- 2026-06-12: **講義棟予約の構造化表示＋夜間更新の復旧**。
  - 夜間スクレイピングが2025-09-20から停止していた原因を特定:
    ①`requirements.txt` が「Remove unnecessary files」で削除され `pip install` が失敗 ②60日無コミットでスケジュール自動停止。
    `requirements.txt`（requests）を復元。**GitHub Actions の再有効化（Enable workflow）はユーザー操作待ち**。
  - スクレイパーをローカル実行して最新60日分（2026-06-12〜08-10）を取得・コミット（`f74c9a1`）。
  - `scraper_requests.py` に構造化抽出を追加: 日次HTMLの `.scScheduleBox` の left/width（54px=1時間、07:00起点）を
    パースして `public/htmls/lecture-hall.json`（部屋10室×60日分の予約時間帯）を生成。`--rebuild-json` で再生成可。
  - 新アプリに `LectureHallGrid.jsx` を追加: 日付選択→10部屋×07:00〜22:00の横棒グリッドで空き状況を一目表示。
    iframe（`LectureHallEmbed`）は `<details>` 折りたたみのフォールバックに格下げ。
  - 制約: 表示は「埋まり/空き」のみ（日次ビューに予約タイトルが無いため）。鮮度は夜間取得時点。
- 2026-06-12: **講義棟パイプラインの頑健化（Firestore化・HTML廃止）**。方式比較の結果、GitHub Actions は維持しつつスリム化:
  - スクレイパーを全面書き換え: HTMLスナップショット生成（34MB/日）と CSS/JS インライン化を廃止、
    ログイン1回のセッション再利用で60日分をパース→ `lecture-hall.json` のみ生成。
    `FIREBASE_SERVICE_ACCOUNT` 環境変数があれば **Firestore `settings/lectureHall` に直接書き込み**。
    妥当性チェック付き（部屋0件 or 過半数失敗で異常終了 → Actions が失敗としてメール通知）。
    ログインID/PWは環境変数 `RESV_USER_ID`/`RESV_PASSWORD` で上書き可能（デフォルトは部共有値）。
  - ワークフローを `nightly-scrape.yml` に改名・簡素化: **firebase deploy を廃止**、
    checkout→python→pip→scrape(Firestore書込)→JSONのみcommit（バックアップ兼cron自動停止の予防）の4段に。
  - アプリ: `LectureHallGrid` を Firestore `onSnapshot` 購読に変更（リアルタイム反映）。
    読めない場合は `/htmls/lecture-hall.json` にフォールバック。
    **updatedAt が36時間超なら画面に警告表示**（沈黙する故障の可視化）。iframe（`LectureHallEmbed`）は削除。
  - `firestore.rules` に `settings/lectureHall`（read公開・client書込禁止）を追加。
  - `public/htmls/*.html`（34MB・60ファイル）を git rm。
    ※本番の旧サイトのiframe機能は2025-09以降すでに事実上死んでいたため退行なし。履歴上の34MBは後日の filter-repo で掃除。
  - 検証: スクレイパー実行（60日分・10部屋・エラー0）✓ / ESLint・build ✓ /
    プレビューで Firestore権限なし→フォールバック→グリッド描画・鮮度警告なし（新鮮データ）を確認 ✓
  - 残: GitHub側で ①「Nightly Scrape」ワークフローの Enable ②`FIREBASE_SERVICE_ACCOUNT` シークレットが
    プロジェクト `oumkeion-reservation-app` の有効なサービスアカウントJSONであることの確認（無効化した鍵なら差し替え）
