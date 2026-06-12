// 講義棟空き状況データの購読フック
// Firestore (settings/lectureHall) をリアルタイム購読し、読めない場合は
// 静的ファイル /htmls/lecture-hall.json にフォールバックする。
// 予約カレンダーに重ねられるよう FullCalendar 形式のイベント配列に変換して返す。
import { useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../lib/firebase'

// データが36時間以上古ければ「夜間更新が止まっている」とみなして警告する
const STALE_THRESHOLD_MS = 36 * 60 * 60 * 1000

export const LECTURE_HALL_COLOR = '#FFD8A8'

// "1階 A講堂" → "A講堂"（週表示の狭いセルでも読めるように階数を省く）
function shortRoomName(name) {
  return name.replace(/^\d+階\s*/, '')
}

export function useLectureHall() {
  const [data, setData] = useState(null)
  const [isStale, setIsStale] = useState(false)
  const [error, setError] = useState(false)

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
          console.error('講義棟データの読み込みエラー:', err)
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

  // FullCalendar イベント形式（編集不可、クリックで詳細表示）
  const lectureHallEvents = useMemo(() => {
    if (!data) return []
    const roomNames = Object.fromEntries(
      (data.rooms || []).map((r) => [String(r.id), shortRoomName(r.name)]),
    )
    const events = []
    for (const [date, schedules] of Object.entries(data.days || {})) {
      for (const [roomId, slots] of Object.entries(schedules)) {
        slots.forEach((slot, i) => {
          const room = roomNames[roomId] || `部屋${roomId}`
          events.push({
            id: `lh-${date}-${roomId}-${i}`,
            title: slot.org ? `${room}：${slot.org}` : room,
            start: `${date}T${slot.start}:00`,
            end: `${date}T${slot.end}:00`,
            backgroundColor: LECTURE_HALL_COLOR,
            borderColor: LECTURE_HALL_COLOR,
            editable: false,
            extendedProps: {
              lectureHall: true,
              room,
              org: slot.org || '不明',
              label: slot.label || '',
              sound: slot.sound || '不明',
              startTime: slot.start,
              endTime: slot.end,
            },
          })
        })
      }
    }
    return events
  }, [data])

  return {
    lectureHallEvents,
    updatedAt: data?.updatedAt ? new Date(data.updatedAt) : null,
    isStale,
    error,
  }
}
