// bands コレクション: バンド情報（バンド掲示板の土台）
// 予約と同様にログイン不要。代表者名は手入力（記入者名と同じ運用）。
// 解散は status フラグで管理（一覧は active のみ表示）。
// 演奏曲(songs)は任意。ライブ本番日(performanceDate)を過ぎたバンドは自動削除する。
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  getDocs,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { logActivity } from './activityLog'

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

export async function createBand({ name, songs, performanceDate, representative }) {
  const band = {
    name,
    songs: songs || '',
    performanceDate: performanceDate || '',
    representative,
    status: BAND_STATUS.ACTIVE,
    createdAt: serverTimestamp(),
  }
  const ref = await addDoc(collection(db, 'bands'), band)
  await logActivity('バンド登録', representative, `バンド「${name}」`)
  return ref.id
}

export async function updateBand(bandId, { name, songs, performanceDate }) {
  await updateDoc(doc(db, 'bands', bandId), {
    name,
    songs: songs || '',
    performanceDate: performanceDate || '',
  })
  await logActivity('バンド編集', name, `バンド「${name}」の情報を更新`)
}

export async function disbandBand(bandId, band) {
  await updateDoc(doc(db, 'bands', bandId), {
    status: BAND_STATUS.DISBANDED,
  })
  await logActivity('バンド解散', band?.representative || '不明', `バンド「${band?.name || bandId}」を解散`)
}

// ライブ本番日(performanceDate)が過ぎた active バンドを自動削除する（起動時に一度呼ぶ）。
// 延期時は編集で日付を変更、経過後は再登録で対応する運用。
export async function cleanupExpiredBands() {
  try {
    // "YYYY-MM-DD"（JST の今日）。文字列比較で判定するため performanceDate も同形式で保存する。
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
    const snap = await getDocs(
      query(collection(db, 'bands'), where('status', '==', BAND_STATUS.ACTIVE)),
    )
    let removed = 0
    for (const d of snap.docs) {
      const band = d.data()
      const date = band.performanceDate
      if (date && date < today) {
        await deleteDoc(d.ref)
        await logActivity('バンド自動削除', band.representative || '不明', `本番日(${date})経過のため「${band.name}」を削除`)
        removed += 1
      }
    }
    return removed
  } catch (err) {
    console.warn('期限切れバンドの掃除に失敗しました:', err)
    return 0
  }
}
