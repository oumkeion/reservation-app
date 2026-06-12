// Firebase 初期化（modular SDK）
// このファイルだけが Firebase の設定を知っている。他のファイルは db / auth を import する。
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'

// Web クライアントの apiKey は公開前提の識別子（秘密鍵ではない）
const firebaseConfig = {
  apiKey: 'AIzaSyCnB855ZLYhmh22N9yU-LBUQzw_-fQq1gU',
  authDomain: 'oumkeion-reservation-app.firebaseapp.com',
  projectId: 'oumkeion-reservation-app',
  storageBucket: 'oumkeion-reservation-app.firebasestorage.app',
  messagingSenderId: '689409462750',
  appId: '1:689409462750:web:3eebd8beadb14c32bd8d4f',
}

const app = initializeApp(firebaseConfig)

export const db = getFirestore(app)
export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
