import type { ReactElement } from 'react';

/**
 * Le logo, dans les deux thèmes.
 *
 * Il est posé en **image de fond** d'une boîte dont la taille est donnée par le
 * code (`.pf-logo-mark`, dans `globals.css`) : le navigateur ne télécharge
 * alors que le fichier du thème **affiché**, et changer de thème échange
 * l'image sans JavaScript — c'est le même `data-theme` qui pose déjà les
 * couleurs, donc aucune bascule après hydratation et aucun clignotement.
 *
 * Pourquoi pas `next/image` : le moteur d'images de Next exige `sharp`, absent
 * de cette installation — toute requête `/_next/image` répondait 400 et le logo
 * s'affichait cassé dans les deux thèmes. Les deux fichiers sont des assets
 * fixes, déjà à leur taille d'affichage : les servir directement est plus sûr,
 * plus rapide (18 ko au lieu de 170 ko) et supprime une dépendance native.
 *
 * `aria-hidden` : le logo est décoratif ici, le nom « BuildIt » est écrit à côté
 * en texte. Le lecteur d'écran ne doit pas le lire deux fois.
 */

export interface LogoProps {
  /** La hauteur d'affichage en pixels. La largeur suit le rapport 550:453. */
  readonly size?: number;
  readonly className?: string;
}

const RATIO = 550 / 453;

export function Logo({ size = 28, className }: LogoProps): ReactElement {
  const width = Math.round(size * RATIO);
  return (
    <span
      aria-hidden="true"
      className={`pf-logo-mark${className === undefined ? '' : ` ${className}`}`}
      style={{ height: size, width }}
    />
  );
}

/** Le logo et le nom, tels qu'ils apparaissent dans l'en-tête et le pied. */
export function Wordmark({ size = 26 }: LogoProps): ReactElement {
  return (
    <span style={{ alignItems: 'center', display: 'inline-flex', gap: '0.55rem' }}>
      <Logo size={size} />
      <span
        style={{
          fontSize: '1.0625rem',
          fontWeight: 660,
          letterSpacing: '-0.025em',
        }}
      >
        BuildIt
      </span>
    </span>
  );
}
