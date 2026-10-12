import { describe, expect, it } from 'vitest';
import { FR } from '../../../lib/i18n/messages';
import { formatBytes, GENERATION_STEPS, progressStates, stepLabel, targetDirectory } from './steps';

/**
 * L'écran Generation Progress (§6.13) et le rapport (§6.14) affichent le même
 * vocabulaire : ces fonctions sont pures, donc ce que l'utilisateur lit est
 * vérifié sans navigateur. Les libellés viennent du dictionnaire — ces tests
 * passent le français, l'anglais est vérifié par le typecheck de `Messages`.
 */

const STEPS = FR.build.generate.steps;

describe('stepLabel — les étapes du pipeline en clair', () => {
  it('nomme les étapes du moteur', () => {
    expect(stepLabel('plan', STEPS)).toBe('Planification');
    expect(stepLabel('write', STEPS)).toBe('Écriture des fichiers');
    expect(stepLabel('install', STEPS)).toBe('Installation des dépendances');
  });

  it('une étape inconnue est affichée telle quelle, jamais masquée', () => {
    expect(stepLabel('deploy', STEPS)).toBe('deploy');
  });
});

describe('GENERATION_STEPS — ce que generateProjectAction exécute vraiment', () => {
  it('ne promet ni installation, ni Git, ni validation', () => {
    // Le moteur ne lance aucune commande qu'on ne lui demande pas : l'écran
    // n'affiche donc pas des étapes qui n'auront pas lieu.
    expect([...GENERATION_STEPS]).toEqual(['plan', 'write']);
    expect(GENERATION_STEPS).not.toContain('install');
    expect(GENERATION_STEPS).not.toContain('git');
  });
});

describe('progressStates — l’avancement affiché', () => {
  it('marque terminé ce que le moteur a terminé, en attente le reste', () => {
    expect(progressStates(['plan'], GENERATION_STEPS, STEPS)).toEqual([
      { step: 'plan', label: 'Planification', done: true },
      { step: 'write', label: 'Écriture des fichiers', done: false },
    ]);
  });

  it('rien de terminé : tout est en attente', () => {
    expect(progressStates([], GENERATION_STEPS, STEPS).every((step) => !step.done)).toBe(true);
  });

  it('une étape terminée hors liste n’est pas perdue : elle est ajoutée au compte rendu', () => {
    const states = progressStates(['plan', 'write', 'validate'], GENERATION_STEPS, STEPS);
    expect(states.map((state) => state.step)).toEqual(['plan', 'write', 'validate']);
    expect(states.at(-1)).toEqual({ step: 'validate', label: 'Validation', done: true });
  });
});

describe('formatBytes — le poids du rapport', () => {
  it.each([
    [0, '0 o'],
    [1, '1 o'],
    [512, '512 o'],
    [1024, '1,0 ko'],
    [1536, '1,5 ko'],
    [1048576, '1,0 Mo'],
    [5 * 1024 * 1024 * 1024, '5,0 Go'],
  ])('%i octets → %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });

  it('un nombre négatif ou non fini ne casse pas l’écran', () => {
    expect(formatBytes(-1)).toBe('0 o');
    expect(formatBytes(Number.NaN)).toBe('0 o');
  });
});

describe('targetDirectory — le dossier montré AVANT d’écrire', () => {
  it('compose un chemin POSIX', () => {
    expect(targetDirectory('/tmp/pf', 'mon-projet')).toBe('/tmp/pf/mon-projet');
  });

  it('compose un chemin Windows sans doubler le séparateur', () => {
    expect(targetDirectory('C:\\Users\\moi\\buildit\\', 'mon-projet')).toBe(
      'C:\\Users\\moi\\buildit\\mon-projet',
    );
  });

  it('la racine « / » reste une racine', () => {
    expect(targetDirectory('/', 'mon-projet')).toBe('/mon-projet');
  });

  it('une racine vide rend le seul nom de projet', () => {
    expect(targetDirectory('', 'mon-projet')).toBe('mon-projet');
  });
});
