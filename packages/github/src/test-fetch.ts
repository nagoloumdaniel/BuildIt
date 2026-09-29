import type { Fetch } from './client.js';

export interface Recorded {
  readonly method: string;
  readonly url: string;
  readonly headers: Record<string, string>;
  readonly body: string | undefined;
}

type Reply = { status: number; body?: unknown; headers?: Record<string, string> } | 'network';

/**
 * Faux `fetch` : une réponse par « MÉTHODE chemin » (sans l'hôte), ou une
 * file de réponses pour les appels répétés. Chaque requête est notée.
 */
export function fakeFetch(
  routes: Record<string, Reply | Reply[]>,
): Fetch & { requests: Recorded[] } {
  const requests: Recorded[] = [];
  const fetcher = async (input: string, init: RequestInit = {}): Promise<Response> => {
    const method = init.method ?? 'GET';
    const url = new URL(input);
    requests.push({
      method,
      url: input,
      headers: (init.headers ?? {}) as Record<string, string>,
      body: typeof init.body === 'string' ? init.body : undefined,
    });
    const key = `${method} ${url.pathname}${url.search}`;
    const route = routes[key] ?? routes[`${method} ${url.pathname}`];
    const reply = Array.isArray(route) ? route.shift() : route;
    if (reply === undefined) {
      throw new Error(`route absente : ${key}`);
    }
    if (reply === 'network') {
      throw new Error('getaddrinfo ENOTFOUND api.github.com');
    }
    const body =
      reply.body === undefined
        ? null
        : typeof reply.body === 'string'
          ? reply.body
          : JSON.stringify(reply.body);
    return new Response(reply.status === 204 ? null : body, {
      status: reply.status,
      headers: reply.headers ?? {},
    });
  };
  return Object.assign(fetcher, { requests });
}
