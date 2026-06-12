// events / logs コレクションへの読み書き
// ドキュメント形式は旧アプリと互換:
//   { title, start, end, allDay, createdByUid?, extendedProps: { type, comment, editor } }
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

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

export async function addEvent({ title, start, end, type, comment, editor, uid }) {
  const event = {
    title,
    start,
    end,
    allDay: false,
    createdByUid: uid,
    extendedProps: { type, comment, editor },
  }
  const ref = await addDoc(collection(db, 'events'), event)
  await addLog('予約追加', { id: ref.id, ...event }, editor)
  return ref.id
}

export async function deleteEvent(event, deleterName) {
  await deleteDoc(doc(db, 'events', event.id))
  await addLog('削除', event, deleterName)
}

// 操作ログ（旧アプリと同じ logs コレクション）
async function addLog(action, eventObject, editorName) {
  try {
    await addDoc(collection(db, 'logs'), {
      timestamp: new Date().toLocaleString('ja-JP'),
      action,
      editor: editorName || '不明',
      event: {
        id: eventObject.id || null,
        title: eventObject.title || '',
        start: eventObject.start || null,
        end: eventObject.end || null,
        type: eventObject.extendedProps?.type || '',
      },
    })
  } catch (err) {
    // ログ失敗は予約自体の成否に影響させない
    console.warn('ログの記録に失敗しました:', err)
  }
}
