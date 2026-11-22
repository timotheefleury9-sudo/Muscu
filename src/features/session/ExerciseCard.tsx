import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { formatWeight } from '../../domain/parseWeight'
import { isBlank, sessionHint } from '../../domain/sessionFlow'
import type { SetLog } from '../../domain/types'
import SetRow from './SetRow'
import type { SessionItem } from './useSession'
import { EASE, T } from './motion'

const IconTrend = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12l4-4 3 3 5-6" /><path d="M11 5h4v4" />
  </svg>
)
const IconCheck = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3.5 8.5l3 3 6-7" />
  </svg>
)

const formatRest = (sec: number): string => (sec % 60 === 0 ? `${sec / 60} min` : `${sec} s`)

/** Partie repliable de la carte (ligne compacte ou contenu actif). */
function Fold({ children }: { children: ReactNode }) {
  return (
    <motion.div
      className="fold"
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: T, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}

interface ExerciseCardProps {
  item: SessionItem
  index: number
  active: boolean
  complete: boolean
  onActivate: () => void
  onToggle: (setId: string) => SetLog[]
  onChange: (setId: string, patch: Partial<Pick<SetLog, 'weight' | 'reps'>>) => void
  onAdd: () => string
  onRemove: (setId: string) => void
  onNext: () => void
}

export default function ExerciseCard({ item, index, active, complete, onActivate, onToggle, onChange, onAdd, onRemove, onNext }: ExerciseCardProps) {
  const { exercise, te, sets, suggestion } = item
  const [openId, setOpenId] = useState<string | null>(null)

  // Carte ouverte : la série ouverte par défaut est la première non validée.
  useEffect(() => {
    if (active && !sets.some((s) => s.id === openId)) setOpenId(sets.find((s) => !s.done)?.id ?? null)
  }, [active]) // seule l'ouverture de la carte déclenche ce choix

  const done = sets.filter((s) => s.done).length
  const slot = { sets: te.sets, repsMin: te.repsMin, repsMax: te.repsMax }
  const hint = sessionHint({ suggestion, slot, increment: exercise.increment, sets })
  const meta = `${te.sets} séries de ${te.repsMin} à ${te.repsMax}`

  const check = (s: SetLog) => {
    // Série à compléter (champs vides, 0 rep, ou 0 kg hors poids du corps) : on ouvre la saisie au lieu de valider.
    if (!s.done && (s.reps === 0 || (!exercise.bodyweight && s.weight === 0))) {
      setOpenId(s.id)
      return
    }
    const next = onToggle(s.id)
    const now = next.find((x) => x.id === s.id)
    if (now?.done && openId === s.id) setOpenId(next.find((x) => !x.done)?.id ?? null)
  }

  let load: ReactNode
  if (complete) {
    load = (
      <>
        <span className="num frac">{done}<small>/{sets.length}</small></span>
        <span className="mini-check" role="img" aria-label="Terminé"><IconCheck /></span>
      </>
    )
  } else if (done > 0) {
    load = <span className="num frac">{done}<small>/{sets.length}</small></span>
  } else if (sets[0] && !isBlank(sets[0], exercise.bodyweight).weight) {
    load = <><span className="num">{formatWeight(sets[0].weight)}</span><span className="unit">kg</span></>
  } else {
    load = <span className="unit">À saisir</span>
  }

  return (
    <section id={`ex-${index}`} className={`card ex${active ? ' is-active' : ''}${complete && !active ? ' is-done' : ''}`} aria-label={exercise.name}>
      <AnimatePresence initial={false}>
        {!active && (
          <Fold key="row">
            <button type="button" className="ex-next" onClick={onActivate}>
              <span>
                <span className="ex-next-name">{exercise.name}</span>
                <span className="ex-next-meta">{meta}</span>
              </span>
              <span className="ex-next-load">{load}</span>
            </button>
          </Fold>
        )}
        {active && (
          <Fold key="body">
            <div className="ex-body">
              <h2 className="ex-name">{exercise.name}</h2>
              <p className="ex-meta">{meta} répétitions, repos {formatRest(te.restSec)}</p>
              {hint && (
                <div className={`hint is-${hint.tone}`} aria-live="polite">
                  <IconTrend />
                  <span>{hint.before}<strong>{hint.strong}</strong>{hint.after}</span>
                </div>
              )}
              <div className={`sets${hint ? '' : ' no-hint'}`}>
                <AnimatePresence initial={false}>
                  {sets.map((s, k) => (
                    <SetRow
                      key={s.id}
                      set={s}
                      n={k + 1}
                      increment={exercise.increment}
                      bodyweight={exercise.bodyweight}
                      repsMin={te.repsMin}
                      open={openId === s.id}
                      onToggleOpen={() => setOpenId(openId === s.id ? null : s.id)}
                      onCheck={() => check(s)}
                      onChange={(patch) => onChange(s.id, patch)}
                      onRemove={() => onRemove(s.id)}
                    />
                  ))}
                </AnimatePresence>
              </div>
              <div className="ex-actions">
                <button type="button" className="text-btn" onClick={() => setOpenId(onAdd())}>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M9 3v12M3 9h12" /></svg>
                  Ajouter une série
                </button>
                <button type="button" className="text-btn muted" onClick={onNext}>Exercice suivant</button>
              </div>
            </div>
          </Fold>
        )}
      </AnimatePresence>
    </section>
  )
}
