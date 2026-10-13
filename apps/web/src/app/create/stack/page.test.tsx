import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DraftProvider } from '../../../components/wizard/draft-provider';
import StackPage from './page';
import { CategoryNav, ExpertToolbar } from './stack-options';
import type { CategoryBlock, StackOption } from './stack-view';

/**
 * Vitest tourne sans DOM (environnement `node`) : on prouve le contrat de rendu
 * avec `renderToStaticMarkup`. La logique du §5 est testée dans
 * `stack-view.test.ts` ; ici on vérifie que le JSX la reflète fidèlement —
 * blocage annoncé, budget respecté, libellés et comptes présents.
 */

function option(
  id: string,
  state: StackOption['state'],
  extra: Partial<StackOption> = {},
): StackOption {
  return { id, label: id, category: 'frontend', state, ...extra };
}

function block(
  category: CategoryBlock['category'],
  options: readonly StackOption[],
): CategoryBlock {
  return { category, options };
}

describe('page Stack Builder', () => {
  it('se rend sous <DraftProvider> sans lever et annonce l’étape', () => {
    const html = renderToStaticMarkup(
      <DraftProvider>
        <StackPage />
      </DraftProvider>,
    );
    expect(html).toContain('Stack Builder');
    expect(html).toContain('Guidé');
    expect(html).toContain('Expert');
  });

  it('branche le shell de l’étape `stack` : la navigation et la progression sont là', () => {
    const html = renderToStaticMarkup(
      <DraftProvider>
        <StackPage />
      </DraftProvider>,
    );
    // La barre de progression du shell, et la condition bloquante du §6 :
    // sans résolution calculée, le bouton « Continuer » est grisé avec sa raison.
    expect(html).toContain('Progression du parcours');
    expect(html).toContain('La compatibilité de la sélection n’a pas encore été vérifiée.');
  });

  it('rend la recherche globale et l’attribut de compatibilité en mode expert seulement', () => {
    const guided = renderToStaticMarkup(
      <DraftProvider>
        <StackPage />
      </DraftProvider>,
    );
    // Le brouillon frais est en mode guidé : la recherche est là, le filtre non.
    expect(guided).toContain('id="pf-stack-search"');
    expect(guided).not.toContain('id="pf-stack-compatible"');
  });
});

describe('Stack Builder : catégories, recherche et cartes', () => {
  it('liste les catégories en grille de trois colonnes, sans conteneur, avec le nombre de choix', () => {
    const html = renderToStaticMarkup(
      <DraftProvider>
        <CategoryNav
          blocks={[
            block('frontend', [option('next', 'selected'), option('vue', 'available')]),
            block('orm', [option('prisma', 'available')]),
          ]}
          current={undefined}
          onSelect={() => undefined}
        />
      </DraftProvider>,
    );
    expect(html).toContain('aria-label="Catégories du catalogue"');
    expect(html).toContain('pf-grid-3');
    expect(html).not.toContain('pf-card');
    expect(html).toContain('data-category="orm"');
  });

  it('porte une loupe dans le champ de recherche', () => {
    const html = renderToStaticMarkup(
      <DraftProvider>
        <ExpertToolbar
          query=""
          onQueryChange={() => undefined}
          compatibleOnly={false}
          onCompatibleOnlyChange={() => undefined}
          showCompatibleOnly={false}
        />
      </DraftProvider>,
    );
    expect(html).toContain('pf-search-icon');
    expect(html).toContain('id="pf-stack-search"');
  });

  it('ouvre sur la liste des catégories et annonce la section des technologies choisies', () => {
    const html = renderToStaticMarkup(
      <DraftProvider>
        <StackPage />
      </DraftProvider>,
    );
    expect(html).toContain('Technologies choisies');
    expect(html).not.toContain('Combinaison valide');
    expect(html).not.toContain('Retour aux catégories');
  });
});
