import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { OptionView } from '../../../lib/engine';
import { CapabilityOptions } from './option-list';

const OPTIONS: readonly OptionView[] = [
  { id: 'stripe', label: 'Stripe', category: 'payments', state: 'selected' },
  { id: 'paypal', label: 'PayPal', category: 'payments', state: 'available' },
  {
    id: 'adyen',
    label: 'Adyen',
    category: 'payments',
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

  it('grise une option bloquée et affiche la raison du moteur (§12)', () => {
    const html = renderToStaticMarkup(<CapabilityOptions options={OPTIONS} />);

    // Le refus est porté par l'élément lui-même, pas par une couleur seule.
    expect(html).toContain('disabled=""');
    expect(html).toContain('Adyen est exclusif avec Stripe.');
  });

  it('n’invente aucune option quand la famille est vide', () => {
    const html = renderToStaticMarkup(<CapabilityOptions options={[]} />);

    expect(html).not.toContain('<button');
    expect(html).toContain('Aucune option');
  });
});
