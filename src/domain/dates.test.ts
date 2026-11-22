import { describe, it, expect } from 'vitest'
import { weekStart, addDays } from './dates'

describe('weekStart', () => {
  it('un dimanche 23:30 local appartient à la semaine du lundi précédent', () => {
    expect(weekStart(new Date(2026, 10, 22, 23, 30).toISOString())).toBe('2026-11-16')
  })
  it('un lundi 00:10 local ouvre une nouvelle semaine', () => {
    expect(weekStart(new Date(2026, 10, 23, 0, 10).toISOString())).toBe('2026-11-23')
  })
  it('semaine du changement d\'heure (29/03/2026)', () => {
    expect(weekStart(new Date(2026, 2, 29, 12, 0).toISOString())).toBe('2026-03-23')
    expect(weekStart(new Date(2026, 2, 29, 23, 59).toISOString())).toBe('2026-03-23')
    expect(weekStart(new Date(2026, 2, 30, 0, 5).toISOString())).toBe('2026-03-30')
  })
  it('addDays traverse le changement d\'heure', () => {
    expect(addDays('2026-03-23', 7)).toBe('2026-03-30')
    expect(addDays('2026-03-30', -7)).toBe('2026-03-23')
  })
})
