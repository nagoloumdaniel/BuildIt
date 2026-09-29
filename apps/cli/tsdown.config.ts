import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/main.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node20.11',
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
  // Les paquets du moteur sont privés : le binaire publié les embarque, et ne
  // dépend que de ce qu'eux-mêmes installent (zod, semver).
  noExternal: [/^@project-factory\//],
});
