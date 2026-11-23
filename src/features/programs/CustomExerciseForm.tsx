import { useId, useState, type FormEvent } from 'react'
import { validateCustomExercise, type CustomExerciseErrors } from '../../domain/programEdit'
import type { Exercise, MuscleGroup } from '../../domain/types'
import { GROUPS, GROUP_LABEL } from '../progress/labels'

interface Props {
  initialName: string
  onCreate: (exercise: Exercise) => void
}

/** Exercice personnalisé : nom et groupe obligatoires, incrément > 0 (2,5 par défaut), poids du corps, poly-articulaire ou isolation. */
export default function CustomExerciseForm({ initialName, onCreate }: Props) {
  const id = useId()
  const [name, setName] = useState(initialName)
  const [group, setGroup] = useState<MuscleGroup | null>(null)
  const [kind, setKind] = useState<Exercise['kind']>('compound')
  const [increment, setIncrement] = useState('2,5')
  const [bodyweight, setBodyweight] = useState(false)
  const [errors, setErrors] = useState<CustomExerciseErrors>({})

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const r = validateCustomExercise({ name, group, increment, bodyweight, kind })
    if (!r.ok) return setErrors(r.errors)
    setErrors({})
    onCreate({ id: `custom-${crypto.randomUUID()}`, ...r.exercise })
  }

  const err = (k: keyof CustomExerciseErrors) =>
    errors[k] && <p id={`${id}-${k}-err`} className="prg-field-error">{errors[k]}</p>

  return (
    <form className="prg-form" noValidate onSubmit={submit}>
      <div className="prg-field">
        <label className="prg-field-lab" htmlFor={`${id}-name`}>Nom</label>
        <input
          id={`${id}-name`}
          className="prg-input"
          autoComplete="off"
          enterKeyHint="next"
          placeholder="Ex. Écarté à la poulie vis-à-vis"
          value={name}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? `${id}-name-err` : undefined}
          onChange={(e) => setName(e.target.value)}
        />
        {err('name')}
      </div>

      <div className="prg-field">
        <span className="prg-field-lab" id={`${id}-group`}>Groupe musculaire</span>
        <div
          className="prg-pills wrap"
          role="radiogroup"
          aria-labelledby={`${id}-group`}
          aria-invalid={errors.group ? true : undefined}
          aria-describedby={errors.group ? `${id}-group-err` : undefined}
        >
          {GROUPS.map((g) => (
            <button key={g} type="button" role="radio" aria-checked={group === g} className="prg-pill" onClick={() => setGroup(g)}>
              {GROUP_LABEL[g]}
            </button>
          ))}
        </div>
        {err('group')}
      </div>

      <div className="prg-field">
        <span className="prg-field-lab" id={`${id}-kind`}>Type</span>
        <div className="prg-segment" role="radiogroup" aria-labelledby={`${id}-kind`}>
          {([['compound', 'Poly-articulaire'], ['isolation', 'Isolation']] as const).map(([k, label]) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="prg-field">
        <label className="prg-field-lab" htmlFor={`${id}-inc`}>Incrément (kg)</label>
        <input
          id={`${id}-inc`}
          className="prg-input num short"
          inputMode="decimal"
          autoComplete="off"
          value={increment}
          aria-invalid={errors.increment ? true : undefined}
          aria-describedby={errors.increment ? `${id}-increment-err` : undefined}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setIncrement(e.target.value)}
        />
        {err('increment')}
      </div>

      <button type="button" role="switch" aria-checked={bodyweight} className="prg-switch-row" onClick={() => setBodyweight((b) => !b)}>
        <span>
          Poids du corps
          <small>Le poids saisi en séance est le lest seul.</small>
        </span>
        <span className="prg-switch" aria-hidden="true"><i /></span>
      </button>

      <button type="submit" className="prg-primary">Créer et ajouter</button>
    </form>
  )
}
