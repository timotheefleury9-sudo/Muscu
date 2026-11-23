import { describe, it, expect } from 'vitest'
import type { AppData, Exercise, SetLog, Session } from './types'
import { recentSessionLogs } from './exerciseLog'

const ex = (id: string, bodyweight = false): Exercise => ({
  id, name: id, primaryGroup: 'pectoraux', secondaryGroups: [], equipment: 'x', kind: 'compound', increment: 2.5, bodyweight, custom: false,
})
const sess = (id: string, d: Date): Session => ({ id, templateId: 't', startedAt: d.toISOString(), endedAt: null })
let n = 0
const set = (sessionId: string, exerciseId: string, setIndex: number, weight: number, reps: number, done = true): SetLog => ({
  id: `s${n++}`, sessionId, exerciseId, templateExerciseId: null, setIndex, plannedWeight: null, plannedReps: null, weight, reps, done,
})
const data = (sessions: Session[], sets: SetLog[]): AppData => ({
  exercises: [ex('dev'), ex('pompes', true)], templates: [], templateExercises: [], sessions, sets,
})

describe('recentSessionLogs', () => {
  const d = data(
    [sess('a', new Date(2026, 10, 3, 18)), sess('b', new Date(2026, 10, 10, 18)), sess('c', new Date(2026, 10, 17, 18)), sess('e', new Date(2026, 10, 19, 18))],
    [
      // Stockage dans le désordre : l'ordre doit venir de setIndex.
      set('c', 'dev', 2, 75, 10), set('c', 'dev', 0, 77.5, 12), set('c', 'dev', 1, 77.5, 11),
      set('a', 'dev', 0, 70, 12), set('a', 'dev', 1, 72.5, 10, false),
      set('b', 'dev', 0, 75, 8, false),
      set('e', 'pompes', 0, 0, 12),
    ],
  )
  it('séances avec séries validées uniquement, plus récente en premier, séries par setIndex', () => {
    expect(recentSessionLogs(d, 'dev', 6)).toEqual([
      { sessionId: 'c', startedAt: new Date(2026, 10, 17, 18).toISOString(), sets: [{ weight: 77.5, reps: 12 }, { weight: 77.5, reps: 11 }, { weight: 75, reps: 10 }], topIndex: 0 },
      { sessionId: 'a', startedAt: new Date(2026, 10, 3, 18).toISOString(), sets: [{ weight: 70, reps: 12 }], topIndex: 0 },
    ])
  })
  it('limite le nombre de séances', () => {
    expect(recentSessionLogs(d, 'dev', 1).map(l => l.sessionId)).toEqual(['c'])
  })
  it('topIndex = série la plus lourde (à poids égal, plus de reps)', () => {
    const d2 = data([sess('a', new Date(2026, 10, 3, 18))], [set('a', 'dev', 0, 60, 12), set('a', 'dev', 1, 65, 8), set('a', 'dev', 2, 65, 9), set('a', 'dev', 3, 60, 10)])
    expect(recentSessionLogs(d2, 'dev', 6)[0].topIndex).toBe(2)
    const d3 = data([sess('a', new Date(2026, 10, 3, 18))], [set('a', 'pompes', 0, 0, 12), set('a', 'pompes', 1, 0, 14), set('a', 'pompes', 2, 0, 10)])
    expect(recentSessionLogs(d3, 'pompes', 6)[0].topIndex).toBe(1)
  })
  it('aucune séance => []', () => {
    expect(recentSessionLogs(d, 'squat', 6)).toEqual([])
  })
})
