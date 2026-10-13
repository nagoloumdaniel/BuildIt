import type { DraftState } from '../../../lib/draft';
import type { Messages } from '../../../lib/i18n/messages';
import { CAPABILITY_FAMILIES } from '../capabilities/capabilities';
import type { BlueprintView, SummaryItem, SummaryRow } from './summary';

/**
 * Les crayons du plan : chaque choix ramène à **l'étape et à la section** où
 * il s'est fait.
 *
 * Fonctions pures, sans React : le plan se construit d'abord depuis le seul
 * manifest (`blueprintView`, partagé avec la page de partage, qui ne modifie
 * rien), puis ce module y pose les liens à partir du brouillon. C'est le
 * brouillon qui sait **quel écran** a écrit un identifiant : le même `stripe`
 * peut venir du Stack Builder ou des Capacités, et le manifest ne le dit pas.
 *
 * Les paramètres de requête posés ici sont lus par les écrans visés
 * (`deep-link.ts`) : `?category=` au Stack Builder, `?family=` aux Capacités,
 * `?section=` à l'Infrastructure.
 */

/**
 * Les deux identifiants que l'écran Infrastructure pose par une case à cocher
 * (`lib/draft-to-manifest.ts`, `DOCKER_ID` / `CI_ID`) : ils ne sont dans
 * aucune liste du brouillon, seulement dans ses booléens.
 */
const DOCKER_ID = 'docker';
const CI_ID = 'github-actions';

/** Ce que les crayons lisent du brouillon, et la catégorie de chaque fiche. */
export interface EditContext {
  readonly draft: Pick<
    DraftState,
    'technologies' | 'capabilities' | 'infra' | 'type' | 'envVarNames'
  >;
  /** Identifiant → catégorie du catalogue, telle que le serveur l'a rendue. */
  readonly categories: ReadonlyMap<string, string>;
}

const FAMILIES: ReadonlySet<string> = new Set(CAPABILITY_FAMILIES);

/** Où se modifie une technologie du manifest. */
export function technologyEditHref(id: string, context: EditContext): string {
  const { draft, categories } = context;
  const category = categories.get(id);
  const fromStack = draft.technologies.includes(id);

  if (!fromStack && draft.capabilities.includes(id)) {
    return category !== undefined && FAMILIES.has(category)
      ? `/create/capabilities?family=${encodeURIComponent(category)}`
      : '/create/capabilities';
  }
  if (!fromStack && id === DOCKER_ID && draft.infra.docker) {
    return '/create/infrastructure?section=docker';
  }
  if (!fromStack && id === CI_ID && draft.infra.ci) {
    return '/create/infrastructure?section=ci';
  }
  // L'hébergeur a son écran : c'est là qu'on le choisit parmi les autres clouds.
  if (category === 'hosting') {
    return '/create/infrastructure?section=hosting';
  }
  return category === undefined
    ? '/create/stack'
    : `/create/stack?category=${encodeURIComponent(category)}`;
}

/** Les rôles que pose un écran unique, sans section à viser. */
const ROW_STEP: Partial<Record<SummaryRow['key'], string>> = {
  targets: '/create/target',
  type: '/create/type',
  architecture: '/create/architecture',
};

function withItemLinks(row: SummaryRow, context: EditContext): SummaryRow {
  const step = ROW_STEP[row.key];
  const values: SummaryItem[] = row.values.map((value) => ({
    ...value,
    edit: step ?? technologyEditHref(value.id, context),
  }));
  return { ...row, values };
}

/** Le libellé d'un profil du dictionnaire ; un profil inconnu garde son identifiant. */
function typeLabel(type: string, t: Messages): string {
  const labels: Readonly<Record<string, { readonly label: string } | undefined>> =
    t.wizard.types.labels;
  return labels[type]?.label ?? type;
}

/**
 * Le plan du brouillon, crayons compris.
 *
 * Deux lignes s'y ajoutent, qui n'entrent pas au manifest mais restent des
 * choix du parcours : le profil (après les plateformes, dans l'ordre des
 * étapes) et les variables d'environnement (un seul crayon pour la ligne :
 * elles découlent des technologies, elles ne se cochent pas une à une).
 */
export function editableBlueprint(
  view: BlueprintView,
  context: EditContext,
  t: Messages,
): BlueprintView {
  const rows: SummaryRow[] = [];
  for (const row of view.rows) {
    rows.push(withItemLinks(row, context));
    if (row.key === 'targets' && context.draft.type !== undefined) {
      rows.push(
        withItemLinks(
          {
            key: 'type',
            role: t.blueprintShare.roles.type,
            values: [{ id: context.draft.type, label: typeLabel(context.draft.type, t) }],
          },
          context,
        ),
      );
    }
  }
  if (context.draft.envVarNames.length > 0) {
    rows.push({
      key: 'env',
      role: t.blueprintShare.roles.env,
      values: context.draft.envVarNames.map((name) => ({ id: name, label: name })),
      edit: '/create/env',
    });
  }
  return { ...view, nameEdit: '/create', rows };
}
