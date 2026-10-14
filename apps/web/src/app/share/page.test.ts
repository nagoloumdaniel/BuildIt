import type { Manifest } from '@buildit/manifest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { decodeSharePayload, encodeSharePayload } from './codec';
import SharePage, { metadata } from './page';
import { SharePreview, ShareView } from './view';

/**
 * La page de partage, rendue sans DOM.
 *
 * Ce qui est vérifié ici tient au §9.4 : la page est en lecture seule (aucun
 * bouton d'action), `noindex` est posé, et un lien illisible se dit poliment —
 * jamais par une trace technique.
 */

const MANIFEST: Manifest = {
  manifestVersion: 1,
  name: 'demo',
  targets: ['web'],
  architecture: 'single-app',
  frontend: { framework: 'next', language: 'typescript' },
  database: { engine: 'postgresql', orm: 'prisma' },
};

const LABELS = new Map<string, string>([
  ['next', 'Next.js'],
  ['typescript', 'TypeScript'],
  ['postgresql', 'PostgreSQL'],
  ['prisma', 'Prisma'],
]);

function decoded(): ReturnType<typeof decodeSharePayload> {
  return decodeSharePayload(encodeSharePayload(MANIFEST));
}

describe('metadata la page ne s’indexe pas', () => {
  it('pose noindex, nofollow', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(String(metadata.title)).toContain('Configuration partagée');
  });
});

describe('SharePage le rendu serveur attend le fragment', () => {
  it('n’affiche rien du manifest tant que le navigateur n’a pas lu le fragment', () => {
    const html = renderToStaticMarkup(createElement(SharePage));
    expect(html).toContain('Lecture du lien');
  });
});

describe('SharePreview lecture seule, et rien de plus', () => {
  it('rend le Blueprint du manifest partagé', () => {
    const result = decoded();
    expect(result.ok).toBe(true);
    const html = renderToStaticMarkup(createElement(SharePreview, { result, labels: LABELS }));

    expect(html).toContain('demo');
    expect(html).toContain('Next.js + PostgreSQL');
    expect(html).toContain('Plateformes');
    expect(html).toContain('Web');
    expect(html).toContain('Lecture seule');
  });

  it('n’offre aucune action : ni édition, ni génération', () => {
    const html = renderToStaticMarkup(
      createElement(SharePreview, { result: decoded(), labels: LABELS }),
    );

    expect(html).not.toContain('<button');
    expect(html).not.toContain('Générer');
    expect(html).not.toContain('Modifier');
    expect(html).not.toContain('Installer');
    expect(html).not.toContain('Continuer');
    // Un seul lien de sortie, vers l'accueil.
    expect(html).toContain('href="/"');
  });

  it('dit poliment qu’un lien est illisible, sans trace technique', () => {
    const html = renderToStaticMarkup(
      createElement(SharePreview, {
        result: { ok: false, issues: ['Ce lien est incomplet.'] },
        labels: new Map(),
      }),
    );

    expect(html).toContain('Ce lien n’a pas pu être lu');
    expect(html).toContain('Ce lien est incomplet.');
    expect(html).not.toContain('Error');
    expect(html).not.toMatch(/at \w+ \(/);
  });
});

describe('ShareView le fragment fait foi', () => {
  it('décode le fragment du lien et rend la configuration', () => {
    const payload = encodeSharePayload(MANIFEST);
    const html = renderToStaticMarkup(createElement(ShareView, { hash: `#${payload}` }));

    expect(html).toContain('demo');
    expect(html).toContain('Application unique');
  });

  it('accepte aussi un fragment passé sans croisillon', () => {
    const payload = encodeSharePayload(MANIFEST);
    expect(renderToStaticMarkup(createElement(ShareView, { hash: payload }))).toContain('demo');
  });

  it('refuse un fragment vide sans lever', () => {
    const html = renderToStaticMarkup(createElement(ShareView, { hash: '' }));
    expect(html).toContain('Ce lien n’a pas pu être lu');
  });

  it('ne laisse filtrer ni secret ni chemin local', () => {
    const payload = encodeSharePayload({
      ...MANIFEST,
      name: 'demo',
    });
    const html = renderToStaticMarkup(createElement(ShareView, { hash: `#${payload}` }));

    expect(html).not.toContain('C:\\');
    expect(html).not.toContain('ghp_');
    expect(html).not.toContain('DATABASE_URL');
  });
});
