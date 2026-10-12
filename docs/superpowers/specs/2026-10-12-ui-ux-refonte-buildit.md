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

## Ce qui a été livré

- **Jetons et direction artistique** (`apps/web/src/app/globals.css`) : orange d'action `#c2490c` / `#ff8a3d`, acier `#0d6e7b` / `#3fc6cf`, surfaces et états des deux thèmes, échelle de rayons et d'ombres, courbe d'accélération unique, deux halos de fond (chaud en haut, froid à droite). Contraste mesuré : `--pf-faint` remonte à 4,84:1 (fond) / 5,05:1 (surface) et une variante `--pf-accent-strong` (5,02:1) porte le texte orange sur fond teinté.
- **Primitives** : `Card`, `CardHead`, `EmptyState` (illustration optionnelle), `ErrorState`, `IssueList` (refus dédupliqués), `Illustration` (`forge`, `lost`, `empty`), `Icon`, `Spinner`/`Dots`/`ProgressBar`/`LoadingLine`/`ProgressPanel`, `PathPicker`, `ProjectCard`, `TechIcon`, `Stepper`, `BubbleNav`, `AppShell`.
- **Écrans** : accueil (deux derniers projets + lien vers la collection), `projects/` (collection complète, oubli unitaire et vidage confirmé), `open/` (explorateur natif, barre d'avancement dans la carte), `clone/` (parent choisi dans l'explorateur, avancement SSE réel, annulation honnête, destination inaccessible expliquée), les douze étapes de `create/` (bilingues, erreurs actionnables, progression réelle), `github/`, `repo/` (dossier choisi par `PathPicker`), `share/`, `graph/`.
- **États de route** : `loading.tsx` (barre indéterminée, aucun squelette), `error.tsx` (réessayer / accueil, digest non traduit), `global-error.tsx` (styles inline, bilingue), `not-found.tsx`.
- **Prestations** : logos WebP en image de fond (une seule requête par thème), `images.unoptimized` (le moteur d'images de Next exige `sharp`, absent), deux parcours E2E verts, captures de rendu (`e2e/shots.mjs`).

## Défauts fermés pendant la vérification

1. **Hydratation `#418` sur `create/target`, `create/preview`, `create/generate`** — `useSyncExternalStore` recevait `store.get` comme *snapshot serveur* : un composant hydraté après le branchement de `localStorage` rendait une sélection absente du HTML. `SessionStore.getServer()` porte désormais le brouillon d'avant branchement.
2. **Logos cassés dans les deux thèmes** — toute requête `/_next/image` répondait 400 (`sharp` absent). Les logos sont servis en WebP, via une variable CSS par thème.
3. **404 divergente** — le chemin demandé n'existe pas au rendu serveur ; il apparaît après le montage.
4. **Champs sans anneau de focus** — `.pf-input:focus` supprimait l'`outline` du navigateur ; le liseré chaud s'y ajoute maintenant.
5. **Clés React dupliquées** dans les listes de refus — regroupement des phrases identiques plutôt qu'une clé d'index.

