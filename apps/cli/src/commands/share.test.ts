import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type Manifest, serializeManifest } from '@buildit/manifest';
import { describe, expect, it } from 'vitest';
import { HELP, run } from '../cli.js';
import { fakeIo } from '../fake-io.js';
import { PENDING } from './pending.js';
import { shareBase, shareLink, sharePayload } from './share.js';

/**
 * `pf share` (§20, Phase 9).
 *
 * Contrat de format : la charge est `base64url(serializeManifest(manifest))`,
 * **le même littéral** que celui vérifié par l'UI
 * (`apps/web/src/app/share/codec.test.ts`). Les deux implémentations sont
 * séparées le CLI n'empaquette pas l'application web et ce littéral commun
 * est ce qui les empêche de diverger.
 */

const MANIFEST: Manifest = {
  manifestVersion: 1,
  name: 'demo',
  targets: ['web'],
  architecture: 'single-app',
  frontend: { framework: 'next', language: 'typescript' },
};

/** Égal à `encodeSharePayload(MANIFEST)` côté UI : contrat de format. */
const GOLDEN_PAYLOAD =
  'ewogICJtYW5pZmVzdFZlcnNpb24iOiAxLAogICJuYW1lIjogImRlbW8iLAogICJ0YXJnZXRzIjogWwogICAgIndlYiIKICBdLAogICJhcmNoaXRlY3R1cmUiOiAic2luZ2xlLWFwcCIsCiAgImZyb250ZW5kIjogewogICAgImZyYW1ld29yayI6ICJuZXh0IiwKICAgICJsYW5ndWFnZSI6ICJ0eXBlc2NyaXB0IgogIH0KfQo';

const temp = (): Promise<string> => mkdtemp(join(tmpdir(), 'pf-share-'));

async function projectWith(content: string, name = 'm.json'): Promise<string> {
  const cwd = await temp();
  await writeFile(join(cwd, name), content);
  return cwd;
}

function payloadOf(link: string): string {
  return link.slice(link.indexOf('#') + 1);
}

describe('sharePayload le format, tenu des deux côtés', () => {
  it('produit le littéral de référence, partagé avec l’UI', () => {
    expect(sharePayload(MANIFEST)).toBe(GOLDEN_PAYLOAD);
  });

  it('vaut base64url(serializeManifest(manifest)), sans padding', () => {
    expect(sharePayload(MANIFEST)).toBe(
      Buffer.from(serializeManifest(MANIFEST), 'utf8').toString('base64url'),
    );
    expect(sharePayload(MANIFEST)).not.toContain('=');
  });
});

describe('shareLink origine + fragment', () => {
  it('compose l’URL de la page de partage', () => {
    expect(shareLink(MANIFEST, 'http://127.0.0.1:4173')).toBe(
      `http://127.0.0.1:4173/share#${GOLDEN_PAYLOAD}`,
    );
    expect(shareLink(MANIFEST, 'https://exemple.fr/')).toBe(
      `https://exemple.fr/share#${GOLDEN_PAYLOAD}`,
    );
  });
});

describe('shareBase l’origine du configurateur', () => {
  it('vaut le serveur local par défaut', () => {
    expect(shareBase(undefined)).toBe('http://127.0.0.1:4173');
  });

  it('accepte une origine http ou https, sans chemin ni requête', () => {
    expect(shareBase('http://127.0.0.1:5000')).toBe('http://127.0.0.1:5000');
    expect(shareBase(' https://exemple.fr/ ')).toBe('https://exemple.fr');
  });

  it('refuse le reste, plutôt que d’imprimer un lien mort', () => {
    for (const raw of [
      'exemple.fr',
      'ftp://exemple.fr',
      'https://exemple.fr/pf',
      'https://x.fr?a=1',
      'https://x.fr#a',
    ]) {
      expect(shareBase(raw)).toBeUndefined();
    }
  });
});

describe('pf share', () => {
  it('--help', async () => {
    const io = fakeIo();
    expect(await run(['share', '-h'], io)).toBe(0);
    expect(io.text().out).toContain('--url');
  });

  it('n’est plus une commande à venir', () => {
    expect(Object.keys(PENDING)).not.toContain('share');
    expect(HELP).toContain('share <manifest.json>');
    expect(HELP).not.toContain('share,');
  });

  it('imprime le lien, et rien d’autre', async () => {
    const cwd = await projectWith(serializeManifest(MANIFEST));
    const io = fakeIo({ cwd });

    expect(await run(['share', 'm.json'], io)).toBe(0);

    // Une seule ligne, exactement : ce que la commande a le droit de dire.
    expect(io.stdout).toEqual([`http://127.0.0.1:4173/share#${GOLDEN_PAYLOAD}`]);
    expect(io.stderr).toEqual([]);
    // Et la charge redonne le manifest canonique, tel quel.
    expect(Buffer.from(payloadOf(io.stdout[0] ?? ''), 'base64url').toString('utf8')).toBe(
      serializeManifest(MANIFEST),
    );
  });

  it('suit --url', async () => {
    const cwd = await projectWith(serializeManifest(MANIFEST));
    const io = fakeIo({ cwd });

    expect(await run(['share', 'm.json', '--url', 'http://127.0.0.1:5000'], io)).toBe(0);
    expect(io.stdout[0]).toBe(`http://127.0.0.1:5000/share#${GOLDEN_PAYLOAD}`);
  });

  it('refuse une origine invalide sans imprimer de lien', async () => {
    const cwd = await projectWith(serializeManifest(MANIFEST));
    const io = fakeIo({ cwd });

    expect(await run(['share', 'm.json', '--url', 'exemple.fr'], io)).toBe(2);
    expect(io.stdout).toEqual([]);
    expect(io.text().err).toContain('Origine invalide');
  });

  it('exige exactement un manifest', async () => {
    expect(await run(['share'], fakeIo())).toBe(2);
    expect(await run(['share', 'a.json', 'b.json'], fakeIo())).toBe(2);
  });

  it('un fichier absent ne produit aucun lien', async () => {
    const io = fakeIo({ cwd: await temp() });
    expect(await run(['share', 'absent.json'], io)).toBe(1);
    expect(io.stdout).toEqual([]);
  });

  it('un manifest refusé ne produit aucun lien', async () => {
    const cwd = await projectWith('{"name":"demo"}');
    const io = fakeIo({ cwd });

    expect(await run(['share', 'm.json'], io)).toBe(1);
    expect(io.stdout).toEqual([]);
    expect(io.text().err).not.toContain('share#');
  });
});
