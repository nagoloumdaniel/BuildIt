import type { Issue } from '@project-factory/validation';
import type { Io } from './io.js';

/**
 * Un problème du moteur, tel que l'utilisateur le lit : le message d'abord,
 * la piste de correction ensuite, le code en dernier — utile pour chercher,
 * inutile pour comprendre.
 */
export function printIssues(io: Io, issues: readonly Issue<string>[]): void {
  for (const issue of issues) {
    io.err(`✗ ${issue.message}`);
    if (issue.hint !== undefined) {
      io.err(`  → ${issue.hint}`);
    }
    io.err(`  (${issue.code})`);
  }
}

/** Avertissements : le projet est généré, mais ceci mérite d'être lu. */
export function printWarnings(io: Io, warnings: readonly Issue<string>[]): void {
  for (const warning of warnings) {
    io.out(`! ${warning.message}`);
  }
}

/** Une erreur d'usage : ce qui ne va pas, et la commande qui aurait marché. */
export function usageError(io: Io, message: string, suggestion?: string): 2 {
  io.err(`✗ ${message}`);
  if (suggestion !== undefined) {
    io.err(`  → ${suggestion}`);
  }
  return 2;
}
