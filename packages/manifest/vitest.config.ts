import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      // Le manifest est le contrat dont dépend tout le moteur (§9). Le seuil est
      // imposé, pas seulement mesuré : un chiffre qu'on regarde sans le faire
      // respecter finit toujours par descendre.
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
});
