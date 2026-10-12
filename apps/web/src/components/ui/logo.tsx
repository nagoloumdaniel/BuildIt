import Image from 'next/image';
import type { ReactElement } from 'react';

/**
 * Le logo, dans les deux thèmes.
 *
 * Les deux fichiers sont dans le document ; le CSS en cache un
 * (`.pf-logo-on-light` / `.pf-logo-on-dark` dans `globals.css`). Pourquoi pas
 * un état React qui choisirait le bon : le thème n'est connu qu'après
 * hydratation, et le serveur rendrait donc toujours le logo clair — un
 * clignotement à chaque chargement en thème sombre, exactement ce que le
 * script anti-clignotement du `layout` évite pour les couleurs.
 *
 * Les fichiers viennent de `assets/brand/`, nommés d'après **le fond sur
 * lequel ils se posent**. Ce sont encore des PNG de 550×453 : ils sont servis
 * en 2× de leur taille d'affichage et `priority` est réservé à l'en-tête, qui
 * est au-dessus de la ligne de flottaison.
 */

export interface LogoProps {
  /** La hauteur d'affichage en pixels. La largeur suit le rapport 550:453. */
  readonly size?: number;
  /** Vrai dans l'en-tête : l'image est préchargée plutôt que différée. */
  readonly priority?: boolean;
  readonly className?: string;
}

const RATIO = 550 / 453;

export function Logo({ size = 28, priority = false, className }: LogoProps): ReactElement {
  const width = Math.round(size * RATIO);
  const common = {
    alt: '',
    height: size,
    priority,
    width,
    // Le logo est décoratif : le nom « BuildIt » est écrit à côté en texte.
    // Un `alt` vide évite que le lecteur d'écran le lise deux fois.
    style: { height: size, width: 'auto' } as const,
  };
  return (
    <span className={className} style={{ display: 'inline-flex', flex: 'none' }}>
      <Image {...common} className="pf-logo-on-light" src="/brand/logo-on-light.png" />
      <Image {...common} className="pf-logo-on-dark" src="/brand/logo-on-dark.png" />
    </span>
  );
}

/** Le logo et le nom, tels qu'ils apparaissent dans l'en-tête et le pied. */
export function Wordmark({ size = 26, priority = false }: LogoProps): ReactElement {
  return (
    <span style={{ alignItems: 'center', display: 'inline-flex', gap: '0.55rem' }}>
      <Logo priority={priority} size={size} />
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
