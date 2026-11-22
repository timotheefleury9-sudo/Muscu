import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../data/db'
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
})
