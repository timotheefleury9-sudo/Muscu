/** Matériel free-exercise-db → libellé affiché. */
const EQUIPMENT_LABEL: Record<string, string> = {
  'body only': 'Poids du corps', machine: 'Machine', other: 'Autre', 'foam roll': 'Rouleau', none: 'Sans matériel',
  kettlebells: 'Kettlebell', dumbbell: 'Haltères', cable: 'Poulie', barbell: 'Barre', bands: 'Élastique',
  'medicine ball': 'Médecine-ball', 'exercise ball': 'Ballon', 'e-z curl bar': 'Barre EZ',
}
export const equipmentLabel = (e: string): string => EQUIPMENT_LABEL[e] ?? e

/** « 2 min », « 1 min 30 », « 45 s », « sans repos ». */
export function formatRest(sec: number): string {
  if (sec <= 0) return 'sans repos'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m === 0) return `${s} s`
  return s === 0 ? `${m} min` : `${m} min ${String(s).padStart(2, '0')}`
}

/** « 3 × 8–12 · repos 2 min » */
export const slotSummary = (s: { sets: number; repsMin: number; repsMax: number; restSec: number }): string =>
  `${s.sets} × ${s.repsMin === s.repsMax ? s.repsMin : `${s.repsMin}–${s.repsMax}`} · ${s.restSec > 0 ? `repos ${formatRest(s.restSec)}` : 'sans repos'}`

export const plural = (n: number, one: string, many: string): string => `${n} ${n > 1 ? many : one}`
