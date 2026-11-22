import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { weeklySummary } from '../../domain/metrics'
import { EASE, T_CHART, T_FAST } from '../session/motion'
import { GROUPS, GROUP_LABEL, currentWeek, nextWeek, previousWeek, weekFromParam, weekLabel } from './labels'
import { Chevron, ExerciseRow, IconLeft, IconRight, ProgressScreen, type BackState } from './parts'
import { useAppData } from './useAppData'

const BAR_MIN_SCALE = 12

export default function WeekSummaryPage() {
  const data = useAppData()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const week = weekFromParam(params.get('semaine'))
  const now = currentWeek()
  // Sens du dernier changement de semaine : -1 précédente, +1 suivante, 0 aucun.
  const [dir, setDir] = useState(0)

  const summary = useMemo(() => (data ? weeklySummary(data, week) : null), [data, week])
  const exercises = useMemo(() => new Map((data?.exercises ?? []).map((e) => [e.id, e])), [data])

  const goWeek = (w: string, d: number) => {
    setDir(d)
    setParams({ semaine: w }, { replace: true })
  }
  const back: BackState = { back: weekLabel(week) }
  const openExercise = (id: string) =>
    navigate(`/progression/exercice/${encodeURIComponent(id)}?semaine=${week}`, { state: back })

  const sub = week === now ? 'Cette semaine' : week === previousWeek(now) ? 'Semaine dernière' : null
  const groups = summary ? GROUPS.filter((g) => summary.setsByGroup[g] > 0).sort((a, b) => summary.setsByGroup[b] - summary.setsByGroup[a]) : []
  const idle = summary ? GROUPS.filter((g) => summary.setsByGroup[g] === 0) : []
  const scale = summary ? Math.max(BAR_MIN_SCALE, ...groups.map((g) => summary.setsByGroup[g])) : BAR_MIN_SCALE
  const records = summary ? summary.exercises.filter((e) => e.isRecord) : []

  return (
    <ProgressScreen detail={false} busy={!summary}>
      <h1 className="p-title">Progression</h1>
      <div className="p-week-nav">
        <button type="button" aria-label="Semaine précédente" onClick={() => goWeek(previousWeek(week), -1)}>
          <IconLeft />
        </button>
        <div className="p-week-label">
          <strong>{weekLabel(week)}</strong>
          {sub && <span>{sub}</span>}
        </div>
        {week < now ? (
          <button type="button" aria-label="Semaine suivante" onClick={() => goWeek(nextWeek(week), 1)}>
            <IconRight />
          </button>
        ) : (
          <span className="p-week-gap" aria-hidden="true" />
        )}
      </div>

      {summary && (
        <motion.div
          key={week}
          initial={dir ? { opacity: 0, x: dir < 0 ? -12 : 12 } : false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: T_FAST, ease: EASE }}
        >
          {summary.sessionsDone === 0 ? (
            <div className="p-card p-empty">
              <strong>Aucune séance cette semaine</strong>
              <p>Lance ta prochaine séance depuis l'onglet Séance.</p>
            </div>
          ) : (
            <>
              <div className="p-kpis">
                <div className="p-card">
                  <span className="p-kpi-lab">Séances</span>
                  <span className="p-kpi-val num">
                    {summary.sessionsDone}
                    <small> / {summary.sessionsPlanned}</small>
                  </span>
                  <div className="p-pips" aria-hidden="true">
                    {Array.from({ length: summary.sessionsPlanned }, (_, i) => (
                      <span key={i} className={i < summary.sessionsDone ? 'on' : undefined} />
                    ))}
                  </div>
                </div>
                <div className="p-card">
                  <span className="p-kpi-lab">Records</span>
                  <span className="p-kpi-val num">{summary.recordsCount}</span>
                  <span className="p-kpi-sub">{records.map((r) => exercises.get(r.exerciseId)?.name ?? r.exerciseId).join(', ')}</span>
                </div>
              </div>

              <section className="p-card" aria-labelledby="p-bars-title">
                <h2 className="p-card-title" id="p-bars-title">Séries par muscle</h2>
                <div className="p-bars">
                  {groups.map((g) => {
                    const n = summary.setsByGroup[g]
                    return (
                      <button
                        key={g}
                        type="button"
                        className="p-bar-row"
                        aria-label={`${GROUP_LABEL[g]}, ${n} ${n > 1 ? 'séries' : 'série'}`}
                        onClick={() => navigate(`/progression/muscle/${g}?semaine=${week}`, { state: back })}
                      >
                        <span className="p-bar-name">{GROUP_LABEL[g]}</span>
                        <span className="p-bar-track">
                          <motion.span
                            className="p-bar-fill"
                            initial={{ width: 0 }}
                            animate={{ width: `${(n / scale) * 100}%` }}
                            transition={{ duration: T_CHART, ease: EASE }}
                          />
                        </span>
                        <span className="p-bar-count num">{n}</span>
                        <Chevron />
                      </button>
                    )
                  })}
                </div>
                {idle.length > 0 && <p className="p-bars-empty">Aucune série : {idle.map((g) => GROUP_LABEL[g]).join(', ')}</p>}
              </section>

              <section className="p-card" aria-labelledby="p-ex-title">
                <h2 className="p-card-title" id="p-ex-title">Exercices</h2>
                {summary.exercises.map((ew) => {
                  const ex = exercises.get(ew.exerciseId)
                  return (
                    <ExerciseRow
                      key={ew.exerciseId}
                      ew={ew}
                      name={ex?.name ?? ew.exerciseId}
                      bodyweight={ex?.bodyweight ?? false}
                      detailed={false}
                      onOpen={() => openExercise(ew.exerciseId)}
                    />
                  )
                })}
              </section>
            </>
          )}
        </motion.div>
      )}
    </ProgressScreen>
  )
}
