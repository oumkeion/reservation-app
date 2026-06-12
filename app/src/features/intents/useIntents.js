// slotIntents のリアルタイム購読フック
// Firestore のドキュメントを FullCalendar 形式（色付き）に変換して返す
import { useEffect, useState } from 'react'
import { subscribeIntents } from '../../models/intents'

// 予約枠の配色（lib/eventTypes.js）と被らない狙い表明専用カラー
export const INTENT_COLOR = '#D8B4FE'

export function useIntents() {
  const [intents, setIntents] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsubscribe = subscribeIntents(
      (docs) => setIntents(docs),
      (err) => {
        console.error('狙い表明の読み込みエラー:', err)
        setError(err)
      },
    )
    return unsubscribe
  }, [])

  const calendarIntents = intents.map((i) => ({
    ...i,
    backgroundColor: INTENT_COLOR,
    borderColor: INTENT_COLOR,
  }))

  return { intents, calendarIntents, error }
}
