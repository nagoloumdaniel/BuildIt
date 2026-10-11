import { describe, expect, it } from 'vitest';
import { dependencyGraph, requiredEnvVars } from './engine';

/**
 * Les deux vues ajoutées pour les écrans Env (§6.8) et Dependency Graph
 * (§6.11). Elles lisent le **vrai** catalogue : c'est ce qui garantit que
 * l'écran ne promet pas des variables ou des liens qui n'existent pas.
 */

const SAAS = {
  targets: ['web'] as const,
  technologies: ['next', 'typescript', 'tailwind', 'postgresql', 'prisma', 'better-auth'],
};

describe('requiredEnvVars', () => {
  it('rend les noms réclamés par les technologies choisies, sans doublon', async () => {
    const vars = await requiredEnvVars({
      targets: [...SAAS.targets],
      technologies: [...SAAS.technologies],
    });
    const names = vars.map((variable) => variable.name);

    expect(names).toContain('DATABASE_URL');
    expect(names).toContain('BETTER_AUTH_SECRET');
    // `next`/`typescript`/`tailwind` n'en réclament aucune : elles ne doivent
    // pas apparaître comme si elles en demandaient une.
    expect(names).not.toContain('NEXT_PUBLIC_SOMETHING');
    expect(new Set(names).size).toBe(names.length);
  });

  it('dit quelle technologie réclame chaque variable', async () => {
    const vars = await requiredEnvVars({ targets: ['web'], technologies: ['postgresql'] });
    const database = vars.find((variable) => variable.name === 'DATABASE_URL');

    expect(database?.technologies).toContain('postgresql');
  });

  it('ne rend jamais de valeur, même quand le catalogue en porterait', async () => {
    const vars = await requiredEnvVars({ targets: ['web'], technologies: ['stripe'] });
    for (const variable of vars) {
      // Un nom de variable tel que le schéma du registry l'impose : pas de `=`.
      expect(variable.name).toMatch(/^[A-Z][A-Z0-9_]*$/);
      expect(variable.name).not.toContain('=');
    }
  });

  it('sur une sélection vide, ne réclame rien', async () => {
    expect(await requiredEnvVars({ targets: ['web'], technologies: [] })).toEqual([]);
  });
});

describe('dependencyGraph', () => {
  it('dessine les nœuds choisis et leurs liens déclarés', async () => {
    const graph = await dependencyGraph({ targets: ['web'], technologies: [...SAAS.technologies] });
    const ids = graph.nodes.map((node) => node.id);

    expect(ids).toContain('next');
    expect(ids).toContain('prisma');
    // Une arête ne relie que des technologies présentes dans la résolution.
    for (const edge of graph.edges) {
      expect(ids).toContain(edge.from);
      expect(ids).toContain(edge.to);
    }
    expect(graph.edges.length).toBeGreaterThan(0);
  });

  it('distingue ce qui a été choisi de ce que le moteur a ajouté', async () => {
    const graph = await dependencyGraph({ targets: ['web'], technologies: ['next'] });
    const typescript = graph.nodes.find((node) => node.id === 'typescript');

    // `next` exige `typescript` : il est dans le graphe sans avoir été coché.
    expect(typescript?.state).toBe('added');
    expect(graph.nodes.find((node) => node.id === 'next')?.state).toBe('selected');
  });

  it('une sélection vide rend un graphe vide, pas une erreur', async () => {
    const graph = await dependencyGraph({ targets: ['web'], technologies: [] });
    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
  });
});
