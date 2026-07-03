// 予約カレンダー画面（旧アプリの中核機能の移植）
// 15分単位ドラッグ選択 → 予約ダイアログ / クリック → 詳細・削除
// 予約はログイン不要。Googleログインは管理者操作（固定枠・音出し禁止の予約、確認なし削除）にのみ使う。
// 講義棟の予約状況（夜間スクレイピング）も同じカレンダーに重ねて表示する（表示専用・切替可）。
import { useState, useCallback, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { useEvents } from './useEvents'
import { validateReservation } from './validation'
import { ReserveDialog } from './ReserveDialog'
import { ValidationFailure } from './errors'
import { EventDetailDialog } from './EventDetailDialog'
import {
  addEvent,
  deleteEvent,
  updateEvent,
  addRecurringFixedSlots,
  deleteRecurrenceGroup,
  cleanupOldEvents,
  promoteEligibleRequests,
  SlotConflictError,
} from '../../models/events'
import { EVENT_TYPES } from '../../lib/eventTypes'
import { FixedSlotBulkDialog } from './FixedSlotBulkDialog'
import { useActiveBands } from '../bands/useActiveBands'
import { useLectureHall } from '../lecture-hall/useLectureHall'
import { LectureHallBoard } from '../lecture-hall/LectureHallBoard'
import { LectureHallDetailDialog } from '../lecture-hall/LectureHallDetailDialog'

export function CalendarView({ profile, isAdmin }) {
  const { events, calendarEvents, error } = useEvents()
  const bands = useActiveBands()

  // 起動時に一度だけ、60日より前の古い予約を掃除し、
  // 申請期間が過ぎて競合の無い希望枠を確定枠へ格上げする（どちらも best-effort）
  useEffect(() => {
    cleanupOldEvents()
    promoteEligibleRequests()
  }, [])
  const {
    data: lhData,
    rooms: lhRooms,
    noSoundEvents,
    updatedAt: lhUpdatedAt,
    isStale: lhStale,
    error: lhError,
  } = useLectureHall()
  const [selectedRange, setSelectedRange] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [selectedLhEvent, setSelectedLhEvent] = useState(null)
  const [showBulkFixed, setShowBulkFixed] = useState(false)

  // ドラッグ選択 → 予約ダイアログを開く（ログイン不要）
  const handleSelect = useCallback((info) => {
    setSelectedRange({ start: info.start, end: info.end })
  }, [])

  // 予約イベントクリック → 詳細ダイアログ
  // 音出し禁止（手動作成分）→ 管理者のみ詳細を開ける（削除可能）
  const handleEventClick = useCallback(
    (info) => {
      const original = events.find((e) => e.id === info.event.id)
      if (!original) return
      if (original.extendedProps?.type === EVENT_TYPES.NO_SOUND && !isAdmin) return
      setSelectedEvent(original)
    },
    [events, isAdmin],
  )

  const handleSave = async ({ title, editor, type, comment }) => {
    const validationError = validateReservation({
      type,
      editor,
      start: selectedRange.start,
      end: selectedRange.end,
      now: new Date(),
      isAdmin,
      allEvents: events,
    })
    if (validationError) {
      alert(validationError)
      throw new ValidationFailure(validationError)
    }
    try {
      await addEvent({
        title,
        start: selectedRange.start.toISOString(),
        end: selectedRange.end.toISOString(),
        type,
        comment,
        editor,
      })
    } catch (err) {
      if (err instanceof SlotConflictError) {
        // 事前チェックをすり抜けた同時予約の競合（原子的バックストップ）
        alert(err.message)
        throw new ValidationFailure(err.message)
      }
      throw err
    }
  }

  const handleDelete = (event, deleterName) => deleteEvent(event, deleterName)

  const handleUpdate = (event, changes, editorName) =>
    updateEvent(event, changes, editorName)

  // 音出し禁止（手動作成分）は通常は背景表示（クリック不可）だが、管理者には通常イベント
  // として表示してクリック→削除できるようにする（FullCalendarの背景イベントはクリック不可のため）
  const clubEvents = isAdmin
    ? calendarEvents.map((e) =>
        e.extendedProps?.type === EVENT_TYPES.NO_SOUND ? { ...e, display: 'auto' } : e,
      )
    : calendarEvents
  // 講義棟由来の音出し禁止帯（灰）を背景として重ねる（自動・常に最新）
  const mergedEvents = [...clubEvents, ...noSoundEvents]

  return (
    <div className="calendar-view">
      {error && (
        <p className="error-bar">予約データの読み込みに失敗しました。再読み込みしてください。</p>
      )}
      {lhStale && (
        <p className="error-bar">
          ⚠️ 講義棟の予約データが36時間以上更新されていません（音出し禁止帯が古い可能性があります）。
          GitHub Actions の「Nightly Scrape」を確認してください。
        </p>
      )}
      {lhError && (
        <p className="error-bar">
          講義棟データの読み込みに失敗したため、音出し禁止帯が表示されていません。
        </p>
      )}
      {isAdmin && (
        <div className="admin-toolbar">
          <button onClick={() => setShowBulkFixed(true)}>固定枠を一括登録</button>
        </div>
      )}
      <FullCalendar
        plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
        initialView="timeGridRolling"
        views={{
          // 今日を左端にした7日間のローリング表示（日曜始まりの固定週ではない）
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
        longPressDelay={250}
        selectLongPressDelay={250}
        events={mergedEvents}
        select={handleSelect}
        eventClick={handleEventClick}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'timeGridRolling,timeGridDay,dayGridMonth',
        }}
        buttonText={{ today: '今日', day: '日', month: '月' }}
      />
      <section className="lecture-hall-section">
        <h2>講義棟予約カレンダー</h2>
        <p className="lh-updated">
          {lhError
            ? '読み込みに失敗しました'
            : `データ更新: ${lhUpdatedAt ? lhUpdatedAt.toLocaleString('ja-JP') : '読み込み中…'}（毎晩自動取得）`}
        </p>
        <LectureHallBoard data={lhData} rooms={lhRooms} onSelectSlot={setSelectedLhEvent} />
      </section>
      {selectedRange && (
        <ReserveDialog
          range={selectedRange}
          isAdmin={isAdmin}
          bands={bands}
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
          onUpdate={handleUpdate}
          onDeleteGroup={(group) =>
            deleteRecurrenceGroup(group, profile?.displayName || profile?.email || '管理者')
          }
          onClose={() => setSelectedEvent(null)}
        />
      )}
      {selectedLhEvent && (
        <LectureHallDetailDialog
          event={selectedLhEvent}
          onClose={() => setSelectedLhEvent(null)}
        />
      )}
      {showBulkFixed && (
        <FixedSlotBulkDialog
          adminName={profile?.displayName || profile?.email}
          bands={bands}
          onSave={addRecurringFixedSlots}
          onClose={() => setShowBulkFixed(false)}
        />
      )}
    </div>
  )
}
