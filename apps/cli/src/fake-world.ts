import type { CommandResult, CommandRunner, RunOptions } from '@project-factory/exec';
import type { Fetch } from '@project-factory/github';

export interface Call {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly options: RunOptions | undefined;
}

type Handler = (
  args: readonly string[],
  cwd: string,
  options: RunOptions | undefined,
) => Promise<CommandResult> | CommandResult;

/**
 * Un monde de test : un trousseau en mémoire (secret-tool), et les réponses
 * voulues pour git et les gestionnaires de paquets. Tout appel est noté.
 */
export function fakeWorld(
  handlers: Record<string, Handler> = {},
  keychain: { value?: string } = {},
): CommandRunner & { calls: Call[]; keychain: { value?: string } } {
  const calls: Call[] = [];
  return {
    calls,
    keychain,
    async run(command, args, cwd, options) {
      calls.push({ command, args, cwd, options });
      if (command === 'secret-tool') {
        if (args[0] === 'store') {
          keychain.value = options?.input ?? '';
          return { exitCode: 0, output: '' };
        }
        if (args[0] === 'clear') {
          delete keychain.value;
          return { exitCode: 0, output: '' };
        }
        return keychain.value === undefined
          ? { exitCode: 1, output: '' }
          : { exitCode: 0, output: keychain.value };
      }
      const handler = handlers[command];
      if (handler === undefined) {
        throw Object.assign(new Error(`spawn ${command} ENOENT`), { code: 'ENOENT' });
      }
      return handler(args, cwd, options);
    },
  };
}

type Reply = { status: number; body?: unknown; headers?: Record<string, string> };

/** Faux `fetch` : une réponse (ou une file) par « MÉTHODE chemin ». */
export function fakeFetch(
  routes: Record<string, Reply | Reply[]>,
): Fetch & { requests: { method: string; url: string; body?: string }[] } {
  const requests: { method: string; url: string; body?: string }[] = [];
  const fetcher = async (input: string, init: RequestInit = {}): Promise<Response> => {
    const method = init.method ?? 'GET';
    const url = new URL(input);
    requests.push({
      method,
      url: input,
      ...(typeof init.body === 'string' ? { body: init.body } : {}),
    });
    const route = routes[`${method} ${url.pathname}`];
    const reply = Array.isArray(route) ? route.shift() : route;
    if (reply === undefined) {
      throw new Error(`route absente : ${method} ${url.pathname}`);
    }
    return new Response(reply.status === 204 ? null : JSON.stringify(reply.body ?? {}), {
      status: reply.status,
      headers: reply.headers ?? {},
    });
  };
  return Object.assign(fetcher, { requests });
}

export interface GitState {
  origin?: string;
  commit?: boolean;
  push?: { exitCode: number; output: string };
  commitResult?: { exitCode: number; output: string };
}

/** Un faux git qui répond comme un dépôt réel dans `dir`. */
export function fakeGit(dir: string, state: GitState = {}): Handler {
  return (args: readonly string[]) => {
    const line = args
      .filter(
        (arg) => !arg.startsWith('protocol.') && !arg.startsWith('credential.') && arg !== '-c',
      )
      .join(' ');
    if (line === 'rev-parse --show-toplevel') {
      return { exitCode: 0, output: `${dir}\n` };
    }
    if (line === 'rev-parse --verify --quiet HEAD') {
      return { exitCode: state.commit === false ? 1 : 0, output: '' };
    }
    if (line === 'remote get-url origin') {
      return state.origin === undefined
        ? { exitCode: 2, output: 'error: No such remote' }
        : { exitCode: 0, output: `${state.origin}\n` };
    }
    if (line.startsWith('push')) {
      return state.push ?? { exitCode: 0, output: '' };
    }
    if (line.startsWith('commit')) {
      return state.commitResult ?? { exitCode: 0, output: '' };
    }
    return { exitCode: 0, output: '' };
  };
}
