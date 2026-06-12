// 予約種別の定義（旧 script.js の EVENT_TYPES と同じ値。既存 Firestore データと互換）
export const EVENT_TYPES = {
  CONFIRMED: 'confirmed', // 部室確定枠（週1件まで）
  REQUEST: 'request', //   部室希望枠（0:00〜9:00 限定）
  FIXED: 'fixed', //       固定枠（管理者のみ）
  PERSONAL: 'personal', // 個人練習枠
  NO_SOUND: 'no-sound', // 音出し禁止時間（予約不可）
}

export const TYPE_LABELS = {
  [EVENT_TYPES.CONFIRMED]: '部室確定枠',
  [EVENT_TYPES.REQUEST]: '部室希望枠',
  [EVENT_TYPES.FIXED]: '固定枠',
  [EVENT_TYPES.PERSONAL]: '個人練習枠',
  [EVENT_TYPES.NO_SOUND]: '音出し禁止',
}

export const TYPE_COLORS = {
  [EVENT_TYPES.CONFIRMED]: '#1976d2',
  [EVENT_TYPES.REQUEST]: '#f9a825',
  [EVENT_TYPES.FIXED]: '#6a1b9a',
  [EVENT_TYPES.PERSONAL]: '#2e7d32',
  [EVENT_TYPES.NO_SOUND]: '#9e9e9e',
}

// 部員が予約フォームで選べる種別（固定枠・音出し禁止は管理者専用）
export const MEMBER_SELECTABLE_TYPES = [
  EVENT_TYPES.CONFIRMED,
  EVENT_TYPES.REQUEST,
  EVENT_TYPES.PERSONAL,
]
