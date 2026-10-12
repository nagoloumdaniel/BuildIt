/**
 * Captures de rendu des écrans, dans les deux thèmes et les deux langues.
 *
 * Ce que ce script prouve, et qu'aucun test ne voit : la page telle qu'elle est
 * **peinte**. Un test de composant vérifie des classes et des rôles ARIA ; il ne
 * dit pas qu'un texte passe sous un bouton, qu'une carte déborde à 360 px, ou
 * que le thème sombre rend un contraste illisible. Les captures sont la preuve
 * qu'un humain regarde, et la référence pour comparer avant / après une refonte.
 *
 * Il sert le **vrai** serveur (`next start`, exactement comme `pf web`) sur un
 * espace de travail temporaire, et pilote le navigateur déjà installé — même
 * socle que `journey.mjs`, donc aucun serveur « de test » qui divergerait du
 * serveur réel.
 *
 * Usage :
 *   pnpm --filter @buildit/web build
 *   node e2e/shots.mjs                    # → e2e/shots/ (ignoré par git)
 *   PF_SHOTS_DIR=D:\\captures node e2e/shots.mjs
 *
 * Chaque écran est capturé en clair et en sombre, en français ; la page
 * d'accueil l'est aussi en anglais (la bascule de langue est un état local, pas
 * une route).
 */
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { BASE, browserPath, startServer, stopServer, VIEWPORT } from './harness.mjs';

/** Les écrans qui comptent : un par famille d'interface. */
const SCREENS = [
  { name: '01-accueil', path: '/' },
  { name: '02-projets', path: '/projects' },
  { name: '03-ouvrir', path: '/open' },
  { name: '04-cloner', path: '/clone' },
  { name: '05-creer', path: '/create' },
  { name: '06-stack', path: '/create/stack' },
  { name: '07-github', path: '/github' },
  { name: '08-depot', path: '/repo' },
  { name: '09-graphe', path: '/graph' },
  { name: '10-404', path: '/adresse-inexistante' },
];

const OUT_DIR =
  process.env['PF_SHOTS_DIR'] ??
  new URL('shots', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

/** Le thème et la langue se posent avant le premier rendu, comme le fait le layout. */
async function openContext(browser, theme, locale) {
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  await context.addInitScript(
    ([nextTheme, nextLocale]) => {
      window.localStorage.setItem('pf-theme', nextTheme);
      window.localStorage.setItem('pf-locale', nextLocale);
    },
    [theme, locale],
  );
  return context;
}

async function capture(context, screen, suffix) {
  const page = await context.newPage();
  const failures = [];
  page.on('pageerror', (error) => failures.push(String(error)));
  page.on('response', (response) => {
    if (response.status() >= 500) {
      failures.push(`${response.status()} sur ${response.url()}`);
    }
  });

  const response = await page.goto(`${BASE}${screen.path}`, { waitUntil: 'networkidle' });
  if (screen.path !== '/adresse-inexistante' && response !== null && !response.ok()) {
    failures.push(`HTTP ${response.status()} sur ${screen.path}`);
  }

  const file = join(OUT_DIR, `${screen.name}-${suffix}.png`);
  await page.screenshot({ path: file, fullPage: true });
  await page.close();

  return { file, failures };
}

async function main() {
  const browserExecutable = browserPath();
  if (browserExecutable === undefined) {
    // `PF_E2E_SKIP=1` : la preuve visuelle est sautée **explicitement**.
    console.log('Captures sautées : PF_E2E_SKIP=1 et aucun navigateur trouvé.');
    return;
  }

  const workspace = await mkdtemp(join(tmpdir(), 'buildit-shots-'));
  await mkdir(OUT_DIR, { recursive: true });

  const server = await startServer(workspace);
  const browser = await chromium.launch({ executablePath: browserExecutable, headless: true });
  const failures = [];
  let count = 0;

  try {
    const light = await openContext(browser, 'light', 'fr');
    const dark = await openContext(browser, 'dark', 'fr');
    const english = await openContext(browser, 'light', 'en');

    for (const screen of SCREENS) {
      for (const [context, suffix] of [
        [light, 'clair'],
        [dark, 'sombre'],
      ]) {
        const shot = await capture(context, screen, suffix);
        count += 1;
        failures.push(...shot.failures.map((failure) => `${screen.name} (${suffix}) : ${failure}`));
        console.log(`  ${shot.file}`);
      }
    }

    const englishShot = await capture(english, SCREENS[0], 'en');
    count += 1;
    failures.push(...englishShot.failures.map((failure) => `accueil (en) : ${failure}`));
    console.log(`  ${englishShot.file}`);

    for (const context of [light, dark, english]) {
      await context.close();
    }
  } finally {
    await browser.close();
    stopServer(server);
    await rm(workspace, { recursive: true, force: true });
  }

  if (failures.length > 0) {
    throw new Error(`Captures en erreur :\n- ${failures.join('\n- ')}`);
  }
  console.log(`\n${count} captures écrites dans ${OUT_DIR}`);
}

await main();
