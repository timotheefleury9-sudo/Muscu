import type { Session, SetLog, TemplateExercise, WorkoutTemplate } from './types'

const RESUME_WINDOW_MS = 6 * 60 * 60 * 1000

/**
 * Template qui suit, dans l'ordre de rotation, la dernière séance comptée (au moins une série validée).
 * Les programmes sans exercice sont sautés ; s'ils sont tous vides : le template d'ordre 0.
 */
export function nextTemplateId(
  templates: WorkoutTemplate[], sessions: Session[], sets: SetLog[], templateExercises: Pick<TemplateExercise, 'templateId'>[],
): string {
  const ordered = [...templates].sort((a, b) => a.rotationOrder - b.rotationOrder)
  if (ordered.length === 0) throw new Error('Aucune séance type')
  const filled = new Set(templateExercises.map((te) => te.templateId))
  const counted = new Set(sets.filter((s) => s.done).map((s) => s.sessionId))
  const last = sessions
    .filter((s) => counted.has(s.id))
    .reduce<Session | null>((acc, s) => (!acc || s.startedAt > acc.startedAt ? s : acc), null)
  const i = last ? ordered.findIndex((t) => t.id === last.templateId) : -1
  const start = i < 0 ? 0 : i + 1
  for (let k = 0; k < ordered.length; k++) {
    const t = ordered[(start + k) % ordered.length]
    if (filled.has(t.id)) return t.id
  }
  return ordered[0].id
}

/** Séance restée ouverte : reprise si elle a commencé il y a moins de 6 h, sinon clôture automatique. */
export function resolveOpenSession(open: Session | null, now: Date): 'resume' | 'autoclose' | 'none' {
  if (!open) return 'none'
  return now.getTime() - Date.parse(open.startedAt) < RESUME_WINDOW_MS ? 'resume' : 'autoclose'
}
