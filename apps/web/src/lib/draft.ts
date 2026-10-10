import { STEP_ORDER, type StepId } from './flow';

/**
 * Le brouillon du parcours (§3) : ce qui survit à la fermeture de l'onglet.
 *
 * Deux invariants, tenus par des tests :
 *
 * 1. **Aucune valeur sensible.** Une variable d'environnement n'a ici qu'un
 *    *nom* (`envVarNames`) — le §6.8 interdit d'afficher ou de stocker une
 *    valeur, et le type du brouillon est ce qui le rend impossible.
 * 2. **Une reprise impossible rend un brouillon frais.** JSON corrompu,
 *    version décalée, champ manquant : l'écran s'ouvre, il ne plante pas.
 *
 * La forme persistée est écrite **champ par champ** (`toPersisted`) : un champ
 * ajouté au brouillon ne part pas dans `localStorage` sans qu'on l'ait décidé.
 */

export const DRAFT_VERSION = 1;
export const DRAFT_STORAGE_KEY = 'pf-draft';

export interface DraftState {
  version: number;
  step: StepId;
  mode: 'guided' | 'expert';
  name: string;
  targets: string[];
  type?: string;
  architecture?: string;
  technologies: string[];
  capabilities: string[];
  /** Noms des variables d'environnement requises — jamais leurs valeurs (§6.8). */
  envVarNames: string[];
  infra: { docker: boolean; ci: boolean };
  /** Résolution du moteur, recalculée à chaque changement — jamais persistée. */
  resolution?: { status: 'certified' | 'experimental'; issues: readonly string[] };
}

/** Ce qui part réellement dans `localStorage`. */
interface PersistedDraft {
  version: number;
  step: string;
  mode: string;
  name: string;
  targets: string[];
  type?: string;
  architecture?: string;
  technologies: string[];
  capabilities: string[];
  envVarNames: string[];
  infra: { docker: boolean; ci: boolean };
}

export function freshDraft(): DraftState {
  return {
    version: DRAFT_VERSION,
    step: STEP_ORDER[0],
    mode: 'guided',
    name: '',
    targets: [],
    technologies: [],
    capabilities: [],
    envVarNames: [],
    infra: { docker: false, ci: false },
  };
}

/**
 * Le JSON relu, ou `null` s'il n'est pas exploitable.
 *
 * Les valeurs sont lues par **déstructuration** : le brouillon vient de
 * `localStorage`, donc d'un `Record<string, unknown>` — or le tsconfig interdit
 * l'accès par point sur une signature d'index (`noPropertyAccessFromIndexSignature`),
 * et les crochets feraient râler Biome. La déstructuration satisfait les deux.
 */
function parsePersisted(raw: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    const candidate = parsed as Record<string, unknown>;
    const { version, name, targets } = candidate;
    if (version !== DRAFT_VERSION) {
      return null;
    }
    if (typeof name !== 'string' || !Array.isArray(targets)) {
      return null;
    }
    return candidate;
  } catch {
    return null;
  }
}

/** Les seules chaînes d'un tableau JSON — le reste est écarté, sans lever. */
function strings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function step(value: unknown): StepId {
  return STEP_ORDER.find((known) => known === value) ?? STEP_ORDER[0];
}

function infra(value: unknown): { docker: boolean; ci: boolean } {
  if (typeof value !== 'object' || value === null) {
    return { docker: false, ci: false };
  }
  const { docker, ci } = value as Record<string, unknown>;
  return { docker: docker === true, ci: ci === true };
}

export function loadDraft(storage: Storage | null): DraftState {
  const raw = storage?.getItem(DRAFT_STORAGE_KEY) ?? null;
  if (raw === null) {
    return freshDraft();
  }
  const persisted = parsePersisted(raw);
  if (persisted === null) {
    return freshDraft();
  }
  const {
    step: persistedStep,
    mode,
    name,
    targets,
    type,
    architecture,
    technologies,
    capabilities,
    envVarNames,
    infra: persistedInfra,
  } = persisted;
  const filled = optionalString(type);
  const shape = optionalString(architecture);
  return {
    version: DRAFT_VERSION,
    step: step(persistedStep),
    mode: mode === 'expert' ? 'expert' : 'guided',
    name: name as string,
    targets: strings(targets),
    ...(filled === undefined ? {} : { type: filled }),
    ...(shape === undefined ? {} : { architecture: shape }),
    technologies: strings(technologies),
    capabilities: strings(capabilities),
    envVarNames: strings(envVarNames),
    infra: infra(persistedInfra),
  };
}

function toPersisted(draft: DraftState): PersistedDraft {
  return {
    version: DRAFT_VERSION,
    step: draft.step,
    mode: draft.mode,
    name: draft.name,
    targets: [...draft.targets],
    ...(draft.type === undefined ? {} : { type: draft.type }),
    ...(draft.architecture === undefined ? {} : { architecture: draft.architecture }),
    technologies: [...draft.technologies],
    capabilities: [...draft.capabilities],
    envVarNames: [...draft.envVarNames],
    infra: { ...draft.infra },
    // `resolution` n'est pas ici, et ne doit jamais y être : elle est
    // recalculée par le moteur à chaque changement.
  };
}

export function saveDraft(storage: Storage | null, draft: DraftState): void {
  storage?.setItem(DRAFT_STORAGE_KEY, JSON.stringify(toPersisted(draft)));
}

export function clearDraft(storage: Storage | null): void {
  storage?.removeItem(DRAFT_STORAGE_KEY);
}
