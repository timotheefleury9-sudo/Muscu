import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { db } from '../../data/db'
import { seedIfEmpty } from '../../data/seed'
import { endSession, saveSet, startSession } from '../../data/repo'

type Perf = [exerciseId: string, sets: [weight: number, reps: number, done?: boolean][]]

async function session(at: Date, perfs: Perf[]) {
  const s = await startSession('tpl-push')
  for (const [exerciseId, sets] of perfs) {
    for (const [setIndex, [weight, reps, done = true]] of sets.entries()) {
      await saveSet({
        id: crypto.randomUUID(), sessionId: s.id, exerciseId, templateExerciseId: null, setIndex,
        plannedWeight: weight, plannedReps: reps, weight, reps, done,
      })
    }
  }
  await endSession(s.id)
  await db.sessions.update(s.id, { startedAt: at.toISOString(), endedAt: at.toISOString() })
}

const PRESS = 'Machine_Bench_Press'

function renderAt(path: string) {
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
  await session(new Date(2026, 10, 9, 18), [[PRESS, [[75, 12], [75, 12], [72.5, 12]]]])
  await session(new Date(2026, 10, 16, 18), [[PRESS, [[77.5, 12], [77.5, 11], [75, 10], [80, 3, false]]]])
  await session(new Date(2026, 10, 18, 18), [['Pullups', [[0, 12], [5, 8], [0, 10]]]])
})

afterEach(() => {
  vi.useRealTimers()
})

const hero = () => document.querySelector('.p-hero') as HTMLElement

describe('Courbe d\'un exercice', () => {
  it('par défaut : charge max (poids le plus lourd validé de la semaine)', async () => {
    renderAt(`/progression/exercice/${PRESS}?semaine=2026-11-16`)
    const load = await screen.findByRole('button', { name: 'Charge max' })
    expect(load).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '1RM estimé' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Charge max (kg)', { selector: '.p-chart-label' })).toBeInTheDocument()
    expect(hero()).toHaveTextContent('77,5kg')
    expect(hero()).toHaveTextContent('+2,5 kg depuis le 9 nov.')
  })

  it('« 1RM estimé » change le chiffre clé et la légende', async () => {
    renderAt(`/progression/exercice/${PRESS}?semaine=2026-11-16`)
    await userEvent.click(await screen.findByRole('button', { name: '1RM estimé' }))
    expect(screen.getByRole('button', { name: '1RM estimé' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('1RM estimé (kg)', { selector: '.p-chart-label' })).toBeInTheDocument()
    // e1RM : 77,5 × 12 = 108,5 ; 75 × 12 = 105.
    expect(hero()).toHaveTextContent('108,5kg')
    expect(hero()).toHaveTextContent('+3,5 kg depuis le 9 nov.')
  })

  it('« Dernières séances » : plus récente en premier, séries validées dans l\'ordre', async () => {
    renderAt(`/progression/exercice/${PRESS}?semaine=2026-11-16`)
    const log = await screen.findByRole('region', { name: 'Dernières séances' })
    const rows = within(log).getAllByRole('listitem')
    expect(rows.map((r) => r.querySelector('.p-log-date')?.textContent)).toEqual(['lun. 16 nov.', 'lun. 9 nov.'])
    expect(rows.map((r) => r.querySelector('.p-log-sets')?.textContent)).toEqual([
      '77,5 × 12 · 77,5 × 11 · 75 × 10',
      '75 × 12 · 75 × 12 · 72,5 × 12',
    ])
    expect(rows[0].querySelector('.p-log-top')).toHaveTextContent('77,5 × 12')
  })

  it('poids du corps : PDC / lest, pas de sélecteur si jamais lesté', async () => {
    await db.sets.toCollection().modify((s) => { s.weight = 0 })
    renderAt('/progression/exercice/Pullups?semaine=2026-11-16')
    const log = await screen.findByRole('region', { name: 'Dernières séances' })
    expect(within(log).getByRole('listitem').querySelector('.p-log-sets')).toHaveTextContent('PDC × 12 · PDC × 8 · PDC × 10')
    expect(screen.queryByRole('button', { name: 'Charge max' })).not.toBeInTheDocument()
    expect(screen.getByText('Répétitions', { selector: '.p-chart-label' })).toBeInTheDocument()
  })

  it('poids du corps lesté : « +5 × 8 »', async () => {
    renderAt('/progression/exercice/Pullups?semaine=2026-11-16')
    const log = await screen.findByRole('region', { name: 'Dernières séances' })
    expect(within(log).getByRole('listitem').querySelector('.p-log-sets')).toHaveTextContent('PDC × 12 · +5 × 8 · PDC × 10')
  })
})
