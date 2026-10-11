# Documentation

| Document | Contenu |
|---|---|
| **[Guide](guide/README.md)** | Le produit tel qu'il est : parcours, concepts, garanties |
| [Démarrage rapide](guide/quickstart.md) | De zéro à un projet généré, avec les sorties réelles des commandes |
| [Concepts](guide/concepts.md) | Manifest, registry, compatibility, presets, recettes, générateur |
| [BuildIt et Forge](guide/produit-et-moteur.md) | Le produit, le moteur, le binaire `pf` |
| [No-lock-in](guide/no-lock-in.md) | Le code généré est autonome — et le test qui le prouve |
| [Confidentialité, local-first](guide/confidentialite.md) | Ce qui reste sur la machine, ce qui sort, et quand |
| [Référence du manifest](guide/reference-manifest.md) | Les champs du Project Manifest, la forme canonique, les codes de refus |
| [Référence du registry](guide/reference-registry.md) | Les 283 fiches, les 37 catégories, ce que le chargement vérifie |
| [Commandes](guide/commandes.md) | Chaque commande du §21 : livrée, en attente, ou exemple caduc |
| [`llms.txt`](llms.txt) | Index court et factuel pour les moteurs — versionné, **pas encore servi** (Phase 12) |
| [CLI `pf`](cli.md) | Référence détaillée des commandes — **la référence qui fait foi** |

## Cadrage

| Document | Contenu |
|---|---|
| [Cahier des charges](cahier-des-charges.md) | Cadrage produit et technique complet (les renvois `§n` du guide pointent ici) |
| [Roadmap](roadmap.md) | Phases 0 → beta publique, avec leurs gates |
| [Spécifications et plans](superpowers/) | Les specs et plans d'exécution, phase par phase |

## Revue et preuves

| Document | Contenu |
|---|---|
| [Validation humaine](superpowers/specs/2026-10-11-validation-humaine-entretiens.md) | Entretiens développeurs et gate 8A : ce qui est validé, ce qui n'est pas archivé |
| [Revue de code, Phase 10](superpowers/specs/2026-10-11-phase10-code-review.md) | Le diff cumulé passé au niveau `high` : findings classés, sondes, ce qui est sain |
| [Revue de sécurité, Phases 8-9](superpowers/specs/2026-10-11-phase8-security-review.md) | Le §24 point par point |
| [Runbook Phase 12](superpowers/specs/2026-10-11-phase12-deploiement-readiness.md) | Publier le CLI, déployer le web, observabilité, critères de rollback |

## Contribuer

| Document | Contenu |
|---|---|
| [Contribuer](../CONTRIBUTING.md) | Installation, commits, hook `pre-push`, revue |
| [Ajouter une technologie au registry](../packages/registry/CONTRIBUTING.md) | La procédure complète : fiche, index engendré, contrôles |
| [Contexte projet](../PROJECT_CONTEXT.md) | Conventions et frontières entre paquets — pour ceux qui modifient le dépôt |

## Ce qui fait foi

Ce dossier **explique** ; il ne décide pas. En cas de divergence, l'ordre est :

1. le [cahier des charges](cahier-des-charges.md) ;
2. la [roadmap](roadmap.md) ;
3. le **code** — `packages/manifest/src/schema/manifest.ts`,
   `packages/registry/src/schema/entry.ts`,
   `packages/compatibility/src/rules.ts` ;
4. la [référence du CLI](cli.md), et la sortie de `pnpm pf --help`.

Les sorties de commande citées dans le guide ont été obtenues en lançant les
commandes (Node `v24.10.0`, pnpm `11.13.1`, Windows 11, PowerShell 5.1) ; les
quelques commandes non exécutées sont signalées comme telles, avec leur source.
