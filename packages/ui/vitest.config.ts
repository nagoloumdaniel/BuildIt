import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Le paquet n'est pas compilé par Next dans ses tests : Vitest doit
  // transformer le JSX lui-même, avec le runtime automatique de React.
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    // Même plafond que les autres paquets : la charge de `turbo run test` ne
    // doit pas décider du résultat d'une vérification.
    testTimeout: 30_000,
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
});
