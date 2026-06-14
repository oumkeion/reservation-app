// 固定枠のキャンセル・変更申請ダイアログ（一般部員用）
// 対象の固定枠を選び、キャンセル or 変更（変更後の日時を入力）して申請する。
// 申請は管理者の承認後に反映される。
import { useState } from 'react'
import { REQUEST_KIND } from '../../models/fixedSlotRequests'

function toLocalInput(iso) {
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function FixedSlotRequestDialog({ fixedEvent, onSubmit, onClose }) {
  const [requester, setRequester] = useState('')
  const [kind, setKind] = useState(REQUEST_KIND.CANCEL)
  const [desiredStart, setDesiredStart] = useState(toLocalInput(fixedEvent.start))
  const [desiredEnd, setDesiredEnd] = useState(toLocalInput(fixedEvent.end))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const fmt = (d) =>
    new Date(d).toLocaleString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  const handleSubmit = async () => {
    if (!requester.trim()) {
      alert('申請者名は必須です。')
      return
    }
    if (kind === REQUEST_KIND.CHANGE && new Date(desiredEnd) <= new Date(desiredStart)) {
      alert('変更後の終了時刻は開始時刻より後にしてください。')
      return
    }
    setSaving(true)
    try {
      await onSubmit({
        fixedEvent,
        requester: requester.trim(),
        kind,
        desiredStart: kind === REQUEST_KIND.CHANGE ? new Date(desiredStart).toISOString() : null,
        desiredEnd: kind === REQUEST_KIND.CHANGE ? new Date(desiredEnd).toISOString() : null,
        note: note.trim(),
      })
      alert('申請を送信しました。管理者の承認をお待ちください。')
      onClose()
    } catch (err) {
      console.error('申請の送信に失敗:', err)
      alert('申請の送信に失敗しました。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>固定枠のキャンセル・変更申請</h3>
        <p className="dialog-time">
          対象: {fixedEvent.title}（{fmt(fixedEvent.start)} 〜 {fmt(fixedEvent.end)}）
        </p>
        <label>
          申請者名（必須）
          <input type="text" value={requester} onChange={(e) => setRequester(e.target.value)} autoFocus />
        </label>
        <label>
          申請内容
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value={REQUEST_KIND.CANCEL}>キャンセル（この回を取り消す）</option>
            <option value={REQUEST_KIND.CHANGE}>変更（別の日時に移す）</option>
          </select>
        </label>
        {kind === REQUEST_KIND.CHANGE && (
          <>
            <label>
              変更後の開始
              <input
                type="datetime-local"
                value={desiredStart}
                onChange={(e) => setDesiredStart(e.target.value)}
              />
            </label>
            <label>
              変更後の終了
              <input
                type="datetime-local"
                value={desiredEnd}
                onChange={(e) => setDesiredEnd(e.target.value)}
              />
            </label>
          </>
        )}
        <label>
          備考（任意）
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className="dialog-buttons">
          <button onClick={onClose} disabled={saving}>
            キャンセル
          </button>
          <button className="primary" onClick={handleSubmit} disabled={saving || !requester.trim()}>
            {saving ? '送信中…' : '申請する'}
          </button>
        </div>
      </div>
    </div>
  )
}
