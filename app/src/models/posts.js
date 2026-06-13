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
  return ref.id
}

export async function deletePost(postId) {
  await deleteDoc(doc(db, 'posts', postId))
}
