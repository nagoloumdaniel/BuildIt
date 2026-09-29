# Phase 5 — Revue de sécurité du generator (étape 5.13 / 5B.7)

**Date :** 2026-09-26 · **Périmètre :** `packages/generator`, `packages/recipes`, les fichiers générés (§15, §22, §24)
**Méthode :** relecture adversariale du code, puis un test négatif pour chaque défaut trouvé. Un défaut n'est déclaré corrigé que lorsque son test **échouait avant** la correction.

---

## Résultat

**Aucun finding haut ouvert.** Cinq défauts trouvés, cinq corrigés, chacun verrouillé par un test. Sept risques résiduels acceptés et suivis ci-dessous.

## Défauts trouvés et corrigés

| # | Gravité | Défaut | Correction | Preuve |
|---|---|---|---|---|
| S1 | **Haute** | Un template pouvait écrire dans `.git/` (`.git/hooks/pre-commit`, `.git/config` avec `core.fsmonitor`). Le code posé là s'exécute au prochain `git commit` — celui de l'étape git du pipeline, déjà. Critique dès que les templates viendront d'un registry communautaire (§19). | Nouveau code `GEN_PATH_RESERVED` : tout segment `.git`, quelle que soit sa casse et ses points/espaces finaux, est refusé au plan, avant toute écriture. | `plan.test.ts` — « chemins réservés » (6 refus, 4 acceptations dont `.gitignore` et `.github/`) |
| S2 | Moyenne | Les conflits de fichiers étaient détectés sur le chemin **tel qu'écrit** : `lib/./a.ts` contre `lib/a.ts`, ou `README.md` contre `readme.md` sur un disque insensible à la casse (macOS, Windows), passaient — la seconde écriture écrasait la première en silence. | Clé d'identité = chemin résolu, en minuscules. | `plan.test.ts` — « conflits sur le chemin réel » |
| S3 | Moyenne | `name`, seul champ libre du manifest, est substitué dans du code (`package.json`, templates). Le pipeline acceptait un `Manifest` typé sans le revalider : un appelant qui en fabrique un à la main pouvait injecter du code par le nom. | Revérifié par le socle, premier endroit où il entre dans un fichier (`GEN_INVALID_PROJECT_NAME`). `PROJECT_NAME_PATTERN` est désormais exporté par `manifest`. | `pipeline.test.ts` — « le nom du projet est revérifié avant tout rendu » |
| S4 | Basse | Le Template Resolver contrôlait les liens symboliques sur le dernier composant d'un chemin seulement : un dossier intermédiaire lié ailleurs (`recipes/` → `/`) était suivi. | Chaque composant est contrôlé (`symlinkedAncestor`). | `templates.test.ts` — « liens symboliques en chemin » |
| S5 | Moyenne | Le `Dockerfile` généré retéléchargeait pnpm **à chaque démarrage** du conteneur : dépendance réseau en production, et un téléchargement de code à chaque boot. Trouvé en construisant réellement l'image. | Cache Corepack dans `COREPACK_HOME`, recopié dans l'étape d'exécution. | Image construite et lancée avec `docker run --network none` : démarre, uid 1000. `infrastructure.test.ts` — « embarque pnpm » |

## Contrôles vérifiés sans défaut

| Contrôle (§24) | Où | Preuve |
|---|---|---|
| Aucune écriture hors de la cible : `../`, chemin absolu, lecteur Windows, `\` | `plan.ts` | `plan.test.ts` |
| Aucune écriture à travers un lien symbolique existant | `write.ts` (au moment d'écrire) | `write.test.ts` |
| Rollback : seules les créations du générateur sont annulées, jamais un fichier préexistant | `write.ts` (journal) | `write.test.ts` — injection de panne à mi-écriture |
| Pas d'exécution de code de template : substitution sur liste fermée, `{{constructor}}`, `{{eval}}`, `<%= %>`, backticks jamais interprétés | `template.ts` | `template.test.ts` |
| Templates : binaires et liens refusés, chemins de recette sûrs | `templates.ts`, `recipes/schema.ts` | `templates.test.ts`, `recipes/load.test.ts` |
| `.env.example` sans valeur ; une « variable » qui ressemble à une valeur fait échouer | `scaffold.ts` | `scaffold.test.ts`, `pipeline.test.ts` |
| Commandes sans shell : un argument reste un argument | `postinstall.ts` | `postinstall.test.ts` — « ne passe jamais par un shell » |
| Git : aucune identité inventée, pas de dépôt imbriqué ni de commit dans le dépôt d'un autre | `postinstall.ts` | `postinstall.test.ts` |
| `allowBuilds` minimal : seuls les paquets dont une technologie choisie a besoin | `integrations.data.ts` | `scaffold.test.ts` — « n'approuve rien qui ne soit demandé » |
| Conteneur : utilisateur non root, `.env` exclu du contexte de construction | `infrastructure.ts` | `infrastructure.test.ts` + construction réelle |
| Le projet généré ne dépend pas de Project Factory | pipeline | `pipeline.test.ts` — grep des imports |

## Risques résiduels acceptés

| # | Risque | Pourquoi accepté | Quand le revoir |
|---|---|---|---|
| R1 | ~~Sous Windows, `nodeCommandRunner` passe par un shell.~~ **Levé** : résolution sans shell (`resolveWindowsCommand`), et en Phase 7B les liens saisis sont validés avant Git, puis séparés par `--`. | — | — |
| R2 | Fenêtre entre le contrôle « lien symbolique » et l'écriture (TOCTOU). | N'est exploitable que par un attaquant local qui écrit déjà dans le dossier cible — il a déjà la main. | Si la génération devient un service (cloud, V2). |
| R3 | Les messages d'échec recopient les 20 dernières lignes de sortie de pnpm/git. | pnpm masque les jetons de registre. Phase 7B : le jeton GitHub n'est jamais dans l'URL (credential helper), les liens à identifiants sont refusés, et la sortie de git est de plus expurgée du jeton. | — |
| R4 | Les plages de version ne sont figées qu'à l'installation. | Reproductibilité assurée par le verrou commité ; pnpm 11 retient par défaut les versions trop récentes. | Phase 6 : épingler les presets certifiés. |
| R5 | `allowBuilds` autorise l'exécution des scripts de Prisma. | Nécessaire au fonctionnement ; liste minimale et commentée. | À chaque fiche qui en ajoute. |
| R6 | Noms courts Windows (`GIT~1`) non couverts par S1. | Exige un disque NTFS avec noms 8.3 activés **et** un template malveillant. | Avec le registry communautaire (V2) : liste blanche de chemins plutôt que liste noire. |
| R7 | Identifiants de bac à sable dans `docker-compose.yml`. | Valeurs de développement local, documentées comme telles dans le fichier ; aucun accès à autre chose qu'une base vide. | — |

## Hors périmètre de cette revue

Clonage de dépôts, jeton GitHub et installation de code non fiable (§18bis, §20bis) : revue dédiée en Phase 7B, puis revue globale en Phase 10.
