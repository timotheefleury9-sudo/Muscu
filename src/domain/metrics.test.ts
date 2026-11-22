import { describe, it, expect } from 'vitest'
import type { AppData, Exercise, SetLog, Session } from './types'
import { e1rm, isBetter, weeklySummary, exerciseSeries } from './metrics'

const ex = (id: string, primaryGroup: Exercise['primaryGroup'], bodyweight = false): Exercise => ({
  id, name: id, primaryGroup, secondaryGroups: ['triceps'], equipment: 'x', kind: 'compound', increment: 2.5, bodyweight, custom: false,
})
const W1 = new Date(2026, 10, 2, 18) // lundi 2 nov
const W2 = new Date(2026, 10, 9, 18)
const W3 = new Date(2026, 10, 16, 18)
const sess = (id: string, d: Date): Session => ({ id, templateId: 't', startedAt: d.toISOString(), endedAt: null })
let n = 0
const set = (sessionId: string, exerciseId: string, weight: number, reps: number, done = true): SetLog => ({
  id: `s${n++}`, sessionId, exerciseId, templateExerciseId: null, setIndex: n, plannedWeight: null, plannedReps: null, weight, reps, done,
})
const base = (sessions: Session[], sets: SetLog[]): AppData => ({
  exercises: [ex('dev', 'pectoraux'), ex('squat', 'quadriceps'), ex('pompes', 'pectoraux', true)],
  templates: [], templateExercises: [], sessions, sets,
})

describe('e1rm / isBetter', () => {
  it('e1rm(80,8)', () => expect(e1rm(80, 8)).toBeCloseTo(101.33, 2))
  it('isBetter par e1RM', () => expect(isBetter({ weight: 77.5, reps: 12 }, { weight: 80, reps: 10 }, false)).toBe(true))
  it('isBetter poids du corps : poids puis reps', () => {
    expect(isBetter({ weight: 10, reps: 5 }, { weight: 0, reps: 30 }, true)).toBe(true)
    expect(isBetter({ weight: 0, reps: 11 }, { weight: 0, reps: 10 }, true)).toBe(true)
    expect(isBetter({ weight: 0, reps: 10 }, { weight: 0, reps: 10 }, true)).toBe(false)
  })
})

describe('weeklySummary', () => {
  const data = base(
    [sess('a', W1), sess('b', W2), sess('c', W3), sess('d', W3)],
    [
      set('a', 'dev', 77.5, 8), set('a', 'dev', 77.5, 8), set('a', 'dev', 77.5, 8),
      set('b', 'dev', 80, 8), set('b', 'squat', 100, 5),
      set('c', 'dev', 80, 10), set('c', 'dev', 80, 10), set('c', 'dev', 80, 10, false),
      set('d', 'dev', 50, 5, false),
    ],
  )
  it('sessionsDone ignore une séance sans série validée', () => {
    const s = weeklySummary(data, '2026-11-16')
    expect(s.sessionsDone).toBe(1)
    expect(s.sessionsPlanned).toBe(3)
  })
  it('setsByGroup : primaryGroup uniquement, 10 clés', () => {
    const s = weeklySummary(data, '2026-11-02')
    expect(s.setsByGroup.pectoraux).toBe(3)
    expect(s.setsByGroup.triceps).toBe(0)
    expect(Object.keys(s.setsByGroup)).toHaveLength(10)
  })
  it('deltas', () => {
    const w1 = weeklySummary(data, '2026-11-02').exercises[0]
    expect(w1.delta).toEqual({ kind: 'new' })
    const w2 = weeklySummary(data, '2026-11-09').exercises.find(e => e.exerciseId === 'dev')!
    expect(w2.delta).toEqual({ kind: 'weight', value: 2.5 })
    const w3 = weeklySummary(data, '2026-11-16').exercises[0]
    expect(w3.delta).toEqual({ kind: 'reps', value: 2 })
    expect(w3.sets).toBe(2)
  })
  it('exercice nouveau dans la semaine affichée => new ; ordre d\'apparition', () => {
    const s = weeklySummary(data, '2026-11-09')
    expect(s.exercises.map(e => e.exerciseId)).toEqual(['dev', 'squat'])
    expect(s.exercises[1].delta).toEqual({ kind: 'new' })
  })
  it('80x10 -> 77.5x12 = same', () => {
    const d = base([sess('a', W1), sess('b', W2)], [set('a', 'dev', 80, 10), set('b', 'dev', 77.5, 12)])
    const e = weeklySummary(d, '2026-11-09').exercises[0]
    expect(e.delta).toEqual({ kind: 'same' })
    expect(e.isRecord).toBe(true)
  })
  it('recordsCount : première séance non record', () => {
    expect(weeklySummary(data, '2026-11-02').recordsCount).toBe(0)
    expect(weeklySummary(data, '2026-11-09').recordsCount).toBe(1)
    expect(weeklySummary(data, '2026-11-16').recordsCount).toBe(1)
  })
  it('stagnantWeeks : 3 semaines same d\'affilée', () => {
    const wk = (i: number) => new Date(2026, 10, 2 + 7 * i, 18)
    const sessions = [0, 1, 2, 3].map(i => sess(`s${i}`, wk(i)))
    const sets = [0, 1, 2, 3].map(i => set(`s${i}`, 'dev', 80, 8))
    const d = base(sessions, sets)
    expect(weeklySummary(d, '2026-11-23').exercises[0].stagnantWeeks).toBe(3)
    expect(weeklySummary(d, '2026-11-02').exercises[0].stagnantWeeks).toBe(0)
  })
  it('exercice retiré du template toujours présent', () => {
    const d = { ...data, templateExercises: [] }
    expect(weeklySummary(d, '2026-11-02').exercises).toHaveLength(1)
  })
  it('semaine vide', () => {
    const s = weeklySummary(data, '2026-10-26')
    expect(s.sessionsDone).toBe(0)
    expect(s.exercises).toEqual([])
  })
})

describe('exerciseSeries', () => {
  it('null pour les semaines sans séance, ordre ancien -> récent', () => {
    const d = base([sess('a', W1), sess('c', W3)], [set('a', 'dev', 80, 8), set('c', 'dev', 80, 10)])
    const s = exerciseSeries(d, 'dev', 4, '2026-11-16')
    expect(s.map(p => p.weekStart)).toEqual(['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16'])
    expect(s.map(p => p.value)).toEqual([null, 101.3, null, 106.7])
  })
  it('poids du corps : reps sans lest, e1RM avec lest', () => {
    const d = base([sess('a', W1), sess('b', W2)], [set('a', 'pompes', 0, 20), set('a', 'pompes', 0, 25), set('b', 'pompes', 10, 12)])
    const s = exerciseSeries(d, 'pompes', 2, '2026-11-09')
    expect(s.map(p => p.value)).toEqual([25, 14])
  })
})
