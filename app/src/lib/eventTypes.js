// 予約種別の定義（旧 script.js の EVENT_TYPES と同じ値。既存 Firestore データと互換）
export const EVENT_TYPES = {
  CONFIRMED: 'confirmed', // 部室確定枠（週1件まで）
  REQUEST: 'request', //   部室希望枠（0:00〜9:00 限定）
  FIXED: 'fixed', //       固定枠（管理者のみ）
  PERSONAL: 'personal', // 個人練習枠
  NO_SOUND: 'no-sound', // 音出し禁止時間（予約不可、管理者のみ設定）
}

export const TYPE_LABELS = {
  [EVENT_TYPES.CONFIRMED]: '部室確定枠',
  [EVENT_TYPES.REQUEST]: '部室希望枠',
  [EVENT_TYPES.FIXED]: '固定枠',
  [EVENT_TYPES.PERSONAL]: '個人練習枠',
  [EVENT_TYPES.NO_SOUND]: '音出し禁止',
}

// 旧アプリ(eventDidMount)の配色を継承
export const TYPE_COLORS = {
  [EVENT_TYPES.CONFIRMED]: '#FFB6C1',
  [EVENT_TYPES.REQUEST]: '#CDE6C7',
  [EVENT_TYPES.FIXED]: '#FFF5D2',
  [EVENT_TYPES.PERSONAL]: '#87CEEB',
  [EVENT_TYPES.NO_SOUND]: '#B0B0B0',
}

// 部員が予約フォームで選べる種別（固定枠・音出し禁止は管理者専用）
export const MEMBER_SELECTABLE_TYPES = [
  EVENT_TYPES.CONFIRMED,
  EVENT_TYPES.REQUEST,
  EVENT_TYPES.PERSONAL,
]

// 管理者のみ操作可能（保護枠）。非管理者には削除ボタンを表示しない。
export const PROTECTED_TYPES = [EVENT_TYPES.FIXED, EVENT_TYPES.NO_SOUND]
