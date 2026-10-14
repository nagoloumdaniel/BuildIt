/**
 * Configuration Next en `.mjs`, pas en `.ts`.
 *
 * Next charge `next.config.ts` en appelant l'API JavaScript de TypeScript
 * (`ts.sys.fileExists`) ; c'est cette API que TypeScript 7 a supprimée. Un
 * fichier de configuration en JavaScript évite le problème à la racine, et ne
 * coûte rien : `next.config.ts` n'a jamais été couvert par `pnpm typecheck`.
 *
 * @type {import('next').NextConfig}
 */
const config = {
  // Le serveur de `pf web` est lancé en local : la sortie autonome suffit.
  output: 'standalone',
  // Un build isolé (preuve E2E pendant qu'un `next dev` réécrit `.next`).
  distDir: process.env['PF_NEXT_DIST_DIR'] ?? '.next',
  // Un outil de travail n'annonce pas sa pile dans chaque réponse.
  poweredByHeader: false,
  /**
   * Aucun composant n'utilise `next/image` : le moteur d'images de Next exige
   * `sharp`, qui n'est pas installé ici toute requête `/_next/image` répondait
   * 400 et le logo s'affichait cassé. Les deux logos sont des WebP préparés à
   * leur taille d'affichage (`scripts/build-brand-webp.py`) et posés en image
   * de fond, donc une seule requête par thème, sans dépendance native.
   *
   * `unoptimized` est laissé vrai pour qu'un `next/image` ajouté plus tard serve
   * le fichier tel quel au lieu d'échouer en silence sur une 400.
   */
  images: {
    unoptimized: true,
  },
  /**
   * Les gabarits du générateur sont lus sur le disque à l'exécution : rien ne
   * les importe, donc le traçage de Next ne les voit pas et la fonction
   * déployée partait sans eux (« template introuvable » en production). On
   * les embarque explicitement, pour toutes les routes et actions.
   */
  outputFileTracingIncludes: {
    '/**': ['../../packages/generator/templates/**/*'],
  },
  // Les paquets du moteur sont des paquets workspace qui publient leur
  // **source** (`"import": "./src/index.ts"`) : sans cette liste, webpack les
  // prend pour des dépendances ordinaires de `node_modules` et bute sur du
  // TypeScript. Next en profite aussi pour autoriser les fichiers hors de
  // `apps/web` (`experimental.externalDir`), ce qui est le cas de tout import
  // croisé dans ce monorepo. `import 'server-only'` dans l'adaptateur garde le
  // moteur côté serveur : un composant client qui l'importerait fait échouer le
  // build (`'server-only' cannot be imported from a Client Component module`).
  transpilePackages: [
    '@buildit/compatibility',
    '@buildit/exec',
    '@buildit/generator',
    '@buildit/git',
    '@buildit/github',
    '@buildit/manifest',
    '@buildit/presets',
    '@buildit/registry',
    '@buildit/ui',
    '@buildit/workspace',
  ],
  eslint: {
    // Le linter du dépôt est Biome (`pnpm lint`), pas ESLint : l'étape de lint
    // de Next n'a rien à vérifier ici.
    ignoreDuringBuilds: true,
  },
  /**
   * Les paquets du moteur écrivent leurs imports internes en `.js`
   * (`./rules.js`) : c'est la forme qu'exige `moduleResolution: NodeNext` pour
   * rester exécutable tel quel par Node. TypeScript la résout vers le `.ts` d'à
   * côté, webpack non transpiler ces paquets depuis leur source échoue donc
   * sur chaque import interne. On applique au bundler la règle du compilateur.
   *
   * Réglage inutile sous Turbopack, qui n'est pas utilisé ici (`next dev` /
   * `next build` sans `--turbopack`).
   */
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      ...webpackConfig.resolve.extensionAlias,
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
      '.cjs': ['.cts', '.cjs'],
    };
    // Le générateur situe son dossier `templates/` par
    // `new URL('../templates', import.meta.url)` : webpack y voit une
    // requête de module vers un **dossier**, qu'il ne sait pas résoudre, et le
    // build s'arrête là. On lui demande de laisser l'expression telle quelle
    // pour les paquets du monorepo la résolution redevient une affaire
    // d'exécution. Réglage limité à `packages/` : la découpe d'assets de Next
    // lui-même continue de fonctionner normalement.
    webpackConfig.module.rules.push({
      test: /[\\/]packages[\\/]/,
      parser: { url: false },
    });
    return webpackConfig;
  },
};

export default config;
