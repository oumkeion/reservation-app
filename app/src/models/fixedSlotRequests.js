// fixedSlotRequests コレクション: 固定枠の「キャンセル・変更」申請と管理者承認のワークフロー。
// 一般部員が申請を作成 → 管理者が承認/拒否。承認時に実際の固定枠を変更/削除する。
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { logActivity } from './activityLog'

export const REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
}

export const REQUEST_KIND = {
  CANCEL: 'cancel',
  CHANGE: 'change',
}

// 申請を作成（一般部員）。fixedEvent は対象の固定枠イベント。
export async function createFixedSlotRequest({
  fixedEvent,
  requester,
  kind,
  desiredStart,
  desiredEnd,
  note,
}) {
  const data = {
    createdAt: serverTimestamp(),
    requester,
    kind,
    fixedEventId: fixedEvent.id,
    fixedTitle: fixedEvent.title || '',
    fixedStart: fixedEvent.start,
    fixedEnd: fixedEvent.end,
    desiredStart: desiredStart || null,
    desiredEnd: desiredEnd || null,
    note: note || '',
    status: REQUEST_STATUS.PENDING,
  }
  const ref = await addDoc(collection(db, 'fixedSlotRequests'), data)
  const label = kind === REQUEST_KIND.CANCEL ? 'キャンセル' : '変更'
  await logActivity('固定枠申請', requester, `固定枠「${data.fixedTitle}」の${label}を申請`)
  return ref.id
}

// 申請をリアルタイム購読（新しい順）
export function subscribeFixedSlotRequests(onChange, onError) {
  const q = query(collection(db, 'fixedSlotRequests'), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snapshot) => onChange(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
    onError,
  )
}

// 承認（管理者）: 実際に固定枠を変更/削除してから申請を approved に更新
export async function approveFixedSlotRequest(request, adminName, { updateEventTime, deleteEventById }) {
  if (request.kind === REQUEST_KIND.CANCEL) {
    await deleteEventById(request.fixedEventId, adminName)
  } else if (request.kind === REQUEST_KIND.CHANGE) {
    await updateEventTime(request.fixedEventId, request.desiredStart, request.desiredEnd, adminName)
  }
  await updateDoc(doc(db, 'fixedSlotRequests', request.id), {
    status: REQUEST_STATUS.APPROVED,
    resolvedBy: adminName,
    resolvedAt: serverTimestamp(),
  })
  await logActivity('固定枠申請承認', adminName, `「${request.fixedTitle}」の申請を承認`)
}

// 拒否（管理者）
export async function rejectFixedSlotRequest(request, adminName) {
  await updateDoc(doc(db, 'fixedSlotRequests', request.id), {
    status: REQUEST_STATUS.REJECTED,
    resolvedBy: adminName,
    resolvedAt: serverTimestamp(),
  })
  await logActivity('固定枠申請拒否', adminName, `「${request.fixedTitle}」の申請を拒否`)
}

// 解決済み申請の削除（管理者）
export async function deleteFixedSlotRequest(requestId) {
  await deleteDoc(doc(db, 'fixedSlotRequests', requestId))
}
