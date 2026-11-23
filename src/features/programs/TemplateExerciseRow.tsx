import { useEffect, useId, useState, type PointerEvent } from 'react'
import { AnimatePresence, Reorder, motion, useDragControls } from 'framer-motion'
import { parseReps } from '../../domain/parseWeight'
import { canStep, stepSlot, validateSlot, type Slot } from '../../domain/programEdit'
import type { Exercise, TemplateExercise } from '../../domain/types'
import { GROUP_LABEL } from '../progress/labels'
import { IconMinus, IconPlus } from './parts'
import { slotSummary } from './labels'

const FIELDS = ['sets', 'restSec', 'repsMin', 'repsMax'] as const
type Field = (typeof FIELDS)[number]
type Draft = Record<Field, string>

const META: Record<Field, { label: string; noun: string }> = {
  sets: { label: 'Séries', noun: 'séries' },
  restSec: { label: 'Repos (s)', noun: 'repos' },
  repsMin: { label: 'Répétitions min', noun: 'répétitions min' },
  repsMax: { label: 'Répétitions max', noun: 'répétitions max' },
}

const slotOf = (te: TemplateExercise): Slot => ({ sets: te.sets, repsMin: te.repsMin, repsMax: te.repsMax, restSec: te.restSec })
const toDraft = (s: Slot): Draft => ({ sets: String(s.sets), restSec: String(s.restSec), repsMin: String(s.repsMin), repsMax: String(s.repsMax) })
const parseDraft = (d: Draft): Slot => {
  const n = (f: Field) => parseReps(d[f]) ?? NaN
  return { sets: n('sets'), repsMin: n('repsMin'), repsMax: n('repsMax'), restSec: n('restSec') }
}
const same = (a: Slot, b: Slot) => FIELDS.every((f) => a[f] === b[f])

interface Props {
  domId: string
  te: TemplateExercise
  exercise: Exercise | undefined
  index: number
  count: number
  open: boolean
  onToggle: () => void
  onChange: (slot: Slot) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
  onDragEnd: () => void
}

export default function TemplateExerciseRow({ domId, te, exercise, index, count, open, onToggle, onChange, onMove, onRemove, onDragEnd }: Props) {
  const id = useId()
  const drag = useDragControls()
  const saved = slotOf(te)
  const name = exercise?.name ?? 'Exercice supprimé'
  // Saisie en cours ; null = valeurs enregistrées. Une saisie invalide reste affichée (avec son erreur) sans être enregistrée.
  const [draft, setDraft] = useState<Draft | null>(null)
  const shown = draft ?? toDraft(saved)
  const current = parseDraft(shown)
  const errors = draft ? validateSlot(current) : {}
  // Valeurs de départ des boutons +/− : la saisie si c'est un nombre, sinon la valeur enregistrée.
  const filled = Object.fromEntries(FIELDS.map((f) => [f, Number.isNaN(current[f]) ? saved[f] : current[f]])) as Slot

  // Valeurs enregistrées changées (enregistrement, resynchronisation) : une saisie valide n'a plus lieu d'être gardée.
  useEffect(() => {
    setDraft((d) => (d && Object.keys(validateSlot(parseDraft(d))).length === 0 ? null : d))
  }, [te.sets, te.repsMin, te.repsMax, te.restSec])

  // Ligne repliée : la saisie non enregistrée est abandonnée.
  useEffect(() => {
    if (!open) setDraft(null)
  }, [open])

  const edit = (next: Draft) => {
    setDraft(next)
    const slot = parseDraft(next)
    if (Object.keys(validateSlot(slot)).length === 0 && !same(slot, saved)) onChange(slot)
  }

  const step = (f: Field, dir: 1 | -1) => edit({ ...shown, [f]: String(stepSlot(filled, f, dir)) })

  const startDrag = (e: PointerEvent) => {
    e.preventDefault()
    drag.start(e)
  }

  return (
    <Reorder.Item
      value={te}
      as="li"
      id={domId}
      className={`prg-row${open ? ' is-open' : ''}`}
      aria-label={name}
      dragListener={false}
      dragControls={drag}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.02, boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)', zIndex: 3 }}
    >
      <div className="prg-row-head">
        <button type="button" className="prg-handle" aria-label={`Déplacer ${name}`} onPointerDown={startDrag}>
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <circle cx="7" cy="5" r="1.6" /><circle cx="13" cy="5" r="1.6" /><circle cx="7" cy="10" r="1.6" />
            <circle cx="13" cy="10" r="1.6" /><circle cx="7" cy="15" r="1.6" /><circle cx="13" cy="15" r="1.6" />
          </svg>
        </button>
        <button type="button" className="prg-row-main" aria-expanded={open} aria-controls={`${id}-body`} onClick={onToggle}>
          <span className="prg-row-name">{name}</span>
          <span className="prg-row-sub">
            {exercise && `${GROUP_LABEL[exercise.primaryGroup]} · `}
            <span className="num">{slotSummary(saved)}</span>
          </span>
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            id={`${id}-body`}
            className="prg-row-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="prg-steppers">
              {FIELDS.map((f) => {
                return (
                  <div key={f} className={`prg-stepper${errors[f] ? ' is-invalid' : ''}`}>
                    <label className="prg-stepper-lab" htmlFor={`${id}-${f}`}>{META[f].label}</label>
                    <div className="prg-stepper-row">
                      <button type="button" aria-label={`Moins de ${META[f].noun}`} disabled={!canStep(filled, f, -1)} onClick={() => step(f, -1)}><IconMinus /></button>
                      <input
                        id={`${id}-${f}`}
                        className="num"
                        inputMode="numeric"
                        enterKeyHint="done"
                        autoComplete="off"
                        aria-invalid={errors[f] ? true : undefined}
                        aria-describedby={errors[f] ? `${id}-err` : undefined}
                        value={shown[f]}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) => edit({ ...shown, [f]: e.target.value })}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                      />
                      <button type="button" aria-label={`Plus de ${META[f].noun}`} disabled={!canStep(filled, f, 1)} onClick={() => step(f, 1)}><IconPlus /></button>
                    </div>
                  </div>
                )
              })}
            </div>
            {Object.keys(errors).length > 0 && (
              <p id={`${id}-err`} className="prg-error" role="alert">
                {[...new Set(FIELDS.map((f) => errors[f]).filter(Boolean))].join(' ')}
              </p>
            )}
            <div className="prg-row-actions">
              <button type="button" className="prg-text-btn" disabled={index === 0} onClick={() => onMove(-1)}>Monter</button>
              <button type="button" className="prg-text-btn" disabled={index === count - 1} onClick={() => onMove(1)}>Descendre</button>
              <button type="button" className="prg-text-btn danger" onClick={onRemove}>Retirer</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Reorder.Item>
  )
}
