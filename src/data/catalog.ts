import catalog from './catalog/exercises.json'
import type { Exercise, MuscleGroup } from '../domain/types'

/** Soulevé de terre rattaché aux ischios (spec §5) : le dos (muscle principal du catalogue) passe en secondaire. */
export const deadliftSecondary = (groups: MuscleGroup[]): MuscleGroup[] => ['dos', ...groups.filter((g) => g !== 'ischios' && g !== 'dos')]

/** Catalogue livré avec l'app, ajusté (soulevé de terre). */
export const CATALOG: Exercise[] = (catalog as Exercise[]).map((e) =>
  e.id === 'Barbell_Deadlift' ? { ...e, primaryGroup: 'ischios', secondaryGroups: deadliftSecondary(e.secondaryGroups) } : e,
)
