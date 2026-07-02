// 予約ルールの検証（旧 script.js validateReservation の移植）
// 戻り値: エラーメッセージ文字列 / 問題なければ null
//
// 予約はログイン不要なので、確定枠の週1制限は「記入者名」の一致で判定する（旧アプリと同じ）。
import { EVENT_TYPES, PROTECTED_TYPES } from '../../lib/eventTypes'
import { isLockingType } from '../../models/slotLocks'

const DAY_MS = 24 * 60 * 60 * 1000

// start/end 文字列を絶対時刻(ms)に変換（ISO UTC はそのまま、naive は JST 壁時計）
function toMs(s) {
  if (s instanceof Date) return s.getTime()
  if (typeof s !== 'string') return new Date(s).getTime()
  return (s.endsWith('Z') ? new Date(s) : new Date(`${s}+09:00`)).getTime()
}

// 排他対象（部屋を占有する型）どうしの時間重複を検出し、先約イベントを返す。
// 希望枠(request)・音出し禁止(no-sound)は占有しないので対象外。
function findOverlap({ type, start, end, allEvents }) {
  if (!isLockingType(type)) return null
  const newStart = toMs(start)
  const newEnd = toMs(end)
  return allEvents.find((e) => {
    if (!isLockingType(e.extendedProps?.type)) return false
    const es = toMs(e.start)
    const ee = toMs(e.end)
    return es < newEnd && newStart < ee
  })
}

// 端末のタイムゾーンに依存せず JST の {dateStr:"YYYY-MM-DD", hour:0-23} を返す
function jstParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const get = (t) => parts.find((p) => p.type === t)?.value
  return { dateStr: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) }
}

export function validateReservation({ type, editor, start, end, now, isAdmin, allEvents }) {
  // 保護枠（固定枠・音出し禁止・部のイベント）は管理者のみ
  if (PROTECTED_TYPES.includes(type) && !isAdmin) {
    return 'この種別は管理者のみ設定できます。'
  }

  // 二重予約チェック（希望枠以外）。先約がある時間帯は選べない（早い者勝ち）。
  const overlap = findOverlap({ type, start, end, allEvents })
  if (overlap) {
    return `その時間帯はすでに予約されています（先約: ${overlap.title || '不明'}）。空いている時間を選んでください。`
  }

  if (type === EVENT_TYPES.CONFIRMED) {
    if ((start - now) / DAY_MS > 7) {
      return '確定枠は1週間先までしか予約できません。'
    }
    // 同一記入者が終了していない確定枠をすでに持っていれば不可（週1ルール）
    const existing = allEvents.find(
      (e) =>
        e.extendedProps?.type === EVENT_TYPES.CONFIRMED &&
        e.extendedProps?.editor === editor &&
        new Date(e.end) > now,
    )
    if (existing) {
      return (
        `あなたはすでに確定枠の予約（バンド名: ${existing.title}）を保持しているため、新たな予約はできません。\n` +
        'その予約が終了してから再度お試しください。'
      )
    }
  }

  if (type === EVENT_TYPES.REQUEST) {
    // 使用日のちょうど1週間前の日の 0:00〜9:00（JST）のみ予約操作できる
    const oneWeekBefore = new Date(start.getTime() - 7 * DAY_MS)
    const nowJst = jstParts(now)
    const targetJst = jstParts(oneWeekBefore)
    const isSameDate = nowJst.dateStr === targetJst.dateStr
    const isBetweenMidnightAnd9AM = nowJst.hour >= 0 && nowJst.hour < 9
    if (!(isSameDate && isBetweenMidnightAnd9AM)) {
      return '希望枠は使用日の1週間前、0:00〜9:00（日本時間）の間のみ予約可能です。'
    }
  }

  if (type === EVENT_TYPES.PERSONAL) {
    // 利用日前日の 19:00 以降に予約できる
    const dayBefore = new Date(start)
    dayBefore.setDate(dayBefore.getDate() - 1)
    dayBefore.setHours(19, 0, 0, 0)
    if (now < dayBefore) {
      return '個人練習枠は利用日前日の19:00以降に予約できます。'
    }
  }

  return null
}
