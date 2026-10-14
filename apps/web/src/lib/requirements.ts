import type { Architecture, Target } from '@buildit/manifest';
import { ARCHITECTURES, TARGETS } from '@buildit/manifest';
import type { Category, RegistryEntry } from '@buildit/registry';
import { catalogue } from './catalogue';
import type { DraftState } from './draft';
import type { Messages } from './i18n/messages';
import { APP_TARGET } from './targets';

/**
 * Le **minimum** qu'un écran exige avant de laisser passer.
 *
 * Chaque besoin vient d'une contrainte réelle, pas d'une préférence :
 *
 * - **une plateforme implique une application** (§10) : le manifest exige un
 *   `framework` pour chacune (web, mobile, ordinateur, API) ;
 * - **`monorepo` sans application** : le générateur refuse
 *   (`GEN_MONOREPO_NO_APP`) ;
 * - **les quatre formes serveur** (`modular-monolith`, `microservices`,
 *   `serverless`, `event-driven`) construisent toujours des dossiers serveur
 *   (`modules`, `services`, `functions`, `events`) : sans framework backend, le
 *   projet n'aurait que des README. Le framework backend ne s'installe que si
 *   la plateforme `api` est choisie : le besoin porte donc l'application
 *   serveur entière ;
 * - **`microservices` et `event-driven`** partagent `packages/event-contracts`,
 *   des schémas d'événements échangés : il leur faut une file ;
 * - **`microservices`** déploie chaque service séparément : des conteneurs ;
 * - **`serverless`** déploie des fonctions : un hébergement ;
 * - **un ORM sans base** ne produit pas de manifest (`database.engine` est
 *   obligatoire dès qu'un ORM est choisi).
 *
 * Ce module ne connaît **aucune** technologie (§11) : il ne nomme que des
 * catégories du catalogue et des plateformes du manifest, et c'est le registry
 * qui dit quelle fiche appartient à laquelle.
 */

/**
 * Un besoin non satisfait, prêt à être dit.
 *
 * Forme discriminée plutôt que drapeaux : chaque cas a **sa** phrase, et
 * ajouter un besoin sans lui écrire sa phrase devient une erreur de
 * compilation dans le `switch` de `requirementText`. Le `screen` de chaque cas
 * est l'étape du parcours qui doit le satisfaire.
 */
export type MissingRequirement =
  | { readonly kind: 'framework'; readonly screen: 'stack'; readonly target: Target }
  | {
      readonly kind: 'server-platform';
      readonly screen: 'stack';
      readonly architecture: Architecture;
    }
  | { readonly kind: 'backend'; readonly screen: 'stack'; readonly architecture: Architecture }
  | { readonly kind: 'application'; readonly screen: 'stack'; readonly architecture: Architecture }
  | { readonly kind: 'database'; readonly screen: 'stack' }
  | {
      readonly kind: 'capability';
      readonly screen: 'capabilities';
      readonly architecture: Architecture;
      readonly category: Category;
    }
  | {
      readonly kind: 'infrastructure';
      readonly screen: 'infrastructure';
      readonly architecture: Architecture;
      readonly category: Category;
    };

/**
 * Les formes d'architecture qui produisent du code serveur quel que soit
 * l'écran : leur squelette crée des dossiers serveur inconditionnellement.
 *
 * Table **complète** et non `Set<string>`, comme les deux tables voisines : une
 * architecture ajoutée au manifest casse la compilation ici au lieu de tomber
 * silencieusement dans « pas de besoin serveur ».
 */
const SERVER_ARCHITECTURES: Readonly<Record<Architecture, boolean>> = {
  'single-app': false,
  monorepo: false,
  'modular-monolith': true,
  microservices: true,
  serverless: true,
  'event-driven': true,
};

/** Ce qu'une architecture exige de l'écran Capacités. */
const ARCHITECTURE_CAPABILITIES: Readonly<Record<Architecture, readonly Category[]>> = {
  'single-app': [],
  monorepo: [],
  'modular-monolith': [],
  microservices: ['queue'],
  serverless: [],
  'event-driven': ['queue'],
};

/** Ce qu'une architecture exige de l'écran Infrastructure. */
const ARCHITECTURE_INFRASTRUCTURE: Readonly<Record<Architecture, readonly Category[]>> = {
  'single-app': [],
  monorepo: [],
  'modular-monolith': [],
  microservices: ['containers'],
  serverless: ['hosting'],
  'event-driven': [],
};

/** Les catégories qui portent le `framework` d'une application (§10). */
function isFramework(entry: RegistryEntry): boolean {
  return entry.category === 'frontend' || entry.category === 'backend';
}

/** Vrai si une plateforme implique une application dans le manifest. */
function impliesApplication(target: Target): boolean {
  return Object.values(APP_TARGET).includes(target);
}

/** Les plateformes connues d'un brouillon : un identifiant inventé est ignoré. */
function knownTargets(targets: readonly string[]): readonly Target[] {
  return targets.filter((target): target is Target =>
    (TARGETS as readonly string[]).includes(target),
  );
}

/** L'architecture du brouillon, si c'est une valeur du manifest. */
function knownArchitecture(architecture: string | undefined): Architecture | undefined {
  if (architecture === undefined) {
    return undefined;
  }
  return ARCHITECTURES.find((known) => known === architecture);
}

/** Les fiches réellement choisies : un identifiant inconnu n'est pas une fiche. */
function chosenEntries(draft: DraftState): readonly RegistryEntry[] {
  const registry = catalogue();
  const entries: RegistryEntry[] = [];
  for (const id of [...draft.technologies, ...draft.capabilities]) {
    const entry = registry.get(id);
    if (entry !== undefined) {
      entries.push(entry);
    }
  }
  return entries;
}

/** Un framework qui sert cette plateforme est-il choisi ? */
function hasFramework(chosen: readonly RegistryEntry[], target: Target): boolean {
  return chosen.some((entry) => isFramework(entry) && entry.targets.includes(target));
}

/**
 * Une catégorie porte-t-elle un choix ?
 *
 * La case Docker de l'écran Infrastructure vaut un choix de la catégorie
 * `containers`, exactement comme `lib/draft-to-manifest.ts` l'ajoute à la
 * sélection. La case CI-CD, elle, n'est exigée par aucune architecture : pas de
 * branche morte ici.
 */
function hasCategory(
  draft: DraftState,
  chosen: readonly RegistryEntry[],
  category: Category,
): boolean {
  if (category === 'containers' && draft.infra.docker) {
    return true;
  }
  return chosen.some((entry) => entry.category === category);
}

/**
 * Les besoins **non satisfaits** du brouillon.
 *
 * L'ordre est stable : les plateformes dans l'ordre du manifest, puis
 * l'architecture, puis la base. Deux appels sur le même brouillon rendent la
 * même liste, donc la même phrase.
 */
export function missingRequirements(draft: DraftState): readonly MissingRequirement[] {
  const chosen = chosenEntries(draft);
  const targets = knownTargets(draft.targets);
  const architecture = knownArchitecture(draft.architecture);
  const missing: MissingRequirement[] = [];

  for (const target of targets) {
    if (impliesApplication(target) && !hasFramework(chosen, target)) {
      missing.push({ kind: 'framework', screen: 'stack', target });
    }
  }

  if (architecture !== undefined) {
    if (SERVER_ARCHITECTURES[architecture]) {
      // Une application serveur, c'est la plateforme `api` **et** son
      // framework : l'un sans l'autre ne produit rien.
      if (!targets.includes('api')) {
        missing.push({ kind: 'server-platform', screen: 'stack', architecture });
      } else if (!hasFramework(chosen, 'api')) {
        missing.push({ kind: 'backend', screen: 'stack', architecture });
      }
    }
    if (architecture === 'monorepo' && !targets.some(impliesApplication)) {
      missing.push({ kind: 'application', screen: 'stack', architecture });
    }
    for (const category of ARCHITECTURE_CAPABILITIES[architecture]) {
      if (!hasCategory(draft, chosen, category)) {
        missing.push({ kind: 'capability', screen: 'capabilities', architecture, category });
      }
    }
    for (const category of ARCHITECTURE_INFRASTRUCTURE[architecture]) {
      if (!hasCategory(draft, chosen, category)) {
        missing.push({ kind: 'infrastructure', screen: 'infrastructure', architecture, category });
      }
    }
  }

  if (hasCategory(draft, chosen, 'orm') && !hasCategory(draft, chosen, 'database')) {
    missing.push({ kind: 'database', screen: 'stack' });
  }

  return missing;
}

/**
 * La phrase d'un besoin, dans la langue de l'écran.
 *
 * Les libellés de plateforme et de catégorie viennent du dictionnaire : ce
 * module n'écrit aucun nom de technologie, et aucune phrase non plus.
 */
export function requirementText(t: Messages, need: MissingRequirement): string {
  const blocked = t.journey.blocked;
  switch (need.kind) {
    case 'framework':
      return blocked.framework(t.wizard.targets.labels[need.target].label);
    case 'server-platform':
      return blocked.serverPlatform(t.wizard.architecture.labels[need.architecture].label);
    case 'backend':
      return blocked.backend(t.wizard.architecture.labels[need.architecture].label);
    case 'application':
      return blocked.application(t.wizard.architecture.labels[need.architecture].label);
    case 'database':
      return blocked.database;
    case 'capability':
      return blocked.capability(
        t.wizard.stack.categories[need.category],
        t.wizard.architecture.labels[need.architecture].label,
      );
    case 'infrastructure':
      return blocked.infrastructure(
        t.wizard.stack.categories[need.category],
        t.wizard.architecture.labels[need.architecture].label,
      );
  }
}
