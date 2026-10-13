# Direction artistique et système d'interface

Ce document est le contrat que **tout** écran de `apps/web` respecte. Il tient
en une page parce qu'un système qu'on ne relit pas n'est pas tenu.

## 1. L'idée

**La forge.** Le produit chauffe une matière (le brouillon) et en sort une
pièce finie (le dépôt). Deux couleurs, deux rôles, jamais échangés :

| Couleur | Variable | Dit |
|---|---|---|
| Orange | `--pf-accent` | l'action, ce qui est en cours, ce qui reste à faire |
| Acier (cyan froid) | `--pf-steel` | l'information, le lien, la donnée mesurée |

Vert, ambre et rouge (`--pf-ok`, `--pf-warn`, `--pf-danger`) ne décorent
jamais : ils sont posés par un **résultat**, pas choisis par un écran.

Aucune couleur en dur dans un composant. Tout passe par les variables de
`src/app/globals.css`, seule source de couleur des deux thèmes.

## 2. Les deux familles

- **Inter** (`--pf-sans`, le défaut du `body`) porte la **prose** : titres,
  phrases, libellés de bouton, aide.
- **JetBrains Mono** (`--pf-mono`, classe `.pf-mono`) porte la **donnée** :
  chemins, identifiants techniques, commandes, compteurs d'étape,
  pourcentages, tailles, codes d'erreur, badges.

C'est une règle de sens, pas de goût : le lecteur apprend en une page que ce
qui est en chasse fixe est une valeur. Un libellé de bouton n'est jamais en
chasse fixe ; un chemin ne l'est jamais en Inter.

Échelle : `.pf-display` (titre d'écran), `.pf-title`, `.pf-title-sm` (titre de
carte), corps 15 px, `.pf-hint` 13 px, `.pf-eyebrow` 11 px en chasse fixe.

Pas d'étiquette en CAPITALES traquées. L'eyebrow est en chasse fixe : la
famille dit déjà « étiquette de donnée ».

## 3. Les composants réutilisables

Tous sous `src/components/ui/` — sauf `Toaster`, `ThemeToggle` et
`LocaleToggle`, qui vivent dans `src/app/` parce qu'ils portent l'état du
document (stockage, `data-theme`, `lang`). **Aucun écran ne redessine ce qui
existe.**

| Composant | Rôle |
|---|---|
| `Icon` | le jeu d'icônes, grille 24, trait `currentColor` |
| `TechIcon` | le logo d'une technologie du catalogue (sprite SVG), monogramme en repli |
| `Illustration` | les trois dessins de la maison : `forge`, `lost`, `empty` |
| `Logo`, `Wordmark` | le logo, qui suit le thème sans JavaScript (WebP en image de fond) |
| `Card`, `CardHead` | une unité de décision délimitée |
| `Stepper` | les douze numéros sur une ligne de progression à partir de 48rem ; une simple barre en dessous |
| `BubbleNav` | la navigation en pilules, dans sa bulle de l'en-tête |
| `CopyButton`, `CommandLine`, `CommandSteps` | une valeur technique et sa copie, une marche à suivre |
| `PickCard` | la carte qui **est** le geste : l'appuyer ouvre l'explorateur |
| `OptionCard` | une technologie (Stack, Capacités, Hébergement) : coche de sélection, carte grisée et nom rouge si incompatible |
| `InfoTip` | la bulle `!` : s'ouvre au clic, à Entrée ou au survol, jamais au simple focus ; peut porter des liens |
| `DisclosureButton` | « Voir toutes les options » : un bouton repliable, chevron qui pivote |
| `CATEGORY_ICONS` (`category-icon.ts`) | l'icône de chacune des 37 catégories, vérifiée à la compilation |
| `ProjectExport`, `OutputProgress` | les deux sorties d'un projet (ZIP, dossier + installation) et leur unique barre d'avancement |
| `ProjectArchitecture` | l'arbre commenté et repliable des fichiers générés (étape 10, `/projects/architecture`) |
| `Spinner`, `Dots`, `ProgressBar`, `LoadingLine`, `ProgressPanel` | les attentes |
| `EmptyState`, `ErrorState`, `IssueList`, `NoteList` | les vides, les arrêts et les refus |
| `PathPicker` | choisir un dossier ou un fichier **dans l'explorateur système** |
| `ProjectCard` | un projet déjà généré, sur l'accueil comme dans la collection |
| `Toaster`, `ThemeToggle`, `LocaleToggle` | les retours d'action ; un bouton soleil/lune (défaut : le système) ; `FR`/`EN` sans icône |
| `AppShell` | les bulles flottantes de l'en-tête, le pied, les liens d'évitement |
| `ScreenShell`, `StepShell` (dans `components/wizard/shell.tsx`) | les deux cadres de page : icône de titre, bouton « Annuler » de l'étape |

Les classes `pf-*` de `globals.css` restent disponibles : `pf-btn`,
`pf-btn-primary`, `pf-btn-ghost`, `pf-btn-danger`, `pf-btn-sm`, `pf-btn-lg`,
`pf-btn-icon`, `pf-card`, `pf-card-pad`, `pf-card-accent`, `pf-card-head`,
`pf-choice`, `pf-grid`, `pf-badge` (+ `-accent`, `-ok`, `-danger`), `pf-input`,
`pf-label`, `pf-code`, `pf-bubble`, `pf-tabs`/`pf-tab`, `pf-page-head`,
`pf-rows`/`pf-row-item`, `pf-callout` (+ `-steel`), `pf-link`, `pf-table`,
`pf-scroll-x`, `pf-card-progress`, `pf-route-loading`, `pf-sr-only-focusable`,
`pf-pod` (la bulle de l'en-tête, + `-identity`, `-action`), `pf-segmented`/
`pf-segment`, `pf-command`/`pf-command-text`, `pf-steps-list`, `pf-footer`,
`pf-empty-state`, `pf-option`, `pf-tip`, `pf-disclosure`, `pf-locale`, `pf-sr-only`.

Les zones qui ont leur propriétaire ont leur feuille, importée par
`globals.css` : `src/styles/journey.css` (stepper, glissement d'étape,
annulation), `output.css` (sorties d'un projet), `architecture.css` (arbre
commenté), `graph.css` (graphe et légende), `share.css` (plan du projet,
lien de partage), `clone.css` (copie hébergée d'un dépôt). Même règles que la feuille principale.

Rien n'y est déclaré sans usage : une classe ou un jeton qui ne sert nulle part
est du dessin mort, il part avec le reste. L'audit se fait en comparant les
`.pf-*` / `--pf-*` déclarés dans `globals.css` à ce que le balisage consomme —
`pf-sr-only` et `--pf-shadow-lift` sont partis comme ça.

## 4. Les chargements — aucun squelette

Un squelette promet une forme avant de la connaître ; il fait sauter la page
quand la vraie donnée arrive, et il ment quand la requête échoue.

| On sait… | Forme |
|---|---|
| rien, c'est court | `Dots` |
| rien, c'est long | `LoadingLine` avec une phrase qui **nomme le travail** |
| le pourcentage réel | `ProgressBar` / `ProgressPanel` |

« Chargement… » ne dit rien. « Lecture de vos dépôts GitHub… » dit quoi
attendre. **Jamais de pourcentage inventé** : sans mesure, `ProgressBar` sans
`value` rend une barre indéterminée, de la même hauteur et à la même place.

## 5. Les chemins de fichiers

Un chemin ne se tape pas, **dans aucun mode**. Deux explorateurs, une seule
intention :

- **en local** (`pf web`), `PathPicker` et `pickFolderAction` ouvrent
  l'explorateur *de la machine* (PowerShell sous Windows, `osascript` sous
  macOS, `zenity` sous Linux) par une Server Action, et rendent un chemin
  absolu ;
- **en hébergé**, le serveur n'est pas sur la machine du visiteur : c'est son
  navigateur qui ouvre l'explorateur (File System Access API,
  `app/open/browser-picker.ts`). Il ne rend pas de chemin, seulement les noms
  des fichiers du premier niveau et le texte de `package.json` : assez pour
  reconnaître le projet par la **même** règle qu'en local
  (`detectFromEntries`, dans `@buildit/workspace`), pas pour l'installer. Les
  écrans le disent à cet endroit-là, et montrent la commande à copier.

Le chemin rendu n'est pas pour autant cru : l'action qui suit le revalide
(`resolveLocalDirectory`, `resolveAbsoluteDestination`, `deletionTarget`).

## 6. Les deux langues

Français et anglais, via `useMessages()` (`src/lib/i18n/`). Le dictionnaire
est découpé par zone — `messages.dashboard.ts`, `messages.workspace.ts`,
`messages.wizard.ts`, `messages.build.ts`, `messages.account.ts` — et
recomposé par `messages.ts`. Le français fait foi : une clé ajoutée d'un côté
sans l'autre fait échouer `pnpm typecheck`.

**Ne sont pas traduits** : les identifiants techniques (`next`, `pnpm
install`), les chemins, les sorties de commande et les refus venus du moteur.
Ce sont les mêmes phrases que le CLI affiche.

## 7. Le mouvement

Court, et seulement en réponse à un geste : `pf-fade-in` à l'entrée d'un
écran, 120–180 ms sur les survols et les états. Pas d'entrée en cascade par
section, pas d'animation au défilement. `prefers-reduced-motion` est respecté
globalement dans `globals.css`.

**Rien ne se déplace sous le curseur.** Un survol change une couleur, une
bordure ou une ombre ; il ne décale jamais l'élément, ni d'un pixel. Un
déplacement au survol fait trembler une grille entière quand la souris la
traverse, et déplace la cible qu'on vise.

Seule exception, parce qu'elle répond à un geste et non au survol : le
changement d'étape. « Continuer » fait entrer l'étape suivante de droite à
gauche, « Précédent » (ou un retour par le stepper) de gauche à droite, en
220 ms. Rien sur un rechargement ; sous `prefers-reduced-motion`, un simple
fondu.

## 8. Le plancher de qualité

Non négociable, sur chaque écran :

- responsive jusqu'à 360 px de large, sans défilement horizontal ;
- `:focus-visible` visible sur tout élément interactif ;
- un bouton désactivé **dit pourquoi** juste à côté (§12) ;
- tout écran hors parcours porte un retour (`ScreenShell` en pose un par
  défaut) : pas de cul-de-sac ;
- contraste AA sur le texte, 3:1 sur les frontières de contrôle, dans les
  deux thèmes ;
- une icône seule porte un `aria-label` ; sinon elle est décorative.

## 9. Ce qu'on ne fait pas

- Pas de dégradé décoratif, pas d'ombre colorée sous chaque carte.
- Pas de grille de rectangles identiques : une carte délimite une décision,
  pas un paragraphe.
- Pas de numéros `01 / 02 / 03` hors d'une vraie séquence — le parcours en
  est une, le reste non.
- Pas de `→` collé au texte d'un lien : l'icône `arrowRight` existe.
- Pas de tiret cadratin dans un texte affiché : deux-points quand la suite
  explique, virgule quand elle apposait, point quand c'est une phrase de plus.
- Pas de couleur de marque sortie d'un logo de technologie au milieu d'une
  grille : `TechIcon` suit `currentColor`.
