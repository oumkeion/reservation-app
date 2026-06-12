// 予約ルールの検証（旧 script.js validateReservation の移植）
// 戻り値: エラーメッセージ文字列 / 問題なければ null
import { EVENT_TYPES } from '../../lib/eventTypes'

const DAY_MS = 24 * 60 * 60 * 1000

export function validateReservation({ type, start, now, uid, isAdmin, allEvents }) {
  if (type === EVENT_TYPES.FIXED && !isAdmin) {
    return '固定枠は管理者のみ予約できます。'
  }

  if (type === EVENT_TYPES.CONFIRMED) {
    if ((start - now) / DAY_MS > 7) {
      return '確定枠は1週間先までしか予約できません。'
    }
    // 同一ユーザーが終了していない確定枠をすでに持っていれば不可（週1ルール）
    const existing = allEvents.find(
      (e) =>
        e.extendedProps?.type === EVENT_TYPES.CONFIRMED &&
        e.createdByUid === uid &&
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
    // 使用日のちょうど1週間前の日の 0:00〜9:00 のみ予約操作できる
    const oneWeekBefore = new Date(start.getTime() - 7 * DAY_MS)
    const isSameDate = now.toDateString() === oneWeekBefore.toDateString()
    const isBetweenMidnightAnd9AM = now.getHours() >= 0 && now.getHours() < 9
    if (!(isSameDate && isBetweenMidnightAnd9AM)) {
      return '希望枠は使用日の1週間前、0:00〜9:00の間のみ予約可能です。'
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
