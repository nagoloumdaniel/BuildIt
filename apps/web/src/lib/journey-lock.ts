import type { DraftState } from './draft';
import type { StepId } from './flow';

/**
 * Le verrou d'un projet généré.
 *
 * Une fois l'archive téléchargée ou le dossier écrit, le projet existe hors
 * d'ici : revenir modifier un choix ferait diverger le brouillon de ce qui a
 * réellement été produit, sans rien changer au disque. Le parcours se referme
 * donc sur ses deux derniers écrans, Génération et Rapport.
 *
 * Fonctions pures : la décision se teste sans routeur ni stockage, et le cadre
 * d'étape n'a plus qu'à l'exécuter.
 */

/** Ce que le verrou lit du brouillon : rien d'autre ne compte. */
export type LockSource = Pick<DraftState, 'generated' | 'step'>;

/** Les seuls écrans encore visibles une fois le projet généré. */
const OPEN_WHEN_GENERATED: readonly StepId[] = ['generate', 'report'];

/** Le projet est-il généré, donc figé ? */
export function isGenerated(draft: Pick<DraftState, 'generated'>): boolean {
  return draft.generated === true;
}

/**
 * Où renvoyer quelqu'un qui arrive sur `step` (retour du navigateur, adresse
 * tapée, lien gardé) ; `null` s'il peut rester.
 *
 * Le Rapport si c'est là que le parcours s'était arrêté : y revenir est ce
 * qu'on attend après un retour arrière de trop. Sinon la Génération, le seul
 * autre écran ouvert, d'où le Rapport reste à un clic.
 */
export function lockedRedirect(step: StepId, draft: LockSource): StepId | null {
  if (!isGenerated(draft) || OPEN_WHEN_GENERATED.includes(step)) {
    return null;
  }
  return draft.step === 'report' ? 'report' : 'generate';
}

/**
 * Le brouillon sur lequel décider : celui du stockage s'il est généré, sinon
 * celui de la mémoire.
 *
 * Au chargement d'une adresse, le cadre écrit l'étape de l'URL en mémoire
 * **avant** que le stockage ne soit branché, et ce branchement garde l'écriture
 * la plus récente. Le brouillon en mémoire dit alors « stack » alors que le
 * parcours s'était arrêté au Rapport ; le stockage, lui, n'a pas encore été
 * réécrit et dit vrai. Sans stockage (navigation privée), la mémoire suffit.
 */
export function lockSource(memory: LockSource, stored: LockSource): LockSource {
  return isGenerated(stored) ? stored : memory;
}
