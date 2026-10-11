import {
  MANIFEST_VERSION,
  type Manifest,
  type ManifestIssueCode,
  type ParseResult,
  parseManifest,
} from '@project-factory/manifest';
import {
  loadCatalogue,
  type Registry,
  type RegistryEntry,
  slotFor,
} from '@project-factory/registry';
import type { DraftState } from './draft';
import { APP_TARGET, type AppKey } from './targets';

/**
 * Brouillon → Project Manifest (§9, §10).
 *
 * L'UI et le CLI sont deux façades du même moteur : les mêmes choix doivent
 * donner le même manifest, **octet pour octet** (gate M5). Ce fichier est le
 * seul endroit où le web décide *où* va un choix ; il ne décide jamais *ce qui
 * existe*.
 *
 * Trois frontières, et aucune n'est franchie ici (§10) :
 *
 * - le manifest valide la **forme** : l'objet assemblé passe par `parseManifest`,
 *   jamais par un cast. Un choix manquant devient un problème lisible, pas un
 *   champ inventé ;
 * - le registry valide l'**identité** : un id inconnu du catalogue n'est pas
 *   écarté en silence, il est porté jusqu'au moteur, qui le refuse nommément
 *   (`COMPAT_UNKNOWN_TECHNOLOGY`) ;
 * - le compatibility engine valide la **combinaison** : deux choix exclusifs
 *   restent tous deux dans la sélection, c'est lui qui refuse
 *   (`COMPAT_EXCLUSIVE_CATEGORY`).
 *
 * Aucune liste de technologies n'est recopiée ici (§11) : les ids et leurs
 * catégories viennent du catalogue, et cette table ne dit que des rôles.
 */

type AppField = 'framework' | 'language' | 'styling' | 'ui';

/** Les champs que chaque application accepte — le schéma du §10, ni plus ni moins. */
const APP_FIELDS: Readonly<Record<AppKey, readonly AppField[]>> = {
  frontend: ['framework', 'language', 'styling', 'ui'],
  mobile: ['framework', 'language', 'styling'],
  desktop: ['framework'],
  backend: ['framework', 'language'],
};

/** Ordre fixe : la sortie ne dépend pas de l'ordre de saisie du brouillon. */
const APP_KEYS: readonly AppKey[] = ['frontend', 'mobile', 'desktop', 'backend'];

/**
 * Ce que le manifest sait exprimer : un emplacement par **rôle**, pas un par
 * catégorie du catalogue. Plusieurs catégories désignent le même rôle — un
 * langage vaut pour toutes les applications, une base de données n'en a qu'une.
 */
type Slot =
  | { readonly kind: 'app'; readonly field: AppField }
  | { readonly kind: 'single'; readonly field: 'engine' | 'orm' | 'provider' }
  | { readonly kind: 'list'; readonly field: 'services' | 'quality' | 'infra' };

/**
 * Où va chaque catégorie : la table vit désormais dans le registry
 * (`@project-factory/registry`, module `slots.ts`), avec celle que `pf add`
 * lisait de son côté. Deux copies tenues ensemble par un test finissent par
 * diverger — la règle n'existe plus qu'une fois.
 *
 * Ce qui reste ici, et qui n'appartient qu'au brouillon : la **politique** de
 * placement. Le brouillon assemble un manifest neuf : le premier framework
 * arrivé occupe le rôle, les suivants rejoignent `services` plutôt que d'être
 * écartés. `pf add`, lui, remplace la valeur en place et le dit.
 */

/**
 * Les deux seuls ids que le brouillon nomme lui-même : l'écran Infrastructure
 * (§6.9) pose des booléens, pas des technologies. Les deux existent au
 * catalogue (`containers/docker.entry.json`, `ci-cd/github-actions.entry.json`)
 * et suivent donc le chemin commun. `github-actions` est le seul fournisseur de
 * CI du produit : les quatre presets le posent, et le fichier engendré est un
 * workflow GitHub.
 */
const DOCKER_ID = 'docker';
const CI_ID = 'github-actions';

interface AppValues {
  framework?: string;
  language?: string;
  styling?: string;
  ui?: string;
}

/** Ce qui est placé au fil de l'eau, avant d'être rendu au schéma. */
interface Assembly {
  readonly apps: Record<AppKey, AppValues>;
  readonly lists: {
    readonly services: Set<string>;
    readonly quality: Set<string>;
    readonly infra: Set<string>;
  };
  engine?: string;
  orm?: string;
  provider?: string;
}

/**
 * Le manifest en cours d'assemblage : les clés du §10, et rien d'autre.
 *
 * Nommer ces clés n'est pas une garantie — le manifest peut sortir incomplet,
 * c'est voulu. La garantie qu'aucun champ inventé ne passe vient du schéma
 * strict de `parseManifest`, pas d'ici : ce type sert à écrire l'assemblage
 * sans cast, et sans accès par crochets qu'interdit
 * `noPropertyAccessFromIndexSignature`.
 */
interface ManifestDraft {
  manifestVersion: number;
  name: string;
  targets: string[];
  architecture?: string;
  frontend?: AppValues;
  mobile?: AppValues;
  desktop?: AppValues;
  backend?: AppValues;
  database?: { engine?: string; orm?: string };
  auth?: { provider: string };
  services?: string[];
  quality?: string[];
  infra?: string[];
}

let loaded: Registry | undefined;

/**
 * Le catalogue officiel, chargé une fois.
 *
 * Un échec de chargement n'est pas une erreur de brouillon : le catalogue est
 * un artefact de construction, vérifié par les tests du registry. On lève
 * plutôt que de rendre un manifest partiel, qui aurait l'air valide.
 */
function catalogue(): Registry {
  if (loaded === undefined) {
    const result = loadCatalogue();
    if (!result.ok) {
      throw new Error(
        `Catalogue du registry illisible : ${result.issues.map((issue) => issue.code).join(', ')}.`,
      );
    }
    loaded = result.value;
  }
  return loaded;
}

/**
 * Les ids choisis : un ensemble, dans un ordre stable.
 *
 * Les deux listes du brouillon — Stack Builder et Capabilities (§6.7) — sont
 * deux vues de la même sélection : le même id choisi aux deux écrans reste un
 * choix. L'ordre est trié pour que deux saisies du même ensemble donnent la
 * même chaîne, quel que soit l'ordre des clics.
 */
function chosenIds(draft: DraftState): string[] {
  const ids = new Set([...draft.technologies, ...draft.capabilities]);
  if (draft.infra.docker) {
    ids.add(DOCKER_ID);
  }
  if (draft.infra.ci) {
    ids.add(CI_ID);
  }
  return [...ids].sort();
}

/**
 * Place une fiche au rôle que sa catégorie désigne.
 *
 * Un choix qui ne trouve pas d'emplacement libre — second framework, seconde
 * base, fiche qui ne sert pas l'application visée — rejoint `services` plutôt
 * que d'être écarté : le moteur verra la sélection entière et nommera le
 * conflit, au lieu de générer un projet amputé d'un choix.
 */
function place(assembly: Assembly, entry: RegistryEntry, targets: ReadonlySet<string>): void {
  const slot = slotFor(entry.category);

  if (slot.kind === 'list') {
    assembly.lists[slot.field].add(entry.id);
    return;
  }

  if (slot.kind === 'single') {
    if (assembly[slot.field] === undefined) {
      assembly[slot.field] = entry.id;
    } else {
      assembly.lists.services.add(entry.id);
    }
    return;
  }

  let placed = false;
  for (const app of APP_KEYS) {
    // L'application doit exister (sa cible est choisie) et accepter ce champ.
    if (!targets.has(APP_TARGET[app]) || !APP_FIELDS[app].includes(slot.field)) {
      continue;
    }
    // Une fiche ne remplit que les applications qu'elle sert : un framework web
    // n'est pas le framework d'une application mobile.
    if (!entry.targets.includes(APP_TARGET[app])) {
      continue;
    }
    const values = assembly.apps[app];
    if (values[slot.field] !== undefined) {
      continue;
    }
    values[slot.field] = entry.id;
    placed = true;
  }
  if (!placed) {
    assembly.lists.services.add(entry.id);
  }
}

/**
 * Rend l'objet manifest — encore incomplet, c'est voulu : c'est `parseManifest`
 * qui juge. Le passer au schéma plutôt que de le typer en `Manifest` est ce qui
 * rend impossible un champ inventé : une clé qui n'existe pas au §10 est
 * refusée, elle n'est pas ignorée.
 */
function toManifest(
  draft: DraftState,
  assembly: Assembly,
  targets: ReadonlySet<string>,
): ManifestDraft {
  const manifest: ManifestDraft = {
    manifestVersion: MANIFEST_VERSION,
    name: draft.name,
    targets: [...draft.targets],
  };
  // Aucune valeur par défaut : une architecture non choisie est un brouillon
  // incomplet, et le schéma doit le dire.
  if (draft.architecture !== undefined) {
    manifest.architecture = draft.architecture;
  }

  // Une cible implique une application : le schéma exigera son framework et son
  // langage. Ne pas créer l'objet laisserait passer un projet vide.
  for (const app of APP_KEYS) {
    if (targets.has(APP_TARGET[app])) {
      manifest[app] = assembly.apps[app];
    }
  }

  // Une base ou un ORM sans l'autre n'a pas de sens : l'objet est créé dès qu'un
  // des deux existe, et le schéma réclame celui qui manque (« pf add » dit la
  // même chose à l'utilisateur).
  const database: { engine?: string; orm?: string } = {};
  if (assembly.engine !== undefined) {
    database.engine = assembly.engine;
  }
  if (assembly.orm !== undefined) {
    database.orm = assembly.orm;
  }
  if (database.engine !== undefined || database.orm !== undefined) {
    manifest.database = database;
  }
  if (assembly.provider !== undefined) {
    manifest.auth = { provider: assembly.provider };
  }

  // Un ensemble vide n'est pas « rien de choisi » : c'est un champ qui ment.
  // Absent, il dit exactement ce qui s'est passé.
  if (assembly.lists.services.size > 0) {
    manifest.services = [...assembly.lists.services].sort();
  }
  if (assembly.lists.quality.size > 0) {
    manifest.quality = [...assembly.lists.quality].sort();
  }
  if (assembly.lists.infra.size > 0) {
    manifest.infra = [...assembly.lists.infra].sort();
  }

  return manifest;
}

export function draftToManifest(draft: DraftState): ParseResult<Manifest, ManifestIssueCode> {
  const targets = new Set<string>(draft.targets);
  const assembly: Assembly = {
    apps: { frontend: {}, mobile: {}, desktop: {}, backend: {} },
    lists: { services: new Set(), quality: new Set(), infra: new Set() },
  };
  const registry = catalogue();

  for (const id of chosenIds(draft)) {
    const entry = registry.get(id);
    if (entry === undefined) {
      // Le registry est seul juge de l'identité. Écarter ce choix ferait
      // générer un projet sans lui, sans rien dire : on le porte au moteur.
      assembly.lists.services.add(id);
      continue;
    }
    place(assembly, entry, targets);
  }

  return parseManifest(toManifest(draft, assembly, targets));
}
