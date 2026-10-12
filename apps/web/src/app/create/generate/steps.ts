/**
 * L'écran Generation (§6.13) et le rapport (§6.14), hors du rendu.
 *
 * Ce qui reste ici est pur et sert au navigateur : le poids écrit dans la
 * langue courante, et le dossier montré **avant** d'écrire. L'avancement, lui,
 * ne se calcule plus : la route `/api/generate` pousse chaque passage réel, et
 * l'écran le dit tel quel sur une seule ligne d'état.
 */

import { formatBytes } from '../../../lib/projects';

/**
 * Le poids écrit, dans la langue courante : « 1,5 ko » en français, « 1.5 kB »
 * en anglais. Ré-exporté de `lib/projects.ts` — une seule table d'unités pour
 * tout le configurateur, donc deux écrans ne peuvent pas diverger.
 */
export { formatBytes };

/**
 * Le dossier cible, celui qu'on montre **avant** d'écrire.
 *
 * Il n'est pas construit avec `node:path` : ce code s'exécute aussi dans le
 * navigateur. Le nom du projet ne peut pas contenir de séparateur
 * (`PROJECT_NAME_PATTERN`), donc concaténer est sûr. Le séparateur ajouté est
 * celui du chemin reçu : un dossier choisi sous Windows reste en `\`, et
 * l'utilisateur relit le chemin que son explorateur lui a montré.
 *
 * Ce n'est qu'un affichage d'attente : le chemin qui fait foi est celui que le
 * serveur résout (`checkOutputDestinationAction`).
 */
export function targetDirectory(root: string, name: string): string {
  if (root === '') {
    return name;
  }
  if (root.endsWith('/') || root.endsWith('\\')) {
    return `${root}${name}`;
  }
  const separator = root.includes('\\') && !root.includes('/') ? '\\' : '/';
  return `${root}${separator}${name}`;
}
