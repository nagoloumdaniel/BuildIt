'use server';

import { homedir } from 'node:os';
import { isHostedEnvironment } from '../lib/hosting';
import { type DialogOutcome, openNativeDialog } from './picker/native-dialog';

/**
 * Les Server Actions de l'explorateur natif.
 *
 * Elles ne prennent qu'un **point de départ** optionnel et ne rendent qu'un
 * chemin. Aucune lecture de dossier, aucune écriture : choisir n'est pas
 * agir, et l'action qui suivra (analyser, cloner, générer) revalidera le
 * chemin de son côté.
 */

/**
 * Vrai quand l'explorateur peut s'ouvrir : local seulement.
 *
 * L'écran l'appelle au montage pour décider entre le bouton « Choisir un
 * dossier » et le champ de saisie — plutôt que de proposer un bouton qui
 * échouera, puis d'expliquer pourquoi.
 */
export async function canOpenNativePickerAction(): Promise<boolean> {
  return !isHostedEnvironment();
}

export async function pickFolderAction(startAt?: unknown): Promise<DialogOutcome> {
  if (isHostedEnvironment()) {
    return { ok: false, reason: 'unsupported' };
  }
  return openNativeDialog('folder', startAt);
}

export async function pickFileAction(startAt?: unknown): Promise<DialogOutcome> {
  if (isHostedEnvironment()) {
    return { ok: false, reason: 'unsupported' };
  }
  return openNativeDialog('file', startAt);
}

/**
 * Le dossier où poser la boîte quand l'écran n'a rien à proposer.
 *
 * Le dossier personnel, pas la racine du disque : c'est là que les projets
 * d'un développeur vivent, et deux clics de moins.
 */
export async function pickerHomeAction(): Promise<string> {
  return homedir();
}
