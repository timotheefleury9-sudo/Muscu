import { Fragment, useEffect, useRef, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import { isExerciseComplete, nextUnfinished } from '../../domain/sessionFlow'
import ExerciseCard from './ExerciseCard'
import { useSession, type RemovedSet } from './useSession'
import { EASE, T } from './motion'
import './session.css'

const ADVANCE_DELAY_MS = 420
const TOAST_MS = 4000

function dayLabel(iso: string): string {
  const s = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso))
  return s.charAt(0).toUpperCase() + s.slice(1)
}

interface Toast { key: number; text: string; undo?: RemovedSet }

export default function SessionPage() {
  const { state, toggleDone, updateSet, addSet, removeSet, restoreSet, selectTemplate, finish, dismissError } = useSession()
  const [selected, setSelected] = useState<{ version: number; index: number } | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const timers = useRef<{ advance?: number; toast?: number; scroll?: number }>({})
  const sheetOk = useRef<HTMLButtonElement>(null)

  const complete = state.items.map((i) => isExerciseComplete(i.sets))
  // Exercice actif : choisi par l'utilisateur, sinon le premier non terminé de la séance chargée.
  const active = selected && selected.version === state.version ? selected.index : complete.indexOf(false)

  const live = useRef({ state, active, complete })
  live.current = { state, active, complete }

  useEffect(() => {
    const t = timers.current
    return () => { window.clearTimeout(t.advance); window.clearTimeout(t.toast); window.clearTimeout(t.scroll) }
  }, [])

  useEffect(() => {
    if (sheetOpen) sheetOk.current?.focus()
  }, [sheetOpen])

  if (state.status === 'loading') return <section className="page session" aria-busy="true" />
  if (state.status === 'empty' || !state.template) {
    return (
      <section className="page session">
        <h1>Séance</h1>
        <p className="session-empty">Aucune séance type. Crée-en une dans l'onglet Programmes.</p>
      </section>
    )
  }

  const activate = (i: number) => {
    window.clearTimeout(timers.current.advance)
    setSelected({ version: live.current.state.version, index: i })
    if (i < 0) return
    window.clearTimeout(timers.current.scroll)
    timers.current.scroll = window.setTimeout(() => {
      const card = document.getElementById(`ex-${i}`)
      const scroller = card?.closest('.app-main')
      if (!card || !scroller || typeof scroller.scrollTo !== 'function') return
      const top = card.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 8
      scroller.scrollTo({ top, behavior: 'smooth' })
    }, T * 1000 + 20)
  }

  const showToast = (text: string, undo?: RemovedSet) => {
    setToast({ key: Date.now(), text, undo })
    window.clearTimeout(timers.current.toast)
    timers.current.toast = window.setTimeout(() => setToast(null), TOAST_MS)
  }

  const onToggle = (i: number, setId: string) => {
    const next = toggleDone(i, setId)
    window.clearTimeout(timers.current.advance)
    if (next.find((s) => s.id === setId)?.done && isExerciseComplete(next) && i === live.current.active) {
      // Dernière série validée : on laisse voir la coche, puis on enchaîne.
      timers.current.advance = window.setTimeout(() => {
        const { active: a, complete: c } = live.current
        if (a === i && c[i]) activate(nextUnfinished(c, i))
      }, ADVANCE_DELAY_MS)
    }
    return next
  }

  const onRemove = (i: number, setId: string) => {
    const removed = removeSet(i, setId)
    if (removed) showToast('Série supprimée', removed)
  }

  const confirmFinish = async () => {
    setSheetOpen(false)
    window.clearTimeout(timers.current.advance)
    if (await finish()) showToast('Séance enregistrée')
  }

  const { items, template, templates, session } = state
  const sets = items.flatMap((i) => i.sets)
  const doneTotal = sets.filter((s) => s.done).length
  const left = sets.length - doneTotal
  const started = session !== null || doneTotal > 0
  const ready = active < 0 || complete.every(Boolean)
  const nextTitleAt = active >= 0 ? complete.findIndex((c, i) => i > active && !c) : -1
  const sheetText = doneTotal === 0
    ? 'Aucune série validée : cette séance ne comptera pas.'
    : left === 0
      ? 'Toutes les séries sont validées.'
      : left === 1
        ? '1 série non validée sera ignorée. Elle ne compte ni dans le bilan ni dans la prochaine charge.'
        : `${left} séries non validées seront ignorées. Elles ne comptent ni dans le bilan ni dans la prochaine charge.`

  return (
    <MotionConfig reducedMotion="user">
      <section className="page session">
        <header className="session-head">
          <div className="session-date">{dayLabel(session?.startedAt ?? new Date().toISOString())}</div>
          <div className="session-title">
            <h1>{template.name}</h1>
            <span className="session-count">
              {active >= 0
                ? <>Exercice <strong>{active + 1}</strong> sur {items.length}</>
                : <><strong>{complete.filter(Boolean).length}</strong> sur {items.length} terminés</>}
            </span>
          </div>
          <div className="progress" aria-hidden="true">
            {items.map((it) => (
              <span key={it.te.id}>
                <motion.i
                  initial={false}
                  animate={{ width: `${it.sets.length ? (it.sets.filter((s) => s.done).length / it.sets.length) * 100 : 0}%` }}
                  transition={{ duration: T, ease: EASE }}
                />
              </span>
            ))}
          </div>
          {doneTotal === 0 && templates.length > 1 && (
            <div className="tpl-switch" role="group" aria-label="Changer de séance">
              {templates.map((t) => (
                <button key={t.id} type="button" aria-pressed={t.id === template.id} onClick={() => {
                  if (toast?.undo) setToast(null)
                  selectTemplate(t.id)
                }}>
                  {t.name}
                </button>
              ))}
            </div>
          )}
        </header>

        {items.map((item, i) => (
          <Fragment key={item.te.id}>
            {i === nextTitleAt && <h3 className="next-title">Ensuite</h3>}
            <ExerciseCard
              item={item}
              index={i}
              active={i === active}
              complete={complete[i]}
              onActivate={() => activate(i)}
              onToggle={(setId) => onToggle(i, setId)}
              onChange={(setId, patch) => updateSet(i, setId, patch)}
              onAdd={() => addSet(i)}
              onRemove={(setId) => onRemove(i, setId)}
              onNext={() => activate(nextUnfinished(complete, i))}
            />
          </Fragment>
        ))}

        {started && (
          <div className="session-footer">
            <motion.button
              type="button"
              className={`primary-btn${ready ? ' is-ready' : ''}`}
              initial={false}
              animate={ready ? { scale: [1, 1.04, 1] } : { scale: 1 }}
              transition={{ duration: 0.28, ease: EASE }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSheetOpen(true)}
            >
              Terminer la séance
            </motion.button>
          </div>
        )}
      </section>

      <AnimatePresence>
        {state.saveError && (
          <motion.div
            key="save-error"
            className="save-error"
            role="alert"
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -16, opacity: 0 }}
            transition={{ duration: T, ease: EASE }}
          >
            <span>Enregistrement impossible — tes dernières saisies n'ont pas été sauvegardées</span>
            <button type="button" onClick={dismissError}>Fermer</button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.key}
            className="toast"
            role="status"
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ duration: T, ease: EASE }}
          >
            <span>{toast.text}</span>
            {toast.undo && (
              <button
                type="button"
                onClick={() => {
                  restoreSet(toast.undo!)
                  setToast(null)
                }}
              >
                Annuler
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {sheetOpen && (
          <Fragment key="sheet">
            <motion.div
              className="scrim"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: T, ease: EASE }}
              onClick={() => setSheetOpen(false)}
            />
            <motion.div
              className="sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="sheet-title"
              initial={{ y: '110%' }}
              animate={{ y: 0 }}
              exit={{ y: '110%' }}
              transition={{ duration: T, ease: EASE }}
              onKeyDown={(e) => { if (e.key === 'Escape') setSheetOpen(false) }}
            >
              <h2 id="sheet-title">Terminer la séance ?</h2>
              <p>{sheetText}</p>
              <button ref={sheetOk} type="button" className="primary-btn" onClick={() => void confirmFinish()}>Terminer</button>
              <button type="button" className="secondary-btn" onClick={() => setSheetOpen(false)}>Continuer la séance</button>
            </motion.div>
          </Fragment>
        )}
      </AnimatePresence>
    </MotionConfig>
  )
}
