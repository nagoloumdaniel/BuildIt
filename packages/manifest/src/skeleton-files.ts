import type { SkeletonDir } from './architecture-skeleton.js';
import type { Architecture } from './schema/enums.js';

/**
 * Le contenu des fichiers de base d’une architecture : un README par dossier
 * du squelette, la vue d’architecture, l’ADR-001, CONTRIBUTING et SECURITY.
 *
 * Pur, sans `fs` : le générateur l’écrit dans un projet neuf, et l’écran
 * « Ouvrir un projet local » le propose pour un projet existant, dans le
 * navigateur — une seule source pour les deux.
 */

export interface SkeletonFile {
  /** Chemin relatif POSIX. */
  readonly path: string;
  readonly contents: string;
}

const TITLES: Readonly<Record<Architecture, string>> = {
  'single-app': 'Application unique',
  monorepo: 'Monorepo',
  'modular-monolith': 'Monolithe modulaire',
  microservices: 'Microservices',
  serverless: 'Serverless',
  'event-driven': 'Orienté événements',
};

const RATIONALE: Readonly<Record<Architecture, string>> = {
  'single-app':
    'Un seul déployable et un seul dépôt : le coût d’exploitation le plus bas. Le code reste découpé par fonctionnalités (front) et par modules (back) pour pouvoir grandir sans réécriture.',
  monorepo:
    'Plusieurs applications (web, API) et des paquets partagés dans un même dépôt : un seul historique, des contrats partagés typés, une CI qui ne construit que ce qui change.',
  'modular-monolith':
    'Un seul déployable, mais des modules métier aux frontières nettes (domaine, application, adaptateurs). Un module pourra devenir un service plus tard si la charge l’exige.',
  microservices:
    'Des services indépendants, chacun propriétaire de ses données, déployés et mis à l’échelle séparément. Le prix : réseau, orchestration et observabilité à financer.',
  serverless:
    'Des fonctions exécutées à la demande, sans serveur à administrer. Facturation à l’usage : surveiller le plafond, garder les fonctions courtes et idempotentes.',
  'event-driven':
    'Des flux d’événements découplent producteurs et consommateurs. Outbox transactionnelle, consommateurs idempotents et file de lettres mortes sont la base, pas une option.',
};

function readme(dir: SkeletonDir): string {
  const name = dir.path.split('/').at(-1) ?? dir.path;
  return `# ${name}\n\n${dir.role}\n`;
}

function tree(dirs: readonly SkeletonDir[]): string {
  return dirs.map((dir) => `${dir.path}/`).join('\n');
}

export interface SkeletonFilesOptions {
  /** Date de la décision (AAAA-MM-JJ) inscrite dans l’ADR-001. */
  readonly date?: string;
}

/** `Date` → `AAAA-MM-JJ`, en UTC (déterministe quel que soit le fuseau). */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function skeletonFiles(
  name: string,
  architecture: Architecture,
  dirs: readonly SkeletonDir[],
  options: SkeletonFilesOptions = {},
): SkeletonFile[] {
  const date = options.date ?? isoDate(new Date());
  const title = TITLES[architecture];
  const files: { path: string; contents: string }[] = dirs.map((dir) => ({
    path: `${dir.path}/README.md`,
    contents: readme(dir),
  }));
  // La vue d'architecture remplace le README générique de son dossier.
  const view = files.find((file) => file.path === 'docs/architecture/README.md');
  if (view !== undefined) {
    Object.assign(view, {
      contents: `# Architecture — ${name}\n\nForme : **${title}**. Décision : [ADR-001](../decisions/ADR-001-${architecture}.md).\n\n## Arborescence de base\n\n\`\`\`\n${tree(dirs)}\n\`\`\`\n\n## Responsabilités\n\n${dirs.map((dir) => `- \`${dir.path}/\` — ${dir.role}`).join('\n')}\n`,
    });
  }

  files.push(
    {
      path: `docs/decisions/ADR-001-${architecture}.md`,
      contents: `# ADR-001 — Architecture : ${title}\n\n- Statut : acceptée\n- Date : ${date}\n\n## Contexte\n\nLe projet ${name} est généré par BuildIt avec l’architecture « ${architecture} ».\n\n## Décision\n\n${RATIONALE[architecture]}\n\n## Conséquences\n\n- Chaque dossier de base porte un README qui fixe sa responsabilité et sa règle de dépendance.\n- Le domaine n’importe aucun framework : les adaptateurs dépendent du domaine, jamais l’inverse.\n- Toute évolution de cette décision passe par un nouvel ADR qui remplace celui-ci.\n`,
    },
    {
      path: 'CONTRIBUTING.md',
      contents: `# Contribuer à ${name}\n\n1. Lire \`docs/architecture/README.md\` et les ADR de \`docs/decisions/\`.\n2. Respecter la responsabilité de chaque dossier (voir son README).\n3. Une décision d’architecture nouvelle = un nouvel ADR.\n4. Lint, typage et tests verts avant toute demande de fusion.\n`,
    },
    {
      path: 'SECURITY.md',
      contents: `# Sécurité\n\nSignaler une vulnérabilité en privé aux mainteneurs, jamais dans un ticket public.\n\n- Aucun secret dans le dépôt : variables d’environnement uniquement.\n- Dépendances mises à jour régulièrement.\n`,
    },
  );
  return files;
}
