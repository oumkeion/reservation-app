// 固定枠の一括登録ダイアログ（管理者専用）
// 曜日・時間・期間を指定して、毎週繰り返す固定枠をまとめて作成する。
import { useState } from 'react'

const WEEKDAYS = [
  { value: 1, label: '月' },
  { value: 2, label: '火' },
  { value: 3, label: '水' },
  { value: 4, label: '木' },
  { value: 5, label: '金' },
  { value: 6, label: '土' },
  { value: 0, label: '日' },
]

function todayStr() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function FixedSlotBulkDialog({ adminName, bands = [], onSave, onClose }) {
  const [title, setTitle] = useState('')
  const [weekday, setWeekday] = useState(1)
  const [startTime, setStartTime] = useState('18:00')
  const [endTime, setEndTime] = useState('20:00')
  const [startDate, setStartDate] = useState(todayStr())
  const [endDate, setEndDate] = useState(todayStr())
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!title.trim()) {
      alert('バンド名（枠の名前）は必須です。')
      return
    }
    if (endTime <= startTime) {
      alert('終了時刻は開始時刻より後にしてください。')
      return
    }
    if (endDate < startDate) {
      alert('終了日は開始日以降にしてください。')
      return
    }
    setSaving(true)
    try {
      const { created, skipped } = await onSave({
        title: title.trim(),
        weekday: Number(weekday),
        startTime,
        endTime,
        startDate,
        endDate,
        comment: comment.trim(),
        editor: adminName || '管理者',
      })
      if (created === 0 && skipped === 0) {
        alert('指定した期間に該当する曜日がありませんでした。')
        return
      }
      alert(
        `${created}件の固定枠を登録しました。` +
          (skipped ? `\n${skipped}件は既存の予約と重複していたためスキップしました。` : ''),
      )
      onClose()
    } catch (err) {
      console.error('固定枠の一括登録に失敗:', err)
      alert('固定枠の一括登録に失敗しました。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>固定枠の一括登録（管理者）</h3>
        <label>
          バンド名（必須・一覧から選択、または自由入力）
          <input
            type="text"
            list="fixed-band-list"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="一覧から選択、またはメンテ等を自由入力"
            autoFocus
          />
          <datalist id="fixed-band-list">
            {bands.map((b) => (
              <option key={b.id} value={b.name} />
            ))}
          </datalist>
        </label>
        <label>
          曜日
          <select value={weekday} onChange={(e) => setWeekday(e.target.value)}>
            {WEEKDAYS.map((w) => (
              <option key={w.value} value={w.value}>
                毎週{w.label}曜
              </option>
            ))}
          </select>
        </label>
        <label>
          開始時刻
          <input type="time" value={startTime} step="900" onChange={(e) => setStartTime(e.target.value)} />
        </label>
        <label>
          終了時刻
          <input type="time" value={endTime} step="900" onChange={(e) => setEndTime(e.target.value)} />
        </label>
        <label>
          開始日
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label>
          終了日
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>
        <label>
          コメント
          <input type="text" value={comment} onChange={(e) => setComment(e.target.value)} />
        </label>
        <div className="dialog-buttons">
          <button onClick={onClose} disabled={saving}>
            キャンセル
          </button>
          <button className="primary" onClick={handleSave} disabled={saving || !title.trim()}>
            {saving ? '登録中…' : '一括登録'}
          </button>
        </div>
      </div>
    </div>
  )
}
