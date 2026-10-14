import { describe, expect, it } from 'vitest';
import {
  type ClonePhase,
  clonePhaseRank,
  createCloneProgressReader,
  isClonePhase,
  mergeCloneProgress,
  overallPercent,
  parseCloneChunk,
} from './progress';

/**
 * L'avancement d'un clone : la seule chose que l'écran a le droit d'afficher
 * est une mesure qui **ne recule pas**. Ces tests couvrent les deux moitiés de
 * cette promesse : lire la sortie de git (qui écrit en `\r`), et fusionner
 * deux mesures sans jamais revenir en arrière.
 */

describe('parseCloneChunk lire la sortie de git', () => {
  it('lit la dernière mesure d’un morceau, même réécrite en place', () => {
    const chunk = [
      "Cloning into 'mon-app'...",
      'remote: Counting objects: 12% (3/25)',
      'remote: Receiving objects: 42% (520/1234), 1.20 MiB | 3.00 MiB/s',
    ].join('\r');

    const parsed = parseCloneChunk(chunk);

    expect(parsed?.phase).toBe('receiving');
    expect(parsed?.percent).toBe(overallPercent('receiving', 42));
    expect(parsed?.detail).toContain('520/1234');
    expect(parsed?.detail).toContain('3.00 MiB/s');
  });

  it('ne bouge pas sur du bruit', () => {
    expect(parseCloneChunk('')).toBeUndefined();
    expect(parseCloneChunk("Cloning into 'mon-app'...\n")).toBeUndefined();
    expect(parseCloneChunk('warning: redirecting to https://github.com/…')).toBeUndefined();
  });

  it('ignore une phase que git nomme mais qu’on ne sait pas situer', () => {
    // « Enumerating objects » existe chez git ; il n'a pas de part dans le
    // total, donc il ne fait pas avancer la barre.
    expect(parseCloneChunk('remote: Enumerating objects: 25, done.')).toBeUndefined();
  });

  it('accepte les deux formes de comptage, avec et sans débit', () => {
    expect(parseCloneChunk('Resolving deltas: 100% (30/30), done.')?.phase).toBe('resolving');
    expect(parseCloneChunk('Checking out files: 10% (2/20)')?.phase).toBe('checkout');
    expect(parseCloneChunk('Updating files: 10% (2/20)')?.phase).toBe('checkout');
  });
});

describe('overallPercent des parts qui ne se recouvrent pas', () => {
  it('borne chaque phase entre son début et sa fin', () => {
    expect(overallPercent('starting', 0)).toBe(0);
    expect(overallPercent('starting', 100)).toBe(2);
    expect(overallPercent('receiving', 0)).toBe(24);
    expect(overallPercent('receiving', 100)).toBe(86);
    expect(overallPercent('done', 0)).toBe(100);
  });

  it('ne dépasse jamais 100 et ne descend jamais sous le début', () => {
    expect(overallPercent('receiving', 500)).toBe(overallPercent('receiving', 100));
    expect(overallPercent('receiving', -20)).toBe(overallPercent('receiving', 0));
  });

  it('croît d’une phase à la suivante', () => {
    const [start, ...rest] = [
      'starting',
      'counting',
      'compressing',
      'receiving',
      'resolving',
      'checkout',
      'installing',
      'done',
    ] as const;

    let previous: ClonePhase = start;
    for (const current of rest) {
      expect(overallPercent(current, 0)).toBeGreaterThanOrEqual(overallPercent(previous, 100));
      previous = current;
    }
  });
});

describe('createCloneProgressReader la barre ne redescend jamais', () => {
  it('garde la phase la plus avancée quand git réaffiche une phase antérieure', () => {
    const read = createCloneProgressReader();

    const received = read('remote: Receiving objects: 80% (800/1000), 4.00 MiB | 2.00 MiB/s');
    const late = read('remote: Counting objects: 10% (2/20)');

    expect(received?.phase).toBe('receiving');
    expect(late?.phase).toBe('receiving');
    expect(late?.percent).toBe(received?.percent);
    expect(late?.detail).toContain('800/1000');
  });

  it('avance quand la mesure suivante est plus loin', () => {
    const read = createCloneProgressReader();

    const first = read('remote: Receiving objects: 20% (200/1000)');
    const second = read('remote: Receiving objects: 60% (600/1000)');

    expect(second?.percent).toBeGreaterThan(first?.percent ?? 0);
    expect(second?.detail).toContain('600/1000');
  });

  it('ne rend rien pour un morceau sans mesure', () => {
    const read = createCloneProgressReader();
    expect(read("Cloning into 'mon-app'...")).toBeUndefined();
  });

  it('passe à l’installation annoncée par la route', () => {
    const read = createCloneProgressReader();
    const received = read('remote: Receiving objects: 90% (900/1000)');

    const installed = mergeCloneProgress(received ?? null, {
      phase: 'installing',
      percent: overallPercent('installing', 0),
    });

    expect(installed.phase).toBe('installing');
  });
});

describe('mergeCloneProgress', () => {
  it('prend la première mesure telle quelle', () => {
    expect(mergeCloneProgress(null, { phase: 'counting', percent: 5 })).toEqual({
      phase: 'counting',
      percent: 5,
    });
  });

  it('ignore en bloc une phase de rang inférieur', () => {
    const previous = { phase: 'resolving' as const, percent: 90, detail: '30/30' };
    expect(mergeCloneProgress(previous, { phase: 'compressing', percent: 10 })).toBe(previous);
  });

  it('garde le pourcentage le plus haut sans perdre la phase la plus avancée', () => {
    const merged = mergeCloneProgress(
      { phase: 'receiving', percent: 80, detail: '800/1000' },
      { phase: 'checkout', percent: 20, detail: '2/10' },
    );

    expect(merged).toEqual({ phase: 'checkout', percent: 80, detail: '2/10' });
  });
});

describe('clonePhaseRank et isClonePhase', () => {
  it('ordonne les phases du début à la fin', () => {
    expect(clonePhaseRank('starting')).toBeLessThan(clonePhaseRank('counting'));
    expect(clonePhaseRank('receiving')).toBeLessThan(clonePhaseRank('resolving'));
    expect(clonePhaseRank('installing')).toBeLessThan(clonePhaseRank('done'));
  });

  it('ne reconnaît que les phases du contrat', () => {
    expect(isClonePhase('receiving')).toBe(true);
    expect(isClonePhase('done')).toBe(true);
    expect(isClonePhase('Enumerating objects')).toBe(false);
    expect(isClonePhase(42)).toBe(false);
    expect(isClonePhase(undefined)).toBe(false);
  });
});
