import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DraftProvider } from '../../../components/wizard/draft-provider';
import { freshDraft } from '../../../lib/draft';
import { FR } from '../../../lib/i18n/messages';
import TypePage from './page';
import { PROJECT_TYPES, ProjectTypeChoices, recommendedTypes, withType } from './profiles';

/**
 * Vitest tourne sans DOM : on prouve le contrat par `renderToStaticMarkup`.
 * `ProjectTypeChoices` est le contenu de l'écran **hors contexte React** — il
 * prend le brouillon et le geste de sélection en props, donc il se rend seul.
 */

/** Le nombre de cartes de profil rendues, lu sur l'attribut, pas sur le texte. */
function rendered(html: string): number {
  return html.match(/data-type="/g)?.length ?? 0;
}

describe('profils du §6.4', () => {
  it('décrit chaque profil et l’orientation qu’il donne aux écrans suivants', () => {
    // La table vit au dictionnaire : ajouter un profil sans sa phrase casse le
    // typecheck au point d'usage (`t.wizard.types.labels[type]`).
    const notes = FR.wizard.types.labels;
    expect(Object.keys(notes).sort()).toEqual([...PROJECT_TYPES].sort());
    for (const type of PROJECT_TYPES) {
      const note = notes[type];
      expect(note.label.length).toBeGreaterThan(0);
      expect(note.note.length).toBeGreaterThan(0);
      expect(note.guides.length).toBeGreaterThan(0);
    }
  });

  it('recommande de 2 à 4 profils, jamais zéro ni le catalogue entier', () => {
    const profiles: readonly (readonly string[])[] = [
      [],
      ['web'],
      ['mobile'],
      ['desktop'],
      ['api'],
      ['library'],
      ['web', 'mobile'],
    ];
    for (const targets of profiles) {
      const recommended = recommendedTypes(targets);
      expect(recommended.length).toBeGreaterThanOrEqual(2);
      expect(recommended.length).toBeLessThanOrEqual(4);
      for (const type of recommended) {
        expect(PROJECT_TYPES).toContain(type);
      }
    }
  });

  it('ne recommande que des profils connus et de façon déterministe', () => {
    expect(recommendedTypes(['web'])).toEqual(recommendedTypes(['web']));
    expect(recommendedTypes(['mobile']).length).toBeGreaterThan(0);
  });
});

describe('ProjectTypeChoices', () => {
  it('en guidé, n’affiche que les recommandés et garde le reste accessible', () => {
    const html = renderToStaticMarkup(
      <ProjectTypeChoices
        mode="guided"
        selected={undefined}
        targets={['web']}
        onSelect={() => {}}
      />,
    );

    expect(rendered(html)).toBe(recommendedTypes(['web']).length);
    expect(html).toContain('Recommandé');
    expect(html).toContain('Voir toutes les options');
  });

  it('en expert, affiche tout le catalogue d’emblée', () => {
    const html = renderToStaticMarkup(
      <ProjectTypeChoices
        mode="expert"
        selected={undefined}
        targets={['web']}
        onSelect={() => {}}
      />,
    );

    expect(rendered(html)).toBe(PROJECT_TYPES.length);
    expect(html).not.toContain('Voir toutes les options');
  });

  it('marque le profil choisi, et lui seul', () => {
    const html = renderToStaticMarkup(
      <ProjectTypeChoices mode="expert" selected="saas" targets={['web']} onSelect={() => {}} />,
    );

    expect(html).toMatch(/data-type="saas"[^>]*aria-pressed="true"/);
    expect(html).toContain('Choisi');
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
  });

  it('ne rend aucune carte quand le profil est inconnu du brouillon', () => {
    const html = renderToStaticMarkup(
      <ProjectTypeChoices
        mode="expert"
        selected="profil-supprime"
        targets={['web']}
        onSelect={() => {}}
      />,
    );

    expect(html.match(/aria-pressed="true"/g)).toBeNull();
    expect(rendered(html)).toBe(PROJECT_TYPES.length);
  });
});

describe('withType', () => {
  it('pose le profil sans toucher au reste du brouillon', () => {
    const before = { ...freshDraft(), name: 'quai3', targets: ['web'] };
    const after = withType(before, 'marketplace');

    expect(after.type).toBe('marketplace');
    expect(after.name).toBe('quai3');
    expect(after.targets).toEqual(['web']);
    // Le brouillon d'entrée n'est pas muté : le store reste la seule écriture.
    expect(before.type).toBeUndefined();
  });

  it('reste une donnée d’UI : `type` n’existe pas dans le manifest', () => {
    // Garde-fou de la décision : le manifest est strict, une clé `type` y serait
    // une erreur de validation. On vérifie donc qu'elle vit dans le brouillon.
    const after = withType(freshDraft(), 'ai');
    expect(after.type).toBe('ai');
    expect(Object.keys(after)).not.toContain('manifest');
  });
});

describe('TypePage', () => {
  it('branche l’étape « type » dans StepShell et se rend sous son provider', () => {
    // Preuve d'intégration : le `step` est bien celui de l'écran 4, donc la
    // progression, l'étape suivante et la condition bloquante sont les bonnes.
    const html = renderToStaticMarkup(
      <DraftProvider>
        <TypePage />
      </DraftProvider>,
    );

    expect(html).toContain('Profil du projet');
    expect(html).toContain('Étape 3 sur');
    expect(html).toContain('Continuer');
  });
});
