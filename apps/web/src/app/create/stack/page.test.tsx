import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DraftProvider } from '../../../components/wizard/draft-provider';
import StackPage from './page';
import { CategoryNav, ExpertToolbar, OptionButton } from './stack-options';
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

describe('OptionButton', () => {
  it('grise une option bloquée, écrit sa raison et n’en fait pas un bouton mort', () => {
    const html = renderToStaticMarkup(
      <OptionButton
        option={option('mui', 'blocked', {
          label: 'Material UI',
          reason: 'Ne sort pas sur mobile.',
        })}
        onToggle={() => undefined}
      />,
    );
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('Incompatible');
    expect(html).toContain('Ne sort pas sur mobile.');
    // Jamais `disabled` : la raison resterait inaccessible au clavier.
    expect(html).not.toContain('disabled=""');
  });

  it('marque un choix en cours et le badge « Recommandé » sans les confondre', () => {
    const chosen = renderToStaticMarkup(
      <OptionButton option={option('react', 'selected')} onToggle={() => undefined} />,
    );
    const recommended = renderToStaticMarkup(
      <OptionButton option={option('vue', 'available')} recommended onToggle={() => undefined} />,
    );
    const plain = renderToStaticMarkup(
      <OptionButton option={option('svelte', 'available')} onToggle={() => undefined} />,
    );

    expect(chosen).toContain('aria-pressed="true"');
    expect(chosen).toContain('Choisi');
    expect(recommended).toContain('Recommandé');
    expect(recommended).toContain('aria-pressed="false"');
    expect(plain).not.toContain('Recommandé');
  });

  it('ne recommande jamais une option bloquée, même si on le demande', () => {
    const html = renderToStaticMarkup(
      <OptionButton option={option('mui', 'blocked')} recommended onToggle={() => undefined} />,
    );
    expect(html).not.toContain('Recommandé');
  });

  it('annonce le choix local avant que le moteur ne l’ait confirmé', () => {
    // L'état rendu par le moteur arrive après un aller-retour serveur. Sans le
    // choix local, un lecteur d'écran entend « non appuyé » juste après avoir
    // appuyé — c'est ce que la passe clavier a relevé (2026-10-11).
    const optimistic = renderToStaticMarkup(
      <OptionButton
        option={option('react', 'available')}
        chosenLocally
        onToggle={() => undefined}
      />,
    );
    const engineConfirmed = renderToStaticMarkup(
      <OptionButton option={option('react', 'selected')} onToggle={() => undefined} />,
    );
    // Le choix local l'emporte quand le moteur n'a pas encore répondu…
    expect(optimistic).toContain('aria-pressed="true"');
    // …et le badge reste celui du moteur : l'affichage ne ment pas sur l'état validé.
    expect(optimistic).not.toContain('Choisi');
    expect(engineConfirmed).toContain('aria-pressed="true"');
    expect(engineConfirmed).toContain('Choisi');
    // Un choix local retiré éteint le bouton même si l'état moteur est en retard.
    const unselected = renderToStaticMarkup(
      <OptionButton
        option={option('react', 'selected')}
        chosenLocally={false}
        onToggle={() => undefined}
      />,
    );
    expect(unselected).toContain('aria-pressed="false"');
  });
});

describe('CategoryNav', () => {
  const blocks = [
    block('frontend', [option('react', 'selected'), option('vue', 'available')]),
    block('database', [option('postgres', 'available')]),
  ];

  it('affiche chaque catégorie avec le nombre de choix faits', () => {
    const html = renderToStaticMarkup(
      <CategoryNav blocks={blocks} current="frontend" onSelect={() => undefined} />,
    );
    expect(html).toContain('Frontend');
    expect(html).toContain('Base de données');
    expect(html).toContain('2 fiche');
    expect(html).toContain('1 fiche<');
  });

  it('marque la catégorie ouverte', () => {
    const html = renderToStaticMarkup(
      <CategoryNav blocks={blocks} current="database" onSelect={() => undefined} />,
    );
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
  });
});

describe('ExpertToolbar', () => {
  it('cache le filtre de compatibilité hors mode expert', () => {
    const html = renderToStaticMarkup(
      <ExpertToolbar
        query=""
        onQueryChange={() => undefined}
        compatibleOnly={false}
        onCompatibleOnlyChange={() => undefined}
        showCompatibleOnly={false}
      />,
    );
    expect(html).toContain('id="pf-stack-search"');
    expect(html).not.toContain('pf-stack-compatible');
  });

  it('montre le filtre de compatibilité en mode expert, avec sa valeur', () => {
    const html = renderToStaticMarkup(
      <ExpertToolbar
        query="drizzle"
        onQueryChange={() => undefined}
        compatibleOnly
        onCompatibleOnlyChange={() => undefined}
        showCompatibleOnly
      />,
    );
    expect(html).toContain('id="pf-stack-compatible"');
    expect(html).toContain('checked=""');
  });
});
