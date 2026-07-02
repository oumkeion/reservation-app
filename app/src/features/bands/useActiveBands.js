// 現存バンドをリアルタイム購読するフック（予約フォームのバンド選択などで共有）
import { useEffect, useState } from 'react'
import { subscribeActiveBands } from '../../models/bands'

export function useActiveBands() {
  const [bands, setBands] = useState([])

  useEffect(() => {
    const unsubscribe = subscribeActiveBands(setBands, (err) =>
      console.warn('バンド一覧の購読に失敗しました:', err),
    )
    return unsubscribe
  }, [])

  return bands
}
