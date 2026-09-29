import type { CommandRunner } from '@project-factory/exec';
import { type GitHubIssue, githubIssue } from './errors.js';

/**
 * Le jeton GitHub, dans le trousseau du système (§20bis) : Keychain,
 * Secret Service (libsecret) ou le coffre de Windows.
 *
 * Deux règles, sans exception :
 * - le jeton passe **par l'entrée standard** de l'outil du trousseau, jamais
 *   en argument (`ps` montre les arguments à tous les utilisateurs) ;
 * - trousseau indisponible ⇒ refus. Aucun repli en clair dans un fichier.
 */

export interface TokenStore {
  /** Où vit le jeton, pour le dire à l'utilisateur. */
  readonly location: string;
  get(): Promise<string | undefined>;
  set(token: string): Promise<GitHubIssue | undefined>;
  delete(): Promise<GitHubIssue | undefined>;
}

const SERVICE = 'project-factory';
const ACCOUNT = 'github';

/**
 * Forme des jetons GitHub (`ghp_…`, `gho_…`, `github_pat_…`). La vérifier
 * avant de stocker, c'est aussi garantir que le jeton ne contient rien que
 * l'outil du trousseau pourrait interpréter.
 */
export const TOKEN_PATTERN: RegExp = /^[A-Za-z0-9_]{20,255}$/;

export function isTokenShaped(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

interface Backend {
  readonly location: string;
  readonly missing: string;
  readonly get: readonly [string, readonly string[], string | undefined];
  readonly set: (token: string) => readonly [string, readonly string[], string];
  readonly delete: readonly [string, readonly string[], string | undefined];
}

const VAULT =
  '[void][Windows.Security.Credentials.PasswordVault,Windows.Security.Credentials,ContentType=WindowsRuntime];$v=New-Object Windows.Security.Credentials.PasswordVault;';
const POWERSHELL = ['-NoProfile', '-NonInteractive', '-Command', '-'];

const BACKENDS: Partial<Record<NodeJS.Platform, Backend>> = {
  darwin: {
    location: 'Trousseau macOS',
    missing: 'l’outil « security » de macOS est introuvable',
    get: ['security', ['find-generic-password', '-s', SERVICE, '-a', ACCOUNT, '-w'], undefined],
    // `security -i` lit ses commandes sur l'entrée standard : le jeton n'est
    // jamais un argument de processus.
    set: (token) => [
      'security',
      ['-i'],
      `add-generic-password -U -s ${SERVICE} -a ${ACCOUNT} -w ${token}\n`,
    ],
    delete: ['security', ['delete-generic-password', '-s', SERVICE, '-a', ACCOUNT], undefined],
  },
  linux: {
    location: 'Secret Service (libsecret)',
    missing:
      'secret-tool est introuvable — installez libsecret-tools (Debian/Ubuntu) ou libsecret (Fedora, Arch), avec un trousseau actif (GNOME Keyring, KWallet)',
    get: ['secret-tool', ['lookup', 'service', SERVICE, 'account', ACCOUNT], undefined],
    set: (token) => [
      'secret-tool',
      // ASCII seulement : sous une locale non UTF-8 (C, POSIX — serveurs, CI),
      // secret-tool refuse un tiret cadratin dans l'étiquette.
      ['store', '--label=Project Factory - GitHub', 'service', SERVICE, 'account', ACCOUNT],
      token,
    ],
    delete: ['secret-tool', ['clear', 'service', SERVICE, 'account', ACCOUNT], undefined],
  },
  win32: {
    location: 'Gestionnaire d’identification Windows',
    missing: 'PowerShell est introuvable',
    get: [
      'powershell',
      POWERSHELL,
      `${VAULT}try{$c=$v.Retrieve('${SERVICE}','${ACCOUNT}');$c.RetrievePassword();[Console]::Out.Write($c.Password)}catch{exit 44}`,
    ],
    set: (token) => [
      'powershell',
      POWERSHELL,
      `${VAULT}$v.Add((New-Object Windows.Security.Credentials.PasswordCredential('${SERVICE}','${ACCOUNT}','${token}')))`,
    ],
    delete: [
      'powershell',
      POWERSHELL,
      `${VAULT}try{$v.Remove($v.Retrieve('${SERVICE}','${ACCOUNT}'))}catch{}`,
    ],
  },
};

/** Le trousseau de la plateforme, piloté par le `CommandRunner`. */
export function keychainStore(
  runner: CommandRunner,
  platform: NodeJS.Platform = process.platform,
): TokenStore {
  const backend = BACKENDS[platform];
  if (backend === undefined) {
    const unavailable = githubIssue(
      'GITHUB_KEYCHAIN_UNAVAILABLE',
      `plateforme ${platform}`,
      'Utilisez PF_GITHUB_TOKEN.',
    );
    return {
      location: 'aucun trousseau connu',
      get: async () => undefined,
      set: async () => unavailable,
      delete: async () => undefined,
    };
  }

  async function run([command, args, input]: readonly [
    string,
    readonly string[],
    string | undefined,
  ]): Promise<{ exitCode: number; output: string } | GitHubIssue> {
    try {
      return await runner.run(command, args, process.cwd(), input === undefined ? {} : { input });
    } catch {
      return githubIssue('GITHUB_KEYCHAIN_UNAVAILABLE', backend?.missing ?? command);
    }
  }

  return {
    location: backend.location,
    async get() {
      const result = await run(backend.get);
      if ('code' in result || result.exitCode !== 0) {
        return undefined;
      }
      const token = result.output.trim();
      return isTokenShaped(token) ? token : undefined;
    },
    async set(token) {
      if (!isTokenShaped(token)) {
        return githubIssue('GITHUB_TOKEN_INVALID');
      }
      const result = await run(backend.set(token));
      if ('code' in result) {
        return result;
      }
      // Jamais la sortie brute : elle pourrait citer ce qu'on lui a passé.
      return result.exitCode === 0
        ? undefined
        : githubIssue('GITHUB_KEYCHAIN_FAILED', `code ${result.exitCode}`);
    },
    async delete() {
      const result = await run(backend.delete);
      return 'code' in result ? result : undefined;
    },
  };
}

/**
 * Jeton fourni par l'environnement (`PF_GITHUB_TOKEN`), pour la CI : lu,
 * jamais écrit ni effacé par Project Factory.
 */
export function environmentStore(token: string): TokenStore {
  const refusal = githubIssue(
    'GITHUB_TOKEN_FROM_ENV',
    '',
    'Modifiez ou retirez la variable vous-même.',
  );
  return {
    location: 'variable PF_GITHUB_TOKEN',
    get: async () => token,
    set: async () => refusal,
    delete: async () => refusal,
  };
}
