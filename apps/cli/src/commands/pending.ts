import { EXIT, type ExitCode, type Io } from '../io.js';

/**
 * Commandes du §21 qui ne sont pas encore livrées. Elles existent et le
 * disent, avec un code d'usage : ni commande muette, ni commande qui fait
 * semblant.
 */
export const PENDING: Readonly<Record<string, string>> = {
  clone: 'Phase 7B — cloner un dépôt GitHub (par lien ou parmi les vôtres)',
  open: 'Phase 7B — ouvrir un projet local et installer ses dépendances',
  login: 'Phase 7B — connexion GitHub',
  logout: 'Phase 7B — déconnexion GitHub',
  repo: 'Phase 7B — créer le dépôt GitHub d’un projet',
  collab: 'Phase 7B — collaborateurs d’un dépôt',
  doctor: 'V1 — diagnostic d’un projet existant',
  analyze: 'V1 — analyse d’un projet existant',
  upgrade: 'V2 — mise à niveau d’un projet généré',
  share: 'Phase 9 — partage d’un projet par lien',
};

export function pending(command: string, io: Io): ExitCode {
  io.err(`pf ${command} n'est pas encore disponible : ${PENDING[command]}.`);
  return EXIT.usage;
}
