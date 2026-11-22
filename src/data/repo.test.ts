import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import {
  deleteTemplateExercise, getOpenSession, endSession, listSets, listTemplateExercises,
  loadAll, saveSet, saveTemplate, saveTemplateExercise, startSession, deleteSet, listTemplates, deleteTemplate,
} from './repo'
import type { SetLog, TemplateExercise } from '../domain/types'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const te = (over: Partial<TemplateExercise> = {}): TemplateExercise => ({
  id: crypto.randomUUID(), templateId: 't1', exerciseId: 'e1', order: 0, sets: 3, repsMin: 8, repsMax: 12, restSec: 90, ...over,
})
const set = (sessionId: string, over: Partial<SetLog> = {}): SetLog => ({
  id: crypto.randomUUID(), sessionId, exerciseId: 'e1', templateExerciseId: null, setIndex: 0,
  plannedWeight: 50, plannedReps: 10, weight: 50, reps: 10, done: true, ...over,
})

describe('repo', () => {
  it('enregistre une séance et ses séries, les relit, et loadAll les contient', async () => {
    await saveTemplate({ id: 't1', name: 'Push', rotationOrder: 0 })
    const s = await startSession('t1')
    expect(await getOpenSession()).toEqual(s)
    const a = set(s.id, { setIndex: 0 })
    const b = set(s.id, { setIndex: 1, weight: 52.5 })
    await saveSet(a)
    await saveSet(b)
    expect((await listSets(s.id)).map((x) => x.id).sort()).toEqual([a.id, b.id].sort())
    await endSession(s.id)
    expect(await getOpenSession()).toBeUndefined()
    const all = await loadAll()
    expect(all.sessions).toHaveLength(1)
    expect(all.sessions[0].endedAt).not.toBeNull()
    expect(all.sets).toHaveLength(2)
    await deleteSet(a.id)
    expect(await listSets(s.id)).toHaveLength(1)
  })

  it('supprimer un TemplateExercise ne supprime aucun SetLog', async () => {
    const t = te()
    await saveTemplateExercise(t)
    const s = await startSession('t1')
    await saveSet(set(s.id, { templateExerciseId: t.id }))
    await deleteTemplateExercise(t.id)
    expect(await listTemplateExercises('t1')).toHaveLength(0)
    expect(await listSets(s.id)).toHaveLength(1)
  })

  it('liste et supprime les modèles', async () => {
    await saveTemplate({ id: 't1', name: 'Push', rotationOrder: 0 })
    expect(await listTemplates()).toHaveLength(1)
    await deleteTemplate('t1')
    expect(await listTemplates()).toHaveLength(0)
  })
})
