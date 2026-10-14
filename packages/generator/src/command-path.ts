import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Comment lancer une commande d'un projet généré, **sous Windows comprise**.
 *
 * `spawn('pnpm', …)` et `execFileSync('pnpm', …)` échouent en `ENOENT` sous
 * Windows : `pnpm` y est un `pnpm.cmd`, et Node refuse de lancer un `.cmd` sans
 * shell (CVE-2024-27980). Le produit a déjà la réponse `resolveCommand` de
 * `packages/exec` remplace le `.cmd` par son script JavaScript lancé avec Node,
 * sans jamais ouvrir de shell mais elle est asynchrone, alors que le test de
 * fumée lance ses commandes en synchrone.
 *
 * On reproduit donc ici la **même** résolution, en synchrone, et
 * `command-path.test.ts` monte la garde : il exécute réellement ce que cette
 * fonction rend. Sans cette sonde, le test de fumée échouait en `ENOENT` sur
 * cette plateforme sans que rien ne le dise.
 *
 * Module hors `*.smoke.ts` à dessein : c'est une fonction pure de résolution,
 * elle se teste sans réseau et sans générer de projet.
 */
export interface ResolvedCommand {
  readonly file: string;
  /** Ce qui se glisse avant les arguments : le script d'un lanceur npm. */
  readonly prefix: readonly string[];
}

/**
 * `platform` et `searchPath` sont injectables pour une seule raison : une
 * branche qui ne s'exécute jamais sur la machine de développement est une
 * branche qu'on ne connaît pas. Le comportement Windows se prouve donc par des
 * chemins simulés, pas par un commentaire.
 */
export function resolveCommand(
  command: string,
  platform: NodeJS.Platform = process.platform,
  searchPath: string = process.env['PATH'] ?? '',
): ResolvedCommand {
  if (platform !== 'win32') {
    return { file: command, prefix: [] };
  }
  const directories = searchPath.split(';').filter((part) => part !== '');
  for (const directory of directories) {
    for (const extension of ['.exe', '.com']) {
      const candidate = join(directory, `${command}${extension}`);
      if (existsSync(candidate)) {
        return { file: candidate, prefix: [] };
      }
    }
  }
  // Un lanceur npm (`.cmd`) cache un script : Node est l'exécutable, le script
  // est le premier argument.
  for (const directory of directories) {
    for (const launch of ['.cmd', '.bat']) {
      if (!existsSync(join(directory, `${command}${launch}`))) {
        continue;
      }
      for (const entry of ['.cjs', '.mjs', '.js']) {
        const script = join(directory, 'node_modules', command, 'bin', `${command}${entry}`);
        if (existsSync(script)) {
          return { file: process.execPath, prefix: [script] };
        }
      }
    }
  }
  return { file: command, prefix: [] };
}
