// 画面上部のログイン状態表示バー
export function AuthBar({ profile, loading, login, logout }) {
  if (loading) {
    return <div className="auth-bar">読み込み中…</div>
  }
  if (!profile) {
    return (
      <div className="auth-bar">
        <span>予約するには Google アカウントでログインしてください</span>
        <button onClick={login}>ログイン</button>
      </div>
    )
  }
  return (
    <div className="auth-bar">
      <span>
        {profile.displayName || profile.email}
        {profile.role === 'admin' && '（管理者）'}
      </span>
      <button onClick={logout}>ログアウト</button>
    </div>
  )
}
