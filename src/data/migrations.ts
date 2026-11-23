import type { Transaction } from 'dexie'
import type { Exercise } from '../domain/types'
import { CATALOG, deadliftSecondary } from './catalog'

/**
 * V2 : met à jour le catalogue d'une base déjà installée.
 * Exercices du catalogue : catégorie copiée depuis le catalogue livré ; soulevé de terre avec le dos en secondaire ;
 * exercices du catalogue absents ajoutés. Les exercices personnalisés, programmes, séances et séries ne sont jamais modifiés.
 * Une base vide reste vide : le premier lancement y installe catalogue et programme (seedIfEmpty).
 */
export async function upgradeCatalogV2(tx: Transaction): Promise<void> {
  const table = tx.table<Exercise, string>('exercises')
  if ((await table.count()) === 0) return
  const byId = new Map(CATALOG.map((e) => [e.id, e]))
  const present = new Set<string>()
  await table.toCollection().modify((e) => {
    present.add(e.id)
    if (e.custom) return
    const ref = byId.get(e.id)
    if (ref?.category) e.category = ref.category
    if (e.id === 'Barbell_Deadlift' && e.primaryGroup !== 'dos') e.secondaryGroups = deadliftSecondary(e.secondaryGroups)
  })
  const missing = CATALOG.filter((e) => !present.has(e.id))
  if (missing.length > 0) await table.bulkAdd(missing)
}
