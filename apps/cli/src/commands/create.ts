import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { PROJECT_NAME_PATTERN } from '@project-factory/manifest';
import { getPreset, PRESET_IDS, PRESETS, type PresetId } from '@project-factory/presets';
import { suggest } from '@project-factory/validation';
import { usageError } from '../format.js';
import { GENERATION_OPTIONS, generationFlags, runGeneration } from '../generation.js';
import { EXIT, type ExitCode, type Io } from '../io.js';

export const CREATE_USAGE: string = `Usage : pf create [nom] --preset <${PRESET_IDS.join('|')}> [options]

Options :
  --preset <p>    Preset certifié (pf template list)
  --dir <dossier> Dossier cible (par défaut : ./<nom>)
  --no-install    Ne pas installer les dépendances
  --no-git        Ne pas initialiser de dépôt Git
  --dry-run       Afficher les fichiers, sans rien écrire
  --from <étape>  Reprendre à une étape (write, install, git, validate)
  --yes           Ne poser aucune question`;

function nameProblem(name: string): string | undefined {
  return PROJECT_NAME_PATTERN.test(name)
    ? undefined
    : `« ${name} » n'est pas un nom de projet valide : minuscules, chiffres et tirets, commençant par une lettre (ex. mon-projet).`;
}

export async function create(args: readonly string[], io: Io): Promise<ExitCode> {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: {
      ...GENERATION_OPTIONS,
      preset: { type: 'string' },
      yes: { type: 'boolean', short: 'y', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    io.out(CREATE_USAGE);
    return EXIT.ok;
  }
  if (positionals.length > 1) {
    return usageError(
      io,
      `Un seul nom de projet attendu, ${positionals.length} reçus.`,
      CREATE_USAGE,
    );
  }
  const ask = io.interactive && !values.yes;

  let name = positionals[0];
  if (name === undefined) {
    if (!ask) {
      return usageError(io, 'Nom du projet manquant.', 'pf create <nom> --preset <preset>');
    }
    name = await io.prompter.text('Nom du projet :', nameProblem);
  }
  const problem = nameProblem(name);
  if (problem !== undefined) {
    return usageError(io, problem);
  }

  let presetId = values.preset;
  if (presetId === undefined) {
    if (!ask) {
      return usageError(io, 'Preset manquant.', `Ajoutez --preset <${PRESET_IDS.join('|')}>.`);
    }
    presetId = await io.prompter.select<PresetId>(
      'Quel type de projet ?',
      PRESETS.map((preset) => ({ value: preset.id, label: preset.name, hint: preset.description })),
    );
  }
  const preset = getPreset(presetId);
  if (preset === undefined) {
    const close = suggest(presetId, PRESET_IDS);
    return usageError(
      io,
      `Preset inconnu : « ${presetId} ».`,
      close === undefined
        ? `Presets disponibles : ${PRESET_IDS.join(', ')}.`
        : `Vouliez-vous dire « ${close} » ?`,
    );
  }

  const target = resolve(io.cwd, values.dir ?? name);
  return runGeneration(
    io,
    preset.manifest(name),
    target,
    preset.recipes,
    generationFlags(values),
    `pf create ${name} --preset ${preset.id}${values.dir === undefined ? '' : ` --dir ${values.dir}`}`,
  );
}
