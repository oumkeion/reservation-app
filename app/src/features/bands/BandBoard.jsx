// バンド掲示板: 現存バンドの一覧表示（枠の取りやすさを判断する材料）
// ログイン不要。登録・解散とも代表者名の手入力で運用する（予約と同じ方式）。
import { useEffect, useState } from 'react'
import { subscribeActiveBands, createBand, disbandBand } from '../../models/bands'
import { CreateBandDialog } from './CreateBandDialog'

export function BandBoard() {
  const [bands, setBands] = useState([])
  const [error, setError] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    const unsubscribe = subscribeActiveBands(setBands, () => setError(true))
    return unsubscribe
  }, [])

  const handleDisband = async (band) => {
    if (!confirm(`「${band.name}」を解散済みにしますか？`)) return
    const input = prompt(
      `本人確認のため、登録時の代表者名(${band.representative || '不明'})を入力してください:`,
    )
    if (input === null) return
    if (!band.representative || input.trim() !== band.representative) {
      alert('入力された名前が一致しません。')
      return
    }
    try {
      await disbandBand(band.id)
    } catch (err) {
      console.error('解散処理に失敗:', err)
      alert('解散処理に失敗しました。')
    }
  }

  const sorted = [...bands].sort((a, b) => a.name.localeCompare(b.name, 'ja'))

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
      {sorted.length === 0 && !error && (
        <p className="placeholder">登録されているバンドはまだありません。</p>
      )}
      <ul className="band-list">
        {sorted.map((band) => (
          <li key={band.id} className="band-card">
            <div className="band-card-main">
              <span className="band-name">{band.name}</span>
              {band.genre && <span className="band-genre">{band.genre}</span>}
            </div>
            <div className="band-card-sub">代表: {band.representative || '不明'}</div>
            <button className="band-disband" onClick={() => handleDisband(band)}>
              解散
            </button>
          </li>
        ))}
      </ul>
      {showCreate && (
        <CreateBandDialog onSave={createBand} onClose={() => setShowCreate(false)} />
      )}
    </div>
  )
}
