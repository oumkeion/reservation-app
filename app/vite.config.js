import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, createReadStream } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 講義棟予約カレンダーの静的HTML（public/htmls/YYYY-MM-DD.html）を
// 開発サーバーでも /htmls/* として配信する（34MBあるため app/public へは複製しない）
function lectureHallHtmlsDevMiddleware() {
  const htmlsDir = path.resolve(__dirname, '../public/htmls')
  return {
    name: 'lecture-hall-htmls-dev-middleware',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/htmls/')) return next()
        const filePath = path.join(htmlsDir, req.url.slice('/htmls/'.length))
        if (!filePath.startsWith(htmlsDir) || !existsSync(filePath)) {
          res.statusCode = 404
          res.end('Not found')
          return
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        createReadStream(filePath).pipe(res)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), lectureHallHtmlsDevMiddleware()],
})
