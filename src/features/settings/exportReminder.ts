export const LAST_EXPORT_KEY = 'muscu:lastExport'
const REMINDER_DAYS = 30

/** Date du dernier export (ISO), ou null si jamais exporté ou si localStorage est inaccessible. */
export function getLastExport(): string | null {
  try {
    return localStorage.getItem(LAST_EXPORT_KEY)
  } catch {
    return null
  }
}

export function setLastExport(date: Date): void {
  try {
    localStorage.setItem(LAST_EXPORT_KEY, date.toISOString())
  } catch {
    // Stockage indisponible : le rappel restera affiché, sans conséquence sur la sauvegarde.
  }
}

/** Vrai si aucun export connu, ou s'il date de plus de 30 jours. */
export function isExportReminderDue(last: string | null, now: Date): boolean {
  if (!last) return true
  const t = Date.parse(last)
  if (Number.isNaN(t)) return true
  return now.getTime() - t > REMINDER_DAYS * 86_400_000
}

/** Nom du fichier d'export, avec la date locale. */
export function backupFileName(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `muscu-sauvegarde-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`
}
