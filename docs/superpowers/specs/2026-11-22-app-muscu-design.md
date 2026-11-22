# App de suivi musculation — document de conception

Date : 2026-11-22 · Statut : validé par Tim

## 1. Intention

Tim note aujourd'hui ses séances dans l'app Notes de l'iPhone. Ce qui le gêne : ce n'est pas visuel, il ne voit pas ses progrès. Il veut une app qui :

- permet de saisir ses performances en salle (exercices, séries, répétitions, poids) ;
- lui montre clairement sa progression semaine après semaine ;
- propose la charge suivante selon une règle de surcharge progressive.

Elle est d'abord pour lui. Il la partage ensuite à des amis, qui suivent leurs propres séances et lui font des retours pour l'améliorer. Tout le code est délégué à Claude ; Tim décide et teste.

## 2. Objectifs, non-objectifs, anti-objectifs

**Objectifs (V1)**
- Créer et modifier des séances types (templates) à partir d'une base d'exercices.
- Saisir une séance en salle avec des séries pré-remplies, validées d'un tap.
- Proposer automatiquement la charge / les répétitions de la prochaine séance (double progression).
- Écran « Progression » centré sur un bilan hebdomadaire, avec détail par muscle et par exercice.
- Installable gratuitement sur iPhone et partageable par un simple lien.

**Non-objectifs (V1)**
- Minuteur de repos et notifications (abandonné explicitement par Tim).
- Comptes utilisateurs, synchronisation cloud, fonctions sociales (voir les séances des amis).
- Publication sur l'App Store, appli native.
- Multilingue : interface en français uniquement.

**Anti-objectifs (échec même si « ça marche »)**
- Saisir une séance est plus lent ou plus pénible qu'avec Notes.
- Des données perdues sans prévenir.
- Des charges proposées fausses (erreur dans la logique de progression).

## 3. Contraintes

- iPhone, Safari et Chrome (Chrome sur iPhone utilise le même moteur que Safari ; l'installation sur l'écran d'accueil depuis Chrome est à vérifier sur l'iPhone de Tim dès le 1er lot). Coût nul : pas de compte développeur Apple à 99 $/an.
- Les données de l'app installée sur l'écran d'accueil sont séparées de celles d'un onglet Safari ou Chrome : l'app indique à l'utilisateur d'utiliser la version installée.
- Fonctionne hors ligne en salle.
- Données stockées uniquement sur le téléphone de chaque utilisateur.
- Unités : kg.

## 4. Approches envisagées

| Approche | Compromis | Décision |
|---|---|---|
| **A. PWA locale** (appli web installée sur l'écran d'accueil, données dans le navigateur, pas de serveur) | Gratuite, partage par lien, hors ligne. Pas de sync ni de notifications sur écran verrouillé. Sauvegarde uniquement par export. | **Retenue par Tim** |
| B. PWA + serveur gratuit (Supabase) | Comptes, sync, social, notifications. Bien plus de travail (auth, sécurité), limites de l'offre gratuite. | Écartée pour la V1 ; le code doit permettre de l'ajouter plus tard sans réécriture (accès aux données isolé dans une couche dédiée). |
| C. Natif SwiftUI / Expo | Meilleure intégration iOS. Sans compte payant : réinstallation tous les 7 jours, impossible à partager. | Écartée (coût / partage). |

## 5. Ce que Tim a décidé

- **Plateforme** : PWA locale (approche A).
- **Programme** : PPL, 3 séances par semaine. Le template fourni au premier lancement (modifiable) est le programme actuel de Tim :
  - **Push** : développé couché haltères · presse pectoraux · fly · extension triceps · élévations latérales poulie
  - **Pull** : tractions · tirage horizontal machine · rowing poulie · fly arrière (deltoïde postérieur) · curl haltères
  - **Legs** : squat · soulevé de terre · fentes marchées avec sac à dos lesté · leg extension
- Séries / fourchettes par défaut (choix de Claude, modifiables) : squat et soulevé de terre 3 × 5–8 ; autres poly-articulaires 3 × 8–12 ; isolation 3 × 10–15. Pas de poids de départ : Tim saisit le poids à la 1re séance de chaque exercice, les propositions démarrent à la 2e.
- Incréments (choix de Claude) : haltères 2 kg ; fentes avec sac 2 kg (exercice personnalisé, poids = charge du sac) ; machines / poulies 2,5 kg ; barre 2,5 kg. Le soulevé de terre est rattaché aux Ischios, les tractions au Dos (poids du corps).
- Import de l'historique Notes : hors V1 sauf décision contraire de Tim.
- **Surcharge progressive** : double progression (détail §7).
- **Saisie** : chaque série est pré-remplie avec le poids et les répétitions prévus ; Tim valide d'un tap et ne modifie qu'en cas d'écart.
- **Écran principal de Progression** : bilan de la semaine (maquette B) :
  - séances faites / prévues (« x / 3 ») ;
  - nombre de records de la semaine ;
  - nombre de séries par groupe musculaire (barres) ;
  - évolution de chaque exercice vs semaine précédente.
- **Détail par muscle** : toucher un groupe musculaire dans le bilan → liste des exercices de ce muscle faits cette semaine, avec séries, meilleure série et évolution.
- **Détail par exercice** : toucher un exercice → courbe sur plusieurs semaines.
- **Partage** : les amis reçoivent un lien, utilisent l'app pour eux-mêmes et font leurs retours à Tim directement (pas de bouton de retour dans l'app).

## 6. Écrans

1. **Aujourd'hui / séance** : propose la prochaine séance de la rotation (Push → Pull → Legs). Liste des exercices ; pour chacun, les séries pré-remplies (poids × reps). Tap = série faite. Modification rapide du poids et des reps (boutons +/- avec l'incrément de l'exercice, ou saisie). Ajouter / supprimer une série, sauter un exercice. Terminer la séance.
2. **Programmes** : liste des templates ; édition (ordre des exercices, nombre de séries, fourchette de reps, temps de repos indicatif — affiché seulement, pas de minuteur). Sélecteur d'exercices avec recherche et filtre par muscle ; création d'exercices personnalisés.
3. **Progression** : bilan hebdo (navigation semaine précédente / suivante) → détail muscle → détail exercice (courbe).
4. **Réglages** : export / import des données (JSON), incréments par défaut.

## 7. Règles métier

**Double progression** (par exercice d'un template) :
- Chaque exercice a une fourchette de reps [min, max] (ex. 8–12) et un nombre de séries.
- Si, à la dernière séance, toutes les séries ont atteint `max` au poids prévu → charge suivante = poids + incrément, reps cibles = `min`.
- Sinon → même poids ; cible = refaire au moins aussi bien série par série.
- Une séance est un **échec** si au moins une série n'atteint pas `min`. Après **3 échecs consécutifs** sur un exercice → charge −10 %, arrondie à l'incrément inférieur.
- Première fois sur un exercice (pas d'historique) : pas de proposition, l'utilisateur saisit le poids.
- Incréments par défaut : 2,5 kg (poly-articulaires), 1 kg (isolation) ; modifiables par exercice (ex. haltères à 2 kg).
- Exercices au poids du corps (tractions, dips) : poids = 0 par défaut (lest possible) ; la progression porte sur les reps.

**Cas où le plan n'est pas suivi** (choix de Claude)
- L'historique de progression est suivi **par exercice** (toutes séances confondues) ; la fourchette de reps vient de l'exercice dans le template en cours. `SetLog` garde aussi le lien vers le `TemplateExercise`.
- Poids de référence d'une séance = poids de la 1re série validée. Si Tim a soulevé plus lourd ou plus léger que prévu, la proposition suivante part du réel, pas du prévu.
- Après une séance sans montée de charge : même poids, reps pré-remplies = reps réelles de la séance précédente série par série (à égaler ou battre).
- Toute séance non-échec remet le compteur d'échecs à zéro ; une baisse de charge (−10 %) aussi.
- Séries non validées : ignorées. Séries en plus : comptent dans le volume, pas dans le test « toutes les séries à `max` » (seules les N premières séries prévues comptent). Exercice sauté : ni succès ni échec.
- Une séance avec au moins une série validée compte dans le « x / 3 » et fait avancer la rotation ; une séance non terminée est clôturée automatiquement à l'ouverture suivante de l'app.

**Poids du corps** (choix de Claude)
- Le poids stocké est le lest seul. Quand toutes les séries atteignent `max` sans lest, l'app affiche « Fourchette atteinte : ajoute du lest ou passe à une variante » au lieu d'une charge. Dès qu'un lest est saisi, la règle standard s'applique. Pas de baisse de charge à 0 kg.
- Records et évolution comparés sur (lest, reps) : plus de lest = progrès ; même lest et plus de reps = progrès.

**Indicateurs**
- **1RM estimé** (formule d'Epley) : `poids × (1 + reps / 30)`, calculé sur la meilleure série de la semaine. Pour le poids du corps sans lest : on compare le nombre de reps de la meilleure série.
- **Évolution vs semaine précédente** : « +x kg » si le poids max a augmenté, « +x reps » si même poids et plus de reps, « = » sinon. Signal orange après 3 semaines sans progrès.
- **Record** : meilleur 1RM estimé (ou meilleures reps au poids du corps) jamais atteint sur l'exercice.
- **Séries par muscle** : nombre de séries validées, attribuées **au seul muscle principal** de l'exercice. Les ~17 muscles de la base sont regroupés en 10 groupes affichés (choix de Claude) : Pectoraux, Dos, Épaules, Biceps, Triceps, Quadriceps, Ischios, Fessiers, Mollets, Abdos.
- Import de données : remplace tout l'existant, après confirmation (choix de Claude).
- Semaine = lundi → dimanche.

## 8. Données

- `Exercise` : id, nom (FR), muscle principal, muscles secondaires, matériel, poly-articulaire ou isolation, incrément, personnalisé ou non.
- `WorkoutTemplate` : id, nom (Push / Pull / Legs…), ordre dans la rotation.
- `TemplateExercise` : template, exercice, ordre, nb de séries, reps min, reps max, repos indicatif.
- `Session` : id, template, date de début / fin.
- `SetLog` : séance, exercice, n° de série, poids prévu, reps prévues, poids réel, reps réelles, validée.

Le réalisé (`SetLog`) est stocké indépendamment du template : modifier un programme ne change jamais l'historique.

## 9. Choix techniques (proposés par Claude)

- React + TypeScript + Vite, plugin PWA (service worker, manifeste, installation sur l'écran d'accueil iOS).
- Stockage : IndexedDB (via Dexie), derrière une couche d'accès dédiée (pour ajouter un serveur plus tard). Demande de stockage persistant au navigateur + rappel d'export régulier.
- Graphiques : bibliothèque légère (Recharts ou Chart.js).
- Tests automatisés (Vitest) obligatoires sur : règles de progression, 1RM, évolution hebdo, séries par muscle, découpage des semaines.
- Base d'exercices : free-exercise-db (open source, ~800 exercices avec muscles et matériel) — licence à confirmer au démarrage. Noms traduits en français une fois, stockés dans le dépôt. Pas d'images en V1.
- Hébergement gratuit : GitHub Pages ou Netlify.
- Export JSON versionné (pour migrations futures et pour qu'un ami puisse envoyer ses données en cas de bug).

## 10. Expérience utilisateur

Tim veut une interface très fluide et interactive. Référence citée par Tim : l'app Revolut (inspiration pour le ressenti : chiffres clés mis en avant, cartes épurées, transitions fluides — sans reprendre sa marque, ses couleurs ni ses éléments graphiques). Exigences :
- Réponse instantanée à chaque action : données locales, aucun écran de chargement en usage normal.
- Animations fluides (60 images/s) : transitions entre écrans, validation d'une série (animation de coche), apparition des graphiques.
- Gestes : glisser une série pour la supprimer, retour par glissement depuis le bord, défilement fluide.
- Pensée pour la salle : grandes zones tactiles, utilisable d'une main, contrastes lisibles, mode sombre.
- Les animations ne doivent jamais ralentir la saisie : courtes (< 300 ms) et interruptibles.
- Limite connue : pas de retour haptique (vibration) depuis une app web sur iPhone.
- Avant de coder les écrans : maquettes des écrans principaux (séance, bilan) soumises à Tim pour validation du rendu.

## 11. Laissé au builder

Choix exact des bibliothèques (y compris d'animation), structure du code, découpage en lots du plan, détail du style visuel dans le cadre du §10 et des maquettes validées.
