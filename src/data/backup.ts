import { db } from './db'
import { loadAll } from './repo'
import { normalizeCatalogExercise } from './catalog'
import type { AppData } from '../domain/types'

const FORMAT = 'muscu-backup'
const VERSION = 1
const KEYS: (keyof AppData)[] = ['exercises', 'templates', 'templateExercises', 'sessions', 'sets']

export async function exportData(): Promise<string> {
  const data = await loadAll()
  return JSON.stringify({ format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), data })
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function validate(json: string): { ok: true; data: AppData } | { ok: false; error: string } {
  let parsed: unknown
  try { parsed = JSON.parse(json) } catch { return { ok: false, error: "Ce fichier n'est pas un JSON valide." } }
  if (!isObj(parsed) || parsed.format !== FORMAT) return { ok: false, error: "Ce fichier n'est pas une sauvegarde Muscu." }
  if (parsed.version !== VERSION) return { ok: false, error: `Version de sauvegarde non prise en charge : ${String(parsed.version)}.` }
  const data = parsed.data
  if (!isObj(data)) return { ok: false, error: 'Données de sauvegarde manquantes.' }
  for (const k of KEYS) {
    const arr = data[k]
    if (!Array.isArray(arr) || !arr.every((r) => isObj(r) && typeof r.id === 'string')) {
      return { ok: false, error: `Données invalides : « ${k} ».` }
    }
  }
  return { ok: true, data: data as unknown as AppData }
}

export async function importData(json: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const v = validate(json)
  if (!v.ok) return v
  const data: AppData = { ...v.data, exercises: v.data.exercises.map(normalizeCatalogExercise) }
  try {
    await db.transaction('rw', [db.exercises, db.templates, db.templateExercises, db.sessions, db.sets], async () => {
      await Promise.all(KEYS.map((k) => db[k].clear()))
      await db.exercises.bulkAdd(data.exercises)
      await db.templates.bulkAdd(data.templates)
      await db.templateExercises.bulkAdd(data.templateExercises)
      await db.sessions.bulkAdd(data.sessions)
      await db.sets.bulkAdd(data.sets)
    })
  } catch {
    return { ok: false, error: "Échec de l'import : les données existantes sont conservées." }
  }
  return { ok: true }
}
