# Revue de code Phase 10.2, diff cumulé `origin/main...HEAD`

Branche : `feat/phase8-web-socle`, tête `dab27d4`. 17 commits, 160 fichiers, 22 246 insertions / 41 suppressions.
Skills suivis : `code-review` (niveau `high`, méthode obligatoire), `cavecrew` (jugée et retenue dans son principe, voir « Méthode »).
Verdict : **changes-requested** 0 critical, 3 major, 5 minor. `10.2` peut être cochée comme *revue faite* ; elle ne peut pas être cochée comme *aucun finding major* avant correction des trois majors.

## Méthode

La revue a été conduite en lisant le code réel à `HEAD`, pas l'intention, et en vérifiant chaque garde-fou par sa sonde. Les commandes de preuve sont données à côté de chaque finding ; elles sont rejouables telles quelles.

Deux écarts au plan, assumés et écrits ici :

1. **Le périmètre annoncé ne correspond pas au diff.** La tâche décrit `packages/generator`, `packages/registry`, `packages/github`, `packages/git` comme les zones les plus denses. Le diff mesuré (`git diff --numstat origin/main...HEAD`, agrégé par répertoire) ne les touche pas du tout :

   ```text
   apps/web           files=125  +17006
   docs/superpowers   files=3    +1554
   docs/guide         files=9    +1512
   pnpm-lock.yaml     files=1    +1030
   apps/cli           files=11   +858
   docs/roadmap.md    files=1    +75
   docs/{cli,README,llms.txt}  3 fichiers  +136
   PROJECT_CONTEXT.md files=1    +32
   packages/exec      files=2    +22   <- seul paquet du moteur touché
   README.md, biome.json, .gitignore, package.json  4 fichiers  +21
   ```

   Le seul changement dans `packages/exec` est un commentaire de 5 lignes plus un `/* v8 ignore next */` (`git diff origin/main...HEAD -- packages/exec/src/index.ts`). Ce diff est donc **Phase 8 (web) + Phase 9 (partage) + début Phase 11 (docs)**, pas une revue du moteur.

2. **La revue déléguée par paquet n'a pas pu être faite.** Le harnais refuse la création de sous-agents depuis un coéquipier : les six délégations `cavecrew-reviewer` ont échoué avec `Error: subagent depth 2 exceeds maxDepth 1`. La revue a donc été faite en ligne, en ciblant les ~5 500 lignes de source non-test du diff et en traitant le reste par lectures ciblées et `grep`. Conséquence : la couverture n'est pas exhaustive, et la section « ce qui n'a pas été couvert » dit exactement où.

3. **L'arbre de travail a été modifié par d'autres coéquipiers pendant la revue.** `git status --short` relevait `M apps/cli/src/commands/add.ts`, `M apps/web/next.config.mjs`, `M apps/web/package.json`, `M apps/web/src/lib/draft-to-manifest.ts`, `M packages/registry/src/index.ts`, `?? packages/registry/src/slots.ts(.test.ts)`, `?? packages/ui/`. Tout ce qui suit décrit `HEAD` (`dab27d4`) : `next.config.mjs` à `HEAD` ne contient pas `@buildit/ui`, et le `draft-to-manifest.ts` lu est celui de `HEAD` (`git show HEAD:...`). Une revue du diff final devra être refaite après stabilisation des écritures concurrentes.

Aucun fichier de code n'a été modifié, aucun commit, aucun push. La seule écriture est ce rapport.

## Findings

### MAJOR-1 le garde-fou d'environnement ne vide qu'une seule variable

`apps/web/src/app/open/project.ts:161` (liste) et `:175` (fusion)

**Ce qui est faux.** `withoutServerSecrets` promet, dans son propre commentaire (`:164`), un exécuteur « dont les commandes **enfants** ne reçoivent aucun secret du serveur ». Le `docs/roadmap.md:665` écrit la même chose : « les secrets du serveur sont vidés pour toute commande issue d'une action, `PF_GIT_TOKEN` excepté ». Le code ne vide que `PF_GITHUB_TOKEN` :

```ts
const SERVER_SECRETS = ['PF_GITHUB_TOKEN'] as const;              // :161
run: (command, args, cwd, options) =>
  runner.run(command, args, cwd, { ...options, env: { ...options?.env, ...scrubbed } }),  // :175
```

**Preuve (exécutée sur `HEAD`, sortie observable).** Le probe demande à un vrai processus enfant la valeur de trois variables après passage par le garde-fou :

```powershell
cd D:\Projets\BuildIt\apps\web
node -e "const j=require('D:/Projets/BuildIt/node_modules/jiti');const c=j.createJiti(process.cwd()+'/package.json');(async()=>{process.env.PF_GIT_TOKEN='ghp_probe';process.env.AUTRE_SECRET='secret-probe';process.env.PF_GITHUB_TOKEN='ghp_github';const m=await c.import('./src/app/open/project.ts');const e=await c.import('@buildit/exec');const r=await m.withoutServerSecrets(e.nodeCommandRunner).run(process.execPath,['-p','JSON.stringify({PF_GIT_TOKEN:process.env.PF_GIT_TOKEN,AUTRE_SECRET:process.env.AUTRE_SECRET,PF_GITHUB_TOKEN:process.env.PF_GITHUB_TOKEN})'],process.cwd());console.log('PROBE '+r.output)})()"
```

```text
PROBE {"PF_GIT_TOKEN":"ghp_probe","AUTRE_SECRET":"secret-probe","PF_GITHUB_TOKEN":""}
```

`PF_GITHUB_TOKEN` est bien vidé ; `PF_GIT_TOKEN` un jeton de forme GitHub et toute autre variable secrète de l'environnement passent intactes. Le chemin emprunté est celui de l'installation d'un dépôt cloné (`installProject` → `install`, `open/project.ts:207`) et des hooks `git` : du code non fiable (§18bis).

**Ce que la suite de tests ne peut pas voir.** `apps/web/src/app/open/project.test.ts` sonde le risque réel (un vrai processus Node, `:304-327`) mais uniquement sur `PF_GITHUB_TOKEN` ; le test `:329-336` verrouille le comportement inverse une variable posée par l'appelant (`PF_GIT_TOKEN` via `options.env`) doit survivre. Aucun test ne couvre `PF_GIT_TOKEN` **hérité de `process.env`**, qui est le trou.

**Correctif proposé.**

1. Étendre la liste : `['PF_GITHUB_TOKEN', 'PF_GIT_TOKEN', 'GITHUB_TOKEN', 'GH_TOKEN', 'NPM_TOKEN']`, ou passer à une liste d'autorisation d'environnement (`PATH`, `HOME`, `TEMP`, `SystemRoot`, `ComSpec`, `PATHEXT`, `APPDATA`, `LOCALAPPDATA`).
2. Inverser l'ordre de la fusion en `env: { ...scrubbed, ...options?.env }`. Sans cette inversion, ajouter `PF_GIT_TOKEN` à la liste casserait `git push` : `packages/git` le pose par `options.env` pour la seule commande qui en a besoin (`packages/git/src/operations.ts:57-81`), et l'ordre actuel donne la victoire au scrub.
3. Ajouter la sonde négative manquante : `process.env.PF_GIT_TOKEN` posé, commande lancée par `withoutServerSecrets`, l'enfant doit lire `''`. Le test existant `:329-336` reste vert avec ce correctif.

**Impact.** Un `postinstall` ou un hook `git` d'un dépôt cloné non fiable lit un jeton de l'environnement du serveur et peut l'exfiltrer. C'est la classe exacte de H1, dont la fermeture est annoncée au `docs/roadmap.md:665` et conditionne la case du gate M6 « 0 finding `high` de `security-review` ».

Sévérité **major** et non critical : le jeton propre à l'application (`PF_GITHUB_TOKEN`, celui du trousseau et du device flow) est bien neutralisé, et la fuite suppose qu'un jeton soit exporté dans le shell qui lance `pf web`.

### MAJOR-2 le contrôle de `Host` n'a aucun test

`apps/web/src/middleware.ts` (38 lignes, fichier entier)

**Ce qui est faux.** Le fichier n'est pas incorrect il est **non prouvé automatiquement**. `apps/web/src/middleware.ts` est la seule porte d'accès au serveur local (décision 8B.6 : même processus Node que le moteur, droit d'écriture disque, lecture du trousseau GitHub). Il n'existe aucun test : ni unitaire, ni e2e.

**Preuve.**

```text
$ git grep -n "middleware" -- apps/web/src apps/web/e2e
apps/web/src/middleware.ts:24:export function middleware(request: NextRequest): NextResponse {

$ (glob apps/web/**/middleware*)   -> apps/web/src/middleware.ts  + artefacts .next/** (build)
$ git grep -nE "Host|403|attaquant" -- apps/web/e2e   -> 0 résultat
```

La seule preuve existante est une note manuelle, `docs/roadmap.md:667` : « `200` en local, **`403`** avec `Host: attaquant.example` ». Or `PROJECT_CONTEXT.md:105` pose comme règle non négociable : « Un garde-fou n'est validé que par un **test négatif** on prouve qu'il rejette, pas qu'il passe. »

**Correctif proposé.** Un test unitaire de `middleware()` couvrant les deux sens :

- acceptés : `127.0.0.1:4173`, `localhost`, `LOCALHOST:3000`, `[::1]:4173` → `NextResponse.next()` (pas un 403) ;
- refusés : `attaquant.example`, `127.0.0.1.attaquant.example`, `localhost.` (FQDN à point final), en-tête `Host` absent → 403.

Et, dans `apps/web/e2e/probe.mjs` (qui existe déjà, 27 lignes), une requête sur le serveur réel avec `Host: attaquant.example`, pour que la preuve du roadmap devienne une assertion rejouable.

**Impact.** Le seul contrôle d'accès du serveur local est supprimable sans qu'aucun test ne tombe. Une régression sur `config.matcher` (`/:path*`) ou sur `LOCAL_HOSTS` ne se verrait qu'à la relecture.

### MAJOR-3 la couverture de `apps/web` ne mesure pas `apps/web`

`apps/web/vitest.config.ts:34`, à rapprocher de `docs/roadmap.md:674`

**Ce qui est faux.**

```ts
coverage: {
  provider: 'v8',
  include: ['src/lib/**/*.ts'],                                  // :34
  thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },  // :35
}
```

Les seuils ne s'appliquent qu'à `src/lib/**`. Les 18 écrans, les Server Actions (`actions.ts`, `actions-node.ts`, `actions-share.ts`), le codec de partage, `clone/destination.ts`, `clone/clone.ts`, `repo/sharing.ts`, `github/*` soit l'essentiel des ~9 000 lignes de `src/app/**` ne sont ni au numérateur ni au dénominateur. Le `docs/roadmap.md:674` coche pourtant la case du gate M6 « Couverture globale ≥ 80 %, ≥ 90 % sur `compatibility` et `generator` » avec « `apps/web` **98,7 %** ». Le chiffre est exact ; son étiquette est fausse.

**Preuve.**

```text
$ git grep -n "include" -- apps/web/vitest.config.ts
apps/web/vitest.config.ts:34:      include: ['src/lib/**/*.ts'],

$ git grep -n "98,7" -- docs/roadmap.md
docs/roadmap.md:674:- [x] Couverture globale ≥ 80 %, ≥ 90 % sur `compatibility` et `generator` `compatibility` 98,5 %, `generator` 98,9 %, `apps/web` 98,7 %.
```

**Correctif proposé.** Soit élargir `include` à `['src/**/*.ts']` en excluant `**/*.test.*` et `e2e/**`, puis faire tomber les seuils sur le chiffre réel (ce qui est le travail) ; soit écrire « `apps/web` (`src/lib`) 98,7 % » dans le roadmap et ajouter la mesure de `src/app/**` comme point ouvert de la Phase 10.3.

**Impact.** Une case du gate M6 est cochée sur une métrique dont la portée est plus étroite que ce qu'elle laisse croire exactement ce que 10.2 doit empêcher.

### MINOR-1 la création du dossier de destination n'est pas atomique

`apps/web/src/app/actions.ts:140-157`

**Ce qui est faux.** Le refus d'écraser repose sur un test d'existence puis une écriture, sans exclusion mutuelle :

```ts
const directory = resolve(root, manifest.value.name);   // :149
if (!directory.startsWith(root + sep)) { ... }          // :150
if (await exists(directory)) { return refused([...]); } // :153
await mkdir(root, { recursive: true });                 // :157
const result = await generateProject(manifest.value, directory);  // :158
```

Deux Server Actions concurrentes (deux onglets, rejeu du POST par le navigateur) passent toutes les deux le test `:153` et écrivent dans le même dossier. `generateProject` recalcule le plan et écrit sans refuser un dossier existant (`packages/generator/src/pipeline.ts:360-378`), donc la seconde écriture n'est pas arrêtée.

**Preuve.** Lecture de `actions.ts:140-158` ; absence de tout verrou dans `apps/web/src/app/actions.ts` (`git grep -n "mkdir" -- apps/web/src/app/actions.ts` → `:157` seulement). Le même trou existe côté clone (`clone/clone.ts:101` puis `cloneRepository`), mais `packages/git` refait le contrôle (`packages/git/src/operations.ts:101` : `return (await readdir(path)).length === 0;`), donc le risque y est fermé.

**Correctif proposé.** Remplacer le test d'existence par une création exclusive : créer `root` si besoin, puis `await mkdir(directory, { recursive: false })` en traitant `EEXIST` comme le refus actuel. L'exclusivité du `mkdir` ferme la course sans verrou applicatif.

**Impact.** Deux générations simultanées du même nom mélangent leurs fichiers dans un dossier ; les deux répondent `ok`.

### MINOR-2 la racine de travail est définie deux fois

`apps/web/src/app/clone/destination.ts:16-23` et `apps/web/src/app/actions.ts:113-118`

**Ce qui est faux.** Deux fonctions identiques, dans deux modules, avec deux appelants différents :

| Fichier | Fonction | Valeur par défaut |
|---|---|---|
| `actions.ts:113-118` | `workspaceRoot()` (privée) | `join(homedir(), 'buildit')`, surcharge `PF_WEB_WORKSPACE` |
| `clone/destination.ts:16-23` | `webWorkspaceRoot()` (exportée) | idem, à l'identique |

Le commentaire de `destination.ts:11-13` l'assume : « recopiée ici parce que `actions.ts` est réservé au moteur et n'exporte pas la sienne ».

**Preuve.** `git grep -n "PF_WEB_WORKSPACE" -- apps/web/src` → `actions.ts:114` et `clone/destination.ts:19`.

**Correctif proposé.** Extraire `webWorkspaceRoot` dans un module neutre (par exemple `apps/web/src/lib/workspace-root.ts`), l'exporter, et l'importer depuis `actions.ts` comme depuis `destination.ts`.

**Impact.** Aucune divergence aujourd'hui (vérifié : les deux implémentations sont identiques), mais la génération et le clone écrivent sous des racines calculées par deux code différents. Le jour où l'un change de défaut, la moitié de l'application écrit ailleurs.

### MINOR-3 les grammaires de nom sont dupliquées entre le CLI et le web

`apps/web/src/app/repo/sharing.ts:197` et `:362`, à rapprocher de `apps/cli/src/commands/repo.ts:24` et `apps/cli/src/commands/collab.ts:21`

**Ce qui est faux.** Le commentaire de `repo/sharing.ts:24-26` affirme « Rien n'est dupliqué du CLI ». Les règles de validation, elles, le sont mot pour mot :

| Règle | CLI | Web |
|---|---|---|
| Nom de dépôt GitHub | `apps/cli/src/commands/repo.ts:24` `/^[A-Za-z0-9._-]{1,100}$/` | `apps/web/src/app/repo/sharing.ts:197` identique |
| Nom d'utilisateur GitHub | `apps/cli/src/commands/collab.ts:21` `/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/` | `apps/web/src/app/repo/sharing.ts:362` identique |

**Preuve.**

```text
$ git grep -n "A-Za-z0-9._-\]{1,100}" -- apps
apps/cli/src/commands/repo.ts:24:const REPO_NAME = /^[A-Za-z0-9._-]{1,100}$/;
apps/web/src/app/repo/sharing.ts:197:const REPOSITORY_NAME = /^[A-Za-z0-9._-]{1,100}$/;

$ git grep -n "A-Za-z0-9-\]{0,38}" -- apps
apps/cli/src/commands/collab.ts:21:const USERNAME = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
apps/web/src/app/repo/sharing.ts:362:const USERNAME = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
```

Les rôles, eux, viennent bien du paquet (`ROLES` de `@buildit/github`, `sharing.ts:496`) le modèle est donc déjà là.

**Correctif proposé.** Déplacer ces deux expressions dans `packages/github` (à côté de `ROLES`) et les importer des deux applications.

**Impact.** Une correction d'un côté ne suit pas l'autre : le CLI et l'UI accepteraient alors deux ensembles de noms différents, ce qui contredit la promesse « mêmes choix ⇒ même résultat ».

### MINOR-4 la visibilité d'un dépôt coûte un listage complet à chaque affichage

`apps/web/src/app/github/repositories.ts:77-97`, appelé par `apps/web/src/app/repo/sharing.ts:144-146`

**Ce qui est faux.** `repositoryVisibility` n'obtient pas un dépôt : il liste tous les dépôts accessibles au compte (jusqu'à 100, les plus récemment modifiés) puis cherche une correspondance en minuscules. Il est appelé depuis `repositoryStatus`, donc depuis `repositoryStatusAction`, donc à chaque rendu de l'écran 24.

**Preuve.** Lecture de `repositories.ts:77-97` (`new GitHubClient({...}).listRepositories()`) et de `sharing.ts:144-146`. Le commentaire `repositories.ts:71-76` documente le contournement : « `packages/github` n'expose pas de lecture d'un dépôt par son nom ».

**Correctif proposé.** Exposer `GET /repos/{owner}/{repo}` dans `packages/github` (méthode `repository(owner, name)`) et remplacer le listage. En attendant, mémoriser le résultat pour la durée du rendu.

**Impact.** Un appel d'API GitHub inutile par affichage, et une visibilité « inconnue » donc affichée comme telle pour tout dépôt sorti des 100 plus récents, alors que le dépôt existe.

### MINOR-5 l'attente du device flow bloque une Server Action jusqu'à 15 minutes

`apps/web/src/app/github/device.ts:142-171`, appelé par `apps/web/src/app/github/page.tsx:56`

**Ce qui est faux.** `githubWaitDeviceAction` est une Server Action qui attend la saisie du code côté GitHub. La boucle vient de `packages/github/src/device-flow.ts:113` (`while (waited <= code.expiresIn)`) avec `expiresIn` par défaut **900 secondes** (`device-flow.ts:90`). `page.tsx:56` l'attend immédiatement après `githubStartDeviceAction`. Si l'utilisateur ne saisit jamais le code (onglet fermé, navigation), la requête HTTP reste ouverte et le serveur continue d'interroger GitHub toutes les `interval` secondes pendant un quart d'heure ; rien n'annule l'attente et `pending` (`device.ts:56`) n'est purgé qu'à l'expiration.

**Preuve.** Lecture de `device.ts:142-171`, `github/page.tsx:46-61`, et :

```text
$ git grep -n "while (waited" -- packages/github/src/device-flow.ts
packages/github/src/device-flow.ts:113:  while (waited <= code.expiresIn) {
$ git grep -n "expires_in" -- packages/github/src/device-flow.ts
packages/github/src/device-flow.ts:90:    expiresIn: Number(body['expires_in'] ?? 900),
```

**Correctif proposé.** Borner l'attente de l'action (par exemple 60 s) et rendre une vue « toujours en attente » que le client rejoue, ou déplacer la boucle côté client avec un intervalle borné côté serveur.

**Impact.** Ressource serveur retenue sans possibilité d'annulation, et bouton définitivement désactivé (`busy`) pour l'utilisateur qui a fermé la fenêtre GitHub.

## À vérifier

Faute de preuve, ces points ne sont pas des findings.

- **A1 la revue porte sur `HEAD`, pas sur l'arbre de travail.** Des fichiers ont été modifiés et créés par d'autres coéquipiers pendant la revue. Tout ce rapport décrit `HEAD` (`dab27d4`). Sonde : `git status --short`, puis relire les fichiers listés dans « État à la remise » tels qu'ils seront fusionnés. `packages/registry/src/slots.ts`, `packages/doctor/` et `packages/ui/` sont hors de ce diff et donc hors de cette revue.
- **A2 `pnpm ci:local` et `pnpm test:e2e` n'ont pas été relancés.** Les exécuter maintenant testerait un arbre modifié par trois autres coéquipiers, pas le diff examiné. Sonde : `pnpm ci:local` puis `pnpm test:e2e` **après** l'arrêt des écritures concurrentes. L'état « vert aujourd'hui » est repris tel quel du `PROJECT_CONTEXT.md`.
- **A3 `PF_SHARE_BASE_URL` franchit la frontière client.** `apps/web/src/app/actions-share.ts:44-45` rend cette variable d'environnement serveur au navigateur via une Server Action. La valeur n'est pas secrète par nature (une origine publique) et la Server Action est de toute façon joignable par toute page servie par cette origine, mais c'est la seule variable d'environnement qui sort du serveur. Sonde : décider explicitement la garder, ou rendre une constante vide et faire calculer l'origine par `window.location.origin` (que `codec.ts:79-82` sait déjà faire).
- **A4 les affirmations des nouveaux guides ne sont pas exécutées.** `docs/guide/confidentialite.md:44` (fichier `0600`, dossier `0700`), `docs/cli.md`, `docs/README.md`, `docs/llms.txt`, les 9 fichiers de `docs/guide/` : lus par endroits, pas vérifiés ligne par ligne contre le comportement. Sonde : `pnpm pf key status` avec un `PF_CONFIG_DIR` temporaire, puis contrôle des permissions du fichier engendré.
- **A5 le décompte « 243 troncatures » (`docs/roadmap.md:638`)** n'a pas été recompté. Sonde : `pnpm --filter @buildit/web exec vitest run src/app/share/codec.test.ts` et lire le nombre de cas du `it.each`.
- **A6 `apps/web/e2e/journey.mjs` (324 lignes) n'a pas été lu ligne à ligne.** La couverture « 12 étapes, clavier seul, reprise du brouillon » n'est donc pas re-prouvée ici. Sonde : `pnpm test:e2e`.
- **A7 `pf web --port` sans valeur.** `commands/web.ts:83-87` déclare `port: { type: 'string' }` et `parseArgs` lève `ERR_PARSE_ARGS_INVALID_OPTION_VALUE` sur une option à valeur manquante ; `web()` n'entoure pas l'appel d'un `try`. Je n'ai pas lu `apps/cli/src/cli.ts`, donc je ne sais pas si l'exception est rattrapée en amont pour rendre une erreur d'usage plutôt qu'une pile. Sonde : `pnpm pf web --port` et lire la sortie (même question pour `pf share --url`).

## Ce qui est sain

Vérifié en lisant le code réel ; ces points ne demandent pas de correction.

- **`middleware.ts:17-32` la logique, elle, est saine et échoue du bon côté.** `hostName` retire le port (`:\d+$`) et met en minuscules ; un hôte absent rend `''`, donc 403. Aucun contournement trouvé : `127.0.0.1.attaquant.example`, `localhost.` (FQDN à point final), `[::ffff:127.0.0.1]` tombent tous en 403. Seul le test manque (MAJOR-2).
- **`open/project.ts:169-177` le garde-fou fonctionne pour la variable qu'il traite**, et il est prouvé par une sonde réaliste (un vrai processus Node, `project.test.ts:304-327`), pas par une assertion sur un faux.
- **`share/codec.ts:117-147` le décodage d'une charge hostile ne lève jamais.** Chaque échec rend une phrase : base64url invalide (`:34`), `atob` en échec (`:40-44`), UTF-8 non fatal (`:127` `TextDecoder('utf-8', { fatal: true })`), JSON corrompu (`:133`), manifest refusé (`:137`). `payloadFromHash` (`:92-99`) décode `%` sans jamais lever.
- **Décision 9.1 tenue : le fragment ne va pas au serveur.** `apps/web/src/app/share/page.tsx` est un composant serveur sans `searchParams`, et la lecture passe par `window.location.hash` dans `share/view.tsx` (`:107-121`). `shared-link.tsx:25-26` ne garde que `pathname`+`search`+`hash` et jette l'origine collée, donc un lien étranger ne peut pas être suivi.
- **Le codec CLI et le codec web sont confrontés au même littéral.** `apps/cli/src/commands/share.ts:36` (`Buffer…toString('base64url')`) et `apps/web/src/app/share/codec.ts:29` (`btoa` + substitutions) sont deux implémentations indépendantes, et leurs deux suites comparent au **même** littéral : `apps/cli/src/commands/share.test.ts:31` et `apps/web/src/app/share/codec.test.ts:42`. La dérive de l'une fait tomber l'autre.
- **Aucun chemin venu du client n'atteint le disque sans validation.** `resolveLocalDirectory` (`open/project.ts:33-46`) exige un chemin absolu sans caractère de contrôle ; `resolveDestination` (`clone/destination.ts:47-81`) refuse l'absolu, `..`, `.`, les caractères hors `[A-Za-z0-9._-]` et re-vérifie la containment sous la racine (`:73-79`). Toutes les actions qui touchent la machine passent par l'un ou l'autre (`actions-node.ts:164-248`).
- **Le jeton GitHub ne sort jamais du serveur.** `GithubStatusView` (`github/session.ts:100-107`) ne porte ni jeton ni valeur secrète ; `device.ts:20-23` garde le `device_code` derrière un `randomUUID()` (`:110`) et ne rend au navigateur que le code court, l'URI et les délais ; `session.ts:42-51` lit l'environnement puis le trousseau, sans repli en clair.
- **`redactOrigin` (`repo/sharing.ts:42-55`) couvre les deux formes** `https://x-access-token:ghp_…@github.com/…` et `ssh://git:…@hôte` et il est appliqué sur tous les chemins qui rendent une origine au navigateur (`sharing.ts:129`, `:182-188`, `:243`) ou qui la recopient dans un message d'erreur (`clone.ts` côté action, `sharing.ts:188`).
- **Le brouillon ne peut pas porter de valeur de variable d'environnement.** `DraftState.envVarNames` (`lib/draft.ts:32`) ne contient que des noms ; `toPersisted` (`:157-173`) écrit champ par champ et exclut `resolution` ; `requiredEnvVars` (`lib/engine.ts:171-186`) dérive ses noms des fiches du catalogue, jamais d'une saisie. Le test `lib/draft-to-manifest.test.ts:328-355` prouve les trois niveaux : le manifest sérialisé ne contient ni `DATABASE_URL` ni `sk_live…`, il est **octet pour octet identique** avec ou sans `envVarNames`, et le schéma strict refuse le champ ajouté (`MANIFEST_UNKNOWN_FIELD`).
- **La forme canonique est tenue et testée.** `chosenIds` (`draft-to-manifest.ts`) trie, les listes passent par des `Set` puis `.sort()`, et `lib/draft-to-manifest.test.ts` compare le résultat sérialisé au preset SaaS attendu. L'ordre des clics ne peut pas changer la sortie.
- **Complétude par le type, pas par la relecture.** `SLOTS` et `APP_FIELDS` (`draft-to-manifest.ts:48` et suivants) sont des `Record<Category, …>` et `Record<AppKey, …>` : ajouter une catégorie au registry casse la compilation. Idem `SCREEN_ROLE` (`create/capabilities/capabilities.ts:24`), `CATEGORY_LABELS` (`create/stack/stack-view.ts:72`) et `ROLE_TEXT` (`repo/sharing.ts:472`). Le test `capabilities.test.ts:25` vérifie en plus que `SCREEN_ROLE` couvre exactement les catégories du catalogue.
- **La compatibilité est revalidée par le moteur, pas seulement par l'écran.** `generateProjectAction` ne se contente pas de `parseManifest` : `generateProject` recalcule le plan par `planProject`, qui appelle `resolve` (`packages/generator/src/pipeline.ts:210-213`) et refuse une combinaison invalide. Un client qui saute l'assistant ne peut donc pas écrire un projet incohérent.
- **Aucune liste de technologies n'est recopiée dans `apps/`.** `dependencyGraph` (`lib/engine.ts:216-251`) lit `requires` et `compatibleWith` des fiches du catalogue (`packages/registry/src/schema/entry.ts:111-112`) ; `SLOTS` ne dit que des rôles ; `capabilities.ts:82-122` ne dit que des familles de catégories.
- **Les bloquants du §6 sont exactement ceux du cahier des charges.** `blockedReason` (`lib/flow.ts:59-78`) couvre le nom (`create`), au moins une cible (`target`, §6.3 / `cahier-des-charges.md:121`) et la compatibilité (`stack`) ; les bloquants des écrans 22 et 23 (`cahier-des-charges.md:140-141`) sont tenus par `planClone`/`destinationState` (`clone/clone.ts:101-108`) et par `inspectProject` (`open/project.ts:132-138`).
- **`pf web` ne peut pas laisser de serveur orphelin.** `commands/web.ts` lance `node` directement (aucun `pnpm` intermédiaire à survivre, `:143`), ne lie que `127.0.0.1` (`:79`, répété en `HOSTNAME`/`PORT` et en arguments), **refuse de démarrer si le port répond** (`io.portProbe`, sonde TCP réelle bornée à 2 s, `apps/cli/src/node-io.ts:82-98`), et couvre les deux emplacements du serveur autonome documentés au `PROJECT_CONTEXT.md:145` (`:28-31`).
- **`packages/exec` : jamais de shell, y compris sous Windows.** `resolveWindowsCommand` (`:64-94`) résout un `.cmd` npm vers son script Node plutôt que d'activer `shell: true` ; les arguments restent des arguments. Le seul changement du diff dans ce paquet est un commentaire plus un `/* v8 ignore next */` justifié (le `code null` d'un kill par le parent est hors d'atteinte sous Windows sans exposer l'enfant).
- **Hygiène de type respectée.** Aucun `as any`, aucun `@ts-expect-error`/`@ts-ignore`, aucun `console.log`/`warn`/`error` dans `apps/web/src` (vérifié par `grep` sur ces motifs). Tous les exports publics portent un type de retour explicite (`isolatedDeclarations`). Le seul `dangerouslySetInnerHTML` est `apps/web/src/app/layout.tsx:27` sur une constante statique `ANTI_FLASH` sans donnée interpolée.
- **`vitest.config.ts:21-28` applique bien l'alias ciblé** sur le seul paquet `server-only` (fichier `empty.js` du paquet, pas une condition globale), conforme au piège documenté au `PROJECT_CONTEXT.md:143`.
- **`next.config.mjs:49-67` (à `HEAD`) porte les deux réglages que le piège `PROJECT_CONTEXT.md:146` exige** `resolve.extensionAlias` `.js → ['.ts','.tsx','.js']` et `parser: { url: false }` limité aux chemins `packages/`. Le second est volontairement étroit et ne couvre pas les assets de Next.
- **`loadOptionsAction` n'est pas une prise.** `actions.ts:64-68` ne valide pas la catégorie au runtime (elle est typée `Category`, ce qui n'existe plus à l'exécution), mais `registry.query` filtre par égalité stricte (`packages/registry/src/load.ts:137-152`) : une catégorie inconnue rend `[]` sans lever. Comportement sûr, à défaut d'être explicite.

## Ce qui n'a pas été couvert

Raisons, et non excuses ces zones ne doivent pas être considérées comme revues.

1. **La revue par sous-agents `cavecrew-reviewer` (10.5) n'a pas été possible** dans cette session : `subagent depth 2 exceeds maxDepth 1`. Le découpage par paquet reste pertinent, mais c'est le Lead qui doit le déclencher.
2. **Les rendus et l'habillage** `clone/view.tsx` (336), `repo/view.tsx` (371), `open/view.tsx` (199), `share/view.tsx` (161), `github/view.tsx` (130), `create/stack/page.tsx` (313), `create/infrastructure/page.tsx` (184), `create/blueprint/page.tsx` (179), `create/preview/page.tsx`, `create/report/page.tsx`, `graph/*`, `components/wizard/shell.tsx`, `toaster.tsx`, `theme-toggle.tsx`, `globals.css` (340), `layout.tsx`, `apps/web/src/app/page.tsx` (dashboard) : lus par `grep` (imports, motifs à risque) et par échantillon, pas intégralement. Aucun test de rendu n'a été exécuté. C'est la zone où un bug d'affichage ou de flux resterait invisible.
3. **Les modules de logique pure non lus intégralement** `create/blueprint/summary.ts` (225), `create/stack/stack-view.ts` (250), `create/infrastructure/infrastructure.ts` (64), `create/preview/tree.ts` (113), `create/report/result.ts` (86), `create/generate/steps.ts` (93), `graph/relations.ts` (147), `lib/session.ts` (76), `lib/theme.ts`, `lib/toasts.ts` : vérifiés sur leurs imports et leurs contrats (aucun ne réimplémente une règle du moteur), pas ligne à ligne.
4. **Aucune suite de tests n'a été relancée** (ni `pnpm test`, ni `ci:local`, ni `test:e2e`, ni `test:smoke`). Les 51 fichiers `.test.*`/`.test.tsx` du diff sont donc, pour cette revue, une intention déclarée, pas une preuve d'exécution la seule exception est le probe exécuté pour MAJOR-1.

   ```text
   $ git diff --numstat origin/main...HEAD | Select-String '\.test\.' | Measure-Object -Line
   Count: 51        # dont 47 sous apps/web
   ```

   `pnpm ci:local` reste le point de référence du dépôt, mais il doit être relancé par le Lead sur l'arbre stabilisé.
5. **Le câblage du CLI** `apps/cli/src/cli.ts` (+10), `apps/cli/src/commands/create.ts` (+4/−1), `apps/cli/src/io.ts` (+6), `apps/cli/src/fake-io.ts` (+3) : parcourus par `grep` sur l'ajout de `portProbe` et l'inscription des commandes `web`/`share`, pas lus ligne à ligne. `pending.ts` a été lu (le retrait de `share` de `PENDING` est correct).
6. **`pnpm-lock.yaml` (+1030/−15), `apps/web/turbo.json`, `apps/web/postcss.config.mjs`, `apps/web/tsconfig.json`, `biome.json`, `.gitignore`, `package.json` racine** : lus par `git diff` ciblé pour `biome.json`, `package.json` et `.gitignore` (les trois ajouts sont conformes : `tailwindDirectives`, `test:e2e` branché dans `ci:full`, `next-env.d.ts` exclu). Le lockfile et `turbo.json` n'ont pas été audités.
7. **`pnpm test:e2e` et `e2e/journey.mjs`** : la preuve « 12 étapes, clavier seul, génération réelle sur disque » n'est pas re-vérifiée ici (elle l'est par le dépôt, `PROJECT_CONTEXT.md:12`).
8. **Les 1 512 lignes de `docs/guide/`, `docs/cli.md`, `docs/README.md` et `docs/llms.txt`** : lus en partie (les pages qui recoupent un invariant de code : `confidentialite.md`, `commandes.md`, `no-lock-in.md`), pas relus pour l'exactitude factuelle ligne à ligne. Un coéquipier travaille en parallèle sur ce périmètre (Phase 11).

## État à la remise ce qui a bougé après la revue

Pendant et après la rédaction, l'arbre de travail a continué d'évoluer. Ces changements ne font pas partie du diff examiné, mais deux d'entre eux répondent directement à des findings : les passer sous silence ferait lire un rapport périmé.

**MAJOR-2 fermé dans l'arbre.** `apps/web/src/middleware.test.ts` (72 lignes, non suivi) couvre exactement les cas demandés : positifs (`127.0.0.1`, `127.0.0.1:4173`, `localhost`, `LOCALHOST:3000`, `[::1]`, `[::1]:4173`), négatifs (`attaquant.example`, `127.0.0.1.attaquant.example`, `localhost.attaquant.example`, `127.0.0.1.example.com:80`, `localhost:abc`, chaîne vide, `::1`), en-tête `Host` absent, et l'assertion `config.matcher === '/:path*'`. Le test est cohérent avec la logique de `HEAD` : `::1` sans crochets tombe bien en 403, parce que `replace(/:\d+$/)` le réduit à `":"`. Reste à confirmer par `pnpm test`.

**MAJOR-1 partiellement fermé, la variable que j'avais prouvée reste ouverte.** Le correctif de `apps/web/src/app/open/project.ts` s'est appliqué : la liste est passée à `['PF_GITHUB_TOKEN', 'GITHUB_TOKEN', 'GH_TOKEN', 'NPM_TOKEN']` (`:163-168`) et l'ordre du merge a été inversé en `{ ...scrubbed, ...options?.env }` (`:189`) les deux corrections proposées ici. Mais `PF_GIT_TOKEN` a été délibérément laissé hors de la liste. Re-sonde sur le fichier corrigé, même commande que pour MAJOR-1, avec six variables :

```text
PROBE {"PF_GIT_TOKEN":"ghp_probe_git","GITHUB_TOKEN":"","GH_TOKEN":"","NPM_TOKEN":"","AUTRE_SECRET":"secret-probe","PF_GITHUB_TOKEN":""}
```

Les quatre variables de la liste sont bien vidées ; `PF_GIT_TOKEN` hérité de `process.env` passe toujours c'est exactement la variable dont la fuite a été prouvée plus haut, et celle que le `docs/roadmap.md:665` désigne comme l'exception. Le raisonnement du commentaire (`:159-161` : « le garde-fou ne vide que ce qui vient du **processus**, jamais ce que l'appelant a posé explicitement ») est désormais satisfaisable sans compromis : **l'inversion de l'ordre de merge rend l'ajout de `PF_GIT_TOKEN` à la liste sûr**. Le `PF_GIT_TOKEN` du processus est vidé, celui que `packages/git` pose par `options.env` gagne, et le test `open/project.test.ts:329-336` reste vert. La sonde négative qui manque est celle de `PF_GIT_TOKEN` hérité du shell.

Reste hors d'atteinte d'une liste de noms : tout secret non listé exporté dans le shell qui lance `pf web` (`AUTRE_SECRET` ci-dessus). Seule une **liste d'autorisation** d'environnement (`PATH`, `HOME`, `TEMP`, `APPDATA`, `SystemRoot`, `ComSpec`, `PATHEXT`…) ferme cette classe ; à défaut, la liste actuelle est déjà une amélioration nette.

**MAJOR-3 non traité à cette heure.** `apps/web/vitest.config.ts` porte toujours `include: ['src/lib/**/*.ts']`.

Autres changements d'arbre observés à la remise, sans effet sur les findings : `M apps/web/e2e/journey.mjs`, `M apps/web/src/app/github/view.tsx`, `M apps/web/src/app/graph/page.tsx`, `M apps/web/src/app/open/project.test.ts`, `M apps/web/src/app/repo/view.tsx`, `M apps/web/src/app/share/view.tsx`, `M apps/web/src/components/wizard/shell.tsx`, `M pnpm-lock.yaml`, `?? apps/web/e2e/{harness,keyboard,_debug}.mjs`, `?? apps/web/src/app/ui-partagee.test.tsx`, `?? packages/doctor/`.

## Verdict

**changes-requested** sur `HEAD`. Aucun finding `critical` : aucune écriture de fichier arbitraire, aucune fuite du jeton propre à l'application (`PF_GITHUB_TOKEN` est vidé, prouvé), aucun contournement du contrôle de `Host` trouvé dans le code.

Trois `major` empêchent de cocher 10.2 comme « revue faite **et** aucun finding majeur » :

1. **MAJOR-1** `open/project.ts:161,175` le garde-fou d'environnement ne vide qu'une variable, prouvé par sonde. *État à la remise : les quatre variables de la nouvelle liste sont fermées, `PF_GIT_TOKEN` hérité du shell ne l'est pas.*
2. **MAJOR-2** `middleware.ts` le seul contrôle d'accès du serveur local n'a aucun test. *État à la remise : `middleware.test.ts` ajouté, couvrant les cas demandés ; reste `pnpm test`.*
3. **MAJOR-3** `vitest.config.ts:34` la couverture d'`apps/web` ne mesure que `src/lib/**`, alors que le gate M6 cite « `apps/web` 98,7 % ». *Non traité à cette heure.*

**Ce qui reste à faire pour cocher 10.2 :** ajouter `PF_GIT_TOKEN` à `SERVER_SECRETS` (sûr depuis l'inversion du merge) avec sa sonde négative, trancher MAJOR-3, puis relancer `pnpm ci:local` sur l'arbre stabilisé les 51 fichiers de test du diff n'ont pas été exécutés par cette revue.

Les cinq `minor` peuvent suivre en 10.3/10.4 : ils sont écrits pour être corrigés, pas pour être débattus.
