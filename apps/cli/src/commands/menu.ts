import type { ExitCode, Io } from '../io.js';
import { clone } from './clone.js';
import { create } from './create.js';
import { open } from './open.js';

/**
 * Menu d'accueil (§18bis) : créer, cloner, ouvrir un projet local.
 */
export async function menu(io: Io, help: () => ExitCode): Promise<ExitCode> {
  if (!io.interactive) {
    return help();
  }
  const choice = await io.prompter.select('Que voulez-vous faire ?', [
    { value: 'create', label: 'Créer un projet', hint: 'depuis un preset certifié' },
    { value: 'clone', label: 'Cloner un projet', hint: 'depuis GitHub ou un lien Git' },
    { value: 'open', label: 'Ouvrir un projet local', hint: 'et installer ses dépendances' },
    { value: 'help', label: 'Voir toutes les commandes' },
  ]);
  switch (choice) {
    case 'create':
      return create([], io);
    case 'clone':
      return clone([], io);
    case 'open':
      return open([], io);
    default:
      return help();
  }
}
