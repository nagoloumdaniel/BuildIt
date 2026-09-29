import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  target: 'node20.11',
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
});
