import type { Manifest } from '@buildit/manifest';
import type { Messages } from '../../../lib/i18n/messages';

/**
 * Le Project Blueprint (§6.10) : le manifest canonique, en clair.
 *
 * Ce module ne construit **pas** la sélection — `draftToManifest`
 * (`src/lib/draft-to-manifest.ts`) le fait, et c'est lui qui fait foi. Il ne
 * décide pas non plus *ce qui existe* : les noms lisibles viennent du catalogue,
 * via les libellés que l'écran a reçus du serveur (`loadGraphAction`), et un
 * identifiant que personne ne nomme s'affiche tel quel — jamais remplacé par un
 * nom inventé.
 *
 * Les rôles et les libellés de plateforme/architecture vivent au dictionnaire
 * (`build.blueprint`), où chaque entrée est une clé : ajouter une plateforme ou
 * une architecture au manifest sans écrire son mot casse le typecheck au point
 * d'usage. C'est une décision produit, pas un détail.
 */

export interface SummaryItem {
  readonly id: string;
  readonly label: string;
}

export interface SummaryRow {
  readonly role: string;
  readonly values: readonly SummaryItem[];
}

export interface BlueprintView {
  readonly name: string;
  /** « Next.js + PostgreSQL + Stripe » — la phrase du §6.10. */
  readonly headline: string;
  readonly rows: readonly SummaryRow[];
  /** Les identifiants du manifest, dans l'ordre canonique — la sélection du graphe. */
  readonly technologyIds: readonly string[];
}

/** Au-delà, la phrase d'en-tête devient une liste ; on la coupe et on le dit. */
export const HEADLINE_LIMIT = 8;

/**
 * Tous les identifiants de technologies du manifest, sans doublon.
 *
 * L'ordre suit celui des clés du §10 : deux brouillons équivalents donnent la
 * même sélection, donc le même graphe et le même aperçu.
 */
export function manifestTechnologyIds(manifest: Manifest): readonly string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const add = (id: string | undefined): void => {
    if (id !== undefined && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  };

  if (manifest.frontend !== undefined) {
    add(manifest.frontend.framework);
    add(manifest.frontend.language);
    add(manifest.frontend.styling);
    add(manifest.frontend.ui);
  }
  if (manifest.mobile !== undefined) {
    add(manifest.mobile.framework);
    add(manifest.mobile.language);
    add(manifest.mobile.styling);
  }
  if (manifest.desktop !== undefined) {
    add(manifest.desktop.framework);
  }
  if (manifest.backend !== undefined) {
    add(manifest.backend.framework);
    add(manifest.backend.language);
  }
  if (manifest.database !== undefined) {
    add(manifest.database.engine);
    add(manifest.database.orm);
  }
  if (manifest.auth !== undefined) {
    add(manifest.auth.provider);
  }
  for (const id of manifest.services ?? []) {
    add(id);
  }
  for (const id of manifest.quality ?? []) {
    add(id);
  }
  for (const id of manifest.infra ?? []) {
    add(id);
  }

  return ids;
}

/** Nomme une liste d'identifiants, doublons écartés, sans jamais inventer. */
function items(
  ids: readonly (string | undefined)[],
  labels: ReadonlyMap<string, string>,
): SummaryItem[] {
  const seen = new Set<string>();
  const values: SummaryItem[] = [];
  for (const id of ids) {
    if (id === undefined || seen.has(id)) {
      continue;
    }
    seen.add(id);
    values.push({ id, label: labels.get(id) ?? id });
  }
  return values;
}

/**
 * La phrase d'en-tête : d'abord les cadres applicatifs, puis le socle de
 * données, l'authentification et les services. C'est ce qui répond à « c'est
 * quoi, ce projet ? » en une ligne.
 */
function headlineOf(manifest: Manifest, labels: ReadonlyMap<string, string>): string {
  const salient: (string | undefined)[] = [
    manifest.frontend?.framework,
    manifest.mobile?.framework,
    manifest.desktop?.framework,
    manifest.backend?.framework,
    manifest.database?.engine,
    manifest.auth?.provider,
    ...(manifest.services ?? []),
  ];
  const unique = [...new Set(salient.filter((id): id is string => id !== undefined))];
  const shown = unique.slice(0, HEADLINE_LIMIT);
  const text = shown.map((id) => labels.get(id) ?? id).join(' + ');
  return unique.length > shown.length ? `${text}…` : text;
}

/**
 * La vue complète : nom, phrase, et une ligne par rôle du manifest.
 *
 * Un rôle sans valeur n'apparaît pas — un bloc vide se lirait comme un oubli
 * du produit, pas comme un choix de l'utilisateur.
 */
export function blueprintView(
  manifest: Manifest,
  labels: ReadonlyMap<string, string>,
  t: Messages,
): BlueprintView {
  const roles = t.build.blueprint.roles;
  const rows: SummaryRow[] = [
    {
      role: roles.targets,
      values: manifest.targets.map((target) => ({
        id: target,
        label: t.build.blueprint.targetLabels[target],
      })),
    },
    {
      role: roles.architecture,
      values: [
        {
          id: manifest.architecture,
          label: t.build.blueprint.architectureLabels[manifest.architecture],
        },
      ],
    },
  ];

  if (manifest.frontend !== undefined) {
    const app = manifest.frontend;
    rows.push({
      role: roles.web,
      values: items([app.framework, app.language, app.styling, app.ui], labels),
    });
  }
  if (manifest.mobile !== undefined) {
    const app = manifest.mobile;
    rows.push({
      role: roles.mobile,
      values: items([app.framework, app.language, app.styling], labels),
    });
  }
  if (manifest.desktop !== undefined) {
    rows.push({
      role: roles.desktop,
      values: items([manifest.desktop.framework], labels),
    });
  }
  if (manifest.backend !== undefined) {
    const app = manifest.backend;
    rows.push({
      role: roles.backend,
      values: items([app.framework, app.language], labels),
    });
  }
  if (manifest.database !== undefined) {
    const database = manifest.database;
    rows.push({
      role: roles.database,
      values: items([database.engine, database.orm], labels),
    });
  }
  if (manifest.auth !== undefined) {
    rows.push({ role: roles.auth, values: items([manifest.auth.provider], labels) });
  }
  if (manifest.services !== undefined && manifest.services.length > 0) {
    rows.push({ role: roles.services, values: items(manifest.services, labels) });
  }
  if (manifest.quality !== undefined && manifest.quality.length > 0) {
    rows.push({ role: roles.quality, values: items(manifest.quality, labels) });
  }
  if (manifest.infra !== undefined && manifest.infra.length > 0) {
    rows.push({ role: roles.infra, values: items(manifest.infra, labels) });
  }

  return {
    name: manifest.name,
    headline: headlineOf(manifest, labels),
    rows,
    technologyIds: manifestTechnologyIds(manifest),
  };
}
