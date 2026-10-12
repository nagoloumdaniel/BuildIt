import { createMessageFormatter, type Issue } from '@buildit/validation';

export const GITHUB_CODES = [
  'GITHUB_NETWORK',
  'GITHUB_UNAUTHORIZED',
  'GITHUB_FORBIDDEN',
  'GITHUB_RATE_LIMITED',
  'GITHUB_NOT_FOUND',
  'GITHUB_REPO_EXISTS',
  'GITHUB_INVALID',
  'GITHUB_UNEXPECTED',
  'GITHUB_NOT_COLLABORATOR',
  'GITHUB_DEVICE_DISABLED',
  'GITHUB_DEVICE_EXPIRED',
  'GITHUB_DEVICE_DENIED',
  'GITHUB_OAUTH_CODE_INVALID',
  'GITHUB_OAUTH_STATE_INVALID',
  'GITHUB_TOKEN_INVALID',
  'GITHUB_KEYCHAIN_UNAVAILABLE',
  'GITHUB_KEYCHAIN_FAILED',
  'GITHUB_TOKEN_FROM_ENV',
  'GITHUB_SESSION_SECRET_MISSING',
] as const;

export type GitHubCode = (typeof GITHUB_CODES)[number];
export type GitHubIssue = Issue<GitHubCode>;

const MESSAGES: Readonly<Record<GitHubCode, string>> = {
  GITHUB_NETWORK: 'GitHub est injoignable : {value}',
  GITHUB_UNAUTHORIZED: 'GitHub refuse la connexion : le jeton est invalide, expiré ou révoqué.',
  GITHUB_FORBIDDEN: 'GitHub refuse cette action au compte connecté : {value}',
  GITHUB_RATE_LIMITED: 'Limite de requêtes GitHub atteinte.',
  GITHUB_NOT_FOUND: 'Introuvable sur GitHub : {value}.',
  GITHUB_REPO_EXISTS: 'Le dépôt {value} existe déjà sur ce compte : rien n’a été créé.',
  GITHUB_INVALID: 'GitHub refuse la demande : {value}',
  GITHUB_UNEXPECTED: 'Réponse inattendue de GitHub ({value}).',
  GITHUB_NOT_COLLABORATOR: '{value} n’est ni collaborateur ni invité sur ce dépôt.',
  GITHUB_DEVICE_DISABLED:
    'Cette application GitHub n’accepte pas la connexion par code (device flow), ou son identifiant est faux.',
  GITHUB_DEVICE_EXPIRED: 'Le code a expiré avant d’être saisi : rien n’a été connecté.',
  GITHUB_DEVICE_DENIED: 'Connexion refusée sur github.com : rien n’a été connecté.',
  GITHUB_OAUTH_CODE_INVALID:
    'Code d’autorisation invalide ou déjà utilisé : relancez la connexion.',
  GITHUB_OAUTH_STATE_INVALID:
    'La réponse de GitHub ne correspond à aucune connexion en cours : relancez-la depuis BuildIt, pas depuis un lien gardé de côté.',
  GITHUB_TOKEN_INVALID: 'Ce jeton n’a pas la forme d’un jeton GitHub.',
  GITHUB_KEYCHAIN_UNAVAILABLE:
    'Le trousseau du système est indisponible ({value}) : le jeton n’est jamais stocké en clair, il n’a donc pas été enregistré.',
  GITHUB_KEYCHAIN_FAILED: 'Le trousseau du système a refusé l’opération ({value}).',
  GITHUB_TOKEN_FROM_ENV:
    'Le jeton vient de la variable PF_GITHUB_TOKEN : BuildIt ne la modifie pas.',
  GITHUB_SESSION_SECRET_MISSING:
    'SESSION_SECRET n’est pas configurée sur ce déploiement : le jeton ne peut pas être scellé dans un cookie par visiteur, il n’a donc pas été enregistré.',
};

const messageFor = createMessageFormatter(MESSAGES);

export function githubIssue(code: GitHubCode, value = '', hint?: string): GitHubIssue {
  const base = { code, path: [], message: messageFor(code, { value }) };
  return hint === undefined ? base : { ...base, hint };
}
