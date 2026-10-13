import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type DraftState, freshDraft } from '../../lib/draft';
import { DraftProvider } from './draft-provider';
import { Progress, ScreenShell, STEP_ICONS, StepShell } from './shell';

/**
 * Le brouillon vu par le cadre, remplaçable test par test : le provider rend
 * sans stockage, donc toujours un brouillon neuf, et le verrou d'un projet
 * généré ne se verrait jamais. `vi.hoisted` parce que `vi.mock` est remonté
 * au-dessus des déclarations du fichier.
 */
const seeded = vi.hoisted(() => ({ draft: null as DraftState | null }));

vi.mock('./draft-provider', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./draft-provider')>();
  return {
    ...actual,
    useDraft: (): DraftState => {
      const draft = actual.useDraft();
      return seeded.draft ?? draft;
    },
  };
});

// Le renvoi d'une étape refermée prend le routeur de Next, absent hors de Next.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

afterEach(() => {
  seeded.draft = null;
});

/**
 * Le cadre commun des écrans : progression, navigation, raison bloquante.
 *
 * Rendu sans DOM (`renderToStaticMarkup`) : c'est le HTML que le serveur envoie,
 * donc ce que voit un lecteur d'écran avant toute hydratation. Un `Continuer`
 * grisé sans explication est un cul-de-sac — le test l'interdit.
 */
function render(node: React.ReactElement): string {
  return renderToStaticMarkup(<DraftProvider>{node}</DraftProvider>);
}

describe('StepShell', () => {
  it('affiche l’étape, la progression et les deux liens de navigation', () => {
    const html = render(
      <StepShell step="target" title="Plateformes cibles" description="Choisissez.">
        <p>contenu</p>
      </StepShell>,
    );

    expect(html).toContain('Plateformes cibles');
    expect(html).toContain('aria-label="Progression du parcours"');
    // L'étape courante est annoncée, pas seulement colorée.
    expect(html).toContain('aria-current="step"');
    expect(html).toContain('href="/create"');
    expect(html).toContain('href="/create/type"');
  });

  it('dit pourquoi on ne peut pas avancer, et désactive le lien', () => {
    const html = render(
      <StepShell step="target" title="Plateformes cibles" description="Choisissez.">
        <p>contenu</p>
      </StepShell>,
    );

    expect(html).toContain('Choisissez au moins une plateforme.');
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('role="status"');
  });

  it('sur la première étape, « Précédent » ramène à l’accueil et non dans le vide', () => {
    const html = render(
      <StepShell step="create" title="Créer un projet" description="Nommez.">
        <p>contenu</p>
      </StepShell>,
    );

    expect(html).toContain('href="/"');
    expect(html).not.toContain('href="/create/create"');
  });

  it('hidePrevious verrouille la navigation : accueil seul, jamais « Précédent » ni « Continuer »', () => {
    const html = render(
      <StepShell step="report" title="Rapport" description="Ce qui a été écrit." hidePrevious>
        <p>contenu</p>
      </StepShell>,
    );

    // Au rapport, « Terminer » (posé par la page) est la seule sortie.
    expect(html).not.toContain('>Accueil<');
    expect(html).not.toContain('Précédent');
    expect(html).not.toContain('Continuer');
  });

  it('la progression ne propose aucun saut en avant : seules les étapes déjà franchies sont des liens', () => {
    const html = renderToStaticMarkup(<Progress current="stack" />);

    // Franchies : cliquables. Revenir corriger un choix est le geste le plus
    // fréquent du parcours, et le rail est l'endroit où on le cherche.
    expect(html).toContain('href="/create"');
    expect(html).toContain('href="/create/architecture"');

    // L'étape courante et les suivantes ne sont pas des liens : y sauter
    // contournerait les conditions bloquantes du §6.
    expect(html).not.toContain('href="/create/stack"');
    expect(html).not.toContain('href="/create/capabilities"');
    expect(html).not.toContain('href="/create/report"');
  });

  it('la progression montre douze numéros sur un rail, sans nom d’étape affiché', () => {
    const html = renderToStaticMarkup(<Progress current="stack" />);

    // La position est dite au lecteur d'écran, une seule fois, à toutes les
    // largeurs : plus de second rendu « petit écran ».
    expect(html).toContain('Étape 5 sur 12');
    expect(html).not.toContain('role="progressbar"');
    expect(html.match(/class="pf-rail-node"/g)).toHaveLength(12);
    // Le rail est rempli jusqu'à l'étape courante : 4 intervalles sur 11.
    expect(html).toContain(`--pf-rail-fill:${4 / 11}`);
    // Le nom reste accessible (texte masqué, `title`), jamais en clair.
    expect(html).toContain('title="Capacités"');
    expect(html).toContain('<span class="pf-journey-sr">Capacités</span>');
  });

  it('pose l’icône de l’étape à gauche du titre', () => {
    const html = render(
      <StepShell step="stack" title="Stack technique" description="Choisissez.">
        <p>contenu</p>
      </StepShell>,
    );

    expect(html).toContain('class="pf-journey-title"');
    expect(html).toContain(`data-icon="${STEP_ICONS.stack}"`);
  });

  it('un accès direct ne glisse pas : aucun écran précédent n’est connu', () => {
    const html = render(
      <StepShell step="type" title="Type" description="Choisissez.">
        <p>contenu</p>
      </StepShell>,
    );

    expect(html).toContain('data-slide="none"');
    expect(html).not.toContain('pf-fade-in');
  });

  it('propose d’annuler la création, sous un nom qui dit ce qu’il annule', () => {
    const html = render(
      <StepShell
        step="target"
        title="Plateformes cibles"
        description="Choisissez."
        actions={<span>geste</span>}
      >
        <p>contenu</p>
      </StepShell>,
    );

    expect(html).toContain('aria-label="Annuler la création du projet"');
    expect(html).toContain('geste');
    // L'encart de confirmation ne s'ouvre que sur demande.
    expect(html).not.toContain('role="alertdialog"');
  });

  it('un projet déjà généré n’a plus rien à annuler', () => {
    const html = render(
      <StepShell step="report" title="Rapport" description="Ce qui a été écrit." hidePrevious>
        <p>contenu</p>
      </StepShell>,
    );

    expect(html).not.toContain('Annuler la création du projet');
  });
});

describe('StepShell : bouton Annuler', () => {
  it('est un vrai bouton à contour, icône X, libellé masquable sur petit écran', () => {
    const html = render(
      <StepShell step="stack" title="Stack technique" description="Choisissez.">
        <p>contenu</p>
      </StepShell>,
    );

    expect(html).toContain('class="pf-btn pf-btn-sm pf-journey-cancel"');
    expect(html).not.toContain('pf-btn-ghost pf-btn-sm');
    expect(html).toContain('data-icon="close"');
    expect(html).toContain('<span class="pf-journey-cancel-text">Annuler</span>');
    // Il vit dans la ligne du titre, pas en dessous.
    expect(html).toMatch(/class="pf-journey-head[^"]*">.*pf-journey-cancel/s);
  });
});

describe('StepShell : projet généré', () => {
  const generated = (step: DraftState['step']): DraftState => ({
    ...freshDraft(),
    name: 'mon-app',
    step,
    generated: true,
  });

  it('referme les dix premières étapes : rien du contenu, une phrase pour le lecteur d’écran', () => {
    seeded.draft = generated('report');
    const html = render(
      <StepShell step="stack" title="Stack technique" description="Choisissez.">
        <p>contenu</p>
      </StepShell>,
    );

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('déjà généré');
    expect(html).not.toContain('contenu');
    expect(html).not.toContain('Stack technique');
    expect(html).not.toContain('Annuler la création du projet');
  });

  it('sur Génération : ni Annuler ni Précédent, mais le Rapport reste à un clic', () => {
    seeded.draft = generated('generate');
    const html = render(
      <StepShell step="generate" title="Génération" description="Écrire.">
        <p>contenu</p>
      </StepShell>,
    );

    expect(html).toContain('contenu');
    expect(html).not.toContain('Annuler la création du projet');
    expect(html).not.toContain('Précédent');
    expect(html).toContain('href="/create/report"');
    // Le stepper ne ramène plus en arrière : aucune étape franchie n'est un lien.
    expect(html).not.toContain('href="/create"');
    expect(html).not.toContain('href="/create/stack"');
  });

  it('sur Rapport, même sans `hidePrevious` : ni Annuler ni Précédent', () => {
    seeded.draft = generated('report');
    const html = render(
      <StepShell step="report" title="Rapport" description="Ce qui a été écrit.">
        <p>contenu</p>
      </StepShell>,
    );

    expect(html).toContain('contenu');
    expect(html).not.toContain('>Accueil<');
    expect(html).not.toContain('Précédent');
    expect(html).not.toContain('Annuler la création du projet');
    expect(html).not.toContain('href="/create/generate"');
  });
});

describe('Progress : petit écran', () => {
  it('pose une barre fine remplie à la proportion de l’étape, cachée du lecteur d’écran', () => {
    const html = renderToStaticMarkup(<Progress current="stack" />);

    expect(html).toContain('<div aria-hidden="true" class="pf-rail-bar"');
    expect(html).toContain(`--pf-rail-bar-fill:${5 / 12}`);
    // La position reste dite, une seule fois.
    expect(html.match(/Étape 5 sur 12/g)).toHaveLength(1);
  });
});

describe('ScreenShell', () => {
  it('rend le titre, la description et les actions', () => {
    const html = renderToStaticMarkup(
      <ScreenShell
        title="Dependency Graph"
        description="Vue avancée."
        actions={<span>action</span>}
      >
        <p>graphe</p>
      </ScreenShell>,
    );

    expect(html).toContain('Dependency Graph');
    expect(html).toContain('Vue avancée.');
    // Sans icône demandée, pas de colonne vide devant le titre.
    expect(html).toContain('pf-journey-title-plain');
    expect(html).toContain('action');
  });

  it('rend l’icône demandée à gauche du titre', () => {
    const html = renderToStaticMarkup(
      <ScreenShell icon="send" title="Partage">
        <p>contenu</p>
      </ScreenShell>,
    );

    expect(html).toContain('data-icon="send"');
    expect(html).not.toContain('pf-journey-title-plain');
  });

  it('sans description, ne laisse pas de paragraphe vide', () => {
    const html = renderToStaticMarkup(
      <ScreenShell title="Accueil">
        <p>contenu</p>
      </ScreenShell>,
    );

    expect(html).not.toContain('pf-subtitle');
  });
});
