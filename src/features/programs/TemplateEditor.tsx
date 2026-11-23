import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, Reorder } from 'framer-motion'
import { useNavigate, useParams } from 'react-router-dom'
import { moveItem } from '../../domain/programEdit'
import type { Exercise, TemplateExercise, WorkoutTemplate } from '../../domain/types'
import ExercisePicker from './ExercisePicker'
import TemplateExerciseRow from './TemplateExerciseRow'
import { ConfirmSheet, IconLeft, IconPlus, ProgramsScreen, SaveError, type ConfirmRequest } from './parts'
import { plural } from './labels'
import { rowsOf, usePrograms } from './usePrograms'

/** Nom du programme, modifiable sur place ; un nom vide est refusé (retour au nom enregistré). */
function TemplateName({ template, onRename }: { template: WorkoutTemplate; onRename: (name: string) => void }) {
  const [text, setText] = useState(template.name)
  const editing = useRef(false)
  useEffect(() => {
    if (!editing.current) setText(template.name)
  }, [template.name])
  const commit = () => {
    editing.current = false
    const name = text.trim().replace(/\s+/g, ' ')
    if (name && name !== template.name) onRename(name)
    setText(name || template.name)
  }
  return (
    <input
      className="prg-name-input"
      aria-label="Nom du programme"
      autoComplete="off"
      enterKeyHint="done"
      maxLength={40}
      value={text}
      onFocus={() => { editing.current = true }}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') { setText(template.name); editing.current = false }
      }}
    />
  )
}

export default function TemplateEditor() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const p = usePrograms()
  const [openId, setOpenId] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)
  // Ordre provisoire pendant un glisser-déposer ; enregistré au lâcher.
  const [dragRows, setDragRows] = useState<TemplateExercise[] | null>(null)
  const dragRef = useRef<TemplateExercise[] | null>(null)
  const scrollTo = useRef<string | null>(null)

  useEffect(() => {
    const target = scrollTo.current
    if (!target) return
    scrollTo.current = null
    const t = window.setTimeout(() => document.getElementById(`row-${target}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'center' }), 60)
    return () => window.clearTimeout(t)
  })

  const back = (
    <button type="button" className="prg-back" onClick={() => navigate('/programmes')}>
      <IconLeft />
      Programmes
    </button>
  )

  if (!p.data) return <ProgramsScreen detail busy>{back}</ProgramsScreen>
  const template = p.data.templates.find((t) => t.id === id)
  if (!template) {
    return (
      <ProgramsScreen detail>
        {back}
        <p className="prg-muted">Ce programme n'existe plus.</p>
      </ProgramsScreen>
    )
  }

  const exercises = new Map(p.data.exercises.map((e) => [e.id, e]))
  const saved = rowsOf(p.data, template.id)
  const rows = dragRows ?? saved
  const lastTemplate = p.data.templates.length <= 1

  const added = (rowId: string) => {
    setPicking(false)
    setOpenId(rowId)
    scrollTo.current = rowId
  }

  const finishDrag = () => {
    const order = dragRef.current
    dragRef.current = null
    setDragRows(null)
    if (order && order.some((r, i) => r.id !== saved[i]?.id)) p.reorder(order)
  }

  const askRemove = (te: TemplateExercise, ex: Exercise | undefined) => setConfirm({
    title: `Retirer « ${ex?.name ?? 'cet exercice'} » ?`,
    text: 'Il disparaît de ce programme. Les séances déjà faites restent dans l\'historique.',
    confirm: 'Retirer',
    onConfirm: () => {
      if (openId === te.id) setOpenId(null)
      p.removeExercise(te.id)
    },
  })

  const askDeleteTemplate = () => setConfirm({
    title: `Supprimer « ${template.name} » ?`,
    text: 'Le programme quitte la rotation. Les séances déjà faites restent dans l\'historique.',
    confirm: 'Supprimer',
    onConfirm: () => {
      p.removeTemplate(template.id)
      navigate('/programmes', { replace: true })
    },
  })

  const overlays = (
    <>
      <AnimatePresence>
        {picking && (
          <ExercisePicker
            key="picker"
            exercises={p.data.exercises}
            inTemplate={new Set(saved.map((r) => r.exerciseId))}
            onPick={(ex) => added(p.addExercise(template.id, ex))}
            onCreate={(ex) => added(p.createExercise(template.id, ex))}
            onClose={() => setPicking(false)}
          />
        )}
      </AnimatePresence>
      <ConfirmSheet request={confirm} onClose={() => setConfirm(null)} />
      <SaveError show={p.saveError} onDismiss={p.dismissError} />
    </>
  )

  return (
    <ProgramsScreen detail overlays={overlays}>
      {back}
      <TemplateName template={template} onRename={(name) => p.renameTemplate(template, name)} />
      <p className="prg-lead">{plural(rows.length, 'exercice', 'exercices')}</p>

      {rows.length === 0 ? (
        <div className="prg-empty">
          <strong>Aucun exercice pour l'instant.</strong>
          <p>Ajoute les exercices de cette séance, dans l'ordre où tu les fais.</p>
        </div>
      ) : (
        <Reorder.Group
          axis="y"
          as="ul"
          className="prg-list"
          aria-label="Exercices du programme"
          values={rows}
          onReorder={(next: TemplateExercise[]) => { dragRef.current = next; setDragRows(next) }}
        >
          {rows.map((te, i) => (
            <TemplateExerciseRow
              key={te.id}
              domId={`row-${te.id}`}
              te={te}
              exercise={exercises.get(te.exerciseId)}
              index={i}
              count={rows.length}
              open={openId === te.id}
              onToggle={() => setOpenId((o) => (o === te.id ? null : te.id))}
              onChange={(slot) => p.updateSlot(te, slot)}
              onIncrementChange={(ex, increment) => p.updateIncrement(ex, increment)}
              onMove={(dir) => p.reorder(moveItem(saved, i, dir))}
              onRemove={() => askRemove(te, exercises.get(te.exerciseId))}
              onDragEnd={finishDrag}
            />
          ))}
        </Reorder.Group>
      )}

      <button type="button" className="prg-add" onClick={() => setPicking(true)}>
        <IconPlus />
        Ajouter un exercice
      </button>

      <div className="prg-danger-zone">
        <button type="button" className="prg-text-btn danger" disabled={lastTemplate} onClick={askDeleteTemplate}>
          Supprimer le programme
        </button>
        {lastTemplate && <p className="prg-muted">Garde au moins un programme.</p>}
      </div>
    </ProgramsScreen>
  )
}
