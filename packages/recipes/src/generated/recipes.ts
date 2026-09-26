// Fichier engendré par scripts/build-index.mjs — ne pas modifier à la main.
// Source de vérité : le dossier data/. Relancer le script après toute modification.

/** Recettes brutes, non validées. `loadRecipeCatalogue()` les valide. */
export const RAW_RECIPES: readonly unknown[] = [
  {"id":"better-auth-email-password","name":"Better Auth — email et mot de passe","description":"Inscription et connexion par email et mot de passe, sessions en base.","for":["better-auth"],"packages":{"better-auth":">=1.0.0 <2.0.0"},"env":["BETTER_AUTH_SECRET","BETTER_AUTH_URL"],"files":[{"template":"recipes/better-auth-email-password/auth.ts","target":"lib/auth.ts"}]},
  {"id":"stripe-checkout","name":"Stripe — paiement Checkout","description":"Session de paiement Stripe Checkout : un prix, une redirection.","for":["stripe"],"packages":{"stripe":"^18.0.0"},"devPackages":{"@types/node":"^24.0.0"},"env":["STRIPE_SECRET_KEY"],"files":[{"template":"recipes/stripe-checkout/checkout.ts","target":"lib/stripe/checkout.ts"}]},
];
