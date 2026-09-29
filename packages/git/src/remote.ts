import {
  createMessageFormatter,
  fail,
  type Issue,
  ok,
  type ParseResult,
} from '@project-factory/validation';

/**
 * Un lien de dépôt saisi par l'utilisateur, validé **avant** qu'aucune
 * commande Git ne le voie.
 *
 * Le danger est réel : `git clone` interprète un lien qui commence par `-`
 * comme une option (`--upload-pack=<commande>` exécute la commande), et le
 * transport `ext::` exécute une commande par construction. Une liste blanche
 * — HTTPS, SSH, le raccourci `propriétaire/dépôt` — plutôt qu'une liste noire
 * qu'un schéma oublié contournerait.
 */

export const REMOTE_CODES = [
  'GIT_REMOTE_EMPTY',
  'GIT_REMOTE_OPTION',
  'GIT_REMOTE_PROTOCOL',
  'GIT_REMOTE_LOCAL',
  'GIT_REMOTE_CREDENTIALS',
  'GIT_REMOTE_INVALID',
] as const;

export type RemoteCode = (typeof REMOTE_CODES)[number];
export type RemoteIssue = Issue<RemoteCode>;

const MESSAGES: Readonly<Record<RemoteCode, string>> = {
  GIT_REMOTE_EMPTY: 'Lien de dépôt vide.',
  GIT_REMOTE_OPTION:
    'Un lien de dépôt ne peut pas commencer par « - » : Git le lirait comme une option.',
  GIT_REMOTE_PROTOCOL: 'Protocole refusé : {value}. Seuls HTTPS et SSH sont acceptés.',
  GIT_REMOTE_LOCAL: '« {value} » est un chemin local, pas un dépôt distant.',
  GIT_REMOTE_CREDENTIALS:
    'Ce lien contient des identifiants : ils finiraient dans .git/config et dans les journaux.',
  GIT_REMOTE_INVALID: '« {value} » n’est pas un lien de dépôt reconnu.',
};

const messageFor = createMessageFormatter(MESSAGES);

function issue(code: RemoteCode, value: string, hint?: string): RemoteIssue {
  const base = { code, path: [], message: messageFor(code, { value }) };
  return hint === undefined ? base : { ...base, hint };
}

const FORMS =
  'Formes acceptées : https://github.com/propriétaire/dépôt, git@github.com:propriétaire/dépôt, propriétaire/dépôt.';

export interface GitHubRepository {
  readonly owner: string;
  readonly repo: string;
}

export interface GitRemote {
  /** Ce qui sera passé à `git`, et rien d'autre. */
  readonly url: string;
  readonly protocol: 'https' | 'ssh';
  readonly host: string;
  /** Présent quand le dépôt est sur github.com. */
  readonly github?: GitHubRepository;
}

/** Nom d'utilisateur ou d'organisation GitHub. */
const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
/** Nom de dépôt GitHub ; `.` et `..` exclus à part. */
const REPO = /^[A-Za-z0-9._-]{1,100}$/;
const HOST = /^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?(?::\d{1,5})?$/;
/** Chemin distant : pas de `-` en tête de segment, pas de caractère spécial. */
const REMOTE_PATH = /^(?!-)[A-Za-z0-9._~/-]+$/;

function githubRepository(host: string, path: string): GitHubRepository | undefined {
  if (host.toLowerCase() !== 'github.com') {
    return undefined;
  }
  const [owner = '', rawRepo = '', ...rest] = path.replace(/^\/+|\/+$/g, '').split('/');
  const repo = rawRepo.replace(/\.git$/, '');
  if (rest.length > 0 || !OWNER.test(owner) || !REPO.test(repo) || repo === '.' || repo === '..') {
    return undefined;
  }
  return { owner, repo };
}

function withGithub(remote: Omit<GitRemote, 'github'>, path: string): GitRemote {
  const github = githubRepository(remote.host, path);
  return github === undefined ? remote : { ...remote, github };
}

/** `propriétaire/dépôt`, `https://…`, `ssh://…` ou `git@hôte:chemin`. */
export function parseRemote(input: string): ParseResult<GitRemote, RemoteCode> {
  const value = input.trim();
  if (value === '') {
    return fail([issue('GIT_REMOTE_EMPTY', value, FORMS)]);
  }
  if (value.startsWith('-')) {
    return fail([issue('GIT_REMOTE_OPTION', value, FORMS)]);
  }
  // biome-ignore lint/suspicious/noControlCharactersInRegex: c'est précisément ce qu'on refuse
  if (/[\s\u0000-\u001f\u007f]/.test(value)) {
    return fail([issue('GIT_REMOTE_INVALID', value, FORMS)]);
  }
  // `<transport>::<adresse>` : syntaxe des helpers distants, dont `ext::`.
  const helper = /^([A-Za-z][A-Za-z0-9+.-]*)::/.exec(value);
  if (helper !== null) {
    return fail([issue('GIT_REMOTE_PROTOCOL', `${helper[1]}::`, FORMS)]);
  }

  const shorthand = /^([^/:@]+)\/([^/:@]+)$/.exec(value);
  if (shorthand !== null && !value.startsWith('.') && !value.startsWith('~')) {
    const [, owner = '', repo = ''] = shorthand;
    const name = repo.replace(/\.git$/, '');
    if (OWNER.test(owner) && REPO.test(name) && name !== '.' && name !== '..') {
      return ok({
        url: `https://github.com/${owner}/${name}.git`,
        protocol: 'https',
        host: 'github.com',
        github: { owner, repo: name },
      });
    }
    return fail([issue('GIT_REMOTE_INVALID', value, FORMS)]);
  }

  const scp = /^([A-Za-z0-9._-]+)@([^:/]+):(.+)$/.exec(value);
  if (scp !== null && !value.includes('://')) {
    const [, user = '', host = '', path = ''] = scp;
    if (
      user.startsWith('-') ||
      !HOST.test(host) ||
      !REMOTE_PATH.test(path) ||
      path.startsWith('/')
    ) {
      return fail([issue('GIT_REMOTE_INVALID', value, FORMS)]);
    }
    return ok(withGithub({ url: value, protocol: 'ssh', host }, path));
  }

  if (/^(?:\/|\.{1,2}(?:\/|$)|~|[A-Za-z]:[\\/])/.test(value)) {
    return fail([issue('GIT_REMOTE_LOCAL', value, FORMS)]);
  }

  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(value)?.[1]?.toLowerCase();
  if (scheme === undefined) {
    return fail([issue('GIT_REMOTE_INVALID', value, FORMS)]);
  }
  if (scheme === 'file') {
    return fail([issue('GIT_REMOTE_LOCAL', value, FORMS)]);
  }
  if (scheme !== 'https' && scheme !== 'ssh') {
    const hint = scheme === 'http' ? 'Utilisez https:// : http:// n’est pas chiffré.' : FORMS;
    return fail([issue('GIT_REMOTE_PROTOCOL', `${scheme}://`, hint)]);
  }

  // `https:///a` serait « réparé » en `https://a` par le parseur d'URL, mais
  // pas par Git : on n'accepte que ce que les deux lisent pareil.
  if (!/^[a-z]+:\/\/[^/]/i.test(value)) {
    return fail([issue('GIT_REMOTE_INVALID', value, FORMS)]);
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fail([issue('GIT_REMOTE_INVALID', value, FORMS)]);
  }
  const path = decodeURIComponent(url.pathname);
  if (
    url.host === '' ||
    !HOST.test(url.host) ||
    url.search !== '' ||
    url.hash !== '' ||
    path.length < 2 ||
    !REMOTE_PATH.test(path.slice(1))
  ) {
    return fail([issue('GIT_REMOTE_INVALID', value, FORMS)]);
  }
  if (scheme === 'https' && (url.username !== '' || url.password !== '')) {
    return fail([
      issue(
        'GIT_REMOTE_CREDENTIALS',
        value,
        'Retirez-les du lien ; pour un dépôt privé GitHub, connectez-vous : pf login.',
      ),
    ]);
  }
  if (scheme === 'ssh' && url.password !== '') {
    return fail([issue('GIT_REMOTE_CREDENTIALS', value, 'Retirez le mot de passe du lien.')]);
  }
  return ok(withGithub({ url: value, protocol: scheme, host: url.host }, path));
}

/** Le lien web d'un dépôt GitHub. */
export function githubUrl(repository: GitHubRepository): string {
  return `https://github.com/${repository.owner}/${repository.repo}`;
}
