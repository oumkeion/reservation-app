// posts コレクション: 部誌（Xのような短文つぶやき）
// ログイン不要・投稿者名は手入力。削除は投稿者名一致で本人確認（予約と同じ運用）。
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { logActivity } from './activityLog'

export const POST_MAX_LENGTH = 300

// 最新100件を新しい順でリアルタイム購読
export function subscribePosts(onChange, onError) {
  const q = query(
    collection(db, 'posts'),
    orderBy('createdAt', 'desc'),
    limit(100),
  )
  return onSnapshot(
    q,
    (snapshot) => {
      const posts = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      onChange(posts)
    },
    onError,
  )
}

export async function createPost({ body, author }) {
  const post = {
    body,
    author,
    createdAt: serverTimestamp(),
  }
  const ref = await addDoc(collection(db, 'posts'), post)
  await logActivity('部誌投稿', author, body.length > 30 ? `${body.slice(0, 30)}…` : body)
  return ref.id
}

export async function deletePost(post) {
  await deleteDoc(doc(db, 'posts', post.id))
  await logActivity('部誌削除', post.author || '不明', '投稿を削除')
}
