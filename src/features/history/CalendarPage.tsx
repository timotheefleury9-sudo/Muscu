import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { addMonths, localDay, monthGrid } from '../../domain/dates'
import { sessionsByDay, type SessionSummary } from '../../domain/sessionLog'
import { EASE, T, T_FAST } from '../session/motion'
import { shortDate } from '../progress/labels'
import { BackButton, IconLeft, IconRight, ProgressScreen, type BackState } from '../progress/parts'
import { useAppData } from '../progress/useAppData'
import { DumbbellIcon } from '../shell/icons'
import { currentMonth, longDay, monthFromParam, monthLabel, timeLabel } from './labels'
import './history.css'

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

const WeekIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 19V5M4 19h16M8 15l4-4 3 3 5-6" />
  </svg>
)

export default function CalendarPage() {
  const data = useAppData()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const month = monthFromParam(params.get('mois'))
  const now = currentMonth()
  const today = localDay(new Date().toISOString())
  const [dir, setDir] = useState(0)
  const [choice, setChoice] = useState<{ day: string; sessions: SessionSummary[] } | null>(null)

  const days = useMemo(() => (data ? sessionsByDay(data, month) : null), [data, month])
  const grid = useMemo(() => monthGrid(month), [month])
  const back: BackState = { back: 'Calendrier' }

  const goMonth = (m: string, d: number) => {
    setDir(d)
    setParams({ mois: m }, { replace: true })
  }
  const openSession = (id: string) => navigate(`/seances/${encodeURIComponent(id)}`, { state: back })
  const openDay = (day: string) => {
    // sessionsByDay : plus récente d'abord ; la feuille les liste dans l'ordre de la journée.
    const list = [...(days?.[day] ?? [])].reverse()
    if (list.length === 1) openSession(list[0].id)
    else if (list.length > 1) setChoice({ day, sessions: list })
    else if (day <= today) setChoice({ day, sessions: [] })
  }
  const addAt = (day: string) => navigate(`/seances/nouvelle?date=${day}`, { state: back })

  return (
    <ProgressScreen detail busy={!days}>
      <BackButton fallbackTo="/progression" fallbackLabel="Progression" />
      <h1 className="p-title">Calendrier</h1>
      <div className="p-week-nav">
        <button type="button" aria-label="Mois précédent" onClick={() => goMonth(addMonths(month, -1), -1)}>
          <IconLeft />
        </button>
        <h2 className="h-month">{monthLabel(month)}</h2>
        {month < now ? (
          <button type="button" aria-label="Mois suivant" onClick={() => goMonth(addMonths(month, 1), 1)}>
            <IconRight />
          </button>
        ) : (
          <span className="p-week-gap" aria-hidden="true" />
        )}
      </div>

      <div className="p-card h-cal">
        <div className="h-row h-head" aria-hidden="true">
          <span />
          {WEEKDAYS.map((d, i) => <span key={i}>{d}</span>)}
        </div>
        <motion.div
          key={month}
          initial={dir ? { opacity: 0, x: dir < 0 ? -12 : 12 } : false}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: T_FAST, ease: EASE }}
        >
          {grid.map((week) => (
            <div key={week[0]} className="h-row">
              <button
                type="button"
                className="h-week"
                aria-label={`Bilan de la semaine du ${shortDate(week[0])}`}
                onClick={() => navigate(`/progression?semaine=${week[0]}`)}
              >
                <WeekIcon />
              </button>
              {week.map((day) => {
                const list = days?.[day] ?? []
                const outside = !day.startsWith(`${month}-`)
                const cls = ['h-day', outside && 'is-out', day > today && 'is-future', day === today && 'is-today'].filter(Boolean).join(' ')
                // La cellule entière est la zone tactile ; l'encadré visuel (jour courant, appui) est intérieur.
                const content = (
                  <span className="h-day-in">
                    <span className="h-num num">{Number(day.slice(8))}</span>
                    {list.length > 0 && <span className="h-pill"><DumbbellIcon /></span>}
                  </span>
                )
                const current = day === today ? ('date' as const) : undefined
                return list.length > 0 || day <= today ? (
                  <button
                    key={day}
                    type="button"
                    className={cls}
                    data-day={day}
                    aria-current={current}
                    aria-label={list.length > 0 ? `${longDay(day)}, ${list.length} ${list.length > 1 ? 'séances' : 'séance'}` : `${longDay(day)}, aucune séance`}
                    onClick={() => openDay(day)}
                  >
                    {content}
                  </button>
                ) : (
                  <span key={day} className={cls} data-day={day} aria-current={current}>
                    {content}
                  </span>
                )
              })}
            </div>
          ))}
        </motion.div>
      </div>

      <div className="h-actions">
        <button type="button" className="h-action" onClick={() => navigate('/progression/seances', { state: back })}>
          Toutes mes séances
        </button>
        <button type="button" className="h-action" onClick={() => navigate('/seances/nouvelle', { state: back })}>
          Ajouter une séance
        </button>
      </div>

      <DaySheet choice={choice} onPick={openSession} onAdd={addAt} onClose={() => setChoice(null)} />
    </ProgressScreen>
  )
}

/** Feuille (même présentation que ConfirmSheet) : une ligne « 18:05 · Push » par séance du jour. */
function DaySheet({ choice, onPick, onAdd, onClose }: {
  choice: { day: string; sessions: SessionSummary[] } | null; onPick: (id: string) => void; onAdd: (day: string) => void; onClose: () => void
}) {
  const cancel = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (choice) cancel.current?.focus()
  }, [choice])
  return (
    <AnimatePresence>
      {choice && (
        <Fragment key="day">
          <motion.div
            className="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: T, ease: EASE }}
            onClick={onClose}
          />
          <motion.div
            className="sheet h-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="day-title"
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            exit={{ y: '110%' }}
            transition={{ duration: T, ease: EASE }}
            onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
          >
            <h2 id="day-title">{longDay(choice.day)}</h2>
            <div className="h-sheet-list">
              {choice.sessions.length === 0 && (
                <button type="button" className="h-sheet-row" onClick={() => { onClose(); onAdd(choice.day) }}>
                  Ajouter une séance ce jour-là
                </button>
              )}
              {choice.sessions.map((s) => (
                <button key={s.id} type="button" className="h-sheet-row" onClick={() => { onClose(); onPick(s.id) }}>
                  {`${timeLabel(s.startedAt)} · ${s.templateName}`}
                </button>
              ))}
            </div>
            <button ref={cancel} type="button" className="secondary-btn" onClick={onClose}>Annuler</button>
          </motion.div>
        </Fragment>
      )}
    </AnimatePresence>
  )
}
