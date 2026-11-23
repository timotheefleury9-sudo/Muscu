import type { Exercise, MuscleGroup } from './types'

/** Catégories masquées par défaut dans le sélecteur. */
const HIDDEN_CATEGORIES = new Set(['stretching', 'cardio'])

/** Minuscules, sans accents, espaces réduits : « Développé  COUCHÉ » → « developpe couche ». */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[\s_]+/g, ' ').trim()
}

export interface SearchOptions {
  /** Inclut les étirements et le cardio (masqués par défaut). */
  includeAll?: boolean
}

/**
 * Recherche insensible à la casse et aux accents : chaque mot de la requête doit apparaître dans le nom français
 * ou dans le nom anglais d'origine (identifiant). Les noms qui commencent par la requête passent en premier, puis ordre alphabétique.
 */
export function searchExercises(list: Exercise[], query: string, group?: MuscleGroup, options: SearchOptions = {}): Exercise[] {
  const q = normalize(query)
  const words = q ? q.split(' ') : []
  const collator = new Intl.Collator('fr', { sensitivity: 'base' })
  return list
    .filter((e) => (!group || e.primaryGroup === group) && (options.includeAll || !e.category || !HIDDEN_CATEGORIES.has(e.category)))
    .map((e) => ({ e, name: normalize(e.name), hay: `${normalize(e.name)} ${normalize(e.id)}` }))
    .filter((x) => words.every((w) => x.hay.includes(w)))
    .sort((a, b) => {
      if (q) {
        const pa = a.name.startsWith(q) ? 0 : 1
        const pb = b.name.startsWith(q) ? 0 : 1
        if (pa !== pb) return pa - pb
      }
      return collator.compare(a.e.name, b.e.name)
    })
    .map((x) => x.e)
}
