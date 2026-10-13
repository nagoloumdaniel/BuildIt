import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BlueprintSummary } from './BlueprintSummary';
import type { BlueprintView } from './summary';

const VIEW: BlueprintView = {
  name: 'mon-projet',
  headline: 'Next.js + PostgreSQL + Stripe',
  technologyIds: ['next', 'postgresql', 'stripe'],
  rows: [
    { key: 'targets', role: 'Plateformes', values: [{ id: 'web', label: 'Web' }] },
    {
      key: 'architecture',
      role: 'Architecture',
      values: [{ id: 'single-app', label: 'Application unique' }],
    },
    {
      key: 'web',
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
    const html = renderToStaticMarkup(<BlueprintSummary view={VIEW} />);

    expect(html).toContain('mon-projet');
    expect(html).toContain('Next.js + PostgreSQL + Stripe');
    expect(html).toContain('Plateformes');
    expect(html).toContain('Application unique');
    expect(html).toContain('Application web');
    expect(html).toContain('TypeScript');
  });

  it('sans phrase d’en-tête, n’affiche pas de paragraphe vide', () => {
    const html = renderToStaticMarkup(<BlueprintSummary view={{ ...VIEW, headline: '' }} />);
    expect(html).not.toContain('pf-subtitle');
  });

  it('sans liens de modification (page de partage), n’affiche aucun crayon', () => {
    const html = renderToStaticMarkup(<BlueprintSummary view={VIEW} />);
    expect(html).not.toContain('data-icon="pencil"');
    expect(html).not.toContain('Modifier');
  });

  it('pose un crayon nommé à côté de chaque choix qui en porte un', () => {
    const html = renderToStaticMarkup(
      <BlueprintSummary
        view={{
          ...VIEW,
          nameEdit: '/create',
          rows: [
            {
              key: 'web',
              role: 'Application web',
              values: [{ id: 'next', label: 'Next.js', edit: '/create/stack?category=frontend' }],
            },
            {
              key: 'env',
              role: 'Variables d’environnement',
              values: [{ id: 'DATABASE_URL', label: 'DATABASE_URL' }],
              edit: '/create/env',
            },
          ],
        }}
      />,
    );

    expect(html).toContain('aria-label="Modifier le nom du projet"');
    expect(html).toContain('href="/create"');
    expect(html).toContain('aria-label="Modifier Next.js"');
    expect(html).toContain('href="/create/stack?category=frontend"');
    expect(html).toContain('aria-label="Modifier Variables d’environnement"');
    expect(html).toContain('href="/create/env"');
    expect(html.match(/data-icon="pencil"/g)?.length).toBe(3);
  });
});
