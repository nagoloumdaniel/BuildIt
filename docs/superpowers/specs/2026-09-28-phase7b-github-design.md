# Phase 7B — Projets existants & GitHub : design

**Date :** 2026-09-28 · **Phase roadmap :** 7B (Milestone M4) · **Sections :** §0, §18bis, §20bis, §21, §24

## Objectif

Le menu d'accueil a trois chemins : créer, **cloner**, **ouvrir un projet local**. S'y ajoutent l'installation des dépendances, la connexion GitHub, la création du dépôt d'un projet, le partage et les collaborateurs. CLI d'abord ; l'UI reprendra les mêmes paquets en Phase 8.

## Paquets

| Paquet | Rôle | Dépend de |
|---|---|---|
| `packages/exec` | Le `CommandRunner` de 5B.2, sorti du generator et étendu : entrée standard et variables d'environnement par commande. Toujours **sans shell** | `validation` |
| `packages/workspace` | Détecter un projet (écosystème, gestionnaire de paquets et **d'où on le sait**), construire la commande d'installation, l'exécuter | `exec` |
| `packages/git` | Valider un lien, cloner sans rien laisser derrière soi, initialiser, pousser, lire le dépôt GitHub d'un projet | `exec` |
| `packages/github` | Client de l'API (fetch injectable), device flow, dépôts, collaborateurs ; stockage du jeton dans le trousseau | `exec` |

Le generator importe désormais son exécuteur de `exec` et le réexporte : son API publique ne change pas.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Lien Git | Acceptés : `https://hôte/chemin`, `git@hôte:chemin`, `ssh://…`, raccourci `propriétaire/dépôt` (→ github.com). **Refusés avant tout appel à Git** : un lien qui commence par `-`, `ext::`, `file://`, un chemin local, `http://`, tout autre schéma, un espace ou caractère de contrôle, des identifiants dans l'URL | Un lien commençant par `-` devient une option de `git` (`--upload-pack=…` exécute une commande) ; `ext::` exécute une commande ; un jeton dans l'URL finit dans `.git/config` et les logs (R3) |
| Défense en profondeur | `git -c protocol.ext.allow=never -c protocol.file.allow=never clone -- <lien> <dossier>` ; `GIT_TERMINAL_PROMPT=0` | Si la validation laissait passer quelque chose, Git refuserait quand même ; `--` sépare options et arguments ; pas de question bloquante hors terminal |
| Dossier de destination | Inexistant ou vide. Échec ⇒ supprimé s'il a été créé, vidé s'il existait vide | §18bis : un clone n'écrase rien et ne laisse rien |
| Jeton pour Git | Jamais dans l'URL ni en argument : un *credential helper* le lit dans une variable d'environnement **du seul processus git** | `ps` et `.git/config` ne le voient pas |
| Détection | Verrou d'abord (`pnpm-lock.yaml`, `yarn.lock`, `bun.lock[b]`, `package-lock.json`), puis `packageManager`, sinon npm **annoncé comme une supposition**. Verrous contradictoires : avertissement. Python, Rust, Go, PHP, Ruby : détectés et nommés, avec la commande à lancer soi-même | §18bis |
| Installation | Commande exacte affichée **avant**, confirmée (ou `--yes`). Projet cloné : avertissement « code non fiable », choix « sans scripts » (`--ignore-scripts` ; Yarn ≥ 2 : `--mode=skip-build`) | §18bis, gate 7B |
| Connexion | Device flow OAuth, identifiant d'application dans `PF_GITHUB_CLIENT_ID` tant que l'application OAuth de Project Factory n'est pas enregistrée (action de mainteneur, un identifiant client n'est pas un secret). `pf login --with-token` lit un jeton sur l'entrée standard, jamais en argument | L'application OAuth n'existe pas encore : on le dit plutôt que de le simuler |
| Permissions | Annoncées avant la connexion. `repo` par défaut (cloner un dépôt privé, créer, inviter : les applications OAuth n'ont pas plus fin) ; `--public-only` ⇒ `public_repo`. Les permissions accordées sont affichées en clair après connexion | §20bis |
| Jeton | Trousseau du système : `security` (macOS), `secret-tool` (libsecret, Linux), `PasswordVault` (Windows, via PowerShell). Toujours transmis **par l'entrée standard**. Trousseau absent : refus, avec la commande pour l'installer — **aucun repli en clair**. `PF_GITHUB_TOKEN` lu (jamais écrit) pour la CI | §20bis, §24 |
| Dépôt créé | Privé sauf `--public`. Nom proposé : `name` de `package.json`, sinon le nom du dossier. Nom pris : refus, rien n'est créé. Push échoué après création : on dit que le dépôt existe et la commande à relancer | §20bis |
| Partage | `pf repo share` / `pf collab` exigent un `origin` sur github.com ; sinon refus avec la marche à suivre (`pf repo create`) et le rappel du lien de configuration en lecture seule (Phase 9) | Règle « partage ⇔ dépôt » |
| Rôles | `read`, `triage`, `write`, `maintain`, `admin` (→ `pull`, `triage`, `push`, `maintain`, `admin` de l'API). 403 ⇒ « le compte connecté n'est pas administrateur de ce dépôt » | §20bis |

## Commandes

`pf clone <lien|propriétaire/dépôt> [dossier] [--install] [--ignore-scripts] [--yes]` — sans lien, dans un terminal et connecté : liste des dépôts du compte. · `pf open <dossier>` · `pf install [--ignore-scripts] [--yes]` · `pf login [--with-token] [--public-only]` · `pf logout` · `pf repo create [--public] [--name] [--description]` · `pf repo share` · `pf collab add <utilisateur> [--role]` · `pf collab list` · `pf collab remove <utilisateur>`.

Le menu d'accueil active « Cloner » et « Ouvrir un projet local ».

## Preuves

- Tests négatifs : liens refusés sans qu'aucune commande ne soit lancée ; clone échoué ⇒ aucun dossier ; jeton absent de toute sortie, de tout argument de commande et de tout fichier écrit ; dépôt privé par défaut ; partage refusé sans dépôt ; aucune installation sans confirmation.
- Réel dans cette session : cloner un dépôt public, ouvrir un projet local, installer. **Pas** vérifiable ici : l'API GitHub est bloquée par le réseau de la session, et aucun compte de test n'est disponible — création de dépôt, clone privé et invitation sont prouvés contre un faux `fetch` qui rejoue les réponses documentées de l'API, et restent à vérifier sur un vrai compte.

## Hors périmètre

GitLab, Bitbucket (un lien Git quelconque se clone ; seules les actions de compte exigent GitHub). Analyse d'un projet cloné (V2). Accès de l'UI au disque local (Phase 8B).
