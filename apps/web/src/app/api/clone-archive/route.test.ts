import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST } from './route';

/**
 * La route ne fait que lire le corps et le jeton : sans session lisible (hors
 * requête Next), un dépôt public se vérifie quand même, et un corps illisible
 * est un refus, pas une panne.
 */

function request(body: () => Promise<unknown>): NextRequest {
  return { json: body, signal: new AbortController().signal } as unknown as NextRequest;
}

describe('POST /api/clone-archive', () => {
  const previous = process.env['PF_HOSTED'];
  // Le mode hébergé lit le jeton dans un cookie de requête : hors requête
  // Next, la lecture échoue, et la route doit continuer sans jeton.
  beforeEach(() => {
    process.env['PF_HOSTED'] = '1';
  });
  afterEach(() => {
    if (previous === undefined) {
      delete process.env['PF_HOSTED'];
    } else {
      process.env['PF_HOSTED'] = previous;
    }
  });

  it('vérifie un lien sans toucher au réseau', async () => {
    const response = await POST(
      request(async () => ({ action: 'plan', link: 'octo/hello', folder: '' })),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, label: 'octo/hello', folder: 'hello' });
  });

  it('refuse un corps illisible', async () => {
    const response = await POST(
      request(async () => {
        throw new SyntaxError('pas du JSON');
      }),
    );
    expect(response.status).toBe(422);
  });
});
