# Phase 8F.3 Revue du thème, écran par écran (clair / sombre)

**Date :** 11/10/2026
**Périmètre :** les 18 écrans du MVP de `apps/web`, dans les deux thèmes (`:root` et `[data-theme="dark"]`).
**Statut :** revue faite, quatre défauts de contraste corrigés dans `apps/web/src/app/globals.css`, deux constats laissés à l'arbitrage (voir « Ce qui n'a pas été corrigé, et pourquoi »).
**Compagnon :** [direction 8A](2026-10-11-phase8a-direction-artistique-design.md) c'est elle qui définit les tokens ; elle n'est pas modifiée ici.

---

## Méthode

Trois vérifications outillées, pas de relecture d'impression :

1. **Aucune couleur en dur dans un composant.** Recherche de `#hex`, `rgb(`, `text-white`,
   `bg-white`, `text-black`, `bg-black`, `text-gray*`, `bg-gray*` dans tous les `.tsx` de
   `apps/web/src` : **0 occurrence**. La règle 1 de la 8A tient.
2. **Toute classe `pf-*` utilisée existe.** Extraction de tous les tokens `pf-*` passés à
   `className` dans les `.tsx`, comparaison aux **24 sélecteurs `.pf-*`** de `globals.css` :
   seules **`pf-toast` et `pf-toasts`** sont des classes utilisées sans définition (les autres
   tokens `pf-*` repérés sont des `id` de formulaire ou des clés de `localStorage`) cf. défaut 4.
3. **Contraste calculé, pas estimé.** Ratios WCAG 2.2 (luminance relative) sur chaque couple
   « couleur de texte / fond » réellement produit par les classes des écrans, dans les deux
   thèmes. Seuils : **4,5:1** (texte < 18,66 px), **3:1** (frontière de composant, SC 1.4.11).
   Le tableau ci-dessous donne l'état **avant** et **après** correction.

Le thème est posé par le script anti-flash de `layout.tsx` (`data-theme` sur `<html>`) et
bascule par `theme-toggle.tsx` : les deux thèmes sont donc atteignables sans recharger, et le
parcours clavier du `test:e2e` les traverse (`getByRole('button', { name: /Thème/ })`).

---

## Défauts trouvés et corrigés

| # | Défaut | Preuve (avant → après) | Correction |
|---|---|---|---|
| 1 | **Badge accent, thème clair** : le texte `--pf-accent` sur `--pf-accent-soft` passait sous le seuil AA « Recommandé », « Choisie », « Dry-run », « Sélection expérimentale » sont en 11 px gras, donc soumis à 4,5:1. | `#b4530a` sur `#fbf0e5` = **4,47:1** → sur `#fdf5ee` = **4,66:1** | `--pf-accent-soft` clair : `#fbf0e5` → `#fdf5ee` (le badge reste un badge crème ; `--pf-accent` est inchangé, il est nommé dans la 8A) |
| 2 | **Frontière des contrôles, deux thèmes** : un `pf-input` a le fond de la carte qui le porte (`--pf-surface` des deux côtés) sa **seule** frontière est la bordure `--pf-border-strong`, mesurée sous 3:1 (SC 1.4.11). Idem pour le contour d'un `pf-btn`. | clair : `#b4b4ac` = **2,09:1** (carte) / **1,93:1** (fond) → `#8f8f88` = **3,25:1** / **3,01:1** · sombre : `#414750` = **1,90:1** / **2,04:1** → `#63666f` = **3,10:1** / **3,32:1** | `--pf-border-strong` : `#b4b4ac` → `#8f8f88` (clair), `#414750` → `#63666f` (sombre). `--pf-border` (bordures décoratives des cartes) est **inchangé** |
| 3 | **Survol du bouton principal, thème clair** : `filter: brightness(1.08)` éclaircissait l'accent et faisait **perdre** du contraste au texte blanc du bouton le survol passait sous AA alors que l'état repos est conforme. | `#ffffff` sur `brightness(1.08)` de `#b4530a` = **4,41:1** (repos : 5,02:1) → **5,67:1** | Nouveau token `--pf-accent-hover` : `#a84c09` (clair, assombrit), `#ffa64b` (sombre, valeur **identique** à l'ancien filtre : 9,54:1). `.pf-btn-primary:hover` utilise la couleur, plus de `filter` |
| 4 | **`pf-toasts` / `pf-toast` utilisées sans définition** : `toaster.tsx` monte une région `role="status"` sur chaque écran, avec `data-kind="info|success|error"` aucune de ces classes n'existe dans `globals.css`, et rien ne consomme `data-kind`. Un toast d'erreur serait donc visuellement identique à un toast de succès. | audit de classes : les deux seules classes `pf-*` utilisées sans sélecteur. **Aucun appelant** : `toast()` n'est appelé que dans les tests (`lib/toasts.test.ts`, `toaster.test.tsx`) | **Non corrigé** voir ci-dessous |

### Vérification après correction

28 couples mesurés, **0 échec** :

- clair : texte 17,58 · atténué 6,63 · atténué/surface-2 5,76 · accent/carte 5,02 · accent/fond
  4,64 · accent/accent-soft 4,66 · blanc/accent 5,02 · **blanc/accent survolé 5,67** ·
  danger/danger-soft 6,09 · ok/ok-soft 5,43 · focus/fond 6,19 · **bordure forte/carte 3,25** ·
  **bordure forte/fond 3,01** ;
- sombre : texte 15,17 · atténué 6,83 · accent/carte 8,44 · accent/accent-soft 7,83 ·
  accent-text/accent 8,79 · blanc/accent survolé 9,54 · danger/danger-soft 6,88 · focus/fond
  8,84 · **bordure forte/carte 3,10** · **bordure forte/fond 3,32**.

Les classes rendues ne changent pas : la correction est entièrement dans les valeurs de tokens.

---

## Écran par écran

« Vérifié » = les primitives de cet écran ont été passées au calcul de contraste, dans les deux
thèmes, et son balisage a été relu pour la règle « la couleur ne porte jamais seule
l'information ». Les écrans 15 à 17 et 18 consomment désormais `@buildit/ui` : leurs
`pf-btn` / `pf-badge` / `pf-hint` / `pf-error` viennent du paquet, les classes rendues sont
identiques (preuve par diff de classes, cf. `apps/web/src/app/ui-partagee.test.tsx`).

| # | Écran | Fichiers | Primitives en jeu | Constat |
|---|---|---|---|---|
| 1 | Accueil / Dashboard | `app/page.tsx` | `pf-card`, `pf-choice`, `pf-grid`, `pf-badge-accent`, `pf-btn*`, `pf-hint`, `pf-eyebrow` | conforme ; le badge accent bénéficie du défaut 1 |
| 2 | Create | `create/page.tsx` | `pf-input`, `pf-label`, `pf-choice`, `pf-grid`, `pf-hint`, `pf-btn-ghost` | conforme ; `pf-input` bénéficie du défaut 2 |
| 3 | Target | `create/target/page.tsx` | `pf-choice`, `pf-badge-accent`, `pf-hint` | conforme (`aria-pressed` + couleur, jamais la couleur seule) |
| 4 | Project Type | `create/type/{page,profiles}.tsx` | `pf-choice`, `pf-badge-accent`, `pf-btn-ghost`, `pf-label` | conforme |
| 5 | Architecture | `create/architecture/{page,options}.tsx` | `pf-choice`, `pf-badge-accent`, `pf-badge`, `pf-btn-ghost` | conforme |
| 6 | Stack Builder | `create/stack/{page,stack-options}.tsx` | `pf-input` (recherche), `pf-choice`, `pf-badge-{accent,ok,danger}`, `pf-error`, `pf-mono` | conforme ; trois tons de badge, ratios 4,66 / 5,43 / 6,09 (clair) |
| 7 | Capabilities | `create/capabilities/{page,option-list}.tsx` | `pf-choice`, `pf-badge-{accent,danger}`, `pf-error`, `pf-mono` | conforme ; l'option indisponible est `disabled` **et** porte sa raison (règle 4) |
| 8 | Environment & Secrets | `create/env/page.tsx` | `pf-card`, `pf-badge-ok`, `pf-error`, `pf-label`, `pf-mono`, `pf-hint` | conforme ; noms de variables seuls, aucun contraste de valeur secrète en jeu |
| 9 | Infrastructure | `create/infrastructure/page.tsx` | `pf-choice`, `pf-badge-accent`, `pf-error`, `pf-hint`, `pf-mono` | conforme |
| 10 | Blueprint | `create/blueprint/{page,BlueprintSummary}.tsx` | `pf-card`, `pf-input` (lien partagé), `pf-error`, `pf-title`, `pf-subtitle`, `pf-mono` | conforme ; le champ de lien bénéficie du défaut 2 |
| 11 | Dependency Graph | `graph/{page,GraphDiagram,GraphTables}.tsx` | `pf-card`, `pf-label`, `pf-hint`, `pf-mono` + `Badge` du paquet | conforme ; le SVG n'utilise que des tokens (`currentColor`, variables), vérifié : aucune couleur littérale dans `GraphDiagram.tsx` |
| 12 | File Preview | `create/preview/{page,FileTree}.tsx` | `pf-card`, `pf-badge-accent`, `pf-error`, `pf-mono`, `pf-hint` | conforme ; l'arborescence monospace reste lisible dans les deux thèmes |
| 13 | Generation Progress | `create/generate/{page,PipelineProgress}.tsx` | `pf-card`, `pf-badge`, `pf-badge-ok`, `pf-error`, `pf-btn-primary` | conforme ; la progression est aussi écrite en texte (règle 3) et `pf-fade-in` tombe à 0,01 ms sous `prefers-reduced-motion` |
| 14 | Generation Report | `create/report/{page,ReportBody}.tsx` | `pf-card`, `pf-badge-{ok,danger}`, `pf-error`, `pf-grid`, `pf-label` | conforme ; **avertissements rendus en `pf-hint`** cf. défaut 6 |
| 15 | GitHub Connection | `github/{page,view}.tsx` | `pf-card`, `pf-title`, `pf-eyebrow`, `pf-mono` (+ `text-accent` sur le code d'appareil), `pf-hint` | conforme ; `text-accent` sur carte = 5,02:1 (clair), 8,44:1 (sombre) |
| 16 | Clone | `clone/{page,view}.tsx` | `pf-input` (recherche, lien, dossier), `pf-choice`, `pf-badge`, `pf-error`, `pf-btn-primary` | conforme ; les trois champs bénéficient du défaut 2 |
| 17 | Open Local | `open/{page,view}.tsx` | `pf-input` (dossier), `pf-label`, `pf-error`, `pf-btn-primary`, `pf-mono` | conforme |
| 18 | Repository & Sharing | `repo/{page,view}.tsx` | `pf-input` (dossier, nom, description, utilisateur), `pf-choice`, `pf-label`, `pf-mono`, `pf-badge` | conforme ; les champs `pf-input` sont désormais rendus par `Field` du paquet, classes inchangées |

Écrans partagés (présents sur les 18, hors liste) : `layout.tsx` (en-tête, lien d'évitement
`pf-btn pf-sr-only-focusable`, bascule de thème), `components/wizard/shell.tsx` (`pf-card`,
`pf-title`, `pf-eyebrow`, `pf-fade-in`, progression avec `text-accent` sur le fond : 4,64:1
clair / 9,04:1 sombre), `toaster.tsx` (cf. défaut 4).

### Vérifié et conforme (pas un défaut)

- **Anneau de focus sur l'accent.** `--pf-focus` contre `--pf-accent` ne vaut que 1,33:1 (clair)
  et 1,02:1 (sombre) mais `:focus-visible` pose `outline-offset: 2px` : l'anneau est séparé du
  bouton par 2 px du fond parent, où il vaut 6,19:1 (clair) et 8,84:1 (sombre). Aucun élément
  interactif n'est sans focus visible (règle 2).
- **Couleur jamais seule.** Chaque état coloré est doublé d'un attribut : `aria-pressed` sur les
  choix, `disabled` + raison écrite sur les blocages, badge **et** libellé dans le texte.
- **Contrôles désactivés.** `opacity: 0.5` fait tomber le contraste, mais les composants inactifs
  sont exemptés par WCAG ; la raison du blocage est toujours écrite à côté.
- **Bordures décoratives des cartes.** `--pf-border` vaut 1,42:1 (clair) / 1,32:1 (sombre) sur
  `--pf-surface` : sous 3:1, mais une carte n'est pas un composant d'interface elle est
  laissée telle quelle, c'est le choix 8A (« dense, neutre »).
- **Placeholder des champs.** Couleur imposée par le navigateur, non pilotée par nos tokens, et
  chaque champ porte un `pf-label` visible : aucune information ne dépend du placeholder.
- **Deux thèmes réellement complets.** Chaque token de `:root` consommé par une classe est
  redéfini ou hérité dans `[data-theme="dark"]` ; `color-scheme` est posé dans les deux blocs
  (barres de défilement, champs natifs, `select`).

---

## Ce qui n'a pas été corrigé, et pourquoi

**Défaut 4 `pf-toasts` / `pf-toast` sans style.** Le corriger veut dire inventer l'apparence
d'un toast (position, fond, teinte par `data-kind`) : c'est un ajout de design, pas un réglage de
contraste, et **aucun écran n'appelle `toast()`** aujourd'hui (seuls les tests le font). Styliser
une région qui ne s'affiche jamais serait du code mort. À faire le jour où un écran notifie,
dans `globals.css` (la règle 8A : un style de plus se propose ici, pas dans un `.tsx`).

**Défaut 5 `--pf-shadow` défini et jamais consommé.** Le token existe dans les deux thèmes
(`0 1px 2px … , 0 10px 24px -16px …`) mais `.pf-card` n'a pas de `box-shadow` et `@theme inline`
ne l'expose pas à Tailwind. La 8A dit « une ombre discrète pour détacher une carte », l'en-tête
de `globals.css` dit « pas d'ombre portée décorative » : les deux textes se contredisent. Poser
l'ombre changerait l'allure des 18 écrans c'est exactement ce que le gate humain 8A doit
arbitrer. Signalé, non tranché ici.

**Défaut 6 `--pf-warn` / `--pf-warn-soft` définis, aucune classe ni aucun ton.** Il n'existe ni
`.pf-badge-warn` ni variante `warn` de `Badge`/`StatusMessage` : les avertissements du rapport de
génération et du plan de prévisualisation sont rendus en `pf-hint`, c'est-à-dire **visuellement
identiques à une aide**. Le corriger demande d'ajouter la classe **et** les écrans qui l'utilisent
(`create/generate`, `create/report`, `create/preview`) ces fichiers ne sont pas dans le
périmètre de cette tâche. Signalé avec la sortie à prendre : une classe `.pf-badge-warn` /
`.pf-hint-warn` ici, puis le remplacement dans les trois écrans par leur propriétaire.

---

## Ce qui reste à un humain

Le gate 8A (trois maquettes arbitrées) reste dû, et les défauts 2 et 3 en dépendent
esthétiquement : une bordure de contrôle à 3:1 est plus marquée qu'avant, et le survol du bouton
principal assombrit au lieu d'éclaircir en thème clair. Les deux sont des corrections
d'accessibilité mesurées, pas des choix de goût ; si Daniel tranche autrement, la reprise reste
bornée à `globals.css` et aux valeurs de tokens ci-dessus.

---

## Preuves d'exécution

| Commande | Résultat |
|---|---|
| `pnpm --filter @buildit/ui test` | 13 tests passés, couverture 100 % (13/13 instructions, 16/16 branches) |
| `pnpm --filter @buildit/ui typecheck` | exit 0 |
| `pnpm exec biome check` (fichiers touchés) | **0 erreur**, 4 avertissements assumés (`!important` du bloc `prefers-reduced-motion`) |
| `pnpm --filter @buildit/web build` | **exit 0** 20 routes engendrées, `@buildit/ui` transpilé depuis sa source |
| `pnpm build` (turbo) | 15/15 tâches |
| `vitest run` sur les écrans convertis + coquilles partagées | 54 tests passés (7 fichiers) dont `ui-partagee.test.tsx`, qui vérifie les classes `pf-*` rendues |

État du dépôt au moment de la revue : `pnpm typecheck` et `pnpm lint` à l'échelle du dépôt étaient
rouges sur des fichiers d'autres travaux en cours (`apps/cli` → `@buildit/doctor`,
`PF_SITE_URL` en TS4111 dans `layout.tsx`/`robots.ts`/`sitemap.ts`, dépréciation `biome.json`) —
**aucun** fichier de cette revue n'y figure. Les vérifications ci-dessus sont donc bornées aux
fichiers touchés, et le sont toutes au vert.

