# Phase 5 — Pipeline Generator : plan d'exécution

**Date :** 2026-09-24 · **Spec :** [../specs/2026-09-24-phase5-pipeline-generator-design.md](../specs/2026-09-24-phase5-pipeline-generator-design.md)

Méthode : TDD strict, module par module — le test échoue d'abord, vérifié, puis implémentation. Chaque étape se termine par un commit Conventional Commits.

## Séquence

1. **Registry — champ `packageRanges`** (additif, optionnel)
   - Test : une fiche avec `packageRanges` valide passe ; une fiche avec une plage vide échoue ; une fiche avec un nom de paquet vide échoue.
   - Schéma + type + export. Aucune fiche existante modifiée.
   - Commit : `feat(registry): plages de version par paquet, champ optionnel`

2. **`packages/recipes` — paquet nouveau**
   - Tests : schéma (valide, champ inconnu, `for` vide, env mal nommée, chemin de template invalide, chemin cible avec `..`), chargement (fixture valide, fiche non-objet, ids en doublon), `get`/`recipesFor(entryId)`.
   - `data/` avec 2 recettes fixtures réalistes (better-auth email-password, stripe checkout) — réalistes car utilisées par les tests du generator.
   - Commit : `feat(recipes): modele, chargeur et interrogation des recettes`

3. **`packages/generator` — squelette + erreurs**
   - Codes `GEN_*` + messages (formatter partagé). Commit avec le premier module.

4. **Rendu `render.ts`** — substitution `{{identifiant}}` seule.
   - Tests : substitution, variable inconnue → erreur, pas d'éval (`<%= %>`, backtick, `{{constructor}}` traités comme du texte ou rejetés), placeholder restant détecté.

5. **Stack Resolver `stack.ts`** — manifest → `resolve()`.
   - Tests : mapping de chaque champ du manifest vers les slugs ; échec compatibility propagé ; ajouts tracés.

6. **Dependency Resolver `dependencies.ts`**
   - Tests : homonyme hérite de `versionRange` ; `packageRanges` prioritaire ; paquet non épinglé → warning `GEN_UNPINNED_DEPENDENCY` ; dédoublonnage inter-fiches (conflit de plage → erreur).

7. **Données services `data/services` + `services.ts`**
   - Schéma + chargement validé ; fixtures postgres/redis/mailpit/minio.

8. **Infra `infra.ts`** — docker-compose, Dockerfile, workflow CI, devcontainer.
   - Tests : services seulement si la fiche résolue les déclare ; compose YAML déterministe ; aucun service pour une stack sans base.

9. **Env `env.ts`** — `.env.example`.
   - Tests : noms agrégés + triés + dédoublonnés ; valeurs vides ; rejet d'une valeur réelle.

10. **Scaffold `scaffold.ts`** — fichiers racine §13.
    - Tests : package.json valide et déterministe ; turbo.json conditionnel ; README contient le nom du projet ; `.gitignore`.

11. **Templates `templates.ts`** — chargement depuis `templatesRoot`, arborescence → chemins cibles, rendu.
    - Tests : template manquant → erreur ; arborescence parcourue ; `.gitkeep`/binaires ignorés ou rejetés.

12. **Recipe Resolver `recipes.ts`**
    - Tests : recette inconnue → erreur ; recette non portée par la stack → erreur ; paquets/env/fichiers fusionnés dans le plan.

13. **File Plan `plan.ts`** — assemblage + conflits + tri.
    - Tests : conflit de chemin → `GEN_FILE_CONFLICT` avant toute écriture ; tri déterministe ; provenance tracée.

14. **Écriture `fs.ts` + `writer.ts`** — journal + rollback + garde-fous.
    - Tests : cible non vide → `GEN_TARGET_NOT_EMPTY` ; `../` et chemin absolu → `GEN_PATH_TRAVERSAL` ; injection de panne à la N-ième écriture → restauration identique (diff récursif avant/après) ; journal complet en succès.

15. **Pipeline `pipeline.ts`** — orchestration, dry-run, retry.
    - Tests : dry-run sur FS en lecture seule n'écrit rien (cible jamais créée) ; étages dans l'ordre ; échec transitoire → `retryable` + `failedStep` ; reprise `fromStep` ; post-install/validation via runner injecté.

16. **Smoke test réel** — génération d'un socle dans un dossier temporaire, `pnpm install` + `tsc --noEmit` dessus.

17. **Revue sécurité écrite (5.13)** — `docs/superpowers/specs/2026-09-24-phase5-security-review.md`, checklist §24 : path traversal, template exécutable, secret dans le plan, écriture hors cible, runner injecté.

18. **Gate M3** — `pnpm ci:local` vert, couverture ≥ 90 %, mise à jour `CLAUDE.md` (état + structure), commit final.

## Risques

- **Couverture 90 %** imposée par la config vitest : prévoir les tests des branches d'erreur dès l'écriture de chaque module.
- **Windows** : les chemins du journal et du garde path traversal doivent normaliser `\` et `/` — tester les deux séparateurs dans la sonde.
- **Réseau** : le smoke test 16 dépend de `pnpm install` ; si le réseau est indisponible, le marquer explicitement dans le compte rendu du gate plutôt que de le faire semblant.
