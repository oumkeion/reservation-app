// bands コレクション: バンド情報（バンド掲示板の土台）
// 予約と同様にログイン不要。代表者名は手入力（記入者名と同じ運用）。
// 解散は status フラグで管理（一覧は active のみ表示）。
// 演奏曲(songs)は任意。ライブ本番日(performanceDate)を過ぎたバンドは自動削除する。
// カテゴリ(category)は本番の種類（部室ライブ・定期演奏会など）。一覧の絞り込みに使う。
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
  writeBatch,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { logActivity } from './activityLog'
import { slotKeysFor } from './slotLocks'

export const BAND_STATUS = {
  ACTIVE: 'active',
  DISBANDED: 'disbanded',
}

// バンドのカテゴリ（本番の種類）。一覧の絞り込みに使う。
export const BAND_CATEGORIES = [
  '部室ライブ',
  '定期演奏会',
  'ジョイント',
  '学祭バンド',
  'その他',
]
export const DEFAULT_BAND_CATEGORY = 'その他'

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

export async function createBand({ name, songs, performanceDate, category, representative }) {
  const band = {
    name,
    songs: songs || '',
    performanceDate: performanceDate || '',
    category: category || DEFAULT_BAND_CATEGORY,
    representative,
    status: BAND_STATUS.ACTIVE,
    createdAt: serverTimestamp(),
  }
  const ref = await addDoc(collection(db, 'bands'), band)
  await logActivity('バンド登録', representative, `バンド「${name}」`)
  return ref.id
}

export async function updateBand(bandId, { name, songs, performanceDate, category }) {
  await updateDoc(doc(db, 'bands', bandId), {
    name,
    songs: songs || '',
    performanceDate: performanceDate || '',
    category: category || DEFAULT_BAND_CATEGORY,
  })
  await logActivity('バンド編集', name, `バンド「${name}」の情報を更新`)
}

// 予約の start/end 文字列を絶対時刻(ms)に変換する（slotLocks.js と同じ解釈:
// 末尾 Z は UTC、naive 文字列（固定枠）は JST 壁時計）。
function toInstantMs(s) {
  if (typeof s !== 'string') return new Date(s).getTime()
  return new Date(s.endsWith('Z') ? s : `${s}+09:00`).getTime()
}

// 解散したバンドの「今後の予定」を削除する（過去の記録は残す）。
// 固定枠など保護枠はルール上非管理者では削除できないため、失敗分は件数で返す。
async function deleteFutureBandEvents(bandName) {
  const now = Date.now()
  const snap = await getDocs(query(collection(db, 'events'), where('title', '==', bandName)))
  let removed = 0
  let failed = 0
  for (const d of snap.docs) {
    const ev = { id: d.id, ...d.data() }
    if (toInstantMs(ev.start) < now) continue
    try {
      const batch = writeBatch(db)
      batch.delete(d.ref)
      const keys = slotKeysFor({ start: ev.start, end: ev.end, type: ev.extendedProps?.type })
      for (const k of keys) batch.delete(doc(db, 'slotLocks', k))
      await batch.commit()
      removed += 1
    } catch (err) {
      console.warn(`解散バンドの予約削除に失敗（${ev.start}）:`, err)
      failed += 1
    }
  }
  return { removed, failed }
}

export async function disbandBand(bandId, band) {
  await updateDoc(doc(db, 'bands', bandId), {
    status: BAND_STATUS.DISBANDED,
  })
  const name = band?.name || ''
  let result = { removed: 0, failed: 0 }
  if (name) {
    result = await deleteFutureBandEvents(name)
  }
  await logActivity(
    'バンド解散',
    band?.representative || '不明',
    `バンド「${name || bandId}」を解散` +
      (result.removed ? `／今後の予約${result.removed}件を削除` : '') +
      (result.failed ? `／固定枠など${result.failed}件は削除できず（管理者対応が必要）` : ''),
  )
  return result
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
