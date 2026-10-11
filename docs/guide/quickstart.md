# Démarrage rapide — de zéro à un projet généré

Toutes les sorties de ce guide ont été obtenues en lançant la commande, dans ce
dépôt, avec **Node v24.10.0** et **pnpm 11.13.1** (Windows 11, PowerShell 5.1).
Elles sont recopiées telles quelles ; les élisions sont marquées `(…)`, et les
chemins absolus des sorties ont été rendus portables (`/tmp/…`) — rien d'autre
n'a été modifié.

## 0. Prérequis

| | |
|---|---|
| Node | ≥ 20.11 (`engines` de la racine du dépôt) — `node --version` → `v24.10.0` |
| pnpm | ≥ 11 (`engines`) — `pnpm --version` → `11.13.1` |
| Docker | optionnel : seulement pour les services locaux du projet généré, et pour `pnpm test:smoke` |

Le CLI **n'est pas encore publié sur npm** (Phase 12 de la [roadmap](../roadmap.md)) :
aujourd'hui, on le lance depuis les sources du dépôt.

## 1. Récupérer le dépôt

```bash
git clone https://github.com/nagoloumdaniel/BuildIt.git
cd BuildIt
pnpm install
```

> **Non exécutées ici.** La copie du dépôt et l'installation des dépendances
> sortent du périmètre de la session qui a écrit ce guide (dépôt partagé avec
> d'autres travaux en cours). Les commandes sont celles du dépôt : `pnpm install`
> est la commande d'installation de la [racine](../../README.md), et le remote est
> celui de [PROJECT_CONTEXT.md](../../PROJECT_CONTEXT.md).

## 2. Vérifier que le CLI répond

```bash
pnpm pf --help
```

```text
pf — Project Factory : décrire un projet, obtenir un projet prêt à développer.

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

À venir : doctor, analyze, upgrade.

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
pnpm pf create mon-projet --preset saas --dir /tmp/mon-projet --dry-run
```

```text
Aperçu — rien n'est écrit. 34 fichiers dans /tmp/mon-projet/ :

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
pnpm pf create mon-projet --preset saas --dir /tmp/mon-projet --no-install --no-git --yes
```

```text
Génération de « mon-projet » dans /tmp/mon-projet/…
✓ 34 fichiers écrits.
! Sentry est sous licence BSL-1.1, qui impose des contraintes de redistribution. Vérifiez sa compatibilité avec votre usage.

Et maintenant :
  cd /tmp/mon-projet
  pnpm install
  pnpm dev
```

`--no-install` et `--no-git` ont été utilisés ici parce que la machine est
partagée : sans eux, la même commande écrit, **installe les dépendances et crée
le premier commit** — c'est le comportement par défaut, décrit par
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

> **Non exécutées ici** : ce sont les deux lignes que le CLI imprime lui-même en
> fin de génération (§5), et celles du `README.md` du projet généré. Elles
> installent et démarrent un serveur — hors périmètre de la session de rédaction.

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

> **Non exécutées ici** : `pnpm build` construit l'application web (chantier en
> cours, et interdit dans cette session) et `pnpm pf web` démarre un serveur au
> premier plan. Les deux commandes sont décrites en détail dans la
> [référence du CLI](../cli.md).

## 9. Mode expert : le manifest d'abord

On peut partir d'un manifest, le modifier à la main ou avec `pf add`, et générer.

```bash
pnpm pf template show api --name mon-api > pf.manifest.json      # le manifest du preset
pnpm pf add stripe --manifest pf.manifest.json --yes             # une capacité en plus
pnpm pf add drizzle --manifest pf.manifest.json --yes            # remplace l'ORM du preset
pnpm pf graph pf.manifest.json                                   # ce que ça donne
pnpm pf generate pf.manifest.json --dir mon-api --dry-run        # ce qui serait écrit
```

Ces cinq commandes ont été lancées dans un dossier de travail temporaire — d'où
le `--manifest` explicite : **`pnpm pf` s'exécute à la racine du dépôt**, donc un
manifest sans `--manifest` (ou un projet créé sans `--dir`) y serait cherché ou
écrit. C'est le seul piège de la ligne de commande lancée depuis les sources.

```text
+ Stripe → services
! Redis est sous licence SSPL-1.0, qui impose des contraintes de redistribution. Vérifiez sa compatibilité avec votre usage.
✓ pf.manifest.json mis à jour.

+ Drizzle → database.orm (remplace prisma)
! Combinaison expérimentale : Drizzle n’est couverte par aucun test de génération. Le projet sera généré, sans garantie qu’il compile.
! Redis est sous licence SSPL-1.0, qui impose des contraintes de redistribution. Vérifiez sa compatibilité avec votre usage.
✓ pf.manifest.json mis à jour.
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
| `1` | le moteur a refusé | manifest invalide : `✗ Le champ « type » n'existe pas dans un manifest. (MANIFEST_UNKNOWN_FIELD)` |
| `2` | usage : argument manquant, drapeau inconnu, commande pas encore livrée | `pnpm pf doctor` → `pf doctor n'est pas encore disponible : V1 — diagnostic d’un projet existant.` |

Hors terminal, aucune question n'est posée : une information manquante est une
erreur qui nomme le drapeau à fournir. Les conventions complètes (format des
erreurs, `--yes`) sont dans la [référence du CLI](../cli.md).
