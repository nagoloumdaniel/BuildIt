import { betterAuth } from 'better-auth';

/**
 * Authentification de {{projectName}} : email et mot de passe.
 *
 * Better Auth lit BETTER_AUTH_SECRET et BETTER_AUTH_URL dans l'environnement
 * (voir .env.example). Branchez un adaptateur de base de données avant la mise
 * en production : sans lui, les comptes et les sessions ne survivent pas à un
 * redémarrage.
 */
export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
  },
});
