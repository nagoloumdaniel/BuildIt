# Project Factory

> **Development Environment Factory** — décrire un projet, choisir ses plateformes et ses technologies, obtenir un projet prêt à développer : cohérent, documenté et diagnostiqué.

**Statut : pré-alpha.** Le moteur (manifest, registry, compatibility, generator) existe et est testé ; un projet généré s'installe et passe sa propre CI. Prochaine étape : le premier preset certifié (Phase 6). Rien n'est publié, rien n'est utilisable par un tiers. Voir la [roadmap](docs/roadmap.md).

---

## Le code généré ne dépend pas de Project Factory

C'est le principe fondateur du produit, et il est vérifié par un test automatisé, pas seulement affirmé ici.

Le projet que vous générez est autonome : aucune dépendance runtime, aucun paquet propriétaire, aucun appel réseau vers nous. Vous pouvez supprimer Project Factory de votre machine juste après la génération — rien ne casse. Ce que vous obtenez est le code que vous auriez écrit vous-même si vous aviez pris le temps de câbler correctement Docker, la CI, le lint, les tests et les variables d'environnement.

## Confidentialité : local-first par défaut

L'analyse de projet et l'assistant d'architecture tournent **en local**, avec votre propre clé API. Aucun code, aucun prompt ne transite par un serveur Project Factory. L'exécution hébergée existera un jour comme option payante, jamais comme obligation.

---

## Project Factory et Forge

Deux noms, une seule chose :

- **Project Factory** est le produit.
- **Forge** est le moteur qui l'alimente.
- **`pf`** est le nom de la commande du CLI.
- L'interface web et le CLI `pf` sont deux façades du même moteur, au même niveau. Tout ce qui est faisable dans l'une l'est dans l'autre, parce que les deux produisent le même *Project Manifest* et le passent au même pipeline.

---

## Développement

Prérequis : **Node ≥ 20.11**, **pnpm ≥ 11**.

```bash
pnpm install
pnpm ci:local      # lint + typecheck + test + build + scan de secrets
```

Commandes individuelles :

| Commande | Rôle |
|---|---|
| `pnpm lint` | Biome (format + lint) |
| `pnpm lint:fix` | Biome avec corrections appliquées |
| `pnpm typecheck` | TypeScript, mode strict |
| `pnpm test` | Vitest |
| `pnpm build` | tsdown, via Turborepo |
| `pnpm lint:secrets` | secretlint |

### Intégration continue

**`pnpm ci:local` est la CI** : elle est exécutée automatiquement par le hook `pre-push` de lefthook, et `.github/workflows/ci.yml` appelle exactement la même commande sur GitHub Actions. Aucune divergence possible entre local et distant.

Le test de fumée (`pnpm test:smoke`) génère un vrai projet, l'installe et le vérifie. Il a besoin du réseau et prend environ une minute : il tourne dans un job CI dédié plutôt qu'au pre-push.

### Structure

```
tooling/    configurations partagées (TypeScript, …)
packages/   moteur — manifest, registry, compatibility, generator…
docs/       cahier des charges, roadmap, specs, plans
```

---

## Documentation

- [Cahier des charges](docs/cahier-des-charges.md) — cadrage produit et technique complet
- [Roadmap](docs/roadmap.md) — 0 → beta publique, phase par phase
- [Contribuer](CONTRIBUTING.md)

## Licence

[MIT](LICENSE)
