# Phase 8bis — Cibles mobile et desktop : le catalogue ne peut pas les honorer

**Date :** 11/10/2026
**Périmètre :** les cibles du §10 dans le parcours web (`apps/web/src/app/create/target/`,
`apps/web/src/lib/flow.ts`), le catalogue (`packages/registry/`), et ce qui les décrit
(`docs/roadmap.md`, ligne du constat).
**Statut :** **arbitré et corrigé** — aucune fiche technologique n'est inventée ; les cibles que le
catalogue ne peut pas honorer ne sont **plus proposées**, et un brouillon qui les porte encore est
refusé **avec sa raison**, à l'endroit du choix.
**Décision structurante :** le manifest (§10) **conserve** `mobile` et `desktop`. Ce qui est retiré,
c'est l'**offre** du MVP, pas le contrat de données.
**Interdit respecté :** aucune fiche inventée, aucun commit.

---

## 1. Le fait mesuré, pas l'impression

Le constat de la roadmap (« Le catalogue n'a aucune fiche mobile ni desktop ») est **faux au sens
littéral**, et c'est cette imprécision qui rendait le défaut difficile à trancher. Commandes et
sorties réelles :

```console
$ node -e "const fs=require('fs'),p=require('path');const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(p.join(d,e.name)):[p.join(d,e.name)]);const j=walk('packages/registry/data').filter(f=>f.endsWith('.entry.json')).map(f=>JSON.parse(fs.readFileSync(f,'utf8')));const fw=j.filter(e=>e.category==='frontend'||e.category==='backend');console.log('fiches totales            :',j.length);console.log('dont frontend/backend     :',fw.length);for(const t of ['web','api','mobile','desktop','library']){console.log(t.padEnd(8),'fiches citant la cible:',String(j.filter(e=>e.targets.includes(t)).length).padStart(3),'| dont capables d un framework:',fw.filter(e=>e.targets.includes(t)).length);}"
fiches totales            : 283
dont frontend/backend     : 29
web      fiches citant la cible: 238 | dont capables d un framework: 13
api      fiches citant la cible: 202 | dont capables d un framework: 16
mobile   fiches citant la cible:  46 | dont capables d un framework: 0
desktop  fiches citant la cible:  46 | dont capables d un framework: 0
library  fiches citant la cible:  46 | dont capables d un framework: 0
[exit 0]
```

Le chiffre qui décide est **0**, pas 46. Les 46 fiches qui citent `mobile` — et les mêmes 46 qui
citent `desktop` — sont des linters, des CI, des gestionnaires de paquets, des langages, des outils
de test : leurs catégories (`linting`, `ci-cd`, `language`, `testing`…) remplissent `quality`,
`services` ou `infra`, jamais le champ `framework` d'une application (la table est
`packages/registry/src/slots.ts` : seules `frontend` et `backend` occupent `framework`).

`expo` n'existe pas au catalogue, contrairement à ce que suppose l'énoncé de la tâche :

```console
$ node -e "const fs=require('fs'),p=require('path');const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(p.join(d,e.name)):[p.join(d,e.name)]);console.log('fiches citant expo/react-native/tauri/electron :',walk('packages/registry/data').filter(f=>/expo|react-native|tauri|electron/i.test(fs.readFileSync(f,'utf8'))).length)"
fiches citant expo/react-native/tauri/electron : 0
[exit 0]
```

Vérification du cas `library`, qui montre pourquoi « 0 framework » ne suffit pas à décider seul : le
§10 ne décrit `library` par **aucune** application, donc aucun framework ne lui est demandé. Une
cible sans framework n'est pas forcément inutilisable — c'est l'intersection des deux informations
(catalogue × forme du §10) qui tranche.

## 2. Le cul-de-sac, reproduit par une commande

Deux tests **existaient déjà** et prouvaient le refus, sans que rien ne relie ce refus au choix de
l'utilisateur :

```console
$ pnpm --filter @project-factory/web exec vitest run src/lib/draft-to-manifest.test.ts -t "cible mobile|cible desktop"
 Test Files  1 passed (1)
      Tests  2 passed | 18 skipped (20)
[exit 0]
```

Ce que ces tests disent :

- `une cible mobile reste refusée tant que le catalogue n'offre aucun framework mobile` →
  `draftToManifest` rend `ok: false` avec un problème de chemin `mobile.framework` ;
- `une cible desktop est refusée…` → même chose sur `desktop.framework`.

Le mécanisme, lu dans le code : `draftToManifest` crée un objet d'application par cible choisie
(`apps/web/src/lib/draft-to-manifest.ts`, `toManifest`), et `place()` ne remplit une application
qu'avec une fiche dont `targets` contient la cible de cette application. Le §10 exige un `framework`
dans chacun de ces objets (`packages/manifest/src/schema/manifest.ts`). Sans fiche, l'objet reste
vide et le schéma refuse — **trois écrans après le choix**, sous la forme d'un chemin de champ.
L'écran Target, lui, proposait les cinq cibles.

## 3. L'arbitrage

### Option A — ajouter les fiches manquantes : rejetée

| Raison | Source |
|---|---|
| Le MVP est **« Web uniquement »** ; mobile et desktop sont explicitement **V1** (« Mobile avec Expo, Desktop avec Tauri ») | `docs/cahier-des-charges.md` §23 |
| Une fiche `declared` ferait **passer** le brouillon (le slug existerait, la cible correspondrait) sans que rien ne génère de code mobile : l'utilisateur croirait avoir un projet mobile. C'est exactement le mensonge que le produit interdit | §24, `packages/registry/CONTRIBUTING.md` |
| Devenir `certified` demande un template **et** un test de génération (test de fumée) — du travail de pipeline, pas une entrée de catalogue | `CONTRIBUTING.md`, « `declared` ou `certified` » |
| Le catalogue interdit déjà les fiches qui visent **exclusivement** mobile ou desktop, au nom du périmètre MVP | `packages/registry/src/catalogue.test.ts:216` |
| Tauri ne vise pas le web : lui inventer une cible `web` pour satisfaire ce test serait une donnée fausse dans un champ qui pilote l'offre | même règle |

### Option B — retirer les cibles sans contenu de ce qui est **proposé** : retenue

Le retrait porte sur l'**offre**, et le contrat du §10 est conservé. Ce n'est pas un compromis
d'esthétique : c'est ce que la spécification impose.

- **Le manifest garde `mobile` et `desktop`.** Le §10 donne comme exemple canonique
  `"targets": ["web", "mobile"]` avec `"mobile": { "framework": "expo", "language": "typescript" }` ;
  le §11 donne une fiche `"targets": ["web", "mobile", "api"]` ; le §12 liste « compatibilité mobile
  ↔ monorepo » et « desktop ↔ frontend » ; le §23 place mobile et desktop en V1. Retirer ces valeurs
  de `TARGETS` contredirait la spécification, casserait les liens de partage (Phase 9) et devrait
  être défait en V1. **Le schéma n'est donc pas modifié.**
- **L'offre, elle, ne propose que ce que le catalogue peut honorer.** L'écran Target affiche
  `offeredTargets()` — `web`, `api`, `library` aujourd'hui — et un texte qui dit, pour les autres,
  **pourquoi** : aucun framework au catalogue, V1 (§23).
- **Le calcul n'est pas une liste d'interdits écrite dans l'écran.** Il se lit dans le catalogue
  (`packages/registry/src/targets.ts`) croisé avec la table des applications du §10. Le jour où une
  fiche `expo` vise `mobile`, l'écran la propose sans qu'on touche à l'écran — et le test du registry
  échoue en nommant la décision à rouvrir.
- **Un brouillon hérité ou un lien de partage (§20) qui porte encore `mobile` est refusé avec sa
  raison**, dans `blockedReason` : le message nomme la cible, dit qu'aucun framework n'existe au
  catalogue, cite le §10 et liste les plateformes proposées. `canAdvance` devient faux : le parcours
  ne va pas plus loin, il ne découvre pas le trou trois écrans plus tard.
- **Presets :** les quatre sont `web`, `web`, `api` et `web + api` — mesuré ci-dessous. Rien à en
  retirer.
- **`pf` :** `pf create` n'a aucun drapeau de cible (`--web`/`--mobile` n'existent pas ; les exemples
  du §21 qui les emploient sont documentés comme tels dans le guide). Rien à y changer.
- **Guide :** `docs/guide/reference-manifest.md` décrit les valeurs **acceptées** par le manifest —
  elles restent acceptées. Rien à y changer.

```console
$ node -e "const fs=require('fs');const s=fs.readFileSync('packages/presets/src/index.ts','utf8');for(const m of s.matchAll(/targets: \[([^\]]*)\]/g))console.log(m[1].trim())"
'web'
'web'
'api'
'web', 'api'
[exit 0]
```

## 4. Ce qui change dans le code

| Fichier | Changement |
|---|---|
| `packages/registry/src/targets.ts` **(nouveau)** | `FRAMEWORK_CATEGORIES` dérivée de `SLOTS` ; `targetCoverage(entries)` (fiches citant la cible × fiches capables d'en être le framework) ; `targetsWithoutFramework(entries)`. Aucune liste de technologies. |
| `packages/registry/src/index.ts` | Exporte le module. |
| `apps/web/src/lib/targets.ts` **(nouveau)** | `APP_TARGET` (la table du §10, une seule copie) ; `offeredTargets()` ; `refusedTargets()`. Le croisement « catalogue × §10 » vit ici, une fois. |
| `apps/web/src/lib/draft-to-manifest.ts` | Lit `APP_TARGET` au lieu de sa copie locale. Aucun changement de comportement. |
| `apps/web/src/lib/flow.ts` | `blockedReason` de l'étape `target` : refuse une cible non proposée **en la nommant et en disant pourquoi**. |
| `apps/web/src/app/create/target/page.tsx` | Rend `offeredTargets()` ; pour chaque cible retirée, une phrase dit qu'aucun framework n'existe et que c'est la V1 (§23). `NOTES` reste une table **complète** de `Target`. |

Tests ajoutés : `packages/registry/src/targets.test.ts` (couverture du catalogue réel + dérivation sur
fixtures), `apps/web/src/lib/targets.test.ts` (offre et refus), `apps/web/src/lib/flow.test.ts`
(test négatif mobile **et** desktop avec la raison ; test positif `web`, `api`, `library`).

**Aucune fiche ajoutée, aucun JSON touché, l'index engendré n'a pas besoin d'être régénéré.**

## 5. Preuves

```console
$ pnpm --filter @project-factory/registry test
 Test Files  7 passed (7)
      Tests  195 passed (195)
[exit 0]

$ pnpm --filter @project-factory/compatibility test
 Test Files  4 passed (4)
      Tests  85 passed (85)
[exit 0]

$ pnpm typecheck
 Tasks:    28 successful, 28 total
[exit 0]

$ pnpm --filter @project-factory/web test
 Test Files  50 passed (50)
      Tests  505 passed (505)
 Statements : 98.05% ( 252/257 ) · Branches : 93.71% ( 164/175 )
[exit 0]
# les 50 fichiers incluent 5 tests ajoutés dans src/lib/targets.test.ts et 2 dans
# src/lib/flow.test.ts ; le total grossit aussi du travail d'un autre lot en cours.

$ pnpm exec biome check <les 9 fichiers de ce lot>
 Checked 9 files in 24ms. No fixes applied.
 Found 1 warning.
[exit 0]   # l'avertissement est `type Slot` inutilisé, préexistant à HEAD dans draft-to-manifest.ts

$ pnpm lint
 Found 5 errors.
[exit 1]   # erreurs toutes situées dans `.measure-stack/*` — scripts de mesure d'un autre lot,
           # non versionnés et en cours au moment de la mesure. Vérifié par
           # `biome check --diagnostic-level=error` : `.measure-stack/measure.mjs`,
           # `measure2.mjs`, `measure-warm.mjs`, `measure-requests.mjs`. Aucun fichier de ce lot
           # n'est en cause, et aucun n'est touché ici.
```

Le refus est prouvé par un **test négatif**, pas par une phrase : `flow.test.ts` vérifie que
`mobile` et `desktop` ne franchissent pas l'étape et que le message les nomme, et
`draft-to-manifest.test.ts` continue de vérifier le refus au niveau du manifest
(`mobile.framework` / `desktop.framework`).

## 6. Ce qui reste ouvert, et pourquoi ce n'est pas un mensonge

- **Mobile et desktop restent dans le manifest, dans le guide et dans le type `Target`.** C'est
  volontaire : le format doit pouvoir décrire ce que la V1 générera (`"targets": ["web","mobile"]` du
  §10). Un manifest écrit à la main avec `mobile` reste lisible et diagnostiqué ; c'est le parcours
  guidé qui ne le produit plus.
- **V1 :** ajouter Expo (mobile) et Tauri (desktop) au catalogue demandera de vraies fiches
  (version, licence, paquets, documentation), et surtout un template par cible plus un test de
  génération. Le jour où la première fiche `frontend`/`backend` visera `mobile`, le test
  `targets.test.ts` échouera en nommant la décision à rouvrir, et l'écran la proposera de nouveau sans
  modification.
- **`pnpm test:e2e` n'a pas été rejoué** : il demande un navigateur installé, et cette tâche n'a pas
  touché au parcours lui-même (le parcours clavier cherche la plateforme « Web » par Tab et la
  touche Entrée ; les deux plateformes retirées n'étaient pas utilisées par cette preuve).
- **Le constat de la roadmap** est corrigé sur place : la formulation « aucune fiche mobile ni
  desktop » est remplacée par le chiffre réel (46 fiches citent la cible, 0 peut en être le
  framework) et le renvoi à ce document.
