# Project Factory

> **Development Environment Factory** — décrire un projet, choisir ses plateformes et ses technologies, obtenir un projet prêt à développer : cohérent, documenté et diagnostiqué.

**Statut : pré-alpha.** Le moteur (manifest, registry, compatibility, generator) existe et est testé ; quatre presets (SaaS, API, Dashboard, Full-stack en monorepo) sont certifiés : générés, installés, construits et démarrés par le test de fumée. Prochaine étape : le CLI `pf` (Phase 7). Rien n'est publié, rien n'est utilisable par un tiers. Voir la [roadmap](docs/roadmap.md).

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

La CI GitHub n'est pas disponible pour ce dépôt : **l'intégration continue est locale**, et le hook `pre-push` de lefthook la rend obligatoire.

| Quand | Ce qui tourne |
|---|---|
| chaque push | `pnpm ci:local` — lint, typecheck, test, build, scan de secrets |
| push qui touche `generator`, `registry` ou `recipes` | en plus, `pnpm test:smoke` — génère de vrais projets, les installe depuis npm, les construit ; avec Docker, va jusqu'à une base réelle et une inscription |
| à la main | `pnpm ci:full` — les deux |

Le test de fumée exige Docker (base, Redis, image) : sans lui, il échoue. `PF_SMOKE_SKIP_DOCKER=1` saute ces preuves **explicitement** — elles apparaissent « skipped » dans le compte — et cela se dit dans la PR. Hors-ligne, `LEFTHOOK_EXCLUDE=smoke git push`. Derrière un proxy TLS d'entreprise, `PF_SMOKE_DOCKER_CA=<ca.crt>` permet de construire l'image Docker du test. `.github/workflows/ci.yml` est gardé dormant (déclenchement manuel), prêt à resservir.

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
