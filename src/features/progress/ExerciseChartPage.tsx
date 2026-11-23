import { Fragment, useMemo, useState } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts'
import { exerciseHighlights, exerciseSeries, type ExerciseHighlights, type ExerciseSeries, type SeriesMetric } from '../../domain/metrics'
import { recentSessionLogs, type SessionLog } from '../../domain/exerciseLog'
import type { Exercise } from '../../domain/types'
import { formatWeight } from '../../domain/parseWeight'
import { GROUP_LABEL, dayDate, formatLogSet, formatSet, shortDate, weekFromParam, weekLabel } from './labels'
import { BackButton, ProgressScreen } from './parts'
import { useAppData } from './useAppData'

const WEEKS = 12
const LOG_SESSIONS = 6
const METRIC_LABEL: Record<SeriesMetric, string> = { load: 'Charge max', e1rm: '1RM estimé' }
const X_TICKS = [0, 3, 6, 9, 11]
const fmt = (n: number): string => formatWeight(Math.round(n * 10) / 10)

type Point = ExerciseSeries['points'][number]

/** Axe vertical : bornes arrondies au pas, avec une marge d'un demi-pas. */
function yScale(values: number[], reps: boolean): { domain: [number, number]; ticks: number[] } {
  const min = Math.min(...values), max = Math.max(...values)
  const step = reps ? 2 : max < 30 ? 2.5 : 5
  const lo = Math.max(0, Math.floor((min - step / 2) / step) * step)
  const hi = Math.ceil((max + step / 2) / step) * step
  return { domain: [lo, hi], ticks: [lo, (lo + hi) / 2, hi] }
}

function Chart({ series, reps, label, sel, onSelect }: {
  series: Point[]; reps: boolean; label: string; sel: number; onSelect: (i: number) => void
}) {
  const values = series.flatMap((p) => (p.value === null ? [] : [p.value]))
  const { domain, ticks } = yScale(values, reps)
  return (
    <div className="p-chart">
      <LineChart
        responsive
        style={{ width: '100%', height: '100%' }}
        data={series}
        margin={{ top: 12, right: 0, bottom: 0, left: 0 }}
        onClick={(state) => {
          const i = Number(state?.activeTooltipIndex)
          if (Number.isInteger(i) && series[i]?.value != null) onSelect(i)
        }}
        accessibilityLayer={false}
      >
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="weekStart"
          ticks={X_TICKS.map((i) => series[i].weekStart)}
          interval={0}
          tickFormatter={shortDate}
          axisLine={false}
          tickLine={false}
          padding={{ left: 10, right: 10 }}
          tick={{ fill: 'var(--faint)', fontSize: 11 }}
        />
        <YAxis
          orientation="right"
          domain={domain}
          ticks={ticks}
          tickFormatter={(v: number) => formatWeight(Math.round(v * 2) / 2)}
          axisLine={false}
          tickLine={false}
          width={36}
          tick={{ fill: 'var(--faint)', fontSize: 11 }}
        />
        <Tooltip content={() => null} cursor={false} isAnimationActive={false} />
        <ReferenceLine x={series[sel].weekStart} stroke="var(--faint)" strokeDasharray="2 3" />
        <Line
          type="linear"
          dataKey="value"
          stroke="var(--text)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          connectNulls={false}
          animationDuration={280}
          animationEasing="ease-out"
          activeDot={false}
          dot={(p: { cx?: number; cy?: number; index?: number; value?: number | null }) => (
            <circle
              key={p.index}
              cx={p.cx}
              cy={p.cy}
              r={p.value == null ? 0 : p.index === sel ? 6 : 4}
              fill={p.index === sel ? 'var(--text)' : 'var(--surface)'}
              stroke="var(--text)"
              strokeWidth={2}
            />
          )}
        />
      </LineChart>
      <table className="sr-only">
        <tbody>
          <tr><th>Semaine</th><th>{label}</th></tr>
          {series.map((p) => (
            <tr key={p.weekStart}><td>{weekLabel(p.weekStart)}</td><td>{p.value === null ? 'pas de séance' : fmt(p.value)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function ExerciseChartPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const data = useAppData()
  const week = weekFromParam(params.get('semaine'))
  const [metric, setMetric] = useState<SeriesMetric>('load')

  const view = useMemo(() => {
    if (!data) return null
    const ex = data.exercises.find((e) => e.id === id)
    if (!ex) return { ex: undefined } as const
    return {
      ex,
      series: { load: exerciseSeries(data, id, WEEKS, week, 'load'), e1rm: exerciseSeries(data, id, WEEKS, week, 'e1rm') },
      highlights: exerciseHighlights(data, id, week),
      logs: recentSessionLogs(data, id, LOG_SESSIONS),
    }
  }, [data, id, week])

  if (view && !view.ex) return <Navigate to="/progression" replace />
  const ex = view?.ex

  return (
    <ProgressScreen detail busy={!view}>
      {ex && (
        <BackButton fallbackTo={`/progression/muscle/${ex.primaryGroup}?semaine=${week}`} fallbackLabel={GROUP_LABEL[ex.primaryGroup]} />
      )}
      {ex && view && (
        <Content
          key={`${id}-${week}`}
          ex={ex}
          series={view.series[metric]}
          metric={metric}
          onMetric={setMetric}
          highlights={view.highlights}
          logs={view.logs}
        />
      )}
    </ProgressScreen>
  )
}

function Content({ ex, series: { points: series, unit }, metric, onMetric, highlights, logs }: {
  ex: Exercise
  series: ExerciseSeries
  metric: SeriesMetric
  onMetric: (m: SeriesMetric) => void
  highlights: ExerciseHighlights | null
  logs: SessionLog[]
}) {
  const [picked, setPicked] = useState<number | null>(null)
  const reps = unit === 'reps'
  const label = reps ? 'Répétitions' : `${METRIC_LABEL[metric]} (kg)`
  const present = series.map((p, i) => (p.value === null ? -1 : i)).filter((i) => i >= 0)
  const last = present[present.length - 1]
  const sel = picked !== null && series[picked]?.value != null ? picked : last
  const value = sel === undefined ? null : series[sel].value
  const diff = present.length > 1 ? series[last].value! - series[present[0]].value! : null
  const since = present.length > 0 ? `depuis le ${shortDate(series[present[0]].weekStart)}` : ''
  const gaps = present.length > 0 && present.length < series.length

  return (
    <>
      <h1 className="p-title">{ex.name}</h1>
      {value !== null && (
        <div className="p-hero">
          <div className="p-hero-val num">
            {fmt(value)}
            <small>{unit}</small>
          </div>
          <div className="p-hero-sub">
            {sel !== last ? weekLabel(series[sel].weekStart)
              : diff === null ? weekLabel(series[sel].weekStart)
              : diff > 0 ? <><span className="up">+{fmt(diff)} {unit}</span> {since}</>
              : diff < 0 ? `−${fmt(-diff)} ${unit} ${since}`
              : `Stable ${since}`}
          </div>
        </div>
      )}
      {!reps && (
        <div className="p-seg" role="group" aria-label="Mesure">
          {(['load', 'e1rm'] as const).map((m) => (
            <button key={m} type="button" aria-pressed={metric === m} onClick={() => onMetric(m)}>
              {METRIC_LABEL[m]}
            </button>
          ))}
        </div>
      )}
      <section className="p-card">
        <p className="p-chart-label">{label}</p>
        {sel === undefined ? (
          <p className="p-bars-empty">Aucune séance sur les {WEEKS} dernières semaines.</p>
        ) : (
          <>
            <Chart series={series} reps={reps} label={label} sel={sel} onSelect={setPicked} />
            <p className="p-chart-note">
              {gaps && 'Les semaines sans séance laissent un trou. '}Touchez un point pour voir sa semaine.
            </p>
          </>
        )}
      </section>
      {logs.length > 0 && (
        <section className="p-card" aria-labelledby="p-log-title">
          <h2 className="p-card-title" id="p-log-title">Dernières séances</h2>
          <ul className="p-log">
            {logs.map((log) => (
              <li key={log.sessionId} className="p-log-row">
                <span className="p-log-date">{dayDate(log.startedAt)}</span>
                <span className="p-log-sets num">
                  {log.sets.map((set, i) => (
                    <Fragment key={i}>
                      {i > 0 && ' · '}
                      <span className={i === log.topIndex ? 'p-log-top' : undefined}>{formatLogSet(set, ex.bodyweight)}</span>
                    </Fragment>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {highlights && (
        <section className="p-card" aria-label="Repères">
          <div className="p-fact">
            <span className="p-fact-lab">Record</span>
            <span className="p-fact-val">{formatSet(highlights.record, ex.bodyweight)}</span>
          </div>
          <div className="p-fact">
            <span className="p-fact-lab">
              Dernière meilleure série
              <small>{weekLabel(highlights.last.weekStart)}</small>
            </span>
            <span className="p-fact-val">{formatSet(highlights.last.best, ex.bodyweight)}</span>
          </div>
        </section>
      )}
    </>
  )
}
