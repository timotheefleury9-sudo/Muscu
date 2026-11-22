import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from './db'
import {
  deleteTemplateExercise, getOpenSession, endSession, listSets, listTemplateExercises,
  loadAll, saveSet, saveTemplate, saveTemplateExercise, startSession, deleteSet, listTemplates, deleteTemplate, deleteSession, startSessionWithSets,
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

  it('supprime une séance et ses séries seulement', async () => {
    const a = await startSession('t1')
    const b = await startSession('t1')
    await saveSet(set(a.id))
    await saveSet(set(b.id))
    await deleteSession(a.id)
    const all = await loadAll()
    expect(all.sessions.map((s) => s.id)).toEqual([b.id])
    expect(all.sets.map((s) => s.sessionId)).toEqual([b.id])
  })

  it('startSessionWithSets crée la séance et ses séries ensemble, ou rien', async () => {
    const s = await startSessionWithSets('t1', [set('', { setIndex: 0 }), set('', { setIndex: 1 })])
    expect(await getOpenSession()).toEqual(s)
    expect((await listSets(s.id)).map((x) => x.sessionId)).toEqual([s.id, s.id])
    await endSession(s.id)

    const put = vi.spyOn(db.sets, 'put').mockRejectedValueOnce(new Error('quota'))
    await expect(startSessionWithSets('t1', [set('')])).rejects.toThrow('quota')
    put.mockRestore()
    expect(await getOpenSession()).toBeUndefined()
    expect((await loadAll()).sessions).toHaveLength(1)
  })
})
