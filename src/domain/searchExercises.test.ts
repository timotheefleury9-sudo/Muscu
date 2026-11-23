import { describe, expect, it } from 'vitest'
import { normalize, searchExercises } from './searchExercises'
import type { Exercise } from './types'

const ex = (id: string, name: string, primaryGroup: Exercise['primaryGroup'], over: Partial<Exercise> = {}): Exercise => ({
  id, name, primaryGroup, secondaryGroups: [], equipment: 'other', kind: 'compound', increment: 2.5, bodyweight: false, custom: false, ...over,
})

const LIST: Exercise[] = [
  ex('Barbell_Squat', 'Squat barre', 'quadriceps', { category: 'strength' }),
  ex('Dumbbell_Bench_Press', 'Développé couché haltères', 'pectoraux', { category: 'strength' }),
  ex('Butterfly', 'Pec deck', 'pectoraux', { category: 'strength' }),
  ex('Chest_Stretch', 'Étirement des pectoraux', 'pectoraux', { category: 'stretching' }),
  ex('Rowing_Stationary', 'Rameur', 'dos', { category: 'cardio' }),
  ex('custom-1', 'Écarté maison', 'pectoraux', { custom: true }),
]
const names = (l: Exercise[]) => l.map((e) => e.name)

describe('normalize', () => {
  it('ignore la casse, les accents et les espaces superflus', () => {
    expect(normalize('  Développé  COUCHÉ ')).toBe('developpe couche')
  })
})

describe('searchExercises', () => {
  it('« developpe » trouve « Développé couché haltères »', () => {
    expect(names(searchExercises(LIST, 'developpe'))).toEqual(['Développé couché haltères'])
  })

  it('accepte les accents et majuscules dans la requête', () => {
    expect(names(searchExercises(LIST, 'DÉVELOPPÉ'))).toEqual(['Développé couché haltères'])
  })

  it('tous les mots de la requête doivent apparaître, dans n\'importe quel ordre', () => {
    expect(names(searchExercises(LIST, 'halteres couche'))).toEqual(['Développé couché haltères'])
    expect(searchExercises(LIST, 'couché squat')).toEqual([])
  })

  it('trouve aussi par le nom anglais d\'origine (identifiant)', () => {
    expect(names(searchExercises(LIST, 'bench press'))).toEqual(['Développé couché haltères'])
  })

  it('le filtre pectoraux exclut le squat', () => {
    const r = names(searchExercises(LIST, '', 'pectoraux'))
    expect(r).not.toContain('Squat barre')
    expect(r).toEqual(['Développé couché haltères', 'Écarté maison', 'Pec deck'])
  })

  it('requête vide sans filtre : tout sauf étirements et cardio, trié par nom', () => {
    expect(names(searchExercises(LIST, ''))).toEqual(['Développé couché haltères', 'Écarté maison', 'Pec deck', 'Squat barre'])
  })

  it('includeAll montre aussi étirements et cardio', () => {
    expect(names(searchExercises(LIST, '', undefined, { includeAll: true }))).toEqual([
      'Développé couché haltères', 'Écarté maison', 'Étirement des pectoraux', 'Pec deck', 'Rameur', 'Squat barre',
    ])
    expect(names(searchExercises(LIST, 'etirement'))).toEqual([])
    expect(names(searchExercises(LIST, 'etirement', 'pectoraux', { includeAll: true }))).toEqual(['Étirement des pectoraux'])
  })

  it('un exercice sans catégorie (catalogue déjà installé, personnalisé) reste visible', () => {
    expect(names(searchExercises(LIST, 'ecarte'))).toEqual(['Écarté maison'])
  })

  it('les noms qui commencent par la requête passent en premier', () => {
    const list = [ex('a', 'Curl pupitre', 'biceps'), ex('b', 'Développé', 'pectoraux'), ex('c', 'Pupitre curl', 'biceps')]
    expect(names(searchExercises(list, 'pupitre'))).toEqual(['Pupitre curl', 'Curl pupitre'])
  })
})
