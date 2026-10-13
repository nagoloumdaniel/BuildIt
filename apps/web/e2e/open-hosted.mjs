/**
 * Ouvrir un projet local **depuis le site hébergé**, dans un vrai navigateur,
 * sur le serveur de production (`next start`, `PF_HOSTED=1` — l'interrupteur
 * que `VERCEL=1` pose sur Vercel).
 *
 * Deux navigateurs simulés, deux voies :
 * 1. Chromium avec File System Access API : le dossier est lu et les fichiers
 *    de base manquants sont **écrits** par la poignée (dossier en mémoire) ;
 * 2. Firefox / Safari (pas de `showDirectoryPicker`) : la carte reste active,
 *    le dossier passe par `<input webkitdirectory>`, et les fichiers de base
 *    manquants partent en archive `.zip`.
 *
 * 3. iPhone, iPad, Android (pas de dossier possible) : deux cartes, archive
 *    `.zip` du projet ou fichiers ; l'archive est lue dans le navigateur
 *    (deflate via DecompressionStream) et les fichiers de base partent en `.zip`.
 *
 * Avant le correctif, le cas 2 rendait la carte grisée : aucun moyen d'ouvrir
 * un projet hors Chrome/Edge sur le site en production.
 */
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';
import { chromium, devices, firefox, webkit } from 'playwright-core';
import {
  BASE,
  browserPath,
  check,
  startServer,
  stopServer,
  VIEWPORT,
  watchFailures,
} from './harness.mjs';

process.env['PF_HOSTED'] = '1';

/**
 * Les trois moteurs, avec les navigateurs de Playwright (`npx playwright-core
 * install chromium firefox webkit`). Chromium retombe sur Edge/Chrome installé
 * si le sien manque ; Firefox et WebKit absents font **échouer** la preuve,
 * sauf `PF_E2E_SKIP=1`.
 */
async function launch(type) {
  try {
    return await type.launch({ headless: true });
  } catch (error) {
    if (type === chromium) {
      const executablePath = browserPath();
      if (executablePath !== undefined) {
        return chromium.launch({ executablePath, headless: true });
      }
    }
    if (process.env['PF_E2E_SKIP'] === '1') {
      return undefined;
    }
    throw error;
  }
}

/** Un dossier en mémoire à la forme de FileSystemDirectoryHandle. */
function installMemoryPicker() {
  const files = new Map([
    ['package.json', JSON.stringify({ name: 'demo-app', dependencies: { next: '15.0.0' } })],
    ['pnpm-lock.yaml', ''],
    ['CONTRIBUTING.md', 'le mien'],
  ]);
  window.__pfFiles = files;
  const notFound = () => new DOMException('absent', 'NotFoundError');
  const dir = (name, prefix) => ({
    name,
    kind: 'directory',
    requestPermission: async () => 'granted',
    async *values() {
      const seen = new Set();
      for (const key of files.keys()) {
        if (!key.startsWith(prefix)) continue;
        const [head, ...rest] = key.slice(prefix.length).split('/');
        if (seen.has(head)) continue;
        seen.add(head);
        yield rest.length > 0
          ? { kind: 'directory', name: head }
          : { kind: 'file', name: head, getFile: async () => new Blob([files.get(key)]) };
      }
    },
    async getDirectoryHandle(child, options) {
      const path = `${prefix}${child}/`;
      const known = [...files.keys()].some((key) => key.startsWith(path));
      if (!known && options?.create !== true) throw notFound();
      return dir(child, path);
    },
    async getFileHandle(child, options) {
      const path = `${prefix}${child}`;
      if (!files.has(path) && options?.create !== true) throw notFound();
      return {
        createWritable: async () => {
          let text = '';
          return {
            write: async (data) => {
              text += new TextDecoder().decode(data);
            },
            close: async () => {
              files.set(path, text);
            },
          };
        },
      };
    },
  });
  window.showDirectoryPicker = async () => dir('demo-app', '');
}

async function chromiumWay(page) {
  await page.addInitScript(installMemoryPicker);
  await page.goto(`${BASE}/open`);
  const card = page.locator('button.pf-choice').first();
  await card.waitFor();
  await page.waitForFunction(() => !document.querySelector('button.pf-choice')?.disabled);
  await card.click();
  await page.getByText('pnpm install').first().waitFor({ timeout: 15_000 });
  const panel = page.locator('[data-base-files]');
  await panel.waitFor({ timeout: 15_000 });
  const before = Number(await panel.locator('[data-base-count]').getAttribute('data-base-count'));
  check(before > 0, 'Des fichiers de base manquants devaient être proposés.');
  await panel.getByRole('button', { name: /Créer les fichiers manquants/ }).click();
  await panel.getByText(/fichiers? de base créés?/).waitFor({ timeout: 15_000 });
  const written = await page.evaluate(() => Object.fromEntries(window.__pfFiles));
  check(written['CONTRIBUTING.md'] === 'le mien', 'CONTRIBUTING.md existant a été écrasé.');
  check(String(written['SECURITY.md']).startsWith('# Sécurité'), 'SECURITY.md absent.');
  check('docs/decisions/ADR-001-single-app.md' in written, 'ADR absent.');
  check('src/features/README.md' in written, 'README de dossier absent.');
  await panel.locator('[data-base-count="0"]').waitFor({ timeout: 15_000 });
  return `${Object.keys(written).length - 3} fichiers de base écrits par la poignée`;
}

/** Masque la File System Access API (Chromium imitant Firefox/Safari/Android). */
function hidePicker() {
  delete window.showDirectoryPicker;
  delete Window.prototype.showDirectoryPicker;
}

/**
 * Firefox, Safari, mobile : aucune File System Access API. Sur un vrai Firefox
 * ou WebKit rien n'est masqué — c'est le moteur réel qui est jugé.
 */
async function inputWay(page, project, mask) {
  if (mask) {
    await page.addInitScript(hidePicker);
  }
  await page.goto(`${BASE}/open`);
  check(
    (await page.evaluate(() => typeof window.showDirectoryPicker)) === 'undefined',
    'La sonde devait masquer showDirectoryPicker.',
  );
  const card = page.locator('button.pf-choice').first();
  await page.waitForFunction(() => {
    const button = document.querySelector('button.pf-choice');
    return (
      button !== null && !button.disabled && document.body.textContent.includes('lecture seule')
    );
  });
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), card.click()]);
  await chooser.setFiles(project);
  await page.getByText('pnpm install').first().waitFor({ timeout: 15_000 });
  const panel = page.locator('[data-base-files]');
  await panel.waitFor({ timeout: 15_000 });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    panel.getByRole('button', { name: /Télécharger les fichiers manquants/ }).click(),
  ]);
  check(download.suggestedFilename().endsWith('.zip'), 'Une archive .zip était attendue.');
  await panel.getByText(/Archive de \d+ fichiers? téléchargée/).waitFor();
  const zip = await readFile(await download.path());
  check(zip.subarray(0, 4).toString('hex') === '504b0304', 'Archive .zip illisible.');
  check(zip.includes('SECURITY.md'), 'SECURITY.md absent de l’archive.');
  return `archive ${download.suggestedFilename()} (${zip.length} o)`;
}

/** Un `.zip` deflate minimal, comme celui de « Compresser » dans Fichiers (iOS). */
function zipOf(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [path, text] of entries) {
    const name = Buffer.from(path);
    const data = Buffer.from(text);
    const packed = deflateRawSync(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, packed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc32(data), 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += 30 + name.length + packed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

/**
 * Mobile : pas de dossier. On choisit l'archive `.zip` du projet ; elle est
 * lue sur l'appareil, et les fichiers de base manquants se téléchargent.
 * Le projet Next a déjà `components/` et `lib/` : pas de shared/ui ni shared/lib.
 */
async function zipWay(page) {
  await page.goto(`${BASE}/open`);
  const mobile = page.locator('[data-pick-mobile]');
  await mobile.waitFor({ timeout: 15_000 });
  const card = mobile.locator('button.pf-choice').first();
  await page.waitForFunction(
    () => !document.querySelector('[data-pick-mobile] button.pf-choice')?.disabled,
  );
  const buffer = zipOf([
    [
      'demo-app/package.json',
      JSON.stringify({ name: 'demo-app', dependencies: { next: '16.0.0' } }),
    ],
    ['demo-app/pnpm-lock.yaml', ''],
    ['demo-app/app/page.tsx', 'export default function Page() { return null; }\n'],
    ['demo-app/components/button.tsx', 'export {};\n'],
    ['demo-app/lib/utils.ts', 'export {};\n'],
  ]);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), card.click()]);
  check(!chooser.isMultiple(), 'Le choix .zip attend une seule archive.');
  await chooser.setFiles({ name: 'demo-app.zip', mimeType: 'application/zip', buffer });
  await page.getByText('pnpm install').first().waitFor({ timeout: 15_000 });
  const panel = page.locator('[data-base-files]');
  await panel.waitFor({ timeout: 15_000 });
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    panel.getByRole('button', { name: /Télécharger les fichiers manquants/ }).click(),
  ]);
  const zip = await readFile(await download.path());
  check(zip.subarray(0, 4).toString('hex') === '504b0304', 'Archive .zip illisible.');
  check(zip.includes('SECURITY.md'), 'SECURITY.md absent de l’archive.');
  check(!zip.includes('shared/ui'), 'shared/ui proposé alors que components/ existe.');
  check(!zip.includes('shared/lib'), 'shared/lib proposé alors que lib/ existe.');
  check(!zip.includes('src/features'), 'src/features proposé dans un projet sans src/.');
  check(/- Date : \d{4}-\d{2}-\d{2}/.test(zip.toString('utf8')), 'ADR sans date.');
  check(!zip.toString('utf8').includes('à la génération'), 'ADR non daté.');
  await page.screenshot({ path: join(import.meta.dirname, 'shots', 'open-iphone-zip.png') });
  return `archive lue sur l’appareil, ${download.suggestedFilename()} (${zip.length} o)`;
}

const project = join(await mkdtemp(join(tmpdir(), 'pf-open-')), 'demo-app');
await mkdir(join(project, 'src'), { recursive: true });
await writeFile(join(project, 'package.json'), JSON.stringify({ name: 'demo-app' }));
await writeFile(join(project, 'pnpm-lock.yaml'), '');
await writeFile(join(project, 'src', 'index.ts'), 'export {};\n');

const RUNS = [
  [
    'Chromium — File System Access API (poignée simulée)',
    chromium,
    {},
    (page) => chromiumWay(page),
  ],
  ['Chromium — repli webkitdirectory', chromium, {}, (page) => inputWay(page, project, true)],
  ['Firefox — webkitdirectory réel', firefox, {}, (page) => inputWay(page, project, false)],
  ['WebKit — webkitdirectory réel', webkit, {}, (page) => inputWay(page, project, false)],
  // Android Chrome n'a pas showDirectoryPicker : on le masque comme lui.
  ['Pixel 7 (Chromium mobile)', chromium, devices['Pixel 7'], (page) => zipWay(page)],
  [
    'iPhone 15 (WebKit mobile) — archive .zip',
    webkit,
    devices['iPhone 15'],
    (page) => zipWay(page),
  ],
];

const workspace = await mkdtemp(join(tmpdir(), 'pf-open-ws-'));
const server = await startServer(workspace);
const browsers = new Map();
let failed = false;
try {
  for (const [label, type, device, run] of RUNS) {
    if (!browsers.has(type)) {
      browsers.set(type, await launch(type));
    }
    const browser = browsers.get(type);
    if (browser === undefined) {
      console.log(`- ${label} : sauté (PF_E2E_SKIP=1, navigateur absent)`);
      continue;
    }
    const context = await browser.newContext({
      viewport: VIEWPORT,
      ...device,
      // Les libellés attendus sont français ; Firefox de Playwright part en en-US.
      locale: 'fr-FR',
      acceptDownloads: true,
    });
    const page = await context.newPage();
    const failures = watchFailures(page);
    try {
      const detail = await run(page);
      check(failures.length === 0, `Erreurs de page : ${failures.join(' | ')}`);
      console.log(`✓ ${label} : projet reconnu, ${detail}`);
    } catch (error) {
      failed = true;
      console.log(`✗ ${label} : ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      await context.close();
    }
  }
} finally {
  for (const browser of browsers.values()) {
    await browser?.close();
  }
  stopServer(server);
  await rm(workspace, { recursive: true, force: true });
}
if (failed) {
  process.exit(1);
}
console.log('\n✓ ouverture d’un projet local en hébergé : réussie');
