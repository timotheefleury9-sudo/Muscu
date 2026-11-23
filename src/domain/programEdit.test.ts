import { describe, expect, it } from 'vitest'
import { canStep, defaultSlot, moveItem, stepSlot, nextRotationOrder, validateCustomExercise, validateSlot, type CustomExerciseInput } from './programEdit'
import type { Exercise } from './types'

describe('validateSlot', () => {
  const ok = { sets: 3, repsMin: 8, repsMax: 12, restSec: 90 }

  it('accepte une fourchette valide', () => {
    expect(validateSlot(ok)).toEqual({})
    expect(validateSlot({ sets: 1, repsMin: 1, repsMax: 1, restSec: 0 })).toEqual({})
    expect(validateSlot({ sets: 10, repsMin: 6, repsMax: 10, restSec: 600 })).toEqual({})
  })

  it('séries entre 1 et 10, entières', () => {
    expect(validateSlot({ ...ok, sets: 0 }).sets).toBeDefined()
    expect(validateSlot({ ...ok, sets: 11 }).sets).toBeDefined()
    expect(validateSlot({ ...ok, sets: 2.5 }).sets).toBeDefined()
  })

  it('reps min ≥ 1 et reps max ≥ reps min', () => {
    expect(validateSlot({ ...ok, repsMin: 0 }).repsMin).toBeDefined()
    expect(validateSlot({ ...ok, repsMin: 10, repsMax: 9 }).repsMax).toBeDefined()
    expect(validateSlot({ ...ok, repsMin: 10, repsMax: 10 })).toEqual({})
  })

  it('repos de 0 à 600 s, par pas de 15 s', () => {
    expect(validateSlot({ ...ok, restSec: -15 }).restSec).toBeDefined()
    expect(validateSlot({ ...ok, restSec: 615 }).restSec).toBeDefined()
    expect(validateSlot({ ...ok, restSec: 100 }).restSec).toBeDefined()
    expect(validateSlot({ ...ok, restSec: 105 })).toEqual({})
  })

  it('refuse les valeurs non numériques', () => {
    expect(Object.keys(validateSlot({ sets: NaN, repsMin: NaN, repsMax: NaN, restSec: NaN })).sort()).toEqual(['repsMax', 'repsMin', 'restSec', 'sets'])
  })
})

describe('validateCustomExercise', () => {
  const base: CustomExerciseInput = { name: 'Écarté maison', group: 'pectoraux', increment: '2,5', bodyweight: false, kind: 'compound' }

  it('construit l\'exercice personnalisé (nom nettoyé, incrément décimal)', () => {
    const r = validateCustomExercise({ ...base, name: '  Écarté maison ', increment: '1,25', kind: 'isolation' })
    expect(r).toEqual({
      ok: true,
      exercise: {
        name: 'Écarté maison', primaryGroup: 'pectoraux', secondaryGroups: [], equipment: 'other', kind: 'isolation',
        increment: 1.25, bodyweight: false, custom: true,
      },
    })
  })

  it('poids du corps : équipement « body only »', () => {
    const r = validateCustomExercise({ ...base, bodyweight: true })
    expect(r.ok && r.exercise).toMatchObject({ bodyweight: true, equipment: 'body only' })
  })

  it('exige un nom et un groupe', () => {
    const r = validateCustomExercise({ ...base, name: '   ', group: null })
    expect(r.ok).toBe(false)
    expect(!r.ok && Object.keys(r.errors).sort()).toEqual(['group', 'name'])
  })

  it('incrément strictement positif, saisi comme un poids', () => {
    for (const increment of ['0', '0,0', '', 'abc', '-2', '2,5,5']) {
      const r = validateCustomExercise({ ...base, increment })
      expect(!r.ok && r.errors.increment, increment).toBeTruthy()
    }
    expect(validateCustomExercise({ ...base, increment: '2.5' }).ok).toBe(true)
  })
})

describe('defaultSlot', () => {
  const ex = (kind: Exercise['kind']) => ({ kind })
  it('poly-articulaire : 3 × 8–12, repos 120 s ; isolation : 3 × 10–15, repos 90 s', () => {
    expect(defaultSlot(ex('compound'))).toEqual({ sets: 3, repsMin: 8, repsMax: 12, restSec: 120 })
    expect(defaultSlot(ex('isolation'))).toEqual({ sets: 3, repsMin: 10, repsMax: 15, restSec: 90 })
  })
})

describe('moveItem', () => {
  it('déplace un élément et renumérote order de 0 à n−1', () => {
    const items = [{ id: 'a', order: 0 }, { id: 'b', order: 1 }, { id: 'c', order: 5 }]
    expect(moveItem(items, 2, -1)).toEqual([{ id: 'a', order: 0 }, { id: 'c', order: 1 }, { id: 'b', order: 2 }])
    expect(moveItem(items, 0, 1).map((x) => x.id)).toEqual(['b', 'a', 'c'])
  })

  it('aux bords, ne change que la numérotation', () => {
    const items = [{ id: 'a', order: 3 }, { id: 'b', order: 7 }]
    expect(moveItem(items, 0, -1)).toEqual([{ id: 'a', order: 0 }, { id: 'b', order: 1 }])
    expect(moveItem(items, 1, 1)).toEqual([{ id: 'a', order: 0 }, { id: 'b', order: 1 }])
  })

  it('ne modifie pas le tableau d\'origine', () => {
    const items = [{ id: 'a', order: 0 }, { id: 'b', order: 1 }]
    moveItem(items, 1, -1)
    expect(items).toEqual([{ id: 'a', order: 0 }, { id: 'b', order: 1 }])
  })
})

describe('nextRotationOrder', () => {
  it('place un nouveau programme après le dernier', () => {
    expect(nextRotationOrder([])).toBe(0)
    expect(nextRotationOrder([{ rotationOrder: 0 }, { rotationOrder: 4 }, { rotationOrder: 2 }])).toBe(5)
  })
})

describe('stepSlot', () => {
  const s = { sets: 3, repsMin: 8, repsMax: 12, restSec: 90 }
  it('avance d\'un cran : 1 série, 1 répétition, 15 s de repos', () => {
    expect(stepSlot(s, 'sets', 1)).toBe(4)
    expect(stepSlot(s, 'repsMin', -1)).toBe(7)
    expect(stepSlot(s, 'restSec', 1)).toBe(105)
    expect(stepSlot(s, 'restSec', -1)).toBe(75)
  })
  it('s\'aligne sur le pas depuis une valeur saisie hors pas', () => {
    expect(stepSlot({ ...s, restSec: 100 }, 'restSec', 1)).toBe(105)
    expect(stepSlot({ ...s, restSec: 100 }, 'restSec', -1)).toBe(90)
  })
  it('ne franchit jamais les bornes (dont reps min ≤ reps max)', () => {
    expect(stepSlot({ ...s, sets: 1 }, 'sets', -1)).toBe(1)
    expect(stepSlot({ ...s, sets: 10 }, 'sets', 1)).toBe(10)
    expect(stepSlot({ ...s, restSec: 0 }, 'restSec', -1)).toBe(0)
    expect(stepSlot({ ...s, restSec: 600 }, 'restSec', 1)).toBe(600)
    expect(stepSlot({ ...s, repsMin: 12 }, 'repsMin', 1)).toBe(12)
    expect(stepSlot({ ...s, repsMax: 8 }, 'repsMax', -1)).toBe(8)
    expect(stepSlot({ ...s, repsMin: 1 }, 'repsMin', -1)).toBe(1)
  })
  it('canStep indique si un appui changerait la valeur', () => {
    expect(canStep({ ...s, sets: 1 }, 'sets', -1)).toBe(false)
    expect(canStep(s, 'sets', -1)).toBe(true)
    expect(canStep({ ...s, repsMin: 12 }, 'repsMax', -1)).toBe(false)
  })
})
