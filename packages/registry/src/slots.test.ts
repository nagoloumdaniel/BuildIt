import { describe, expect, it } from 'vitest';
import { CATEGORIES } from './schema/entry.js';
import { SLOTS, slotFor } from './slots.js';

describe('la règle « catégorie → emplacement du manifest »', () => {
  it('couvre toutes les catégories du catalogue', () => {
    // Une catégorie sans emplacement ferait tomber un choix dans `services`
    // sans que personne ne l'ait décidé : c'est précisément la dérive que ce
    // module supprime.
    for (const category of CATEGORIES) {
      expect(SLOTS[category], `catégorie sans emplacement : ${category}`).toBeDefined();
    }
    expect(Object.keys(SLOTS).sort()).toEqual([...CATEGORIES].sort());
  });

  it('place les rôles structurants là où le manifest les attend', () => {
    // Les quatre rôles que `pf add` et le brouillon web doivent traiter de la
    // même façon, sinon « les mêmes choix » ne donnent plus le même manifest.
    expect(slotFor('frontend')).toEqual({ kind: 'app', field: 'framework' });
    expect(slotFor('language')).toEqual({ kind: 'app', field: 'language' });
    expect(slotFor('database')).toEqual({ kind: 'single', field: 'engine' });
    expect(slotFor('orm')).toEqual({ kind: 'single', field: 'orm' });
    expect(slotFor('authentication')).toEqual({ kind: 'single', field: 'provider' });
    expect(slotFor('testing')).toEqual({ kind: 'list', field: 'quality' });
    expect(slotFor('containers')).toEqual({ kind: 'list', field: 'infra' });
  });

  it('envoie les capacités du §6.7 dans `services`', () => {
    // `security` n'est pas un outil de qualité au sens du manifest : le CLI et
    // le brouillon le rangeaient déjà là. Le module doit le confirmer.
    for (const capability of ['security', 'payments', 'observability', 'analytics'] as const) {
      expect(slotFor(capability)).toEqual({ kind: 'list', field: 'services' });
    }
  });

  it('ne déclare qu’un seul emplacement par catégorie', () => {
    // Deux catégories qui écrivent le même champ à valeur unique se
    // remplaceraient l'une l'autre en silence ; seule `quality`/`infra`/
    // `services` accepte plusieurs fiches, et c'est un ensemble, pas un champ.
    const singles = Object.entries(SLOTS).filter(([, slot]) => slot.kind === 'single');
    const fields = singles.map(([, slot]) => (slot.kind === 'single' ? slot.field : ''));
    expect(new Set(fields).size).toBe(fields.length);
  });
});
