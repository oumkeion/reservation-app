// events のリアルタイム購読フック
// Firestore のドキュメントを FullCalendar 形式（色付き）に変換して返す
import { useEffect, useState } from 'react'
import { subscribeEvents } from '../../models/events'
import { TYPE_COLORS, EVENT_TYPES } from '../../lib/eventTypes'

export function useEvents() {
  const [events, setEvents] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsubscribe = subscribeEvents(
      (docs) => setEvents(docs),
      (err) => {
        console.error('イベントの読み込みエラー:', err)
        setError(err)
      },
    )
    return unsubscribe
  }, [])

  const calendarEvents = events.map((e) => {
    const type = e.extendedProps?.type
    return {
      ...e,
      backgroundColor: TYPE_COLORS[type],
      borderColor: TYPE_COLORS[type],
      // 音出し禁止は背景表示にして「予約できない時間」と分かるようにする
      display: type === EVENT_TYPES.NO_SOUND ? 'background' : 'auto',
    }
  })

  return { events, calendarEvents, error }
}
