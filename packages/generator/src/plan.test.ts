import { describe, expect, it } from 'vitest';
import { describePlan, planFiles } from './plan.js';

const FILE = { path: 'README.md', contents: '# projet\n', source: 'base' };

function codesOf(files: { path: string; contents: string; source: string }[]): string[] {
  const result = planFiles('/cible', files);
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

describe('plan valide', () => {
  it('accepte un fichier à la racine', () => {
    expect(planFiles('/cible', [FILE]).ok).toBe(true);
  });

  it('accepte un chemin imbriqué', () => {
    expect(codesOf([{ ...FILE, path: 'src/app/page.tsx' }])).toEqual([]);
  });

  it('accepte un plan vide', () => {
    expect(planFiles('/cible', []).ok).toBe(true);
  });

  it('accepte un fichier caché', () => {
    expect(codesOf([{ ...FILE, path: '.env.example' }])).toEqual([]);
  });

  it('accepte un contenu vide — un fichier vide reste un fichier', () => {
    expect(codesOf([{ ...FILE, contents: '' }])).toEqual([]);
  });

  it('trie les fichiers par chemin — un plan est reproductible', () => {
    const result = planFiles('/cible', [
      { ...FILE, path: 'src/b.ts' },
      { ...FILE, path: 'README.md' },
      { ...FILE, path: 'src/a.ts' },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.files.map((file) => file.path)).toEqual([
        'README.md',
        'src/a.ts',
        'src/b.ts',
      ]);
    }
  });
});

/**
 * Les six règles qui séparent un générateur d'un effaceur de disque.
 * Chacune se prouve en refusant, pas en acceptant.
 */
describe('sécurité des chemins — §24', () => {
  it('refuse un chemin absolu POSIX', () => {
    expect(codesOf([{ ...FILE, path: '/etc/passwd' }])).toContain('GEN_PATH_TRAVERSAL');
  });

  it('refuse un chemin absolu Windows', () => {
    expect(codesOf([{ ...FILE, path: 'C:/Windows/system32/x' }])).toContain('GEN_PATH_TRAVERSAL');
  });

  it('refuse une racine UNC', () => {
    expect(codesOf([{ ...FILE, path: '//serveur/partage/x' }])).toContain('GEN_PATH_TRAVERSAL');
  });

  it('refuse un segment de remontée', () => {
    expect(codesOf([{ ...FILE, path: '../dehors.txt' }])).toContain('GEN_PATH_TRAVERSAL');
  });

  it('refuse une remontée dissimulée au milieu du chemin', () => {
    // `a/../../b` ne commence pas par `..` mais sort quand même du dossier.
    // C'est pourquoi la vérification porte sur le chemin résolu.
    expect(codesOf([{ ...FILE, path: 'a/../../dehors.txt' }])).toContain('GEN_PATH_TRAVERSAL');
  });

  it('accepte une remontée qui reste à l’intérieur', () => {
    expect(codesOf([{ ...FILE, path: 'src/../README.md' }])).toEqual([]);
  });

  it('refuse un séparateur antislash', () => {
    expect(codesOf([{ ...FILE, path: 'src\\app.ts' }])).toContain('GEN_BACKSLASH_SEPARATOR');
  });

  it('refuse un chemin vide', () => {
    expect(codesOf([{ ...FILE, path: '' }])).toContain('GEN_EMPTY_PATH');
  });

  it('refuse un chemin qui ne désigne pas un fichier', () => {
    expect(codesOf([{ ...FILE, path: '.' }])).toContain('GEN_PATH_TRAVERSAL');
  });

  it('refuse un chemin se terminant par un séparateur', () => {
    expect(codesOf([{ ...FILE, path: 'src/' }])).toContain('GEN_NOT_A_FILE');
  });

  it('refuse deux fichiers au même chemin', () => {
    expect(
      codesOf([
        { ...FILE, path: 'README.md', source: 'base' },
        { ...FILE, path: 'README.md', source: 'auth' },
      ]),
    ).toContain('GEN_FILE_CONFLICT');
  });

  it('nomme les deux sources en conflit — on doit savoir qui se marche dessus', () => {
    const result = planFiles('/cible', [
      { ...FILE, path: 'README.md', source: 'base' },
      { ...FILE, path: 'README.md', source: 'auth' },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues[0]?.message).toContain('base');
      expect(result.issues[0]?.message).toContain('auth');
    }
  });

  it('refuse une source vide — un fichier sans origine est intraçable', () => {
    expect(codesOf([{ ...FILE, source: '' }])).toContain('GEN_MISSING_SOURCE');
  });

  it('rapporte tous les problèmes d’un coup', () => {
    const codes = codesOf([
      { ...FILE, path: '/absolu' },
      { ...FILE, path: '../dehors' },
      { ...FILE, path: 'src\\x' },
    ]);
    // Trois fichiers fautifs, trois problèmes — mais seulement deux codes :
    // « chemin absolu » et « remontée » sont deux causes d'une même sortie du
    // dossier cible, et l'utilisateur n'a pas à distinguer les deux.
    expect(codes).toHaveLength(3);
    expect(new Set(codes).size).toBe(2);
  });

  it('aucun message n’est vide ni ne laisse de marqueur', () => {
    const result = planFiles('/cible', [{ ...FILE, path: '../dehors' }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      for (const issue of result.issues) {
        expect(issue.message.length).toBeGreaterThan(0);
        expect(issue.message).not.toMatch(/\{[a-zA-Z]+\}/);
      }
    }
  });

  it('ne lève jamais', () => {
    for (const path of ['', '..', '/', 'C:', '\\\\', './../..', 'a/'.repeat(200)]) {
      expect(() => planFiles('/cible', [{ ...FILE, path }])).not.toThrow();
    }
  });
});

describe('describePlan — le dry-run du §6.12', () => {
  it('rend une arborescence lisible', () => {
    const result = planFiles('/cible', [
      { ...FILE, path: 'README.md' },
      { ...FILE, path: 'src/app/page.tsx' },
      { ...FILE, path: 'src/lib/db.ts' },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const description = describePlan(result.value);
      expect(description).toContain('README.md');
      expect(description).toContain('src');
      expect(description).toContain('page.tsx');
    }
  });

  it('rend une description stable', () => {
    const a = planFiles('/cible', [
      { ...FILE, path: 'b.ts' },
      { ...FILE, path: 'a.ts' },
    ]);
    const b = planFiles('/cible', [
      { ...FILE, path: 'a.ts' },
      { ...FILE, path: 'b.ts' },
    ]);
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(describePlan(a.value)).toBe(describePlan(b.value));
    }
  });

  it('annonce le nombre de fichiers', () => {
    const result = planFiles('/cible', [FILE]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(describePlan(result.value)).toContain('1 fichier');
    }
  });

  it('gère un plan vide', () => {
    const result = planFiles('/cible', []);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(describePlan(result.value).length).toBeGreaterThan(0);
    }
  });
});
