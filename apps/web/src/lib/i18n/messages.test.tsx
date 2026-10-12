import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EN, FR, MESSAGES } from './messages';
import { useMessages } from './provider';

/**
 * La parité des deux langues, prouvée sur les **données**, pas seulement sur
 * les types.
 *
 * Le typecheck fait déjà l'essentiel : `EN` est déclaré `Widen<typeof FR>`,
 * donc une clé ajoutée d'un seul côté ne compile pas. Mais un type ne dit rien
 * de ce qui est *dans* la clé — une phrase laissée vide, recopiée du français,
 * ou un gabarit de fonction dont l'anglais oublie un paramètre passent tous les
 * deux. C'est ce que ce fichier vérifie, en parcourant les deux arbres.
 *
 * Règle de la maison : le français fait la **forme**. L'anglais doit la
 * satisfaire exactement, y compris le nombre d'arguments des fonctions, parce
 * qu'un accord ou un ordre de mots différent est justement ce qu'une fonction
 * traduit.
 */

type Tree = Readonly<Record<string, unknown>>;

function paths(value: unknown, prefix = ''): readonly string[] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return [prefix];
  }
  return Object.entries(value as Tree).flatMap(([key, child]) =>
    paths(child, prefix === '' ? key : `${prefix}.${key}`),
  );
}

function at(tree: Tree, path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => {
    if (typeof node !== 'object' || node === null) {
      return undefined;
    }
    return (node as Tree)[key];
  }, tree);
}

describe('parité fr / en', () => {
  it('expose exactement les mêmes chemins des deux côtés', () => {
    expect([...paths(EN)].sort()).toEqual([...paths(FR)].sort());
  });

  it('ne laisse aucune phrase vide, dans aucune langue', () => {
    for (const [locale, tree] of [
      ['fr', FR],
      ['en', EN],
    ] as const) {
      for (const path of paths(tree)) {
        const value = at(tree, path);
        if (typeof value === 'string') {
          expect(value.trim(), `${locale}.${path} est vide`).not.toBe('');
        }
      }
    }
  });

  it('donne le même nombre d’arguments aux textes variables', () => {
    for (const path of paths(FR)) {
      const french = at(FR, path);
      const english = at(EN, path);
      if (typeof french === 'function') {
        expect(typeof english, `en.${path} devrait être une fonction`).toBe('function');
        if (typeof english === 'function') {
          expect(english.length, `en.${path} n’a pas le même arité`).toBe(french.length);
        }
      }
    }
  });

  it('sert le français hors fournisseur de langue', () => {
    // Rendu statique d'un test : aucun `LocaleProvider` monté. Un écran doit
    // rester lisible plutôt que de lever. Un hook ne s'appelle pas hors rendu,
    // d'où la sonde — c'est le cas réel : un composant rendu seul dans un test.
    function Probe(): string {
      return useMessages() === FR ? 'fr' : 'autre';
    }
    expect(renderToStaticMarkup(<Probe />)).toBe('fr');
  });

  it('range les deux langues sous leur code', () => {
    expect(MESSAGES.fr).toBe(FR);
    expect(MESSAGES.en).toBe(EN);
  });

  it('ne recopie pas le français dans l’anglais pour les phrases', () => {
    // Les **valeurs techniques** sont légitimement identiques : « BuildIt »,
    // « MIT », « GitHub », une version. Une phrase, elle, ne l'est pas — et
    // c'est la seule façon de voir une traduction oubliée.
    //
    // Une exception, nommée : un texte qui n'est qu'une **liste de noms de
    // technologies** (`react, postgres, drizzle…`) est une donnée. Le traduire
    // n'aurait aucun sens.
    const sameByDesign = new Set(['wizard.stack.searchPlaceholder']);

    const identical = paths(FR).filter((path) => {
      if (sameByDesign.has(path)) {
        return false;
      }
      const french = at(FR, path);
      const english = at(EN, path);
      return (
        typeof french === 'string' &&
        french === english &&
        french.length > 24 &&
        !/^[A-Za-z0-9.@:/-]+$/.test(french)
      );
    });

    expect(identical).toEqual([]);
  });
});
