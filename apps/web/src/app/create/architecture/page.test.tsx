import { ARCHITECTURES } from '@buildit/manifest';
import { loadCatalogue } from '@buildit/registry';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DraftProvider } from '../../../components/wizard/draft-provider';
import { freshDraft } from '../../../lib/draft';
import { FR } from '../../../lib/i18n/messages';
import {
  ArchitectureChoices,
  DEFAULT_ARCHITECTURE,
  STACK_SIGNALS,
  stackProfile,
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
    // à écrire sa phrase même garde-fou que l'écran cible.
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
});

describe('profil de stack', () => {
  it('les identifiants repérés existent au catalogue, dans la bonne catégorie', () => {
    const catalogue = loadCatalogue();
    if (!catalogue.ok) throw new Error('catalogue invalide');
    const categoryOf = (id: string) => catalogue.value.get(id)?.category;
    for (const id of STACK_SIGNALS.frontend) expect(categoryOf(id)).toBe('frontend');
    for (const id of STACK_SIGNALS.backend) expect(categoryOf(id)).toBe('backend');
    for (const id of STACK_SIGNALS.queue) expect(categoryOf(id)).toBe('queue');
    for (const id of STACK_SIGNALS.serverless) expect(categoryOf(id)).toBe('hosting');
    // Tous les frameworks front **web** et back du catalogue sont repérés. Les
    // frameworks mobile et ordinateur (Expo, Flutter, Electron…) sont aussi de
    // catégorie `frontend`, mais ne dessinent pas d'application web.
    for (const entry of catalogue.value.entries()) {
      const webOnly =
        entry.targets.includes('web') &&
        !entry.targets.some((target) => target === 'mobile' || target === 'desktop');
      if (entry.category === 'frontend' && webOnly)
        expect(STACK_SIGNALS.frontend).toContain(entry.id);
      if (entry.category === 'backend') expect(STACK_SIGNALS.backend).toContain(entry.id);
      if (entry.category === 'queue') expect(STACK_SIGNALS.queue).toContain(entry.id);
    }
  });

  it('sans technologie, les cibles décident du front et du back', () => {
    expect(stackProfile([], ['web', 'api'])).toMatchObject({ frontend: true, backend: true });
    expect(stackProfile([], ['web'])).toMatchObject({ frontend: true, backend: false });
  });
});

describe('ArchitectureChoices', () => {
  it('montre l’arborescence de base de chaque forme, et les notes dépôt / runtime', () => {
    const html = renderToStaticMarkup(
      <ArchitectureChoices
        selected={undefined}
        technologies={['next', 'hono']}
        targets={['web', 'api']}
        onSelect={() => {}}
      />,
    );
    expect(html).toContain('apps/api/src/modules/example/domain/');
    expect(html).toContain('functions/http/');
    expect(html).toContain('Dépôt');
    expect(html).toContain('Exécution');
  });

  it('affiche les six formes d’emblée, sans recommandation ni bouton « voir plus »', () => {
    const html = renderToStaticMarkup(
      <ArchitectureChoices selected={undefined} onSelect={() => {}} />,
    );

    expect(rendered(html)).toBe(ARCHITECTURES.length);
    expect(html).not.toContain('Recommand');
    expect(html).not.toContain('Voir toutes les options');
  });

  it('affiche la complexité et le coût d’exploitation, pas seulement le nom', () => {
    const html = renderToStaticMarkup(
      <ArchitectureChoices selected={undefined} onSelect={() => {}} />,
    );

    expect(html).toContain('Complexité');
    expect(html).toContain('Coût d’exploitation');
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
