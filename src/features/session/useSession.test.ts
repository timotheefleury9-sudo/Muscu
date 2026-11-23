import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../data/db'
import { saveExercise } from '../../data/repo'
import { seedIfEmpty } from '../../data/seed'
import { pendingWrites, useSession } from './useSession'

beforeEach(async () => {
  await db.delete()
  await db.open()
  await seedIfEmpty()
})

afterEach(async () => {
  cleanup()
  await pendingWrites()
  vi.restoreAllMocks()
})

describe('useSession', () => {
  it('« Annuler » une suppression après un changement de séance ne réinsère rien', async () => {
    const { result } = renderHook(() => useSession())
    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    const set = result.current.state.items[0].sets[0]
    act(() => { result.current.updateSet(0, set.id, { weight: 20, reps: 10 }) })
    act(() => { result.current.toggleDone(0, set.id) })
    let removed: ReturnType<typeof result.current.removeSet> = null
    act(() => { removed = result.current.removeSet(0, set.id) })
    act(() => { result.current.selectTemplate('tpl-pull') })
    expect(result.current.state.template?.id).toBe('tpl-pull')
    act(() => { result.current.restoreSet(removed!) })
    expect(result.current.state.items.flatMap((i) => i.sets).some((s) => s.id === set.id)).toBe(false)
    await act(() => result.current.finish())
    expect(await db.sets.get(set.id)).toBeUndefined()
    expect(await db.sets.count()).toBe(0)
  })

  it('un changement de séance pendant la création de la séance ne laisse pas de séance orpheline', async () => {
    const { result } = renderHook(() => useSession())
    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    const set = result.current.state.items[0].sets[0]
    // La création de la séance (transaction) reste en attente jusqu'à ce qu'on la libère.
    const realTransaction = db.transaction.bind(db) as (...a: unknown[]) => Promise<unknown>
    let release!: () => void
    const gate = new Promise<void>((r) => { release = r })
    let calls = 0
    const add = vi.spyOn(db, 'transaction').mockImplementation(((...args: unknown[]) => {
      calls++
      return gate.then(() => realTransaction(...args))
    }) as unknown as typeof db.transaction)
    act(() => { result.current.updateSet(0, set.id, { weight: 20 }) })
    await waitFor(() => expect(calls).toBe(1))
    act(() => { result.current.selectTemplate('tpl-legs') })
    release()
    await act(() => result.current.finish())
    add.mockRestore()
    expect(await db.sessions.count()).toBe(0)
    expect(await db.sets.count()).toBe(0)
  })

  it('l\'incrément de l\'exercice fixe le pas de la hausse de charge proposée', async () => {
    const day = new Date(Date.now() - 86_400_000).toISOString()
    await db.sessions.add({ id: 'past', templateId: 'tpl-push', startedAt: day, endedAt: day })
    await db.sets.bulkAdd([0, 1, 2].map((setIndex) => ({
      id: `past-${setIndex}`, sessionId: 'past', exerciseId: 'Dumbbell_Bench_Press', templateExerciseId: 'tpl-push-0', setIndex,
      plannedWeight: null, plannedReps: null, weight: 24, reps: 12, done: true,
    })))
    const proposed = async () => {
      const { result, unmount } = renderHook(() => useSession())
      await waitFor(() => expect(result.current.state.status).toBe('ready'))
      act(() => { result.current.selectTemplate('tpl-push') })
      const item = result.current.state.items.find((i) => i.te.id === 'tpl-push-0')!
      unmount()
      return item.sets.map((s) => s.weight)
    }
    expect((await db.exercises.get('Dumbbell_Bench_Press'))!.increment).toBe(2)
    expect(await proposed()).toEqual([26, 26, 26])
    await saveExercise({ ...(await db.exercises.get('Dumbbell_Bench_Press'))!, increment: 2.5 })
    expect(await proposed()).toEqual([26.5, 26.5, 26.5])
  })

  it('un remontage pendant la création de la séance ne crée pas de seconde séance', async () => {
    const first = renderHook(() => useSession())
    await waitFor(() => expect(first.result.current.state.status).toBe('ready'))
    const set = first.result.current.state.items[0].sets[0]
    const realTransaction = db.transaction.bind(db) as (...a: unknown[]) => Promise<unknown>
    let release!: () => void
    const gate = new Promise<void>((r) => { release = r })
    let calls = 0
    const tx = vi.spyOn(db, 'transaction').mockImplementation(((...args: unknown[]) => {
      calls++
      return calls === 1 ? gate.then(() => realTransaction(...args)) : realTransaction(...args)
    }) as unknown as typeof db.transaction)
    act(() => { first.result.current.updateSet(0, set.id, { weight: 20 }) })
    await waitFor(() => expect(calls).toBe(1))
    first.unmount()

    const second = renderHook(() => useSession())
    release()
    await waitFor(() => expect(second.result.current.state.status).toBe('ready'))
    expect(second.result.current.state.session).not.toBeNull()
    const s2 = second.result.current.state.items[0].sets[0]
    act(() => { second.result.current.toggleDone(0, s2.id) })
    await pendingWrites()
    tx.mockRestore()
    expect(await db.sessions.count()).toBe(1)
  })

  it('terminer une séance sans série validée la supprime (séries brouillon comprises)', async () => {
    const { result } = renderHook(() => useSession())
    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    const set = result.current.state.items[0].sets[0]
    act(() => { result.current.updateSet(0, set.id, { weight: 20 }) })
    await pendingWrites()
    expect(await db.sessions.count()).toBe(1)
    await act(() => result.current.finish())
    expect(await db.sessions.count()).toBe(0)
    expect(await db.sets.count()).toBe(0)
    expect(result.current.state.session).toBeNull()
  })

  it('terminer une séance avec une série validée la conserve', async () => {
    const { result } = renderHook(() => useSession())
    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    act(() => { result.current.toggleDone(0, result.current.state.items[0].sets[0].id) })
    await act(() => result.current.finish())
    const sessions = await db.sessions.toArray()
    expect(sessions).toHaveLength(1)
    expect(sessions[0].endedAt).not.toBeNull()
  })

  it('clôture automatique : séance sans série validée supprimée, séance avec série validée close', async () => {
    const old = new Date(Date.now() - 2 * 86_400_000).toISOString()
    const draft = (id: string, sessionId: string, done: boolean) => ({
      id, sessionId, exerciseId: 'Dumbbell_Bench_Press', templateExerciseId: 'tpl-push-0', setIndex: 0,
      plannedWeight: null, plannedReps: null, weight: 20, reps: 10, done,
    })
    await db.sessions.add({ id: 'vide', templateId: 'tpl-push', startedAt: old, endedAt: null })
    await db.sets.add(draft('v0', 'vide', false))
    const { result, unmount } = renderHook(() => useSession())
    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    unmount()
    expect(await db.sessions.count()).toBe(0)
    expect(await db.sets.count()).toBe(0)

    await db.sessions.add({ id: 'faite', templateId: 'tpl-push', startedAt: old, endedAt: null })
    await db.sets.bulkAdd([draft('f0', 'faite', true), draft('f1', 'faite', false)])
    const again = renderHook(() => useSession())
    await waitFor(() => expect(again.result.current.state.status).toBe('ready'))
    expect((await db.sessions.get('faite'))!.endedAt).not.toBeNull()
    expect(await db.sets.count()).toBe(2)
  })
})
