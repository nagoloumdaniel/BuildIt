import type { ExitCode, Io } from '../io.js';
import { create } from './create.js';

/**
 * Menu d'accueil (§18bis). Cloner et ouvrir un projet local y figurent dès
 * maintenant, désactivés : l'utilisateur voit ce qui vient.
 */
export async function menu(io: Io, help: () => ExitCode): Promise<ExitCode> {
  if (!io.interactive) {
    return help();
  }
  const choice = await io.prompter.select('Que voulez-vous faire ?', [
    { value: 'create', label: 'Créer un projet', hint: 'depuis un preset certifié' },
    {
      value: 'clone',
      label: 'Cloner un dépôt GitHub et installer',
      hint: 'Phase 7B',
      disabled: true,
    },
    {
      value: 'open',
      label: 'Ouvrir un projet local et installer',
      hint: 'Phase 7B',
      disabled: true,
    },
    { value: 'help', label: 'Voir toutes les commandes' },
  ]);
  return choice === 'create' ? create([], io) : help();
}
