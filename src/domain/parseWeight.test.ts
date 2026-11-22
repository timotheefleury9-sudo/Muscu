import { describe, expect, it } from 'vitest'
import { formatWeight, parseReps, parseWeight } from './parseWeight'

describe('parseWeight', () => {
  it('accepte la virgule et le point', () => {
    expect(parseWeight('77,5')).toBe(77.5)
    expect(parseWeight('77.5')).toBe(77.5)
    expect(parseWeight('80')).toBe(80)
    expect(parseWeight(' 80 ')).toBe(80)
  })
  it('refuse le vide, le texte et les négatifs', () => {
    expect(parseWeight('')).toBeNull()
    expect(parseWeight('abc')).toBeNull()
    expect(parseWeight('-5')).toBeNull()
    expect(parseWeight('7,5,5')).toBeNull()
  })
})

describe('formatWeight', () => {
  it('affiche une virgule', () => {
    expect(formatWeight(77.5)).toBe('77,5')
    expect(formatWeight(80)).toBe('80')
    expect(formatWeight(82.25)).toBe('82,25')
  })
})

describe('parseReps', () => {
  it('entier positif seulement', () => {
    expect(parseReps('12')).toBe(12)
    expect(parseReps(' 8 ')).toBe(8)
    expect(parseReps('')).toBeNull()
    expect(parseReps('8,5')).toBeNull()
    expect(parseReps('abc')).toBeNull()
  })
})
