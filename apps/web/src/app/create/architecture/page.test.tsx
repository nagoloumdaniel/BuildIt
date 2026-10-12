import { ARCHITECTURES } from '@buildit/manifest';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DraftProvider } from '../../../components/wizard/draft-provider';
import { freshDraft } from '../../../lib/draft';
import { FR } from '../../../lib/i18n/messages';
import { PROJECT_TYPES } from '../type/profiles';
import {
  ArchitectureChoices,
  defaultArchitecture,
  recommendedArchitectures,
  withArchitecture,
} from './options';
import ArchitecturePage from './page';

/** Le nombre de cartes d'architecture rendues, lu sur l'attribut. */
function rendered(html: string): number {
  return html.match(/data-architecture="/g)?.length ?? 0;
}

describe('les architectures réelles du manifest (§6.5)', () => {
  it('décrit chacune et donne son impact : complexité ET coût d’exploitation', () => {
    // Table complète : ajouter une architecture au manifest casse ici, et force
    // à écrire sa phrase — même garde-fou que l'écran cible.
    const notes = FR.wizard.architecture.labels;
    expect(Object.keys(notes).sort()).toEqual([...ARCHITECTURES].sort());
    for (const architecture of ARCHITECTURES) {
      const note = notes[architecture];
      expect(note.label.length).toBeGreaterThan(0);
      expect(note.note.length).toBeGreaterThan(0);
      expect(note.complexity.length).toBeGreaterThan(0);
      expect(note.cost.length).toBeGreaterThan(0);
    }
  });

  it('recommande de 2 à 4 architectures et ne sort jamais du manifest', () => {
    for (const type of [undefined, ...PROJECT_TYPES]) {
      const recommended = recommendedArchitectures(type);
      expect(recommended.length).toBeGreaterThanOrEqual(2);
      expect(recommended.length).toBeLessThanOrEqual(4);
      for (const architecture of recommended) {
        expect(ARCHITECTURES).toContain(architecture);
      }
    }
  });

  it('recommande la même chose pour le même profil (déterministe)', () => {
    expect(recommendedArchitectures('saas')).toEqual(recommendedArchitectures('saas'));
  });
});

describe('ArchitectureChoices', () => {
  it('en guidé, n’affiche que les recommandées et garde le reste accessible', () => {
    const html = renderToStaticMarkup(
      <ArchitectureChoices mode="guided" selected={undefined} type="saas" onSelect={() => {}} />,
    );

    expect(rendered(html)).toBe(recommendedArchitectures('saas').length);
    expect(html).toContain('Recommandé');
    expect(html).toContain('Voir toutes les options');
  });

  it('en expert, déplie le catalogue complet d’emblée', () => {
    const html = renderToStaticMarkup(
      <ArchitectureChoices mode="expert" selected={undefined} type="saas" onSelect={() => {}} />,
    );

    expect(rendered(html)).toBe(ARCHITECTURES.length);
    expect(html).not.toContain('Voir toutes les options');
  });

  it('affiche la complexité et le coût d’exploitation, pas seulement le nom', () => {
    const html = renderToStaticMarkup(
      <ArchitectureChoices
        mode="expert"
        selected={undefined}
        type={undefined}
        onSelect={() => {}}
      />,
    );

    expect(html).toContain('Complexité');
    expect(html).toContain('Coût d’exploitation');
  });

  it('marque l’architecture choisie, et elle seule', () => {
    const html = renderToStaticMarkup(
      <ArchitectureChoices mode="expert" selected="monorepo" type="saas" onSelect={() => {}} />,
    );

    expect(html).toMatch(/data-architecture="monorepo"[^>]*aria-pressed="true"/);
    // Plus de badge « Choisie » : la carte appuyée le dit déjà.
    expect(html).not.toContain('>Choisie<');
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  });
});

describe('defaultArchitecture — la forme préremplie (§6.5)', () => {
  it('reprend la première recommandation de chaque profil, jamais une table à part', () => {
    for (const type of PROJECT_TYPES) {
      expect(defaultArchitecture(type)).toBe(recommendedArchitectures(type)[0]);
    }
  });

  it('sans profil connu, retombe sur la première valeur par défaut', () => {
    expect(defaultArchitecture(undefined)).toBe(recommendedArchitectures(undefined)[0]);
    expect(defaultArchitecture('profil-inconnu')).toBe(recommendedArchitectures(undefined)[0]);
  });

  it('rend toujours une valeur du manifest, jamais undefined', () => {
    expect(ARCHITECTURES).toContain(defaultArchitecture('saas'));
    expect(ARCHITECTURES).toContain(defaultArchitecture(undefined));
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
    // Preuve d'intégration : l'écran est bien l'étape 5 du parcours (§6.5), donc
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
