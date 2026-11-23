import { localDay } from '../../domain/dates'
import type { SessionSummary } from '../../domain/sessionLog'
import { dayDate } from '../progress/labels'

const parseLocal = (date: string): Date => {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d ?? 1)
}

export const currentMonth = (): string => localDay(new Date().toISOString()).slice(0, 7)

/** Mois demandé dans l'URL (AAAA-MM), jamais au-delà du mois courant. */
export function monthFromParam(param: string | null): string {
  const now = currentMonth()
  if (!param || !/^\d{4}-(0[1-9]|1[0-2])$/.test(param)) return now
  return param > now ? now : param
}

/** « novembre 2026 » */
export const monthLabel = (month: string): string =>
  new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(parseLocal(month))

/** « lundi 16 novembre » */
export const longDay = (day: string): string =>
  new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).format(parseLocal(day))

/** « 18:05 » (heure locale) */
export const timeLabel = (iso: string): string =>
  new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso))

const plural = (n: number, one: string, many: string): string => `${n} ${n > 1 ? many : one}`

/** « lun. 17 nov. · Push · 5 exercices · 15 séries » */
export const sessionLine = (s: SessionSummary): string =>
  [dayDate(s.startedAt), s.templateName, plural(s.exerciseCount, 'exercice', 'exercices'), plural(s.doneSets, 'série', 'séries')].join(' · ')

/** Séances (déjà triées) regroupées par mois, dans le même ordre. */
export function byMonth(list: SessionSummary[]): { month: string; sessions: SessionSummary[] }[] {
  const out: { month: string; sessions: SessionSummary[] }[] = []
  for (const s of list) {
    const month = s.day.slice(0, 7)
    const last = out.at(-1)
    if (last?.month === month) last.sessions.push(s)
    else out.push({ month, sessions: [s] })
  }
  return out
}
