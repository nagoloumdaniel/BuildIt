# Phase 6.7b — Monorepo multi-applications et preset Full-stack : design

**Date :** 2026-09-28 · **Phase roadmap :** 6.7b · **Sections :** §8 (Full-stack), §9, §13, §22

## Objectif

Générer un monorepo pnpm + Turborepo avec une application web (Next.js) et une API (Hono), et certifier le preset Full-stack du §8 : **Next.js + Hono + TypeScript + Tailwind + shadcn/ui + PostgreSQL + Prisma + Better Auth + Redis + Zod + Vitest + Playwright + Docker + GitHub Actions**.

Avant ce chantier, `architecture: "monorepo"` produisait un projet faux : les fichiers d'une application seule à la racine, et un `pnpm-workspace.yaml` qui déclarait `apps/*` vide.

## Principe : une application = une génération d'application seule

Aucun second générateur. La stack résolue est **répartie** entre les applications, puis chaque application est générée par le chemin déjà certifié (socle, intégrations, templates, recettes), et ses fichiers sont placés sous `apps/<nom>/`. La racine reçoit ce qui appartient au dépôt entier.

```
racine/                package.json (turbo), turbo.json, pnpm-workspace.yaml,
                       biome.json, .gitignore, README.md, docker-compose.yml,
                       .github/workflows/ci.yml
apps/web/              Next.js — généré comme une application seule
apps/api/              Hono — généré comme une application seule
```

Conséquence : tout ce que le test de fumée prouve pour les presets SaaS et API reste vrai dans le monorepo, fichier pour fichier.

## Répartition — donnée, pas logique

Chaque technologie va à un **rôle** selon sa catégorie (table `monorepo.data.ts`), avec quelques exceptions par identifiant :

| Rôle | Catégories | Exceptions |
|---|---|---|
| `web` | frontend, styling, ui, authentication, authorization, state, data-fetching, forms, analytics, observability, payments, email, cms, ecommerce, build | `playwright` |
| `api` | backend, api, cache, queue, search | — |
| `data` | database, orm | va au `web` s'il existe (Better Auth y vit), sinon à l'`api` |
| `both` | language, validation, testing | — |
| `root` | linting, formatting, monorepo, package-manager, git-hooks, containers, ci-cd, hosting, dev-environment, security | — |

Une technologie `both` est générée dans chaque application. Une technologie `root` n'est générée qu'à la racine.

## Racine

- `package.json` : `build`, `typecheck`, `test`, `dev` délèguent à `turbo run` ; `lint` lance Biome une fois pour tout le dépôt (sa configuration est à la racine, les applications en héritent).
- `pnpm-workspace.yaml` : `apps/*`, `packages/*`, et la **réunion** des politiques `allowBuilds` de toutes les applications — pnpm ne lit que celle de la racine.
- `docker-compose.yml` : la réunion des services de toutes les applications.
- `.github/workflows/ci.yml` : les scripts de la racine.
- Les fichiers propres à une application seule (`.gitignore`, `README.md`, workflow, compose, `pnpm-workspace.yaml`, `biome.json`) produits par les générations d'applications sont **écartés** : la racine les porte une fois.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Base de données | Possédée par `apps/web`, comme dans le SaaS | Better Auth en a besoin ; l'API n'en a pas l'usage dans ce preset. Un `packages/db` partagé viendra avec un besoin réel |
| Noms de paquets | `<projet>-web`, `<projet>-api` | Grammaire du nom de projet ; uniques dans le workspace |
| Dockerfile par application | **Pas dans cette itération** — avertissement `GEN_DOCKERFILE_MONOREPO_DEFERRED` | Une image par application exige `turbo prune` ; mieux vaut ne rien poser qu'un Dockerfile qui échoue. docker-compose (services locaux) est bien généré |
| `packages/shared` | **Pas dans cette itération** | Le preset n'a pas encore de contrat partagé qui le justifie ; un dossier vide « pour plus tard » est interdit par le projet |

## Preuve

Test de fumée, preset Full-stack : installation à la racine, puis `lint`, `typecheck`, `test`, `build` via Turborepo ; l'API construite sert `/health` ; PostgreSQL réel, inscription et connexion sur l'application web construite.

## Hors périmètre

`packages/shared` (types partagés web ↔ API), Dockerfiles par application, plus de deux applications (mobile, desktop : V1).
