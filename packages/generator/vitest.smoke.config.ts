import { defineConfig } from 'vitest/config';

/**
 * Test de fumée : génère de vrais projets, les installe depuis le registre npm
 * et lance leurs scripts. Réseau requis, environ une minute par projet — d'où
 * une configuration à part, hors de `pnpm test` et du hook pre-push.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.smoke.ts'],
    testTimeout: 600_000,
    hookTimeout: 600_000,
  },
});
