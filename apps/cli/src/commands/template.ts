import { parseArgs } from 'node:util';
import { PROJECT_NAME_PATTERN, serializeManifest } from '@project-factory/manifest';
import { getPreset, PRESETS } from '@project-factory/presets';
import { usageError } from '../format.js';
import { EXIT, type ExitCode, type Io } from '../io.js';
import { create } from './create.js';

export const TEMPLATE_USAGE = `Usage : pf template <list|show|use>

  list              Les presets certifiés
  show <preset> [--name <nom>]
                    Le manifest d'un preset, sur la sortie standard :
                    pf template show api --name mon-api > pf.manifest.json
  use <preset> [nom] [options]
                    Crée un projet — alias de pf create --preset <preset>`;

export async function template(args: readonly string[], io: Io): Promise<ExitCode> {
  const [action, id, ...rest] = args;
  switch (action) {
    case 'list': {
      for (const preset of PRESETS) {
        io.out(`${preset.id.padEnd(10)} ${preset.name}`);
        io.out(`${' '.repeat(11)}${preset.description}`);
      }
      io.out('');
      io.out(
        'Tous certifiés : chaque preset est généré, installé, construit et lancé par le test de fumée.',
      );
      return EXIT.ok;
    }
    case 'show': {
      const preset = id === undefined ? undefined : getPreset(id);
      if (preset === undefined) {
        return usageError(io, `Preset inconnu : « ${id ?? ''} ».`, 'pf template list');
      }
      const { values } = parseArgs({ args: rest, options: { name: { type: 'string' } } });
      const name = values.name ?? 'mon-projet';
      if (!PROJECT_NAME_PATTERN.test(name)) {
        return usageError(io, `« ${name} » n'est pas un nom de projet valide.`);
      }
      // Seul le manifest va sur la sortie standard : il doit pouvoir être
      // redirigé dans un fichier tel quel.
      io.out(serializeManifest(preset.manifest(name)).trimEnd());
      if (preset.recipes.length > 0) {
        io.err(`Recettes du preset : pf generate <fichier> --recipes ${preset.recipes.join(',')}`);
      }
      return EXIT.ok;
    }
    case 'use':
      if (id === undefined) {
        return usageError(io, 'Preset manquant.', 'pf template use <preset> [nom]');
      }
      return create([...rest, '--preset', id], io);
    case undefined:
    case '--help':
    case '-h':
      io.out(TEMPLATE_USAGE);
      return action === undefined ? EXIT.usage : EXIT.ok;
    default:
      return usageError(io, `Action inconnue : « ${action} ».`, TEMPLATE_USAGE);
  }
}
