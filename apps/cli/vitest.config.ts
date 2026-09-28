import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Les deux coquilles du terminal (readline, process) : couvertes par les
      // scénarios manuels de 7.9, pas par des tests unitaires. Et l'aide aux tests.
      exclude: ['src/**/*.test.ts', 'src/main.ts', 'src/node-io.ts', 'src/fake-io.ts'],
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
});
