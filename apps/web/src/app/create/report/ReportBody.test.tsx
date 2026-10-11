import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReportBody } from './ReportBody';
import type { GenerationReport } from './result';

const SUCCESS: GenerationReport = {
  ok: true,
  directory: '/tmp/pf/mon-projet',
  files: ['package.json', 'src/app/page.tsx'],
  bytes: 2048,
  warnings: ['un avertissement du plan'],
  steps: ['plan', 'write'],
  issues: [],
};

const REFUSED: GenerationReport = {
  ok: false,
  directory: '',
  files: [],
  bytes: 0,
  warnings: [],
  steps: [],
  issues: ['Le dossier existe déjà : /tmp/pf/mon-projet.'],
};

const BASE_PROPS = { docker: false, envVarNames: [] as readonly string[] };

/** Le rapport (§6.14) est pur : il reçoit son rapport, il ne relit rien. */
describe('ReportBody', () => {
  it('rend le dossier, le compte de fichiers, le poids et les étapes', () => {
    const html = renderToStaticMarkup(
      ReportBody({ report: SUCCESS, technologies: ['next'], ...BASE_PROPS }),
    );

    expect(html).toContain('/tmp/pf/mon-projet');
    expect(html).toContain('2');
    expect(html).toContain('2,0 ko');
    expect(html).toContain('Planification');
    expect(html).toContain('Écriture des fichiers');
    expect(html).toContain('package.json');
    expect(html).toContain('un avertissement du plan');
  });

  it('rend un refus avec ses raisons, sans liste de fichiers', () => {
    const html = renderToStaticMarkup(
      ReportBody({ report: REFUSED, technologies: [], ...BASE_PROPS }),
    );

    expect(html).toContain('existe déjà');
    expect(html).toContain('Aucun fichier écrit');
  });

  it('un rapport réussi sans avertissement ne montre pas de section vide', () => {
    const html = renderToStaticMarkup(
      ReportBody({
        report: { ...SUCCESS, warnings: [], files: [] },
        technologies: [],
        ...BASE_PROPS,
      }),
    );
    expect(html).not.toContain('Avertissements');
    expect(html).toContain('Aucun fichier écrit');
  });

  it('un succès ne montre jamais le bouton de correction (rien à corriger)', () => {
    const html = renderToStaticMarkup(
      ReportBody({ report: SUCCESS, technologies: ['next'], ...BASE_PROPS }),
    );
    expect(html).not.toContain('Modifier les technologies');
  });

  it('un refus propose de corriger les technologies et de revenir au tableau de bord', () => {
    const html = renderToStaticMarkup(
      ReportBody({ report: REFUSED, technologies: ['next', 'javascript'], ...BASE_PROPS }),
    );
    expect(html).toContain('href="/create/stack"');
    expect(html).toContain('Modifier les technologies');
    expect(html).toContain('href="/"');
    expect(html).toContain('Retour au tableau de bord');
    expect(html).toContain('next');
    expect(html).toContain('javascript');
  });

  it('un refus sans technologie choisie le dit, plutôt qu’une liste vide', () => {
    const html = renderToStaticMarkup(
      ReportBody({ report: REFUSED, technologies: [], ...BASE_PROPS }),
    );
    expect(html).toContain('Aucune technologie choisie.');
  });

  it('un succès affiche la marche à suivre et le retour au tableau de bord', () => {
    const html = renderToStaticMarkup(
      ReportBody({ report: SUCCESS, technologies: ['next'], ...BASE_PROPS }),
    );
    expect(html).toContain('Installation');
    expect(html).toContain('pnpm install');
    expect(html).toContain('pnpm dev');
    expect(html).toContain('href="/"');
    expect(html).toContain('Retour au tableau de bord');
  });

  it('un succès avec un dossier connu (mode local) propose de connecter GitHub', () => {
    const html = renderToStaticMarkup(
      ReportBody({ report: SUCCESS, technologies: ['next'], ...BASE_PROPS }),
    );
    expect(html).toContain('href="/repo"');
    expect(html).toContain('Connecter à GitHub');
  });

  it('un succès sans dossier (mode hébergé) ne propose pas GitHub', () => {
    const html = renderToStaticMarkup(
      ReportBody({ report: { ...SUCCESS, directory: '' }, technologies: ['next'], ...BASE_PROPS }),
    );
    expect(html).not.toContain('Connecter à GitHub');
  });

  it('une archive en main (mode hébergé) propose de la re-télécharger', () => {
    const html = renderToStaticMarkup(
      ReportBody({
        report: { ...SUCCESS, zipBase64: 'QUJD' },
        technologies: ['next'],
        ...BASE_PROPS,
        onRedownload: () => undefined,
      }),
    );
    expect(html).toContain('Télécharger à nouveau');
  });

  it('sans archive, aucun bouton de re-téléchargement', () => {
    const html = renderToStaticMarkup(
      ReportBody({ report: SUCCESS, technologies: ['next'], ...BASE_PROPS }),
    );
    expect(html).not.toContain('Télécharger à nouveau');
  });

  it('Docker et des variables d’environnement apparaissent dans les étapes', () => {
    const html = renderToStaticMarkup(
      ReportBody({
        report: SUCCESS,
        technologies: ['next'],
        docker: true,
        envVarNames: ['DATABASE_URL'],
      }),
    );
    expect(html).toContain('docker compose up -d');
    expect(html).toContain('cp .env.example .env');
    expect(html).toContain('DATABASE_URL');
  });
});
