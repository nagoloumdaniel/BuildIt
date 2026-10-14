import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import RootLayout from './layout';
import { Toaster, ToastList } from './toaster';

/**
 * Vitest tourne en environnement `node` (pas de jsdom) : on prouve le contrat
 * de rendu avec `renderToStaticMarkup`, qui n'a besoin ni de DOM ni de React
 * côté client. Le composant connecté (`Toaster`) n'est monté par React que
 * dans le navigateur ici on vérifie qu'il rend sans lever, qu'il reflète son
 * store, et que le layout le branche réellement.
 */
describe('ToastList', () => {
  it('rend une liste role="status" avec un élément par toast', () => {
    const html = renderToStaticMarkup(
      <ToastList
        toasts={[
          { id: 1, message: 'projet généré', kind: 'success' },
          { id: 2, message: 'disque plein', kind: 'error' },
        ]}
      />,
    );

    expect(html).toContain('role="status"');
    expect(html).toContain('projet généré');
    expect(html).toContain('disque plein');
    expect(html.match(/<li/g)).toHaveLength(2);
  });

  it('distingue les genres par un attribut, sans les confondre', () => {
    const html = renderToStaticMarkup(
      <ToastList
        toasts={[
          { id: 1, message: 'information', kind: 'info' },
          { id: 2, message: 'succès', kind: 'success' },
          { id: 3, message: 'erreur', kind: 'error' },
        ]}
      />,
    );

    expect(html).toContain('data-kind="info"');
    expect(html).toContain('data-kind="success"');
    expect(html).toContain('data-kind="error"');
    // Un toast d'erreur ne doit pas s'annoncer comme un succès : le genre est
    // porté par l'élément, pas par une classe globale.
    expect(html.match(/data-kind="error"/g)).toHaveLength(1);
  });

  it('sans toast, garde la région d’annonce vide et n’invente rien', () => {
    const html = renderToStaticMarkup(<ToastList toasts={[]} />);

    expect(html).toContain('role="status"');
    expect(html).not.toContain('<li');
  });

  it('n’interprète pas le message comme du HTML', () => {
    const html = renderToStaticMarkup(
      <ToastList toasts={[{ id: 1, message: '<img src=x onerror="alert(1)">', kind: 'info' }]} />,
    );

    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});

describe('Toaster', () => {
  it('rend la liste sans état initial et sans lever', () => {
    // `Toaster` est un composant à hooks : il se rend, il ne s'appelle pas.
    const html = renderToStaticMarkup(<Toaster />);

    expect(html).toContain('role="status"');
    expect(html).not.toContain('<li');
  });

  it('affiche les toasts du store auquel il est connecté', async () => {
    // Registre de modules remis à neuf : le store du composant rendu est celui
    // que ce test alimente, pas un état laissé par un autre fichier de test.
    vi.resetModules();
    const { Toaster: ToasterConnecte } = await import('./toaster');
    const { toast } = await import('../lib/toasts');

    toast('projet généré', { kind: 'success' });

    const html = renderToStaticMarkup(<ToasterConnecte />);
    expect(html).toContain('projet généré');
    expect(html).toContain('data-kind="success"');
  });

  it("n'affiche pas un toast d'un autre registre de modules", async () => {
    // Contre-preuve du test précédent : le store est un état de module, pas un
    // global. Si `Toaster` lisait autre chose que le store de son propre
    // registre, le toast de l'ancien registre apparaîtrait ici.
    const { toast } = await import('../lib/toasts');
    toast('toast du registre précédent');

    vi.resetModules();
    const { Toaster: ToasterNeuf } = await import('./toaster');
    const html = renderToStaticMarkup(<ToasterNeuf />);

    expect(html).not.toContain('toast du registre précédent');
    expect(html).not.toContain('<li');
  });

  it('affiche le toast de son propre registre et ignore l’ancien', async () => {
    const { toast } = await import('../lib/toasts');
    toast('toast du registre précédent');

    vi.resetModules();
    const { Toaster: ToasterNeuf } = await import('./toaster');
    const { toast: toastNeuf } = await import('../lib/toasts');
    toastNeuf('toast du registre courant', { kind: 'error' });

    const html = renderToStaticMarkup(<ToasterNeuf />);
    expect(html).toContain('toast du registre courant');
    expect(html).toContain('data-kind="error"');
    expect(html).not.toContain('toast du registre précédent');
    expect(html.match(/<li/g)).toHaveLength(1);
  });
});

describe('layout racine', () => {
  it('branche <Toaster /> : la région d’annonce est dans le document', () => {
    const html = renderToStaticMarkup(RootLayout({ children: null }));

    // Le script anti-flash et la bascule de thème sont toujours là…
    expect(html).toContain('pf-theme');
    expect(html).toContain('Passer au thème');
    // …et le Toaster est bien branché, sinon aucun toast ne s'afficherait.
    expect(html).toContain('role="status"');
  });
});
