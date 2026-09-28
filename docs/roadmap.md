# Project Factory — Roadmap 0 → Beta publique (v1)

> **Source :** `Project_Factory_Cahier_des_charges_v2.md` — chaque phase référence les sections (§) qu'elle implémente.
> **Cible de cette roadmap :** livrer le **MVP gratuit (§23)** en beta publique, moteur Forge + CLI `pf` + configurateur web + partage lecture seule + intégration GitHub (§18bis, §20bis). V1/V2/V3 sont cadrés en horizon (Phase 15) mais hors périmètre d'exécution.
> **Hypothèse de charge :** 1 dev (Daniel), ~4 j/semaine. Les semaines sont indicatives, les **gates** sont fermes.
> **Révision du 26/09/2026 :** Phase 5 scindée (5A livrée, 5B pour fermer le gate M3) ; Phase 6 recentrée sur un preset certifié d'abord ; nouvelle **Phase 7B — Projets existants & GitHub** (menu d'accueil, clonage, projet local, création de dépôt, partage et collaborateurs). Le binaire CLI s'appelle `pf` (Forge reste le nom du moteur). Les phases 8 et suivantes glissent de 2 semaines.

---

## 0. Règles transverses (s'appliquent à TOUTES les phases)

| Règle | Skill obligatoire | Quand |
|---|---|---|
| Compression des échanges | `caveman` | En permanence, toute la roadmap |
| Rien ne se code sans cadrage | `brainstorming` | Avant **chaque** nouveau module / écran / comportement |
| Plan écrit avant exécution multi-étapes | `writing-plans` → `executing-plans` ou `subagent-driven-development` | Au démarrage de chaque phase ≥ 3 jours |
| Test avant code | `test-driven-development` | Tout package de `packages/*` sans exception |
| Bug = enquête avant patch | `investigate-first` → `systematic-debugging` → `surgical-patch` | Tout comportement cassé |
| Refacto = comportement préservé | `safe-refactor` | Toute restructuration |
| Rien n'est "fini" sans preuve | `verification-before-completion` + `verify-and-stop` | **Gate de fin de chaque phase** |
| Revue avant merge | `requesting-code-review` → `caveman-review` / `code-review` → `receiving-code-review` | Toute PR |
| Commits | `caveman-commit` | Chaque commit |
| Fin de branche feature | `finishing-a-development-branch` | Chaque merge de feature |
| Isolation quand 2 chantiers en // | `using-git-worktrees` + `dispatching-parallel-agents` | Dès 2 sous-tâches indépendantes |
| Délégation compressée | `cavecrew` | Investigation large / édition 1-2 fichiers / review de diff |

**Convention de lecture des tableaux de phase :** les skills sont listés **dans l'ordre d'appel**. « Obligatoire » = ne pas démarrer l'étape sans l'avoir invoqué.

---

## Vue d'ensemble

| # | Phase | Sem. | Milestone | Livrable qui prouve la phase |
|---|---|---|---|---|
| 0 | Cadrage & décisions | S1 | **M0** | Specs figées + repo initialisé |
| 1 | Socle monorepo & tooling | S2 | M0 | `pnpm build` + CI verte sur repo vide |
| 2 | Project Manifest + Validation | S3 | **M1 — Moteur parle** | Manifest validé, typé, versionné |
| 3 | Registry | S3–S4 | M1 | 60+ fiches, CI de validation du registry |
| 4 | Compatibility Engine | S4–S5 | **M2 — Moteur décide** | Résolution + conflits + semver testés |
| 5 | Pipeline Generator (5A + 5B livrées) | S5–S8 | **M3 — Moteur génère** | `pf generate` produit un socle qui installe, typecheck et lint |
| 6 | Templates & Recipes MVP | S8–S9 | M3 | Preset SaaS certifié, puis les 3 autres, générés en CI |
| 7 | CLI `pf` | S9–S10 | **M4 — CLI utilisable** | CLI publiée en `npm` tag `next` |
| 7B | Projets existants & GitHub | S10–S11 | M4 | `pf clone`, `pf open`, `pf repo create`, `pf collab add` sur de vrais dépôts |
| 8 | Configurateur Web | S11–S14 | **M5 — UI utilisable** | 18 écrans MVP, guidé + expert, menu d'accueil |
| 9 | Partage lecture seule | S14 | M5 | Lien anonyme → Blueprint read-only |
| 10 | Durcissement qualité & sécurité | S15 | **M6 — Prêt à montrer** | 0 finding bloquant, score Doctor interne ≥ 90 |
| 11 | Docs & site | S15–S16 | M6 | docs.projectfactory + landing |
| 12 | Packaging & déploiement | S16 | **M7 — Déployé** | CLI en `npm@latest`, web en prod |
| 13 | Beta privée | S17 | M7 | 20 testeurs, 5 projets réels générés |
| 14 | Beta publique / GTM | S18 | **M8 — Beta publique** | Launch day exécuté |
| 15 | Horizon V1 → V3 | S19+ | — | Backlog priorisé |

---

# PHASE 0 — Cadrage & décisions
**Semaine 1 · Milestone M0 · Couvre §0, §1, §2, §24**

### Objectif
Transformer le cahier des charges en décisions exécutables et vérifier que le produit a une place réelle. Rien ne se code ici.

### Étapes et skills

| # | Étape | Skills obligatoires (dans l'ordre) |
|---|---|---|
| 0.1 | Rejouer les 4 décisions produit (§0) et écrire les arbitrages restants : périmètre exact du MVP, ce qu'on refuse de faire en beta | `brainstorming` |
| 0.2 | Valider les 4 personas (§2) par entretiens réels — 5 devs minimum, dont 2 freelances | `customer-research`, `design:user-research` |
| 0.3 | Synthétiser les entretiens en décisions de priorisation catalogue/presets | `design:research-synthesis` |
| 0.4 | Profiler les concurrents : create-t3-app, Nx generators, Yeoman, Cookiecutter, Vercel Templates, shadcn CLI, Bulletproof React, Railway/Supabase starters | `competitor-profiling` |
| 0.5 | Positionner Project Factory contre eux — l'axe est Registry + Compatibility Engine + Manifest (§25), pas la vitesse de scaffold | `product-marketing` |
| 0.6 | Pré-cadrer le modèle freemium V2 (§0) — décidé maintenant, **appliqué en V2** : savoir dès aujourd'hui quelle feature sera payante évite de la coder gratuite par erreur | `pricing`, `offers` |
| 0.7 | Écrire le plan d'exécution maître (celui-ci) et le plan détaillé Phase 1–4 | `writing-plans` |
| 0.8 | Créer le repo + `CLAUDE.md` du projet (conventions, commandes, structure §9) | `init`, `update-config` |
| 0.9 | Réduire les frictions de permissions pour la suite | `fewer-permission-prompts` |

### Livrables
- `docs/decisions/` — 1 fichier par décision (ADR léger)
- `docs/research/personas.md`, `docs/research/competitors/*.md`
- `docs/monetization-v2.md` (liste figée des features payantes futures)
- `docs/superpowers/plans/2026-XX-XX-*.md`
- Repo Git initialisé + `CLAUDE.md`

### Gate M0 — `verification-before-completion`
- [ ] 5 entretiens réalisés, verbatims archivés
- [ ] Périmètre MVP écrit **en négatif** (liste explicite du hors-scope)
- [ ] Chaque feature du MVP tracée vers un persona
- [ ] Plan Phase 1–4 rédigé sans placeholder

### Risque à surveiller
Le cahier des charges liste ~250 technologies (§7). **Le MVP n'en implémente qu'une vingtaine.** Si cette liste n'est pas coupée en Phase 0, elle contamine toutes les phases suivantes.

---

# PHASE 1 — Socle monorepo & tooling
**Semaine 2 · Milestone M0 · Couvre §9**

### Objectif
Le monorepo de Project Factory est lui-même une démonstration de ce que l'outil génère. Il doit être exemplaire.

### Étapes et skills

| # | Étape | Skills obligatoires |
|---|---|---|
| 1.1 | Cadrer la structure `apps/` + `packages/` (§9) et les frontières de dépendance | `brainstorming`, `lean-build` |
| 1.2 | pnpm workspaces + Turborepo + tsconfig base partagé | `lean-build` |
| 1.3 | Biome (lint + format) + Lefthook + Commitlint + Conventional Commits | `update-config` |
| 1.4 | Vitest + config de coverage partagée + premier test smoke | `test-driven-development` |
| 1.5 | Changesets (versioning des packages publiés) | `lean-build` |
| 1.6 | GitHub Actions : lint, typecheck, test, build, sur PR et `main` | `update-config`, `anthropic-skills:backend-patterns` |
| 1.7 | Vérifier que tout tourne réellement | `run`, `verify-and-stop` |
| 1.8 | Commit + PR + revue | `caveman-commit`, `caveman-review` |

### Livrables
- Monorepo fonctionnel, 11 packages vides mais typés et buildables
- CI verte en < 4 min

### Gate M0 — `verification-before-completion`
- [ ] `pnpm install && pnpm build && pnpm test && pnpm lint` passe à froid sur clone neuf
- [ ] CI verte sur une PR de test
- [ ] Un commit non conforme est **rejeté** par le hook (test négatif obligatoire)

---

# PHASE 2 — Project Manifest + Validation
**Semaine 3 · Milestone M1 · Couvre §10, §22 (Schema Validation)**

### Objectif
Le Manifest est le contrat entre UI, CLI et moteur (§9). Tout le reste en dépend — il se fige en premier.

### Étapes et skills

| # | Étape | Skills obligatoires |
|---|---|---|
| 2.1 | Cadrer le schéma : champs, optionnalité, extensibilité, versioning du schéma lui-même | `brainstorming` |
| 2.2 | Écrire les tests du schéma **avant** le schéma — manifests valides, invalides, partiels, futurs | `test-driven-development` |
| 2.3 | Implémenter `packages/project-manifest` (Zod + types inférés + `manifestVersion`) | `test-driven-development` |
| 2.4 | Implémenter `packages/validation` — messages d'erreur lisibles par un humain, pas des dumps Zod | `test-driven-development`, `design:ux-copy` |
| 2.5 | Migration de schéma : un manifest v1 doit se lire quand v2 sortira | `migration` |
| 2.6 | Sérialisation/désérialisation pour le lien de partage (§20) — pas de secret dans le manifest | `security-review` |
| 2.7 | Revue + merge | `requesting-code-review`, `caveman-review`, `finishing-a-development-branch` |

### Livrables
- `packages/project-manifest` — schéma + types + parseur + migrateur
- `packages/validation` — erreurs humaines
- Fixtures : 20 manifests de référence

### Gate M1 (partiel) — `verification-before-completion`
- [ ] Le manifest exemple du §10 valide sans modification
- [ ] Chaque champ a un test de rejet
- [ ] `security-review` : aucun champ ne peut porter une valeur sensible (§24)
- [ ] Round-trip parse → serialize → parse idempotent

---

# PHASE 3 — Registry
**Semaines 3–4 · Milestone M1 · Couvre §7, §11, §24**

### Objectif
Le registry n'est jamais codé en dur dans les écrans (§11). Il est data-driven, versionné, validé en CI.

### Étapes et skills

| # | Étape | Skills obligatoires |
|---|---|---|
| 3.1 | Cadrer la fiche technologie : le schéma du §11 + `status`, `versionRange`, `license`, `lastReviewedAt` | `brainstorming` |
| 3.2 | TDD du loader + validateur de fiches | `test-driven-development` |
| 3.3a | Rédiger les **~40 fiches `certifiée`** — celles que le preset SaaS génère réellement, chacune adossée à un template et à un test de génération | `test-driven-development` |
| 3.3b | Rédiger les **~150 fiches `déclarée`** — tout le périmètre web du §7 : connues du registry (catégorie, compatibilités, licence, paquets), visibles et cherchables, mais sans template, donc non générables | `dispatching-parallel-agents` (découpe par catégorie) |
| 3.4 | CI de validation du registry : schéma + unicité des id + licences connues + dates de revue | `update-config` |
| 3.5 | Politique de fraîcheur (§7) : job planifié de rappel de revue trimestrielle | `schedule` |
| 3.6 | Alerte licence incompatible usage commercial (§11, §24) | `security-review` |
| 3.7 | Workflow de contribution (§11) documenté | `anthropic-skills:docs-writer` |
| 3.8 | Revue + merge | `caveman-review`, `finishing-a-development-branch` |

### Le distinguo qui tient tout

Le catalogue doit être large (§7 en liste ~250) **et** honnête (§24 : « ne pas générer de combinaisons non testées »). Les deux se concilient par un champ de statut de génération sur chaque fiche :

| Statut | Signification | Visible ? | Générable ? |
|---|---|---|---|
| `certifiée` | template écrit + test de génération en CI | oui | oui |
| `déclarée` | connue du registry (catégorie, compatibilités, licence, paquets) mais sans template | oui, marquée | non |

L'utilisateur voit un catalogue crédible — « 190 technologies connues, 40 génèrent aujourd'hui » — sans jamais cliquer sur une case qui ne fait rien. Une fiche passe de `déclarée` à `certifiée` le jour où son template et son test existent, preset par preset.

### Livrables
- `packages/registry` — loader, validateur, index par catégorie/target
- ~40 fiches `certifiée` + ~150 fiches `déclarée`, versionnées
- `CONTRIBUTING-registry.md`
- Job trimestriel de revue

### Gate M1 — `verification-before-completion`
- [ ] Une fiche malformée fait **échouer la CI** (test négatif)
- [ ] Chaque fiche porte `status`, `generation`, `versionRange`, `license`, `lastReviewedAt`
- [ ] Une fiche `certifiée` sans `template` fait **échouer la CI** — c'est le garde-fou qui empêche de promettre ce qui n'existe pas
- [ ] `registry.query({ category, target })` testé
- [ ] Le registry ne connaît aucune technologie hors périmètre web MVP

---

# PHASE 4 — Compatibility Engine
**Semaines 4–5 · Milestone M2 · Couvre §12, §24**

### Objectif
Le différenciant produit (§25). C'est la phase la plus dense en logique — elle mérite le plus de tests.

### Étapes et skills

| # | Étape | Skills obligatoires |
|---|---|---|
| 4.1 | Cadrer les règles : compatibilité, conflits, doublons de capacité, dépendances obligatoires (§12) | `brainstorming`, `investigate-first` |
| 4.2 | TDD règle par règle — chaque ligne du §12 = au moins 1 test positif + 1 négatif | `test-driven-development` |
| 4.3 | Contraintes **semver inter-technos** (§12 : Next 15 → Node ≥ 18.18) | `test-driven-development` |
| 4.4 | Détection de doublons de capacité (2 solutions pour le même besoin) | `test-driven-development` |
| 4.5 | Statut `certifiée` / `expérimentale` par combinaison (§12, §24) + avertissement | `test-driven-development` |
| 4.6 | Messages d'explication pédagogiques : « pourquoi grisé » (§5) — pas juste `false` | `design:ux-copy` |
| 4.7 | Quand une résolution est incohérente : enquête méthodique, pas de patch au jugé | `systematic-debugging` |
| 4.8 | Simplifier le moteur de règles après le premier jet | `simplify`, `safe-refactor` |
| 4.9 | Revue + merge | `requesting-code-review`, `code-review`, `finishing-a-development-branch` |

### Livrables
- `packages/compatibility` — moteur de règles + explications
- Matrice de compatibilité versionnée
- Table des combinaisons certifiées (les 4 presets MVP au minimum)

### Gate M2 — `verification-before-completion`
- [ ] Couverture ≥ 90 % sur `packages/compatibility`
- [ ] Chaque règle du §12 a un test
- [ ] Toute incompatibilité renvoie une **raison lisible**, jamais un booléen nu
- [ ] Une combinaison non certifiée est marquée `expérimentale` automatiquement

---

# PHASE 5 — Pipeline Generator
**Semaines 5–7 · Milestone M3 · Couvre §13, §15, §22**

### Objectif
Manifest → fichiers sur disque, avec **dry-run obligatoire** et **rollback** (§22, §24). C'est ici que le produit devient réel — et ici qu'il peut détruire le disque d'un utilisateur.

### Étapes et skills

| # | Étape | Skills obligatoires |
|---|---|---|
| 5.0 | Plan détaillé du pipeline (10 étages du §22) avant la première ligne | `writing-plans`, `brainstorming` |
| 5.1 | Stack Resolver — manifest + registry → stack résolue | `test-driven-development` |
| 5.2 | Dependency Resolver — packages npm + versions cohérentes | `test-driven-development` |
| 5.3 | Recipe Resolver — `packages/recipes` (auth email-password, oauth, etc.) | `test-driven-development`, `composition-patterns` |
| 5.4 | Template Resolver — résolution + surcharge de templates | `test-driven-development` |
| 5.5 | **File Plan** — objet inspectable listant chaque fichier à écrire, son contenu, sa provenance | `test-driven-development` |
| 5.6 | **Dry Run / Preview** — aucune écriture disque, alimente l'écran File Preview (§6.12) | `test-driven-development`, `verify-and-stop` |
| 5.7 | Generator — écriture atomique, journal des écritures | `test-driven-development`, `security-review` (path traversal, écrasement hors cible, templates exécutables) |
| 5.8 | **Rollback automatique** (§22) — test qui provoque un échec en milieu d'écriture et vérifie la restauration | `test-driven-development`, `systematic-debugging` |
| 5.9 | « Retry from last step » sur échec transitoire (réseau, npm down) | `test-driven-development` |
| 5.10 | Post Install (install deps, git init) + Validation (typecheck, lint, test du projet généré) | `test-driven-development`, `run` |
| 5.11 | Génération d'infrastructure : Dockerfile, docker-compose, `.env.example`, GitHub Actions (§15) | `anthropic-skills:backend-patterns`, `security-review` |
| 5.12 | Vérifier sur un vrai projet, pas seulement en test | `run`, `verify-and-stop` |
| 5.13 | Revue sécurité dédiée du generator | `security-review`, `code-review` |

### Livrables
- `packages/generator` — les 10 étages du §22
- `packages/recipes`
- Rollback + retry testés
- Générateur d'infra Docker/CI

### Gate M3 (partiel) — `verification-before-completion`
- [ ] Dry-run n'écrit **aucun** octet — test avec FS en lecture seule
- [ ] Échec simulé à mi-écriture → répertoire cible restauré à l'identique
- [ ] `security-review` sans finding haut : pas d'écriture hors du dossier cible, pas d'exécution de code de template non validé
- [ ] `.env.example` généré sans **aucune** valeur réelle (§24)
- [ ] Un projet généré passe `install + build + typecheck + test` **sur ta machine**

### Risque à surveiller
Le rollback est la fonctionnalité la plus facile à « croire faite ». Elle exige un test d'injection de panne, pas une relecture.

## État au 26/09/2026 — 5A et 5B livrées, gate M3 partiel fermé

**5A (livrée)** : 5.1, 5.2, 5.5, 5.6, 5.7, 5.8, et 5.11 en partie (docker-compose, CI, `.env.example`). 185 tests, couverture ≥ 90 %.

**Constat qui ouvre 5B** : un preset SaaS généré puis installé pour de vrai passe `pnpm install` mais **échoue** à `typecheck` (pas de `tsconfig.json`) et à `lint` (sortie non conforme au formateur choisi). Le workflow CI généré serait rouge au premier push. 99 % de couverture n'a pas vu le défaut : les tests prouvaient les étages, pas la sortie.

## 5B — Fermer le gate M3

| # | Étape | Skills obligatoires |
|---|---|---|
| 5B.1 | **Socle vert** : `tsconfig.json`, configuration de l'outil de qualité choisi, sortie conforme à son formateur, scripts `build`/`dev`/`start` émis seulement quand une application existe. **Test de fumée réel** : générer → installer → typecheck → lint, en script dédié, lancé par le hook pre-push | `test-driven-development`, `run` |
| 5B.2 | Post Install + Validation (5.10) via `CommandRunner` injectable : `pnpm install`, `git init` + premier commit, typecheck/lint du projet généré | `test-driven-development` |
| 5B.3 | Reprise (5.9) : échec transitoire/permanent, `retryable`, `failedStep`, reprise `fromStep` | `test-driven-development` |
| 5B.4 | Template Resolver (5.4) : chargement depuis `templatesRoot`, rendu `{{placeholder}}`, branchement dans le plan | `test-driven-development` |
| 5B.5 | `packages/recipes` (5.3) : schéma, chargeur, 2 recettes fixtures, résolution explicite | `test-driven-development`, `composition-patterns` |
| 5B.6 | Infra (fin de 5.11) : Dockerfile et devcontainer conditionnels ; décision écrite sur `integrations.data.ts` vs `data/services/*.json` | `anthropic-skills:backend-patterns` |
| 5B.7 | Revue sécurité écrite (5.13) | `security-review`, `code-review` |
| 5B.8 | Gate M3 partiel coché avec preuves, `PROJECT_CONTEXT.md` à jour | `verification-before-completion` |

**Règle** : la Phase 6 ne s'ouvre pas tant que 5B.1 n'est pas vert — sinon chaque preset hérite du défaut et on le corrige quatre fois.

**5B livrée le 26/09/2026.** Les 8 étapes sont faites ; le gate est coché avec ses preuves dans la [spec de la Phase 5](superpowers/specs/2026-09-24-phase5-pipeline-generator-design.md), et la [revue sécurité](superpowers/specs/2026-09-26-phase5-security-review.md) a trouvé et corrigé 5 défauts, dont un haut (écriture dans `.git/hooks`). Reste pour la Phase 6 : le `build` d'un projet généré, qui exige une première fiche certifiée. **La Phase 6 peut s'ouvrir.**

---

# PHASE 6 — Templates & Recipes MVP
**Semaines 7–8 · Milestone M3 · Couvre §8, §13, §23 (MVP), §24**

### Objectif
4 presets du §23 (SaaS, Full-stack, Dashboard, API), tous **certifiés** (§12), tous testés en CI de génération (§24).

### Étapes et skills

| # | Étape | Skills obligatoires |
|---|---|---|
| 6.1 | Cadrer les 4 presets : ce qu'ils contiennent exactement, ce qu'ils ne contiennent pas | `brainstorming` |
| 6.2 | Template de base Next.js + TS + Tailwind — qualité du code généré | `anthropic-skills:react-nextjs-development`, `react-best-practices` |
| 6.3 | Architecture des composants générés (pas de boolean-prop soup dès la génération) | `composition-patterns` |
| 6.4 | Choix de la lib UI embarquée dans les presets (shadcn/ui par défaut, §8) | `pick-ui-library` |
| 6.5 | Toasts/feedback dans les templates web | `ask-sonner` |
| 6.6 | Direction visuelle du code généré — un projet Project Factory ne doit pas ressembler à un template IA générique | `frontend-design`, `taste-skill` |
| 6.7a | **Preset SaaS certifié de bout en bout d'abord** — c'est lui qui fixe les templates partagés | `test-driven-development` |
| 6.7b | Les 3 autres presets, en réutilisant les templates du SaaS (worktrees séparés) | `dispatching-parallel-agents`, `using-git-worktrees` |
| 6.8 | **Tests de génération en CI** pour chaque preset : générer → installer → builder → typecheck (§24) | `test-driven-development`, `update-config` |
| 6.9 | README + `.env.example` + docs générés avec le projet | `anthropic-skills:docs-writer` |
| 6.10 | Accessibilité du code généré (base saine dès le scaffold) | `web-design-guidelines`, `design:accessibility-review` |
| 6.11 | Revue + merge | `caveman-review`, `finishing-a-development-branch` |
| 6.12 | **Rattrapage Phase 0** : 2–3 entretiens de développeurs sur le contenu des 4 presets, avant de figer 6.7b | `customer-research`, `design:research-synthesis` |

### Livrables
- `packages/templates` — 4 presets certifiés
- CI de génération (matrice 4 presets × 2 OS)
- Structure générée conforme au §13

### Gate M3 — `verification-before-completion`
- [ ] Les 4 presets génèrent, installent, buildent et typechecken en CI
- [ ] Aucun preset ne référence Project Factory au runtime — **no-lock-in vérifié** (§1, §24) : grep des imports dans le projet généré
- [ ] Un projet généré tourne réellement (`run`) et s'affiche dans un navigateur
- [ ] Temps de génération < 90 s hors `npm install`

## État au 28/09/2026 — 6.7a livrée : le preset SaaS est certifié

Les 15 fiches du preset SaaS du §8 sont `certified`, et le moteur de compatibilité résout la combinaison en `certified`. Chacune est prouvée par `pnpm test:smoke`, qui génère le preset, l'installe depuis npm, lance lint, typecheck, test et **build**, puis, si Docker est là, démarre le Postgres du `docker-compose.yml` généré, y crée une table et va jusqu'à une **inscription et une connexion réelles** par Better Auth.

Vérifié à la main en plus : l'image Docker du preset se construit et sert la page (uid 1000) ; le test Playwright généré passe dans Chromium.

Mécanismes ajoutés au générateur pour y arriver :
- **intégrations par combinaison** (`when`, une ou plusieurs fiches compagnes) : le code qui dépend de plusieurs choix — Prisma sur PostgreSQL, Better Auth sur Next + Prisma + PostgreSQL, Playwright sur Next — n'est posé que pour la combinaison vérifiée. Une autre combinaison ne reçoit rien de faux et reste `experimental` ;
- **fichiers composés** : `instrumentation-client.ts` importe le module de chaque outil qui en déclare un (Sentry, PostHog) ;
- **politique des scripts d'installation** : autorisés quand une technologie en a besoin, refusés explicitement sinon.

Gate M3, où il en est :
- [ ] 4 presets — **1 sur 4** (SaaS). Full-stack, Dashboard, API : 6.7b
- [x] No-lock-in vérifié par test (grep des imports du projet généré)
- [x] Un projet généré tourne réellement et s'affiche dans un navigateur — Docker + Playwright
- [x] Génération < 90 s hors installation — le plan et l'écriture prennent moins d'une seconde

## État au 28/09/2026 (suite) — preset API certifié

Preset API du §8 certifié : **Hono** (NestJS réservé au Full-stack), OpenAPI et Zod — ajoutés d'office par le moteur, une API Hono est documentée et validée par défaut —, Prisma + PostgreSQL, Redis, Docker, GitHub Actions. Le test de fumée démarre l'API construite (`/health`, `/openapi.json`), l'**image Docker** (200, non root), fait un aller-retour **Redis** par le client généré et un aller-retour **PostgreSQL**.

La CI GitHub n'étant pas disponible, le test de fumée est lancé par le hook pre-push (voir README).

Gate M3 : **2 presets sur 4**. Restent Full-stack (Next.js + NestJS en monorepo — la génération multi-apps n'existe pas encore) et Dashboard (contenu à cadrer, 6.1). Les entretiens de 6.12 n'ont pas eu lieu.

**Prochaine étape (initiale) : 6.12 puis 6.7b.** Les entretiens de 6.12 doivent précéder 6.7b (« avant de figer ») ; les trois autres presets réutiliseront les intégrations du SaaS. Full-stack exige NestJS, Redis et Zod ; API exige NestJS ou Hono ; Dashboard reste à cadrer (6.1).

---

# PHASE 7 — CLI `pf`
**Semaines 8–9 · Milestone M4 · Couvre §9, §21**

### Objectif
Le CLI est une **façade au même niveau que l'UI** (§9, §21, §24), pas un bonus. Il sort avant l'UI : il valide le moteur sans dépendre du front.

### Étapes et skills

| # | Étape | Skills obligatoires |
|---|---|---|
| 7.1 | Cadrer l'UX terminal : prompts guidés, flags, mode non-interactif pour la CI | `brainstorming`, `design:ux-copy` |
| 7.2 | TDD des commandes du §21 : `create`, `add`, `graph`, `doctor`, `analyze`, `template`, `generate`, `share` | `test-driven-development` |
| 7.3 | `pf create --web --mobile` et le mode guidé/expert (§5) en terminal | `test-driven-development` |
| 7.4 | `pf graph` — rendu texte du Dependency Graph | `test-driven-development`, `dataviz` |
| 7.5 | Gestion de la clé API LLM locale (§0, §17) — stockage local, jamais commitée, jamais loggée | `security-review` |
| 7.6 | Sorties d'erreur actionnables (chaque erreur dit quoi faire) | `design:ux-copy`, `copy-editing` |
| 7.7 | `--dry-run` par défaut sur les commandes destructives | `verify-and-stop` |
| 7.8 | Documentation de référence des commandes | `anthropic-skills:write-api-reference`, `anthropic-skills:docs-writer` |
| 7.9 | Test manuel complet du CLI sur 3 scénarios réels | `run`, `verification-before-completion` |
| 7.10 | Publication `npm` sous tag `next` | `lean-build`, `finishing-a-development-branch` |

### Livrables
- `apps/cli` publié en `npm` tag `next`
- Référence de commandes complète
- Clé API gérée localement

### Gate M4 — `verification-before-completion`
- [ ] `npx <paquet CLI>@next create` (binaire `pf`) fonctionne depuis un dossier vide sur machine propre
- [ ] Les commandes du §21 (hors celles de la Phase 7B) existent et ont un `--help` utile
- [ ] `security-review` : la clé API n'apparaît ni en logs, ni en fichier versionné, ni en variable exportée
- [ ] Un projet créé au CLI et un projet créé plus tard à l'UI sont **byte-identical** à partir du même manifest

---

# PHASE 7B — Projets existants & GitHub
**Semaines 10–11 · Milestone M4 · Couvre §0 (Dépôts & GitHub), §18bis, §20bis, §21, §24**

### Objectif
Project Factory ne sert pas qu'à créer. Menu d'accueil à trois chemins (créer / cloner / ouvrir un projet local), installation des dépendances, connexion GitHub, création du dépôt d'un projet généré, partage et collaborateurs. CLI d'abord — l'UI reprend les mêmes paquets en Phase 8.

### Étapes et skills

| # | Étape | Skills obligatoires |
|---|---|---|
| 7B.1 | Cadrer : device flow, permissions GitHub minimales, stockage du jeton, parcours du menu | `brainstorming`, `design:ux-copy` |
| 7B.2 | `packages/workspace` — détection écosystème + gestionnaire de paquets (verrou, `packageManager`), plan d'installation affiché avant exécution | `test-driven-development` |
| 7B.3 | `packages/git` — validation du lien (option injection, protocoles), clone/init/commit/push via le `CommandRunner` de 5B.2, nettoyage du dossier en cas d'échec | `test-driven-development`, `security-review` |
| 7B.4 | `packages/github` — client API injectable (fetch), device flow, liste des dépôts, création de dépôt (privé par défaut), collaborateurs (inviter/lister/retirer) | `test-driven-development` |
| 7B.5 | Stockage du jeton dans le trousseau système ; jamais en clair, jamais loggé | `security-review` |
| 7B.6 | Commandes `pf` (menu sans argument), `pf clone`, `pf open`, `pf install`, `pf login`/`logout`, `pf repo create`/`share`, `pf collab add`/`list`/`remove` | `test-driven-development`, `design:ux-copy` |
| 7B.7 | Règle « partage de projet ⇔ dépôt GitHub » : refus explicite avec la marche à suivre quand le projet n'a pas de dépôt | `test-driven-development` |
| 7B.8 | Code cloné non fiable : avertissement sur les scripts d'installation, option `--ignore-scripts` | `security-review` |
| 7B.9 | Vérification réelle : cloner un dépôt public, un dépôt privé, ouvrir un projet local, créer un dépôt, inviter un collaborateur de test | `run`, `verify-and-stop` |
| 7B.10 | Revue + merge | `requesting-code-review`, `code-review`, `finishing-a-development-branch` |

### Livrables
- `packages/workspace`, `packages/git`, `packages/github`
- Commandes CLI de §21 marquées §18bis/§20bis
- Référence de commandes mise à jour

### Gate — `verification-before-completion`
- [ ] Un lien commençant par `-`, un protocole `ext::`/`file://` sont **rejetés** avant tout appel à Git (test négatif)
- [ ] Un clone qui échoue ne laisse aucun dossier derrière lui
- [ ] Le jeton GitHub n'apparaît dans aucun log, fichier du projet ni variable exportée (test)
- [ ] Un dépôt créé est privé sauf `--public` explicite
- [ ] `pf repo share` sur un projet sans dépôt refuse avec la marche à suivre
- [ ] Aucune commande d'installation n'est lancée sans confirmation (ou `--yes` explicite en mode non interactif)

---

# PHASE 8 — Configurateur Web
**Semaines 9–12 · Milestone M5 · Couvre §3, §5, §6**

### Objectif
18 écrans MVP (les 14 du parcours + menu d'accueil, GitHub Connection, Clone Project, Open Local Project, Repository & Sharing — §6.21–24), mode guidé/expert (§5), progressive disclosure réelle. C'est la phase la plus longue — elle se découpe en 7 sous-phases.

## 8A — Direction artistique (S9)

| # | Étape | Skills obligatoires |
|---|---|---|
| 8A.1 | Cadrer l'identité produit : un outil de dev, dense, rapide, pas un SaaS marketing pastel | `brainstorming` |
| 8A.2 | Explorer une direction visuelle qui ne lit pas « template IA » | `frontend-design`, `taste-skill` |
| 8A.3 | Si besoin d'une vraie recherche typographique différenciante | `bencium-innovative-ux-designer` |
| 8A.4 | Cadrer les décisions UI au fil du build | `bencium-controlled-ux-designer` |
| 8A.5 | Design system + tokens (clair/sombre imposés par §6) | `design:design-system`, `theme-factory` |
| 8A.6 | Cohérence de marque | `brand-guidelines` |
| 8A.7 | Critique de la direction avant de coder 18 écrans | `design:design-critique` |

**Gate 8A :** direction validée sur 3 écrans maquettés (Stack Builder, Blueprint, File Preview) — les 3 plus durs.

## 8B — Socle applicatif web (S9–S10)

| # | Étape | Skills obligatoires |
|---|---|---|
| 8B.1 | Architecture `apps/web` : Next.js, state, data flow vers le moteur | `brainstorming`, `anthropic-skills:frontend-patterns` |
| 8B.2 | Le web **consomme les mêmes packages que le CLI** — zéro logique métier dupliquée (§9) | `safe-refactor`, `composition-patterns` |
| 8B.3 | Patterns React et perf | `react-best-practices`, `anthropic-skills:senior-frontend` |
| 8B.4 | Sauvegarde automatique du brouillon (§3, §6) | `test-driven-development` |
| 8B.5 | Feedback utilisateur (toasts, états de chargement) | `ask-sonner` |
| 8B.6 | **Trancher l'accès au disque local depuis l'UI** (serveur local lancé par `pf`, ou autre) — condition des écrans clone / projet local (§18bis) | `brainstorming`, `security-review` |

## 8C — Écrans 1 → 9 : parcours de configuration (S10–S11)
Couvre §6.1 à §6.9 — Dashboard, Create, Target, Project Type, Architecture, Stack Builder, Capabilities, Env & Secrets, Infrastructure.

| # | Étape | Skills obligatoires |
|---|---|---|
| 8C.1 | Cadrer écran par écran : objectif + condition bloquante (§6) | `brainstorming` |
| 8C.2 | **Progressive disclosure (§5)** : 2–4 recommandés, « Voir toutes les options », toggle expert, filtrage par compatibilité avec info-bulle explicative, recherche globale | `composition-patterns`, `bencium-controlled-ux-designer` |
| 8C.3 | Écran Environment & Secrets — **jamais de valeur sensible affichée ou stockée** (§6.8, §24) | `security-review`, `anthropic-skills:frontend-security-coder` |
| 8C.4 | Micro-copy de chaque écran (les raisons d'incompatibilité sont du produit, pas de la technique) | `design:ux-copy`, `copywriting` |
| 8C.5 | Prototypage rapide quand une interaction est incertaine | `prototype` |

## 8D — Écrans 10 → 14 : blueprint, preview, génération (S11)
Couvre §6.10 à §6.14.

| # | Étape | Skills obligatoires |
|---|---|---|
| 8D.1 | Project Blueprint — résumé lisible (§6.10) | `brainstorming`, `design:ux-copy` |
| 8D.2 | **Dependency Graph** — graphe interactif, accessible mais non imposé (§6.11) | `dataviz`, `find-animation-opportunities` |
| 8D.3 | File Preview — arborescence + contenu façon éditeur (§6.12) | `anthropic-skills:senior-frontend`, `react-best-practices` |
| 8D.4 | Generation Progress — étapes, annulation propre avec rollback (§6.13, §22) | `test-driven-development` |
| 8D.5 | Generation Report (§6.14) | `design:ux-copy` |

## 8G — Menu d'accueil & écrans GitHub (S13)
Couvre §6.1 (menu), §6.21 à §6.24. Consomme `workspace`, `git` et `github` de la Phase 7B — aucune logique dupliquée.

| # | Étape | Skills obligatoires |
|---|---|---|
| 8G.1 | Menu d'accueil à trois choix sur le Dashboard | `brainstorming`, `design:ux-copy` |
| 8G.2 | GitHub Connection — permissions affichées avant connexion, jamais le jeton | `security-review`, `anthropic-skills:frontend-security-coder` |
| 8G.3 | Clone Project (Mes dépôts / Depuis un lien) + case « Installer les dépendances » | `test-driven-development` |
| 8G.4 | Open Local Project — commande d'installation affichée avant exécution | `test-driven-development` |
| 8G.5 | Repository & Sharing — « Partager » grisé avec explication sans dépôt GitHub | `design:ux-copy`, `test-driven-development` |

## 8E — Motion (S11–S12)

| # | Étape | Skills obligatoires |
|---|---|---|
| 8E.1 | Doctrine : où animer, où ne **pas** animer | `motion-doctrine`, `motion-design` |
| 8E.2 | Repérer les opportunités réelles (transitions d'étapes, graphe, progression) | `find-animation-opportunities` |
| 8E.3 | Implémenter | `animate`, `cut-the-curve` |
| 8E.4 | Polish et détails physiques | `emil-design-eng`, `apple-design`, `seam-craft` |
| 8E.5 | Critique de l'existant avant de figer | `review-animations`, `improve-animations` |

**Contrainte :** `prefers-reduced-motion` respecté partout — c'est un outil de travail, pas une démo.

## 8F — Accessibilité & qualité UI (S12)

| # | Étape | Skills obligatoires |
|---|---|---|
| 8F.1 | Navigation clavier complète (exigence transverse §6) | `design:accessibility-review` |
| 8F.2 | Audit du code UI existant | `web-design-guidelines` |
| 8F.3 | Responsive + thème clair/sombre vérifiés écran par écran | `design:design-critique` |
| 8F.4 | Relecture de toute la copy d'interface | `copy-editing` |
| 8F.5 | Tests E2E du parcours complet (§3, 14 étapes) | `test-driven-development` |
| 8F.6 | Revue | `requesting-code-review`, `code-review`, `receiving-code-review` |

### Gate M5 — `verification-before-completion`
- [ ] Les 18 écrans MVP existent et bloquent correctement (condition de passage du §6 testée)
- [ ] Parcours complet §3 réalisable **au clavier seul**
- [ ] Mode guidé : ≤ 4 options visibles par étape ; mode expert : catalogue complet + recherche
- [ ] Une incompatibilité affiche **pourquoi**, en français lisible
- [ ] Thème clair et sombre corrects sur les 18 écrans
- [ ] Brouillon restauré après fermeture du navigateur
- [ ] UI et CLI produisent le même manifest pour les mêmes choix

---

# PHASE 9 — Partage lecture seule
**Semaine 12 · Milestone M5 · Couvre §0, §10 (`shareLink`), §20**

### Objectif
Lien anonyme, sans compte, vers Manifest + Blueprint en lecture seule (§20, MVP). Petit en volume, sensible en sécurité. À ne pas confondre avec le partage d'un **projet** (le code), qui passe exclusivement par GitHub (§20bis, Phase 7B).

| # | Étape | Skills obligatoires |
|---|---|---|
| 9.1 | Cadrer : où vit le manifest partagé ? (encodé dans l'URL vs stocké) — impacte la confidentialité | `brainstorming` |
| 9.2 | `pf share` + bouton Blueprint → génération du lien | `test-driven-development` |
| 9.3 | Page publique read-only — non éditable, non générable sans copie locale | `test-driven-development` |
| 9.4 | **Revue sécurité dédiée** : identifiants non énumérables, aucun secret dans le manifest partagé, pas de fuite de chemin local, pas d'indexation | `security-review` |
| 9.5 | Copy de la page partagée (le destinataire n'a jamais utilisé le produit) | `design:ux-copy`, `copywriting` |
| 9.6 | Revue + merge | `caveman-review`, `finishing-a-development-branch` |

### Gate — `verification-before-completion`
- [ ] Un lien partagé ouvert en navigation privée affiche le Blueprint, rien d'autre
- [ ] Aucun secret, chemin local, ou nom d'utilisateur dans le payload partagé
- [ ] Identifiant non devinable (test d'énumération)
- [ ] `noindex` sur les pages de partage

---

# PHASE 10 — Durcissement qualité & sécurité
**Semaine 13 · Milestone M6 · Couvre §24 (tous les points)**

### Objectif
Passer en revue le §24 point par point. Rien de neuf n'est codé ici — on ferme.

| # | Étape | Skills obligatoires |
|---|---|---|
| 10.1 | Revue de sécurité globale : generator (écriture disque), clé API, lien de partage, import de templates, jeton GitHub, clonage et installation de code non fiable | `security-review` |
| 10.2 | Revue de code complète sur le diff cumulé | `code-review` (niveau `high`) |
| 10.3 | Simplification / suppression du code mort | `simplify`, `safe-refactor` |
| 10.4 | Bugs restants, un par un | `investigate-first`, `systematic-debugging`, `surgical-patch` |
| 10.5 | Revue déléguée en parallèle sur les 3 packages les plus denses | `cavecrew`, `dispatching-parallel-agents` |
| 10.6 | Intégrer les retours de revue | `receiving-code-review` |
| 10.7 | **Auto-application du Project Doctor** : faire tourner les checks §16 sur le repo Project Factory lui-même | `verification-before-completion` |
| 10.8 | Checklist §24 ligne par ligne | `verify-and-stop` |

### Gate M6 — `verify-and-stop`
- [ ] 0 finding `high` de `security-review`
- [ ] Chaque point du §24 coché avec une preuve (test, lien, commit)
- [ ] No-lock-in vérifié par un test automatisé, pas par relecture
- [ ] Couverture globale ≥ 80 %, ≥ 90 % sur `compatibility` et `generator`

---

# PHASE 11 — Docs & site
**Semaines 13–14 · Milestone M6 · Couvre §1 (no-lock-in), §9 (nommage), §11 (contribution)**

| # | Étape | Skills obligatoires |
|---|---|---|
| 11.1 | Architecture de la doc et du site | `site-architecture`, `content-strategy` |
| 11.2 | Documentation produit (`apps/docs`) : quickstart, concepts, presets, CLI | `anthropic-skills:docs-writer`, `anthropic-skills:technical-writer` |
| 11.3 | Référence API du registry et du manifest | `anthropic-skills:write-api-reference` |
| 11.4 | **Page « Project Factory vs Forge »** — lever la confusion produit/moteur (§9) | `anthropic-skills:docs-writer` |
| 11.5 | **Page no-lock-in explicite** (§1, §24) | `copywriting`, `product-marketing` |
| 11.6 | Page confidentialité / local-first (§0) — argument de vente autant que légal | `copywriting`, `product-marketing` |
| 11.7 | Landing page | `frontend-design`, `copywriting`, `cro` |
| 11.8 | SEO technique + structured data | `seo-audit`, `schema` |
| 11.9 | Optimisation pour les moteurs IA (`llms.txt`, citations) — public dev = forte consommation d'IA | `ai-seo` |
| 11.10 | Relecture finale de toute la copy | `copy-editing` |

### Gate M6 — `verification-before-completion`
- [ ] Quickstart suivi de zéro par une personne extérieure → projet généré en < 10 min
- [ ] Chaque commande du §21 documentée
- [ ] `seo-audit` sans erreur bloquante, `llms.txt` publié

---

# PHASE 12 — Packaging & déploiement
**Semaine 14 · Milestone M7 · Couvre §15, §23**

| # | Étape | Skills obligatoires |
|---|---|---|
| 12.1 | Release pipeline Changesets → npm (CLI `pf` en `latest`) | `lean-build`, `update-config` |
| 12.2 | Déploiement `apps/web` (Vercel ou Cloudflare) + `apps/docs` | `lean-build` |
| 12.3 | Variables d'environnement de prod, secrets hors repo | `security-review` |
| 12.4 | Observabilité minimale : Sentry + un analytics respectueux (Plausible/Umami/PostHog) | `analytics` |
| 12.5 | Plan de tracking : quels events, pourquoi, avant de les poser | `analytics` |
| 12.6 | Test de bout en bout en production réelle | `run`, `verification-before-completion` |
| 12.7 | Procédure de rollback produit (release cassée) | `verify-and-stop` |

### Gate M7 — `verification-before-completion`
- [ ] `npm i -g <paquet CLI>` (binaire `pf`) depuis le registre public, sur une machine vierge → génération réussie
- [ ] Web en prod, HTTPS, thème sombre, < 2 s de first load
- [ ] Erreurs remontées dans Sentry (test d'erreur volontaire)
- [ ] Un rollback de release a été **testé**, pas seulement écrit

---

# PHASE 13 — Beta privée
**Semaine 15 · Milestone M7**

### Objectif
20 testeurs, dont les 5 interviewés de la Phase 0. Objectif : 5 projets **réellement utilisés** (pas juste générés), dont Quai3 (§0, persona 1).

| # | Étape | Skills obligatoires |
|---|---|---|
| 13.1 | Recruter les testeurs | `prospecting`, `cold-email` |
| 13.2 | Onboarding beta (premier run réussi = métrique n°1) | `onboarding`, `signup` |
| 13.3 | Séquence emails beta (accueil, relance J+3, demande de retour J+7) | `emails` |
| 13.4 | Instrumenter le funnel : install → manifest → génération → projet qui build | `analytics` |
| 13.5 | Entretiens de retour, 20 min chacun | `customer-research`, `design:user-research` |
| 13.6 | Synthèse et priorisation des correctifs | `design:research-synthesis` |
| 13.7 | Corriger les bugs remontés | `investigate-first`, `systematic-debugging`, `surgical-patch` |
| 13.8 | Optimiser les points de décrochage du funnel | `cro` |

### Gate M7 — `verification-before-completion`
- [ ] ≥ 15 testeurs actifs, ≥ 5 projets réels
- [ ] Taux de génération réussie ≥ 90 %
- [ ] Aucun bug bloquant ouvert
- [ ] Quai3 démarré avec Project Factory (validation du persona 1)

---

# PHASE 14 — Beta publique & go-to-market
**Semaine 16 · Milestone M8**

| # | Étape | Skills obligatoires |
|---|---|---|
| 14.1 | Plan marketing beta | `marketing-plan`, `marketing-ideas` |
| 14.2 | Arbitrage stratégique des canaux | `marketing-council` |
| 14.3 | Positionnement et messages | `product-marketing`, `marketing-psychology` |
| 14.4 | Plan de lancement (Product Hunt, HN, Reddit, dev.to) | `launch` |
| 14.5 | Copy de lancement (landing, posts, README) | `copywriting`, `copy-editing` |
| 14.6 | Contenu social et threads techniques | `social`, `content-strategy` |
| 14.7 | Annonces presse / newsletters dev | `public-relations` |
| 14.8 | Vidéo de démo (< 90 s, génération réelle à l'écran) | `video`, `captions-overlay` |
| 14.9 | Visuels de lancement | `image`, `canvas-design` |
| 14.10 | Soumissions annuaires (awesome-lists, alternativeto, dev tool directories) | `directory-submissions` |
| 14.11 | Outil gratuit d'acquisition (ex. « analysez la santé de votre repo » en ligne) | `free-tools`, `lead-magnets` |
| 14.12 | Communauté (Discord ou GitHub Discussions) | `community-marketing` |
| 14.13 | Boucles de croissance (le projet généré porte un badge/README mentionnant l'outil — opt-in) | `marketing-loops`, `referrals` |
| 14.14 | Partenariats écosystème (Expo, Drizzle, Better Auth, Tauri) | `co-marketing` |
| 14.15 | Mesure post-lancement | `analytics`, `attribution` |

### Gate M8 — `verification-before-completion`
- [ ] Beta publique accessible sans invitation
- [ ] Launch day exécuté sur ≥ 3 canaux
- [ ] Attribution en place : on sait d'où viennent les installs
- [ ] Le support ne sature pas (docs + FAQ absorbent les questions récurrentes)

---

# PHASE 15 — Horizon post-beta (cadré, non exécuté ici)

### V1 — gratuit (§23)
Mobile Expo, Desktop Tauri, backend NestJS/Hono, PostgreSQL + Drizzle, Auth, Redis, tests, CI/CD, **Project Doctor** (§16, score visuel + historique), Dependency Graph avancé, historique des liens de partage.

**Skills pivots :** `react-native-skills`, `animate-expo`, `flutter-animations` (si Flutter entre au catalogue), `anthropic-skills:nodejs-backend-patterns`, `dataviz` (score Doctor + historique), `test-driven-development`, `ab-testing` (arbitrages UX sur données).

### V2 — introduction du payant (§0, §19, §20, §23)
AI Stack Advisor (§17, local-first), import de projets (§18), marketplace de templates, registry communautaire, cloud generation, gestion d'équipe.

**Skills pivots :** `claude-api` (**obligatoire** avant toute ligne d'intégration LLM — modèles, pricing, caching), `brainstorming`, `security-review` (analyse de code propriétaire en local), `pricing`, `paywalls`, `offers`, `signup`, `emails`, `churn-prevention`, `revops`, `ab-testing`, `attribution`, `sales-enablement`, `competitors` (pages comparatives), `programmatic-seo` (pages par stack : « starter Next.js + Drizzle + Better Auth »).

### V3 — entreprise (§23)
Multi-cloud, IaC, déploiement automatisé, policy engine, enterprise registry, AI Architecture Review.

**Skills pivots :** `migration`, `security-review`, `sales-enablement`, `prospecting`, `events`, `influencer-marketing`.

---

# Annexe A — Index inverse : skill → phase

| Skill | Phases |
|---|---|
| `caveman` | **Toutes** |
| `brainstorming` | 0, 1, 2, 3, 4, 5, 6, 7, 8A, 8B, 8C, 8D, 9 |
| `writing-plans` / `executing-plans` / `subagent-driven-development` | 0, 5, + démarrage de chaque phase |
| `test-driven-development` | 1, 2, 3, 4, 5, 6, 7, 8B, 8D, 8F, 9 |
| `verification-before-completion` / `verify-and-stop` | **Tous les gates** |
| `security-review` | 2, 3, 5, 7, 8C, 9, 10, 12, V2, V3 |
| `code-review` / `caveman-review` | 1, 2, 3, 4, 5, 6, 8F, 9, 10 |
| `investigate-first` / `systematic-debugging` / `surgical-patch` | 4, 5, 10, 13 |
| `safe-refactor` / `simplify` | 4, 8B, 10 |
| `frontend-design` / `taste-skill` | 6, 8A, 11 |
| `design:*` (system, critique, a11y, ux-copy, user-research) | 0, 6, 8A–8F, 13 |
| `react-best-practices` / `composition-patterns` / `anthropic-skills:senior-frontend` | 6, 8B, 8C, 8D |
| `dataviz` | 7, 8D, V1 |
| `motion-*` / `animate` / `emil-design-eng` / `apple-design` | 8E |
| `anthropic-skills:docs-writer` / `technical-writer` / `write-api-reference` | 3, 6, 7, 11 |
| `copywriting` / `copy-editing` | 7, 8C, 8F, 9, 11, 14 |
| `analytics` / `attribution` / `cro` / `ab-testing` | 12, 13, 14, V1, V2 |
| `launch` / `product-marketing` / `social` / `public-relations` | 0, 11, 14 |
| `pricing` / `offers` / `paywalls` | 0 (cadrage), V2 (exécution) |
| `claude-api` | V2 — **bloquant avant toute intégration LLM** |
| `caveman-commit` / `finishing-a-development-branch` | Chaque commit / chaque merge |
| `using-git-worktrees` / `dispatching-parallel-agents` / `cavecrew` | 3, 6, 10 |

---

# Annexe B — Chemin critique

```
Manifest (P2) → Registry (P3) → Compatibility (P4) → Generator (P5) → Templates (P6)
                                                                          ↓
                                               CLI (P7) → GitHub (P7B) ──┬──► Web (P8) → Partage (P9)
                                                                       │
                                                                       └──► Durcissement (P10) → Docs (P11) → Déploiement (P12)
                                                                                                                      ↓
                                                                                              Beta privée (P13) → Beta publique (P14)
```

**Parallélisable :** P3 avec la fin de P2 · P6 avec la fin de P5 · P11 avec P8F/P9/P10 · P14 (préparation) avec P13.
**Non parallélisable :** P4 avant P5 · P5B.1 avant P6 · P6 avant P7 · P7B avant P8G · P10 avant P12.
**Parallélisable aussi :** P7B.2–7B.4 (paquets `workspace`, `git`, `github`) avec la fin de P6 — ils ne dépendent que du `CommandRunner` de 5B.2.

---

# Annexe C — Ce que la roadmap refuse explicitement avant la beta

Écrit ici pour que ce soit un choix, pas un oubli :

- Les ~230 technologies du §7 hors périmètre web MVP
- Mobile, Desktop, backend (→ V1)
- AI Stack Advisor (§17) et import **avec analyse** de projets (§18) (→ V2). Cloner et installer (§18bis) sont dans le MVP : ni analyse, ni Blueprint reconstruit, ni migration
- Installation automatique hors JavaScript, GitLab/Bitbucket (→ V1)
- Marketplace, comptes, organisations, cloud (→ V2)
- Terraform / Kubernetes (§15) (→ V3)
- Toute forme de paiement

Chaque ligne ci-dessus qui réapparaît en cours de route doit passer par `brainstorming` et un arbitrage de scope écrit — pas par « c'est vite fait ».
