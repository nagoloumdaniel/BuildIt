import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReportBody, type ReportBodyProps } from './ReportBody';
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

/** Rend le rapport : il reçoit sa vue, il ne relit ni brouillon ni moteur. */
function render(props: ReportBodyProps): string {
  return renderToStaticMarkup(<ReportBody {...props} />);
}

/** Le rapport (§6.14) est pur : il reçoit son rapport, il ne relit rien. */
describe('ReportBody', () => {
  it('rend le dossier, le compte de fichiers et le poids, sans la liste des fichiers', () => {
    const html = render({ report: SUCCESS, technologies: ['next'], ...BASE_PROPS });

    expect(html).toContain('/tmp/pf/mon-projet');
    expect(html).toContain('Fichiers écrits');
    expect(html).toContain('2,0 ko');
    expect(html).toContain('un avertissement du plan');
    // La liste des fichiers est partie : l'architecture a son propre écran.
    expect(html).not.toContain('src/app/page.tsx');
    expect(html).not.toContain('Planification');
  });

  it('rend un refus avec ses raisons, sans statistiques d’écriture', () => {
    const html = render({ report: REFUSED, technologies: [], ...BASE_PROPS });

    expect(html).toContain('existe déjà');
    expect(html).not.toContain('Fichiers écrits');
  });

  it('un rapport réussi sans avertissement ne montre pas de section vide', () => {
    const html = render({
      report: { ...SUCCESS, warnings: [], files: [] },
      technologies: [],
      ...BASE_PROPS,
    });
    expect(html).not.toContain('Avertissements');
  });

  it('un projet enregistré mène à ses pages d’architecture et de graphe', () => {
    const html = render({
      report: SUCCESS,
      technologies: [],
      ...BASE_PROPS,
      projectId: 'mon-app-1',
    });

    expect(html).toContain('href="/projects/architecture?id=mon-app-1"');
    expect(html).toContain('href="/projects/graph?id=mon-app-1"');
    expect(html).toContain('Architecture du projet');
    expect(html).toContain('Graphe de dépendances');
    // Le projet est écrit : l'étape 10 est refermée, l'aperçu ne mènerait nulle part.
    expect(html).not.toContain('href="/create/preview"');
    expect(html).not.toContain('href="/"');
    expect(html).not.toContain('Retour au tableau de bord');
  });

  it('sans identifiant de projet, l’aperçu reste la seule architecture possible', () => {
    for (const report of [SUCCESS, REFUSED]) {
      const html = render({ report, technologies: [], ...BASE_PROPS });
      expect(html.split('href="/create/preview"')).toHaveLength(2);
      expect(html).toContain('Architecture du projet');
      // Rien n'a été écrit (refus), ou le projet n'est pas dans la liste : pas
      // de page de projet à désigner.
      expect(html).not.toContain('/projects/architecture');
      expect(html).not.toContain('/projects/graph');
      expect(html).not.toContain('href="/"');
      expect(html).not.toContain('Retour au tableau de bord');
    }
  });

  it('l’identifiant du projet est encodé dans l’adresse : il vient du stockage', () => {
    const html = render({
      report: SUCCESS,
      technologies: [],
      ...BASE_PROPS,
      projectId: 'mon app/1',
    });
    expect(html).toContain('href="/projects/architecture?id=mon%20app%2F1"');
    expect(html).toContain('href="/projects/graph?id=mon%20app%2F1"');
  });

  it('les gestes sont un pied de page, après le trait qui ferme le rapport', () => {
    const html = render({
      report: SUCCESS,
      technologies: [],
      ...BASE_PROPS,
      projectId: 'mon-app-1',
      onFinish: () => undefined,
    });
    expect(html).toMatch(/<footer[^>]*class="[^"]*border-t[^"]*"/);
    // Le pied est le dernier bloc du rapport : rien ne le suit.
    expect(html.endsWith('</footer></div>')).toBe(true);
  });

  it('« Ouvrir sur GitHub » seulement avec une adresse de dépôt valide, dans un nouvel onglet', () => {
    const withRepo = render({
      report: SUCCESS,
      technologies: [],
      ...BASE_PROPS,
      repositoryUrl: 'https://github.com/moi/mon-projet',
    });
    expect(withRepo).toContain('href="https://github.com/moi/mon-projet"');
    expect(withRepo).toContain('target="_blank"');
    expect(withRepo).toContain('noopener');
    expect(withRepo).toContain('Ouvrir sur GitHub');
    // Le dépôt existe : pas de « Connecter à GitHub » en double.
    expect(withRepo).not.toContain('Connecter à GitHub');

    const guessed = render({
      report: SUCCESS,
      technologies: [],
      ...BASE_PROPS,
      repositoryUrl: 'https://github.com/settings',
    });
    expect(guessed).not.toContain('Ouvrir sur GitHub');

    const none = render({ report: SUCCESS, technologies: [], ...BASE_PROPS });
    expect(none).not.toContain('Ouvrir sur GitHub');
  });

  it('des dépendances déjà installées ne sont pas à réinstaller', () => {
    const html = render({
      report: { ...SUCCESS, installed: true },
      technologies: [],
      ...BASE_PROPS,
    });
    expect(html).toContain('Les dépendances ont été installées pendant la génération.');
    expect(html).not.toContain('pnpm install');
    expect(html).toContain('pnpm dev');
  });

  it('un succès ne montre jamais le bouton de correction (rien à corriger)', () => {
    const html = render({ report: SUCCESS, technologies: ['next'], ...BASE_PROPS });
    expect(html).not.toContain('Modifier les technologies');
  });

  it('un refus propose de corriger les technologies', () => {
    const html = render({
      report: REFUSED,
      technologies: ['next', 'javascript'],
      ...BASE_PROPS,
    });
    expect(html).toContain('href="/create/stack"');
    expect(html).toContain('Modifier les technologies');
    expect(html).toContain('next');
    expect(html).toContain('javascript');
  });

  it('un refus dit ce qui s’est passé et que rien n’a été écrit', () => {
    const html = render({ report: REFUSED, technologies: [], ...BASE_PROPS });
    expect(html).toContain('La génération a été refusée');
    expect(html).toContain('Rien n’a été écrit.');
  });

  it('un refus sans technologie choisie le dit, plutôt qu’une liste vide', () => {
    const html = render({ report: REFUSED, technologies: [], ...BASE_PROPS });
    expect(html).toContain('Aucune technologie choisie.');
  });

  it('un succès affiche la marche à suivre', () => {
    const html = render({ report: SUCCESS, technologies: ['next'], ...BASE_PROPS });
    expect(html).toContain('Installation');
    expect(html).toContain('pnpm install');
    expect(html).toContain('pnpm dev');
  });

  it('un succès avec un dossier connu (mode local) propose de connecter GitHub', () => {
    const html = render({ report: SUCCESS, technologies: ['next'], ...BASE_PROPS });
    expect(html).toContain('href="/repo"');
    expect(html).toContain('Connecter à GitHub');
  });

  it('un succès sans dossier (mode hébergé) ne propose pas GitHub', () => {
    const html = render({
      report: { ...SUCCESS, directory: '' },
      technologies: ['next'],
      ...BASE_PROPS,
    });
    expect(html).not.toContain('Connecter à GitHub');
  });

  it('une archive en main (mode hébergé) propose de la re-télécharger', () => {
    const html = render({
      report: { ...SUCCESS, zipBase64: 'QUJD' },
      technologies: ['next'],
      ...BASE_PROPS,
      onRedownload: () => undefined,
    });
    expect(html).toContain('Télécharger à nouveau');
  });

  it('sans archive, aucun bouton de re-téléchargement', () => {
    const html = render({ report: SUCCESS, technologies: ['next'], ...BASE_PROPS });
    expect(html).not.toContain('Télécharger à nouveau');
  });

  it('Docker et des variables d’environnement apparaissent dans les étapes', () => {
    const html = render({
      report: SUCCESS,
      technologies: ['next'],
      docker: true,
      envVarNames: ['DATABASE_URL'],
    });
    expect(html).toContain('docker compose up -d');
    expect(html).toContain('cp .env.example .env');
    expect(html).toContain('DATABASE_URL');
  });

  it('un succès se termine par un seul bouton orange « Terminer », sans lien vers l’accueil', () => {
    const html = render({
      report: SUCCESS,
      technologies: [],
      ...BASE_PROPS,
      onFinish: () => undefined,
    });
    expect(html).toMatch(
      /<button[^>]*class="pf-btn pf-btn-primary"[^>]*>(?:(?!<\/button>).)*Terminer/,
    );
    expect(html.split('Terminer')).toHaveLength(2);
    expect(html).not.toContain('href="/"');
    expect(html).not.toContain('Accueil');
  });

  it('un refus n’a pas de « Terminer » : rien n’a été écrit, il reste à corriger', () => {
    const html = render({
      report: REFUSED,
      technologies: [],
      ...BASE_PROPS,
      onFinish: () => undefined,
    });
    expect(html).not.toContain('Terminer');
  });

  it('un dossier écrit en local s’ouvre d’un bouton, son chemin reste en petit à côté', () => {
    const html = render({ report: SUCCESS, technologies: [], ...BASE_PROPS });
    expect(html).toContain('Ouvrir le dossier du projet');
    expect(html).toContain('pf-output-folder-path');
  });

  it('chaque étape dit où la faire : terminal, ou éditeur sans commande pour .env', () => {
    const html = render({
      report: SUCCESS,
      technologies: [],
      docker: false,
      envVarNames: ['DATABASE_URL'],
    });
    expect(html).toContain('Ouvrez un terminal dans le dossier du projet.');
    expect(html).toContain('À taper dans ce terminal');
    expect(html).toContain('data-where="editor"');
    expect(html).toContain('Sans terminal');
  });
});
