// 予約入力ダイアログ
// 記入者名はログインユーザーから自動取得（旧アプリの手入力から改善）
import { useState } from 'react'
import {
  TYPE_LABELS,
  MEMBER_SELECTABLE_TYPES,
  EVENT_TYPES,
} from '../../lib/eventTypes'

export function ReserveDialog({ range, profile, isAdmin, onSave, onClose }) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState(EVENT_TYPES.CONFIRMED)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  const selectableTypes = isAdmin
    ? [...MEMBER_SELECTABLE_TYPES, EVENT_TYPES.FIXED, EVENT_TYPES.NO_SOUND]
    : MEMBER_SELECTABLE_TYPES

  const handleSave = async () => {
    if (!title.trim()) {
      alert('バンド名は必須です。')
      return
    }
    setSaving(true)
    try {
      await onSave({ title: title.trim(), type, comment: comment.trim() })
      onClose()
    } catch (err) {
      console.error('予約の追加に失敗:', err)
      alert('予約の追加に失敗しました。')
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
        <h3>予約入力</h3>
        <p className="dialog-time">
          {fmt(range.start)} 〜 {fmt(range.end)}
        </p>
        <label>
          バンド名（必須）
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
        </label>
        <label>
          種別
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {selectableTypes.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          コメント
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </label>
        <p className="dialog-editor">記入者: {profile.displayName || profile.email}</p>
        <div className="dialog-buttons">
          <button onClick={onClose}>キャンセル</button>
          <button className="primary" onClick={handleSave} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
