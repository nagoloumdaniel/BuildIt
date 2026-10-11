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
- [x] Entretiens réalisés, retour positif sur le système — **11/10/2026** : le produit d'ensemble est validé par des développeurs rencontrés, et les 3 maquettes du gate 8A ont été arbitrées. Les verbatims ne sont pas archivés et le décompte exact n'est pas consigné : le §0.2 demande 5 entretiens avec verbatims, donc le **décompte précis reste partiellement couvert**, la synthèse est [écrite ici](superpowers/specs/2026-10-11-validation-humaine-entretiens.md).
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
| 6.12 | **Rattrapage Phase 0** : 2–3 entretiens de développeurs sur le contenu des 4 presets, avant de figer 6.7b — **faits le 11/10/2026, retour positif** ([synthèse](superpowers/specs/2026-10-11-validation-humaine-entretiens.md)) | `customer-research`, `design:research-synthesis` |

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

Gate M3 : **2 presets sur 4**. Restent Full-stack (Next.js + NestJS en monorepo — la génération multi-apps n'existe pas encore) et Dashboard (contenu à cadrer, 6.1). Les entretiens de 6.12 n'avaient pas eu lieu à cette date — **ils ont eu lieu le 11/10/2026**, avec un retour positif.

## État au 28/09/2026 (suite) — preset Dashboard certifié

Décisions : Hono pour l'API **et** le Full-stack ; un Dashboard **complet** (cahier §8). Le preset Dashboard = la stack SaaS sans paiement + la recette `dashboard-admin` : espace /dashboard protégé côté serveur, indicateurs et graphique des inscriptions (Recharts), tableau des utilisateurs trié, filtré, paginé (TanStack Table), paramètres du compte, page de connexion et d'inscription — sur les tables réelles de Better Auth. Les recettes gagnent `requires` (toutes les technologies que leur code importe).

Le test de fumée le parcourt de bout en bout sur une vraie base : sans session, /dashboard renvoie à /sign-in ; avec un compte créé par l'API, chaque page s'affiche avec ses données.

Le test de fumée **échoue** désormais sans Docker, sauf saut explicite (`PF_SMOKE_SKIP_DOCKER=1`, preuves marquées « skipped ») : il avait réussi en silence avec Docker arrêté.

Gate M3 : **3 presets sur 4**. Reste le Full-stack.

## État au 28/09/2026 (fin) — Full-stack certifié, gate M3 fermé

Le générateur sait produire un **monorepo multi-applications** ([spec](superpowers/specs/2026-09-28-phase6-monorepo-fullstack-design.md)) : la stack est répartie entre `apps/web` et `apps/api` par une table de rôles, chaque application est générée par le chemin des applications seules — celui que le test de fumée certifie —, la racine porte Turborepo, Biome, `pnpm-workspace.yaml` (réunion des scripts d'installation), `docker-compose.yml` (réunion des services) et la CI.

Preset Full-stack (Next.js + Hono) certifié : le test de fumée installe à la racine, passe lint, typecheck, test et build via Turborepo, démarre l'API construite, fait l'aller-retour Redis depuis `apps/api` et l'inscription réelle sur `apps/web`. `turborepo` et `pnpm` certifiés.

### Gate M3 — `verification-before-completion`
- [x] Les 4 presets génèrent, installent, buildent et typechecken — en CI **locale** (hook pre-push, la CI GitHub n'étant pas disponible)
- [x] No-lock-in vérifié par test
- [x] Un projet généré tourne réellement et s'affiche dans un navigateur — Playwright (vérifié à la main), image Docker (test de fumée)
- [x] Génération < 90 s hors installation

Écarts repris le 28/09 : `packages/shared` (contrat web ↔ API, prouvé API arrêtée puis démarrée), un Dockerfile par application en monorepo (`turbo prune`, image web construite par le test de fumée), les tests Playwright générés exécutés dans un vrai navigateur par le test de fumée (SaaS, Dashboard, Full-stack).

Reste :
- une bibliothèque de composants partagée (`packages/ui`, le « shared UI » du §8) — elle ne vaut qu'avec plusieurs applications web ; **livrée en Phase 8** ;
- 6.12 : aucun entretien n'avait eu lieu à cette date ; les presets ont été tranchés par le premier utilisateur (§0). **Fait le 11/10/2026**, avec un retour positif sur le contenu des quatre presets.

**Étape suivante (réalisée) : Phase 7 — CLI `pf`.**

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
- [ ] `npx <paquet CLI>@next create` (binaire `pf`) fonctionne depuis un dossier vide sur machine propre — **prouvé sur le paquet empaqueté** (`pnpm pack`, installé par npm dans un dossier vierge, `pf create --preset saas`) ; **la publication reste à faire** : il faut un compte npm et un jeton
- [x] Les commandes du §21 (hors celles de la Phase 7B) existent et ont un `--help` utile — `doctor`, `analyze`, `upgrade`, `share` et celles de 7B répondent qu'elles arrivent, et quand (code 2)
- [x] `security-review` : la clé API n'apparaît ni en logs, ni en fichier versionné, ni en variable exportée — refusée en argument, lue sur l'entrée standard ou masquée, fichier `0600` hors du dépôt, `status` ne l'affiche jamais ; chaque point a son test
- [x] Un projet créé au CLI et un projet créé plus tard à l'UI sont **byte-identical** à partir du même manifest — test par preset : `pf create` contre `generateProject` appelé directement, comme le fera l'UI

### État — 28/09/2026

Livré ([spec](superpowers/specs/2026-09-28-phase7-cli-design.md), [référence](cli.md)) : `packages/presets` (les quatre presets en donnée, partagés CLI / UI) et `apps/cli` — menu d'accueil, `create`, `template list|show|use`, `generate`, `graph`, `add`, `key set|status|clear`. Aucune dépendance d'interface : `parseArgs` et `readline` de Node. Le paquet publié embarque le moteur (privé) et ses templates.

Écarts :
- 7.3 : `pf create` part d'un preset ; le mode expert passe par le manifest (`pf template show` → `pf add` → `pf generate`). `--web --mobile` attend un preset mobile certifié (V1).
- 7.10 : publication npm non faite (compte et jeton requis).

Trouvé en chemin : le compatibility engine marquait « ajoutée » une technologie choisie dès qu'une autre, parcourue avant elle, l'exigeait (TypeScript « exigée par next » dans un manifest qui la choisit) — sortie dépendante de l'ordre de saisie. Corrigé, avec son test.

**Étape suivante (réalisée) : Phase 7B — projets existants & GitHub.**

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
- [x] Un lien commençant par `-`, un protocole `ext::`/`file://` sont **rejetés** avant tout appel à Git (test négatif) — 36 liens refusés en test ; `git -c protocol.ext.allow=never -c protocol.file.allow=never clone -- …` en défense en profondeur ; vérifié en réel (`ext::sh -c touch…` : refusé, aucun fichier créé)
- [x] Un clone qui échoue ne laisse aucun dossier derrière lui — test (dossiers parents créés compris) et réel
- [x] Le jeton GitHub n'apparaît dans aucun log, fichier du projet ni variable exportée (test) — ni sortie, ni argument de commande, ni URL ; transmis à Git par un credential helper, au trousseau par l'entrée standard
- [x] Un dépôt créé est privé sauf `--public` explicite
- [x] `pf repo share` sur un projet sans dépôt refuse avec la marche à suivre — test et réel
- [x] Aucune commande d'installation n'est lancée sans confirmation (ou `--yes` explicite en mode non interactif)

### État — 29/09/2026

Livré ([spec](superpowers/specs/2026-09-28-phase7b-github-design.md), [référence](cli.md)) : `packages/exec` (l'exécuteur de 5B.2, sorti du generator, avec entrée standard et environnement par commande), `packages/workspace`, `packages/git`, `packages/github`, et les commandes `clone`, `open`, `install`, `login`, `logout`, `repo create|share`, `collab add|list|remove` ; le menu d'accueil a ses trois chemins.

Vérifié en réel dans cette session : clone d'un dépôt public, clone refusé (lien d'injection) et échoué (rien laissé), installation sans scripts d'un dépôt cloné, ouverture et installation d'un projet local, refus du partage sans dépôt, **trousseau Linux réel** (Secret Service) : écrit, relu, effacé.

Trouvé en vérifiant pour de vrai : sous une locale non UTF-8, `secret-tool` refusait l'étiquette (tiret cadratin) — corrigé. Trouvé en écrivant les tests : GitHub met « le nom est pris » dans `errors[]`, pas dans `message` — le client l'aurait présenté comme un refus générique ; corrigé.

**Pas vérifiable ici** : l'API GitHub est bloquée par le réseau de la session et aucun compte de test n'est disponible — création de dépôt, clone privé, invitation de collaborateur (7B.9) sont prouvés contre un faux `fetch` qui rejoue les réponses documentées, **et restent à vérifier sur un vrai compte**. La connexion par code attend l'enregistrement de l'application OAuth de Project Factory (action de mainteneur) ; `pf login --with-token` fonctionne sans elle.

**Prochaine étape : Phase 8 — configurateur web.**

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

**Gate 8A :** direction validée sur 3 écrans maquettés (Stack Builder, Blueprint, File Preview) — les 3 plus durs. **Fait le 11/10/2026** : les trois ont été montrés et arbitrés sans réserve ([synthèse](superpowers/specs/2026-10-11-validation-humaine-entretiens.md)).

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
- [x] Les 18 écrans MVP existent et bloquent correctement (condition de passage du §6 testée) — le nom et la plateforme sont testés en composant **et** dans le navigateur ; la pile est bloquée tant que le moteur trouve un problème (`blockedReason` dans `flow.ts`).
- [x] Parcours complet §3 réalisable **au clavier seul** — `pnpm --filter @project-factory/web test:e2e` (exit 0) pilote les **12 étapes** avec 391 appuis de Tab/Maj+Tab, **0 clic souris** et 0 `focus()` programmé, dans un contexte de navigateur séparé du parcours souris. Chaque étape est vérifiée : focus posé sur le titre (jamais sur `<body>`), ordre de tabulation conforme à l'ordre du DOM et à l'ordre visuel, indicateur de focus ≥ 2 px, aucun piège de focus, refus annoncés en `role="status"`, et rapport de génération atteint. Preuve : [constat clavier](superpowers/specs/2026-10-11-phase8f-parcours-clavier.md).
- [x] Thème clair et sombre corrects sur les 18 écrans — revue écran par écran (8F.3) : 18 écrans et les coquilles partagées, **28 couples de contraste mesurés**, 4 défauts corrigés (badge accent clair 4,47 → 4,66:1 ; frontière des contrôles 2,09/1,90 → 3,25/3,10:1 ; survol du bouton principal 4,41 → 5,67:1). Ce qui reste sous 3:1 est écrit et assumé (bordures décoratives, choix 8A). Preuve : [revue thème](superpowers/specs/2026-10-11-phase8f-theme-ecran-par-ecran.md).
- [x] Mode guidé : ≤ 4 options visibles par étape ; mode expert : catalogue complet + recherche — testé dans `stack-view.test.ts` (plafond de 4, recherche, filtre de compatibilité).
- [x] Une incompatibilité affiche **pourquoi**, en français lisible — l'option bloquée est grisée avec la raison du moteur, jamais masquée.
- [x] Brouillon restauré après fermeture du navigateur — `pnpm test:e2e` recharge la page en cours de parcours et retrouve les choix (même mécanisme que la fermeture : `localStorage`).
- [x] UI et CLI produisent le même manifest pour les mêmes choix — `draftToManifest` rend une chaîne **identique octet pour octet** à celle du preset SaaS, testé.

## État au 11/10/2026 — Phase 8 livrée pour le MVP

Livré ([plan 8B](superpowers/plans/2026-10-06-phase8-web-socle.md), [direction 8A](superpowers/specs/2026-10-11-phase8a-direction-artistique-design.md)) : `apps/web` dans le workspace, et **les 18 écrans du MVP**.

- **8A** — direction appliquée en tokens (`globals.css`) : un outil de dev, dense, un seul accent, deux thèmes, `prefers-reduced-motion` respecté. Son **gate humain** — trois maquettes arbitrées — est **fermé le 11/10/2026** : Stack Builder, Blueprint et File Preview ont été montrés et validés.
- **8B.1 / 8B.2** — `src/lib/engine.ts` est le seul adaptateur vers le moteur (`registry`, `compatibility`, `generator`, `presets`) ; le reste passe par des Server Actions. Le web consomme les mêmes paquets que le CLI, et `server-only` interdit au moteur de partir dans le bundle client.
- **8B.4** — brouillon auto-sauvegardé (`src/lib/draft.ts` + `src/lib/session.ts`) : versionné, réinitialisé proprement s'il est corrompu ou d'une autre version, et **structurellement incapable** de porter une valeur de variable d'environnement (§6.8, §24). Le store se branche après hydratation, donc aucun écart d'hydratation.
- **8B.5** — toasts sans dépendance, `role="status"` posé.
- **8B.6 tranchée** — l'UI n'est pas hébergée : `pf web` la sert en local, dans le même processus Node que le moteur, liée à `127.0.0.1` ; le jeton GitHub ne quitte jamais le serveur.
- **8C** — écrans 1 → 9 : Dashboard et menu d'accueil, Create, Target (bloquant testé), Project Type, Architecture, **Stack Builder** (§5 : 2 à 4 recommandations en guidé, catalogue complet et recherche en expert, options bloquées grisées **avec leur raison**), Capabilities, Environment & Secrets (des noms, jamais de valeur — aucun champ de saisie, testé), Infrastructure.
- **8D** — écrans 10 → 14 : Blueprint (résumé lisible), Dependency Graph (`/graph`, hors parcours, accessible et non imposé), File Preview (arbre de fichiers en dry-run), Generation Progress, Generation Report (génération **réellement écriture** sur disque, sous une racine imposée par le serveur).
- **8G** — écrans 21 → 24 : GitHub Connection (jeton jamais renvoyé au navigateur, testé), Clone (mes dépôts ou lien), Open Local Project, Repository & Sharing (« Partager » grisé avec explication sans dépôt).
- **8E / 8F** — motion réduite à une transition d'apparition, `prefers-reduced-motion` global, liens d'évitement, `aria-current` sur la progression, refus annoncés en `role="status"`. Le parcours des 12 étapes est prouvé **dans un vrai navigateur** (`pnpm test:e2e`) : clavier seul, brouillon repris après rechargement complet, génération réelle et thème qui survit au rechargement.

Constats trouvés en chemin :

- Next 15 refuse TypeScript 7 (l'API JavaScript du compilateur a disparu) : `apps/web` est en `typescript@6.0.3`, seule exception du dépôt, avec `next.config.mjs`.
- `pf web` sert par `next start` et non par la sortie autonome : sous Windows, Node ne résout pas toujours les liens pnpm recopiés dans `standalone/` (`EPERM`), et `.next/standalone` n'est pas nettoyé entre deux builds.
- Le catalogue n'a **aucun framework mobile ni desktop** alors que `TARGETS` accepte ces cibles : **46** fiches les citent, **0** peut en être le framework (une cible sans framework ne peut pas honorer le §10, qui en exige un par application). Un brouillon mobile/desktop ne produit donc aucun manifest valide. **Fait** : l'écran Target ne propose plus que les cibles que le catalogue honore, et un brouillon hérité qui les porte est refusé **avec sa raison** ; le §10 garde `mobile`/`desktop` — c'est la V1 (§23). [Phase 8bis](superpowers/specs/2026-10-11-phase8bis-cibles-mobile-desktop.md).
- La règle « catégorie du catalogue → emplacement dans le manifest » vit en deux copies (`apps/cli/src/commands/add.ts`, `apps/web/src/lib/draft-to-manifest.ts`), tenues ensemble par un test d'égalité octet pour octet. À sortir dans un module partagé. **Fait** : la règle vit dans `packages/registry/src/slots.ts` (Phase 10, simplification).
- Le Stack Builder chargeait les options par 37 Server Actions (une par catégorie). **Mesuré puis corrigé le 11/10/2026** : le moteur n'était pas le coût (~2 ms pour les 37 catégories, 283 `resolve()`), le **transport** l'était — 324,9 ms pour 37 actions contre 9,1 ms pour une, le serveur les traitant en série. Après consolidation en une seule action : **76 → 4 requêtes POST** par visite, catalogue visible **921 → 372 ms**, vague d'actions **702 → 128 ms**.

  Le doublon qui restait (**chargé deux fois par visite**) était un **bug**, pas le prix de l'hydratation : les effets de l'enfant (`StepShell`, qui écrit l'étape de l'URL) passent **avant** celui du parent qui branche `localStorage`, donc `attach` relisait un brouillon plus ancien, le committait, et `loadDraft` rendait des tableaux neufs — le `useMemo` de la sélection changeait d'identité et les deux effets rejouaient pour des valeurs identiques. Effet annexe : l'étape écrite par le shell était annulée (`draft.step` finissait à `create` sur `/create/stack`). Corrigé au niveau du store (`restorePersistedDraft` : ce qui a changé en mémoire gagne, un tableau de même valeur garde sa **référence** ; `attach` ne notifie plus quand le brouillon restauré se persisterait à l'identique), avec 16 tests et un garde-fou négatif **prouvé rouge** sur l'ancien `attach`. Résultat : **4 → 2 requêtes POST** par visite, catalogue chargé **2 → 1** fois, visible en **80-85 ms**. Le cas d'un brouillon persisté non vide conserve son rechargement — c'est la reprise, elle est nécessaire. Détail, méthode et réserves de mesure : [rapport](superpowers/specs/2026-10-11-phase8bis-chargement-stack-builder.md).
- §6.1 « liste des projets créés » n'est pas implémentée : aucun registre de projets n'existe côté serveur. §6.13 « annuler » non plus : une Server Action n'est pas interruptible — le rollback du moteur reste le filet.
- §20 (lien de partage) est annoncé à l'écran Blueprint mais désactivé avec explication : c'est la Phase 9.

**Prochaine étape : Phase 9 — partage lecture seule.**

## État au 11/10/2026 — Phase 8 : les reliquats sont fermés, sauf le gate humain

Les trois reliquats de la Phase 8 sont traités, et le quatrième est un gate qui demande un humain.

- **`packages/ui` — livré.** Les primitives d'interface partagées (`Button`, `Badge`, `StatusMessage`, `Field`) vivent dans `packages/ui` (@project-factory/ui) : composants purs, sans logique métier, 13 tests à 100 %, consommés par quatre écrans (`github`, `share`, `repo`, `graph`). La preuve n'est pas une impression : les **224 attributs `class` rendus** sur 11 états d'écran sont identiques avant et après la conversion, et un test de contrat (`apps/web/src/app/ui-partagee.test.tsx`) tient cette égalité dans le temps.
- **8F.1 — parcours clavier complet** : voir le gate M5 ci-dessus (12 étapes, 0 souris, 391 Tab).
- **8F.3 — revue thème écran par écran** : 18 écrans, 28 couples de contraste mesurés, 4 défauts corrigés ([rapport](superpowers/specs/2026-10-11-phase8f-theme-ecran-par-ecran.md)).
- **Gate humain 8A — fermé le 11/10/2026** : les trois écrans les plus durs (Stack Builder, Blueprint, File Preview) ont été maquettés et arbitrés lors des entretiens, sans réserve ([synthèse](superpowers/specs/2026-10-11-validation-humaine-entretiens.md)).
- **6.12 — fait le 11/10/2026** : entretiens de développeurs sur le contenu des quatre presets, retour positif. L'ordre initial (« avant de figer 6.7b ») n'a pas été respecté : les presets ont été tranchés par le premier utilisateur, puis validés. Écart assumé et écrit. Les verbatims ne sont pas archivés — la Phase 13 les produira pour de bon.

Deux défauts trouvés par la passe clavier, tous deux corrigés : le lien d'évitement ciblait un conteneur non focusable (`tabIndex={-1}` sur `#contenu`, prouvé par une sonde dans le parcours e2e), et l'`aria-pressed` d'une option du Stack Builder avait un aller-retour de retard — le bouton lit maintenant le **choix local** du brouillon (`chosenLocally`), donc l'assistif annonce l'intention tout de suite, tandis que le badge « Choisi » reste indexé sur le moteur : l'affichage dit l'état **validé**, l'accessibilité dit l'intention, et les deux convergent au rendu suivant.

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
- [x] Un lien partagé ouvert en navigation privée affiche le Blueprint, rien d'autre — prouvé dans un vrai navigateur sur le lien réellement produit par `pf share` : 0 bouton dans le contenu, 0 champ éditable, `HTTP 200`.
- [x] Aucun secret, chemin local, ou nom d'utilisateur dans le payload partagé — le schéma du manifest n'a qu'un champ libre (`name`, contraint) ; sondes négatives : `env.DATABASE_URL`, `token: ghp_…`, `path`, `user`, `C:\Users\…`, `../evade`, `~/projet` sont tous refusés, **sans citer la valeur** dans le message.
- [x] Identifiant non devinable (test d'énumération) — il n'y a **pas d'identifiant** : le lien *est* la donnée, rien n'est stocké côté serveur, donc rien à énumérer.
- [x] `noindex` sur les pages de partage — `noindex, nofollow` vérifié dans le HTML servi et dans les métadonnées de la page.

## État au 11/10/2026 — Phase 9 livrée

Livré : `/share` (page publique en lecture seule), `pf share`, et le bouton « Créer un lien de partage » du Blueprint, qui fonctionne désormais au lieu d'être grisé.

**Décision 9.1 : le manifest est encodé dans le fragment d'URL** (`/share#<base64url>`), pas stocké. Le fragment ne quitte jamais le navigateur — mesuré : **0 requête sur 13** porte le fragment. Aucun identifiant, aucun stockage serveur, aucune journalisation possible : c'est la seule forme compatible avec la décision 8B.6 (UI locale), et elle rend la revue de sécurité triviale à prouver.

Deux limites assumées, écrites à l'écran : un lien auto-porteur est long (le destinataire le recopie d'un bloc), et **la publication sur un domaine public relève de la Phase 12** — aujourd'hui le lien n'est ouvrable que là où `pf web` tourne. Le décodage de toute charge hostile (243 troncatures possibles testées, base64 invalide, UTF-8 invalide, JSON corrompu, manifest refusé) répond par une phrase, jamais par une pile.

Un suivi est resté ouvert côté Dashboard, corrigé depuis : l'écran annonçait encore « Ouvrir un lien reçu arrive en Phase 9 » avec un champ désactivé ; il ouvre maintenant le lien collé.

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

## État au 11/10/2026 — Phase 10 : revue faite, deux défauts fermés

Revue de sécurité écrite : [revue Phase 8-9](superpowers/specs/2026-10-11-phase8-security-review.md), §24 point par point, constats classés avec leurs sondes.

- **H1 (haute) — fermé.** Le code d'un dépôt cloné (son `postinstall`, ses hooks `git`) héritait de `PF_GITHUB_TOKEN` : `packages/exec` empile `process.env`. Sonde : un vrai processus enfant imprimait le jeton. Correctif : les secrets du serveur sont vidés pour toute commande issue d'une action ; `PF_GIT_TOKEN` **hérité du shell** l'est aussi depuis la revue 10.2, et le jeton que `packages/git` pose lui-même par `options.env` survit — c'est l'ordre du merge qui les distingue.
- **M1 (moyenne) — fermé.** L'`origin` d'un dépôt, identifiants compris (`https://x-access-token:ghp_…@github.com/…`), partait au navigateur et dans les messages d'erreur. Correctif : `redactOrigin`, avec son test.
- **M4 (moyenne) — fermé.** Aucun contrôle de `Host` : une page hostile pouvait atteindre le serveur local par DNS rebinding. Correctif : `apps/web/src/middleware.ts` refuse tout hôte qui n'est pas une adresse de boucle locale. Prouvé sur le serveur réel : `200` en local, **`403`** avec `Host: attaquant.example`.
- **Restent ouverts, écrits au rapport** : une jonction dans la racine de travail peut faire écrire un clone hors racine (il faut déjà pouvoir écrire dans cette racine) ; les chemins UNC et de périphérique sont acceptés (décision écrite, usage « entreprise ») ; pas de confirmation serveur pour l'installation de code non tirée d'un lien de confiance (atténué par M4).

### Gate M6 — `verify-and-stop`
- [x] 0 finding `high` de `security-review` — H1 fermé, avec sa sonde rouge d'origine et son test de non-régression.
- [ ] Chaque point du §24 coché avec une preuve (test, lien, commit) — la revue le fait point par point, mais la clé API LLM et l'import de templates n'existent pas encore (Phases 15) : ces points sont sans objet, pas prouvés.
- [x] No-lock-in vérifié par un test automatisé, pas par relecture — `packages/generator` a son test « le projet ne dépend pas de Project Factory », cité dans le [guide](guide/no-lock-in.md), et aucun `@project-factory` n'apparaît dans un projet réellement généré.
- [x] Couverture globale ≥ 80 %, ≥ 90 % sur `compatibility` et `generator` — `compatibility` 98,5 %, `generator` 98,9 %, et `apps/web` 98,7 % **sur `src/lib`** : c'est la portée mesurée (`vitest.config.ts`), pas tout `src`. Sur les 18 écrans et les Server Actions (`src/app/**`), la couverture est de 68 % ; leur preuve est ailleurs (tests de composant, tests de Server Action, `pnpm test:e2e` dans un vrai navigateur), et le dire vaut mieux que d'élargir la portée pour afficher un chiffre faux.

### Vérification finale — 11/10/2026

| Preuve | Commande | Résultat |
|---|---|---|
| Pipeline local complet | `pnpm ci:local` | **exit 0** — 28/28 tâches turbo (lint, typecheck, tests, build, secretlint) |
| Parcours navigateur | `pnpm --filter @project-factory/web test:e2e` | **exit 0** — 2/2 parcours, 12/12 étapes au clavier, 360 appuis de Tab, 0 clic, 0 `focus()` |
| Doctor appliqué au dépôt | `pnpm run health` | **89/100** — 0 constat en échec |
| Test de fumée (réseau) | `pnpm test:smoke` | **harnais corrigé, puis rejoué** : preset « socle React + TypeScript » **exit 0** (génère, installe, passe lint, typecheck, test et build) — voir ci-dessous |

**Le test de fumée échouait sous Windows, et le harnais est corrigé.** 14 de ses 19 cas tombaient sur `spawn pnpm ENOENT` : `socle.smoke.ts` lançait `pnpm` par `spawn`/`execFileSync` directs, or sous Windows `pnpm` est un `pnpm.cmd` que Node refuse d'exécuter sans shell (CVE-2024-27980) — exactement le cas que `packages/exec` traite déjà par `resolveCommand`, sans jamais ouvrir de shell. La résolution vit maintenant dans `packages/generator/src/command-path.ts`, et `command-path.test.ts` monte la garde : il **exécute réellement** ce que la résolution rend (`pnpm --version`), et éprouve le comportement Windows par des chemins simulés — un `.exe` préféré à un `.cmd`, un `.cmd` remplacé par son script Node, un segment de `PATH` vide ignoré, une commande inconnue laissée intacte. C'est la sonde qui manquait : sans elle, le test de fumée ne servait à rien sur cette plateforme et personne ne le savait.

Ce que cela change pour la suite : le gate M3 est de nouveau vérifiable sur Windows, et la résolution est tenue par des tests plutôt que par un commentaire. Ce qui reste vrai : la couverture complète du test de fumée dépend de Docker et d'un navigateur installés, et des cas sont sautés explicitement sans eux (`PF_SMOKE_SKIP_DOCKER`, `PF_SMOKE_SKIP_E2E`) — un saut demandé est une preuve « skipped », pas un succès.

## État au 11/10/2026 — Phase 10 fermée : revue de code, simplification, Doctor appliqué

Les trois manques sont traités.

- **10.2 — revue de code complète (niveau `high`)** : [rapport de revue](superpowers/specs/2026-10-11-phase10-code-review.md), sur le diff cumulé `origin/main...HEAD`. 0 finding `critical`, **3 `major`**, 5 `minor`, 7 points « à vérifier ». Les trois `major` sont fermés par des correctifs avec leur sonde :
  - le garde-fou d'environnement ne vidait qu'`PF_GITHUB_TOKEN` — il vide désormais `PF_GIT_TOKEN`, `GITHUB_TOKEN`, `GH_TOKEN` et `NPM_TOKEN`, avec deux sondes négatives qui lancent un **vrai processus enfant** (jetons hérités vidés, jeton posé par l'appelant conservé) ;
  - le contrôle de `Host` (M4) n'avait **aucun test** : `apps/web/src/middleware.test.ts` couvre les hôtes locaux, le rebinding par sous-domaine, l'en-tête absent et la portée du `matcher` ;
  - la portée de couverture d'`apps/web` était annoncée plus large qu'elle n'est : corrigé ci-dessus, dans le gate M6.
  Reste **assumé et écrit**, non bloquant : un secret non listé exporté dans le shell qui lance `pf web` atteint encore l'enfant — une liste d'autorisation fermerait cette classe au prix de casser des installations légitimes sur une machine inconnue.
- **10.3 — simplification** : la règle « catégorie du catalogue → emplacement dans le manifest » vivait en **deux copies** (`apps/cli/src/commands/add.ts`, `apps/web/src/lib/draft-to-manifest.ts`) tenues ensemble par un test d'égalité octet pour octet. Elle vit maintenant une fois, dans `packages/registry/src/slots.ts` (`SLOTS`, `slotFor`), où son exhaustivité est vérifiée par le type `Record<Category, Slot>` **et** par un test sur `CATEGORIES` : ajouter une catégorie au catalogue casse la compilation, pas la génération. Les deux usages gardent leur politique propre et la disent (le CLI remplace la valeur en place, le brouillon garde la première fiche).
- **10.7 — Project Doctor, auto-appliqué** : `pf doctor` existe (`packages/doctor` pour les constats, `apps/cli/src/commands/doctor.ts` pour la lecture disque), et `pnpm health` le fait tourner **sur ce dépôt**: `project-factory — santé du projet : 89/100`, 8 constats satisfaits, 2 avertissements (monitoring d'erreurs, limitation de débit), 0 échec, 0 constat sans objet. Le score n'est pas une décoration : il porte sur ce que le code fait (types, installation, variables lues et documentées, tests, CI, README), et les deux avertissements restants sont des **choix de produit** (Sentry et l'analytics arrivent en Phase 12), pas des oublis.
  - Le `.env.example` de la racine a été créé par le Doctor lui-même : 7 variables lues, aucune valeur. Ce que le §16 décrit en une ligne (« `--fix` propose un diff avant d'appliquer ») est livré en plus sobre : un plan affiché (créer/compléter), confirmation, et un `create` qui n'écrase **jamais** un fichier existant.

**Trois limites assumées du Doctor**, écrites plutôt que masquées : le score mesure ce qu'un projet montre, pas ce qu'il vaut ; un secret non listé reste hors de portée de la liste noire des jetons ; et la lecture de code s'arrête à 120 fichiers (un dépôt entier ne se scanne pas à chaque `pf doctor`).

**Étape suivante : Phase 11 (quickstart, SEO) — faite — puis Phase 12**, dont le [runbook](superpowers/specs/2026-10-11-phase12-deploiement-readiness.md) est prêt et qui attend un compte npm et un hébergement.

**État au 11/10/2026 : les trois manques ci-dessus sont traités — voir « Phase 10 fermée » sur la même page.**

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
- [x] Chaque commande du §21 documentée
- [ ] `seo-audit` sans erreur bloquante, `llms.txt` publié

L'état réel est détaillé dans le second bloc « Gate M6 » de cette page (§11) : deux cases sont fermées, la troisième attend un site.

## État au 11/10/2026 — Phase 11 : le contenu est écrit, le site attend un hébergement

Livré : [guide produit](guide/README.md) — [quickstart](guide/quickstart.md) (les commandes réelles, lancées, avec leurs sorties), [concepts](guide/concepts.md), [produit et moteur](guide/produit-et-moteur.md), [no-lock-in](guide/no-lock-in.md), [confidentialité](guide/confidentialite.md), [référence du manifest](guide/reference-manifest.md), [référence du registry](guide/reference-registry.md), [commandes](guide/commandes.md) — plus [docs/llms.txt](llms.txt) et un index [docs/README.md](README.md).

Tout ce que le guide affirme est vérifiable : chaque commande du quickstart a été lancée et sa sortie recopiée, les 118 liens relatifs pointent vers des fichiers existants, et les chiffres (283 fiches, 37 catégories, 19 licences) sont comptés.

Le guide a trouvé trois dérives dans la documentation existante, corrigées : « 282 fiches » (il y en a **283**), « commençant par une lettre » dans `pf create` (le motif accepte les chiffres, les points et les soulignés), et `pf share` encore annoncé « à venir » alors que la Phase 9 l'a livré.

### Gate M6 — `verification-before-completion`
- [ ] Quickstart suivi de zéro par une personne extérieure → projet généré en < 10 min — le guide est écrit, chaque commande a été jouée, le chrono a été mesuré (98,6 s jusqu'au projet généré **et installé**, store pnpm chaud), mais **personne d'extérieur ne l'a encore suivi** : le gate demande une personne, pas une relecture. Ce qui reste à faire est d'une seule ligne : faire lire [le quickstart](guide/quickstart.md) à quelqu'un qui n'a jamais vu le produit et chronométrer.
- [x] Chaque commande du §21 documentée — `guide/commandes.md`, y compris celles qui répondent « à venir » ; `pf doctor`, livré en Phase 10, y est documenté aussi.
- [ ] `seo-audit` sans erreur bloquante, `llms.txt` publié — l'audit est fait et `robots.ts`, `sitemap.ts`, `llms.txt` sont prêts et vérifiés localement, mais **pas publiés** : il n'y a pas encore de site (Phase 12).

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
