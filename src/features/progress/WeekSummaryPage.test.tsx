import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { db } from '../../data/db'
import { seedIfEmpty } from '../../data/seed'
import { endSession, saveSet, startSession } from '../../data/repo'

type Perf = [exerciseId: string, weight: number, reps: number[]]

/** Séance terminée à la date locale donnée, avec ses séries validées (rattachées au template). */
async function session(at: Date, perfs: Perf[]) {
  const s = await startSession('tpl-push')
  const tes = await db.templateExercises.toArray()
  for (const [exerciseId, weight, reps] of perfs) {
    const templateExerciseId = tes.find((t) => t.exerciseId === exerciseId)?.id ?? null
    for (const [setIndex, r] of reps.entries()) {
      await saveSet({
        id: crypto.randomUUID(), sessionId: s.id, exerciseId, templateExerciseId, setIndex,
        plannedWeight: weight, plannedReps: r, weight, reps: r, done: true,
      })
    }
  }
  await endSession(s.id)
  await db.sessions.update(s.id, { startedAt: at.toISOString(), endedAt: at.toISOString() })
}

const RAISE = 'Standing_Low-Pulley_Deltoid_Raise'

/** Semaine courante = semaine du 16 nov. (2 séances), précédente = 9 nov. (1 séance). */
async function history() {
  await session(new Date(2026, 9, 26, 18), [[RAISE, 7.5, [13, 13, 13]]])
  await session(new Date(2026, 10, 2, 18), [[RAISE, 7.5, [13, 13, 13]]])
  await session(new Date(2026, 10, 9, 18), [
    ['Dumbbell_Bench_Press', 24, [12, 12, 12]],
    ['Machine_Bench_Press', 75, [12, 12, 12]],
    ['Butterfly', 45, [12, 12, 12]],
    [RAISE, 7.5, [13, 13, 13]],
    ['Barbell_Squat', 80, [8, 8, 8, 8]],
  ])
  await session(new Date(2026, 10, 16, 18), [
    ['Dumbbell_Bench_Press', 26, [12, 11, 10]],
    ['Machine_Bench_Press', 77.5, [11, 10, 9]],
    ['Butterfly', 45, [12, 12, 12]],
    [RAISE, 7.5, [13, 13, 13]],
  ])
  await session(new Date(2026, 10, 18, 18), [['Pullups', 0, [9, 8, 8]]])
}

function renderAt(path = '/progression') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 20, 12))
  await db.delete()
  await db.open()
  await seedIfEmpty()
  await history()
})

afterEach(() => {
  vi.useRealTimers()
})

const kpi = (label: string) => screen.getByText(label).closest('.p-card') as HTMLElement

describe('Progression', () => {
  it('bilan de la semaine courante : « 2 / 3 », records, une barre par groupe travaillé', async () => {
    renderAt()
    expect(await screen.findByText('Semaine du 16 nov.')).toBeInTheDocument()
    await waitFor(() => expect(kpi('Séances')).toHaveTextContent('2 / 3'))
    expect(kpi('Records')).toHaveTextContent('2')
    const bars = within(screen.getByRole('region', { name: 'Séries par muscle' })).getAllByRole('button')
    expect(bars.map((b) => b.textContent)).toEqual(['Pectoraux9', 'Dos3', 'Épaules3'])
    expect(screen.queryByRole('button', { name: 'Semaine suivante' })).not.toBeInTheDocument()
  })

  it('« Semaine précédente » charge la semaine d\'avant', async () => {
    renderAt()
    await screen.findByText('Semaine du 16 nov.')
    await userEvent.click(screen.getByRole('button', { name: 'Semaine précédente' }))
    expect(await screen.findByText('Semaine du 9 nov.')).toBeInTheDocument()
    await waitFor(() => expect(kpi('Séances')).toHaveTextContent('1 / 3'))
    const bars = within(screen.getByRole('region', { name: 'Séries par muscle' })).getAllByRole('button')
    expect(bars.map((b) => b.textContent)).toEqual(['Pectoraux9', 'Quadriceps4', 'Épaules3'])
    expect(screen.getByRole('button', { name: 'Semaine suivante' })).toBeInTheDocument()
  })

  it('semaine sans séance : invitation vers l\'onglet Séance', async () => {
    renderAt('/progression?semaine=2026-10-19')
    expect(await screen.findByText('Aucune séance cette semaine')).toBeInTheDocument()
  })

  it('un exercice qui stagne depuis 3 semaines porte le style stagnation', async () => {
    renderAt()
    const exercises = await screen.findByRole('region', { name: 'Exercices' })
    const raise = await within(exercises).findByRole('button', { name: /Élévation deltoïde/ })
    expect(within(raise).getByText('Stagne 3 sem.')).toHaveClass('delta-stall')
    const press = within(exercises).getByRole('button', { name: /Développé couché machine/ })
    expect(within(press).getByText('+2,5 kg')).toHaveClass('delta-up')
  })

  it('le tap sur « Pectoraux » ouvre le détail avec uniquement les exercices pectoraux', async () => {
    renderAt()
    const bars = await screen.findByRole('region', { name: 'Séries par muscle' })
    await userEvent.click(await within(bars).findByRole('button', { name: /Pectoraux/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Pectoraux' })).toBeInTheDocument()
    const list = await screen.findByRole('region', { name: 'Exercices de la semaine' })
    const names = within(list).getAllByRole('button').map((b) => b.querySelector('.p-ex-name')?.textContent)
    expect(names).toEqual(['Développé couché haltères', 'Développé couché machine', 'Pec deck'])
  })

  it('le tap sur un exercice ouvre sa courbe', async () => {
    renderAt()
    const exercises = await screen.findByRole('region', { name: 'Exercices' })
    await userEvent.click(await within(exercises).findByRole('button', { name: /Développé couché machine/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Développé couché machine' })).toBeInTheDocument()
    expect(screen.getByText('1RM estimé (kg)')).toBeInTheDocument()
    expect(document.querySelector('.p-hero-sub')).toHaveTextContent('+0,9 kg depuis le 9 nov.')
    const facts = screen.getByRole('region', { name: 'Repères' })
    expect(within(facts).getByText('Record')).toBeInTheDocument()
    expect(facts).toHaveTextContent('77,5 kg × 11')
  })
})
