import { describe, expect, it } from 'vitest'
import { formatDelta } from './formatDelta'

describe('formatDelta', () => {
  it('poids', () => expect(formatDelta({ kind: 'weight', value: 2.5 })).toBe('+2,5 kg'))
  it('poids entier', () => expect(formatDelta({ kind: 'weight', value: 2 })).toBe('+2 kg'))
  it('répétitions', () => expect(formatDelta({ kind: 'reps', value: 2 })).toBe('+2 reps'))
  it('une répétition', () => expect(formatDelta({ kind: 'reps', value: 1 })).toBe('+1 rep'))
  it('identique', () => expect(formatDelta({ kind: 'same' })).toBe('='))
  it('nouveau', () => expect(formatDelta({ kind: 'new' })).toBe('Nouveau'))
})
