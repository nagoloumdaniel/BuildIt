# Phase 7 — CLI `pf` : design

**Date :** 2026-09-28 · **Phase roadmap :** 7 (Milestone M4) · **Sections :** §5, §9, §17, §21, §24

## Objectif

Le CLI est une façade du moteur Forge, au même niveau que la future UI (§9) : il produit un Project Manifest et le passe au même pipeline. Il sort avant l'UI et valide le moteur sans front.

## Paquets

| Paquet | Rôle |
|---|---|
| `packages/presets` | Les quatre presets certifiés (§8) : manifest + recettes + description. De la donnée, partagée par le CLI et, plus tard, l'UI — sinon les deux divergeraient |
| `apps/cli` | Le binaire `pf`. Aucune logique métier : lire les arguments, poser les questions, appeler le moteur, afficher |

## Commandes de cette phase

| Commande | Rôle |
|---|---|
| `pf` | Menu d'accueil (§18bis). Cloner et ouvrir un projet local y figurent, désactivés jusqu'à la Phase 7B |
| `pf create [nom] --preset <p>` | Crée un projet depuis un preset. Interactif s'il manque quelque chose et qu'un terminal est là ; sinon, erreur qui dit quel drapeau fournir |
| `pf template list` / `pf template use <p> [nom]` | Liste les presets ; `use` est un alias de `create --preset` |
| `pf generate <manifest.json>` | Génère depuis un manifest écrit à la main ou partagé — le chemin qu'emprunteront l'UI et le lien de partage |
| `pf graph [manifest.json]` | La stack résolue en texte : choisie ou ajoutée (et par qui), statut, avertissements |
| `pf add <technologie> [--manifest f]` | Ajoute une technologie à un manifest, au bon champ selon sa catégorie, après contrôle de compatibilité |
| `pf key set` / `clear` / `status` | Clé API LLM locale (§0, §17) |

Commandes du §21 hors de cette phase — `doctor`, `analyze`, `upgrade` (V1/V2), `share` (Phase 9), et celles de la Phase 7B — **existent** et répondent, avec un code de sortie 2, quand elles arriveront. Pas de commande muette, pas de commande qui fait semblant.

## Décisions

| Sujet | Décision | Raison |
|---|---|---|
| Arguments | `node:util` `parseArgs` | Aucune dépendance pour un besoin que Node couvre |
| Questions | Interface `Prompter` injectable ; implémentation `node:readline/promises` | Testable sans terminal ; aucune dépendance |
| Mode non interactif | Automatique hors terminal (`!stdin.isTTY`) ou `--yes` : toute information manquante est une erreur qui nomme le drapeau | La CI ne répond pas aux questions |
| Défauts de `create` | installation + `git init` + premier commit ; `--no-install`, `--no-git` ; `--dry-run` n'écrit rien et affiche l'arborescence | Le moteur n'a pas de défauts (Phase 5B) : c'est à la façade de choisir ce qu'attend un humain |
| `pf add` | Affiche la modification ; n'écrit qu'avec `--yes` ou une confirmation | Seule commande qui réécrit un fichier existant (§7.7 roadmap : dry-run par défaut) |
| Clé API | Lue sur l'entrée standard ou par une question masquée, **jamais en argument** (visible dans l'historique du shell et `ps`) ; stockée dans le répertoire de configuration utilisateur, fichier en `0600` ; `status` dit si elle est définie, jamais ne l'affiche, pas même en partie | §24 |
| Erreurs | Chaque problème : code, message, piste (`→`). Codes de sortie : 0 succès, 1 échec du moteur, 2 usage | Une erreur dit quoi faire (7.6) |
| Octet pour octet | Le CLI appelle `generateProject` sans transformer le manifest : même manifest ⇒ même projet que le moteur appelé directement — vérifié par un test | Gate M4 |
| Publication npm | Paquet prêt (`bin`, `files`, `publishConfig`), **non publié** : il faut un compte npm et un jeton que cette session n'a pas | Dit plutôt que simulé |

## Hors périmètre

Publication (`npm publish --tag next`), commandes de la Phase 7B, `doctor`/`analyze`/`upgrade`/`share`.
