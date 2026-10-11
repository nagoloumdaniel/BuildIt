/**
 * Le socle commun des parcours E2E : trouver le navigateur **déjà installé**,
 * démarrer le serveur réellement servi par `pf web`, et collecter les erreurs
 * survenues dans la page.
 *
 * Ce fichier existe pour qu'un second parcours (le clavier seul, gate M5) ne
 * recopie pas l'infrastructure du premier : deux copies de « comment démarrer
 * le serveur » finiraient par diverger, et l'une des deux lancerait un serveur
 * différent de celui qu'on croit tester.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** `apps/web`, déduit de l'emplacement de ce fichier (`e2e/`). */
export const APP_DIR = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
export const PORT = Number(process.env['PF_E2E_PORT'] ?? 4319);
export const BASE = `http://127.0.0.1:${PORT}`;
export const VIEWPORT = { width: 1280, height: 900 };

/**
 * Le navigateur n'est pas téléchargé : on pilote celui de la machine
 * (`PF_E2E_CHROMIUM`, sinon Edge ou Chrome installé). Sans navigateur trouvé,
 * le test **échoue** en disant quoi faire — sauf `PF_E2E_SKIP=1`, qui saute la
 * preuve explicitement (une preuve sautée doit être demandée).
 */
const BROWSERS = [
  process.env['PF_E2E_CHROMIUM'],
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter((path) => path !== undefined && path !== '');

export function browserPath() {
  const found = BROWSERS.find((path) => existsSync(path));
  if (found !== undefined) {
    return found;
  }
  if (process.env['PF_E2E_SKIP'] === '1') {
    return undefined;
  }
  throw new Error(
    'Aucun navigateur trouvé. Installez Chromium/Edge/Chrome, ou donnez son chemin par PF_E2E_CHROMIUM=<exécutable>, ou sautez cette preuve explicitement avec PF_E2E_SKIP=1.',
  );
}

export function check(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Les erreurs qui ne doivent jamais arriver pendant un parcours : exception de
 * page, `console.error`, et 404 (sauf `favicon.ico`, que l'app ne sert pas).
 *
 * La réponse 404 est écoutée plutôt que le message de console : elle dit
 * **quelle** URL a échoué, là où la console ne la nomme pas.
 *
 * Chaque erreur est aussi écrite tout de suite dans le journal : un parcours
 * long s'arrête parfois avant le récapitulatif, et l'erreur doit rester lisible.
 */
export function watchFailures(page) {
  const failures = [];
  const record = (message) => {
    failures.push(message);
    console.log(`  ⚠ erreur de page : ${message}`);
  };
  page.on('pageerror', (error) => record(`erreur de page : ${String(error)}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('Failed to load resource')) {
      record(`console : ${message.text()}`);
    }
  });
  page.on('response', (response) => {
    if (response.status() === 404 && !response.url().endsWith('/favicon.ico')) {
      record(`404 : ${response.url()}`);
    }
  });
  return failures;
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/create`);
      if (response.ok) {
        return;
      }
    } catch {
      // Pas encore prêt.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Le serveur n'a pas répondu sur ${BASE} après 30 s.`);
}

export async function startServer(workspace) {
  const nextBin = join(APP_DIR, 'node_modules', 'next', 'dist', 'bin', 'next');
  const child = spawn(process.execPath, [nextBin, 'start', '-H', '127.0.0.1', '-p', String(PORT)], {
    cwd: APP_DIR,
    env: { ...process.env, PF_WEB_WORKSPACE: workspace, HOSTNAME: '127.0.0.1', PORT: String(PORT) },
    stdio: 'ignore',
    detached: true,
  });
  await waitForServer();
  return child;
}

export function stopServer(child) {
  if (child.pid === undefined) {
    return;
  }
  try {
    // Le serveur Next lance des fils : on tue le groupe, pas seulement le père.
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    child.kill('SIGKILL');
  }
}
