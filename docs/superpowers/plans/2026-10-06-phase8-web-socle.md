# Phase 8B Socle applicatif web Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** poser le socle du configurateur web `apps/web` (Next.js) qui consomme les mêmes paquets moteur que le CLI, brouillon auto-sauvegardé, machine à états du parcours §3, commande `pf web` sans coder aucun des 18 écrans (ils suivent le gate 8A).

**Architecture :** Next.js 15 App Router en application locale lancée par `pf web` (décision 8B.6 écrite ci-dessous). Le moteur (manifest, registry, compatibility, generator, presets) n'est appelé que côté serveur, via un adaptateur unique ; le client ne connaît que des vues de données. L'état du parcours vit dans un brouillon persisté côté navigateur, injectable pour les tests.

**Tech stack :** Next ^15, React ^19, Tailwind ^4, Vitest 5, TypeScript 7, pnpm 11 + Turborepo (existants).

**Spec :** `docs/cahier-des-charges.md` §3 (parcours), §5 (progressive disclosure), §6 (écrans), §9 (architecture, façades au même niveau), §18bis (menu d'accueil), §24 (vigilance) ; `docs/roadmap.md` Phase 8 (sous-phase 8B) ; `PROJECT_CONTEXT.md` (conventions et pièges).

---

## Périmètre et décision 8B.6 (accès au disque depuis l'UI)

La roadmap exige de **trancher** l'accès au disque local (8B.6) avant les écrans clone / projet local. Décision écrite :

- L'UI web **ne vit pas sur un hébergement public** pour le MVP : elle est servie en local par la commande `pf web`, dans le même processus Node que le moteur.
- Le clonage, l'ouverture de projet local et l'écriture de la génération passent par des **Server Actions** qui appellent directement `packages/workspace`, `packages/git`, `packages/github` et `packages/generator` les mêmes paquets que le CLI, zéro duplication (§9).
- Le jeton GitHub ne quitte **jamais** le processus serveur : il vit au trousseau (7B.5), les Server Actions ne le renvoient jamais au client (§24, §20bis).
- Le serveur écoute sur `127.0.0.1` uniquement jamais `0.0.0.0`.

Cette décision doit être relue à l'étape 8G.2 (revue sécurité des écrans GitHub). Un jour, une exécution hébergée existera comme option payante (§0) hors MVP.

## Hors périmètre de ce plan

- 8A (direction artistique, design system, tokens) : gate humain Daniel valide la direction sur 3 maquettes avant que les écrans ne se codent. Les tâches ci-dessous posent des **tokens CSS provisoires**, volontairement neutres.
- Les 18 écrans (8C, 8D, 8G), le motion (8E), l'accessibilité complète (8F).
- La publication npm du CLI et le partage lecture seule (Phases 9, 12).

## Global Constraints

- ESM strict partout, `"type": "module"` ; Node ≥ 20.11, cible ES2023.
- Conventional Commits, en français sans accents (style des commits existants), vérifiés par commitlint.
- Biome est le formateur : espaces, 2, ligne 100, guillemets simples. Toute sortie générée doit lui plaire.
- TDD : le test échoue d'abord. Un garde-fou est validé par un **test négatif**.
- **Le web consomme les mêmes paquets que le CLI** (8B.2) : aucune logique métier (compatibilité, résolution, plan) ne se réécrit dans `apps/web`. Une règle qui n'existe pas dans les paquets n'existe pas.
- Next ^15 (le registry promet `>=15.0.0 <17.0.0` pour `next`), React ^19, Tailwind ^4. Versions épinglées exactes comme les autres paquets du dépôt (pas de `^` dans `package.json` voir `apps/cli`).
- pnpm 11 `minimumReleaseAge` : une dépendance trop récente exige une entrée `minimumReleaseAgeExclude` justifiée dans `pnpm-workspace.yaml` ne pas l'ajouter en silence.
- Le brouillon (§3) ne porte **aucune valeur de variable d'environnement** (§6.8, §24) : uniquement des noms de variables.
- Le serveur de `pf web` écoute sur `127.0.0.1`, jamais `0.0.0.0`.
- `isolatedDeclarations` est désactivée **explicitement** dans `apps/web/tsconfig.json` avec un commentaire justifiant (application non publiée ; les exports RSC de Next sont inférés) c'est la seule déviation à la convention du dépôt.
- Ne jamais chaîner `&& echo OK` après une commande dont la sortie passe par `tail` (piège documenté).
- Turbo : `apps/web/turbo.json` étend les `outputs` de `build` avec `.next/**` sans quoi un build en cache rendrait un serveur périmé.

## Review Focus

Les cinq façons les plus probables de se mordre avec ce socle, et le test qui les épingle :

1. **localStorage indisponible** (rendu serveur, navigation privée) → le brouillon doit rendre un brouillon frais, jamais lever. Test : `loadDraft` avec `storage: undefined` Task 3.
2. **Brouillon d'une version antérieure** (changement de forme) → réinitialisé proprement, jamais de crash sur un champ manquant. Test : version décalée + JSON corrompu Task 3.
3. **Une valeur secrète saisie à l'écran Env** → ne peut pas être persistée car le type `DraftState` n'a pas de champ valeur ; le test prouve qu'après sérialisation, aucune valeur n'apparaît. Test : Task 3.
4. **Build Next servi depuis le cache turbo sans `.next` restauré** → `pf web` démarre un serveur périmé. Test : `pnpm build` deux fois de suite (2e en cache), `pf web` sert la page à jour Task 9.
5. **Serveur lié à toutes les interfaces** → exposition du moteur et du disque au réseau local. Test : les arguments de démarrage contiennent `127.0.0.1` Task 8.

---

### Task 1 : `apps/web` dans le workspace scaffold Next 15 + Tailwind 4 + Vitest

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/turbo.json`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/globals.css`
- Create: `apps/web/src/app/page.test.ts`
- Modify: `.gitignore` (ajouter `.next/`)
- Modify: `.mimosa/` etc. déjà ignorés (fait le 06/10/2026)

**Interfaces:**
- Consumes: rien (première brique).
- Produces: le paquet `@buildit/web` avec `pnpm build` (Next), `pnpm test` (Vitest), `pnpm typecheck` (tsc) branchés sur Turborepo toutes les tâches suivantes s'y ajoutent.

- [ ] **Step 1 : écrire le test qui prouve que la page racine rend**

`apps/web/src/app/page.test.ts` :

```ts
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Home from './page.js';

describe('page racine', () => {
  it('annonce le produit et les trois chemins du menu', () => {
    const html = renderToStaticMarkup(Home());
    expect(html).toContain('BuildIt');
    expect(html).toContain('Créer un projet');
    expect(html).toContain('Cloner un projet');
    expect(html).toContain('Ouvrir un projet local');
  });
});
```

- [ ] **Step 2 : vérifier qu'il échoue**

Run: `pnpm --filter @buildit/web test` (échouera d'abord car le paquet n'existe pas encore l'échec attendu est « no such package » jusqu'au Step 3 ; le test doit ensuite échouer sur contenu manquant avant que `page.tsx` ne soit écrit).
Expected: FAIL (paquet absent, puis contenu absent).

- [ ] **Step 3 : scaffold minimal**

`apps/web/package.json` versions épinglées comme `apps/cli` ; `next`/`react` épinglés à la dernière 15.x/19.x disponible au moment de l'exécution (le registry promet `<17` pour next, pas de contrainte au-delà) :

```json
{
  "name": "@buildit/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "license": "MIT",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "test": "vitest run --coverage",
    "lint": "biome check ."
  },
  "dependencies": {
    "next": "15.x.y",
    "react": "19.x.y",
    "react-dom": "19.x.y"
  },
  "devDependencies": {
    "@buildit/typescript-config": "workspace:*",
    "@tailwindcss/postcss": "4.x.y",
    "@types/react": "19.x.y",
    "@types/react-dom": "19.x.y",
    "@vitest/coverage-v8": "5.0.1",
    "tailwindcss": "4.x.y",
    "typescript": "7.0.2",
    "vitest": "5.0.1"
  },
  "engines": {
    "node": ">=20.11.0"
  }
}
```

`apps/web/tsconfig.json` hérite de la base, ajuste pour Next, désactive `isolatedDeclarations` avec justification :

```jsonc
{
  "extends": "@buildit/typescript-config/base.json",
  "compilerOptions": {
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "types": ["node"],
    "plugins": [{ "name": "next" }],
    // Application non publiée : pas de .d.ts à produire, et les exports RSC de
    // Next (metadata, route handlers) sont inférés. Seule déviation à la
    // convention du dépôt documentée ici.
    "isolatedDeclarations": false
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "next.config.ts", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`apps/web/next.config.ts` :

```ts
import type { NextConfig } from 'next';

export default {
  // Server Actions pour le moteur ; rien d'exotique au socle.
  output: 'standalone',
} satisfies NextConfig;
```

`apps/web/postcss.config.mjs` :

```js
const config = { plugins: { '@tailwindcss/postcss': {} } };
export default config;
```

`apps/web/turbo.json` sans ça, un build en cache ne restaure pas `.next` :

```json
{
  "$schema": "https://turbo.build/schema.json",
  "extends": ["//"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**"]
    }
  }
}
```

`apps/web/vitest.config.ts` couverture bornée à `src/lib` : les écrans (8C+) n'existent pas encore, c'est 8F qui élargira :

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
});
```

`apps/web/src/app/globals.css` Tailwind + tokens provisoires (8A les remplacera) :

```css
@import 'tailwindcss';

/* Tokens provisoires la direction 8A les fige. Clair/sombre imposés par §6. */
:root {
  --pf-background: #ffffff;
  --pf-foreground: #111111;
}

[data-theme='dark'] {
  --pf-background: #111111;
  --pf-foreground: #f5f5f5;
}

body {
  background: var(--pf-background);
  color: var(--pf-foreground);
}
```

`apps/web/src/app/layout.tsx` :

```tsx
import type { ReactNode } from 'react';
import './globals.css';

export const metadata = { title: 'BuildIt' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
```

`apps/web/src/app/page.tsx` le menu d'accueil trois chemins (§18bis), sans style définitif :

```tsx
const PATHS = [
  { href: '/create', label: 'Créer un projet' },
  { href: '/clone', label: 'Cloner un projet' },
  { href: '/open', label: 'Ouvrir un projet local' },
];

export default function Home() {
  return (
    <main>
      <h1>BuildIt</h1>
      <nav aria-label="Menu d'accueil">
        <ul>
          {PATHS.map((path) => (
            <li key={path.href}>
              <a href={path.href}>{path.label}</a>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
```

Ajouter `.next/` à la section racine de `.gitignore` (à côté de `dist/`).

- [ ] **Step 4 : vérifier que tout est vert**

Run: `pnpm install` puis `pnpm --filter @buildit/web test && pnpm --filter @buildit/web typecheck && pnpm --filter @buildit/web build`
Expected: test PASS (la page rend les trois chemins), typecheck PASS, `next build` PASS.

Pièges : si pnpm refuse un script de build (protobuf de Next/Tailwind), ajouter l'entrée `allowBuilds` correspondante dans `pnpm-workspace.yaml` jamais en silence, en commentant pourquoi. Si `minimumReleaseAge` retient les versions trop récentes de next/react, épingler une version assez âgée plutôt qu'exclure, sauf raison écrite.

- [ ] **Step 5 : Commit**

```bash
git add apps/web .gitignore pnpm-workspace.yaml
git commit -m "feat(web): socle apps/web - next, tailwind, vitest, menu trois chemins"
```

---

### Task 2 : thème clair/sombre logique pure + script anti-flash

**Files:**
- Create: `apps/web/src/lib/theme.ts`
- Test: `apps/web/src/lib/theme.test.ts`
- Modify: `apps/web/src/app/layout.tsx` (script inline anti-flash)

**Interfaces:**
- Consumes: rien.
- Produces: `type ThemePreference = 'light' | 'dark' | 'system'` ; `resolveTheme(preference: ThemePreference, prefersDark: boolean): 'light' | 'dark'` ; `readPreference(storage: Storage | null): ThemePreference` ; `writePreference(storage: Storage | null, preference: ThemePreference): void` ; `THEME_STORAGE_KEY: 'pf-theme'`.

- [ ] **Step 1 : tests qui échouent**

`apps/web/src/lib/theme.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { readPreference, resolveTheme, THEME_STORAGE_KEY, writePreference } from './theme.js';

function fakeStorage(values: Record<string, string> = {}) {
  const map = new Map(Object.entries(values));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

describe('resolveTheme', () => {
  it('system suit la préférence du système', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('light et dark s’imposent, quel que soit le système', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('readPreference', () => {
  it('sans storage ni valeur, revient à system', () => {
    expect(readPreference(null)).toBe('system');
    expect(readPreference(fakeStorage() as unknown as Storage)).toBe('system');
  });

  it('une valeur inconnue est rejetée, pas crachée', () => {
    expect(readPreference(fakeStorage({ [THEME_STORAGE_KEY]: 'bleu' }) as unknown as Storage)).toBe(
      'system',
    );
  });

  it('relit une préférence écrite', () => {
    const storage = fakeStorage() as unknown as Storage;
    writePreference(storage, 'dark');
    expect(readPreference(storage)).toBe('dark');
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run: `pnpm --filter @buildit/web test`
Expected: FAIL `./theme.js` introuvable.

- [ ] **Step 3 : implémenter**

`apps/web/src/lib/theme.ts` :

```ts
export type ThemePreference = 'light' | 'dark' | 'system';
export const THEME_STORAGE_KEY = 'pf-theme';

const PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system'];

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): 'light' | 'dark' {
  if (preference === 'system') return prefersDark ? 'dark' : 'light';
  return preference;
}

export function readPreference(storage: Storage | null): ThemePreference {
  const raw = storage?.getItem(THEME_STORAGE_KEY) ?? null;
  return PREFERENCES.find((value) => value === raw) ?? 'system';
}

export function writePreference(storage: Storage | null, preference: ThemePreference): void {
  storage?.setItem(THEME_STORAGE_KEY, preference);
}
```

Dans `layout.tsx`, ajouter le script anti-flash (avant `<body>`, dans `<head>`) qui pose `data-theme` avant le premier rendu :

```tsx
<head>
  <script
    dangerouslySetInnerHTML={{
      __html: `(function(){try{var p=localStorage.getItem('pf-theme')||'system';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){}})();`,
    }}
  />
</head>
```

- [ ] **Step 4 : vérifier le vert**

Run: `pnpm --filter @buildit/web test && pnpm --filter @buildit/web typecheck`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add apps/web/src/lib apps/web/src/app/layout.tsx
git commit -m "feat(web): theme clair/sombre sans flash, logique pure testee"
```

---

### Task 3 : brouillon auto-sauvegardé jamais de valeur sensible (§3, §6.8, §24)

**Files:**
- Create: `apps/web/src/lib/draft.ts`
- Test: `apps/web/src/lib/draft.test.ts`

**Interfaces:**
- Consumes: `PROJECT_NAME_PATTERN` de `@buildit/manifest` (validation du nom côté client, la validation finale reste `parseManifest` côté serveur).
- Produces:
  - `interface DraftState { version: number; step: StepId; mode: 'guided' | 'expert'; name: string; targets: string[]; type?: string; architecture?: string; technologies: string[]; capabilities: string[]; envVarNames: string[]; infra: { docker: boolean; ci: boolean }; resolution?: { status: 'certified' | 'experimental'; issues: readonly string[] } }` (le type `StepId` vient de la Task 4 ; le champ `resolution` est **transitoire**, jamais persisté voir `toPersisted`).
  - `DRAFT_VERSION: 1` ; `freshDraft(): DraftState` ; `loadDraft(storage: Storage | null): DraftState` ; `saveDraft(storage: Storage | null, draft: DraftState): void` ; `clearDraft(storage: Storage | null): void`.

Décision écrite : un brouillon d'une version antérieure est **réinitialisé** (état d'UI éphémère, pas un manifest le migrateur du manifest ne s'applique pas ici) ; toute entrée de variable d'environnement ne porte qu'un **nom**, jamais une valeur.

- [ ] **Step 1 : tests qui échouent**

`apps/web/src/lib/draft.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { clearDraft, DRAFT_VERSION, freshDraft, loadDraft, saveDraft } from './draft.js';

function fakeStorage(values: Record<string, string> = {}) {
  const map = new Map(Object.entries(values));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

describe('saveDraft / loadDraft round-trip', () => {
  it('rend un brouillon identique', () => {
    const storage = fakeStorage() as unknown as Storage;
    const draft = { ...freshDraft(), name: 'mon-projet', targets: ['web'] };
    saveDraft(storage, draft);
    expect(loadDraft(storage)).toEqual(draft);
  });
});

describe('loadDraft reprise impossible rend un brouillon frais, jamais un crash', () => {
  it('sans storage', () => {
    expect(loadDraft(null)).toEqual(freshDraft());
  });

  it('avec JSON corrompu', () => {
    const storage = fakeStorage({ 'pf-draft': '{oops' }) as unknown as Storage;
    expect(loadDraft(storage)).toEqual(freshDraft());
  });

  it('avec une version antérieure ou future', () => {
    const ancien = JSON.stringify({ ...freshDraft(), version: DRAFT_VERSION - 1 });
    const storage = fakeStorage({ 'pf-draft': ancien }) as unknown as Storage;
    expect(loadDraft(storage)).toEqual(freshDraft());
  });

  it('avec des champs manquants', () => {
    const storage = fakeStorage({ 'pf-draft': '{"version":1}' }) as unknown as Storage;
    expect(loadDraft(storage)).toEqual(freshDraft());
  });
});

describe('§6.8 aucune valeur sensible dans le brouillon', () => {
  it('les variables d’environnement ne portent que des noms', () => {
    const draft = freshDraft();
    expect(draft.envVarNames).toEqual([]);
    expect(Object.keys(draft)).not.toContain('envVars');
    expect(JSON.stringify(draft)).not.toContain('value');
  });

  it('la résolution du moteur est transitoire : saveDraft ne la persiste pas', () => {
    const storage = fakeStorage() as unknown as Storage;
    const draft = {
      ...freshDraft(),
      resolution: { status: 'certified' as const, issues: [] },
    };
    saveDraft(storage, draft);
    expect(loadDraft(storage).resolution).toBeUndefined();
  });
});

describe('clearDraft', () => {
  it('oublie le brouillon', () => {
    const storage = fakeStorage() as unknown as Storage;
    saveDraft(storage, { ...freshDraft(), name: 'x' });
    clearDraft(storage);
    expect(loadDraft(storage)).toEqual(freshDraft());
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run: `pnpm --filter @buildit/web test -- draft`
Expected: FAIL `./draft.js` introuvable.

- [ ] **Step 3 : implémenter**

`apps/web/src/lib/draft.ts` le type `StepId` et `STEP_ORDER` viennent de la Task 4 ; pour garder les tâches indépendantes, la Task 3 importe `STEP_ORDER` et la Task 4 le définit (le premier implémenteur de la Task 3 crée `flow.ts` avec sa seule liste de steps, la Task 4 remplace par la version à bloquants) :

```ts
import { STEP_ORDER } from './flow.js';

export const DRAFT_VERSION = 1;
export const DRAFT_STORAGE_KEY = 'pf-draft';

export interface DraftState {
  version: number;
  step: (typeof STEP_ORDER)[number];
  mode: 'guided' | 'expert';
  name: string;
  targets: string[];
  type?: string;
  architecture?: string;
  technologies: string[];
  capabilities: string[];
  /** Noms des variables d'environnement requises jamais leurs valeurs (§6.8). */
  envVarNames: string[];
  infra: { docker: boolean; ci: boolean };
  /** Résolution du moteur, recalculée à chaque changement jamais persistée. */
  resolution?: { status: 'certified' | 'experimental'; issues: readonly string[] };
}

export function freshDraft(): DraftState {
  return {
    version: DRAFT_VERSION,
    step: STEP_ORDER[0] as DraftState['step'],
    mode: 'guided',
    name: '',
    targets: [],
    technologies: [],
    capabilities: [],
    envVarNames: [],
    infra: { docker: false, ci: false },
  };
}

type Persisted = Omit<DraftState, 'resolution' | 'version' | 'step'> & {
  version: unknown;
  step: unknown;
};

function parsePersisted(raw: string): Persisted | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const candidate = parsed as Record<string, unknown>;
    if (candidate['version'] !== DRAFT_VERSION) return null;
    if (typeof candidate['name'] !== 'string' || !Array.isArray(candidate['targets'])) return null;
    return parsed as Persisted;
  } catch {
    return null;
  }
}

export function loadDraft(storage: Storage | null): DraftState {
  const raw = storage?.getItem(DRAFT_STORAGE_KEY) ?? null;
  if (raw === null) return freshDraft();
  const persisted = parsePersisted(raw);
  if (persisted === null) return freshDraft();
  return { ...freshDraft(), ...persisted, version: DRAFT_VERSION } as DraftState;
}

export function saveDraft(storage: Storage | null, draft: DraftState): void {
  const { resolution: _transitoire, ...persiste } = draft;
  storage?.setItem(DRAFT_STORAGE_KEY, JSON.stringify(persiste));
}

export function clearDraft(storage: Storage | null): void {
  storage?.removeItem(DRAFT_STORAGE_KEY);
}
```

Note : `noPropertyAccessFromIndexSignature` (base tsconfig) impose `candidate['version']` les crochets sont ici obligatoires, Biome `useLiteralKeys` ne se déclenche que pour les littéraux redondants sur des types à clés connues.

- [ ] **Step 4 : vérifier le vert**

Run: `pnpm --filter @buildit/web test -- draft`
Expected: PASS (24 assertions au total).

- [ ] **Step 5 : Commit**

```bash
git add apps/web/src/lib/draft.ts apps/web/src/lib/draft.test.ts apps/web/src/lib/flow.ts
git commit -m "feat(web): brouillon auto-sauvegarde, jamais de valeur sensible (6.8)"
```

---

### Task 4 : machine à états du parcours les bloquants du §6 comme tests

**Files:**
- Create: `apps/web/src/lib/flow.ts` (remplace le `flow.ts` créé en Task 3, qui ne contenait que `STEP_ORDER`)
- Test: `apps/web/src/lib/flow.test.ts`

**Interfaces:**
- Consumes: `freshDraft` / `DraftState` de `draft.ts` (Task 3).
- Produces:
  - `STEP_ORDER = ['create', 'target', 'type', 'architecture', 'stack', 'capabilities', 'env', 'infrastructure', 'blueprint', 'preview', 'generate', 'report'] as const` les 14 écrans du §3 minus menu/graph (le Dependency Graph est accessible depuis le Blueprint, §6.11, pas une étape).
  - `nextStep(step: StepId): StepId | null` ; `previousStep(step: StepId): StepId | null` (bornes : `null`).
  - `canAdvance(draft: DraftState): boolean` les bloquants du §6 :
    - `create` : le nom satisfait `PROJECT_NAME_PATTERN` ;
    - `target` : au moins une cible (§6.3) ;
    - `stack` : la résolution stockée existe et `issues` est vide ;
    - tout autre step : `true` (aucun bloquant écrit dans le §6 documenté, pas oublié).

- [ ] **Step 1 : tests qui échouent un bloquant = un positif + un négatif**

`apps/web/src/lib/flow.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { freshDraft } from './draft.js';
import { canAdvance, nextStep, previousStep, STEP_ORDER } from './flow.js';

describe('STEP_ORDER', () => {
  it('couvre les étapes du §3 sans le menu ni le graphe', () => {
    expect(STEP_ORDER).toEqual([
      'create', 'target', 'type', 'architecture', 'stack', 'capabilities',
      'env', 'infrastructure', 'blueprint', 'preview', 'generate', 'report',
    ]);
  });

  it('next/previous bornés à null aux extrémités', () => {
    expect(previousStep('create')).toBeNull();
    expect(nextStep('report')).toBeNull();
    expect(nextStep('create')).toBe('target');
    expect(previousStep('target')).toBe('create');
  });
});

describe('canAdvance bloquants du §6', () => {
  it('create : un nom conforme passe', () => {
    expect(canAdvance({ ...freshDraft(), name: 'mon-projet' })).toBe(true);
  });

  it('create : un nom vide est refusé', () => {
    expect(canAdvance({ ...freshDraft(), name: '' })).toBe(false);
  });

  it('create : un nom invalide selon le pattern du manifest est refusé', () => {
    expect(canAdvance({ ...freshDraft(), name: 'Espace Interdit' })).toBe(false);
  });

  it('target : au moins une cible', () => {
    expect(canAdvance({ ...freshDraft(), step: 'target', targets: [] })).toBe(false);
    expect(canAdvance({ ...freshDraft(), step: 'target', targets: ['web'] })).toBe(true);
  });

  it('stack : la résolution doit exister et ne porter aucun problème', () => {
    const base = { ...freshDraft(), name: 'ok', targets: ['web'], step: 'stack' as const };
    expect(canAdvance(base)).toBe(false);
    expect(
      canAdvance({ ...base, resolution: { status: 'certified', issues: ['doublon'] } }),
    ).toBe(false);
    expect(canAdvance({ ...base, resolution: { status: 'certified', issues: [] } })).toBe(true);
    expect(
      canAdvance({ ...base, resolution: { status: 'experimental', issues: [] } }),
    ).toBe(true);
  });

  it('les étapes sans bloquant écrit passent', () => {
    for (const step of ['type', 'capabilities', 'env', 'infrastructure'] as const) {
      expect(canAdvance({ ...freshDraft(), step })).toBe(true);
    }
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run: `pnpm --filter @buildit/web test -- flow`
Expected: FAIL les fonctions n'existent pas (ou `flow.ts` ne contient que `STEP_ORDER`).

- [ ] **Step 3 : implémenter**

`apps/web/src/lib/flow.ts` :

```ts
import { PROJECT_NAME_PATTERN } from '@buildit/manifest';
import type { DraftState } from './draft.js';

export const STEP_ORDER = [
  'create', 'target', 'type', 'architecture', 'stack', 'capabilities',
  'env', 'infrastructure', 'blueprint', 'preview', 'generate', 'report',
] as const;

export type StepId = (typeof STEP_ORDER)[number];

export function nextStep(step: StepId): StepId | null {
  const index = STEP_ORDER.indexOf(step);
  return index >= 0 && index < STEP_ORDER.length - 1 ? (STEP_ORDER[index + 1] as StepId) : null;
}

export function previousStep(step: StepId): StepId | null {
  const index = STEP_ORDER.indexOf(step);
  return index > 0 ? (STEP_ORDER[index - 1] as StepId) : null;
}

export function canAdvance(draft: DraftState): boolean {
  switch (draft.step) {
    case 'create':
      return PROJECT_NAME_PATTERN.test(draft.name);
    case 'target':
      return draft.targets.length > 0;
    case 'stack':
      return draft.resolution !== undefined && draft.resolution.issues.length === 0;
    default:
      // Aucun bloquant écrit dans le §6 pour ces écrans choix, pas oubli.
      return true;
  }
}
```

Adapter `draft.ts` : il importait `STEP_ORDER` de `flow.ts` l'import reste, seule la définition bouge ici (Task 3 avait créé le fichier avec la liste seule ; fusionner proprement).

- [ ] **Step 4 : vérifier le vert**

Run: `pnpm --filter @buildit/web test && pnpm --filter @buildit/web typecheck`
Expected: PASS tous les tests draft + flow.

- [ ] **Step 5 : Commit**

```bash
git add apps/web/src/lib
git commit -m "feat(web): machine a etats du parcours, bloquants du 6 en tests"
```

---

### Task 5 : adaptateur moteur le web parle au moteur, un seul endroit (8B.2)

**Files:**
- Create: `apps/web/src/lib/engine.ts`
- Test: `apps/web/src/lib/engine.test.ts`
- Modify: `apps/web/package.json` (dépendances workspace : `@buildit/registry`, `@buildit/compatibility`, `@buildit/generator`, `@buildit/manifest`, `@buildit/presets`)
- Create: `apps/web/src/lib/server-only.ts` (garde `server-only`)

**Interfaces:**
- Consumes (signatures exactes, vérifiées le 06/10/2026) :
  - `loadRegistry(): Promise<Registry>` et `registry.query(criteria: RegistryQuery): RegistryEntry[]` `packages/registry/src/load.ts` ; `type Category` est ré-exporté par `@buildit/registry` ;
  - `optionsFor(category: Category, selection: Selection, registry: Registry): Option[]` avec `Option = { entry: RegistryEntry; state: 'selected' | 'available' | 'blocked'; reason?: string }` `packages/compatibility/src/resolve.ts` ;
  - `resolve(selection: Selection, registry: Registry): ParseResult<Resolution, CompatibilityCode>` avec `Resolution = { technologies, additions, status: 'certified' | 'experimental', warnings }` ;
  - `selectionFromManifest(manifest: Manifest): Selection` `packages/generator/src/pipeline.ts` ;
  - `getPreset(id: string): Preset | undefined` et `PRESETS: readonly Preset[]` `packages/presets` ; un `Preset` porte `manifest(name: string): Manifest` ;
  - `planProject(manifest: Manifest, targetDir: string, options?: PipelineOptions): ParseResult<ProjectPlan, string>` dry-run, **n'écrit rien** et `generateProject(manifest, targetDir, options?)` pour la génération (8D.4, hors de ce plan) `packages/generator/src/pipeline.ts` ;
  - `parseManifest(input: unknown)` canonicalise, seul point d'entrée vers le générateur.
- Produces (ce que les Server Actions des écrans appelleront l'adaptateur parle les **types du moteur**, pas ceux de l'UI ; la conversion draft → `Selection` se fait à l'appel, c'est trivial : `{ targets, technologies }`) :
  - `stackOptions(category: Category, selection: Selection): Promise<OptionView[]>` avec `interface OptionView { id: string; label: string; category: string; state: 'selected' | 'available' | 'blocked'; reason?: string }` ;
  - `resolveSelection(selection: Selection): Promise<ResolutionView>` avec `interface ResolutionView { status: 'certified' | 'experimental'; issues: readonly string[] }` ;
  - `listPresets(): PresetView[]` avec `interface PresetView { id: PresetId; name: string; description: string }` ;
  - `previewPlan(manifest: Manifest): Promise<{ files: readonly string[]; warnings: readonly string[] }>` dry-run via `planProject` ; `targetDir` ne sert qu'à nommer les fichiers, rien n'est écrit.

- [ ] **Step 1 : tests qui échouent avec le vrai registry et le vrai preset SaaS**

`apps/web/src/lib/engine.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { selectionFromManifest } from '@buildit/generator';
import { getPreset } from '@buildit/presets';
import { listPresets, resolveSelection, stackOptions } from './engine.js';

describe('stackOptions', () => {
  it(‘liste les options d’une catégorie avec leur état’, async () => {
    const options = await stackOptions('frontend', { targets: ['web'], technologies: [] });
    expect(options.length).toBeGreaterThan(0);
    const next = options.find((option) => option.id === 'next');
    expect(next).toBeDefined();
    expect(next?.state).toBe('available');
  });

  it('une option incompatible est bloquée avec une raison lisible (§5)', async () => {
    const options = await stackOptions('frontend', { targets: ['mobile'], technologies: [] });
    const bloquee = options.find((option) => option.state === 'blocked');
    expect(bloquee?.reason).toBeTruthy();
  });
});

describe('resolveSelection', () => {
  it('la sélection du preset SaaS résout en certified, avec le vrai catalogue', async () => {
    const saas = getPreset('saas');
    expect(saas).toBeDefined();
    if (saas === undefined) return;
    const selection = selectionFromManifest(saas.manifest('essai'));
    const resolution = await resolveSelection(selection);
    expect(resolution.status).toBe('certified');
    expect(resolution.issues).toEqual([]);
  });
});

describe('listPresets', () => {
  it('expose les quatre presets certifiés', () => {
    const ids = listPresets().map((preset) => preset.id);
    expect(ids).toEqual(['saas', 'dashboard', 'api', 'fullstack']);
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run: `pnpm --filter @buildit/web test -- engine`
Expected: FAIL `./engine.js` introuvable.

- [ ] **Step 3 : implémenter**

Ajouter aux `devDependencies` de `apps/web/package.json` (versions workspace, comme `apps/cli`) : `@buildit/registry`, `@buildit/compatibility`, `@buildit/generator`, `@buildit/manifest`, `@buildit/presets`, et la dépendance `server-only` (épinglée).

`apps/web/src/lib/engine.ts` :

```ts
import 'server-only';
import { optionsFor, resolve, type Selection } from '@buildit/compatibility';
import { planProject } from '@buildit/generator';
import type { Manifest } from '@buildit/manifest';
import { PRESETS, type PresetId } from '@buildit/presets';
import { loadRegistry, type Category } from '@buildit/registry';

export interface OptionView {
  id: string;
  label: string;
  category: string;
  state: 'selected' | 'available' | 'blocked';
  reason?: string;
}

export interface ResolutionView {
  status: 'certified' | 'experimental';
  issues: readonly string[];
}

export interface PresetView {
  id: PresetId;
  name: string;
  description: string;
}

let registryPromise: ReturnType<typeof loadRegistry> | undefined;

function getRegistry(): ReturnType<typeof loadRegistry> {
  registryPromise ??= loadRegistry();
  return registryPromise;
}

export async function stackOptions(
  category: Category,
  selection: Selection,
): Promise<OptionView[]> {
  const registry = await getRegistry();
  return optionsFor(category, selection, registry).map((option) => ({
    id: option.entry.id,
    label: option.entry.name,
    category: option.entry.category,
    state: option.state,
    reason: option.reason,
  }));
}

export async function resolveSelection(selection: Selection): Promise<ResolutionView> {
  const registry = await getRegistry();
  const result = resolve(selection, registry);
  if (!result.ok) {
    return { status: 'experimental', issues: result.issues.map((issue) => issue.code) };
  }
  return { status: result.value.status, issues: [] };
}

export function listPresets(): PresetView[] {
  return PRESETS.map((preset) => ({
    id: preset.id,
    name: preset.name,
    description: preset.description,
  }));
}

export async function previewPlan(
  manifest: Manifest,
): Promise<{ files: readonly string[]; warnings: readonly string[] }> {
  // Dry-run : planProject décide tout et n'écrit rien (§22).
  const result = planProject(manifest, '/pf-preview');
  if (!result.ok) {
    return { files: [], warnings: result.issues.map((issue) => String(issue)) };
  }
  return {
    files: result.value.plan.files.map((file) => file.path),
    warnings: result.value.warnings.map((warning) => String(warning)),
  };
}
```

**Adapter à la réalité des types** : la forme de `FilePlan.files`, de `PipelineIssue` et de l'échec `ParseResult` (`.issues[].code`) doivent être relues dans `packages/generator/src/plan.ts` et `packages/validation` au moment d'implémenter les signatures citées ci-dessus viennent des sources du 06/10/2026 ; si un champ diffère, c'est le champ qui fait foi, pas le plan. `getPreset` sert à l'écran Create (8C.2) : le serveur d'un preset produit le manifest complet, la suite du parcours pré-remplit le brouillon.

- [ ] **Step 4 : vérifier le vert**

Run: `pnpm install && pnpm --filter @buildit/web test -- engine && pnpm --filter @buildit/web typecheck`
Expected: PASS les options du vrai catalogue arrivent avec leurs états ; au moins une option bloquée porte une raison.

- [ ] **Step 5 : Commit**

```bash
git add apps/web/src/lib/engine.ts apps/web/src/lib/engine.test.ts apps/web/package.json apps/web/src/lib/server-only.ts
git commit -m "feat(web): adaptateur moteur - le web consomme les memes paquets que le cli"
```

---

### Task 6 : Server Action de génération du brouillon → manifest (contrat UI/CLI, §9)

**Files:**
- Create: `apps/web/src/lib/draft-to-manifest.ts`
- Test: `apps/web/src/lib/draft-to-manifest.test.ts`

**Interfaces:**
- Consumes: `parseManifest`, `serializeManifest`, `MANIFEST_KEY_ORDER` de `@buildit/manifest`.
- Produces: `draftToManifest(draft: DraftState): ParseResult<Manifest, ManifestIssueCode>` **la règle byte-identical du gate M5 commence ici** : les mêmes choix en CLI et en UI passent par `parseManifest`, qui rend la forme canonique ; un test compare la sérialisation du manifest issu du draft avec celle du manifest construit à la main.

- [ ] **Step 1 : test qui échoue le même choix doit donner le même manifest octet pour octet**

`apps/web/src/lib/draft-to-manifest.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { serializeManifest } from '@buildit/manifest';
import { freshDraft } from './draft.js';
import { draftToManifest } from './draft-to-manifest.js';

describe('draftToManifest', () => {
  it('un brouillon incomplet est refusé avec des problèmes lisibles', () => {
    const result = draftToManifest(freshDraft());
    expect(result.ok).toBe(false);
  });

  it('le même choix au CLI et à l’UI produit le même manifest canonique', () => {
    const draft = {
      ...freshDraft(),
      name: 'mon-projet',
      targets: ['web'],
      technologies: ['next', 'typescript', 'tailwind'],
    };
    const result = draftToManifest(draft);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // serializeManifest est canonique (ensembles triés, clés ordonnées) :
    // la même sélection saisie dans un autre ordre donne la même chaîne.
    const inverse = { ...draft, technologies: [...draft.technologies].reverse() };
    const other = draftToManifest(inverse);
    expect(other.ok).toBe(true);
    if (!other.ok) return;
    expect(serializeManifest(result.value)).toBe(serializeManifest(other.value));
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run: `pnpm --filter @buildit/web test -- draft-to-manifest`
Expected: FAIL module absent.

- [ ] **Step 3 : implémenter**

`apps/web/src/lib/draft-to-manifest.ts` assembler l'objet manifest **dans les champs du §10**, puis passer par `parseManifest` (jamais de cast). La forme réelle du manifest est visible dans le preset SaaS (`packages/presets/src/index.ts`) : `targets`, `architecture`, `frontend: { framework, language, styling, ui }`, `database: { engine, orm }`, `auth: { provider }`, `services`, `quality`. Le champ `type` du brouillon (écran Project Type : SaaS, marketplace…) **n'est pas un champ du manifest** c'est une donnée d'UI qui guide les recommandations ; le confirmer à `packages/manifest/src/schema/manifest.ts` et ne l'inventer pas :

```ts
import { parseManifest } from '@buildit/manifest';
import type { DraftState } from './draft.js';

/** La techno d'une catégorie choisie dans le brouillon vide sinon. */
function chosen(technologies: readonly string[], ids: readonly string[]): string | undefined {
  return ids.find((id) => technologies.includes(id));
}

export function draftToManifest(draft: DraftState): ReturnType<typeof parseManifest> {
  return parseManifest({
    manifestVersion: 1,
    name: draft.name,
    targets: draft.targets,
    architecture: draft.architecture,
    frontend:
      draft.targets.includes('web') || draft.targets.includes('mobile')
        ? {
            framework: chosen(draft.technologies, ['next', 'expo']),
            language: chosen(draft.technologies, ['typescript', 'javascript']),
            styling: chosen(draft.technologies, ['tailwind']),
            ui: chosen(draft.technologies, ['shadcn-ui']),
          }
        : undefined,
    database: {
      engine: chosen(draft.technologies, ['postgresql', 'sqlite', 'mysql']),
      orm: chosen(draft.technologies, ['prisma', 'drizzle']),
    },
    auth: { provider: chosen(draft.technologies, ['better-auth', 'next-auth', 'clerk']) },
    services: draft.capabilities,
    quality: [],
  });
}
```

**Adapter au schéma réel** : la correspondance ci-dessus illustre la mécanique avec les ids du preset SaaS ; les catégories et ids exacts viennent du registry (`packages/registry/data/`) relire `schema/manifest.ts` et ajuster champ par champ. Principe invariant : **aucun champ libre à part `name`**, tout passe par `parseManifest`, qui rejette ce qui n'existe pas.

- [ ] **Step 4 : vérifier le vert**

Run: `pnpm --filter @buildit/web test -- draft-to-manifest && pnpm --filter @buildit/web typecheck`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add apps/web/src/lib/draft-to-manifest.ts apps/web/src/lib/draft-to-manifest.test.ts
git commit -m "feat(web): brouillon vers manifest canonique - meme contrat que le cli"
```

---

### Task 7 : toasts store pur, zéro dépendance

**Files:**
- Create: `apps/web/src/lib/toasts.ts`
- Create: `apps/web/src/app/toaster.tsx`
- Test: `apps/web/src/lib/toasts.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `toast(message: string, options?: { kind?: 'info' | 'success' | 'error'; durationMs?: number }): void` ; `subscribeToasts(listener: (toasts: readonly ActiveToast[]) => void): () => void` avec `interface ActiveToast { id: number; message: string; kind: 'info' | 'success' | 'error' }` ; `<Toaster />` (client component) rendu dans `layout.tsx`.

- [ ] **Step 1 : tests qui échouent émission, notification, expiration avec fausses horloges**

`apps/web/src/lib/toasts.test.ts` :

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { subscribeToasts, toast } from './toasts.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('toast', () => {
  it('notifie les abonnés', () => {
    const seen: string[] = [];
    const unsubscribe = subscribeToasts((toasts) => seen.push(...toasts.map((t) => t.message)));
    toast('projet généré', { kind: 'success' });
    expect(seen).toEqual(['projet généré']);
    unsubscribe();
  });

  it('expire au bout de la durée demandée (fake timers)', () => {
    vi.useFakeTimers();
    const unsubscribe = subscribeToasts(() => {});
    const seen: number[] = [];
    const unsubscribe2 = subscribeToasts((toasts) => seen.push(toasts.length));
    void unsubscribe;
    toast('echo');
    vi.advanceTimersByTime(5_000);
    expect(seen.at(-1)).toBe(0);
    unsubscribe2();
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run: `pnpm --filter @buildit/web test -- toasts`
Expected: FAIL module absent.

- [ ] **Step 3 : implémenter**

`apps/web/src/lib/toasts.ts` :

```ts
export interface ActiveToast {
  id: number;
  message: string;
  kind: 'info' | 'success' | 'error';
}

const DEFAULT_DURATION_MS = 4_000;

let nextId = 0;
let active: readonly ActiveToast[] = [];
const listeners = new Set<(toasts: readonly ActiveToast[]) => void>();

function emit(): void {
  for (const listener of listeners) listener(active);
}

export function toast(
  message: string,
  options: { kind?: ActiveToast['kind']; durationMs?: number } = {},
): void {
  const id = ++nextId;
  active = [...active, { id, message, kind: options.kind ?? 'info' }];
  emit();
  setTimeout(() => {
    active = active.filter((t) => t.id !== id);
    emit();
  }, options.durationMs ?? DEFAULT_DURATION_MS);
}

export function subscribeToasts(listener: (toasts: readonly ActiveToast[]) => void): () => void {
  listeners.add(listener);
  listener(active);
  return () => void listeners.delete(listener);
}
```

`apps/web/src/app/toaster.tsx` (client) : `useEffect` s'abonne, rend une liste `role="status"` l'accessibilité fine reste pour 8F, mais le rôle est posé dès maintenant.

- [ ] **Step 4 : vérifier le vert**

Run: `pnpm --filter @buildit/web test && pnpm --filter @buildit/web typecheck && pnpm --filter @buildit/web lint`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add apps/web/src/lib/toasts.ts apps/web/src/lib/toasts.test.ts apps/web/src/app/toaster.tsx apps/web/src/app/layout.tsx
git commit -m "feat(web): toasts sans dependance, store pur teste"
```

---

### Task 8 : commande `pf web` le serveur local, lié à 127.0.0.1

**Files:**
- Create: `apps/cli/src/commands/web.ts`
- Test: `apps/cli/src/commands/web.test.ts`
- Modify: `apps/cli/src/cli.ts` (enregistrement dans `COMMANDS`)
- Modify: `docs/cli.md` (section de référence)
- Modify: `apps/cli/src/commands/menu.ts` (le menu d'accueil propose « Configurateur web » si le serveur est construit optionnel, garder simple : ne pas toucher le menu dans cette tâche, décision à 8G.1)

**Interfaces:**
- Consumes: `nodeCommandRunner`, `resolveCommand` de `@buildit/exec` (résolution Windows sans shell le piège du `.cmd` est déjà résolu là) ; le harnais de test existant d'apps/cli : `run` (`src/cli.js`), `fakeIo` (`src/fake-io.ts` options `cwd`, `runner`, `platform`), `fakeWorld` (`src/fake-world.ts` commandes scriptées, `world.calls`).
- Produces: `pf web [--port <n>] [--no-open]` démarre le serveur Next construit (`apps/web/.next/standalone/server.js` après `next build`, résolu sous le `cwd` courant la racine du monorepo en dev), sur `127.0.0.1:<port>` (défaut 4173), ouvre le navigateur sauf `--no-open`, reste au premier plan (Ctrl-C arrête). Erreurs actionnables : serveur non construit → « lancez pnpm build » ; port occupé → « un serveur répond déjà sur ce port » et arrêt (le piège de l'orphelin, PROJECT_CONTEXT §115).

Nouveau sur `Io` : `portProbe(host: string, port: number): Promise<boolean>` même logique que `fetch` et `runner`, déjà injectables sur `Io` : la sonde réseau est une dépendance de l'Io, pas un global. `node-io.ts` fournit la vraie (TCP `node:net.connect`), `fake-io.ts` accepte `portProbe` en option.

- [ ] **Step 1 : tests qui échouent avec le harnais existant du CLI**

`apps/cli/src/commands/web.test.ts` mêmes montages que `open.test.ts` : vrais dossiers temporaires pour le fs, `fakeWorld` pour les process, `fakeIo` pour l'Io :

```ts
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from '../cli.js';
import { fakeIo } from '../fake-io.js';
import { fakeWorld } from '../fake-world.js';

const ok = () => ({ exitCode: 0, output: '' });

async function builtWebApp(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'pf-web-'));
  const server = join(root, 'apps/web/.next/standalone');
  await mkdir(server, { recursive: true });
  await writeFile(join(server, 'server.js'), '// serveur factice');
  return root;
}

describe('pf web', () => {
  it('démarre le serveur standalone sur 127.0.0.1, jamais 0.0.0.0', async () => {
    const world = fakeWorld({ node: ok, explorer: ok });
    const io = fakeIo({ cwd: await builtWebApp(), runner: world, platform: 'win32' });
    expect(await run(['web', '--no-open'], io)).toBe(0);
    const server = world.calls.find((call) => call.command === 'node');
    expect(server).toBeDefined();
    expect(server?.args.join(' ')).toContain('127.0.0.1');
    expect(server?.args.join(' ')).not.toContain('0.0.0.0');
  });

  it('sans serveur construit, dit quoi faire', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pf-web-vide-'));
    const io = fakeIo({ cwd: root });
    expect(await run(['web'], io)).toBe(1);
    expect(io.text().out).toContain('pnpm build');
  });

  it('un port déjà servi est refusé, pas de second serveur', async () => {
    const world = fakeWorld({ node: ok, explorer: ok });
    const io = fakeIo({
      cwd: await builtWebApp(),
      runner: world,
      portProbe: async () => true,
    });
    expect(await run(['web', '--no-open'], io)).toBe(1);
    expect(world.calls.find((call) => call.command === 'node')).toBeUndefined();
    expect(io.text().out).toContain('répond déjà');
  });

  it('ouvre le navigateur sans --no-open, jamais via un shell', async () => {
    const world = fakeWorld({ node: ok, explorer: ok });
    const io = fakeIo({
      cwd: await builtWebApp(),
      runner: world,
      platform: 'win32',
      portProbe: async () => false,
    });
    expect(await run(['web'], io)).toBe(0);
    const open = world.calls.find((call) => call.command === 'explorer');
    expect(open).toBeDefined();
    expect(open?.args.join(' ')).toContain('http://127.0.0.1');
  });
});
```

- [ ] **Step 2 : vérifier l'échec**

Run: `pnpm --filter @buildit/cli test -- web`
Expected: FAIL `web` inconnu du CLI (la commande n'est pas encore enregistrée).

- [ ] **Step 3 : implémenter**

`apps/cli/src/commands/web.ts` structure : parser les flags (`--port`, `--no-open`) avec `parseArgs` comme les autres commandes ; vérifier l'existence de `apps/web/.next/standalone/server.js` sous le `cwd` (fs réel, comme `open` vérifie ses manifests) ; sonder le port via `io.portProbe('127.0.0.1', port)` ; lancer `node server.js` via le runner de l'`Io` avec l'environnement de la commande seule (`HOSTNAME: '127.0.0.1'`, `PORT: String(port)` le mécanisme `options.env` de `packages/exec`) ; ouvrir le navigateur via `resolveCommand` selon `io.platform` (win32 → `explorer`, darwin → `open`, linux → `xdg-open`) **sans shell** ; attendre le fils (premier plan, Ctrl-C). Enregistrer `web` dans `COMMANDS` (`src/cli.ts`).

Étendre `Io` avec `portProbe` et brancher : vraie sonde TCP dans `node-io.ts`, option `portProbe` dans `fake-io.ts` (défaut : `async () => false`).

Erreurs selon la convention des autres commandes : message qui dit quoi faire, code 1.

- [ ] **Step 4 : vérifier le vert**

Run: `pnpm --filter @buildit/cli test -- web && pnpm --filter @buildit/cli typecheck && pnpm --filter @buildit/cli lint`
Expected: PASS.

- [ ] **Step 5 : vérifier en réel** (`run`)

Run: `pnpm build && pnpm pf web --no-open` puis ouvrir `http://127.0.0.1:4173` dans un navigateur, et Ctrl-C.
Expected: la page du menu trois chemins s'affiche ; le second `pf web` sans arrêt du premier refuse avec le message du port.

- [ ] **Step 6 : Commit + doc**

Mettre à jour `docs/cli.md` (section `pf web` : flags, port, prérequis `pnpm build`, note « local uniquement »).

```bash
git add apps/cli/src/commands/web.ts apps/cli/src/commands/web.test.ts apps/cli/src/cli.ts docs/cli.md
git commit -m "feat(cli): pf web - serveur local du configurateur, 127.0.0.1 uniquement"
```

---

### Task 9 : câblage CI locale + preuve de bout en bout du socle

**Files:**
- Modify: rien si turbo découvre `apps/web` (il le fait : `apps/*`) la tâche est une **vérification**, avec corrections au passage si un chaînon manque.

**Interfaces:**
- Consumes: toutes les tâches précédentes.
- Produces: la preuve que `pnpm ci:local` couvre le web, et que `pnpm pf web` sert la page construite le socle 8B est clos.

- [ ] **Step 1 : CI locale verte de bout en bout**

Run: `pnpm ci:local`
Expected: PASS lint (Biome couvre le TSX), typecheck, test, build (`next build` y compris), secretlint.

- [ ] **Step 2 : le piège du cache turbo (Review Focus #4)**

Run: `pnpm build` deux fois de suite (le second doit afficher `full turbo` cache), puis vérifier que `apps/web/.next/BUILD_ID` existe après le build en cache.
Expected: `.next/BUILD_ID` présent la config `outputs: ['.next/**', '!.next/cache/**']` de `apps/web/turbo.json` restaure bien `.next`. Sinon, corriger les outputs et relancer.

- [ ] **Step 3 : la preuve manuelle (gate 8B, style `run`)**

Run: `pnpm pf web`
Expected: navigateur ouvert sur le menu trois chemins ; bascule clair/sombre sans flash ; brouillon conservé après rechargement (Task 3 branchée sur `localStorage` par un composant client si ce branchement n'a pas encore d'écran, le prouver par un test de composant minimal plutôt que de coder un écran hors périmètre) ; Ctrl-C arrête proprement.

- [ ] **Step 4 : PROJECT_CONTEXT.md à jour**

Mettre à jour la section « État » : Phase 8B livrée (socle web), décision 8B.6 écrite dans le plan, prochaine étape 8A (gate humain sur la direction) puis 8C.

- [ ] **Step 5 : Commit**

```bash
git add PROJECT_CONTEXT.md
git commit -m "docs: 8B livree - socle web, decision 8B.6 serveur local"
```

---

## Gate de la sous-phase 8B `verification-before-completion`

- [ ] `pnpm ci:local` vert avec `apps/web` dedans (lint, typecheck, test, build, secretlint)
- [ ] Le web n'appelle le moteur que via `src/lib/engine.ts` + Server Actions grep : aucun import de `@buildit/*` hors de `src/lib/` (test ou vérification mécanique)
- [ ] Aucune valeur de variable d'environnement ne peut être persistée (test Task 3)
- [ ] Un brouillon corrompu/ancien rend un brouillon frais (tests Task 3)
- [ ] `pf web` écoute sur `127.0.0.1` et refuse un port déjà servi (tests Task 8 + vérification réelle)
- [ ] Le manifest issu d'un brouillon est canonique même chaîne que le CLI pour les mêmes choix (test Task 6)
- [ ] `PROJECT_CONTEXT.md` à jour
