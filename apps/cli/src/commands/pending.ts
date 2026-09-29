import { EXIT, type ExitCode, type Io } from '../io.js';

/**
 * Commandes du §21 qui ne sont pas encore livrées. Elles existent et le
 * disent, avec un code d'usage : ni commande muette, ni commande qui fait
 * semblant.
 */
export const PENDING: Readonly<Record<string, string>> = {
  doctor: 'V1 — diagnostic d’un projet existant',
  analyze: 'V1 — analyse d’un projet existant',
  upgrade: 'V2 — mise à niveau d’un projet généré',
  share: 'Phase 9 — partage d’un projet par lien',
};

export function pending(command: string, io: Io): ExitCode {
  io.err(`pf ${command} n'est pas encore disponible : ${PENDING[command]}.`);
  return EXIT.usage;
}
