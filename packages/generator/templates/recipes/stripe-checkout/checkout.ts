import Stripe from 'stripe';

/**
 * Paiement Stripe Checkout pour {{projectName}}.
 *
 * La clé secrète vient de l'environnement (voir .env.example), jamais du code.
 */
function stripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (secretKey === undefined || secretKey === '') {
    throw new Error('STRIPE_SECRET_KEY est vide : renseignez-la dans .env.');
  }
  return new Stripe(secretKey);
}

/** Crée une session de paiement et renvoie l'URL vers laquelle rediriger le client. */
export async function createCheckoutSession(options: {
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<string> {
  const session = await stripeClient().checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: options.priceId, quantity: 1 }],
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
  });
  if (session.url === null) {
    throw new Error('Stripe n’a pas renvoyé d’URL de paiement.');
  }
  return session.url;
}
