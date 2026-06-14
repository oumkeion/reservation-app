// 予約詳細／編集ダイアログ
// 権限ルール（旧アプリと同じ匿名運用）:
//   - 固定枠・音出し禁止・部のイベント（保護枠）は管理者のみ編集・削除可
//   - 管理者は本人確認なしで編集・削除可能
//   - 通常ユーザーは「記入者名」の入力一致で本人確認のうえ編集・削除
import { useState } from 'react'
import {
  TYPE_LABELS,
  PROTECTED_TYPES,
  MEMBER_SELECTABLE_TYPES,
  ADMIN_SELECTABLE_TYPES,
} from '../../lib/eventTypes'

// ISO文字列 → datetime-local 用 "YYYY-MM-DDTHH:MM"（ローカル時刻）
function toLocalInput(iso) {
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function EventDetailDialog({
  event,
  isAdmin,
  adminName,
  onDelete,
  onUpdate,
  onDeleteGroup,
  onClose,
}) {
  const type = event.extendedProps?.type
  const editor = event.extendedProps?.editor || ''
  const recurrenceGroup = event.extendedProps?.recurrenceGroup
  const isProtected = PROTECTED_TYPES.includes(type)
  const canModify = isAdmin || !isProtected

  const [mode, setMode] = useState('view') // 'view' | 'edit'
  const [busy, setBusy] = useState(false)
  // 編集フォーム
  const [title, setTitle] = useState(event.title || '')
  const [editType, setEditType] = useState(type)
  const [start, setStart] = useState(toLocalInput(event.start))
  const [end, setEnd] = useState(toLocalInput(event.end))
  const [comment, setComment] = useState(event.extendedProps?.comment || '')

  const selectableTypes = isAdmin
    ? [...MEMBER_SELECTABLE_TYPES, ...ADMIN_SELECTABLE_TYPES]
    : MEMBER_SELECTABLE_TYPES

  // 非管理者の本人確認（記入者名一致）。OKなら名前を返し、NGなら null
  const confirmIdentity = () => {
    if (isAdmin) return adminName || '管理者'
    const input = prompt(
      `本人確認のため、この予約の「記入者名」(${editor || '不明'})を入力してください:`,
    )
    if (input === null) return null
    if (!editor || input.trim() !== editor) {
      alert('入力された名前が一致しません。')
      return null
    }
    return input.trim()
  }

  const handleStartEdit = () => {
    // 編集に入る前に本人確認（保護枠以外）。確認できたら編集モードへ。
    const name = confirmIdentity()
    if (name === null) return
    setMode('edit')
  }

  const handleSaveEdit = async () => {
    if (!title.trim()) {
      alert('バンド名は必須です。')
      return
    }
    if (new Date(end) <= new Date(start)) {
      alert('終了時刻は開始時刻より後にしてください。')
      return
    }
    const name = isAdmin ? adminName || '管理者' : editor
    setBusy(true)
    try {
      await onUpdate(
        event,
        {
          title: title.trim(),
          type: editType,
          start: new Date(start).toISOString(),
          end: new Date(end).toISOString(),
          comment: comment.trim(),
        },
        name,
      )
      onClose()
    } catch (err) {
      console.error('編集に失敗:', err)
      alert('編集に失敗しました。')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    const deleterName = confirmIdentity()
    if (deleterName === null) return
    if (!confirm(`「${event.title}」の予約を本当に削除しますか？`)) return
    setBusy(true)
    try {
      await onDelete(event, deleterName)
      onClose()
    } catch (err) {
      console.error('削除に失敗:', err)
      alert('削除に失敗しました。')
    } finally {
      setBusy(false)
    }
  }

  const handleDeleteGroup = async () => {
    if (!confirm('この固定枠の繰り返し（同時に登録した全ての回）を削除します。よろしいですか？')) {
      return
    }
    setBusy(true)
    try {
      const n = await onDeleteGroup(recurrenceGroup)
      alert(`${n}件の固定枠を削除しました。`)
      onClose()
    } catch (err) {
      console.error('一括削除に失敗:', err)
      alert('一括削除に失敗しました。')
    } finally {
      setBusy(false)
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
        {mode === 'view' ? (
          <>
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
              {canModify && (
                <button onClick={handleStartEdit} disabled={busy}>
                  編集
                </button>
              )}
              {canModify && (
                <button className="danger" onClick={handleDelete} disabled={busy}>
                  削除
                </button>
              )}
              {isAdmin && recurrenceGroup && onDeleteGroup && (
                <button className="danger" onClick={handleDeleteGroup} disabled={busy}>
                  繰り返し全体を削除
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <h3>予約を編集</h3>
            <label>
              バンド名（必須）
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            {isAdmin && (
              <label>
                種別
                <select value={editType} onChange={(e) => setEditType(e.target.value)}>
                  {selectableTypes.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              開始
              <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            </label>
            <label>
              終了
              <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            </label>
            <label>
              コメント
              <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} />
            </label>
            <div className="dialog-buttons">
              <button onClick={() => setMode('view')} disabled={busy}>
                戻る
              </button>
              <button className="primary" onClick={handleSaveEdit} disabled={busy || !title.trim()}>
                {busy ? '保存中…' : '保存'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
