// bands コレクション: バンド情報（バンド掲示板の土台）
// 予約と同様にログイン不要。代表者名は手入力（記入者名と同じ運用）。
// 解散は status フラグで管理（一覧は active のみ表示）。
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

export const BAND_STATUS = {
  ACTIVE: 'active',
  DISBANDED: 'disbanded',
}

// 現存バンドをリアルタイム購読
export function subscribeActiveBands(onChange, onError) {
  const q = query(
    collection(db, 'bands'),
    where('status', '==', BAND_STATUS.ACTIVE),
  )
  return onSnapshot(
    q,
    (snapshot) => {
      const bands = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      onChange(bands)
    },
    onError,
  )
}

export async function createBand({ name, genre, representative }) {
  const band = {
    name,
    genre: genre || '',
    representative,
    status: BAND_STATUS.ACTIVE,
    createdAt: serverTimestamp(),
  }
  const ref = await addDoc(collection(db, 'bands'), band)
  return ref.id
}

export async function updateBand(bandId, { name, genre }) {
  await updateDoc(doc(db, 'bands', bandId), { name, genre })
}

export async function disbandBand(bandId) {
  await updateDoc(doc(db, 'bands', bandId), {
    status: BAND_STATUS.DISBANDED,
  })
}
