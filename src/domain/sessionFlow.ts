import { formatWeight } from './parseWeight'
import type { ExerciseResult, Slot, Suggestion } from './progression'
import type { SetLog } from './types'

export const ADD_LOAD_HINT = 'Fourchette atteinte : ajoute du lest ou passe à une variante'

export type PlannedValues = Pick<SetLog, 'plannedWeight' | 'plannedReps' | 'weight' | 'reps'>

/** Valeurs de départ des séries d'un exercice à partir de la proposition (prévu copié dans le réel). */
export function plannedSets(suggestion: Suggestion, slot: Slot, history: ExerciseResult[]): PlannedValues[] {
  if (suggestion.kind === 'sets') {
    return suggestion.sets.map((s) => ({ plannedWeight: s.weight, plannedReps: s.reps, weight: s.weight, reps: s.reps }))
  }
  if (suggestion.kind === 'add-load') {
    const last = history[history.length - 1]
    return Array.from({ length: slot.sets }, (_, i) => {
      const reps = last?.sets[i]?.reps ?? last?.sets[0]?.reps ?? slot.repsMax
      return { plannedWeight: 0, plannedReps: reps, weight: 0, reps }
    })
  }
  return Array.from({ length: slot.sets }, () => ({ plannedWeight: null, plannedReps: null, weight: 0, reps: 0 }))
}

/** Champs encore à remplir : pas de valeur prévue et rien de saisi. Au poids du corps, un lest à 0 est une valeur. */
export function isBlank(s: SetLog, bodyweight = false): { weight: boolean; reps: boolean } {
  return {
    weight: !bodyweight && !s.done && s.plannedWeight === null && s.weight === 0,
    reps: !s.done && s.plannedReps === null && s.reps === 0,
  }
}

/** Après validation d'une série, recopie ses valeurs dans les séries suivantes encore entièrement vides. */
export function propagateValues(sets: SetLog[], from: number): SetLog[] {
  const src = sets[from]
  return sets.map((s, i) => {
    if (i <= from) return s
    const b = isBlank(s)
    return b.weight && b.reps ? { ...s, weight: src.weight, reps: src.reps } : s
  })
}

export function stepWeight(weight: number, increment: number, dir: 1 | -1): number {
  return Math.max(0, Math.round(weight * 100) + dir * Math.round(increment * 100)) / 100
}

export function isExerciseComplete(sets: Pick<SetLog, 'done'>[]): boolean {
  return sets.length > 0 && sets.every((s) => s.done)
}

/** Prochain exercice non terminé après `from`, en bouclant ; -1 s'il n'en reste aucun. */
export function nextUnfinished(complete: boolean[], from: number): number {
  for (let k = 1; k <= complete.length; k++) {
    const j = (from + k) % complete.length
    if (j !== from && !complete[j]) return j
  }
  return -1
}

export interface Hint { tone: 'neutral' | 'up' | 'warn'; before: string; strong: string; after: string }

/** Encadré d'aide de l'exercice actif ; null quand il n'apporterait rien (poids inconnu). */
export function sessionHint(args: { suggestion: Suggestion; slot: Slot; increment: number; sets: SetLog[] }): Hint | null {
  const { suggestion, slot, increment, sets } = args
  const first = sets[0]
  if (!first || isBlank(first).weight) return null
  const refH = Math.round(first.weight * 100)
  const planned = sets.slice(0, slot.sets)
  const allMax = planned.length === slot.sets && planned.every((s) => s.done && s.reps >= slot.repsMax && Math.round(s.weight * 100) === refH)

  if (refH === 0) {
    if (allMax) return { tone: 'up', before: '', strong: ADD_LOAD_HINT, after: '' }
    if (suggestion.kind === 'add-load') return { tone: 'neutral', before: '', strong: ADD_LOAD_HINT, after: '' }
    return null
  }
  const next = `Prochaine charge : ${formatWeight((refH + Math.round(increment * 100)) / 100)} kg`
  if (allMax) return { tone: 'up', before: 'Fourchette atteinte. ', strong: next, after: ` à ${slot.repsMin} répétitions.` }
  if (suggestion.kind === 'sets' && suggestion.reason === 'deload') {
    return { tone: 'warn', before: '', strong: 'Charge allégée de 10 %', after: ' après 3 séances sous la fourchette.' }
  }
  return { tone: 'neutral', before: '', strong: next, after: ` quand les ${slot.sets} séries atteignent ${slot.repsMax} répétitions.` }
}
