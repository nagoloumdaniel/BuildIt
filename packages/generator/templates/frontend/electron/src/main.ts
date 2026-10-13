import { join } from 'node:path';
import { app, BrowserWindow } from 'electron';

/**
 * Processus principal : ouvre la fenêtre et charge l'interface.
 *
 * L'interface n'a aucun accès à Node (`contextIsolation`, pas de
 * `nodeIntegration`) : ce qu'elle doit pouvoir faire passera par un preload.
 */
function createWindow(): void {
  const window = new BrowserWindow({
    width: 900,
    height: 640,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  void window.loadFile(join(import.meta.dirname, '..', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  // macOS : recréer une fenêtre quand l'icône du dock est cliquée.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
