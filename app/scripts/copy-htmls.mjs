// ビルド後に public/htmls (講義棟予約カレンダーのスクレイピング結果) を dist/htmls へコピーする。
// 34MBあるため app/public には置かず、ビルド時にのみ統合する。
import { existsSync } from 'node:fs'
import { cp } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const src = path.resolve(__dirname, '../../public/htmls')
const dest = path.resolve(__dirname, '../dist/htmls')

if (!existsSync(src)) {
  console.warn(`[copy-htmls] スキップ: ${src} が見つかりません`)
} else {
  await cp(src, dest, { recursive: true })
  console.log(`[copy-htmls] ${src} -> ${dest}`)
}
