import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Même plafond que les autres paquets : la charge de `turbo run test` ne
    // doit pas décider du résultat d'une vérification.
    testTimeout: 30_000,
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
