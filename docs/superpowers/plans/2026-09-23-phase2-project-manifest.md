# Phase 2 — Project Manifest : plan de tâches

**Spec :** [`../specs/2026-09-23-phase2-project-manifest-design.md`](../specs/2026-09-23-phase2-project-manifest-design.md)
**Paquet :** `packages/manifest`
**Méthode :** TDD strict. Le test est écrit, exécuté, vu échouer, puis l'implémentation minimale le fait passer.

Le spec porte déjà la structure de fichiers, les grammaires, la liste des codes d'erreur, la stratégie de test et le gate. Ce document ne le répète pas : il donne l'ordre des tâches et ce qui clôt chacune.

## Contraintes globales

- Zod 4.6.5, ajouté en dépendance de `packages/manifest`
- `isolatedDeclarations` : tout export public porte un type explicite
- Les assertions de test portent sur les **codes**, jamais sur les messages
- Aucune tâche ne se termine sans `pnpm ci:local` vert

---

### T1 — `errors.ts` + `result.ts`

Codes d'erreur, catalogue de messages français indexé par code, calcul d'indice par distance d'édition, et l'union discriminée `ParseResult` avec ses constructeurs.

**Clôture :** un code inconnu ne peut pas être construit (le type l'interdit) ; `suggest('wbe', ['web','mobile'])` renvoie `'web'` ; `suggest('zzzzzz', [...])` ne renvoie rien.

### T2 — `schema/primitives.ts`

Nom de projet, slug de technologie, ensemble sans doublon.

**Clôture :** chaque grammaire du spec a un test d'acceptation et au moins deux tests de rejet. Les doublons produisent `MANIFEST_DUPLICATE_ENTRY`, jamais une déduplication silencieuse.

### T3 — `schema/enums.ts`

`Target` et `Architecture` — les deux seules énumérations fermées.

**Clôture :** une valeur hors énumération produit `MANIFEST_ENUM_UNKNOWN` avec un indice quand la distance d'édition le permet.

### T4 — `schema/manifest.ts`

Assemblage du §10, mode strict.

**Clôture :** une clé inconnue est rejetée. Aucun nom de technologie n'apparaît dans le fichier — vérifiable par lecture.

### T5 — `parse.ts`

`parseManifest` et la traduction `ZodError` → `ManifestIssue[]`.

**Clôture :** le manifest exemple du §10 valide sans modification (fixture). `parseManifest` ne lève sur aucune de ces entrées : `null`, `undefined`, `42`, `'texte'`, `[]`, `{}`.

### T6 — `serialize.ts`

Sérialisation canonique : ordre de clés déclaré, tableaux de slugs triés.

**Clôture :** deux objets au contenu identique mais aux clés et tableaux dans un ordre différent produisent la même chaîne. `parse → serialize → parse` est idempotent.

### T7 — `migrate.ts`

Chaîne de migrations, vide aujourd'hui.

**Clôture :** un test injecte une migration factice v0→v1 et prouve que la machinerie l'applique. Une version non supportée et sans migration produit `MANIFEST_VERSION_UNSUPPORTED`.

### T8 — `index.ts`, couverture, commit

Surface publique, vérification du seuil de couverture, gate M1.

**Clôture :** couverture ≥ 90 %, gate du spec coché point par point.
