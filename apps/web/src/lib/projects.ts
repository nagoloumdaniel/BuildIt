/**
 * Les projets déjà générés depuis ce navigateur.
 *
 * Pourquoi `localStorage` et pas le serveur : le configurateur n'a pas de
 * compte ni de base. Le rapport de génération vit déjà en `sessionStorage` —
 * volontairement, il ne survit pas à la fermeture de l'onglet. Mais la
 * **liste** des projets, elle, doit survivre : un projet généré hier est
 * toujours sur le disque, et retrouver son dossier ne devrait pas demander de
 * le chercher à la main.
 *
 * Ce qui est conservé est donc le minimum pour le retrouver et le rouvrir :
 * un nom, un dossier, une date, un poids. Pas l'archive — plusieurs
 * mégaoctets par projet rempliraient le quota du navigateur en quelques
 * générations, et le projet est déjà sur le disque.
 *
 * Un projet généré **n'est plus un brouillon** (§6.14) : c'est cette liste qui
 * le porte, pas la reprise de parcours.
 */

import { type Manifest, parseManifest } from '@buildit/manifest';

export const PROJECTS_STORAGE_KEY = 'pf-projects';

/** Au-delà, les plus anciens tombent : une liste sans fin n'est pas consultée. */
const MAX_PROJECTS = 50;

export interface StoredProject {
  /** Stable et unique : nom plus horodatage, pour une clé de React sûre. */
  readonly id: string;
  readonly name: string;
  /** Le dossier absolu écrit sur le disque. Vide en hébergé (rien n'est écrit). */
  readonly directory: string;
  readonly fileCount: number;
  readonly bytes: number;
  /** ISO 8601, en UTC. L'affichage le formate dans la langue courante. */
  readonly generatedAt: string;
  /** Les technologies retenues, pour afficher leurs logos dans la liste. */
  readonly technologies: readonly string[];
  /**
   * Le manifest qui a produit le projet.
   *
   * C'est lui qui permet de **refaire** quelque chose d'un projet déjà généré :
   * télécharger l'archive, l'écrire dans un autre dossier, montrer son
   * architecture. Quelques centaines d'octets de JSON, pas l'archive : le
   * moteur reproduit le même projet à partir des mêmes choix (§9). Absent
   * pour un projet généré avant cette version — l'écran le dit au lieu de
   * proposer un geste qui ne pourrait pas aboutir.
   */
  readonly manifest?: Manifest;
  /**
   * L'adresse du dépôt GitHub associé, quand il a été créé ou retrouvé par
   * BuildIt. Jamais construite à partir du nom du projet : une URL supposée
   * mènerait à la page d'un inconnu ou à une 404.
   */
  readonly repositoryUrl?: string;
}

export interface ProjectStorage {
  read(key: string): string | null;
  write(key: string, value: string): void;
}

export function browserProjectStorage(): ProjectStorage {
  return {
    read(key) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    write(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // Quota plein ou stockage refusé : la liste est un confort.
      }
    },
  };
}

/** Une entrée du stockage, validée — ce qui vient de `localStorage` est hostile. */
function parseProject(value: unknown): StoredProject | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const raw = value as Record<string, unknown>;
  const id = raw['id'];
  const name = raw['name'];
  const generatedAt = raw['generatedAt'];
  if (typeof id !== 'string' || typeof name !== 'string' || typeof generatedAt !== 'string') {
    return undefined;
  }
  const technologies = Array.isArray(raw['technologies'])
    ? raw['technologies'].filter((item): item is string => typeof item === 'string')
    : [];
  // Le manifest relu passe par le schéma : un objet trafiqué dans le stockage
  // n'atteindra jamais le moteur sous une forme qu'il n'aurait pas acceptée.
  const manifest = raw['manifest'] === undefined ? undefined : parseManifest(raw['manifest']);
  const repositoryUrl = isGithubUrl(raw['repositoryUrl']) ? raw['repositoryUrl'] : undefined;
  return {
    id,
    name,
    directory: typeof raw['directory'] === 'string' ? raw['directory'] : '',
    fileCount: typeof raw['fileCount'] === 'number' ? raw['fileCount'] : 0,
    bytes: typeof raw['bytes'] === 'number' ? raw['bytes'] : 0,
    generatedAt,
    technologies,
    ...(manifest?.ok === true ? { manifest: manifest.value } : {}),
    ...(repositoryUrl === undefined ? {} : { repositoryUrl }),
  };
}

/**
 * Une adresse de dépôt GitHub réelle : `https://github.com/<propriétaire>/<dépôt>`.
 *
 * Tout le reste est refusé — y compris une adresse GitHub qui ne désigne pas un
 * dépôt (`https://github.com/settings`) : le bouton « Ouvrir sur GitHub » ne
 * doit mener qu'au dépôt du projet.
 */
export function isGithubUrl(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  try {
    const url = new URL(value);
    const parts = url.pathname.split('/').filter((part) => part !== '');
    return (
      url.protocol === 'https:' &&
      url.hostname === 'github.com' &&
      parts.length === 2 &&
      parts.every((part) => /^[A-Za-z0-9._-]+$/.test(part))
    );
  } catch {
    return false;
  }
}

/** Retient l'adresse du dépôt GitHub d'un projet, une fois qu'elle est connue. */
export function attachRepository(
  storage: ProjectStorage,
  directory: string,
  url: string,
): readonly StoredProject[] {
  const projects = loadProjects(storage);
  if (!isGithubUrl(url) || directory === '') {
    return projects;
  }
  const next = projects.map((project) =>
    project.directory === directory ? { ...project, repositoryUrl: url } : project,
  );
  save(storage, next);
  return next;
}

export function loadProjects(storage: ProjectStorage): readonly StoredProject[] {
  const raw = storage.read(PROJECTS_STORAGE_KEY);
  if (raw === null) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map(parseProject)
      .filter((project): project is StoredProject => project !== undefined);
  } catch {
    // Une entrée corrompue n'est pas une panne : la liste repart vide.
    return [];
  }
}

function save(storage: ProjectStorage, projects: readonly StoredProject[]): void {
  storage.write(PROJECTS_STORAGE_KEY, JSON.stringify(projects.slice(0, MAX_PROJECTS)));
}

/**
 * Ajoute un projet en tête.
 *
 * Une deuxième génération du **même nom dans le même dossier** remplace la
 * première plutôt que de s'empiler : c'est le même projet, régénéré.
 */
export function rememberProject(
  storage: ProjectStorage,
  project: StoredProject,
): readonly StoredProject[] {
  const existing = loadProjects(storage).filter(
    (item) => !(item.name === project.name && item.directory === project.directory),
  );
  const next = [project, ...existing];
  save(storage, next);
  return next.slice(0, MAX_PROJECTS);
}

export function forgetProject(storage: ProjectStorage, id: string): readonly StoredProject[] {
  const next = loadProjects(storage).filter((project) => project.id !== id);
  save(storage, next);
  return next;
}

export function forgetAllProjects(storage: ProjectStorage): readonly StoredProject[] {
  save(storage, []);
  return [];
}

/** L'identifiant d'une génération : lisible, trié par date, sans collision. */
export function projectId(name: string, at: Date = new Date()): string {
  return `${name}-${at.getTime()}`;
}

/** Les deux derniers, pour le tableau de bord. */
export function recentProjects(
  projects: readonly StoredProject[],
  count = 2,
): readonly StoredProject[] {
  return projects.slice(0, count);
}

const UNITS = ['o', 'ko', 'Mo', 'Go'] as const;

/** Le poids écrit : 1 536 octets → « 1,5 ko » en français, « 1.5 kB » en anglais. */
export function formatBytes(bytes: number, locale: 'fr' | 'en' = 'fr'): string {
  const units = locale === 'en' ? (['B', 'kB', 'MB', 'GB'] as const) : UNITS;
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return `0 ${units[0]}`;
  }
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const text =
    unit === 0
      ? String(Math.round(value))
      : locale === 'en'
        ? value.toFixed(1)
        : value.toFixed(1).replace('.', ',');
  return `${text} ${units[unit] ?? units[0]}`;
}

/** La date, dans la langue courante. Une date brute ISO ne se lit pas. */
export function formatDate(iso: string, locale: 'fr' | 'en' = 'fr'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}
