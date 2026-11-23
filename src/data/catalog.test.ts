import { describe, expect, it } from 'vitest'
import { CATALOG, normalizeCatalogExercise } from './catalog'
import type { Exercise } from '../domain/types'

const stale = (id: string, over: Partial<Exercise> = {}): Exercise => {
  const { category: _c, ...ref } = CATALOG.find((e) => e.id === id)!
  return { ...ref, ...over }
}

describe('normalizeCatalogExercise', () => {
  it('copie la catégorie du catalogue par id', () => {
    expect(normalizeCatalogExercise(stale('90_90_Hamstring')).category).toBe('stretching')
  })
  it('met le dos en secondaire du soulevé de terre sans toucher au reste', () => {
    const e = stale('Barbell_Deadlift', { primaryGroup: 'ischios', secondaryGroups: ['fessiers'] })
    const out = normalizeCatalogExercise(e)
    expect(out.secondaryGroups).toEqual(['dos', 'fessiers'])
    expect(out.name).toBe(e.name)
  })
  it('laisse un exercice personnalisé intact, même avec un id du catalogue', () => {
    const e = stale('Barbell_Squat', { custom: true, name: 'Mon squat' })
    expect(normalizeCatalogExercise(e)).toEqual(e)
  })
  it('laisse intact un exercice inconnu du catalogue', () => {
    const e = stale('Barbell_Squat', { id: 'inconnu' })
    expect(normalizeCatalogExercise(e)).toEqual(e)
  })
  it('ne modifie pas son argument', () => {
    const e = stale('90_90_Hamstring')
    normalizeCatalogExercise(e)
    expect(e.category).toBeUndefined()
  })
})
