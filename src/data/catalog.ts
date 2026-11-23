import catalog from './catalog/exercises.json'
import type { Exercise, MuscleGroup } from '../domain/types'

/** Soulevé de terre rattaché aux ischios (spec §5) : le dos (muscle principal du catalogue) passe en secondaire. */
export const deadliftSecondary = (groups: MuscleGroup[]): MuscleGroup[] => ['dos', ...groups.filter((g) => g !== 'ischios' && g !== 'dos')]

/** Catalogue livré avec l'app, ajusté (soulevé de terre). */
export const CATALOG: Exercise[] = (catalog as Exercise[]).map((e) =>
  e.id === 'Barbell_Deadlift' ? { ...e, primaryGroup: 'ischios', secondaryGroups: deadliftSecondary(e.secondaryGroups) } : e,
)

const CATALOG_BY_ID = new Map(CATALOG.map((e) => [e.id, e]))

/**
 * Aligne un exercice du catalogue (non personnalisé) sur le catalogue livré : catégorie copiée par id,
 * soulevé de terre avec le dos en secondaire. Un exercice personnalisé est rendu tel quel. Fonction pure.
 */
export function normalizeCatalogExercise(e: Exercise): Exercise {
  if (e.custom) return e
  const ref = CATALOG_BY_ID.get(e.id)
  const out = ref?.category ? { ...e, category: ref.category } : { ...e }
  if (e.id === 'Barbell_Deadlift' && e.primaryGroup !== 'dos') out.secondaryGroups = deadliftSecondary(e.secondaryGroups)
  return out
}
