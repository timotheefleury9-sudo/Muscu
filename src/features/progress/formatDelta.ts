import type { Delta } from '../../domain/metrics'
import { formatWeight } from '../../domain/parseWeight'

const signed = (n: number, text: string): string => `${n > 0 ? '+' : ''}${text}`

/** Évolution vs semaine précédente : « +2,5 kg », « +2 reps », « = » ou « Nouveau ». */
export function formatDelta(d: Delta): string {
  switch (d.kind) {
    case 'weight': return signed(d.value, `${formatWeight(d.value)} kg`)
    case 'reps': return signed(d.value, `${d.value} ${Math.abs(d.value) === 1 ? 'rep' : 'reps'}`)
    case 'same': return '='
    case 'new': return 'Nouveau'
  }
}
