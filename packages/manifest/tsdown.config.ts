import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node20.11',
  // Le paquet est `"type": "module"` : `.js` est déjà de l'ESM.
  // Sans cette ligne tsdown émet `.mjs`/`.d.mts`, qui ne correspondent
  // pas aux chemins déclarés dans `exports`.
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
});
