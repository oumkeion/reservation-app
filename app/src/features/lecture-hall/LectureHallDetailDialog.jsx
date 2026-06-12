// 講義棟予約の詳細ダイアログ（表示専用）
// スクレイピングした詳細: どの部屋を・どの団体が・何時まで・音出し可否
export function LectureHallDetailDialog({ event, onClose }) {
  const p = event.extendedProps
  const date = new Date(event.start).toLocaleDateString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>講義棟の予約</h3>
        <p>部屋：{p.room}</p>
        <p>団体：{p.org}</p>
        {p.label && <p>内容：{p.label}</p>}
        <p>
          時間：{date} {p.startTime} 〜 {p.endTime}
        </p>
        <p>
          課外活動の音出し：
          {p.sound === '可' ? '可（この時間も音出しできます）' : '不可'}
        </p>
        <p className="dialog-editor">
          ※大学の予約システムから毎晩自動取得した情報です。このアプリからは変更できません。
        </p>
        <div className="dialog-buttons">
          <button onClick={onClose}>閉じる</button>
        </div>
      </div>
    </div>
  )
}
