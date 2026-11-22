import type { ReactNode } from 'react'
import { MotionConfig, motion } from 'framer-motion'
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import type { ExerciseWeek } from '../../domain/metrics'
import { EASE, T } from '../session/motion'
import { formatDelta } from './formatDelta'
import { formatSet } from './labels'
import './progress.css'

/** État de navigation : libellé de l'écran d'origine, pour le bouton retour. */
export interface BackState { back: string }

export const IconLeft = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
)
export const IconRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
)
export const Chevron = () => (
  <svg className="p-chev" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3l5 5-5 5" /></svg>
)

/** Écran de Progression ; un écran de détail entre par la droite, un retour par la gauche. */
export function ProgressScreen({ detail, busy, children }: { detail: boolean; busy?: boolean; children: ReactNode }) {
  const pop = useNavigationType() === 'POP'
  const first = useLocation().key === 'default'
  const slide = !first && (detail || pop)
  return (
    <MotionConfig reducedMotion="user">
      <motion.section
        className="page prog"
        aria-busy={busy || undefined}
        initial={slide ? { opacity: 0, x: pop ? -24 : 24 } : false}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: T, ease: EASE }}
      >
        {children}
      </motion.section>
    </MotionConfig>
  )
}

export function BackButton({ fallbackTo, fallbackLabel }: { fallbackTo: string; fallbackLabel: string }) {
  const navigate = useNavigate()
  const from = (useLocation().state as BackState | null)?.back
  return (
    <button type="button" className="p-back" onClick={() => (from ? navigate(-1) : navigate(fallbackTo))}>
      <IconLeft />
      {from ?? fallbackLabel}
    </button>
  )
}

export function DeltaPill({ ew }: { ew: ExerciseWeek }) {
  if (ew.stagnantWeeks >= 3) {
    return (
      <span className="delta delta-stall">
        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M2 6h8" /></svg>
        {`Stagne ${ew.stagnantWeeks} sem.`}
      </span>
    )
  }
  const d = ew.delta
  if (d.kind === 'weight' || d.kind === 'reps') {
    return (
      <span className="delta delta-up">
        <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M6 2l4.5 6h-9z" /></svg>
        {formatDelta(d)}
      </span>
    )
  }
  if (d.kind === 'new') return <span className="delta delta-new">{formatDelta(d)}</span>
  return (
    <span className="delta delta-eq">
      <span aria-hidden="true">{formatDelta(d)}</span>
      <span className="sr-only">Stable</span>
    </span>
  )
}

export function ExerciseRow({ ew, name, bodyweight, detailed, onOpen }: {
  ew: ExerciseWeek; name: string; bodyweight: boolean; detailed: boolean; onOpen: () => void
}) {
  const best = formatSet(ew.best, bodyweight)
  const sub = detailed ? `${ew.sets} ${ew.sets > 1 ? 'séries' : 'série'}, meilleure ${best}` : best
  return (
    <button type="button" className="p-ex-row" onClick={onOpen}>
      <span className="p-ex-main">
        <span className="p-ex-name">{name}</span>
        <span className="p-ex-sub">
          {sub}
          {ew.isRecord && <span className="p-tag">Record</span>}
        </span>
      </span>
      <DeltaPill ew={ew} />
      <Chevron />
    </button>
  )
}
