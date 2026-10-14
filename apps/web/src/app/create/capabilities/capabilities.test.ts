import { CATEGORIES, type Category } from '@buildit/registry';
import { describe, expect, it } from 'vitest';
import { freshDraft } from '../../../lib/draft';
import { FR } from '../../../lib/i18n/messages';
import {
  CAPABILITY_CATEGORIES,
  CAPABILITY_FAMILIES,
  DEFAULT_CAPABILITY_CATEGORY,
  engineSelection,
  SCREEN_ROLE,
  toggleCapability,
} from './capabilities';

/**
 * L'écran 7 (§6.7) ne recopie aucune liste de technologies : il demande au
 * moteur les options d'une **catégorie** du catalogue. Ce qui se décide ici,
 * c'est quelles catégories sont des capacités et cette décision doit porter
 * sur le catalogue entier, sinon une catégorie ajoutée disparaîtrait de tous
 * les écrans en silence.
 */
describe('rôle des catégories sur les écrans du parcours', () => {
  it('range chaque catégorie du catalogue sur exactement un écran', () => {
    // Une catégorie absente de la table est un trou : elle n'apparaîtrait nulle
    // part. `Object.keys` est comparé au catalogue réel, pas à une liste écrite
    // ici un test qui recopie sa source ne prouve rien.
    expect(Object.keys(SCREEN_ROLE).sort()).toEqual([...CATEGORIES].sort());
  });

  it('classe les capacités comme les « services » du manifest', () => {
    // Même frontière que `SLOTS` de `lib/draft-to-manifest.ts` : les catégories
    // que le manifest range dans `services` sont celles de l'écran Capabilities.
    const expected = [
      'authorization',
      'state',
      'data-fetching',
      'forms',
      'validation',
      'api',
      'build',
      'storage',
      'cache',
      'queue',
      'search',
      'email',
      'payments',
      'observability',
      'analytics',
      'security',
      'ai',
      'cms',
      'ecommerce',
    ];

    expect([...CAPABILITY_CATEGORIES].sort()).toEqual([...expected].sort());
  });

  it('laisse la pile, la base, l’auth et l’infrastructure aux autres écrans', () => {
    // Ces catégories ont un emplacement propre dans le manifest (framework,
    // engine, provider, infra) : les doubler ici créerait deux endroits pour un
    // même choix.
    for (const category of [
      'frontend',
      'database',
      'orm',
      'authentication',
      'hosting',
      'containers',
    ]) {
      expect(CAPABILITY_CATEGORIES).not.toContain(category);
    }
  });

  it('donne un libellé lisible à chaque famille, jamais un identifiant de catalogue', () => {
    const families = FR.wizard.capabilities.families;
    expect(CAPABILITY_FAMILIES.length).toBeGreaterThan(0);
    for (const category of CAPABILITY_FAMILIES) {
      const family = families[category];
      expect(family.label.length).toBeGreaterThan(0);
      expect(family.label).not.toBe(category);
      expect(family.note.length).toBeGreaterThan(0);
      expect(SCREEN_ROLE[category]).toBe('capabilities');
    }
    // Les familles couvrent les capacités, dans le même ordre : deux listes qui
    // divergent afficheraient un écran amputé d'une famille.
    expect([...CAPABILITY_FAMILIES]).toEqual([...CAPABILITY_CATEGORIES]);
  });

  it('ouvre l’écran sur une famille qui existe vraiment', () => {
    expect(CAPABILITY_CATEGORIES).toContain(DEFAULT_CAPABILITY_CATEGORY);
  });
});

describe('sélection envoyée au moteur', () => {
  it('unit technologies et capacités, sans doublon et dans un ordre stable', () => {
    const draft = {
      ...freshDraft(),
      targets: ['web'],
      technologies: ['next', 'typescript', 'next'],
      capabilities: ['stripe', 'typescript'],
    };

    expect(engineSelection(draft)).toEqual({
      targets: ['web'],
      // Trié : deux ordres de clics sur le même ensemble donnent la même
      // sélection, donc la même vérification de compatibilité.
      technologies: ['next', 'stripe', 'typescript'],
    });
  });

  it('ne porte aucune valeur : des identifiants, rien d’autre', () => {
    const selection = engineSelection(freshDraft());
    expect(selection).toEqual({ targets: [], technologies: [] });
  });
});

describe('bascule d’une capacité', () => {
  const categoryOf = new Map<string, Category>([
    ['stripe', 'payments'],
    ['paddle', 'payments'],
  ]);

  it('ajoute puis retire un identifiant sans muter le brouillon reçu', () => {
    const draft = freshDraft();
    const added = toggleCapability(draft, 'stripe', 'payments', categoryOf);

    expect(added.capabilities).toEqual(['stripe']);
    expect(draft.capabilities).toEqual([]);

    const removed = toggleCapability(added, 'stripe', 'payments', categoryOf);
    expect(removed.capabilities).toEqual([]);
    expect(added.capabilities).toEqual(['stripe']);
  });

  it('un second moyen de paiement s’ajoute : Stripe et Paddle coexistent', () => {
    const draft = freshDraft();
    const withStripe = toggleCapability(draft, 'stripe', 'payments', categoryOf);
    const withPaddle = toggleCapability(withStripe, 'paddle', 'payments', categoryOf);
    expect(withPaddle.capabilities).toEqual(['stripe', 'paddle']);
  });
});
