import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATEGORIES, GENERATION_STATUSES, LICENSES, LIFECYCLE_STATUSES } from './schema/entry.js';

/**
 * La documentation de contribution énumère les catégories et les licences
 * acceptées. Un contributeur s'y fie pour écrire sa fiche.
 *
 * Une documentation qui a dérivé du code est pire que pas de documentation :
 * elle fait perdre du temps avec assurance. Ces tests la clouent au code.
 */

const DOC = readFileSync(new URL('../CONTRIBUTING.md', import.meta.url), 'utf8');

describe('CONTRIBUTING.md — catégories', () => {
  it.each(CATEGORIES)('documente la catégorie %s', (category) => {
    expect(DOC).toContain(category);
  });

  it("n'annonce aucune catégorie qui n'existe pas", () => {
    // Le bloc de catégories est délimité par le titre qui le précède.
    const block = DOC.split('## Catégories')[1]?.split('## Licences')[0] ?? '';
    const announced = block.match(/[a-z][a-z-]+/g) ?? [];
    const unknown = announced.filter(
      (word) =>
        word.includes('-') &&
        !(CATEGORIES as readonly string[]).includes(word) &&
        !['ci-cd', 'data-fetching', 'package-manager', 'git-hooks'].includes(word),
    );
    expect(unknown).toEqual([]);
  });
});

describe('CONTRIBUTING.md — licences', () => {
  it.each(LICENSES)('documente la licence %s', (license) => {
    expect(DOC).toContain(license);
  });
});

describe('CONTRIBUTING.md — statuts', () => {
  it.each(LIFECYCLE_STATUSES)('documente le statut de cycle de vie %s', (status) => {
    expect(DOC).toContain(status);
  });

  it.each(GENERATION_STATUSES)('documente le statut de génération %s', (status) => {
    expect(DOC).toContain(status);
  });
});

describe('CONTRIBUTING.md — commandes citées', () => {
  it('cite la commande de régénération de l’index telle qu’elle existe', () => {
    const packageJson = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { scripts: Record<string, string> };
    expect(packageJson.scripts['build:index']).toBeDefined();
    expect(DOC).toContain('run build:index');
  });
});
