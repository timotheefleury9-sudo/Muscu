import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestPersistentStorage } from './persist'

afterEach(() => vi.unstubAllGlobals())

describe('requestPersistentStorage', () => {
  it('appelle navigator.storage.persist une fois', () => {
    const persist = vi.fn().mockResolvedValue(true)
    vi.stubGlobal('navigator', { storage: { persist } })
    requestPersistentStorage()
    expect(persist).toHaveBeenCalledTimes(1)
  })
  it("ne plante pas si l'API est absente", () => {
    vi.stubGlobal('navigator', {})
    expect(() => requestPersistentStorage()).not.toThrow()
  })
  it('ignore un refus ou une erreur', async () => {
    vi.stubGlobal('navigator', { storage: { persist: vi.fn().mockRejectedValue(new Error('non')) } })
    expect(() => requestPersistentStorage()).not.toThrow()
    await Promise.resolve()
  })
})
