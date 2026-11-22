export type MuscleGroup = 'pectoraux'|'dos'|'epaules'|'biceps'|'triceps'|'quadriceps'|'ischios'|'fessiers'|'mollets'|'abdos'
export interface Exercise { id: string; name: string; primaryGroup: MuscleGroup; secondaryGroups: MuscleGroup[]; equipment: string; kind: 'compound'|'isolation'; increment: number; bodyweight: boolean; custom: boolean }
export interface WorkoutTemplate { id: string; name: string; rotationOrder: number }
export interface TemplateExercise { id: string; templateId: string; exerciseId: string; order: number; sets: number; repsMin: number; repsMax: number; restSec: number }
export interface Session { id: string; templateId: string; startedAt: string; endedAt: string | null } // ISO
export interface SetLog { id: string; sessionId: string; exerciseId: string; templateExerciseId: string | null; setIndex: number; plannedWeight: number | null; plannedReps: number | null; weight: number; reps: number; done: boolean }
export interface AppData { exercises: Exercise[]; templates: WorkoutTemplate[]; templateExercises: TemplateExercise[]; sessions: Session[]; sets: SetLog[] }
