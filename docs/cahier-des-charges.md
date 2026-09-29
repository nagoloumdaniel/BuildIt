# Project Factory — Cahier des charges (v2)

Document de cadrage produit et technique. Fusionne le document source (septembre 2026), les améliorations proposées et les décisions produit validées. Prêt à servir de base de développement.

---

## 0. Décisions produit (nouveau)

Ces choix conditionnent toute la suite du document — ils remplacent les zones d'ambiguïté du document source.

| Sujet | Décision |
|---|---|
| Modèle économique | Gratuit au départ (MVP + V1), monétisation introduite à partir de la V2 : freemium (fonctions avancées, templates premium, génération cloud, gestion d'équipe payantes ; le cœur — CLI, moteur, registry, presets standards — reste gratuit). |
| Public cible | Daniel en premier utilisateur (optimiser son propre workflow, y compris pour Quai3 et ses autres projets), puis ouverture à tout développeur, freelance, agence ou entreprise voulant industrialiser son démarrage de projet. Pas de niche fermée : le produit doit rester utile en solo comme en équipe. |
| Exécution / confidentialité | **Local-first** : le moteur, l'analyse de projet importé et l'AI Stack Advisor tournent en local via le CLI, avec la clé API LLM fournie par l'utilisateur (OpenAI/Anthropic/autre). Aucun code ni prompt ne transite par un serveur Project Factory par défaut. Le **cloud hébergé** (génération sans installation locale, exécution du LLM géré par Project Factory) devient une **option payante** en V2, pas une obligation. |
| Dépôts & GitHub | **Ajouté le 26/09/2026.** Project Factory ne sert pas qu'à créer : il sait aussi **cloner** un dépôt (GitHub ou lien Git) et **ouvrir un projet local** pour en installer les dépendances. Le compte GitHub de l'utilisateur est le seul compte que le produit utilise : connexion GitHub, création du dépôt, partage et ajout de collaborateurs passent par **l'API GitHub**, pas par des comptes Project Factory. Le partage d'un **projet** (le code) n'existe que si ce projet est adossé à un dépôt GitHub ; sans dépôt, seul le lien de configuration en lecture seule (§20) est disponible. Détail en §18bis et §20bis. |
| Collaboration | Partage léger dès le MVP : un lien en lecture seule vers une configuration (Project Manifest + Blueprint), sans compte ni authentification, pour faire valider un choix de stack à un collègue. La gestion d'équipe complète (comptes, permissions, organisations, édition collaborative) arrive en V2, une fois le modèle payant en place. |

Argumentaire résumé (pour mémoire) :
- **Local-first** a été retenu plutôt que cloud-first parce que la fonctionnalité d'import d'un projet existant (section 15) envoie potentiellement du code propriétaire à analyser — un frein rédhibitoire pour un usage en entreprise si tout part sur un serveur tiers par défaut. Partir local-first règle la confidentialité par défaut, évite un chantier infra/facturation dès le MVP, et n'empêche pas de proposer le cloud plus tard comme confort payant (moins de setup, pas de gestion de clé API).
- **Partage léger dès le MVP** a été retenu parce qu'il ne coûte presque rien à construire (un identifiant + une page en lecture seule, pas de compte) mais débloque un usage réel dès le premier jour pour quiconque travaille à plusieurs — sans anticiper tout le chantier compte/organisation qui, lui, attend un modèle payant pour se justifier.

---

## 1. Vision du produit

Project Factory transforme un simple scaffolder en véritable **Development Environment Factory** : décrire un projet, choisir ses plateformes et technologies, obtenir un projet prêt à développer — cohérent, documenté et diagnostiqué.

Fonctions cœur :
- Choix initial de la cible : Web, Mobile, Desktop, ou combinaison.
- Sélection guidée des technologies et services, avec dépendances et incompatibilités gérées.
- Presets prêts à l'emploi (SaaS, e-commerce, dashboard, API, AI SaaS, marketplace...).
- Génération d'un monorepo ou de projets séparés.
- Génération du code, configuration, variables d'environnement, Docker, tests, CI/CD, documentation, Git.
- Analyse d'un projet existant et proposition d'améliorations.
- **AI Stack Advisor** : description en langage naturel → architecture et stack proposées (exécuté en local avec la clé API de l'utilisateur, cf. §0).
- **Project Doctor** : analyse du projet généré/existant, score et corrections automatiques.
- Registry extensible de templates, recipes, services et règles de compatibilité.
- Partage en lecture seule d'une configuration avant génération (cf. §0).
- **Trois points d'entrée** — créer un projet, cloner un dépôt, ouvrir un projet déjà présent sur la machine — choisis dans un menu d'accueil unique (§18bis).
- **Intégration GitHub** : connexion, clonage d'un dépôt personnel ou de n'importe quel lien, création du dépôt d'un projet généré, partage et ajout de collaborateurs (§20bis).

**Principe de non-dépendance (no-lock-in)** — à afficher explicitement dans le produit et la documentation : le code généré est autonome, sans dépendance runtime à Project Factory. Quitter l'outil après génération ne casse rien.

---

## 2. Personas (nouveau)

À garder en tête pour prioriser catalogue, presets et niveaux de configuration :

1. **Daniel / dev solo** — veut démarrer vite un projet cohérent (ex. Quai3), sans reconfigurer Docker/CI/lint à chaque fois. Utilise surtout les presets et le mode guidé.
2. **Freelance / indépendant** — plusieurs projets clients différents, besoin de rapidité et de presets variés, sensible à la gratuité du MVP.
3. **Équipe / agence** — veut imposer une stack cohérente entre projets, partager une configuration pour validation (lien de partage), potentiellement passer au cloud/payant plus tard pour la gestion d'équipe.
4. **Entreprise avec contraintes internes** — sensible à la confidentialité du code (d'où le local-first), veut auditer chaque dépendance (mode expert), a besoin du Project Doctor pour la gouvernance.

---

## 3. Parcours utilisateur principal

0. **Menu d'accueil** — choisir : *Créer un projet*, *Cloner un projet* (puis installer les dépendances si voulu) ou *Ouvrir un projet local* (puis installer les dépendances). Seul *Créer* entre dans le parcours ci-dessous ; les deux autres sont décrits en §18bis.
1. Créer un projet (ou partir d'un lien de configuration partagé).
2. Choisir le mode **guidé** (choix par défaut acceptés, peu d'écrans) ou **expert** (tout configurable) — *nouveau, cf. §6*.
3. Choisir les plateformes cibles : Web / Mobile / Desktop / combinaison.
4. Choisir le profil du projet : SaaS, marketplace, e-commerce, dashboard, blog, AI, API, application métier, etc.
5. Choisir une architecture : single app, monorepo, modular monolith, microservices, serverless, event-driven.
6. Choisir ou accepter une stack recommandée.
7. Configurer les capacités : Auth, DB, Storage, Email, Payments, Search, Realtime, Jobs, Analytics, AI, Monitoring, etc.
8. Visualiser le Project Blueprint (vue simple) et, si besoin, le Dependency Graph (vue avancée) — *nouveau, cf. §6*.
9. Prévisualiser les fichiers qui seront créés (arborescence + contenu, façon éditeur de code).
10. Générer le lien de partage en lecture seule si validation à faire avant génération — *nouveau*.
11. Générer le projet.
12. Exécuter validation, tests, typecheck et checks de configuration.
13. Initialiser Git et, si l'utilisateur est connecté à GitHub, créer le dépôt (privé par défaut) et y pousser le premier commit (§20bis). Une fois le dépôt créé : partager le projet, inviter des collaborateurs.
14. Afficher les instructions de démarrage et le rapport de génération.

À tout moment : sauvegarde automatique de la configuration en cours (brouillon), reprise possible plus tard.

---

## 4. Étape 0 — choix du type de projet

Premier écran, décision structurante — détermine le catalogue de technologies présenté ensuite.

- **Web** : site, SPA, SSR, SSG, full-stack web, PWA.
- **Mobile** : Android + iOS, éventuellement Web via Expo.
- **Desktop** : Windows/macOS/Linux avec Electron ou Tauri, ou Flutter Desktop.
- **Web + Mobile** : partage maximal de types, validation, API, auth et logique métier.
- **Web + Desktop** : interface web réutilisable avec shell desktop.
- **Mobile + Desktop** : selon framework retenu, avec attention aux contraintes natives.
- **Web + Mobile + Desktop** : architecture multi-apps dans un monorepo.
- **API / Backend only** : option avancée pour créer un backend partagé.
- **Library / Package** : création de packages internes ou librairies publiables.

### 4.1 Matrice de choix recommandée

- **Web moderne** : Next.js + TypeScript + Tailwind, chemin par défaut pour les applications React structurées.
- **Mobile React** : Expo + React Native + TypeScript (support officiel Android/iOS/Web, monorepo pris en charge).
- **Desktop React** : Tauri + frontend React/Next-compatible (create-tauri-app avec templates React, Vue, Svelte, Solid, Angular...).
- **Desktop Electron** : alternative quand l'écosystème Chromium/Node et certaines librairies desktop sont prioritaires.
- **Flutter** : option cross-platform distincte pour une base de code UI unique mobile + desktop.

---

## 5. Mécanisme de progressive disclosure (nouveau — comble une lacune du document source)

Le principe « ne pas exposer 100 technologies dès le premier écran » (cf. §22 points de vigilance) est appliqué concrètement ainsi :

- **Mode guidé par défaut** : à chaque étape, 2 à 4 choix recommandés sont affichés (badge « Recommandé » basé sur le profil de projet + compatibilité), le reste est masqué derrière un lien « Voir toutes les options ».
- **Mode expert** : bascule explicite (toggle en haut de l'écran Stack Builder) qui déplie tout le catalogue de la catégorie en cours, avec recherche texte et filtres (catégorie, licence, popularité, compatible/incompatible avec les choix déjà faits).
- **Filtrage dynamique par compatibilité** : dès qu'un choix est fait (ex. mobile = Expo), les options incompatibles ailleurs sont grisées avec une info-bulle expliquant pourquoi, plutôt que simplement masquées (pour rester pédagogique).
- **Recherche globale** : un champ de recherche unique permet de sauter directement à une techno par son nom sans naviguer catégorie par catégorie.

---

## 6. Écrans (renumérotés et complétés)

Pour chaque écran : objectif + ce qui bloque le passage à la suite. (Le document source ne listait que des noms d'écran sans description — corrigé ici.)

1. **Dashboard** — liste des projets créés/en brouillon ; entrée vers un nouveau projet ou un lien partagé reçu. Porte le **menu d'accueil** à trois choix (§18bis) : Créer un projet · Cloner un projet · Ouvrir un projet local.
2. **Create Project** — nom du projet, mode guidé/expert.
3. **Target Selection** — Web/Mobile/Desktop/combinaison (cf. §4). Bloquant : au moins une cible choisie.
4. **Project Type** — profil (SaaS, e-commerce, dashboard...).
5. **Architecture Builder** — single app, monorepo, microservices, etc., avec description courte de chaque option et son impact (complexité, coût d'exploitation).
6. **Stack Builder** — sélection technologie par catégorie, avec progressive disclosure (§5).
7. **Capabilities** — Auth, DB, Storage, Payments, etc.
8. **Environment & Secrets** — liste des variables d'environnement requises par les choix faits, sans jamais afficher/stocker de valeur sensible par défaut.
9. **Infrastructure** — Docker, CI/CD, cloud cible.
10. **Project Blueprint** — vue simple, résumé lisible (« Next.js + PostgreSQL + Stripe... »), bouton pour générer un lien de partage en lecture seule.
11. **Dependency Graph** — vue avancée en graphe interactif, accessible depuis le Blueprint, pas imposée par défaut.
12. **File Preview** — arborescence des fichiers à générer, contenu prévisualisable, diff si projet importé.
13. **Generation Progress** — avancement, étape en cours, possibilité d'annuler proprement (rollback, cf. §9).
14. **Generation Report** — ce qui a été généré, erreurs/avertissements.
15. **Project Doctor** — score visuel, historique d'évolution, actions correctives avec diff avant application (« Fix automatically »).
16. **Existing Project Import** — upload/chemin local du repo, détection (framework, DB, ORM, tests, CI), **étape de confirmation manuelle obligatoire** avant toute migration automatique (cf. §14).
17. **AI Stack Advisor** — champ de description en langage naturel, justification de chaque choix proposé, indication claire que l'exécution est locale et utilise la clé API personnelle de l'utilisateur.
18. **Templates Marketplace** — templates officiels/communautaires/premium (payants, à partir de la V2), recherche, notation.
19. **Template Details** — changelog, compatibilité, licence affichée clairement.
20. **Settings / Registry** — gestion de la clé API LLM personnelle, préférences de mode (guidé/expert), gestion des templates privés.
21. **GitHub Connection** — connexion/déconnexion du compte GitHub, compte connecté, permissions accordées affichées en clair. Jamais le jeton lui-même (§20bis).
22. **Clone Project** — deux onglets : *Mes dépôts* (liste des dépôts du compte connecté, recherche) et *Depuis un lien* (URL collée). Dossier de destination, puis case « Installer les dépendances » avec le gestionnaire détecté. Bloquant : URL valide et dossier de destination inexistant ou vide.
23. **Open Local Project** — choix d'un dossier de la machine, détection du gestionnaire de paquets et de l'écosystème, aperçu de la commande d'installation **avant** de la lancer. Bloquant : dossier contenant un manifeste de dépendances reconnu.
24. **Repository & Sharing** — état du dépôt GitHub du projet (lien, visibilité), création du dépôt si absent, liste des collaborateurs, invitation avec rôle, retrait. Le bouton « Partager le projet » est **grisé avec explication** tant que le projet n'a pas de dépôt GitHub.

Exigences transverses à tous les écrans : responsive, thème clair/sombre, navigation clavier, sauvegarde automatique du brouillon.

---

## 7. Catalogue des stacks

*(Contenu technique du document source, conservé intégralement — c'est la base du registry. Nettoyé des marqueurs de citation résiduels.)*

### 7.1 Web / Frontend
React, Next.js, Vue, Nuxt, Angular, Svelte, SvelteKit, Astro, Remix, SolidJS, Vite, Preact, Qwik, HTMX.

### 7.2 Langages
TypeScript, JavaScript, Dart, Kotlin, Swift, Python, Go, Rust, Java, PHP, C#.

### 7.3 Styling
Tailwind CSS, CSS Modules, Sass/SCSS, Styled Components, Emotion, UnoCSS, Panda CSS, PostCSS, Vanilla CSS.

### 7.4 UI / Design systems
shadcn/ui, Radix UI, Headless UI, HeroUI, Material UI, Chakra UI, Ant Design, Mantine, Bootstrap, DaisyUI, React Aria, Fluent UI, Carbon Design System, PrimeReact, PrimeVue, Vuetify.

### 7.5 Backend / API
Next.js Route Handlers/Server Actions, NestJS, Hono, Fastify, Express, Elysia, FastAPI, Django, Flask, Spring Boot, Laravel, Symfony, Gin, Fiber, Axum, Actix Web, Ruby on Rails.

### 7.6 Base de données
PostgreSQL, MySQL, MariaDB, SQLite, SQL Server, Oracle, MongoDB, Redis, DynamoDB, Cassandra, ScyllaDB, CockroachDB, Neon, Supabase, Turso, PlanetScale, Convex, Firebase.

### 7.7 ORM / ODM
Drizzle, Prisma, TypeORM, MikroORM, Kysely, Sequelize, Knex, Mongoose, SQLAlchemy, Django ORM, Hibernate, Eloquent, GORM, Ent, SQLx, Diesel, SeaORM.

### 7.8 Auth / Authorization
Better Auth, Auth.js, Clerk, Supabase Auth, Firebase Auth, Auth0, WorkOS, Keycloak, Microsoft Entra ID, AWS Cognito, OAuth 2.0, OpenID Connect, SAML, JWT, Passkeys/WebAuthn, CASL, OpenFGA, Cerbos, Oso, Permit.io.

### 7.9 Mobile
React Native, Expo, NativeWind, Flutter, Dart, Kotlin + Jetpack Compose, Swift + SwiftUI, Ionic, Capacitor, .NET MAUI, NativeScript, Kotlin Multiplatform.

### 7.10 Desktop
Tauri, Electron, Flutter Desktop, .NET MAUI, Neutralino.

### 7.11 State / Data fetching
Zustand, Redux Toolkit, Jotai, MobX, XState, TanStack Query, SWR, RTK Query, Apollo Client, urql, Pinia, NgRx.

### 7.12 Forms / Validation
React Hook Form, TanStack Form, Formik, Conform, Zod, Valibot, Yup, Joi, ArkType, TypeBox, JSON Schema, OpenAPI.

### 7.13 API
REST, OpenAPI/Swagger, GraphQL, Apollo, GraphQL Yoga, Hasura, tRPC, gRPC, ConnectRPC, JSON-RPC.

### 7.14 Build / Package / Monorepo
Vite, Turbopack, Webpack, Rollup, esbuild, SWC, Rspack, Rolldown, tsup, pnpm, npm, Yarn, Bun, Turborepo, Nx, pnpm Workspaces, Lerna, Rush, Moon.

### 7.15 Tests
Vitest, Jest, Mocha, Node Test Runner, Playwright, Cypress, Puppeteer, WebdriverIO, Testing Library, Storybook.

### 7.16 Quality / Git
ESLint, Biome, Prettier, Oxlint, Stylelint, Husky, lint-staged, Lefthook, Git, GitHub, GitLab, Bitbucket, Gitea, Forgejo, Conventional Commits, Commitlint, Changesets, Semantic Release.

### 7.17 Containers / CI-CD / Cloud
Docker, Docker Compose, Podman, Kubernetes, Helm, K3s, GitHub Actions, GitLab CI/CD, Jenkins, CircleCI, Azure DevOps, AWS, Google Cloud, Azure, Vercel, Netlify, Cloudflare, Render, Railway, Fly.io, Hetzner, OVHcloud, DigitalOcean.

### 7.18 Storage / Cache / Queue / Search
S3, Cloudflare R2, Google Cloud Storage, Azure Blob, Supabase Storage, Cloudinary, UploadThing, MinIO, Redis, Valkey, RabbitMQ, Kafka, BullMQ, SQS, NATS, Meilisearch, Typesense, Algolia, Elasticsearch, OpenSearch.

### 7.19 Services métier
Resend, SendGrid, Postmark, Brevo, Stripe, PayPal, Adyen, Mollie, Paddle, Lemon Squeezy, Paystack, Flutterwave, Checkout.com.

### 7.20 Observability / Security
Sentry, OpenTelemetry, Grafana, Prometheus, Datadog, New Relic, PostHog, Plausible, Umami, Matomo, Snyk, Dependabot, CodeQL, Semgrep, SonarQube, Trivy, OWASP.

### 7.21 AI
Vercel AI SDK, LangChain, LangGraph, LlamaIndex, Mastra, OpenAI, Anthropic, Google Gemini, Mistral, Groq, Cohere, DeepSeek, xAI, Ollama, vLLM, Pinecone, Qdrant, Weaviate, Milvus, Chroma, pgvector.

### 7.22 CMS / E-commerce
Payload CMS, Strapi, Sanity, Contentful, Directus, Storyblok, Medusa, Saleor, Shopify, WooCommerce, Vendure.

### 7.23 Architecture
Monolith, Modular Monolith, Monorepo, Microservices, Serverless, Event-driven, Clean Architecture, Hexagonal Architecture, DDD, MVC, CQRS, Event Sourcing, BFF, REST API, GraphQL API, tRPC.

**Politique de fraîcheur du catalogue (nouveau)** : chaque entrée porte un statut (`stable` / `beta` / `déprécié`) et une date de dernière revue. Revue trimestrielle du catalogue complet. Une techno dépréciée reste utilisable mais affiche un avertissement.

---

## 8. Presets / Blueprints

- **SaaS Web** — Next.js + TypeScript + Tailwind + shadcn/ui + PostgreSQL + Prisma + Better Auth + Stripe + Resend + Sentry + PostHog + Vercel + Vitest + Playwright.
- **Full-stack Monorepo** — Next.js + Hono + TypeScript + Tailwind + shared UI + PostgreSQL + Prisma + Better Auth + Redis + Zod + Vitest + Playwright + Docker + GitHub Actions.
- **AI SaaS** — Next.js + TypeScript + Tailwind + shadcn/ui + PostgreSQL + Prisma + Better Auth + Vercel AI SDK + OpenAI/Anthropic + pgvector + Redis + Stripe + PostHog + Sentry.
- **Marketplace** — Web + Mobile + Admin + API : Next.js + Expo + NestJS + PostgreSQL + Prisma + Auth + Storage + Payments + Notifications + Search + Redis.
- **Mobile + API** — Expo + React Native + TypeScript + Expo Router + NativeWind + NestJS/Hono + PostgreSQL + Prisma + Auth + Redis + Docker.
- **Desktop + Web** — Next.js/React + Tauri + TypeScript + shared packages + API + PostgreSQL + Auth.
- **API** — Hono + TypeScript + PostgreSQL + Prisma + Redis + OpenAPI + Zod + Docker + GitHub Actions.
- **Dashboard** — Next.js + TypeScript + Tailwind + shadcn/ui + PostgreSQL + Prisma + Better Auth + recette `dashboard-admin` (Recharts, TanStack Table) + Vitest + Playwright + Docker + GitHub Actions. Un espace d'administration complet et protégé : indicateurs, graphique des inscriptions, tableau des utilisateurs (tri, recherche, pagination), paramètres du compte, connexion et inscription — sur les données réelles de l'application, jamais d'exemple inventé.

**Décision du 28/09/2026 — backend : Hono, pour l'API comme pour le Full-stack.** Plus léger que NestJS, standard Web (`fetch`), et une seule façon de faire à maintenir. Une API Hono est documentée (OpenAPI) et validée (Zod) par défaut : le moteur ajoute les deux s'ils manquent. NestJS reste au catalogue (§7.5).

**Décision du 23/09/2026 — ORM par défaut : Prisma.** Les presets livrés utilisent Prisma parce que c'est l'outil réellement employé par le premier utilisateur (§0). Drizzle reste au catalogue (§7.7) comme alternative certifiée. Conséquence sur le pipeline : Prisma exige un `prisma generate` à l'étape Post Install (§22), qui doit échouer explicitement plutôt que livrer un projet qui ne compile pas.

---

## 9. Architecture interne de Project Factory

```
project-factory/
├── apps/
│   ├── web/            # interface du configurateur
│   ├── cli/            # CLI `pf` — même moteur que le web
│   ├── api/             # API du produit (option cloud, V2)
│   └── docs/
├── packages/
│   ├── ui/
│   ├── registry/
│   ├── generator/
│   ├── templates/
│   ├── recipes/
│   ├── compatibility/
│   ├── analyzer/
│   ├── ai/
│   ├── validation/
│   ├── project-manifest/
│   ├── git/            # opérations Git locales (clone, init, commit, push) — §18bis
│   ├── github/         # connexion et API GitHub (dépôts, collaborateurs) — §20bis
│   ├── workspace/      # détection d'un projet local et plan d'installation — §18bis
│   └── config/
├── infrastructure/
└── tooling/
```

Le moteur est indépendant de l'interface. **UI et CLI produisent tous deux un Project Manifest** en entrée du même pipeline (corrige l'incohérence du document source, où le CLI apparaissait sans lien explicite avec le schéma d'architecture — cf. §19bis).

**Nommage** (tranché le 26/09/2026) : « Project Factory » est le nom du produit ; « Forge » est le nom du **moteur** ; le binaire du CLI s'appelle **`pf`**. UI et CLI sont deux façades du moteur Forge. À expliciter dans la documentation utilisateur pour éviter la confusion entre les trois noms.

---

## 10. Project Manifest

```json
{
  "name": "my-project",
  "targets": ["web", "mobile"],
  "architecture": "monorepo",
  "apps": ["web", "mobile", "api", "admin"],
  "frontend": { "framework": "next", "language": "typescript", "styling": "tailwind" },
  "mobile": { "framework": "expo", "language": "typescript" },
  "backend": { "framework": "nestjs" },
  "database": { "engine": "postgresql", "orm": "prisma" },
  "auth": { "provider": "better-auth" },
  "services": ["redis", "storage", "email", "payments"],
  "quality": ["biome", "vitest", "playwright"],
  "infra": ["docker", "github-actions"],
  "shareLink": { "enabled": true, "readOnly": true }
}
```

Le champ `shareLink` matérialise la fonctionnalité de partage léger décidée en §0.

**Le dépôt GitHub n'entre pas dans le manifest.** Un propriétaire, un nom de dépôt ou une URL sont du texte libre ; or le manifest n'a qu'un seul champ libre (`name`), ce qui le rend structurellement incapable de porter un secret alors qu'il transite par les liens de partage. Le dépôt d'un projet se lit là où il vit déjà : le remote Git du dossier local.

---

## 11. Registry : cœur extensible

Chaque technologie est décrite par une fiche machine-readable, versionnée en semver — le registry n'est jamais codé en dur dans les écrans.

```json
{
  "id": "better-auth",
  "category": "authentication",
  "targets": ["web", "mobile", "api"],
  "status": "stable",
  "versionRange": ">=1.0.0 <2.0.0",
  "requires": ["typescript"],
  "compatibleWith": ["next", "nestjs", "prisma", "postgresql"],
  "conflictsWith": [],
  "packages": ["better-auth"],
  "env": ["BETTER_AUTH_SECRET"],
  "recipes": ["email-password", "oauth", "passkeys"],
  "template": "auth/better-auth",
  "license": "MIT"
}
```

Ajouts par rapport au document source : `status` (stable/beta/déprécié), `versionRange` (gestion de version, cf. §12), `license` (affichée à l'utilisateur, alerte si incompatible avec un usage commercial).

**Workflow de contribution (nouveau)** : une nouvelle entrée passe par une CI de validation (schéma + test de génération minimal) avant fusion dans le registry officiel. Le registry communautaire (V2) reprend le même schéma, avec une étape de modération manuelle avant publication publique.

---

## 12. Compatibility Engine

- Compatibilité framework ↔ UI library.
- Compatibilité ORM ↔ database.
- Compatibilité auth ↔ framework/backend.
- Compatibilité mobile ↔ monorepo.
- Compatibilité desktop ↔ frontend.
- Compatibilité build tool ↔ framework.
- Compatibilité deployment ↔ runtime.
- **Compatibilité de versions (nouveau)** : contraintes semver entre technologies (ex. Next.js 15 nécessite Node ≥ 18.18), pas seulement entre technologies prises comme blocs figés.
- Détection des doublons : deux solutions qui remplissent la même capacité.
- Détection des dépendances obligatoires.
- Warnings et erreurs bloquantes avec justification.

Exemple : si l'utilisateur choisit Web + Mobile, le configurateur recommande un package partagé pour types, validation, API client et logique métier, en gardant les couches spécifiques à chaque plateforme séparées.

**Combinaisons certifiées vs expérimentales (nouveau)** : chaque combinaison de stack porte un statut `certifiée` (testée en CI de génération) ou `expérimentale` (best effort, avertissement affiché avant génération). Évite de promettre un support total sur une combinatoire qui explose avec la taille du catalogue.

---

## 13. Structure générée

```
project/
├── apps/
│   ├── web/
│   ├── mobile/
│   ├── desktop/
│   ├── admin/
│   └── api/
├── packages/
│   ├── ui/
│   ├── database/
│   ├── auth/
│   ├── api-client/
│   ├── validation/
│   ├── types/
│   ├── config/
│   ├── logger/
│   └── utils/
├── infra/
│   ├── docker/
│   ├── terraform/
│   └── kubernetes/
├── tests/
├── .github/workflows/
├── .env.example
├── docker-compose.yml
├── package.json
├── README.md
└── turbo.json
```

---

## 14. Capacités fonctionnelles

Authentication/Authorization, Database/ORM, Storage/Upload, Email/Notifications, Payments, Search, Realtime, Background Jobs/Scheduling, Cache, Analytics, Monitoring, Feature Flags, Internationalisation, SEO, AI/LLM/RAG, Maps, Charts/Data Visualization, Rich Text, Tables/Data Grid, CMS, E-commerce.

---

## 15. Génération d'infrastructure

- Dockerfile et Docker Compose.
- Services locaux : PostgreSQL, Redis, MinIO, Mailpit, Meilisearch selon sélection.
- Dev Container.
- GitHub Actions / GitLab CI.
- Terraform/OpenTofu/Pulumi en option.
- Configuration de déploiement Vercel, Cloudflare, Railway, Render, AWS, GCP, Azure ou VPS.
- Secrets et `.env.example` — jamais de valeur sensible stockée par défaut.
- Health checks et scripts de diagnostic.

---

## 16. Project Doctor

Rapport après génération ou import d'un projet, avec **présentation visuelle** (score graphique, historique d'évolution du score dans le temps — nouveau par rapport au document source qui ne prévoyait qu'un rapport texte) :

```
Project Health: 87/100
✓ TypeScript
✓ Dependencies
✓ Environment variables
✓ Database
✓ Docker
✓ Tests
⚠ Missing production secret
⚠ No rate limiting
✕ CI pipeline missing

Recommended actions:
1. Add rate limiting
2. Add CI pipeline
3. Configure error monitoring
```

Le bouton « Fix automatically » propose un diff avant d'appliquer les changements, avec comparaison avant/après score.

---

## 17. AI Stack Advisor

L'utilisateur décrit le produit en langage naturel (« Je veux une marketplace avec web, application mobile, dashboard vendeur, admin, paiement, notifications et IA »).

- Extraction des besoins.
- Proposition de plateformes, d'architecture, de technologies, avec justification de chaque choix.
- Détection des conflits, estimation de la complexité.
- Génération du Blueprint, modifiable avant génération.
- **Exécution locale par défaut, clé API personnelle de l'utilisateur** (cf. §0) — aucune donnée envoyée à un serveur Project Factory. Le prompt et son contexte ne sont ni stockés ni réutilisés par le produit.
- Option cloud managé (V2, payant) pour qui ne veut pas gérer sa propre clé API.

---

## 18. Import / migration

- Importer un repository existant (traité en local, cf. §0 — pas d'envoi de code à un serveur par défaut).
- Détecter framework, package manager, DB, ORM, tests, CI et services.
- Construire automatiquement le Project Blueprint.
- **Étape de confirmation manuelle obligatoire (nouveau)** avant toute migration automatique majeure (ex. bascule vers monorepo) — la détection reste heuristique et peut se tromper sur un projet en production.
- Créer les packages partagés, ajouter Docker, CI, documentation et observability.
- Proposer des upgrades avec impact estimé.

---

## 18bis. Point d'entrée : créer, cloner ou ouvrir un projet (nouveau)

Le menu d'accueil propose trois chemins, au même niveau dans l'UI et dans le CLI (`pf` lancé sans argument) :

| Choix | Ce qui se passe | Installation des dépendances |
|---|---|---|
| **Créer un projet** | Parcours complet du §3 → Manifest → pipeline du §22 | Étape Post Install du pipeline |
| **Cloner un projet** | Clonage d'un dépôt GitHub personnel (liste, après connexion) **ou** de n'importe quel lien Git (dépôt public sans connexion, dépôt privé avec connexion) | Proposée après le clonage, **si voulu** |
| **Ouvrir un projet local** | Choix d'un dossier de la machine, détection de l'écosystème et du gestionnaire de paquets | Proposée après la détection |

**Ce que ce n'est pas** : ni l'import du §18 (aucune analyse, aucun Blueprint reconstruit, aucune migration), ni le Project Doctor. Cloner puis installer est volontairement simple ; l'analyse d'un projet cloné reste une étape distincte, en V2.

**Détection et installation** :
- Le gestionnaire de paquets se déduit du fichier de verrouillage (`pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`, `bun.lock`/`bun.lockb`) et à défaut du champ `packageManager`. Sans verrou ni champ : npm, annoncé comme une supposition.
- MVP : écosystème JavaScript/TypeScript. Les autres écosystèmes (Python, Rust, Go, PHP…) sont **détectés et nommés**, avec la commande à lancer soi-même ; leur installation automatique arrive en V1.
- La commande exacte est affichée **avant** d'être lancée ; l'utilisateur confirme.
- **Un dépôt cloné n'est pas du code de confiance** : ses scripts `postinstall` s'exécutent sur la machine. L'installation d'un projet cloné propose donc l'option « sans scripts » (`--ignore-scripts`) et le dit clairement.

**Dossier de destination** : inexistant ou vide, comme pour la génération (§22) — un clone n'écrase jamais rien. Un échec de clonage supprime le dossier partiellement créé.

**Exécution locale** : cloner, ouvrir un dossier et installer touchent le disque. Ces actions exigent que le moteur tourne sur la machine — elles sont dans le CLI dès le MVP ; côté configurateur web, la manière dont l'UI atteint le disque local (serveur local lancé par le CLI ou autre) est tranchée en Phase 8B.

---

## 19. Templates et Marketplace

- Templates officiels (gratuits).
- Templates communautaires (gratuits, modération avant publication).
- **Templates premium (payants, à partir de la V2)** — nouvelle source de revenu alignée avec la décision « gratuit puis payant » (§0).
- Templates privés pour équipes.
- Versioning, tags, recherche, notation, changelog et compatibilité, fork/duplicate.
- Registry d'entreprise (V3).

---

## 20. Collaboration (nouveau, décision §0)

**MVP** : génération d'un lien en lecture seule pointant vers un Project Manifest + Blueprint, sans authentification. Utile pour faire valider une stack à un collègue ou un client avant de générer.

**V1** : historique des liens partagés par projet, expiration configurable.

**V2** : gestion d'équipe complète — comptes, organisations, permissions d'édition, commentaires sur le Blueprint, journal des changements. Fonctionnalité payante, cohérente avec le passage au modèle freemium.

---

## 20bis. GitHub : connexion, dépôt, partage et collaborateurs (nouveau)

**Connexion** :
- CLI : *device flow* OAuth de GitHub (un code à saisir sur github.com) — aucun mot de passe ne transite par Project Factory.
- Jeton stocké dans le **trousseau du système** (Keychain, Credential Manager, libsecret) ; jamais dans un fichier du projet, jamais dans le manifest, jamais dans les logs. Déconnexion = révocation locale du jeton.
- Permissions demandées **au minimum** et annoncées avant la connexion : lecture des dépôts pour cloner, création de dépôt et gestion des collaborateurs seulement quand l'utilisateur s'en sert.
- Local-first (§0) : le jeton ne quitte pas la machine ; les appels partent directement vers l'API GitHub.

**Cloner** : dépôts personnels et d'organisations accessibles au compte connecté (liste + recherche), ou n'importe quel lien (`https://…`, `git@…`, raccourci `propriétaire/dépôt`).

**Créer le dépôt d'un projet généré** : après génération, `git init` + premier commit + création du dépôt GitHub (**privé par défaut**, nom proposé = `name` du manifest) + push. Refus explicite si le nom est pris, sans rien créer à moitié.

**Partager un projet et ajouter des collaborateurs** :
- **Règle** : le partage d'un projet n'est disponible **que si le projet utilise un dépôt GitHub**. Sans dépôt, l'écran propose de le créer d'abord, et seul le lien de configuration en lecture seule (§20) reste possible.
- Partager = inviter un collaborateur GitHub (nom d'utilisateur) avec un rôle — `read`, `triage`, `write`, `maintain`, `admin` —, lister les collaborateurs et invitations en attente, retirer un accès. Le lien du dépôt est copiable.
- Les droits sont ceux de GitHub : l'invitation échoue proprement, avec la raison, si le compte connecté n'est pas administrateur du dépôt.
- Aucun compte Project Factory n'est créé : la gestion d'équipe du §20 (V2, payante) reste distincte. Celle-ci délègue tout à GitHub et ne coûte donc rien à opérer.

**Hors GitHub** : GitLab et Bitbucket sont hors MVP. Un lien Git quelconque se clone ; seules les actions de compte (création, collaborateurs) exigent GitHub.

---

## 21. CLI

Le moteur ne doit pas être prisonnier de l'interface web — le CLI (`pf`, cf. §9) en est la deuxième façade, au même niveau que l'UI, pas un ajout secondaire.

```
pf                 # sans argument : menu d'accueil (créer / cloner / ouvrir) — §18bis
pf create
pf create --web --mobile
pf add auth
pf add database
pf add payments
pf add redis
pf graph
pf doctor
pf analyze
pf upgrade
pf template list
pf template use saas
pf generate
pf share           # génère le lien de partage en lecture seule
pf clone <lien|propriétaire/dépôt> [dossier] [--install] [--ignore-scripts]
pf open <dossier>  # détecte le projet et propose l'installation
pf install         # installe les dépendances du projet courant
pf login           # connexion GitHub (device flow)
pf logout
pf repo create [--public]      # crée le dépôt GitHub du projet et pousse
pf repo share                  # lien du dépôt + collaborateurs
pf collab add <utilisateur> [--role read|triage|write|maintain|admin]
pf collab list
pf collab remove <utilisateur>
```

---

## 22. Architecture du moteur

```
UI ──┐
     ├──► Project Manifest
CLI ─┘
        ↓
   Schema Validation
        ↓
    Stack Resolver
        ↓
 Compatibility Engine (avec contraintes de version)
        ↓
  Dependency Resolver
        ↓
   Recipe Resolver
        ↓
  Template Resolver
        ↓
     File Plan
        ↓
  Dry Run / Preview
        ↓
     Generator
        ↓
   Post Install
        ↓
    Validation
        ↓
      Doctor
        ↓
   Git / GitHub
        ↓
    Deployment
```

Les deux autres points d'entrée du §18bis ne traversent pas ce pipeline — ils n'ont pas de manifest :

```
Cloner          : Lien/dépôt → Validation du lien → Clone → Détection → [Installation]
Ouvrir (local)  : Dossier → Détection → [Installation]
```

Ils partagent avec lui l'exécuteur de commandes (Post Install), la règle du dossier cible vide et le nettoyage en cas d'échec.

En cas d'échec à n'importe quelle étape après le début de l'écriture des fichiers : **rollback automatique** (nouveau) — le système restaure l'état précédent plutôt que de laisser un projet à moitié généré. Une reprise (« retry from last step ») est proposée quand l'échec est lié à une erreur transitoire (réseau, registre npm indisponible...).

---

## 23. Roadmap

### MVP (gratuit)
- Web uniquement — Next.js / React / Vite, TypeScript, Tailwind.
- Monorepo pnpm + Turborepo.
- Presets SaaS / Full-stack / Dashboard / API.
- Registry, Manifest, Template generator, Preview, Docker, Git, README, `.env.example`.
- Mode guidé/expert (§5).
- Lien de partage en lecture seule (§20).
- CLI de base (§21).
- Menu d'accueil : créer / cloner / ouvrir un projet local (§18bis), installation des dépendances JavaScript/TypeScript.
- Connexion GitHub, clonage (dépôts personnels + lien), création du dépôt, partage et collaborateurs via GitHub (§20bis).

### V1 (gratuit)
- Mobile avec Expo, Desktop avec Tauri.
- Backend NestJS/Hono, PostgreSQL + Drizzle/Prisma, Auth, Redis.
- Tests, CI/CD.
- Project Doctor (avec score visuel et historique).
- Dependency Graph (vue avancée).
- Historique des liens de partage.
- Installation des dépendances hors JavaScript (Python, Rust, Go, PHP…) pour les projets clonés ou locaux.
- GitLab et Bitbucket (connexion, création de dépôt, membres).

### V2 (introduction du payant)
- AI Stack Advisor (exécution locale par défaut, option cloud managé payante).
- Import de projets existants (avec confirmation manuelle avant migration).
- Migration vers monorepo, upgrade assistant.
- Marketplace de templates (gratuits + premium payants).
- Registry communautaire (avec modération).
- Cloud generation (payant).
- Gestion d'équipe complète (comptes, organisations — payant).

### V3
- Génération multi-cloud, Infrastructure as Code.
- Deployment automatisé.
- Policy engine, Enterprise registry, Architecture governance.
- AI Architecture Review, Automated remediation.

---

## 24. Points de vigilance

- Ne pas exposer 100 technologies dès le premier écran : mécanisme concret en §5, pas seulement un principe.
- Séparer clairement les capacités des implémentations techniques.
- Ne pas générer de combinaisons non testées : statut certifiée/expérimentale (§12).
- Maintenir une matrice de compatibilité versionnée (§12), y compris entre versions d'une même techno.
- Chaque template doit avoir des tests de génération, priorisés sur les combinaisons certifiées.
- Prévoir un mode dry-run avant toute écriture, et un rollback en cas d'échec en cours d'écriture (§22).
- Afficher les variables d'environnement nécessaires, sans jamais stocker de valeur sensible par défaut.
- Gérer les licences des templates/services, avec alerte si incompatible avec un usage commercial (§11).
- Conserver le moteur de génération indépendant de l'UI — CLI et UI au même niveau (§9, §21).
- **No-lock-in explicite** : le code généré doit rester autonome, à documenter clairement (§1).
- **Confidentialité par défaut** : local-first pour l'analyse de code et l'IA, cloud en option payante seulement (§0, §17, §18).
- **Fraîcheur du catalogue** : statut et revue trimestrielle par entrée (§7).
- **Jeton GitHub** : trousseau système uniquement, permissions minimales, jamais loggé, jamais dans le manifest ni dans un fichier du projet (§20bis).
- **Clonage** : lien validé avant d'appeler Git — pas d'argument commençant par `-`, protocoles limités à `https` et `ssh`, jamais de shell (arguments passés en tableau), aucun prompt interactif caché (§18bis).
- **Code cloné non fiable** : l'installation annonce l'exécution des scripts et propose `--ignore-scripts` ; aucune commande lancée sans confirmation (§18bis).
- **Dépôt privé par défaut** à la création ; le partage de projet n'existe que via GitHub (§20bis).

---

## 25. Conclusion

Le produit est pensé comme une plateforme de composition de projets, pas comme un clone de `create-next-app`. La première décision est la cible — Web, Mobile, Desktop ou combinaison — puis le moteur filtre intelligemment les technologies possibles. Le point différenciant majeur reste la combinaison Registry + Compatibility Engine + Project Manifest + Recipes + Generator + AI Stack Advisor + Project Doctor, complétée ici par un cadrage produit explicite : gratuit puis payant, local-first par défaut, partage léger dès le MVP, ouvert à Daniel comme premier utilisateur puis à tout développeur ou équipe voulant industrialiser son démarrage de projet.

Le résultat attendu est un projet cohérent, reproductible et documenté, avec une architecture visible avant génération, un rapport de santé après génération, et aucune dépendance cachée envers Project Factory une fois le code livré.
