# `pf` — référence des commandes

`pf` est la façade en ligne de commande du moteur Forge (§9, §21). Elle produit un Project Manifest et le passe au pipeline — le même que celui de la future interface web : **même manifest, même projet, octet pour octet** (vérifié par un test, pour chaque preset).

**Statut :** Phases 7 et 7B livrées dans le dépôt, **pas encore publiée sur npm** (il faut un compte et un jeton). En attendant :

```bash
pnpm pf <commande>                        # depuis la racine du dépôt, sur les sources
pnpm --filter @project-factory/cli build  # puis node apps/cli/bin/pf.js <commande>
```

`pnpm pf` s'exécute à la racine du dépôt : un projet créé sans `--dir` y atterrit.

## Conventions

| | |
|---|---|
| Codes de sortie | `0` succès · `1` le moteur a refusé ou échoué · `2` usage (argument manquant, drapeau inconnu, commande pas encore livrée) |
| Erreurs | `✗ message`, puis `→ piste`, puis `(CODE)` — le code est stable, le message est pour vous |
| Mode non interactif | Hors terminal, ou avec `--yes`, aucune question n'est posée : une information manquante est une erreur qui nomme le drapeau à fournir |
| Aide | `pf --help`, `pf <commande> --help` |

## `pf`

Menu d'accueil (§18bis) : créer un projet, cloner un projet, ouvrir un projet local. Hors terminal, affiche l'aide.

## `pf create [nom] --preset <preset>`

Crée un projet depuis un preset certifié (`saas`, `dashboard`, `api`, `fullstack`), avec ses recettes. Par défaut : écriture, installation des dépendances, `git init` et premier commit.

| Option | |
|---|---|
| `--preset <p>` | Preset (`pf template list`) |
| `--dir <dossier>` | Dossier cible ; par défaut `./<nom>` |
| `--no-install` | Ne pas installer |
| `--no-git` | Ne pas créer de dépôt Git |
| `--dry-run` | Afficher l'arborescence ; rien n'est écrit |
| `--from <étape>` | Reprendre à `write`, `install`, `git` ou `validate` — après une erreur passagère, `pf` affiche la commande exacte |
| `--yes`, `-y` | Aucune question |

```bash
pf create boutique --preset saas
pf create mon-api --preset api --no-git --dir services/api
pf create demo --preset fullstack --dry-run
```

Le nom : minuscules, chiffres et tirets, commençant par une lettre.

## `pf template`

| | |
|---|---|
| `pf template list` | Les presets, et à quoi ils servent |
| `pf template show <preset> [--name <nom>]` | Le manifest du preset sur la sortie standard — et rien d'autre, pour pouvoir le rediriger ; ses recettes sont rappelées sur la sortie d'erreur |
| `pf template use <preset> [nom] [options]` | Alias de `pf create --preset <preset>` |

## `pf generate <manifest.json>`

Génère depuis un manifest écrit à la main, modifié par `pf add` ou partagé. Le manifest est migré vers la version courante puis validé.

Options : `--dir`, `--recipes <a,b>`, `--no-install`, `--no-git`, `--dry-run`, `--from`. Dossier par défaut : `./<name du manifest>`.

## `pf graph [manifest.json] [--preset <p>]`

La stack résolue : chaque technologie, sa catégorie, certifiée (`✓`) ou seulement déclarée (`·`), celles que le moteur ajoute et **qui les exige**, le statut de la stack (certifiée si toutes le sont, expérimentale sinon) et les avertissements (licences…). Sans argument, lit `pf.manifest.json`.

## `pf add <technologie> [--manifest <fichier>] [--yes]`

Ajoute une technologie au manifest, au champ que désigne sa catégorie (`frontend.ui`, `database.orm`, `quality`, `infra`, `services`…), puis contrôle la compatibilité de l'ensemble. Affiche la modification, ce qu'elle remplace et ce qu'elle entraîne ; **n'écrit qu'avec `--yes` ou après confirmation**. Fichier par défaut : `pf.manifest.json`, réécrit sous forme canonique.

Une technologie qui n'a pas de sens seule est refusée avec la raison (un ORM sans base, un style sans application web, un langage — il se choisit à la création).

### Mode expert

```bash
pf template show api --name mon-api > pf.manifest.json
pf add stripe --yes
pf graph
pf generate pf.manifest.json
```

## `pf key set | status | clear`

La clé API LLM locale (§0, §17), pour les fonctions d'analyse à venir.

- `set` lit la clé sur l'entrée standard (`echo "$CLE" | pf key set`) ou par une saisie masquée dans un terminal. **Jamais en argument** : elle resterait dans l'historique du shell et dans `ps` — `pf` refuse.
- Stockée dans `credentials.json` du répertoire de configuration, fichier en `0600`, dossier en `0700`. Répertoire : `$PF_CONFIG_DIR`, sinon `%APPDATA%\project-factory` (Windows), `$XDG_CONFIG_HOME/project-factory`, `~/.config/project-factory`.
- `status` dit si une clé est définie, **jamais sa valeur, pas même en partie**.
- `clear` la supprime.

## Projets existants et GitHub (§18bis, §20bis)

### `pf clone [lien|propriétaire/dépôt] [dossier]`

Clone un dépôt, puis propose d'installer ses dépendances. Sans lien, dans un terminal et connecté : la liste de vos dépôts.

- **Liens acceptés** : `https://…`, `git@hôte:chemin`, `ssh://…`, `propriétaire/dépôt` (GitHub). **Refusés avant tout appel à Git** : un lien qui commence par `-`, `ext::`, `file://`, un chemin local, `http://`, un lien contenant des identifiants.
- **Dossier** : inexistant ou vide. Un clone qui échoue ne laisse rien derrière lui.
- **Dépôt privé** : connectez-vous d'abord (`pf login`). Le jeton est transmis à Git par un *credential helper*, jamais dans l'URL ni en argument.
- **Code cloné** : ses scripts d'installation s'exécuteraient sur votre machine — `pf` le dit et propose « sans scripts » en premier.

| Option | |
|---|---|
| `--install` | Installer sans demander |
| `--ignore-scripts` | Installer sans exécuter les scripts (`--ignore-scripts` ; Yarn ≥ 2 : `--mode=skip-build`) |
| `--yes` | Aucune question |

### `pf open <dossier>` · `pf install`

Reconnaît un projet de la machine et propose l'installation ; `pf install` agit sur le dossier courant. Le gestionnaire de paquets vient du verrou (`pnpm-lock.yaml`, `yarn.lock`, `bun.lock[b]`, `package-lock.json`), sinon du champ `packageManager`, sinon npm — **annoncé comme une supposition**. Python, Rust, Go, PHP et Ruby sont reconnus et nommés, avec la commande à lancer vous-même (installation automatique en V1).

La commande exacte est affichée **avant** d'être lancée. Sans terminal, rien n'est installé sans `--yes`. Options : `--ignore-scripts`, `--yes`.

### `pf login` · `pf logout`

- `pf login` : connexion par code (device flow). Les permissions sont annoncées avant : `repo` (dépôts privés, création, collaborateurs), ou `public_repo` avec `--public-only`. **L'application OAuth de Project Factory n'est pas encore enregistrée** : en attendant, `PF_GITHUB_CLIENT_ID=<identifiant>` ou un jeton existant.
- `pf login --with-token` : lit un jeton sur l'entrée standard (`echo "$JETON" | pf login --with-token`) ou par saisie masquée. **Jamais en argument.**
- Le jeton va dans le trousseau du système — Trousseau macOS, Secret Service (Linux, `secret-tool`), Gestionnaire d'identification Windows —, toujours par l'entrée standard de l'outil. **Trousseau absent : refus, aucun repli en clair.** Pour la CI, `PF_GITHUB_TOKEN` est lu (jamais écrit).
- `pf logout` retire le jeton de la machine ; pour le révoquer côté GitHub : https://github.com/settings/applications.

### `pf repo create` · `pf repo share`

| | |
|---|---|
| `pf repo create [--public] [--name <nom>] [--description <texte>] [--dir <dossier>] [--yes]` | Crée le dépôt GitHub du projet — **privé sauf `--public`** — et y pousse le code. Nom proposé : `name` de `package.json`, sinon le dossier. Le premier commit est créé avant tout appel à GitHub ; un nom pris ne crée rien. Confirmation, ou `--yes` |
| `pf repo share [--dir <dossier>]` | Le lien du dépôt, ses collaborateurs, les invitations en attente |

### `pf collab add | list | remove`

| | |
|---|---|
| `pf collab add <utilisateur> [--role read\|triage\|write\|maintain\|admin]` | Invite ; rôle par défaut `write` |
| `pf collab list` | Collaborateurs et invitations |
| `pf collab remove <utilisateur> [--yes]` | Annule l'invitation en attente, sinon retire l'accès ; confirmation, ou `--yes` |

**Partager un projet exige un dépôt GitHub.** Sans lui, `pf repo share` et `pf collab` refusent et disent quoi faire (`pf repo create`) ; le lien de configuration en lecture seule arrivera en Phase 9. Les droits sont ceux de GitHub : il faut être administrateur du dépôt.

## À venir

Ces commandes existent, répondent qu'elles ne sont pas encore disponibles et quand elles le seront (code `2`) :

| Commande | Quand |
|---|---|
| `share` | Phase 9 — lien de configuration en lecture seule |
| `doctor`, `analyze` | V1 |
| `upgrade` | V2 |
