import { describe, expect, it } from 'vitest'
import { canMoveTo, moveSessionTimes, sessionsByDay, sessionSummaries } from './sessionLog'
import type { AppData, Session, SetLog } from './types'

const at = (m: number, d: number, h = 10) => new Date(2026, m - 1, d, h, 0).toISOString()
const sess = (id: string, startedAt: string, over: Partial<Session> = {}): Session => ({ id, templateId: 't1', startedAt, endedAt: startedAt, ...over })
const set = (sessionId: string, exerciseId: string, i: number, done = true): SetLog => ({
  id: `${sessionId}-${exerciseId}-${i}`, sessionId, exerciseId, templateExerciseId: null, setIndex: i, plannedWeight: null, plannedReps: null, weight: 50, reps: 10, done,
})
const data = (sessions: Session[], sets: SetLog[]): AppData => ({
  exercises: [], templates: [{ id: 't1', name: 'Push', rotationOrder: 0 }], templateExercises: [], sessions, sets,
})

describe('sessionSummaries', () => {
  it('trie du plus récent au plus ancien et calcule les compteurs', () => {
    const d = data([sess('a', at(11, 10)), sess('b', at(11, 20))], [
      set('a', 'e1', 0), set('a', 'e1', 1, false), set('a', 'e2', 0),
      set('b', 'e1', 0),
    ])
    const r = sessionSummaries(d)
    expect(r.map((s) => s.id)).toEqual(['b', 'a'])
    expect(r[1]).toMatchObject({ templateName: 'Push', exerciseCount: 2, doneSets: 2, open: false, day: '2026-11-10' })
  })
  it('exerciseCount compte les exercices ayant au moins une série (validée ou non)', () => {
    const r = sessionSummaries(data([sess('a', at(11, 10))], [set('a', 'e1', 0, false), set('a', 'e2', 0)]))
    expect(r[0]).toMatchObject({ exerciseCount: 2, doneSets: 1 })
  })
  it('séance ouverte sans série validée exclue, avec série validée incluse', () => {
    const open = sess('o', at(11, 22), { endedAt: null })
    expect(sessionSummaries(data([open], [set('o', 'e1', 0, false)]))).toHaveLength(0)
    const r = sessionSummaries(data([open], [set('o', 'e1', 0)]))
    expect(r).toHaveLength(1)
    expect(r[0].open).toBe(true)
  })
  it('séance terminée sans série (oubliée) incluse', () => {
    expect(sessionSummaries(data([sess('a', at(11, 10))], []))).toHaveLength(1)
  })
  it('modèle supprimé : « Séance »', () => {
    const d = data([sess('a', at(11, 10), { templateId: 'gone' })], [])
    expect(sessionSummaries(d)[0].templateName).toBe('Séance')
  })
})

describe('sessionsByDay', () => {
  it('regroupe par jour et ignore les jours hors mois', () => {
    const d = data([sess('a', at(11, 10, 8)), sess('b', at(11, 10, 18)), sess('c', at(10, 30)), sess('d', at(12, 1))], [])
    const r = sessionsByDay(d, '2026-11')
    expect(Object.keys(r)).toEqual(['2026-11-10'])
    expect(r['2026-11-10']).toHaveLength(2)
  })
})

describe('canMoveTo', () => {
  it('refuse le futur', () => {
    expect(canMoveTo('2026-11-24', '2026-11-23')).toBe(false)
    expect(canMoveTo('2026-11-23', '2026-11-23')).toBe(true)
    expect(canMoveTo('2026-11-01', '2026-11-23')).toBe(true)
  })
})

describe('moveSessionTimes', () => {
  const L = (m: number, d: number, h: number, mi: number) => new Date(m - 1 === 10 ? 2026 : 2026, m - 1, d, h, mi).toISOString()
  it('séance franchissant minuit : durée et heures conservées', () => {
    const r = moveSessionTimes({ startedAt: L(11, 22, 23, 30), endedAt: L(11, 23, 0, 45) }, '2026-11-20')
    expect(r).toEqual({ startedAt: L(11, 20, 23, 30), endedAt: L(11, 21, 0, 45) })
  })
  it('à travers le changement d\'heure (29/03/2026)', () => {
    const r = moveSessionTimes({ startedAt: L(3, 31, 23, 30), endedAt: L(4, 1, 0, 45) }, '2026-03-27')
    expect(r).toEqual({ startedAt: L(3, 27, 23, 30), endedAt: L(3, 28, 0, 45) })
  })
  it('endedAt null reste null', () => {
    expect(moveSessionTimes({ startedAt: L(11, 22, 10, 0), endedAt: null }, '2026-11-20').endedAt).toBeNull()
  })
})
