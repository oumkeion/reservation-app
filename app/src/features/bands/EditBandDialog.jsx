// バンド情報の編集ダイアログ（代表者名の一致で本人確認してから保存）
import { useState } from 'react'
import { BAND_CATEGORIES, DEFAULT_BAND_CATEGORY } from '../../models/bands'

export function EditBandDialog({ band, onSave, onClose }) {
  const [name, setName] = useState(band.name)
  const [songs, setSongs] = useState(band.songs || '')
  const [performanceDate, setPerformanceDate] = useState(band.performanceDate || '')
  const [category, setCategory] = useState(band.category || DEFAULT_BAND_CATEGORY)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) {
      alert('バンド名は必須です。')
      return
    }
    const input = prompt(
      `本人確認のため、登録時の代表者名(${band.representative || '不明'})を入力してください:`,
    )
    if (input === null) return
    if (!band.representative || input.trim() !== band.representative) {
      alert('入力された名前が一致しません。')
      return
    }
    setSaving(true)
    try {
      await onSave(band.id, {
        name: name.trim(),
        songs: songs.trim(),
        performanceDate,
        category,
      })
      onClose()
    } catch (err) {
      console.error('バンド情報の更新に失敗:', err)
      alert('バンド情報の更新に失敗しました。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>バンド情報を編集</h3>
        <label>
          バンド名（必須）
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </label>
        <label>
          カテゴリ
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {BAND_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
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
        <p className="dialog-note">本番が延期になった場合はここで日付を変更してください。</p>
        <div className="dialog-buttons">
          <button onClick={onClose}>キャンセル</button>
          <button className="primary" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
