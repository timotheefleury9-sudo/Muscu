import { describe, expect, it } from 'vitest'
import { backupFileName, isExportReminderDue } from './exportReminder'

const now = new Date(2026, 10, 23, 12)
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString()

describe('isExportReminderDue', () => {
  it('vrai sans export connu ou avec une date illisible', () => {
    expect(isExportReminderDue(null, now)).toBe(true)
    expect(isExportReminderDue('n’importe quoi', now)).toBe(true)
  })
  it('faux jusqu’à 30 jours, vrai au-delà', () => {
    expect(isExportReminderDue(daysAgo(30), now)).toBe(false)
    expect(isExportReminderDue(daysAgo(31), now)).toBe(true)
  })
})

describe('backupFileName', () => {
  it('utilise la date locale, complétée de zéros', () => {
    expect(backupFileName(new Date(2026, 0, 3, 23, 59))).toBe('muscu-sauvegarde-2026-01-03.json')
  })
})
