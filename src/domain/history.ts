import type { ExerciseResult } from './progression'
import type { AppData } from './types'

/**
 * Historique d'un exercice pour `suggestNext` : séries validées seulement, groupées par séance,
 * séances par date de début croissante, séries par setIndex. Les séances sans série validée sont omises.
 * `excludeSessionId` écarte la séance en cours.
 */
export function buildHistory(data: AppData, exerciseId: string, excludeSessionId?: string): ExerciseResult[] {
  const bySession = new Map<string, { setIndex: number; weight: number; reps: number }[]>()
  for (const s of data.sets) {
    if (!s.done || s.exerciseId !== exerciseId || s.sessionId === excludeSessionId) continue
    const list = bySession.get(s.sessionId) ?? []
    list.push({ setIndex: s.setIndex, weight: s.weight, reps: s.reps })
    bySession.set(s.sessionId, list)
  }
  return data.sessions
    .filter((s) => bySession.has(s.id))
    .sort((a, b) => (a.startedAt < b.startedAt ? -1 : a.startedAt > b.startedAt ? 1 : 0))
    .map((s) => ({
      date: s.startedAt,
      sets: bySession.get(s.id)!.sort((a, b) => a.setIndex - b.setIndex).map(({ weight, reps }) => ({ weight, reps })),
    }))
}
