// 講義棟空き状況データの購読フック
// Firestore (settings/lectureHall) をリアルタイム購読し、読めない場合は
// 静的ファイル /htmls/lecture-hall.json にフォールバックする。
// メインカレンダー用の「音出し禁止」背景イベント（灰）と、部屋別表示用の生データを返す。
import { useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { TYPE_COLORS, EVENT_TYPES } from '../../lib/eventTypes'

// データが36時間以上古ければ「夜間更新が止まっている」とみなして警告する
const STALE_THRESHOLD_MS = 36 * 60 * 60 * 1000

export const LECTURE_HALL_COLOR = '#FFD8A8'
// 部屋別ボードで「音出し可の予約」を示す緑
export const SOUND_OK_COLOR = '#A5D6A7'

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

  // メインカレンダー用: 音出し禁止帯（「音出し不可」予約の日毎和集合）を
  // 灰色の背景イベントとして返す。スクレイプデータから直接導出するので常に最新。
  const noSoundEvents = useMemo(() => {
    if (!data) return []
    const color = TYPE_COLORS[EVENT_TYPES.NO_SOUND]
    const events = []
    for (const [date, ranges] of Object.entries(data.noSound || {})) {
      ranges.forEach((r, i) => {
        events.push({
          id: `lh-nosound-${date}-${i}`,
          title: '音出し禁止（講義棟使用中）',
          start: `${date}T${r.start}:00`,
          end: `${date}T${r.end}:00`,
          display: 'background',
          backgroundColor: color,
          borderColor: color,
          editable: false,
          extendedProps: { lectureHallNoSound: true },
        })
      })
    }
    return events
  }, [data])

  // 部屋別カレンダー用に部屋名を短縮した生データも返す
  const rooms = useMemo(
    () =>
      (data?.rooms || []).map((r) => ({ ...r, shortName: shortRoomName(r.name) })),
    [data],
  )

  return {
    data,
    rooms,
    noSoundEvents,
    updatedAt: data?.updatedAt ? new Date(data.updatedAt) : null,
    isStale,
    error,
  }
}
