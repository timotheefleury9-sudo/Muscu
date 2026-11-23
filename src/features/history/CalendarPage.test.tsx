import { useEffect } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { db } from '../../data/db'
import { seedIfEmpty } from '../../data/seed'
import { endSession, saveSet, startSession } from '../../data/repo'

type Perf = [exerciseId: string, weight: number, reps: number[]]

/** Séance à la date locale donnée, avec ses séries validées ; terminée sauf si `open`. */
async function session(at: Date, perfs: Perf[], open = false): Promise<string> {
  const s = await startSession('tpl-push')
  for (const [exerciseId, weight, reps] of perfs) {
    for (const [setIndex, r] of reps.entries()) {
      await saveSet({
        id: crypto.randomUUID(), sessionId: s.id, exerciseId, templateExerciseId: null, setIndex,
        plannedWeight: weight, plannedReps: r, weight, reps: r, done: true,
      })
    }
  }
  if (!open) await endSession(s.id)
  await db.sessions.update(s.id, { startedAt: at.toISOString(), endedAt: open ? null : at.toISOString() })
  return s.id
}

let ids: Record<string, string>

/** Octobre : 26 ; novembre : 2, 16 (deux séances), 18 ; 20 : séance en cours. */
async function history() {
  ids = {
    oct26: await session(new Date(2026, 9, 26, 18), [['Butterfly', 45, [12, 12]]]),
    nov2: await session(new Date(2026, 10, 2, 18), [['Butterfly', 45, [12, 12, 12]]]),
    nov16am: await session(new Date(2026, 10, 16, 9, 30), [['Pullups', 0, [9]]]),
    nov16: await session(new Date(2026, 10, 16, 18, 5), [
      ['Dumbbell_Bench_Press', 26, [12, 11, 10]],
      ['Machine_Bench_Press', 77.5, [11, 10, 9]],
      ['Butterfly', 45, [12, 12, 12]],
      ['Standing_Low-Pulley_Deltoid_Raise', 7.5, [13, 13, 13]],
      ['Barbell_Squat', 80, [8, 8, 8]],
    ]),
    nov18: await session(new Date(2026, 10, 18, 18), [['Pullups', 0, [9, 8, 8]]]),
    nov20: await session(new Date(2026, 10, 20, 11), [['Butterfly', 45, [12]]], true),
  }
}

/** Toutes les adresses visitées (les écrans /seances/… arrivent avec les tâches suivantes). */
let visited: string[]
function Probe() {
  const { pathname, search } = useLocation()
  useEffect(() => { visited.push(pathname + search) }, [pathname, search])
  return null
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Probe />
      <App />
    </MemoryRouter>,
  )
}

beforeEach(async () => {
  visited = []
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

const pillDays = () =>
  Array.from(document.querySelectorAll('.h-pill')).map((p) => (p.closest('[data-day]') as HTMLElement).dataset.day)

describe('Calendrier', () => {
  it('toucher « Semaine du 16 nov. » ouvre le calendrier de novembre 2026', async () => {
    renderAt('/progression')
    await userEvent.click(await screen.findByRole('button', { name: /Semaine du 16 nov\./ }))
    expect(await screen.findByRole('heading', { name: 'novembre 2026' })).toBeInTheDocument()
    expect(visited.at(-1)).toBe('/progression/calendrier?mois=2026-11')
    expect(screen.getByRole('link', { name: 'Progression' })).toHaveClass('active')
  })

  it('pastilles exactement sur les jours avec séance, flèche › absente sur le mois courant', async () => {
    renderAt('/progression/calendrier?mois=2026-11')
    await screen.findByRole('heading', { name: 'novembre 2026' })
    await waitFor(() => expect(pillDays()).toEqual(['2026-11-02', '2026-11-16', '2026-11-18', '2026-11-20']))
    expect(screen.queryByRole('button', { name: 'Mois suivant' })).not.toBeInTheDocument()
    expect(document.querySelector('[aria-current="date"]')).toHaveAttribute('data-day', '2026-11-20')
  })

  it('« Mois précédent » affiche octobre et sa pastille, puis › revient', async () => {
    renderAt('/progression/calendrier?mois=2026-11')
    await screen.findByRole('heading', { name: 'novembre 2026' })
    await userEvent.click(screen.getByRole('button', { name: 'Mois précédent' }))
    expect(await screen.findByRole('heading', { name: 'octobre 2026' })).toBeInTheDocument()
    await waitFor(() => expect(pillDays()).toEqual(['2026-10-26']))
    expect(screen.getByRole('button', { name: 'Mois suivant' })).toBeInTheDocument()
  })

  it('un mois futur demandé dans l\'adresse est ramené au mois courant', async () => {
    renderAt('/progression/calendrier?mois=2027-02')
    expect(await screen.findByRole('heading', { name: 'novembre 2026' })).toBeInTheDocument()
  })

  it('toucher un jour à une séance ouvre /seances/<id>', async () => {
    renderAt('/progression/calendrier?mois=2026-11')
    await waitFor(() => expect(pillDays()).toHaveLength(4))
    await userEvent.click(document.querySelector('[data-day="2026-11-18"]') as HTMLElement)
    await waitFor(() => expect(visited).toContain(`/seances/${ids.nov18}`))
  })

  it('jour à deux séances : feuille avec deux choix « heure · séance type »', async () => {
    renderAt('/progression/calendrier?mois=2026-11')
    await waitFor(() => expect(pillDays()).toHaveLength(4))
    await userEvent.click(document.querySelector('[data-day="2026-11-16"]') as HTMLElement)
    const sheet = await screen.findByRole('dialog', { name: 'lundi 16 novembre' })
    const choices = within(sheet).getAllByRole('button').filter((b) => b.textContent !== 'Annuler')
    expect(choices.map((b) => b.textContent)).toEqual(['09:30 · Push', '18:05 · Push'])
    await userEvent.click(choices[1])
    await waitFor(() => expect(visited).toContain(`/seances/${ids.nov16}`))
  })

  it('toucher la semaine revient au bilan de cette semaine', async () => {
    renderAt('/progression/calendrier?mois=2026-11')
    await screen.findByRole('heading', { name: 'novembre 2026' })
    await userEvent.click(screen.getByRole('button', { name: 'Bilan de la semaine du 9 nov.' }))
    expect(await screen.findByText('Semaine du 9 nov.')).toBeInTheDocument()
    expect(visited.at(-1)).toBe('/progression?semaine=2026-11-09')
  })

  it('« Ajouter une séance » ouvre /seances/nouvelle', async () => {
    renderAt('/progression/calendrier?mois=2026-11')
    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter une séance' }))
    await waitFor(() => expect(visited).toContain('/seances/nouvelle'))
  })

  it('« Toutes mes séances » : groupées par mois, plus récentes d\'abord, libellé exact', async () => {
    renderAt('/progression/calendrier?mois=2026-11')
    await userEvent.click(await screen.findByRole('button', { name: 'Toutes mes séances' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Toutes mes séances' })).toBeInTheDocument()
    expect(visited.at(-1)).toBe('/progression/seances')
    const nov = await screen.findByRole('region', { name: 'novembre 2026' })
    const rows = within(nov).getAllByRole('button').map((b) => b.textContent)
    expect(rows).toEqual([
      'ven. 20 nov. · Push · 1 exercice · 1 sérieEn cours',
      'mer. 18 nov. · Push · 1 exercice · 3 séries',
      'lun. 16 nov. · Push · 5 exercices · 15 séries',
      'lun. 16 nov. · Push · 1 exercice · 1 série',
      'lun. 2 nov. · Push · 1 exercice · 3 séries',
    ])
    const oct = screen.getByRole('region', { name: 'octobre 2026' })
    expect(within(oct).getAllByRole('button').map((b) => b.textContent)).toEqual(['lun. 26 oct. · Push · 1 exercice · 2 séries'])
    await userEvent.click(within(nov).getAllByRole('button')[2])
    await waitFor(() => expect(visited).toContain(`/seances/${ids.nov16}`))
  })
})
