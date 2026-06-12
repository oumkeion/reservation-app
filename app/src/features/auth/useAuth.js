// Google 認証の状態を管理するフック
//
// ログインは「必須」ではない。通常の部室予約はログイン無しでも可能（記入者名を手入力）。
// ログインが必要になるのは:
//   - 管理者操作（固定枠・音出し禁止枠の設定、保護枠の削除）→ isAdmin で判定
//   - Phase1以降の機能（バンド作成・狙い表明など、「誰か」が必要な機能）→ profile で判定
//
// isAdmin は旧アプリと同じ判定方法: admins コレクションに自分のメールのドキュメントが存在するか
import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider, db } from '../../lib/firebase'
import { ensureUserProfile } from '../../models/users'

export function useAuth() {
  const [profile, setProfile] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setProfile(null)
        setIsAdmin(false)
        setLoading(false)
        return
      }
      try {
        const [p, adminSnap] = await Promise.all([
          ensureUserProfile(user),
          user.email ? getDoc(doc(db, 'admins', user.email)) : Promise.resolve(null),
        ])
        setProfile(p)
        setIsAdmin(!!adminSnap?.exists())
      } catch (err) {
        console.error('プロファイル/管理者情報の取得に失敗:', err)
        setProfile({
          uid: user.uid,
          displayName: user.displayName || '',
          email: user.email || '',
          role: 'member',
        })
        setIsAdmin(false)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        console.error('ログインに失敗:', err)
        alert('ログインに失敗しました。')
      }
    }
  }

  const logout = () => signOut(auth)

  return { profile, loading, login, logout, isAdmin }
}
