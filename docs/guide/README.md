# Guide Project Factory

Project Factory décrit un projet, choisit ses plateformes et ses technologies, et
rend un projet prêt à développer : cohérent, documenté, diagnostiqué. Ce guide
explique le produit tel qu'il est dans le dépôt — pas tel qu'il est prévu.

**Statut : pré-alpha.** Le moteur (manifest, registry, compatibility, generator)
est livré et testé ; quatre presets sont certifiés de bout en bout ; le CLI `pf`
et le configurateur web existent et produisent **le même manifest pour les mêmes
choix**. Le CLI n'est pas publié sur npm (Phase 12) : aujourd'hui, il se lance
depuis les sources. Voir la [roadmap](../roadmap.md).

## Parcours conseillé

| Page | Pour quoi |
|---|---|
| [Démarrage rapide](quickstart.md) | De zéro à un projet généré, commandes réelles et sorties recopiées |
| [Concepts](concepts.md) | Manifest, registry, compatibility, presets, recettes, générateur |
| [Project Factory et Forge](produit-et-moteur.md) | Le produit, le moteur, le binaire `pf` — et pourquoi deux façades |
| [Le code généré ne dépend pas de nous](no-lock-in.md) | La promesse du §1 et le test qui la prouve |
| [Confidentialité, local-first](confidentialite.md) | Ce qui reste sur la machine, ce qui sort, et quand |
| [Référence du manifest](reference-manifest.md) | Les champs, ce qui est validé, ce que le manifest ne porte pas |
| [Référence du registry](reference-registry.md) | Les 37 catégories, la forme d'une fiche, ce que le chargement vérifie |
| [Commandes](commandes.md) | Chaque commande du §21 : livrée, en attente, ou exemple caduc |

## Comment ce guide est vérifié

Chaque sortie de commande citée ici a été **obtenue en lançant la commande**,
dans ce dépôt : Node `v24.10.0`, pnpm `11.13.1`, Windows 11, PowerShell 5.1. Les
sorties sont recopiées telles quelles, y compris les avertissements.

Une commande que nous n'avons pas pu lancer dans cette session — parce qu'elle
installe des dépendances, démarre un serveur, ou sort du réseau de la machine —
est **signalée comme telle**, avec sa source : `--help` de la commande, sortie du
CLI, ou fichier du dépôt. Le lecteur sait donc toujours ce qui a été exécuté.

## Ce qui fait foi

Ce guide explique ; il ne décide pas. En cas de divergence :

1. [Cahier des charges](../cahier-des-charges.md) — cadrage produit et technique
   (les renvois `§n` du guide pointent vers lui) ;
2. [Roadmap](../roadmap.md) — ce qui est livré, et quand ;
3. le **code** — `packages/manifest/src/schema/manifest.ts` pour la forme du
   manifest, `packages/registry/src/schema/entry.ts` pour la forme d'une fiche,
   `packages/compatibility/src/rules.ts` pour les règles de combinaison ;
4. [Référence du CLI `pf`](../cli.md) — les commandes, leur état, leurs options.

Le fichier [PROJECT_CONTEXT.md](../../PROJECT_CONTEXT.md) tient les conventions
et les frontières entre paquets : il est destiné à ceux qui modifient le dépôt,
pas à ceux qui l'utilisent.
