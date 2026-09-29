import type { CommandRunner } from '@project-factory/exec';
import type { Fetch } from '@project-factory/github';

/**
 * Ce que le CLI échange avec le monde, rendu injectable : les tests pilotent
 * `run` sans terminal, sans processus, et lisent ce qu'il a écrit.
 */

export interface Choice<T extends string> {
  readonly value: T;
  readonly label: string;
  readonly hint?: string;
  /** Affichée mais non choisissable — avec la raison dans `hint`. */
  readonly disabled?: boolean;
}

export interface Prompter {
  select<T extends string>(message: string, choices: readonly Choice<T>[]): Promise<T>;
  text(message: string, validate?: (value: string) => string | undefined): Promise<string>;
  confirm(message: string): Promise<boolean>;
  /** Saisie masquée : rien n'est renvoyé à l'écran. */
  secret(message: string): Promise<string>;
}

export interface Io {
  out(text: string): void;
  err(text: string): void;
  readonly cwd: string;
  readonly env: Readonly<Record<string, string | undefined>>;
  /** Un humain est là pour répondre : sinon, toute question devient une erreur. */
  readonly interactive: boolean;
  readonly prompter: Prompter;
  /** Contenu de l'entrée standard, quand elle n'est pas un terminal. */
  readStdin(): Promise<string>;
  /** Lance git, pnpm, l'outil du trousseau — jamais par un shell. */
  readonly runner: CommandRunner;
  /** Vers l'API GitHub. */
  readonly fetch: Fetch;
  readonly platform: NodeJS.Platform;
  /** Attente entre deux interrogations de GitHub (connexion par code). */
  sleep(seconds: number): Promise<void>;
}

/** Codes de sortie : 0 succès, 1 le moteur a refusé ou échoué, 2 mauvais usage. */
export const EXIT = { ok: 0, failure: 1, usage: 2 } as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];
