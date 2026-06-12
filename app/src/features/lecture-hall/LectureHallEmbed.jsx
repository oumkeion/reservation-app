// 講義棟予約カレンダー埋め込み（旧アプリの #reservationEmbed の移植）
// 大阪大学医学部の講義棟予約状況を毎晩スクレイピングした静的HTML（/htmls/YYYY-MM-DD.html）を
// 日付選択で iframe に表示する。
import { useEffect, useRef, useState } from 'react'

const DAY_MS = 24 * 60 * 60 * 1000

function formatDate(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function LectureHallEmbed() {
  const today = new Date()
  const minDate = formatDate(today)
  const maxDate = formatDate(new Date(today.getTime() + 60 * DAY_MS))

  const [date, setDate] = useState(minDate)
  const iframeRef = useRef(null)

  const loadIframeContent = async (targetDate) => {
    const iframe = iframeRef.current
    if (!iframe || !targetDate) return
    const url = `/htmls/${targetDate}.html`
    try {
      const response = await fetch(url)
      if (response.ok) {
        iframe.removeAttribute('srcdoc')
        iframe.src = url
      } else {
        iframe.removeAttribute('src')
        iframe.srcdoc = `<p style="padding: 1em; text-align: center; color: #555;">${targetDate} の予約情報は見つかりませんでした。</p>`
      }
    } catch (err) {
      console.error('iframeの読み込みエラー:', err)
      iframe.removeAttribute('src')
      iframe.srcdoc = `<p style="padding: 1em; text-align: center; color: #d32f2f;">予約情報の読み込み中にエラーが発生しました。</p>`
    }
  }

  useEffect(() => {
    loadIframeContent(date)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section className="lecture-hall-embed">
      <h2>講義棟予約カレンダー</h2>
      <div className="lecture-hall-controls">
        <label htmlFor="resvDate">日付選択:</label>
        <input
          id="resvDate"
          type="date"
          min={minDate}
          max={maxDate}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <button onClick={() => loadIframeContent(date)}>表示</button>
      </div>
      <div className="lecture-hall-frame">
        <iframe ref={iframeRef} title="講義棟予約状況" scrolling="auto" frameBorder="0" />
      </div>
    </section>
  )
}
