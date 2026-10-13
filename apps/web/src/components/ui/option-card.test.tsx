import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MESSAGES } from '../../lib/i18n/messages';
import { OptionCard, type OptionCardData, refusalAdvice } from './option-card';

/**
 * La carte d'une technologie, rendue sans DOM.
 *
 * Ce qui est vérifié ici est ce que la refonte a changé : plus de badge
 * « Choisi » (la carte entière le dit, plus une coche qui ne dépend pas de la
 * couleur), plus de raison écrite **dans** la carte (elle passe dans la bulle
 * `!`), et une bulle qui nomme les technologies en cause avec leur
 * documentation.
 */

function option(patch: Partial<OptionCardData> & { id: string }): OptionCardData {
  return { label: patch.id, state: 'available', ...patch };
}

const render = (props: Parameters<typeof OptionCard>[0]): string =>
  renderToStaticMarkup(<OptionCard {...props} />);

describe('OptionCard — sélection', () => {
  it('une option choisie est appuyée, sans badge « Choisi »', () => {
    const html = render({ option: option({ id: 'react', state: 'selected' }), onToggle: () => {} });

    expect(html).toContain('aria-pressed="true"');
    expect(html).not.toMatch(/pf-badge[^>]*>[^<]*Choisi/);
    // La coche existe pour que la sélection ne dépende pas de la couleur seule.
    expect(html).toContain('pf-option-check');
  });

  it('le choix local l’emporte sur un état moteur en retard', () => {
    const optimistic = render({
      option: option({ id: 'react' }),
      pressed: true,
      onToggle: () => {},
    });
    const withdrawn = render({
      option: option({ id: 'react', state: 'selected' }),
      pressed: false,
      onToggle: () => {},
    });

    expect(optimistic).toContain('aria-pressed="true"');
    expect(withdrawn).toContain('aria-pressed="false"');
  });

  it('« Recommandé » ne se pose jamais sur une option bloquée ni déjà choisie', () => {
    const plain = render({ option: option({ id: 'vue' }), recommended: true, onToggle: () => {} });
    const blocked = render({
      option: option({ id: 'mui', state: 'blocked' }),
      recommended: true,
      onToggle: () => {},
    });
    const chosen = render({
      option: option({ id: 'vue', state: 'selected' }),
      recommended: true,
      onToggle: () => {},
    });

    expect(plain).toContain('Recommandé');
    expect(blocked).not.toContain('Recommandé');
    expect(chosen).not.toContain('Recommandé');
  });
});

describe('OptionCard — incompatibilité', () => {
  const blocked = option({
    id: 'vuetify',
    label: 'Vuetify',
    category: 'ui',
    state: 'blocked',
    reason: 'Next.js fonctionne avec React, Vuetify avec Vue.',
    code: 'COMPAT_ECOSYSTEM_MISMATCH',
    docs: 'https://vuetifyjs.com',
    conflicts: [{ id: 'next', label: 'Next.js', docs: 'https://nextjs.org/docs' }],
  });

  it('reste atteignable au clavier et dit qu’elle est incompatible', () => {
    const html = render({ option: blocked, onToggle: () => {} });

    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain('disabled=""');
    expect(html).toContain('data-blocked="true"');
    expect(html).toContain('Incompatible');
  });

  it('sa bulle rouge porte la raison, les technologies en cause et leur documentation', () => {
    const html = render({
      option: blocked,
      alternatives: [{ id: 'shadcn-ui', label: 'shadcn/ui' }],
      onToggle: () => {},
    });

    expect(html).toContain('data-tone="danger"');
    expect(html).toContain('Next.js fonctionne avec React, Vuetify avec Vue.');
    expect(html).toContain('href="https://nextjs.org/docs"');
    expect(html).toContain('href="https://vuetifyjs.com"');
    expect(html).toContain('Alternatives compatibles : shadcn/ui.');
    expect(html).toContain('rel="noreferrer"');
  });

  it('une option utilisable a une bulle neutre, avec sa documentation', () => {
    const html = render({
      option: option({ id: 'radix-ui', label: 'Radix', docs: 'https://www.radix-ui.com' }),
      onToggle: () => {},
    });

    expect(html).toContain('data-tone="neutral"');
    expect(html).toContain('href="https://www.radix-ui.com"');
    expect(html).not.toContain('Incompatible');
  });
});

describe('refusalAdvice', () => {
  const t = MESSAGES.fr;

  it.each([
    'COMPAT_ECOSYSTEM_MISMATCH',
    'COMPAT_EXCLUSIVE_CATEGORY',
    'COMPAT_DECLARED_CONFLICT',
    'COMPAT_TARGET_UNSUPPORTED',
    'COMPAT_ENGINE_UNSATISFIABLE',
    undefined,
  ])('%s : une conséquence et une solution, jamais vides', (code) => {
    const advice = refusalAdvice(t, code, [{ id: 'pnpm', label: 'pnpm' }]);
    expect(advice.consequence.length).toBeGreaterThan(0);
    expect(advice.solution.length).toBeGreaterThan(0);
  });

  it('nomme la technologie à retirer quand la solution est un choix', () => {
    expect(
      refusalAdvice(t, 'COMPAT_DECLARED_CONFLICT', [{ id: 'npm', label: 'npm' }]).solution,
    ).toContain('npm');
  });
});

describe('OptionCard — contenu de la carte', () => {
  it('ne répète pas le nom sous la carte : seul le libellé est écrit', () => {
    const html = render({
      option: option({ id: 'prisma-orm-x', label: 'Prisma' }),
      onToggle: () => {},
    });
    expect(html).toContain('Prisma');
    // L'identifiant n'apparaît que dans les attributs, jamais comme texte visible.
    expect(html).not.toContain('>prisma-orm-x<');
    expect(html).not.toContain('pf-mono');
  });
});
