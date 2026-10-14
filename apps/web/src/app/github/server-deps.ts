import { nodeCommandRunner } from '@buildit/exec';
import { isHostedEnvironment } from '../../lib/hosting';
import { cookieTokenStore } from '../../lib/session-cookie';
import type { SessionDeps } from './session';
import { tokenStoreFor } from './session';

/**
 * Les dépendances réelles pour parler à GitHub : `fetch`, trousseau et
 * identifiant d'application OAuth.
 *
 * Partagé entre les Server Actions (`actions-node.ts`) et les routes de
 * redirection OAuth (`github/authorize`, `github/callback`) : les deux
 * parlent au même trousseau, pas à deux copies de la même règle.
 *
 * Phase 12 : en mode hébergé (`VERCEL=1` ou `PF_HOSTED=1`), le jeton ne va
 * jamais au trousseau du système ni à `PF_GITHUB_TOKEN` ce serait un jeton
 * partagé entre tous les visiteurs du déploiement. Il vit dans un cookie
 * scellé, unique par visiteur (`lib/session-cookie.ts`). En local, rien ne
 * change : `tokenStoreFor` garde le comportement de `pf web` tel qu'avant
 * cette phase.
 */
export function sessionDeps(): SessionDeps {
  const store = isHostedEnvironment()
    ? cookieTokenStore(process.env['SESSION_SECRET'] ?? '')
    : tokenStoreFor(process.env, nodeCommandRunner);
  return {
    fetch: (input, init) => globalThis.fetch(input, init),
    store,
    clientId: process.env['PF_GITHUB_CLIENT_ID'] ?? '',
  };
}

/** Le Client Secret de l'application OAuth exigé seulement par le flux de redirection. */
export function clientSecret(): string {
  return process.env['PF_GITHUB_CLIENT_SECRET'] ?? '';
}
