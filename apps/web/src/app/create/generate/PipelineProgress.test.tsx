import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PipelineProgress } from './PipelineProgress';
import { GENERATION_STEPS, progressStates } from './steps';

/** L'avancement (§6.13) dit l'étape en cours et celles qui restent. */
describe('PipelineProgress', () => {
  it('pendant la génération, annonce l’attente sans promettre de durée', () => {
    const html = renderToStaticMarkup(
      PipelineProgress({ steps: progressStates([], GENERATION_STEPS), running: true }),
    );
    expect(html).toContain('Génération en cours');
    expect(html).toContain('Planification');
    expect(html).toContain('En attente');
    expect(html).toContain('role="status"');
  });

  it('après, marque les étapes terminées', () => {
    const html = renderToStaticMarkup(
      PipelineProgress({
        steps: progressStates(['plan', 'write'], GENERATION_STEPS),
        running: false,
      }),
    );
    expect(html).toContain('Terminé');
    expect(html).not.toContain('En attente');
    expect(html).not.toContain('Génération en cours');
  });
});
