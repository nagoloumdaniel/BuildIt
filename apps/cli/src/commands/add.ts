import { writeFile } from 'node:fs/promises';
import { resolve as resolvePath } from 'node:path';
import { parseArgs } from 'node:util';
import { resolve } from '@project-factory/compatibility';
import { selectionFromManifest } from '@project-factory/generator';
import { type Manifest, parseManifest, serializeManifest } from '@project-factory/manifest';
import { type Category, loadCatalogue, type RegistryEntry } from '@project-factory/registry';
import { suggest } from '@project-factory/validation';
import { printIssues, printWarnings, usageError } from '../format.js';
import { EXIT, type ExitCode, type Io } from '../io.js';
import { DEFAULT_MANIFEST_FILE, readManifestFile } from '../manifest-file.js';

export const ADD_USAGE: string = `Usage : pf add <technologie> [--manifest <fichier>] [--yes]

Ajoute une technologie au manifest, au champ que sa catégorie désigne, après
contrôle de compatibilité. Affiche la modification ; n'écrit qu'avec --yes ou
après confirmation. Manifest par défaut : ${DEFAULT_MANIFEST_FILE}.`;

/** Le résultat d'un placement : le nouveau manifest et ce qu'il a changé. */
interface Placement {
  readonly manifest: Manifest;
  readonly field: string;
  readonly replaced?: string | undefined;
}

type Place = (manifest: Manifest, id: string) => Placement | string;

function list(field: 'services' | 'quality' | 'infra'): Place {
  return (manifest, id) => ({
    manifest: { ...manifest, [field]: [...(manifest[field] ?? []), id] },
    field,
  });
}

/**
 * Où va chaque catégorie. Un champ à valeur unique est remplacé, et la
 * modification affichée le dit ; une chaîne est un refus, qui dit pourquoi.
 */
const PLACES: Partial<Record<Category, Place>> = {
  frontend: (manifest, id) =>
    manifest.frontend === undefined
      ? 'Aucune application web dans ce manifest : créez-la avec un preset (pf create) plutôt que par morceaux.'
      : {
          manifest: { ...manifest, frontend: { ...manifest.frontend, framework: id } },
          field: 'frontend.framework',
          replaced: manifest.frontend.framework,
        },
  styling: (manifest, id) =>
    manifest.frontend === undefined
      ? 'Un style s’applique à une application web, absente de ce manifest.'
      : {
          manifest: { ...manifest, frontend: { ...manifest.frontend, styling: id } },
          field: 'frontend.styling',
          replaced: manifest.frontend.styling,
        },
  ui: (manifest, id) =>
    manifest.frontend === undefined
      ? 'Une bibliothèque d’interface s’applique à une application web, absente de ce manifest.'
      : {
          manifest: { ...manifest, frontend: { ...manifest.frontend, ui: id } },
          field: 'frontend.ui',
          replaced: manifest.frontend.ui,
        },
  backend: (manifest, id) => ({
    manifest: { ...manifest, backend: { ...manifest.backend, framework: id } },
    field: 'backend.framework',
    replaced: manifest.backend?.framework,
  }),
  database: (manifest, id) => ({
    manifest: { ...manifest, database: { ...manifest.database, engine: id } },
    field: 'database.engine',
    replaced: manifest.database?.engine,
  }),
  orm: (manifest, id) =>
    manifest.database === undefined
      ? 'Un ORM a besoin d’une base de données : ajoutez-la d’abord (pf add postgresql).'
      : {
          manifest: { ...manifest, database: { ...manifest.database, orm: id } },
          field: 'database.orm',
          replaced: manifest.database.orm,
        },
  authentication: (manifest, id) => ({
    manifest: { ...manifest, auth: { provider: id } },
    field: 'auth.provider',
    replaced: manifest.auth?.provider,
  }),
  language: () =>
    'Le langage fait partie de l’application : il se choisit à la création (pf create).',
  testing: list('quality'),
  linting: list('quality'),
  formatting: list('quality'),
  'git-hooks': list('quality'),
  containers: list('infra'),
  'ci-cd': list('infra'),
  hosting: list('infra'),
  monorepo: list('infra'),
  'package-manager': list('infra'),
  'dev-environment': list('infra'),
};

function place(manifest: Manifest, entry: RegistryEntry): Placement | string {
  return (PLACES[entry.category] ?? list('services'))(manifest, entry.id);
}

export async function add(args: readonly string[], io: Io): Promise<ExitCode> {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: {
      manifest: { type: 'string', short: 'm' },
      yes: { type: 'boolean', short: 'y', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    io.out(ADD_USAGE);
    return EXIT.ok;
  }
  const [id, ...extra] = positionals;
  if (id === undefined || extra.length > 0) {
    return usageError(io, 'Une technologie attendue.', ADD_USAGE);
  }

  const registry = loadCatalogue();
  if (!registry.ok) {
    printIssues(io, registry.issues);
    return EXIT.failure;
  }
  const entry = registry.value.get(id);
  if (entry === undefined) {
    const close = suggest(
      id,
      registry.value.entries().map((candidate) => candidate.id),
    );
    return usageError(
      io,
      `Technologie inconnue : « ${id} ».`,
      close === undefined
        ? 'pf graph liste les technologies d’un projet.'
        : `Vouliez-vous dire « ${close} » ?`,
    );
  }

  const file = resolvePath(io.cwd, values.manifest ?? DEFAULT_MANIFEST_FILE);
  const manifest = await readManifestFile(io, file);
  if (manifest === undefined) {
    return EXIT.failure;
  }
  if (selectionFromManifest(manifest).technologies.includes(id)) {
    io.out(`${entry.name} fait déjà partie du projet : rien à faire.`);
    return EXIT.ok;
  }

  const placed = place(manifest, entry);
  if (typeof placed === 'string') {
    return usageError(io, `Impossible d’ajouter ${entry.name} ici.`, placed);
  }
  const parsed = parseManifest(placed.manifest);
  if (!parsed.ok) {
    printIssues(io, parsed.issues);
    return EXIT.failure;
  }
  const resolution = resolve(selectionFromManifest(parsed.value), registry.value);
  if (!resolution.ok) {
    printIssues(io, resolution.issues);
    return EXIT.failure;
  }

  const replaced = placed.replaced === undefined ? '' : ` (remplace ${placed.replaced})`;
  io.out(`+ ${entry.name} → ${placed.field}${replaced}`);
  for (const addition of resolution.value.additions) {
    if (addition.requiredBy === id) {
      io.out(`+ ${addition.id} — exigée par ${id}, ajoutée à la génération`);
    }
  }
  printWarnings(io, resolution.value.warnings);

  const confirmed =
    values.yes ||
    (io.interactive &&
      (await io.prompter.confirm(`Écrire ${values.manifest ?? DEFAULT_MANIFEST_FILE} ?`)));
  if (!confirmed) {
    io.out('Rien n’a été écrit. Relancez avec --yes pour appliquer.');
    return EXIT.ok;
  }
  await writeFile(file, serializeManifest(parsed.value));
  io.out(`✓ ${values.manifest ?? DEFAULT_MANIFEST_FILE} mis à jour.`);
  return EXIT.ok;
}
