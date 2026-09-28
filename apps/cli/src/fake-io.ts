import type { Choice, Io, Prompter } from './io.js';

/** Réponses scriptées, consommées dans l'ordre ; une question en trop échoue. */
export type Answer = string | boolean;

export interface FakeIo extends Io {
  readonly stdout: string[];
  readonly stderr: string[];
  /** Questions posées, dans l'ordre. */
  readonly asked: string[];
  /** Choix proposés à chaque `select`. */
  readonly offered: Choice<string>[][];
  text(): { out: string; err: string };
}

export function fakeIo(
  options: {
    cwd?: string;
    env?: Record<string, string | undefined>;
    interactive?: boolean;
    answers?: Answer[];
    stdin?: string;
  } = {},
): FakeIo {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const asked: string[] = [];
  const offered: Choice<string>[][] = [];
  const answers = [...(options.answers ?? [])];

  function next(message: string): Answer {
    asked.push(message);
    if (answers.length === 0) {
      throw new Error(`Question inattendue : ${message}`);
    }
    return answers.shift() as Answer;
  }

  const prompter: Prompter = {
    async select<T extends string>(message: string, choices: readonly Choice<T>[]): Promise<T> {
      offered.push([...choices]);
      return next(message) as T;
    },
    async text(message, validate) {
      const value = String(next(message));
      const problem = validate?.(value);
      if (problem !== undefined) {
        throw new Error(problem);
      }
      return value;
    },
    async confirm(message) {
      return next(message) === true;
    },
    async secret(message) {
      return String(next(message));
    },
  };

  return {
    stdout,
    stderr,
    asked,
    offered,
    out: (line) => stdout.push(line),
    err: (line) => stderr.push(line),
    cwd: options.cwd ?? process.cwd(),
    env: options.env ?? {},
    interactive: options.interactive ?? false,
    prompter,
    readStdin: async () => options.stdin ?? '',
    text: () => ({ out: stdout.join('\n'), err: stderr.join('\n') }),
  };
}
