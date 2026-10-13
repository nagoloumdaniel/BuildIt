import { TARGETS } from '@buildit/manifest';
import { loadCatalogue, targetsWithoutFramework } from '@buildit/registry';
import { describe, expect, it } from 'vitest';

/** Les cibles à application que le catalogue ne sait pas encore honorer. */
function missing(): readonly string[] {
  const loaded = loadCatalogue();
  if (!loaded.ok) throw new Error('catalogue invalide');
  return targetsWithoutFramework(loaded.value.entries()).filter((target) =>
    Object.values(APP_TARGET).includes(target),
  );
}

import { APP_TARGET, offeredTargets, refusedTargets } from './targets';

/**
 * L'écran Target ne propose que ce que le catalogue peut honorer (§7.9, §7.10).
 *
 * La règle elle-même est testée contre les vraies données dans le registry
 * (`packages/registry/src/targets.test.ts`). Ici, on vérifie ce que le web en
 * fait : la liste proposée, et le refus nommé d'un brouillon hérité.
 */

describe('cibles proposées', () => {
  it('propose les cibles que le catalogue honore, dans l’ordre du manifest', () => {
    // Calculé depuis le catalogue : le jour où une fiche mobile ou ordinateur
    // arrive (Expo, Flutter, Tauri…), la cible apparaît sans toucher au code.
    expect([...offeredTargets()]).toEqual(TARGETS.filter((target) => !missing().includes(target)));
    expect(offeredTargets()).toContain('web');
  });

  it('retire exactement les cibles que le §10 décrit par une application sans framework', () => {
    // Le retrait est calculé, pas écrit : il se déduit du catalogue et de la
    // table des applications du §10. Ce test fige la conséquence, pas la règle.
    const withheld = TARGETS.filter((target) => !offeredTargets().includes(target));
    expect([...withheld]).toEqual([...missing()]);
    for (const target of withheld) {
      expect(Object.values(APP_TARGET)).toContain(target);
    }
  });

  it('ne retire pas `library`, que le §10 ne décrit par aucune application', () => {
    expect(offeredTargets()).toContain('library');
    expect(Object.values(APP_TARGET)).not.toContain('library');
  });
});

describe('refus d’un brouillon hérité', () => {
  it('nomme les cibles choisies que l’écran ne propose plus', () => {
    for (const target of missing()) {
      expect([...refusedTargets(['web', target])]).toEqual([target]);
    }
    expect([...refusedTargets(['zzz', 'api'])]).toEqual(['zzz']);
  });

  it('ne refuse rien quand toutes les cibles choisies sont proposées', () => {
    expect([...refusedTargets([...offeredTargets()])]).toEqual([]);
    expect([...refusedTargets([])]).toEqual([]);
  });
});
