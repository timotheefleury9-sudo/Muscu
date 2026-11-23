import type { AppData, Exercise, MuscleGroup, SetLog } from './types'
import type { PerformedSet } from './progression'
import { addDays, weekStart } from './dates'

export type Delta =
  | { kind: 'weight'; value: number }
  | { kind: 'reps'; value: number }
  | { kind: 'same' }
  | { kind: 'new' }

export interface ExerciseWeek {
  exerciseId: string
  group: MuscleGroup
  sets: number
  best: PerformedSet
  delta: Delta
  isRecord: boolean
  stagnantWeeks: number
}

export interface WeeklySummary {
  weekStart: string
  sessionsDone: number
  sessionsPlanned: 3
  recordsCount: number
  setsByGroup: Record<MuscleGroup, number>
  exercises: ExerciseWeek[]
}

const GROUPS: MuscleGroup[] = ['pectoraux', 'dos', 'epaules', 'biceps', 'triceps', 'quadriceps', 'ischios', 'fessiers', 'mollets', 'abdos']
const EPS = 1e-9

export function e1rm(weight: number, reps: number): number {
  return weight * (1 + reps / 30)
}

export function isBetter(a: PerformedSet, b: PerformedSet, bodyweight: boolean): boolean {
  if (bodyweight) return a.weight > b.weight + EPS || (Math.abs(a.weight - b.weight) <= EPS && a.reps > b.reps)
  return e1rm(a.weight, a.reps) > e1rm(b.weight, b.reps) + EPS
}

/** Meilleure série ; à égalité d'e1RM, la plus lourde l'emporte (premier rencontré sinon). */
function bestOf(sets: PerformedSet[], bodyweight: boolean): PerformedSet {
  let best = sets[0]
  for (const s of sets.slice(1)) {
    if (isBetter(s, best, bodyweight)) best = s
    else if (!bodyweight && Math.abs(e1rm(s.weight, s.reps) - e1rm(best.weight, best.reps)) <= EPS && s.weight > best.weight) best = s
  }
  return best
}

interface WeekEntry { week: string; sets: PerformedSet[] }

/** Séries validées d'un exercice groupées par semaine (début de séance), triées chronologiquement. */
function weeksOf(data: AppData, exerciseId: string): WeekEntry[] {
  const started = new Map(data.sessions.map(s => [s.id, s.startedAt]))
  const rows = data.sets
    .filter(s => s.done && s.exerciseId === exerciseId && started.has(s.sessionId))
    .map(s => ({ at: started.get(s.sessionId)!, week: weekStart(started.get(s.sessionId)!), idx: s.setIndex, p: { weight: s.weight, reps: s.reps } }))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.idx - b.idx))
  const byWeek = new Map<string, PerformedSet[]>()
  for (const r of rows) byWeek.set(r.week, [...(byWeek.get(r.week) ?? []), r.p])
  return [...byWeek.entries()].map(([week, sets]) => ({ week, sets })).sort((a, b) => (a.week < b.week ? -1 : 1))
}

/** Série au poids max de la semaine, avec les meilleures reps à ce poids (base de l'évolution, §7). */
function topOf(sets: PerformedSet[]): PerformedSet {
  let top = sets[0]
  for (const s of sets.slice(1)) {
    if (s.weight > top.weight + EPS || (Math.abs(s.weight - top.weight) <= EPS && s.reps > top.reps)) top = s
  }
  return top
}

/** Évolution : hausse du poids max, sinon plus de reps au même poids max, sinon « = ». */
function deltaOf(best: PerformedSet, prev: PerformedSet | undefined): Delta {
  if (!prev) return { kind: 'new' }
  if (best.weight > prev.weight + EPS) return { kind: 'weight', value: Math.round((best.weight - prev.weight) * 100) / 100 }
  if (Math.abs(best.weight - prev.weight) <= EPS && best.reps > prev.reps) return { kind: 'reps', value: best.reps - prev.reps }
  return { kind: 'same' }
}

function exerciseWeek(ex: Exercise, weeks: WeekEntry[], at: number): ExerciseWeek {
  const best = bestOf(weeks[at].sets, ex.bodyweight)
  // Au poids du corps, bestOf compare déjà (lest, puis reps) : identique à topOf.
  const tops = weeks.slice(0, at + 1).map(w => topOf(w.sets))
  const delta = deltaOf(tops[at], tops[at - 1])
  let stagnantWeeks = 0
  for (let i = at; i >= 0; i--) {
    if (deltaOf(tops[i], tops[i - 1]).kind !== 'same') break
    stagnantWeeks++
  }
  const earlier = weeks.slice(0, at).flatMap(w => w.sets)
  const isRecord = earlier.length > 0 && isBetter(best, bestOf(earlier, ex.bodyweight), ex.bodyweight)
  return { exerciseId: ex.id, group: ex.primaryGroup, sets: weeks[at].sets.length, best, delta, isRecord, stagnantWeeks }
}

export function weeklySummary(data: AppData, weekStartIso: string): WeeklySummary {
  const setsByGroup = Object.fromEntries(GROUPS.map(g => [g, 0])) as Record<MuscleGroup, number>
  const weekOfSession = new Map(data.sessions.map(s => [s.id, weekStart(s.startedAt)]))
  const startedAt = new Map(data.sessions.map(s => [s.id, s.startedAt]))
  const teOrder = new Map(data.templateExercises.map(te => [te.id, te.order]))
  const filtered = data.sets.filter(s => s.done && weekOfSession.get(s.sessionId) === weekStartIso)
  // Premier setIndex de chaque exercice dans sa séance : départage les exercices hors template.
  const firstIdx = new Map<string, number>()
  for (const s of filtered) {
    const k = `${s.sessionId}|${s.exerciseId}`
    firstIdx.set(k, Math.min(firstIdx.get(k) ?? Infinity, s.setIndex))
  }
  const rank = (s: SetLog): number => (s.templateExerciseId !== null ? teOrder.get(s.templateExerciseId) : undefined) ?? Infinity
  const cmp = (x: string | number, y: string | number): number => (x < y ? -1 : x > y ? 1 : 0)
  // Séance par séance ; dans une séance : ordre du template, puis exercices hors template
  // (ou dont la ligne de template a été supprimée) par premier setIndex puis id.
  const inWeek = filtered.sort((a, b) =>
    cmp(startedAt.get(a.sessionId)!, startedAt.get(b.sessionId)!)
    || cmp(a.sessionId, b.sessionId)
    || cmp(rank(a), rank(b))
    || (rank(a) === Infinity ? cmp(firstIdx.get(`${a.sessionId}|${a.exerciseId}`)!, firstIdx.get(`${b.sessionId}|${b.exerciseId}`)!) : 0)
    || cmp(a.exerciseId, b.exerciseId)
    || a.setIndex - b.setIndex,
  )

  const sessionsDone = new Set(inWeek.map(s => s.sessionId)).size
  const order: string[] = []
  for (const s of inWeek) if (!order.includes(s.exerciseId)) order.push(s.exerciseId)

  const exercises: ExerciseWeek[] = []
  for (const id of order) {
    const ex = data.exercises.find(e => e.id === id)
    if (!ex) continue
    const weeks = weeksOf(data, id)
    const at = weeks.findIndex(w => w.week === weekStartIso)
    if (at < 0) continue
    exercises.push(exerciseWeek(ex, weeks, at))
    setsByGroup[ex.primaryGroup] += weeks[at].sets.length
  }
  return {
    weekStart: weekStartIso,
    sessionsDone,
    sessionsPlanned: 3,
    recordsCount: exercises.filter(e => e.isRecord).length,
    setsByGroup,
    exercises,
  }
}

const round1 = (n: number): number => Math.round(n * 10) / 10

export type SeriesMetric = 'load' | 'e1rm'

export interface ExerciseSeries {
  unit: 'kg' | 'reps'
  points: { weekStart: string; value: number | null }[]
}

/**
 * Valeur hebdomadaire d'un exercice sur `weeks` semaines finissant à endWeek (null = pas de séance).
 * Unité unique sur la fenêtre : e1RM en kg ; pour un exercice au poids du corps jamais lesté
 * dans la fenêtre, répétitions de la meilleure série. S'il a été lesté, seules les séries lestées comptent.
 * metric 'load' : charge max validée de la semaine (lest max au poids du corps) au lieu de l'e1RM.
 */
export function exerciseSeries(
  data: AppData, exerciseId: string, weeks: number, endWeek: string, metric: SeriesMetric = 'e1rm',
): ExerciseSeries {
  const ex = data.exercises.find(e => e.id === exerciseId)
  const byWeek = new Map(weeksOf(data, exerciseId).map(w => [w.week, w.sets]))
  const window = Array.from({ length: weeks }, (_, i) => addDays(endWeek, -7 * (weeks - 1 - i)))
  const bodyweight = ex?.bodyweight ?? false
  const loaded = !bodyweight || window.some(w => (byWeek.get(w) ?? []).some(s => s.weight > 0))
  const unit = loaded ? 'kg' : 'reps'
  const points = window.map(week => {
    const sets = (byWeek.get(week) ?? []).filter(s => !bodyweight || !loaded || s.weight > 0)
    if (sets.length === 0 || !ex) return { weekStart: week, value: null }
    const best = bestOf(sets, bodyweight)
    if (!loaded) return { weekStart: week, value: best.reps }
    return { weekStart: week, value: metric === 'load' ? Math.max(...sets.map(s => s.weight)) : round1(e1rm(best.weight, best.reps)) }
  })
  return { unit, points }
}

export interface ExerciseHighlights {
  record: PerformedSet
  last: { weekStart: string; best: PerformedSet }
}

/** Record (meilleure série) et meilleure série de la dernière semaine travaillée, jusqu'à endWeek inclus. */
export function exerciseHighlights(data: AppData, exerciseId: string, endWeek: string): ExerciseHighlights | null {
  const ex = data.exercises.find(e => e.id === exerciseId)
  const weeks = weeksOf(data, exerciseId).filter(w => w.week <= endWeek)
  if (!ex || weeks.length === 0) return null
  const lastWeek = weeks[weeks.length - 1]
  return {
    record: bestOf(weeks.flatMap(w => w.sets), ex.bodyweight),
    last: { weekStart: lastWeek.week, best: bestOf(lastWeek.sets, ex.bodyweight) },
  }
}
