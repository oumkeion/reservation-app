// アプリ全体のシェル: 上部にログインバー、タブで機能を切り替える
// Phase 0: カレンダーのみ。バンド掲示板・狙い表明・掲示板は Phase 1 以降で実装。
import { useState } from 'react'
import { useAuth } from './features/auth/useAuth'
import { AuthBar } from './features/auth/AuthBar'
import { CalendarView } from './features/calendar/CalendarView'
import { LECTURE_HALL_COLOR } from './features/lecture-hall/useLectureHall'
import { BandBoard } from './features/bands/BandBoard'
import { IntentBoard } from './features/intents/IntentBoard'
import { TYPE_LABELS, TYPE_COLORS, EVENT_TYPES } from './lib/eventTypes'

const TABS = [
  { id: 'calendar', label: '予約カレンダー' },
  { id: 'bands', label: 'バンド一覧' },
  { id: 'board', label: '掲示板' },
]

function Legend() {
  return (
    <div className="legend">
      {Object.values(EVENT_TYPES).map((t) => (
        <span key={t} className="legend-item">
          <span className="legend-color" style={{ background: TYPE_COLORS[t] }} />
          {TYPE_LABELS[t]}
        </span>
      ))}
      <span className="legend-item">
        <span className="legend-color" style={{ background: LECTURE_HALL_COLOR }} />
        講義棟の予約
      </span>
    </div>
  )
}

export default function App() {
  const { profile, loading, login, logout, isAdmin } = useAuth()
  const [tab, setTab] = useState('calendar')

  return (
    <div className="app">
      <header className="app-header">
        <h1>軽音部 部室予約システム</h1>
        <AuthBar
          profile={profile}
          isAdmin={isAdmin}
          loading={loading}
          login={login}
          logout={logout}
        />
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'tab active' : 'tab'}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'calendar' && (
          <>
            <Legend />
            <CalendarView profile={profile} isAdmin={isAdmin} />
          </>
        )}
        {tab === 'bands' && (
          <>
            <BandBoard />
            <IntentBoard />
          </>
        )}
        {tab === 'board' && (
          <p className="placeholder">掲示板は準備中です（Phase 2）。</p>
        )}
      </main>
    </div>
  )
}
