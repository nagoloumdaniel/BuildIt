// @ts-check
/**
 * Engendre `src/components/ui/tech-icons.generated.ts`.
 *
 * Pourquoi un fichier engendré plutôt qu'un import direct de `simple-icons` :
 * le paquet pèse plusieurs mégaoctets pour ~3 300 marques, dont ce
 * configurateur n'en affiche que celles de son catalogue. On extrait les
 * tracés une fois, à la main, et le navigateur ne télécharge que ce qu'il
 * montre. `simple-icons` reste une dépendance de développement : relancer
 * `node scripts/build-tech-icons.mjs` après un ajout au catalogue.
 *
 * La correspondance identifiant du catalogue → marque n'est pas devinable
 * (`next` → `nextdotjs`, `vercel-ai-sdk` → `vercel`) : elle est écrite ici,
 * et toute entrée du catalogue sans marque retombe sur le monogramme.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as simpleIcons from 'simple-icons';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const entriesFile = join(repoRoot, 'packages', 'registry', 'src', 'generated', 'entries.ts');
const outputFile = join(here, '..', 'src', 'components', 'ui', 'tech-icons.generated.ts');
const spriteFile = join(here, '..', 'public', 'tech-sprite.svg');

/** Identifiant du catalogue → slug `simple-icons`, quand il diffère du nom. */
const ALIASES = {
  next: 'nextdotjs',
  'next-intl': 'nextdotjs',
  nuxt: 'nuxt',
  'apollo-client': 'apollographql',
  cassandra: 'apachecassandra',
  'actix-web': 'actix',
  knex: 'knexdotjs',
  moon: 'moonrepo',
  csharp: 'dotnet',
  'azure-devops': 'dotnet',
  node: 'nodedotjs',
  nodejs: 'nodedotjs',
  'vue': 'vuedotjs',
  'nest': 'nestjs',
  'nestjs': 'nestjs',
  'socket-io': 'socketdotio',
  'vitest': 'vitest',
  'drizzle': 'drizzle',
  'drizzle-orm': 'drizzle',
  'tailwind': 'tailwindcss',
  'shadcn-ui': 'shadcnui',
  'react-native': 'react',
  'expo-router': 'expo',
  'tanstack-query': 'reactquery',
  'tanstack-router': 'reactquery',
  'vercel-ai-sdk': 'vercel',
  'google-gemini': 'googlegemini',
  'aws-lambda': 'awslambda',
  'github-actions': 'githubactions',
  'gitlab-ci': 'gitlab',
  'cloudflare-workers': 'cloudflareworkers',
  'cloudflare-pages': 'cloudflarepages',
  'supabase': 'supabase',
  'planetscale': 'planetscale',
  'better-auth': 'auth0',
  'next-auth': 'auth0',
  'react-hook-form': 'reacthookform',
  'framer-motion': 'framer',
  'motion': 'framer',
  'styled-components': 'styledcomponents',
  'css-modules': 'cssmodules',
  'chakra-ui': 'chakraui',
  'material-ui': 'mui',
  'ant-design': 'antdesign',
  'react-router': 'reactrouter',
  'solid': 'solid',
  'solidjs': 'solid',
  'svelte': 'svelte',
  'sveltekit': 'svelte',
  'astro': 'astro',
  'remix': 'remix',
  'postgres': 'postgresql',
  'postgresql': 'postgresql',
  'mysql': 'mysql',
  'sqlite': 'sqlite',
  'mongodb': 'mongodb',
  'mongoose': 'mongodb',
  'redis': 'redis',
  'prisma': 'prisma',
  'typeorm': 'typeorm',
  'kysely': 'kysely',
  'graphql': 'graphql',
  'apollo': 'apollographql',
  'trpc': 'trpc',
  'grpc': 'grpc',
  'connectrpc': 'connectrpc',
  'openapi': 'openapiinitiative',
  'swagger': 'swagger',
  'docker': 'docker',
  'kubernetes': 'kubernetes',
  'terraform': 'terraform',
  'pulumi': 'pulumi',
  'nginx': 'nginx',
  'stripe': 'stripe',
  'resend': 'resend',
  'sendgrid': 'sendgrid',
  'twilio': 'twilio',
  'sentry': 'sentry',
  'posthog': 'posthog',
  'plausible': 'plausibleanalytics',
  'umami': 'umami',
  'matomo': 'matomo',
  'storybook': 'storybook',
  'playwright': 'playwright',
  'cypress': 'cypress',
  'jest': 'jest',
  'eslint': 'eslint',
  'prettier': 'prettier',
  'biome': 'biome',
  'typescript': 'typescript',
  'javascript': 'javascript',
  'python': 'python',
  'rust': 'rust',
  'go': 'go',
  'golang': 'go',
  'java': 'openjdk',
  'kotlin': 'kotlin',
  'swift': 'swift',
  'dart': 'dart',
  'flutter': 'flutter',
  'php': 'php',
  'laravel': 'laravel',
  'ruby': 'ruby',
  'rails': 'rubyonrails',
  'elixir': 'elixir',
  'phoenix': 'phoenixframework',
  'django': 'django',
  'fastapi': 'fastapi',
  'flask': 'flask',
  'express': 'express',
  'fastify': 'fastify',
  'hono': 'hono',
  'koa': 'koa',
  'deno': 'deno',
  'bun': 'bun',
  'vite': 'vite',
  'webpack': 'webpack',
  'rollup': 'rollupdotjs',
  'esbuild': 'esbuild',
  'turborepo': 'turborepo',
  'nx': 'nx',
  'pnpm': 'pnpm',
  'npm': 'npm',
  'yarn': 'yarn',
  'electron': 'electron',
  'tauri': 'tauri',
  'capacitor': 'capacitor',
  'ionic': 'ionic',
  'firebase': 'firebase',
  'appwrite': 'appwrite',
  'pocketbase': 'pocketbase',
  'clerk': 'clerk',
  'auth0': 'auth0',
  'keycloak': 'keycloak',
  'openai': 'openai',
  'anthropic': 'anthropic',
  'mistral': 'mistralai',
  'ollama': 'ollama',
  'langchain': 'langchain',
  'huggingface': 'huggingface',
  'pinecone': 'pinecone',
  'qdrant': 'qdrant',
  'chroma': 'chroma',
  'weaviate': 'weaviate',
  'netlify': 'netlify',
  'vercel': 'vercel',
  'railway': 'railway',
  'render': 'render',
  'fly': 'flydotio',
  'flyio': 'flydotio',
  'heroku': 'heroku',
  'aws': 'amazonwebservices',
  'gcp': 'googlecloud',
  'azure': 'microsoftazure',
  'cloudflare': 'cloudflare',
  'github': 'github',
  'gitlab': 'gitlab',
  'git': 'git',
  'zod': 'zod',
  'rspack': 'rspack',
  'vitepress': 'vite',
  'mdx': 'mdx',
  'contentful': 'contentful',
  'sanity': 'sanity',
  'strapi': 'strapi',
  'directus': 'directus',
  'payload': 'payloadcms',
  'wordpress': 'wordpress',
  'algolia': 'algolia',
  'meilisearch': 'meilisearch',
  'elasticsearch': 'elasticsearch',
  'typesense': 'typesense',
  'rabbitmq': 'rabbitmq',
  'kafka': 'apachekafka',
  'nats': 'natsdotio',
  'temporal': 'temporal',
  'inngest': 'inngest',
  'trigger': 'trigger',
  'upstash': 'upstash',
  'neon': 'neon',
  'turso': 'turso',
  'xata': 'xata',
  'minio': 'minio',
  's3': 'amazons3',
  'cloudinary': 'cloudinary',
  'uploadthing': 'uploadthing',
  'mailgun': 'mailgun',
  'postmark': 'postmark',
  'nodemailer': 'nodemailer',
  'datadog': 'datadog',
  'grafana': 'grafana',
  'prometheus': 'prometheus',
  'opentelemetry': 'opentelemetry',
  'vitess': 'vitess',
  'cockroachdb': 'cockroachlabs',
  'duckdb': 'duckdb',
  'clickhouse': 'clickhouse',
  'influxdb': 'influxdb',
  'surrealdb': 'surrealdb',
  'edgedb': 'edgedb',
  'bootstrap': 'bootstrap',
  'bulma': 'bulma',
  'sass': 'sass',
  'less': 'less',
  'postcss': 'postcss',
  'emotion': 'styledcomponents',
  'radix-ui': 'radixui',
  'headlessui': 'headlessui',
  'mantine': 'mantine',
  'daisyui': 'daisyui',
  'threejs': 'threedotjs',
  'd3': 'd3dotjs',
  'chartjs': 'chartdotjs',
  'leaflet': 'leaflet',
  'mapbox': 'mapbox',
  'i18next': 'i18next',
  'zustand': 'react',
  'redux': 'redux',
  'jotai': 'react',
  'mobx': 'mobx',
  'rxjs': 'reactivex',
  'lodash': 'lodash',
  'dayjs': 'dayjs',
  'axios': 'axios',
  'swr': 'vercel',
  'angular': 'angular',
  'ember': 'emberdotjs',
  'alpine': 'alpinedotjs',
  'htmx': 'htmx',
  'lit': 'lit',
  'qwik': 'qwik',
  'preact': 'preact',
  'react': 'react',
  'expo': 'expo',
  'gatsby': 'gatsby',
  'eleventy': 'eleventy',
  'hugo': 'hugo',
  'jekyll': 'jekyll',
  'docusaurus': 'docusaurus',
  'nextra': 'nextdotjs',
  'mintlify': 'mintlify',
  'pgvector': 'postgresql',
  'cohere': 'cohere',
  'groq': 'groq',
  'deepseek': 'deepseek',
  'vllm': 'python',
  'milvus': 'milvus',
  'llamaindex': 'llamaindex',
  'langgraph': 'langchain',
  'mastra': 'mastra',
  'bruno': 'bruno',
  'insomnia': 'insomnia',
  'postman': 'postman',
};

/** Le nom de l'export `simple-icons` pour un slug : `nextdotjs` → `siNextdotjs`. */
function exportName(slug) {
  return `si${slug.charAt(0).toUpperCase()}${slug.slice(1)}`;
}

const source = readFileSync(entriesFile, 'utf8');
const ids = [...source.matchAll(/"id":"([^"]+)"/g)].map((match) => match[1]);
const unique = [...new Set(ids)].sort();

const found = new Map();
const missing = [];

for (const id of unique) {
  const slug = ALIASES[id] ?? id.replace(/[^a-z0-9]/g, '');
  const icon = simpleIcons[exportName(slug)];
  if (icon === undefined) {
    missing.push(id);
    continue;
  }
  found.set(id, { path: icon.path, title: icon.title, hex: icon.hex });
}

const symbols = [...found.entries()].map(
  ([id, brand]) =>
    `<symbol id="t-${id}" viewBox="0 0 24 24"><title>${brand.title.replace(/[<&>]/g, '')}</title><path fill="currentColor" d="${brand.path}"/></symbol>`,
);

// Le sprite est servi en statique : il sort du bundle JavaScript, le
// navigateur le met en cache une fois, et `fill="currentColor"` laisse le
// thème décider de la couleur. 196 marques y tiennent pour le prix d'une
// requête, contre ~300 ko de JavaScript si on les embarquait.
writeFileSync(
  spriteFile,
  `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">${symbols.join('')}</svg>`,
  'utf8',
);

const lines = [
  '// Fichier engendré par scripts/build-tech-icons.mjs — ne pas modifier à la main.',
  '// Les tracés vivent dans `public/tech-sprite.svg` (marques `simple-icons`, CC0-1.0).',
  '// Ici ne restent que les identifiants disponibles : quelques kilooctets, pas 300.',
  '// Relancer le script après tout ajout au catalogue des technologies.',
  '',
  '/** Les identifiants du catalogue dont le sprite porte la marque. */',
  'export const TECH_BRAND_IDS: ReadonlySet<string> = new Set([',
  ...[...found.keys()].map((id) => `  ${JSON.stringify(id)},`),
  ']);',
  '',
  '/** Le nom lisible d’une marque, pour l’attribut `alt` du logo. */',
  'export const TECH_BRAND_TITLES: Readonly<Record<string, string>> = {',
  ...[...found.entries()].map(([id, brand]) => `  ${JSON.stringify(id)}: ${JSON.stringify(brand.title)},`),
  '};',
  '',
  `/** Les ${missing.length} entrées du catalogue sans marque : elles prennent le monogramme. */`,
  `export const TECH_WITHOUT_BRAND: readonly string[] = ${JSON.stringify(missing)};`,
  '',
];

writeFileSync(outputFile, `${lines.join('\n')}`, 'utf8');
console.log(`${found.size} marques dans le sprite, ${missing.length} sans marque.`);
