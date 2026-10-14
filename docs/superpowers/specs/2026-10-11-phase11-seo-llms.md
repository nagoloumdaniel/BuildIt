# Phase 11 SEO technique et `llms.txt`

**Date :** 11/10/2026 · **Dépôt :** `D:\Projets\BuildIt`, branche `feat/phase8-web-socle`
**Objet :** fermer le second point ouvert du gate M6 « `seo-audit` sans erreur bloquante, `llms.txt` publié » ([roadmap](../roadmap.md), ligne 712) dans la limite de ce qui est vérifiable sans hébergement.
**Périmètre d'écriture tenu :** `docs/llms.txt`, `docs/README.md`, `apps/web/src/app/robots.ts`, `apps/web/src/app/sitemap.ts`, la **métadonnée** de `apps/web/src/app/layout.tsx` et `apps/web/src/app/share/page.tsx`. Rien dans `packages/**`, `apps/cli/**`, `globals.css`, `next.config.mjs`, `apps/web/package.json`.

## 1. Ce que « publié » veut dire ici, et pourquoi le gate reste ouvert

« Publié » au sens du gate suppose un **site qui sert** le fichier. Il n'y en a pas : la décision 8B.6 tient l'UI hors hébergement pour le MVP, `pf web` n'écoute que sur `127.0.0.1`, et le déploiement est la Phase 12. La roadmap l'écrit d'ailleurs (ligne 712) : « `llms.txt` est écrit et versionné, mais **pas publié** ».

Ce rapport livre donc ce qui est vérifiable **hors hébergement** : l'audit, les correctifs, les fichiers prêts à déployer et les preuves locales que ces fichiers produisent bien ce qu'ils promettent.

## 2. Audit de l'état initial

Recompté, pas recopié : **19 routes** (`page.tsx` sous `apps/web/src/app`), dont **2 seulement** déclarent leurs métadonnées (`layout.tsx:20`, `share/page.tsx:14` les 17 autres héritent des mêmes titre et description).

### Ce qui allait déjà bien

- `lang="fr"` sur `<html>` (`layout.tsx`) ;
- une `description` réelle, pas un slogan ;
- `/share` déjà en `robots: { index: false, follow: false }` la bonne décision, écrite et motivée dans le code ;
- aucune valeur sensible dans les métadonnées (cohérent avec le §24).

### Findings

| # | Sévérité | Constat | Preuve | État |
|---|---|---|---|---|
| F1 | haute | **Aucun `robots.txt` ni `sitemap.xml`** : ni route, ni fichier statique. Un moteur ne reçoit ni directive ni carte du site. | `apps/web/public/` absent ; aucun `app/robots.ts`/`app/sitemap.ts` | **corrigé** |
| F2 | haute | **Pas de `metadataBase`** : Next ne peut pas produire d'URL absolue (canonique, Open Graph) les aperçus de lien n'ont pas d'adresse. | aucune occurrence de `metadataBase` dans `apps/web/src` | **corrigé** |
| F3 | haute | **17 routes sur 19 partagent le même `<title>` et la même description** (« BuildIt »), donc des titres dupliqués à l'échelle du site. | 2 exports `metadata` pour 19 `page.tsx` | **partiellement corrigé** : gabarit de titre posé ; les titres par écran restent à écrire (voir §6) |
| F4 | moyenne | **Aucun Open Graph ni Twitter Card** : un lien partagé s'affiche nu. | aucune balise `og:`/`twitter:` dans le HTML construit initial | **corrigé** (sans image, voir F6) |
| F5 | moyenne | **`og:title` figé au niveau du layout** défaut que j'ai introduit dans ma première version et que la vérification du build a révélé : `/share` annonçait « BuildIt » dans ses aperçus au lieu de son propre titre. | HTML construit : `share.html` → `og:title=BuildIt` | **corrigé** (vérifié après correction) |
| F6 | moyenne | **Aucune icône ni image de partage** : pas de `favicon.ico`, pas d'`icon.*`, pas d'`apple-icon.*`, pas d'`opengraph-image.*`. La requête `/favicon.ico` n'a rien à servir. | recompté : `public/` absent, 0 fichier d'icône sous `apps/web` (hors artefact `coverage/favicon.png`, qui n'est pas servi) | **non corrigé hors périmètre** (direction artistique ; `assets/brand/` est explicitement provisoire) |
| F7 | moyenne | **`llms.txt` n'est pas servi** : le fichier est dans `docs/`, or l'application servie est `apps/web`. Aucune route ne répond à `/llms.txt`. | aucune occurrence de `llms` sous `apps/web/src` | **signalé** (voir §5) |
| F8 | faible | **Aucune donnée structurée** (`application/ld+json`). | 0 occurrence dans `layout.tsx` | **à faire avec la landing** (étape 11.8, skill `schema`) |
| F9 | faible | **Les 17 écrans du parcours sont indexables par défaut.** Si `pf web` était un jour exposé publiquement, un moteur trouverait 17 pages quasi identiques. | `robots` par défaut ; seul `/share` est en `noindex` | **décision documentée** (voir §6) |

## 3. Corrections livrées

**`apps/web/src/app/robots.ts`** (nouveau) `/robots.txt` engendré à la construction : `Allow: /` et l'URL du sitemap. Une **seule** origine, `PF_SITE_URL`, avec le repli sur ce que `pf web` sert (`http://127.0.0.1:4173`) : aucun domaine en dur, puisque aucun n'existe.

**`apps/web/src/app/sitemap.ts`** (nouveau) `/sitemap.xml` engendré : une URL, la racine. Les écrans du parcours ne sont pas du contenu et `/share` est en `noindex`.

**`apps/web/src/app/layout.tsx`** (métadonnée seule) `metadataBase`, gabarit de titre (`%s · BuildIt`), `applicationName`, Open Graph (`type`, `siteName`, `locale`, `url`), Twitter Card `summary`. `title`/`description` sont **volontairement absents** de `openGraph` pour que chaque page garde les siens c'est le correctif de F5, commenté dans le code.

**`apps/web/src/app/share/page.tsx`** (métadonnée seule) titre ramené à `Configuration partagée`, le gabarit ajoutant « · BuildIt ». Avant, le titre complet aurait donné « … BuildIt · BuildIt ».

### Pourquoi `app/robots.ts` et non `apps/web/public/robots.txt`

Un `robots.txt` statique et une route `app/robots.ts` visent **la même URL** : Next 15.5 embarque d'ailleurs un contrôle de conflit entre fichier public et route (`A conflicting public file and page file was found for path …`, `apps/web/node_modules/next/dist/server/lib/router-server.js:354`). Surtout, un fichier statique obligerait à y écrire le domaine **avant** de l'avoir, alors que la route lit `PF_SITE_URL` : au déploiement, une variable d'environnement suffit et **rien n'est à éditer**. Le fichier engendré a la même forme qu'un statique :

```text
User-Agent: *
Allow: /

Sitemap: <PF_SITE_URL>/sitemap.xml
```

## 4. Preuves locales

| Vérification | Commande | Résultat |
|---|---|---|
| Types | `pnpm exec tsc --noEmit` (dans `apps/web`) | **exit 0** a d'abord révélé 3 erreurs dans mes fichiers (`process.env.PF_SITE_URL` → `process.env['PF_SITE_URL']`), corrigées |
| Format | `pnpm exec biome check` sur les 4 fichiers TS touchés | **exit 0** seulement des `useLiteralKeys` (info) sur `process.env['…']`, **conflit d'outils assumé par le dépôt** : Biome propose l'accès par point, `noPropertyAccessFromIndexSignature` l'interdit (TS4111). La convention retenue est celle du dépôt (`actions.ts:114`, `packages/exec/src/index.ts:66`), et ces infos préexistent ailleurs (`2026-10-11-phase8f-parcours-clavier.md:168`) |
| Construction | `pnpm build` | **exit 0**, 79 s Next liste `○ /robots.txt 127 B` et `○ /sitemap.xml 127 B`, tous deux **prérendus en statique** |
| Servi | `next start -p 4199` puis requêtes HTTP | `GET /robots.txt` → **200**, `content-type: text/plain` ; `GET /sitemap.xml` → **200**, `content-type: application/xml` ; `GET /` → **200** |
| Métadonnées | HTML construit | `/` → `title=BuildIt` ; `/share` → `title=Configuration partagée · BuildIt`, `og:title` **identique au titre de la page**, `og:description` propre à la page, `robots=noindex, nofollow` |

Le serveur de vérification a été arrêté et le port 4199 libéré (vérifié).

## 5. Corrections de `docs/llms.txt`

Le fichier était juste sur les chiffres (283 fiches, 37 catégories recomptés) mais **trompeur sur le parcours** qu'il prescrit :

- **le clone annoncé ne menait pas à la documentation** : `git clone …` donne la branche `main`, où `docs/` n'existe pas. C'est désormais écrit en tête, avec la branche `feat/phase8-web-socle` ;
- **la commande d'installation écrivait dans le dépôt** : `pnpm pf create mon-projet --preset saas` sans `--dir` écrit à la racine du dépôt cloné. Corrigé en `--dir ../mon-projet`, et le piège est expliqué ;
- **statut d'hébergement explicite** : « Ce fichier est versionné mais **pas encore servi** » ;
- **forme publiée annoncée, pas affirmée** : `pnpm add -g @nagoloum/cli` est décrit comme prévu en Phase 12 et **non disponible** ;
- ajout du configurateur web (`pnpm build` puis `pnpm pf web` → `http://127.0.0.1:4173`, boucle locale) et des 19 licences reconnues dans la ligne du registry.

`docs/README.md` : la ligne `llms.txt` disait « à la racine de la doc publiée » elle dit maintenant « versionné, **pas encore servi** (Phase 12) ».

**Liens :** les liens relatifs de tous les fichiers touchés ont été vérifiés par script, **0 cassé après correction** `llms.txt` 14, `quickstart.md` 7, `guide/README.md` 13, `docs/README.md` 20 ; la roadmap, éditée en parallèle par un autre chantier pendant ce travail, en comptait 26 au moment du contrôle, tous valides.

## 6. Ce qui reste à faire, et par qui

- **Titres par écran (F3)** : le gabarit est posé, mais les 17 écrans héritent encore du titre global. Pour une application servie en local, cela n'a aucun effet ; **le jour où un site public existera**, chaque page publiée devra déclarer son titre. Les écrans du parcours, eux, n'ont pas vocation à être indexés (`/share` a montré le motif : `robots: { index: false }` dans la métadonnée de la route).
- **Décision F9, assumée** : `robots.ts` n'interdit rien. Tant que le site public est une landing page, `Allow: /` est correct ; si `pf web` devient public, il faudra décider du sort des écrans du parcours `Disallow` n'empêche pas l'indexation par lien, la métadonnée `noindex` est plus fiable.
- **Icônes et image de partage (F6)** : à prendre avec la direction artistique et `assets/brand/` (logos provisoires).
- **Données structurées (F8)** : à écrire avec la landing page (11.8).
- **Servir `/llms.txt` (F7)** : une seule source, `docs/llms.txt`, copiée dans la sortie servie à la construction **pas** une seconde copie dans `apps/web/public/`, qui dériverait en silence. À faire en Phase 12, quand le site et les docs seront servis ensemble.

## 7. Bloqué faute d'hébergement (Phase 12)

- **« `llms.txt` publié »** : le fichier est prêt, **aucun site ne le sert** → point du gate **non coché**.
- **« `seo-audit` sans erreur bloquante »** : l'audit ci-dessus est **statique** (source + HTML construit + requêtes sur un serveur local). Il ne remplace pas un audit sur un site réel : pas de crawl, pas d'inspection des en-têtes de production (TLS, redirections, cache, HSTS), pas de Core Web Vitals sur un domaine public.
- **`robots.txt` et `sitemap.xml` décrivent un site dont l'hôte est inconnu.** Ils sont corrects par construction (`PF_SITE_URL`), mais **personne ne peut confirmer aujourd'hui** l'URL qui y figurera.
- **Risque résiduel R1** : si `PF_SITE_URL` n'est pas posée au déploiement, le repli écrit `http://127.0.0.1:4173` dans le `sitemap.xml` **sans échouer**. C'est volontaire (le repli est exactement ce que sert `pf web`, et le projet se construit sans variable), mais la checklist de déploiement de la Phase 12 doit inclure cette variable.
- **Un seul point est réellement fermable maintenant** : les fichiers existent, ils sont construits, servis et vérifiés localement. Le gate, lui, demande un site.

## 8. Non audité

Le contenu rédactionnel des pages du guide (hors liens), la structure de titres HTML des écrans (`h1`→`h2`), les performances de chargement, et l'accessibilité relèvent d'autres chantiers de cette session (thème écran par écran, parcours clavier).

## 9. Verdict sur le gate

- [x] `seo-audit` sans erreur bloquante **sur le code** : les findings hauts (F1–F3) sont corrigés ou explicitement bornés, la construction et le service local sont verts. Un audit sur site reste impossible.
- [ ] `llms.txt` **publié** le fichier est corrigé et prêt ; il n'est **pas servi**. Point **non coché**, conformément à la consigne : « publié » suppose un site.
