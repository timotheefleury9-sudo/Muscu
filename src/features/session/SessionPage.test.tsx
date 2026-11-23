import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { db } from '../../data/db'
import { seedIfEmpty } from '../../data/seed'
import { endSession, saveSet, startSession } from '../../data/repo'
import SessionPage from './SessionPage'
import { pendingWrites } from './useSession'

afterEach(async () => {
  // Démonte puis laisse finir les écritures en file avant que le test suivant ne vide la base.
  cleanup()
  await pendingWrites()
  vi.restoreAllMocks()
})

beforeEach(async () => {
  await db.delete()
  await db.open()
  await seedIfEmpty()
})

/** Séance passée terminée, avec ses séries validées. */
async function pastSession(templateId: string, startedAt: string, sets: { exerciseId: string; te: string; weight: number; reps: number[] }[]) {
  const s = await startSession(templateId)
  for (const x of sets) {
    for (const [setIndex, reps] of x.reps.entries()) {
      await saveSet({
        id: crypto.randomUUID(), sessionId: s.id, exerciseId: x.exerciseId, templateExerciseId: x.te, setIndex,
        plannedWeight: x.weight, plannedReps: reps, weight: x.weight, reps, done: true,
      })
    }
  }
  await endSession(s.id)
  await db.sessions.update(s.id, { startedAt, endedAt: startedAt })
}

/** Push la semaine dernière, puis Legs : la rotation propose Push. */
async function withHistory() {
  await pastSession('tpl-push', '2026-11-16T17:00:00.000Z', [
    { exerciseId: 'Dumbbell_Bench_Press', te: 'tpl-push-0', weight: 26, reps: [12, 11, 10] },
    { exerciseId: 'Machine_Bench_Press', te: 'tpl-push-1', weight: 80, reps: [12, 12, 12] },
  ])
  await pastSession('tpl-legs', '2026-11-20T17:00:00.000Z', [{ exerciseId: 'Barbell_Squat', te: 'tpl-legs-0', weight: 100, reps: [6] }])
}

const doneSets = () => db.sets.filter((s) => s.done && s.sessionId !== '').toArray()
const openSession = async () => (await db.sessions.toArray()).find((s) => s.endedAt === null)

describe('SessionPage', () => {
  it('un programme vide ajouté à la rotation est sauté', async () => {
    await withHistory() // dernière séance : Legs
    await db.templates.put({ id: 'tpl-new', name: 'Nouveau programme', rotationOrder: 3 })
    render(<SessionPage />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Push' })).toBeInTheDocument()
  })

  it('programme choisi sans exercice : état vide avec lien vers Programmes', async () => {
    await db.templateExercises.clear()
    render(<MemoryRouter><SessionPage /></MemoryRouter>)
    expect(await screen.findByText('Ce programme est vide')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ouvrir Programmes' })).toHaveAttribute('href', '/programmes')
    expect(screen.queryByRole('button', { name: 'Terminer la séance' })).not.toBeInTheDocument()
  })

  it('affiche « Push » et 5 exercices', async () => {
    render(<SessionPage />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Push' })).toBeInTheDocument()
    expect(screen.getAllByRole('region')).toHaveLength(5)
    expect(document.querySelector('.session-count')).toHaveTextContent('Exercice 1 sur 5')
  })

  it('après une séance précédente à 80×12 ×3, les séries affichent 82,5 × 8', async () => {
    await withHistory()
    render(<SessionPage />)
    await userEvent.click(await screen.findByRole('button', { name: /Développé couché machine/ }))
    const card = screen.getByRole('region', { name: 'Développé couché machine' })
    await waitFor(() => expect(within(card).getAllByRole('button', { name: /82,5 kg × 8 répétitions/ })).toHaveLength(3))
  })

  it('le tap sur une série la marque done en base', async () => {
    await withHistory()
    render(<SessionPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Valider la série 1' }))
    await waitFor(async () => expect(await doneSets()).toHaveLength(1 + 3 + 3 + 1))
    const open = await openSession()
    expect(open?.templateId).toBe('tpl-push')
    const mine = (await db.sets.where('sessionId').equals(open!.id).toArray()).filter((s) => s.done)
    expect(mine).toHaveLength(1)
    expect(mine[0]).toMatchObject({ exerciseId: 'Dumbbell_Bench_Press', weight: 26, reps: 12, plannedWeight: 26, plannedReps: 12 })
  })

  it('après démontage puis remontage, la séance ouverte et ses séries validées réapparaissent', async () => {
    await withHistory()
    const first = render(<SessionPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Valider la série 1' }))
    await waitFor(async () => expect((await openSession()) && (await db.sets.count())).toBeGreaterThan(8))
    const id = (await openSession())!.id
    await waitFor(async () => expect((await db.sets.where('sessionId').equals(id).toArray()).filter((s) => s.done)).toHaveLength(1))
    first.unmount()

    render(<SessionPage />)
    const check = await screen.findByRole('button', { name: 'Valider la série 1' })
    expect(check).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Valider la série 2' })).toHaveAttribute('aria-pressed', 'false')
    expect((await db.sessions.toArray()).filter((s) => s.endedAt === null).map((s) => s.id)).toEqual([id])
  })

  it('la saisie « 77,5 » dans le champ poids enregistre 77.5', async () => {
    render(<SessionPage />)
    const input = await screen.findByLabelText('Poids, kg')
    await userEvent.type(input, '77,5')
    await waitFor(async () => {
      const sets = await db.sets.filter((s) => s.exerciseId === 'Dumbbell_Bench_Press' && s.setIndex === 0).toArray()
      expect(sets.map((s) => s.weight)).toEqual([77.5])
    })
    expect(input).toHaveValue('77,5')
  })

  it('un exercice jamais fait affiche des champs vides à remplir', async () => {
    render(<SessionPage />)
    expect(await screen.findByLabelText('Poids, kg')).toHaveValue('')
    expect(screen.getByLabelText('Répétitions')).toHaveValue('')
    expect(screen.getByRole('button', { name: /Série 1 : à remplir/ })).toBeInTheDocument()
  })

  it('valider une série vide ouvre la saisie au lieu de la valider', async () => {
    render(<SessionPage />)
    await screen.findByLabelText('Poids, kg')
    await userEvent.click(screen.getByRole('button', { name: 'Valider la série 2' }))
    expect(screen.getByRole('button', { name: 'Valider la série 2' })).toHaveAttribute('aria-pressed', 'false')
    expect(await doneSets()).toHaveLength(0)
  })

  it('les boutons +/− suivent l’incrément de l’exercice et sont enregistrés', async () => {
    await withHistory()
    render(<SessionPage />)
    await screen.findByRole('button', { name: 'Valider la série 1' })
    await userEvent.click(screen.getByRole('button', { name: 'Plus de poids' }))
    await userEvent.click(screen.getByRole('button', { name: 'Moins de répétitions' }))
    expect(screen.getByLabelText('Poids, kg')).toHaveValue('28')
    await waitFor(async () => {
      const open = await openSession()
      const s = open && (await db.sets.where('sessionId').equals(open.id).toArray()).find((x) => x.exerciseId === 'Dumbbell_Bench_Press' && x.setIndex === 0)
      expect(s).toMatchObject({ weight: 28, reps: 11 })
    })
  })

  it('valider les 3 séries replie l’exercice (3/3) et ouvre le suivant', async () => {
    await withHistory()
    render(<SessionPage />)
    for (const n of [1, 2, 3]) await userEvent.click(await screen.findByRole('button', { name: `Valider la série ${n}` }))
    await waitFor(() => expect(document.querySelector('.session-count')).toHaveTextContent('Exercice 2 sur 5'))
    expect(await screen.findByRole('button', { name: /Développé couché haltères.*3\/3/ })).toBeInTheDocument()
  })

  it('ajouter une série l’enregistre', async () => {
    await withHistory()
    render(<SessionPage />)
    await screen.findByRole('button', { name: 'Valider la série 1' })
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter une série' }))
    expect(await screen.findByRole('button', { name: 'Valider la série 4' })).toBeInTheDocument()
    await waitFor(async () => {
      const open = await openSession()
      expect(open && (await db.sets.where('sessionId').equals(open.id).filter((s) => s.exerciseId === 'Dumbbell_Bench_Press').count())).toBe(4)
    })
  })

  it('« Terminer la séance » demande confirmation puis clôt la séance', async () => {
    await withHistory()
    render(<SessionPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Valider la série 1' }))
    await userEvent.click(screen.getByRole('button', { name: 'Terminer la séance' }))
    const dialog = await screen.findByRole('dialog', { name: 'Terminer la séance ?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Terminer' }))
    await waitFor(async () => expect(await openSession()).toBeUndefined())
    expect(await screen.findByRole('heading', { level: 1, name: 'Pull' })).toBeInTheDocument()
  })

  it('permet de choisir une autre séance avant de commencer', async () => {
    render(<SessionPage />)
    await screen.findByRole('heading', { level: 1, name: 'Push' })
    await userEvent.click(screen.getByRole('button', { name: 'Legs' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Legs' })).toBeInTheDocument()
    expect(screen.getAllByRole('region')).toHaveLength(4)
  })

  it('clôt automatiquement une séance ouverte depuis plus de 6 h', async () => {
    const s = await startSession('tpl-pull')
    await db.sessions.update(s.id, { startedAt: new Date(Date.now() - 7 * 3600_000).toISOString() })
    render(<SessionPage />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Push' })).toBeInTheDocument()
    expect((await db.sessions.get(s.id))?.endedAt).not.toBeNull()
  })

  it('un échec d’enregistrement affiche un message persistant et resynchronise depuis la base', async () => {
    await withHistory()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(db.sets, 'put').mockRejectedValue(new DOMException('Quota dépassé', 'QuotaExceededError'))
    render(<SessionPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Valider la série 1' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("Enregistrement impossible — tes dernières saisies n'ont pas été sauvegardées")
    // L'écran reflète la base : la série n'apparaît pas validée.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Valider la série 1', pressed: true })).not.toBeInTheDocument())
    expect(await doneSets()).toHaveLength(7)
    expect(error).toHaveBeenCalled()
    // Rien de partiel en base : pas de séance ouverte vide, et les séries proposées sont toujours là.
    expect(await openSession()).toBeUndefined()
    const card = screen.getByRole('region', { name: 'Développé couché haltères' })
    expect(within(card).getAllByRole('button', { name: /^Série \d : 26 kg × 1[012] répétitions/ })).toHaveLength(3)
    // Le message reste jusqu'à ce qu'on le ferme.
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    await userEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Fermer' }))
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
  })

  it('« Séance enregistrée » n’est pas annoncé si la clôture échoue', async () => {
    await withHistory()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<SessionPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Valider la série 1' }))
    await waitFor(async () => expect(await openSession()).toBeDefined())
    vi.spyOn(db.sessions, 'update').mockRejectedValue(new Error('échec'))
    await userEvent.click(screen.getByRole('button', { name: 'Terminer la séance' }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Terminer' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.queryByText('Séance enregistrée')).not.toBeInTheDocument()
  })
})
