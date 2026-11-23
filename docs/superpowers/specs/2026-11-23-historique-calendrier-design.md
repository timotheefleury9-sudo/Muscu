# Historique des séances et calendrier — conception

Date : 2026-11-23 · Statut : validé par Tim · Complète `2026-11-22-app-muscu-design.md`

## Intention

Tim veut accéder à toutes ses séances enregistrées, les corriger ou les supprimer même terminées, voir sur un calendrier les jours où il s'est entraîné et ouvrir une séance d'un tap. Il veut aussi pouvoir ajouter après coup une séance oubliée et changer la date d'une séance mal enregistrée.

## Objectifs / non-objectifs / anti-objectifs

- **Objectifs** : calendrier mensuel ; liste de toutes les séances ; détail d'une séance terminée modifiable ; suppression ; ajout d'une séance passée ; changement de date.
- **Non-objectifs** : modifier une séance en cours depuis l'historique (elle reste dans l'onglet Séance) ; statistiques nouvelles.
- **Anti-objectifs** : perdre ou corrompre des données par une modification ; un calendrier illisible sur iPhone ; des charges proposées qui ne tiennent pas compte des corrections.

## Approches

| Approche | Compromis | Décision |
|---|---|---|
| **A. Réutiliser les composants de saisie de l'écran Séance** (lignes de série, boutons +/−) dans un écran « détail de séance » | Même geste qu'en salle, peu de code nouveau | **Retenue (seule approche sensée)** |
| B. Formulaire d'édition séparé (tableau de champs) | Plus simple à coder mais deux façons de saisir, incohérent | Écartée |

## Ce que Tim a validé

1. Dans Progression, toucher « Semaine du … » ouvre un **calendrier mensuel** : jours d'entraînement marqués, flèches de mois, toucher un jour ouvre la séance, toucher une semaine revient au bilan de cette semaine.
2. **Détail d'une séance terminée** : date, séance type, exercices et séries ; modifier poids/répétitions, ajouter/supprimer une série, valider/dévalider ; **supprimer la séance** (confirmation).
3. **Liste « Toutes mes séances »** depuis le calendrier, la plus récente en haut.
4. **Ajouter une séance oubliée** (date au choix) et **changer la date** d'une séance.

## Choix de Claude (à corriger si besoin)

- **Marquage des jours** (choix de Tim) : une seule pastille avec une icône d'haltère sur chaque jour d'entraînement, sans couleur ni légende ; le détail (séance type, exercices) s'affiche en touchant le jour. Plusieurs séances le même jour : toujours une seule pastille ; toucher le jour ouvre une petite liste.
- **Écrans et adresses** : `/progression/calendrier?mois=AAAA-MM`, `/progression/seances` (liste), `/seances/:id` (détail), `/seances/nouvelle?date=AAAA-MM-JJ`.
- **Liste** : date courte, séance type, nombre d'exercices et de séries validées ; groupée par mois.
- **Modification** : chaque changement est enregistré immédiatement, avec le même bandeau d'erreur que l'écran Séance. On peut aussi ajouter un exercice oublié (sélecteur d'exercices existant) et retirer un exercice de la séance.
- **Séance en cours** : depuis l'historique, elle ouvre l'onglet Séance au lieu de l'éditeur.
- **Changer la date** : sélecteur de date natif iOS ; l'heure d'origine est conservée ; pas de date future.
- **Séance oubliée** : choix de la date (calendrier ou bouton « Ajouter une séance ») puis de la séance type ; séries vides à remplir (pas de pré-remplissage) ; heure fixée à 12:00 locale pour éviter les erreurs de semaine ; la séance est créée terminée.
- **Suppression** : séance et séries supprimées en une seule opération ; confirmation « Supprimer cette séance ? C'est définitif. »
- **Effets sur le reste** : progression, bilan, courbes et records se recalculent depuis l'historique corrigé. La rotation (prochaine séance proposée) ne dépend que de la séance la plus récente : ajouter une séance plus ancienne ne la change pas.
- **Séance vidée** : si toutes les séries validées sont supprimées ou dévalidées, la séance reste visible jusqu'à suppression explicite (pas de suppression silencieuse).

## Laissé au builder

Style visuel dans la continuité des maquettes validées, structure du code, découpage en lots.
