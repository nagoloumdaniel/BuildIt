import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Badge, badgeClassName } from './badge.js';
import { Button, buttonClassName } from './button.js';
import { joinClassNames } from './class-names.js';
import { Field } from './field.js';
import { StatusMessage } from './status-message.js';

/**
 * Le contrat de ces primitives est un **HTML identique** à celui du balisage
 * dupliqué qu'elles remplacent dans `apps/web` : ce sont les classes `pf-*`
 * rendues qui sont vérifiées ici, pas une impression de rendu.
 */
describe('joinClassNames', () => {
  it('joint les fragments et ignore les vides', () => {
    expect(joinClassNames('pf-btn', '', undefined, 'mt-3')).toBe('pf-btn mt-3');
  });

  it('ne rend jamais de balisage quand il n’y a rien', () => {
    expect(joinClassNames()).toBe('');
  });
});

describe('Button', () => {
  it('rend pf-btn, type="button" par défaut, et la variante demandée', () => {
    expect(renderToStaticMarkup(<Button>Annuler</Button>)).toBe(
      '<button class="pf-btn" type="button">Annuler</button>',
    );
    expect(renderToStaticMarkup(<Button variant="primary">Continuer</Button>)).toContain(
      'class="pf-btn pf-btn-primary"',
    );
    expect(renderToStaticMarkup(<Button variant="ghost">Retour</Button>)).toContain(
      'class="pf-btn pf-btn-ghost"',
    );
  });

  it('ajoute la classe de l’écran après la variante', () => {
    expect(buttonClassName('primary', 'mt-3')).toBe('pf-btn pf-btn-primary mt-3');
    expect(renderToStaticMarkup(<Button className="mt-3">Envoyer</Button>)).toContain(
      'class="pf-btn mt-3"',
    );
  });

  it('transmet disabled et onClick, et respecte un type explicite', () => {
    const html = renderToStaticMarkup(
      <Button disabled type="submit" onClick={() => undefined}>
        Créer
      </Button>,
    );
    expect(html).toContain('type="submit"');
    expect(html).toContain('disabled');
  });
});

describe('Badge', () => {
  it('rend pf-badge seul par défaut', () => {
    expect(renderToStaticMarkup(<Badge>Lecture seule</Badge>)).toBe(
      '<span class="pf-badge">Lecture seule</span>',
    );
  });

  it('rend chaque ton avec sa classe', () => {
    expect(renderToStaticMarkup(<Badge tone="accent">Choisie</Badge>)).toContain(
      'class="pf-badge pf-badge-accent"',
    );
    expect(renderToStaticMarkup(<Badge tone="ok">Connecté</Badge>)).toContain(
      'class="pf-badge pf-badge-ok"',
    );
    expect(renderToStaticMarkup(<Badge tone="danger">Incompatible</Badge>)).toContain(
      'class="pf-badge pf-badge-danger"',
    );
    expect(badgeClassName('ok', 'ml-2')).toBe('pf-badge pf-badge-ok ml-2');
  });
});

describe('StatusMessage', () => {
  it('une aide est une région status, polie', () => {
    expect(
      renderToStaticMarkup(<StatusMessage className="mb-3">Clonage en cours…</StatusMessage>),
    ).toBe('<p class="pf-hint mb-3" role="status">Clonage en cours…</p>');
  });

  it('une erreur est un alert, assertif', () => {
    expect(renderToStaticMarkup(<StatusMessage tone="error">Échec du clone.</StatusMessage>)).toBe(
      '<p class="pf-error" role="alert">Échec du clone.</p>',
    );
  });

  it('laisse le rôle être forcé pour coller à un écran existant', () => {
    expect(
      renderToStaticMarkup(
        <StatusMessage tone="error" role="status">
          Doucement
        </StatusMessage>,
      ),
    ).toContain('role="status"');
  });
});

describe('Field', () => {
  it('rend le label, le contrôle, l’aide et l’erreur, sans élément d’enveloppe', () => {
    const html = renderToStaticMarkup(
      <Field
        error="Ce nom est déjà pris."
        errorId="pf-name-error"
        hint="Visible dans l’URL."
        hintId="pf-name-hint"
        hintClassName="mt-1"
        id="pf-name"
        label="Nom du projet"
      >
        <input className="pf-input" id="pf-name" />
      </Field>,
    );

    expect(html).toBe(
      '<label class="pf-label" for="pf-name">Nom du projet</label>' +
        '<input class="pf-input" id="pf-name"/>' +
        '<p class="pf-hint mt-1" id="pf-name-hint">Visible dans l’URL.</p>' +
        '<p class="pf-error" id="pf-name-error" role="alert">Ce nom est déjà pris.</p>',
    );
  });

  it('sans aide ni erreur, n’ajoute aucun paragraphe', () => {
    const html = renderToStaticMarkup(
      <Field id="pf-folder" label="Dossier">
        <input className="pf-input" id="pf-folder" />
      </Field>,
    );
    expect(html).toBe(
      '<label class="pf-label" for="pf-folder">Dossier</label><input class="pf-input" id="pf-folder"/>',
    );
  });

  it('accepte null comme absence, et la classe du label de l’écran', () => {
    const html = renderToStaticMarkup(
      <Field error={null} hint={null} id="pf-repo" label="Dépôt" labelClassName="mt-4" />,
    );
    expect(html).toBe('<label class="pf-label mt-4" for="pf-repo">Dépôt</label>');
  });
});
