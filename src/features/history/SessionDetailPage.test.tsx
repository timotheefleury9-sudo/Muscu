import { useEffect } from 'react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { db } from '../../data/db'
import { loadAll, saveSet, startSession } from '../../data/repo'
import { seedIfEmpty } from '../../data/seed'
import { buildHistory } from '../../domain/history'
import { suggestNext } from '../../domain/progression'
import { pendingEditorWrites } from './useSessionEditor'

type Perf = [exerciseId: string, te: string | null, weight: number, reps: number[]]

/** Séance Push à l'instant local donné, séries validées ; terminée sauf si `open`. */
async function session(at: Date, perfs: Perf[], open = false): Promise<string> {
  const s = await startSession('tpl-push')
  for (const [exerciseId, te, weight, reps] of perfs) {
    for (const [setIndex, r] of reps.entries()) {
      await saveSet({
        id: crypto.randomUUID(), sessionId: s.id, exerciseId, templateExerciseId: te, setIndex,
        plannedWeight: weight, plannedReps: r, weight, reps: r, done: true,
      })
    }
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

let id: string
let openId: string

beforeEach(async () => {
  visited = []
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 20, 12))
  await db.delete()
  await db.open()
  await seedIfEmpty()
  // Pec deck saisi avant le développé couché machine : l'ordre affiché suit le programme.
  id = await session(new Date(2026, 10, 16, 18, 5), [
    ['Butterfly', 'tpl-push-2', 45, [12, 12]],
    ['Machine_Bench_Press', 'tpl-push-1', 80, [10, 10, 10]],
  ])
  openId = await session(new Date(2026, 10, 20, 11), [['Butterfly', 'tpl-push-2', 45, [12]]], true)
})

afterEach(async () => {
  cleanup()
  await pendingEditorWrites()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const sets = (exerciseId: string) => db.sets.where('sessionId').equals(id).filter((s) => s.exerciseId === exerciseId).sortBy('setIndex')
const bench = () => screen.findByRole('region', { name: 'Développé couché machine' })

describe('Détail d\'une séance', () => {
  it('en-tête date · heure, séance type, exercices dans l\'ordre du programme', async () => {
    renderAt(`/seances/${id}`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Push' })).toBeInTheDocument()
    expect(screen.getByText('lun. 16 nov. · 18:05')).toBeInTheDocument()
    expect(screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual(['Développé couché machine', 'Pec deck'])
    expect(screen.getByRole('link', { name: 'Progression' })).toHaveClass('active')
  })

  it('80 → 82,5 sur une série enregistre 82.5 et la proposition suivante part de 82,5', async () => {
    renderAt(`/seances/${id}`)
    const card = await bench()
    await userEvent.click(within(card).getByRole('button', { name: /^Série 1 : 80 kg × 10 répétitions/ }))
    const input = within(card).getByLabelText('Poids, kg')
    await userEvent.clear(input)
    await userEvent.type(input, '82,5')
    await pendingEditorWrites()
    expect((await sets('Machine_Bench_Press')).map((s) => s.weight)).toEqual([82.5, 80, 80])

    const data = await loadAll()
    const te = data.templateExercises.find((t) => t.id === 'tpl-push-1')!
    const ex = data.exercises.find((e) => e.id === 'Machine_Bench_Press')!
    const next = suggestNext(buildHistory(data, ex.id), te, ex)
    expect(next.kind === 'sets' && next.sets[0].weight).toBe(82.5)
  })

  it('dévalider une série enregistre done: false', async () => {
    renderAt(`/seances/${id}`)
    const card = await bench()
    await userEvent.click(within(card).getByRole('button', { name: 'Valider la série 2', pressed: true }))
    await pendingEditorWrites()
    expect((await sets('Machine_Bench_Press')).map((s) => s.done)).toEqual([true, false, true])
    expect(within(card).getByRole('button', { name: 'Valider la série 2', pressed: false })).toBeInTheDocument()
  })

  it('ajouter puis supprimer une série persiste', async () => {
    renderAt(`/seances/${id}`)
    const card = await bench()
    await userEvent.click(within(card).getByRole('button', { name: 'Ajouter une série' }))
    await pendingEditorWrites()
    let rows = await sets('Machine_Bench_Press')
    expect(rows).toHaveLength(4)
    expect(rows[3]).toMatchObject({ setIndex: 3, weight: 80, reps: 10, done: false, templateExerciseId: 'tpl-push-1' })

    await userEvent.click(within(card).getByRole('button', { name: /^Série 1 : 80 kg/ }))
    await userEvent.click(within(card).getByRole('button', { name: 'Supprimer la série 1' }))
    await pendingEditorWrites()
    rows = await sets('Machine_Bench_Press')
    expect(rows.map((s) => s.setIndex)).toEqual([1, 2, 3])
    await waitFor(() => expect(within(card).getAllByRole('button', { name: /^Valider la série/ })).toHaveLength(3))
  })

  it('« Modifier la date » vers la veille garde l\'heure ; une date future est refusée', async () => {
    renderAt(`/seances/${id}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Modifier la date' }))
    const input = screen.getByLabelText('Date de la séance')
    expect(input).toHaveAttribute('type', 'date')
    expect(input).toHaveAttribute('max', '2026-11-20')

    fireEvent.change(input, { target: { value: '2026-11-21' } })
    expect(await screen.findByText('La date ne peut pas être dans le futur')).toBeInTheDocument()
    await pendingEditorWrites()
    expect((await db.sessions.get(id))!.startedAt).toBe(new Date(2026, 10, 16, 18, 5).toISOString())

    fireEvent.change(input, { target: { value: '2026-11-15' } })
    await pendingEditorWrites()
    const s = (await db.sessions.get(id))!
    expect(s.startedAt).toBe(new Date(2026, 10, 15, 18, 5).toISOString())
    expect(s.endedAt).toBe(new Date(2026, 10, 15, 19, 5).toISOString())
    expect(await screen.findByText('dim. 15 nov. · 18:05')).toBeInTheDocument()
    expect(screen.queryByText('La date ne peut pas être dans le futur')).not.toBeInTheDocument()
  })

  it('« Retirer l\'exercice » puis confirmer supprime ses séries', async () => {
    renderAt(`/seances/${id}`)
    const card = await screen.findByRole('region', { name: 'Pec deck' })
    await userEvent.click(within(card).getByRole('button', { name: 'Retirer l\'exercice' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Retirer' }))
    await pendingEditorWrites()
    expect(await sets('Butterfly')).toHaveLength(0)
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Pec deck' })).not.toBeInTheDocument())
    expect(await sets('Machine_Bench_Press')).toHaveLength(3)
  })

  it('échec du retrait : bandeau « Enregistrement impossible… » et séries toujours affichées', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(db.sets, 'bulkDelete').mockRejectedValue(new DOMException('Quota dépassé', 'QuotaExceededError'))
    renderAt(`/seances/${id}`)
    const card = await screen.findByRole('region', { name: 'Pec deck' })
    await userEvent.click(within(card).getByRole('button', { name: 'Retirer l\'exercice' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Retirer' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/^Enregistrement impossible/)
    await pendingEditorWrites()
    const again = await screen.findByRole('region', { name: 'Pec deck' })
    expect(within(again).getAllByRole('button', { name: /^Valider la série/ })).toHaveLength(2)
    expect(await sets('Butterfly')).toHaveLength(2)
  })

  it('« Ajouter un exercice » ajoute une série vide hors template', async () => {
    renderAt(`/seances/${id}`)
    await screen.findByRole('heading', { level: 1, name: 'Push' })
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter un exercice' }))
    const picker = await screen.findByRole('dialog')
    await userEvent.type(within(picker).getByRole('searchbox', { name: 'Rechercher un exercice' }), 'Curl barre')
    await userEvent.click(within(picker).getAllByRole('button', { name: /^Curl barre/ })[0])
    await pendingEditorWrites()
    const added = await db.sets.where('sessionId').equals(id).filter((s) => s.templateExerciseId === null).toArray()
    expect(added).toHaveLength(1)
    expect(added[0]).toMatchObject({ setIndex: 3, weight: 0, reps: 0, done: false })
    const regions = await screen.findAllByRole('region')
    expect(regions).toHaveLength(3)
    expect(regions[2]).toHaveAccessibleName(/^Curl barre/)
  })

  it('« Supprimer la séance » + confirmation : séance et séries absentes, retour au calendrier du mois', async () => {
    renderAt(`/seances/${id}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer la séance' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Supprimer cette séance ?')
    expect(dialog).toHaveTextContent('C\'est définitif.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }))
    await waitFor(() => expect(visited.at(-1)).toBe('/progression/calendrier?mois=2026-11'))
    expect(await db.sessions.get(id)).toBeUndefined()
    expect(await db.sets.where('sessionId').equals(id).count()).toBe(0)
  })

  it('séance vidée : reste affichée', async () => {
    renderAt(`/seances/${id}`)
    for (const name of ['Pec deck', 'Développé couché machine']) {
      const card = await screen.findByRole('region', { name })
      await userEvent.click(within(card).getByRole('button', { name: 'Retirer l\'exercice' }))
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Retirer' }))
      await waitFor(() => expect(screen.queryByRole('region', { name })).not.toBeInTheDocument())
    }
    await pendingEditorWrites()
    expect(await db.sessions.get(id)).toBeDefined()
    expect(screen.getByRole('heading', { level: 1, name: 'Push' })).toBeInTheDocument()
    expect(screen.getByText('Aucune série dans cette séance.')).toBeInTheDocument()
  })

  it('l\'id de la séance en cours ouvre l\'onglet Séance', async () => {
    renderAt(`/seances/${openId}`)
    await waitFor(() => expect(visited.at(-1)).toBe('/'))
    expect(screen.getByRole('link', { name: 'Séance' })).toHaveClass('active')
  })

  it('séance inconnue : message', async () => {
    renderAt('/seances/inconnue')
    expect(await screen.findByText('Cette séance n\'existe plus.')).toBeInTheDocument()
  })
})
