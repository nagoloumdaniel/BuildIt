import { describe, expect, it } from 'vitest';
import { freshDraft } from '../../../lib/draft';
import type { EnvVarView } from '../../../lib/engine';
import { loadEnvVarsAction } from '../../actions';
import { envSelection, isEngineAdded, namesOf, sameNames } from './env-model';

const DATABASE: EnvVarView = { name: 'DATABASE_URL', technologies: ['prisma', 'postgresql'] };
const STRIPE: EnvVarView = { name: 'STRIPE_SECRET_KEY', technologies: ['stripe'] };
const SENTRY: EnvVarView = { name: 'SENTRY_DSN', technologies: ['sentry'] };
const VARS: readonly EnvVarView[] = [DATABASE, STRIPE, SENTRY];

/**
 * L'écran 8 (§6.8, §24) ne manipule que des **noms**. Ce fichier est le seul
 * endroit de l'écran qui décide ce qui part dans le brouillon ; il ne peut donc
 * rien y faire entrer d'autre qu'un nom de la vue du moteur.
 */
describe('sélection envoyée au moteur', () => {
  it('unit technologies, capacités et infras cochées, sans doublon ni ordre instable', () => {
    const draft = {
      ...freshDraft(),
      targets: ['web'],
      technologies: ['next', 'prisma'],
      capabilities: ['stripe', 'prisma'],
      infra: { docker: true, ci: true },
    };

    expect(envSelection(draft)).toEqual({
      targets: ['web'],
      technologies: ['docker', 'github-actions', 'next', 'prisma', 'stripe'],
    });
  });

  it('n’envoie rien quand rien n’est choisi', () => {
    expect(envSelection(freshDraft())).toEqual({ targets: [], technologies: [] });
  });
});

describe('noms retenus pour le brouillon', () => {
  it('ne garde que les noms, dans l’ordre du moteur', () => {
    expect(namesOf(VARS)).toEqual(['DATABASE_URL', 'STRIPE_SECRET_KEY', 'SENTRY_DSN']);
  });

  it('un nom ne peut pas porter d’affectation : la grammaire l’interdit déjà', () => {
    // La valeur n'est pas « non affichée par convention » : elle ne peut pas
    // entrer dans un `EnvVarView`, donc elle ne peut pas entrer dans le
    // brouillon. La sonde est réaliste : c'est la forme que prendrait une fuite.
    for (const name of namesOf(VARS)) {
      expect(name).not.toContain('=');
      expect(name).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });

  it('compare deux listes de noms sans dépendre de l’ordre', () => {
    expect(sameNames(['A', 'B'], ['B', 'A'])).toBe(true);
    expect(sameNames(['A', 'B'], ['A'])).toBe(false);
    expect(sameNames([], [])).toBe(true);
    expect(sameNames(['A'], ['A', 'A'])).toBe(false);
  });
});

describe('variables ajoutées par le moteur', () => {
  it('reconnaît une variable réclamée par un choix de l’utilisateur', () => {
    expect(isEngineAdded(DATABASE, new Set(['prisma']))).toBe(false);
  });

  it('signale une variable qu’aucun choix de l’utilisateur ne réclame', () => {
    // Le moteur ajoute des technologies pour tenir une exigence : leur variable
    // vient de lui, pas d'un clic, et l'écran doit le dire.
    expect(isEngineAdded(DATABASE, new Set(['next', 'stripe']))).toBe(true);
    expect(isEngineAdded(STRIPE, new Set(['next']))).toBe(true);
    expect(isEngineAdded(SENTRY, new Set(['next']))).toBe(true);
  });

  it('ne prétend rien d’une variable sans technologie déclarée', () => {
    expect(isEngineAdded({ name: 'ORPHELINE', technologies: [] }, new Set())).toBe(false);
  });
});

describe('la source réelle des noms (Server Action)', () => {
  it('rend les noms du catalogue pour une sélection réelle, jamais une valeur', async () => {
    const variables = await loadEnvVarsAction(
      envSelection({
        ...freshDraft(),
        targets: ['web'],
        technologies: ['next'],
        capabilities: ['stripe'],
      }),
    );

    const names = namesOf(variables);
    expect(names).toContain('STRIPE_SECRET_KEY');
    // Le contrat tient sur la forme : un nom du registry ne peut pas contenir
    // d'affectation, donc la vue ne peut pas transporter de valeur.
    for (const name of names) {
      expect(name).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });

  it('ne rend rien pour un brouillon vide, sans inventer de variable', async () => {
    expect(await loadEnvVarsAction(envSelection(freshDraft()))).toEqual([]);
  });
});
