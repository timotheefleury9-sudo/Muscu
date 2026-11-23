import { parseWeight } from './parseWeight'
import type { Exercise, MuscleGroup, TemplateExercise, WorkoutTemplate } from './types'

/** Réglages d'un exercice dans un programme. */
export type Slot = Pick<TemplateExercise, 'sets' | 'repsMin' | 'repsMax' | 'restSec'>
export type SlotErrors = Partial<Record<keyof Slot, string>>

export const SLOT_LIMITS = { setsMin: 1, setsMax: 10, repsMin: 1, restMax: 600, restStep: 15 } as const

const isInt = (n: number) => Number.isInteger(n)

/** Séries 1–10, reps min ≥ 1, reps max ≥ reps min, repos 0–600 s par pas de 15 s. Objet vide si tout est valide. */
export function validateSlot(s: Slot): SlotErrors {
  const e: SlotErrors = {}
  if (!isInt(s.sets) || s.sets < SLOT_LIMITS.setsMin || s.sets > SLOT_LIMITS.setsMax) e.sets = 'Entre 1 et 10 séries.'
  if (!isInt(s.repsMin) || s.repsMin < SLOT_LIMITS.repsMin) e.repsMin = 'Au moins 1 répétition.'
  if (!isInt(s.repsMax) || s.repsMax < Math.max(SLOT_LIMITS.repsMin, isInt(s.repsMin) ? s.repsMin : 1)) {
    e.repsMax = 'Le maximum doit être au moins égal au minimum.'
  }
  if (!isInt(s.restSec) || s.restSec < 0 || s.restSec > SLOT_LIMITS.restMax || s.restSec % SLOT_LIMITS.restStep !== 0) {
    e.restSec = 'Repos de 0 à 600 s, par pas de 15 s.'
  }
  return e
}

const STEP: Record<keyof Slot, number> = { sets: 1, repsMin: 1, repsMax: 1, restSec: SLOT_LIMITS.restStep }

function slotBounds(f: keyof Slot, s: Slot): [number, number] {
  switch (f) {
    case 'sets': return [SLOT_LIMITS.setsMin, SLOT_LIMITS.setsMax]
    case 'restSec': return [0, SLOT_LIMITS.restMax]
    case 'repsMin': return [SLOT_LIMITS.repsMin, Math.max(SLOT_LIMITS.repsMin, s.repsMax)]
    case 'repsMax': return [Math.max(SLOT_LIMITS.repsMin, s.repsMin), Infinity]
  }
}

/** Valeur après un appui sur +/− : cran suivant aligné sur le pas (100 s → 105 s ou 90 s), sans jamais franchir les bornes. */
export function stepSlot(s: Slot, f: keyof Slot, dir: 1 | -1): number {
  const by = STEP[f]
  const next = dir > 0 ? (Math.floor(s[f] / by) + 1) * by : (Math.ceil(s[f] / by) - 1) * by
  const [lo, hi] = slotBounds(f, s)
  return Math.min(hi, Math.max(lo, next))
}

/** Un appui sur +/− changerait-il la valeur ? */
export const canStep = (s: Slot, f: keyof Slot, dir: 1 | -1): boolean => stepSlot(s, f, dir) !== s[f]

/** Réglages proposés à l'ajout d'un exercice (mêmes valeurs que le programme initial). */
export function defaultSlot(ex: Pick<Exercise, 'kind'>): Slot {
  return ex.kind === 'compound' ? { sets: 3, repsMin: 8, repsMax: 12, restSec: 120 } : { sets: 3, repsMin: 10, repsMax: 15, restSec: 90 }
}

export interface CustomExerciseInput {
  name: string
  group: MuscleGroup | null
  /** Saisie brute (« 2,5 »). */
  increment: string
  bodyweight: boolean
  kind: Exercise['kind']
}
export type CustomExerciseErrors = Partial<Record<'name' | 'group' | 'increment', string>>
export type CustomExerciseResult = { ok: true; exercise: Omit<Exercise, 'id'> } | { ok: false; errors: CustomExerciseErrors }

/** Nom et groupe obligatoires, incrément > 0. */
export function validateCustomExercise(input: CustomExerciseInput): CustomExerciseResult {
  const errors: CustomExerciseErrors = {}
  const name = input.name.trim().replace(/\s+/g, ' ')
  if (!name) errors.name = 'Donne un nom à l\'exercice.'
  if (!input.group) errors.group = 'Choisis un groupe musculaire.'
  const increment = parseWeight(input.increment)
  if (increment === null || increment <= 0) errors.increment = 'Saisis un incrément supérieur à 0 (ex. 2,5).'
  if (Object.keys(errors).length > 0 || !input.group || increment === null) return { ok: false, errors }
  return {
    ok: true,
    exercise: {
      name, primaryGroup: input.group, secondaryGroups: [], equipment: input.bodyweight ? 'body only' : 'other',
      kind: input.kind, increment, bodyweight: input.bodyweight, custom: true,
    },
  }
}

/** Déplace l'élément d'un cran (dir −1 = vers le haut) et renumérote order de 0 à n−1. Sans effet de bord. */
export function moveItem<T extends { order: number }>(items: T[], index: number, dir: -1 | 1): T[] {
  const next = [...items]
  const to = index + dir
  if (to >= 0 && to < next.length) [next[index], next[to]] = [next[to], next[index]]
  return reindex(next)
}

/** order = position dans la liste. */
export const reindex = <T extends { order: number }>(items: T[]): T[] => items.map((x, order) => ({ ...x, order }))

/** Un nouveau programme se place après le dernier de la rotation. */
export const nextRotationOrder = (templates: Pick<WorkoutTemplate, 'rotationOrder'>[]): number =>
  templates.reduce((m, t) => Math.max(m, t.rotationOrder + 1), 0)
