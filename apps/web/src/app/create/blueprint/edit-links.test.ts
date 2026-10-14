import { describe, expect, it } from 'vitest';
import { freshDraft } from '../../../lib/draft';
import { EN, FR } from '../../../lib/i18n/messages';
import { type EditContext, editableBlueprint, technologyEditHref } from './edit-links';
import type { BlueprintView } from './summary';

/**
 * Les crayons du plan : chaque choix ramène à l'écran **qui l'a écrit**, et à
 * la section où il se modifie. Le brouillon fait foi, pas le manifest.
 */

function context(overrides: Partial<EditContext['draft']> = {}): EditContext {
  return {
    draft: { ...freshDraft(), ...overrides },
    categories: new Map([
      ['next', 'frontend'],
      ['prisma', 'orm'],
      ['stripe', 'payments'],
      ['vercel', 'hosting'],
      ['docker', 'containers'],
      ['github-actions', 'ci-cd'],
    ]),
  };
}

const VIEW: BlueprintView = {
  name: 'mon-projet',
  headline: 'Next.js',
  technologyIds: ['next', 'prisma'],
  rows: [
    { key: 'targets', role: 'Plateformes', values: [{ id: 'web', label: 'Web' }] },
    {
      key: 'architecture',
      role: 'Architecture',
      values: [{ id: 'single-app', label: 'Application unique' }],
    },
    { key: 'web', role: 'Application web', values: [{ id: 'next', label: 'Next.js' }] },
  ],
};

describe('technologyEditHref l’étape et la section de chaque technologie', () => {
  it('une technologie du Stack Builder ouvre sa catégorie', () => {
    const ctx = context({ technologies: ['next', 'prisma'] });
    expect(technologyEditHref('next', ctx)).toBe('/create/stack?category=frontend');
    expect(technologyEditHref('prisma', ctx)).toBe('/create/stack?category=orm');
  });

  it('une capacité ouvre sa famille aux Capacités', () => {
    expect(technologyEditHref('stripe', context({ capabilities: ['stripe'] }))).toBe(
      '/create/capabilities?family=payments',
    );
  });

  it('le même identifiant choisi au Stack Builder y ramène, même s’il est aussi une capacité', () => {
    const ctx = context({ technologies: ['stripe'], capabilities: ['stripe'] });
    expect(technologyEditHref('stripe', ctx)).toBe('/create/stack?category=payments');
  });

  it('Docker, la CI et l’hébergeur ramènent à leur case de l’Infrastructure', () => {
    const ctx = context({ technologies: ['vercel'], infra: { docker: true, ci: true } });
    expect(technologyEditHref('docker', ctx)).toBe('/create/infrastructure?section=docker');
    expect(technologyEditHref('github-actions', ctx)).toBe('/create/infrastructure?section=ci');
    expect(technologyEditHref('vercel', ctx)).toBe('/create/infrastructure?section=hosting');
  });

  it('sans catégorie connue (catalogue illisible), ouvre le Stack Builder sans section', () => {
    expect(technologyEditHref('inconnu', context({ technologies: ['inconnu'] }))).toBe(
      '/create/stack',
    );
  });
});

describe('editableBlueprint le plan du brouillon, crayons compris', () => {
  it('pose un lien sur le nom, les plateformes, l’architecture et chaque technologie', () => {
    const view = editableBlueprint(VIEW, context({ technologies: ['next'] }), FR);

    expect(view.nameEdit).toBe('/create');
    const edits = view.rows.flatMap((row) => row.values.map((value) => value.edit));
    expect(edits).toEqual([
      '/create/target',
      '/create/architecture',
      '/create/stack?category=frontend',
    ]);
  });

  it('ajoute le profil après les plateformes, et les variables d’environnement en fin', () => {
    const view = editableBlueprint(
      VIEW,
      context({ technologies: ['next'], type: 'saas', envVarNames: ['DATABASE_URL'] }),
      FR,
    );

    expect(view.rows.map((row) => row.key)).toEqual([
      'targets',
      'type',
      'architecture',
      'web',
      'env',
    ]);
    expect(view.rows[1]?.values).toEqual([{ id: 'saas', label: 'SaaS', edit: '/create/type' }]);
    expect(view.rows[4]?.role).toBe('Variables d’environnement');
    expect(view.rows[4]?.edit).toBe('/create/env');
  });

  it('nomme les lignes ajoutées dans la langue courante', () => {
    const view = editableBlueprint(
      VIEW,
      context({ type: 'saas', envVarNames: ['DATABASE_URL'] }),
      EN,
    );
    const roles = view.rows.map((row) => row.role);
    expect(roles).toContain('Project profile');
    expect(roles).toContain('Environment variables');
  });

  it('ne modifie pas la vue reçue : la page de partage la rend sans crayon', () => {
    editableBlueprint(VIEW, context({ technologies: ['next'] }), FR);
    expect(VIEW.rows.every((row) => row.values.every((value) => value.edit === undefined))).toBe(
      true,
    );
  });
});
