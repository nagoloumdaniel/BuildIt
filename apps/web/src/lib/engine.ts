import { optionsFor, resolve, type Selection } from '@buildit/compatibility';
import { planProject } from '@buildit/generator';
import type { Manifest } from '@buildit/manifest';
import { PRESETS, type PresetId } from '@buildit/presets';
import { type Category, loadCatalogue, type Registry } from '@buildit/registry';
import 'server-only';

/**
 * Le seul endroit où le web parle au moteur (8B.2).
 *
 * Les écrans et les Server Actions qui les alimentent ne consomment que ce
 * fichier. Recopier une règle du moteur ici la ferait diverger du CLI, et
 * « mêmes choix ⇒ même projet » (§9) cesserait d'être vrai au premier
 * ajustement. L'adaptateur traduit donc des **types du moteur** vers des vues
 * sérialisables, et rien d'autre.
 *
 * `server-only` est la garde du 8B.2 : l'import lève à la compilation si un
 * composant client tente de charger ce module. Le catalogue et le pipeline
 * lisent des fichiers et pèsent leur poids de code ils n'ont rien à faire
 * dans un bundle navigateur.
 *
 * Trois écarts assumés au plan, dictés par les sources :
 *
 * - `loadRegistry` n'a jamais chargé le catalogue : il valide une liste de
 *   fiches non fiables. L'entrée officielle est `loadCatalogue()`, synchrone.
 * - `planProject` est synchrone. Les fonctions restent `async` : les Server
 *   Actions le sont de toute façon, et un aperçu dérivé un jour de
 *   `generateProject` (asynchrone) ne cassera pas ses appelants.
 * - `resolveSelection` rend les **messages** du moteur, pas ses codes : le §12
 *   exige une justification lisible, et le brouillon affiche ces chaînes telles
 *   quelles. Les codes restent dans le moteur, où les tests s'y branchent ;
 *   ici, c'est l'utilisateur qui lit.
 */

/** Une technologie nommée, avec sa documentation officielle quand le registry la connaît. */
export interface TechnologyRef {
  id: string;
  label: string;
  docs?: string;
}

export interface OptionView {
  id: string;
  label: string;
  category: string;
  /**
   * Les plateformes que cette fiche sert (`entry.targets`).
   *
   * L'écran en a besoin pour appliquer la **même** règle d'exclusivité que le
   * moteur : deux frameworks d'une catégorie exclusive cohabitent s'ils visent
   * des plateformes différentes (Next.js web + Expo mobile), et se remplacent
   * sinon.
   */
  targets: readonly string[];
  state: 'selected' | 'available' | 'blocked';
  reason?: string;
  /** La documentation officielle (`docs` de la fiche, vérifiée par le registry). */
  docs?: string;
  /**
   * Le code du refus, pour que l'écran choisisse l'explication et la solution
   * dans sa langue. Jamais affiché tel quel.
   */
  code?: string;
  /** Les **autres** technologies en cause dans le refus, avec leur documentation. */
  conflicts?: TechnologyRef[];
}

export interface ResolutionView {
  status: 'certified' | 'experimental';
  /** Messages destinés à l'écran jamais des codes : §12 exige une raison lisible. */
  issues: readonly string[];
}

export interface PresetView {
  id: PresetId;
  name: string;
  description: string;
}

export interface PlanPreviewView {
  files: readonly string[];
  /**
   * Avertissements du plan, **et** problèmes qui l'ont empêché le contrat du
   * plan ne prévoit qu'un canal, et un aperçu muet devant un refus serait pire
   * que bavard. `files` reste vide quand le plan est refusé.
   */
  warnings: readonly string[];
}

export interface PreviewOptions {
  /** Dossier affiché il nomme le plan, il n'est jamais écrit (§22). */
  readonly targetDir?: string;
}

/** Valeur par défaut quand l'appelant n'a pas de dossier cible : un simple libellé. */
const DEFAULT_PREVIEW_DIR = '/pf-preview';

/**
 * Le catalogue est chargé une fois par processus.
 *
 * Il est immuable et livré avec l'application : le relire à chaque frappe de
 * l'écran Stack Builder ferait payer 282 validations Zod par interaction.
 */
let catalogue: Registry | undefined;

/**
 * Rend le catalogue officiel, ou lève.
 *
 * Un catalogue illisible n'est pas une saisie utilisateur à corriger : c'est
 * une installation cassée. Rendre une liste d'options vide, ou une résolution
 * « expérimentale », ferait croire à un choix légitime la panne doit se voir.
 */
function getRegistry(): Registry {
  if (catalogue === undefined) {
    const loaded = loadCatalogue();
    if (!loaded.ok) {
      throw new Error(
        `Catalogue illisible : ${loaded.issues.map((issue) => issue.message).join(' ')}`,
      );
    }
    catalogue = loaded.value;
  }
  return catalogue;
}

/** Les options d'une catégorie, chacune avec son état l'écran Stack Builder (§5). */
export async function stackOptions(
  category: Category,
  selection: Selection,
): Promise<OptionView[]> {
  const registry = getRegistry();
  return optionsFor(category, selection, registry).map((option) => {
    const conflicts = (option.blocking?.path ?? [])
      .filter((id): id is string => typeof id === 'string' && id !== option.entry.id)
      .map((id) => registry.get(id))
      .filter((entry) => entry !== undefined)
      .map((entry) => ({
        id: entry.id,
        label: entry.name,
        ...(entry.docs === undefined ? {} : { docs: entry.docs }),
      }));
    return {
      id: option.entry.id,
      label: option.entry.name,
      category: option.entry.category,
      targets: [...option.entry.targets],
      state: option.state,
      // `exactOptionalPropertyTypes` interdit d'écrire `reason: undefined` : la
      // clé est absente quand il n'y a rien à dire, sinon elle porte la raison.
      ...(option.reason === undefined ? {} : { reason: option.reason }),
      ...(option.entry.docs === undefined ? {} : { docs: option.entry.docs }),
      ...(option.blocking === undefined ? {} : { code: option.blocking.code }),
      ...(conflicts.length === 0 ? {} : { conflicts }),
    };
  });
}

/**
 * Les cibles dont l'application exige un langage au schéma du manifest
 * (§10 : `ManifestFrontend.language` et `ManifestMobile.language` ne sont pas
 * optionnels ; `ManifestBackend.language` et `ManifestDesktop`, si).
 *
 * Dupliqué à dessein : ce n'est pas une liste de technologies (qui vivrait au
 * registry), c'est la forme du schéma lui-même une frontière que
 * `draft-to-manifest.ts` documente déjà (§10, trois frontières). La recopier
 * ici évite de faire dépendre le moteur de compatibilité, générique par
 * nature, d'une règle de forme qui n'est pas la sienne.
 */
const TARGETS_REQUIRING_LANGUAGE: ReadonlySet<Selection['targets'][number]> = new Set([
  'web',
  'mobile',
]);

/**
 * Le moteur de compatibilité certifie une **combinaison** ; il ne sait rien
 * du **schéma** du manifest (§10, trois frontières voir `draft-to-manifest.ts`).
 * Un framework frontend choisi seul, sans langage, ne crée donc aucun conflit
 * à ses yeux : `resolve()` rend `certified`, `issues: []`.
 *
 * Le manifest, lui, refuse `frontend` sans `language` un refus qui n'arrive
 * qu'au Blueprint, plusieurs écrans après le Stack Builder où le choix a été
 * fait. Un visiteur qui choisit un framework web voit « Combinaison certifiée »
 * puis, sans lien apparent, « le champ frontend.language est obligatoire » :
 * bug rapporté, reproduit par `engine.test.ts`.
 *
 * Le correctif ne touche ni le moteur ni le manifest chacun reste juste sur
 * son terrain il complète la **vue** que l'écran lit : un framework présent
 * sans langage pour la même cible devient un problème visible ici, avant que
 * l'utilisateur n'avance.
 */
function missingLanguageIssues(selection: Selection, registry: Registry): string[] {
  const chosen = new Set(selection.technologies);
  const issues: string[] = [];

  for (const target of TARGETS_REQUIRING_LANGUAGE) {
    if (!selection.targets.includes(target)) {
      continue;
    }
    const hasFramework = [...chosen].some((id) => {
      const entry = registry.get(id);
      // `mobile` n'est pas une catégorie du registry (§11) : un framework
      // mobile, le jour où le catalogue en certifie un, reste catégorie
      // `frontend` seule sa cible change. C'est `entry.targets`, pas
      // `entry.category`, qui distingue web et mobile ici.
      return entry !== undefined && entry.category === 'frontend' && entry.targets.includes(target);
    });
    if (!hasFramework) {
      continue;
    }
    const hasLanguage = [...chosen].some((id) => {
      const entry = registry.get(id);
      return entry !== undefined && entry.category === 'language' && entry.targets.includes(target);
    });
    if (!hasLanguage) {
      issues.push(
        `Un langage est requis pour l’application ${target} : choisissez-en un dans la catégorie « Langage ».`,
      );
    }
  }
  return issues;
}

/** La résolution d'une sélection le verdict du §12, avec ses raisons. */
export async function resolveSelection(selection: Selection): Promise<ResolutionView> {
  const registry = getRegistry();
  const result = resolve(selection, registry);
  const languageIssues = missingLanguageIssues(selection, registry);

  if (!result.ok) {
    return {
      status: 'experimental',
      issues: [...result.issues.map((issue) => issue.message), ...languageIssues],
    };
  }
  if (languageIssues.length > 0) {
    return { status: result.value.status, issues: languageIssues };
  }
  return { status: result.value.status, issues: [] };
}

/** Les presets certifiés du §8 la même liste qu'au CLI, lue au même endroit. */
export function listPresets(): PresetView[] {
  return PRESETS.map((preset) => ({
    id: preset.id,
    name: preset.name,
    description: preset.description,
  }));
}

/**
 * L'aperçu du projet : le plan complet, **sans une seule écriture**.
 *
 * `planProject` est le dry-run du §22 c'est la même fonction qui précède
 * l'écriture réelle, donc l'aperçu ne peut pas diverger du résultat.
 */
export async function previewPlan(
  manifest: Manifest,
  options: PreviewOptions = {},
): Promise<PlanPreviewView> {
  const result = planProject(manifest, options.targetDir ?? DEFAULT_PREVIEW_DIR);
  if (!result.ok) {
    return { files: [], warnings: result.issues.map((issue) => issue.message) };
  }
  return {
    files: result.value.plan.files.map((file) => file.path),
    warnings: result.value.warnings.map((warning) => warning.message),
  };
}

export interface EnvVarView {
  /** Un **nom** seulement le §6.8 interdit d'afficher ou de stocker une valeur. */
  readonly name: string;
  /** Les technologies qui la réclament, pour que l'écran dise d'où elle vient. */
  readonly technologies: readonly string[];
}

/**
 * Les variables d'environnement que la sélection réclame (§6.8).
 *
 * Elles ne sont pas inventées ici : chaque fiche du catalogue déclare les
 * siennes (`env`), et le schéma du registry n'accepte que des noms la valeur
 * ne peut pas s'y trouver. La résolution est celle du moteur, additions
 * comprises : ce que le projet exigera vraiment, pas ce que l'utilisateur a
 * coché.
 */
export async function requiredEnvVars(selection: Selection): Promise<EnvVarView[]> {
  const registry = getRegistry();
  const result = resolve(selection, registry);
  const ids = result.ok ? result.value.technologies : selection.technologies;

  const byName = new Map<string, string[]>();
  for (const id of ids) {
    const entry = registry.get(id);
    for (const name of entry?.env ?? []) {
      byName.set(name, [...(byName.get(name) ?? []), id]);
    }
  }
  return [...byName.entries()]
    .map(([name, technologies]) => ({ name, technologies }))
    .sort((left, right) => left.name.localeCompare(right.name, 'fr'));
}

export interface GraphNodeView {
  readonly id: string;
  readonly label: string;
  readonly category: string;
  /** `selected` : choisi ; `added` : ajouté par le moteur pour tenir une exigence. */
  readonly state: 'selected' | 'added';
}

export interface GraphEdgeView {
  readonly from: string;
  readonly to: string;
  readonly kind: 'requires' | 'compatibleWith';
}

export interface GraphView {
  readonly nodes: readonly GraphNodeView[];
  readonly edges: readonly GraphEdgeView[];
  readonly status: 'certified' | 'experimental';
}

/**
 * Le Dependency Graph (§6.11) : ce qui est choisi, ce qui a été ajouté, et par
 * quoi les pièces tiennent ensemble.
 *
 * Les arêtes ne sont que les relations **déclarées par le catalogue** entre
 * deux technologies présentes dans la résolution : le graphe ne dessine pas une
 * intention, il montre des dépendances qui existent.
 */
export async function dependencyGraph(selection: Selection): Promise<GraphView> {
  const registry = getRegistry();
  const result = resolve(selection, registry);
  const resolution = result.ok ? result.value : undefined;
  const selected = new Set(selection.technologies);
  const ids = resolution?.technologies ?? selection.technologies;
  const added = new Set((resolution?.additions ?? []).map((addition) => addition.id));

  const nodes: GraphNodeView[] = [];
  const edges: GraphEdgeView[] = [];
  const present = new Set(ids);

  for (const id of ids) {
    const entry = registry.get(id);
    if (entry === undefined) {
      continue;
    }
    nodes.push({
      id: entry.id,
      label: entry.name,
      category: entry.category,
      state: selected.has(entry.id) && !added.has(entry.id) ? 'selected' : 'added',
    });
    for (const target of entry.requires ?? []) {
      if (present.has(target)) {
        edges.push({ from: entry.id, to: target, kind: 'requires' });
      }
    }
    for (const target of entry.compatibleWith ?? []) {
      if (present.has(target)) {
        edges.push({ from: entry.id, to: target, kind: 'compatibleWith' });
      }
    }
  }

  return { nodes, edges, status: resolution?.status ?? 'experimental' };
}
