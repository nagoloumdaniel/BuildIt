# Phase 2 — Project Manifest : design

**Date :** 2026-09-23
**Phase roadmap :** 2 (Milestone M1)
**Sections du cahier des charges couvertes :** §9 (façades UI/CLI), §10 (Project Manifest), §20 (partage), §22 (Schema Validation), §24

---

## Objectif

Le Project Manifest est le contrat entre l'UI et le CLI (§9) : les deux façades le produisent, un seul pipeline le consomme. Tout le moteur en dépend. Il se fige avant le registry, avant le compatibility engine, avant le generator.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Bibliothèque de validation | **Zod** | Meilleure introspection d'erreurs (chemin + code), et les presets générés embarquent déjà Zod (§8) — on mange notre propre cuisine |
| Portée du schéma | **§10 complet dès maintenant**, champs optionnels | Le contrat est la chose coûteuse à faire bouger. Typer `mobile` et `backend` aujourd'hui évite une migration garantie dans six semaines, et évite d'invalider les liens de partage (§20) déjà émis |
| Langue des messages | **Français** | Décision produit assumée |
| Modèle d'erreur | **code stable + chemin + message + indice** | Le code survit à une reformulation ; le CLI et l'UI rendent le même objet différemment |

### Conséquence du choix de langue

Le modèle d'erreur retenu rend la langue **purement présentationnelle**. Les codes sont la donnée, les messages vivent dans un catalogue unique indexé par code (`errors.ts`). Livrer l'anglais plus tard coûtera un fichier, pas une réécriture. Ce n'est pas une réserve sur la décision : c'est la façon de la tenir sans se fermer de porte.

---

## L'idée structurante : forme contre identité

```
manifest        « frontend.framework est un slug kebab-case »   <- Phase 2
registry        « le slug "next" existe et vaut Next.js »       <- Phase 3
compatibility   « "next" va avec "drizzle" en version >= 15 »   <- Phase 4
```

Le schéma du manifest ne connaît **aucun nom de technologie**. S'il en connaissait, ajouter une entrée au catalogue (§7 en liste ~250) obligerait à modifier le contrat — et à faire migrer tous les manifests existants pour une raison qui n'a rien à voir avec leur structure.

Seules les énumérations **fermées par nature** vivent dans le schéma :

- `targets` — web, mobile, desktop, api, library (§4)
- `architecture` — single-app, monorepo, modular-monolith, microservices, serverless, event-driven (§7.23)

Tout le reste est un slug opaque, validé sur sa forme uniquement.

## Le manifest ne peut pas porter de secret

Le manifest est sérialisé dans le lien de partage en lecture seule (§20). §24 exige qu'aucune valeur sensible ne soit stockée. Plutôt que d'ajouter un filtre — qu'on oublierait d'appliquer quelque part — la garantie est structurelle :

**Aucun champ du manifest n'est du texte libre.** Tout est énumération fermée, booléen, ou slug kebab-case. Le seul champ à contenu choisi par l'utilisateur est `name`, contraint par la grammaire des noms de paquets npm.

Il n'y a pas de champ `env` : les variables d'environnement requises sont **dérivées** des fiches du registry (§11 porte `"env": ["BETTER_AUTH_SECRET"]`), au moment de la résolution. L'écran Environment & Secrets (§6.8) les affiche sans que le manifest ne les stocke jamais.

---

## Schéma

```
manifestVersion   1                                        requis
name              nom de paquet npm valide                 requis
targets           ensemble non vide de Target              requis
architecture      Architecture                             requis
apps              ensemble de slugs                        optionnel
frontend          { framework, language, styling?, ui? }   optionnel
mobile            { framework, language, styling? }        optionnel
desktop           { framework }                            optionnel
backend           { framework, language? }                 optionnel
database          { engine, orm? }                         optionnel
auth              { provider }                             optionnel
services          ensemble de slugs                        optionnel
quality           ensemble de slugs                        optionnel
infra             ensemble de slugs                        optionnel
shareLink         { enabled, readOnly }                    optionnel
```

Le schéma est **strict** : une clé inconnue est une erreur, pas un champ ignoré. Une faute de frappe dans un manifest écrit à la main doit se voir. Les manifests écrits par une version plus récente sont interceptés en amont par le contrôle de version, donc la strictitude ne coûte aucune compatibilité ascendante.

### Grammaires

| Type | Règle |
|---|---|
| Nom de projet | 1 à 214 caractères, minuscules, `a-z0-9-._`, ne commence ni par `.` ni par `_` |
| Slug de technologie | `^[a-z0-9]+(-[a-z0-9]+)*$` |
| Ensemble | tableau sans doublon ; les doublons sont une erreur, pas une déduplication silencieuse |

---

## API publique

```
parseManifest(input: unknown): ParseResult
migrateManifest(input: unknown): ParseResult
serializeManifest(manifest: Manifest): string
```

`parseManifest` **ne lève jamais**. Elle renvoie une union discriminée :

```
{ ok: true,  manifest: Manifest }
{ ok: false, issues: ManifestIssue[] }
```

Une exception oblige chaque appelant à un `try/catch` et fait perdre le type des erreurs. Le CLI affiche une liste, l'UI surligne des champs : même objet, deux rendus.

### ManifestIssue

```
{
  code:    ManifestIssueCode    // stable, testable, indépendant de la langue
  path:    (string | number)[]  // ['frontend', 'framework'] ou ['targets', 0]
  message: string               // français, depuis le catalogue
  hint?:   string               // « Vouliez-vous dire "web" ? »
}
```

L'indice est calculé par distance d'édition sur les valeurs d'une énumération fermée. §12 exige que le produit explique *pourquoi* plutôt que de refuser sèchement ; ça commence à la validation.

### Codes d'erreur

```
MANIFEST_NOT_AN_OBJECT
MANIFEST_VERSION_MISSING
MANIFEST_VERSION_UNSUPPORTED
MANIFEST_FIELD_REQUIRED
MANIFEST_UNKNOWN_FIELD
MANIFEST_TYPE_MISMATCH
MANIFEST_NAME_INVALID
MANIFEST_TARGETS_EMPTY
MANIFEST_ENUM_UNKNOWN
MANIFEST_SLUG_INVALID
MANIFEST_DUPLICATE_ENTRY
```

---

## Sérialisation canonique

`serializeManifest` produit toujours la même chaîne pour un même contenu :

1. Les clés d'objet suivent un **ordre canonique déclaré**, pas l'ordre d'insertion ni l'ordre alphabétique — un manifest posé dans un dépôt généré doit rester lisible par un humain.
2. Les tableaux de slugs sont **triés alphabétiquement** : ce sont des ensembles, leur ordre ne porte pas de sens.
3. Indentation de deux espaces, saut de ligne final.

Cette propriété n'est pas cosmétique : c'est elle qui rend vérifiable la promesse du gate de la Phase 7 — mêmes choix dans l'UI et dans le CLI ⇒ manifest identique **octet pour octet**. Sans ordre stable, cette promesse est invérifiable et donc sans valeur.

## Migration

```
migrateManifest(input) -> lit manifestVersion
                       -> applique la chaîne de migrations jusqu'à MANIFEST_VERSION
                       -> parse le résultat
```

Il n'existe aujourd'hui qu'une seule version : la chaîne de migrations est **vide**. Le mécanisme est néanmoins livré et testé, avec une migration factice injectée dans les tests. La V1 ajoutera mobile et desktop au périmètre (§23) ; ce jour-là on branche une migration, on n'invente pas la machinerie dans l'urgence, sur un format déjà diffusé par des liens de partage.

---

## Fichiers

```
packages/manifest/src/
├── version.ts          MANIFEST_VERSION, isSupportedManifestVersion   (existe)
├── errors.ts           codes + catalogue de messages + calcul d'indice
├── result.ts           ParseResult, ok(), fail()
├── schema/
│   ├── primitives.ts   nom de projet, slug, ensemble sans doublon
│   ├── enums.ts        Target, Architecture
│   └── manifest.ts     assemblage §10
├── parse.ts            parseManifest + traduction ZodError -> ManifestIssue[]
├── serialize.ts        sérialisation canonique
├── migrate.ts          chaîne de migrations
└── index.ts            surface publique
```

`parse.ts` est le seul fichier qui connaît Zod en dehors de `schema/`. Changer de bibliothèque de validation un jour toucherait `schema/` et `parse.ts`, jamais l'API publique ni les appelants.

## Stratégie de test

- Chaque champ a **au moins un test de rejet**, pas seulement un test d'acceptation.
- Le manifest exemple du §10 est une fixture et doit valider **sans modification**.
- Propriété de round-trip : `parse → serialize → parse` donne le même manifest.
- Propriété de stabilité : deux objets au contenu identique mais aux clés et tableaux dans un ordre différent produisent la **même** chaîne.
- Les assertions portent sur les **codes**, jamais sur les messages — sinon reformuler une phrase casse la suite de tests.

## Gate de sortie (M1, partie manifest)

- [ ] Le manifest exemple du §10 valide sans modification
- [ ] Chaque champ possède un test de rejet
- [ ] Aucun champ n'accepte du texte libre hors `name` (vérifié par relecture du schéma, tracé ici)
- [ ] Round-trip idempotent, sérialisation stable quel que soit l'ordre d'entrée
- [ ] `parseManifest` ne lève jamais, y compris sur `null`, `undefined`, une chaîne, un tableau
- [ ] Couverture ≥ 90 % sur le paquet

## Hors périmètre

- Toute connaissance de noms de technologies (→ Phase 3, registry)
- Toute règle de compatibilité (→ Phase 4)
- Le paquet `validation` séparé de la roadmap : le catalogue de messages vit dans `manifest` tant qu'il n'a qu'un seul client. Il sera extrait quand le registry aura ses propres erreurs (Phase 3).
