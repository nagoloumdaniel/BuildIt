import { ENV_NAME_PATTERN } from '@buildit/manifest';
import { STEP_ORDER, type StepId } from './flow';

/**
 * Le brouillon du parcours (§3) : ce qui survit à la fermeture de l'onglet.
 *
 * Deux invariants, tenus par des tests :
 *
 * 1. **Aucune valeur sensible.** Une variable d'environnement n'a ici qu'un
 *    *nom* (`envVarNames`) le §6.8 interdit d'afficher ou de stocker une
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
  /** Noms des variables d'environnement requises jamais leurs valeurs (§6.8). */
  envVarNames: string[];
  /**
   * Variables ajoutées à la main à l'écran Environnement des **noms**
   * seulement (`ENV_NAME_PATTERN`), écrits vides dans `.env.example`.
   * Absent : aucune.
   */
  customEnv?: string[];
  infra: { docker: boolean; ci: boolean };
  /**
   * Le projet est généré (archive téléchargée ou dossier écrit) : plus rien ne
   * se modifie. Persisté avec le reste, parce que le verrou doit survivre à un
   * rechargement et au bouton Précédent du navigateur. Absent : rien n'est
   * encore généré.
   */
  generated?: true;
  /** Résolution du moteur, recalculée à chaque changement jamais persistée. */
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
  customEnv?: string[];
  infra: { docker: boolean; ci: boolean };
  generated?: true;
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
 * `localStorage`, donc d'un `Record<string, unknown>` or le tsconfig interdit
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

/** Les seules chaînes d'un tableau JSON le reste est écarté, sans lever. */
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
    customEnv,
    infra: persistedInfra,
    generated,
  } = persisted;
  const custom = strings(customEnv).filter((name) => ENV_NAME_PATTERN.test(name));
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
    ...(custom.length === 0 ? {} : { customEnv: custom }),
    infra: infra(persistedInfra),
    ...(generated === true ? { generated: true as const } : {}),
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
    ...(draft.customEnv === undefined || draft.customEnv.length === 0
      ? {}
      : { customEnv: [...draft.customEnv] }),
    infra: { ...draft.infra },
    ...(draft.generated === true ? { generated: true as const } : {}),
    // `resolution` n'est pas ici, et ne doit jamais y être : elle est
    // recalculée par le moteur à chaque changement.
  };
}

/**
 * Vrai si les deux brouillons se **persisteraient à l'identique**.
 *
 * C'est la question que pose `SessionStore.attach` : brancher `localStorage`
 * après l'hydratation relit un brouillon, et si c'est celui qu'on avait déjà,
 * l'annoncer comme un changement fait rejouer les effets des écrans pour rien
 * (mesuré : le Stack Builder chargeait son catalogue deux fois par visite,
 * §8bis). La comparaison passe par la forme **persistée** : un champ ajouté à
 * `toPersisted` est donc comparé sans qu'on y pense, et `resolution` jamais
 * persistée, recalculée par le moteur ne compte pas.
 *
 * Elle est volontairement stricte sur l'ordre des tableaux : notifier un
 * changement qui n'en est pas un coûte un rendu, ne pas notifier un vrai
 * changement coûterait la reprise du brouillon.
 */
export function samePersistedDraft(a: DraftState, b: DraftState): boolean {
  return JSON.stringify(toPersisted(a)) === JSON.stringify(toPersisted(b));
}

/** Deux listes de chaînes, même ordre, mêmes valeurs. */
function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** La valeur lue du stockage, sauf si la mémoire l'a changée depuis la création du store. */
function keep<T>(stored: T, current: T, baseline: T): T {
  return Object.is(current, baseline) ? stored : current;
}

/**
 * La liste qui gagne, mais la **référence** courante quand la valeur ne change
 * pas : c'est elle que `React.useMemo` compare.
 */
function keepList(stored: string[], current: string[], baseline: string[]): string[] {
  const winner = sameList(current, baseline) ? stored : current;
  return sameList(winner, current) ? current : winner;
}

/**
 * Le brouillon **relu du stockage**, recouvert par ce que l'application a
 * changé en mémoire depuis la création du store.
 *
 * `attach` branche le stockage dans un effet du provider, donc **après** les
 * effets des écrans, qui sont ses enfants et `StepShell` y écrit l'étape de
 * l'URL courante. Le brouillon persisté est plus ancien que cette écriture :
 * le relire ne doit pas la défaire (sans quoi le brouillon retient l'étape
 * quittée, et la reprise du §3 repart du mauvais écran).
 *
 * Deuxième règle, discrète mais c'est elle qui coûtait cher : un tableau dont
 * la valeur ne change pas **garde sa référence**. Sans cela, `targets` et
 * `technologies` sont neufs à chaque branchement, la sélection mémoïsée de
 * l'écran change d'identité, et l'écran recharge son catalogue pour des valeurs
 * identiques mesuré deux fois par visite sur le Stack Builder (§8bis).
 */
export function restorePersistedDraft(
  stored: DraftState,
  current: DraftState,
  baseline: DraftState,
): DraftState {
  const type = keep(stored.type, current.type, baseline.type);
  const architecture = keep(stored.architecture, current.architecture, baseline.architecture);
  const generated = keep(stored.generated, current.generated, baseline.generated);
  const customEnv = keep(stored.customEnv, current.customEnv, baseline.customEnv);
  return {
    version: stored.version,
    step: keep(stored.step, current.step, baseline.step),
    mode: keep(stored.mode, current.mode, baseline.mode),
    name: keep(stored.name, current.name, baseline.name),
    targets: keepList(stored.targets, current.targets, baseline.targets),
    ...(type === undefined ? {} : { type }),
    ...(architecture === undefined ? {} : { architecture }),
    technologies: keepList(stored.technologies, current.technologies, baseline.technologies),
    capabilities: keepList(stored.capabilities, current.capabilities, baseline.capabilities),
    envVarNames: keepList(stored.envVarNames, current.envVarNames, baseline.envVarNames),
    ...(customEnv === undefined || customEnv.length === 0 ? {} : { customEnv }),
    infra: keep(stored.infra, current.infra, baseline.infra),
    ...(generated === true ? { generated: true as const } : {}),
    // `resolution` n'est jamais persistée : le brouillon relu ne la porte pas,
    // et un écran la recalcule de toute façon.
  };
}

export function saveDraft(storage: Storage | null, draft: DraftState): void {
  storage?.setItem(DRAFT_STORAGE_KEY, JSON.stringify(toPersisted(draft)));
}

export function clearDraft(storage: Storage | null): void {
  storage?.removeItem(DRAFT_STORAGE_KEY);
}
