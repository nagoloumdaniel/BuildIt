# BuildIt UI/UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a coherent responsive BuildIt interface with theme-aware branding, native local pickers, real clone progress, clear project states, and French/English coverage.

**Architecture:** Preserve the existing Next.js App Router and shared UI primitives. Extend the design tokens and shell first, then wire explorer-first open/clone flows, then project organization and route states. Keep browser-hosted fallback inputs only where the server cannot access the visitor's machine.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 4, Vitest, Biome, existing native picker actions, existing clone SSE endpoint.

**Spec:** `docs/superpowers/specs/2026-10-12-ui-ux-refonte-buildit.md`

## Global Constraints

- Inter porte prose, titres, libellés et actions.
- JetBrains Mono porte chemins, statuts techniques, identifiants et métriques.
- Orange reste la couleur d'action et de progression; bleu pétrole porte l'information secondaire.
- Pas de skeletons; utiliser spinner, dots, barre indéterminée ou progression réelle.
- Les deux logos existants doivent basculer selon le thème sans flash.
- Les chemins locaux sont choisis via explorateur natif en mode desktop local.
- Les modes hébergés gardent un fallback manuel explicite.
- Tout texte ajouté existe en français et en anglais.
- Aucun nouveau backend ni dépendance d'icônes si les primitives présentes suffisent.

## Review Focus

- Une destination Windows contenant des espaces ou caractères non ASCII reste sélectionnable et valide; test dans Task 3.
- Une annulation de dialogue natif ne transforme pas l'annulation en erreur bloquante; test dans Task 3.
- Une destination de clonage inaccessible affiche une récupération actionnable, pas une boucle de chargement; test dans Task 4.
- Un clone long affiche la progression SSE et garde la dernière phase lisible sur mobile; test dans Task 4.
- Un projet généré ne réapparaît jamais comme brouillon après rafraîchissement; test dans Task 5.

### Task 1: Design tokens, shell, and reusable visual states

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/components/ui/app-shell.tsx`
- Modify: `apps/web/src/components/ui/bubble-nav.tsx`
- Modify: `apps/web/src/components/ui/card.tsx`
- Modify: `apps/web/src/components/ui/stepper.tsx`
- Modify: `apps/web/src/components/ui/loading.tsx`
- Modify: `apps/web/src/components/ui/empty-state.tsx`
- Modify: `apps/web/src/components/ui/icon.tsx`
- Test: `apps/web/src/components/ui/ui-foundation.test.tsx`

**Interfaces:**
- Preserve existing component exports and class names used by pages.
- Add only focused optional props for visual variants; do not replace page-level data contracts.

- [ ] **Step 1: Write failing foundation tests**

Assert shell exposes navigation labels, progress components render determinate and indeterminate ARIA state, and cards preserve action slots.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `pnpm --filter @buildit/web exec vitest run src/components/ui/ui-foundation.test.tsx`
Expected: FAIL because the new assertions are not implemented.

- [ ] **Step 3: Implement visual foundation**

Tune light/dark tokens around orange `#c2490c` and petrol `#0d6e7b`, add responsive card/nav spacing, preserve visible focus rings, and ensure mobile bubble navigation wraps without horizontal overflow. Keep Inter/JetBrains Mono variables as the only font source.

- [ ] **Step 4: Run focused tests and lint**

Run: `pnpm --filter @buildit/web exec vitest run src/components/ui/ui-foundation.test.tsx`; `pnpm --filter @buildit/web exec biome check src/app/globals.css src/components/ui`
Expected: PASS and no Biome errors.

- [ ] **Step 5: Commit the isolated foundation change**

Run: `rtk git add apps/web/src/app/globals.css apps/web/src/components/ui apps/web/src/components/ui/ui-foundation.test.tsx; rtk git commit -m "feat(web): refresh shared ui foundation"`

### Task 2: Dashboard and project collection

**Files:**
- Modify: `apps/web/src/app/dashboard-view.tsx`
- Modify: `apps/web/src/components/ui/project-card.tsx`
- Modify: `apps/web/src/lib/projects.ts`
- Create: `apps/web/src/app/projects/page.tsx`
- Create: `apps/web/src/app/projects/view.tsx`
- Modify: `apps/web/src/lib/i18n/messages.dashboard.ts`
- Test: `apps/web/src/app/dashboard-view.test.tsx`
- Test: `apps/web/src/app/projects/projects.test.tsx`

**Interfaces:**
- Reuse `recentProjects(2)` for dashboard and `listProjects()` or equivalent for full collection.
- Project cards receive completed project records only; draft rendering stays in its own branch.

- [ ] **Step 1: Add failing project-state tests**

Cover two recent completed projects, an empty collection, and completed records excluded from draft output.

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm --filter @buildit/web exec vitest run src/app/dashboard-view.test.tsx src/app/projects/projects.test.tsx`
Expected: FAIL on the new collection assertions.

- [ ] **Step 3: Implement dashboard collection and full page**

Use the existing project persistence helpers. Dashboard shows at most two completed projects and a link to `/projects`; `/projects` renders all completed projects with reusable `ProjectCard`, empty state, and localized back navigation.

- [ ] **Step 4: Verify tests**

Run: `pnpm --filter @buildit/web exec vitest run src/app/dashboard-view.test.tsx src/app/projects/projects.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

Run: `rtk git add apps/web/src/app/dashboard-view.tsx apps/web/src/components/ui/project-card.tsx apps/web/src/lib/projects.ts apps/web/src/app/projects apps/web/src/lib/i18n/messages.dashboard.ts apps/web/src/app/dashboard-view.test.tsx; rtk git commit -m "feat(web): organize generated projects"`

### Task 3: Explorer-first local open flow

**Files:**
- Modify: `apps/web/src/app/open/page.tsx`
- Modify: `apps/web/src/app/open/view.tsx`
- Modify: `apps/web/src/components/ui/path-picker.tsx`
- Modify: `apps/web/src/lib/i18n/messages.ts`
- Test: `apps/web/src/app/open/page.test.ts`
- Test: `apps/web/src/app/open/view.test.tsx`

**Interfaces:**
- Consume `PathPicker` with `kind="folder"` and existing `pickFolderAction`.
- Keep `inspectProjectAction` input as the selected directory string.

- [ ] **Step 1: Add failing open-flow tests**

Assert `/open` renders a native folder chooser instead of a text path field in native mode, submits only after a directory is selected, and shows a progress state during inspection.

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm --filter @buildit/web exec vitest run src/app/open/page.test.ts src/app/open/view.test.tsx`
Expected: FAIL because view currently renders manual path input.

- [ ] **Step 3: Wire picker and loading state**

Replace manual path input in local/native mode with `PathPicker`; retain the existing hosted fallback behavior. Disable inspect while picker/inspection is busy, show `LoadingLine` or `ProgressPanel`, and preserve clear error plus back action.

- [ ] **Step 4: Verify focused tests**

Run: `pnpm --filter @buildit/web exec vitest run src/app/open/page.test.ts src/app/open/view.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

Run: `rtk git add apps/web/src/app/open apps/web/src/components/ui/path-picker.tsx apps/web/src/lib/i18n/messages.ts; rtk git commit -m "feat(web): open local projects with native picker"`

### Task 4: Explorer-first clone with real-time progress

**Files:**
- Modify: `apps/web/src/app/clone/page.tsx`
- Modify: `apps/web/src/app/clone/view.tsx`
- Modify: `apps/web/src/app/clone/destination.ts`
- Modify: `apps/web/src/app/api/clone/route.ts`
- Modify: `apps/web/src/app/clone/progress.ts`
- Modify: `apps/web/src/components/ui/loading.tsx`
- Modify: `apps/web/src/lib/i18n/messages.ts`
- Test: `apps/web/src/app/clone/page.test.ts`
- Test: `apps/web/src/app/clone/view.test.tsx`
- Test: `apps/web/src/app/clone/progress.test.ts`

**Interfaces:**
- Use `PathPicker` with `kind="folder"` for local destination.
- Consume existing `GET/POST /api/clone` SSE contract and progress parser.
- Surface `resolveLocalDirectory` errors as localized action cards.

- [ ] **Step 1: Add failing clone-flow tests**

Cover folder picker usage, inaccessible destination error, SSE progress updates, cancellation, and completed result state.

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm --filter @buildit/web exec vitest run src/app/clone/page.test.ts src/app/clone/view.test.tsx src/app/clone/progress.test.ts`
Expected: FAIL on native destination and live progress assertions.

- [ ] **Step 3: Wire destination picker and SSE client**

Store selected absolute path, call preview validation before clone, then consume SSE messages with `EventSource` or `fetch` stream parsing. Bind real parsed percentage and phase to `ProgressPanel`; on inaccessible destination, keep the card stable and offer “choose another folder”.

- [ ] **Step 4: Verify focused tests**

Run: `pnpm --filter @buildit/web exec vitest run src/app/clone/page.test.ts src/app/clone/view.test.tsx src/app/clone/progress.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

Run: `rtk git add apps/web/src/app/clone apps/web/src/app/api/clone apps/web/src/components/ui/loading.tsx apps/web/src/lib/i18n/messages.ts; rtk git commit -m "feat(web): show real clone progress"`

### Task 5: Generation states, errors, and route polish

**Files:**
- Modify: `apps/web/src/app/create/generate/page.tsx`
- Modify: `apps/web/src/app/create/generate/PipelineProgress.tsx`
- Modify: `apps/web/src/components/wizard/shell.tsx`
- Modify: `apps/web/src/app/not-found.tsx`
- Create: `apps/web/src/app/error.tsx`
- Modify: `apps/web/src/lib/i18n/messages.build.ts`
- Modify: `apps/web/src/lib/i18n/messages.ts`
- Test: `apps/web/src/app/create/generate/page.test.tsx`
- Test: `apps/web/src/app/not-found.test.tsx`

**Interfaces:**
- Preserve generation engine and pipeline step contracts.
- `error.tsx` uses the existing shell and localized recovery actions.

- [ ] **Step 1: Add failing generation and error tests**

Assert generation progress has no skeleton, generated success leads to completed state, errors offer retry/back, and 404/error pages expose localized recovery links.

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm --filter @buildit/web exec vitest run src/app/create/generate/page.test.tsx src/app/not-found.test.tsx`
Expected: FAIL on missing route-level error/recovery assertions.

- [ ] **Step 3: Implement state polish**

Add explicit back buttons to wizard shell, keep pipeline progress accessible on narrow screens, make generation errors action-oriented, and add route-level error boundary without changing generation engine behavior.

- [ ] **Step 4: Verify focused tests**

Run: `pnpm --filter @buildit/web exec vitest run src/app/create/generate/page.test.tsx src/app/not-found.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

Run: `rtk git add apps/web/src/app/create apps/web/src/components/wizard apps/web/src/app/not-found.tsx apps/web/src/app/error.tsx apps/web/src/lib/i18n; rtk git commit -m "feat(web): polish generation and error states"`

### Task 6: Whole-app verification and local preview

**Files:**
- Modify only files required by verification failures.
- Test: existing web test suite, typecheck, lint, build.

- [ ] **Step 1: Run complete web tests**

Run: `pnpm --filter @buildit/web test`
Expected: exit code 0 with zero failed tests.

- [ ] **Step 2: Run typecheck**

Run: `pnpm --filter @buildit/web typecheck`
Expected: exit code 0.

- [ ] **Step 3: Run lint**

Run: `pnpm --filter @buildit/web lint`
Expected: exit code 0 with no errors.

- [ ] **Step 4: Run production build**

Run: `pnpm --filter @buildit/web build`
Expected: exit code 0 and all routes compile.

- [ ] **Step 5: Start local preview**

Run: `pnpm --filter @buildit/web dev`
Expected: Next.js reports a local URL such as `http://localhost:3000`; verify `/`, `/open`, `/clone`, `/projects`, and a missing route respond.

- [ ] **Step 6: Review final diff**

Run: `rtk git diff --check`; `rtk git status --short`
Expected: no whitespace errors; unrelated pre-existing changes remain identifiable.
