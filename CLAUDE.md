# Muscu

PWA iPhone (Safari et Chrome) de suivi d'entraînement de musculation. Interface en français uniquement, données locales, hors ligne, coût nul.

- Spec : `docs/superpowers/specs/2026-11-22-app-muscu-design.md`
- Plan : `docs/superpowers/plans/2026-11-22-app-muscu.md`

## Stack

Vite, React 18, TypeScript strict, vite-plugin-pwa (autoUpdate), Dexie, React Router, Framer Motion, Recharts, Vitest + Testing Library + fake-indexeddb. Gestionnaire : `npm`.

Commandes : `npm run dev`, `npm test`, `npm run build`, `npm run icons` (régénère les icônes de substitution).

## Découpage

- `src/domain/` : logique métier pure (progression, charges, semaines, etc.). Aucune dépendance à React ni à Dexie.
- `src/data/` : stockage Dexie, dépôts, export/import.
- `src/features/` : écrans et composants React (`session`, `programs`, `progress`, `settings`).
- `src/styles/theme.css` : variables CSS (thème sombre par défaut, clair via `prefers-color-scheme`), safe areas.

**Règle : la logique métier vit uniquement dans `src/domain/` et est toujours testée.**

Catalogue : toute évolution du catalogue exige une nouvelle version Dexie avec upgrade (cf. version(2), src/data/migrations.ts).

## Déploiement

GitHub Pages via `.github/workflows/deploy.yml` (push sur `main`). Dépôt `timotheefleury9-sudo/Muscu` → Vite `base: '/Muscu/'`, Router avec `basename` = `import.meta.env.BASE_URL`. `404.html` = copie de `index.html` pour les liens profonds.

## Contraintes

Pas de minuteur, de notification ni de vibration. Zones tactiles >= 44 px. Safe areas gérées (`viewport-fit=cover`).

## Vérifications appareil

- Safari iPhone : OK (iOS 27.2.1 : status-bar-style `default` obligatoire, `black-translucent` laisse une bande non affichable en bas).
- Chrome iPhone : à vérifier.
