import { useEffect } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { db } from '../../data/db'
import { seedIfEmpty } from '../../data/seed'
import { pendingEditorWrites } from './useSessionEditor'

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

beforeEach(async () => {
  visited = []
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 20, 12))
  await db.delete()
  await db.open()
  await seedIfEmpty()
})

afterEach(async () => {
  cleanup()
  await pendingEditorWrites()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('Ajouter une séance oubliée', () => {
  it('calendrier → jour sans séance → feuille → Push : séance du 10/11 à 12:00, terminée, séries vides, détail ouvert', async () => {
    renderAt('/progression/calendrier?mois=2026-11')
    await screen.findByRole('heading', { name: 'novembre 2026' })
    await userEvent.click(document.querySelector('[data-day="2026-11-10"]') as HTMLElement)
    const sheet = await screen.findByRole('dialog', { name: 'mardi 10 novembre' })
    await userEvent.click(within(sheet).getByRole('button', { name: 'Ajouter une séance ce jour-là' }))
    expect(await screen.findByRole('heading', { name: 'Ajouter une séance' })).toBeInTheDocument()
    expect(visited.at(-1)).toBe('/seances/nouvelle?date=2026-11-10')
    expect(screen.getByLabelText('Date de la séance')).toHaveValue('2026-11-10')

    const push = screen.getByRole('button', { name: /Push/ })
    expect(push).toHaveTextContent('5 exercices')
    await userEvent.click(push)

    await waitFor(() => expect(visited.at(-1)).toMatch(/^\/seances\/(?!nouvelle)/))
    const [s] = await db.sessions.toArray()
    expect(s.templateId).toBe('tpl-push')
    expect(s.startedAt).toBe(new Date(2026, 10, 10, 12).toISOString())
    expect(s.endedAt).toBe(s.startedAt)
    expect(visited.at(-1)).toBe(`/seances/${s.id}`)
    const sets = await db.sets.where('sessionId').equals(s.id).toArray()
    const tes = await db.templateExercises.where('templateId').equals('tpl-push').toArray()
    expect(new Set(sets.map((x) => x.exerciseId)).size).toBe(5)
    expect(sets).toHaveLength(tes.reduce((n, te) => n + te.sets, 0))
    expect(sets.every((x) => x.weight === 0 && x.reps === 0 && !x.done && x.plannedWeight === null && x.plannedReps === null && x.templateExerciseId !== null)).toBe(true)
    expect(await screen.findByRole('heading', { name: 'Push' })).toBeInTheDocument()
  })

  it('la séance créée apparaît avec sa pastille dans le calendrier', async () => {
    renderAt('/seances/nouvelle?date=2026-11-10')
    await userEvent.click(await screen.findByRole('button', { name: /Push/ }))
    await waitFor(() => expect(visited.at(-1)).toMatch(/^\/seances\/(?!nouvelle)/))
    await userEvent.click(await screen.findByRole('button', { name: /Calendrier/ }))
    await screen.findByRole('heading', { name: 'novembre 2026' })
    await waitFor(() => expect(document.querySelector('[data-day="2026-11-10"] .h-pill')).not.toBeNull())
  })

  it('séries vides du détail : toucher la coche ouvre la saisie au lieu de valider', async () => {
    renderAt('/seances/nouvelle?date=2026-11-10')
    await userEvent.click(await screen.findByRole('button', { name: /Push/ }))
    const first = (await screen.findAllByRole('region'))[0]
    const check = within(first).getAllByRole('button', { name: 'Valider la série 1' })[0]
    expect(within(first).getAllByRole('button', { name: /Série 1 : à remplir/ })[0]).toBeInTheDocument()
    await userEvent.click(check)
    expect(await within(first).findByRole('button', { name: 'Plus de poids' })).toBeInTheDocument()
    expect((await db.sets.toArray()).some((x) => x.done)).toBe(false)
    await userEvent.click(within(first).getByRole('button', { name: 'Plus de répétitions' }))
    await waitFor(async () => expect((await db.sets.toArray()).filter((x) => x.reps > 0)).toHaveLength(1))
  })

  it('date future refusée à l\'envoi : message, rien créé', async () => {
    renderAt('/seances/nouvelle?date=2026-11-25')
    expect(screen.getByLabelText('Date de la séance')).toHaveValue('2026-11-25')
    await userEvent.click(await screen.findByRole('button', { name: /Push/ }))
    expect(await screen.findByText('La date ne peut pas être dans le futur')).toBeInTheDocument()
    expect(await db.sessions.count()).toBe(0)
    expect(visited.at(-1)).toBe('/seances/nouvelle?date=2026-11-25')
  })

  it('date effacée : « Choisis une date », rien créé', async () => {
    renderAt('/seances/nouvelle?date=2026-11-10')
    const push = await screen.findByRole('button', { name: /Push/ })
    fireEvent.change(screen.getByLabelText('Date de la séance'), { target: { value: '' } })
    await userEvent.click(push)
    expect(await screen.findByText('Choisis une date')).toBeInTheDocument()
    expect(screen.queryByText('La date ne peut pas être dans le futur')).not.toBeInTheDocument()
    expect(await db.sessions.count()).toBe(0)
  })

  it('date absente ou mal formée → aujourd\'hui ; l\'input est borné à aujourd\'hui', async () => {
    renderAt('/seances/nouvelle?date=pas-une-date')
    const input = screen.getByLabelText('Date de la séance')
    expect(input).toHaveValue('2026-11-20')
    expect(input).toHaveAttribute('max', '2026-11-20')
  })

  it('les programmes vides ne sont pas proposés', async () => {
    await db.templates.put({ id: 'tpl-vide', name: 'Vide', rotationOrder: 9 })
    renderAt('/seances/nouvelle')
    await screen.findByRole('button', { name: /Push/ })
    expect(screen.queryByRole('button', { name: /Vide/ })).not.toBeInTheDocument()
  })

  it('jour futur du calendrier : inerte', async () => {
    renderAt('/progression/calendrier?mois=2026-11')
    await screen.findByRole('heading', { name: 'novembre 2026' })
    const future = document.querySelector('[data-day="2026-11-25"]') as HTMLElement
    expect(future.tagName).toBe('SPAN')
  })
})
