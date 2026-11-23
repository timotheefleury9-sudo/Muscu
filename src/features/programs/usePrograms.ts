import { useCallback, useEffect, useRef, useState } from 'react'
import {
  deleteTemplate, deleteTemplateExercise, loadPrograms, saveExercise, saveTemplate, saveTemplateExercise, saveTemplateExercises,
} from '../../data/repo'
import { defaultSlot, nextRotationOrder, reindex, type Slot } from '../../domain/programEdit'
import type { AppData, Exercise, TemplateExercise, WorkoutTemplate } from '../../domain/types'

export type ProgramsData = Pick<AppData, 'exercises' | 'templates' | 'templateExercises'>

/**
 * File unique des lectures et écritures de l'onglet, partagée entre écrans :
 * un écran qui se charge voit toujours les écritures lancées avant lui.
 */
let queue: Promise<unknown> = Promise.resolve()
const inFlight = new Set<Promise<unknown>>()
function schedule<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job)
  queue = run.catch(() => undefined)
  inFlight.add(run)
  void run.catch(() => undefined).finally(() => inFlight.delete(run))
  return run
}
/** Attend la fin de toutes les écritures en cours (tests). */
export async function pendingProgramWrites(): Promise<void> {
  while (inFlight.size > 0) await Promise.allSettled([...inFlight])
}

export const rowsOf = (data: ProgramsData, templateId: string): TemplateExercise[] =>
  data.templateExercises.filter((te) => te.templateId === templateId).sort((a, b) => a.order - b.order)

/**
 * Données des programmes et modifications. Chaque modification s'affiche tout de suite puis est écrite en base ;
 * en cas d'échec : message persistant et retour à l'état sauvegardé (comme l'écran de séance).
 */
export function usePrograms() {
  const [data, setData] = useState<ProgramsData | null>(null)
  const [saveError, setSaveError] = useState(false)
  const alive = useRef(true)

  const reload = useCallback(
    () => schedule(loadPrograms).then((d) => { if (alive.current) setData(d) }),
    [],
  )

  useEffect(() => {
    alive.current = true
    reload().catch((e: unknown) => console.error('Chargement des programmes échoué', e))
    return () => { alive.current = false }
  }, [reload])

  /** Affiche `update` immédiatement, puis écrit. */
  const mutate = useCallback((update: (d: ProgramsData) => ProgramsData, write: () => Promise<void>) => {
    setData((d) => (d ? update(d) : d))
    void schedule(write).catch(async (e: unknown) => {
      console.error('Enregistrement du programme échoué', e)
      if (alive.current) setSaveError(true)
      await reload().catch((e2: unknown) => console.error('Resynchronisation des programmes échouée', e2))
    })
  }, [reload])

  const addTemplate = useCallback((): string => {
    const t: WorkoutTemplate = { id: crypto.randomUUID(), name: 'Nouveau programme', rotationOrder: nextRotationOrder(data?.templates ?? []) }
    mutate((d) => ({ ...d, templates: [...d.templates, t] }), () => saveTemplate(t))
    return t.id
  }, [data, mutate])

  const renameTemplate = useCallback((t: WorkoutTemplate, name: string) => {
    const next = { ...t, name }
    mutate((d) => ({ ...d, templates: d.templates.map((x) => (x.id === t.id ? next : x)) }), () => saveTemplate(next))
  }, [mutate])

  const removeTemplate = useCallback((id: string) => {
    mutate(
      (d) => ({ ...d, templates: d.templates.filter((t) => t.id !== id), templateExercises: d.templateExercises.filter((te) => te.templateId !== id) }),
      () => deleteTemplate(id),
    )
  }, [mutate])

  const newRow = (d: ProgramsData | null, templateId: string, ex: Exercise): TemplateExercise => ({
    id: crypto.randomUUID(), templateId, exerciseId: ex.id, order: d ? rowsOf(d, templateId).length : 0, ...defaultSlot(ex),
  })

  /** Ajoute l'exercice en fin de programme ; renvoie l'id de la ligne. */
  const addExercise = useCallback((templateId: string, ex: Exercise): string => {
    const te = newRow(data, templateId, ex)
    mutate((d) => ({ ...d, templateExercises: [...d.templateExercises, te] }), () => saveTemplateExercise(te))
    return te.id
  }, [data, mutate])

  /** Enregistre l'exercice personnalisé et l'ajoute au programme ; renvoie l'id de la ligne. */
  const createExercise = useCallback((templateId: string, ex: Exercise): string => {
    const te = newRow(data, templateId, ex)
    mutate(
      (d) => ({ ...d, exercises: [...d.exercises, ex], templateExercises: [...d.templateExercises, te] }),
      async () => { await saveExercise(ex); await saveTemplateExercise(te) },
    )
    return te.id
  }, [data, mutate])

  const updateSlot = useCallback((te: TemplateExercise, slot: Slot) => {
    const next = { ...te, ...slot }
    mutate((d) => ({ ...d, templateExercises: d.templateExercises.map((x) => (x.id === te.id ? next : x)) }), () => saveTemplateExercise(next))
  }, [mutate])

  /** Nouvel ordre des lignes d'un programme (order = position). */
  const reorder = useCallback((rows: TemplateExercise[]) => {
    const next = reindex(rows)
    const byId = new Map(next.map((x) => [x.id, x]))
    mutate((d) => ({ ...d, templateExercises: d.templateExercises.map((x) => byId.get(x.id) ?? x) }), () => saveTemplateExercises(next))
  }, [mutate])

  const removeExercise = useCallback((id: string) => {
    mutate((d) => ({ ...d, templateExercises: d.templateExercises.filter((x) => x.id !== id) }), () => deleteTemplateExercise(id))
  }, [mutate])

  return {
    data, saveError, dismissError: () => setSaveError(false),
    addTemplate, renameTemplate, removeTemplate, addExercise, createExercise, updateSlot, reorder, removeExercise,
  }
}
