import { describe, expect, it } from 'vitest'
import { buildHistory } from './history'
import type { AppData, Session, SetLog } from './types'

const session = (id: string, startedAt: string, endedAt: string | null = startedAt): Session => ({ id, templateId: 't', startedAt, endedAt })
const set = (sessionId: string, setIndex: number, weight: number, reps: number, done = true, exerciseId = 'e1'): SetLog => ({
  id: `${sessionId}-${exerciseId}-${setIndex}`, sessionId, exerciseId, templateExerciseId: null, setIndex,
  plannedWeight: null, plannedReps: null, weight, reps, done,
})
const data = (sessions: Session[], sets: SetLog[]): AppData => ({ exercises: [], templates: [], templateExercises: [], sessions, sets })

describe('buildHistory', () => {
  it('groupe les séries validées par séance, séances par date croissante, séries par setIndex', () => {
    const d = data(
      [session('b', '2026-11-20T10:00:00.000Z'), session('a', '2026-11-18T10:00:00.000Z')],
      [set('b', 1, 82.5, 9), set('b', 0, 82.5, 10), set('a', 0, 80, 12), set('a', 2, 80, 11), set('a', 1, 80, 12)],
    )
    expect(buildHistory(d, 'e1')).toEqual([
      { date: '2026-11-18T10:00:00.000Z', sets: [{ weight: 80, reps: 12 }, { weight: 80, reps: 12 }, { weight: 80, reps: 11 }] },
      { date: '2026-11-20T10:00:00.000Z', sets: [{ weight: 82.5, reps: 10 }, { weight: 82.5, reps: 9 }] },
    ])
  })

  it('ignore les séries non validées, les autres exercices et les séances sans série validée', () => {
    const d = data(
      [session('a', '2026-11-18T10:00:00.000Z'), session('b', '2026-11-20T10:00:00.000Z')],
      [set('a', 0, 80, 12), set('a', 1, 80, 3, false), set('a', 0, 50, 10, true, 'e2'), set('b', 0, 85, 8, false)],
    )
    expect(buildHistory(d, 'e1')).toEqual([{ date: '2026-11-18T10:00:00.000Z', sets: [{ weight: 80, reps: 12 }] }])
  })

  it('exclut la séance indiquée (séance en cours)', () => {
    const d = data(
      [session('a', '2026-11-18T10:00:00.000Z'), session('open', '2026-11-22T10:00:00.000Z', null)],
      [set('a', 0, 80, 12), set('open', 0, 82.5, 8)],
    )
    expect(buildHistory(d, 'e1', 'open')).toEqual([{ date: '2026-11-18T10:00:00.000Z', sets: [{ weight: 80, reps: 12 }] }])
    expect(buildHistory(d, 'e1')).toHaveLength(2)
  })
})
