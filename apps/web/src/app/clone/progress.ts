/**
 * L'avancement d'un `git clone`, lu dans sa sortie.
 *
 * `git clone --progress` écrit son avancement sur la sortie d'erreur, par
 * retours chariot (`\r`) plutôt que par lignes : une même ligne est réécrite
 * en place. On la découpe donc sur `\r` **et** `\n`, et on ne garde que la
 * dernière mesure vue la seule qui soit encore vraie.
 *
 * Pourquoi un pourcentage composé plutôt que celui de git : git recommence à
 * zéro à chaque phase (comptage, compression, réception, deltas, extraction).
 * Une barre qui va quatre fois de 0 à 100 n'informe pas. Chaque phase reçoit
 * donc une part du total, choisie d'après ce qu'elle coûte réellement sur un
 * dépôt ordinaire la réception domine, le reste est court.
 *
 * Les bornes sont assumées : elles rendent la barre **monotone**, ce qui est
 * la seule promesse qu'une barre doit tenir. Elle n'est pas une estimation de
 * durée, et rien ici n'en invente une.
 */

export type ClonePhase =
  | 'starting'
  | 'counting'
  | 'compressing'
  | 'receiving'
  | 'resolving'
  | 'checkout'
  | 'installing'
  | 'done';

export interface CloneProgress {
  readonly phase: ClonePhase;
  /** De 0 à 100, tous phases confondues. Toujours croissant. */
  readonly percent: number;
  /** La mesure brute que git affiche : « 520/1234 », « 1.20 MiB ». */
  readonly detail?: string;
}

/**
 * L'ordre des phases, du début à la fin.
 *
 * C'est lui, et non le pourcentage, qui décide si une mesure fait **reculer**
 * l'affichage : deux phases peuvent partager une borne (l'installation et la
 * fin sont toutes deux à 99-100), et git lui-même réaffiche une phase
 * antérieure quand une sous-tâche se termine.
 */
const RANK: Readonly<Record<ClonePhase, number>> = {
  starting: 0,
  counting: 1,
  compressing: 2,
  receiving: 3,
  resolving: 4,
  checkout: 5,
  installing: 6,
  done: 7,
};

/** La part du total attribuée à chaque phase : début et fin. */
const SPAN: Readonly<Record<ClonePhase, readonly [number, number]>> = {
  starting: [0, 2],
  counting: [2, 10],
  compressing: [10, 24],
  receiving: [24, 86],
  resolving: [86, 95],
  checkout: [95, 99],
  installing: [99, 99],
  done: [100, 100],
};

/** Le motif d'une ligne d'avancement de git, dans les deux langues qu'il parle. */
const LINE =
  /^(?:remote:\s*)?(Counting objects|Compressing objects|Receiving objects|Resolving deltas|Updating files|Checking out files):\s+(\d+)%\s*\(([^)]*)\)(?:,\s*([^,]+))?/;

const PHASE_OF: Readonly<Record<string, ClonePhase>> = {
  'Counting objects': 'counting',
  'Compressing objects': 'compressing',
  'Receiving objects': 'receiving',
  'Resolving deltas': 'resolving',
  'Updating files': 'checkout',
  'Checking out files': 'checkout',
};

/** Le pourcentage global d'une phase à `within` % d'elle-même. */
export function overallPercent(phase: ClonePhase, within: number): number {
  const [from, to] = SPAN[phase];
  const ratio = Math.min(100, Math.max(0, within)) / 100;
  return Math.round(from + (to - from) * ratio);
}

/**
 * La dernière mesure contenue dans un morceau de sortie, s'il y en a une.
 *
 * `undefined` quand le morceau ne porte aucune ligne d'avancement : du bruit
 * (« Cloning into… », un avertissement) ne doit pas faire bouger la barre.
 */
export function parseCloneChunk(chunk: string): CloneProgress | undefined {
  let found: CloneProgress | undefined;
  for (const raw of chunk.split(/[\r\n]+/)) {
    const line = raw.trim();
    if (line === '') {
      continue;
    }
    const match = LINE.exec(line);
    if (match === null) {
      continue;
    }
    const [, name, percentText, counts, rate] = match;
    const phase = name === undefined ? undefined : PHASE_OF[name];
    if (phase === undefined) {
      continue;
    }
    const within = Number.parseInt(percentText ?? '0', 10);
    const detail = rate === undefined ? counts : `${counts} · ${rate.trim()}`;
    found = {
      phase,
      percent: overallPercent(phase, Number.isFinite(within) ? within : 0),
      ...(detail === undefined || detail === '' ? {} : { detail }),
    };
  }
  return found;
}

/**
 * Un lecteur de flux : il garde la dernière mesure et refuse de reculer.
 *
 * Git peut réafficher une phase antérieure (une sous-tâche qui se termine) ;
 * une barre qui redescend est pire que pas de barre du tout. La fusion est
 * celle de `mergeCloneProgress` : la phase la plus avancée **et** le
 * pourcentage le plus haut gagnent, jamais l'un sans l'autre.
 */
export function createCloneProgressReader(): (chunk: string) => CloneProgress | undefined {
  let previous: CloneProgress | null = null;
  return (chunk) => {
    const parsed = parseCloneChunk(chunk);
    if (parsed === undefined) {
      return undefined;
    }
    previous = mergeCloneProgress(previous, parsed);
    return previous;
  };
}

/** Le rang d'une phase : plus il est grand, plus la phase est avancée. */
export function clonePhaseRank(phase: ClonePhase): number {
  return RANK[phase];
}

/**
 * Vrai pour un nom de phase connu.
 *
 * Sert à la frontière réseau : un événement dont la phase n'est pas reconnue
 * n'est pas une mesure, c'est une réponse qu'on ne sait pas lire.
 */
export function isClonePhase(value: unknown): value is ClonePhase {
  return typeof value === 'string' && Object.hasOwn(RANK, value);
}

/**
 * La fusion de deux mesures, pour un affichage qui ne recule **jamais**.
 *
 * La mesure la plus avancée gagne phase d'abord, pourcentage ensuite et
 * c'est la mesure retenue qui donne son `detail` : garder la phase la plus
 * avancée avec la mesure brute d'une phase antérieure afficherait deux choses
 * qui ne vont pas ensemble. Une phase de rang inférieur est donc ignorée en
 * bloc : c'est exactement ce qu'on veut quand git réaffiche « Counting
 * objects » après « Receiving objects ».
 */
export function mergeCloneProgress(
  previous: CloneProgress | null,
  next: CloneProgress,
): CloneProgress {
  if (previous === null) {
    return next;
  }
  if (clonePhaseRank(next.phase) < clonePhaseRank(previous.phase)) {
    return previous;
  }
  return { ...next, percent: Math.max(previous.percent, next.percent) };
}
