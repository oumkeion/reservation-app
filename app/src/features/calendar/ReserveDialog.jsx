// 予約入力ダイアログ
// ログイン不要: 記入者名は手入力（旧アプリと同じ）。
// 確定枠(confirmed)のバンド名は「バンド一覧」から選択のみ。希望枠・個人練習は手入力。
// 管理者ログイン中は固定枠・音出し禁止・部のイベントも選択可能。
import { useState } from 'react'
import {
  TYPE_LABELS,
  MEMBER_SELECTABLE_TYPES,
  ADMIN_SELECTABLE_TYPES,
  EVENT_TYPES,
} from '../../lib/eventTypes'
import { ValidationFailure } from './errors'

export function ReserveDialog({ range, isAdmin, bands = [], onSave, onClose }) {
  const [title, setTitle] = useState('')
  const [editor, setEditor] = useState('')
  const [type, setType] = useState(EVENT_TYPES.CONFIRMED)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  const selectableTypes = isAdmin
    ? [...MEMBER_SELECTABLE_TYPES, ...ADMIN_SELECTABLE_TYPES]
    : MEMBER_SELECTABLE_TYPES

  // 確定枠はバンド一覧から選択のみ
  const bandSelectOnly = type === EVENT_TYPES.CONFIRMED
  const bandNames = [...bands.map((b) => b.name)].sort((a, b) => a.localeCompare(b, 'ja'))
  const noBands = bandSelectOnly && bandNames.length === 0

  const handleTypeChange = (nextType) => {
    setType(nextType)
    // 確定枠に切り替えたとき、一覧に無い名前が残っていたらクリアして選択を促す
    if (nextType === EVENT_TYPES.CONFIRMED && !bands.some((b) => b.name === title)) {
      setTitle('')
    }
  }

  const handleSave = async () => {
    if (!title.trim() || !editor.trim()) {
      alert('バンド名と記入者名は必須です。')
      return
    }
    setSaving(true)
    try {
      await onSave({ title: title.trim(), editor: editor.trim(), type, comment: comment.trim() })
      onClose()
    } catch (err) {
      console.error('予約の追加に失敗:', err)
      if (!(err instanceof ValidationFailure)) {
        alert('予約の追加に失敗しました。')
      }
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
          種別
          <select value={type} onChange={(e) => handleTypeChange(e.target.value)}>
            {selectableTypes.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label>
          バンド名（必須）
          {bandSelectOnly ? (
            <select value={title} onChange={(e) => setTitle(e.target.value)} disabled={noBands}>
              <option value="">（バンドを選択）</option>
              {bandNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="（必須）"
              autoFocus
            />
          )}
        </label>
        {noBands && (
          <p className="dialog-note">
            確定枠は登録済みバンドからの選択制です。先に「バンド一覧」タブでバンドを登録してください。
          </p>
        )}
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
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
