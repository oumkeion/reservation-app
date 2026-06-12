// 予約詳細ダイアログ（削除は本人か管理者のみ）
import { useState } from 'react'
import { TYPE_LABELS } from '../../lib/eventTypes'

export function EventDetailDialog({ event, profile, isAdmin, onDelete, onClose }) {
  const [deleting, setDeleting] = useState(false)

  const canDelete =
    isAdmin || (profile && event.createdByUid && event.createdByUid === profile.uid)

  const handleDelete = async () => {
    if (!confirm('この予約を削除しますか？')) return
    setDeleting(true)
    try {
      await onDelete(event)
      onClose()
    } catch (err) {
      console.error('削除に失敗:', err)
      alert('削除に失敗しました。')
    } finally {
      setDeleting(false)
    }
  }

  const fmt = (d) =>
    new Date(d).toLocaleString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>予約詳細</h3>
        <p>バンド名：{event.title}</p>
        <p>種別：{TYPE_LABELS[event.extendedProps?.type] || '不明'}</p>
        <p>記入者：{event.extendedProps?.editor || '（不明）'}</p>
        <p>
          時間：{fmt(event.start)} 〜 {fmt(event.end)}
        </p>
        <p>コメント：{event.extendedProps?.comment || '（なし）'}</p>
        <div className="dialog-buttons">
          <button onClick={onClose}>閉じる</button>
          {canDelete && (
            <button className="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? '削除中…' : 'この予約を削除'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
