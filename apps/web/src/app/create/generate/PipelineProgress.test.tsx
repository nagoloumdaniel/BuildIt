import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FR } from '../../../lib/i18n/messages';
import { PipelineProgress } from './PipelineProgress';
import { GENERATION_STEPS, progressStates } from './steps';

/**
 * L'avancement (§6.13) dit l'étape en cours et celles qui restent. Sans
 * fournisseur de langue, le rendu statique sort le français — c'est le défaut
 * documenté de `useMessages`.
 */
const STEPS = FR.build.generate.steps;

describe('PipelineProgress', () => {
  it('pendant la génération, annonce l’attente sans promettre de durée', () => {
    const html = renderToStaticMarkup(
      <PipelineProgress steps={progressStates([], GENERATION_STEPS, STEPS)} running />,
    );
    expect(html).toContain('Génération en cours');
    expect(html).toContain('Planification');
    expect(html).toContain('En attente');
    expect(html).toContain('role="status"');
  });

  it('après, marque les étapes terminées', () => {
    const html = renderToStaticMarkup(
      <PipelineProgress
        steps={progressStates(['plan', 'write'], GENERATION_STEPS, STEPS)}
        running={false}
      />,
    );
    expect(html).toContain('Terminé');
    expect(html).not.toContain('En attente');
    expect(html).not.toContain('Génération en cours');
  });

  it('la barre est déterminée : 0 % avant tout retour du moteur, 100 % à la fin', () => {
    const pending = renderToStaticMarkup(
      <PipelineProgress steps={progressStates([], GENERATION_STEPS, STEPS)} running />,
    );
    const finished = renderToStaticMarkup(
      <PipelineProgress
        steps={progressStates(['plan', 'write'], GENERATION_STEPS, STEPS)}
        running={false}
      />,
    );
    expect(pending).toContain('role="progressbar"');
    expect(pending).toContain('aria-valuenow="0"');
    expect(finished).toContain('aria-valuenow="100"');
    // Jamais d'indéterminée ici : le dénominateur est connu (les étapes réelles).
    expect(pending).not.toContain('pf-bar-indeterminate');
  });
});
