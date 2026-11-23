import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../App'
import { db } from '../../data/db'
import { endSession, listTemplateExercises, saveSet, startSession } from '../../data/repo'
import { seedIfEmpty } from '../../data/seed'
import { pendingProgramWrites } from './usePrograms'

afterEach(async () => {
  cleanup()
  await pendingProgramWrites()
  vi.restoreAllMocks()
})

beforeEach(async () => {
  await db.delete()
  await db.open()
  await seedIfEmpty()
})

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

const rowsOf = async (templateId: string) => {
  const exos = new Map((await db.exercises.toArray()).map((e) => [e.id, e.name]))
  return (await listTemplateExercises(templateId)).map((te) => ({ ...te, name: exos.get(te.exerciseId) }))
}

async function openPicker(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Ajouter un exercice' }))
  return screen.findByRole('dialog', { name: 'Ajouter un exercice' })
}

describe('TemplateEditor', () => {
  it('ajouter un exercice, le monter d\'un cran et passer la fourchette à 6–10 met à jour order, repsMin et repsMax en base', async () => {
    const user = userEvent.setup()
    renderAt('/programmes/tpl-legs')
    const picker = await openPicker(user)
    await user.type(within(picker).getByRole('searchbox', { name: 'Rechercher un exercice' }), 'leg curl allonge')
    await user.click(within(picker).getByText('Leg curl allongé'))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Ajouter un exercice' })).not.toBeInTheDocument())

    await waitFor(async () => expect((await rowsOf('tpl-legs')).map((r) => r.name)).toContain('Leg curl allongé'))
    const added = (await rowsOf('tpl-legs')).find((r) => r.name === 'Leg curl allongé')!
    // Isolation : réglages par défaut 3 × 10–15, repos 90 s, en dernière position.
    expect(added).toMatchObject({ order: 4, sets: 3, repsMin: 10, repsMax: 15, restSec: 90 })

    // La ligne ajoutée est ouverte.
    const row = screen.getByRole('listitem', { name: 'Leg curl allongé' })
    await user.click(within(row).getByRole('button', { name: 'Monter' }))
    const min = within(row).getByRole('textbox', { name: 'Répétitions min' })
    const max = within(row).getByRole('textbox', { name: 'Répétitions max' })
    await user.clear(min)
    await user.type(min, '6')
    await user.clear(max)
    await user.type(max, '10')

    await waitFor(async () => {
      const rows = await rowsOf('tpl-legs')
      expect(rows.map((r) => r.name)).toEqual([
        'Squat barre', 'Soulevé de terre barre', 'Fentes marchées avec sac à dos lesté', 'Leg curl allongé', 'Leg extension',
      ])
      expect(rows.map((r) => r.order)).toEqual([0, 1, 2, 3, 4])
      expect(rows[3]).toMatchObject({ repsMin: 6, repsMax: 10 })
    })
  })

  it('une fourchette invalide est signalée en ligne et n\'est pas enregistrée ; les boutons respectent les bornes', async () => {
    const user = userEvent.setup()
    renderAt('/programmes/tpl-push')
    await user.click(await screen.findByRole('button', { name: /^Pec deck/ }))
    const row = screen.getByRole('listitem', { name: 'Pec deck' })
    const max = within(row).getByRole('textbox', { name: 'Répétitions max' })
    await user.clear(max)
    await user.type(max, '8')
    expect(within(row).getByText('Le maximum doit être au moins égal au minimum.')).toBeInTheDocument()
    await pendingProgramWrites()
    expect((await db.templateExercises.get('tpl-push-2'))!.repsMax).toBe(15)
    await user.clear(max)
    await user.type(max, '15')
    expect(within(row).queryByRole('alert')).not.toBeInTheDocument()

    // Repos : par pas de 15 s.
    await user.click(within(row).getByRole('button', { name: 'Plus de repos' }))
    await waitFor(async () => expect((await db.templateExercises.get('tpl-push-2'))!.restSec).toBe(105))
    // Séries : jamais sous 1.
    const sets = within(row).getByRole('textbox', { name: 'Séries' })
    await user.clear(sets)
    await user.type(sets, '1')
    await waitFor(async () => expect((await db.templateExercises.get('tpl-push-2'))!.sets).toBe(1))
    expect(within(row).getByRole('button', { name: 'Moins de séries' })).toBeDisabled()
  })

  it('retirer un exercice demande confirmation et conserve l\'historique', async () => {
    const s = await startSession('tpl-push')
    await saveSet({
      id: 'set-1', sessionId: s.id, exerciseId: 'Butterfly', templateExerciseId: 'tpl-push-2', setIndex: 0,
      plannedWeight: 40, plannedReps: 12, weight: 40, reps: 12, done: true,
    })
    await endSession(s.id)
    const user = userEvent.setup()
    renderAt('/programmes/tpl-push')
    await user.click(await screen.findByRole('button', { name: /^Pec deck/ }))
    await user.click(within(screen.getByRole('listitem', { name: 'Pec deck' })).getByRole('button', { name: 'Retirer' }))

    const sheet = screen.getByRole('dialog', { name: 'Retirer « Pec deck » ?' })
    await user.click(within(sheet).getByRole('button', { name: 'Annuler' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Retirer/ })).not.toBeInTheDocument())
    expect(await db.templateExercises.get('tpl-push-2')).toBeDefined()

    await user.click(within(screen.getByRole('listitem', { name: 'Pec deck' })).getByRole('button', { name: 'Retirer' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Retirer « Pec deck » ?' })).getByRole('button', { name: 'Retirer' }))
    await waitFor(async () => expect(await db.templateExercises.get('tpl-push-2')).toBeUndefined())
    expect(screen.queryByRole('listitem', { name: 'Pec deck' })).not.toBeInTheDocument()
    expect(await db.sets.get('set-1')).toBeDefined()
  })

  it('renomme le programme en ligne ; un nom vide est refusé', async () => {
    const user = userEvent.setup()
    renderAt('/programmes/tpl-push')
    const name = await screen.findByRole('textbox', { name: 'Nom du programme' })
    await user.clear(name)
    await user.type(name, 'Poussée{Enter}')
    await waitFor(async () => expect((await db.templates.get('tpl-push'))!.name).toBe('Poussée'))

    await user.clear(name)
    await user.tab()
    expect(name).toHaveValue('Poussée')
    await pendingProgramWrites()
    expect((await db.templates.get('tpl-push'))!.name).toBe('Poussée')
  })

  it('le sélecteur filtre par groupe et masque étirements et cardio par défaut', async () => {
    const user = userEvent.setup()
    renderAt('/programmes/tpl-push')
    const picker = await openPicker(user)
    await user.click(within(picker).getByRole('button', { name: 'Pectoraux' }))
    expect(within(picker).getByText('Développé couché haltères')).toBeInTheDocument()
    expect(within(picker).queryByText('Squat barre')).not.toBeInTheDocument()
    expect(within(picker).queryByText('Étirement pectoraux sur ballon')).not.toBeInTheDocument()

    await user.click(within(picker).getByRole('switch', { name: 'Afficher étirements et cardio' }))
    expect(within(picker).getByText('Étirement pectoraux sur ballon')).toBeInTheDocument()

    await user.click(within(picker).getByRole('button', { name: 'Fermer' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Ajouter un exercice' })).not.toBeInTheDocument())
  })

  it('la création d\'un exercice personnalisé exige un nom et un groupe : erreur affichée en ligne si l\'un manque', async () => {
    const user = userEvent.setup()
    renderAt('/programmes/tpl-push')
    const picker = await openPicker(user)
    await user.click(within(picker).getByRole('button', { name: 'Créer un exercice' }))
    const count = await db.exercises.count()

    await user.click(within(picker).getByRole('button', { name: 'Créer et ajouter' }))
    expect(within(picker).getByText('Donne un nom à l\'exercice.')).toBeInTheDocument()
    expect(within(picker).getByText('Choisis un groupe musculaire.')).toBeInTheDocument()

    await user.type(within(picker).getByRole('textbox', { name: 'Nom' }), 'Écarté au sol')
    await user.click(within(picker).getByRole('button', { name: 'Créer et ajouter' }))
    expect(within(picker).queryByText('Donne un nom à l\'exercice.')).not.toBeInTheDocument()
    expect(within(picker).getByText('Choisis un groupe musculaire.')).toBeInTheDocument()

    await user.click(within(picker).getByRole('radio', { name: 'Pectoraux' }))
    const inc = within(picker).getByRole('textbox', { name: 'Incrément (kg)' })
    expect(inc).toHaveValue('2,5')
    await user.clear(inc)
    await user.type(inc, '0')
    await user.click(within(picker).getByRole('button', { name: 'Créer et ajouter' }))
    expect(within(picker).getByText('Saisis un incrément supérieur à 0 (ex. 2,5).')).toBeInTheDocument()
    expect(await db.exercises.count()).toBe(count)

    await user.clear(inc)
    await user.type(inc, '1,5')
    await user.click(within(picker).getByRole('radio', { name: 'Isolation' }))
    await user.click(within(picker).getByRole('button', { name: 'Créer et ajouter' }))

    await waitFor(async () => expect(await db.exercises.count()).toBe(count + 1))
    const ex = (await db.exercises.toArray()).find((e) => e.name === 'Écarté au sol')!
    expect(ex).toMatchObject({ custom: true, primaryGroup: 'pectoraux', increment: 1.5, kind: 'isolation', bodyweight: false })
    await waitFor(async () => expect((await rowsOf('tpl-push')).at(-1)).toMatchObject({ exerciseId: ex.id, order: 5 }))
    expect(screen.getByRole('listitem', { name: 'Écarté au sol' })).toBeInTheDocument()
  })

  it('supprime un programme après confirmation, sans toucher à l\'historique ; le dernier ne peut pas être supprimé', async () => {
    const s = await startSession('tpl-pull')
    await endSession(s.id)
    const user = userEvent.setup()
    renderAt('/programmes/tpl-pull')
    await user.click(await screen.findByRole('button', { name: 'Supprimer le programme' }))
    await user.click(within(screen.getByRole('dialog', { name: 'Supprimer « Pull » ?' })).getByRole('button', { name: 'Supprimer' }))

    expect(await screen.findByRole('heading', { name: 'Programmes' })).toBeInTheDocument()
    await waitFor(async () => expect(await db.templates.get('tpl-pull')).toBeUndefined())
    expect(await db.templateExercises.where('templateId').equals('tpl-pull').count()).toBe(0)
    expect(await db.sessions.get(s.id)).toBeDefined()
    expect(screen.queryByRole('button', { name: /^Pull/ })).not.toBeInTheDocument()

    await db.templates.delete('tpl-legs')
    cleanup()
    renderAt('/programmes/tpl-push')
    expect(await screen.findByRole('button', { name: 'Supprimer le programme' })).toBeDisabled()
    expect(screen.getByText('Garde au moins un programme.')).toBeInTheDocument()
  })

  it('un échec d\'enregistrement est signalé et l\'écran revient à l\'état sauvegardé', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(db.templateExercises, 'put').mockRejectedValue(new DOMException('Quota dépassé', 'QuotaExceededError'))
    const user = userEvent.setup()
    renderAt('/programmes/tpl-push')
    await user.click(await screen.findByRole('button', { name: /^Pec deck/ }))
    const row = screen.getByRole('listitem', { name: 'Pec deck' })
    await user.click(within(row).getByRole('button', { name: 'Plus de séries' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Enregistrement impossible')
    await waitFor(() => expect(within(row).getByRole('textbox', { name: 'Séries' })).toHaveValue('3'))
    expect((await db.templateExercises.get('tpl-push-2'))!.sets).toBe(3)
  })
})

describe('ProgramsPage', () => {
  it('liste les programmes dans l\'ordre de la rotation et en crée un nouveau', async () => {
    const user = userEvent.setup()
    renderAt('/programmes')
    const list = await screen.findByRole('list', { name: 'Programmes' })
    expect(within(list).getAllByRole('button').map((b) => b.textContent)).toEqual([
      expect.stringContaining('Push'), expect.stringContaining('Pull'), expect.stringContaining('Legs'),
    ])
    expect(within(list).getByRole('button', { name: /^Legs/ })).toHaveTextContent('4 exercices')

    await user.click(screen.getByRole('button', { name: 'Nouveau programme' }))
    expect(await screen.findByRole('textbox', { name: 'Nom du programme' })).toHaveValue('Nouveau programme')
    expect(screen.getByText('Aucun exercice pour l\'instant.')).toBeInTheDocument()
    await waitFor(async () => expect((await db.templates.toArray()).find((t) => t.name === 'Nouveau programme')).toMatchObject({ rotationOrder: 3 }))
  })
})
