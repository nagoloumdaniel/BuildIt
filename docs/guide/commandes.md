# Commandes

Le CLI `pf` est la façade en ligne de commande du moteur. Cette page est la
**carte** des commandes du §21 : ce qui existe, ce qui répond « à venir », et les
exemples du cadrage qui ne correspondent à aucune commande réelle.

La référence détaillée — chaque option, chaque comportement — est dans
[docs/cli.md](../cli.md). En cas de divergence entre cette page et la sortie de
`pf --help`, `pf --help` fait foi : c'est du code.

## Comment lancer

```bash
pnpm pf <commande>                        # depuis la racine du dépôt, sur les sources
pnpm --filter @project-factory/cli build  # puis node apps/cli/bin/pf.js <commande>
```

`pnpm pf` s'exécute **à la racine du dépôt** : un manifest sans `--manifest`, ou
un projet créé sans `--dir`, y sera cherché ou écrit. Le CLI n'est pas encore
publié sur npm (Phase 12 de la [roadmap](../roadmap.md)).

## Conventions

| | |
|---|---|
| Codes de sortie | `0` succès · `1` le moteur a refusé ou échoué · `2` usage (argument manquant, drapeau inconnu, commande pas encore livrée) |
| Erreurs | `✗ message`, puis `→ piste`, puis `(CODE)` — le code est stable, le message est pour vous |
| Mode non interactif | Hors terminal, ou avec `--yes`, aucune question n'est posée : une information manquante est une erreur qui nomme le drapeau à fournir |
| Aide | `pf --help`, `pf <commande> --help` — chaque commande a la sienne |
| Version | `pf --version` — la version du paquet `apps/cli` |

```text
$ pnpm pf --version
0.0.0
```

## Les commandes du §21

| §21 | État | Ce qu'elle fait |
|---|---|---|
| `pf` | **livrée** | Menu d'accueil : créer / cloner / ouvrir (hors terminal : affiche l'aide) |
| `pf create` | **livrée** | Crée un projet depuis un preset certifié |
| `pf template list\|show\|use` | **livrée** | Les presets |
| `pf generate` | **livrée** | Génère depuis un manifest |
| `pf graph` | **livrée** | La stack résolue, les ajouts, le statut, les avertissements |
| `pf add` | **livrée** | Ajoute une technologie au manifest |
| `pf web` | **livrée** *(hors §21)* | Sert le configurateur web construit, sur `127.0.0.1` |
| `pf key set\|status\|clear` | **livrée** *(hors §21)* | La clé API LLM locale |
| `pf clone` | **livrée** | Clone un dépôt, puis propose d'installer |
| `pf open` / `pf install` | **livrée** | Reconnaît un projet local / installe ses dépendances |
| `pf login` / `pf logout` | **livrée** | Connexion GitHub (jeton dans le trousseau) |
| `pf repo create\|share` | **livrée** | Dépôt GitHub du projet, privé par défaut |
| `pf collab add\|list\|remove` | **livrée** | Collaborateurs du dépôt |
| `pf share` | **livrée** (Phase 9) | Lien de partage en lecture seule — le manifest est dans le fragment de l'URL |
| `pf doctor` | **à venir — V1** | Diagnostic d'un projet existant |
| `pf analyze` | **à venir — V1** | Analyse d'un projet existant |
| `pf upgrade` | **à venir — V2** | Mise à niveau d'un projet généré |

```text
$ pnpm pf doctor
pf doctor n'est pas encore disponible : V1 — diagnostic d’un projet existant.      # code 2
$ pnpm pf analyze
pf analyze n'est pas encore disponible : V1 — analyse d’un projet existant.
$ pnpm pf upgrade
pf upgrade n'est pas encore disponible : V2 — mise à niveau d’un projet généré.
```

Ces trois commandes **existent et le disent** : ni commande muette, ni commande
qui fait semblant. `pf --help` les liste sous « À venir ».

## Le détail, commande par commande

### `pf create [nom] --preset <saas|dashboard|api|fullstack> [options]`

```text
--preset <p>    Preset certifié (pf template list)
--dir <dossier> Dossier cible (par défaut : ./<nom>)
--no-install    Ne pas installer les dépendances
--no-git        Ne pas initialiser de dépôt Git
--dry-run       Afficher les fichiers, sans rien écrire
--from <étape>  Reprendre à une étape (write, install, git, validate)
--yes           Ne poser aucune question
```

Par défaut : écriture, installation, `git init` et premier commit. Les étapes
sont nommées, et un échec passager se reprend avec `--from`. Voir le
[démarrage rapide](quickstart.md).

### `pf template list | show <preset> [--name <nom>] | use <preset> [nom] [options]`

`list` affiche les presets et leur usage ; `show` écrit **le manifest du preset
sur la sortie standard** — et rien d'autre, pour pouvoir le rediriger — en
rappelant ses recettes sur la sortie d'erreur ; `use` est l'alias de
`pf create --preset`.

```bash
pnpm pf template show api --name mon-api > pf.manifest.json
```

### `pf generate <manifest.json> [options]`

Génère depuis un manifest (écrit à la main, produit par `pf add`, ou reçu par un
lien de partage). Le manifest est **migré** vers la version courante puis validé.
Options : `--dir`, `--recipes <a,b>`, `--no-install`, `--no-git`, `--dry-run`,
`--from`. Dossier par défaut : `./<name du manifest>`.

### `pf graph [manifest.json] [--preset <p>]`

La stack résolue : chaque technologie, sa catégorie, certifiée (`✓`) ou déclarée
(`·`), celles que le moteur ajoute **et qui les exige**, le statut de la stack, et
les avertissements (licences, combinaison expérimentale). Sans argument, lit
`pf.manifest.json`.

### `pf add <technologie> [--manifest <fichier>] [--yes]`

Ajoute une technologie au manifest, **au champ que désigne sa catégorie**
(`frontend.ui`, `database.orm`, `quality`, `infra`, `services`…), puis contrôle la
compatibilité de l'ensemble. Affiche ce que ça change, ce que ça remplace et ce
que ça entraîne ; **n'écrit qu'avec `--yes`** ou après confirmation. Le fichier
est réécrit sous forme canonique.

```text
$ pnpm pf add stripe --manifest pf.manifest.json --yes
+ Stripe → services
✓ pf.manifest.json mis à jour.

$ pnpm pf add drizzle --manifest pf.manifest.json --yes
+ Drizzle → database.orm (remplace prisma)
! Combinaison expérimentale : Drizzle n’est couverte par aucun test de génération. Le projet sera généré, sans garantie qu’il compile.
```

Une technologie qui n'a pas de sens seule est refusée **avec la raison** :

```text
$ pnpm pf add drizzle --manifest sans-base.json --yes
✗ Impossible d’ajouter Drizzle ici.
  → Un ORM a besoin d’une base de données : ajoutez-la d’abord (pf add postgresql).
```

### `pf share <manifest.json> [--url <base>]`

Imprime un lien de partage en lecture seule : le manifest est encodé dans le
**fragment** de l'URL, donc il n'est envoyé à aucun serveur. Le lien s'ouvre là
où tourne le configurateur (`pf web`) ; `--url` permet de viser une autre origine.
Voir [Confidentialité](confidentialite.md).

```text
$ pnpm pf share pf.manifest.json
http://127.0.0.1:4173/share#ewogICJtYW5pZmVzdFZlcnNpb24iOiAxLAogICJuYW1lIjog…
```

Ce n'est **pas** le partage d'un dépôt GitHub : pour cela, `pf repo create`.

### `pf web [--port <n>] [--no-open]`

Sert le configurateur déjà construit (`pnpm build`), ouvre le navigateur, reste au
premier plan (Ctrl-C arrête le serveur). Le comportement, lu dans
[`web.ts`](../../apps/cli/src/commands/web.ts) :

- n'écoute que sur `127.0.0.1` — le serveur reste sur cette machine ;
- sans `apps/web/.next/BUILD_ID` : `✗ Le configurateur n'est pas construit : … est absent.` (code 1), rien n'est lancé à moitié ;
- un port qui répond déjà est refusé : `✗ Un serveur répond déjà sur 127.0.0.1:<port> : pf n'en démarre pas un second.` ;
- un port qui n'est pas un port est refusé : `✗ Port invalide : « 0x10 ».` ;
- deux modes de service, dans l'ordre : `next start` quand `next` est installé (le cas d'un dépôt cloné), sinon la sortie autonome `apps/web/.next/standalone/apps/web/server.js`.

### `pf key set | status | clear`

La clé API LLM locale (§0, §17), pour les fonctions d'analyse à venir. `set` lit
la clé sur l'entrée standard ou par saisie masquée — **jamais en argument** ;
`status` dit si une clé existe, jamais sa valeur ; `clear` la supprime. Stockage :
`credentials.json` en `0600`, dossier en `0700`.

### `pf clone [lien|propriétaire/dépôt] [dossier] [options]`

```text
--install         Installer les dépendances sans demander
--ignore-scripts  Installer sans exécuter les scripts du projet
--yes             Ne poser aucune question
```

Liens acceptés : `https://…`, `git@hôte:chemin`, `ssh://…`,
`propriétaire/dépôt`. Refusés **avant tout appel à Git** : un lien qui commence
par `-`, `ext::`, `file://`, un chemin local, `http://`, un lien contenant des
identifiants. Le code cloné peut exécuter ses scripts d'installation : `pf` le
dit et propose « sans scripts » en premier.

### `pf open <dossier> [--ignore-scripts] [--yes]` · `pf install [--ignore-scripts] [--yes]`

Reconnaît un projet de la machine (écosystème, gestionnaire de paquets d'après le
verrou) et propose l'installation ; la commande exacte est affichée **avant**
d'être lancée. Sans terminal, rien n'est installé sans `--yes`.

```text
$ pnpm pf open mon-projet
Projet : JavaScript / TypeScript — pnpm (d’après package.json)
Rien n’a été installé. Pour installer : pnpm install
```

### `pf login [--with-token] [--public-only]` · `pf logout`

Connexion GitHub par code (device flow) : aucun mot de passe ne passe par Project
Factory. Le jeton va dans le **trousseau du système** — jamais dans un fichier,
jamais dans le manifest. `--with-token` lit un jeton sur l'entrée standard.
`--public-only` demande la permission `public_repo` au lieu de `repo`.

### `pf repo create [--public] [--name <nom>] [--description <texte>] [--dir <dossier>] [--yes]` · `pf repo share [--dir <dossier>]`

Crée le dépôt GitHub du projet — **privé par défaut** — et y pousse le code ; le
premier commit est créé avant tout appel à GitHub. `repo share` affiche le lien du
dépôt, ses collaborateurs et les invitations en attente.

### `pf collab add <utilisateur> [--role read|triage|write|maintain|admin]` · `list` · `remove <utilisateur> [--yes]`

Invite, liste, retire. Rôle par défaut : `write`. Les droits sont ceux de GitHub :
il faut être administrateur du dépôt. **Partager un projet exige un dépôt
GitHub** ; sans lui, ces commandes refusent et disent quoi faire.

## Les exemples du §21 qui ne sont pas des commandes

Le §21 donne des exemples de cadrage. Deux d'entre eux ne correspondent à aucune
commande réelle — vérifié :

```text
$ pnpm pf create demo --web --mobile
✗ Unknown option '--web'. To specify a positional argument starting with a '-', place it at the end of the command after '--', as in '-- "--web"
  → pf create --help
```

Les cibles se choisissent **dans le parcours** (interface web) ou par le preset
(`--preset fullstack` couvre web + api) ; `pf create` n'a pas de drapeau par
cible.

```text
$ pnpm pf add auth
✗ Technologie inconnue : « auth ».
  → Vouliez-vous dire « auth0 » ?
```

`pf add` prend un **identifiant du catalogue**, pas un rôle : `pf add better-auth`
(authentification), `pf add postgresql` (base de données), `pf add stripe`
(paiement), `pf add redis` (cache). Les noms de rôle du §21 (`auth`, `database`,
`payments`) ne sont pas des fiches.

Un troisième écart, de forme : la barre verticale des tableaux ci-dessus est une
commodité de cette page — les commandes s'écrivent `pf repo create`, pas
`pf repo create|share`.
