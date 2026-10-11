# 8bis — Stack Builder : 37 Server Actions, mesurées puis réduites

**Date** : 2026-10-11 · **Branche** : `feat/phase8-web-socle` · **Périmètre** :
`apps/web/src/app/create/stack/**` (+ ce rapport).

Le constat du roadmap — « le Stack Builder charge les options par 37 Server
Actions, une par catégorie : point chaud si l'écran paraît lent » — n'avait
jamais été mesuré. Il l'est ici. La conclusion est en deux parties, et la
seconde contredit l'intuition que la première suggérait :

1. **Le moteur n'est pas le coût.** Les 37 catégories demandent 283 `resolve()`
   et **~2 ms** en tout (p50, 30 rendus). Un rendu qui déclenche 37 Server
   Actions ne coûte pas cher parce que le moteur travaille beaucoup.
2. **Le transport, lui, coûte.** Une Server Action seule vaut **~9 ms** ; les
   mêmes 37, lancées en parallèle depuis le navigateur, valent **~325 ms**,
   parce que le serveur les exécute **en série**. C'est 36 allers-retours
   inutiles par rendu.

La consolidation du §2 de la tâche était donc justifiée, et elle est faite.

## Méthode (pour que les chiffres soient réutilisables)

Deux familles de mesures, toutes deux reproductibles.

### A. Coût du moteur et d'un aller-retour, hors build

Script : `measure-stack.mjs` (parle au moteur directement : `registry` +
`compatibility` ; `lib/engine.ts` importe `server-only`, qui lève hors condition
`react-server`). Un petit crochet résout `.js` → `.ts` pour les paquets du
monorepo, qui publient leur source.

```powershell
# %TEMP%\pf-mesure-stack\
node --loader ./loader.mjs ./measure-stack.mjs
```

Mesuré sur la machine de développement : Windows, Node v24.10.0, Next 15.5.27,
React 19.3.0. Catalogue : **283 fiches, 37 catégories, toutes non vides**.

| Mesure | p50 | min | max |
| --- | --- | --- | --- |
| `loadCatalogue()` (une fois par processus) | 39,3 ms | — | — |
| Les 37 catégories, sélection vide (283 `resolve()`) | **2,16 ms** | 1,47 | 4,43 |
| Les 37 catégories, 3 technos choisies | **1,69 ms** | 1,05 | 2,94 |
| Les 37 catégories, 8 technos choisies | **2,38 ms** | 1,65 | 4,93 |
| Un `resolve()` seul (`checkSelectionAction`) | 0,003 ms | 0,002 | 0,343 |

### B. Coût d'un aller-retour, isolé du moteur

Script : `measure-rpc.mjs`. Il capture une **vraie** requête d'action émise par
l'écran (URL, en-têtes, corps), puis la rejoue 1, 8 et 37 fois en parallèle
depuis la page. Le corps fait 34–45 o et ne change pas : ce qui reste est le
transport.

| Requêtes concurrentes | Médiane (5 tirs) |
| --- | --- |
| 1 | **9,1 ms** |
| 8 | 65,7 ms |
| 37 | **324,9 ms** |

La progression est linéaire (~8,8 ms par requête) : les 37 requêtes sont bien
émises **en parallèle** par le navigateur, mais le serveur les traite l'une
après l'autre. C'est là que se perdent ~315 ms.

### C. Ce que voit l'utilisateur, sur le build de production

Script : `measure-warm.mjs`. Il démarre `next start` sur le build courant (le
serveur réellement servi, pas `next dev`), charge `/create/stack` **8 fois à
chaud**, compte les requêtes POST, additionne leurs octets et chronomètre
l'affichage du catalogue (disparition de « Chargement du catalogue »).

```powershell
node ./measure-warm.mjs
```

Avant et après ont été mesurés **le même jour, sur la même machine, avec le
même script**, le seul écart entre les deux étant le contenu de
`page.tsx` : la version d'origine a été remise en place depuis git, le build
refait, les 8 rechargements rejoués, puis la version consolidée restaurée et le
build refait.

## Avant / après

| | Avant (37 actions) | Après (1 action) | Écart |
| --- | --- | --- | --- |
| Requêtes POST par visite | **76** | **4** | −72 |
| dont actions de chargement | 74 (2 × 37) | 2 | −72 |
| Catalogue visible (médiane) | **921 ms** | **372 ms** | **−549 ms (−60 %)** |
| Durée de la vague d'actions (médiane) | **702 ms** | **128 ms** | −574 ms (−82 %) |
| Somme des durées RPC (médiane) | **806 ms** | **156 ms** | −650 ms (−81 %) |
| Action la plus lente (médiane) | 38 ms | 53 ms | — |

Détail des deux séries (avant) :

```
requêtes=76  visible=802…1765 ms  vague=600…1327 ms  RPC=684…1488 ms
```

Détail des deux séries (après) :

```
requêtes=4   visible=327…831 ms   vague=108…332 ms   RPC=129…377 ms
```

Le volume rendu est comparable (≈ 50 ko par chargement complet, 283 options) :
la consolidation ne supprime pas du **contenu**, elle supprime des
**allers-retours**. Les 76 requêtes d'avant portaient 2 × 38 réponses de ~2 ko.

## Ce qui a changé

- **`apps/web/src/app/create/stack/actions.ts`** (nouveau) :
  `loadStackBlocksAction(selection)` rend toutes les catégories d'un coup. Il
  **ne décide rien** : il appelle `loadOptionsAction` en `Promise.all` (même
  travail, même ordre, même filtrage des catégories vides) et il est marqué
  `'use server'`.
- **`page.tsx`** : l'effet de chargement appelle cette action une fois, au lieu
  de `CATEGORIES.map(loadOptionsAction)`.
- **`lib/engine.ts`** : **inchangé**. C'est toujours le seul fichier qui parle au
  moteur, `server-only` compris.
- **`actions.ts`** (racine) : **inchangé**, y compris `loadOptionsAction`, qui
  reste la primitive par catégorie (et la preuve que le chargement groupé rend
  exactement la même chose).
- **`stack-data.test.ts`** : quatre tests ajoutés (contrat du chargement groupé,
  compatibilité tranchée par le moteur, garde-fou du 8B.2).

**Comportement inchangé** : les options bloquées restent visibles avec leur
raison (le test compare la raison rendue à celle du moteur pour la même
sélection), le plafond de 4 du mode guidé n'est pas touché (`stack-view.ts`),
la recherche experte parcourt toujours tout le catalogue (`blocks` contient
toujours les 37 catégories).

**Garde-fou du 8B.2, prouvé par un test négatif** : `stack-data.test.ts` lit
`page.tsx` et `stack-options.tsx` et refuse tout import de `lib/engine`, de
`server-only`, de `@project-factory/compatibility` ou de
`@project-factory/generator`, sous les **deux** formes (`import … from 'x'` et
l'import à effet de bord `import 'x'`). Le premier jet de ce test ne voyait que
la première forme : en injectant `import '../../../lib/engine';` dans
`page.tsx`, il passait — corrigé, il échoue (vérifié, puis import retiré).

## Ce qui reste ouvert (mesuré, non corrigé)

L'écran charge **deux fois** son catalogue par visite, et ce n'est pas la
consolidation qui l'a fait apparaître : c'était déjà le cas avec les 37 actions
(74 + 2 = 76 requêtes). La cause est dans le cycle de vie du brouillon :
`DraftProvider` branche `localStorage` dans un effet (`store.attach`), qui
notifie les abonnés ; le rendu suivant recrée les tableaux `targets` et
`technologies`, donc la `selection` mémoïsée change de référence et l'effet de
chargement repart une seconde fois — pour des données identiques.

Après consolidation cela coûte : 2 requêtes d'action au lieu d'une, ~50 ko
transférés en double, ~128 ms de vague au lieu de ~90 ms. C'est visible dans
les mesures (`bytes` : 49 647 quand la seconde réponse n'est pas captée, 99 120
quand les deux le sont). Pistes, dans l'ordre de sûreté : rendre `attach()`
idempotent quand le brouillon relu est égal à l'état courant (dans
`lib/session.ts`, **hors du périmètre de cette tâche**), ou ne relancer le
chargement que si la sélection a réellement changé de **valeur** (dans
`page.tsx`). Aucune des deux n'est faite ici : la seconde demande de décider ce
qu'« égale » veut dire pour deux tableaux, et la première sort du périmètre
d'écriture de la tâche.

## Commandes de vérification

```powershell
pnpm --filter @project-factory/web test     # exit 0
pnpm --filter @project-factory/web build    # exit 0
pnpm typecheck                              # exit 0
pnpm lint                                   # exit 0 (0 erreur)
```

---

# Suite (task-7) — la deuxième vague était un bug, pas le prix de l'hydratation

**Date** : 2026-10-11 (même journée) · **Branche** : `feat/phase8-web-socle` · même machine
(Windows, Node v24.10.0, Next 15.5.27, React 19.3.0). Cette suite **ajoute** au rapport
ci-dessus sans en réécrire les chiffres ; elle ferme la section « Ce qui reste ouvert ».

La section précédente donnait la bonne chaîne (« `attach` branche `localStorage`, notifie, les
tableaux sont recréés ») et proposait deux pistes. La mesure fine montre que la chaîne est
exacte, mais que le **déclencheur est une écriture antérieure à `attach`** — et que les deux
pistes visées n'auraient pas suffi.

## 1. Nature du doublon : un bug

Sonde de trace (instrumentation temporaire, **retirée** depuis) sur le build de production,
`next start`, visite à chaud de `/create/stack` :

```text
302 ms  StepShell  draft.step=create → step=stack      (commit step=stack)
304 ms  page       effet de chargement                 (vague 1, sélection vide)
305 ms  provider   attach : reread.step=create, current.step=stack → commit step=create
306 ms  page       effet de chargement                 (vague 2, mêmes valeurs)
```

Trois faits mesurés :

1. **`attach` n'est appelé qu'une fois.** Ni double abonnement, ni effet rejoué par React :
   `StrictMode` n'existe pas dans ce dépôt, et le build de production ne double aucun effet.
2. **Il commite un brouillon différent** parce que `StepShell` a écrit l'étape de l'URL dans un
   effet **avant** lui : les effets des enfants passent avant celui du provider, qui est leur
   parent. Le brouillon persisté porte l'étape *quittée* (`create`), la mémoire porte l'étape
   courante (`stack`) — `attach` relit et écrase.
3. **Ce commit rend les tableaux neufs.** `loadDraft` reconstruit `targets` et `technologies`,
   or le `useMemo` de `page.tsx` compare des **références**, pas des valeurs. La sélection
   mémoïsée change d'identité, et les deux effets (catalogue *et* compatibilité) repartent pour
   des valeurs identiques — les deux corps de requête mesurés sont
   `[{"targets":[],"technologies":[]}]`, octet pour octet.

C'est donc un bug : la seconde vague ne portait **aucune** information neuve. Deux conséquences
mesurées :

- **l'étape écrite par le shell était annulée.** Les deux commits se fondent en un seul rendu,
  donc l'effet de `StepShell` (dépendance `draft.step`) ne revoit jamais la valeur intermédiaire
  et ne corrige pas : `draft.step` finissait la visite à `create` alors que l'URL était
  `/create/stack`. C'est la reprise du §3 qui repartait du mauvais écran (le `step` persisté
  restait `create`, mesuré dans `localStorage` après la visite).
- **la vague 1, elle, est du prix d'hydratation** pour un visiteur qui a une sélection
  persistée : le serveur rend le brouillon frais (il ne connaît pas `localStorage`), le premier
  rendu client doit donc l'être aussi, et le moteur est interrogé une fois avec cette sélection
  vide avant que la reprise n'arrive.

## 2. Le correctif, au niveau responsable

Le doublon vit dans le cycle de vie du store, pas dans l'effet de l'écran : il est corrigé dans
`lib/draft.ts` et `lib/session.ts`, sans toucher `page.tsx` (aucun garde ajouté dans l'effet).

- **`restorePersistedDraft(stored, current, baseline)`** (nouveau, `lib/draft.ts`) : le
  brouillon **relu du stockage**, recouvert par ce que l'application a changé **en mémoire**
  depuis la création du store. L'étape de l'URL écrite par `StepShell` gagne donc sur l'étape
  persistée. Deuxième règle, celle qui coûtait cher : un tableau dont la **valeur** ne change
  pas **garde sa référence** — c'est ce que lit `useMemo`, donc la sélection mémoïsée ne bouge
  plus.
- **`attach`** (`lib/session.ts`) applique cette restauration et ne notifie **pas** si le
  brouillon restauré se persisterait à l'identique (`samePersistedDraft`) : un rendu qui ne
  change rien n'est plus un changement. Le store garde la trace de son état de création, qui est
  ce qui permet de distinguer « relu » de « changé en mémoire ».

Les invariants du brouillon sont intacts : rien de sensible n'entre dans le brouillon
(`toPersisted` n'a pas bougé), et un brouillon relu **différent** est toujours annoncé — la
reprise est vérifiée de nouveau dans l'interface (voir §4).

**16 tests ajoutés** (5 dans `session.test.ts`, 11 dans `draft.test.ts`), dont un garde-fou
négatif prouvé **rouge** sur l'ancien comportement : `attach` sur un stockage identique, avec
l'étape écrite en mémoire avant lui, ne notifie pas et rend le **même** objet d'état (4 échecs
sur l'ancien `attach`, 0 après).

## 3. Avant / après, même méthode, même journée

Même instrument (`%TEMP%\pf-mesure-double\measure-double.mjs`, hors de l'arbre de travail) :
`next start` sur le build de production, **3 scénarios × 8 visites** (1 froide + 7 chaudes),
requêtes POST comptées par identifiant d'action (`Next-Action`), « catalogue visible » = délai
jusqu'à la disparition de « Chargement du catalogue ».

| Scénario de visite | Requêtes POST | dont catalogue | dont compatibilité | Catalogue visible (médiane chaude) |
| --- | --- | --- | --- | --- |
| **Avant** — aucun brouillon | 4 | **2** | 2 | 124 ms |
| **Avant** — brouillon persisté = frais | 4 | **2** | 2 | 132 ms |
| **Avant** — brouillon persisté `web` + `next` | 4 | **2** (vide, puis reprise) | 2 | 125 ms |
| **Après** — aucun brouillon | **2** | **1** | 1 | **80 ms** |
| **Après** — brouillon persisté = frais | **2** | **1** | 1 | **85 ms** |
| **Après** — brouillon persisté `web` + `next` | 4 | 2 (vide, puis reprise) | 2 | 110 ms |

Les deux corps de la vague dupliquée étaient identiques (mesuré) : la moitié des octets du
catalogue était transférée pour rien. La somme des octets du catalogue sur les 7 visites chaudes
passe de 346 311–593 676 o (selon les réponses que la sonde a pu lire) à 296 838 o ; ce sont des
**bornes basses**, environ une réponse sur sept n'étant pas lisible par la sonde.

Le troisième scénario est le plus important : **le rechargement nécessaire est conservé**. Un
visiteur qui reprend un brouillon non vide paie toujours deux vagues, dont la seconde — la
reprise — est celle qui compte. La première est le prix d'hydratation décrit au §1, et elle
n'est **pas** supprimée ici : l'enlever demanderait de ne pas interroger le moteur avant que le
brouillon soit restauré, ce qui change le contrat du provider et le moment du premier appel
moteur pour tous les écrans (piste du §6, non appliquée).

## 4. La reprise du brouillon, vérifiée dans l'interface

Après le correctif, avec un brouillon persisté (`targets: ["web"]`, `technologies: ["next"]`,
`mode: "expert"`), le build de production affiche : « **1 technologie choisie** », le mode
**Expert** actif, et l'option **Next.js** en état *Choisi* (`aria-pressed="true"`). La
restauration après rechargement complet n'est donc pas sacrifiée au gain de requêtes.

## 5. Ce qui a été mesuré, et ce qui ne l'est pas

**Mesuré**

- Nombre de POST par visite, par identifiant d'action, et **corps exact** de chaque vague
  (3 scénarios × 8 visites) sur le build de production.
- Délai d'affichage du catalogue (médiane des visites chaudes).
- La séquence réelle des commits et des effets : `StepShell` → effet de l'écran → `attach` du
  provider, avec les valeurs de chaque commit (instrumentation temporaire, retirée).
- L'état final du brouillon dans `localStorage` après une visite.
- La reprise visible dans l'interface (§4).
- Les quatre commandes de vérification, après le correctif et après ce rapport.

**Non mesuré**

- `pnpm test:e2e` n'a pas été rejoué : la preuve de la reprise ici est l'assertion d'interface
  du §4 et les tests `draft.test.ts` / `session.test.ts`, pas le parcours complet.
- La visite **froide** (première connexion, premier rendu compilé) n'est pas comparable : ses
  350–400 ms incluent le premier aller-retour du serveur, pas le doublon.
- Les sommes d'octets sont des bornes basses (réponses illisibles par la sonde).
- Seul le Stack Builder a été instrumenté. Le même enchaînement (`attach` qui rend les tableaux
  neufs) concernait **tous** les écrans qui interrogent le moteur depuis un effet ; le
  correctif est dans le store, donc il les concerne tous, mais aucun d'eux n'a été remesuré.
- `next dev` n'a pas été mesuré (le correctif ne change pas le nombre d'effets, seulement les
  commits du store ; le double effet du mode strict en développement reste possible).
- Ces chiffres ne sont pas comparables à ceux de la section précédente : le harnais de task-6
  chronométrait différemment (372 ms médians « après » contre ~124 ms ici pour le même build
  avant correctif). Seul l'avant/après **de cette suite**, mesuré par le même script, est
  comparable.

## 6. Ce qui reste ouvert

- **La première vague d'un visiteur qui reprend un brouillon non vide** (dernière ligne du
  tableau du §3) : le moteur est interrogé une fois avec la sélection vide du rendu serveur,
  puis une fois avec la sélection restaurée. Piste la moins risquée, **non appliquée** : que le
  provider expose « le stockage est branché » et que l'écran attende ce signal avant son premier
  appel moteur — le moteur ne serait jamais interrogé sur une sélection qui n'est pas encore
  restaurée. Elle change le contrat du provider et le moment du premier appel pour chaque écran
  qui l'adopterait : à faire avec sa propre mesure.
- **Le commentaire d'`actions.ts`** citait `.measure-stack/measure-rpc.mjs`, un dossier de
  mesure qui ne doit pas exister dans l'arbre de travail : il renvoie désormais à ce rapport.
- `pnpm lint` signale 15 avertissements et 171 informations, dont les `!important` assumés du
  bloc `prefers-reduced-motion` : 0 erreur, comme avant.

## Commandes de vérification (suite task-7)

```powershell
pnpm --filter @project-factory/web test     # exit 0 — session+draft : 25 → 41 tests
pnpm --filter @project-factory/web build     # exit 0
pnpm typecheck                               # exit 0 — 28 tâches
pnpm lint                                    # exit 0 — 0 erreur
```

