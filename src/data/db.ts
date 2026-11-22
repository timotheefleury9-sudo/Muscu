import Dexie, { type EntityTable } from 'dexie'
import type { Exercise, Session, SetLog, TemplateExercise, WorkoutTemplate } from '../domain/types'

export class MuscuDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  templates!: EntityTable<WorkoutTemplate, 'id'>
  templateExercises!: EntityTable<TemplateExercise, 'id'>
  sessions!: EntityTable<Session, 'id'>
  sets!: EntityTable<SetLog, 'id'>

  constructor() {
    super('muscu')
    this.version(1).stores({
      exercises: 'id, primaryGroup',
      templates: 'id, rotationOrder',
      templateExercises: 'id, templateId, exerciseId',
      sessions: 'id, startedAt, templateId',
      sets: 'id, sessionId, exerciseId',
    })
  }
}

export const db = new MuscuDB()
