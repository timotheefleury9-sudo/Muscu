import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { listExercises, listTemplateExercises, listTemplates } from './repo'
import { seedIfEmpty } from './seed'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

async function rows(templateName: string) {
  const t = (await listTemplates()).find((x) => x.name === templateName)!
  const exos = new Map((await listExercises()).map((e) => [e.id, e]))
  return (await listTemplateExercises(t.id)).map((te) => ({ te, ex: exos.get(te.exerciseId)! }))
}

describe('seedIfEmpty', () => {
  it('crée Push, Pull, Legs avec rotationOrder 0, 1, 2', async () => {
    await seedIfEmpty()
    const ts = await listTemplates()
    expect(ts.map((t) => [t.name, t.rotationOrder])).toEqual([['Push', 0], ['Pull', 1], ['Legs', 2]])
  })

  it('les séances contiennent 5, 5 et 4 exercices dans l\'ordre du spec', async () => {
    await seedIfEmpty()
    expect((await rows('Push')).map((r) => r.ex.name)).toEqual([
      'Développé couché haltères', 'Développé couché machine', 'Pec deck', 'Extension triceps poulie haute', 'Élévation deltoïde poulie basse debout',
    ])
    expect((await rows('Pull')).map((r) => r.ex.name)).toEqual([
      'Tractions', 'Rowing machine iso-latérale', 'Tirage horizontal poulie assis', 'Oiseau à la machine', 'Curl biceps haltères',
    ])
    expect((await rows('Legs')).map((r) => r.ex.name)).toEqual([
      'Squat barre', 'Soulevé de terre barre', 'Fentes marchées avec sac à dos lesté', 'Leg extension',
    ])
    for (const n of ['Push', 'Pull', 'Legs']) {
      const r = await rows(n)
      expect(r.map((x) => x.te.order)).toEqual(r.map((_, i) => i))
    }
  })

  it('applique 3 × 5–8 (squat, soulevé), 3 × 8–12 (poly-articulaires), 3 × 10–15 (isolation)', async () => {
    await seedIfEmpty()
    const all = [...(await rows('Push')), ...(await rows('Pull')), ...(await rows('Legs'))]
    for (const { te, ex } of all) {
      expect(te.sets).toBe(3)
      const heavy = ex.name === 'Squat barre' || ex.name === 'Soulevé de terre barre'
      const expected = heavy ? [5, 8] : ex.kind === 'compound' ? [8, 12] : [10, 15]
      expect([te.repsMin, te.repsMax], ex.name).toEqual(expected)
      expect(te.restSec).toBe(ex.kind === 'compound' ? 120 : 90)
    }
    expect(all.filter((r) => r.ex.kind === 'compound').length).toBeGreaterThan(5)
    expect(all.filter((r) => r.ex.kind === 'isolation').length).toBeGreaterThan(3)
  })

  it('crée les fentes marchées lestées en exercice personnalisé', async () => {
    await seedIfEmpty()
    const ex = (await listExercises()).find((e) => e.name === 'Fentes marchées avec sac à dos lesté')!
    expect(ex).toMatchObject({ custom: true, increment: 2, primaryGroup: 'quadriceps' })
  })

  it('rattache le soulevé de terre aux ischios et les tractions au dos (poids du corps)', async () => {
    await seedIfEmpty()
    const exos = await listExercises()
    const deadlift = exos.find((e) => e.name === 'Soulevé de terre barre')!
    expect(deadlift.primaryGroup).toBe('ischios')
    expect(deadlift.secondaryGroups).toContain('dos')
    expect(deadlift.secondaryGroups).not.toContain('ischios')
    expect(exos.find((e) => e.name === 'Tractions')).toMatchObject({ bodyweight: true, primaryGroup: 'dos' })
  })

  it('le catalogue n\'a aucun nom vide', async () => {
    await seedIfEmpty()
    const exos = await listExercises()
    expect(exos.length).toBeGreaterThan(800)
    expect(exos.every((e) => e.name.trim().length > 0)).toBe(true)
  })

  it('le catalogue porte la catégorie free-exercise-db (étirements, cardio…)', async () => {
    await seedIfEmpty()
    const exos = await listExercises()
    expect(exos.find((e) => e.id === 'Barbell_Squat')!.category).toBe('strength')
    expect(exos.find((e) => e.id === '90_90_Hamstring')!.category).toBe('stretching')
    expect(exos.filter((e) => !e.custom).every((e) => typeof e.category === 'string')).toBe(true)
  })

  it('un second appel ne duplique rien', async () => {
    await seedIfEmpty()
    const counts = async () => [await db.exercises.count(), await db.templates.count(), await db.templateExercises.count()]
    const before = await counts()
    await seedIfEmpty()
    expect(await counts()).toEqual(before)
  })
})
