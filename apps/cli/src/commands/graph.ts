import { resolve as resolvePath } from 'node:path';
import { parseArgs } from 'node:util';
import { resolve } from '@project-factory/compatibility';
import { selectionFromManifest } from '@project-factory/generator';
import type { Manifest } from '@project-factory/manifest';
import { getPreset } from '@project-factory/presets';
import { loadCatalogue } from '@project-factory/registry';
import { printIssues, printWarnings, usageError } from '../format.js';
import { EXIT, type ExitCode, type Io } from '../io.js';
import { DEFAULT_MANIFEST_FILE, readManifestFile } from '../manifest-file.js';

export const GRAPH_USAGE: string = `Usage : pf graph [manifest.json] [--preset <p>]

Affiche la stack résolue : les technologies choisies, celles que le moteur
ajoute (et qui les exige), le statut de certification et les avertissements.
Sans argument, lit ${DEFAULT_MANIFEST_FILE}.`;

export async function graph(args: readonly string[], io: Io): Promise<ExitCode> {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: {
      preset: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    io.out(GRAPH_USAGE);
    return EXIT.ok;
  }
  if (positionals.length > 1 || (positionals.length === 1 && values.preset !== undefined)) {
    return usageError(io, 'Un manifest ou un preset, pas les deux.', GRAPH_USAGE);
  }

  let manifest: Manifest | undefined;
  if (values.preset === undefined) {
    manifest = await readManifestFile(
      io,
      resolvePath(io.cwd, positionals[0] ?? DEFAULT_MANIFEST_FILE),
    );
  } else {
    const preset = getPreset(values.preset);
    if (preset === undefined) {
      return usageError(io, `Preset inconnu : « ${values.preset} ».`, 'pf template list');
    }
    manifest = preset.manifest(preset.id);
  }
  if (manifest === undefined) {
    return EXIT.failure;
  }

  const registry = loadCatalogue();
  if (!registry.ok) {
    printIssues(io, registry.issues);
    return EXIT.failure;
  }
  const resolution = resolve(selectionFromManifest(manifest), registry.value);
  if (!resolution.ok) {
    printIssues(io, resolution.issues);
    return EXIT.failure;
  }

  const { technologies, additions, status, warnings } = resolution.value;
  const addedBy = new Map(additions.map((addition) => [addition.id, addition.requiredBy]));
  io.out(
    `${manifest.name} — ${technologies.length} technologies, stack ${status === 'certified' ? 'certifiée' : 'expérimentale'}`,
  );
  io.out('');
  for (const id of technologies) {
    const entry = registry.value.get(id);
    const label = entry === undefined ? id : `${entry.name} (${id})`;
    const category = entry?.category ?? '?';
    const certified = entry?.generation === 'certified' ? '✓' : '·';
    const origin = addedBy.has(id) ? `  ← ajoutée : exigée par ${addedBy.get(id)}` : '';
    io.out(`  ${certified} ${category.padEnd(16)} ${label}${origin}`);
  }
  io.out('');
  io.out('✓ certifiée (prouvée par le test de fumée) · · déclarée');
  printWarnings(io, warnings);
  return EXIT.ok;
}
