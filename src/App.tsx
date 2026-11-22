import { NavLink, Route, Routes } from 'react-router-dom'
import SessionPage from './features/session/SessionPage'
import ProgramsPage from './features/programs/ProgramsPage'
import WeekSummaryPage from './features/progress/WeekSummaryPage'
import SettingsPage from './features/settings/SettingsPage'

const TABS = [
  { to: '/', label: 'Séance', end: true },
  { to: '/programmes', label: 'Programmes', end: false },
  { to: '/progression', label: 'Progression', end: false },
  { to: '/reglages', label: 'Réglages', end: false },
]

export default function App() {
  return (
    <div className="app">
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
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
