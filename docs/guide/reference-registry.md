# Référence du registry

Le **registry** est la base de connaissances du produit : ce que BuildIt
sait des technologies. Il ne raisonne pas il **déclare**. Décider si deux
technologies vont ensemble est le travail du compatibility engine
([§12](../cahier-des-charges.md), et [Concepts](concepts.md)).

Sources qui font foi :

- [`packages/registry/src/schema/entry.ts`](../../packages/registry/src/schema/entry.ts) la forme d'une fiche, les catégories, les licences ;
- [`packages/registry/src/load.ts`](../../packages/registry/src/load.ts) le chargement et la validation ;
- [`packages/registry/src/integrity.ts`](../../packages/registry/src/integrity.ts) la cohérence de l'ensemble ;
- [`packages/registry/data/`](../../packages/registry/data) les fiches, éditées à la main ;
- [`packages/registry/CONTRIBUTING.md`](../../packages/registry/CONTRIBUTING.md) comment en ajouter une (la procédure qui fait foi).

## Le catalogue en chiffres

| | |
|---|---|
| Fiches | **283** (`data/**/*.entry.json`) |
| Catégories | **37** (liste fermée) |
| Licences | **19** (liste fermée) |
| Index engendré | [`src/generated/entries.ts`](../../packages/registry/src/generated/entries.ts), versionné, vérifié par un test |

```text
$ (Get-ChildItem packages/registry/data -Recurse -Filter *.entry.json -File).Count
283
$ node packages/registry/scripts/build-index.mjs --check     # aucun écart avec data/
```

L'index doit correspondre à `data/` : le test
[`catalogue.test.ts`](../../packages/registry/src/catalogue.test.ts) exécute ce
`--check`, donc un JSON modifié sans régénérer l'index fait échouer la CI.

> Note de maintenance : [PROJECT_CONTEXT.md](../../PROJECT_CONTEXT.md) porte
> encore « 282 fiches » à deux endroits. Le compte vérifié ci-dessus est **283**
> (fichiers `data/` et entrées de l'index engendré).

## Les catégories

Liste **fermée** : ajouter une catégorie est une décision d'architecture, pas une
contribution de routine.

```text
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

Une catégorie ne dit pas seulement « de quoi il s'agit », elle porte une
**arité** combien de technologies peuvent coexister. Cette arité vit dans le
moteur de compatibilité, pas sur les fiches :
[`arity.ts`](../../packages/compatibility/src/arity.ts). `testing` est
cumulative (Vitest *et* Playwright dans le preset SaaS), `orm` est exclusive.

## Anatomie d'une fiche

Exemple réel, une fiche **certifiée** :

```json
{
  "id": "shadcn-ui",
  "name": "shadcn/ui",
  "category": "ui",
  "targets": ["web"],
  "status": "stable",
  "generation": "certified",
  "template": "ui/shadcn-ui",
  "license": "MIT",
  "lastReviewedAt": "2026-09-23",
  "requires": ["tailwind"],
  "compatibleWith": ["next", "react-hook-form"],
  "packages": ["class-variance-authority", "clsx", "tailwind-merge"],
  "packageRanges": {
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^3.0.0"
  },
  "docs": "https://ui.shadcn.com"
}
```

Exemple réel, une fiche **déclarée** (le catalogue la connaît, rien ne la génère
encore) :

```json
{
  "id": "openai",
  "name": "OpenAI",
  "category": "ai",
  "targets": ["web", "api"],
  "status": "stable",
  "generation": "declared",
  "license": "Proprietary",
  "lastReviewedAt": "2026-09-23",
  "docs": "https://platform.openai.com/docs"
}
```

| Champ | Requis | Rôle |
|---|---|---|
| `id` | oui | Slug unique dans tout le catalogue, égal au nom du fichier |
| `name` | oui | Libellé affiché, 1 à 60 caractères, écrit comme l'éditeur l'écrit |
| `category` | oui | Une des 37 catégories fermées |
| `targets` | oui | Plateformes servies, non vide et sans doublon |
| `status` | oui | `stable`, `beta`, `deprecated` dépréciée reste utilisable, avec avertissement |
| `generation` | oui | `certified` (un test de génération la couvre) ou `declared` |
| `license` | oui | Identifiant d'une des 19 licences fermées |
| `lastReviewedAt` | oui | Date réelle, jamais dans le futur ; au-delà d'un an, avertissement |
| `versionRange` | non | Contrainte semver, par exemple `>=15.0.0 <17.0.0` |
| `requires` | non | Fiches **obligatoires** : le moteur les ajoute et le dit |
| `compatibleWith` | non | Fiches qui fonctionnent avec celle-ci |
| `conflictsWith` | non | Fiches incompatibles pour les conflits qui **traversent** les catégories |
| `packages` / `devPackages` | non | Paquets npm de production / de développement, disjoints |
| `packageRanges` | non | Plage par paquet ; un paquet non déclaré n'a pas de plage |
| `env` | non | **Noms** de variables d'environnement, jamais de valeur |
| `recipes` | non | Variantes d'usage **déclarées** par la fiche (`oauth`, `webhooks`, `migrate`…). À ne pas confondre avec les recettes du générateur ([`packages/recipes`](../../packages/recipes)), qui portent des fichiers : ce champ n'est pas consommé par le pipeline aujourd'hui |
| `engines` | non | Contraintes de runtime (`node`, `bun`, `deno`) |
| `template` | non | Chemin du template **uniquement** si `generation` vaut `certified` |
| `docs` | non | URL http(s) de la documentation officielle |

Trois contraintes croisées sont portées par le schéma, donc impossibles à
écrire :

- une fiche `declared` **ne peut pas** porter de `template` (elle promettrait ce
  qui n'existe pas) ;
- un paquet ne peut pas être à la fois dans `packages` et `devPackages` (le
  générateur ne saurait pas dans quelle section l'écrire) ;
- une `packageRanges` orpheline est refusée (soit le paquet a été renommé, soit
  il manque à la liste).

En revanche, une fiche `certified` **peut** n'avoir aucun template : TypeScript,
Biome et Vitest n'apportent aucun fichier d'application leur configuration vient
de la couche d'intégration mais ils doivent être certifiés pour que la
combinaison qui les contient le soit.

## Ce que le chargement vérifie

Deux étapes, dans cet ordre : **chaque fiche sur sa forme**, puis **l'ensemble sur
sa cohérence**. L'ordre compte : contrôler les références croisées d'un catalogue
dont une fiche est malformée produirait des erreurs en cascade qui masqueraient la
vraie cause.

| Contrôle | Sévérité | Code |
|---|---|---|
| Deux fiches partagent un `id` | erreur | `REGISTRY_DUPLICATE_ID` |
| Un identifiant cité n'existe pas | erreur | `REGISTRY_UNKNOWN_REFERENCE` (avec suggestion) |
| Une fiche se cite elle-même | erreur | `REGISTRY_SELF_REFERENCE` |
| Un identifiant est à la fois compatible et en conflit | erreur | `REGISTRY_CONTRADICTORY_RELATION` |
| Un `requires` ne couvre aucune cible commune | erreur | `REGISTRY_TARGET_MISMATCH` |
| Fiche non revue depuis plus d'un an | avertissement | `REGISTRY_STALE_ENTRY` |

Une **erreur bloque le chargement** : le catalogue ne se charge pas « à moitié ».
Les avertissements sont rendus avec le catalogue, et remontent jusqu'à
l'utilisateur.

## Ce que le registry ne fait pas

| Question | Qui y répond |
|---|---|
| Ce slug existe-t-il ? Quelle est sa catégorie ? | **le registry** |
| Ces deux technologies vont-elles ensemble ? | le **compatibility engine** |
| Cette combinaison est-elle certifiée ? | le **compatibility engine** le statut se déduit de `generation` sur chaque fiche de la sélection |
| Cette technologie est-elle compatible avec mes versions ? | `engines` (déclaré) puis `checkEngines` (décidé) |

Un fichier de fiche ne contient **jamais** de règle de combinaison : c'est ce qui
permet d'ajouter une technologie au catalogue sans toucher au moteur.
