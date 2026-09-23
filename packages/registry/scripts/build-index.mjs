#!/usr/bin/env node
/**
 * Engendre `src/generated/entries.ts` à partir des fichiers de `data/`.
 *
 * Les fiches vivent en JSON, un fichier par technologie : c'est ce qui rend une
 * contribution lisible en revue de code (§11). Mais un paquet publié ne peut pas
 * aller lire un dossier sur le disque après installation — les chemins ne sont
 * pas fiables. L'index engendré résout les deux : source éditable à la main,
 * données embarquées à la construction.
 *
 * Le fichier engendré est versionné, et un test vérifie qu'il n'a pas dérivé.
 * Engendré mais non versionné imposerait un ordre de construction ; versionné
 * mais non vérifié divergerait en silence.
 *
 * Usage : node scripts/build-index.mjs [--check]
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dataDir = join(root, 'data');
const outputPath = join(root, 'src', 'generated', 'entries.ts');

/** Liste les fiches, triées pour que la sortie ne dépende pas du système de fichiers. */
function collectEntryFiles(directory) {
  const found = [];
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) {
      found.push(...collectEntryFiles(path));
    } else if (item.name.endsWith('.json')) {
      found.push(path);
    }
  }
  return found.sort();
}

let entryCount = 0;

function render() {
  const files = existsSync(dataDir) ? collectEntryFiles(dataDir) : [];
  const entries = files.map((file) => JSON.parse(readFileSync(file, 'utf8')));
  entryCount = entries.length;

  return [
    '// Fichier engendré par scripts/build-index.mjs — ne pas modifier à la main.',
    '// Source de vérité : le dossier data/. Relancer le script après toute modification.',
    '',
    '/** Fiches brutes, non validées. `loadCatalogue()` les valide. */',
    'export const RAW_ENTRIES: readonly unknown[] = [',
    ...entries.map((entry) => `  ${JSON.stringify(entry)},`),
    '];',
    '',
  ].join('\n');
}

const content = render();
const isCheck = process.argv.includes('--check');

if (isCheck) {
  const current = existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : '';
  if (current !== content) {
    console.error(
      "L'index du registry a dérivé de data/.\n" +
        'Relancez : pnpm --filter @project-factory/registry run build:index',
    );
    process.exit(1);
  }
  process.exit(0);
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, content);
console.log(`index engendré : ${entryCount} fiche(s)`);
