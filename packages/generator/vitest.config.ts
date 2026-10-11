import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // `socle.test.ts` écrit et vérifie un vrai projet : sous `turbo run test`,
    // le délai par défaut de 5 s est dépassé dès que la machine est chargée.
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.smoke.ts', 'src/generated/**'],
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
});
