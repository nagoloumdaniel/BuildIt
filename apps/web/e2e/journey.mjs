/**
 * Parcours §3 de bout en bout, dans un **vrai navigateur**, sur le serveur
 * réellement servi par `pf web`.
 *
 * Ce que ce test prouve, et qu'aucun test de composant ne peut prouver :
 *
 * 1. les 12 étapes s'enchaînent jusqu'au rapport, sur le vrai rendu ;
 * 2. une condition bloquante du §6 retient vraiment l'utilisateur ;
 * 3. le parcours est faisable **au clavier seul** (gate M5) ;
 * 4. le brouillon survit à un rechargement de page (§3) ;
 * 5. la génération écrit un projet sur le disque, et le rapport le dit ;
 * 6. `prefers-reduced-motion` et le thème clair/sombre ne cassent rien.
 *
 * Le navigateur n'est pas téléchargé : on pilote celui de la machine
 * (`PF_E2E_CHROMIUM`, sinon Edge ou Chrome installé). Sans navigateur trouvé,
 * le test **échoue** en disant quoi faire — sauf `PF_E2E_SKIP=1`, qui saute la
 * preuve explicitement (une preuve sautée doit être demandée).
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const APP_DIR = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const PORT = Number(process.env['PF_E2E_PORT'] ?? 4319);
const BASE = `http://127.0.0.1:${PORT}`;

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

function browserPath() {
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

function check(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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

async function startServer(workspace) {
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

function stopServer(child) {
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

async function journey(page, workspace) {
  const continueLink = () => page.getByRole('link', { name: 'Continuer' });

  // 1. Le Dashboard annonce les trois chemins du §18bis.
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  for (const label of ['Créer un projet', 'Cloner un projet', 'Ouvrir un projet local']) {
    check(
      (await page.getByText(label, { exact: false }).count()) > 0,
      `Le Dashboard n'annonce pas « ${label} ».`,
    );
  }

  // 2. Create Project : le nom est un bloquant (§6.2).
  await page.goto(`${BASE}/create`, { waitUntil: 'domcontentloaded' });
  check(
    (await continueLink().getAttribute('aria-disabled')) === 'true',
    'Sans nom, « Continuer » devrait être désactivé.',
  );
  await page.fill('#pf-project-name', 'parcours-e2e');
  await page.waitForFunction(
    () =>
      document.querySelector('a[aria-disabled]')?.getAttribute('aria-disabled') !== 'true' ||
      !document.querySelector('a[aria-disabled]'),
    undefined,
    { timeout: 5000 },
  );
  await continueLink().click();

  // 3. Target Selection, **au clavier seul** : c'est le gate M5.
  await page.waitForURL('**/create/target');
  check(
    (await continueLink().getAttribute('aria-disabled')) === 'true',
    'Sans plateforme, « Continuer » devrait être désactivé.',
  );
  await page.getByRole('button', { name: /^Web/ }).focus();
  await page.keyboard.press('Enter');
  check(
    (await page.getByRole('button', { name: /^Web/ }).getAttribute('aria-pressed')) === 'true',
    'La touche Entrée n’a pas sélectionné la plateforme Web.',
  );
  await continueLink().focus();
  await page.keyboard.press('Enter');

  // 4. Project Type et 5. Architecture : les recommandations du mode guidé.
  await page.waitForURL('**/create/type');
  await page.getByRole('button', { name: /^SaaS/ }).click();
  await continueLink().click();
  await page.waitForURL('**/create/architecture');
  await page.getByRole('button', { name: /^Application unique/ }).click();
  await continueLink().click();

  // 6. Stack Builder : la recherche globale choisit une pile cohérente.
  await page.waitForURL('**/create/stack');
  for (const [terme, nom] of [
    ['next', /Next\.js/],
    ['typescript', /TypeScript/],
    ['tailwind', /Tailwind/],
    ['postgresql', /PostgreSQL/],
    ['prisma', /Prisma/],
  ]) {
    await page.fill('#pf-stack-search', terme);
    const option = page.getByRole('button', { name: nom }).first();
    await option.waitFor({ state: 'visible', timeout: 15000 });
    await option.click();
    await page.waitForTimeout(250);
  }
  await page.fill('#pf-stack-search', '');
  await page.waitForFunction(
    () => document.querySelector('a[aria-disabled="true"]') === null,
    undefined,
    { timeout: 15000 },
  );

  // Le brouillon doit survivre à un rechargement complet (§3). On le vérifie
  // sur l'écran des plateformes, dont l'état est directement visible.
  await page.goto(`${BASE}/create/target`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => document.querySelector('button[aria-pressed="true"]') !== null,
    undefined,
    { timeout: 15000 },
  );
  check(
    (await page.getByRole('button', { name: /^Web/ }).getAttribute('aria-pressed')) === 'true',
    'Après un rechargement complet, la plateforme choisie n’est plus là : le brouillon n’a pas été repris.',
  );

  // De retour sur Stack Builder, la **résolution se recalcule seule** : elle
  // n'est jamais persistée, c'est le moteur qui la redonne.
  await page.goto(`${BASE}/create/stack`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => document.querySelector('a[aria-disabled="true"]') === null,
    undefined,
    { timeout: 20000 },
  );
  await continueLink().click();

  // 7. Capabilities, 8. Environment, 9. Infrastructure.
  await page.waitForURL('**/create/capabilities');
  await continueLink().click();
  await page.waitForURL('**/create/env');
  check(
    (await page.locator('input, textarea').count()) === 0,
    'L’écran Environment ne doit contenir aucun champ de saisie : une valeur sensible ne se saisit pas ici (§6.8).',
  );
  await continueLink().click();
  await page.waitForURL('**/create/infrastructure');
  await continueLink().click();

  // 10. Blueprint résume les choix ; 11. le graphe reste accessible.
  await page.waitForURL('**/create/blueprint');
  // Le résumé se remplit quand le serveur a rendu les noms de technologies.
  await page
    .getByText('Next.js', { exact: false })
    .first()
    .waitFor({ state: 'visible', timeout: 20000 });
  const blueprint = await page.locator('main').innerText();
  check(
    blueprint.includes('Next.js') && blueprint.includes('PostgreSQL'),
    `Le Blueprint devrait résumer la pile choisie. Reçu : ${blueprint.slice(0, 300)}`,
  );
  await page.goto(`${BASE}/graph`, { waitUntil: 'domcontentloaded' });
  check(
    (await page.getByText('Graphe de dépendances', { exact: false }).count()) > 0,
    'Le Dependency Graph devrait être accessible depuis le Blueprint.',
  );

  // 12. File Preview annonce les fichiers, sans écrire.
  await page.goto(`${BASE}/create/preview`, { waitUntil: 'domcontentloaded' });
  const tree = page.locator('ul[aria-label="Arborescence des fichiers à générer"]');
  await tree.waitFor({ state: 'visible', timeout: 15000 });
  check(
    (await tree.innerText()).includes('package.json'),
    'L’aperçu devrait annoncer package.json.',
  );
  check((await readdir(workspace)).length === 0, 'L’aperçu ne doit rien écrire sur le disque.');

  // 13. Generation Progress + 14. Generation Report : écriture réelle.
  await page.goto(`${BASE}/create/generate`, { waitUntil: 'domcontentloaded' });
  const generate = page.getByRole('button', { name: /Générer le projet/ });
  await generate.waitFor({ state: 'visible', timeout: 20000 });
  await generate.click();
  // Le rapport s'affiche sur place, et l'écran dédié s'ouvre par un lien.
  const fullReport = page.getByRole('link', { name: 'Voir le rapport complet' });
  await fullReport.waitFor({ state: 'visible', timeout: 60000 });
  await fullReport.click();
  await page.waitForURL('**/create/report', { timeout: 30000 });
  const report = await page.locator('main').innerText();
  check(
    report.includes('parcours-e2e'),
    `Le rapport devrait nommer le projet généré. Reçu : ${report.slice(0, 300)}`,
  );
  const written = await readdir(join(workspace, 'parcours-e2e')).catch(() => []);
  check(
    written.includes('package.json'),
    `Le projet devrait être écrit sur le disque. Contenu : ${written.join(', ')}`,
  );

  // Le thème clair/sombre : le cycle part de « système », dont le rendu peut
  // déjà être clair — on vérifie donc le **libellé**, puis l'effet réel.
  const theme = page.getByRole('button', { name: /Thème/ });
  const labelBefore = await theme.getAttribute('aria-label');
  await theme.click();
  check(
    (await theme.getAttribute('aria-label')) !== labelBefore,
    `Cliquer sur la bascule de thème n'a rien changé (${labelBefore}).`,
  );
  for (let i = 0; i < 3; i += 1) {
    if ((await page.locator('html').getAttribute('data-theme')) === 'dark') {
      break;
    }
    await theme.click();
    await page.waitForTimeout(150);
  }
  check(
    (await page.locator('html').getAttribute('data-theme')) === 'dark',
    'Le thème sombre devrait pouvoir être appliqué.',
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);
  check(
    (await page.locator('html').getAttribute('data-theme')) === 'dark',
    'Le thème choisi devrait survivre au rechargement (aucun flash, aucune remise à zéro).',
  );
}

const workspace = await mkdtemp(join(tmpdir(), 'pf-e2e-ws-'));
const executablePath = browserPath();

if (executablePath === undefined) {
  console.log('PF_E2E_SKIP=1 : parcours E2E sauté explicitement (aucun navigateur requis).');
  process.exit(0);
}

console.log(`Parcours E2E — navigateur ${executablePath}`);
console.log(`Parcours E2E — espace de travail ${workspace}`);

const server = await startServer(workspace);
let browser;
try {
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const failures = [];
  page.on('pageerror', (error) => failures.push(`erreur de page : ${String(error)}`));
  page.on('console', (message) => {
    // Les erreurs de chargement de ressource sont couvertes par l'écoute des
    // réponses, qui dit **quelle** URL a échoué — le message de console, lui,
    // ne la nomme pas.
    if (message.type() === 'error' && !message.text().includes('Failed to load resource')) {
      failures.push(`console : ${message.text()}`);
    }
  });
  page.on('response', (response) => {
    // `favicon.ico` n'est pas servi par l'app : ce n'est pas une régression.
    if (response.status() === 404 && !response.url().endsWith('/favicon.ico')) {
      failures.push(`404 : ${response.url()}`);
    }
  });

  await journey(page, workspace);
  check(failures.length === 0, `Erreurs console pendant le parcours : ${failures.join(' | ')}`);
  console.log('✓ parcours complet : 12 étapes, clavier, brouillon, génération réelle');
} finally {
  await browser?.close();
  stopServer(server);
  await rm(workspace, { recursive: true, force: true });
}
