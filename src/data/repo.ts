import { db } from './db'
import type { AppData, Exercise, Session, SetLog, TemplateExercise, WorkoutTemplate } from '../domain/types'

export const listExercises = (): Promise<Exercise[]> => db.exercises.toArray()
export const saveExercise = async (e: Exercise): Promise<void> => { await db.exercises.put(e) }

/** Exercice personnalisé et sa ligne dans un programme : tous deux ou aucun. */
export const createCustomExercise = (e: Exercise, te: TemplateExercise): Promise<void> =>
  db.transaction('rw', db.exercises, db.templateExercises, async () => {
    await db.exercises.put(e)
    await db.templateExercises.put(te)
  })

export const listTemplates = async (): Promise<WorkoutTemplate[]> => db.templates.orderBy('rotationOrder').toArray()
export const saveTemplate = async (t: WorkoutTemplate): Promise<void> => { await db.templates.put(t) }
/** Supprime le modèle et ses lignes d'exercices ; l'historique (séances, séries) est conservé. */
export const deleteTemplate = (id: string): Promise<void> =>
  db.transaction('rw', db.templates, db.templateExercises, async () => {
    await db.templateExercises.where('templateId').equals(id).delete()
    await db.templates.delete(id)
  })

export const listTemplateExercises = async (templateId: string): Promise<TemplateExercise[]> =>
  (await db.templateExercises.where('templateId').equals(templateId).toArray()).sort((a, b) => a.order - b.order)
export const saveTemplateExercise = async (te: TemplateExercise): Promise<void> => { await db.templateExercises.put(te) }
/** Plusieurs lignes en une écriture (réordonnancement) : toutes ou aucune. */
export const saveTemplateExercises = async (tes: TemplateExercise[]): Promise<void> => { await db.templateExercises.bulkPut(tes) }
/** Ne touche à aucun SetLog. */
export const deleteTemplateExercise = (id: string): Promise<void> => db.templateExercises.delete(id)

export const getOpenSession = async (): Promise<Session | undefined> =>
  (await db.sessions.toArray()).find((s) => s.endedAt === null)
export async function startSession(templateId: string): Promise<Session> {
  const s: Session = { id: crypto.randomUUID(), templateId, startedAt: new Date().toISOString(), endedAt: null }
  await db.sessions.add(s)
  return s
}
/** Crée la séance et ses séries dans une seule transaction : en cas d'échec, rien n'est écrit. */
export const startSessionWithSets = (templateId: string, sets: SetLog[]): Promise<Session> =>
  db.transaction('rw', db.sessions, db.sets, async () => {
    const s: Session = { id: crypto.randomUUID(), templateId, startedAt: new Date().toISOString(), endedAt: null }
    await db.sessions.add(s)
    for (const x of sets) await saveSet({ ...x, sessionId: s.id })
    return s
  })
export const endSession = async (id: string): Promise<void> => {
  await db.sessions.update(id, { endedAt: new Date().toISOString() })
}

/** Supprime une séance et ses séries (changement de séance avant toute série validée). */
export const deleteSession = (id: string): Promise<void> =>
  db.transaction('rw', db.sessions, db.sets, async () => {
    await db.sets.where('sessionId').equals(id).delete()
    await db.sessions.delete(id)
  })

export const listSets = async (sessionId: string): Promise<SetLog[]> =>
  (await db.sets.where('sessionId').equals(sessionId).toArray()).sort((a, b) => a.setIndex - b.setIndex)
export const saveSet = async (s: SetLog): Promise<void> => { await db.sets.put(s) }
export const deleteSet = (id: string): Promise<void> => db.sets.delete(id)

/** Données de l'onglet Programmes (sans les séances ni les séries). */
export async function loadPrograms(): Promise<Pick<AppData, 'exercises' | 'templates' | 'templateExercises'>> {
  const [exercises, templates, templateExercises] = await Promise.all([listExercises(), listTemplates(), db.templateExercises.toArray()])
  return { exercises, templates, templateExercises }
}

export async function loadAll(): Promise<AppData> {
  const [exercises, templates, templateExercises, sessions, sets] = await Promise.all([
    db.exercises.toArray(), db.templates.toArray(), db.templateExercises.toArray(), db.sessions.toArray(), db.sets.toArray(),
  ])
  return { exercises, templates, templateExercises, sessions, sets }
}
