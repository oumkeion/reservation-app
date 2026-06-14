// 予約種別の定義（旧 script.js の EVENT_TYPES と同じ値。既存 Firestore データと互換）
export const EVENT_TYPES = {
  CONFIRMED: 'confirmed', // 部室確定枠（週1件まで）
  REQUEST: 'request', //   部室希望枠（0:00〜9:00 限定）
  FIXED: 'fixed', //       固定枠（管理者のみ）
  PERSONAL: 'personal', // 個人練習枠
  NO_SOUND: 'no-sound', // 音出し禁止時間（予約不可、管理者のみ設定）
  CLUB_EVENT: 'club-event', // 部のイベント（ミーティング・定演・新歓など、管理者設定）
}

export const TYPE_LABELS = {
  [EVENT_TYPES.CONFIRMED]: '部室確定枠',
  [EVENT_TYPES.REQUEST]: '部室希望枠',
  [EVENT_TYPES.FIXED]: '固定枠',
  [EVENT_TYPES.PERSONAL]: '個人練習枠',
  [EVENT_TYPES.NO_SOUND]: '音出し禁止',
  [EVENT_TYPES.CLUB_EVENT]: '部のイベント',
}

// 旧アプリ(eventDidMount)の配色を継承
export const TYPE_COLORS = {
  [EVENT_TYPES.CONFIRMED]: '#FFB6C1',
  [EVENT_TYPES.REQUEST]: '#CDE6C7',
  [EVENT_TYPES.FIXED]: '#FFF5D2',
  [EVENT_TYPES.PERSONAL]: '#87CEEB',
  [EVENT_TYPES.NO_SOUND]: '#B0B0B0',
  [EVENT_TYPES.CLUB_EVENT]: '#C5A3FF',
}

// 部員が予約フォームで選べる種別（固定枠・音出し禁止・部のイベントは管理者専用）
export const MEMBER_SELECTABLE_TYPES = [
  EVENT_TYPES.CONFIRMED,
  EVENT_TYPES.REQUEST,
  EVENT_TYPES.PERSONAL,
]

// 管理者のみ作成・編集・削除できる枠（保護枠）。非管理者には削除ボタンを表示しない。
export const PROTECTED_TYPES = [
  EVENT_TYPES.FIXED,
  EVENT_TYPES.NO_SOUND,
  EVENT_TYPES.CLUB_EVENT,
]

// 管理者が追加で選べる種別（保護枠）
export const ADMIN_SELECTABLE_TYPES = [
  EVENT_TYPES.FIXED,
  EVENT_TYPES.NO_SOUND,
  EVENT_TYPES.CLUB_EVENT,
]
