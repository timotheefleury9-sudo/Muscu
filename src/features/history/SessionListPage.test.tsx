import { useEffect } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { db } from '../../data/db'
import { saveSet, startSession } from '../../data/repo'
import { seedIfEmpty } from '../../data/seed'

/** Séance Push à l'instant local donné, une série validée par répétition ; terminée sauf si `open`. */
async function session(at: Date, reps: number[], open = false): Promise<string> {
  const s = await startSession('tpl-push')
  for (const [setIndex, r] of reps.entries()) {
    await saveSet({
      id: crypto.randomUUID(), sessionId: s.id, exerciseId: 'Butterfly', templateExerciseId: 'tpl-push-2', setIndex,
      plannedWeight: 45, plannedReps: r, weight: 45, reps: r, done: true,
    })
  }
  await db.sessions.update(s.id, { startedAt: at.toISOString(), endedAt: open ? null : new Date(at.getTime() + 3600_000).toISOString() })
  return s.id
}

let visited: string[]
function Probe() {
  const { pathname, search } = useLocation()
  useEffect(() => { visited.push(pathname + search) }, [pathname, search])
  return null
}
const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Probe />
    <App />
  </MemoryRouter>,
)

let ids: Record<string, string>

beforeEach(async () => {
  visited = []
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 20, 12))
  await db.delete()
  await db.open()
  await seedIfEmpty()
  ids = {
    nov16: await session(new Date(2026, 10, 16, 18, 5), [12, 12]),
    nov18: await session(new Date(2026, 10, 18, 18), [12, 12, 12]),
    nov20: await session(new Date(2026, 10, 20, 11), [12], true),
  }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const LINE16 = 'lun. 16 nov. · Push · 1 exercice · 2 séries'
const row16 = () => screen.findByRole('button', { name: LINE16 })
const askDelete16 = async () => {
  await row16()
  await userEvent.click(screen.getByRole('button', { name: `Supprimer : ${LINE16}` }))
  return screen.findByRole('dialog')
}

describe('Toutes mes séances : suppression par glissement', () => {
  it('chaque séance terminée a son action « Supprimer » ; pas la séance en cours', async () => {
    renderAt('/progression/seances')
    await row16()
    const actions = screen.getAllByRole('button', { name: /^Supprimer : / })
    expect(actions.map((b) => b.textContent)).toEqual(['Supprimer', 'Supprimer'])
    expect(screen.queryByRole('button', { name: /^Supprimer : ven\. 20 nov\./ })).not.toBeInTheDocument()
    expect(document.querySelector('.h-swipe.is-locked')).not.toBeNull()
  })

  it('confirmer : séance et séries supprimées, ligne retirée', async () => {
    renderAt('/progression/seances')
    const dialog = await askDelete16()
    expect(dialog).toHaveTextContent('Supprimer cette séance ?')
    expect(dialog).toHaveTextContent('C\'est définitif.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: LINE16 })).not.toBeInTheDocument())
    expect(await db.sessions.get(ids.nov16)).toBeUndefined()
    expect(await db.sets.where('sessionId').equals(ids.nov16).count()).toBe(0)
    expect(await db.sessions.get(ids.nov18)).toBeDefined()
    expect(visited.at(-1)).toBe('/progression/seances')
  })

  it('annuler : rien n\'est supprimé', async () => {
    renderAt('/progression/seances')
    const dialog = await askDelete16()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: LINE16 })).toBeInTheDocument()
    expect(await db.sessions.get(ids.nov16)).toBeDefined()
    expect(await db.sets.where('sessionId').equals(ids.nov16).count()).toBe(2)
  })

  it('échec : bandeau « Enregistrement impossible… », la ligne reste', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(db, 'transaction').mockRejectedValue(new DOMException('Quota dépassé', 'QuotaExceededError'))
    renderAt('/progression/seances')
    const dialog = await askDelete16()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/^Enregistrement impossible/)
    expect(screen.getByRole('button', { name: LINE16 })).toBeInTheDocument()
    vi.mocked(db.transaction).mockRestore()
    expect(await db.sessions.get(ids.nov16)).toBeDefined()
  })

  it('glisser une ligne vers la gauche découvre l\'action ; toucher la ligne la referme sans ouvrir la séance', async () => {
    renderAt('/progression/seances')
    const row = await row16()
    const wrap = row.closest('.h-swipe') as HTMLElement
    expect(wrap).not.toHaveClass('is-open')
    // jsdom ne déplace rien : on simule la fin du glissement via le gestionnaire exposé au clavier/lecteur d'écran.
    fireEvent.keyDown(row, { key: 'ArrowLeft' })
    await waitFor(() => expect(wrap).toHaveClass('is-open'))
    await userEvent.click(row)
    await waitFor(() => expect(wrap).not.toHaveClass('is-open'))
    expect(visited.at(-1)).toBe('/progression/seances')
  })
})
