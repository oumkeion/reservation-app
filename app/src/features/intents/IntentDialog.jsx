// 狙い表明の入力ダイアログ
// 予約ではないので検証ルールは無し。複数人が同じ枠を宣言できる。
import { useState } from 'react'

export function IntentDialog({ range, onSave, onClose }) {
  const [title, setTitle] = useState('')
  const [editor, setEditor] = useState('')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!title.trim() || !editor.trim()) {
      alert('バンド名と記入者名は必須です。')
      return
    }
    setSaving(true)
    try {
      await onSave({ title: title.trim(), editor: editor.trim(), comment: comment.trim() })
      onClose()
    } catch (err) {
      console.error('狙い表明の登録に失敗:', err)
      alert('狙い表明の登録に失敗しました。')
    } finally {
      setSaving(false)
    }
  }

  const fmt = (d) =>
    d.toLocaleString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>狙い表明</h3>
        <p className="dialog-time">
          {fmt(range.start)} 〜 {fmt(range.end)}
        </p>
        <p className="dialog-editor">
          予約ではなく「この時間を狙っている」という宣言です。複数のバンドが同じ枠を宣言できます。
        </p>
        <label>
          バンド名（必須）
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="（必須）"
            autoFocus
          />
        </label>
        <label>
          記入者名（必須）
          <input
            type="text"
            value={editor}
            onChange={(e) => setEditor(e.target.value)}
            placeholder="（必須）"
          />
        </label>
        <label>
          コメント
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </label>
        <div className="dialog-buttons">
          <button onClick={onClose}>キャンセル</button>
          <button
            className="primary"
            onClick={handleSave}
            disabled={saving || !title.trim() || !editor.trim()}
          >
            {saving ? '登録中…' : '登録'}
          </button>
        </div>
      </div>
    </div>
  )
}
