// slotIntents コレクション: 狙い表明（予約ではなく「この時間を狙っている」という宣言）
// 予約と同じ15分グリッドを使い、ログイン不要・複数人が同じ枠を宣言できる。
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { logActivity } from './activityLog'

// slotIntents をリアルタイム購読し、FullCalendar 形式の配列でコールバックに渡す
export function subscribeIntents(onChange, onError) {
  return onSnapshot(
    collection(db, 'slotIntents'),
    (snapshot) => {
      const intents = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      onChange(intents)
    },
    onError,
  )
}

export async function addIntent({ title, editor, start, end, comment }) {
  const intent = {
    title,
    start,
    end,
    allDay: false,
    extendedProps: { editor, comment },
  }
  const ref = await addDoc(collection(db, 'slotIntents'), intent)
  await logActivity('狙い表明', editor, `バンド「${title}」`)
  return ref.id
}

export async function deleteIntent(intent) {
  const id = typeof intent === 'string' ? intent : intent.id
  await deleteDoc(doc(db, 'slotIntents', id))
  await logActivity('狙い表明取消', intent?.extendedProps?.editor || '不明', `バンド「${intent?.title || id}」`)
}
