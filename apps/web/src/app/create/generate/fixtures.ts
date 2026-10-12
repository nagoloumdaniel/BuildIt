import type { Manifest } from '@buildit/manifest';
import { type DraftState, freshDraft } from '../../../lib/draft';
import { draftToManifest } from '../../../lib/draft-to-manifest';

/**
 * Le brouillon des tests de sortie : celui du preset SaaS, saisi aux écrans
 * 1 à 9. Partagé par les tests de la route, des actions et du suivi, pour que
 * les trois prouvent la même chose sur le même projet.
 */
export function saasDraft(name = 'mon-projet'): DraftState {
  return {
    ...freshDraft(),
    step: 'generate',
    name,
    targets: ['web'],
    type: 'saas',
    architecture: 'single-app',
    technologies: [
      'next',
      'typescript',
      'tailwind',
      'shadcn-ui',
      'postgresql',
      'prisma',
      'better-auth',
      'biome',
      'vitest',
      'playwright',
      'vercel',
    ],
    capabilities: ['stripe', 'resend', 'sentry', 'posthog'],
    envVarNames: ['DATABASE_URL', 'BETTER_AUTH_SECRET'],
    infra: { docker: true, ci: true },
  };
}

export function saasManifest(name = 'mon-projet'): Manifest {
  const manifest = draftToManifest(saasDraft(name));
  if (!manifest.ok) {
    throw new Error(manifest.issues.map((issue) => issue.message).join('\n'));
  }
  return manifest.value;
}
