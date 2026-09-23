# Phase 1 — Socle monorepo : design

**Date :** 2026-09-23
**Phase roadmap :** 1 (Milestone M0)
**Sections du cahier des charges couvertes :** §9 (architecture interne), §7.14–§7.16 (build/qualité), §24 (points de vigilance)

---

## Objectif

Le monorepo de Project Factory est la première démonstration de ce que l'outil génère. Il doit être exemplaire : un dev qui clone doit pouvoir builder, tester et linter en une commande, et la CI doit rejeter tout ce qui ne respecte pas les conventions.

## Décisions produit prises hors cahier des charges

| Sujet | Décision | Raison |
|---|---|---|
| Nom npm publié | `@project-factory/cli` | `forge` et `project-factory` sont pris sur npm |
| Binaire CLI | `pf` | `forge` entre en collision avec Foundry (Ethereum), très répandu chez les devs cibles |
| Nom du moteur | « Forge » reste le nom interne du moteur (§9) | Cohérence avec le cahier des charges ; `pf` est seulement ce qu'on tape |
| Licence | MIT | Adoption maximale, cohérent avec le no-lock-in (§1) ; le payant V2 repose sur le cloud/marketplace/équipe (§0), pas sur la licence du cœur |
| Visibilité repo | Public — **différé** | Décision confirmée, mais le compte GitHub est indisponible. Le dépôt reste local sans remote jusqu'à résolution. L'historique est tenu dès aujourd'hui aux standards d'un dépôt public. |
| Intégration continue | **Locale d'abord** | Pas de GitHub Actions exécutable pour l'instant. Le pipeline tourne via `pnpm ci:local` et un hook `pre-push` bloquant. `ci.yml` est écrit et versionné mais dormant. |
| Scan de secrets | `secretlint` (npm) plutôt que Gitleaks | Gitleaks est un binaire externe absent de la machine ; `secretlint` s'installe via pnpm et tourne dans le hook comme en CI. |
| Plancher Node | `>=20.11.0` | Node 20 LTS reste majoritaire en entreprise (persona 4, §2) ; Node 18 est EOL |
| Cible TS | `ES2023`, ESM strict | Aligné sur le plancher Node |
| Dépôt | `nagoloumdaniel/project-factory` | — |

## Architecture

### Arborescence cible de la Phase 1

```
project-factory/
├── .github/
│   ├── workflows/ci.yml
│   ├── dependabot.yml
│   └── ISSUE_TEMPLATE/
├── docs/
│   ├── cahier-des-charges.md
│   ├── roadmap.md
│   └── superpowers/{specs,plans}/
├── tooling/
│   ├── typescript-config/
│   ├── biome-config/
│   └── vitest-config/
├── packages/
│   └── manifest/
├── .changeset/
├── LICENSE
├── README.md
├── CONTRIBUTING.md
├── CLAUDE.md
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── biome.json
├── lefthook.yml
└── commitlint.config.js
```

### Décision : un seul package sonde

La roadmap prévoyait « 11 packages vides mais buildables ». **Rejeté** : ce sont 10 répertoires qu'on ne touchera pas avant quatre semaines, et du scaffolding qu'il faudra maintenir entre-temps.

À la place, un **package sonde** : `packages/manifest`. C'est la cible réelle de la Phase 2, créé ici avec une seule fonction triviale et son test, dans le seul but de prouver que build + typecheck + test + lint traversent bien un package du workspace de bout en bout. La Phase 2 le remplit.

Les autres packages naissent dans leur phase. Aucun `apps/` avant la Phase 7.

### Décision : ESM strict

`"type": "module"` partout, y compris à la racine. `moduleResolution: "bundler"` pour les packages, `NodeNext` pour le futur CLI. Node 20.11 le supporte nativement ; commencer en CJS créerait une dette de migration garantie.

### Décision : tsdown pour le build des packages

Build basé sur Rolldown, sortie ESM + déclarations. `isolatedDeclarations` activé dans le tsconfig pour que la génération de `.d.ts` reste rapide et prévisible. Fallback conservateur si problème : `tsup`.

### Conséquences du choix « repo destiné à être public »

Quatre livrables remontent de la Phase 11 à la Phase 1 — le jour de l'ouverture, ils doivent déjà être dans l'historique, pas ajoutés en catastrophe :

1. `LICENSE` MIT et `README.md` portant l'énoncé **no-lock-in** (§1, §24) dès le premier commit
2. `CONTRIBUTING.md` et templates d'issue
3. **Scan de secrets** à chaque commit — exigé par §24 (« jamais de valeur sensible »). Implémenté avec `secretlint` dans le hook `pre-commit` et dans `pnpm ci:local`
4. `dependabot.yml` versionné (dormant jusqu'à la mise en ligne)

### Intégration continue locale

Le compte GitHub étant indisponible, la CI est d'abord **locale**. Principe : une seule définition du pipeline, deux exécuteurs.

```
pnpm ci:local   ->  lint + typecheck + test + build + secrets
     ^                          ^
     |                          |
hook pre-push          .github/workflows/ci.yml
(bloquant)             (versionné, dormant)
```

`ci.yml` appelle exactement `pnpm ci:local`. Le jour où GitHub revient, la CI distante exécute le même pipeline que celui déjà rodé en local — aucune divergence possible entre les deux.

Hooks `lefthook` :

| Hook | Action | Coût |
|---|---|---|
| `pre-commit` | Biome sur les fichiers indexés + `secretlint` | < 2 s |
| `commit-msg` | `commitlint` (Conventional Commits) | < 1 s |
| `pre-push` | `pnpm ci:local` complet — **bloquant** | ~1 min |

## Stratégie de test

La Phase 1 ne produit quasiment pas de logique métier — sa valeur est dans les garde-fous. Chaque garde-fou est donc validé par un **test négatif** : on prouve qu'il rejette, pas seulement qu'il tourne.

| Garde-fou | Test négatif obligatoire |
|---|---|
| Biome | Une violation de lint fait échouer `pnpm lint` |
| Commitlint | Un message non conforme est rejeté par le hook `commit-msg` |
| secretlint | Une clé API factice fait échouer `pnpm lint:secrets` |
| TypeScript strict | Un `any` implicite fait échouer `pnpm typecheck` |
| Vitest | Le package sonde a un test qui passe, et un test cassé volontairement échoue bien avant d'être corrigé |

Ces cinq tests sont exécutés à la main une fois, leur résultat consigné, puis la violation retirée. Ils ne restent pas dans le dépôt : leur rôle est de prouver que le garde-fou mord, pas de rester en place.

## Gate de sortie (M0)

- [ ] `pnpm install && pnpm ci:local` passe sur un clone neuf, en moins de 4 minutes
- [ ] Les 5 tests négatifs ci-dessus ont été exécutés et ont bien échoué
- [ ] Le hook `pre-push` bloque effectivement un push quand le pipeline échoue
- [ ] `ci.yml` appelle `pnpm ci:local` et rien d'autre (aucune divergence local/distant possible)
- [ ] Le dépôt contient LICENSE, README (no-lock-in), CONTRIBUTING

## Hors périmètre de la Phase 1

- Tout contenu de `packages/manifest` au-delà de la fonction sonde (→ Phase 2)
- Turbo remote cache (demande un compte tiers)
- Publication npm (→ Phase 7)
- `apps/web`, `apps/cli`, `apps/docs` (→ Phases 7, 8, 11)
