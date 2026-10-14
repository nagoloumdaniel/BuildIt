import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { OptionView } from '../../../lib/engine';
import { CapabilityOptions } from './option-list';

const OPTIONS: readonly OptionView[] = [
  {
    id: 'stripe',
    label: 'Stripe',
    category: 'payments',
    targets: ['web', 'api'],
    state: 'selected',
  },
  {
    id: 'paypal',
    label: 'PayPal',
    category: 'payments',
    targets: ['web', 'api'],
    state: 'available',
  },
  {
    id: 'adyen',
    label: 'Adyen',
    category: 'payments',
    targets: ['web', 'api'],
    state: 'blocked',
    reason: 'Adyen est exclusif avec Stripe.',
  },
];

describe('CapabilityOptions', () => {
  it('marque les choix retenus sans les confondre avec les disponibles', () => {
    const html = renderToStaticMarkup(<CapabilityOptions options={OPTIONS} />);

    expect(html).toContain('Stripe');
    expect(html).toContain('PayPal');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
  });

  it('grise une option bloquée et garde la raison du moteur dans sa bulle (§12)', () => {
    const html = renderToStaticMarkup(<CapabilityOptions options={OPTIONS} />);

    // Le refus est porté par l'élément lui-même, pas par une couleur seule, et
    // l'option reste atteignable au clavier : `aria-disabled`, jamais `disabled`.
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain('data-blocked="true"');
    expect(html).toContain('Adyen est exclusif avec Stripe.');
    // La carte propose les options utilisables de la même famille.
    expect(html).toContain('Alternatives compatibles : PayPal.');
  });

  it('n’invente aucune option quand la famille est vide', () => {
    const html = renderToStaticMarkup(<CapabilityOptions options={[]} />);

    expect(html).not.toContain('<button');
    expect(html).toContain('Aucune option');
  });
});
