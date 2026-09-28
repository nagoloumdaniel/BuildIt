import { describe, expect, it, vi } from 'vitest';
import { fakeIo } from './fake-io.js';
import { runGeneration } from './generation.js';

vi.mock('@project-factory/generator', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@project-factory/generator')>()),
  generateProject: vi.fn(async () => ({
    ok: false,
    issues: [
      {
        code: 'GEN_INSTALL_FAILED',
        path: [],
        message: 'pnpm install a échoué.',
        hint: 'Vérifiez votre connexion.',
      },
    ],
    failedStep: 'install',
    retryable: true,
    completedSteps: ['plan', 'write'],
  })),
}));

describe('runGeneration', () => {
  it('une erreur passagère donne la commande exacte à relancer', async () => {
    const io = fakeIo({ cwd: '/tmp' });
    const manifest = {
      manifestVersion: 1 as const,
      name: 'demo',
      targets: ['api' as const],
      architecture: 'single-app' as const,
      backend: { framework: 'hono', language: 'typescript' },
    };
    const code = await runGeneration(
      io,
      manifest,
      '/tmp/demo',
      [],
      { install: true, git: true, dryRun: false },
      'pf create demo --preset api',
    );
    expect(code).toBe(1);
    expect(io.stderr).toEqual([
      "Échec à l'étape « install ».",
      '✗ pnpm install a échoué.',
      '  → Vérifiez votre connexion.',
      '  (GEN_INSTALL_FAILED)',
      '  → Erreur passagère : relancez avec `pf create demo --preset api --from install`.',
    ]);
  });
});
