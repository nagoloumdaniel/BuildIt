import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { usageError } from '../format.js';
import { GENERATION_OPTIONS, generationFlags, runGeneration } from '../generation.js';
import { EXIT, type ExitCode, type Io } from '../io.js';
import { readManifestFile } from '../manifest-file.js';

export const GENERATE_USAGE = `Usage : pf generate <manifest.json> [options]

Options :
  --dir <dossier>     Dossier cible (par défaut : ./<nom du manifest>)
  --recipes <a,b>     Recettes à appliquer
  --no-install        Ne pas installer les dépendances
  --no-git            Ne pas initialiser de dépôt Git
  --dry-run           Afficher les fichiers, sans rien écrire
  --from <étape>      Reprendre à une étape (write, install, git, validate)`;

export async function generate(args: readonly string[], io: Io): Promise<ExitCode> {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: {
      ...GENERATION_OPTIONS,
      recipes: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    io.out(GENERATE_USAGE);
    return EXIT.ok;
  }
  const [file, ...extra] = positionals;
  if (file === undefined || extra.length > 0) {
    return usageError(io, 'Un fichier manifest attendu.', GENERATE_USAGE);
  }

  const manifest = await readManifestFile(io, resolve(io.cwd, file));
  if (manifest === undefined) {
    return EXIT.failure;
  }
  const recipes = (values.recipes ?? '')
    .split(',')
    .map((recipe) => recipe.trim())
    .filter((recipe) => recipe !== '');
  const recipeFlag = recipes.length === 0 ? '' : ` --recipes ${recipes.join(',')}`;
  const dirFlag = values.dir === undefined ? '' : ` --dir ${values.dir}`;
  return runGeneration(
    io,
    manifest,
    resolve(io.cwd, values.dir ?? manifest.name),
    recipes,
    generationFlags(values),
    `pf generate ${file}${dirFlag}${recipeFlag}`,
  );
}
