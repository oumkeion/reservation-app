// 狙い表明カレンダー: 「この時間を狙っている」という宣言を15分単位で可視化する
// 予約カレンダーとは別の独立したカレンダー（同じ枠を複数バンドが宣言できる）。
import { useState, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { useIntents } from './useIntents'
import { IntentDialog } from './IntentDialog'
import { IntentDetailDialog } from './IntentDetailDialog'
import { addIntent, deleteIntent } from '../../models/intents'
import { useLectureHall } from '../lecture-hall/useLectureHall'

export function IntentBoard() {
  const { intents, calendarIntents, error } = useIntents()
  const { noSoundEvents } = useLectureHall()
  const [selectedRange, setSelectedRange] = useState(null)
  const [selectedIntent, setSelectedIntent] = useState(null)

  const handleSelect = useCallback((info) => {
    setSelectedRange({ start: info.start, end: info.end })
  }, [])

  const handleEventClick = useCallback(
    (info) => {
      const original = intents.find((i) => i.id === info.event.id)
      if (original) setSelectedIntent(original)
    },
    [intents],
  )

  const handleSave = async ({ title, editor, comment }) => {
    await addIntent({
      title,
      start: selectedRange.start.toISOString(),
      end: selectedRange.end.toISOString(),
      editor,
      comment,
    })
  }

  const handleDelete = (intent) => deleteIntent(intent.id)

  return (
    <div className="intent-board">
      <h2>狙い表明カレンダー</h2>
      <p className="intent-hint">
        まだ予約していないけれど「この時間を使いたい」という意思表示です。複数のバンドが同じ枠を宣言できます。
      </p>
      {error && (
        <p className="error-bar">狙い表明データの読み込みに失敗しました。再読み込みしてください。</p>
      )}
      <FullCalendar
        plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
        initialView="timeGridRolling"
        views={{
          // 今日を左端にした7日間のローリング表示（メインカレンダーと同じ）
          timeGridRolling: {
            type: 'timeGrid',
            duration: { days: 7 },
            buttonText: '週',
          },
        }}
        locale="ja"
        height="auto"
        allDaySlot={false}
        slotMinTime="06:00:00"
        slotMaxTime="22:00:00"
        slotDuration="00:15:00"
        slotLabelInterval="01:00"
        selectable
        selectMirror
        slotEventOverlap={false}
        events={[...calendarIntents, ...noSoundEvents]}
        select={handleSelect}
        eventClick={handleEventClick}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'timeGridRolling,timeGridDay,dayGridMonth',
        }}
        buttonText={{ today: '今日', day: '日', month: '月' }}
      />
      {selectedRange && (
        <IntentDialog
          range={selectedRange}
          onSave={handleSave}
          onClose={() => setSelectedRange(null)}
        />
      )}
      {selectedIntent && (
        <IntentDetailDialog
          intent={selectedIntent}
          onDelete={handleDelete}
          onClose={() => setSelectedIntent(null)}
        />
      )}
    </div>
  )
}
