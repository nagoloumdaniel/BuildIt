/**
 * Parcours §3 de bout en bout, dans un **vrai navigateur**, sur le serveur
 * réellement servi par `pf web`.
 *
 * Ce que ce test prouve, et qu'aucun test de composant ne peut prouver :
 *
 * 1. les 12 étapes s'enchaînent jusqu'au rapport, sur le vrai rendu ;
 * 2. une condition bloquante du §6 retient vraiment l'utilisateur ;
 * 3. le parcours est faisable **au clavier seul** (gate M5) — c'est le second
 *    parcours de ce fichier, `keyboardJourney` ;
 * 4. le brouillon survit à un rechargement de page (§3) ;
 * 5. la génération écrit un projet sur le disque, et le rapport le dit ;
 * 6. `prefers-reduced-motion` et le thème clair/sombre ne cassent rien.
 *
 * Le navigateur n'est pas téléchargé : on pilote celui de la machine
 * (`PF_E2E_CHROMIUM`, sinon Edge ou Chrome installé). Sans navigateur trouvé,
 * le test **échoue** en disant quoi faire — sauf `PF_E2E_SKIP=1`, qui saute la
 * preuve explicitement (une preuve sautée doit être demandée).
 *
 * Chaque parcours tourne dans son **propre contexte** de navigateur : le
 * brouillon vit dans `localStorage`, et le second parcours ne doit pas hériter
 * des choix du premier. Le premier (souris) tourne avant le second : il vérifie
 * que l'aperçu n'écrit rien, ce qui suppose un espace de travail encore vide.
 * `PF_E2E_ONLY=clavier` (ou `souris`) ne joue qu'un parcours — pour itérer,
 * jamais pour la preuve finale.
 */
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import {
  BASE,
  browserPath,
  check,
  startServer,
  stopServer,
  VIEWPORT,
  watchFailures,
} from './harness.mjs';
import { keyboardJourney } from './keyboard.mjs';

const continueLink = (page) => page.getByRole('link', { name: 'Continuer' });

/** Le parcours historique : souris autorisée, référence du §3. */
/**
 * Écrit le projet dans un dossier par la **même** route que l'écran
 * (`POST /api/generate`), avec le manifest que l'écran vient de mémoriser.
 *
 * Le choix du dossier passe par l'explorateur natif de Windows : une fenêtre
 * du système, hors de la page, qu'aucun navigateur piloté ne peut cliquer. La
 * preuve d'écriture contourne donc la seule boîte de dialogue, pas la règle :
 * la route revalide le manifest et la destination comme pour un clic.
 */
async function writeThroughRoute(page, parent) {
  return page.evaluate(async (target) => {
    const projects = JSON.parse(window.localStorage.getItem('pf-projects') ?? '[]');
    const manifest = projects[0]?.manifest;
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ manifest, parent: target, install: false }),
    });
    return { hasManifest: manifest !== undefined, stream: await response.text() };
  }, parent);
}

async function mouseJourney(page, workspace) {
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
    (await continueLink(page).getAttribute('aria-disabled')) === 'true',
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
  await continueLink(page).click();

  // 3. Target Selection, **au clavier seul** : le premier jalon du gate M5.
  await page.waitForURL('**/create/target');
  check(
    (await continueLink(page).getAttribute('aria-disabled')) === 'true',
    'Sans plateforme, « Continuer » devrait être désactivé.',
  );
  await page.getByRole('button', { name: /^Web/ }).focus();
  await page.keyboard.press('Enter');
  check(
    (await page.getByRole('button', { name: /^Web/ }).getAttribute('aria-pressed')) === 'true',
    'La touche Entrée n’a pas sélectionné la plateforme Web.',
  );
  await continueLink(page).focus();
  await page.keyboard.press('Enter');

  // 4. Project Type et 5. Architecture : les recommandations du mode guidé.
  await page.waitForURL('**/create/type');
  await page.getByRole('button', { name: /^SaaS/ }).click();
  await continueLink(page).click();
  await page.waitForURL('**/create/architecture');
  await page.getByRole('button', { name: /^Application unique/ }).click();
  await continueLink(page).click();

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
  await continueLink(page).click();

  // 7. Capabilities, 8. Environment, 9. Infrastructure.
  await page.waitForURL('**/create/capabilities');
  await continueLink(page).click();
  await page.waitForURL('**/create/env');
  check(
    (await page.locator('input, textarea').count()) === 0,
    'L’écran Environment ne doit contenir aucun champ de saisie : une valeur sensible ne se saisit pas ici (§6.8).',
  );
  await continueLink(page).click();
  await page.waitForURL('**/create/infrastructure');
  await continueLink(page).click();

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
  const tree = page.locator(
    'ul[aria-label="Architecture du projet : dossiers et fichiers générés"]',
  );
  await tree.waitFor({ state: 'visible', timeout: 15000 });
  check(
    (await tree.innerText()).includes('package.json'),
    'L’aperçu devrait annoncer package.json.',
  );
  check((await readdir(workspace)).length === 0, 'L’aperçu ne doit rien écrire sur le disque.');

  // 13. Generation : « Générer le projet » s'efface devant deux sorties.
  await page.goto(`${BASE}/create/generate`, { waitUntil: 'domcontentloaded' });
  const generate = page.getByRole('button', { name: /Générer le projet/ });
  await generate.waitFor({ state: 'visible', timeout: 20000 });
  await generate.click();
  // La sortie ZIP, de bout en bout : l'archive est réellement téléchargée.
  const download = page.waitForEvent('download', { timeout: 90000 });
  await page.getByRole('button', { name: /Générer le ZIP/ }).click();
  const archive = await download;
  check(
    archive.suggestedFilename().endsWith('.zip'),
    `Le téléchargement devrait être une archive .zip. Reçu : ${archive.suggestedFilename()}`,
  );
  await page.getByText('Génération terminée', { exact: false }).first().waitFor({
    state: 'visible',
    timeout: 30000,
  });
  // La sortie dossier : écrite par la route de l'écran, dans le dossier de test.
  const written_ = await writeThroughRoute(page, workspace);
  check(written_.hasManifest, 'La génération ZIP devrait mémoriser le manifest du projet.');
  check(
    written_.stream.includes('"type":"done"') && written_.stream.includes('"ok":true'),
    `La route /api/generate devrait écrire le projet. Reçu : ${written_.stream.slice(-300)}`,
  );
  // 14. Report : « Continuer » y mène, il n'y a plus de second lien.
  await page.getByRole('link', { name: /Continuer/ }).click();
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

  // Le thème : un seul bouton soleil/lune. Le départ suit le système, dont le
  // rendu peut déjà être clair : on vérifie donc le **libellé**, puis l'effet réel.
  const theme = page.getByRole('button', { name: /thème/i });
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

const JOURNEYS = [
  { id: 'souris', label: 'souris (référence §3)', run: mouseJourney },
  { id: 'clavier', label: 'clavier seul (gate M5)', run: keyboardJourney },
].filter(
  (journey) =>
    (process.env['PF_E2E_ONLY'] ?? '') === '' || journey.id === process.env['PF_E2E_ONLY'],
);

if (JOURNEYS.length === 0) {
  console.error(
    `PF_E2E_ONLY=${String(process.env['PF_E2E_ONLY'])} ne correspond à aucun parcours.`,
  );
  process.exit(1);
}

const server = await startServer(workspace);
let browser;
const results = [];
try {
  browser = await chromium.launch({ executablePath, headless: true });
  for (const { label, run } of JOURNEYS) {
    console.log(`\n=== Parcours ${label} ===`);
    const context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();
    const failures = watchFailures(page);
    try {
      await run(page, workspace);
      check(
        failures.length === 0,
        `Erreurs console pendant le parcours ${label} : ${failures.join(' | ')}`,
      );
      results.push({ label, error: null });
      console.log(`\n✓ parcours ${label} : réussi`);
    } catch (error) {
      results.push({ label, error });
      const detail = failures.length === 0 ? '' : `\n  erreurs de page : ${failures.join(' | ')}`;
      console.log(
        `\n✗ parcours ${label} : ${error instanceof Error ? error.message : String(error)}${detail}`,
      );
    } finally {
      await context.close();
    }
  }
} finally {
  await browser?.close();
  stopServer(server);
  await rm(workspace, { recursive: true, force: true });
}

const failed = results.filter((result) => result.error !== null);
if (failed.length > 0) {
  console.error(`\n✗ ${failed.length}/${results.length} parcours en échec.`);
  process.exit(1);
}
console.log(
  `\n✓ ${results.length}/${JOURNEYS.length} parcours réussi(s) : ${results
    .map((result) => result.label)
    .join(' + ')}.`,
);
