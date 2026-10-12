import { writeFile } from 'node:fs/promises';
import { resolve as resolvePath } from 'node:path';
import { parseArgs } from 'node:util';
import { resolve } from '@buildit/compatibility';
import { selectionFromManifest } from '@buildit/generator';
import { type Manifest, parseManifest, serializeManifest } from '@buildit/manifest';
import type { RegistryEntry, Slot } from '@buildit/registry';
import { loadCatalogue, slotFor } from '@buildit/registry';
import { suggest } from '@buildit/validation';
import { printIssues, printWarnings, usageError } from '../format.js';
import { EXIT, type ExitCode, type Io } from '../io.js';
import { DEFAULT_MANIFEST_FILE, readManifestFile } from '../manifest-file.js';

export const ADD_USAGE: string = `Usage : pf add <technologie> [--manifest <fichier>] [--yes]

Ajoute une technologie au manifest, au champ que sa catégorie désigne, après
contrôle de compatibilité. Affiche la modification ; n'écrit qu'avec --yes ou
après confirmation. Manifest par défaut : ${DEFAULT_MANIFEST_FILE}.`;

/** Le résultat d'un placement : le nouveau manifest et le champ touché. */
interface Placement {
  readonly manifest: Manifest;
  readonly field: string;
  readonly replaced?: string | undefined;
}

/** Le manifest, avec un champ d'application remplacé — jamais un cast. */
function withApp(manifest: Manifest, app: AppKey, field: AppField, id: string): Manifest {
  return { ...manifest, [app]: { ...manifest[app], [field]: id } };
}

type AppKey = 'frontend' | 'mobile' | 'desktop' | 'backend';
type AppField = 'framework' | 'language' | 'styling' | 'ui';

/** Ce qu'un ajout remplace dans une application, selon son champ. */
function replaceInApp(manifest: Manifest, field: AppField, id: string): Placement | string {
  // Le framework va à l'application que la cible implique : sans application
  // web, un framework web n'a nulle part où aller.
  const target = manifest.frontend;
  if (target === undefined) {
    return 'Aucune application web dans ce manifest : créez-la avec un preset (pf create) plutôt que par morceaux.';
  }
  return {
    manifest: withApp(manifest, 'frontend', field, id),
    field: `frontend.${field}`,
    replaced: target[field],
  };
}

/**
 * Le placement de `pf add`, à partir de la table partagée `slotFor`.
 *
 * Politique propre au CLI, et différente de celle du brouillon web : ici on
 * **remplace** la valeur unique en place et on le dit (`remplace X`), parce que
 * c'est un ajout demandé explicitement à un manifest existant. Le brouillon, lui,
 * assemble un manifest neuf et garde la première fiche rencontrée. Ce module ne
 * décide plus *où* va une catégorie — c'était la seule chose que les deux copies
 * devaient dire à l'identique.
 */
function slotted(slot: Slot, manifest: Manifest, id: string): Placement | string {
  if (slot.kind === 'list') {
    return {
      manifest: { ...manifest, [slot.field]: [...(manifest[slot.field] ?? []), id] },
      field: slot.field,
    };
  }

  if (slot.kind === 'single') {
    if (slot.field === 'provider') {
      return {
        manifest: { ...manifest, auth: { provider: id } },
        field: 'auth.provider',
        replaced: manifest.auth?.provider,
      };
    }
    if (slot.field === 'orm') {
      const database = manifest.database;
      if (database === undefined) {
        return 'Un ORM a besoin d’une base de données : ajoutez-la d’abord (pf add postgresql).';
      }
      return {
        manifest: { ...manifest, database: { ...database, orm: id } },
        field: 'database.orm',
        replaced: database.orm,
      };
    }
    return {
      manifest: { ...manifest, database: { ...manifest.database, engine: id } },
      field: 'database.engine',
      replaced: manifest.database?.engine,
    };
  }

  if (slot.field === 'language') {
    return 'Le langage fait partie de l’application : il se choisit à la création (pf create).';
  }
  if (slot.field === 'styling' && manifest.frontend === undefined) {
    return 'Un style s’applique à une application web, absente de ce manifest.';
  }
  if (slot.field === 'ui' && manifest.frontend === undefined) {
    return 'Une bibliothèque d’interface s’applique à une application web, absente de ce manifest.';
  }
  return replaceInApp(manifest, slot.field, id);
}

function place(manifest: Manifest, entry: RegistryEntry): Placement | string {
  const slot = slotFor(entry.category);
  // Le catalogue est la source de vérité : une fiche `backend` va au framework
  // du backend, et non à celui de l'application web que `slotted` traite par
  // défaut.
  if (slot.kind === 'app' && slot.field === 'framework' && entry.category === 'backend') {
    return {
      manifest: { ...manifest, backend: { ...manifest.backend, framework: entry.id } },
      field: 'backend.framework',
      replaced: manifest.backend?.framework,
    };
  }
  return slotted(slot, manifest, entry.id);
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
      io.out(`+ ${addition.id} : exigée par ${id}, ajoutée à la génération`);
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
