import { parseRemote } from '@buildit/git';
import { GitHubClient } from '@buildit/github';
import { describeIssues, type SessionDeps } from '../github/session';

/**
 * Supprimer le **dépôt GitHub** d'un projet, depuis la liste des projets (§6.24).
 *
 * Le geste part d'une adresse (`StoredProject.repositoryUrl`), pas d'un dossier :
 * un projet dont le dossier a été effacé garde son dépôt, et la suppression doit
 * rester possible. L'adresse est donc relue par `parseRemote`, le même lecteur
 * que le clone et le dépôt : aucune expression régulière parallèle.
 *
 * `'gone'` n'est **pas** un échec : un dépôt déjà supprimé côté GitHub (ou
 * introuvable pour le compte connecté) laisse le projet dans le même état qu'une
 * suppression d'ici. L'appelant détache alors le projet et peut proposer de le
 * reconnecter à un nouveau dépôt, sans que rien n'ait cassé.
 */

export type DeleteRepositoryOutcome =
  | { readonly ok: true; readonly status: 'deleted' | 'gone'; readonly full: string }
  | {
      readonly ok: false;
      readonly reason: 'invalid' | 'notConnected' | 'failed';
      readonly message: string;
    };

export async function deleteGithubRepository(
  deps: SessionDeps,
  url: unknown,
): Promise<DeleteRepositoryOutcome> {
  const link = typeof url === 'string' ? url.trim() : '';
  const parsed = parseRemote(link);
  const github = parsed.ok ? parsed.value.github : undefined;
  if (!parsed.ok || github === undefined) {
    return {
      ok: false,
      reason: 'invalid',
      message: `« ${link} » n’est pas une adresse de dépôt GitHub : rien n’a été supprimé.`,
    };
  }

  const token = await deps.store.get();
  if (token === undefined) {
    return {
      ok: false,
      reason: 'notConnected',
      message: 'Connectez-vous à GitHub avant de supprimer un dépôt.',
    };
  }

  const client = new GitHubClient({ token, fetch: deps.fetch });
  const result = await client.deleteRepository({ owner: github.owner, name: github.repo });
  if (result.ok) {
    return {
      ok: true,
      status: result.value,
      full: `${github.owner}/${github.repo}`,
    };
  }
  return { ok: false, reason: 'failed', message: describeIssues(result.issues).join(' ') };
}
