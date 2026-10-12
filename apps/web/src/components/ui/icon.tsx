import type { ReactElement, SVGProps } from 'react';

/**
 * Le jeu d'icônes de l'interface.
 *
 * Un seul fichier, un seul gabarit : grille 24, trait `currentColor` de 1,75,
 * bouts et jointures arrondis. Pas de dépendance d'icônes — un paquet de 1 500
 * glyphes pour les trente qu'on utilise coûterait plus en poids et en montage
 * qu'il ne rapporte, et la cohérence de trait serait à surveiller de toute
 * façon.
 *
 * Règle d'usage : une icône **accompagne** un libellé, elle ne le remplace que
 * lorsque le geste est universel (fermer, copier) — et porte alors un
 * `aria-label`. Sans libellé ni `aria-label`, elle reste décorative
 * (`aria-hidden`), ce qui est le défaut ici.
 */

const PATHS = {
  home: [
    'M3 10.2a2 2 0 0 1 .7-1.5l7-6a2 2 0 0 1 2.6 0l7 6a2 2 0 0 1 .7 1.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    'M9.5 21v-7.5h5V21',
  ],
  plus: ['M5 12h14', 'M12 5v14'],
  minus: ['M5 12h14'],
  check: ['m20 6-11 11-5-5'],
  close: ['M18 6 6 18', 'm6 6 12 12'],
  arrowLeft: ['m12 19-7-7 7-7', 'M19 12H5'],
  arrowRight: ['M5 12h14', 'm12 5 7 7-7 7'],
  arrowUpRight: ['M7 17 17 7', 'M8 7h9v9'],
  chevronRight: ['m9 18 6-6-6-6'],
  chevronDown: ['m6 9 6 6 6-6'],
  chevronLeft: ['m15 18-6-6 6-6'],
  folder: [
    'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z',
  ],
  folderOpen: [
    'm6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2',
  ],
  file: [
    'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z',
    'M14 2v4a2 2 0 0 0 2 2h4',
    'M9 13h6',
    'M9 17h6',
  ],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3'],
  upload: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm17 8-5-5-5 5', 'M12 3v12'],
  gitBranch: ['M6 3v12', 'M18 9a9 9 0 0 1-9 9'],
  github: [
    'M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4',
    'M9 18c-4.51 2-5-2-7-2',
  ],
  package: [
    'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
    'm3.3 7 8.7 5 8.7-5',
    'M12 22V12',
    'm7.5 4.3 9 5.1',
  ],
  layers: [
    'M12.8 2.2a2 2 0 0 0-1.6 0L2.6 6.1a1 1 0 0 0 0 1.8l8.6 3.9a2 2 0 0 0 1.6 0l8.6-3.9a1 1 0 0 0 0-1.8z',
    'm22 12.6-9.2 4.2a2 2 0 0 1-1.6 0L2 12.6',
    'm22 17.6-9.2 4.2a2 2 0 0 1-1.6 0L2 17.6',
  ],
  database: [
    'M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5',
    'M3 12c0 1.7 4 3 9 3s9-1.3 9-3',
    'M12 8c5 0 9-1.3 9-3s-4-3-9-3-9 1.3-9 3 4 3 9 3z',
  ],
  cloud: ['M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9z'],
  shield: [
    'M20 13c0 5-3.5 7.5-7.7 9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.5 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z',
  ],
  key: ['m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4', 'm21 2-9.6 9.6'],
  terminal: ['m4 17 6-6-6-6', 'M12 19h8'],
  cpu: [
    'M9 9h6v6H9z',
    'M9 2v3',
    'M15 2v3',
    'M9 19v3',
    'M15 19v3',
    'M2 9h3',
    'M2 15h3',
    'M19 9h3',
    'M19 15h3',
  ],
  search: ['m21 21-4.3-4.3'],
  settings: [
    'M4 21v-7',
    'M4 10V3',
    'M12 21v-9',
    'M12 8V3',
    'M20 21v-5',
    'M20 12V3',
    'M2 14h4',
    'M10 8h4',
    'M18 16h4',
  ],
  sun: [
    'M12 2v2',
    'M12 20v2',
    'm4.9 4.9 1.4 1.4',
    'm17.7 17.7 1.4 1.4',
    'M2 12h2',
    'M20 12h2',
    'm6.3 17.7-1.4 1.4',
    'm19.1 4.9-1.4 1.4',
  ],
  moon: ['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z'],
  monitor: ['M2 4.5h20v12H2z', 'M8 21h8', 'M12 16.5V21'],
  languages: ['m5 8 6 6', 'm4 14 6-6 2-3', 'M2 5h12', 'M7 2h1', 'm22 22-5-10-5 10', 'M14 18h6'],
  info: ['M12 16v-4', 'M12 8h.01'],
  warning: [
    'm21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3',
    'M12 9v4',
    'M12 17h.01',
  ],
  trash: [
    'M3 6h18',
    'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
    'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  ],
  copy: [
    'M8 8h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2z',
    'M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2',
  ],
  externalLink: [
    'M15 3h6v6',
    'M10 14 21 3',
    'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
  ],
  link: [
    'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.8 1.7',
    'M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
  ],
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M22 21v-2a4 4 0 0 0-3-3.9',
    'M16 3.1a4 4 0 0 1 0 7.8',
  ],
  lock: ['M4 11h16v11H4z', 'M7.5 11V7a4.5 4.5 0 0 1 9 0v4'],
  play: ['m7 4 13 8-13 8z'],
  refresh: ['M3 12a9 9 0 1 0 9-9 9.8 9.8 0 0 0-6.7 2.7L3 8', 'M3 3v5h5'],
  zap: [
    'M4 14a1 1 0 0 1-.8-1.6l9.9-10.2a.5.5 0 0 1 .9.5l-1.9 6A1 1 0 0 0 13 10h7a1 1 0 0 1 .8 1.6l-9.9 10.2a.5.5 0 0 1-.9-.5l1.9-6A1 1 0 0 0 11 14z',
  ],
  clock: ['M12 6v6l4 2'],
  grid: ['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M14 14h7v7h-7z', 'M3 14h7v7H3z'],
  list: ['M3 5h.01', 'M3 12h.01', 'M3 19h.01', 'M8 5h13', 'M8 12h13', 'M8 19h13'],
  sparkles: [
    'M12 2.4 13.6 8a2 2 0 0 0 1.4 1.4l5.6 1.6-5.6 1.6a2 2 0 0 0-1.4 1.4L12 19.6 10.4 14a2 2 0 0 0-1.4-1.4L3.4 11 9 9.4A2 2 0 0 0 10.4 8z',
    'M19 3v4',
    'M21 5h-4',
  ],
  hammer: [
    'm15 12-8.4 8.4a1 1 0 1 1-3-3L12 9',
    'm18 15 4-4',
    'm21.5 11.5-1.9-1.9A2 2 0 0 1 19 8.2V7l-2.3-2.3a6 6 0 0 0-4.2-1.7L9 3l.9.8A6.2 6.2 0 0 1 12 8.4V10l2 2h1.2a2 2 0 0 1 1.4.6l1.9 1.9',
  ],
  compass: ['m16 8-2.5 6.5L7 17l2.5-6.5z'],
  globe: ['M2 12h20', 'M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z'],
  book: [
    'M4 19.5A2.5 2.5 0 0 1 6.5 17H20',
    'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
  ],
  eye: ['M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z'],
  filter: ['M3 5h18', 'M7 12h10', 'M10 19h4'],
  send: ['m22 2-7 20-4-9-9-4z', 'M22 2 11 13'],
  history: ['M3 12a9 9 0 1 0 2.6-6.4L3 8', 'M3 3v5h5', 'M12 8v4.5l3 1.8'],
} as const;

/** Les cercles et ellipses que le tracé seul ne rend pas. */
const SHAPES: Partial<Record<IconName, ReactElement>> = {
  search: <circle cx="11" cy="11" r="7.5" key="c" />,
  info: <circle cx="12" cy="12" r="9.5" key="c" />,
  clock: <circle cx="12" cy="12" r="9.5" key="c" />,
  globe: <circle cx="12" cy="12" r="9.5" key="c" />,
  compass: <circle cx="12" cy="12" r="9.5" key="c" />,
  sun: <circle cx="12" cy="12" r="4" key="c" />,
  cpu: <rect x="4" y="4" width="16" height="16" rx="2" key="r" />,
  monitor: <rect x="2" y="3" width="20" height="13.5" rx="2" key="r" />,
  gitBranch: (
    <g key="g">
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
    </g>
  ),
  key: <circle cx="7.5" cy="15.5" r="5" key="c" />,
  users: <circle cx="9" cy="7" r="4" key="c" />,
  lock: <rect x="4" y="11" width="16" height="11" rx="2" key="r" />,
  eye: <circle cx="12" cy="12" r="3" key="c" />,
  file: <path d="M15 2v5h5" key="p" />,
  grid: <g key="g" />,
};

export type IconName = keyof typeof PATHS;

export const ICON_NAMES = Object.keys(PATHS) as readonly IconName[];

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  readonly name: IconName;
  /** En pixels. 16 accompagne un libellé, 20 un titre, 24 et plus une vignette. */
  readonly size?: number;
  /** Donné : l'icône devient un élément d'interface nommé, pas une décoration. */
  readonly label?: string;
}

export function Icon({ name, size = 16, label, ...rest }: IconProps): ReactElement {
  const shape = SHAPES[name];
  return (
    <svg
      aria-hidden={label === undefined ? true : undefined}
      aria-label={label}
      data-icon={name}
      fill="none"
      focusable="false"
      height={size}
      role={label === undefined ? undefined : 'img'}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      {shape}
      {PATHS[name].map((d) => (
        <path d={d} key={d} />
      ))}
    </svg>
  );
}
