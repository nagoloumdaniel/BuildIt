import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BlueprintSummary } from './BlueprintSummary';
import type { BlueprintView } from './summary';

const VIEW: BlueprintView = {
  name: 'mon-projet',
  headline: 'Next.js + PostgreSQL + Stripe',
  technologyIds: ['next', 'postgresql', 'stripe'],
  rows: [
    { role: 'Plateformes', values: [{ id: 'web', label: 'Web' }] },
    { role: 'Architecture', values: [{ id: 'single-app', label: 'Application unique' }] },
    {
      role: 'Application web',
      values: [
        { id: 'next', label: 'Next.js' },
        { id: 'typescript', label: 'TypeScript' },
      ],
    },
  ],
};

/** Le résumé est pur : il reçoit sa vue, il ne lit ni le brouillon ni le moteur. */
describe('BlueprintSummary', () => {
  it('affiche le nom, la phrase lisible et chaque rôle', () => {
    const html = renderToStaticMarkup(BlueprintSummary({ view: VIEW }));

    expect(html).toContain('mon-projet');
    expect(html).toContain('Next.js + PostgreSQL + Stripe');
    expect(html).toContain('Plateformes');
    expect(html).toContain('Application unique');
    expect(html).toContain('Application web');
    expect(html).toContain('TypeScript');
  });

  it('sans phrase d’en-tête, n’affiche pas de paragraphe vide', () => {
    const html = renderToStaticMarkup(BlueprintSummary({ view: { ...VIEW, headline: '' } }));
    expect(html).not.toContain('pf-subtitle');
  });
});
