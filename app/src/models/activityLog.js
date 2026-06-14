// 予約以外の操作（バンド・部誌・狙い表明）も logs コレクションに記録する共通ヘルパ。
// 予約ログ(events.js)と同じ logs コレクションを使い、detail に内容文字列を入れる。
import { collection, addDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

export async function logActivity(action, editor, detail) {
  try {
    await addDoc(collection(db, 'logs'), {
      createdAt: new Date().toISOString(),
      timestamp: new Date().toLocaleString('ja-JP'),
      action,
      editor: editor || '不明',
      detail: detail || '',
    })
  } catch (err) {
    // ログ失敗は本処理の成否に影響させない
    console.warn('ログの記録に失敗しました:', err)
  }
}
