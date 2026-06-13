// バンド情報の編集ダイアログ（代表者名の一致で本人確認してから保存）
import { useState } from 'react'

export function EditBandDialog({ band, onSave, onClose }) {
  const [name, setName] = useState(band.name)
  const [genre, setGenre] = useState(band.genre || '')
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
      await onSave(band.id, { name: name.trim(), genre: genre.trim() })
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
          ジャンル
          <input
            type="text"
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            placeholder="例: ロック、ポップス"
          />
        </label>
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
