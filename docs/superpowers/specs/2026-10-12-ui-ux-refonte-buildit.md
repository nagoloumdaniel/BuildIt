# Refonte UI/UX BuildIt

## Objectif

Rendre BuildIt plus lisible, cohérent et performant sur desktop et mobile, avec un parcours de création, d'ouverture et de clonage compréhensible sans saisie manuelle de chemins locaux.

## Principes visuels

- Inter porte les titres, phrases, libellés et actions.
- JetBrains Mono porte chemins, statuts techniques, identifiants et métriques.
- Orange reste la couleur d'action et de progression.
- Bleu pétrole complète l'orange pour l'information et les états secondaires.
- Les thèmes clair et sombre utilisent les deux logos existants avec bascule CSS sans flash.
- Pas de skeletons. Utiliser spinner, dots, barre indéterminée ou progression réelle.
- Contraste, focus clavier, cibles tactiles et responsive restent obligatoires.

## Architecture d'interface

1. `AppShell` fournit en-tête, wordmark, navigation en bulles, thème, langue et retour.
2. Les pages utilisent des primitives partagées : `Card`, `Stepper`, `ProgressPanel`, `PathPicker`, `EmptyState`, `ErrorState`, `ProjectCard`, `TechIcon`.
3. Le dashboard affiche les deux projets générés les plus récents. Une page dédiée liste tous les projets.
4. Un projet généré n'est jamais présenté comme brouillon.
5. Les pages de création réutilisent le stepper et une action retour explicite.

## Parcours locaux

- `Ouvrir un projet local` ouvre le sélecteur natif Windows quand disponible.
- La destination de clonage utilise le sélecteur natif de dossier, jamais un champ de chemin local en mode desktop.
- Le clone expose son avancement réel avec barre, phase et détail.
- Une destination invalide ou inaccessible affiche une erreur actionnable et propose de rouvrir l'explorateur.
- Les modes hébergés conservent un fallback manuel explicite, car le serveur ne peut pas ouvrir l'explorateur de la machine du visiteur.

## États et erreurs

- Chaque opération longue possède un état d'attente, succès, erreur et annulation.
- Les erreurs utilisent un titre clair, une explication courte, une action de récupération et un bouton retour.
- Une page `404` reprend le shell et propose retour accueil.

## Internationalisation

Tous les libellés ajoutés sont disponibles en français et anglais. Les chemins et identifiants ne sont jamais traduits.

## Vérification

- Tests ciblés des composants et flux modifiés.
- `pnpm --filter @buildit/web typecheck`.
- `pnpm --filter @buildit/web test`.
- `pnpm --filter @buildit/web build`.
- Lancement de `pnpm --filter @buildit/web dev` pour fournir une URL de preview.

## Limites de périmètre

La refonte réutilise les primitives et données existantes. Elle n'ajoute pas de backend de persistance ni de nouvelle dépendance d'icônes si les SVG déjà présents couvrent le besoin.
