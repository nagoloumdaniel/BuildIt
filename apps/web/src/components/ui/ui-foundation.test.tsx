import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { BubbleNav } from './bubble-nav';
import { Card, CardHead } from './card';
import { ProgressBar, ProgressPanel } from './loading';
import { Stepper } from './stepper';

vi.mock('next/navigation', () => ({
  usePathname: () => '/create',
}));

describe('UI foundation', () => {
  it('names every shell destination and identifies the active page', () => {
    const html = renderToStaticMarkup(<BubbleNav />);

    expect(html).toContain('aria-label="Navigation principale"');
    for (const label of ['Accueil', 'Créer', 'Cloner', 'Ouvrir', 'Projets', 'GitHub']) {
      expect(html).toContain(`aria-label="${label}"`);
    }
    expect(html).toContain(
      'aria-label="Créer" class="pf-bubble" aria-current="page" href="/create"',
    );
  });

  it('exposes known progress as a bounded ARIA value', () => {
    const html = renderToStaticMarkup(<ProgressBar label="Génération" value={42.4} />);

    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-label="Génération"');
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="100"');
    expect(html).toContain('aria-valuenow="42"');
  });

  it('keeps unknown progress indeterminate for assistive technology', () => {
    const html = renderToStaticMarkup(<ProgressBar />);

    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-label="Progression"');
    expect(html).toContain('pf-bar-indeterminate');
    expect(html).not.toContain('aria-valuenow');
  });

  it('tells the stepper position to screen readers and keeps step names out of sight', () => {
    const html = renderToStaticMarkup(
      <Stepper
        ariaLabel="Parcours"
        compactLabel="Étape 1 sur 2"
        current={0}
        steps={[
          { id: 'name', label: 'Nom', href: '/create' },
          { id: 'type', label: 'Type', href: '/create/type' },
        ]}
      />,
    );

    expect(html).toContain('<p class="pf-journey-sr">Étape 1 sur 2</p>');
    expect(html).toContain('aria-current="step"');
    expect(html).toContain('<span class="pf-journey-sr">Type</span>');
    // Upcoming steps are not links: jumping ahead would skip blocking checks.
    expect(html).not.toContain('href="/create/type"');
    // Small screens: a thin decorative bar, filled to step / total.
    expect(html).toContain('<div aria-hidden="true" class="pf-rail-bar"');
    expect(html).toContain('--pf-rail-bar-fill:0.5');
  });

  it('turns done steps into plain text once the stepper is locked', () => {
    const steps = [
      { id: 'name', label: 'Nom', href: '/create' },
      { id: 'type', label: 'Type', href: '/create/type' },
    ];
    const open = renderToStaticMarkup(
      <Stepper ariaLabel="Parcours" compactLabel="Étape 2 sur 2" current={1} steps={steps} />,
    );
    const locked = renderToStaticMarkup(
      <Stepper
        ariaLabel="Parcours"
        compactLabel="Étape 2 sur 2"
        current={1}
        locked
        steps={steps}
      />,
    );

    expect(open).toContain('href="/create"');
    expect(locked).not.toContain('href="/create"');
    expect(locked).toContain('title="Nom"');
  });

  it('associates panel progress with its visible title', () => {
    const html = renderToStaticMarkup(<ProgressPanel title="Génération du projet" value={50} />);

    expect(html).toMatch(/<p class="pf-title-sm flex items-center gap-2" id="[^"]+">/);
    expect(html).toMatch(/aria-labelledby="[^"]+"/);
    expect(html).toContain('Génération du projet');
  });

  it('renders card actions in the named action slot', () => {
    const html = renderToStaticMarkup(
      <Card>
        <CardHead actions={<button type="button">Modifier</button>} title="Projet" />
      </Card>,
    );

    expect(html).toContain('data-slot="card-actions"');
    expect(html).toContain('w-full flex-wrap');
    expect(html).toContain('md:w-auto md:flex-none');
    expect(html).toContain('<button type="button">Modifier</button>');
  });
});
