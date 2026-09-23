# Project Factory — contexte projet

Development Environment Factory. Le produit s'appelle **Project Factory**, le moteur **Forge**, le binaire CLI **`pf`**.
Référence complète : `docs/cahier-des-charges.md`. Plan d'exécution : `docs/roadmap.md`.

## État

Phases 1 (socle monorepo) et 2 (Project Manifest) livrées. Phase 3 (registry) livrée : schéma, intégrité, chargeur, 282 fiches et doc de contribution. Prochaine : Phase 4, compatibility engine. Pas de remote Git — le compte GitHub est indisponible, la CI est **locale**.

Reliquat de Phase 0, non fait et assumé : entretiens utilisateurs, profils concurrents, doc de monétisation V2. Le premier utilisateur (§0) a tranché le catalogue à leur place ; à corriger avec de vrais testeurs en Phase 13.

## Commandes

```bash
pnpm ci:local      # pipeline complet — c'est ce que valide le hook pre-push
pnpm lint:fix      # Biome, corrections appliquées
pnpm typecheck     # tsc strict, via Turborepo
pnpm test          # Vitest, via Turborepo
pnpm build         # tsdown, via Turborepo
```

`.github/workflows/ci.yml` appelle `pnpm ci:local` et rien d'autre. Si le pipeline change, il change à un seul endroit : le script `ci:local` du `package.json` racine.

## Structure

```text
tooling/typescript-config/   tsconfig de base partagé
packages/validation/         modèle d'erreur partagé — livré
packages/manifest/           Project Manifest (§10) — livré
packages/registry/           catalogue (§7, §11) — livré, 282 fiches
  data/<catégorie>/<id>.entry.json   source de vérité, éditable à la main
  src/generated/entries.ts           index engendré, versionné, vérifié
assets/brand/                logos, provisoires (voir son README)
docs/superpowers/{specs,plans}/
```

## Frontières entre paquets

Frontière structurante, à ne pas franchir :

- `manifest` valide la **forme** — « framework est un slug kebab-case »
- `registry` (Phase 3) valide l'**identité** — « le slug next existe »
- `compatibility` (Phase 4) valide la **combinaison** — « next va avec drizzle »

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
- Pour suggérer une correction de faute de frappe, utiliser **Damerau**-Levenshtein : Levenshtein facture 2 une transposition (« wbe » → « web »), ce qui la met hors d'atteinte de tout seuil raisonnable.
