# Référence du manifest

Le **Project Manifest** est l'objet d'entrée du moteur : l'UI et le CLI le
produisent, le pipeline le consomme. C'est du JSON, versionné, et il valide la
**forme** — pas l'identité des technologies, ni leur compatibilité (voir
[Concepts](concepts.md), « forme, identité, combinaison »).

Sources qui font foi :

- [`packages/manifest/src/schema/manifest.ts`](../../packages/manifest/src/schema/manifest.ts) — les champs ;
- [`packages/manifest/src/schema/enums.ts`](../../packages/manifest/src/schema/enums.ts) — `targets`, `architecture` ;
- [`packages/manifest/src/schema/primitives.ts`](../../packages/manifest/src/schema/primitives.ts) — grammaire du nom, des slugs, unicité ;
- [`packages/manifest/src/errors.ts`](../../packages/manifest/src/errors.ts) — codes et messages ;
- [`packages/manifest/src/serialize.ts`](../../packages/manifest/src/serialize.ts) — forme canonique.

## Un manifest minimal

```json
{
  "manifestVersion": 1,
  "name": "sans-base",
  "targets": ["web"],
  "architecture": "single-app",
  "frontend": { "framework": "next", "language": "typescript" }
}
```

```text
$ pnpm pf graph sans-base.json
sans-base — 2 technologies, stack certifiée

  ✓ frontend         Next.js (next)
  ✓ language         TypeScript (typescript)
```

## Les champs

| Champ | Requis | Forme | Ce que le moteur en fait |
|---|---|---|---|
| `manifestVersion` | oui | littéral `1` | Un manifest d'une autre version est refusé **avant** le schéma, avec un seul message (`MANIFEST_VERSION_UNSUPPORTED`) plutôt qu'une avalanche de champs |
| `name` | oui | nom de paquet npm : minuscules, chiffres, `-`, `.`, `_`, sans commencer par `.` ni `_`, 214 caractères au plus | Nom du paquet généré et du dossier par défaut. **Seul champ à contenu libre** |
| `targets` | oui | tableau **non vide** et sans doublon de `web`, `mobile`, `desktop`, `api`, `library` | Chaque technologie choisie doit couvrir au moins une de ces plateformes |
| `architecture` | oui | `single-app`, `monorepo`, `modular-monolith`, `microservices`, `serverless`, `event-driven` | `monorepo` déclenche le générateur multi-applications |
| `apps` | non | tableau de slugs, sans doublon | Réservé : le générateur partitionne aujourd'hui par rôles, ce champ n'est pas encore consommé |
| `frontend` | non | `{ framework, language, styling?, ui? }` | `framework` et `language` sont **obligatoires dès que l'objet existe** |
| `mobile` | non | `{ framework, language, styling? }` | idem |
| `desktop` | non | `{ framework }` | idem |
| `backend` | non | `{ framework, language? }` | `framework` obligatoire si l'objet existe |
| `database` | non | `{ engine, orm? }` | `engine` obligatoire si l'objet existe — un ORM seul est refusé |
| `auth` | non | `{ provider }` | `provider` obligatoire si l'objet existe |
| `services` | non | tableau de slugs, sans doublon | Capacités et services : paiement, email, cache, observabilité… |
| `quality` | non | tableau de slugs, sans doublon | Outils de qualité : lint, format, tests, hooks Git |
| `infra` | non | tableau de slugs, sans doublon | Docker, CI/CD, hébergement, monorepo, gestionnaire de paquets |
| `shareLink` | non | `{ enabled, readOnly }` | Une **intention** de partage en lecture seule (§20) : jamais un jeton, jamais une URL |

Tous les objets sont **stricts** : une clé inconnue est une erreur, pas un champ
ignoré. C'est ce qui fait qu'une faute de frappe se voit :

```text
$ pnpm pf graph invalide-champ.json          # { … , "type": "saas", … }
✗ Le champ « type » n'existe pas dans un manifest. Vérifiez l'orthographe.
  (MANIFEST_UNKNOWN_FIELD)                            # code de sortie 1
```

## Énumérations et grammaires

```text
$ pnpm pf graph invalide-valeurs.json        # targets: ["website"], architecture: "micro-services"
✗ Valeur inconnue : « website ». Valeurs acceptées : web, mobile, desktop, api, library.
  (MANIFEST_ENUM_UNKNOWN)
✗ Valeur inconnue : « micro-services ». Valeurs acceptées : single-app, monorepo, modular-monolith, microservices,
  serverless, event-driven.
  → Vouliez-vous dire « microservices » ?
  (MANIFEST_ENUM_UNKNOWN)
```

Un slug de technologie suit `^[a-z0-9]+(?:-[a-z0-9]+)*$` : minuscules et
chiffres séparés par des tirets simples. Un tableau ne peut pas contenir deux
fois la même valeur — un doublon n'est pas dédupliqué en silence : il révèle
presque toujours une façade qui ajoute deux fois la même capacité.

## Forme canonique

`parseManifest` **normalise** avant de rendre la main :

- les ensembles (`targets`, `apps`, `services`, `quality`, `infra`) sont **triés** ;
- les clés suivent un ordre déclaré (`MANIFEST_KEY_ORDER`) :
  `manifestVersion`, `name`, `targets`, `architecture`, `apps`, `frontend`,
  `mobile`, `desktop`, `backend`, `database`, `auth`, `services`, `quality`,
  `infra`, `shareLink` ;
- les champs absents sont retirés (pas de `"quality": []`) ;
- l'ordre des clés imbriquées est fixe (`framework`, `language`, `styling`, `ui`…).

Conséquence directe : **les mêmes choix donnent la même chaîne**, octet pour
octet, quelle que soit la façade et quel que soit l'ordre des clics.
`serializeManifest` applique la même forme, avec une indentation de deux espaces
et un saut de ligne final — le fichier est destiné à être relu par des humains et
posé dans un dépôt.

## Version et migrations

Il n'existe aujourd'hui qu'une version : `MANIFEST_VERSION = 1`. Le mécanisme de
migration est néanmoins livré et testé
([`migrate.ts`](../../packages/manifest/src/migrate.ts)) : `MIGRATIONS` est vide,
et `migrateManifest` applique la chaîne puis valide le résultat. Le jour où une
v2 existera, des manifests v1 circuleront déjà dans des liens de partage — la
machinerie ne sera pas inventée sous contrainte.

## Les codes de refus

Un manifest refusé produit une **liste** de problèmes, chacun avec un code stable
et un message :

| Code | Ce qu'il dit |
|---|---|
| `MANIFEST_NOT_AN_OBJECT` | Ce n'est pas un objet JSON |
| `MANIFEST_VERSION_MISSING` | Pas de `manifestVersion` : le manifest ne vient pas de BuildIt |
| `MANIFEST_VERSION_UNSUPPORTED` | Version non prise en charge |
| `MANIFEST_FIELD_REQUIRED` | Un champ obligatoire manque |
| `MANIFEST_UNKNOWN_FIELD` | Un champ n'existe pas au §10 |
| `MANIFEST_TYPE_MISMATCH` | Mauvais type |
| `MANIFEST_NAME_INVALID` | Nom de projet invalide |
| `MANIFEST_TARGETS_EMPTY` | Aucune cible sélectionnée |
| `MANIFEST_ENUM_UNKNOWN` | Valeur hors d'une énumération fermée (avec suggestion si proche) |
| `MANIFEST_SLUG_INVALID` | Identifiant de technologie mal formé |
| `MANIFEST_DUPLICATE_ENTRY` | Valeur répétée dans un ensemble |

## Ce que le manifest ne valide pas

| Question | Qui la tranche |
|---|---|
| « Ce slug existe-t-il au catalogue ? » | le **registry** (`pf add auth` → « Technologie inconnue ») |
| « Ces technologies vont-elles ensemble ? » | le **compatibility engine** (deux ORM → refus, `Drizzle` → déclarée) |

Un manifest peut donc être **valide et ingénérable** : c'est voulu — le manifest
décrit une intention, le moteur dit si elle tient. Voir
[Référence du registry](reference-registry.md) pour le détail du partage.
