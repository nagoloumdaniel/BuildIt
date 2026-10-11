# Phase 8F.1 — Parcours clavier seul, 12 étapes (gate M5)

**Date :** 11/10/2026
**Périmètre :** les 12 étapes de `STEP_ORDER` (`apps/web/src/lib/flow.ts`), pilotées **entièrement au
clavier** dans un vrai navigateur, sur le serveur réellement servi par `next start`.
**Statut :** gate M5 franchi — **12/12 étapes** au clavier, **0 clic souris**, **0 `focus()`
programmé** ; **un obstacle réel corrigé** dans `apps/web/src/components/wizard/shell.tsx`, et la
sonde du **lien d'évitement** (septième vérification) couvre la correction de `layout.tsx:68`.
**Compagnons :** [thème écran par écran](2026-10-11-phase8f-theme-ecran-par-ecran.md),
[gate M5 de la roadmap](../../roadmap.md) (la case reste à cocher par son propriétaire : `docs/roadmap.md`
n'est pas dans le périmètre d'écriture de cette tâche).

---

## Ce que le gate demandait, et où on en était

> `pnpm test:e2e` sur l'étape bloquante (sélection d'une plateforme et passage à la suite, touche
> Entrée) ; le reste du parcours n'utilise que des liens et des boutons natifs, mais n'est pas
> encore piloté entièrement au clavier.

Le parcours existant **prouvait la touche Entrée sur une seule étape**, avec deux faiblesses : il
plaçait le focus par programme (`element.focus()`) avant d'appuyer sur Entrée — un lecteur d'écran
n'aurait jamais atteint ce bouton par Tab — et il ne disait rien du focus après un changement
d'écran, de l'ordre de tabulation, des pièges de focus ni des annonces de refus. Le parcours clavier
ci-dessous lève ces quatre angles morts, sans toucher au premier.

---

## Méthode

1. **L'infrastructure est partagée, pas recopiée** : `apps/web/e2e/harness.mjs` (navigateur déjà
   installé, `next start` sur un espace de travail temporaire, collecte des erreurs de page).
   `journey.mjs` (parcours souris, référence) et `keyboard.mjs` (parcours clavier, gate) l'importent.
2. **Deux parcours, deux contextes de navigateur.** Le brouillon vit dans `localStorage` : le
   parcours clavier ne doit pas hériter des choix du parcours souris. Le parcours souris tourne en
   premier parce qu'il vérifie que l'aperçu **n'écrit rien** — ce qui suppose un espace de travail
   encore vide.
3. **Le parcours clavier ne touche à aucune API souris**, et le test s'en garde lui-même :
   `keyboard.mjs` relit son propre source et échoue s'il contient `.click(`, `.fill(`, `.hover(`,
   `.tap(`, `.focus(`, `.selectOption(`, `.check(`, `.setInputFiles(`. Le journal final le dit :
   `376 appuis de Tab/Maj+Tab, 0 clic souris, 0 focus() programmé`.
4. **Le parcours se juge étape par étape**, et il **relève** les obstacles au lieu de s'arrêter au
   premier : chaque anomalie est écrite dans le journal dès qu'elle est vue, et le parcours échoue à
   la fin en les listant toutes. Un passage montre donc tout.
5. `PF_E2E_ONLY=clavier` (ou `souris`) ne joue qu'un parcours — outil d'itération, jamais la preuve
   finale (la preuve finale est la commande nue, cf. ci-dessous).

### Les sept vérifications faites à chaque étape

| # | Vérification | Comment elle est prouvée |
|---|---|---|
| 1 | **Le focus est posé sur le titre** à l'arrivée (jamais perdu sur `<body>`) | après chaque changement d'écran, `document.activeElement` doit être le `<h1>` de l'étape |
| 2 | **L'ordre de tabulation suit l'ordre du DOM** | on part de l'intérieur de `<main>`, on Tab jusqu'à en sortir : la séquence obtenue doit être **exactement** la suite des éléments focusables de `<main>` (ordre du DOM, éléments visibles et `tabIndex >= 0` seulement) |
| 3 | **L'ordre de tabulation suit l'ordre visuel** | coordonnées **absolues** (`rect.top + scrollY`) : chaque arrêt est au-dessous du précédent, ou sur la même ligne à sa droite |
| 4 | **Chaque arrêt de focus a un indicateur visible** | `outline-style != none` et `outline-width >= 2px` sur l'élément réellement focalisé (le `:focus-visible` de `globals.css`) |
| 5 | **Aucun piège de focus** | le focus doit **ressortir** de `<main>` après avoir visité tous ses arrêts attendus — ni boucle, ni élément sauté |
| 6 | **Un refus est annoncé** | une région `role="status"` dit le refus (`aria-disabled="true"` sur « Continuer », `tabIndex="-1"`), et elle disparaît quand la condition est levée |
| 7 | **Le lien d'évitement mène quelque part** | premier Tab du document → l'élément actif est le lien « Aller au contenu » (avec indicateur visible) ; Entrée → `document.activeElement.id === 'contenu'` |

Les **flèches** ne sont pas utilisées, et c'est dit plutôt que simulé : aucun composant du parcours
n'est un `radiogroup` ou une `listbox` à navigation par flèches — les choix sont des
`<button aria-pressed>` et des cases à cocher natives, que Tab puis Entrée/Espace activent.

---

## L'obstacle réel, corrigé

### 1. Le focus retombait sur `<body>` à chaque changement d'étape

**Preuve (avant correction, parcours clavier sur le build d'alors, `exit 1`) :**

```
[1/12] create — « Créer un projet » (focus resté sur <BODY>)
[2/12] target — « Plateformes cibles » (focus resté sur <BODY>)
[3/12] type — « Profil du projet » (focus resté sur <BODY>)
[4/12] architecture — « Architecture » (focus resté sur <BODY>)
[5/12] stack — « Stack Builder » (focus resté sur <BODY>)
  ⚠ obstacle relevé : étape 1 (create) : après le changement d'écran, le focus est sur <BODY>
    «  » et non sur le titre de l'étape — le focus est perdu à chaque navigation cliente.
```

Le routeur de Next **retire du DOM** le lien qui portait le focus (« Continuer ») : le focus du
navigateur retombe sur `<body>`. L'utilisateur au clavier devait donc retraverser tout l'en-tête
(lien d'évitement, lien d'accueil, bascule de thème) à chaque étape, et rien n'annonçait l'écran
suivant.

**Correction — `apps/web/src/components/wizard/shell.tsx` :**

- `shell.tsx:67` — `const requestedUrl = …` : l'adresse **demandée** au chargement du document,
  lue quand le module est évalué ;
- `shell.tsx:98-107` — l'effet d'entrée d'étape : si `requestedUrl !== window.location.href`, c'est
  une navigation **dans** le parcours, et le focus est posé sur le titre. Sinon (accès direct à
  l'adresse), le focus ne bouge pas : le déplacer serait intrusif et ferait sauter le lien
  d'évitement et la bascule de thème du premier Tab ;
- `shell.tsx:125` — le `<h1>` reçoit `tabIndex={-1}` et une `ref` : c'est une **cible de focus
  programmée**, jamais un arrêt de tabulation de plus.

**Après correction :** les 12 étapes affichent `focus posé sur le titre`, et l'ordre de tabulation
relevé inclut le titre comme point de départ (les compteurs d'arrêts passent de 5 à 6 sur `target`,
etc.).

Aucune autre correction d'accessibilité n'a été nécessaire : les liens et boutons natifs du parcours
étaient déjà activables au clavier (`<a>` pour « Continuer », `<button>` pour les choix, cases à
cocher natives pour l'infrastructure).

---

## Obstacles **du test**, consignés parce qu'ils piègent

Ils n'ont rien changé à `apps/web/src`, mais chacun a produit un faux échec ou un faux constat :

1. **`innerText` met le texte en majuscules.** `.pf-eyebrow { text-transform: uppercase }`
   (`globals.css:148-152`) fait rendre « ÉTAPE 1 SUR 12 » à `innerText`, alors que le DOM contient
   « Étape 1 sur 12 ». Le test lit désormais `textContent`.
2. **Les coordonnées de `getBoundingClientRect()` sont relatives à la fenêtre.** Le focus fait
   défiler la page : le premier passage a donc conclu à tort que l'écran Stack Builder ne suivait pas
   l'ordre visuel (« Lint » y=415 arrivant après « Tests » y=831). Les positions sont désormais
   absolues (`+ scrollY`).
3. **L'état d'une option du Stack Builder change de façon asynchrone.** Après Entrée, le moteur
   revalide et **recharge les options** : 300 ms ne suffisaient pas, le bouton focalisé annonçait
   encore `aria-pressed="false"` alors que la bascule avait bien eu lieu. Le test attend maintenant
   que l'état soit annoncé (`waitForFunction`), sans parier sur un délai fixe. C'est aussi un
   **constat sur l'application** — voir les remarques ci-dessous.
4. **Chromium sort le focus du document en fin de liste** (un Tab de plus donne `<body>`, le suivant
   repart au début). Le test tolère ce passage de relais et ne conclut à une perte de focus qu'après
   trois `<body>` consécutifs.

---

## Ce qui reste impossible au clavier

**Rien sur les 12 étapes du §3** : chacune est franchie, y compris la génération réelle et l'arrivée
au rapport (projet écrit sur le disque, vérifié).

Limites explicites de la preuve :

- Le **Dependency Graph** (`/graph`) et les écrans hors parcours (GitHub, Clone, Open, Repo, Share)
  ne font pas partie des 12 étapes : ils ne sont pas couverts par cette preuve clavier.
- La **bascule de thème** est atteignable au clavier (c'est le 3ᵉ arrêt de chaque écran, l'ordre de
  tabulation le prouve), mais c'est le parcours souris qui l'exerce.
- Les écrans qui interrogent le moteur affichent leur chargement en texte (`Chargement…`) : le
  parcours attend sa disparition, donc **un chargement éternel serait un échec**, pas un silence.

### Remarques et suite

1. **Lien d'évitement — corrigé pendant la relecture, et prouvé.**
   `apps/web/src/app/layout.tsx:68` porte désormais `tabIndex={-1}` sur `<div id="contenu">` : le
   premier Tab donne le lien « Aller au contenu », Entrée pose le focus sur la cible. Le `<main>`
   vivant dans `shell.tsx`, la cible reste le conteneur — c'est bien le comportement attendu d'un
   lien d'évitement. La sonde vit dans `apps/web/e2e/keyboard.mjs:329-360` ; elle passe.
2. **L'état d'une option du Stack Builder suit le rechargement serveur, pas le brouillon.**
   `apps/web/src/app/create/stack/stack-options.tsx:38` : `chosen` vient de `option.state`, donc le
   bouton n'annonce « Choisi » qu'après le retour du moteur (mesuré : > 300 ms, < 20 s). Un état
   client existe — `draft.technologies` (`create/stack/page.tsx:75`) — mais il **n'est pas consulté**
   par le bouton : l'appelant (`create/stack/page.tsx:270-281`) ne passe que `option`,
   `recommended` et `onToggle`, jamais la sélection du brouillon. **Laissé tel quel** : c'est le
   moteur qui tranche la compatibilité (§12), l'écart d'un aller-retour est le prix de cette
   validation, et le corriger sans cette décision serait un changement de comportement, pas un
   correctif.
3. **`pnpm test:e2e` et un `next build` concurrent ne cohabitent pas.** Le premier essai de preuve
   finale a échoué en 30 s (« Le serveur n'a pas répondu sur http://127.0.0.1:4319 ») parce qu'un
   `pnpm build` d'un autre travail réécrivait `apps/web/.next` pendant que `next start` le lisait.
   La preuve doit être relancée sur un `.next` stable, tous les writers arrêtés.

---

## Preuves d'exécution

| Commande | Résultat |
|---|---|
| `pnpm --filter @project-factory/web test:e2e` | **exit 0** — parcours souris (référence §3) **et** parcours clavier seul : 12/12 étapes, 376 Tab/Maj+Tab, 0 clic souris, 0 `focus()`, sonde du lien d'évitement comprise |
| `pnpm --filter @project-factory/web test` | **exit 0** — 49 fichiers, **492 tests passés** (couverture comprise), aucune régression |
| `pnpm --filter @project-factory/web build` | **exit 0** |
| `pnpm exec biome check apps/web/e2e apps/web/src/components/wizard/shell.tsx` | **exit 0** — 0 erreur, 7 infos préexistantes (`useLiteralKeys` sur `process.env['…']`, style du dépôt) |

Extrait de la sortie de `pnpm --filter @project-factory/web test:e2e` (preuve du gate — les 12
étapes, telles que l'application les annonce elle-même, « Étape N sur 12 ») :

```
=== Parcours souris (référence §3) ===

✓ parcours souris (référence §3) : réussi

=== Parcours clavier seul (gate M5) ===
  lien d’évitement : premier Tab sur le lien, Entrée pose le focus sur #contenu

[entrée] Dashboard — ordre de tabulation complet du document
  ordre de tabulation : 4 arrêt(s) dans <main>, ordre du DOM et ordre visuel respectés

[1/12] create — « Créer un projet » (focus posé sur le titre)
  ordre de tabulation : 5 arrêt(s) dans <main>, ordre du DOM et ordre visuel respectés
  nom saisi au clavier : clavier-e2e, refus levé
  ✓ étape 1/12 franchie au clavier (Entrée sur « Continuer »)

[2/12] target — « Plateformes cibles » (focus posé sur le titre)
  ordre de tabulation : 6 arrêt(s) dans <main>, ordre du DOM et ordre visuel respectés
  plateforme « Web » choisie à la touche Entrée, refus annoncé puis levé
  Maj+Tab ramène sur « Précédent » : la navigation est réversible au clavier
  ✓ étape 2/12 franchie au clavier (Entrée sur « Continuer »)

[3/12] type — « Profil du projet » (focus posé sur le titre)
  ordre de tabulation : 6 arrêt(s) dans <main>, ordre du DOM et ordre visuel respectés
  ✓ étape 3/12 franchie au clavier (Entrée sur « Continuer »)

[4/12] architecture — « Architecture » (focus posé sur le titre)
  ordre de tabulation : 6 arrêt(s) dans <main>, ordre du DOM et ordre visuel respectés
  ✓ étape 4/12 franchie au clavier (Entrée sur « Continuer »)

[5/12] stack — « Stack Builder » (focus posé sur le titre)
  ordre de tabulation : 47 arrêt(s) dans <main>, ordre du DOM et ordre visuel respectés
  next choisi au clavier : « Next.jsChoisinext » (recherche saisie, option atteinte par Tab, Entrée)
  typescript choisi au clavier : « TypeScriptChoisitypescript » (…)
  tailwind choisi au clavier : « Tailwind CSSChoisitailwind » (…)
  postgresql choisi au clavier : « PostgreSQLChoisipostgresql » (…)
  prisma choisi au clavier : « PrismaChoisiprisma » (…)
  ordre de tabulation : 52 arrêt(s) dans <main>, ordre du DOM et ordre visuel respectés
  ✓ étape 5/12 franchie au clavier (Entrée sur « Continuer »)

[6/12] capabilities — « Capacités » (focus posé sur le titre)
  ordre de tabulation : 26 arrêt(s) dans <main>, ordre du DOM et ordre visuel respectés
  ✓ étape 6/12 franchie au clavier (Entrée sur « Continuer »)

[7/12] env — « Environnement & secrets » (focus posé sur le titre)
  ordre de tabulation : 2 arrêt(s) dans <main>, ordre du DOM et ordre visuel respectés
  ✓ étape 7/12 franchie au clavier (Entrée sur « Continuer »)

[8/12] infrastructure — « Infrastructure » (focus posé sur le titre)
  ordre de tabulation : 17 arrêt(s) dans <main>, ordre du DOM et ordre visuel respectés
  case « Docker » cochée à la barre d’espace
  ✓ étape 8/12 franchie au clavier (Entrée sur « Continuer »)

[9/12] blueprint — « Plan du projet » (focus posé sur le titre)
  ordre de tabulation : 5 arrêt(s) dans <main>, ordre du DOM et ordre visuel respectés
  ✓ étape 9/12 franchie au clavier (Entrée sur « Continuer »)

[10/12] preview — « Aperçu des fichiers » (focus posé sur le titre)
  ordre de tabulation : 2 arrêt(s) dans <main>, ordre du DOM et ordre visuel respectés
  ✓ étape 10/12 franchie au clavier (Entrée sur « Continuer »)

[11/12] generate — « Générer le projet » (focus posé sur le titre)
  ordre de tabulation : 3 arrêt(s) dans <main>, ordre du DOM et ordre visuel respectés
  génération lancée à la touche Entrée, rapport annoncé sur place
  ✓ étape 11/12 franchie au clavier

[12/12] report — « Rapport de génération » (focus posé sur le titre)
  ordre de tabulation : 3 arrêt(s) dans <main>, ordre du DOM et ordre visuel respectés
  rapport atteint : projet « clavier-e2e » écrit (15 entrées sur le disque)
  dernière étape : les 12 étapes
  total : 376 appuis de Tab/Maj+Tab, 0 clic souris, 0 focus() programmé

✓ parcours clavier seul (gate M5) : réussi

✓ 2/2 parcours réussi(s) : souris (référence §3) + clavier seul (gate M5).
```

**Fichiers de la preuve :** `apps/web/e2e/harness.mjs` (socle commun),
`apps/web/e2e/keyboard.mjs` (parcours clavier), `apps/web/e2e/journey.mjs` (les deux parcours).

Le compteur d'appuis est un **indicateur**, pas un critère du gate : il dépend du point de départ de
chaque traversée (la sonde du lien d'évitement pose le focus sur `#contenu`, d'où des traversées plus
courtes). Le passage précédent, sans cette sonde, en comptait 391 ; les compteurs d'arrêts par écran
(4 / 5 / 6 / 6 / 6 / 47 / 52 / 26 / 2 / 17 / 5 / 2 / 3 / 3), eux, sont identiques d'un passage à
l'autre. Le critère est le code de sortie et les 12 étapes franchies.

**État du dépôt :** aucun commit, aucun push. Rien touché dans `packages/**`, `apps/cli/**`,
`apps/web/src/app/actions*.ts`, `apps/web/src/app/globals.css` ni `apps/web/next.config.mjs` /
`apps/web/package.json`. La case « Parcours complet §3 réalisable au clavier seul » de
`docs/roadmap.md` (ligne 576) peut être cochée par son propriétaire : ce constat en est la preuve.
