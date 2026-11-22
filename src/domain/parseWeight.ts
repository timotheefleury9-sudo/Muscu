/** Poids saisi au clavier : accepte « 77,5 » et « 77.5 » ; refuse le vide, le texte et les négatifs. */
export function parseWeight(input: string): number | null {
  const s = input.trim()
  if (!/^\d+([.,]\d+)?$/.test(s)) return null
  return Number(s.replace(',', '.'))
}

/** Affichage français : 77,5 */
export function formatWeight(kg: number): string {
  return String(Math.round(kg * 100) / 100).replace('.', ',')
}

/** Répétitions saisies : entier positif ou nul. */
export function parseReps(input: string): number | null {
  const s = input.trim()
  return /^\d+$/.test(s) ? Number(s) : null
}
