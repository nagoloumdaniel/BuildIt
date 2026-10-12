import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { NextRequest } from 'next/server';
import { afterEach, describe, expect, it } from 'vitest';
import { saasManifest } from '../../create/generate/fixtures';
import { parseGenerateEvent } from '../../create/generate/stream-client';
import { POST } from './route';

/**
 * La route elle-même : ce qu'elle renvoie est bien un flux d'événements
 * serveur, lisible par le client, et le refus hébergé y arrive comme un
 * `done` lisible plutôt qu'une page d'erreur.
 */

const created: string[] = [];

afterEach(async () => {
  // biome-ignore lint/complexity/useLiteralKeys: `noPropertyAccessFromIndexSignature` impose les crochets sur `process.env`.
  delete process.env['PF_HOSTED'];
  // biome-ignore lint/complexity/useLiteralKeys: `noPropertyAccessFromIndexSignature` impose les crochets sur `process.env`.
  delete process.env['PF_WEB_WORKSPACE'];
  await Promise.all(created.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

async function temporary(prefix: string): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), prefix));
  created.push(path);
  return path;
}

function request(body: string): NextRequest {
  return new Request('http://127.0.0.1/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  }) as unknown as NextRequest;
}

/** Les événements du flux, relus par le parseur du navigateur. */
async function events(response: Response) {
  const text = await response.text();
  return text
    .split('\n\n')
    .filter((block) => block.trim() !== '')
    .map((block) => parseGenerateEvent(block));
}

describe('POST /api/generate', () => {
  it('répond en text/event-stream et écrit le projet dans le dossier choisi', async () => {
    // biome-ignore lint/complexity/useLiteralKeys: `noPropertyAccessFromIndexSignature` impose les crochets sur `process.env`.
    process.env['PF_WEB_WORKSPACE'] = await temporary('pf-route-travail-');
    const parent = await temporary('pf-route-parent-');
    const response = await POST(
      request(JSON.stringify({ manifest: saasManifest(), parent, install: false })),
    );

    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const parsed = await events(response);
    expect(parsed.at(-1)).toMatchObject({
      type: 'done',
      result: { ok: true, directory: join(parent, 'mon-projet'), installed: false },
    });
    expect(await readdir(parent)).toEqual(['mon-projet']);
  });

  it('refuse en mode hébergé, par un done lisible, sans rien écrire', async () => {
    // biome-ignore lint/complexity/useLiteralKeys: `noPropertyAccessFromIndexSignature` impose les crochets sur `process.env`.
    process.env['PF_HOSTED'] = '1';
    const parent = await temporary('pf-route-heberge-');
    const response = await POST(
      request(JSON.stringify({ manifest: saasManifest(), parent, install: true })),
    );
    const parsed = await events(response);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ type: 'done', result: { ok: false } });
    expect(await readdir(parent)).toEqual([]);
  });

  it('un corps illisible est refusé, sans lever', async () => {
    const parsed = await events(await POST(request('{pas du json')));
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ type: 'done', result: { ok: false } });
  });
});
