import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { saasManifest } from '../../app/create/generate/fixtures';
import { OutputProgress, ProjectExport, ProjectFolder, toGenerationView } from './project-export';

/**
 * La sortie d'un projet, rendue sans navigateur : le premier geste unique, les
 * deux sorties distinctes, et l'avancement sur une seule ligne au-dessus d'une
 * seule barre. Sans fournisseur de langue, le rendu sort le français.
 */

describe('ProjectExport', () => {
  it('commence par un seul bouton « Générer le projet », sans rien écrire', () => {
    const html = renderToStaticMarkup(
      <ProjectExport manifest={saasManifest()} projectName="mon-projet" />,
    );
    expect(html).toContain('Générer le projet');
    expect(html).toContain('pf-btn-primary');
    expect(html).not.toContain('Générer le ZIP');
  });

  it('ouvert d’emblée, propose deux sorties distinctes, chacune avec sa note', () => {
    const html = renderToStaticMarkup(
      <ProjectExport initiallyOpen manifest={saasManifest()} projectName="mon-projet" />,
    );
    expect(html).toContain('Générer le ZIP');
    expect(html).toContain('Une archive à télécharger');
    expect(html).toContain('Choisir un dossier et installer');
    expect(html).toContain('<fieldset');
    expect(html).toContain('Comment récupérer le projet');
    // Tant que le serveur n'a pas dit s'il est local, le dossier attend : on
    // ne propose pas un geste qui pourrait échouer.
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Choisir un dossier/);
    // Aucun chemin à taper.
    expect(html).not.toContain('<input');
  });
});

describe('OutputProgress une ligne d’état, une barre', () => {
  it('pendant le travail : la ligne dit l’opération, la barre est indéterminée', () => {
    const html = renderToStaticMarkup(
      <OutputProgress status="Installation des dépendances : pnpm install…" tone="running" />,
    );
    expect(html).toContain('Installation des dépendances : pnpm install…');
    expect(html).toContain('role="status"');
    expect(html).toContain('pf-bar-indeterminate');
    expect(html).not.toContain('aria-valuenow');
    expect(html).not.toContain('Projet écrit dans');
    // L'ancienne liste d'étapes est partie.
    expect(html).not.toContain('Planification');
  });

  it('à la fin : barre pleine, et seulement le dossier réellement écrit sous elle', () => {
    const html = renderToStaticMarkup(
      <OutputProgress
        directory={'C:\\Projets\\mon-projet'}
        status="Génération terminée."
        tone="ok"
        value={100}
      />,
    );
    expect(html).toContain('aria-valuenow="100"');
    expect(html).toContain('Projet écrit dans');
    expect(html).toContain('C:\\Projets\\mon-projet');
  });

  it('en faute : une alerte, et pas de barre qui ferait croire à un travail en cours', () => {
    const html = renderToStaticMarkup(
      <OutputProgress status="La génération a été refusée. Rien n’a été écrit." tone="error" />,
    );
    expect(html).toContain('role="alert"');
    expect(html).not.toContain('role="progressbar"');
  });
});

describe('toGenerationView', () => {
  const DONE = {
    ok: true,
    directory: '/x/app',
    files: ['package.json'],
    bytes: 10,
    warnings: [],
    steps: ['plan', 'write'],
    issues: [],
    installRequested: false,
    installed: false,
    installIssues: [],
  };

  it('ne dit rien de l’installation quand elle n’a pas été demandée', () => {
    expect(toGenerationView(DONE)).not.toHaveProperty('installed');
  });

  it('dit l’installation réelle quand elle a été demandée', () => {
    expect(toGenerationView({ ...DONE, installRequested: true, installed: true }).installed).toBe(
      true,
    );
    expect(toGenerationView({ ...DONE, installRequested: true }).installed).toBe(false);
  });
});

describe('ProjectFolder le dossier écrit, ouvert d’un bouton en local', () => {
  it('en local : un bouton « Ouvrir le dossier du projet », le chemin en petit à côté, rien à copier', () => {
    const html = renderToStaticMarkup(
      <ProjectFolder directory={'C:\\Projets\\mon-projet'} openable />,
    );
    expect(html).toMatch(
      /<button[^>]*type="button"[^>]*>(?:(?!<\/button>).)*Ouvrir le dossier du projet/,
    );
    expect(html).toContain('data-icon="folderOpen"');
    expect(html).toContain('pf-output-folder-path');
    expect(html).toContain('C:\\Projets\\mon-projet');
    expect(html).not.toContain('Copier');
  });

  it('écrit par le navigateur : le nom du dossier seul, sans bouton', () => {
    const html = renderToStaticMarkup(<ProjectFolder directory="mon-projet" openable={false} />);
    expect(html).toContain('mon-projet');
    expect(html).toContain('Projet écrit dans le dossier');
    expect(html).not.toContain('<button');
  });

  it('OutputProgress choisit la forme du dossier : copie, bouton, ou texte', () => {
    const open = renderToStaticMarkup(
      <OutputProgress directory="/p/app" directoryMode="open" status="ok" tone="ok" value={100} />,
    );
    expect(open).toContain('Ouvrir le dossier du projet');
    const text = renderToStaticMarkup(
      <OutputProgress directory="app" directoryMode="text" status="ok" tone="ok" value={100} />,
    );
    expect(text).not.toContain('<button');
    const copy = renderToStaticMarkup(
      <OutputProgress directory="/p/app" status="…" tone="running" />,
    );
    expect(copy).not.toContain('Ouvrir le dossier du projet');
    expect(copy).toContain('Projet écrit dans');
  });
});
