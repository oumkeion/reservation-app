// 講義棟予約カレンダー（部屋別・日付選択式）
// メインカレンダーの下に表示する。スクレイプした予約を部屋×時間の横棒で表示し、
// クリックで詳細（団体・内容・音出し可否）を開く。
// 音出し不可の予約は赤、音出し可の予約は緑で塗り分ける。
import { useMemo, useState } from 'react'
import { SOUND_OK_COLOR } from './useLectureHall'

const BUSY_COLOR = '#e57373'

function formatDate(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// "HH:MM" → 分（0:00起点）
function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function LectureHallBoard({ data, rooms, onSelectSlot }) {
  const [date, setDate] = useState(formatDate(new Date()))

  const { dates, startMin, endMin, hours } = useMemo(() => {
    if (!data) return { dates: [], startMin: 0, endMin: 0, hours: [] }
    const s = toMinutes(data.gridStart || '07:00')
    const e = toMinutes(data.gridEnd || '22:00')
    const hourLabels = []
    for (let m = s; m < e; m += 60) hourLabels.push(Math.floor(m / 60))
    return { dates: Object.keys(data.days || {}).sort(), startMin: s, endMin: e, hours: hourLabels }
  }, [data])

  if (!data) {
    return <p className="placeholder">講義棟の予約データを読み込み中…</p>
  }

  const day = data.days?.[date]
  const totalMin = endMin - startMin
  const pct = (min) => `${((min - startMin) / totalMin) * 100}%`

  return (
    <div className="lh-board">
      <div className="lecture-hall-controls">
        <label htmlFor="lhBoardDate">日付選択:</label>
        <input
          id="lhBoardDate"
          type="date"
          min={dates[0]}
          max={dates[dates.length - 1]}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {!day && <p className="placeholder">{date} のデータはありません（取得範囲外の日付です）。</p>}

      {day && (
        <div className="lh-table">
          <div className="lh-row lh-row-header">
            <div className="lh-room-name" />
            <div className="lh-lane">
              {hours.map((h) => (
                <span key={h} className="lh-hour-label" style={{ left: pct(h * 60) }}>
                  {h}
                </span>
              ))}
            </div>
          </div>
          {rooms.map((room) => {
            const slots = day[String(room.id)] || []
            return (
              <div className="lh-row" key={room.id}>
                <div className="lh-room-name">{room.name}</div>
                <div className="lh-lane">
                  {hours.map((h) => (
                    <span key={h} className="lh-hour-line" style={{ left: pct(h * 60) }} />
                  ))}
                  {slots.map((slot, i) => (
                    <button
                      key={i}
                      className="lh-busy"
                      style={{
                        left: pct(toMinutes(slot.start)),
                        width: `${((toMinutes(slot.end) - toMinutes(slot.start)) / totalMin) * 100}%`,
                        background: slot.sound === '可' ? SOUND_OK_COLOR : BUSY_COLOR,
                      }}
                      title={`${slot.start}〜${slot.end} ${slot.org || ''}`}
                      onClick={() =>
                        onSelectSlot({
                          start: new Date(`${date}T${slot.start}:00`),
                          extendedProps: {
                            room: room.shortName,
                            org: slot.org || '不明',
                            label: slot.label || '',
                            sound: slot.sound || '不明',
                            startTime: slot.start,
                            endTime: slot.end,
                          },
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <p className="lh-legend">
        <span className="lh-legend-chip" style={{ background: BUSY_COLOR }} /> 音出し不可の予約
        <span className="lh-legend-chip" style={{ background: SOUND_OK_COLOR }} /> 音出し可の予約
        （クリックで詳細表示）
      </p>
    </div>
  )
}
