// 部誌: Xのような短文つぶやきタイムライン
// ログイン不要。投稿は本文＋名前、削除は投稿者名一致（管理者は無条件で削除可）。
import { useEffect, useState } from 'react'
import {
  subscribePosts,
  createPost,
  deletePost,
  POST_MAX_LENGTH,
} from '../../models/posts'

// Firestore Timestamp / null → 相対時刻表示
function relativeTime(createdAt) {
  if (!createdAt?.toDate) return '送信中…'
  const diffMs = Date.now() - createdAt.toDate().getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'たった今'
  if (min < 60) return `${min}分前`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours}時間前`
  return createdAt.toDate().toLocaleDateString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
  })
}

export function JournalBoard({ isAdmin }) {
  const [posts, setPosts] = useState([])
  const [error, setError] = useState(false)
  const [body, setBody] = useState('')
  const [author, setAuthor] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    const unsubscribe = subscribePosts(setPosts, (err) => {
      console.error('部誌の読み込みエラー:', err)
      setError(true)
    })
    return unsubscribe
  }, [])

  const handlePost = async () => {
    if (!body.trim() || !author.trim()) {
      alert('本文と名前は必須です。')
      return
    }
    setSending(true)
    try {
      await createPost({ body: body.trim(), author: author.trim() })
      setBody('')
    } catch (err) {
      console.error('投稿に失敗:', err)
      alert('投稿に失敗しました。')
    } finally {
      setSending(false)
    }
  }

  const handleDelete = async (post) => {
    if (!isAdmin) {
      const input = prompt(
        `本人確認のため、この投稿の名前(${post.author || '不明'})を入力してください:`,
      )
      if (input === null) return
      if (!post.author || input.trim() !== post.author) {
        alert('入力された名前が一致しません。')
        return
      }
    }
    if (!confirm('この投稿を削除しますか？')) return
    try {
      await deletePost(post.id)
    } catch (err) {
      console.error('削除に失敗:', err)
      alert('削除に失敗しました。')
    }
  }

  return (
    <div className="journal">
      <h2>部誌</h2>
      <div className="journal-form">
        <textarea
          value={body}
          maxLength={POST_MAX_LENGTH}
          placeholder="いまどうしてる？（練習報告・連絡・つぶやきなど）"
          onChange={(e) => setBody(e.target.value)}
          rows={3}
        />
        <div className="journal-form-row">
          <input
            type="text"
            value={author}
            placeholder="名前（必須）"
            onChange={(e) => setAuthor(e.target.value)}
          />
          <span className="journal-count">
            {body.length}/{POST_MAX_LENGTH}
          </span>
          <button
            className="primary"
            onClick={handlePost}
            disabled={sending || !body.trim() || !author.trim()}
          >
            {sending ? '送信中…' : '投稿'}
          </button>
        </div>
      </div>

      {error && (
        <p className="error-bar">部誌の読み込みに失敗しました。再読み込みしてください。</p>
      )}
      {posts.length === 0 && !error && (
        <p className="placeholder">まだ投稿がありません。最初のひとことをどうぞ。</p>
      )}
      <ul className="journal-list">
        {posts.map((post) => (
          <li key={post.id} className="journal-post">
            <div className="journal-post-head">
              <span className="journal-author">{post.author || '名無し'}</span>
              <span className="journal-time">{relativeTime(post.createdAt)}</span>
              <button className="journal-delete" onClick={() => handleDelete(post)}>
                削除
              </button>
            </div>
            <p className="journal-body">{post.body}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
