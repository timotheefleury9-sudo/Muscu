import type { Session, SetLog, WorkoutTemplate } from './types'

const RESUME_WINDOW_MS = 6 * 60 * 60 * 1000

/** Template qui suit, dans l'ordre de rotation, la dernière séance comptée (au moins une série validée). */
export function nextTemplateId(templates: WorkoutTemplate[], sessions: Session[], sets: SetLog[]): string {
  const ordered = [...templates].sort((a, b) => a.rotationOrder - b.rotationOrder)
  if (ordered.length === 0) throw new Error('Aucune séance type')
  const counted = new Set(sets.filter((s) => s.done).map((s) => s.sessionId))
  const last = sessions
    .filter((s) => counted.has(s.id))
    .reduce<Session | null>((acc, s) => (!acc || s.startedAt > acc.startedAt ? s : acc), null)
  const i = last ? ordered.findIndex((t) => t.id === last.templateId) : -1
  return i < 0 ? ordered[0].id : ordered[(i + 1) % ordered.length].id
}

/** Séance restée ouverte : reprise si elle a commencé il y a moins de 6 h, sinon clôture automatique. */
export function resolveOpenSession(open: Session | null, now: Date): 'resume' | 'autoclose' | 'none' {
  if (!open) return 'none'
  return now.getTime() - Date.parse(open.startedAt) < RESUME_WINDOW_MS ? 'resume' : 'autoclose'
}
