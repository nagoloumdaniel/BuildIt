import { createApiClient } from '{{projectName}}-shared';

/**
 * L'API, vue de l'application web. En local, elle écoute sur le port 3001 ;
 * ailleurs, API_URL dit où la trouver (voir .env.example).
 */
export const api = createApiClient(process.env.API_URL ?? 'http://localhost:3001');
