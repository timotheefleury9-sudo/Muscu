import { NavLink, Route, Routes } from 'react-router-dom'
import SessionPage from './features/session/SessionPage'
import ProgramsPage from './features/programs/ProgramsPage'
import WeekSummaryPage from './features/progress/WeekSummaryPage'
import SettingsPage from './features/settings/SettingsPage'

const TABS = [
  { to: '/', label: 'Séance', end: true, icon: <path d="M3 9v6M6.5 6v12M17.5 6v12M21 9v6M6.5 12h11" /> },
  { to: '/programmes', label: 'Programmes', end: false, icon: <path d="M5 6h14M5 12h14M5 18h9" /> },
  { to: '/progression', label: 'Progression', end: false, icon: <path d="M4 19V5M4 19h16M8 15l4-4 3 3 5-6" /> },
  {
    to: '/reglages',
    label: 'Réglages',
    end: false,
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
      </>
    ),
  },
]

export default function App() {
  return (
    <div className="app">
      <div className="topbar" aria-hidden="true" />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<SessionPage />} />
          <Route path="/programmes" element={<ProgramsPage />} />
          <Route path="/progression" element={<WeekSummaryPage />} />
          <Route path="/reglages" element={<SettingsPage />} />
          <Route path="*" element={<SessionPage />} />
        </Routes>
      </main>
      <nav className="tabbar" aria-label="Navigation principale">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end} className="tab">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {t.icon}
            </svg>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
