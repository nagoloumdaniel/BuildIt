import { describe, expect, it } from 'vitest';
import {
  browserProjectStorage,
  forgetAllProjects,
  forgetProject,
  formatBytes,
  formatDate,
  loadProjects,
  PROJECTS_STORAGE_KEY,
  type ProjectStorage,
  projectId,
  recentProjects,
  rememberProject,
  type StoredProject,
} from './projects';

/**
 * La liste des projets générés.
 *
 * Ce qui est éprouvé ici n'est pas « ça écrit, ça relit » mais ce qui casse en
 * vrai : une entrée corrompue dans `localStorage`, un stockage qui lève, une
 * régénération du même projet, un quota plein.
 */

function fakeStorage(initial?: string): ProjectStorage & { value: string | null } {
  return {
    value: initial ?? null,
    read(key) {
      return key === PROJECTS_STORAGE_KEY ? this.value : null;
    },
    write(key, next) {
      if (key === PROJECTS_STORAGE_KEY) {
        this.value = next;
      }
    },
  };
}

function project(patch: Partial<StoredProject> = {}): StoredProject {
  return {
    id: 'demo-1',
    name: 'demo',
    directory: 'C:\\projets\\demo',
    fileCount: 12,
    bytes: 2048,
    generatedAt: '2026-10-01T10:00:00.000Z',
    technologies: ['next', 'tailwind'],
    ...patch,
  };
}

describe('loadProjects', () => {
  it('rend une liste vide quand rien n’a jamais été écrit', () => {
    expect(loadProjects(fakeStorage())).toEqual([]);
  });

  it('rend une liste vide plutôt que de lever sur du JSON cassé', () => {
    expect(loadProjects(fakeStorage('{ pas du JSON'))).toEqual([]);
  });

  it('rend une liste vide quand le contenu n’est pas un tableau', () => {
    expect(loadProjects(fakeStorage('{"name":"demo"}'))).toEqual([]);
  });

  it('écarte les entrées sans les trois champs qui identifient un projet', () => {
    const storage = fakeStorage(
      JSON.stringify([project(), { name: 'sans id' }, null, 'texte', 42]),
    );
    expect(loadProjects(storage).map((item) => item.name)).toEqual(['demo']);
  });

  it('complète les champs secondaires absents plutôt que d’écarter l’entrée', () => {
    const storage = fakeStorage(
      JSON.stringify([{ id: 'a', name: 'demo', generatedAt: '2026-10-01T10:00:00.000Z' }]),
    );
    expect(loadProjects(storage)[0]).toEqual({
      id: 'a',
      name: 'demo',
      directory: '',
      fileCount: 0,
      bytes: 0,
      generatedAt: '2026-10-01T10:00:00.000Z',
      technologies: [],
    });
  });

  it('ne garde des technologies que les chaînes', () => {
    const storage = fakeStorage(
      JSON.stringify([{ ...project(), technologies: ['next', 7, null, 'vite'] }]),
    );
    expect(loadProjects(storage)[0]?.technologies).toEqual(['next', 'vite']);
  });
});

describe('rememberProject', () => {
  it('ajoute en tête : le plus récent se lit en premier', () => {
    const storage = fakeStorage();
    rememberProject(storage, project({ id: 'a', name: 'premier' }));
    const list = rememberProject(storage, project({ id: 'b', name: 'second' }));
    expect(list.map((item) => item.name)).toEqual(['second', 'premier']);
  });

  it('remplace l’entrée du même projet régénéré, au lieu de l’empiler', () => {
    const storage = fakeStorage();
    rememberProject(storage, project({ id: 'a', fileCount: 3 }));
    const list = rememberProject(storage, project({ id: 'b', fileCount: 42 }));
    expect(list).toHaveLength(1);
    expect(list[0]?.fileCount).toBe(42);
  });

  it('garde deux projets du même nom dans des dossiers différents', () => {
    const storage = fakeStorage();
    rememberProject(storage, project({ id: 'a', directory: 'C:\\un' }));
    const list = rememberProject(storage, project({ id: 'b', directory: 'C:\\deux' }));
    expect(list).toHaveLength(2);
  });

  it('plafonne la liste : une liste sans fin n’est pas consultée', () => {
    const storage = fakeStorage();
    for (let index = 0; index < 60; index += 1) {
      rememberProject(storage, project({ id: `p${index}`, name: `projet-${index}` }));
    }
    expect(loadProjects(storage)).toHaveLength(50);
    expect(loadProjects(storage)[0]?.name).toBe('projet-59');
  });
});

describe('forgetProject', () => {
  it('retire l’entrée visée et garde les autres', () => {
    const storage = fakeStorage(
      JSON.stringify([project({ id: 'a' }), project({ id: 'b', name: 'autre' })]),
    );
    expect(forgetProject(storage, 'a').map((item) => item.id)).toEqual(['b']);
  });

  it('ne change rien quand l’identifiant est inconnu', () => {
    const storage = fakeStorage(JSON.stringify([project({ id: 'a' })]));
    expect(forgetProject(storage, 'inexistant')).toHaveLength(1);
  });

  it('vide la liste entière', () => {
    const storage = fakeStorage(JSON.stringify([project({ id: 'a' }), project({ id: 'b' })]));
    expect(forgetAllProjects(storage)).toEqual([]);
    expect(loadProjects(storage)).toEqual([]);
  });
});

describe('recentProjects', () => {
  it('rend les deux premiers par défaut — ce que montre le tableau de bord', () => {
    const list = [project({ id: 'a' }), project({ id: 'b' }), project({ id: 'c' })];
    expect(recentProjects(list).map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('rend tout ce qu’il y a quand il y en a moins que demandé', () => {
    expect(recentProjects([project()], 5)).toHaveLength(1);
  });
});

describe('projectId', () => {
  it('reprend le nom et l’horodatage : lisible et sans collision', () => {
    expect(projectId('demo', new Date(1_700_000_000_000))).toBe('demo-1700000000000');
  });
});

describe('formatBytes', () => {
  it('rend les octets sans décimale', () => {
    expect(formatBytes(512)).toBe('512 o');
  });

  it('rend zéro et le négatif comme zéro, sans « NaN »', () => {
    expect(formatBytes(0)).toBe('0 o');
    expect(formatBytes(-5)).toBe('0 o');
    expect(formatBytes(Number.NaN)).toBe('0 o');
  });

  it('monte d’unité et sépare par une virgule en français', () => {
    expect(formatBytes(1536)).toBe('1,5 ko');
    expect(formatBytes(1024 * 1024 * 3)).toBe('3,0 Mo');
  });

  it('utilise le point et les unités anglaises en anglais', () => {
    expect(formatBytes(1536, 'en')).toBe('1.5 kB');
    expect(formatBytes(512, 'en')).toBe('512 B');
  });

  it('plafonne à la plus grande unité connue', () => {
    expect(formatBytes(1024 ** 5)).toContain('Go');
  });
});

describe('formatDate', () => {
  it('rend la date lisible dans la langue demandée', () => {
    expect(formatDate('2026-10-01T10:00:00.000Z', 'fr')).toContain('2026');
    expect(formatDate('2026-10-01T10:00:00.000Z', 'en')).toContain('2026');
  });

  it('rend la chaîne telle quelle quand ce n’est pas une date', () => {
    expect(formatDate('pas une date')).toBe('pas une date');
  });
});

describe('browserProjectStorage', () => {
  /**
   * Un `window` minimal, posé puis retiré autour de l'assertion.
   *
   * `Object.defineProperty` plutôt qu'une affectation : la propriété globale
   * `window` n'est pas déclarée dans l'environnement Node de Vitest, on la crée
   * donc, et on remet l'état exact d'avant (souvent : rien). Un `@ts-expect-error`
   * sur l'affectation ne suffisait pas — il masquait aussi les erreurs réelles
   * du faux objet, ce que le compilateur signalait à juste titre.
   */
  function withWindow(windowValue: unknown, run: () => void): void {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'window', { configurable: true, value: windowValue });
    try {
      run();
    } finally {
      if (descriptor === undefined) {
        delete (globalThis as { window?: unknown }).window;
      } else {
        Object.defineProperty(globalThis, 'window', descriptor);
      }
    }
  }

  it('rend null et avale l’erreur quand le stockage est refusé', () => {
    withWindow(
      {
        localStorage: {
          getItem() {
            throw new Error('refusé');
          },
          setItem() {
            throw new Error('refusé');
          },
        },
      },
      () => {
        const storage = browserProjectStorage();
        expect(storage.read(PROJECTS_STORAGE_KEY)).toBeNull();
        expect(() => storage.write(PROJECTS_STORAGE_KEY, '[]')).not.toThrow();
      },
    );
  });

  it('lit et écrit quand le stockage répond', () => {
    const memory = new Map<string, string>();
    withWindow(
      {
        localStorage: {
          getItem: (key: string) => memory.get(key) ?? null,
          setItem: (key: string, value: string) => {
            memory.set(key, value);
          },
        },
      },
      () => {
        const storage = browserProjectStorage();
        storage.write(PROJECTS_STORAGE_KEY, '[]');
        expect(storage.read(PROJECTS_STORAGE_KEY)).toBe('[]');
      },
    );
  });

  it('ne laisse pas de `window` derrière lui', () => {
    // La preuve que la sonde des deux tests précédents ne fuit pas dans les
    // suivants : un faux navigateur oublié ferait passer un test pour un autre.
    expect(Object.getOwnPropertyDescriptor(globalThis, 'window')).toBeUndefined();
  });
});
