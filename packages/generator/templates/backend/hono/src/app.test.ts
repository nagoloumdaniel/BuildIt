import { describe, expect, it } from 'vitest';
import { app } from './app';

describe('API', () => {
  it('répond sur /health', async () => {
    const response = await app.request('/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('publie sa documentation OpenAPI, qui décrit ses routes', async () => {
    const response = await app.request('/openapi.json');
    const document = (await response.json()) as { paths: Record<string, unknown> };
    expect(Object.keys(document.paths)).toContain('/health');
  });
});
