import type { AppData, Exercise, MuscleGroup } from './types'
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

function deltaOf(best: PerformedSet, prev: PerformedSet | undefined): Delta {
  if (!prev) return { kind: 'new' }
  if (best.weight > prev.weight + EPS) return { kind: 'weight', value: Math.round((best.weight - prev.weight) * 100) / 100 }
  if (Math.abs(best.weight - prev.weight) <= EPS && best.reps > prev.reps) return { kind: 'reps', value: best.reps - prev.reps }
  return { kind: 'same' }
}

function exerciseWeek(ex: Exercise, weeks: WeekEntry[], at: number): ExerciseWeek {
  const bests = weeks.slice(0, at + 1).map(w => bestOf(w.sets, ex.bodyweight))
  const best = bests[at]
  const delta = deltaOf(best, bests[at - 1])
  let stagnantWeeks = 0
  for (let i = at; i >= 0; i--) {
    if (deltaOf(bests[i], bests[i - 1]).kind !== 'same') break
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
  const inWeek = data.sets
    .filter(s => s.done && weekOfSession.get(s.sessionId) === weekStartIso)
    .sort((a, b) => {
      const sa = startedAt.get(a.sessionId)!, sb = startedAt.get(b.sessionId)!
      return sa < sb ? -1 : sa > sb ? 1 : a.setIndex - b.setIndex
    })

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

export function exerciseSeries(
  data: AppData,
  exerciseId: string,
  weeks: number,
  endWeek: string,
): { weekStart: string; value: number | null }[] {
  const ex = data.exercises.find(e => e.id === exerciseId)
  const byWeek = new Map(weeksOf(data, exerciseId).map(w => [w.week, w.sets]))
  return Array.from({ length: weeks }, (_, i) => {
    const week = addDays(endWeek, -7 * (weeks - 1 - i))
    const sets = byWeek.get(week)
    if (!sets || !ex) return { weekStart: week, value: null }
    const best = bestOf(sets, ex.bodyweight)
    const value = ex.bodyweight && best.weight === 0 ? best.reps : round1(e1rm(best.weight, best.reps))
    return { weekStart: week, value }
  })
}
