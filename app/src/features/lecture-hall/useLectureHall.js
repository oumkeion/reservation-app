// 講義棟空き状況データの購読フック
// Firestore (settings/lectureHall) をリアルタイム購読し、読めない場合は
// 静的ファイル /htmls/lecture-hall.json にフォールバックする。
// メインカレンダー用に「音出し禁止」帯（灰）と「音出し可能」帯（緑）の背景イベント、
// および部屋別表示用の生データを返す。
import { useEffect, useMemo, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import { TYPE_COLORS, EVENT_TYPES } from '../../lib/eventTypes'

// データが36時間以上古ければ「夜間更新が止まっている」とみなして警告する
const STALE_THRESHOLD_MS = 36 * 60 * 60 * 1000

export const LECTURE_HALL_COLOR = '#FFD8A8'
export const SOUND_OK_COLOR = '#A5D6A7'

// "1階 A講堂" → "A講堂"（週表示の狭いセルでも読めるように階数を省く）
function shortRoomName(name) {
  return name.replace(/^\d+階\s*/, '')
}

// "HH:MM" → 分（0:00起点）
function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

// 分 → "HH:MM"
function toHHMM(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

// [startMin, endMin] の区間から noSound 帯を引いた残り（音出し可能帯）を返す。
// ranges は scraper 側で和集合・ソート済みだが、念のため整列・マージしてから差し引く。
function complementRanges(ranges, startMin, endMin) {
  const sorted = [...ranges]
    .map((r) => [toMinutes(r.start), toMinutes(r.end)])
    .sort((a, b) => a[0] - b[0])
  const gaps = []
  let cursor = startMin
  for (const [s, e] of sorted) {
    if (s > cursor) gaps.push({ start: toHHMM(cursor), end: toHHMM(Math.min(s, endMin)) })
    cursor = Math.max(cursor, e)
    if (cursor >= endMin) break
  }
  if (cursor < endMin) gaps.push({ start: toHHMM(cursor), end: toHHMM(endMin) })
  return gaps
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

  // メインカレンダー用: 音出し可能帯（音出し禁止帯の補集合）を緑の背景イベントとして返す。
  // 講義棟データの時間軸（既定 07:00〜22:00）内で、禁止帯を除いた残り時間を「音出しOK」とみなす。
  // 禁止帯エントリの無い日は終日（時間軸全域）が音出し可能。
  const soundOkEvents = useMemo(() => {
    if (!data) return []
    const startMin = toMinutes(data.gridStart || '07:00')
    const endMin = toMinutes(data.gridEnd || '22:00')
    const events = []
    // 講義棟予約のある全日付を対象に補集合を計算（noSound に無い日は終日OK）
    for (const date of Object.keys(data.days || {})) {
      const okRanges = complementRanges(data.noSound?.[date] || [], startMin, endMin)
      okRanges.forEach((r, i) => {
        events.push({
          id: `lh-soundok-${date}-${i}`,
          title: '音出し可能',
          start: `${date}T${r.start}:00`,
          end: `${date}T${r.end}:00`,
          display: 'background',
          backgroundColor: SOUND_OK_COLOR,
          borderColor: SOUND_OK_COLOR,
          editable: false,
          extendedProps: { lectureHallSoundOk: true },
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
    soundOkEvents,
    updatedAt: data?.updatedAt ? new Date(data.updatedAt) : null,
    isStale,
    error,
  }
}
