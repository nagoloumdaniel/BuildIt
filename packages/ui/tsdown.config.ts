import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  // Composants partagés : ils tournent dans le navigateur et dans le serveur
  // Next, pas dans le CLI. `react` et son runtime JSX sont des pairs : on les
  // laisse hors du bundle, sinon deux copies de React cohabitent dans `apps/web`.
  target: 'es2022',
  platform: 'neutral',
  // `react` est un pair, et le runtime JSX engendré (`react/jsx-runtime`) ne
  // doit pas être inliné : sinon deux copies de React cohabitent dans `apps/web`.
  deps: { neverBundle: ['react', 'react-dom', 'react/jsx-runtime'] },
  outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
});
