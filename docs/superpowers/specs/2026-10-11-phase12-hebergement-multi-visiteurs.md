# Phase 12 Hébergement multi-visiteurs du configurateur web

**Date :** 2026-10-11 · **Périmètre :** rendre `apps/web` déployable sur Vercel (hébergement public, multi-visiteurs anonymes) sans casser le mode local (`pf web`, décision 8B.6).

## Objectif

Le projet Vercel « buildit » existe (domaine réservé `trybuildit.vercel.app`), mais rien n'était déployé : trois décisions de conception, correctes en local-only, cassent tout en hébergement public. Cette phase introduit une **détection d'environnement** (`VERCEL=1`, posée automatiquement par Vercel, ou `PF_HOSTED=1` pour les autres hébergeurs/tests) qui bascule le comportement elle ne le remplace jamais : `pf web` doit rester identique à avant cette phase.

## Décisions prises

### 1. Host-check adapté (`apps/web/src/lib/hosting.ts`)

**Avant :** `middleware.ts` codait en dur l'ensemble `{127.0.0.1, localhost, ::1}`. Correct en local, 403 permanent sur un domaine public.

**Décision :** extraire la logique dans `lib/hosting.ts` (`isHostedEnvironment`, `allowedHosts`, `isAllowedHost`). En mode local (par défaut), l'ensemble autorisé est **exactement** celui d'avant figé, aucune variable ne peut l'élargir, `PF_SITE_URL` comprise. En mode hébergé, on y ajoute l'hôte de `PF_SITE_URL` (déjà utilisée par `robots.ts`/`sitemap.ts` réutilisée, pas dupliquée) et celui de `VERCEL_URL` (posée par Vercel lui-même, utile pour les déploiements de prévisualisation).

**Pourquoi cette forme :** la garantie la plus importante n'est pas « quels hôtes sont acceptés en hébergé » mais « le mode local ne change jamais » d'où un test qui prouve qu'une `PF_SITE_URL` définie par erreur sur une machine locale (sans `VERCEL=1`) n'élargit rien.

`middleware.ts` ne fait plus qu'appeler `isAllowedHost(host)` ; son comportement local est inchangé et ses tests existants passent sans modification de leurs assertions.

### 2. Jeton GitHub par visiteur (`apps/web/src/lib/session-cookie.ts`)

**Avant :** `tokenStoreFor` lit `PF_GITHUB_TOKEN` ou le trousseau du système un seul jeton pour tout le processus. En hébergé, le visiteur B hériterait du compte GitHub du visiteur A via les Server Actions.

**Décision :** en mode hébergé, le jeton vit dans un cookie **scellé** (chiffré et authentifié), `httpOnly`, `secure`, `sameSite=lax`, posé par le serveur et jamais lu en clair par le navigateur. Chiffrement : **AES-256-GCM via `node:crypto`**, sans dépendance ajoutée le monorepo n'a ni `jose` ni `iron-session` et ils seraient disproportionnés pour un scellé de cette taille. La clé de 32 octets est dérivée de la variable d'environnement `SESSION_SECRET` par SHA-256 (accepte un secret de n'importe quelle longueur).

**Garantie prouvée par test** (`session-cookie.test.ts`) : deux magasins construits avec des cookies de visiteurs différents ne peuvent jamais lire le jeton l'un de l'autre c'est le test qui correspond directement au risque décrit dans la tâche (§2).

**Sans repli en clair :** si `SESSION_SECRET` n'est pas configurée, `cookieTokenStore` refuse d'enregistrer (`GITHUB_SESSION_SECRET_MISSING`, nouveau code ajouté à `packages/github/src/errors.ts`) même motif que `keychainStore` qui refuse quand le trousseau est indisponible : aucun chemin de repli non sécurisé.

**Intégration :** `apps/web/src/app/actions-node.ts` (`sessionDeps()`) bascule entre `tokenStoreFor` (local, inchangé) et `cookieTokenStore` (hébergé) selon `isHostedEnvironment()`. Toutes les Server Actions GitHub (connexion, device flow, dépôts, collaborateurs) passent déjà par `sessionDeps()` rien d'autre n'a changé dans ces fichiers.

### 3. Génération hébergée = zip téléchargeable (`apps/web/src/app/actions.ts`, `apps/web/src/lib/zip.ts`)

**Avant :** `generateProjectAction` écrit toujours sous `PF_WEB_WORKSPACE` (par défaut `~/buildit`) un dossier partagé entre tous les visiteurs en hébergé, avec les risques de collision de nom et d'épuisement de ressources que la tâche signale.

**Décision :** en mode hébergé, `generateHosted()` écrit dans un répertoire temporaire **isolé par requête** (`fs.mkdtemp` dans `os.tmpdir()`), appelle le même `generateProject` du moteur (aucune divergence de comportement entre CLI/local/hébergé), lit les fichiers écrits, les compresse en **`.zip`** et rend l'archive en base64 dans `GenerationView.zipBase64` puis **nettoie systématiquement** le répertoire temporaire (`finally`), succès ou échec. Le client (`create/generate/page.tsx`) décode le base64 en `Blob` et déclenche un téléchargement via une balise `<a download>` éphémère pas de route de téléchargement différée, donc pas de fichier à stocker entre la génération et le téléchargement.

**Format zip :** écrit à la main (`lib/zip.ts`, entrées `STORED`, CRC32 via `node:zlib.crc32`, disponible nativement depuis Node 24 la version de ce dépôt). Aucune dépendance de zip n'existait dans le monorepo (`archiver`, `jszip`, `adm-zip`…) ; en ajouter une pour ~90 lignes de format documenté aurait été disproportionné, conformément à la consigne de la tâche.

**Ce qui ne change pas en hébergé :** aucun `git init`, aucun `pnpm install`, aucun push automatique `generateProject` ne lance toujours que l'écriture de fichiers, comme en local. La génération hébergée n'est jamais plus privilégiée que le mode local ; elle est strictement plus contrainte (répertoire éphémère au lieu d'un dossier persistant).

## Ce qui ne change pas en mode local

- `middleware.ts` : mêmes hôtes acceptés, mêmes tests existants verts sans modification.
- `tokenStoreFor` / `keychainStore` / `PF_GITHUB_TOKEN` : chemin inchangé, toujours celui utilisé par `pf web` et le CLI.
- `generateProjectAction` : chemin `workspaceRoot()` / écriture réelle sous `~/buildit` inchangé, refus d'un dossier déjà pris inchangé.

## Preuves des tests (TDD : rouge avant le code, vert après)

| Fichier | Ce qui est prouvé |
|---|---|
| `apps/web/src/lib/hosting.test.ts` | Mode local figé même si `PF_SITE_URL` est définie par erreur ; mode hébergé ajoute l'hôte de `PF_SITE_URL`/`VERCEL_URL` ; un hôte d'attaquant est refusé dans les deux modes. |
| `apps/web/src/middleware.test.ts` (ajouts) | Le middleware réel refuse un hôte d'attaquant même avec `VERCEL=1`, et laisse passer le domaine configuré seulement quand `VERCEL=1` est posée. |
| `apps/web/src/lib/session-cookie.test.ts` | Scellé/descellé symétrique ; le scellé ne contient jamais le jeton en clair ; IV aléatoire (deux scellés du même jeton diffèrent) ; un secret différent ou une valeur altérée est refusée ; **un visiteur ne lit jamais le jeton scellé pour un autre** (le test qui correspond au risque du §2) ; refus sans repli en clair si `SESSION_SECRET` est absente. |
| `apps/web/src/lib/zip.test.ts` | Signature ZIP locale et EOCD valides ; les noms et contenus des fichiers sont présents ; une archive vide reste un zip valide. |
| `apps/web/src/app/create/generate/generation-hosted.test.ts` | En mode hébergé, `generateProjectAction` rend une archive zip contenant les fichiers attendus, et **le répertoire temporaire est nettoyé** après l'appel (preuve : aucune entrée `buildit-hosted-*` ne subsiste sous `os.tmpdir()`) ; un manifest invalide est refusé sans toucher au disque. |

## Vérifications (sorties)

```
pnpm run lint       → 0 erreur (190 infos/15 warnings préexistants, non liés à cette phase)
pnpm run typecheck  → 28/28 tâches, aucune erreur
pnpm run test       → 28/28 tâches ; apps/web : 54 fichiers, 553 tests passés
pnpm run build      → 15/15 tâches ; `next build` compile, types valides, 24 pages statiques générées
```

`test:smoke` et `test:e2e` n'ont pas été lancés (hors consigne de cette tâche trop longs).

## Ce qui reste à faire manuellement

Ces points touchent à des décisions de sécurité/produit ambiguës, écrites ici plutôt que tranchées à la place de l'équipe :

1. **Variables d'environnement à définir dans le projet Vercel « buildit » avant tout déploiement réel :**
   - `SESSION_SECRET` secret long et aléatoire (≥ 32 octets), **jamais commité**. Sans elle, la connexion GitHub est refusée en hébergé (fail-closed, pas de repli en clair).
   - `PF_SITE_URL=https://trybuildit.vercel.app` déjà utilisée par `robots.ts`/`sitemap.ts`, réutilisée ici pour le host-check.
   - `PF_GITHUB_CLIENT_ID` l'identifiant de l'application OAuth GitHub, si la connexion par code doit être proposée en hébergé (sinon l'écran l'affiche comme non configurée, ce qui est un état géré).
   - `VERCEL` est posée automatiquement par Vercel rien à faire.
2. **Durée de vie du cookie de session** : ce correctif pose un cookie de session (effacé à la fermeture du navigateur, pas de `maxAge`). Une durée de vie plus longue (ex. 7 jours, pour éviter de reconnecter GitHub à chaque visite) est un choix produit/sécurité qui n'a pas été tranché ici à décider explicitement.
3. **Scope des permissions GitHub demandées en hébergé** (`REQUESTED_SCOPES` / `SCOPES.full` dans `packages/github`) : ce périmètre n'a pas été revu pour l'hébergement public. Demander `repo` (accès complet) à un visiteur anonyme sur un site public mérite une relecture séparée non faite ici, car c'est une décision produit, pas une question d'architecture.
4. **Rotation de `SESSION_SECRET`** : la changer invalide tous les cookies existants (déconnexion silencieuse de tous les visiteurs en cours). Pas de mécanisme de rotation à chaud dans ce correctif ; à prévoir si une rotation planifiée devient nécessaire.
5. Le reste du [runbook Phase 12 existant](./2026-10-11-phase12-deploiement-readiness.md) DSN Sentry, compte analytics, rollback testé n'est pas couvert par cette tâche et reste ouvert.
