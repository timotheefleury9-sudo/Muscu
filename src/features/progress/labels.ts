import type { MuscleGroup } from '../../domain/types'
import type { PerformedSet } from '../../domain/progression'
import { addDays, weekStart } from '../../domain/dates'
import { formatWeight } from '../../domain/parseWeight'

export const GROUPS: MuscleGroup[] = ['pectoraux', 'dos', 'epaules', 'biceps', 'triceps', 'quadriceps', 'ischios', 'fessiers', 'mollets', 'abdos']

export const GROUP_LABEL: Record<MuscleGroup, string> = {
  pectoraux: 'Pectoraux', dos: 'Dos', epaules: 'Épaules', biceps: 'Biceps', triceps: 'Triceps',
  quadriceps: 'Quadriceps', ischios: 'Ischios', fessiers: 'Fessiers', mollets: 'Mollets', abdos: 'Abdos',
}

export const isGroup = (g: string | undefined): g is MuscleGroup => GROUPS.includes(g as MuscleGroup)

const parseLocal = (date: string): Date => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** « 16 nov. » */
export const shortDate = (date: string): string =>
  new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(parseLocal(date))

/** « Semaine du 16 nov. » */
export const weekLabel = (monday: string): string => `Semaine du ${shortDate(monday)}`

export const currentWeek = (): string => weekStart(new Date().toISOString())

/** Semaine demandée dans l'URL, ramenée à son lundi et jamais au-delà de la semaine courante. */
export function weekFromParam(param: string | null): string {
  const now = currentWeek()
  if (!param || !/^\d{4}-\d{2}-\d{2}$/.test(param) || Number.isNaN(parseLocal(param).getTime())) return now
  const monday = weekStart(parseLocal(param).toISOString())
  return monday > now ? now : monday
}

export const previousWeek = (monday: string): string => addDays(monday, -7)
export const nextWeek = (monday: string): string => addDays(monday, 7)

/** « 77,5 kg × 11 », « Poids du corps × 9 » */
export const formatSet = (s: PerformedSet, bodyweight: boolean): string =>
  `${bodyweight && s.weight === 0 ? 'Poids du corps' : `${formatWeight(s.weight)} kg`} × ${s.reps}`
