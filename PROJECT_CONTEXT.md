# Project Factory — contexte projet

Development Environment Factory. Le produit s'appelle **Project Factory**, le moteur **Forge**, le binaire CLI **`pf`**. Le cahier des charges et la roadmap utilisent `pf` partout depuis le 26/09/2026.
Référence complète : `docs/cahier-des-charges.md`. Plan d'exécution : `docs/roadmap.md`.

## État

Phases 1 (socle monorepo), 2 (Project Manifest), 3 (registry, 282 fiches) et 4 (compatibility engine) livrées. Phase 5 livrée (5A + 5B), gate M3 partiel fermé : le socle généré s'installe et passe lint, typecheck et test (`pnpm test:smoke`), post-install et reprise d'étape, Template Resolver, `packages/recipes` avec deux recettes réelles, Dockerfile/devcontainer, revue sécurité écrite. Phase 6 livrée, gate M3 fermé : les quatre presets — **SaaS**, **API** (Hono), **Dashboard** (recette `dashboard-admin`), **Full-stack** (Next.js + Hono en monorepo) — sont certifiés de bout en bout. Le Full-stack a son contrat partagé (`packages/shared`) et un Dockerfile par application ; les tests Playwright générés tournent dans le test de fumée. Restent `packages/ui` et les entretiens 6.12. Phase 7 livrée hors publication npm : le CLI `pf` (`apps/cli`, [référence](docs/cli.md)) — `create`, `template`, `generate`, `graph`, `add`, `key`, menu d'accueil — sur `packages/presets` ; même manifest, même projet que le moteur, octet pour octet. **Prochaine étape : Phase 7B, projets existants et GitHub.**

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
```

Le pipeline est défini à un seul endroit : les scripts `ci:local` et `test:smoke` du `package.json` racine. Le hook `pre-push` et `ci.yml` (dormant) n'appellent qu'eux.

## Structure

```text
tooling/typescript-config/   tsconfig de base partagé
packages/validation/         modèle d'erreur partagé — livré
packages/manifest/           Project Manifest (§10) — livré
packages/registry/           catalogue (§7, §11) — livré, 282 fiches
  data/<catégorie>/<id>.entry.json   source de vérité, éditable à la main
  src/generated/entries.ts           index engendré, versionné, vérifié
packages/compatibility/      règles du §12 — livré
packages/recipes/            recettes (§22, Recipe Resolver) — livré
  data/<id>.recipe.json              source de vérité ; index engendré comme le registry
packages/presets/            les quatre presets certifiés (§8) : manifest + recettes, partagés CLI / UI
apps/cli/                    le CLI pf (§21) — aucune logique métier ; embarque le moteur à la construction
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
