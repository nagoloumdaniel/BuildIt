import type { Category } from '@buildit/registry';
import type { IconName } from './icon';

/**
 * L'icône de chaque catégorie du catalogue.
 *
 * `satisfies Record<Category, IconName>` : une catégorie ajoutée au registry
 * sans icône est une erreur de compilation, pas une case vide à l'écran. Une
 * seule table, lue par le Stack Builder, les capacités et la bulle de détails —
 * deux tables auraient fini par donner deux icônes à la même famille.
 *
 * **Aucune icône en forme de coche.** La coche était le marqueur de sélection
 * retiré des cartes : une `checkCircle` orange sur les fiches `validation`, ou
 * un `shieldCheck` sur les fiches `security`, se liraient comme elle. La
 * validation prend un œil (ce qu'on inspecte), la sécurité un bouclier nu.
 */
export const CATEGORY_ICONS = {
  frontend: 'appWindow',
  language: 'code',
  styling: 'brush',
  ui: 'component',
  backend: 'server',
  database: 'database',
  orm: 'table',
  authentication: 'lock',
  authorization: 'key',
  state: 'workflow',
  'data-fetching': 'refresh',
  forms: 'listChecks',
  validation: 'eye',
  api: 'plug',
  build: 'wrench',
  'package-manager': 'package',
  monorepo: 'grid',
  testing: 'flask',
  linting: 'scanLine',
  formatting: 'alignLeft',
  'git-hooks': 'gitCommit',
  containers: 'box',
  'dev-environment': 'terminal',
  'ci-cd': 'rocket',
  hosting: 'cloud',
  storage: 'hardDrive',
  cache: 'zap',
  queue: 'inbox',
  search: 'search',
  email: 'mail',
  payments: 'creditCard',
  observability: 'activity',
  analytics: 'barChart',
  security: 'shield',
  ai: 'bot',
  cms: 'fileText',
  ecommerce: 'shoppingCart',
} as const satisfies Record<Category, IconName>;

export function categoryIcon(category: string): IconName {
  return (CATEGORY_ICONS as Readonly<Record<string, IconName>>)[category] ?? 'layers';
}
