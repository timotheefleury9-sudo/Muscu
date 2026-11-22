import { useMemo } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { weeklySummary } from '../../domain/metrics'
import { GROUP_LABEL, isGroup, previousWeek, weekFromParam, weekLabel } from './labels'
import { BackButton, ExerciseRow, ProgressScreen } from './parts'
import { useAppData } from './useAppData'

export default function MuscleDetailPage() {
  const { group } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const data = useAppData()
  const week = weekFromParam(params.get('semaine'))
  const summaries = useMemo(
    () => (data ? { cur: weeklySummary(data, week), prev: weeklySummary(data, previousWeek(week)) } : null),
    [data, week],
  )
  if (!isGroup(group)) return <Navigate to="/progression" replace />

  const label = GROUP_LABEL[group]
  const rows = summaries ? summaries.cur.exercises.filter((e) => e.group === group) : []
  const n = summaries?.cur.setsByGroup[group] ?? 0
  const prev = summaries && summaries.prev.sessionsDone > 0 ? summaries.prev.setsByGroup[group] : null
  const diff = prev === null ? 0 : n - prev
  const exercises = new Map((data?.exercises ?? []).map((e) => [e.id, e]))

  return (
    <ProgressScreen detail busy={!summaries}>
      <BackButton fallbackTo={`/progression?semaine=${week}`} fallbackLabel={weekLabel(week)} />
      <h1 className="p-title">{label}</h1>
      {summaries && (
        <>
          <div className="p-hero">
            <div className="p-hero-val num">
              {n}
              <small>{n > 1 ? 'séries validées' : 'série validée'}</small>
            </div>
            {prev !== null && (
              <div className="p-hero-sub">
                {diff === 0 ? 'Autant que la semaine précédente' : (
                  <>
                    {diff > 0 ? <span className="up">+{diff}</span> : `−${-diff}`} par rapport à la semaine précédente
                  </>
                )}
              </div>
            )}
          </div>
          <section className="p-card" aria-labelledby="p-muscle-ex">
            <h2 className="p-card-title" id="p-muscle-ex">Exercices de la semaine</h2>
            {rows.length === 0 && <p className="p-bars-empty">Aucune série pour ce muscle cette semaine.</p>}
            {rows.map((ew) => {
              const ex = exercises.get(ew.exerciseId)
              return (
                <ExerciseRow
                  key={ew.exerciseId}
                  ew={ew}
                  name={ex?.name ?? ew.exerciseId}
                  bodyweight={ex?.bodyweight ?? false}
                  detailed
                  onOpen={() =>
                    navigate(`/progression/exercice/${encodeURIComponent(ew.exerciseId)}?semaine=${week}`, { state: { back: label } })
                  }
                />
              )
            })}
          </section>
        </>
      )}
    </ProgressScreen>
  )
}
