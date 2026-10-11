# Phase 10 — Revue de sécurité du configurateur web (Phase 8)

**Date :** 2026-10-11 · **Périmètre :** `apps/web/src/app/actions.ts`, `actions-node.ts`, `github/**`, `clone/**`, `open/**`, `repo/**` — la surface d'attaque réelle du produit, où une Server Action est appelable par n'importe quel client qui atteint le serveur.
**Méthode :** relecture adversariale, puis un test ou une sonde pour chaque constat. Un défaut n'est déclaré corrigé que lorsque sa sonde **échouait avant** la correction ; la sortie brute de la sonde rouge est recopiée ci-dessous.

**Hors périmètre, non relu :** `apps/web/src/app/share/**` et `actions-share.ts` (un autre équipier les écrit en parallèle — la génération de lien et sa lecture restent à couvrir), `lib/*` et `components/*` (interdits d'écriture), `packages/*` (relus, **non modifiés** : leurs correctifs éventuels sont écrits ici, pas appliqués).

---

## Résultat

**Deux défauts corrigés** (un **haut**, un moyen) et **quatre risques résiduels écrits**. La suite est verte après correction : 465 tests, `typecheck` et `biome check` du périmètre sans erreur.

| # | Gravité | Constat | État |
|---|---|---|---|
| H1 | **Haute** | Le code du projet (dépôt cloné, `postinstall`) héritait de `PF_GITHUB_TOKEN` dans son environnement : un `postinstall` malveillant lisait le jeton du serveur. | **Corrigé** |
| M1 | Moyenne | `origin` était renvoyé au navigateur **avec ses identifiants** (`https://x-access-token:ghp_…@github.com/…`) et recopié dans les phrases d'erreur. | **Corrigé** |
| M2 | Moyenne-basse | Un lien (jonction) posé dans la racine de travail passe pour une destination libre : le clone écrit à travers, hors de la racine. | Ouvert, preuve fournie |
| M3 | Moyenne | `resolveLocalDirectory` accepte les chemins UNC et de périphérique : `stat`/`detectProject` sortent vers un partage SMB. | Ouvert, décision écrite |
| M4 | Moyenne | Aucun contrôle de l'en-tête `Host` (pas de `middleware.ts`) : la vérification same-origin de Next est contournable par *DNS rebinding*. Correctif **hors périmètre**. | Ouvert, **non prouvé dynamiquement** |
| M5 | Moyenne | L'installation de code non fiable n'exige aucune confirmation **côté serveur** ; un chemin absolu client est accepté pour l'ouverture. | Accepté (8B.6), documenté |
| L1 | Basse | La sortie de commande est recopiée au client (git expurgé du jeton, pnpm/npm non). | Ouvert |
| L2 | Basse | La carte des *device flows* n'est purgée qu'au démarrage d'un flux. | Ouvert |
| L3 | Basse | Existence d'un chemin local révélée par les actions. | Accepté (8B.6) |

---

## H1 — Le jeton GitHub atteignait le code du projet (corrigé)

**Où :** `packages/exec/src/index.ts:118` (`env: options.env === undefined ? process.env : { ...process.env, ...options.env }`), `packages/workspace/src/index.ts:317` (`runner.run(command.command, command.args, dir)` — aucun `env`), `apps/web/src/app/open/project.ts` (ancien `install(detection, directory, runner, options)`).

**Scénario concret.** Le serveur tourne avec `PF_GITHUB_TOKEN` défini (chemin CI/tête de série documenté par `github/session.ts:47`). L'utilisateur clone un dépôt et coche « installer », ou ouvre un projet local et lance l'installation. Le `postinstall` du dépôt lit `process.env.PF_GITHUB_TOKEN` et le poste où il veut : le jeton ouvre tous les dépôts du compte. Le même environnement est hérité par `git commit` (`ensureInitialCommit`), donc un hook du projet s'exécute avec le jeton.

**Sonde rouge** (test `sonde le risque réel…`, avant correction — la seconde assertion n'a pas été atteinte car `withoutServerSecrets` n'existait pas, la première, elle, passait) :

```
AssertionError: expected '<valeur du jeton>' to be '<absent>'  ✗ sans le garde-fou
```

Le premier `expect(brut.output).toBe(SECRET)` **passait** : un vrai processus Node lancé par `nodeCommandRunner` imprime bien `PF_GITHUB_TOKEN`.

**Correctif appliqué.**
- `open/project.ts:161` : liste fermée `SERVER_SECRETS = ['PF_GITHUB_TOKEN']`.
- `open/project.ts:169` : `withoutServerSecrets(runner)` — un exécuteur dont `options.env` vide les secrets du serveur. Posé **à l'intérieur** de `installProject` (`open/project.ts:207`) : l'écran « ouvrir » comme le clone en héritent sans pouvoir l'oublier.
- `actions-node.ts:91` : `projectRunner()` applique le même garde-fou aux commandes Git des actions (`createRepositoryAction`, `repositoryStatusAction`, `listAccess`, invitations/retraits) — `git commit` peut lancer un hook.
- `PF_GIT_TOKEN` est **exclu** de la liste : c'est la variable du *credential helper* posée explicitement par `packages/git` pour la seule commande qui en a besoin ; le test « ne touche pas aux variables ajoutées par l'appelant » le verrouille.

**Limite assumée.** `packages/exec` empile `process.env` puis `options.env` : on ne peut pas **retirer** une variable, seulement la vider. Le code du projet lit `''`. Un correctif propre appartient à `packages/exec` (`env: { ...process.env, ...options.env, ...exclusions }` ou une option `dropEnv`) — hors périmètre, écrit ici.

---

## M1 — `origin` renvoyé avec ses identifiants (corrigé)

**Où :** `repo/sharing.ts` (`repositoryStatus`, `requireGitHubRepository`, `createRepository`), affiché par `repo/view.tsx:165`, et `packages/git/src/operations.ts:248` (`origin: origin.output`).

**Scénario concret.** `.git/config` accepte `https://x-access-token:ghp_…@github.com/propriétaire/dépôt.git` — c'est la forme qu'écrivent plusieurs outils. `git remote get-url origin` la rend telle quelle ; l'écran 24 l'affiche, et la phrase de refus la recopie. Le jeton finit dans le HTML, dans l'historique du navigateur, dans la réponse JSON de la Server Action et dans toute capture d'écran.

**Sonde rouge** (sortie brute de l'assertion `expect(JSON.stringify(status)).not.toContain(TOKEN)`) :

```
Received: "{"ok":true,"directory":"C:\\Users\\…\\Temp\\pf-web-repo-AvYMCG","isRepository":true,
"hasCommit":true,"origin":"https://x-access-token:<jeton>@github.com/octocat/mon-app.git",
"github":false,"visibility":"unknown","proposedName":"pf-web-repo-AvYMCG","issues":[]}"
```

**Correctif appliqué.** `repo/sharing.ts:42` `redactOrigin()` (retire `username`/`password` d'une URL ; laisse intactes les formes `git@hôte:chemin`, qui ne portent pas de mot de passe) ; `sharing.ts:64` `githubRef()` relit l'URL **nettoyée**, si bien qu'un dépôt GitHub à identifiants reste reconnu au lieu d'être annoncé « pas sur GitHub » ; appliqué en `sharing.ts:129`, `:182` et `:243`.

**Recommandation hors périmètre.** `repositoryState` (`packages/git`) rend toujours l'`origin` brut, donc le CLI peut l'afficher tel quel. Le même nettoyage appartient au paquet, pas à l'UI.

---

## M2 — Destination : un lien dans la racine est suivi (ouvert)

**Où :** `clone/destination.ts:91` (`destinationState` utilise `stat`, qui suit les liens) et `packages/git/src/operations.ts:96` (`isEmptyDirectory`, même défaut).

**Sonde** (`suit un lien posé dans la racine — constat M2`, Windows, jonction vers un dossier vide **hors** de la racine) :

```
Test Files  1 passed (1)   →  destinationState(jonction) === 'empty'
```

Un clone est donc autorisé et écrit à travers le lien, hors de `PF_WEB_WORKSPACE`.

**Pourquoi non corrigé.** Le correctif complet n'est pas dans `destination.ts` seul : il faut comparer `realpath(destination)` à `realpath(racine)` **et** changer `isEmptyDirectory` dans `packages/git`. Un `lstat` local donnerait une fausse assurance (un ancêtre lié passe toujours). Exploitable seulement par un acteur qui a déjà écrit un lien dans la racine.

**Correctif recommandé :** `realpath` de la destination et de la racine, refus si la première ne commence pas par la seconde ; `lstat` au dernier composant ; même règle dans `packages/git`. À faire quand le serveur cessera d'être strictement local.

---

## M3 — Chemins UNC et de périphérique acceptés (ouvert, décision écrite)

**Où :** `open/project.ts:42` — `isAbsolute('\\\\serveur\\partage')` vaut `true` sous Windows, donc `resolveLocalDirectory` l'accepte, puis `stat`/`detectProject`/`install` sortent vers le partage.

**Sonde** (test Windows, comportement figé volontairement) :

```
expect(resolveLocalDirectory('\\\\serveur\\partage\\projet').ok).toBe(true)   ✓
```

`\\?\C:\…` (chemin étendu) et, sous POSIX, `//serveur/partage` passent aussi. Un partage contrôlé par un attaquant fait sortir une authentification SMB de la machine (fuite de hachage NetNTLM classique).

**Décision : accepté pour l'instant**, pour deux raisons écrites : le serveur n'écoute que sur `127.0.0.1` (décision 8B.6) et un projet sur un partage réseau est un usage légitime du persona « entreprise » (§2, persona 4). À rouvrir si le serveur devient joignable autrement que par la boucle locale, ou si le produit tranche « dossiers locaux uniquement ». Correctif proposé alors : refuser `\\`/`//` en tête **et** `\\?\` dans `resolveLocalDirectory`.

---

## M4 — Aucun contrôle de `Host` : surface *DNS rebinding* (ouvert, hors périmètre, non prouvé)

**Où :** `apps/web/src/middleware.ts` **n'existe pas** (`glob` : aucun fichier) ; `next.config.mjs` ne configure ni `serverActions.allowedOrigins` ni de contrôle d'hôte.

**Raisonnement.** La vérification *same-origin* des Server Actions compare `Origin` et l'hôte de la requête. En *DNS rebinding*, un site attaquant sert sa page puis fait résoudre son domaine vers `127.0.0.1:PORT` : `Origin` et `Host` portent alors **le même nom d'attaquant**, la comparaison passe, et les actions locales (génération, clone, installation, création de dépôt) deviennent appelables depuis la page. La liaison à `127.0.0.1` ne protège pas de ce chemin, qui vient du navigateur de la victime.

**Statut : non prouvé dynamiquement** — je n'ai pas construit ni démarré le serveur (consigne : pas de `next build` en parallèle des autres équipiers). La preuve à faire au build final du Lead : `curl -H 'Host: attaquant.example' http://127.0.0.1:PORT/` doit répondre 200 aujourd'hui.

**Correctif, hors périmètre d'écriture :** un `apps/web/src/middleware.ts` qui refuse (421/400) toute requête dont l'hôte n'est pas `127.0.0.1`, `localhost` ou `[::1]`. C'est la seule défense réelle contre le rebinding ; `allowedOrigins` ne la remplace pas.

---

## M5 / L3 — Chemin absolu et confirmation serveur (accepté, documenté)

`installProjectAction`, `inspectProjectAction`, `repositoryStatusAction`, `createRepositoryAction` et les actions d'accès acceptent **n'importe quel chemin absolu** (`open/project.ts:42`), et l'installation exécute les scripts du projet sans exiger de jeton de confirmation côté serveur. §18bis demande une confirmation : elle vit dans l'UI (bouton, commande affichée, `ignoreScripts` coché par défaut dans `clone/page.tsx:21`), pas dans l'action.

**Pourquoi accepté :** décision 8B.6 — serveur local, même utilisateur, même machine. Un processus local peut déjà exécuter du code ; franchir une Server Action ne lui donne aucun privilège nouveau. Le refus qui compte est celui du réseau : il repose sur la vérification d'origine de Next **et** sur M4.

**Ce qui le rend acceptable durablement :** (1) traiter M4 ; (2) si le serveur est un jour exposé, exiger un nonce émis par le serveur (double-submit) sur `installProjectAction` et `createRepositoryAction`, et restreindre l'ouverture aux chemins sous une racine déclarée.

L3 (révéler « ce chemin existe / n'existe pas ») relève du même raisonnement : légitime en local, à revoir avec l'exposition réseau.

---

## L1 / L2 — Risques bas

- **L1 — sortie de commande recopiée.** `WORKSPACE_INSTALL_FAILED` (`packages/workspace/src/index.ts:337`) renvoie les 20 dernières lignes de `pnpm install` au client. `packages/git` expurge déjà `PF_GIT_TOKEN` (`operations.ts:88`) ; pnpm/npm n'ont pas d'équivalent. Un jeton de registre imprimé par l'outil finirait dans la réponse. Recommandation : appliquer la même idée (`redact`) à la frontière web, avec la liste `SERVER_SECRETS` déjà en place.
- **L2 — carte des `device_code`.** `github/device.ts:56` : la carte n'est purgée qu'au démarrage d'un flux (`prune` dans `startDevice`). Un client local peut la faire grossir, borné par l'expiration GitHub et par les appels réseau que chaque entrée exige. Négligeable en local ; à borner si le serveur change de modèle.

---

## §24 point par point

| Point du §24 | Constat | Preuve |
|---|---|---|
| « Ne pas exposer 100 technologies… » | Hors sécurité | — |
| Dry-run avant écriture, rollback | `previewManifestAction` n'écrit rien ; `generateProjectAction` refuse un dossier existant ; rollback dans le générateur (revue Phase 5) | `actions.test.ts` |
| Variables d'environnement sans valeur sensible | Le brouillon ne porte que des **noms** (`DraftState.envVarNames`) ; `loadEnvVarsAction` rend des noms | `actions.test.ts`, `lib/draft.ts` |
| Moteur indépendant de l'UI | Le web passe par `actions.ts` / `actions-node.ts` uniquement | relecture |
| Local-first / confidentialité | Le serveur de `pf web` n'écoute que sur `127.0.0.1` | `apps/web/e2e/journey.mjs:77` |
| **Jeton GitHub : trousseau uniquement, jamais loggé, jamais dans un fichier** | Le jeton va du trousseau (ou de `PF_GITHUB_TOKEN`) au client GitHub ; aucune vue ne le porte ; le trousseau le passe par **entrée standard** (`packages/github/src/token-store.ts:117-127`) ; `git` l'obtient par variable d'environnement, jamais par argument, et la sortie est expurgée. **Manquait : il était hérité par les commandes de projet → H1 corrigé.** L'`origin` pouvait en porter un → **M1 corrigé**. | `session.test.ts`, `clone.test.ts:235`, `sharing.test.ts` |
| **Clonage : lien validé avant Git, pas d'argument `-`, https/ssh, pas de shell, pas de prompt caché** | `parseRemote` (liste blanche, refus `ext::`, `file://`, identifiants dans l'URL) ; `git clone -- <url> <cible>` ; `protocol.ext.allow=never`, `GIT_TERMINAL_PROMPT=0` | `packages/git/src/remote.ts`, `operations.ts` + `clone.test.ts` |
| **Code cloné non fiable : scripts annoncés, `--ignore-scripts` proposé, aucune commande sans confirmation** | L'UI coche « sans scripts » par défaut et décrit le risque ; la commande exacte est affichée. **La confirmation n'est pas exigée par le serveur → M5.** | `clone/page.tsx:21`, `clone/view.tsx:248`, `open/project.test.ts` |
| Dépôt privé par défaut | `isPrivate: record['isPrivate'] !== false` — seul un `false` explicite rend public | `actions-node.ts:205` |
| Pas d'écriture hors cible (génération) | `parseManifest` + `resolve` + `startsWith(root + sep)` + refus d'écraser | `actions.test.ts` |
| Pas d'écriture hors cible (clone) | Destination **relative** seulement : absolu, `..`, `\`, UNC, lecteur, `C:..`, `\\?\`, `%2e%2e`, `~`, contrôle refusés | `clone.test.ts` (nouveaux cas) |
| Pas d'écriture à travers un lien | **Non tenu pour la destination de clone → M2** (génération : revue Phase 5) | `clone.test.ts` |
| Commandes sans shell ; aucune valeur client en argument dangereux | `spawn(..., { shell: false })` ; le lien est validé puis séparé par `--` ; chemins projet validés avant tout `spawn` ; tirage aléatoire des `device_code` | `packages/exec`, `clone.test.ts`, `open/project.test.ts` |

---

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `apps/web/src/app/open/project.ts` | `SERVER_SECRETS`, `withoutServerSecrets`, appliqué dans `installProject` |
| `apps/web/src/app/actions-node.ts` | `projectRunner()` ; tous les runners des actions passent par lui |
| `apps/web/src/app/repo/sharing.ts` | `redactOrigin`, `githubRef` ; trois affichages/recopies nettoyés |

## Tests négatifs ajoutés

| Fichier | Test | Rouge avant correction |
|---|---|---|
| `open/project.test.ts` | « neutralise `PF_GITHUB_TOKEN` dans l'environnement de la commande lancée » | oui (H1) |
| `open/project.test.ts` | « sonde le risque réel : sans le garde-fou, le processus hérite du jeton » | oui (H1) |
| `open/project.test.ts` | « ne touche pas aux variables ajoutées par l'appelant (`PF_GIT_TOKEN`) » | oui (H1) |
| `open/project.test.ts` | « accepte un chemin UNC — constat M3, non corrigé » | comportement figé, vert |
| `repo/sharing.test.ts` | « retire les identifiants de `origin` dans l'état du dépôt » | oui (M1) |
| `repo/sharing.test.ts` | « ne recopie pas l'identifiant dans la phrase de refus du partage » | oui (M1) |
| `clone/clone.test.ts` | « refuse les contournements qui ne dépendent pas de la plateforme » | vert (garde-fou confirmé) |
| `clone/clone.test.ts` | « refuse UNC, lecteur, chemin étendu et unité relative (Windows) » | vert (garde-fou confirmé) |
| `clone/clone.test.ts` | « suit un lien posé dans la racine — constat M2, non corrigé » | comportement figé, vert |

## Vérifications (sorties brutes)

```
pnpm --filter @buildit/web test
  Test Files  47 passed (47)
  Tests       465 passed (465)
  Statements 98.72% | Branches 95.09% | Functions 98.41% | Lines 98.66%   (seuils 90)

pnpm --filter @buildit/web typecheck
  → aucune sortie d'erreur, code de sortie 0

pnpm exec biome check apps/web/src/app/actions.ts apps/web/src/app/actions-node.ts \
  apps/web/src/app/open apps/web/src/app/clone apps/web/src/app/repo apps/web/src/app/github
  Checked 26 files … No fixes applied                     (code de sortie 0)

pnpm exec biome check apps/web
  Found 3 errors  — tous hors périmètre et en cours d'écriture :
  create/blueprint/page.tsx (format + organizeImports), share/view.tsx (organizeImports)
```

## Ce qui reste ouvert

1. **M2** — `realpath` de la destination contre la racine (`destination.ts` **et** `packages/git`).
2. **M3** — UNC/périphériques, à trancher avec le produit (dossier local uniquement ?).
3. **M4** — `middleware.ts` validant `Host` ; **à prouver au build final** (`curl -H 'Host: …'`).
4. **M5** — nonce de confirmation serveur si le serveur cesse d'être strictement local.
5. **H1, seconde moitié** — une option `dropEnv` dans `packages/exec`, pour retirer la variable au lieu de la vider.
6. **M1, seconde moitié** — nettoyage de l'`origin` dans `packages/git`, pour le CLI.
7. `share/**` et `actions-share.ts` : non relus (écriture concurrente) — le lien de partage en lecture seule reste la plus grosse zone non couverte de la Phase 8/9.
