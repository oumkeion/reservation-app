// 固定枠 変更・キャンセル申請の承認一覧（管理者専用）
// 未処理の申請を承認/拒否する。承認時に実際の固定枠を変更・削除する。
import { useEffect, useState } from 'react'
import {
  subscribeFixedSlotRequests,
  approveFixedSlotRequest,
  rejectFixedSlotRequest,
  deleteFixedSlotRequest,
  REQUEST_STATUS,
  REQUEST_KIND,
} from '../../models/fixedSlotRequests'
import { updateEventTime, deleteEventById } from '../../models/events'

const STATUS_LABEL = {
  [REQUEST_STATUS.PENDING]: '未処理',
  [REQUEST_STATUS.APPROVED]: '承認済',
  [REQUEST_STATUS.REJECTED]: '拒否',
}

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function FixedSlotRequestsAdmin({ adminName }) {
  const [requests, setRequests] = useState([])
  const [error, setError] = useState(false)
  const [busyId, setBusyId] = useState(null)

  useEffect(() => {
    const unsub = subscribeFixedSlotRequests(setRequests, (err) => {
      console.error('申請の読み込みエラー:', err)
      setError(true)
    })
    return unsub
  }, [])

  const handleApprove = async (req) => {
    const detail =
      req.kind === REQUEST_KIND.CANCEL
        ? `固定枠「${req.fixedTitle}」を削除します。`
        : `固定枠「${req.fixedTitle}」を ${fmt(req.desiredStart)}〜${fmt(req.desiredEnd)} に変更します。`
    if (!confirm(`承認すると${detail}\nよろしいですか？`)) return
    setBusyId(req.id)
    try {
      await approveFixedSlotRequest(req, adminName || '管理者', {
        updateEventTime,
        deleteEventById,
      })
    } catch (err) {
      console.error('承認に失敗:', err)
      alert('承認に失敗しました。')
    } finally {
      setBusyId(null)
    }
  }

  const handleReject = async (req) => {
    if (!confirm('この申請を拒否しますか？')) return
    setBusyId(req.id)
    try {
      await rejectFixedSlotRequest(req, adminName || '管理者')
    } catch (err) {
      console.error('拒否に失敗:', err)
      alert('拒否に失敗しました。')
    } finally {
      setBusyId(null)
    }
  }

  const pending = requests.filter((r) => r.status === REQUEST_STATUS.PENDING)
  const resolved = requests.filter((r) => r.status !== REQUEST_STATUS.PENDING)

  const renderRow = (req) => (
    <li key={req.id} className={`req-item req-${req.status}`}>
      <div className="req-head">
        <span className="req-kind">
          {req.kind === REQUEST_KIND.CANCEL ? 'キャンセル' : '変更'}
        </span>
        <span className="req-status">{STATUS_LABEL[req.status]}</span>
        <span className="req-requester">申請者: {req.requester}</span>
      </div>
      <div className="req-detail">
        対象: {req.fixedTitle}（{fmt(req.fixedStart)}〜{fmt(req.fixedEnd)}）
      </div>
      {req.kind === REQUEST_KIND.CHANGE && (
        <div className="req-detail">変更後: {fmt(req.desiredStart)}〜{fmt(req.desiredEnd)}</div>
      )}
      {req.note && <div className="req-detail">備考: {req.note}</div>}
      {req.status === REQUEST_STATUS.PENDING ? (
        <div className="dialog-buttons">
          <button className="primary" onClick={() => handleApprove(req)} disabled={busyId === req.id}>
            承認
          </button>
          <button className="danger" onClick={() => handleReject(req)} disabled={busyId === req.id}>
            拒否
          </button>
        </div>
      ) : (
        <div className="req-resolved">
          {STATUS_LABEL[req.status]}（{req.resolvedBy || '—'}）
          <button className="req-clear" onClick={() => deleteFixedSlotRequest(req.id)}>
            一覧から消す
          </button>
        </div>
      )}
    </li>
  )

  return (
    <div className="req-admin">
      <h2>固定枠 変更・キャンセル申請</h2>
      {error && <p className="error-bar">申請の読み込みに失敗しました。</p>}
      <h3>未処理（{pending.length}）</h3>
      {pending.length === 0 ? (
        <p className="placeholder">未処理の申請はありません。</p>
      ) : (
        <ul className="req-list">{pending.map(renderRow)}</ul>
      )}
      {resolved.length > 0 && (
        <>
          <h3>処理済み</h3>
          <ul className="req-list">{resolved.map(renderRow)}</ul>
        </>
      )}
    </div>
  )
}
