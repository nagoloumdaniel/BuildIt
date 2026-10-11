# Démarrage rapide — de zéro à un projet généré

Toutes les sorties de ce guide ont été obtenues en lançant la commande, dans ce
dépôt, avec **Node v24.10.0** et **pnpm 11.13.1** (Windows 11, PowerShell 5.1).
Elles sont recopiées telles quelles, à deux conventions près :

Deux conventions de transcription, pour que la comparaison soit honnête :

- `pnpm pf …` écrit d'abord la ligne `$ jiti apps/cli/src/main.ts …` (pnpm annonce
  le script lancé) et termine un échec par
  `[ELIFECYCLE] Command failed with exit code 1.` : ces deux lignes appartiennent à
  pnpm, pas à `pf`, et ne sont pas recopiées ci-dessous ;
- le CLI affiche le dossier cible **relatif au dossier courant**, jamais en absolu.
  Les sorties ci-dessous portent donc `<dossier>/mon-projet/` là où le terminal de
  la session affichait un chemin relatif (`..\mon-projet/`).

## Combien de temps ?

Chronométré sur cette machine en repartant d'un dossier vide **hors du dépôt** —
[mesure complète](../superpowers/specs/2026-10-11-phase11-quickstart-externe.md) :

| Segment | Durée |
|---|---|
| `git clone --branch feat/phase8-web-socle …` | 2 s |
| `pnpm install` du dépôt (**store pnpm déjà chaud**) | 29 s |
| `pnpm pf --help`, `template list`, `create --dry-run` | 14 s |
| `pnpm pf create … --no-install --no-git` (écriture seule) | 4 s |
| `pnpm pf create …` **avec l'installation des dépendances** | 68 s |

Du dossier vide à un projet **généré et installé** : **≈ 2 min**, bien en deçà des
10 min visées. Ce chiffre suppose le store pnpm déjà rempli : à froid, les deux
installations téléchargent, et c'est le réseau qui décide.

## 0. Prérequis

| | |
|---|---|
| Node | ≥ 20.11 (`engines` de la racine du dépôt) — `node --version` → `v24.10.0` |
| pnpm | ≥ 11 (`engines`) — `pnpm --version` → `11.13.1` |
| Docker | optionnel : seulement pour les services locaux du projet généré, et pour `pnpm test:smoke` |

Le CLI **n'est pas encore publié sur npm** (Phase 12 de la [roadmap](../roadmap.md)) :
aujourd'hui, on le lance depuis les sources du dépôt.

### Comment invoquer `pf`

Depuis la racine du dépôt cloné : `pf` est le script de la racine, qui exécute les
sources TypeScript par `jiti`.

```bash
pnpm pf --help          # dépôt cloné — la seule forme disponible aujourd'hui
```

La forme publiée est prévue en **Phase 12** (`pnpm add -g @buildit/cli`,
puis `pf create …`) : **elle n'existe pas encore**, ne l'utilisez pas avant que la
roadmap ne l'annonce.

### Où travailler

`pnpm pf` s'exécute **à la racine du dépôt** et y résout ses chemins par défaut :
un projet créé sans `--dir` s'écrirait **dans le dépôt**. Choisissez donc un
**dossier de travail hors du dépôt** et passez-le explicitement (`--dir`,
`--manifest`) — ce guide le note `<dossier>`.

```bash
mkdir -p /tmp/pf-work                            # bash : <dossier> = /tmp/pf-work
```

```powershell
New-Item -ItemType Directory "$env:TEMP\pf-work" -Force | Out-Null   # PowerShell : <dossier> = $env:TEMP\pf-work
```

> Sous Windows, `/tmp` n'existe pas : `--dir /tmp/mon-projet` vise
> `C:\tmp\mon-projet` (vérifié : `--dir /tmp/pf-proof` et `--dir C:\tmp\pf-proof`
> affichent le même dossier cible). Le CLI affiche en outre ce dossier
> **relativement au dossier courant** — `..\..\..\tmp\mon-projet/`, et non
> `/tmp/mon-projet/`. Écrivez toujours un chemin absolu explicite.

## 1. Récupérer le dépôt

```bash
git clone --branch feat/phase8-web-socle https://github.com/nagoloumdaniel/BuildIt.git
cd BuildIt
pnpm install
```

`pnpm install` est la commande d'installation de la [racine](../../README.md), et
le remote est celui de [PROJECT_CONTEXT.md](../../PROJECT_CONTEXT.md).

> **La branche est obligatoire.** `git clone` seul donne la branche par défaut
> `main`, qui **ne contient pas ce guide** : `docs/` y est absent, comme
> `apps/web` et `pf share`. Vérifiable sur le dépôt lui-même :
> `git cat-file -e origin/main:docs/guide/quickstart.md` échoue, et
> `git rev-list --count origin/main..feat/phase8-web-socle` → `17`. Phase 12
> fusionnera la branche et publiera le paquet ; d'ici là, clonez
> `feat/phase8-web-socle`.

Rejoué depuis un dossier vide **hors du dépôt** — le clone prend **2 s** (dépôt
~1 Mo), `pnpm install` **29 s** avec un store pnpm déjà chaud. À froid,
l'installation télécharge : c'est le réseau qui décide.

## 2. Vérifier que le CLI répond

```bash
pnpm pf --help
```

```text
pf — BuildIt : décrire un projet, obtenir un projet prêt à développer.

Usage : pf [commande] [options]

Commandes :
  (aucune)                      Menu d'accueil
  create [nom] --preset <p>     Crée un projet depuis un preset certifié
  template list|show|use        Les presets
  generate <manifest.json>      Génère depuis un manifest
  graph [manifest.json]         La stack résolue : choisie, ajoutée, statut
  add <technologie>             Ajoute une technologie au manifest
  key set|status|clear          Clé API LLM locale

Projets existants et GitHub :
  clone [lien] [dossier]        Clone un dépôt, propose l'installation
  open <dossier>                Reconnaît un projet local, propose l'installation
  install                       Installe les dépendances du dossier courant
  login | logout                Connexion GitHub (jeton dans le trousseau)
  repo create | share           Dépôt GitHub du projet, privé par défaut
  collab add|list|remove        Collaborateurs du dépôt

Configurateur web :
  web [--port <n>] [--no-open]   Sert le configurateur construit, sur 127.0.0.1

Partage en lecture seule (§20) :
  share <manifest.json>         Imprime un lien dont le fragment porte le manifest

Diagnostic (§16) :
  doctor [dossier] [--fix] [--json]   Score de santé, constats, corrections proposées

À venir : analyze, upgrade.

Options : --help, --version. Aide d'une commande : pf <commande> --help.
Codes de sortie : 0 succès, 1 échec, 2 usage.
```

`pnpm pf` est le CLI lancé sur les sources (script `pf` de la racine, via
`jiti apps/cli/src/main.ts`).

## 3. Choisir un preset

```bash
pnpm pf template list
```

```text
saas       SaaS Web
           Application web avec comptes, paiement Stripe, emails transactionnels, suivi des erreurs et mesure d’audience.
dashboard  Dashboard
           Espace d’administration protégé : indicateurs, graphique, tableau des utilisateurs, paramètres — sur des données réelles.
api        API
           API Hono documentée (OpenAPI) et validée (Zod), avec PostgreSQL, Redis et une image Docker.
fullstack  Full-stack Monorepo
           Monorepo Turborepo : application Next.js, API Hono, et le contrat partagé entre les deux.

Tous certifiés : chaque preset est généré, installé, construit et lancé par le test de fumée.
```

## 4. Regarder avant d'écrire

`--dry-run` affiche tout ce qui serait écrit, et n'écrit rien.

```bash
pnpm pf create mon-projet --preset saas --dir "<dossier>/mon-projet" --dry-run
```

```text
Aperçu — rien n'est écrit. 34 fichiers dans <dossier>/mon-projet/ :

.dockerignore
.env.example
.github/
  workflows/
    ci.yml
.gitignore
app/
  api/
    auth/
      [...all]/
        route.ts
  globals.css
  layout.tsx
  page.tsx
biome.json
components/
  ui/
    button.tsx
    card.tsx
docker-compose.yml
Dockerfile
e2e/
  home.e2e.ts
env.d.ts
instrumentation-client.ts
instrumentation.ts
lib/
  auth-client.ts
  auth.ts
  db.ts
  email.ts
  observability/
    posthog.client.ts
    sentry.client.ts
  stripe/
    checkout.ts
  utils.ts
next.config.ts
package.json
playwright.config.ts
pnpm-workspace.yaml
prisma.config.ts
prisma/
  schema/
    auth.prisma
    schema.prisma
README.md
tsconfig.json

34 fichiers, 18822 caractères.
! Sentry est sous licence BSL-1.1, qui impose des contraintes de redistribution. Vérifiez sa compatibilité avec votre usage.
```

Le dossier cible n'existait pas avant la commande, et n'existait toujours pas
après (vérifié dans le terminal : `Test-Path` → `False` des deux côtés).

## 5. Générer

```bash
pnpm pf create mon-projet --preset saas --dir "<dossier>/mon-projet" --no-install --no-git --yes
```

```text
Génération de « mon-projet » dans <dossier>/mon-projet/…
✓ 34 fichiers écrits.
! Sentry est sous licence BSL-1.1, qui impose des contraintes de redistribution. Vérifiez sa compatibilité avec votre usage.

Et maintenant :
  cd <dossier>/mon-projet
  pnpm install
  pnpm dev
```

`--no-install` et `--no-git` écartent deux effets de bord sur une machine
partagée. Sans eux, la même commande écrit, **installe les dépendances et crée le
premier commit** — c'est le comportement par défaut, décrit par
`pf create --help` :

```text
Usage : pf create [nom] --preset <saas|dashboard|api|fullstack> [options]

Options :
  --preset <p>    Preset certifié (pf template list)
  --dir <dossier> Dossier cible (par défaut : ./<nom>)
  --no-install    Ne pas installer les dépendances
  --no-git        Ne pas initialiser de dépôt Git
  --dry-run       Afficher les fichiers, sans rien écrire
  --from <étape>  Reprendre à une étape (write, install, git, validate)
  --yes           Ne poser aucune question
```

Le nom du projet suit la grammaire des noms de paquets npm : minuscules,
chiffres, `-`, `.`, `_`, sans commencer par `.` ou `_`.

Sans `--no-install`, la même génération a été chronométrée à **68 s** (store pnpm
chaud) : le CLI dit alors `✓ Dépendances installées.` et n'imprime plus que
`pnpm dev` dans la suite à faire.

## 6. Le projet généré

34 fichiers, dont :

| Fichier | Ce qu'il porte |
|---|---|
| `package.json` | scripts (`dev`, `build`, `test`, `typecheck`, `lint`, `db:*`) et dépendances **publiques uniquement** |
| `.env.example` | les **noms** des variables requises, sans aucune valeur |
| `Dockerfile`, `docker-compose.yml` | l'image et les services locaux (PostgreSQL ici) |
| `.github/workflows/ci.yml` | la CI GitHub Actions |
| `biome.json`, `playwright.config.ts` | les outils de qualité du preset |
| `prisma/schema/`, `lib/db.ts`, `lib/auth.ts`, `lib/stripe/`, `lib/observability/` | le code des technologies choisies |
| `README.md` | la stack, les recettes, et la phrase d'autonomie |

`.env.example` d'un projet SaaS généré :

```text
# Variables d’environnement requises par ce projet.
# Aucune valeur n’est fournie : renseignez-les localement, ne les versionnez jamais.

BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
DATABASE_URL=
NEXT_PUBLIC_POSTHOG_HOST=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_SENTRY_DSN=
RESEND_API_KEY=
SENTRY_DSN=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

Pour continuer, dans le projet généré :

```bash
cd mon-projet
pnpm install
pnpm dev
```

> `pnpm install` est de toute façon inutile si `pf create` a installé les
> dépendances (comportement par défaut, rejoué ici : **68 s** store chaud). `pnpm
> dev` **n'a pas été lancé** : il démarre un serveur au premier plan, hors du
> périmètre de cette mesure.

## 7. Voir la stack résolue

```bash
pnpm pf graph --preset saas
```

```text
saas — 17 technologies, stack certifiée

  ✓ authentication   Better Auth (better-auth)
  ✓ linting          Biome (biome)
  ✓ containers       Docker (docker)
  ✓ ci-cd            GitHub Actions (github-actions)
  ✓ frontend         Next.js (next)
  ✓ testing          Playwright (playwright)
  ✓ database         PostgreSQL (postgresql)
  ✓ analytics        PostHog (posthog)
  ✓ orm              Prisma (prisma)
  ✓ email            Resend (resend)
  ✓ observability    Sentry (sentry)
  ✓ ui               shadcn/ui (shadcn-ui)
  ✓ payments         Stripe (stripe)
  ✓ styling          Tailwind CSS (tailwind)
  ✓ language         TypeScript (typescript)
  ✓ hosting          Vercel (vercel)
  ✓ testing          Vitest (vitest)

✓ certifiée (prouvée par le test de fumée) · · déclarée
! Sentry est sous licence BSL-1.1, qui impose des contraintes de redistribution. Vérifiez sa compatibilité avec votre usage.
```

`✓` : la fiche est certifiée (un test de génération la couvre). `·` : elle est
seulement déclarée au catalogue — la combinaison devient alors « expérimentale ».
Voir [Concepts](concepts.md).

## 8. Le configurateur web

Le parcours en écrans (18 écrans du MVP) produit le **même manifest** que le CLI.
Il sert l'application déjà construite :

```bash
pnpm build       # une fois — c'est un « next build »
pnpm pf web      # http://127.0.0.1:4173
```

```text
Usage : pf web [--port <n>] [--no-open]

Sert le configurateur web déjà construit (pnpm build), ouvre le navigateur,
et reste au premier plan : Ctrl-C arrête le serveur.

Le serveur n'écoute que sur 127.0.0.1 — il reste sur cette machine.

Options :
  --port <n>   Port d'écoute (défaut 4173)
  --no-open    Ne pas ouvrir le navigateur
```

> **Non exécutées ici** : `pnpm build` construit l'application web (chantier mené
> en parallèle dans cette session) et `pnpm pf web` démarre un serveur au premier
> plan. Les deux commandes sont décrites dans la [référence du CLI](../cli.md).
> Le bloc `Usage` ci-dessus est, lui, la sortie réelle de `pnpm pf web --help`. Le
> garde-fou a été vérifié sur un dépôt **non construit** — `pf web` refuse et le
> dit :
>
> ```text
> ✗ Le configurateur n’est pas construit : apps\web\.next\BUILD_ID est absent.
>   → Lancez « pnpm build » depuis la racine du dépôt, puis relancez pf web.
> ```

## 9. Mode expert : le manifest d'abord

On peut partir d'un manifest, le modifier à la main ou avec `pf add`, et générer.

```bash
pnpm pf template show api --name mon-api > "<dossier>/pf.manifest.json"   # le manifest du preset
pnpm pf add stripe  --manifest "<dossier>/pf.manifest.json" --yes         # une capacité en plus
pnpm pf add drizzle --manifest "<dossier>/pf.manifest.json" --yes         # remplace l'ORM du preset
pnpm pf graph "<dossier>/pf.manifest.json"                                # ce que ça donne
pnpm pf generate "<dossier>/pf.manifest.json" --dir "<dossier>/mon-api" --dry-run
```

> **Sous PowerShell, la première ligne ne marche pas telle quelle.** La
> redirection `>` de PowerShell 5.1 réencode en **UTF-16LE**, et `pf add` refuse
> alors le fichier : `✗ « … » n'est pas du JSON valide : Unexpected token '�'`. Le
> correctif est de laisser `cmd` rediriger les octets bruts (choisissez un
> `<dossier>` sans espace — ici `%TEMP%\pf-work`) :
>
> ```powershell
> cmd /c "pnpm pf template show api --name mon-api > <dossier>\pf.manifest.json"
> ```
>
> `Set-Content -Encoding utf8` **ne convient pas** : PowerShell 5.1 y ajoute un
> BOM (`EF BB BF`), que `pf add` refuse lui aussi. Vérifié : avec `cmd /c`, le
> fichier commence par `7B` (`{`) et les quatre commandes suivantes passent.

Ces cinq commandes ont été lancées depuis la racine du dépôt — d'où le
`--manifest` et le `--dir` explicites : **`pnpm pf` s'exécute à la racine du
dépôt**, donc un manifest sans `--manifest` (ou un projet créé sans `--dir` — ici
`--dir mon-api` écrirait **dans le dépôt**) y serait cherché ou écrit. C'est le
seul piège de la ligne de commande lancée depuis les sources.

```text
+ Stripe → services
! Redis est sous licence SSPL-1.0, qui impose des contraintes de redistribution. Vérifiez sa compatibilité avec votre usage.
✓ <dossier>/pf.manifest.json mis à jour.

+ Drizzle → database.orm (remplace prisma)
! Combinaison expérimentale : Drizzle n’est couverte par aucun test de génération. Le projet sera généré, sans garantie qu’il compile.
! Redis est sous licence SSPL-1.0, qui impose des contraintes de redistribution. Vérifiez sa compatibilité avec votre usage.
✓ <dossier>/pf.manifest.json mis à jour.
```

```text
mon-api — 12 technologies, stack expérimentale

  ✓ linting          Biome (biome)
  ✓ containers       Docker (docker)
  · orm              Drizzle (drizzle)
  ✓ ci-cd            GitHub Actions (github-actions)
  ✓ backend          Hono (hono)
  ✓ api              OpenAPI (openapi)  ← ajoutée : exigée par hono
  ✓ database         PostgreSQL (postgresql)
  ✓ cache            Redis (redis)
  ✓ payments         Stripe (stripe)
  ✓ language         TypeScript (typescript)
  ✓ testing          Vitest (vitest)
  ✓ validation       Zod (zod)  ← ajoutée : exigée par hono

✓ certifiée (prouvée par le test de fumée) · · déclarée
! Combinaison expérimentale : Drizzle n’est couverte par aucun test de génération. Le projet sera généré, sans garantie qu’il compile.
! Redis est sous licence SSPL-1.0, qui impose des contraintes de redistribution. Vérifiez sa compatibilité avec votre usage.
```

`← ajoutée : exigée par hono` : le moteur complète la sélection, et **dit ce
qu'il ajoute**. `pf add` refuse ce qui n'a pas de sens seul, avec la raison :

```text
$ pnpm pf add drizzle --manifest sans-base.json --yes     # manifest sans base de données
✗ Impossible d’ajouter Drizzle ici.
  → Un ORM a besoin d’une base de données : ajoutez-la d’abord (pf add postgresql).

$ pnpm pf add betterauth                                  # faute de frappe
✗ Technologie inconnue : « betterauth ».
  → Vouliez-vous dire « better-auth » ?
```

## 10. Codes de sortie

| Code | Sens | Exemple observé |
|---|---|---|
| `0` | succès | `pnpm pf --version` → `0.0.0` |
| `1` | le moteur a refusé | manifest invalide : `✗ Le champ « type » n'existe pas dans un manifest. Vérifiez l'orthographe.` puis, ligne suivante, `  (MANIFEST_UNKNOWN_FIELD)` |
| `2` | usage : argument manquant, drapeau inconnu, commande pas encore livrée | `pnpm pf analyze` → `pf analyze n'est pas encore disponible : V1 — analyse d’un projet existant.` |

Hors terminal, aucune question n'est posée : une information manquante est une
erreur qui nomme le drapeau à fournir. Les conventions complètes (format des
erreurs, `--yes`) sont dans la [référence du CLI](../cli.md).
