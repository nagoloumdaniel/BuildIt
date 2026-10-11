# Phase 12 — Packaging & déploiement : ce qui est prêt, ce qui manque

**Statut : bloqué sur deux accès externes** — un compte npm avec jeton, et un hébergement. Tout ce qui ne demande ni l'un ni l'autre est écrit ici, exécutable tel quel le jour où les accès arrivent. Rien n'a été publié ni déployé : aucune affirmation de cette page n'est une preuve de mise en ligne, seulement une préparation vérifiable.

Couvre §15 (infrastructure), §23 (release). Gate M7 : `npm i -g` depuis le registre public, web en prod, erreurs dans Sentry, rollback **testé**.

## 1. État actuel, mesuré

| Élément | État | Preuve |
|---|---|---|
| `pf` construit et exécutable | fait | `pnpm build` — 15/15 tâches turbo |
| Binaire `pf` déclaré | fait | `apps/cli/package.json` → `bin.pf` → `bin/pf.js` → `dist/main.js` |
| Versionnement | outillé | Changesets (`@changesets/cli`), `.changeset/config.json`, `access: public`, `baseBranch: main` |
| Publication npm | **bloqué** | pas de compte npm, pas de jeton, pas de `NPM_TOKEN` |
| Web déployable | fait | `apps/web` construit 22 routes en sortie `standalone` |
| Hébergement web | **bloqué** | aucun compte Vercel/Cloudflare |
| Sentry + analytics | **bloqué** | aucun DSN, aucun compte |
| Procédure de rollback | écrite ci-dessous, **non testée** | un rollback non testé n'est pas un rollback (gate M7) |

En revanche, les 13 paquets de `packages/` portent `"private": true` : une publication accidentelle y est **refusée** par pnpm, et c'est cette garde-là qui protège, pas `publishConfig` (qu'ils déclarent aussi, pour le jour où ils deviendront publics). Seul `@nagoloum/cli` est publiable — et il embarque le moteur dans son bundle à la construction.

## 2. Publier le CLI (`12.1`)

```bash
# 1. Le jeton, hors du dépôt (§24) — jamais dans un fichier versionné.
#    npm → Access Tokens → « Automation » (contourne le 2FA en CI).
export NPM_TOKEN=npm_…

# 2. Une entrée de version : le CLI change, les paquets internes suivent.
pnpm changeset                      # interactif : choisir @nagoloum/cli, minor/major
git add .changeset && git commit -m "chore: version du CLI"

# 3. La pré-release : tag `next`, jamais `latest` avant la preuve d'installation.
pnpm changeset version
pnpm build
pnpm -r --filter @nagoloum/cli publish --access public --tag next --no-git-checks
```

**Vérification obligatoire sur une machine vierge** (le gate le demande, pas un `npm view`) :

```bash
npm i -g @nagoloum/cli@next
pf --version
mkdir /tmp/essai && cd /tmp/essai && pf create voisinage --preset saas
```

Puis passer `latest` : `npm dist-tag add @nagoloum/cli@<version> latest`. Tant que cette installation n'a pas été faite ailleurs que sur la machine de développement, la version reste en `next` — c'est la règle qui évite de publier une casse en `latest`.

**Ce qui peut casser, et a déjà cassé ailleurs** : `apps/cli/templates/` n'est pas dans `files` par hasard (`bin`, `dist`, `templates`) — un paquet publié sans ses templates démarre et échoue à la première génération. Le script `build` copie ces templates (`scripts/copy-templates.mjs`) ; publier sans `pnpm build` d'abord envoie un paquet vide.

## 3. Déployer le web (`12.2`)

```bash
# Vercel, depuis la racine du monorepo : le répertoire du projet est apps/web.
vercel link
vercel env add PF_SITE_URL production     # l'origine publique, sans barre finale
vercel --prod
```

Trois contraintes connues de ce dépôt décident de la configuration :

- **`output: 'standalone'`** convient à un serveur Node (VPS, Railway, Docker) ; sur Vercel, la sortie n'est pas utilisée et c'est la plateforme qui construit. Ne pas « corriger » le standalone pour Vercel : `pf web` en dépend pour servir une application distribuée.
- **`typescript@6.0.3` dans `apps/web` uniquement** : Next 15 refuse TypeScript 7 (son API JavaScript a disparu). Un environnement de build qui impose TypeScript 7 casse le déploiement — la version est dans `apps/web/package.json`, et elle doit rester la seule exception.
- **`transpilePackages`** : l'application importe la **source** des paquets du workspace, pas leur `dist/`. Un déploiement qui ne copie que `apps/web` échoue ; la racine du dépôt est le contexte de build.

`PF_SITE_URL` est la variable qui rend le sitemap et les métadonnées absolus. Sans elle, le site se construit mais annonce des URL relatives — c'est précisément le constat d'exploitation de la [revue SEO](2026-10-11-phase11-seo-llms.md).

## 4. Observabilité (`12.4`, `12.5`)

Le Doctor compte déjà deux constats ouverts sur ce dépôt : « monitoring d'erreurs » et « limitation de débit ». Les fermer demande des comptes, pas du code.

| Outil | Pourquoi | Ce qu'on envoie | Ce qu'on n'envoie pas |
|---|---|---|---|
| Sentry | une erreur de production sans trace coûte une journée | la pile d'appel, la version, la route | aucun contenu de manifest, aucun jeton, aucun chemin local (§0, §24) |
| Plausible ou Umami | savoir si le site sert à quelque chose | page vue, referrer, pays | pas de cookie, pas d'empreinte, pas de profil |

Le `pf doctor` du web doit rester vert après l'ajout : `NEXT_PUBLIC_SENTRY_DSN` est une variable **publique** (elle part dans le bundle, c'est sa nature), `SENTRY_AUTH_TOKEN` ne l'est pas et reste côté build.

Événements à instrumenter, dans cet ordre — celui du funnel, pas celui de la curiosité :

1. `install` réussi (le premier run est la métrique n°1 de la bêta) ;
2. manifest produit ;
3. génération réussie ;
4. projet qui **build** (la seule qui compte) ;
5. lien de partage créé (signal d'usage réel, §20).

## 5. Vérification de bout en bout (`12.6`)

À faire en production, pas en local :

```bash
curl -sS -o /dev/null -w '%{http_code} %{time_starttransfer}s\n' https://<domaine>/     # 200, < 2 s
curl -sS https://<domaine>/robots.txt
curl -sS https://<domaine>/sitemap.xml | head -5
curl -sS -H 'Host: attaquant.example' https://<domaine>/                                # le domaine public, lui, répond 200
```

Le contrôle de `Host` (`apps/web/src/middleware.ts`) protège un serveur **local**. Une application hébergée est publique par définition : le déployer ne réintroduit pas la faille, mais il faut le dire, parce que la même route répond sur un domaine public.

## 6. Rollback (`12.7`) — écrit, non testé

**CLI** : `npm dist-tag add @nagoloum/cli@<version-précédente> latest`. Le paquet fautif reste installable, mais plus personne ne l'obtient par défaut. Un `npm unpublish` dans les 72 h est possible ; après, il est interdit par npm et la seule sortie est une version de correction.

**Web** : `vercel rollback` (ou l'onglet Deployments → « Promote to Production » sur le déploiement précédent). La variable d'environnement n'est pas concernée par un rollback : c'est une raison de plus de ne pas y mettre de valeur fonctionnelle.

**Critère de rollback**, écrit avant d'en avoir besoin : erreur Sentry sur > 1 % des requêtes, ou first load > 2 s pendant 10 minutes, ou une génération cassée pour les utilisateurs. Sans critère écrit, un rollback se décide sous pression.

## 7. Ce qu'il reste à faire par un humain

- [ ] Un compte npm + un jeton Automation → `NPM_TOKEN` en secret de dépôt, jamais en clair (§24).
- [ ] Un compte d'hébergement (Vercel ou Cloudflare) → domaine + `PF_SITE_URL`.
- [ ] Un projet Sentry → `NEXT_PUBLIC_SENTRY_DSN` (public) et `SENTRY_AUTH_TOKEN` (secret de build).
- [ ] Un compte analytics respectueux des données (Plausible/Umami) → variable publique.
- [ ] **Tester le rollback**, pas seulement le lire : c'est le seul point du gate M7 qui ne peut pas être écrit d'avance.
