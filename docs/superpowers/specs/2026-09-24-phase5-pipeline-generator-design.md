# Phase 5 — Pipeline Generator : design

**Date :** 2026-09-24
**Phase roadmap :** 5 (Milestone M3)
**Sections couvertes :** §13, §15, §22, §24

---

## Objectif

Manifest → fichiers sur disque. C'est la phase où le produit devient réel — et où il peut détruire le disque d'un utilisateur. D'où les deux exigences non négociables du §22/§24 : **dry-run** qui n'écrit aucun octet, et **rollback automatique** qui restaure l'état précédent en cas d'échec à mi-écriture.

Le pipeline suit les étages du §22 :

```
Manifest → Schema Validation → Stack Resolver → Compatibility Engine
  → Dependency Resolver → Recipe Resolver → Template Resolver
  → File Plan → Dry Run / Preview → Generator (écriture)
  → Post Install → Validation
```

Schema Validation et Compatibility Engine existent déjà (phases 2 et 4). Cette phase construit tout le reste, dans deux paquets nouveaux :

- `packages/generator` — le pipeline
- `packages/recipes` — les recettes (capabilities câblées : auth email-password, oauth…)

## Décisions

| Sujet | Décision | Alternative rejetée |
|---|---|---|
| Templates | Texte avec substitution `{{placeholder}}`, liste **fermée** de variables. **Aucune logique dans les templates** : pas de condition, pas de boucle, pas d'éval | Moteur type Handlebars/EJS : du code dans les templates = surface d'exécution non validée (§24, revue sécurité) |
| Contenu conditionnel | Par **sélection de templates**, pas par logique interne : deux variantes d'un fichier sont deux templates | `{{#if}}` dans les templates — même problème |
| Version des dépendances | Nouveau champ **optionnel** `packageRanges` sur la fiche registry (`{ "react": "^19.0.0" }`). Le paquet homonyme de la fiche hérite de `versionRange`. Tout paquet sans plage connue produit un avertissement `GEN_UNPINNED_DEPENDENCY` — jamais de `*` en silence | Réseau (`npm view`) : la génération doit marcher hors-ligne et être reproductible |
| Connaissance Docker/CI des technos | `packages/generator/data/services/<id>.service.json` — data-driven, éditable à la main, validé au chargement. Le registry n'est pas modifié pour ça | Champ `docker` sur les 282 fiches : couche infra, pas identité — la frontière du registry reste propre |
| Cible d'écriture | Doit être **inexistante ou vide** (`.git` toléré). Sinon `GEN_TARGET_NOT_EMPTY` — pas d'écrasement de fichiers existants | Écraser avec backup : hors scope MVP, et dangereux |
| Atomicité | Pas d'atomicité multi-fichiers réelle → **journal + rollback** : chaque écriture est journalisée, un échec restaure tout | Écriture en dossier temporaire puis renommage : ne protège pas les reprises et complique le cross-device Windows |
| Post-install / validation | **Exécuteur injectable** (`CommandRunner`). Jamais de shell réel en test | `execa` en dur : tests lents, non déterministes |
| Retry | Classification transitoire/permanent. Un échec transitoire rapporte `retryable: true` et `failedStep` ; `generate({ fromStep })` reprend à un étage donné | Retry automatique en boucle : masque les vraies pannes |
| Récipes | Choix **explicite** via `GenerateOptions.recipes: string[]`, validé contre les `recipes` déclarées par les fiches résolues. Défaut : aucune | Appliquer toutes les recettes d'une fiche : better-auth embarquerait email **et** oauth |
| Fiches `certified` | Aucune n'existe encore : le pipeline génère le **socle** (§13 racine + infra) et les templates d'applications viendront en Phase 6 | Certifier à la hâte des fiches sans test de génération : exactement ce que le garde-fou du registry interdit |

## Le File Plan est un objet inspectable

Le File Plan est une **donnée pure**, sérialisable, qui liste chaque fichier à écrire : chemin relatif, contenu, provenance (`scaffold:root-package-json`, `template:frontend/next`, `infra:docker-compose`, `recipe:better-auth-email`…). C'est lui qui alimente l'écran File Preview (§6.12) et le dry-run CLI. Le Generator ne décide rien : il exécute un plan.

Conséquence testable : **dry-run = construire le plan et s'arrêter**. Le test sur FS en lecture seule prouve qu'aucun octet ne part.

## Conflits et path traversal

- Deux sources produisant le même chemin → `GEN_FILE_CONFLICT`, détecté **avant la première écriture**.
- Tout chemin de sortie est normalisé et vérifié **dans** le répertoire cible — `../`, chemins absolus et liens symboliques sont rejetés (`GEN_PATH_TRAVERSAL`). Un template ne peut pas écrire ailleurs que la cible.
- Les secrets ne peuvent pas entrer : `.env.example` ne contient que des **noms** de variables (grammaire déjà forcée par le registry) avec des valeurs vides ou des placeholders `CHANGE_ME`. Test négatif : une valeur qui ressemble à un secret fait échouer la génération.

## API publique

```ts
generate(manifest: Manifest, options: GenerateOptions): Promise<GenerateResult>
plan(manifest: Manifest, options: PlanOptions): PlanResult          // dry-run pur

GenerateOptions {
  targetDir: string
  registry?: Registry            // défaut : catalogue officiel
  recipes?: string[]             // recettes explicites
  templatesRoot?: string         // défaut : templates/ du paquet
  dryRun?: boolean               // true ⇒ plan sans écriture
  install?: boolean              // pnpm install (défaut : false)
  gitInit?: boolean              // git init (défaut : true si écriture)
  fromStep?: PipelineStep        // reprise après échec transitoire
  fs?: FileSystem                // injection pour les tests
  runner?: CommandRunner         // injection post-install/validation
}
```

Résultat : union discriminée — succès `{ ok: true, plan, journal, report, warnings }` ou échec `{ ok: false, step, issues, retryable, journal? }`. Pas d'exceptions pour les erreurs métier ; les exceptions restent pour les bugs.

## Étages et livrables

1. **Stack Resolver** — Manifest → `Selection` (slugs des champs du manifest) → `resolve()` du compatibility engine. Réutilise tout l'existant, n'ajoute aucune règle.
2. **Dependency Resolver** — stack résolue → `{ dependencies, devDependencies }` par fichier `package.json` cible, versions issues de `packageRanges`/`versionRange`, avertissement explicite si non épinglée.
3. **Recipe Resolver** — recettes demandées → validation (la recette doit être déclarée par une fiche de la stack) → paquets, env et fichiers ajoutés au plan.
4. **Template Resolver** — fiches certifiées résolues → chargement des templates, rendu `{{placeholder}}` (variables : `projectName`, `packageName`, `scope`… liste fermée).
5. **File Plan** — assemblage socle + infra + templates + recettes, détection de conflits, tri déterministe.
6. **Dry Run** — le plan lui-même, retourné sans écriture.
7. **Generator** — écriture journalisée, garde path traversal, rollback sur échec.
8. **Post Install** — `pnpm install`, `git init`, via exécuteur injectable.
9. **Validation** — typecheck/lint/test du projet généré, via le même exécuteur. Optionnel en Phase 5 (le socle nu n'a rien à typer) ; devient obligatoire avec les presets de la Phase 6.

## Socle généré (§13, périmètre Phase 5)

Racine d'un monorepo pnpm : `package.json`, `pnpm-workspace.yaml`, `turbo.json` (si Turborepo choisi), `.gitignore`, `README.md`, `.env.example` (agrégé des `env` des fiches résolues + recettes), `docker-compose.yml` (services des fiches qui en déclarent), `Dockerfile` par cible si conteneur choisi, `.github/workflows/ci.yml` (si GitHub Actions choisi), `.devcontainer/` (si demandé). Le contenu des `apps/` vient des templates certifiés — Phase 6.

## Paquet `recipes`

Même philosophie que le registry : données JSON (`data/<id>.recipe.json`), schéma strict, chargement validé, aucune logique câblée en dur.

```json
{
  "id": "better-auth-email-password",
  "name": "Better Auth — email + mot de passe",
  "description": "...",
  "for": ["better-auth"],
  "packages": { "better-auth": "^1.0.0" },
  "env": ["BETTER_AUTH_SECRET", "BETTER_AUTH_URL"],
  "files": [{ "template": "recipes/better-auth-email-password/auth.ts", "target": "apps/web/lib/auth.ts" }]
}
```

`for` est la frontière qui empêche d'appliquer une recette à une stack qui ne la porte pas. Phase 5 livre le paquet, le schéma et le resolveur avec des recettes **fixtures** ; les vraies recettes arrivent avec les presets (Phase 6).

## Modification du registry (additive)

Un seul champ **optionnel** ajouté au schéma de fiche : `packageRanges?: Record<string, string>`. Aucune des 282 fiches existante n'est modifiée ; les fiches certifiées de la Phase 6 le rempliront. Testé côté registry (forme) — le generator consomme, ne redéfinit pas.

## Critères de sortie (gate M3, partiel) — fermé le 26/09/2026

- [x] Dry-run n'écrit aucun octet — `pipeline.test.ts` : la cible n'est **même pas créée**, y compris quand le plan lit des templates. (Un FS en lecture seule ne prouverait rien : les tests peuvent tourner en root.)
- [x] Échec simulé à mi-écriture → répertoire cible restauré à l'identique — `write.test.ts`, injection de panne
- [x] Aucune écriture hors du dossier cible — `plan.test.ts` (`../`, absolu, lecteur, `\`, `.git/`), `write.test.ts` (lien symbolique)
- [x] Pas d'exécution de code de template — `template.test.ts` (`<%= %>`, `{{eval}}`, `{{constructor}}`, backticks)
- [x] `.env.example` sans aucune valeur réelle — `scaffold.test.ts`, `pipeline.test.ts`
- [x] Un projet socle généré passe `install + typecheck` sur la machine — et aussi `lint` et `test` : `pnpm test:smoke` (preset SaaS avec ses deux recettes, et socle React), via le pipeline lui-même avec le vrai pnpm et le vrai git. Lancé par le hook pre-push (la CI GitHub n’est pas disponible).
- [x] Couverture ≥ 90 % sur `generator` et `recipes`
- [x] Revue sécurité écrite (5.13) sans finding haut ouvert — [2026-09-26-phase5-security-review.md](2026-09-26-phase5-security-review.md)

Non couvert par ce gate, et dit ici pour ne pas être cru fait : `build` d'un projet généré. Aucune fiche n'est encore certifiée, donc aucun template ne pose d'application à construire. Le script `build` n'est d'ailleurs émis qu'avec une fiche certifiée. Il arrive avec la Phase 6.

## Décisions prises en 5B (26/09/2026)

| Sujet | Décision | Raison |
|---|---|---|
| Socle qui passe sa propre CI | `tsconfig.json` + `env.d.ts` (typage de `process.env`), `biome.json` en espaces, `vitest --passWithNoTests`, `allowBuilds` dans `pnpm-workspace.yaml` | Chacune de ces absences faisait échouer install, typecheck ou lint d'un preset réellement généré |
| Scripts d'application (`dev`, `build`, `start`, `db:*`) | Émis seulement pour une fiche `certified` | Sans template, rien à construire : `next build` échouerait et la CI générée avec lui |
| Étapes post-écriture | Toutes **désactivées par défaut** dans le moteur (`install`, `git`, `validate`) ; les façades choisissent leurs défauts | Le moteur ne lance aucune commande qu'on ne lui a pas demandée. S'écarte de « `gitInit` vrai par défaut » de l'API initiale |
| Rollback après l'écriture | Aucun. Un échec d'installation, de git ou de validation laisse le projet — complet — en place, nomme l'étape (`failedStep`) et dit s'il est reprenable (`retryable`) | Le §22 exige de ne pas laisser un projet **à moitié** généré ; après l'écriture, il est entier. Tout supprimer ferait perdre un projet valide pour une panne réseau |
| Forme du résultat | `GenerationResult` étend `ParseFailure` (`ok`, `issues`) avec `failedStep`, `retryable`, `completedSteps` | Les appelants existants restent compatibles |
| Données Docker/CI des technologies | Restent en TypeScript (`integrations.data.ts`) et non en `data/services/*.json` | Couche interne, sans contribution externe ni publication ; un module typé évite un chargeur pour rien. Justifié dans l'en-tête du fichier |
| Recettes | Deux recettes **réelles** (et non des fixtures) avec leurs templates livrés dans `packages/generator/templates/` ; vérifiées par le test de fumée contre les vrais paquets | Une recette qui pointe vers un template absent promettrait ce qui n'existe pas |
| Paquets des recettes | Même résolveur que les fiches (`DependencySource`) | Un conflit recette ↔ fiche est détecté et formulé comme un conflit entre deux fiches |
| Dockerfile | Posé seulement si `build` et `start` existent, sinon avertissement `GEN_DOCKERFILE_DEFERRED` | Un Dockerfile qui échoue à `docker build` sur un projet neuf est pire que pas de Dockerfile |
| Devcontainer | Nouvelle catégorie **cumulative** `dev-environment` au registry, fiche `dev-container` | `containers` est exclusive : y ranger le devcontainer l'aurait rendu incompatible avec Docker |

## Hors scope (Phase 6+)

- Templates d'applications certifiés et leurs tests de génération en CI
- Récipes réelles (auth email-password, oauth…)
- Génération multi-cibles (mobile, desktop) — le pipeline les accepte, les templates n'existent pas encore
- Terraform/Pulumi (§15 option, V3)
