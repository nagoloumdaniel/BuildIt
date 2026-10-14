import type { ReactElement } from 'react';
import { TECH_BRAND_IDS, TECH_BRAND_TITLES } from './tech-icons.generated';

/**
 * Le logo d'une technologie du catalogue.
 *
 * Les tracés vivent dans `public/tech-sprite.svg`, pas dans le bundle : 196
 * marques y pèsent 300 ko que le navigateur télécharge **une fois**, met en
 * cache, et n'exécute jamais. Les embarquer en JavaScript aurait coûté le
 * même poids à chaque chargement de page, analysé par le moteur.
 *
 * Les 87 entrées du catalogue sans marque connue (`arktype`, `valibot`,
 * `sqlx`…) ne sont pas un trou : elles prennent un **monogramme**, dessiné
 * avec les mêmes tokens, de la même taille, au même endroit. Une grille où un
 * tiers des cases est vide se lit moins bien qu'une grille où un tiers des
 * cases est une lettre.
 *
 * La couleur suit `currentColor` : aucune marque ne sort son orange ou son
 * bleu au milieu d'une grille la page garde ses deux couleurs, et le logo
 * reste lisible dans les deux thèmes. C'est un choix, pas un oubli.
 */

export interface TechIconProps {
  /** L'identifiant du catalogue : `next`, `tailwind`, `postgres`… */
  readonly id: string;
  /** Le nom lisible, quand le catalogue en a un de meilleur que la marque. */
  readonly name?: string;
  readonly size?: number;
  readonly className?: string;
}

/** La lettre du monogramme : la première du nom, ou de l'identifiant. */
export function monogram(id: string, name?: string): string {
  const source = (name ?? id).trim();
  return source === '' ? '?' : source.slice(0, 1).toUpperCase();
}

export function hasBrand(id: string): boolean {
  return TECH_BRAND_IDS.has(id);
}

export function brandTitle(id: string): string | undefined {
  return TECH_BRAND_TITLES[id];
}

export function TechIcon({ id, name, size = 20, className }: TechIconProps): ReactElement {
  const label = name ?? brandTitle(id) ?? id;

  if (!hasBrand(id)) {
    return (
      <span
        aria-label={label}
        className={className}
        role="img"
        style={{
          alignItems: 'center',
          background: 'var(--pf-surface-2)',
          border: '1px solid var(--pf-border)',
          borderRadius: `${Math.round(size * 0.28)}px`,
          color: 'var(--pf-muted)',
          display: 'inline-flex',
          flex: 'none',
          fontFamily: 'var(--pf-mono)',
          fontSize: `${Math.round(size * 0.52)}px`,
          fontWeight: 600,
          height: size,
          justifyContent: 'center',
          lineHeight: 1,
          width: size,
        }}
      >
        {monogram(id, name)}
      </span>
    );
  }

  return (
    <svg
      aria-label={label}
      className={className}
      focusable="false"
      height={size}
      role="img"
      style={{ flex: 'none' }}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Le `<title>` sert d'infobulle au survol ; `aria-label` est ce que lit
          le lecteur d'écran. Sans lui, la grille de logos du projet était
          annoncée comme une suite d'éléments vides. */}
      <title>{label}</title>
      <use href={`/tech-sprite.svg#t-${id}`} />
    </svg>
  );
}
