// events / logs コレクションへの読み書き
// 予約はログイン不要（匿名）。ドキュメント形式は旧アプリと互換:
//   { title, start, end, allDay, extendedProps: { type, comment, editor } }
// 二重予約は slotLocks（15分単位の占有ドキュメント）を同一バッチで書き込むことで
// 原子的に防ぐ（希望枠は占有しないため対象外）。
import {
  collection,
  addDoc,
  doc,
  onSnapshot,
  writeBatch,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { EVENT_TYPES } from '../lib/eventTypes'
import { slotKeysFor, lockPayload } from './slotLocks'

// 60日より前の予約はクライアント側で購読しない（読み取り量の抑制）
const CLEANUP_DAYS = 60

// バッチの操作上限（Firestore は 500）。安全側で分割する。
const BATCH_LIMIT = 400

// 二重予約（スロット競合）を表すエラー
export class SlotConflictError extends Error {
  constructor(message = 'その時間帯はすでに予約されています。別の時間を選んでください。') {
    super(message)
    this.name = 'SlotConflictError'
  }
}

// permission-denied はルール上「lock が既存＝競合」を意味する（時間制約はクライアントで事前検証済み）
function asConflict(err) {
  if (err && err.code === 'permission-denied') return new SlotConflictError()
  return err
}

// "YYYY-MM-DD"（ローカル日付）
function dateStr(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// 60日前の ISO（購読フィルタ用）
function cutoffIso() {
  return new Date(Date.now() - CLEANUP_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

// events をリアルタイム購読し、FullCalendar 形式の配列でコールバックに渡す。
// 60日より前の予約は読み込まない（古いデータの肥大化を防ぐ）。
export function subscribeEvents(onChange, onError) {
  const q = query(collection(db, 'events'), where('start', '>=', cutoffIso()))
  return onSnapshot(
    q,
    (snapshot) => {
      const events = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      onChange(events)
    },
    onError,
  )
}

// 新規予約。event + 占有スロットの lock を同一バッチで書き込む。
// lock が既存なら（他の予約が占有中）バッチが失敗し SlotConflictError を投げる。
export async function addEvent({ title, start, end, type, comment, editor }) {
  const ref = doc(collection(db, 'events'))
  const event = {
    title,
    start,
    end,
    allDay: false,
    extendedProps: { type, comment, editor },
  }
  const keys = slotKeysFor({ start, end, type })
  const batch = writeBatch(db)
  batch.set(ref, event)
  for (const k of keys) {
    batch.set(doc(db, 'slotLocks', k), lockPayload({ eventId: ref.id, type, editor }))
  }
  try {
    await batch.commit()
  } catch (err) {
    throw asConflict(err)
  }
  await addLog('予約追加', { editor, before: null, after: summarize({ id: ref.id, ...event }) })
  return ref.id
}

// 予約の編集（時間移動・内容変更）。lock は差分で解放/再取得する。
export async function updateEvent(event, changes, editorName) {
  const before = summarize(event)
  const nextType = changes.type ?? event.extendedProps?.type
  const next = {
    title: changes.title ?? event.title,
    start: changes.start ?? event.start,
    end: changes.end ?? event.end,
    extendedProps: {
      type: nextType,
      comment: changes.comment ?? event.extendedProps?.comment ?? '',
      editor: changes.editor ?? event.extendedProps?.editor ?? '',
    },
  }
  const oldKeys = slotKeysFor({
    start: event.start,
    end: event.end,
    type: event.extendedProps?.type,
  })
  const newKeys = slotKeysFor({ start: next.start, end: next.end, type: nextType })
  const oldSet = new Set(oldKeys)
  const newSet = new Set(newKeys)

  const batch = writeBatch(db)
  batch.update(doc(db, 'events', event.id), next)
  for (const k of oldKeys) {
    if (!newSet.has(k)) batch.delete(doc(db, 'slotLocks', k))
  }
  for (const k of newKeys) {
    if (!oldSet.has(k)) {
      batch.set(
        doc(db, 'slotLocks', k),
        lockPayload({ eventId: event.id, type: nextType, editor: next.extendedProps.editor }),
      )
    }
  }
  try {
    await batch.commit()
  } catch (err) {
    throw asConflict(err)
  }
  await addLog('編集', {
    editor: editorName,
    before,
    after: summarize({ id: event.id, ...next }),
  })
}

export async function deleteEvent(event, deleterName) {
  const keys = slotKeysFor({
    start: event.start,
    end: event.end,
    type: event.extendedProps?.type,
  })
  const batch = writeBatch(db)
  batch.delete(doc(db, 'events', event.id))
  for (const k of keys) batch.delete(doc(db, 'slotLocks', k))
  await batch.commit()
  await addLog('削除', { editor: deleterName, before: summarize(event), after: null })
}

// ID指定で削除（固定枠申請の承認などで使用）。ログ用に内容を取得してから削除する。
export async function deleteEventById(eventId, deleterName) {
  const ref = doc(db, 'events', eventId)
  const snap = await getDoc(ref)
  const event = snap.exists() ? { id: eventId, ...snap.data() } : { id: eventId }
  const keys = slotKeysFor({
    start: event.start,
    end: event.end,
    type: event.extendedProps?.type,
  })
  const batch = writeBatch(db)
  batch.delete(ref)
  for (const k of keys) batch.delete(doc(db, 'slotLocks', k))
  await batch.commit()
  await addLog('削除', { editor: deleterName, before: summarize(event), after: null })
}

// ID指定で時間を変更（固定枠の変更申請の承認で使用）。lock も差分で更新する。
export async function updateEventTime(eventId, start, end, editorName) {
  const ref = doc(db, 'events', eventId)
  const snap = await getDoc(ref)
  const event = snap.exists() ? { id: eventId, ...snap.data() } : null
  if (!event) return
  const type = event.extendedProps?.type
  const oldKeys = slotKeysFor({ start: event.start, end: event.end, type })
  const newKeys = slotKeysFor({ start, end, type })
  const oldSet = new Set(oldKeys)
  const newSet = new Set(newKeys)

  const batch = writeBatch(db)
  batch.update(ref, { start, end })
  for (const k of oldKeys) {
    if (!newSet.has(k)) batch.delete(doc(db, 'slotLocks', k))
  }
  for (const k of newKeys) {
    if (!oldSet.has(k)) {
      batch.set(
        doc(db, 'slotLocks', k),
        lockPayload({ eventId, type, editor: event.extendedProps?.editor }),
      )
    }
  }
  try {
    await batch.commit()
  } catch (err) {
    throw asConflict(err)
  }
  await addLog('編集', {
    editor: editorName,
    before: summarize(event),
    after: summarize({ ...event, start, end }),
  })
}

// 固定枠の繰り返し一括登録（管理者専用）。
// weekday: 0(日)〜6(土) / startTime,endTime: "HH:MM" / startDate,endDate: "YYYY-MM-DD"
// 各回ごとに個別バッチで登録し、既存予約と重複する回はスキップして件数を返す。
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
  const occurrences = []
  const cursor = new Date(`${startDate}T00:00:00`)
  const last = new Date(`${endDate}T00:00:00`)
  while (cursor <= last) {
    if (cursor.getDay() === weekday) {
      const ds = dateStr(cursor)
      occurrences.push({
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
  if (occurrences.length === 0) return { created: 0, skipped: 0 }

  let created = 0
  let skipped = 0
  for (const ev of occurrences) {
    const ref = doc(collection(db, 'events'))
    const keys = slotKeysFor({ start: ev.start, end: ev.end, type: EVENT_TYPES.FIXED })
    const batch = writeBatch(db)
    batch.set(ref, ev)
    for (const k of keys) {
      batch.set(doc(db, 'slotLocks', k), lockPayload({ eventId: ref.id, type: EVENT_TYPES.FIXED, editor }))
    }
    try {
      await batch.commit()
      created += 1
    } catch (err) {
      if (err && err.code === 'permission-denied') {
        skipped += 1
      } else {
        throw err
      }
    }
  }
  if (created > 0) {
    await addLog('固定枠一括登録', {
      editor,
      before: null,
      after: {
        title,
        type: EVENT_TYPES.FIXED,
        start: occurrences[0].start,
        end: occurrences[occurrences.length - 1].end,
        comment: `${created}件（毎週・${startDate}〜${endDate}）${skipped ? `／重複${skipped}件スキップ` : ''}`,
      },
    })
  }
  return { created, skipped }
}

// 繰り返しグループをまとめて削除（管理者専用）。event と lock を分割バッチで削除。
export async function deleteRecurrenceGroup(group, deleterName) {
  const snap = await getDocs(
    query(collection(db, 'events'), where('extendedProps.recurrenceGroup', '==', group)),
  )
  if (snap.empty) return 0

  let batch = writeBatch(db)
  let ops = 0
  const flush = async () => {
    if (ops > 0) {
      await batch.commit()
      batch = writeBatch(db)
      ops = 0
    }
  }
  for (const d of snap.docs) {
    const ev = { id: d.id, ...d.data() }
    const keys = slotKeysFor({ start: ev.start, end: ev.end, type: ev.extendedProps?.type })
    batch.delete(d.ref)
    ops += 1
    for (const k of keys) {
      batch.delete(doc(db, 'slotLocks', k))
      ops += 1
      if (ops >= BATCH_LIMIT) await flush()
    }
    if (ops >= BATCH_LIMIT) await flush()
  }
  await flush()
  await addLog('固定枠一括削除', {
    editor: deleterName,
    before: { title: '固定枠（繰り返し）', type: EVENT_TYPES.FIXED, comment: `${snap.size}件を削除` },
    after: null,
  })
  return snap.size
}

// 60日より前の予約を best-effort で削除（起動時に一度だけ呼ぶ）。ログは残さない。
export async function cleanupOldEvents() {
  try {
    const snap = await getDocs(
      query(collection(db, 'events'), where('start', '<', cutoffIso())),
    )
    if (snap.empty) return 0
    let batch = writeBatch(db)
    let ops = 0
    for (const d of snap.docs) {
      const ev = { id: d.id, ...d.data() }
      const keys = slotKeysFor({ start: ev.start, end: ev.end, type: ev.extendedProps?.type })
      batch.delete(d.ref)
      ops += 1
      for (const k of keys) {
        batch.delete(doc(db, 'slotLocks', k))
        ops += 1
      }
      if (ops >= BATCH_LIMIT) {
        await batch.commit()
        batch = writeBatch(db)
        ops = 0
      }
    }
    if (ops > 0) await batch.commit()
    return snap.size
  } catch (err) {
    console.warn('古い予約の掃除に失敗しました:', err)
    return 0
  }
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
