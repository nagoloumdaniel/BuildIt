/**
 * Les commandes à copier après une copie hébergée.
 *
 * Une page web ne lance aucun programme sur la machine : pour un vrai clone
 * (avec l'historique) et pour installer les dépendances, l'écran donne les
 * commandes exactes, à coller dans un terminal. Elles sont construites ici,
 * hors de la vue, pour être testées sans rien monter.
 *
 * Le lien et le nom de dossier ont déjà été validés côté serveur
 * (`parseRemote` refuse espaces et caractères de contrôle, le nom ne garde que
 * lettres, chiffres, `.`, `-` et `_`). On les cite quand même si besoin :
 * une commande copiée doit marcher telle quelle dans PowerShell comme dans
 * bash.
 */

const PLAIN = /^[A-Za-z0-9._@:/+=~-]+$/;

/** Une valeur sûre dans un shell, entre guillemets si elle en a besoin. */
export function shellQuote(value: string): string {
  return PLAIN.test(value) ? value : `'${value.replace(/'/g, `'"'"'`)}'`;
}

export interface CloneCommands {
  /** `git clone <lien> <dossier>` : la copie avec tout l'historique. */
  readonly clone: string;
  readonly cd: string;
  /** `pnpm install`, `pip install -r requirements.txt`… quand le projet est reconnu. */
  readonly install?: string;
}

export function cloneCommands(url: string, folder: string, install?: string): CloneCommands {
  const name = shellQuote(folder);
  return {
    clone: `git clone ${shellQuote(url)} ${name}`,
    cd: `cd ${name}`,
    ...(install === undefined || install === '' ? {} : { install }),
  };
}
