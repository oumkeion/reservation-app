// Google 認証の状態を管理するフック
// profile: users コレクションのプロファイル（role 含む）。未ログイン時は null。
import { useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { auth, googleProvider } from '../../lib/firebase'
import { ensureUserProfile } from '../../models/users'

export function useAuth() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setProfile(null)
        setLoading(false)
        return
      }
      try {
        const p = await ensureUserProfile(user)
        setProfile(p)
      } catch (err) {
        console.error('プロファイル取得に失敗:', err)
        // 認証自体は成功しているので最低限の情報で続行
        setProfile({
          uid: user.uid,
          displayName: user.displayName || '',
          email: user.email || '',
          role: 'member',
        })
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

  return { profile, loading, login, logout, isAdmin: profile?.role === 'admin' }
}
