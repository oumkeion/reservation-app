// スロットロック: 二重予約を原子的に防ぐための 15 分単位の占有ドキュメント。
// docID = "YYYY-MM-DD_HHMM"（JST 15分グリッド）。
// 希望枠(request)・音出し禁止(no-sound)は部屋を占有しないためロックを取らない。
import { EVENT_TYPES } from '../lib/eventTypes'

const SLOT_MS = 15 * 60 * 1000

// 部屋を占有する（＝互いに排他になる）予約種別。ここに含まれる型だけがロックを取る。
export const LOCKING_TYPES = [
  EVENT_TYPES.CONFIRMED,
  EVENT_TYPES.FIXED,
  EVENT_TYPES.CLUB_EVENT,
  EVENT_TYPES.PERSONAL,
]

export function isLockingType(type) {
  return LOCKING_TYPES.includes(type)
}

// 予約の start/end 文字列を絶対時刻(Date)に変換する。
// ISO UTC（末尾 Z）はそのまま、naive 文字列（固定枠の "YYYY-MM-DDTHH:MM:SS"）は JST 壁時計として解釈。
function toInstant(s) {
  if (typeof s !== 'string') return new Date(s)
  return s.endsWith('Z') ? new Date(s) : new Date(`${s}+09:00`)
}

// JST の 15分スロットキー "YYYY-MM-DD_HHMM" を返す
function jstSlotKey(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (t) => parts.find((p) => p.type === t)?.value
  return `${get('year')}-${get('month')}-${get('day')}_${get('hour')}${get('minute')}`
}

// 予約が占有する 15分スロットキーの配列を返す（ロック対象外の型は空配列）。
export function slotKeysFor({ start, end, type }) {
  if (!isLockingType(type)) return []
  const startMs = toInstant(start).getTime()
  const endMs = toInstant(end).getTime()
  if (!(endMs > startMs)) return []
  const keys = []
  for (let t = startMs; t < endMs; t += SLOT_MS) {
    keys.push(jstSlotKey(new Date(t)))
  }
  return keys
}

// slotLocks ドキュメントの中身
export function lockPayload({ eventId, type, editor }) {
  return {
    eventId,
    type,
    editor: editor || '',
    createdAt: new Date().toISOString(),
  }
}
