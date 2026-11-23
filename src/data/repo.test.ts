import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from './db'
import {
  deleteTemplateExercise, getOpenSession, endSession, listSets, listTemplateExercises,
  loadAll, saveSet, saveTemplate, saveTemplateExercise, startSession, deleteSet, listTemplates, deleteTemplate, deleteSession, startSessionWithSets,
  loadPrograms, saveTemplateExercises, createCustomExercise, createPastSession, moveSession, removeExerciseFromSession,
} from './repo'
import type { SetLog, TemplateExercise } from '../domain/types'
import { nextTemplateId } from '../domain/rotation'

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

  it('loadPrograms lit exercices, programmes (ordre de rotation) et lignes, sans les séances', async () => {
    await saveTemplate({ id: 't2', name: 'Pull', rotationOrder: 1 })
    await saveTemplate({ id: 't1', name: 'Push', rotationOrder: 0 })
    await saveTemplateExercise(te({ id: 'a', templateId: 't1' }))
    await db.exercises.put({ id: 'e1', name: 'X', primaryGroup: 'dos', secondaryGroups: [], equipment: 'other', kind: 'compound', increment: 2.5, bodyweight: false, custom: true })
    const p = await loadPrograms()
    expect(p.templates.map((t) => t.id)).toEqual(['t1', 't2'])
    expect(p.templateExercises.map((x) => x.id)).toEqual(['a'])
    expect(p.exercises.map((x) => x.id)).toEqual(['e1'])
  })

  it('saveTemplateExercises écrit toutes les lignes ensemble, ou aucune', async () => {
    await saveTemplateExercises([te({ id: 'a', order: 0 }), te({ id: 'b', order: 1 })])
    expect((await listTemplateExercises('t1')).map((x) => x.id)).toEqual(['a', 'b'])
    await saveTemplateExercises([te({ id: 'a', order: 1 }), te({ id: 'b', order: 0 })])
    expect((await listTemplateExercises('t1')).map((x) => x.id)).toEqual(['b', 'a'])

    const put = vi.spyOn(db.templateExercises, 'bulkPut').mockRejectedValueOnce(new Error('quota'))
    await expect(saveTemplateExercises([te({ id: 'a', order: 0 }), te({ id: 'b', order: 1 })])).rejects.toThrow('quota')
    put.mockRestore()
    expect((await listTemplateExercises('t1')).map((x) => x.id)).toEqual(['b', 'a'])
  })

  it('createCustomExercise écrit l\'exercice et sa ligne ensemble, ou rien', async () => {
    const ex = { id: 'c1', name: 'Perso', primaryGroup: 'dos' as const, secondaryGroups: [], equipment: 'other', kind: 'compound' as const, increment: 2.5, bodyweight: false, custom: true }
    const put = vi.spyOn(db.templateExercises, 'put').mockRejectedValueOnce(new Error('quota'))
    await expect(createCustomExercise(ex, te({ id: 'r1', exerciseId: 'c1' }))).rejects.toThrow('quota')
    put.mockRestore()
    expect(await db.exercises.get('c1')).toBeUndefined()
    await createCustomExercise(ex, te({ id: 'r1', exerciseId: 'c1' }))
    expect(await db.exercises.get('c1')).toBeDefined()
    expect(await db.templateExercises.get('r1')).toBeDefined()
  })

  describe('historique', () => {
    const noSid = (over: Partial<SetLog> = {}): Omit<SetLog, 'sessionId'> => { const { sessionId: _s, ...rest } = set('x', over); return rest }

    it('createPastSession crée une séance terminée et ses séries', async () => {
      const at = new Date(2026, 10, 16, 12, 0).toISOString()
      const a = noSid({ setIndex: 0 })
      const s = await createPastSession('t1', at, [a, noSid({ setIndex: 1 })])
      expect(s).toMatchObject({ templateId: 't1', startedAt: at, endedAt: at })
      expect(await db.sessions.get(s.id)).toEqual(s)
      const sets = await listSets(s.id)
      expect(sets).toHaveLength(2)
      expect(sets.every((x) => x.sessionId === s.id)).toBe(true)
      expect(sets.map((x) => x.id)).not.toContain(a.id)
    })

    it('createPastSession : échec d\'écriture des séries, rien n\'est écrit', async () => {
      const put = vi.spyOn(db.sets, 'put').mockRejectedValueOnce(new Error('quota'))
      await expect(createPastSession('t1', new Date().toISOString(), [noSid()])).rejects.toThrow()
      put.mockRestore()
      expect(await db.sessions.count()).toBe(0)
      expect(await db.sets.count()).toBe(0)
    })

    it('une séance passée plus ancienne que la dernière ne change pas nextTemplateId', async () => {
      const templates = [{ id: 't1', name: 'A', rotationOrder: 0 }, { id: 't2', name: 'B', rotationOrder: 1 }, { id: 't3', name: 'C', rotationOrder: 2 }]
      for (const t of templates) await saveTemplate(t)
      for (const t of templates) await saveTemplateExercise(te({ templateId: t.id }))
      await createPastSession('t2', new Date(2026, 10, 20, 10).toISOString(), [noSid()])
      const next = async () => { const d = await loadAll(); return nextTemplateId(d.templates, d.sessions, d.sets, d.templateExercises) }
      expect(await next()).toBe('t3')
      await createPastSession('t1', new Date(2026, 10, 10, 10).toISOString(), [noSid()])
      expect(await next()).toBe('t3')
    })

    it('moveSession met à jour les deux dates', async () => {
      const s = await createPastSession('t1', new Date(2026, 10, 16, 12).toISOString(), [])
      const a = new Date(2026, 10, 10, 9).toISOString()
      const b = new Date(2026, 10, 10, 10).toISOString()
      await moveSession(s.id, a, b)
      expect(await db.sessions.get(s.id)).toMatchObject({ startedAt: a, endedAt: b })
      await moveSession(s.id, a, null)
      expect((await db.sessions.get(s.id))?.endedAt).toBeNull()
    })

    it('removeExerciseFromSession ne supprime que cet exercice dans cette séance', async () => {
      const s1 = await createPastSession('t1', new Date(2026, 10, 16, 12).toISOString(), [noSid({ exerciseId: 'e1' }), noSid({ exerciseId: 'e1', setIndex: 1 }), noSid({ exerciseId: 'e2' })])
      const s2 = await createPastSession('t1', new Date(2026, 10, 17, 12).toISOString(), [noSid({ exerciseId: 'e1' })])
      await removeExerciseFromSession(s1.id, 'e1')
      expect((await listSets(s1.id)).map((x) => x.exerciseId)).toEqual(['e2'])
      expect(await listSets(s2.id)).toHaveLength(1)
    })

    it('removeExerciseFromSession : échec, rien n\'est supprimé', async () => {
      const s = await createPastSession('t1', new Date(2026, 10, 16, 12).toISOString(), [noSid({ exerciseId: 'e1' }), noSid({ exerciseId: 'e1', setIndex: 1 })])
      const del = vi.spyOn(db.sets, 'bulkDelete').mockRejectedValueOnce(new Error('quota'))
      await expect(removeExerciseFromSession(s.id, 'e1')).rejects.toThrow()
      del.mockRestore()
      expect(await listSets(s.id)).toHaveLength(2)
    })
  })
})
