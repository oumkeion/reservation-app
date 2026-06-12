// 講義棟 空き状況グリッド
// 夜間スクレイピングが Firestore (settings/lectureHall) に書き込む構造化データを購読し、
// 日付ごとに 10部屋 × 07:00〜22:00 の横棒グリッドで埋まり状況を一目で表示する。
// Firestore に無い場合は静的ファイル /htmls/lecture-hall.json にフォールバックする。
// データが36時間以上古い場合は警告を出す（夜間更新が止まったことを可視化するため）。
import { useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../lib/firebase'

const STALE_THRESHOLD_MS = 36 * 60 * 60 * 1000

function formatDate(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// "HH:MM" → 分（0:00起点）
function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function LectureHallGrid() {
  const [data, setData] = useState(null)
  const [isStale, setIsStale] = useState(false)
  const [error, setError] = useState(false)
  const [date, setDate] = useState(formatDate(new Date()))

  useEffect(() => {
    // 鮮度判定はレンダー外（データ受信時）に行う
    const receive = (d) => {
      setData(d)
      const updatedAt = d.updatedAt ? new Date(d.updatedAt).getTime() : 0
      setIsStale(Date.now() - updatedAt > STALE_THRESHOLD_MS)
    }
    const fallbackFetch = () => {
      fetch('/htmls/lecture-hall.json')
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.json()
        })
        .then(receive)
        .catch((err) => {
          console.error('空き状況データの読み込みエラー:', err)
          setError(true)
        })
    }
    const unsubscribe = onSnapshot(
      doc(db, 'settings', 'lectureHall'),
      (snap) => {
        if (snap.exists()) {
          receive(snap.data())
        } else {
          fallbackFetch()
        }
      },
      (err) => {
        console.warn('Firestore からの読み込みに失敗、静的ファイルにフォールバック:', err)
        fallbackFetch()
      },
    )
    return unsubscribe
  }, [])

  const { dates, gridStartMin, gridEndMin, hours } = useMemo(() => {
    if (!data) return { dates: [], gridStartMin: 0, gridEndMin: 0, hours: [] }
    const startMin = toMinutes(data.gridStart || '07:00')
    const endMin = toMinutes(data.gridEnd || '22:00')
    const hourLabels = []
    for (let m = startMin; m < endMin; m += 60) {
      hourLabels.push(`${Math.floor(m / 60)}`)
    }
    return {
      dates: Object.keys(data.days).sort(),
      gridStartMin: startMin,
      gridEndMin: endMin,
      hours: hourLabels,
    }
  }, [data])

  if (error) {
    return (
      <p className="error-bar">
        空き状況データ（lecture-hall.json）の読み込みに失敗しました。スクレイパー未実行の可能性があります。
      </p>
    )
  }
  if (!data) {
    return <p className="placeholder">空き状況を読み込み中…</p>
  }

  const day = data.days[date]
  const totalMin = gridEndMin - gridStartMin
  const pct = (min) => `${((min - gridStartMin) / totalMin) * 100}%`
  const widthPct = (startMin, endMin) => `${((endMin - startMin) / totalMin) * 100}%`

  const updatedAtDate = data.updatedAt ? new Date(data.updatedAt) : null

  return (
    <div className="lh-grid">
      {isStale && (
        <p className="error-bar">
          ⚠️ 空き状況データが36時間以上更新されていません。夜間の自動取得が止まっている可能性があります
          （GitHub Actions の「Nightly Scrape」を確認してください）。
        </p>
      )}
      <div className="lecture-hall-controls">
        <label htmlFor="lhGridDate">日付選択:</label>
        <input
          id="lhGridDate"
          type="date"
          min={dates[0]}
          max={dates[dates.length - 1]}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <span className="lh-updated">
          データ更新: {updatedAtDate ? updatedAtDate.toLocaleString('ja-JP') : '不明'}
        </span>
      </div>

      {!day && (
        <p className="placeholder">{date} のデータはありません（取得範囲外の日付です）。</p>
      )}

      {day && (
        <div className="lh-table">
          <div className="lh-row lh-row-header">
            <div className="lh-room-name" />
            <div className="lh-lane">
              {hours.map((h) => (
                <span
                  key={h}
                  className="lh-hour-label"
                  style={{ left: pct(Number(h) * 60) }}
                >
                  {h}
                </span>
              ))}
            </div>
          </div>
          {data.rooms.map((room) => {
            const slots = day[String(room.id)] || []
            return (
              <div className="lh-row" key={room.id}>
                <div className="lh-room-name">{room.name}</div>
                <div className="lh-lane">
                  {hours.map((h) => (
                    <span
                      key={h}
                      className="lh-hour-line"
                      style={{ left: pct(Number(h) * 60) }}
                    />
                  ))}
                  {slots.map((slot, i) => (
                    <span
                      key={i}
                      className="lh-busy"
                      style={{
                        left: pct(toMinutes(slot.start)),
                        width: widthPct(toMinutes(slot.start), toMinutes(slot.end)),
                      }}
                      title={`${slot.start}〜${slot.end} 予約あり`}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <p className="lh-legend">
        <span className="lh-busy lh-legend-chip" /> = 予約あり（空欄は空き）。
        データは毎晩の自動取得時点のものです。
      </p>
    </div>
  )
}
