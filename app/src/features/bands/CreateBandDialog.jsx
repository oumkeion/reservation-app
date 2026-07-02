// バンド登録ダイアログ（ログイン不要、予約と同じく手入力）
import { useState } from 'react'

export function CreateBandDialog({ onSave, onClose }) {
  const [name, setName] = useState('')
  const [songs, setSongs] = useState('')
  const [performanceDate, setPerformanceDate] = useState('')
  const [representative, setRepresentative] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim() || !representative.trim()) {
      alert('バンド名と代表者名は必須です。')
      return
    }
    setSaving(true)
    try {
      await onSave({
        name: name.trim(),
        songs: songs.trim(),
        performanceDate,
        representative: representative.trim(),
      })
      onClose()
    } catch (err) {
      console.error('バンドの登録に失敗:', err)
      alert('バンドの登録に失敗しました。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>バンドを登録</h3>
        <label>
          バンド名（必須）
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="（必須）"
            autoFocus
          />
        </label>
        <label>
          演奏する曲（任意）
          <textarea
            value={songs}
            onChange={(e) => setSongs(e.target.value)}
            placeholder="例: 曲名A / 曲名B（自由記入）"
            rows={3}
          />
        </label>
        <label>
          ライブ本番日（任意）
          <input
            type="date"
            value={performanceDate}
            onChange={(e) => setPerformanceDate(e.target.value)}
          />
        </label>
        <p className="dialog-note">本番日を過ぎると自動で一覧から削除されます（延期時は編集で変更）。</p>
        <label>
          代表者名（必須）
          <input
            type="text"
            value={representative}
            onChange={(e) => setRepresentative(e.target.value)}
            placeholder="（必須・編集/解散時の本人確認に使用）"
          />
        </label>
        <div className="dialog-buttons">
          <button onClick={onClose}>キャンセル</button>
          <button
            className="primary"
            onClick={handleSave}
            disabled={saving || !name.trim() || !representative.trim()}
          >
            {saving ? '登録中…' : '登録'}
          </button>
        </div>
      </div>
    </div>
  )
}
