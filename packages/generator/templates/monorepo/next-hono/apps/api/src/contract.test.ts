import { HealthSchema } from '{{projectName}}-shared';
import { describe, expect, it } from 'vitest';
import { app } from './app';

/** L'API respecte le contrat partagé avec l'application web. */
describe('contrat web ↔ API', () => {
  it('/health renvoie ce que le web attend', async () => {
    const response = await app.request('/health');
    expect(HealthSchema.safeParse(await response.json()).success).toBe(true);
  });
});
