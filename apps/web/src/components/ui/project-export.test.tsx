import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { saasManifest } from '../../app/create/generate/fixtures';
import {
  OutputChoices,
  OutputProgress,
  ProjectExport,
  ProjectFolder,
  toGenerationView,
} from './project-export';

/**
 * La sortie d'un projet, rendue sans navigateur : le premier geste unique, les
 * deux sorties distinctes, et l'avancement sur une seule ligne au-dessus d'une
 * seule barre. Sans fournisseur de langue, le rendu sort le français.
 *
 * `OutputChoices` est rendu avec ses propriétés : c'est lui qui porte la
 * matrice local / navigateur, et c'est la seule façon de la prouver sans monter
 * les Server Actions que `ProjectExport` appelle dans ses effets.
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

  it('ouvert d’emblée, propose le ZIP tout de suite et jamais un bouton grisé', () => {
    const html = renderToStaticMarkup(
      <ProjectExport initiallyOpen manifest={saasManifest()} projectName="mon-projet" />,
    );
    expect(html).toContain('Générer le ZIP');
    expect(html).toContain('Une archive à télécharger');
    expect(html).toContain('<fieldset');
    expect(html).toContain('Comment récupérer le projet');
    // Tant que le serveur n'a pas dit s'il est local, la carte dossier n'est
    // pas rendue du tout : elle ne peut donc pas apparaître grisée.
    expect(html).not.toContain('Choisir un dossier et installer');
    expect(html).not.toContain('disabled');
    // Aucun chemin à taper.
    expect(html).not.toContain('<input');
  });
});

describe('OutputChoices la matrice local / navigateur', () => {
  function choices(local: boolean | null, browserWrite: boolean, picking = false): string {
    return renderToStaticMarkup(
      <OutputChoices
        browserWrite={browserWrite}
        local={local}
        onBrowserFolder={() => undefined}
        onNativeFolder={() => undefined}
        onZip={() => undefined}
        picking={picking}
      />,
    );
  }

  it('en local, la carte dossier est active sans dépendre du navigateur', () => {
    const html = choices(true, false);
    expect(html).toContain('Choisir un dossier et installer');
    expect(html).toContain('puis ses dépendances sont installées');
    // Aucun bouton grisé : le serveur sait ouvrir l'explorateur de la machine.
    expect(html).not.toContain('disabled');
    expect(html).not.toContain('ne sait pas écrire');
    expect(html).not.toContain('pf web');
    expect(html).toContain('Générer le ZIP');
  });

  it('hébergé sans API d’écriture : pas de carte dossier, pas de callout, le ZIP reste', () => {
    const html = choices(false, false);
    expect(html).not.toContain('Choisir un dossier et installer');
    expect(html).not.toContain('ne sait pas écrire');
    expect(html).not.toContain('pf web');
    expect(html).not.toContain('Chrome');
    expect(html).not.toContain('disabled');
    expect(html).toContain('Générer le ZIP');
    expect(html).toContain('Une archive à télécharger');
  });

  it('hébergé avec API d’écriture : la carte navigateur est active et dit qui écrit', () => {
    const html = choices(false, true);
    expect(html).toContain('Choisir un dossier et installer');
    expect(html).toContain('ne peut pas se lancer depuis une page web');
    expect(html).not.toContain('disabled');
    expect(html).toContain('Générer le ZIP');
  });

  it('en attente de la réponse du serveur : la carte dossier n’existe pas encore', () => {
    const html = choices(null, true);
    expect(html).not.toContain('Choisir un dossier et installer');
    expect(html).not.toContain('disabled');
    expect(html).toContain('Générer le ZIP');
  });

  it('pendant l’ouverture de l’explorateur local, la carte dit ce qu’elle attend', () => {
    const html = choices(true, false, true);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Fenêtre de l’explorateur ouverte sur le bureau de cette machine');
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
