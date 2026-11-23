import { useId, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { createPastSession } from '../../data/repo'
import { localDay, noonOf } from '../../domain/dates'
import { blankSetsFor, canMoveTo, dayFromParam, nonEmptyTemplates } from '../../domain/sessionLog'
import { BackButton, ProgressScreen } from '../progress/parts'
import { useAppData } from '../progress/useAppData'
import { currentMonth } from './labels'
import './history.css'

const count = (n: number): string => `${n} ${n > 1 ? 'exercices' : 'exercice'}`

/** Séance oubliée : une date (jamais future) et une séance type ; les séries sont créées vides, à remplir dans le détail. */
export default function NewPastSessionPage() {
  const data = useAppData()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const today = localDay(new Date().toISOString())
  const [day, setDay] = useState(() => dayFromParam(params.get('date'), today))
  const [error, setError] = useState<string | null>(null)
  const busy = useRef(false)
  const inputId = useId()

  const choices = useMemo(() => {
    if (!data) return null
    return nonEmptyTemplates(data.templates, data.templateExercises).map((t) => ({
      template: t, exercises: data.templateExercises.filter((te) => te.templateId === t.id),
    }))
  }, [data])

  const create = async (templateId: string) => {
    if (busy.current || !choices) return
    if (!day) {
      setError('Choisis une date')
      return
    }
    if (!canMoveTo(day, today)) {
      setError('La date ne peut pas être dans le futur')
      return
    }
    busy.current = true
    try {
      const sets = blankSetsFor(choices.find((c) => c.template.id === templateId)?.exercises ?? [])
      const s = await createPastSession(templateId, noonOf(day), sets)
      navigate(`/seances/${encodeURIComponent(s.id)}`, { replace: true })
    } catch (e) {
      console.error('Création de la séance échouée', e)
      setError('Enregistrement impossible. Réessaie.')
      busy.current = false
    }
  }

  return (
    <ProgressScreen detail busy={!choices}>
      <BackButton fallbackTo={`/progression/calendrier?mois=${day ? day.slice(0, 7) : currentMonth()}`} fallbackLabel="Calendrier" />
      <h1 className="p-title">Ajouter une séance</h1>
      <div className="h-date-edit">
        <label htmlFor={inputId} className="h-date-lab">Date de la séance</label>
        <input
          id={inputId}
          className="h-date-input h-date-full"
          type="date"
          max={today}
          value={day}
          onChange={(e) => { setDay(e.target.value); setError(null) }}
        />
        <p className="h-date-error" role="alert">{error}</p>
      </div>
      <h2 className="p-card-title h-choose">Quelle séance ?</h2>
      {choices && choices.length === 0 && (
        <div className="p-card p-empty"><strong>Aucun programme avec des exercices.</strong><p>Ajoute des exercices à un programme d'abord.</p></div>
      )}
      <div className="h-templates">
        {choices?.map(({ template, exercises }) => (
          <button key={template.id} type="button" className="h-template" onClick={() => void create(template.id)}>
            <span className="h-template-name">{template.name}</span>
            <span className="h-template-meta">{count(exercises.length)}</span>
          </button>
        ))}
      </div>
    </ProgressScreen>
  )
}
