// bands コレクション: バンド情報（Phase 1 バンド掲示板の土台）
// 方針: 部員が自由に作成。解散は status フラグで管理（一覧は active のみ数える）。
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

export async function createBand({ name, genre, uid }) {
  const band = {
    name,
    genre: genre || '',
    memberUids: [uid],
    status: BAND_STATUS.ACTIVE,
    createdByUid: uid,
    createdAt: serverTimestamp(),
  }
  const ref = await addDoc(collection(db, 'bands'), band)
  return ref.id
}

export async function disbandBand(bandId) {
  await updateDoc(doc(db, 'bands', bandId), {
    status: BAND_STATUS.DISBANDED,
  })
}
