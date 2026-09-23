# Project Factory — contexte projet

Development Environment Factory. Le produit s'appelle **Project Factory**, le moteur **Forge**, le binaire CLI **`pf`**.
Référence complète : `docs/cahier-des-charges.md`. Plan d'exécution : `docs/roadmap.md`.

## État

Phase 1 de la roadmap (socle monorepo). Pas de remote Git — le compte GitHub est indisponible, la CI est **locale**.

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

```
tooling/typescript-config/   tsconfig de base partagé
packages/manifest/           Project Manifest (§10) — cible de la Phase 2
docs/superpowers/{specs,plans}/
```

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
