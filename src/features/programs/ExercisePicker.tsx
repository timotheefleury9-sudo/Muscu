import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { searchExercises } from '../../domain/searchExercises'
import type { Exercise, MuscleGroup } from '../../domain/types'
import { GROUPS, GROUP_LABEL } from '../progress/labels'
import CustomExerciseForm from './CustomExerciseForm'
import { IconLeft, IconPlus } from './parts'
import { equipmentLabel } from './labels'
import { EASE, T } from '../session/motion'

/** Résultats affichés au plus (au-delà : affiner la recherche). */
const MAX_RESULTS = 60

interface Props {
  exercises: Exercise[]
  /** Exercices déjà présents dans le programme (signalés, pas interdits). */
  inTemplate: Set<string>
  /** Libellé de ces exercices déjà présents. */
  presentTag?: string
  onPick: (exercise: Exercise) => void
  onCreate: (exercise: Exercise) => void
  onClose: () => void
}

/** Plein écran : recherche, filtre par groupe, étirements et cardio masqués par défaut, création d'un exercice. */
export default function ExercisePicker({ exercises, inTemplate, presentTag = 'Déjà dans le programme', onPick, onCreate, onClose }: Props) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<MuscleGroup | undefined>(undefined)
  const [includeAll, setIncludeAll] = useState(false)
  const [creating, setCreating] = useState(false)
  const search = useRef<HTMLInputElement>(null)

  const results = useMemo(() => searchExercises(exercises, query, group, { includeAll }), [exercises, query, group, includeAll])

  useEffect(() => {
    if (!creating) search.current?.focus({ preventScroll: true })
  }, [creating])

  return (
    <motion.div
      className="prg-picker"
      role="dialog"
      aria-modal="true"
      aria-labelledby="picker-title"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ duration: T, ease: EASE }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
    >
      <header className="prg-picker-head">
        {creating
          ? <button type="button" className="prg-back" onClick={() => setCreating(false)}><IconLeft />Retour</button>
          : <span />}
        <button type="button" className="prg-close" onClick={onClose}>Fermer</button>
      </header>
      <h2 id="picker-title" className="prg-picker-title">Ajouter un exercice</h2>

      {creating ? (
        <div className="prg-picker-body">
          <h3 className="prg-picker-sub">Nouvel exercice</h3>
          <CustomExerciseForm initialName={query.trim()} onCreate={onCreate} />
        </div>
      ) : (
        <>
          <div className="prg-picker-tools">
            <input
              ref={search}
              type="search"
              className="prg-input"
              aria-label="Rechercher un exercice"
              placeholder="Rechercher"
              autoComplete="off"
              enterKeyHint="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="prg-pills" role="group" aria-label="Groupe musculaire">
              <button type="button" className="prg-pill" aria-pressed={group === undefined} onClick={() => setGroup(undefined)}>Tous</button>
              {GROUPS.map((g) => (
                <button key={g} type="button" className="prg-pill" aria-pressed={group === g} onClick={() => setGroup(g)}>{GROUP_LABEL[g]}</button>
              ))}
            </div>
            <button type="button" role="switch" aria-checked={includeAll} className="prg-switch-row compact" onClick={() => setIncludeAll((v) => !v)}>
              <span>Afficher étirements et cardio</span>
              <span className="prg-switch" aria-hidden="true"><i /></span>
            </button>
          </div>

          <div className="prg-picker-body">
            <button type="button" className="prg-create" onClick={() => setCreating(true)}>
              <span className="prg-create-icon"><IconPlus /></span>
              Créer un exercice
            </button>
            {results.length === 0 ? (
              <p className="prg-muted">Aucun exercice trouvé. Crée-le s'il n'existe pas.</p>
            ) : (
              <ul className="prg-results">
                {results.slice(0, MAX_RESULTS).map((e) => (
                  <li key={e.id}>
                    <button type="button" className="prg-result" onClick={() => onPick(e)}>
                      <span className="prg-result-name">{e.name}</span>
                      <span className="prg-result-sub">
                        {GROUP_LABEL[e.primaryGroup]} · {equipmentLabel(e.equipment)}
                        {e.custom && <span className="prg-tag">Perso</span>}
                        {inTemplate.has(e.id) && <span className="prg-tag">{presentTag}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {results.length > MAX_RESULTS && (
              <p className="prg-muted">{results.length - MAX_RESULTS} autres exercices : précise ta recherche ou choisis un groupe.</p>
            )}
          </div>
        </>
      )}
    </motion.div>
  )
}
