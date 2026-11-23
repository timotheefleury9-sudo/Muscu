import { describe, expect, it } from 'vitest'
import { nextTemplateId, resolveOpenSession } from './rotation'
import type { Session, SetLog, TemplateExercise, WorkoutTemplate } from './types'

const templates: WorkoutTemplate[] = [
  { id: 'legs', name: 'Legs', rotationOrder: 2 },
  { id: 'push', name: 'Push', rotationOrder: 0 },
  { id: 'pull', name: 'Pull', rotationOrder: 1 },
]
const row = (templateId: string): Pick<TemplateExercise, 'templateId'> => ({ templateId })
const rows = [row('push'), row('pull'), row('legs')]
const session = (id: string, templateId: string, startedAt: string): Session => ({ id, templateId, startedAt, endedAt: startedAt })
const set = (sessionId: string, done: boolean): SetLog => ({
  id: `${sessionId}-${done}`, sessionId, exerciseId: 'e', templateExerciseId: null, setIndex: 0,
  plannedWeight: null, plannedReps: null, weight: 50, reps: 10, done,
})

describe('nextTemplateId', () => {
  it("sans historique : le template d'ordre 0", () => {
    expect(nextTemplateId(templates, [], [], rows)).toBe('push')
  })
  it('après Push vient Pull, et après Legs vient Push', () => {
    const s1 = session('s1', 'push', '2026-11-16T10:00:00.000Z')
    expect(nextTemplateId(templates, [s1], [set('s1', true)], rows)).toBe('pull')
    const s2 = session('s2', 'legs', '2026-11-18T10:00:00.000Z')
    expect(nextTemplateId(templates, [s2, s1], [set('s1', true), set('s2', true)], rows)).toBe('push')
  })
  it('une séance sans série validée ne fait pas avancer la rotation', () => {
    const s1 = session('s1', 'push', '2026-11-16T10:00:00.000Z')
    const s2 = session('s2', 'pull', '2026-11-18T10:00:00.000Z')
    expect(nextTemplateId(templates, [s1, s2], [set('s1', true), set('s2', false)], rows)).toBe('pull')
  })
  it("template supprimé depuis : retour au template d'ordre 0", () => {
    const s1 = session('s1', 'gone', '2026-11-16T10:00:00.000Z')
    expect(nextTemplateId(templates, [s1], [set('s1', true)], rows)).toBe('push')
  })
  it('saute les programmes sans exercice', () => {
    const withEmpty = [...templates, { id: 'new', name: 'Nouveau programme', rotationOrder: 3 }, { id: 'zero', name: 'Vide', rotationOrder: -1 }]
    expect(nextTemplateId(withEmpty, [], [], rows)).toBe('push')
    const s1 = session('s1', 'legs', '2026-11-16T10:00:00.000Z')
    expect(nextTemplateId(withEmpty, [s1], [set('s1', true)], rows)).toBe('push')
    const s2 = session('s2', 'pull', '2026-11-16T10:00:00.000Z')
    expect(nextTemplateId(templates, [s2], [set('s2', true)], [row('push'), row('pull')])).toBe('push')
  })
  it('tous vides : le template d\'ordre 0', () => {
    expect(nextTemplateId(templates, [], [], [])).toBe('push')
  })
})

describe('resolveOpenSession', () => {
  const startedAt = '2026-11-22T10:00:00.000Z'
  const open: Session = { id: 'o', templateId: 'push', startedAt, endedAt: null }
  const at = (h: number, m: number) => new Date(Date.parse(startedAt) + (h * 60 + m) * 60_000)
  it('none sans séance ouverte', () => {
    expect(resolveOpenSession(null, at(0, 0))).toBe('none')
  })
  it('resume à 5 h 59 et autoclose à 6 h 01', () => {
    expect(resolveOpenSession(open, at(5, 59))).toBe('resume')
    expect(resolveOpenSession(open, at(6, 1))).toBe('autoclose')
  })
})
