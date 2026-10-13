import type { ReactElement } from 'react';
import { Icon } from '../../components/ui/icon';
import { TechIcon } from '../../components/ui/tech-icon';
import { useMessages } from '../../lib/i18n/provider';
import {
  type AddedExplanation,
  explainGraph,
  type RelationEdge,
  type RelationNode,
} from './relations';

export interface GraphGuideProps {
  readonly nodes: readonly RelationNode[];
  readonly edges: readonly RelationEdge[];
}

/**
 * Ce que le dessin veut dire, pour **ce** graphe-là.
 *
 * Il remplace les deux tableaux (nœuds, relations) : ils redisaient le dessin
 * ligne à ligne sans répondre à la seule question utile, « pourquoi le moteur
 * a-t-il ajouté ça ? ». Ici, chaque addition est nommée avec ce qui l'exige,
 * et la légende prend son exemple dans le graphe affiché.
 *
 * L'équivalent textuel complet reste dans la description du dessin, pour les
 * lecteurs d'écran : ce texte-ci explique, il ne recopie pas.
 */
export function GraphGuide({ nodes, edges }: GraphGuideProps): ReactElement {
  const t = useMessages();
  const g = t.graphGuide;
  const explanation = explainGraph(nodes, edges);

  return (
    <section aria-labelledby="pf-graph-guide" className="pf-graph-guide">
      <div className="pf-graph-story">
        <h2 className="pf-label flex items-center gap-2" id="pf-graph-guide">
          <Icon name="info" size={14} />
          {g.heading}
        </h2>
        <p className="mt-2">{g.summary(explanation.chosen.length, explanation.added.length)}</p>

        {explanation.chosen.length > 0 ? (
          <>
            <h3 className="pf-eyebrow mt-4">{g.chosenHeading}</h3>
            <ul className="pf-graph-chips">
              {explanation.chosen.map((node) => (
                <li className="pf-graph-chip" data-state="selected" key={node.id}>
                  <span aria-hidden="true" className="pf-graph-chip-icon">
                    <TechIcon id={node.id} name={node.label} size={14} />
                  </span>
                  {node.label}
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <h3 className="pf-eyebrow mt-4">{g.addedHeading}</h3>
        {explanation.added.length === 0 ? (
          <p className="pf-hint mt-1">{g.noAdditions}</p>
        ) : (
          <ul className="pf-graph-reasons">
            {explanation.added.map((entry) => (
              <AddedReason entry={entry} key={entry.node.id} />
            ))}
          </ul>
        )}
      </div>

      <div className="pf-graph-legend">
        <h3 className="pf-eyebrow">{g.legendHeading}</h3>
        <ul className="pf-graph-legend-list">
          <li>
            <span aria-hidden="true" className="pf-graph-swatch" data-state="selected" />
            {g.legendChosen}
          </li>
          <li>
            <span aria-hidden="true" className="pf-graph-swatch" data-state="added" />
            {g.legendAdded}
          </li>
          <li>
            <LinkSwatch kind="requires" />
            <span>
              {g.legendRequires}
              {explanation.example === undefined ? null : (
                <span className="pf-graph-example">
                  {g.legendExample(explanation.example.from.label, explanation.example.to.label)}
                </span>
              )}
            </span>
          </li>
          {explanation.hasCompatibility ? (
            <li>
              <LinkSwatch kind="compatibleWith" />
              {g.legendCompatible}
            </li>
          ) : null}
        </ul>
        {edges.length === 0 ? <p className="pf-hint mt-2">{t.graph.noEdges}</p> : null}
      </div>
    </section>
  );
}

/** « TypeScript, exigé par Next.js et Prisma » : la raison d'une addition, en une ligne. */
function AddedReason({ entry }: { readonly entry: AddedExplanation }): ReactElement {
  const g = useMessages().graphGuide;
  // Une exigence venue d'une autre addition est dite : la chaîne remonte à un choix.
  const names = entry.requiredBy.map((node) =>
    node.state === 'added' ? `${node.label} (${g.addedAlso})` : node.label,
  );
  return (
    <li className="pf-graph-reason">
      <span className="pf-graph-chip" data-state="added">
        <span aria-hidden="true" className="pf-graph-chip-icon">
          <TechIcon id={entry.node.id} name={entry.node.label} size={14} />
        </span>
        {entry.node.label}
      </span>
      <span className="pf-hint">{names.length > 0 ? g.requiredBy(names) : g.addedWithoutEdge}</span>
    </li>
  );
}

/** Le trait de la légende : le même que dans le dessin, en miniature. */
function LinkSwatch({ kind }: { readonly kind: RelationEdge['kind'] }): ReactElement {
  return (
    <svg
      aria-hidden="true"
      className="pf-graph-link-swatch"
      focusable="false"
      height={10}
      viewBox="0 0 28 10"
      width={28}
    >
      <path className="pf-graph-link" d="M1 5H25" data-kind={kind} />
      {kind === 'requires' ? <path className="pf-graph-arrow" d="M21 2L26 5L21 8" /> : null}
    </svg>
  );
}
