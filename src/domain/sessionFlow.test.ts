import { describe, expect, it } from 'vitest'
import { ADD_LOAD_HINT, hasValidatedSet, isBlank, isExerciseComplete, nextUnfinished, plannedSets, propagateValues, sessionHint, stepWeight } from './sessionFlow'
import type { Suggestion } from './progression'
import type { SetLog } from './types'

const slot = { sets: 3, repsMin: 8, repsMax: 12 }
const log = (over: Partial<SetLog> = {}): SetLog => ({
  id: crypto.randomUUID(), sessionId: 's', exerciseId: 'e', templateExerciseId: 'te', setIndex: 0,
  plannedWeight: 80, plannedReps: 12, weight: 80, reps: 12, done: false, ...over,
})

describe('plannedSets', () => {
  it('copie la proposition dans le prévu et le réel', () => {
    expect(plannedSets({ kind: 'sets', reason: 'increase', sets: [{ weight: 82.5, reps: 8 }, { weight: 82.5, reps: 8 }] }, slot, [])).toEqual([
      { plannedWeight: 82.5, plannedReps: 8, weight: 82.5, reps: 8 },
      { plannedWeight: 82.5, plannedReps: 8, weight: 82.5, reps: 8 },
    ])
  })
  it('sans historique : séries vides', () => {
    expect(plannedSets({ kind: 'none' }, slot, [])).toEqual(
      Array.from({ length: 3 }, () => ({ plannedWeight: null, plannedReps: null, weight: 0, reps: 0 })),
    )
  })
  it('add-load : lest à 0, répétitions de la dernière séance', () => {
    const history = [{ date: 'd', sets: [{ weight: 0, reps: 12 }, { weight: 0, reps: 13 }] }]
    expect(plannedSets({ kind: 'add-load' }, slot, history)).toEqual([
      { plannedWeight: 0, plannedReps: 12, weight: 0, reps: 12 },
      { plannedWeight: 0, plannedReps: 13, weight: 0, reps: 13 },
      { plannedWeight: 0, plannedReps: 12, weight: 0, reps: 12 },
    ])
  })
})

describe('isBlank', () => {
  it('vide seulement sans prévu et sans valeur saisie', () => {
    expect(isBlank(log({ plannedWeight: null, plannedReps: null, weight: 0, reps: 0 }))).toEqual({ weight: true, reps: true })
    expect(isBlank(log({ plannedWeight: null, plannedReps: null, weight: 40, reps: 0 }))).toEqual({ weight: false, reps: true })
    expect(isBlank(log({ plannedWeight: 0, plannedReps: 12, weight: 0, reps: 12 }))).toEqual({ weight: false, reps: false })
    expect(isBlank(log({ plannedWeight: null, plannedReps: null, weight: 0, reps: 10, done: true }))).toEqual({ weight: false, reps: false })
  })
  it('poids du corps : un lest à 0 est une valeur, jamais un champ vide', () => {
    expect(isBlank(log({ plannedWeight: null, plannedReps: null, weight: 0, reps: 0 }), true)).toEqual({ weight: false, reps: true })
  })
})

describe('propagateValues', () => {
  it('recopie poids et reps dans les séries suivantes encore vides', () => {
    const blank = { plannedWeight: null, plannedReps: null, weight: 0, reps: 0 }
    const sets = [log({ ...blank, weight: 40, reps: 10, done: true }), log(blank), log({ ...blank, weight: 35 })]
    const out = propagateValues(sets, 0)
    expect(out.map((s) => [s.weight, s.reps])).toEqual([[40, 10], [40, 10], [35, 0]])
    expect(out[2]).toBe(sets[2])
  })
})

describe('stepWeight', () => {
  it("ajoute ou retire l'incrément sans flottant parasite et sans descendre sous 0", () => {
    expect(stepWeight(77.5, 2.5, 1)).toBe(80)
    expect(stepWeight(0.3, 0.1, 1)).toBe(0.4)
    expect(stepWeight(1, 2, -1)).toBe(0)
  })
})

describe('isExerciseComplete / nextUnfinished', () => {
  it('complet si toutes les séries sont validées (au moins une)', () => {
    expect(isExerciseComplete([])).toBe(false)
    expect(isExerciseComplete([log({ done: true }), log({ done: false })])).toBe(false)
    expect(isExerciseComplete([log({ done: true })])).toBe(true)
  })
  it('cherche le prochain exercice non terminé, en bouclant', () => {
    expect(nextUnfinished([true, false, false], 1)).toBe(2)
    expect(nextUnfinished([false, true, false, true], 2)).toBe(0)
    expect(nextUnfinished([true, false, true], 1)).toBe(-1)
  })
})

describe('sessionHint', () => {
  const repeat: Suggestion = { kind: 'sets', reason: 'repeat', sets: [] }
  const base = { slot, increment: 2.5, suggestion: repeat }
  it('prochaine charge tant que la fourchette n’est pas atteinte', () => {
    const sets = [log({ done: true }), log({ reps: 10 }), log()]
    expect(sessionHint({ ...base, sets })).toEqual({
      tone: 'neutral', before: '', strong: 'Prochaine charge : 82,5 kg', after: ' quand les 3 séries atteignent 12 répétitions.',
    })
  })
  it('vert quand les séries prévues sont validées au max', () => {
    const sets = [log({ done: true }), log({ done: true, reps: 13 }), log({ done: true }), log({ weight: 60, reps: 5 })]
    expect(sessionHint({ ...base, sets })).toEqual({
      tone: 'up', before: 'Fourchette atteinte. ', strong: 'Prochaine charge : 82,5 kg', after: ' à 8 répétitions.',
    })
  })
  it('rien sans poids connu', () => {
    const blank = { plannedWeight: null, plannedReps: null, weight: 0, reps: 0 }
    expect(sessionHint({ ...base, suggestion: { kind: 'none' }, sets: [log(blank), log(blank), log(blank)] })).toBeNull()
    expect(sessionHint({ ...base, sets: [] })).toBeNull()
  })
  it('add-load : message dédié tant que le lest est à 0', () => {
    const sets = [log({ weight: 0, plannedWeight: 0 }), log({ weight: 0, plannedWeight: 0 }), log({ weight: 0, plannedWeight: 0 })]
    expect(sessionHint({ ...base, suggestion: { kind: 'add-load' }, sets })).toEqual({ tone: 'neutral', before: '', strong: ADD_LOAD_HINT, after: '' })
    expect(ADD_LOAD_HINT).toBe('Fourchette atteinte : ajoute du lest ou passe à une variante')
  })
  it('poids du corps sans lest : message dédié en vert quand la fourchette est atteinte, rien avant', () => {
    const bw = (done: boolean) => log({ weight: 0, plannedWeight: 0, done })
    expect(sessionHint({ ...base, sets: [bw(true), bw(true), bw(false)] })).toBeNull()
    expect(sessionHint({ ...base, sets: [bw(true), bw(true), bw(true)] })).toEqual({ tone: 'up', before: '', strong: ADD_LOAD_HINT, after: '' })
  })
  it('baisse de charge : explique la baisse', () => {
    const sets = [log({ weight: 72.5 }), log({ weight: 72.5 }), log({ weight: 72.5 })]
    expect(sessionHint({ ...base, suggestion: { kind: 'sets', reason: 'deload', sets: [] }, sets })).toEqual({
      tone: 'warn', before: '', strong: 'Charge allégée de 10 %', after: ' après 3 séances sous la fourchette.',
    })
  })
})

describe('hasValidatedSet', () => {
  it('vrai seulement si une série de cette séance est validée', () => {
    const sets = [{ sessionId: 'a', done: false }, { sessionId: 'b', done: true }]
    expect(hasValidatedSet(sets, 'a')).toBe(false)
    expect(hasValidatedSet(sets, 'b')).toBe(true)
    expect(hasValidatedSet([], 'a')).toBe(false)
  })
})
