import { ARCHITECTURES } from '@buildit/manifest';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DraftProvider } from '../../../components/wizard/draft-provider';
import { freshDraft } from '../../../lib/draft';
import { FR } from '../../../lib/i18n/messages';
import { ArchitectureChoices, DEFAULT_ARCHITECTURE, withArchitecture } from './options';
import ArchitecturePage from './page';

/** Le nombre de cartes d'architecture rendues, lu sur l'attribut. */
function rendered(html: string): number {
  return html.match(/data-architecture="/g)?.length ?? 0;
}

describe('les architectures réelles du manifest (§6.5)', () => {
  it('décrit chacune et donne son impact : complexité ET coût d’exploitation', () => {
    // Table complète : ajouter une architecture au manifest casse ici, et force
    // à écrire sa phrase même garde-fou que l'écran cible.
    const notes = FR.wizard.architecture.labels;
    expect(Object.keys(notes).sort()).toEqual([...ARCHITECTURES].sort());
    for (const architecture of ARCHITECTURES) {
      const note = notes[architecture];
      expect(note.label.length).toBeGreaterThan(0);
      expect(note.note.length).toBeGreaterThan(0);
      expect(note.complexity.length).toBeGreaterThan(0);
      expect(note.cost.length).toBeGreaterThan(0);
      expect(note.runtime.length).toBeGreaterThan(0);
    }
  });
});

describe('ArchitectureChoices', () => {
  it('montre le nom, l’explication, l’impact et l’exécution de chaque forme', () => {
    const html = renderToStaticMarkup(
      <ArchitectureChoices selected={undefined} onSelect={() => {}} />,
    );
    expect(html).toContain('Exécution');
    expect(html).toContain('Complexité');
    expect(html).toContain('Coût d’exploitation');
    // Le dépôt et l'arborescence de base ne sont plus sur la carte : elle se
    // lit d'un coup d'œil.
    expect(html).not.toContain('Dépôt');
    expect(html).not.toContain('Dossiers de base générés');
    expect(html).not.toContain('data-tree');
  });

  it('affiche les six formes d’emblée, sans recommandation ni bouton « voir plus »', () => {
    const html = renderToStaticMarkup(
      <ArchitectureChoices selected={undefined} onSelect={() => {}} />,
    );

    expect(rendered(html)).toBe(ARCHITECTURES.length);
    expect(html).not.toContain('Recommand');
    expect(html).not.toContain('Voir toutes les options');
  });

  it('marque l’architecture choisie, et elle seule', () => {
    const html = renderToStaticMarkup(
      <ArchitectureChoices selected="monorepo" onSelect={() => {}} />,
    );

    expect(html).toMatch(/data-architecture="monorepo"[^>]*aria-pressed="true"/);
    // Plus de badge « Choisie » : la carte appuyée le dit déjà.
    expect(html).not.toContain('>Choisie<');
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  });
});

describe('DEFAULT_ARCHITECTURE', () => {
  it('est une valeur du manifest', () => {
    expect(ARCHITECTURES).toContain(DEFAULT_ARCHITECTURE);
  });
});

describe('withArchitecture', () => {
  it('pose l’architecture sans toucher au reste du brouillon', () => {
    const before = { ...freshDraft(), name: 'quai3', targets: ['web'], type: 'saas' };
    const after = withArchitecture(before, 'microservices');

    expect(after.architecture).toBe('microservices');
    expect(after.type).toBe('saas');
    expect(after.name).toBe('quai3');
    expect(before.architecture).toBeUndefined();
  });
});

describe('ArchitecturePage', () => {
  it('branche l’étape « architecture » dans StepShell et se rend sous son provider', () => {
    // Preuve d'intégration : l'écran est bien l'étape 4 du parcours (§6.5), donc
    // la progression et l'étape suivante sont celles du catalogue des étapes.
    const html = renderToStaticMarkup(
      <DraftProvider>
        <ArchitecturePage />
      </DraftProvider>,
    );

    expect(html).toContain('Architecture');
    expect(html).toContain('Étape 4 sur');
    expect(html).toContain('Continuer');
  });
});
