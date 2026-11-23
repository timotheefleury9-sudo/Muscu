// Génère src/data/catalog/exercises.json depuis free-exercise-db (Unlicense, domaine public)
// + noms français (src/data/catalog/names.fr.json).
// Usage : npm run catalog   (source : scripts/source/free-exercise-db.json)
import { readFileSync, writeFileSync } from 'node:fs'
import type { Exercise, MuscleGroup } from '../src/domain/types.ts'

interface SourceExercise {
  id: string
  name: string
  mechanic: string | null
  category: string
  equipment: string | null
  primaryMuscles: string[]
  secondaryMuscles: string[]
}

const GROUP: Record<string, MuscleGroup> = {
  abdominals: 'abdos',
  abductors: 'fessiers', glutes: 'fessiers',
  adductors: 'quadriceps', quadriceps: 'quadriceps',
  biceps: 'biceps', forearms: 'biceps',
  calves: 'mollets',
  chest: 'pectoraux',
  hamstrings: 'ischios',
  lats: 'dos', 'lower back': 'dos', 'middle back': 'dos', traps: 'dos', neck: 'dos',
  shoulders: 'epaules',
  triceps: 'triceps',
}
const toGroup = (m: string): MuscleGroup => {
  const g = GROUP[m]
  if (!g) throw new Error(`Muscle inconnu : ${m}`)
  return g
}

const root = new URL('../', import.meta.url)
const source: SourceExercise[] = JSON.parse(readFileSync(new URL('scripts/source/free-exercise-db.json', root), 'utf8'))
const names: Record<string, string> = JSON.parse(readFileSync(new URL('src/data/catalog/names.fr.json', root), 'utf8'))

const out: Exercise[] = source.map((s) => {
  const name = names[s.id]?.trim()
  if (!name) throw new Error(`Nom français manquant : ${s.id}`)
  const primaryGroup = toGroup(s.primaryMuscles[0])
  const secondaryGroups = [...new Set(s.secondaryMuscles.map(toGroup))].filter((g) => g !== primaryGroup)
  const equipment = s.equipment ?? 'none'
  return {
    id: s.id,
    name,
    primaryGroup,
    secondaryGroups,
    equipment,
    kind: s.mechanic === 'compound' ? 'compound' : 'isolation',
    increment: equipment === 'dumbbell' ? 2 : 2.5,
    bodyweight: equipment === 'body only',
    custom: false,
    category: s.category,
  }
})

writeFileSync(new URL('src/data/catalog/exercises.json', root), JSON.stringify(out, null, 1) + '\n')
console.log(`${out.length} exercices écrits`)
