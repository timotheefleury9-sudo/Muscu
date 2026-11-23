import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { exportData, importData, validateBackup } from './backup'
import { loadAll, saveExercise, saveSet, saveTemplate, saveTemplateExercise, startSession } from './repo'
import type { AppData } from '../domain/types'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const sorted = (d: AppData): AppData => {
  const by = <T extends { id: string }>(a: T[]) => [...a].sort((x, y) => x.id.localeCompare(y.id))
  return {
    exercises: by(d.exercises), templates: by(d.templates), templateExercises: by(d.templateExercises),
    sessions: by(d.sessions), sets: by(d.sets),
  }
}

async function seed() {
  await saveExercise({ id: 'e1', name: 'Développé couché', primaryGroup: 'pectoraux', secondaryGroups: ['triceps'], equipment: 'barre', kind: 'compound', increment: 2.5, bodyweight: false, custom: false })
  await saveTemplate({ id: 't1', name: 'Push', rotationOrder: 0 })
  await saveTemplateExercise({ id: 'te1', templateId: 't1', exerciseId: 'e1', order: 0, sets: 3, repsMin: 6, repsMax: 10, restSec: 120 })
  const s = await startSession('t1')
  await saveSet({ id: 'set1', sessionId: s.id, exerciseId: 'e1', templateExerciseId: 'te1', setIndex: 0, plannedWeight: 60, plannedReps: 8, weight: 60, reps: 8, done: true })
}

describe('backup', () => {
  it('export puis effacement puis import redonne loadAll identique', async () => {
    await seed()
    const before = sorted(await loadAll())
    const json = await exportData()
    const parsed = JSON.parse(json)
    expect(parsed.format).toBe('muscu-backup')
    expect(parsed.version).toBe(1)
    expect(typeof parsed.exportedAt).toBe('string')
    await db.delete()
    await db.open()
    expect((await loadAll()).sets).toHaveLength(0)
    expect(await importData(json)).toEqual({ ok: true })
    expect(sorted(await loadAll())).toEqual(before)
  })

  it.each([
    ['{}', '{}'],
    ['pas du json', 'pas du json'],
    ['version 2', JSON.stringify({ format: 'muscu-backup', version: 2, exportedAt: 'x', data: { exercises: [], templates: [], templateExercises: [], sessions: [], sets: [] } })],
    ['données mal formées', JSON.stringify({ format: 'muscu-backup', version: 1, exportedAt: 'x', data: { exercises: [] } })],
  ])('refuse %s et laisse les données intactes', async (_n, input) => {
    await seed()
    const before = sorted(await loadAll())
    const res = await importData(input)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.length).toBeGreaterThan(0)
    expect(sorted(await loadAll())).toEqual(before)
  })
})

describe('import : normalisation du catalogue', () => {
  it('aligne les exercices du catalogue sur le catalogue livré, sans toucher aux personnalisés', async () => {
    const { CATALOG } = await import('./catalog')
    const { category: _c, ...hamstring } = CATALOG.find((e) => e.id === '90_90_Hamstring')!
    const custom = { id: 'perso', name: 'Perso', primaryGroup: 'dos', secondaryGroups: [], equipment: 'barre', kind: 'isolation', increment: 2, bodyweight: false, custom: true }
    const json = JSON.stringify({ format: 'muscu-backup', version: 1, exportedAt: 'x', data: { exercises: [hamstring, custom], templates: [], templateExercises: [], sessions: [], sets: [] } })
    expect(await importData(json)).toEqual({ ok: true })
    expect((await db.exercises.get('90_90_Hamstring'))!.category).toBe('stretching')
    expect(await db.exercises.get('perso')).toEqual(custom)
  })
})

describe('validateBackup', () => {
  it('valide une sauvegarde exportée, sans rien écrire', async () => {
    await seed()
    const json = await exportData()
    await db.sessions.clear()
    const v = validateBackup(json)
    expect(v.ok).toBe(true)
    expect(await db.sessions.count()).toBe(0)
  })
  it('refuse un fichier non JSON, étranger ou incomplet', () => {
    expect(validateBackup('pas du json')).toEqual({ ok: false, error: "Ce fichier n'est pas un JSON valide." })
    expect(validateBackup('{"format":"autre"}')).toEqual({ ok: false, error: "Ce fichier n'est pas une sauvegarde Muscu." })
    expect(validateBackup('{"format":"muscu-backup","version":1,"data":{"exercises":[]}}')).toEqual({ ok: false, error: 'Données invalides : « templates ».' })
  })
})
