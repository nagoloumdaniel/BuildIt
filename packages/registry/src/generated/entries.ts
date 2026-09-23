// Fichier engendré par scripts/build-index.mjs — ne pas modifier à la main.
// Source de vérité : le dossier data/. Relancer le script après toute modification.

/** Fiches brutes, non validées. `loadCatalogue()` les valide. */
export const RAW_ENTRIES: readonly unknown[] = [
  {"id":"better-auth","name":"Better Auth","category":"authentication","targets":["web","api"],"status":"stable","generation":"certified","template":"auth/better-auth","license":"MIT","lastReviewedAt":"2026-09-23","versionRange":">=1.0.0 <2.0.0","requires":["typescript"],"compatibleWith":["next","prisma","postgresql"],"packages":["better-auth"],"env":["BETTER_AUTH_SECRET","BETTER_AUTH_URL"],"recipes":["email-password","oauth","passkeys"],"docs":"https://www.better-auth.com"},
  {"id":"postgresql","name":"PostgreSQL","category":"database","targets":["web","api"],"status":"stable","generation":"certified","template":"database/postgresql","license":"PostgreSQL","lastReviewedAt":"2026-09-23","versionRange":">=16.0.0","env":["DATABASE_URL"],"docs":"https://www.postgresql.org"},
  {"id":"next","name":"Next.js","category":"frontend","targets":["web"],"status":"stable","generation":"certified","template":"frontend/next","license":"MIT","lastReviewedAt":"2026-09-23","versionRange":">=15.0.0 <17.0.0","requires":["typescript"],"compatibleWith":["prisma","better-auth"],"packages":["next","react","react-dom"],"docs":"https://nextjs.org"},
  {"id":"typescript","name":"TypeScript","category":"language","targets":["web","mobile","desktop","api","library"],"status":"stable","generation":"certified","template":"language/typescript","license":"Apache-2.0","lastReviewedAt":"2026-09-23","versionRange":">=5.5.0 <8.0.0","packages":["typescript"],"docs":"https://www.typescriptlang.org"},
  {"id":"prisma","name":"Prisma","category":"orm","targets":["web","api"],"status":"stable","generation":"certified","template":"orm/prisma","license":"Apache-2.0","lastReviewedAt":"2026-09-23","versionRange":">=6.0.0 <8.0.0","requires":["typescript"],"compatibleWith":["postgresql","next","better-auth"],"packages":["prisma","@prisma/client"],"env":["DATABASE_URL"],"recipes":["migrate","seed"],"docs":"https://www.prisma.io"},
];
