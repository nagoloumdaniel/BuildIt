#!/usr/bin/env node
/**
 * Engendre `src/generated/recipes.ts` à partir des fichiers de `data/`.
 *
 * Même raisonnement que l'index du registry : une recette par fichier JSON,
 * lisible en revue de code, embarquée à la construction parce qu'un paquet
 * publié ne peut pas se fier aux chemins du disque. Le fichier engendré est
 * versionné, et un test vérifie qu'il n'a pas dérivé.
 *
 * Usage : node scripts/build-index.mjs [--check]
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dataDir = join(root, 'data');
const outputPath = join(root, 'src', 'generated', 'recipes.ts');

/**
 * Liste les recettes, triées pour que la sortie ne dépende pas du système de
 * fichiers. Suffixe `.recipe.json`, comme `.entry.json` au registry : jamais
 * un nom qu'un outil prendrait pour sa propre configuration.
 */
function collectEntryFiles(directory) {
  const found = [];
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) {
      found.push(...collectEntryFiles(path));
    } else if (item.name.endsWith('.recipe.json')) {
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
    '/** Recettes brutes, non validées. `loadRecipeCatalogue()` les valide. */',
    'export const RAW_RECIPES: readonly unknown[] = [',
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
      "L'index des recettes a dérivé de data/.\n" +
        'Relancez : pnpm --filter @project-factory/recipes run build:index',
    );
    process.exit(1);
  }
  process.exit(0);
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, content);
console.log(`index engendré : ${entryCount} recette(s)`);
