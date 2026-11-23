import { localDay } from './dates'
import type { AppData } from './types'

export interface SessionSummary { id: string; startedAt: string; day: string; templateName: string; exerciseCount: number; doneSets: number; open: boolean }

/** Séances les plus récentes d'abord ; une séance ouverte sans série validée est exclue. */
export function sessionSummaries(data: AppData): SessionSummary[] {
  const names = new Map(data.templates.map((t) => [t.id, t.name]))
  const bySession = new Map<string, { exercises: Set<string>; done: number }>()
  for (const s of data.sets) {
    const acc = bySession.get(s.sessionId) ?? { exercises: new Set<string>(), done: 0 }
    acc.exercises.add(s.exerciseId)
    if (s.done) acc.done++
    bySession.set(s.sessionId, acc)
  }
  const out: SessionSummary[] = []
  for (const s of data.sessions) {
    const acc = bySession.get(s.id)
    const doneSets = acc?.done ?? 0
    const open = s.endedAt === null
    if (open && doneSets === 0) continue
    out.push({
      id: s.id, startedAt: s.startedAt, day: localDay(s.startedAt), templateName: names.get(s.templateId) ?? 'Séance',
      exerciseCount: acc?.exercises.size ?? 0, doneSets, open,
    })
  }
  return out.sort((a, b) => (a.startedAt < b.startedAt ? 1 : a.startedAt > b.startedAt ? -1 : 0))
}

/** Séances du mois (YYYY-MM) regroupées par jour (YYYY-MM-DD). */
export function sessionsByDay(data: AppData, month: string): Record<string, SessionSummary[]> {
  const out: Record<string, SessionSummary[]> = {}
  for (const s of sessionSummaries(data)) {
    if (!s.day.startsWith(`${month}-`)) continue
    ;(out[s.day] ??= []).push(s)
  }
  return out
}

/** Pas de date future. */
export const canMoveTo = (day: string, today: string): boolean => day <= today
