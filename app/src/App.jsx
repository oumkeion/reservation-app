// アプリ全体のシェル: 上部にログインバー、タブで機能を切り替える
import { useState } from 'react'
import { useAuth } from './features/auth/useAuth'
import { AuthBar } from './features/auth/AuthBar'
import { CalendarView } from './features/calendar/CalendarView'
import { BandBoard } from './features/bands/BandBoard'
import { IntentBoard } from './features/intents/IntentBoard'
import { JournalBoard } from './features/journal/JournalBoard'
import { LogView } from './features/logs/LogView'
import { FixedSlotRequestsAdmin } from './features/admin/FixedSlotRequestsAdmin'
import { TYPE_LABELS, TYPE_COLORS, EVENT_TYPES } from './lib/eventTypes'

const TABS = [
  { id: 'calendar', label: '予約カレンダー' },
  { id: 'bands', label: 'バンド一覧' },
  { id: 'journal', label: '部誌' },
  { id: 'logs', label: '操作ログ' },
]

// 管理者だけに表示するタブ
const ADMIN_TABS = [{ id: 'requests', label: '固定枠申請' }]

function Legend() {
  return (
    <div className="legend">
      {Object.values(EVENT_TYPES).map((t) => (
        <span key={t} className="legend-item">
          <span className="legend-color" style={{ background: TYPE_COLORS[t] }} />
          {TYPE_LABELS[t]}
        </span>
      ))}
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
        {[...TABS, ...(isAdmin ? ADMIN_TABS : [])].map((t) => (
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
        {tab === 'journal' && <JournalBoard isAdmin={isAdmin} />}
        {tab === 'logs' && <LogView />}
        {tab === 'requests' && isAdmin && (
          <FixedSlotRequestsAdmin adminName={profile?.displayName || profile?.email} />
        )}
      </main>
    </div>
  )
}
