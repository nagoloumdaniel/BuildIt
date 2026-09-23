# Contribuer à Project Factory

Le projet est en pré-alpha (Phase 1 de la [roadmap](docs/roadmap.md)). Les contributions externes ne sont pas encore ouvertes — ce document fixe les conventions pour qu'elles le soient proprement le jour venu.

## Prérequis

- Node ≥ 20.11
- pnpm ≥ 11

```bash
pnpm install
```

## Avant de pousser

```bash
pnpm ci:local
```

C'est le pipeline complet : lint, typecheck, tests, build, scan de secrets. Le hook `pre-push` l'exécute de toute façon — le lancer à la main évite juste d'attendre pour rien.

## Conventions

### Commits

[Conventional Commits](https://www.conventionalcommits.org/), vérifiés par commitlint au moment du `commit-msg`. Un message non conforme est rejeté.

```
feat(registry): ajoute la contrainte de version semver
fix(generator): restaure l'état du disque quand l'écriture échoue
chore(deps): passe Biome en 2.5.14
docs(readme): explicite le principe de non-dépendance
```

### Code

- TypeScript strict, `isolatedDeclarations` activé : les exports publics portent un type explicite.
- ESM uniquement (`"type": "module"` partout).
- Le formatage est celui de Biome. Ne le discutez pas, lancez `pnpm lint:fix`.

### Tests

Les tests s'écrivent **avant** l'implémentation. Un garde-fou n'est considéré comme en place que si on a vu la violation correspondante être rejetée — prouver qu'il passe ne suffit pas, il faut prouver qu'il mord.

### Changesets

Toute modification qui affecte un paquet publiable s'accompagne d'un changeset :

```bash
pnpm exec changeset
```

## Secrets

Aucune valeur sensible dans le dépôt, jamais — pas même en exemple, pas même commentée. `secretlint` tourne au `pre-commit` et dans `pnpm ci:local`. Les variables d'environnement se déclarent dans `.env.example`, sans valeur.

## Registry

Ajouter une technologie au catalogue, c'est ajouter un fichier JSON — pas modifier du code. La procédure complète est dans [packages/registry/CONTRIBUTING.md](packages/registry/CONTRIBUTING.md).
