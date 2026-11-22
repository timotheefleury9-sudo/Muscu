import type { Exercise } from './types'

export interface PerformedSet { weight: number; reps: number }
/** Séries validées seulement, dans l'ordre ; une séance sans série validée n'apparaît pas. */
export interface ExerciseResult { date: string; sets: PerformedSet[] }
export interface Slot { sets: number; repsMin: number; repsMax: number }
export type Suggestion =
  | { kind: 'none' }
  | { kind: 'add-load' }
  | { kind: 'sets'; reason: 'increase' | 'repeat' | 'deload'; sets: PerformedSet[] }

const DELOAD_AFTER = 3
// Les calculs de charge se font en centièmes entiers pour éviter les artefacts flottants.
const toH = (kg: number): number => Math.round(kg * 100)
const fromH = (h: number): number => h / 100

export function referenceWeight(r: ExerciseResult): number {
  return r.sets[0].weight
}

export function isFailure(r: ExerciseResult, slot: Slot): boolean {
  return r.sets.slice(0, slot.sets).some(s => s.reps < slot.repsMin)
}

function uniform(weight: number, reps: number, n: number): PerformedSet[] {
  return Array.from({ length: n }, () => ({ weight, reps }))
}

export function suggestNext(
  history: ExerciseResult[],
  slot: Slot,
  ex: Pick<Exercise, 'increment' | 'bodyweight'>,
): Suggestion {
  const last = history[history.length - 1]
  if (!last || last.sets.length === 0) return { kind: 'none' }

  const ref = referenceWeight(last)
  const refH = toH(ref)
  const incH = toH(ex.increment)
  const head = last.sets.slice(0, slot.sets)

  // Hausse de charge
  if (head.length >= slot.sets && head.every(s => toH(s.weight) === refH && s.reps >= slot.repsMax)) {
    if (ex.bodyweight && refH === 0) return { kind: 'add-load' }
    return { kind: 'sets', reason: 'increase', sets: uniform(fromH(refH + incH), slot.repsMin, slot.sets) }
  }

  // Baisse de charge après 3 échecs consécutifs au même poids de référence
  let streak = 0
  for (let i = history.length - 1; i >= 0; i--) {
    const r = history[i]
    if (r.sets.length === 0 || toH(referenceWeight(r)) !== refH || !isFailure(r, slot)) break
    streak++
  }
  if (streak >= DELOAD_AFTER && refH > 0 && incH > 0) {
    const targetH = Math.floor((refH * 9) / (10 * incH)) * incH
    if ((targetH > 0 || ex.bodyweight) && targetH < refH) {
      return { kind: 'sets', reason: 'deload', sets: uniform(fromH(targetH), slot.repsMin, slot.sets) }
    }
  }

  // Reconduction
  const repeat: PerformedSet[] = Array.from({ length: slot.sets }, (_, i) => ({
    weight: fromH(refH),
    reps: last.sets[i]?.reps ?? slot.repsMin,
  }))
  return { kind: 'sets', reason: 'repeat', sets: repeat }
}
