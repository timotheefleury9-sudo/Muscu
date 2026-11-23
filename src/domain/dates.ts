const pad = (n: number): string => String(n).padStart(2, '0')
const fmt = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Lundi (YYYY-MM-DD, heure locale) de la semaine contenant l'instant ISO. */
export function weekStart(iso: string): string {
  const d = new Date(iso)
  const sinceMonday = (d.getDay() + 6) % 7
  return fmt(new Date(d.getFullYear(), d.getMonth(), d.getDate() - sinceMonday))
}

/** Ajoute des jours à une date YYYY-MM-DD (calendrier local, insensible au changement d'heure). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return fmt(new Date(y, m - 1, d + days))
}

/** Jour local (YYYY-MM-DD) de l'instant ISO. */
export function localDay(iso: string): string {
  return fmt(new Date(iso))
}

/** Ajoute des mois à un mois YYYY-MM. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

/** Semaines lundi→dimanche couvrant le mois, jours des mois voisins inclus. */
export function monthGrid(month: string): string[][] {
  const start = weekStart(new Date(+month.slice(0, 4), +month.slice(5, 7) - 1, 1, 12).toISOString())
  const next = addMonths(month, 1)
  const weeks: string[][] = []
  for (let w = start; w < `${next}-01`; w = addDays(w, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(w, i)))
  }
  return weeks
}

/** Instant ISO de 12:00 locale pour le jour YYYY-MM-DD. */
export function noonOf(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0).toISOString()
}

/** Même heure locale, autre jour (calendrier local, insensible au changement d'heure). */
export function moveToDay(iso: string, day: string): string {
  const t = new Date(iso)
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, t.getHours(), t.getMinutes(), t.getSeconds(), t.getMilliseconds()).toISOString()
}

/** Même heure locale, n jours calendaires plus tard (ou plus tôt si n < 0), insensible au changement d'heure. */
export function shiftDays(iso: string, n: number): string {
  const t = new Date(iso)
  return new Date(t.getFullYear(), t.getMonth(), t.getDate() + n, t.getHours(), t.getMinutes(), t.getSeconds(), t.getMilliseconds()).toISOString()
}

/** Nombre de jours calendaires de a à b (YYYY-MM-DD). */
export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number)
  const [y2, m2, d2] = b.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000)
}
