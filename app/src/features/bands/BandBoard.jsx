// バンド掲示板: 現存バンドの一覧表示（枠の取りやすさを判断する材料）
// ログイン不要。登録・解散とも代表者名の手入力で運用する（予約と同じ方式）。
import { useEffect, useState } from 'react'
import {
  subscribeActiveBands,
  createBand,
  updateBand,
  disbandBand,
  cleanupExpiredBands,
  BAND_CATEGORIES,
  DEFAULT_BAND_CATEGORY,
} from '../../models/bands'
import { CreateBandDialog } from './CreateBandDialog'
import { EditBandDialog } from './EditBandDialog'

export function BandBoard() {
  const [bands, setBands] = useState([])
  const [error, setError] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [editingBand, setEditingBand] = useState(null)
  const [categoryFilter, setCategoryFilter] = useState('all')

  useEffect(() => {
    // 本番日を過ぎたバンドを自動削除してから購読する
    cleanupExpiredBands()
    const unsubscribe = subscribeActiveBands(setBands, () => setError(true))
    return unsubscribe
  }, [])

  const handleDisband = async (band) => {
    if (!confirm(`「${band.name}」を解散済みにしますか？\n解散すると、このバンドの今後の予約もすべて削除されます。`)) return
    const input = prompt(
      `本人確認のため、登録時の代表者名(${band.representative || '不明'})を入力してください:`,
    )
    if (input === null) return
    if (!band.representative || input.trim() !== band.representative) {
      alert('入力された名前が一致しません。')
      return
    }
    try {
      const result = await disbandBand(band.id, band)
      if (result?.failed) {
        alert(
          `解散しました。今後の予約${result.removed}件を削除しましたが、` +
            `固定枠など${result.failed}件は削除できませんでした。固定枠は「キャンセル・変更申請」から管理者に依頼してください。`,
        )
      } else if (result?.removed) {
        alert(`解散しました。今後の予約${result.removed}件も削除しました。`)
      }
    } catch (err) {
      console.error('解散処理に失敗:', err)
      alert('解散処理に失敗しました。')
    }
  }

  // 本番日が近い順（未設定は最後）→ 同日・未設定同士はバンド名順
  const sorted = [...bands].sort((a, b) => {
    const da = a.performanceDate || ''
    const db = b.performanceDate || ''
    if (da && db && da !== db) return da < db ? -1 : 1
    if (da && !db) return -1
    if (!da && db) return 1
    return a.name.localeCompare(b.name, 'ja')
  })
  const filtered =
    categoryFilter === 'all'
      ? sorted
      : sorted.filter((b) => (b.category || DEFAULT_BAND_CATEGORY) === categoryFilter)

  return (
    <div className="band-board">
      <div className="band-board-header">
        <h2>バンド一覧（現在 {bands.length} バンド）</h2>
        <button className="primary" onClick={() => setShowCreate(true)}>
          + バンドを登録
        </button>
      </div>
      {error && (
        <p className="error-bar">バンド情報の読み込みに失敗しました。再読み込みしてください。</p>
      )}
      <div className="band-filter">
        <button
          className={categoryFilter === 'all' ? 'band-filter-chip active' : 'band-filter-chip'}
          onClick={() => setCategoryFilter('all')}
        >
          すべて
        </button>
        {BAND_CATEGORIES.map((c) => (
          <button
            key={c}
            className={categoryFilter === c ? 'band-filter-chip active' : 'band-filter-chip'}
            onClick={() => setCategoryFilter(c)}
          >
            {c}
          </button>
        ))}
      </div>
      {filtered.length === 0 && !error && (
        <p className="placeholder">
          {categoryFilter === 'all'
            ? '登録されているバンドはまだありません。'
            : `「${categoryFilter}」のバンドはまだありません。`}
        </p>
      )}
      <ul className="band-list">
        {filtered.map((band) => (
          <li key={band.id} className="band-card">
            <div className="band-card-main">
              <span className="band-name">{band.name}</span>
              <span className="band-category">{band.category || DEFAULT_BAND_CATEGORY}</span>
              {band.performanceDate && (
                <span className="band-perf">🎤 本番 {band.performanceDate}</span>
              )}
            </div>
            {band.songs && <div className="band-songs">演奏曲: {band.songs}</div>}
            <div className="band-card-sub">代表: {band.representative || '不明'}</div>
            <div className="band-card-actions">
              <button className="band-action" onClick={() => setEditingBand(band)}>
                編集
              </button>
              <button className="band-action" onClick={() => handleDisband(band)}>
                解散
              </button>
            </div>
          </li>
        ))}
      </ul>
      {showCreate && (
        <CreateBandDialog onSave={createBand} onClose={() => setShowCreate(false)} />
      )}
      {editingBand && (
        <EditBandDialog
          band={editingBand}
          onSave={updateBand}
          onClose={() => setEditingBand(null)}
        />
      )}
    </div>
  )
}
