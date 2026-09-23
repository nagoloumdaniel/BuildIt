# Phase 4 — Compatibility Engine : design

**Date :** 2026-09-23
**Phase roadmap :** 4 (Milestone M2)
**Sections couvertes :** §5, §11 (licences), §12, §22 (Stack Resolver), §24

---

## Objectif

Le registry **déclare** des relations. Le compatibility engine **raisonne** dessus : il complète une sélection partielle, détecte les incohérences, et surtout — il explique. §12 exige des « warnings et erreurs avec justification » ; §5 exige qu'une option indisponible soit grisée **avec une info-bulle disant pourquoi**, pas simplement masquée.

C'est le différenciant du produit (§25) et la phase la plus dense en logique du projet.

## Décisions

| Sujet | Décision |
|---|---|
| Résolution | Le moteur **complète** la sélection et **affiche ce qu'il a ajouté**, avec la raison |
| Combinaison non testée | **Avertit et demande confirmation**, ne bloque pas |
| Combinaison certifiée | **Déduite** : toutes ses fiches sont `certified`. Une table de combinaisons serait impossible à maintenir |
| Arité des catégories | Dans le code du moteur, pas dans les 282 fiches |
| Contraintes de version | Champ `engines` sur la fiche. `peerRanges` reporté — aucune fiche n'en a besoin aujourd'hui |
| Bibliothèque semver | `semver` (npm). Réimplémenter l'analyse de plages est une erreur classique |

---

## L'arité des catégories

Hypothèse initiale, **fausse** : « une seule technologie par catégorie, donc deux fiches de la même catégorie s'excluent ».

`vitest`, `playwright` et `testing-library` sont toutes trois dans `testing` et cohabitent parfaitement. Idem pour `sentry` + `opentelemetry`, ou `redis` + `s3`.

Chaque catégorie porte donc une arité :

**Exclusive** — un seul choix : `frontend`, `language`, `styling`, `ui`, `backend`, `database`, `orm`, `authentication`, `build`, `package-manager`, `monorepo`, `linting`, `formatting`, `containers`, `ci-cd`, `hosting`, `email`, `payments`, `cms`, `ecommerce`

**Cumulative** — plusieurs possibles : `testing`, `security`, `observability`, `analytics`, `ai`, `storage`, `cache`, `queue`, `search`, `state`, `data-fetching`, `forms`, `validation`, `api`, `git-hooks`, `authorization`

L'arité vit dans le code du moteur : c'est une propriété de la catégorie, invariante, pas une donnée par fiche. La mettre dans les 282 fiches serait 282 occasions de se tromper.

---

## API publique

```
resolve(selection, registry)          -> Resolution | échec
optionsFor(category, selection, reg)  -> Option[]
```

### `resolve`

```
Selection {
  targets: Target[]
  technologies: string[]        // identifiants choisis par l'utilisateur
}

Resolution {
  technologies: string[]        // choisies + ajoutées, triées
  additions: Addition[]         // ce qui a été ajouté, et par quoi
  status: 'certified' | 'experimental'
  warnings: CompatibilityIssue[]
}

Addition { id: string, requiredBy: string }
```

La résolution suit les `requires` de façon transitive, en détectant les cycles. Chaque ajout est tracé : l'utilisateur voit `+ typescript (requis par better-auth)` et peut décider de reculer.

### `optionsFor` — le cœur du §5

```
Option {
  entry: RegistryEntry
  state: 'selected' | 'available' | 'blocked'
  reason?: string          // pourquoi bloquée, en français
}
```

C'est la fonction qui alimente la liste grisée avec info-bulle de l'écran Stack Builder. Elle ne renvoie **jamais** une liste filtrée : une option incompatible reste visible, marquée, expliquée. Masquer une option laisse l'utilisateur croire qu'elle n'existe pas ; la griser en disant pourquoi lui apprend quelque chose.

---

## Erreurs bloquantes

| Code | Situation |
|---|---|
| `COMPAT_UNKNOWN_TECHNOLOGY` | identifiant absent du registry |
| `COMPAT_EXCLUSIVE_CATEGORY` | deux technologies dans une catégorie exclusive |
| `COMPAT_DECLARED_CONFLICT` | conflit déclaré par une fiche |
| `COMPAT_TARGET_UNSUPPORTED` | la technologie ne couvre aucune cible sélectionnée |
| `COMPAT_CIRCULAR_DEPENDENCY` | cycle dans les `requires` |
| `COMPAT_ENGINE_UNSATISFIABLE` | deux technologies exigent des versions de runtime incompatibles |
| `COMPAT_NO_TARGET` | aucune cible sélectionnée |

## Avertissements

| Code | Situation |
|---|---|
| `COMPAT_EXPERIMENTAL_COMBINATION` | au moins une technologie n'est pas `certified` |
| `COMPAT_DEPRECATED_TECHNOLOGY` | une technologie est `deprecated` (§7) |
| `COMPAT_RESTRICTIVE_LICENSE` | licence à contrainte de redistribution — AGPL, SSPL, BSL, Elastic (§11) |

L'alerte de licence est une exigence explicite du §11 : « licence affichée à l'utilisateur, alerte si incompatible avec un usage commercial ». Elle est rendue possible par la liste fermée de licences du registry — une licence approximée la rendrait inutile.

---

## Contraintes de version

Nouveau champ optionnel sur la fiche :

```json
"engines": { "node": ">=18.18.0" }
```

La vérification n'est pas « telle version satisfait telle plage » mais **« ces plages ont-elles une intersection »**. Si une technologie exige `node >=20` et une autre `node <18`, aucune version ne convient et la combinaison est impossible — quelles que soient les versions installées. `semver.intersects` répond exactement à cette question.

---

## Fichiers

```
packages/compatibility/src/
├── arity.ts       arité des catégories
├── errors.ts      codes + catalogue de messages
├── resolve.ts     résolution transitive, détection de cycles
├── rules.ts       les règles du §12, une fonction par règle
├── options.ts     optionsFor — alimente le §5
└── index.ts
```

Une fonction par règle dans `rules.ts` : §12 en liste huit, et chacune doit pouvoir être testée, lue et corrigée isolément. Un gros `validate()` qui les enchaîne rendrait chaque correction risquée.

## Stratégie de test

- **Chaque règle du §12 a un test positif et un test négatif.** C'est la ligne la plus explicite de ma roadmap pour cette phase.
- Les assertions portent sur les codes, jamais sur les messages.
- Toute erreur bloquante porte une raison lisible : un test vérifie qu'aucune n'a de message vide.
- La résolution est testée sur le **catalogue réel**, pas seulement des fixtures.

## Gate M2

- [ ] Couverture ≥ 90 % sur le paquet
- [ ] Chaque règle du §12 a son test positif et son test négatif
- [ ] Toute incompatibilité renvoie une raison en français, jamais un booléen nu
- [ ] Une combinaison non certifiée est marquée `experimental` automatiquement
- [ ] `resolve` ne lève jamais, y compris sur un cycle ou un identifiant inconnu
- [ ] `optionsFor` ne masque jamais une option — elle la marque

## Hors périmètre

- `peerRanges` entre technologies (aucun besoin réel aujourd'hui)
- Le choix d'architecture (single-app, monorepo…) — il n'entre pas dans les règles de compatibilité tant que le générateur n'existe pas
- La résolution des versions npm exactes (→ Phase 5, Dependency Resolver)
