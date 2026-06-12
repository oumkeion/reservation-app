// users コレクション: 部員プロファイル
// ログイン時に自動作成される。全新機能（バンド・狙い表明・掲示板）の土台。
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'

// ログイン済みユーザーのプロファイルを取得し、無ければ作成する
export async function ensureUserProfile(user) {
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  if (snap.exists()) {
    return { uid: user.uid, ...snap.data() }
  }
  const profile = {
    displayName: user.displayName || '',
    email: user.email || '',
    role: 'member',
    createdAt: serverTimestamp(),
  }
  await setDoc(ref, profile)
  return { uid: user.uid, ...profile }
}
