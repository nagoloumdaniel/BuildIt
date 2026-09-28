/**
 * Le CLI `pf`, façade du moteur Forge (§9, §21).
 *
 * Exporté pour les tests et pour qui voudrait l'embarquer : `run` prend des
 * arguments et des entrées-sorties, et rend un code de sortie.
 */

export { HELP, run, VERSION } from './cli.js';
export { configDir } from './commands/key.js';
export type { Choice, ExitCode, Io, Prompter } from './io.js';
export { EXIT } from './io.js';
export { nodeIo } from './node-io.js';
