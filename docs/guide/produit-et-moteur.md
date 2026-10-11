# BuildIt et Forge

Trois noms circulent, et ils désignent trois choses différentes. Le cahier des
charges a tranché le 26/09/2026, §9 :

> « BuildIt » est le nom du produit ; « Forge » est le nom du **moteur** ;
> le binaire du CLI s'appelle **`pf`**. UI et CLI sont deux façades du moteur
> Forge. À expliciter dans la documentation utilisateur pour éviter la confusion
> entre les trois noms.

| Nom | Nature | Ce que c'est |
|---|---|---|
| **BuildIt** | Le produit | Ce que vous installez et utilisez : les écrans, le CLI, la documentation, les presets |
| **Forge** | Le moteur | Les paquets qui décident : manifest, registry, compatibility, générateur |
| **`pf`** | Le binaire | La commande que vous tapez : `pf create`, `pf graph`, `pf add` |

Forge n'est pas un second produit, et ce n'est pas un service : c'est le nom de
la partie qui travaille. Vous ne « lancez » pas Forge — vous parlez à `pf` ou à
l'interface web, et c'est Forge qui répond.

## Deux façades, un seul moteur

L'idée fondatrice du §9 est que **le moteur ne doit pas être prisonnier de
l'interface web** :

- l'interface web et le CLI sont **au même niveau** — aucune fonctionnalité
  n'est réservée à l'une des deux ;
- les deux produisent un **Project Manifest** et le passent au **même pipeline** ;
- donc les mêmes choix donnent le même projet, et c'est vérifié par des tests
  (voir [Concepts](concepts.md), « Un seul chemin, deux façades »).

```text
                    ┌──────────────────────────────┐
   interface web ───►                              │
                    │   Forge : manifest → registry │──► projet généré
   pf (CLI)      ───►│   → compatibility → generator │
                    └──────────────────────────────┘
```

Ce que ça change pour vous :

- vous pouvez commencer dans le navigateur et finir en ligne de commande — le
  manifest intermédiaire est le même objet, pas une copie ;
- vous pouvez automatiser en CLI (scripts, CI, `pf generate`) ce que vous avez
  validé à l'écran ;
- aucun choix n'est « perdu » en changeant de façade.

## Où vit quoi

| Élément | Emplacement |
|---|---|
| Le CLI `pf` | [`apps/cli/`](../../apps/cli) — aucune logique métier : il traduit des arguments en appels au moteur |
| Le configurateur web | [`apps/web/`](../../apps/web) — les 18 écrans du MVP |
| Le moteur | [`packages/`](../../packages) : `manifest`, `registry`, `compatibility`, `generator`, `presets`, `recipes`, `validation`, `exec`, `workspace`, `git`, `github` |
| La référence des commandes | [docs/cli.md](../cli.md) |
| Le cadrage et la roadmap | [cahier des charges](../cahier-des-charges.md), [roadmap](../roadmap.md) |

La dépendance ne va que dans un sens : les applications dépendent des paquets du
moteur, jamais l'inverse. Aucun `package.json` de `packages/` ne référence
`@buildit/web` ou `@nagoloum/cli` — c'est ce qui permet au web et
au CLI d'être remplacés, ou d'en ajouter un troisième (une extension d'éditeur,
un script CI), sans toucher au moteur.

## Les trois noms dans la sortie des commandes

```text
$ pnpm pf --help
pf — BuildIt : décrire un projet, obtenir un projet prêt à développer.
```

Le binaire s'annonce par ce qu'il fait. Le moteur, lui, ne s'annonce pas : il
n'apparaît que là où c'est utile — dans le [§9](../cahier-des-charges.md) et
dans le [§22](../cahier-des-charges.md) pour l'architecture interne, et dans
[cette page](produit-et-moteur.md) pour lever la confusion.
