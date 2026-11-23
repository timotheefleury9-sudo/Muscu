import { describe, it, expect } from 'vitest'
import { weekStart, addDays, localDay, addMonths, monthGrid, noonOf, moveToDay } from './dates'

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

describe('calendrier', () => {
  it('localDay en heure locale', () => {
    expect(localDay('2026-11-22T22:30:00.000Z')).toBe('2026-11-22')
    expect(localDay('2026-11-22T23:30:00.000Z')).toBe('2026-11-23')
  })
  it('addMonths', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-11', 0)).toBe('2026-11')
  })
  it('monthGrid : semaines lundi→dimanche', () => {
    const g = monthGrid('2026-11')
    expect(g).toHaveLength(6)
    expect(g.every((w) => w.length === 7)).toBe(true)
    expect(g[0][0]).toBe('2026-10-26')
    expect(g[5][6]).toBe('2026-12-06')
    expect(monthGrid('2027-02')).toHaveLength(4)
  })
  it('noonOf = 12:00 locale', () => {
    const d = new Date(noonOf('2026-11-16'))
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 10, 16, 12, 0])
  })
  it('moveToDay conserve l\'heure locale', () => {
    const d = new Date(moveToDay(new Date(2026, 10, 22, 23, 30).toISOString(), '2026-11-20'))
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([20, 23, 30])
  })
  it('moveToDay à travers le changement d\'heure (29/03/2026)', () => {
    const d = new Date(moveToDay(new Date(2026, 2, 31, 9, 15).toISOString(), '2026-03-27'))
    expect([d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2, 27, 9, 15])
    const e = new Date(moveToDay(new Date(2026, 2, 27, 9, 15).toISOString(), '2026-03-31'))
    expect([e.getDate(), e.getHours()]).toEqual([31, 9])
  })
})
