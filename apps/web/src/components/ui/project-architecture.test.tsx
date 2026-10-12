import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EN_ARCHITECTURE, FR_ARCHITECTURE } from '../../lib/i18n/messages.architecture';
import { type ArchitectureStatus, ArchitectureView } from './project-architecture';

/**
 * La vue de l'architecture, rendue sans DOM : elle reçoit l'issue du calcul,
 * elle ne la lance pas. Le branchement (`ProjectArchitecture`) ne fait
 * qu'appeler le dry-run et lui passer le résultat. Sans fournisseur de langue,
 * c'est le français.
 */

function render(status: ArchitectureStatus, onRetry?: () => void): string {
  return renderToStaticMarkup(
    <ArchitectureView status={status} {...(onRetry === undefined ? {} : { onRetry })} />,
  );
}

const FILES = [
  'package.json',
  'README.md',
  'app/layout.tsx',
  'app/page.tsx',
  'app/api/auth/[...all]/route.ts',
  'components/ui/button.tsx',
  'next.config.ts',
];

describe('ArchitectureView : les issues du calcul', () => {
  it('pendant le calcul, une ligne qui nomme le travail, pas un squelette', () => {
    const html = render({ kind: 'loading' });
    expect(html).toContain('Calcul de l’architecture par le moteur');
    expect(html).not.toContain('pf-arch-tree');
  });

  it('un moteur muet donne une erreur avec « Réessayer » quand on peut relancer', () => {
    const html = render({ kind: 'failed' }, () => undefined);
    expect(html).toContain('L’architecture n’a pas pu être calculée');
    expect(html).toContain('Réessayer');
    expect(render({ kind: 'failed' })).not.toContain('Réessayer');
  });

  it('un refus montre les raisons du moteur, telles quelles', () => {
    const html = render({ kind: 'ready', files: [], warnings: ['Le nom est vide.'] });
    expect(html).toContain('Le moteur refuse ces choix');
    expect(html).toContain('Le nom est vide.');
  });

  it('un plan vide sans raison est un vide, pas une erreur', () => {
    const html = render({ kind: 'ready', files: [], warnings: [] });
    expect(html).toContain('Aucun fichier à générer');
    expect(html).not.toContain('role="alert"');
  });
});

describe('ArchitectureView : l’arbre', () => {
  const html = render({ kind: 'ready', files: FILES, warnings: ['Avertissement du plan.'] });

  it('annonce le total, l’arbre étiqueté et les avertissements', () => {
    expect(html).toContain('7 fichiers');
    expect(html).toContain('aria-label="Architecture du projet : dossiers et fichiers générés"');
    expect(html).toContain('Avertissement du plan.');
  });

  it('les noms sont en chasse fixe, les dossiers marqués d’un « / »', () => {
    expect(html).toContain('<span class="pf-mono pf-arch-name">app/</span>');
    expect(html).toContain('<span class="pf-mono pf-arch-name">package.json</span>');
  });

  it('les dossiers racine sont ouverts, les profonds repliés, et le disent', () => {
    expect(html).toMatch(/aria-expanded="true"[^>]*>(?:(?!<\/button>).)*app\//s);
    expect(html).toMatch(/aria-expanded="false"[^>]*>(?:(?!<\/button>).)*api\//s);
    // Une branche repliée reste dans le document (aria-controls la désigne).
    expect(html).toContain('hidden=""');
    expect(html).toContain('route.ts');
  });

  it('chaque dossier compte ses fichiers, toutes profondeurs', () => {
    expect(html).toMatch(/app\/<\/span><\/button><span class="pf-mono pf-arch-count">3 fichiers/);
    expect(html).toMatch(/ui\/<\/span><\/button><span class="pf-mono pf-arch-count">1 fichier</);
  });

  it('la phrase générale est sur le dossier, un fichier sans rien de propre reste muet', () => {
    expect(html).toContain('Les routes de Next.js (App Router)');
    expect(html).toContain('Les composants de base de shadcn/ui');
    expect(html).toMatch(/button\.tsx<\/span><\/span><\/div>/);
  });

  it('un seul geste pour tout déplier, puisque des dossiers sont repliés', () => {
    expect(html.match(/Tout déplier/g)).toHaveLength(1);
    expect(html).not.toContain('Tout replier');
  });

  it('un plan sans dossier n’offre pas de geste de dépliage', () => {
    const flat = render({ kind: 'ready', files: ['README.md'], warnings: [] });
    expect(flat).not.toContain('Tout déplier');
    expect(flat).not.toContain('Avertissements du plan');
  });

  it('tout ouvert dès l’arrivée, le geste propose de tout replier', () => {
    const shallow = render({ kind: 'ready', files: ['lib/db.ts'], warnings: [] });
    expect(shallow).toContain('Tout replier');
  });
});

describe('les textes de l’architecture', () => {
  it('aucun tiret cadratin dans un texte affiché, dans aucune langue', () => {
    const strings = (value: unknown): string[] =>
      typeof value === 'string'
        ? [value]
        : typeof value === 'function'
          ? [String((value as (arg: never) => unknown)(2 as never))]
          : Object.values(value as Record<string, unknown>).flatMap(strings);
    for (const text of [...strings(FR_ARCHITECTURE), ...strings(EN_ARCHITECTURE)]) {
      expect(text, text).not.toContain('—');
    }
  });
});
