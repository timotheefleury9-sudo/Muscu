import { Suspense, lazy } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import SessionPage from './features/session/SessionPage'
import ProgramsPage from './features/programs/ProgramsPage'
import TemplateEditor from './features/programs/TemplateEditor'
import WeekSummaryPage from './features/progress/WeekSummaryPage'
import MuscleDetailPage from './features/progress/MuscleDetailPage'
import SettingsPage from './features/settings/SettingsPage'
import InstallBanner from './features/shell/InstallBanner'
import ErrorBoundary from './features/shell/ErrorBoundary'

// Recharts n'est chargé qu'à l'ouverture d'une courbe (bloc séparé, précaché par le service worker).
const ExerciseChartPage = lazy(() => import('./features/progress/ExerciseChartPage'))

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

function ChartSkeleton() {
  return (
    <section className="page" aria-busy="true" aria-label="Chargement">
      <div className="skeleton-line" />
      <div className="skeleton-block" />
      <div className="skeleton-block is-short" />
    </section>
  )
}

export default function App() {
  const { pathname } = useLocation()
  return (
    <div className="app">
      <div className="topbar" aria-hidden="true" />
      <InstallBanner />
      <main className="app-main">
        {/* Clé = chemin : changer d'onglet sort de l'écran d'erreur. */}
        <ErrorBoundary key={pathname}>
          <Routes>
            <Route path="/" element={<SessionPage />} />
            <Route path="/programmes" element={<ProgramsPage />} />
            <Route path="/programmes/:id" element={<TemplateEditor />} />
            <Route path="/progression" element={<WeekSummaryPage />} />
            <Route path="/progression/muscle/:group" element={<MuscleDetailPage />} />
            <Route path="/progression/exercice/:id" element={
                <Suspense fallback={<ChartSkeleton />}>
                  <ExerciseChartPage />
                </Suspense>
              } />
            <Route path="/reglages" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
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
