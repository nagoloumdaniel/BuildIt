# Confidentialité, local-first

La décision produit est écrite au §0 du cahier des charges :

> **Local-first** : le moteur, l'analyse de projet importé et l'AI Stack Advisor
> tournent en local via le CLI, avec la clé API LLM fournie par l'utilisateur.
> Aucun code ni prompt ne transite par un serveur Project Factory par défaut. Le
> **cloud hébergé** devient une **option payante** en V2, pas une obligation.

Cette page dit ce que cela signifie concrètement, et ce qui sort quand même.

## Ce qui ne quitte pas la machine

- **Le moteur tourne en local.** Le dépôt contient deux applications —
  `apps/cli` et `apps/web` — et **aucun serveur Project Factory** : il n'y a rien
  à qui parler, même si on le voulait.
- **Le catalogue est embarqué.** Les 283 fiches sont dans un index engendré
  (`packages/registry/src/generated/entries.ts`), chargé depuis le disque.
  `pf template list`, `pf graph` et `pf add` fonctionnent sans réseau.
- **Le configurateur web est local.** `pf web` sert l'application sur
  `127.0.0.1` — le seul hôte écouté (`HOST = '127.0.0.1'`, forcé aussi pour le
  serveur Next par `HOSTNAME`), jamais `0.0.0.0`. Le serveur reste donc sur cette
  machine, non joignable depuis le réseau.
- **Aucune télémétrie.** Le CLI n'embarque ni analytics, ni suivi d'usage :
  aucune occurrence de `analytics`, `posthog`, `sentry` ou `telemetry` dans
  `apps/cli/src`.

## La clé API LLM

Elle sert aux fonctions d'analyse à venir (§17) et vit **uniquement chez vous** :

```bash
echo "$CLE" | pf key set     # ou : pf key set dans un terminal (saisie masquée)
pf key status                # dit si une clé existe, jamais sa valeur
```

```text
$ pnpm pf key status
Clé API : non définie. pf key set pour l’enregistrer.
```

- **Jamais en argument** : la commande refuse (`pf key set <clé>`), parce qu'une
  clé en argument reste dans l'historique du shell et dans `ps` ;
- stockée dans `credentials.json`, fichier en `0600`, dossier en `0700`
  (`$PF_CONFIG_DIR`, sinon `%APPDATA%\project-factory` sous Windows,
  `$XDG_CONFIG_HOME/project-factory`, sinon `~/.config/project-factory`) ;
- `pf key status` n'affiche **jamais** la valeur, pas même en partie ;
- `pf key clear` la supprime.

## Le manifest ne peut pas porter de secret

C'est une propriété de **forme**, pas une consigne :

- le manifest n'a **qu'un seul champ à contenu libre**, `name`, et il est
  contraint par la grammaire des noms de paquets npm (`PROJECT_NAME_PATTERN`) —
  tout le reste est un slug validé ou une énumération fermée ;
- les variables d'environnement n'y figurent que sous forme de **noms**, et
  encore : elles viennent des fiches du catalogue, pas du manifest.

Le projet généré ne reçoit que des noms, jamais de valeurs :

```text
# Variables d’environnement requises par ce projet.
# Aucune valeur n’est fournie : renseignez-les localement, ne les versionnez jamais.

BETTER_AUTH_SECRET=
DATABASE_URL=
STRIPE_SECRET_KEY=
(…)
```

## Le lien de partage (§20)

`pf share` encode le manifest dans le **fragment** de l'URL — la partie après
`#`, que le navigateur ne transmet jamais au serveur : ni journal, ni requête,
ni cookie.

```text
$ pnpm pf share pf.manifest.json
http://127.0.0.1:4173/share#ewogICJtYW5pZmVzdFZlcnNpb24iOiAxLAogICJuYW1lIjog…
```

Le fragment décodé est **exactement le manifest** — vérifié sur un lien réel :

```json
{
  "manifestVersion": 1,
  "name": "mon-api",
  "targets": ["api"],
  "architecture": "single-app",
  "backend": { "framework": "hono", "language": "typescript" },
  "database": { "engine": "postgresql", "orm": "drizzle" },
  "services": ["redis", "stripe"],
  "quality": ["biome", "vitest"],
  "infra": ["docker", "github-actions"]
}
```

Ni chemin local, ni nom d'utilisateur, ni secret : le manifest ne peut pas en
porter (voir plus haut). Le lien s'ouvre là où tourne le configurateur
(`pf web`) ; `pf share --url <base>` permet de viser une autre origine.

## Le jeton GitHub (§20bis)

- Il va dans le **trousseau du système** — Keychain, Secret Service, coffre de
  Windows — passé par l'entrée standard de l'outil, jamais en argument
  (`packages/github/src/token-store.ts`) ;
- **trousseau indisponible ⇒ refus** : aucun repli en clair dans un fichier ;
- il n'est **jamais** écrit dans le manifest ni dans un fichier du projet (§24) ;
- `pf logout` le retire ; la révocation côté GitHub reste possible à tout moment.

## Ce qui sort, et quand

| Sortie | Quand | Pourquoi |
|---|---|---|
| Le registre npm | `pnpm install` (dans le projet généré, ou à la racine) | installer les paquets de votre projet |
| L'API GitHub | `pf login`, `pf clone` (dépôt privé), `pf repo`, `pf collab` | les actions que vous demandez, avec **votre** jeton |
| Votre remote Git | quand vous poussez | votre code, vers votre dépôt |
| Un registre d'images | `docker build` / `compose pull` du projet généré | construire l'image |

Rien d'autre : pas de serveur Project Factory, pas de télémétrie, pas de compte
à créer. Le jour où l'exécution hébergée existera (V2), ce sera une **option**
explicite.
