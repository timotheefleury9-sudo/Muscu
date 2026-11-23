import { useCallback, useEffect, useRef, useState } from 'react'
import { deleteSession, deleteSet, endSession, listSets, loadAll, saveSet, startSessionWithSets } from '../../data/repo'
import { buildHistory } from '../../domain/history'
import { suggestNext, type Suggestion } from '../../domain/progression'
import { nextTemplateId, resolveOpenSession } from '../../domain/rotation'
import { hasValidatedSet, plannedSets, propagateValues } from '../../domain/sessionFlow'
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
  /** Une écriture a échoué : l'écran a été resynchronisé depuis la base. Reste vrai jusqu'à fermeture du message. */
  saveError: boolean
}

/** Série supprimée, restaurable seulement dans la même séance chargée (même version). */
export interface RemovedSet { version: number; itemIndex: number; set: SetLog }

const LOADING: SessionState = { status: 'loading', templates: [], template: null, session: null, items: [], version: 0, saveError: false }

/** Écriture devenue sans objet (séance changée pendant qu'elle s'exécutait). */
class StaleWrite extends Error {}

/** Écritures en cours, toutes instances confondues (y compris après démontage). */
const inFlight = new Set<Promise<unknown>>()
/** Attend la fin de toutes les écritures en cours (tests, diagnostic). */
export async function pendingWrites(): Promise<void> {
  while (inFlight.size > 0) await Promise.allSettled([...inFlight])
}

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

/** Clôt la séance ; sans série validée, elle ne compte pas : supprimée avec ses séries brouillon. */
async function closeSession(id: string, sets: Pick<SetLog, 'sessionId' | 'done'>[]): Promise<void> {
  if (hasValidatedSet(sets, id)) await endSession(id)
  else await deleteSession(id)
}

export function useSession() {
  const [state, setState] = useState<SessionState>(LOADING)
  const stateRef = useRef(state)
  const dataRef = useRef<AppData | null>(null)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const gen = useRef(0)
  const resyncRef = useRef<() => Promise<void>>(async () => {})

  const commit = useCallback((next: SessionState) => {
    stateRef.current = next
    setState(next)
  }, [])

  /**
   * Écritures en base dans l'ordre des actions, sans jamais bloquer l'interface.
   * En cas d'échec : message persistant et resynchronisation depuis la base (l'écran ne montre que ce qui est sauvegardé).
   * Résout à true si l'écriture a abouti.
   */
  const enqueue = useCallback((job: (myGen: number) => Promise<void>): Promise<boolean> => {
    const myGen = gen.current
    const run = queue.current.then(async () => {
      if (myGen !== gen.current) return false
      try {
        await job(myGen)
        return true
      } catch (e) {
        if (e instanceof StaleWrite) return false
        console.error('Enregistrement de la séance échoué', e)
        commit({ ...stateRef.current, saveError: true })
        try {
          await resyncRef.current()
        } catch (e2) {
          console.error('Resynchronisation de la séance échouée', e2)
        }
        return false
      }
    })
    queue.current = run.then(() => undefined)
    inFlight.add(run)
    void run.finally(() => inFlight.delete(run))
    return run
  }, [commit])

  const load = useCallback(async (isCancelled: () => boolean) => {
    let data = await loadAll()
    const open = data.sessions.find((s) => s.endedAt === null) ?? null
    let session: Session | null = null
    const decision = resolveOpenSession(open, new Date())
    if (open && (decision === 'autoclose' || !data.templates.some((t) => t.id === open.templateId))) {
      await closeSession(open.id, data.sets)
      data = await loadAll()
    } else if (decision === 'resume') {
      session = open
    }
    if (isCancelled()) return
    dataRef.current = data
    gen.current++
    const templates = [...data.templates].sort((a, b) => a.rotationOrder - b.rotationOrder)
    const version = stateRef.current.version + 1
    const saveError = stateRef.current.saveError
    if (templates.length === 0) return commit({ ...LOADING, status: 'empty', version, saveError })
    const templateId = session ? session.templateId : nextTemplateId(templates, data.sessions, data.sets, data.templateExercises)
    const template = templates.find((t) => t.id === templateId)!
    commit({ status: 'ready', templates, template, session, items: buildItems(data, templateId, session), version, saveError })
  }, [commit])
  resyncRef.current = () => load(() => false)

  useEffect(() => {
    let cancelled = false
    // Au (re)montage, attendre les écritures d'une instance précédente (ex. création de séance en cours) :
    // sinon la séance encore non écrite serait invisible et une seconde serait créée.
    // (Pas dans load : elle s'exécute aussi depuis la file d'écritures, qui s'attendrait elle-même.)
    pendingWrites()
      .then(() => load(() => cancelled))
      .catch((e: unknown) => console.error('Chargement de la séance échoué', e))
    return () => { cancelled = true }
  }, [load])

  /** Crée la séance en base à la première action, avec toutes les séries proposées. */
  const ensureSession = useCallback(async (myGen: number): Promise<string> => {
    const cur = stateRef.current
    if (cur.session) return cur.session.id
    // Séance et séries proposées écrites ensemble : un échec ne laisse jamais de séance ouverte vide.
    const s = await startSessionWithSets(cur.template!.id, stateRef.current.items.flatMap((i) => i.sets))
    if (myGen !== gen.current) {
      // Séance changée pendant la création : on n'en garde pas de trace.
      await deleteSession(s.id)
      throw new StaleWrite()
    }
    commit({ ...stateRef.current, session: s })
    return s.id
  }, [commit])

  const persist = useCallback((sets: SetLog[]) => {
    if (sets.length === 0) return
    void enqueue(async (myGen) => {
      const sessionId = await ensureSession(myGen)
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
    void enqueue(async (myGen) => {
      await ensureSession(myGen)
      await deleteSet(setId)
    })
    return { version: cur.version, itemIndex, set }
  }, [commit, enqueue, ensureSession])

  const restoreSet = useCallback(({ version, itemIndex, set }: RemovedSet) => {
    const cur = stateRef.current
    if (cur.version !== version) return
    const sets = cur.items[itemIndex].sets
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
    if (old) void enqueue(() => deleteSession(old.id))
  }, [commit, enqueue])

  /** Clôt la séance après les écritures en attente, puis propose la suivante. */
  const finish = useCallback((): Promise<boolean> => {
    return enqueue(async () => {
      const id = stateRef.current.session?.id
      if (id) await closeSession(id, await listSets(id))
      await load(() => false)
    })
  }, [enqueue, load])

  const dismissError = useCallback(() => commit({ ...stateRef.current, saveError: false }), [commit])

  return { state, toggleDone, updateSet, addSet, removeSet, restoreSet, selectTemplate, finish, dismissError }
}
