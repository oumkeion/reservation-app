// 狙い表明の詳細・削除ダイアログ
// 削除は記入者名の入力一致で本人確認のうえ行う（予約の非保護枠と同じ方式）。
import { useState } from 'react'

export function IntentDetailDialog({ intent, onDelete, onClose }) {
  const [deleting, setDeleting] = useState(false)
  const editor = intent.extendedProps?.editor || ''

  const handleDelete = async () => {
    if (!confirm(`「${intent.title}」の狙い表明を取り消しますか？`)) return
    const input = prompt(
      `本人確認のため、この表明の「記入者名」(${editor || '不明'})を入力してください:`,
    )
    if (input === null) return
    if (!editor || input.trim() !== editor) {
      alert('入力された名前が一致しません。取り消せませんでした。')
      return
    }

    setDeleting(true)
    try {
      await onDelete(intent)
      onClose()
    } catch (err) {
      console.error('取り消しに失敗:', err)
      alert('取り消しに失敗しました。')
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
        <h3>狙い表明の詳細</h3>
        <p>バンド名：{intent.title}</p>
        <p>記入者：{editor || '（不明）'}</p>
        <p>
          時間：{fmt(intent.start)} 〜 {fmt(intent.end)}
        </p>
        <p>コメント：{intent.extendedProps?.comment || '（なし）'}</p>
        <div className="dialog-buttons">
          <button onClick={onClose}>閉じる</button>
          <button className="danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? '取り消し中…' : 'この表明を取り消す'}
          </button>
        </div>
      </div>
    </div>
  )
}
