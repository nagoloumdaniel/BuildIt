# Validation humaine — entretiens et gate 8A

**Date du retour : 11/10/2026.** Ce document existe pour que la preuve soit dite à sa mesure exacte : ce qui est coché ici l'est sur un retour humain réel, et rien de plus.

## Ce qui a été validé

| Objet | Verdict | Ce que ça ferme |
|---|---|---|
| Le produit d'ensemble — concept, parcours, promesse, moteur | **positif** : « le système est bon, tout est OK pour eux » | rattrapage Phase 0 (§0.2) et 6.12 |
| Les **3 écrans maquettés** du gate 8A — Stack Builder, Blueprint, File Preview | **arbitrés sans réserve** | gate 8A |
| Le contenu des 4 presets (SaaS, API, Dashboard, Full-stack) | **validé** | 6.12, qui conditionnait 6.7b |

Les entretiens de 6.12 ont eu lieu **après** la certification des quatre presets, pas avant comme le prévoyait l'ordre initial : les presets ont donc été tranchés par le premier utilisateur (§0), puis validés par des développeurs. C'est un écart d'ordre, assumé et écrit — pas un gate sauté.

## Ce qui reste absent, et ce que cela coûte

Aucun verbatim n'est archivé et le décompte exact des personnes rencontrées n'est pas consigné. Le §0.2 demande « 5 entretiens réalisés, verbatims archivés » : la case du décompte reste donc **partiellement** couverte, et le tableau ci-dessus ne prétend pas le contraire.

Ce que ça coûte, concrètement :

- en Phase 13, les entretiens de retour (13.5) et la synthèse (13.6) produiront ces verbatims pour de bon — c'est là que la trace doit être constituée, pas reconstituée après coup ;
- si une décision produit est contestée plus tard (« pourquoi ce choix ? »), la réponse est dans le code et les rapports de phase, pas dans une citation.

## Décisions que ce retour autorise

- La direction artistique (8A) est **figée** : les tokens de `globals.css` ne bougent plus sans une raison de contraste ou d'accessibilité mesurée.
- Le contenu des quatre presets est **figé** : un changement de preset devient une décision documentée, pas un ajustement silencieux.
- La prochaine preuve humaine ne peut plus être une validation de conception : c'est un **premier run réussi par quelqu'un d'autre** — la métrique n°1 de la bêta (Phase 13).

## Ce qui reste ouvert pour la Phase 12

Rien de ce qui suit ne dépend du retour humain : ce sont des accès.

- un compte npm avec jeton pour publier le CLI (`pf`) ;
- un hébergement (Vercel ou Cloudflare) pour `apps/web` et le guide ;
- un projet Sentry, un compte analytics respectueux des données ;
- et un **rollback testé**, pas seulement écrit.

Procédure prête : [runbook Phase 12](2026-10-11-phase12-deploiement-readiness.md).
