import type { NextRequest } from 'next/server';
import { afterEach, describe, expect, it } from 'vitest';
import { POST } from './route';

/**
 * `/api/clone` en mode hébergé : pas de `git` dans une fonction serverless, et
 * pas le disque de l'utilisateur. La route refuse en le disant, au format du
 * flux, au lieu de lancer un clone voué à l'échec.
 */

const previous = process.env['PF_HOSTED'];

afterEach(() => {
  if (previous === undefined) {
    delete process.env['PF_HOSTED'];
  } else {
    process.env['PF_HOSTED'] = previous;
  }
});

function request(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

describe('POST /api/clone en hébergé', () => {
  it('refuse le clone git et renvoie vers la copie depuis GitHub', async () => {
    process.env['PF_HOSTED'] = '1';
    const response = await POST(request({ link: 'octo/hello', folder: 'hello' }));
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const text = await response.text();
    const event = JSON.parse(text.replace(/^data: /, '').trim()) as Record<string, unknown>;
    expect(event).toMatchObject({ type: 'done', ok: false, installed: false });
    expect(String((event['issues'] as string[])[0])).toContain('ne tourne qu’en local');
  });
});
