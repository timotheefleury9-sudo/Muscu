import { describe, expect, it } from 'vitest'
import { appendedSet, blankSetsFor, canMoveTo, dayFromParam, nonEmptyTemplates, moveSessionTimes, sessionExercises, sessionsByDay, sessionSummaries } from './sessionLog'
import type { AppData, Session, SetLog, TemplateExercise } from './types'

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

describe('sessionExercises', () => {
  const te = (id: string, order: number): TemplateExercise => ({ id, templateId: 't1', exerciseId: id, order, sets: 3, repsMin: 8, repsMax: 12, restSec: 90 })
  const s = (exerciseId: string, setIndex: number, templateExerciseId: string | null = null): SetLog => ({
    ...set('a', exerciseId, setIndex), templateExerciseId,
  })
  it('ordre du template, puis exercices hors template par premier setIndex ; séries par setIndex', () => {
    const r = sessionExercises([
      s('x', 7), s('b', 1, 'b'), s('y', 4), s('a', 2, 'a'), s('b', 0, 'b'), s('a', 0, 'a'), s('y', 5),
    ], [te('a', 0), te('b', 1)])
    expect(r.map((g) => g.exerciseId)).toEqual(['a', 'b', 'y', 'x'])
    expect(r[0].sets.map((x) => x.setIndex)).toEqual([0, 2])
  })
  it('ligne de template supprimée : rangé avec les exercices hors template', () => {
    const r = sessionExercises([s('gone', 0, 'gone'), s('a', 3, 'a'), s('z', 1)], [te('a', 0)])
    expect(r.map((g) => g.exerciseId)).toEqual(['a', 'gone', 'z'])
  })
  it('aucune série : liste vide', () => {
    expect(sessionExercises([], [])).toEqual([])
  })
})

describe('appendedSet', () => {
  const base = (exerciseId: string, setIndex: number, weight: number, reps: number, over: Partial<SetLog> = {}): SetLog => ({
    ...set('a', exerciseId, setIndex), weight, reps, plannedWeight: weight, plannedReps: reps, templateExerciseId: `te-${exerciseId}`, ...over,
  })
  it('copie poids et répétitions de la dernière série de l\'exercice, non validée, sans valeurs prévues', () => {
    const r = appendedSet([base('e1', 0, 80, 10), base('e1', 2, 82.5, 8), base('e2', 5, 20, 12)], 'a', 'e1', 'new')
    expect(r).toEqual({
      id: 'new', sessionId: 'a', exerciseId: 'e1', templateExerciseId: 'te-e1', setIndex: 3,
      plannedWeight: null, plannedReps: null, weight: 82.5, reps: 8, done: false,
    })
  })
  it('exercice absent de la séance : 0/0, hors template, après toutes les séries', () => {
    const r = appendedSet([base('e1', 0, 80, 10), base('e2', 5, 20, 12)], 'a', 'e3', 'new')
    expect(r).toMatchObject({ exerciseId: 'e3', templateExerciseId: null, setIndex: 6, weight: 0, reps: 0, done: false })
  })
  it('séance vide : setIndex 0', () => {
    expect(appendedSet([], 'a', 'e1', 'new').setIndex).toBe(0)
  })
})

describe('dayFromParam', () => {
  it('jour valide conservé, mal formé ou inexistant → aujourd\'hui, futur conservé (refusé à l\'envoi)', () => {
    expect(dayFromParam('2026-11-10', '2026-11-23')).toBe('2026-11-10')
    expect(dayFromParam(null, '2026-11-23')).toBe('2026-11-23')
    expect(dayFromParam('hier', '2026-11-23')).toBe('2026-11-23')
    expect(dayFromParam('2026-02-30', '2026-11-23')).toBe('2026-11-23')
    expect(dayFromParam('2026-13-01', '2026-11-23')).toBe('2026-11-23')
    expect(dayFromParam('2026-12-01', '2026-11-23')).toBe('2026-12-01')
  })
})

describe('blankSetsFor', () => {
  const te = (id: string, exerciseId: string, order: number, sets: number): TemplateExercise =>
    ({ id, templateId: 't1', exerciseId, order, sets, repsMin: 8, repsMax: 12, restSec: 90 })
  it('séries vides par exercice, dans l\'ordre du programme', () => {
    const out = blankSetsFor([te('b', 'B', 1, 2), te('a', 'A', 0, 3)])
    expect(out.map((s) => [s.exerciseId, s.setIndex, s.templateExerciseId])).toEqual([
      ['A', 0, 'a'], ['A', 1, 'a'], ['A', 2, 'a'], ['B', 0, 'b'], ['B', 1, 'b'],
    ])
    expect(out.every((s) => s.weight === 0 && s.reps === 0 && !s.done && s.plannedWeight === null && s.plannedReps === null)).toBe(true)
    expect(new Set(out.map((s) => s.id)).size).toBe(5)
  })
})

describe('nonEmptyTemplates', () => {
  it('programmes avec au moins un exercice, dans l\'ordre de rotation', () => {
    const t = (id: string, rotationOrder: number) => ({ id, name: id, rotationOrder })
    const out = nonEmptyTemplates([t('c', 2), t('a', 0), t('b', 1)], [{ templateId: 'c' }, { templateId: 'a' }, { templateId: 'a' }])
    expect(out.map((x) => x.id)).toEqual(['a', 'c'])
  })
})
