import { useCallback, useEffect, useRef, useState } from 'react'
import { deleteSession, deleteSet, endSession, loadAll, saveSet, startSession } from '../../data/repo'
import { buildHistory } from '../../domain/history'
import { suggestNext, type Suggestion } from '../../domain/progression'
import { nextTemplateId, resolveOpenSession } from '../../domain/rotation'
import { plannedSets, propagateValues } from '../../domain/sessionFlow'
import type { AppData, Exercise, Session, SetLog, TemplateExercise, WorkoutTemplate } from '../../domain/types'

export interface SessionItem { te: TemplateExercise; exercise: Exercise; suggestion: Suggestion; sets: SetLog[] }

export interface SessionState {
  status: 'loading' | 'empty' | 'ready'
  templates: WorkoutTemplate[]
  template: WorkoutTemplate | null
  /** null tant que rien n'a été touché : la séance proposée n'est créée en base qu'à la première action. */
  session: Session | null
  items: SessionItem[]
  /** Change à chaque (re)chargement ou changement de séance. */
  version: number
}

export interface RemovedSet { itemIndex: number; set: SetLog }

const LOADING: SessionState = { status: 'loading', templates: [], template: null, session: null, items: [], version: 0 }

/** Exercices de la séance : séries de la séance ouverte, ou séries proposées (brouillon) depuis l'historique. */
function buildItems(data: AppData, templateId: string, session: Session | null): SessionItem[] {
  const exercises = new Map(data.exercises.map((e) => [e.id, e]))
  return data.templateExercises
    .filter((te) => te.templateId === templateId)
    .sort((a, b) => a.order - b.order)
    .flatMap((te) => {
      const exercise = exercises.get(te.exerciseId)
      if (!exercise) return []
      const history = buildHistory(data, te.exerciseId, session?.id)
      const slot = { sets: te.sets, repsMin: te.repsMin, repsMax: te.repsMax }
      const suggestion = suggestNext(history, slot, exercise)
      const sets = session
        ? data.sets.filter((s) => s.sessionId === session.id && s.templateExerciseId === te.id).sort((a, b) => a.setIndex - b.setIndex)
        : plannedSets(suggestion, slot, history).map((p, setIndex): SetLog => ({
            id: crypto.randomUUID(), sessionId: '', exerciseId: te.exerciseId, templateExerciseId: te.id, setIndex, ...p, done: false,
          }))
      return [{ te, exercise, suggestion, sets }]
    })
}

export function useSession() {
  const [state, setState] = useState<SessionState>(LOADING)
  const stateRef = useRef(state)
  const dataRef = useRef<AppData | null>(null)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const gen = useRef(0)

  const commit = useCallback((next: SessionState) => {
    stateRef.current = next
    setState(next)
  }, [])

  /** Écritures en base dans l'ordre des actions, sans jamais bloquer l'interface. */
  const enqueue = useCallback((job: () => Promise<void>) => {
    const myGen = gen.current
    queue.current = queue.current
      .then(() => (myGen === gen.current ? job() : undefined))
      .catch((e: unknown) => console.error('Enregistrement de la séance échoué', e))
    return queue.current
  }, [])

  const load = useCallback(async (isCancelled: () => boolean) => {
    let data = await loadAll()
    const open = data.sessions.find((s) => s.endedAt === null) ?? null
    let session: Session | null = null
    const decision = resolveOpenSession(open, new Date())
    if (open && (decision === 'autoclose' || !data.templates.some((t) => t.id === open.templateId))) {
      await endSession(open.id)
      data = await loadAll()
    } else if (decision === 'resume') {
      session = open
    }
    if (isCancelled()) return
    dataRef.current = data
    gen.current++
    const templates = [...data.templates].sort((a, b) => a.rotationOrder - b.rotationOrder)
    const version = stateRef.current.version + 1
    if (templates.length === 0) return commit({ ...LOADING, status: 'empty', version })
    const templateId = session ? session.templateId : nextTemplateId(templates, data.sessions, data.sets)
    const template = templates.find((t) => t.id === templateId)!
    commit({ status: 'ready', templates, template, session, items: buildItems(data, templateId, session), version })
  }, [commit])

  useEffect(() => {
    let cancelled = false
    load(() => cancelled).catch((e: unknown) => console.error('Chargement de la séance échoué', e))
    return () => { cancelled = true }
  }, [load])

  /** Crée la séance en base à la première action, avec toutes les séries proposées. */
  const ensureSession = useCallback(async (): Promise<string> => {
    const cur = stateRef.current
    if (cur.session) return cur.session.id
    const s = await startSession(cur.template!.id)
    const latest = stateRef.current
    commit({ ...latest, session: s })
    await Promise.all(latest.items.flatMap((i) => i.sets).map((x) => saveSet({ ...x, sessionId: s.id })))
    return s.id
  }, [commit])

  const persist = useCallback((sets: SetLog[]) => {
    if (sets.length === 0) return
    enqueue(async () => {
      const sessionId = await ensureSession()
      await Promise.all(sets.map((s) => saveSet({ ...s, sessionId })))
    })
  }, [enqueue, ensureSession])

  /** Remplace les séries d'un exercice ; enregistre celles qui ont changé. */
  const replaceSets = useCallback((itemIndex: number, next: SetLog[]) => {
    const cur = stateRef.current
    const prev = new Set(cur.items[itemIndex].sets)
    commit({ ...cur, items: cur.items.map((it, i) => (i === itemIndex ? { ...it, sets: next } : it)) })
    persist(next.filter((s) => !prev.has(s)))
    return next
  }, [commit, persist])

  const toggleDone = useCallback((itemIndex: number, setId: string): SetLog[] => {
    const sets = stateRef.current.items[itemIndex].sets
    const k = sets.findIndex((s) => s.id === setId)
    let next = sets.map((s, i) => (i === k ? { ...s, done: !s.done } : s))
    if (next[k].done) next = propagateValues(next, k)
    return replaceSets(itemIndex, next)
  }, [replaceSets])

  const updateSet = useCallback((itemIndex: number, setId: string, patch: Partial<Pick<SetLog, 'weight' | 'reps'>>) => {
    const sets = stateRef.current.items[itemIndex].sets
    replaceSets(itemIndex, sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)))
  }, [replaceSets])

  /** Série en plus, copiée sur la dernière ; renvoie son id. */
  const addSet = useCallback((itemIndex: number): string => {
    const { te, sets } = stateRef.current.items[itemIndex]
    const last = sets[sets.length - 1]
    const s: SetLog = {
      id: crypto.randomUUID(), sessionId: '', exerciseId: te.exerciseId, templateExerciseId: te.id,
      setIndex: sets.reduce((m, x) => Math.max(m, x.setIndex + 1), 0),
      plannedWeight: null, plannedReps: null, weight: last?.weight ?? 0, reps: last?.reps ?? 0, done: false,
    }
    replaceSets(itemIndex, [...sets, s])
    return s.id
  }, [replaceSets])

  const removeSet = useCallback((itemIndex: number, setId: string): RemovedSet | null => {
    const cur = stateRef.current
    const set = cur.items[itemIndex].sets.find((s) => s.id === setId)
    if (!set) return null
    commit({ ...cur, items: cur.items.map((it, i) => (i === itemIndex ? { ...it, sets: it.sets.filter((s) => s.id !== setId) } : it)) })
    enqueue(async () => {
      await ensureSession()
      await deleteSet(setId)
    })
    return { itemIndex, set }
  }, [commit, enqueue, ensureSession])

  const restoreSet = useCallback(({ itemIndex, set }: RemovedSet) => {
    const sets = stateRef.current.items[itemIndex].sets
    if (sets.some((s) => s.id === set.id)) return
    replaceSets(itemIndex, [...sets, set].sort((a, b) => a.setIndex - b.setIndex))
  }, [replaceSets])

  /** Autre séance, tant qu'aucune série n'est validée : la séance commencée (sans série validée) est effacée. */
  const selectTemplate = useCallback((templateId: string) => {
    const cur = stateRef.current
    const data = dataRef.current
    if (!data || cur.template?.id === templateId || cur.items.some((i) => i.sets.some((s) => s.done))) return
    const template = cur.templates.find((t) => t.id === templateId)
    if (!template) return
    const old = cur.session
    gen.current++
    commit({ ...cur, template, session: null, items: buildItems(data, templateId, null), version: cur.version + 1 })
    if (old) enqueue(() => deleteSession(old.id))
  }, [commit, enqueue])

  /** Clôt la séance après les écritures en attente, puis propose la suivante. */
  const finish = useCallback(() => {
    const id = stateRef.current.session?.id
    return enqueue(async () => {
      if (id) await endSession(id)
      await load(() => false)
    })
  }, [enqueue, load])

  return { state, toggleDone, updateSet, addSet, removeSet, restoreSet, selectTemplate, finish }
}
