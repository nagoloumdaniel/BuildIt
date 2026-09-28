import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';

/**
 * L'application, séparée du serveur (src/index.ts) : les tests l'appellent
 * directement avec `app.request`, sans ouvrir de port.
 *
 * Chaque route est décrite par un schéma Zod : il valide l'entrée et produit
 * la documentation OpenAPI, publiée sur /openapi.json. Une seule source.
 */
export const app = new OpenAPIHono();

const Health = z.object({ status: z.literal('ok') }).openapi('Health');

const health = createRoute({
  method: 'get',
  path: '/health',
  responses: {
    200: {
      content: { 'application/json': { schema: Health } },
      description: 'Le service répond.',
    },
  },
});

app.openapi(health, (c) => c.json({ status: 'ok' as const }, 200));

app.doc('/openapi.json', {
  openapi: '3.1.0',
  info: { title: '{{projectName}}', version: '0.1.0' },
});
