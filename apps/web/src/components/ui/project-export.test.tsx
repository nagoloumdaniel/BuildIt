import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { saasManifest } from '../../app/create/generate/fixtures';
import { OutputProgress, ProjectExport, toGenerationView } from './project-export';

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

describe('OutputProgress — une ligne d’état, une barre', () => {
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
