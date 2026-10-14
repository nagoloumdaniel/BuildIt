import type { Category } from '@buildit/registry';
import { describe, expect, it } from 'vitest';
import { freshDraft } from './draft';
import { createSessionStore, toggle, toggleExclusive } from './session';

/** Un `Storage` en mémoire : le navigateur n'est pas disponible sous Vitest. */
function fakeStorage(values: Record<string, string> = {}) {
  const map = new Map(Object.entries(values));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

describe('createSessionStore', () => {
  it('part du brouillon persisté quand il existe', () => {
    const storage = fakeStorage();
    storage.setItem('pf-draft', JSON.stringify({ ...freshDraft(), name: 'repris' }));
    const session = createSessionStore(storage as unknown as Storage);
    expect(session.get().name).toBe('repris');
  });

  it('sans storage, part d’un brouillon frais', () => {
    expect(createSessionStore(null).get()).toEqual(freshDraft());
  });

  it('garde le snapshot serveur stable, quoi qu’il arrive à l’état courant', () => {
    // C'est le contrat de l'hydratation : React relit le snapshot serveur pour
    // comparer le HTML au premier rendu client. S'il changeait parce qu'un
    // brouillon a été relu ou modifié entre-temps le composant qui s'hydrate
    // rendrait une sélection absente du HTML, et React signalerait une
    // divergence (`#418`), ce qui arrivait sur les écrans du parcours.
    const storage = fakeStorage();
    storage.setItem(
      'pf-draft',
      JSON.stringify({ ...freshDraft(), name: 'repris', targets: ['web'] }),
    );
    const session = createSessionStore(null);

    const server = session.getServer();
    expect(server).toEqual(freshDraft());

    session.update((draft) => ({ ...draft, name: 'modifié' }));
    session.attach(storage as unknown as Storage);

    expect(session.getServer()).toBe(server);
    expect(session.getServer().name).toBe('');
    // Le branchement reprend le brouillon persisté sans écraser ce que
    // l'application a changé en mémoire entre-temps.
    expect(session.get().name).toBe('modifié');
    expect(session.get().targets).toEqual(['web']);
  });

  it('chaque changement est persisté : fermer l’onglet ne perd rien', () => {
    const storage = fakeStorage() as unknown as Storage;
    const session = createSessionStore(storage);
    session.update((draft) => ({ ...draft, name: 'mon-projet' }));
    const reread = createSessionStore(storage);
    expect(reread.get().name).toBe('mon-projet');
  });

  it('le changement voit l’état courant, pas une copie figée', () => {
    const session = createSessionStore(null, { ...freshDraft(), name: 'avant' });
    session.update((draft) => ({ ...draft, name: `${draft.name}-apres` }));
    expect(session.get().name).toBe('avant-apres');
  });

  it('notifie les abonnés, et seulement ceux qui sont abonnés', () => {
    const session = createSessionStore(null);
    let abonne = 0;
    let retire = 0;
    const unsubscribe = session.subscribe(() => {
      abonne += 1;
    });
    const retireFn = session.subscribe(() => {
      retire += 1;
    });
    session.update((draft) => ({ ...draft, name: 'a' }));
    unsubscribe();
    session.update((draft) => ({ ...draft, name: 'b' }));

    expect(abonne).toBe(1);
    expect(retire).toBe(2);
    // Se désabonner deux fois ne lève pas et ne double rien.
    expect(() => unsubscribe()).not.toThrow();
    retireFn();
  });

  it('reset oublie le brouillon du navigateur, pas seulement la mémoire', () => {
    const storage = fakeStorage();
    const session = createSessionStore(storage as unknown as Storage);
    session.update((draft) => ({ ...draft, name: 'a-oublier' }));
    session.reset();
    expect(session.get()).toEqual(freshDraft());
    expect(storage.getItem('pf-draft')).toBeNull();
  });

  it('la référence ne change pas tant que rien ne change', () => {
    const session = createSessionStore(null);
    expect(session.get()).toBe(session.get());
  });

  it('attach branche le stockage tardivement et relit le brouillon', () => {
    // Ce que fait le provider : rendu serveur sans stockage, puis branchement
    // du `localStorage` dans un effet, une fois l'hydratation faite.
    const storage = fakeStorage();
    storage.setItem('pf-draft', JSON.stringify({ ...freshDraft(), name: 'persiste' }));
    const session = createSessionStore(null);
    expect(session.get().name).toBe('');

    let notifie = 0;
    session.subscribe(() => {
      notifie += 1;
    });
    session.attach(storage as unknown as Storage);

    expect(session.get().name).toBe('persiste');
    expect(notifie).toBe(1);
  });

  it('un reset avant le branchement oublie le brouillon stocké (« Nouveau projet »)', () => {
    const storage = fakeStorage();
    storage.setItem('pf-draft', JSON.stringify({ ...freshDraft(), name: 'ancien' }));
    const session = createSessionStore(null);
    session.reset();
    session.attach(storage as unknown as Storage);

    expect(session.get().name).toBe('');
    expect(JSON.parse(storage.getItem('pf-draft') ?? '{}').name).toBe('');
    // La suite est persistée normalement.
    session.update((draft) => ({ ...draft, name: 'neuf' }));
    expect(JSON.parse(storage.getItem('pf-draft') ?? '{}').name).toBe('neuf');
  });

  it('attach à un stockage vide repart d’un brouillon frais', () => {
    const session = createSessionStore(null, { ...freshDraft(), name: 'à-oublier' });
    session.attach(fakeStorage() as unknown as Storage);
    expect(session.get()).toEqual(freshDraft());
  });

  it('attach à un brouillon identique ne notifie pas : rien n’a changé', () => {
    // Le cas mesuré du §8bis : le premier rendu part sans stockage (donc d'un
    // brouillon frais), le `localStorage` est branché, et le brouillon relu est
    // le même. Notifier ferait rejouer l'effet qui charge le catalogue deux
    // chargements identiques par visite.
    const session = createSessionStore(null);
    const avant = session.get();
    let notifie = 0;
    session.subscribe(() => {
      notifie += 1;
    });
    session.attach(fakeStorage() as unknown as Storage);
    expect(notifie).toBe(0);
    expect(session.get()).toBe(avant);
  });

  it('attach annonce un changement réel, même sur un champ qu’un écran ne lit pas', () => {
    // Le garde-fou inverse : ne pas notifier serait un bug si le brouillon relu
    // différait la reprise du brouillon repose sur cette notification.
    const storage = fakeStorage();
    storage.setItem('pf-draft', JSON.stringify({ ...freshDraft(), mode: 'expert' }));
    const session = createSessionStore(null);
    let notifie = 0;
    session.subscribe(() => {
      notifie += 1;
    });
    session.attach(storage as unknown as Storage);
    expect(notifie).toBe(1);
    expect(session.get().mode).toBe('expert');
  });

  it('attach compare ce qui est persisté : la résolution en mémoire ne compte pas', () => {
    // `resolution` est recalculée par le moteur et jamais persistée : sa
    // présence ne doit pas faire passer pour différent un brouillon relu
    // identique, sinon le doublon revient après chaque résolution.
    const session = createSessionStore(null);
    session.update((draft) => ({
      ...draft,
      resolution: { status: 'certified', issues: [] },
    }));
    let notifie = 0;
    session.subscribe(() => {
      notifie += 1;
    });
    session.attach(fakeStorage() as unknown as Storage);
    expect(notifie).toBe(0);
  });

  it('attach ne défait pas l’étape écrite en mémoire avant le branchement', () => {
    // Le vrai cas du §8bis : `StepShell` écrit l'étape de l'URL dans un effet,
    // et les effets des enfants passent avant celui du provider qui branche le
    // stockage. Le brouillon persisté porte l'étape **quittée** : le relire ne
    // doit ni la ramener en arrière, ni faire rejouer les effets de l'écran.
    const storage = fakeStorage();
    storage.setItem('pf-draft', JSON.stringify({ ...freshDraft(), step: 'blueprint' }));
    const session = createSessionStore(null);
    session.update((draft) => ({ ...draft, step: 'stack' }));
    const avant = session.get();
    let notifie = 0;
    session.subscribe(() => {
      notifie += 1;
    });
    session.attach(storage as unknown as Storage);
    expect(session.get().step).toBe('stack');
    expect(notifie).toBe(0);
    expect(session.get()).toBe(avant);
  });

  it('attach garde la référence des tableaux dont la valeur ne change pas', () => {
    // La reprise est réelle (le nom diffère), mais `targets` a la même valeur :
    // il doit garder sa référence, sinon la sélection mémoïsée de l'écran
    // change d'identité et le catalogue est rechargé pour rien.
    const storage = fakeStorage();
    storage.setItem('pf-draft', JSON.stringify({ ...freshDraft(), name: 'repris' }));
    const session = createSessionStore(null);
    session.update((draft) => ({ ...draft, step: 'stack' }));
    const avant = session.get();
    let notifie = 0;
    session.subscribe(() => {
      notifie += 1;
    });
    session.attach(storage as unknown as Storage);
    expect(notifie).toBe(1);
    expect(session.get().name).toBe('repris');
    expect(session.get().step).toBe('stack');
    expect(session.get().targets).toBe(avant.targets);
  });
});

describe('toggle', () => {
  it('ajoute ce qui manque, retire ce qui est là, sans muter la liste', () => {
    const initial = ['web'];
    expect(toggle(initial, 'mobile')).toEqual(['web', 'mobile']);
    expect(toggle(initial, 'web')).toEqual([]);
    expect(initial).toEqual(['web']);
  });
});

describe('toggleExclusive une catégorie exclusive remplace, jamais ne cumule', () => {
  /**
   * Bug rapporté : choisir TypeScript puis JavaScript (ou l'inverse) pouvait
   * laisser les deux dans la sélection le moteur ne refusait la paire qu'au
   * Blueprint, écrans plus loin. `toggleExclusive` décide dans `current` seul,
   * sans dépendre d'un aller-retour serveur qui aurait grisé l'un des deux.
   */
  const categoryOf = new Map<string, Category>([
    ['typescript', 'language'],
    ['javascript', 'language'],
    ['next', 'frontend'],
    ['react', 'frontend'],
    ['vitest', 'testing'],
    ['playwright', 'testing'],
    ['python', 'language'],
    ['postgresql', 'database'],
    ['mysql', 'database'],
  ]);

  it('choisir une seconde base retire la première', () => {
    expect(toggleExclusive(['postgresql'], 'mysql', 'database', categoryOf)).toEqual(['mysql']);
  });

  it('un second langage s’ajoute : TypeScript au front, Python à l’API', () => {
    expect(toggleExclusive(['typescript'], 'python', 'language', categoryOf)).toEqual([
      'typescript',
      'python',
    ]);
  });

  it('choisir un second framework frontend retire le premier', () => {
    expect(toggleExclusive(['react'], 'next', 'frontend', categoryOf)).toEqual(['next']);
  });

  it('une catégorie cumulative (testing) ajoute sans rien retirer', () => {
    expect(toggleExclusive(['vitest'], 'playwright', 'testing', categoryOf)).toEqual([
      'vitest',
      'playwright',
    ]);
  });

  it('recliquer l’option déjà choisie la retire, catégorie exclusive ou non', () => {
    expect(toggleExclusive(['typescript'], 'typescript', 'language', categoryOf)).toEqual([]);
    expect(toggleExclusive(['vitest'], 'vitest', 'testing', categoryOf)).toEqual([]);
  });

  it('ne touche jamais une sélection d’une autre catégorie', () => {
    expect(toggleExclusive(['react', 'vitest'], 'next', 'frontend', categoryOf)).toEqual([
      'vitest',
      'next',
    ]);
  });

  it('première sélection d’une catégorie exclusive : rien à remplacer', () => {
    expect(toggleExclusive([], 'typescript', 'language', categoryOf)).toEqual(['typescript']);
  });

  /**
   * Le cas rapporté : projet visant web, mobile, API et bibliothèque — il était
   * impossible de garder Next.js **et** Expo. Les plateformes des fiches
   * tranchent, exactement comme dans le moteur (`canCoexist`).
   */
  describe('avec les plateformes des fiches', () => {
    const targetsOf = new Map<string, readonly string[]>([
      ['next', ['web']],
      ['expo', ['mobile']],
      ['react', ['web']],
      ['electron', ['desktop']],
      ['universal', ['web', 'mobile']],
      ['hono', ['api']],
      ['express', ['api']],
    ]);
    // `toggleExclusive` lit la catégorie des fiches **déjà choisies** : les
    // nouvelles venues doivent donc y figurer aussi.
    const richer = new Map<string, Category>([
      ...categoryOf,
      ['expo', 'frontend'],
      ['electron', 'frontend'],
      ['universal', 'frontend'],
      ['hono', 'backend'],
      ['express', 'backend'],
    ]);

    it('deux frameworks de plateformes différentes cohabitent', () => {
      expect(toggleExclusive(['next'], 'expo', 'frontend', richer, targetsOf)).toEqual([
        'next',
        'expo',
      ]);

      // Et dans l'autre sens, puis sur trois plateformes.
      expect(toggleExclusive(['next', 'expo'], 'electron', 'frontend', richer, targetsOf)).toEqual([
        'next',
        'expo',
        'electron',
      ]);
    });

    it('deux frameworks de la même plateforme se remplacent toujours', () => {
      expect(toggleExclusive(['next'], 'react', 'frontend', richer, targetsOf)).toEqual(['react']);
      // Un framework qui couvre web + mobile reste en concurrence avec Next.
      expect(toggleExclusive(['next'], 'universal', 'frontend', richer, targetsOf)).toEqual([
        'universal',
      ]);
    });

    it('deux backends se remplacent : ils visent la même plateforme', () => {
      expect(toggleExclusive(['hono'], 'express', 'backend', richer, targetsOf)).toEqual([
        'express',
      ]);
    });

    it('sans plateformes connues, on retombe sur le remplacement', () => {
      expect(toggleExclusive(['postgresql'], 'mysql', 'database', categoryOf, new Map())).toEqual([
        'mysql',
      ]);
    });
  });
});
