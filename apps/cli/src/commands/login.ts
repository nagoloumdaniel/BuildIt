import { parseArgs } from 'node:util';
import {
  GitHubClient,
  isTokenShaped,
  pollAccessToken,
  requestDeviceCode,
  SCOPES,
} from '@project-factory/github';
import { printIssues, usageError } from '../format.js';
import { tokenStore } from '../github-session.js';
import { EXIT, type ExitCode, type Io } from '../io.js';

export const LOGIN_USAGE: string = `Usage : pf login [--with-token] [--public-only]

Connexion à GitHub par code (device flow) : un code à saisir sur github.com,
aucun mot de passe ne passe par Project Factory. Le jeton est rangé dans le
trousseau du système, jamais dans un fichier.

  --with-token   Lit un jeton existant sur l'entrée standard, ou par une saisie
                 masquée — jamais en argument
  --public-only  Dépôts publics seulement (permission public_repo)`;

export const LOGOUT_USAGE: string = `Usage : pf logout

Retire le jeton GitHub du trousseau de cette machine.`;

/**
 * Identifiant de l'application OAuth de Project Factory. Pas un secret : il
 * figure dans chaque URL d'autorisation. Vide tant que l'application n'est pas
 * enregistrée sur GitHub (action de mainteneur) — `PF_GITHUB_CLIENT_ID` le
 * fournit en attendant.
 */
const CLIENT_ID = '';

const SCOPE_REASONS: Readonly<Record<string, string>> = {
  repo: 'cloner vos dépôts privés, créer un dépôt, gérer ses collaborateurs',
  public_repo: 'dépôts publics seulement : créer un dépôt public, gérer ses collaborateurs',
};

async function finish(io: Io, token: string): Promise<ExitCode> {
  const viewer = await new GitHubClient({ token, fetch: io.fetch }).viewer();
  if (!viewer.ok) {
    printIssues(io, viewer.issues);
    return EXIT.failure;
  }
  const store = tokenStore(io);
  const refusal = await store.set(token);
  if (refusal !== undefined) {
    printIssues(io, [refusal]);
    return EXIT.failure;
  }
  io.out(`✓ Connecté à GitHub : ${viewer.value.login}.`);
  io.out(
    `  Permissions : ${viewer.value.scopes.length === 0 ? 'celles du jeton à grain fin' : viewer.value.scopes.join(', ')}.`,
  );
  io.out(`  Jeton : ${store.location}.`);
  return EXIT.ok;
}

export async function login(args: readonly string[], io: Io): Promise<ExitCode> {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: {
      'with-token': { type: 'boolean', default: false },
      'public-only': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    io.out(LOGIN_USAGE);
    return EXIT.ok;
  }
  if (positionals.length > 0) {
    return usageError(
      io,
      'pf login ne prend aucun argument : un jeton passé ainsi resterait dans l’historique du shell.',
      'echo "$JETON" | pf login --with-token',
    );
  }

  const existing = await tokenStore(io).get();
  if (existing !== undefined) {
    const viewer = await new GitHubClient({ token: existing, fetch: io.fetch }).viewer();
    if (viewer.ok) {
      io.out(
        `Déjà connecté à GitHub : ${viewer.value.login}. Pour changer de compte : pf logout, puis pf login.`,
      );
      return EXIT.ok;
    }
  }

  if (values['with-token']) {
    const token = (
      io.interactive ? await io.prompter.secret('Jeton GitHub :') : await io.readStdin()
    ).trim();
    if (!isTokenShaped(token)) {
      return usageError(
        io,
        'Ce jeton n’a pas la forme d’un jeton GitHub.',
        'Créez-en un sur https://github.com/settings/tokens',
      );
    }
    return finish(io, token);
  }

  const clientId = io.env['PF_GITHUB_CLIENT_ID'] ?? CLIENT_ID;
  if (clientId === '') {
    io.err(
      '✗ La connexion par code n’est pas encore configurée : l’application OAuth de Project Factory n’est pas enregistrée.',
    );
    io.err(
      '  → Utilisez un jeton : echo "$JETON" | pf login --with-token (ou PF_GITHUB_CLIENT_ID=<identifiant>).',
    );
    return EXIT.failure;
  }
  const scopes = values['public-only'] ? SCOPES.publicOnly : SCOPES.full;
  io.out('Permissions demandées :');
  for (const scope of scopes) {
    io.out(`  ${scope} — ${SCOPE_REASONS[scope] ?? scope}`);
  }
  const code = await requestDeviceCode(io.fetch, clientId, scopes);
  if (!code.ok) {
    printIssues(io, code.issues);
    return EXIT.failure;
  }
  io.out('');
  io.out(`Ouvrez ${code.value.verificationUri} et saisissez le code : ${code.value.userCode}`);
  io.out('En attente de votre accord sur github.com…');
  const token = await pollAccessToken(io.fetch, clientId, code.value, { sleep: io.sleep });
  if (!token.ok) {
    printIssues(io, token.issues);
    return EXIT.failure;
  }
  return finish(io, token.value.token);
}

export async function logout(args: readonly string[], io: Io): Promise<ExitCode> {
  if (args.includes('--help') || args.includes('-h')) {
    io.out(LOGOUT_USAGE);
    return EXIT.ok;
  }
  if (args.length > 0) {
    return usageError(io, 'pf logout ne prend aucun argument.', LOGOUT_USAGE);
  }
  const store = tokenStore(io);
  const refusal = await store.delete();
  if (refusal !== undefined) {
    printIssues(io, [refusal]);
    return EXIT.failure;
  }
  io.out(`✓ Jeton retiré (${store.location}).`);
  io.out('  Pour le révoquer aussi côté GitHub : https://github.com/settings/applications');
  return EXIT.ok;
}
