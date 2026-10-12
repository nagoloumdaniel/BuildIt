# BuildIt — contexte projet

Development Environment Factory. Le produit s'appelle **BuildIt**, le moteur **Forge**, le binaire CLI **`pf`**. Le cahier des charges et la roadmap utilisent `pf` partout depuis le 26/09/2026.
Référence complète : `docs/cahier-des-charges.md`. Plan d'exécution : `docs/roadmap.md`.

## État

Phases 1 (socle monorepo), 2 (Project Manifest), 3 (registry, 283 fiches) et 4 (compatibility engine) livrées. Phase 5 livrée (5A + 5B), gate M3 partiel fermé : le socle généré s'installe et passe lint, typecheck et test (`pnpm test:smoke`), post-install et reprise d'étape, Template Resolver, `packages/recipes` avec deux recettes réelles, Dockerfile/devcontainer, revue sécurité écrite. Phase 6 livrée, gate M3 fermé : les quatre presets — **SaaS**, **API** (Hono), **Dashboard** (recette `dashboard-admin`), **Full-stack** (Next.js + Hono en monorepo) — sont certifiés de bout en bout. Le Full-stack a son contrat partagé (`packages/shared`) et un Dockerfile par application ; les tests Playwright générés tournent dans le test de fumée. Restent `packages/ui` et les entretiens 6.12. Phase 7 livrée hors publication npm : le CLI `pf` (`apps/cli`, [référence](docs/cli.md)) — `create`, `template`, `generate`, `graph`, `add`, `key`, menu d'accueil — sur `packages/presets` ; même manifest, même projet que le moteur, octet pour octet. Phase 7B livrée : `packages/exec`, `workspace`, `git`, `github` ; `pf clone`, `open`, `install`, `login`, `logout`, `repo`, `collab` ; création de dépôt et invitations prouvées contre un faux `fetch` seulement (API GitHub injoignable depuis la session).

**Phase 8 livrée pour le MVP — le configurateur web** (`apps/web`, [plan 8B](docs/superpowers/plans/2026-10-06-phase8-web-socle.md), [direction 8A](docs/superpowers/specs/2026-10-11-phase8a-direction-artistique-design.md)) : Next 15 + React 19 + Tailwind 4, servi en local par `pf web`. Le web consomme **les mêmes paquets que le CLI**, par un adaptateur unique (`src/lib/engine.ts`) et des Server Actions ; brouillon auto-sauvegardé qui ne peut porter **aucune valeur de variable d'environnement** (§6.8, §24) ; machine à états du parcours avec les bloquants du §6 en tests ; le même manifest que le CLI pour les mêmes choix (test `draftToManifest`, octet pour octet contre le preset SaaS). Décision 8B.6 : l'UI n'est pas hébergée pour le MVP, elle tourne dans le même processus Node que le moteur, le serveur n'écoute que sur `127.0.0.1`, et le jeton GitHub ne quitte jamais le processus serveur.

**Les 18 écrans du MVP sont codés** : Dashboard et menu d'accueil (§6.1, §18bis), Create, Target, Project Type, Architecture, Stack Builder (progressive disclosure §5), Capabilities, Environment & Secrets (noms seuls), Infrastructure, Blueprint, Dependency Graph (`/graph`, hors parcours), File Preview, Generation Progress, Generation Report, GitHub Connection, Clone, Open Local, Repository & Sharing. Le parcours des 12 étapes est prouvé de bout en bout **dans un vrai navigateur** (clavier seul, reprise du brouillon après rechargement, génération réelle sur disque) par `pnpm test:e2e`. La direction artistique (8A) est appliquée en tokens et **son gate humain est fermé** (11/10/2026) : les trois écrans les plus durs — Stack Builder, Blueprint, File Preview — ont été montrés et arbitrés. Le thème a été revu écran par écran (8F.3, 28 couples de contraste) et le parcours clavier des 12 étapes est prouvé, `packages/ui` livré et consommé par quatre écrans.

**Les entretiens développeurs 6.12 ont eu lieu** le 11/10/2026, avec un retour positif sur le contenu des quatre presets : [synthèse](docs/superpowers/specs/2026-10-11-validation-humaine-entretiens.md). Les verbatims ne sont pas archivés — le §0.2 les demande, la Phase 13 les produira pour de bon.

**Version 0.2.0** (13/10/2026) : audit de compatibilité (règle des écosystèmes interface/exécution, catégories réellement cumulatives, conflits et dépendances déclarés, voir [docs/compatibilite.md](docs/compatibilite.md)) ; bulle de détails sur chaque technologie (raison, technologies en cause, conséquence, solution, documentation officielle) ; stepper en douze numéros sur une ligne de progression, glissement directionnel entre étapes, bouton « Annuler » ; génération en deux sorties, ZIP ou dossier choisi dans l'explorateur avec installation des dépendances suivie en direct (`POST /api/generate`, flux SSE), registre serveur des dossiers générés pour une suppression sûre ; étape 10 renommée « Architecture du projet » avec un arbre commenté et repliable, réutilisé pour les projets déjà générés (`/projects/architecture`) ; projets réexportables et ouvrables sur GitHub quand le dépôt est connu. Preuve : `pnpm test` (28 tâches, 994 tests côté web), `pnpm test:e2e` (souris et clavier seul, sans obstacle), `node apps/web/e2e/shots.mjs`.

**Deuxième passe UI livrée** (12/10/2026) : l'en-tête n'est plus une barre mais une rangée de **bulles flottantes** (identité, navigation, langue, thème, code source), la bascule de thème est un contrôle à deux icônes dont le défaut est le thème du système, la pastille de l'onglet actif est retirée, et rien ne se déplace au survol. Les commandes et les chemins se copient (`CopyButton`, `CommandLine`, `CommandSteps`). Un projet généré peut être **supprimé du disque** depuis l'écran Projets : la règle (`lib/delete-project.ts`) n'accepte qu'un enfant direct du dossier de travail, l'écran confirme, et rien ne part d'un seul clic. Enfin, « ouvrir un projet local » ne demande plus jamais de taper un chemin : la carte de l'accueil **est** le bouton, elle ouvre l'explorateur et passe la main à `/open` ; en hébergé (trybuildit.vercel.app) l'explorateur est celui du navigateur (File System Access API) et la détection tourne sur la **même** règle, extraite en port (`detectFromEntries`, `@buildit/workspace`), l'installation étant remplacée par la commande à copier.

**Refonte UI/UX livrée** le 12/10/2026 ([spec](docs/superpowers/specs/2026-10-12-ui-ux-refonte-buildit.md)) : direction artistique « Forge » tenue par des jetons (orange = action, acier = information), Inter pour la prose et JetBrains Mono pour la donnée, navigation en bulles, stepper d'étapes, cartes responsives, **aucun squelette de chargement** (rotor, points, barre déterminée ou indéterminée), deux thèmes et deux langues. Le catalogue de technologies est servi par un sprite SVG de 196 marques (`public/tech-sprite.svg`, `TechIcon`) et les écrans vides ou en faute ont leurs illustrations (`components/ui/illustration.tsx`). Trois défauts fermés au passage : les logos étaient cassés dans les deux thèmes (le moteur d'images de Next exige `sharp`, absent — les WebP préparés par `apps/web/scripts/build-brand-webp.py` sont servis en image de fond, 18 ko au lieu de 170 ko) ; `useSyncExternalStore` recevait l'état courant comme *snapshot serveur*, ce qui faisait diverger l'hydratation des écrans du parcours (`#418` sur `target`, `preview`, `generate`) ; la page 404 affichait un chemin absent du rendu serveur. La preuve est en trois temps : `pnpm --filter @buildit/web test` (837 tests, 95,9 % sur `src/lib`), `pnpm test:e2e` (parcours souris **et** clavier seul), et `node apps/web/e2e/shots.mjs` qui capture les 21 écrans (clair, sombre, anglais) et échoue sur la moindre erreur de console.

**Phase 9 livrée** : lien de partage en lecture seule, le manifest encodé dans le fragment d'URL (aucun stockage serveur, aucun identifiant à énumérer).

**Phase 10 fermée** : revue de sécurité ([Phase 8-9](docs/superpowers/specs/2026-10-11-phase8-security-review.md)) et [revue de code complète](docs/superpowers/specs/2026-10-11-phase10-code-review.md) du diff cumulé (niveau `high`) — 3 findings `major` fermés avec leur sonde, dont un jeton hérité du shell qui atteignait le `postinstall` d'un projet cloné. La règle « catégorie → emplacement du manifest » vit désormais une fois (`packages/registry/src/slots.ts`). Le **Project Doctor** existe : `packages/doctor` (constats, score) + `pf doctor` (`--fix`, `--json`), et `pnpm health` le fait tourner sur ce dépôt — **89/100**, 0 échec.

**Phase 11 quasi fermée** : le [guide](docs/guide/README.md) est écrit et ses commandes rejouées ; `docs/llms.txt`, `robots.ts` et `sitemap.ts` sont prêts. Deux points de gate demandent une personne ou un site : le quickstart suivi par quelqu'un d'extérieur (une lecture ligne à ligne a été faite, le chrono tient largement les 10 minutes) et « `llms.txt` publié », qui attend l'hébergement.

**Phase 12 engagée : le CLI est publié.** Le 11/10/2026, `@nagoloum/cli@0.1.0` est publié sur le registre npm public sous le tag `next` (le scope `@buildit` appartient à une autre organisation sur npm — collision de nom, pas d'alerte de sécurité). Prouvé sur une installation réelle, hors du dépôt de développement : `npm i -g @nagoloum/cli@next`, `pf --version` → `0.1.0`, `pf create voisinage --preset saas` génère un projet réel avec dépendances installées. Reste à passer `latest` une fois la version jugée stable (`npm dist-tag add @nagoloum/cli@0.1.0 latest` — déjà fait automatiquement par npm pour cette première version, à surveiller aux suivantes). [Runbook Phase 12](docs/superpowers/specs/2026-10-11-phase12-deploiement-readiness.md) pour le reste : déploiement Vercel, variables, observabilité, critères de rollback. Ce qui manque encore : un hébergement pour `apps/web`, un DSN Sentry, un compte analytics — et un rollback **testé**.

Remote : `github.com/nagoloumdaniel/BuildIt`. **La CI GitHub n'est pas disponible** : l'intégration continue est locale, portée par le hook `pre-push` — `ci:local` à chaque push, plus `test:smoke` quand le push touche `generator`, `registry` ou `recipes`. `ci.yml` est dormant (déclenchement manuel).

Ajouts du 26/09/2026 au cahier des charges : menu d'accueil créer / cloner / ouvrir un projet local (§18bis), intégration GitHub — connexion, clonage, création de dépôt, partage et collaborateurs (§20bis). Exécutés en **Phase 7B**, après le CLI.

Reliquat de Phase 0, non fait et assumé : entretiens utilisateurs, profils concurrents, doc de monétisation V2. Le premier utilisateur (§0) a tranché le catalogue à leur place ; 2–3 entretiens sont prévus en Phase 6 (étape 6.12), le reste en Phase 13.

## Commandes

```bash
pnpm ci:local      # pipeline complet — c'est ce que valide le hook pre-push
pnpm lint:fix      # Biome, corrections appliquées
pnpm typecheck     # tsc strict, via Turborepo
pnpm test          # Vitest, via Turborepo
pnpm build         # tsdown, via Turborepo
pnpm test:smoke    # génère, installe et vérifie de vrais projets — réseau, ~1 min
pnpm ci:full       # ci:local + test:smoke
PF_SMOKE_DOCKER_CA=<ca.crt> pnpm test:smoke   # derrière un proxy TLS d'entreprise
PF_SMOKE_CHROMIUM=<chrome> pnpm test:smoke     # Chromium déjà installé, sans téléchargement
pnpm pf web        # le configurateur web, construit puis servi en local sur 127.0.0.1
pnpm test:e2e      # le parcours des 12 étapes dans un vrai navigateur (Edge/Chrome/Chromium)
```

Le pipeline est défini à un seul endroit : les scripts `ci:local` et `test:smoke` du `package.json` racine. Le hook `pre-push` et `ci.yml` (dormant) n'appellent qu'eux.

## Structure

```text
tooling/typescript-config/   tsconfig de base partagé
packages/validation/         modèle d'erreur partagé — livré
packages/manifest/           Project Manifest (§10) — livré
packages/registry/           catalogue (§7, §11) — livré, 283 fiches
  data/<catégorie>/<id>.entry.json   source de vérité, éditable à la main
  src/generated/entries.ts           index engendré, versionné, vérifié
packages/compatibility/      règles du §12 — livré
packages/recipes/            recettes (§22, Recipe Resolver) — livré
  data/<id>.recipe.json              source de vérité ; index engendré comme le registry
packages/exec/               exécution de commandes sans shell (stdin, env) — partagée par generator, git, workspace, github
packages/workspace/          projet local : écosystème, gestionnaire de paquets, installation (§18bis)
packages/git/                liens validés, clone sans reste, init, push — jeton jamais dans une URL (§18bis)
packages/github/             API GitHub, device flow, jeton dans le trousseau (§20bis)
packages/presets/            les quatre presets certifiés (§8) : manifest + recettes, partagés CLI / UI
apps/cli/                    le CLI pf (§21) — aucune logique métier ; embarque le moteur à la construction
apps/web/                    le configurateur web (Phase 8) — Next.js, aucune logique métier
  src/lib/engine.ts                  l'adaptateur : le seul endroit qui parle au moteur (8B.2)
  src/lib/{draft,flow,theme,toasts,session}.ts   état d'UI pur, testé
  src/app/actions.ts                 les Server Actions du moteur (jamais importées d'un composant client)
  src/app/actions-node.ts            les Server Actions qui touchent la machine (git, workspace, GitHub)
  src/app/create/<étape>/            un écran par URL ; la logique pure vit dans un module frère
  src/components/wizard/             shell, progression, provider du brouillon
  src/app/globals.css                les tokens et les classes pf-* (direction 8A)
  e2e/journey.mjs                    le parcours complet, piloté dans un vrai navigateur
packages/generator/          pipeline du §22 — livré ; monorepo multi-applications (monorepo.ts)
  templates/                         templates livrés (recettes aujourd'hui, presets en Phase 6)
  src/*.smoke.ts                     test de fumée réseau : pnpm test:smoke, hors pnpm test
assets/brand/                logos, provisoires (voir son README)
docs/superpowers/{specs,plans}/
```

## Frontières entre paquets

Frontière structurante, à ne pas franchir :

- `manifest` valide la **forme** — « framework est un slug kebab-case »
- `registry` valide l'**identité** — « le slug next existe »
- `compatibility` valide la **combinaison** — « next va avec prisma »

L'arité des catégories vit dans `compatibility/arity.ts`, jamais sur les fiches : c'est une propriété invariante de la catégorie. **Déduire un conflit de la seule catégorie est faux** — `testing` est cumulative (vitest, playwright et testing-library coexistent), `orm` est exclusive.

Aucun nom de technologie ne doit apparaître dans `packages/manifest`. S'il en apparaît un, ajouter une entrée au catalogue obligera à faire migrer tous les manifests existants.

Deux invariants du manifest, tenus par des tests :

- **Un seul champ à contenu libre** : `name`. C'est ce qui rend un manifest structurellement incapable de porter un secret, alors qu'il transite par les liens de partage (§20, §24).
- **`parseManifest` rend toujours une forme canonique** : ensembles triés, clés ordonnées. C'est ce qui rend vérifiable la promesse « mêmes choix en UI et en CLI ⇒ manifest identique octet pour octet ».

Les packages naissent dans leur phase. Ne pas créer de répertoire vide « pour plus tard » : c'est du scaffolding à maintenir pour rien.

## Conventions non négociables

- **ESM strict** partout, `"type": "module"`.
- **Node ≥ 20.11**, cible `ES2023`.
- **`isolatedDeclarations`** activé : tout export public porte un type explicite. Les fichiers de config (`*.config.ts`) sont hors `include` du tsconfig — ils sont validés par l'exécution des outils.
- **Aucune valeur sensible** dans le dépôt (§24). secretlint tourne au pre-commit.
- **Conventional Commits**, vérifiés par commitlint.
- Le formatage appartient à Biome.

## Méthode

- TDD : le test échoue d'abord, on le vérifie, puis on implémente.
- Un garde-fou n'est validé que par un **test négatif** — on prouve qu'il rejette, pas qu'il passe. Et la sonde du test négatif doit être réaliste : une sonde que l'outil ignore donne un faux « garde-fou cassé ».
- Ne jamais chaîner `&& echo "OK"` après une commande dont la sortie passe par `tail` — le code de retour est celui de `tail`, et le « OK » ment.
- **Regarder `docs/superpowers/specs/` avant d'écrire un spec.** Un spec de Phase 5 existait déjà ; en avoir écrit un second a produit deux conventions de nommage concurrentes qu'il a fallu réconcilier après coup.
- Ne jamais mettre de backtick dans un `node -e "..."` lancé depuis bash : le shell l'interprète comme une substitution de commande et mange le contenu. Pour du contenu qui en contient, utiliser les outils d'écriture de fichier.

## Pièges rencontrés sur cette stack

- pnpm 11 utilise `allowBuilds` dans `pnpm-workspace.yaml`, pas `onlyBuiltDependencies` (syntaxe pnpm 10).
- Biome parse les `.json` en JSON strict : les tsconfig commentés ont besoin d'un `overrides` avec `json.parser.allowComments`.
- tsdown émet `.mjs` / `.d.mts` par défaut ; dans un paquet `"type": "module"` il faut `outExtensions` pour retomber sur `.js` / `.d.ts` et rester cohérent avec `exports`.
- `isolatedDeclarations` exige `declaration: true` même avec `noEmit: true` (TS5069).
- `changeset init` est interactif et échoue sans TTY : écrire `.changeset/config.json` à la main.
- `isolatedDeclarations` refuse `as const satisfies` sur un export : annoter explicitement.
- Zod 4 signale une **énumération absente** en `invalid_value`, pas en `invalid_type`. Ne pas déduire « champ manquant » du code Zod : regarder si la valeur à ce chemin est `undefined`.
- Zod 4 expose `params` uniquement sur les issues `code: 'custom'` — restreindre l'union avant d'y accéder.
- Une fiche du registry se nomme `<id>.entry.json`, jamais `<id>.json` : plusieurs identifiants de technologies sont des noms de fichiers de configuration réservés (`biome.json`, `vercel.json`, `turbo.json`), et l'outil correspondant les lit comme sa propre configuration.
- Biome découvre les configurations imbriquées avant d'appliquer `files.includes` : exclure un dossier n'empêche pas un `biome.json` qui s'y trouve d'être lu.
- pnpm 11 **fait échouer** `pnpm install` (`ERR_PNPM_IGNORED_BUILDS`) dès qu'un paquet a un script de build non approuvé — Prisma, notamment. Le projet généré déclare `allowBuilds` dans `pnpm-workspace.yaml`, même hors monorepo.
- `tsc` sans aucun fichier d'entrée échoue (TS18003). Un socle TypeScript neuf a donc besoin d'au moins un `.ts` — d'où `env.d.ts`.
- Sans `biome.json`, Biome formate en **tabulations** : tout JSON généré en espaces échoue au `lint`. Et un tableau court écrit par `JSON.stringify` est remis sur une ligne par Biome — écrire ces fichiers à la main.
- Dans un Dockerfile, Corepack retélécharge pnpm au démarrage sous un autre utilisateur : fixer `COREPACK_HOME` et recopier le cache dans l'étape d'exécution.
- La couverture ne dit rien de la sortie : 99 % de couverture n'a pas vu qu'un projet généré échouait à `typecheck`. Toute sortie générée est vérifiée par les outils qu'elle déclare (`socle.test.ts` hors réseau, `pnpm test:smoke` en vrai).
- Prisma 7 : `env('DATABASE_URL')` de `prisma/config` **lève** quand la variable manque — `prisma generate` échoue alors en CI. Utiliser `process.env.DATABASE_URL`. Le client est engendré dans le projet (`generated/`) : `prisma generate` en postinstall, `generated/` ignoré par git et Biome.
- Un Dockerfile avec un postinstall qui lit le code (prisma generate) : `pnpm fetch` sur le verrou, puis `pnpm install --offline` **après** `COPY . .`.
- pnpm 11 : un script d'installation qu'on ne veut pas exécuter se **refuse** (`allowBuilds: { paquet: false }`) ; ni autorisé ni refusé, il fait échouer l'installation.
- Le code qui dépend de plusieurs choix va dans une intégration à `when`, jamais dans le template d'une seule fiche. Un fichier que plusieurs outils veulent (`instrumentation-client.ts`) se compose, il ne s'écrit pas deux fois.
- Les modèles de tables d'une bibliothèque (Better Auth) se prennent de son CLI officiel, pas de mémoire.
- Un serveur lancé par `pnpm start` : `kill()` ne tue que pnpm, le `node` qu'il a lancé survit et garde le port. Groupe de processus (`detached`, `kill(-pid)`), attendre sa fin, et refuser de tester si le port répond déjà — un orphelin a déjà fait « échouer » la mauvaise application.
- Services Docker d'un test : `compose down` à la fin de **chaque** projet, pas en fin de suite — le suivant reprend les mêmes ports.
- Docker Hub : quota anonyme. `compose pull --policy missing` ; quota et réseau sautent l'aller-retour avec un avertissement, une image introuvable reste un échec.
- Vitest n'affiche pas les `console.warn` d'un test qui passe : un « avertissement » y est invisible. Une preuve sautée doit être un test marqué `skipped` (`it.skipIf`), et le saut doit être demandé explicitement (`PF_SMOKE_SKIP_DOCKER=1`) — sinon le test échoue. Sans cette règle, le test de fumée a réussi en silence avec Docker arrêté.
- `pkill -f motif` depuis un shell dont la ligne de commande contient le motif tue ce shell (code 144) : écrire `pkill -f "[n]ext-server"`.
- Un test qui passe sur le code source ne dit rien du **bundle** : ce qui part en production (`dist/`, image Docker) se démarre et s'interroge dans le test de fumée.
- Pour suggérer une correction de faute de frappe, utiliser **Damerau**-Levenshtein : Levenshtein facture 2 une transposition (« wbe » → « web »), ce qui la met hors d'atteinte de tout seuil raisonnable.
- Next 15 charge `next.config.ts` en appelant l'**API JavaScript** de TypeScript (`ts.sys.fileExists`) et vérifie la version installée : sous TypeScript 7 (compilateur natif), il refuse de construire (« TypeScript 7.0.2 is not supported by this version of Next.js »). `apps/web` est donc en `typescript@6.0.3` — la seule exception du dépôt, écrite dans `apps/web/package.json` — et sa configuration est en `next.config.mjs`.
- Next/webpack ne résout pas `./x.js` vers `./x.tsx` : dans `apps/web`, tous les imports internes sont **sans extension**. Vitest, lui, résout les deux formes — c'est Next qui impose la règle.
- Le shell de cette machine est **Windows PowerShell 5.1**, pas pwsh 7 : `Get-Content`/`Select-String` lisent l'UTF-8 en CP1252 (l'affichage semble mojibake, le fichier est intact) et `Set-Content -Encoding utf8` **ré-encode** le texte relu : un remplacement en masse a corrompu 8 fichiers (`é` → `Ã©`). Les fichiers s'écrivent avec les outils d'édition, jamais par le shell.
- `vitest run --coverage -- <motif>` sur un sous-ensemble de tests échoue sur les seuils **globaux** de couverture (les fichiers non chargés comptent 0 %) : ce n'est pas un échec de tests. La vérification se fait sur la suite complète.
- `import 'server-only'` garde le moteur hors du bundle client ; sous Vitest, il faut un alias **ciblé** sur ce seul paquet. Ajouter la condition `react-server` globalement casse `react-dom/server`, qui résout alors sa variante RSC — un fichier qui lève.
- Le serveur de `pf web` est lancé par le `CommandRunner`, qui **capture** la sortie et ne la rend qu'à l'arrêt : les journaux de Next n'apparaissent donc pas pendant que `pf web` tourne (limite connue, le streaming n'est pas dans l'interface du runner).
- `output: 'standalone'` en **monorepo** ne dépose pas le serveur à la racine de `standalone/` : Next trace depuis la racine du dépôt et recopie l'arborescence, donc `apps/web/.next/standalone/apps/web/server.js`. Un `pf web` qui ne connaît que `standalone/server.js` refuse de démarrer un serveur pourtant construit — les tests à base de faux fichier ne le voient pas, la vérification réelle si. Les deux emplacements sont acceptés.
- Une route Next qui importe le moteur demande plus que `transpilePackages` : `resolve.extensionAlias` (`.js` → `.ts`, les paquets écrivent `./rules.js`) et `parser: { url: false }` sur `packages/` (le `new URL('../templates', import.meta.url)` du générateur est lu comme une requête vers un dossier). Sans les deux, le build casse.
- `.next/standalone` n'est **pas nettoyé** entre deux builds : les liens symboliques pnpm d'un build précédent y survivent, morts, et le serveur autonome échoue alors sur un `EPERM` de `realpathSync` — sous Windows, Node n'arrive de toute façon pas toujours à résoudre ces liens. C'est pourquoi `pf web` sert par **`next start`** quand `node_modules/next` est là, et ne retombe sur le standalone que pour une application distribuée.
- Biome n'analyse pas les directives Tailwind 4 (`@theme`, `@layer`) sans `css.parser.tailwindDirectives` : sans cette option, `pnpm lint` échoue sur un fichier CSS par ailleurs correct. Les `!important` du bloc `prefers-reduced-motion` restent des avertissements assumés — ils sont nécessaires pour écraser n'importe quel style.
- Next **interdit tout export autre que `default`** dans un `page.tsx` (`.next/types/app/**/page.ts`, TS2344) : les données et composants d'un écran vivent dans un module frère (`profiles.tsx`, `stack-view.ts`, `summary.ts`…), jamais dans le fichier de route.
- Importer `@buildit/registry` depuis un composant client fait entrer les 283 fiches engendrées dans le bundle (~13 ko sur 5 routes). C'est assumé : les paquets du monorepo publient leur source, le moteur (`server-only`) n'y est pas, et le catalogue ne contient aucun secret.
- `pnpm test:e2e` pilote le navigateur **déjà installé** (`PF_E2E_CHROMIUM`, sinon Edge ou Chrome) : sans navigateur, il échoue en disant quoi faire — `PF_E2E_SKIP=1` saute la preuve explicitement.
