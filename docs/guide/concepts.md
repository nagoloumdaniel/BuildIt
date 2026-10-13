# Concepts

BuildIt tient en une phrase : **décrire un projet, choisir ses
plateformes et ses technologies, obtenir un projet prêt à développer**. Ce qui
suit explique comment, et surtout *qui décide quoi* — c'est la partie qu'on ne
peut pas deviner en lisant une sortie de commande.

## Un seul chemin, deux façades

```text
      UI ──┐
           ├──► Project Manifest ──► parseManifest : forme + forme canonique
      CLI ─┘                                    │
                                                ▼
                     resolve : registry (identité) + compatibility (combinaison,
                     ajouts exigés, statut certifié/déclaré)
                                                │
                          Recettes ──► Templates ──► File Plan
                                                │
                                  Dry-run ◄─────┤
                                                ▼
                              Generator (écriture, rollback)
                                                │
                        Post-install (install, Git) ──► Validation
```

Le CLI et l'interface web produisent le **même objet** — un Project Manifest —
et le passent au **même pipeline**. C'est ce qui rend vérifiable la promesse
« mêmes choix ⇒ même projet », et c'est testé des deux côtés :

- côté CLI : `apps/cli/src/commands/create.test.ts` compare, pour chaque preset,
  l'arborescence produite par `pf create` à celle du moteur appelé directement
  (« preset %s : octet pour octet identique au moteur appelé directement ») ;
- côté UI : `apps/web/src/lib/draft-to-manifest.test.ts` compare la
  sérialisation du manifest produit par le brouillon à celle du preset SaaS,
  octet pour octet.

Le schéma ci-dessus est le pipeline **livré**. Le [§22 du cahier des
charges](../cahier-des-charges.md) décrit la cible complète, qui ajoute
l'analyse de projet, le Project Doctor, la couche GitHub et le déploiement.

## La frontière qui structure tout : forme, identité, combinaison

Trois questions différentes, trois paquets différents — et aucun ne fait le
travail d'un autre.

| Question | Qui répond | Où |
|---|---|---|
| Est-ce que ce manifest a la **bonne forme** ? | `packages/manifest` | [`parse.ts`](../../packages/manifest/src/parse.ts), [`schema/manifest.ts`](../../packages/manifest/src/schema/manifest.ts) |
| Est-ce que ce **slug existe** au catalogue, et qu'est-ce que c'est ? | `packages/registry` | [`schema/entry.ts`](../../packages/registry/src/schema/entry.ts), [`load.ts`](../../packages/registry/src/load.ts) |
| Est-ce que ces technologies **vont ensemble**, pour ces cibles ? | `packages/compatibility` | [`rules.ts`](../../packages/compatibility/src/rules.ts), [`resolve.ts`](../../packages/compatibility/src/resolve.ts) |

Concrètement, chaque refus vient de la bonne couche — vérifié :

```text
$ pnpm pf graph manifest-avec-un-champ-inconnu.json
✗ Le champ « type » n'existe pas dans un manifest. Vérifiez l'orthographe.
  (MANIFEST_UNKNOWN_FIELD)                                     # forme

$ pnpm pf add auth
✗ Technologie inconnue : « auth ».
  → Vouliez-vous dire « auth0 » ?                              # identité

$ pnpm pf add drizzle --manifest pf.manifest.json --yes
+ Drizzle → database.orm (remplace prisma)
```

Cette séparation n'est pas une élégance gratuite : elle est ce qui permet à un
manifest d'être **partagé** (un lien, §20) sans être un vecteur de secrets, et à
une catégorie d'être ajoutée au catalogue sans migrer les manifests existants.

## Le Project Manifest

Le manifest est le contrat d'entrée du moteur. Il décrit **ce qu'on veut**, pas
comment le fabriquer :

```json
{
  "manifestVersion": 1,
  "name": "mon-projet",
  "targets": ["web"],
  "architecture": "single-app",
  "frontend": { "framework": "next", "language": "typescript", "styling": "tailwind", "ui": "shadcn-ui" },
  "database": { "engine": "postgresql", "orm": "prisma" },
  "auth": { "provider": "better-auth" },
  "services": ["posthog", "resend", "sentry", "stripe"],
  "quality": ["biome", "playwright", "vitest"],
  "infra": ["docker", "github-actions", "vercel"]
}
```

*(Sortie réelle de `pnpm pf template show saas --name mon-projet`.)*

Deux invariants, tenus par des tests :

- **un seul champ à contenu libre** : `name` — c'est ce qui rend le manifest
  structurellement incapable de porter une valeur sensible ;
- **`parseManifest` rend une forme canonique** : ensembles triés, clés dans
  l'ordre déclaré. Deux manifests exprimant les mêmes choix produisent donc la
  même chaîne, octet pour octet.

Les champs, leur optionalité et ce que le manifest ne porte **pas** :
[Référence du manifest](reference-manifest.md).

## Le registry

Une **fiche** décrit une technologie : son `id`, sa `category`, ses `targets`,
son statut de cycle de vie, sa **capacité de génération** (`certified` ou
`declared`), sa licence, ses relations (`requires`, `compatibleWith`,
`conflictsWith`), ses paquets, ses variables d'environnement, son template.

Le catalogue officiel compte **283 fiches** et **37 catégories** ; il vit dans
`packages/registry/data/` et l'index consommé par le code est **engendré**
(`packages/registry/src/generated/entries.ts`), puis **revalidé au chargement** :
l'index est du code engendré, et du code engendré peut être modifié à la main.

Le registry ne raisonne pas : il déclare. Savoir si deux fiches vont ensemble
est le travail du compatibility engine. Détail :
[Référence du registry](reference-registry.md).

## Le compatibility engine

Il fait trois choses, dans cet ordre :

1. **il complète** : `requires` est suivi de façon transitive — choisir `hono`
   fait entrer `zod` et `openapi` — et il **dit ce qu'il a ajouté, et qui
   l'exigeait** (`← ajoutée : exigée par hono`) ;
2. **il refuse** ce qui ne peut pas tenir : deux technologies d'une catégorie
   **exclusive** (deux ORM, deux frameworks front), un conflit déclaré
   (`conflictsWith`), une cible non couverte, des contraintes de runtime
   incompatibles (`engines`) ;
3. **il avertit** sans bloquer : licence à contrainte de redistribution,
   technologie dépréciée, combinaison non certifiée.

L'**arité** d'une catégorie est une propriété invariante de la catégorie, pas de
la fiche : `testing` est cumulative (Vitest *et* Playwright cohabitent — c'est le
cas du preset SaaS), `orm` est exclusive. La déduire de la seule catégorie serait
faux ; elle vit dans
[`packages/compatibility/src/arity.ts`](../../packages/compatibility/src/arity.ts).

### Certifié, ou déclaré

Une combinaison est **certifiée** si *toutes* ses technologies le sont : le test
de fumée les génère, les installe, les construit, les démarre. Sinon elle est
**déclarée** : chaque technologie du catalogue est planifiée à sec par la suite
`catalogue-coverage.test.ts` (paquets, variables, scripts de CI cohérents),
sans être compilée. Aucun avertissement n'est affiché : le moteur refuse ce qui
ne peut pas fonctionner, il ne prévient pas pour ce qui le peut.

```text
mon-api — 12 technologies, stack déclarée
  · orm              Drizzle (drizzle)          ← déclarée : hors test de fumée
  ✓ backend          Hono (hono)
```

Le statut est **déduit**, jamais déclaré : une table de combinaisons certifiées
serait ingérable face à la combinatoire du catalogue.

## Presets et recettes

Un **preset** est un manifest nommé, plus des recettes. Les quatre presets sont
partagés par le CLI et l'UI (`packages/presets/src/index.ts`) — deux listes
finiraient par diverger, et « le même preset » ne donnerait plus le même projet.

| Preset | Cibles | Architecture | Recettes |
|---|---|---|---|
| `saas` | web | single-app | `resend-transactional`, `stripe-checkout` |
| `dashboard` | web | single-app | `dashboard-admin` |
| `api` | api | single-app | — |
| `fullstack` | web + api | monorepo | — |

Une **recette** ajoute du code applicatif qui n'appartient à aucune technologie
seule : le parcours de paiement Stripe, la page de connexion, l'espace
d'administration. Elle déclare ses fichiers, ses paquets et ses variables, et
n'est **jamais déduite de la stack** : elle est choisie explicitement (par un
preset ou `--recipes`), puis refusée si aucune des technologies qu'elle sert
n'est présente, ou s'il lui manque une de ses exigences
(`packages/recipes/data/*.recipe.json`,
[`packages/generator/src/recipes.ts`](../../packages/generator/src/recipes.ts)).

## Le générateur

Le pipeline ne fait rien avant d'avoir **tout décidé** :

- `planProject(manifest, dossier)` produit un **plan de fichiers** complet, sans
  écrire : c'est le dry-run, et c'est exactement ce que l'écriture fera (le
  preview ne peut pas diverger du résultat) ;
- `generateProject` écrit, avec **rollback** si l'écriture échoue, puis déroule
  ce qu'on lui a demandé : installation, `git init` + premier commit, validation.
  Chaque étape est nommée (`plan`, `write`, `install`, `git`, `validate`) et une
  erreur passagère peut être reprise avec `--from <étape>`.

Aucun nom de technologie n'est câblé dans le générateur : ce que Vitest ou Biome
apportent au projet vient de données d'intégration
(`packages/generator/src/integrations.data.ts`), et le socle se contente de
les assembler.

## Ce que le manifest ne porte pas

| N'est pas dans le manifest | Où c'est |
|---|---|
| Les **valeurs** des variables d'environnement (§6.8, §24) | nulle part : le projet généré ne reçoit que des **noms** (`.env.example`), vous remplissez le reste |
| Un jeton, une clé API | le trousseau du système, ou `credentials.json` en `0600` |
| Le dépôt GitHub | le remote Git du dossier local (§10) |
| Le profil de projet (« SaaS », « e-commerce ») | l'UI : c'est un guide de recommandation, pas un champ du §10 |
| Le contenu des templates | `packages/generator/templates/`, résolu à la génération |

## Vocabulaire

| Terme | Sens |
|---|---|
| **Manifest** | La description d'un projet (§10), en JSON, avec `manifestVersion` |
| **Fiche** *(entry)* | La description d'une technologie au catalogue (§11) |
| **Catégorie** | La famille d'une fiche (`frontend`, `orm`, `payments`…), 37 valeurs |
| **Cible** | La plateforme visée : `web`, `mobile`, `desktop`, `api`, `library` |
| **Arity** | Combien de technologies d'une catégorie peuvent coexister |
| **Recette** | Un lot de fichiers applicatifs, appliqué quand sa technologie est choisie |
| **Preset** | Un manifest nommé + des recettes (§8) |
| **Certifié** | Couvert par le test de fumée : généré, installé, construit, démarré |
| **Plan** | La liste des fichiers et de leur contenu, avant toute écriture |
| **Dry-run** | Montrer le plan, sans écrire |
