import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EN, FR } from '../../lib/i18n/messages';
import type { HostedFailure } from './hosted-client';
import type { HostedPlanView } from './hosted-protocol';
import {
  formatSize,
  HostedCloneForm,
  type HostedCloneProps,
  HostedCloneRun,
  hostedBlocker,
  hostedFailureMessage,
  hostedProgressView,
} from './hosted-view';

/** La copie hébergée, rendue sans DOM : chaque état dit ce qu'il est. */

const c = FR.clone;

const PLAN: HostedPlanView = {
  ok: true,
  label: 'octo/hello',
  url: 'https://github.com/octo/hello',
  folder: 'hello',
  github: true,
  issues: [],
};

const BASE: HostedCloneProps = {
  canWrite: true,
  link: 'octo/hello',
  folder: 'hello',
  onFolder: () => undefined,
  plan: null,
  status: 'idle',
  progress: null,
  outcome: null,
  failure: null,
  partial: null,
  onCheck: () => undefined,
  onCopy: () => undefined,
  onDownload: () => undefined,
  onCancel: () => undefined,
};

function run(overrides: Partial<HostedCloneProps> = {}): string {
  return renderToStaticMarkup(createElement(HostedCloneRun, { ...BASE, ...overrides }));
}

describe('HostedCloneForm', () => {
  it('dit avant tout que ce n’est ni un clone ni une installation, avec les limites', () => {
    const html = renderToStaticMarkup(createElement(HostedCloneForm, BASE));
    expect(html).toContain(c.hostedIntro);
    expect(html).toContain('sans historique git');
    expect(html).toContain(c.hostedNoInstall);
    expect(html).toContain('5000 fichiers et 100 Mo');
    expect(html).toContain(c.hostedFolderLabel);
    expect(html).toContain('value="hello"');
  });
});

describe('HostedCloneRun avant la copie', () => {
  it('grise la copie tant que le lien n’est pas vérifié, et dit pourquoi', () => {
    const html = run();
    expect(html).toContain(c.hostedCheck);
    expect(html).toContain(c.chooseDestination);
    expect(html).toContain(c.hostedBlockerCheck);
    expect(html).toMatch(/disabled=""[^>]*>.*Choisir la destination pour cloner/);
  });

  it('attend de connaître le navigateur avant d’ouvrir l’explorateur', () => {
    const html = run({ canWrite: null, plan: PLAN });
    expect(html).toMatch(/disabled=""[^>]*>.*Choisir la destination pour cloner/);
  });

  it('affranchit la copie une fois le dépôt reconnu', () => {
    const html = run({ plan: PLAN });
    expect(html).toContain('Dépôt GitHub reconnu : octo/hello.');
    expect(html).not.toContain(c.hostedBlockerCheck);
    expect(html).not.toMatch(/disabled=""[^>]*>.*Choisir la destination pour cloner/);
  });

  it('propose le ZIP quand le navigateur n’écrit pas dans un dossier', () => {
    const html = run({ canWrite: false, plan: PLAN });
    expect(html).toContain(c.hostedDownload);
    expect(html).not.toContain(c.chooseDestination);
  });

  it('donne la commande git clone pour un lien hors GitHub, sans faire semblant', () => {
    const html = run({
      folder: '',
      plan: {
        ok: false,
        label: 'https://gitlab.com/team/app.git',
        url: 'https://gitlab.com/team/app.git',
        folder: 'app',
        github: false,
        error: { code: 'notGithub' },
        issues: [],
      },
    });
    expect(html).toContain(c.hostedNotGithubTitle);
    expect(html).toContain('git clone https://gitlab.com/team/app.git app');
    expect(html).toContain('cd app');
    // Le bouton reste grisé, mais l'explication est l'encart, pas une erreur rouge.
    expect(html).not.toContain('pf-error');
  });

  it('montre les refus du moteur pour un lien invalide', () => {
    const html = run({
      plan: {
        ...PLAN,
        ok: false,
        error: { code: 'link' },
        issues: ['« x » n’est pas un lien de dépôt reconnu.'],
      },
    });
    expect(html).toContain(c.hostedErrorLink);
    expect(html).toContain('n’est pas un lien de dépôt reconnu');
  });

  it('dit que la vérification n’a pas abouti quand le serveur ne répond pas', () => {
    expect(run({ status: 'unavailable' })).toContain(c.checkFailedTitle);
    expect(run({ status: 'checking' })).toContain(c.checking);
  });
});

describe('HostedCloneRun pendant la copie', () => {
  it('montre les octets reçus sans pourcentage inventé', () => {
    const html = run({
      plan: PLAN,
      status: 'copying',
      progress: { phase: 'downloading', received: 3 * 1024 * 1024 },
    });
    expect(html).toContain(c.hostedDownloading);
    expect(html).toContain('3 Mo reçus');
    expect(html).not.toMatch(/\d+ %/);
    expect(html).toContain(FR.common.cancel);
  });

  it('montre les fichiers écrits sur le total, en vrai pourcentage', () => {
    const html = run({
      plan: PLAN,
      status: 'copying',
      progress: { phase: 'writing', written: 1, total: 4 },
    });
    expect(html).toContain(c.hostedWriting);
    expect(html).toContain('1 / 4 fichiers');
    expect(html).toContain('25 %');
  });

  it('annonce le téléchargement de l’archive', () => {
    expect(run({ plan: PLAN, status: 'zipping', canWrite: false })).toContain(c.hostedZipping);
  });
});

describe('HostedCloneRun après', () => {
  it('raconte la copie, les fichiers écartés, puis les commandes', () => {
    const html = run({
      plan: PLAN,
      status: 'done',
      outcome: {
        kind: 'folder',
        result: {
          directory: 'Projets/hello',
          written: 12,
          bytes: 2048,
          skipped: ['aux.txt'],
          symlinks: ['lien'],
          installCommand: 'pnpm install',
          project: {
            directory: 'hello',
            label: 'JavaScript / TypeScript',
            ecosystem: 'node',
            packageManager: 'pnpm',
            source: 'lockfile',
            evidence: 'pnpm-lock.yaml',
            origin: 'd’après pnpm-lock.yaml',
            warnings: [],
            description: 'JavaScript / TypeScript : pnpm (d’après pnpm-lock.yaml)',
          },
        },
      },
    });
    expect(html).toContain('Fichiers copiés dans Projets/hello.');
    expect(html).toContain('12 fichiers, 2 Ko. Copie sans historique git.');
    expect(html).toContain('Projet détecté');
    expect(html).toContain(c.hostedSkipped(1));
    expect(html).toContain('aux.txt');
    expect(html).toContain(c.hostedSymlinks(1));
    expect(html).toContain('Ouvrir dans le Terminal');
    expect(html).toContain('pnpm install');
    expect(html).toContain(c.hostedRealCloneTitle);
    expect(html).toContain('git clone https://github.com/octo/hello hello');
  });

  it('dit qu’il n’y a rien à installer quand aucun projet n’est reconnu', () => {
    const html = run({
      plan: PLAN,
      status: 'done',
      outcome: {
        kind: 'folder',
        result: { directory: 'P/hello', written: 1, bytes: 10, skipped: [], symlinks: [] },
      },
    });
    expect(html).toContain(c.hostedNothingToInstall);
    expect(html).not.toContain(c.hostedInstallAfterClone);
  });

  it('raconte l’archive téléchargée, sans deviner l’installation', () => {
    const html = run({
      plan: PLAN,
      canWrite: false,
      status: 'done',
      outcome: { kind: 'zip', fileName: 'hello.zip', bytes: 5 * 1024 * 1024 },
    });
    expect(html).toContain('Archive hello.zip téléchargée (5 Mo).');
    expect(html).toContain(c.hostedZipNext);
    expect(html).not.toContain(c.hostedNextTitle);
    expect(html).toContain('git clone https://github.com/octo/hello hello');
  });

  it('dit ce qui reste sur le disque après un arrêt', () => {
    const cancelled = run({
      plan: PLAN,
      status: 'cancelled',
      partial: { written: 3, directory: 'P/hello' },
    });
    expect(cancelled).toContain(c.hostedCancelledTitle);
    expect(cancelled).toContain('3 fichier(s) déjà écrit(s) restent dans P/hello');

    const failed = run({
      plan: PLAN,
      status: 'failed',
      failure: { code: 'notFound' },
      partial: { written: 0, directory: 'P/hello' },
    });
    expect(failed).toContain(c.hostedFailedTitle);
    expect(failed).toContain(c.hostedErrorNotFound);
    expect(failed).toContain(c.hostedNothingWritten);
  });
});

describe('les fonctions de la vue', () => {
  it('écrit les tailles en Ko puis en Mo, dans la langue de l’écran', () => {
    expect(formatSize(10, c)).toBe('1 Ko');
    expect(formatSize(1536, c)).toBe('2 Ko');
    expect(formatSize(1.5 * 1024 * 1024, c)).toBe('1,5 Mo');
    expect(formatSize(1.5 * 1024 * 1024, EN.clone)).toBe('1.5 MB');
    expect(formatSize(2048, EN.clone)).toBe('2 KB');
  });

  it('a une phrase pour chaque arrêt, dans les deux langues', () => {
    const failures: HostedFailure[] = [
      { code: 'link' },
      { code: 'folder' },
      { code: 'notGithub' },
      { code: 'notFound' },
      { code: 'unauthorized' },
      { code: 'rateLimited' },
      { code: 'archiveTooLarge', limit: 50 * 1024 * 1024 },
      { code: 'archiveTooLarge' },
      { code: 'tooManyFiles', limit: 10 },
      { code: 'tooManyFiles' },
      { code: 'tooLarge', limit: 1024 * 1024 },
      { code: 'fileTooLarge', detail: 'gros.bin' },
      { code: 'fileTooLarge' },
      { code: 'unsafePath', detail: '../x' },
      { code: 'unsupported' },
      { code: 'corrupt', detail: 'a.ts' },
      { code: 'http', status: 503 },
      { code: 'http' },
      { code: 'network' },
      { code: 'taken', detail: 'P/hello' },
      { code: 'write', detail: 'a.ts : refusé' },
      { code: 'malformed' },
      { code: 'incomplete' },
      { code: 'timeout', seconds: 60 },
      { code: 'picker' },
    ];
    for (const messages of [FR.clone, EN.clone]) {
      const sentences = failures.map((failure) => hostedFailureMessage(failure, messages));
      for (const sentence of sentences) {
        expect(sentence).not.toBe('');
        expect(sentence).not.toContain('—');
      }
    }
    expect(hostedFailureMessage({ code: 'archiveTooLarge' }, c)).toContain('50 Mo');
    expect(hostedFailureMessage({ code: 'tooManyFiles', limit: 10 }, c)).toContain('10 fichiers');
    expect(hostedFailureMessage({ code: 'fileTooLarge', detail: 'gros.bin' }, c)).toContain(
      'gros.bin',
    );
    expect(hostedFailureMessage({ code: 'http', status: 503 }, c)).toContain('503');
    expect(hostedFailureMessage({ code: 'taken', detail: 'P/hello' }, c)).toContain('P/hello');
  });

  it('dit ce qui bloque, du plus urgent au plus banal', () => {
    expect(hostedBlocker(PLAN, true, c)).toBe(c.blockerBusy);
    expect(hostedBlocker(null, false, c)).toBe(c.hostedBlockerCheck);
    expect(hostedBlocker(PLAN, false, c)).toBeUndefined();
    expect(hostedBlocker({ ...PLAN, ok: false }, false, c)).toBe(c.hostedErrorLink);
    expect(hostedBlocker({ ...PLAN, ok: false, error: { code: 'folder' } }, false, c)).toBe(
      c.hostedErrorFolder,
    );
  });

  it('ne donne un pourcentage que quand il est mesuré', () => {
    expect(hostedProgressView(null, c)).toEqual({ phase: c.hostedDownloading });
    expect(hostedProgressView({ phase: 'writing', written: 0, total: 0 }, c)).toEqual({
      phase: c.hostedWriting,
      detail: '0 / 0 fichiers',
    });
    expect(hostedProgressView({ phase: 'writing', written: 1, total: 2 }, c).value).toBe(50);
  });
});
