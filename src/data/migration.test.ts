import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import catalog from './catalog/exercises.json'
import { db } from './db'
import type { Exercise, Session, SetLog, TemplateExercise, WorkoutTemplate } from '../domain/types'

const V1_STORES = {
  exercises: 'id, primaryGroup',
  templates: 'id, rotationOrder',
  templateExercises: 'id, templateId, exerciseId',
  sessions: 'id, startedAt, templateId',
  sets: 'id, sessionId, exerciseId',
}

const custom: Exercise = {
  id: 'custom-x', name: 'Perso', primaryGroup: 'pectoraux', secondaryGroups: [], equipment: 'other', kind: 'compound', increment: 2, bodyweight: false, custom: true,
}
const template: WorkoutTemplate = { id: 'tpl-push', name: 'Ma poussée', rotationOrder: 0 }
const row: TemplateExercise = { id: 'r1', templateId: 'tpl-push', exerciseId: 'Barbell_Deadlift', order: 0, sets: 4, repsMin: 3, repsMax: 5, restSec: 180 }
const session: Session = { id: 's1', templateId: 'tpl-push', startedAt: '2026-11-20T17:00:00.000Z', endedAt: '2026-11-20T18:00:00.000Z' }
const set: SetLog = {
  id: 'set1', sessionId: 's1', exerciseId: 'Barbell_Deadlift', templateExerciseId: 'r1', setIndex: 0,
  plannedWeight: 100, plannedReps: 5, weight: 100, reps: 5, done: true,
}

/** Base créée par la V1 : catalogue sans catégorie, soulevé de terre sans « dos », sans le dernier exercice du catalogue. */
async function createV1() {
  db.close()
  await Dexie.delete('muscu')
  const old = new Dexie('muscu')
  old.version(1).stores(V1_STORES)
  await old.open()
  const v1Catalog = (catalog as Exercise[]).slice(0, -1).map(({ category: _c, ...e }) =>
    e.id === 'Barbell_Deadlift' ? { ...e, primaryGroup: 'ischios' as const, secondaryGroups: e.secondaryGroups.filter((g) => g !== 'ischios') } : e,
  )
  await old.table('exercises').bulkAdd([...v1Catalog, custom])
  await old.table('templates').add(template)
  await old.table('templateExercises').add(row)
  await old.table('sessions').add(session)
  await old.table('sets').add(set)
  old.close()
}

beforeEach(createV1)
afterEach(async () => {
  db.close()
  await Dexie.delete('muscu')
  await db.open()
})

describe('migration V2 du catalogue', () => {
  it('ajoute les catégories, corrige le soulevé de terre, complète le catalogue', async () => {
    await db.open()
    const exos = await db.exercises.toArray()
    expect(exos.filter((e) => !e.custom).every((e) => typeof e.category === 'string')).toBe(true)
    expect((await db.exercises.get('90_90_Hamstring'))!.category).toBe('stretching')
    const deadlift = (await db.exercises.get('Barbell_Deadlift'))!
    expect(deadlift.primaryGroup).toBe('ischios')
    expect(deadlift.secondaryGroups).toContain('dos')
    expect(deadlift.secondaryGroups).not.toContain('ischios')
    const lastId = (catalog as Exercise[]).at(-1)!.id
    expect(await db.exercises.get(lastId)).toBeDefined()
    expect(exos).toHaveLength(catalog.length + 1)
  })

  it('ne touche ni aux exercices personnalisés, ni aux programmes, séances et séries', async () => {
    await db.open()
    expect(await db.exercises.get('custom-x')).toEqual(custom)
    expect(await db.templates.toArray()).toEqual([template])
    expect(await db.templateExercises.toArray()).toEqual([row])
    expect(await db.sessions.toArray()).toEqual([session])
    expect(await db.sets.toArray()).toEqual([set])
  })

  it('une base V1 vide reste vide (le premier lancement la remplira)', async () => {
    db.close()
    await Dexie.delete('muscu')
    const old = new Dexie('muscu')
    old.version(1).stores(V1_STORES)
    await old.open()
    old.close()
    await db.open()
    expect(await db.exercises.count()).toBe(0)
  })
})
