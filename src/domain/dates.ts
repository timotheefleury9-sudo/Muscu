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
