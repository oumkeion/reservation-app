// 予約カレンダー画面（旧アプリの中核機能の移植）
// 15分単位ドラッグ選択 → 予約ダイアログ / クリック → 詳細・削除
// 予約はログイン不要。Googleログインは管理者操作（固定枠・音出し禁止の予約、確認なし削除）にのみ使う。
import { useState, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { useEvents } from './useEvents'
import { validateReservation } from './validation'
import { ReserveDialog } from './ReserveDialog'
import { ValidationFailure } from './errors'
import { EventDetailDialog } from './EventDetailDialog'
import { addEvent, deleteEvent } from '../../models/events'
import { EVENT_TYPES } from '../../lib/eventTypes'

export function CalendarView({ profile, isAdmin }) {
  const { events, calendarEvents, error } = useEvents()
  const [selectedRange, setSelectedRange] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)

  // ドラッグ選択 → 予約ダイアログを開く（ログイン不要）
  const handleSelect = useCallback((info) => {
    setSelectedRange({ start: info.start, end: info.end })
  }, [])

  // 予約イベントクリック → 詳細ダイアログ（音出し禁止の背景は対象外）
  const handleEventClick = useCallback(
    (info) => {
      const original = events.find((e) => e.id === info.event.id)
      if (original && original.extendedProps?.type !== EVENT_TYPES.NO_SOUND) {
        setSelectedEvent(original)
      }
    },
    [events],
  )

  const handleSave = async ({ title, editor, type, comment }) => {
    const validationError = validateReservation({
      type,
      editor,
      start: selectedRange.start,
      now: new Date(),
      isAdmin,
      allEvents: events,
    })
    if (validationError) {
      alert(validationError)
      throw new ValidationFailure(validationError)
    }
    await addEvent({
      title,
      start: selectedRange.start.toISOString(),
      end: selectedRange.end.toISOString(),
      type,
      comment,
      editor,
    })
  }

  const handleDelete = (event, deleterName) => deleteEvent(event, deleterName)

  return (
    <div className="calendar-view">
      {error && (
        <p className="error-bar">予約データの読み込みに失敗しました。再読み込みしてください。</p>
      )}
      <FullCalendar
        plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        locale="ja"
        height="auto"
        allDaySlot={false}
        slotDuration="00:15:00"
        slotLabelInterval="01:00"
        selectable
        selectMirror
        events={calendarEvents}
        select={handleSelect}
        eventClick={handleEventClick}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'timeGridWeek,timeGridDay,dayGridMonth',
        }}
        buttonText={{ today: '今日', week: '週', day: '日', month: '月' }}
      />
      {selectedRange && (
        <ReserveDialog
          range={selectedRange}
          isAdmin={isAdmin}
          onSave={handleSave}
          onClose={() => setSelectedRange(null)}
        />
      )}
      {selectedEvent && (
        <EventDetailDialog
          event={selectedEvent}
          isAdmin={isAdmin}
          adminName={profile?.displayName || profile?.email}
          onDelete={handleDelete}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  )
}
