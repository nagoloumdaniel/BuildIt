import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Les tests de génération écrivent un vrai projet : sous `turbo run test`
    // (13 paquets en parallèle), le délai par défaut de 5 s est dépassé de façon
    // reproductible, et le test passe toujours en isolation. Un test qui échoue
    // selon la charge ne prouve rien ; ce plafond ne fait qu'absorber la charge.
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Les deux coquilles du terminal (readline, process) : couvertes par les
      // scénarios manuels de 7.9, pas par des tests unitaires. Et l'aide aux tests.
      exclude: [
        'src/**/*.test.ts',
        'src/main.ts',
        'src/node-io.ts',
        'src/fake-io.ts',
        'src/fake-world.ts',
      ],
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
});
