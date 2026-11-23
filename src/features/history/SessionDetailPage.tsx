import { useId, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { localDay } from '../../domain/dates'
import { defaultSlot } from '../../domain/programEdit'
import { sessionExercises } from '../../domain/sessionLog'
import type { Exercise, SetLog, TemplateExercise } from '../../domain/types'
import ExercisePicker from '../programs/ExercisePicker'
import { ConfirmSheet, IconPlus, SaveError, type ConfirmRequest } from '../programs/parts'
import { dayDate } from '../progress/labels'
import { BackButton, ProgressScreen } from '../progress/parts'
import SetRow from '../session/SetRow'
import '../session/session.css'
import { currentMonth, timeLabel } from './labels'
import { useSessionEditor } from './useSessionEditor'
import './history.css'

interface CardProps {
  exercise: Exercise | undefined
  exerciseId: string
  te: TemplateExercise | undefined
  sets: SetLog[]
  onToggle: (setId: string) => void
  onChange: (setId: string, patch: Partial<Pick<SetLog, 'weight' | 'reps'>>) => void
  onAdd: () => string
  onRemoveSet: (setId: string) => void
  onRemove: () => void
}

/** Un exercice de la séance : ses séries, toutes modifiables (même saisie que l'écran Séance). */
function ExerciseEditCard({ exercise, exerciseId, te, sets, onToggle, onChange, onAdd, onRemoveSet, onRemove }: CardProps) {
  const [openId, setOpenId] = useState<string | null>(null)
  const name = exercise?.name ?? exerciseId
  const bodyweight = exercise?.bodyweight ?? false
  const repsMin = te?.repsMin ?? defaultSlot({ kind: exercise?.kind ?? 'compound' }).repsMin
  const done = sets.filter((s) => s.done).length

  const check = (s: SetLog) => {
    // Série à compléter : on ouvre la saisie au lieu de valider (comme en séance).
    if (!s.done && (s.reps === 0 || (!bodyweight && s.weight === 0))) {
      setOpenId(s.id)
      return
    }
    onToggle(s.id)
  }

  return (
    <section className="card ex h-ex" aria-label={name}>
      <div className="ex-body">
        <h2 className="ex-name">{name}</h2>
        <p className="ex-meta">{`${done} ${done > 1 ? 'séries validées' : 'série validée'} sur ${sets.length}`}</p>
        <div className="sets no-hint">
          <AnimatePresence initial={false}>
            {sets.map((s, k) => (
              <SetRow
                key={s.id}
                set={s}
                n={k + 1}
                increment={exercise?.increment ?? 2.5}
                bodyweight={bodyweight}
                repsMin={repsMin}
                open={openId === s.id}
                onToggleOpen={() => setOpenId(openId === s.id ? null : s.id)}
                onCheck={() => check(s)}
                onChange={(patch) => onChange(s.id, patch)}
                onRemove={() => onRemoveSet(s.id)}
                removeButton
              />
            ))}
          </AnimatePresence>
        </div>
        <div className="ex-actions">
          <button type="button" className="text-btn" onClick={() => setOpenId(onAdd())}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M9 3v12M3 9h12" /></svg>
            Ajouter une série
          </button>
          <button type="button" className="text-btn muted" onClick={onRemove}>Retirer l'exercice</button>
        </div>
      </div>
    </section>
  )
}

/** Date de la séance : sélecteur natif, pas de date future, heure conservée. */
function DateEditor({ day, onMove }: { day: string; onMove: (day: string) => string | null }) {
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputId = useId()
  if (!editing) {
    return (
      <button type="button" className="text-btn h-date-btn" onClick={() => setEditing(true)}>Modifier la date</button>
    )
  }
  return (
    <div className="h-date-edit">
      <label htmlFor={inputId} className="h-date-lab">Date de la séance</label>
      <div className="h-date-row">
        <input
          id={inputId}
          className="h-date-input"
          type="date"
          max={localDay(new Date().toISOString())}
          value={day}
          onChange={(e) => {
            const next = e.target.value
            if (!next || next === day) return
            const err = onMove(next)
            setError(err)
            if (!err) setEditing(false)
          }}
        />
        <button type="button" className="text-btn muted" onClick={() => { setEditing(false); setError(null) }}>Fermer</button>
      </div>
      <p className="h-date-error" aria-live="polite">{error}</p>
    </div>
  )
}

export default function SessionDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const editor = useSessionEditor(id)
  const { state } = editor
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  const [picking, setPicking] = useState(false)

  const month = state.session ? localDay(state.session.startedAt).slice(0, 7) : currentMonth()
  const back = <BackButton fallbackTo={`/progression/calendrier?mois=${month}`} fallbackLabel="Calendrier" />

  if (state.status === 'open') return <Navigate to="/" replace />
  if (state.status === 'loading') return <ProgressScreen detail busy>{back}</ProgressScreen>
  if (state.status === 'error') {
    return (
      <ProgressScreen detail>
        {back}
        <div className="p-card p-empty"><strong>Impossible de charger cette séance.</strong><p>Reviens en arrière puis réessaie.</p></div>
      </ProgressScreen>
    )
  }
  if (state.status === 'missing' || !state.session || !state.data) {
    return (
      <ProgressScreen detail>
        {back}
        <div className="p-card p-empty"><strong>Cette séance n'existe plus.</strong></div>
      </ProgressScreen>
    )
  }

  const { session, data, sets } = state
  const exercises = new Map(data.exercises.map((e) => [e.id, e]))
  const tes = new Map(data.templateExercises.map((te) => [te.id, te]))
  const groups = sessionExercises(sets, data.templateExercises)
  const templateName = data.templates.find((t) => t.id === session.templateId)?.name ?? 'Séance'

  const askRemoveExercise = (exerciseId: string, name: string) => setConfirm({
    title: `Retirer « ${name} » ?`,
    text: 'Ses séries de cette séance sont supprimées.',
    confirm: 'Retirer',
    onConfirm: () => editor.removeExercise(exerciseId),
  })

  const askDelete = () => setConfirm({
    title: 'Supprimer cette séance ?',
    text: 'C\'est définitif.',
    confirm: 'Supprimer',
    onConfirm: () => {
      void editor.remove().then((ok) => {
        if (ok) navigate(`/progression/calendrier?mois=${month}`, { replace: true })
      })
    },
  })

  const overlays = (
    <>
      <AnimatePresence>
        {picking && (
          <ExercisePicker
            key="picker"
            exercises={data.exercises}
            inTemplate={new Set(groups.map((g) => g.exerciseId))}
            presentTag="Déjà dans la séance"
            onPick={(ex) => { setPicking(false); editor.addExercise(ex) }}
            onCreate={(ex) => { setPicking(false); editor.addExercise(ex, true) }}
            onClose={() => setPicking(false)}
          />
        )}
      </AnimatePresence>
      <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />
      <SaveError show={state.saveError} onDismiss={editor.dismissError} />
    </>
  )

  return (
    <ProgressScreen detail className="session h-detail" overlays={overlays}>
      {back}
      <header className="session-head h-detail-head">
        <div className="session-date">{`${dayDate(session.startedAt)} · ${timeLabel(session.startedAt)}`}</div>
        <div className="session-title"><h1>{templateName}</h1></div>
        <DateEditor day={localDay(session.startedAt)} onMove={editor.moveTo} />
      </header>

      {groups.length === 0 && (
        <div className="card session-empty-card"><p>Aucune série dans cette séance.</p></div>
      )}

      {groups.map((g) => {
        const exercise = exercises.get(g.exerciseId)
        const teId = g.sets.find((s) => s.templateExerciseId !== null && tes.has(s.templateExerciseId))?.templateExerciseId
        return (
          <ExerciseEditCard
            key={g.exerciseId}
            exerciseId={g.exerciseId}
            exercise={exercise}
            te={teId ? tes.get(teId) : undefined}
            sets={g.sets}
            onToggle={editor.toggleDone}
            onChange={editor.updateSet}
            onAdd={() => editor.addSet(g.exerciseId)}
            onRemoveSet={editor.removeSet}
            onRemove={() => askRemoveExercise(g.exerciseId, exercise?.name ?? g.exerciseId)}
          />
        )
      })}

      <div className="h-actions">
        <button type="button" className="h-action h-action-icon" onClick={() => setPicking(true)}>
          <IconPlus />
          Ajouter un exercice
        </button>
        <button type="button" className="h-action is-danger" onClick={askDelete}>Supprimer la séance</button>
      </div>
    </ProgressScreen>
  )
}
