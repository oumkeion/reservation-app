// 予約詳細ダイアログ
// 削除ルール（旧アプリと同じ）:
//   - 固定枠・音出し禁止（保護枠）は管理者のみ削除ボタンを表示
//   - 管理者は本人確認なしで削除可能
//   - 通常ユーザーは「記入者名」の入力一致で本人確認のうえ削除
import { useState } from 'react'
import { TYPE_LABELS, PROTECTED_TYPES } from '../../lib/eventTypes'

export function EventDetailDialog({ event, isAdmin, adminName, onDelete, onClose }) {
  const [deleting, setDeleting] = useState(false)
  const type = event.extendedProps?.type
  const editor = event.extendedProps?.editor || ''
  const isProtected = PROTECTED_TYPES.includes(type)
  const canShowDelete = isAdmin || !isProtected

  const handleDelete = async () => {
    if (!confirm(`「${event.title}」の予約を本当に削除しますか？`)) return

    let deleterName
    if (isAdmin) {
      deleterName = adminName || '管理者'
    } else {
      const input = prompt(
        `本人確認のため、この予約の「記入者名」(${editor || '不明'})を入力してください:`,
      )
      if (input === null) return
      if (!editor || input.trim() !== editor) {
        alert('入力された名前が一致しません。削除できませんでした。')
        return
      }
      deleterName = input.trim()
    }

    setDeleting(true)
    try {
      await onDelete(event, deleterName)
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
        <p>種別：{TYPE_LABELS[type] || '不明'}</p>
        <p>記入者：{editor || '（不明）'}</p>
        <p>
          時間：{fmt(event.start)} 〜 {fmt(event.end)}
        </p>
        <p>コメント：{event.extendedProps?.comment || '（なし）'}</p>
        <div className="dialog-buttons">
          <button onClick={onClose}>閉じる</button>
          {canShowDelete && (
            <button className="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? '削除中…' : 'この予約を削除'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
