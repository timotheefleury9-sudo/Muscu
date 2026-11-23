import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { GROUP_LABEL } from '../progress/labels'
import type { MuscleGroup } from '../../domain/types'
import { Chevron, IconPlus, ProgramsScreen, SaveError } from './parts'
import { plural } from './labels'
import { rowsOf, usePrograms } from './usePrograms'

export default function ProgramsPage() {
  const { data, saveError, dismissError, addTemplate } = usePrograms()
  const navigate = useNavigate()

  if (!data) return <ProgramsScreen detail={false} busy><h1 className="prg-title">Programmes</h1></ProgramsScreen>

  const exercises = new Map(data.exercises.map((e) => [e.id, e]))
  const templates = [...data.templates].sort((a, b) => a.rotationOrder - b.rotationOrder)

  return (
    <ProgramsScreen detail={false} overlays={<SaveError show={saveError} onDismiss={dismissError} />}>
      <h1 className="prg-title">Programmes</h1>
      {templates.length > 1 && (
        <p className="prg-lead">Rotation : {templates.map((t) => t.name).join(' → ')}</p>
      )}

      <ul className="prg-cards" aria-label="Programmes">
        {templates.map((t) => {
          const rows = rowsOf(data, t.id)
          const groups = [...new Set(rows.map((r) => exercises.get(r.exerciseId)?.primaryGroup).filter((g): g is MuscleGroup => !!g))]
          return (
            <li key={t.id}>
              <motion.button type="button" className="prg-card" whileTap={{ scale: 0.98 }} onClick={() => navigate(`/programmes/${t.id}`)}>
                <span className="prg-card-main">
                  <span className="prg-card-name">{t.name}</span>
                  <span className="prg-card-sub">
                    {plural(rows.length, 'exercice', 'exercices')}
                    {groups.length > 0 && ` · ${groups.slice(0, 3).map((g) => GROUP_LABEL[g]).join(', ')}`}
                  </span>
                </span>
                <Chevron />
              </motion.button>
            </li>
          )
        })}
      </ul>

      <button type="button" className="prg-add" onClick={() => navigate(`/programmes/${addTemplate()}`)}>
        <IconPlus />
        Nouveau programme
      </button>
    </ProgramsScreen>
  )
}
