import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DraftProvider } from '../../../components/wizard/draft-provider';
import CapabilitiesPage from './page';

describe('écran Capabilities (§6.7)', () => {
  it('rend le cadre de l’étape et toutes les familles de capacités', () => {
    const html = renderToStaticMarkup(
      <DraftProvider>
        <CapabilitiesPage />
      </DraftProvider>,
    );

    expect(html).toContain('Étape 6 sur 12');
    expect(html).toContain('Capacités');
    // Les familles sont visibles avant tout chargement : l'écran n'est jamais
    // une page blanche en attendant le moteur.
    for (const label of ['Paiements', 'Stockage', 'Recherche', 'Intelligence artificielle']) {
      expect(html).toContain(label);
    }
  });

  it('dit où va le choix, sans inventer de champ au manifest', () => {
    const html = renderToStaticMarkup(
      <DraftProvider>
        <CapabilitiesPage />
      </DraftProvider>,
    );

    expect(html).toContain('services');
    expect(html).toContain('brouillon');
  });

  it('annonce l’absence de choix au lieu de la masquer', () => {
    const html = renderToStaticMarkup(
      <DraftProvider>
        <CapabilitiesPage />
      </DraftProvider>,
    );

    expect(html).toContain('Aucune capacité choisie');
  });
});
