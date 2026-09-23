# Phase 3 — Registry : design

**Date :** 2026-09-23
**Phase roadmap :** 3 (Milestone M1)
**Sections couvertes :** §7 (catalogue), §11 (registry), §12 (amorce compatibilité), §24

---

## Objectif

Le registry est la base de connaissances du produit : ce que le catalogue sait des technologies. Il est **data-driven** — jamais codé en dur dans un écran (§11). Ajouter une technologie doit être une pull request sur un fichier JSON, pas une modification de code.

## Décisions

| Sujet | Décision |
|---|---|
| ORM par défaut des presets | Prisma (§8 amendé le 23/09/2026) |
| Largeur du catalogue | ~40 fiches `certifiée` + ~150 `déclarée` |
| Un fichier par fiche | `data/<catégorie>/<id>.json` — diffs lisibles, contribution par PR |
| Intégrité référentielle | vérifiée : une fiche ne peut pas citer un identifiant qui n'existe pas |

## Le distinguo certifiée / déclarée

C'est la décision structurante de la phase. Le catalogue doit être **large** (§7 en liste ~250) et **honnête** (§24 : « ne pas générer de combinaisons non testées »).

| `generation` | Signification | Visible | Générable | `template` |
|---|---|---|---|---|
| `certified` | template écrit, test de génération en CI | oui | oui | **obligatoire** |
| `declared` | connue du registry, aucun template | oui, marquée | non | **interdit** |

Les deux contraintes sur `template` sont vérifiées en CI. Une fiche `certified` sans template promet ce qui n'existe pas ; une fiche `declared` avec template ment dans l'autre sens. Les deux cassent la construction.

Une fiche passe de `declared` à `certified` le jour où son template et son test existent — preset par preset, pas par lot.

## Schéma d'une fiche

```
id              slug kebab-case, unique dans tout le registry   requis
name            libellé affiché, texte libre court              requis
category        énumération fermée                              requis
targets         ensemble non vide de Target (§4)                requis
status          stable | beta | deprecated                      requis
generation      certified | declared                             requis
license         identifiant SPDX                                requis
lastReviewedAt  date ISO, pas dans le futur                     requis
versionRange    plage semver                                    optionnel
requires        identifiants du registry                        optionnel
compatibleWith  identifiants du registry                        optionnel
conflictsWith   identifiants du registry                        optionnel
packages        noms de paquets npm                             optionnel
env             noms de variables — jamais de valeur (§24)       optionnel
recipes         identifiants de recettes                        optionnel
template        chemin de template — lié à `generation`          conditionnel
docs            URL de documentation                            optionnel
```

`name` est le seul champ à contenu libre, comme `name` dans le manifest. Les valeurs sensibles n'ont aucun endroit où se loger : `env` ne porte que des **noms** de variables.

## Intégrité référentielle

Une fiche isolée peut être valide et le registry incohérent. Les vérifications ne portent donc pas seulement sur chaque fiche, mais sur l'ensemble :

1. **Unicité** — deux fiches ne peuvent pas partager un `id`.
2. **Références résolues** — tout identifiant cité dans `requires`, `compatibleWith` ou `conflictsWith` désigne une fiche existante. C'est ce qui empêche le catalogue de pourrir silencieusement quand une entrée est renommée.
3. **Pas d'auto-référence** — une fiche ne se cite pas elle-même.
4. **Pas de contradiction** — un même identifiant ne peut pas figurer à la fois dans `compatibleWith` et `conflictsWith`.
5. **Cohérence de cible** — une dépendance `requires` doit couvrir au moins une des cibles de la fiche qui la requiert.
6. **Fraîcheur** — `lastReviewedAt` de plus d'un an produit un avertissement, pas une erreur (§7, revue trimestrielle).

## API publique

```
parseEntry(input: unknown): ParseResult<RegistryEntry>
loadRegistry(entries: unknown[]): ParseResult<Registry>
registry.get(id): RegistryEntry | undefined
registry.query({ category?, target?, generation?, status? }): RegistryEntry[]
registry.entries(): RegistryEntry[]
```

Même contrat d'erreur que `@project-factory/manifest` : code stable, chemin, message français, indice. Les codes du registry sont préfixés `REGISTRY_`.

`loadRegistry` valide chaque fiche **puis** l'intégrité de l'ensemble : une fiche invalide n'empêche pas de signaler les autres problèmes, l'utilisateur voit tout d'un coup.

## Organisation des données

```
packages/registry/
├── data/<catégorie>/<id>.json     source de vérité, éditable à la main
├── src/generated/entries.ts       index engendré, versionné
└── scripts/build-index.mjs        régénère l'index
```

L'index engendré est **versionné** et la CI vérifie qu'il n'a pas dérivé : si quelqu'un modifie un JSON sans régénérer, la construction échoue. Un index engendré mais non versionné imposerait un ordre de construction ; un index versionné mais non vérifié divergerait en silence.

## Stratégie de test

- Chaque règle de schéma : un test d'acceptation, au moins un de rejet.
- Chaque règle d'intégrité : un registry volontairement incohérent qui doit être rejeté.
- Les **vraies données** sont testées : `loadRegistry` sur le contenu réel de `data/` doit passer. C'est ce test qui attrape une faute de frappe dans une fiche.
- Assertions sur les **codes**, jamais sur les messages.

## Gate de sortie (M1)

- [ ] Une fiche malformée fait échouer la construction (test négatif)
- [ ] Une fiche `certified` sans `template` fait échouer la construction
- [ ] Une référence vers un identifiant inexistant fait échouer la construction
- [ ] Les données réelles de `data/` chargent sans erreur
- [ ] L'index engendré est à jour (détection de dérive)
- [ ] Le registry ne connaît aucune technologie hors périmètre web MVP
- [ ] Couverture ≥ 90 %

## Hors périmètre

- Les règles de compatibilité (→ Phase 4). Le registry **déclare** `compatibleWith` ; il ne raisonne pas dessus.
- Les templates eux-mêmes (→ Phase 6).
- Le registry communautaire et sa modération (→ V2).
