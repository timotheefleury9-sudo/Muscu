import { db } from './db'
import catalog from './catalog/exercises.json'
import type { Exercise, TemplateExercise, WorkoutTemplate } from '../domain/types'

const LUNGES_ID = 'custom-fentes-marchees-sac-a-dos'
const lunges: Exercise = {
  id: LUNGES_ID, name: 'Fentes marchées avec sac à dos lesté', primaryGroup: 'quadriceps',
  secondaryGroups: ['fessiers', 'ischios'], equipment: 'other', kind: 'compound', increment: 2, bodyweight: false, custom: true,
}

/** Programme PPL de Tim (spec §5) : exercices du catalogue (id free-exercise-db) par séance. */
const PLAN: { id: string; name: string; exercises: string[] }[] = [
  { id: 'tpl-push', name: 'Push', exercises: ['Dumbbell_Bench_Press', 'Machine_Bench_Press', 'Butterfly', 'Triceps_Pushdown', 'Standing_Low-Pulley_Deltoid_Raise'] },
  { id: 'tpl-pull', name: 'Pull', exercises: ['Pullups', 'Leverage_Iso_Row', 'Seated_Cable_Rows', 'Reverse_Machine_Flyes', 'Dumbbell_Bicep_Curl'] },
  { id: 'tpl-legs', name: 'Legs', exercises: ['Barbell_Squat', 'Barbell_Deadlift', LUNGES_ID, 'Leg_Extensions'] },
]
const HEAVY = new Set(['Barbell_Squat', 'Barbell_Deadlift'])

/** Insère le catalogue et le template PPL si la base est vide. Idempotent. */
export async function seedIfEmpty(): Promise<void> {
  await db.transaction('rw', db.exercises, db.templates, db.templateExercises, async () => {
    if ((await db.exercises.count()) > 0) return
    const exercises: Exercise[] = [...(catalog as Exercise[]), lunges].map((e) =>
      e.id === 'Barbell_Deadlift' ? { ...e, primaryGroup: 'ischios', secondaryGroups: e.secondaryGroups.filter((g) => g !== 'ischios') } : e,
    )
    const byId = new Map(exercises.map((e) => [e.id, e]))
    const templates: WorkoutTemplate[] = PLAN.map((p, i) => ({ id: p.id, name: p.name, rotationOrder: i }))
    const templateExercises: TemplateExercise[] = PLAN.flatMap((p) =>
      p.exercises.map((exerciseId, order) => {
        const ex = byId.get(exerciseId)
        if (!ex) throw new Error(`Exercice du template introuvable : ${exerciseId}`)
        const [repsMin, repsMax] = HEAVY.has(exerciseId) ? [5, 8] : ex.kind === 'compound' ? [8, 12] : [10, 15]
        return { id: `${p.id}-${order}`, templateId: p.id, exerciseId, order, sets: 3, repsMin, repsMax, restSec: ex.kind === 'compound' ? 120 : 90 }
      }),
    )
    await db.exercises.bulkAdd(exercises)
    await db.templates.bulkAdd(templates)
    await db.templateExercises.bulkAdd(templateExercises)
  })
}
