// logs コレクションの購読（操作履歴の可視化用）
// 全操作（予約追加・編集・削除）が記録される。閲覧は全部員に開放。
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore'
import { db } from '../lib/firebase'

// 新しい順に最大300件を購読
export function subscribeLogs(onChange, onError) {
  const q = query(collection(db, 'logs'), orderBy('createdAt', 'desc'), limit(300))
  return onSnapshot(
    q,
    (snapshot) => {
      const logs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      onChange(logs)
    },
    onError,
  )
}
