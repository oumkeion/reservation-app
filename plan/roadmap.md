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
- 2026-06-12: **講義棟予約をメインカレンダーに統合＋表示時間を6:00〜22:00に変更**。
  - 別グリッド（`LectureHallGrid`）を廃止し、講義棟の予約を予約カレンダー本体に
    オレンジ（#FFD8A8）のイベントとして重ね表示（部屋名は「A講堂」等に短縮、クリック・編集不可）。
    データ取得は `useLectureHall` フックに集約（Firestore購読→静的JSONフォールバック、36時間鮮度警告は継続）。
  - 「講義棟の予約状況を表示」チェックボックスでON/OFF可能（デフォルトON）。凡例に「講義棟の予約」を追加。
  - 予約カレンダー・狙い表明カレンダーとも `slotMinTime=06:00` / `slotMaxTime=22:00` に変更（運用実態に合わせる）。
- 2026-06-12: **講義棟の詳細スクレイピング＋音出し禁止帯の自動生成**。
  - スクレイパーが各予約の詳細ページ（`rsvDetail.php`、ユニークID毎に1回）から
    **使用講座（団体名）・使用内容・課外活動の音出し可否**を取得し JSON に含める（取得失敗時は音出し不可扱い=安全側）。
  - **音出し禁止帯の自動計算**: 「音出し不可」の予約がどこかの部屋に入っている時間帯の日毎和集合を `noSound` として出力。
    Firestore 同期時に `events` コレクションへ `音出し禁止（講義棟使用中）` イベント（type: no-sound、
    `extendedProps.source: lectureHallAuto` マーク付き）として毎晩入れ替え同期。手動作成の音出し禁止には触れない。
    ※自動生成分は管理者が削除しても翌晩復活する仕様。
  - アプリ: 講義棟イベントのタイトルを「部屋：団体」に変更、クリックで詳細ダイアログ
    （部屋・団体・内容・時間・音出し可否）を表示。管理者には音出し禁止イベントを通常表示にして
    クリック→削除可能に（FullCalendarの背景イベントはクリック不可のため表示を切替）。
  - 検証: スクレイパー実機実行（60日分・詳細約450件・エラー0、noSound 47日分生成、6/15の和集合 07:00-20:00 を手計算と照合）✓ /
    ESLint・build ✓ / プレビューで詳細ダイアログ表示確認 ✓
  - 注意: 音出し禁止イベントの events への自動投入は `FIREBASE_SERVICE_ACCOUNT` 設定後の Actions 実行から有効。
  - **認証情報をコードから除去**: ログインID/PWのハードコードを廃止し、ローカルは `.env`（gitignore対象）、
    Actions は Secrets `RESV_USER_ID` / `RESV_PASSWORD` から読む方式に変更。
    ※旧ID/PWはgit履歴に残っているため、可能なら大学側でパスワード変更を推奨（履歴掃除は filter-repo 時に合わせて実施）。
- 2026-06-12: **音出し禁止帯の表示方式を修正（指摘対応）＋講義棟カレンダーをメインカレンダー下に復活**。
  - 問題: 音出し禁止帯を「Actions が Firestore の events に書き込む」方式にしていたため、
    Secrets 未設定の現段階では1件も表示されなかった。
  - 修正: **クライアント側でスクレイプデータ（noSound）から直接導出して灰色の背景イベントとして描画**する方式に変更。
    Secrets 設定を待たずに表示され、スクレイプデータと常に同期（=常に最新）。events への書き込み同期は廃止（スクレイパーから削除）。
  - メインカレンダーのオレンジ重ね表示（部屋別イベント）とトグルは廃止し、
    部屋別の**講義棟予約カレンダー（`LectureHallBoard`）をメインカレンダーの下に表示**。
    音出し不可=赤 / 音出し可=緑 で塗り分け、クリックで詳細（部屋・団体・内容・時間・音出し可否）。
  - 検証: プレビューで 6/12 の音出し禁止帯（07:00-17:10, 17:30-19:00）が背景表示されること、
    部屋別カレンダーのクリック詳細、ESLint・build を確認。
- 2026-06-12: **Phase 4着手: LINE bot 実装**（`functions/` に Cloud Functions v2 / Node 22）。
  - `lineWebhook`: 署名検証付きWebhook。コマンド応答=「今日」（予約＋音出し禁止）/「今週」/「音出し」/
    「通知オン・オフ」（`lineNotifyTargets` に登録）/「ヘルプ」。コマンド以外の雑談には反応しない。グループ招待時はあいさつ。
  - `dailyDigest`: 毎朝7:30 JST、通知オンのトークに当日まとめを push 配信。
  - メッセージ生成は純粋関数（`src/commands.js`）に分離し `npm test` で検証（全assertion通過）。
  - `firebase.json` に functions を追加。デプロイ手順は **`plan/line-bot-setup.md`** に整理
    （Blaze化・LINE Developersチャネル作成・secrets登録・deploy・Webhook URL設定はユーザー操作）。
- 2026-06-12: **LINE bot を GAS（完全無料）へ移行＋部誌＋バンド編集＋sound判定堅牢化**。
  - 無料化の再吟味: Blazeはカード必須 → **Google Apps Script を採用**（無料・カード不要・
    調エモンのSheets/Driveネイティブ連携が決め手）。Cloud Functions版（`functions/`）は削除。
    要件と選定理由は **`plan/line-bot-requirements.md`**、手順は `plan/line-bot-setup.md`（GAS版に全面改訂）。
  - `gas/` 実装: doPost（WEBHOOK_TOKENで認証※GASは署名検証不可のため）/ 照会（今日・今週・音出し）/
    **LINEから予約作成**（`予約 6/15 19:00-21:00 バンド名 記入者名`、Web版と同一の検証ルール）/
    **前日リマインド**（毎日20時トリガー、翌日に予約がある時のみpush）/
    **日程調整=調エモン流用**（`調整 バンド名`でテンプレ複製→リンク返信、`調整結果`で全員OK枠を集計返信）。
    Firestore はSA JWT(RS256)→RESTでアクセス。純粋ロジックは node テストで全assertion通過。
  - **部誌**（Xのようなつぶやき）: `posts` コレクション＋`JournalBoard`。タブ「掲示板」→「部誌」に変更。
    投稿=本文＋名前、削除=名前一致（管理者は無条件）。rules に posts 追加。
  - **バンド編集**: 名前・ジャンルを代表者名一致で編集可能に（`updateBand`、rules拡張）。
  - 音出し可否判定を `startswith("可")` に堅牢化＋分布ログ追加（現60日間は全件「不可」が実態と確認済み）。
  - **発見**: ローカルのSA鍵ファイルは中身が空（0バイト）。Firebase Consoleで**新しい秘密鍵の生成**が必要
    （GitHub Secrets と GAS Script Properties の両方に使う）。
- 2026-06-13: **スクレイパーの取りこぼし修正（音出し可の予約）**。音出し可の予約は style に
  `background-color:#3333ff;`（青）が付くため、`SCHEDULE_RE` が width 直後の閉じ引用符を要求して
  青ボックスを全件スキップしていた（448件中 可=0 と誤判定）。正規表現を緩和し、可予約20件を取得。
  講義棟ボードに緑（音出し可）が表示されるように。メインカレンダーは灰の音出し禁止帯のみに戻した。
- 2026-06-13: **ルール仕様準拠の機能追加一式**（[plan/audit.md](audit.md)に基づく）。
  - **操作ログ閲覧**（操作ログタブ）: 予約の追加/編集/削除＋バンド/部誌/狙い表明の操作を時系列表示。全部員閲覧可、ルールで改ざん禁止。
  - **予約の編集・移動UI**: 詳細ダイアログから編集（一般=記入者名一致、管理者=全件）。before/afterをログ記録。
  - **部のイベント枠**（club-event）: 管理者がミーティング/定演/新歓等を設定可能（保護枠）。
  - **管理者判定の統一**: rulesを `isAdmin()`（adminsコレクション）方式に統一（dailyMemos/settings/admins）。
  - **希望枠のJST固定**: 端末TZに依存せず日本時間で 0:00〜9:00 判定。
  - **固定枠の繰り返し・一括登録**: 管理者が曜日・時間・期間指定で一括生成（recurrenceGroupで一括削除可）。
  - **固定枠 変更・キャンセル申請→承認ワークフロー**: 一般部員が申請（fixedSlotRequests）、管理者が「固定枠申請」タブで承認/拒否。
    承認時に実際の固定枠を変更/削除。メール通知（handai.mail.okuruyou@gmail.com）はGAS `notifyFixedSlotRequests`（15分毎トリガー、要デプロイ）。
  - 未対応（ユーザー判断でスキップ）: 匿名運用のなりすまし対策（記入者名一致の限界）。
  - 検証: lint/build ✓ / 非管理者で管理者UIが非表示（権限ガード）✓ / 残る permission-denied は新ルール未デプロイによる既知事象。
- 2026-06-13: **本番デプロイ準備**。
  - メインカレンダーを「今日が左端」の7日ローリング表示に変更（`timeGrid` + `duration:{days:7}` のカスタムビュー `timeGridRolling`）。
  - `firebase.json` の hosting を `public`（旧バニラ版）から **`app/dist`（React新版）** に切替、SPAリライト追加。
    旧 `public/` サイトは退役。`.firebaserc` default は `oumkeion-reservation-app`（アプリ設定と一致）。
  - Firestore複合インデックスは不要（全クエリ単一フィールド）と確認。
  - `plan/deploy.md` 作成（初回 `firebase deploy --only firestore:rules,hosting`、更新は hosting のみ）。
  - 検証: lint/build ✓ / `app/dist` を静的配信して root・/assets・/htmls/lecture-hall.json が 200 ✓ /
    プレビューで今日(6/13)が左端表示・講義棟ボードの緑赤表示を確認 ✓。
  - LINE bot（`gas/`）は本デプロイに含めず、後から GAS に追加（Firebase側の変更不要）。
