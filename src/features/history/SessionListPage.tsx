import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { sessionSummaries } from '../../domain/sessionLog'
import { BackButton, Chevron, ProgressScreen, type BackState } from '../progress/parts'
import { useAppData } from '../progress/useAppData'
import { byMonth, currentMonth, monthLabel, sessionLine } from './labels'
import './history.css'

export default function SessionListPage() {
  const data = useAppData()
  const navigate = useNavigate()
  const groups = useMemo(() => (data ? byMonth(sessionSummaries(data)) : null), [data])
  const back: BackState = { back: 'Toutes mes séances' }

  return (
    <ProgressScreen detail busy={!groups}>
      <BackButton fallbackTo={`/progression/calendrier?mois=${currentMonth()}`} fallbackLabel="Calendrier" />
      <h1 className="p-title">Toutes mes séances</h1>
      {groups?.length === 0 && (
        <div className="p-card p-empty">
          <strong>Aucune séance enregistrée</strong>
          <p>Lance ta première séance depuis l'onglet Séance.</p>
        </div>
      )}
      {groups?.map((g) => (
        <section key={g.month} className="p-card" aria-labelledby={`h-m-${g.month}`}>
          <h2 className="p-card-title" id={`h-m-${g.month}`}>{monthLabel(g.month)}</h2>
          {g.sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              className="p-ex-row h-session"
              onClick={() => navigate(`/seances/${encodeURIComponent(s.id)}`, { state: back })}
            >
              <span className="p-ex-main h-session-line">{sessionLine(s)}</span>
              {s.open && <span className="p-tag">En cours</span>}
              <Chevron />
            </button>
          ))}
        </section>
      ))}
    </ProgressScreen>
  )
}
