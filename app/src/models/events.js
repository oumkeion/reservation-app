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

// start/end 文字列 → 絶対時刻(ms)。ISO UTC(末尾Z)はそのまま、naive は JST 壁時計として解釈。
function toMs(s) {
  if (typeof s !== 'string') return new Date(s).getTime()
  return (s.endsWith('Z') ? new Date(s) : new Date(`${s}+09:00`)).getTime()
}

// 希望枠の「申請期間の締切」= 使用日のちょうど1週間前の日の 09:00（JST）を ms で返す。
// この時刻を過ぎた希望枠は格上げ判定の対象になる。
function requestWindowEndMs(startIso) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(toMs(startIso)))
  const get = (t) => parts.find((p) => p.type === t)?.value
  const usageMidnightJst = new Date(`${get('year')}-${get('month')}-${get('day')}T00:00:00+09:00`)
  // 使用日0:00(JST) - 7日 + 9時間 = 申請日の 09:00(JST)
  return usageMidnightJst.getTime() - 7 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000
}

// 希望枠の自動格上げ（best-effort、起動時に一度呼ぶ）。
// 申請期間（使用日1週間前 0:00〜9:00 JST）を過ぎた希望枠のうち、同じ時間帯に
// 競合する他の予約（音出し禁止以外）が無いものを、部室確定枠へ格上げする。
// 競合がある希望枠は抽選・話し合いが必要なため据え置く。
export async function promoteEligibleRequests() {
  try {
    const snap = await getDocs(
      query(collection(db, 'events'), where('start', '>=', cutoffIso())),
    )
    if (snap.empty) return 0
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    const now = Date.now()

    // 各イベントが占有する15分スロットキー集合（音出し禁止は非占有＝空集合）。
    // 希望枠は本来ロックを取らないが、競合判定のため占有枠とみなしてキーを求める。
    const keysOf = (ev) => {
      if (ev.extendedProps?.type === EVENT_TYPES.NO_SOUND) return []
      return slotKeysFor({ start: ev.start, end: ev.end, type: EVENT_TYPES.CONFIRMED })
    }

    let promoted = 0
    for (const req of all) {
      if (req.extendedProps?.type !== EVENT_TYPES.REQUEST) continue
      if (toMs(req.end) <= now) continue // 済んだ枠は対象外
      if (now < requestWindowEndMs(req.start)) continue // まだ申請期間内

      const myKeys = keysOf(req)
      if (myKeys.length === 0) continue
      const mySet = new Set(myKeys)

      // 自分以外に同じスロットを占有する予約があれば競合＝格上げしない
      const hasCompetition = all.some(
        (e) => e.id !== req.id && keysOf(e).some((k) => mySet.has(k)),
      )
      if (hasCompetition) continue

      // 競合なし → 確定枠へ格上げ（type変更＋ロック確保を同一バッチで原子的に）
      const batch = writeBatch(db)
      batch.update(doc(db, 'events', req.id), { 'extendedProps.type': EVENT_TYPES.CONFIRMED })
      for (const k of myKeys) {
        batch.set(
          doc(db, 'slotLocks', k),
          lockPayload({ eventId: req.id, type: EVENT_TYPES.CONFIRMED, editor: req.extendedProps?.editor }),
        )
      }
      try {
        await batch.commit()
        promoted += 1
        await addLog('希望枠を確定枠へ格上げ', {
          editor: '自動処理',
          before: summarize(req),
          after: summarize({
            ...req,
            extendedProps: { ...req.extendedProps, type: EVENT_TYPES.CONFIRMED },
          }),
        })
      } catch (err) {
        // 競合（ロック既存）などで失敗した場合はスキップ
        if (!(err && err.code === 'permission-denied')) {
          console.warn('希望枠の格上げに失敗:', err)
        }
      }
    }
    return promoted
  } catch (err) {
    console.warn('希望枠の自動格上げに失敗しました:', err)
    return 0
  }
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
