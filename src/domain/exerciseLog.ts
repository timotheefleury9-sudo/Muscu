import type { AppData } from './types'
import type { PerformedSet } from './progression'

export interface SessionLog {
  sessionId: string
  startedAt: string
  /** Séries validées, dans l'ordre de la séance. */
  sets: PerformedSet[]
  /** Série la plus lourde (à poids égal, la plus de reps ; la première sinon). */
  topIndex: number
}

const EPS = 1e-9

/** Dernières séances où l'exercice a des séries validées, la plus récente en premier. */
export function recentSessionLogs(data: AppData, exerciseId: string, limit: number): SessionLog[] {
  const bySession = new Map<string, { idx: number; set: PerformedSet }[]>()
  for (const s of data.sets) {
    if (!s.done || s.exerciseId !== exerciseId) continue
    bySession.set(s.sessionId, [...(bySession.get(s.sessionId) ?? []), { idx: s.setIndex, set: { weight: s.weight, reps: s.reps } }])
  }
  return data.sessions
    .filter(s => bySession.has(s.id))
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : a.id < b.id ? 1 : -1))
    .slice(0, Math.max(0, limit))
    .map(session => {
      const sets = bySession.get(session.id)!.sort((a, b) => a.idx - b.idx).map(r => r.set)
      let topIndex = 0
      sets.forEach((s, i) => {
        const top = sets[topIndex]
        if (s.weight > top.weight + EPS || (Math.abs(s.weight - top.weight) <= EPS && s.reps > top.reps)) topIndex = i
      })
      return { sessionId: session.id, startedAt: session.startedAt, sets, topIndex }
    })
}
