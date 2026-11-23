import { daysBetween, localDay, shiftDays } from './dates'
import type { AppData, Session, SetLog, TemplateExercise } from './types'

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

/** Déplace début et fin de la même durée en jours : la séance garde ses heures locales et sa durée, même si elle franchit minuit. */
export function moveSessionTimes(s: Pick<Session, 'startedAt' | 'endedAt'>, day: string): { startedAt: string; endedAt: string | null } {
  const n = daysBetween(localDay(s.startedAt), day)
  return { startedAt: shiftDays(s.startedAt, n), endedAt: s.endedAt === null ? null : shiftDays(s.endedAt, n) }
}

export interface SessionExercise { exerciseId: string; sets: SetLog[] }

/**
 * Séries d'une séance regroupées par exercice, dans le même ordre que le bilan : ordre du template,
 * puis exercices hors template (ou dont la ligne a été supprimée) par premier setIndex, puis id. Séries par setIndex.
 */
export function sessionExercises(sets: SetLog[], templateExercises: TemplateExercise[]): SessionExercise[] {
  const teOrder = new Map(templateExercises.map((te) => [te.id, te.order]))
  const groups = new Map<string, { rank: number; first: number; sets: SetLog[] }>()
  for (const s of sets) {
    const rank = (s.templateExerciseId !== null ? teOrder.get(s.templateExerciseId) : undefined) ?? Infinity
    const g = groups.get(s.exerciseId) ?? { rank: Infinity, first: Infinity, sets: [] }
    g.rank = Math.min(g.rank, rank)
    g.first = Math.min(g.first, s.setIndex)
    g.sets.push(s)
    groups.set(s.exerciseId, g)
  }
  const cmp = (x: string | number, y: string | number): number => (x < y ? -1 : x > y ? 1 : 0)
  return [...groups.entries()]
    .sort(([ea, a], [eb, b]) => cmp(a.rank, b.rank) || (a.rank === Infinity ? cmp(a.first, b.first) : 0) || cmp(ea, eb))
    .map(([exerciseId, g]) => ({ exerciseId, sets: g.sets.sort((a, b) => a.setIndex - b.setIndex) }))
}

/**
 * Série ajoutée à un exercice d'une séance (correction depuis l'historique) : poids et répétitions de sa dernière série
 * (0/0 s'il est absent de la séance), non validée, sans valeurs prévues. Un exercice absent est hors template et
 * passe après toutes les séries existantes.
 */
export function appendedSet(sessionSets: SetLog[], sessionId: string, exerciseId: string, id: string): SetLog {
  const own = sessionSets.filter((s) => s.exerciseId === exerciseId)
  const last = own.reduce<SetLog | undefined>((m, s) => (!m || s.setIndex > m.setIndex ? s : m), undefined)
  const pool = last ? own : sessionSets
  return {
    id, sessionId, exerciseId, templateExerciseId: last?.templateExerciseId ?? null,
    setIndex: pool.reduce((m, s) => Math.max(m, s.setIndex + 1), 0),
    plannedWeight: null, plannedReps: null, weight: last?.weight ?? 0, reps: last?.reps ?? 0, done: false,
  }
}
