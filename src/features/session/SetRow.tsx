import { useEffect, useId, useRef, useState } from 'react'
import {
  AnimatePresence, animate, motion, useAnimationControls, useDragControls, useMotionValue, useMotionValueEvent, useTransform,
} from 'framer-motion'
import { formatWeight, parseReps, parseWeight } from '../../domain/parseWeight'
import { isBlank, stepWeight } from '../../domain/sessionFlow'
import type { SetLog } from '../../domain/types'
import { EASE, T, T_FAST } from './motion'

const DELETE_THRESHOLD = 110

const IconMinus = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M4 10h12" /></svg>
)
const IconPlus = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M10 4v12M4 10h12" /></svg>
)

interface StepperProps {
  label: string
  noun: string
  value: number
  blank: boolean
  inputMode: 'decimal' | 'numeric'
  parse: (s: string) => number | null
  format: (n: number) => string
  /** Valeur suivante pour un appui sur +/−. */
  step: (value: number, blank: boolean, dir: 1 | -1) => number
  onCommit: (value: number) => void
}

/** +/− avec saisie directe ; le champ garde la frappe en cours (« 77, ») tant qu'elle n'est pas un nombre. */
function Stepper({ label, noun, value, blank, inputMode, parse, format, step, onCommit }: StepperProps) {
  const id = useId()
  const shown = blank ? '' : format(value)
  const [text, setText] = useState(shown)
  const focused = useRef(false)
  const tick = useAnimationControls()

  useEffect(() => {
    const typed = parse(text)
    if (!focused.current || (typed !== null && typed !== value)) setText(shown)
  }, [shown]) // resynchronise seulement quand la valeur affichée change (stepper, autre série)

  const press = (dir: 1 | -1) => {
    const next = step(value, blank, dir)
    setText(format(next))
    onCommit(next)
    void tick.start({ y: [dir * 6, 0], opacity: [0.4, 1] }, { duration: T_FAST, ease: EASE })
  }

  return (
    <div className="stepper">
      <label className="stepper-lab" htmlFor={id}>{label}</label>
      <div className="stepper-row">
        <button type="button" aria-label={`Moins de ${noun}`} onClick={() => press(-1)}><IconMinus /></button>
        <motion.input
          id={id}
          className="num"
          animate={tick}
          inputMode={inputMode}
          enterKeyHint="done"
          autoComplete="off"
          placeholder="—"
          value={text}
          onFocus={(e) => { focused.current = true; e.currentTarget.select() }}
          onBlur={() => { focused.current = false; setText(shown) }}
          onChange={(e) => {
            setText(e.target.value)
            const v = parse(e.target.value)
            if (v !== null && (v !== value || blank)) onCommit(v)
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        />
        <button type="button" aria-label={`Plus de ${noun}`} onClick={() => press(1)}><IconPlus /></button>
      </div>
    </div>
  )
}

interface SetRowProps {
  set: SetLog
  n: number
  increment: number
  bodyweight: boolean
  repsMin: number
  open: boolean
  onToggleOpen: () => void
  onCheck: () => void
  onChange: (patch: Partial<Pick<SetLog, 'weight' | 'reps'>>) => void
  onRemove: () => void
  /** Bouton « Supprimer la série » dans la saisie, en plus du glissement (correction d'une séance passée). */
  removeButton?: boolean
}

export default function SetRow({ set, n, increment, bodyweight, repsMin, open, onToggleOpen, onCheck, onChange, onRemove, removeButton = false }: SetRowProps) {
  const blank = isBlank(set, bodyweight)
  const x = useMotionValue(0)
  const drag = useDragControls()
  const [armed, setArmed] = useState(false)
  const dragged = useRef(false)
  const pop = useAnimationControls()
  useMotionValueEvent(x, 'change', (v) => setArmed(v < -DELETE_THRESHOLD))
  // Fond « Supprimer » visible seulement pendant le glissement (pas de liseré au repos).
  const delOpacity = useTransform(x, (v) => (v < 0 ? 1 : 0))

  const weightText = blank.weight ? '—' : formatWeight(set.weight)
  const repsText = blank.reps ? '—' : String(set.reps)
  const summary = blank.weight || blank.reps
    ? `Série ${n} : à remplir, modifier`
    : `Série ${n} : ${formatWeight(set.weight)} kg × ${set.reps} répétitions, modifier`

  const swallowClickAfterDrag = (fn: () => void) => () => {
    if (!dragged.current) fn()
  }

  return (
    <motion.div
      className={`set-wrap${armed ? ' armed' : ''}`}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: T, ease: EASE }}
    >
      <motion.div className="set-del" aria-hidden="true" style={{ opacity: delOpacity }}>Supprimer</motion.div>
      <motion.div
        className={`set${set.done ? ' is-done' : ''}${open ? ' is-open' : ''}`}
        style={{ x }}
        drag="x"
        dragListener={false}
        dragControls={drag}
        dragConstraints={{ right: 0 }}
        dragElastic={0}
        dragMomentum={false}
        onDragStart={() => { dragged.current = true }}
        onDragEnd={(_, info) => {
          window.setTimeout(() => { dragged.current = false }, 300)
          if (info.offset.x < -DELETE_THRESHOLD) {
            void animate(x, -window.innerWidth, { duration: T_FAST, ease: EASE }).then(onRemove)
          } else {
            void animate(x, 0, { duration: T, ease: EASE })
          }
        }}
      >
        <div
          className="set-head"
          onPointerDown={(e) => {
            if (!(e.target as Element).closest('.check')) drag.start(e)
          }}
        >
          <span className="set-n">{n}</span>
          <button type="button" className="set-sum" aria-label={summary} aria-expanded={open} onClick={swallowClickAfterDrag(onToggleOpen)}>
            <span className="num">{weightText}</span><span className="unit">kg</span>
            <span className="x">×</span>
            <span className="num">{repsText}</span><span className="unit">reps</span>
          </button>
          <button
            type="button"
            className="check"
            aria-pressed={set.done}
            aria-label={`Valider la série ${n}`}
            onClick={swallowClickAfterDrag(() => {
              void pop.start({ scale: [1, 0.86, 1] }, { duration: T, ease: EASE })
              onCheck()
            })}
          >
            <motion.svg viewBox="0 0 40 40" animate={pop} aria-hidden="true">
              <circle cx="20" cy="20" r="18" />
              <motion.path
                d="M12.5 20.5l5 5 10-11"
                initial={false}
                animate={{ pathLength: set.done ? 1 : 0, opacity: set.done ? 1 : 0 }}
                transition={{ duration: T, ease: EASE, delay: set.done ? 0.04 : 0 }}
              />
            </motion.svg>
          </button>
        </div>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="edit"
              className="set-edit"
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              transition={{ duration: T, ease: EASE }}
            >
              <div className="steppers">
                <Stepper
                  label="Poids, kg"
                  noun="poids"
                  value={set.weight}
                  blank={blank.weight}
                  inputMode="decimal"
                  parse={parseWeight}
                  format={formatWeight}
                  step={(v, _b, dir) => stepWeight(v, increment, dir)}
                  onCommit={(weight) => onChange({ weight })}
                />
                <Stepper
                  label="Répétitions"
                  noun="répétitions"
                  value={set.reps}
                  blank={blank.reps}
                  inputMode="numeric"
                  parse={parseReps}
                  format={String}
                  step={(v, b, dir) => (b ? repsMin : Math.max(0, v + dir))}
                  onCommit={(reps) => onChange({ reps })}
                />
              </div>
              {removeButton && (
                <button type="button" className="text-btn muted set-remove" aria-label={`Supprimer la série ${n}`} onClick={onRemove}>
                  Supprimer la série
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
