import type { ParseResult } from '@project-factory/validation';
import type { RegistryIssueCode } from './errors.js';
import { RAW_ENTRIES } from './generated/entries.js';
import { loadRegistry, type Registry } from './load.js';

/**
 * Charge le catalogue officiel de Project Factory.
 *
 * Les fiches viennent de l'index engendré à partir de `data/`. Elles sont
 * revalidées au chargement plutôt que présumées correctes : l'index est du
 * code engendré, et du code engendré peut être modifié à la main par erreur.
 */
export function loadCatalogue(): ParseResult<Registry, RegistryIssueCode> {
  return loadRegistry(RAW_ENTRIES);
}
