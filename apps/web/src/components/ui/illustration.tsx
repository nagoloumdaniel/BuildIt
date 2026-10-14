import type { ReactElement } from 'react';

/**
 * Les illustrations de la plateforme.
 *
 * Trois traits, un seul vocabulaire : des formes géométriques larges, un trait
 * de 1,5 px, aucune perspective, aucune couleur en dur tout vient de
 * `currentColor`, donc du thème. C'est ce qui permet à la même illustration de
 * servir en clair et en sombre sans second fichier.
 *
 * Elles ne racontent pas une histoire : elles occupent la place d'un vide ou
 * d'un arrêt sans le remplir de bruit. Une page d'erreur sans image est un
 * cul-de-sac gris ; une page d'erreur avec une saynète est une excuse.
 *
 * - `forge` : deux pièces qui se composent la matière et la pièce finie ;
 * - `lost` : un chemin qui s'interrompt la page n'existe pas ;
 * - `empty` : une caisse ouverte il n'y a encore rien, et c'est normal.
 */

export type IllustrationName = 'forge' | 'lost' | 'empty';

export interface IllustrationProps {
  readonly name?: IllustrationName;
  /** La largeur et la hauteur, en pixels. */
  readonly size?: number;
  readonly className?: string;
}

/** Le tracé de chaque illustration, dans une grille de 96 × 96. */
function Shapes({ name }: { name: IllustrationName }): ReactElement {
  switch (name) {
    case 'lost':
      return (
        <>
          <path d="M14 74h18a12 12 0 0 0 12-12V50" strokeDasharray="6 7" />
          <circle cx="70" cy="30" r="12" />
          <path d="M70 22v9M70 37v.5" />
          <path d="M44 74h38" strokeDasharray="6 7" />
        </>
      );
    case 'empty':
      return (
        <>
          <path d="M20 38h56v38H20z" />
          <path d="M14 38l12-14h44l12 14" />
          <path d="M48 24v14" />
          <path d="M36 52h24" opacity="0.55" />
        </>
      );
    default:
      return (
        <>
          <rect height="38" rx="10" width="38" x="16" y="24" />
          <rect
            fill="color-mix(in oklab, currentColor 10%, transparent)"
            height="38"
            rx="10"
            width="38"
            x="42"
            y="36"
          />
          <path d="M66 18v8M80 26h-8M78 12l-6 6" />
        </>
      );
  }
}

export function Illustration({
  name = 'forge',
  size = 96,
  className,
}: IllustrationProps): ReactElement {
  return (
    <svg
      aria-hidden="true"
      className={`pf-illustration${className === undefined ? '' : ` ${className}`}`}
      fill="none"
      focusable="false"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      viewBox="0 0 96 96"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <Shapes name={name} />
    </svg>
  );
}
