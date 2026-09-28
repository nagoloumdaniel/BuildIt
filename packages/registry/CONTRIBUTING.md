# Ajouter une technologie au registry

Le registry est la base de connaissances de Project Factory : ce que le produit sait des technologies. Il n'est jamais codé en dur dans un écran. Ajouter une technologie, c'est ajouter **un fichier JSON**, pas modifier du code.

---

## En bref

```bash
# 1. créer la fiche
$EDITOR packages/registry/data/<catégorie>/<id>.entry.json

# 2. régénérer l'index
pnpm --filter @project-factory/registry run build:index

# 3. vérifier
pnpm ci:local
```

Si `ci:local` passe, la contribution est recevable.

---

## Où vit une fiche

```
packages/registry/data/<catégorie>/<id>.entry.json
```

Une fiche par fichier : en revue de code, ajouter une technologie donne un diff d'un seul fichier, lisible d'un coup d'œil.

### Pourquoi `.entry.json` et pas `.json`

Une fiche porte le nom de sa technologie. Plusieurs de ces noms sont des fichiers de configuration réservés : `biome.json`, `vercel.json`, `turbo.json`, `package.json`. Sans le suffixe, l'outil correspondant lit la fiche comme **sa propre configuration** et la construction échoue. C'est arrivé avec Biome le jour où la fiche `biome` a été écrite.

---

## Anatomie d'une fiche

```json
{
  "id": "better-auth",
  "name": "Better Auth",
  "category": "authentication",
  "targets": ["web", "api"],
  "status": "stable",
  "generation": "declared",
  "license": "MIT",
  "lastReviewedAt": "2026-09-23",
  "versionRange": ">=1.0.0 <2.0.0",
  "requires": ["typescript"],
  "compatibleWith": ["next", "prisma", "postgresql"],
  "packages": ["better-auth"],
  "env": ["BETTER_AUTH_SECRET", "BETTER_AUTH_URL"],
  "recipes": ["email-password", "oauth", "passkeys"],
  "docs": "https://www.better-auth.com"
}
```

### Champs obligatoires

| Champ | Règle |
|---|---|
| `id` | minuscules, chiffres, tirets simples — `better-auth`, `github-actions`. Unique dans tout le registry. Doit être le nom du fichier. |
| `name` | libellé affiché, 1 à 60 caractères. Écrivez-le comme l'éditeur l'écrit : `Next.js`, `shadcn/ui`, `pnpm`. |
| `category` | une des catégories fermées (voir plus bas). |
| `targets` | au moins une plateforme, sans doublon : `web`, `mobile`, `desktop`, `api`, `library`. |
| `status` | `stable`, `beta` ou `deprecated`. Une technologie dépréciée reste utilisable mais affiche un avertissement. |
| `generation` | `certified` ou `declared`. Voir la section suivante — c'est le champ le plus important. |
| `license` | identifiant d'une liste fermée. |
| `lastReviewedAt` | date réelle `AAAA-MM-JJ`, jamais dans le futur. |

### Champs optionnels

| Champ | Règle |
|---|---|
| `versionRange` | contrainte semver, par exemple `>=15.0.0 <17.0.0`. |
| `requires` | identifiants de fiches **obligatoires** pour celle-ci. |
| `compatibleWith` | identifiants de fiches qui fonctionnent avec celle-ci. |
| `conflictsWith` | identifiants de fiches incompatibles avec celle-ci. |
| `packages` | noms de paquets npm à installer. |
| `env` | **noms** de variables d'environnement, en majuscules. |
| `recipes` | variantes d'usage : `oauth`, `migrate`, `webhooks`… |
| `template` | chemin du template. Uniquement si `generation` vaut `certified`. |
| `docs` | URL http(s) de la documentation officielle. |

### `env` ne contient jamais de valeur

```json
"env": ["DATABASE_URL"]                              ✓
"env": ["DATABASE_URL=postgres://user:pass@host/db"] ✗ rejeté
```

La grammaire des noms de variables interdit le signe `=`. Ce n'est pas une politesse : une fiche voyage dans les liens de partage en lecture seule, et le cahier des charges interdit qu'une valeur sensible soit stockée où que ce soit. La règle est tenue par la forme, pas par la vigilance.

---

## `certified` ou `declared` — la question centrale

C'est ce qui permet au catalogue d'être **large** sans jamais **mentir**.

| | `declared` | `certified` |
|---|---|---|
| Le produit connaît la technologie | oui | oui |
| Elle apparaît dans le catalogue | oui, marquée | oui |
| Un template existe | non | **oui, obligatoire** |
| Un test de génération la couvre | non | **oui, obligatoire** |
| L'utilisateur peut générer avec | non | oui |

**Écrivez `declared`.** C'est presque toujours la bonne réponse pour une nouvelle fiche.

Une fiche ne devient `certified` que le jour où un **test de génération** produit un projet qui la contient, l'installe et le construit. C'est `pnpm test:smoke`.

Un template n'est pas exigé. La règle initiale le demandait, et elle confondait deux choses : apporter du **code applicatif** et être couverte par un **test**. TypeScript, Biome et Vitest sont certifiés sans template — leur configuration vient de la couche d'intégration du générateur, pas d'un dossier de templates.

Une seule contrainte reste vérifiée par le schéma :

- `declared` **avec** `template` → rejeté. Si le template existe et qu'un test le couvre, la fiche doit être promue.

---

## Cohérence de l'ensemble

Une fiche peut être valide et le catalogue incohérent. Le chargeur vérifie aussi :

| Règle | Sévérité |
|---|---|
| Deux fiches ne partagent pas un `id` | erreur |
| Tout identifiant cité dans `requires`, `compatibleWith` ou `conflictsWith` désigne une fiche existante | erreur |
| Une fiche ne se cite pas elle-même | erreur |
| Un identifiant n'est pas à la fois dans `compatibleWith` et `conflictsWith` | erreur |
| Une dépendance `requires` couvre au moins une cible commune | erreur |
| `lastReviewedAt` date de moins d'un an | avertissement |

Une référence mal orthographiée déclenche une suggestion :

```
La fiche « next » cite « typescrpit » dans « requires », qui n'existe pas.
  Vouliez-vous dire « typescript » ?
```

**Ne déclarez pas de conflit entre deux fiches de la même catégorie.** Deux ORM sont évidemment exclusifs ; le moteur de compatibilité le déduit. `conflictsWith` sert aux incompatibilités qui traversent les catégories.

---

## Catégories

Liste fermée. Ajouter une catégorie est une décision d'architecture, pas une contribution de routine — ouvrez une discussion d'abord.

```
frontend · language · styling · ui · backend
database · orm · authentication · authorization
state · data-fetching · forms · validation · api
build · package-manager · monorepo
testing · linting · formatting · git-hooks
containers · dev-environment · ci-cd · hosting
storage · cache · queue · search
email · payments
observability · analytics · security
ai · cms · ecommerce
```

`dev-environment` (ajoutée le 26/09/2026, Phase 5B) est **cumulative** : un devcontainer s'ajoute à Docker, il ne le remplace pas. La ranger dans `containers`, exclusive, aurait rendu les deux incompatibles.

## Licences

Liste fermée également. Une licence mal orthographiée rend inutile l'alerte « incompatible avec un usage commercial » que le produit affiche à l'utilisateur.

```
MIT · Apache-2.0 · BSD-2-Clause · BSD-3-Clause · ISC
GPL-2.0 · GPL-3.0 · LGPL-3.0 · AGPL-3.0 · MPL-2.0 · EPL-2.0
BSL-1.1 · Elastic-2.0 · SSPL-1.0
Artistic-2.0 · PostgreSQL · Public-Domain · Unlicense
Proprietary
```

Si la licence de votre technologie n'y figure pas, ajoutez-la à `LICENSES` dans `src/schema/entry.ts` **dans la même contribution**, avec son identifiant SPDX exact. N'approximez jamais : `MIT` à la place de `BSL-1.1` est une information fausse dans un champ juridique.

---

## L'index engendré

`src/generated/entries.ts` embarque les fiches dans le paquet publié. Un paquet npm ne peut pas aller lire un dossier sur le disque après installation.

Il est **versionné**, et un test vérifie qu'il correspond à `data/`. Si vous modifiez un JSON sans régénérer, la construction échoue avec :

```
L'index du registry a dérivé de data/.
Relancez : pnpm --filter @project-factory/registry run build:index
```

Ne modifiez jamais ce fichier à la main. Il est exclu du formateur pour cette raison.

---

## Fraîcheur

Le catalogue est revu chaque trimestre. Quand vous vérifiez qu'une fiche est toujours exacte — version, licence, statut, documentation —, mettez `lastReviewedAt` à jour. Une fiche non revue depuis plus d'un an produit un avertissement au chargement, sans bloquer.

---

## Ce que la construction vérifie

`pnpm ci:local` échoue si :

- une fiche est malformée, avec le chemin exact et ce qu'il faut corriger
- une fiche `declared` porte un template
- une référence pointe vers une fiche inexistante
- deux fiches partagent un identifiant
- l'index engendré a dérivé de `data/`
- le catalogue réel ne charge pas

Le test qui charge les **vraies données** est celui qui attrape une faute de frappe. Toutes les règles ont beau être couvertes ailleurs, rien ne garantit que les données livrées les respectent.
