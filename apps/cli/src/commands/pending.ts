import { EXIT, type ExitCode, type Io } from '../io.js';

/**
 * Commandes du §21 qui ne sont pas encore livrées. Elles existent et le
 * disent, avec un code d'usage : ni commande muette, ni commande qui fait
 * semblant.
 *
 * `doctor` n'y est plus : le diagnostic d'un projet est livré (§16), avec son
 * score, ses constats et ses corrections proposées.
 */
export const PENDING: Readonly<Record<string, string>> = {
  analyze: 'V1 — analyse d’un projet existant',
  upgrade: 'V2 — mise à niveau d’un projet généré',
};

export function pending(command: string, io: Io): ExitCode {
  io.err(`pf ${command} n'est pas encore disponible : ${PENDING[command]}.`);
  return EXIT.usage;
}
