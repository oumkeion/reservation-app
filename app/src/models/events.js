// events / logs コレクションへの読み書き
// 予約はログイン不要（匿名）。ドキュメント形式は旧アプリと互換:
//   { title, start, end, allDay, extendedProps: { type, comment, editor } }
import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  onSnapshot,
  writeBatch,
  getDocs,
  query,
  where,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { EVENT_TYPES } from '../lib/eventTypes'

// "YYYY-MM-DD"（ローカル日付）
function dateStr(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// events をリアルタイム購読し、FullCalendar 形式の配列でコールバックに渡す
export function subscribeEvents(onChange, onError) {
  return onSnapshot(
    collection(db, 'events'),
    (snapshot) => {
      const events = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      onChange(events)
    },
    onError,
  )
}

export async function addEvent({ title, start, end, type, comment, editor }) {
  const event = {
    title,
    start,
    end,
    allDay: false,
    extendedProps: { type, comment, editor },
  }
  const ref = await addDoc(collection(db, 'events'), event)
  await addLog('予約追加', { editor, before: null, after: summarize({ id: ref.id, ...event }) })
  return ref.id
}

// 予約の編集（時間移動・内容変更）。before/after を両方ログに残す。
export async function updateEvent(event, changes, editorName) {
  const before = summarize(event)
  const next = {
    title: changes.title ?? event.title,
    start: changes.start ?? event.start,
    end: changes.end ?? event.end,
    extendedProps: {
      type: changes.type ?? event.extendedProps?.type,
      comment: changes.comment ?? event.extendedProps?.comment ?? '',
      editor: changes.editor ?? event.extendedProps?.editor ?? '',
    },
  }
  await updateDoc(doc(db, 'events', event.id), next)
  await addLog('編集', {
    editor: editorName,
    before,
    after: summarize({ id: event.id, ...next }),
  })
}

export async function deleteEvent(event, deleterName) {
  await deleteDoc(doc(db, 'events', event.id))
  await addLog('削除', { editor: deleterName, before: summarize(event), after: null })
}

// 固定枠の繰り返し一括登録（管理者専用）。
// weekday: 0(日)〜6(土) / startTime,endTime: "HH:MM" / startDate,endDate: "YYYY-MM-DD"
// 同じ recurrenceGroup を付与し、後でまとめて削除できるようにする。
export async function addRecurringFixedSlots({
  title,
  weekday,
  startTime,
  endTime,
  startDate,
  endDate,
  comment,
  editor,
}) {
  const group = `fixed-${Date.now()}`
  const events = []
  const cursor = new Date(`${startDate}T00:00:00`)
  const last = new Date(`${endDate}T00:00:00`)
  while (cursor <= last) {
    if (cursor.getDay() === weekday) {
      const ds = dateStr(cursor)
      events.push({
        title,
        start: `${ds}T${startTime}:00`,
        end: `${ds}T${endTime}:00`,
        allDay: false,
        extendedProps: {
          type: EVENT_TYPES.FIXED,
          comment: comment || '',
          editor,
          recurrenceGroup: group,
        },
      })
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  if (events.length === 0) return 0

  const batch = writeBatch(db)
  for (const ev of events) {
    batch.set(doc(collection(db, 'events')), ev)
  }
  await batch.commit()
  await addLog('固定枠一括登録', {
    editor,
    before: null,
    after: {
      title,
      type: EVENT_TYPES.FIXED,
      start: events[0].start,
      end: events[events.length - 1].end,
      comment: `${events.length}件（毎週・${startDate}〜${endDate}）`,
    },
  })
  return events.length
}

// 繰り返しグループをまとめて削除（管理者専用）
export async function deleteRecurrenceGroup(group, deleterName) {
  const snap = await getDocs(
    query(collection(db, 'events'), where('extendedProps.recurrenceGroup', '==', group)),
  )
  if (snap.empty) return 0
  const batch = writeBatch(db)
  snap.forEach((d) => batch.delete(d.ref))
  await batch.commit()
  await addLog('固定枠一括削除', {
    editor: deleterName,
    before: { title: '固定枠（繰り返し）', type: EVENT_TYPES.FIXED, comment: `${snap.size}件を削除` },
    after: null,
  })
  return snap.size
}

// 予約イベント → ログ用の要約（バンド名・種別・コメント・日時）
function summarize(event) {
  if (!event) return null
  return {
    id: event.id || null,
    title: event.title || '',
    type: event.extendedProps?.type || '',
    comment: event.extendedProps?.comment || '',
    start: event.start || null,
    end: event.end || null,
  }
}

// 操作ログ（logs コレクション）。createdAt(ISO)で並び替え可能、timestampは表示用。
async function addLog(action, { editor, before, after }) {
  try {
    await addDoc(collection(db, 'logs'), {
      createdAt: new Date().toISOString(),
      timestamp: new Date().toLocaleString('ja-JP'),
      action,
      editor: editor || '不明',
      before: before || null,
      after: after || null,
      // 旧ビューア互換のため主対象の要約も残す
      event: after || before || null,
    })
  } catch (err) {
    // ログ失敗は予約自体の成否に影響させない
    console.warn('ログの記録に失敗しました:', err)
  }
}
