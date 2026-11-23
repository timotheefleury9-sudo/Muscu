import { describe, it, expect } from 'vitest'
import { suggestNext, isFailure, referenceWeight, type ExerciseResult, type Slot, type PerformedSet } from './progression'

const slot: Slot = { sets: 3, repsMin: 8, repsMax: 12 }
const ex = { increment: 2.5, bodyweight: false }
const bw = { increment: 2.5, bodyweight: true }
const S = (weight: number, reps: number): PerformedSet => ({ weight, reps })
const sess = (...sets: PerformedSet[]): ExerciseResult => ({ date: '2026-01-01', sets })
const three = (w: number, r: number) => sess(S(w, r), S(w, r), S(w, r))
const fail = (w: number) => sess(S(w, 8), S(w, 8), S(w, 7))
const sets = (w: number, r: number, n = 3) => Array.from({ length: n }, () => S(w, r))

describe('referenceWeight / isFailure', () => {
  it('reference = poids de la 1re série', () => {
    expect(referenceWeight(sess(S(80, 10), S(70, 10)))).toBe(80)
  })
  it('échec si une des séries du slot est sous repsMin', () => {
    expect(isFailure(fail(80), slot)).toBe(true)
    expect(isFailure(three(80, 8), slot)).toBe(false)
  })
  it('les séries au-delà du slot sont ignorées pour l\'échec', () => {
    expect(isFailure(sess(S(80, 8), S(80, 8), S(80, 8), S(60, 3)), slot)).toBe(false)
  })
})

describe('suggestNext', () => {
  it('none si historique vide', () => {
    expect(suggestNext([], slot, ex)).toEqual({ kind: 'none' })
  })
  it('increase', () => {
    expect(suggestNext([three(80, 12)], slot, ex)).toEqual({ kind: 'sets', reason: 'increase', sets: sets(82.5, 8) })
  })
  it('repeat', () => {
    expect(suggestNext([sess(S(80, 12), S(80, 11), S(80, 10))], slot, ex)).toEqual({
      kind: 'sets', reason: 'repeat', sets: [S(80, 12), S(80, 11), S(80, 10)],
    })
  })
  it('repeat avec série manquante', () => {
    expect(suggestNext([sess(S(80, 12), S(80, 12))], slot, ex)).toEqual({
      kind: 'sets', reason: 'repeat', sets: [S(80, 12), S(80, 12), S(80, 8)],
    })
  })
  it('le réel prime sur le prévu', () => {
    expect(suggestNext([three(80, 10), three(85, 12)], slot, ex)).toEqual({ kind: 'sets', reason: 'increase', sets: sets(87.5, 8) })
  })
  it('séries en plus ignorées', () => {
    const r = sess(S(80, 12), S(80, 12), S(80, 12), S(60, 6))
    expect(suggestNext([r], slot, ex)).toEqual({ kind: 'sets', reason: 'increase', sets: sets(82.5, 8) })
  })
  it('pas de hausse si une série est à un autre poids', () => {
    const r = sess(S(80, 12), S(77.5, 12), S(80, 12))
    expect(suggestNext([r], slot, ex)).toMatchObject({ reason: 'repeat' })
  })
  it('deload après 3 échecs au même poids', () => {
    expect(suggestNext([fail(80), fail(80), fail(80)], slot, ex)).toEqual({ kind: 'sets', reason: 'deload', sets: sets(70, 8) })
  })
  it('pas de baisse après 2 échecs', () => {
    expect(suggestNext([fail(80), fail(80)], slot, ex)).toMatchObject({ reason: 'repeat' })
  })
  it('reset : échec, échec, réussite, échec', () => {
    expect(suggestNext([fail(80), fail(80), three(80, 8), fail(80)], slot, ex)).toMatchObject({ reason: 'repeat' })
  })
  it('reset par changement de poids', () => {
    expect(suggestNext([fail(77.5), fail(77.5), fail(80)], slot, ex)).toMatchObject({ reason: 'repeat' })
  })
  it('après une baisse : échec à 70 → repeat', () => {
    const r = suggestNext([fail(80), fail(80), fail(80), fail(70)], slot, ex)
    expect(r).toMatchObject({ kind: 'sets', reason: 'repeat' })
    expect((r as { sets: PerformedSet[] }).sets.every(s => s.weight === 70)).toBe(true)
  })
  it('4 échecs consécutifs : deload encore', () => {
    expect(suggestNext([fail(80), fail(80), fail(80), fail(80)], slot, ex)).toMatchObject({ reason: 'deload' })
  })
  it('haltères (incrément 2)', () => {
    expect(suggestNext([three(24, 12)], slot, { increment: 2, bodyweight: false })).toEqual({ kind: 'sets', reason: 'increase', sets: sets(26, 8) })
  })
  it('arithmétique exacte (77,5 + 2,5 ; 0,1 + 0,2)', () => {
    expect(suggestNext([three(77.5, 12)], slot, ex)).toMatchObject({ sets: sets(80, 8) })
    expect(suggestNext([three(0.1, 12)], slot, { increment: 0.2, bodyweight: false })).toMatchObject({ sets: sets(0.3, 8) })
  })
  it('poids du corps : add-load', () => {
    expect(suggestNext([three(0, 12)], slot, bw)).toEqual({ kind: 'add-load' })
  })
  it('poids du corps : 0×7 ×3 séances → repeat, pas de baisse', () => {
    const r = three(0, 7)
    expect(suggestNext([r, r, r], slot, bw)).toEqual({ kind: 'sets', reason: 'repeat', sets: sets(0, 7) })
  })
  it('poids du corps : fourchette non atteinte → repeat', () => {
    expect(suggestNext([three(0, 10)], slot, bw)).toMatchObject({ reason: 'repeat' })
  })
  it('poids du corps lesté', () => {
    expect(suggestNext([three(5, 12)], slot, bw)).toEqual({ kind: 'sets', reason: 'increase', sets: sets(7.5, 8) })
  })
  it('changement de fourchette → increase', () => {
    expect(suggestNext([three(80, 10)], { sets: 3, repsMin: 6, repsMax: 10 }, ex)).toMatchObject({ reason: 'increase', sets: sets(82.5, 6) })
  })
  it('baisse qui arrondirait à 0 → repeat (jamais de charge 0)', () => {
    const f = (w: number) => sess(S(w, 7), S(w, 7), S(w, 7))
    expect(suggestNext([f(2), f(2), f(2)], slot, ex)).toMatchObject({ reason: 'repeat' })
  })
  it('poids du corps lesté 2,5 kg, 3 échecs → deload à 0 kg', () => {
    const f = three(2.5, 7)
    expect(suggestNext([f, f, f], slot, bw)).toEqual({ kind: 'sets', reason: 'deload', sets: sets(0, 8) })
  })
})
