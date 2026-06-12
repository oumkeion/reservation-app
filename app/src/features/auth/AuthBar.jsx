// 画面上部のログイン状態表示バー
// ログインは管理者操作・バンド機能のために任意。予約自体には不要なことを明示する。
export function AuthBar({ profile, isAdmin, loading, login, logout }) {
  if (loading) {
    return <div className="auth-bar">読み込み中…</div>
  }
  if (!profile) {
    return (
      <div className="auth-bar">
        <span className="auth-hint">予約に必要なログインはありません</span>
        <button onClick={login}>管理者ログイン</button>
      </div>
    )
  }
  return (
    <div className="auth-bar">
      <span>
        {profile.displayName || profile.email}
        {isAdmin && <span className="admin-badge">管理者</span>}
      </span>
      <button onClick={logout}>ログアウト</button>
    </div>
  )
}
