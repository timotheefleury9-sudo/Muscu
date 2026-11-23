import { useCallback, useEffect, useRef, useState } from 'react'
import { deleteSession, deleteSet, loadAll, moveSession, removeExerciseFromSession, saveExercise, saveSet } from '../../data/repo'
import { localDay } from '../../domain/dates'
import { appendedSet, canMoveTo, moveSessionTimes } from '../../domain/sessionLog'
import type { AppData, Exercise, Session, SetLog } from '../../domain/types'

export interface EditorState {
  /** open : séance en cours (non modifiable ici) ; missing : séance introuvable ; error : lecture de la base impossible. */
  status: 'loading' | 'missing' | 'open' | 'ready' | 'error'
  /** Exercices, programmes et lignes de programme (les séances et séries des autres jours ne servent pas). */
  data: Pick<AppData, 'exercises' | 'templates' | 'templateExercises'> | null
  session: Session | null
  /** Séries de la séance, telles qu'affichées. */
  sets: SetLog[]
  /** Une écriture a échoué : l'écran a été resynchronisé depuis la base. Reste vrai jusqu'à fermeture du message. */
  saveError: boolean
}

export const FUTURE_DATE_ERROR = 'La date ne peut pas être dans le futur'

const LOADING: EditorState = { status: 'loading', data: null, session: null, sets: [], saveError: false }

/** Écritures en cours, toutes instances confondues (y compris après démontage). */
const inFlight = new Set<Promise<unknown>>()
/** Attend la fin de toutes les écritures en cours (tests, rechargement). */
export async function pendingEditorWrites(): Promise<void> {
  while (inFlight.size > 0) await Promise.allSettled([...inFlight])
}

/**
 * Correction d'une séance terminée. Chaque modification s'affiche tout de suite puis est écrite en base, dans l'ordre
 * des actions ; en cas d'échec : message persistant et rechargement depuis la base (comme l'écran de séance).
 */
export function useSessionEditor(id: string) {
  const [state, setState] = useState<EditorState>(LOADING)
  const stateRef = useRef(state)
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const alive = useRef(true)

  const commit = useCallback((next: EditorState) => {
    stateRef.current = next
    if (alive.current) setState(next)
  }, [])

  const load = useCallback(async () => {
    const all = await loadAll()
    const session = all.sessions.find((s) => s.id === id) ?? null
    const status = !session ? 'missing' : session.endedAt === null ? 'open' : 'ready'
    commit({
      status,
      data: { exercises: all.exercises, templates: all.templates, templateExercises: all.templateExercises },
      session,
      sets: all.sets.filter((s) => s.sessionId === id),
      saveError: stateRef.current.saveError,
    })
  }, [id, commit])

  useEffect(() => {
    alive.current = true
    stateRef.current = LOADING
    setState(LOADING)
    // Les écritures d'un passage précédent sur l'écran doivent être visibles au chargement.
    pendingEditorWrites()
      .then(load)
      .catch((e: unknown) => {
        console.error('Chargement de la séance échoué', e)
        commit({ ...LOADING, status: 'error' })
      })
    return () => { alive.current = false }
  }, [load, commit])

  /** Un échec attend sa resynchronisation (faite quand la file est vide). */
  const dirty = useRef(false)

  /**
   * Écriture en file ; résout à true si elle a abouti. Après un échec, la resynchronisation n'a lieu qu'une fois les
   * écritures déjà en file terminées : sinon elles s'appliqueraient en base après coup sans apparaître à l'écran.
   */
  const enqueue = useCallback((job: () => Promise<void>): Promise<boolean> => {
    const run: Promise<boolean> = queue.current.then(async () => {
      let ok = true
      try {
        await job()
      } catch (e) {
        console.error('Enregistrement de la séance échoué', e)
        ok = false
        dirty.current = true
        commit({ ...stateRef.current, saveError: true })
      }
      if (dirty.current && queue.current === run) {
        dirty.current = false
        try {
          await load()
        } catch (e2) {
          console.error('Resynchronisation de la séance échouée', e2)
        }
        // Une modification faite pendant la relecture a pu être écrasée : la dernière de la file resynchronisera.
        if (queue.current !== run) dirty.current = true
      }
      return ok
    })
    queue.current = run
    inFlight.add(run)
    void run.finally(() => inFlight.delete(run))
    return run
  }, [commit, load])

  const setSets = useCallback((sets: SetLog[]) => commit({ ...stateRef.current, sets }), [commit])

  const putSet = useCallback((next: SetLog) => {
    setSets(stateRef.current.sets.map((s) => (s.id === next.id ? next : s)))
    void enqueue(() => saveSet(next))
  }, [setSets, enqueue])

  const updateSet = useCallback((setId: string, patch: Partial<Pick<SetLog, 'weight' | 'reps'>>) => {
    const s = stateRef.current.sets.find((x) => x.id === setId)
    if (s) putSet({ ...s, ...patch })
  }, [putSet])

  /** Valider / dévalider ; contrairement à l'écran Séance, les séries suivantes ne sont pas recopiées. */
  const toggleDone = useCallback((setId: string) => {
    const s = stateRef.current.sets.find((x) => x.id === setId)
    if (s) putSet({ ...s, done: !s.done })
  }, [putSet])

  const appendSet = useCallback((exerciseId: string): SetLog => {
    const cur = stateRef.current
    const s = appendedSet(cur.sets, id, exerciseId, crypto.randomUUID())
    setSets([...cur.sets, s])
    return s
  }, [id, setSets])

  /** Série en plus, copiée sur la dernière de l'exercice ; renvoie son id. */
  const addSet = useCallback((exerciseId: string): string => {
    const s = appendSet(exerciseId)
    void enqueue(() => saveSet(s))
    return s.id
  }, [appendSet, enqueue])

  const removeSet = useCallback((setId: string) => {
    setSets(stateRef.current.sets.filter((s) => s.id !== setId))
    void enqueue(() => deleteSet(setId))
  }, [setSets, enqueue])

  const removeExercise = useCallback((exerciseId: string) => {
    setSets(stateRef.current.sets.filter((s) => s.exerciseId !== exerciseId))
    void enqueue(() => removeExerciseFromSession(id, exerciseId))
  }, [id, setSets, enqueue])

  /** Exercice oublié (existant, ou créé dans le sélecteur) : une série vide. */
  const addExercise = useCallback((ex: Exercise, created = false) => {
    const cur = stateRef.current
    if (created && cur.data) commit({ ...cur, data: { ...cur.data, exercises: [...cur.data.exercises, ex] } })
    const s = appendSet(ex.id)
    void enqueue(async () => {
      if (created) await saveExercise(ex)
      await saveSet(s)
    })
  }, [commit, appendSet, enqueue])

  /** Même heure, autre jour ; renvoie le message d'erreur si la date est refusée. */
  const moveTo = useCallback((day: string): string | null => {
    const cur = stateRef.current
    if (!cur.session) return null
    if (!canMoveTo(day, localDay(new Date().toISOString()))) return FUTURE_DATE_ERROR
    const { startedAt, endedAt } = moveSessionTimes(cur.session, day)
    commit({ ...cur, session: { ...cur.session, startedAt, endedAt } })
    void enqueue(() => moveSession(id, startedAt, endedAt))
    return null
  }, [id, commit, enqueue])

  /** Supprime la séance et ses séries après les écritures en attente ; résout à true si c'est fait. */
  const remove = useCallback(() => enqueue(() => deleteSession(id)), [id, enqueue])

  const dismissError = useCallback(() => commit({ ...stateRef.current, saveError: false }), [commit])

  return { state, updateSet, toggleDone, addSet, removeSet, removeExercise, addExercise, moveTo, remove, dismissError }
}
