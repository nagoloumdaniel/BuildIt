import { defineConfig } from 'vite';

// Port fixe : tauri.conf.json (devUrl) l'attend là.
export default defineConfig({
  clearScreen: false,
  server: { port: 5173, strictPort: true },
});
