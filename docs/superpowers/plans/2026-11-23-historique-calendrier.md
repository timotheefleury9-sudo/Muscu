# Historique des séances et calendrier — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** calendrier mensuel des séances, liste de toutes les séances, détail modifiable et supprimable d'une séance terminée, ajout d'une séance oubliée et changement de date.

**Architecture :** logique pure dans `src/domain/sessionLog.ts` (+ helpers de dates), écritures atomiques dans `src/data/repo.ts`, nouveaux écrans dans `src/features/history/`. L'éditeur réutilise `SetRow` de l'écran Séance et `ExercisePicker` / `ConfirmSheet` / `SaveError` de Programmes.

**Tech Stack :** existante (React, TS strict, Dexie, React Router, Framer Motion, Vitest + Testing Library + fake-indexeddb).

**Spec :** `docs/superpowers/specs/2026-11-23-historique-calendrier-design.md` (et `2026-11-22-app-muscu-design.md` pour le reste).

## Global Constraints

- Interface en français, poids avec virgule, zones tactiles ≥ 44 px, animations < 300 ms, mode sombre/clair via les variables de `theme.css`.
- Jours d'entraînement : **une seule pastille avec une icône d'haltère**, pas de couleur ni de légende ; plusieurs séances le même jour → une pastille, toucher le jour ouvre une petite liste.
- Semaine = lundi → dimanche, heure locale ; calendrier commence le lundi.
- Changement de date : heure d'origine conservée, pas de date future.
- Séance oubliée : heure 12:00 locale, créée terminée, séries vides (non pré-remplies).
- Séance en cours (`endedAt === null`) : non modifiable depuis l'historique → redirige vers `/`.
- Suppression : séance + séries en une transaction, confirmation « Supprimer cette séance ? C'est définitif. »
- Toute modification enregistrée immédiatement ; échec d'écriture → bandeau d'erreur (`SaveError`) + rechargement depuis la base.
- Aucune nouvelle dépendance. Logique métier uniquement dans `src/domain/`, toujours testée. `npm test` (TZ=Europe/Paris).

## Review Focus

1. Changer la date d'une séance faite à 23:30 vers un autre jour, ou à travers un changement d'heure (29/03/2026) → l'heure locale reste 23:30 et la séance tombe dans la bonne semaine. → Task 1.
2. Ajouter une séance oubliée plus ancienne que la dernière séance → la séance proposée dans l'onglet Séance ne change pas. → Task 1.
3. Corriger le poids d'une série d'une séance terminée → la prochaine proposition de charge en tient compte. → Task 3.
4. Retirer un exercice / supprimer la séance puis échec d'écriture → rien n'est à moitié supprimé, bandeau affiché. → Tasks 1 et 3.
5. Ouvrir depuis le calendrier la séance en cours → onglet Séance, pas l'éditeur. → Task 3.

---

### Task 1 : Domaine et écritures

**Files :**
- Modify : `src/domain/dates.ts`, `src/data/repo.ts`
- Create : `src/domain/sessionLog.ts`
- Test : `src/domain/dates.test.ts`, `src/domain/sessionLog.test.ts`, `src/data/repo.test.ts`

**Interfaces — Produces :**
```ts
// dates.ts
export function localDay(iso: string): string            // 'YYYY-MM-DD' en heure locale
export function addMonths(month: string, n: number): string // 'YYYY-MM'
export function monthGrid(month: string): string[][]      // semaines lundi→dimanche couvrant le mois (jours hors mois inclus)
export function noonOf(day: string): string               // ISO de day à 12:00 locale
export function moveToDay(iso: string, day: string): string // même heure locale, autre jour

// sessionLog.ts
export interface SessionSummary { id: string; startedAt: string; day: string; templateName: string; exerciseCount: number; doneSets: number; open: boolean }
export function sessionSummaries(data: AppData): SessionSummary[]           // plus récentes d'abord ; exclut une séance ouverte sans série validée
export function sessionsByDay(data: AppData, month: string): Record<string, SessionSummary[]> // jours du mois → séances
export function canMoveTo(day: string, today: string): boolean              // false si day > today

// repo.ts
export function createPastSession(templateId: string, startedAt: string, sets: Omit<SetLog, 'sessionId'>[]): Promise<Session> // une transaction ; endedAt = startedAt
export function moveSession(id: string, startedAt: string, endedAt: string | null): Promise<void>
export function removeExerciseFromSession(sessionId: string, exerciseId: string): Promise<void> // une transaction
```

- [ ] **Step 1 : tests qui échouent.**
  - `localDay('2026-11-22T22:30:00.000Z')` → `'2026-11-22'` (23:30 Paris) ; `monthGrid('2026-11')` → 6 semaines, première cellule `'2026-10-26'`, dernière `'2026-12-06'` ; `addMonths('2026-12', 1)` → `'2027-01'`.
  - `moveToDay` : séance 23:30 locale le 22/11 déplacée au 20/11 → 23:30 locale le 20/11 ; à travers le 29/03/2026 → même heure locale (Review Focus 1).
  - `noonOf('2026-11-16')` → 12:00 locale ; `canMoveTo('2026-11-24','2026-11-23')` → false.
  - `sessionSummaries` : ordre décroissant, `templateName`, `exerciseCount`, `doneSets` justes ; séance ouverte sans série validée exclue, avec série validée incluse (`open: true`).
  - `sessionsByDay` : deux séances le même jour → deux entrées sous la même clé ; jours hors mois absents.
  - repo : `createPastSession` crée séance terminée + séries en une transaction (échec forcé de `db.sets.bulkAdd`/`put` → rien d'écrit) ; une séance passée plus ancienne que la dernière ne change pas `nextTemplateId` (Review Focus 2) ; `removeExerciseFromSession` supprime uniquement les séries de cet exercice dans cette séance, tout ou rien (Review Focus 4) ; `moveSession` met à jour les deux dates.
- [ ] **Step 2 :** `npm test` → FAIL. **Step 3 :** implémenter. **Step 4 :** `npm test` → PASS, `npm run build` OK.
- [ ] **Step 5 :** commit `feat(historique): domaine et écritures`.

### Task 2 : Calendrier et liste des séances

**Files :**
- Create : `src/features/history/CalendarPage.tsx`, `src/features/history/SessionListPage.tsx`, `src/features/history/history.css`, `src/features/history/labels.ts`
- Modify : `src/App.tsx` (routes), `src/features/progress/WeekSummaryPage.tsx` (le libellé « Semaine du … » devient un bouton vers `/progression/calendrier?mois=AAAA-MM` du mois de la semaine affichée)
- Test : `src/features/history/CalendarPage.test.tsx`

**Interfaces :** consomme Task 1 (`monthGrid`, `addMonths`, `sessionsByDay`, `sessionSummaries`, `localDay`) et `useAppData`. Produit les routes `/progression/calendrier`, `/progression/seances`.

Comportement : en-tête « novembre 2026 » + flèches ‹ › (pas de mois futur au-delà du mois courant) ; grille L M M J V S D ; jour courant souligné ; jours d'entraînement = pastille haltère (SVG inline, même tracé que l'onglet Séance) ; toucher un jour à une séance → `/seances/:id` ; plusieurs → petite liste (feuille) avec heure et séance type ; toucher le numéro de semaine/la ligne → `/progression?semaine=<lundi>` ; bouton « Toutes mes séances » → liste ; bouton « Ajouter une séance » → `/seances/nouvelle` (Task 4). Liste : groupée par mois, ligne = « lun. 17 nov. · Push · 5 exercices · 15 séries », séance en cours marquée « En cours ».

- [ ] **Step 1 : tests qui échouent** : toucher « Semaine du 16 nov. » ouvre le calendrier de novembre 2026 ; pastilles présentes exactement sur les jours avec séance ; toucher un jour ouvre `/seances/<id>` ; jour à deux séances → feuille avec deux choix ; « Toutes mes séances » liste les séances plus récentes d'abord avec le libellé exact ; flèche › absente sur le mois courant.
- [ ] **Step 2 :** FAIL. **Step 3 :** implémenter. **Step 4 :** PASS + build. **Step 5 :** commit `feat(historique): calendrier et liste des séances`.

### Task 3 : Détail et modification d'une séance

**Files :**
- Create : `src/features/history/SessionDetailPage.tsx`, `src/features/history/useSessionEditor.ts`
- Modify : `src/App.tsx` (route `/seances/:id`)
- Test : `src/features/history/SessionDetailPage.test.tsx`

**Interfaces :** consomme `SetRow` (`src/features/session/SetRow.tsx`), `ExercisePicker`, `ConfirmSheet`, `SaveError` (`src/features/programs/`), repo (`saveSet`, `deleteSet`, `deleteSession`, `moveSession`, `removeExerciseFromSession`), Task 1 (`moveToDay`, `canMoveTo`, `localDay`).

Comportement : en-tête date + séance type + bouton « Modifier la date » (input `type="date"`, max = aujourd'hui) ; une carte par exercice avec ses séries (`SetRow`) : modifier poids/répétitions, valider/dévalider, ajouter une série, supprimer une série ; « Retirer l'exercice » (confirmation) ; « Ajouter un exercice » (sélecteur) ; « Supprimer la séance » (confirmation exacte des contraintes) → retour au calendrier. Séance en cours → `<Navigate to="/" replace />`. Écritures en file ordonnée, échec → `SaveError` + rechargement. Séance vidée reste affichée.

- [ ] **Step 1 : tests qui échouent** :
  - modifier 80 → 82,5 sur une série d'une séance terminée enregistre 82.5 ; avec `buildHistory`+`suggestNext`, la proposition suivante part de 82,5 (Review Focus 3) ;
  - dévalider une série enregistre `done: false` ; ajouter/supprimer une série persiste ;
  - « Modifier la date » vers la veille met à jour `startedAt` (même heure) ; une date future est refusée avec message ;
  - « Retirer l'exercice » puis confirmer supprime ses séries ; `removeExerciseFromSession` en échec → bandeau « Enregistrement impossible… » et séries toujours affichées (Review Focus 4) ;
  - « Supprimer la séance » + confirmation → séance et séries absentes, navigation vers le calendrier ;
  - ouvrir l'id de la séance en cours → onglet Séance (Review Focus 5).
- [ ] **Step 2 :** FAIL. **Step 3 :** implémenter. **Step 4 :** PASS + build. **Step 5 :** commit `feat(historique): détail et modification d'une séance`.

### Task 4 : Ajouter une séance oubliée

**Files :**
- Create : `src/features/history/NewPastSessionPage.tsx`
- Modify : `src/App.tsx` (route `/seances/nouvelle`), `CalendarPage.tsx` (toucher un jour passé sans séance propose « Ajouter une séance ce jour-là »)
- Test : `src/features/history/NewPastSessionPage.test.tsx`

Comportement : date (paramètre `?date=` ou input, max aujourd'hui) + choix de la séance type (liste des programmes non vides) → `createPastSession(templateId, noonOf(date), sets)` avec, pour chaque exercice du programme, `sets` séries vides (`weight 0, reps 0, done false, planned* null`) → navigation vers `/seances/:id` pour remplir.

- [ ] **Step 1 : tests qui échouent** : depuis le calendrier, toucher le 10/11 (sans séance) → bouton « Ajouter une séance ce jour-là » → choisir Push → séance créée le 10/11 à 12:00, terminée, 5 exercices × séries prévues vides, ouverture du détail ; date future refusée ; la séance apparaît avec sa pastille dans le calendrier.
- [ ] **Step 2 :** FAIL. **Step 3 :** implémenter. **Step 4 :** PASS + build. **Step 5 :** commit `feat(historique): ajout d'une séance oubliée`.
