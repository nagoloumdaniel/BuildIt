# Audit de compatibilité des technologies

Ce document dit **comment** le configurateur décide qu'une combinaison est
possible, et ce que l'audit du 12/10/2026 a changé. Les règles vivent à un seul
endroit, `packages/compatibility` ; les données qu'elles lisent vivent dans les
fiches du registry (`packages/registry/data/**/*.entry.json`). Aucun écran ne
décide d'une compatibilité : il affiche ce que le moteur rend.

## Les cinq règles

| Règle | Fichier | Refuse |
|---|---|---|
| Plateformes | `checkTargets` | une technologie qui ne sert aucune plateforme choisie |
| Catégories exclusives | `checkExclusiveCategories` | deux fiches d'une catégorie où le projet n'en câble qu'une |
| Conflits déclarés | `checkDeclaredConflicts` | deux fiches qui se déclarent incompatibles (`conflictsWith`) |
| Écosystèmes | `checkEcosystems` | deux fiches d'une même dimension sans écosystème commun |
| Runtimes | `checkEngines` | deux plages de version d'un runtime sans intersection |

Les dépendances obligatoires (`requires`) sont ajoutées par le moteur, et dites
à l'utilisateur (« exigée par … »).

## Ce que l'audit a trouvé

La seule règle de structure était « une fiche par catégorie », appliquée à
vingt catégories. Elle se trompait dans les deux sens.

### Refusé à tort

| Combinaison | Pourquoi elle est valide |
|---|---|
| Tailwind + PostCSS | Tailwind s'intègre par son plugin PostCSS |
| Sass + CSS Modules | `*.module.scss` est pris en charge nativement par Next.js et Vite |
| shadcn/ui + Radix | shadcn/ui est construit sur les primitives Radix |
| ESLint + Stylelint | l'un lint le code, l'autre le CSS |
| Docker + Kubernetes + Helm | images Docker déployées par Helm sur Kubernetes |
| pnpm + Changesets | Changesets publie, pnpm installe |
| Stripe + PayPal | deux moyens de paiement côte à côte |
| Vercel + Fly.io | le web sur l'un, l'API sur l'autre |
| TypeScript + Python | TypeScript au front, Python à l'API |
| Lerna + Nx | Lerna moderne s'appuie sur Nx |

**Correction** : `language`, `styling`, `ui`, `build`, `package-manager`,
`monorepo`, `linting`, `containers`, `ci-cd`, `hosting`, `email`, `payments`,
`cms` et `ecommerce` sont cumulatives (`arity.ts`). Restent exclusives :
`frontend`, `backend`, `database`, `orm`, `authentication`, `formatting` — le
manifest n'a qu'un emplacement pour chacune et le générateur n'en câble qu'une.

### Accepté à tort

| Combinaison | Pourquoi elle ne peut pas marcher |
|---|---|
| Next.js + Vuetify, Nuxt + shadcn/ui | composants Vue dans React, ou l'inverse |
| Vue + React Hook Form, Angular + Zustand | bibliothèques liées à un autre moteur |
| htmx + Mantine | htmx rend du HTML serveur, Mantine exige React |
| Django + Prisma, Gin + SQLAlchemy | ORM d'un autre langage que le backend |
| FastAPI + tRPC | tRPC exige un serveur TypeScript |
| Python + Go, Express + Python | deux langages serveur pour une même API |

**Correction** : un champ `ecosystems` sur les fiches qui en ont un, et la règle
`checkEcosystems`. Deux dimensions :

- **interface** : `react`, `vue`, `svelte`, `angular`, `solid`, `qwik`,
  `preact`, `html` ;
- **exécution** : `node`, `python`, `go`, `rust`, `php`, `ruby`, `jvm`, `dotnet`.

Deux fiches qui se déclarent dans la même dimension doivent partager au moins
un écosystème. Une fiche sans écosystème est agnostique et ne contraint rien
(Tailwind, Bootstrap, Sentry, Zod). Les déclarations multiples suivent les
intégrations officielles : Astro accepte React, Vue, Svelte, Solid et Preact ;
Preact accepte l'écosystème React (`preact/compat`) ; TanStack Query couvre
React, Vue, Svelte, Solid, Angular et Preact.

TypeScript et JavaScript ne déclarent pas d'exécution : ils servent aussi le
front. Un ORM, lui, en déclare une, parce que le manifest le rattache au
backend : Prisma derrière une API Django ne démarrerait pas.

### Conflits réels, désormais déclarés

| Fiches | Raison |
|---|---|
| npm, pnpm, Yarn, Bun | un seul verrou, une seule commande d'installation |
| Turborepo, Nx, moon | trois orchestrateurs de tâches concurrents |
| Lerna + Turborepo, Lerna + moon | idem |
| Tailwind + UnoCSS | deux moteurs d'utilitaires sur les mêmes classes |

### Dépendances qui manquaient

| Fiche | Exige | Raison |
|---|---|---|
| daisyUI | Tailwind | c'est un plugin Tailwind |
| Django ORM | Django | il fait partie de Django |
| Eloquent | Laravel | c'est l'ORM de Laravel |

## Ce que l'écran en montre

Chaque carte de technologie porte une pastille `!`. Elle ouvre, au clic, au
survol ou au clavier, la fiche de la technologie et sa documentation officielle
(champ `docs` du registry, présent sur les 283 fiches). Pour une option
incompatible, la carte est grisée, son nom passe au rouge, la pastille aussi,
et la bulle donne : la raison du moteur, les technologies en cause avec leur
documentation, la conséquence, la solution et jusqu'à trois alternatives
compatibles de la même famille.

## Les preuves

`packages/compatibility/src/ecosystems.test.ts` rejoue chaque ligne des
tableaux ci-dessus sur le **vrai** catalogue : retirer un écosystème d'une fiche
ou remettre une catégorie en exclusif casse le test avec le nom de la paire.

## Limites connues

- Une API sans front écrite en TypeScript avec un backend Python n'est pas
  détectée : TypeScript n'a pas d'exécution déclarée, à dessein.
- Deux bibliothèques d'interface complètes (Material UI + Ant Design) sont
  acceptées : elles fonctionnent ensemble, au prix du poids. Le moteur refuse
  l'impossible, il ne juge pas le goût.
- Les plages de version (`engines`) ne sont renseignées que sur une partie du
  catalogue ; la règle s'applique là où elles existent.
