import { describe, expect, it } from 'vitest';
import { parseManifest } from './parse.js';
import type { Manifest } from './schema/manifest.js';
import { serializeManifest } from './serialize.js';

const FULL: Manifest = {
  manifestVersion: 1,
  name: 'my-project',
  targets: ['web', 'mobile'],
  architecture: 'monorepo',
  apps: ['web', 'mobile', 'api', 'admin'],
  frontend: { framework: 'next', language: 'typescript', styling: 'tailwind' },
  mobile: { framework: 'expo', language: 'typescript' },
  backend: { framework: 'nestjs' },
  database: { engine: 'postgresql', orm: 'drizzle' },
  auth: { provider: 'better-auth' },
  services: ['redis', 'storage', 'email', 'payments'],
  quality: ['biome', 'vitest', 'playwright'],
  infra: ['docker', 'github-actions'],
  shareLink: { enabled: true, readOnly: true },
};

const MINIMAL: Manifest = {
  manifestVersion: 1,
  name: 'quai3',
  targets: ['web'],
  architecture: 'single-app',
};

describe('serializeManifest — forme', () => {
  it('produit du JSON valide', () => {
    expect(() => JSON.parse(serializeManifest(FULL))).not.toThrow();
  });

  it('se termine par un saut de ligne — les fichiers texte se terminent par un saut de ligne', () => {
    expect(serializeManifest(FULL).endsWith('\n')).toBe(true);
  });

  it('indente de deux espaces', () => {
    expect(serializeManifest(MINIMAL)).toContain('\n  "name"');
  });

  it('omet les champs absents plutôt que d’écrire null', () => {
    const output = serializeManifest(MINIMAL);
    expect(output).not.toContain('null');
    expect(output).not.toContain('frontend');
  });
});

describe('serializeManifest — ordre canonique des clés', () => {
  it('suit l’ordre déclaré, pas l’ordre d’insertion', () => {
    const shuffled: Manifest = {
      shareLink: { enabled: true, readOnly: true },
      architecture: 'monorepo',
      name: 'my-project',
      targets: ['web', 'mobile'],
      manifestVersion: 1,
    };
    const keys = Object.keys(JSON.parse(serializeManifest(shuffled)) as object);
    expect(keys).toEqual(['manifestVersion', 'name', 'targets', 'architecture', 'shareLink']);
  });

  it('ordonne aussi les clés des objets imbriqués', () => {
    const manifest: Manifest = {
      ...MINIMAL,
      frontend: { ui: 'shadcn', framework: 'next', styling: 'tailwind', language: 'typescript' },
    };
    const parsed = JSON.parse(serializeManifest(manifest)) as { frontend: object };
    expect(Object.keys(parsed.frontend)).toEqual(['framework', 'language', 'styling', 'ui']);
  });
});

describe('serializeManifest — tableaux triés', () => {
  it('trie les ensembles de slugs', () => {
    const parsed = JSON.parse(serializeManifest(FULL)) as { services: string[] };
    expect(parsed.services).toEqual(['email', 'payments', 'redis', 'storage']);
  });

  it('trie aussi les cibles', () => {
    const manifest: Manifest = { ...MINIMAL, targets: ['mobile', 'web', 'api'] };
    const parsed = JSON.parse(serializeManifest(manifest)) as { targets: string[] };
    expect(parsed.targets).toEqual(['api', 'mobile', 'web']);
  });
});

describe('serializeManifest — stabilité', () => {
  it('deux manifests au contenu identique produisent exactement la même chaîne', () => {
    const a: Manifest = {
      manifestVersion: 1,
      name: 'x',
      targets: ['web', 'mobile'],
      architecture: 'monorepo',
      services: ['redis', 'email'],
    };
    const b: Manifest = {
      services: ['email', 'redis'],
      architecture: 'monorepo',
      targets: ['mobile', 'web'],
      name: 'x',
      manifestVersion: 1,
    };
    expect(serializeManifest(a)).toBe(serializeManifest(b));
  });

  it('est idempotente — sérialiser deux fois donne la même chaîne', () => {
    const once = serializeManifest(FULL);
    const reparsed = parseManifest(JSON.parse(once));
    expect(reparsed.ok).toBe(true);
    if (reparsed.ok) {
      expect(serializeManifest(reparsed.value)).toBe(once);
    }
  });
});

describe('aller-retour', () => {
  it('parse → serialize → parse rend le même manifest', () => {
    const first = parseManifest(FULL);
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    const second = parseManifest(JSON.parse(serializeManifest(first.value)));
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.value).toEqual(first.value);
    }
  });

  it('la sortie sérialisée est toujours un manifest valide', () => {
    for (const manifest of [FULL, MINIMAL]) {
      expect(parseManifest(JSON.parse(serializeManifest(manifest))).ok).toBe(true);
    }
  });
});
