import { EN_ACCOUNT, FR_ACCOUNT } from './messages.account';
import { EN_BUILD, FR_BUILD } from './messages.build';
import { EN_DASHBOARD, FR_DASHBOARD } from './messages.dashboard';
import { EN_WIZARD, FR_WIZARD } from './messages.wizard';
import { EN_WORKSPACE, FR_WORKSPACE } from './messages.workspace';
import type { Widen } from './widen';

/**
 * Le dictionnaire des deux langues.
 *
 * Pas de clés en chaîne : le français est la **forme** du dictionnaire
 * (`typeof FR`), l'anglais doit la satisfaire exactement, et chaque écran lit
 * `t.dashboard.title` — une faute de frappe devient une erreur de compilation,
 * et une entrée ajoutée d'un côté sans l'autre fait échouer `pnpm typecheck`.
 *
 * Les valeurs variables passent par une fonction (`t.generate.files(3)`) plutôt
 * que par un gabarit `{n}` : l'accord et l'ordre des mots diffèrent d'une
 * langue à l'autre, et une fonction le dit dans la langue concernée.
 *
 * Ce qui **n'est pas** traduit, à dessein : les identifiants techniques
 * (`next`, `pnpm install`), les chemins, les sorties de commande et les
 * messages d'erreur venus du moteur — ils sont les mêmes dans un terminal.
 */

const FR_CORE = {
  common: {
    appName: 'BuildIt',
    tagline: 'Décrivez un projet, obtenez un projet prêt à développer.',
    back: 'Retour',
    backHome: 'Accueil',
    previous: 'Précédent',
    continue: 'Continuer',
    cancel: 'Annuler',
    retry: 'Réessayer',
    close: 'Fermer',
    loading: 'Chargement…',
    working: 'Opération en cours…',
    copy: 'Copier',
    copied: 'Copié',
    browse: 'Parcourir…',
    choose: 'Choisir',
    change: 'Changer',
    search: 'Rechercher',
    skipToContent: 'Aller au contenu',
    noResults: 'Aucun résultat.',
    seeAll: 'Tout voir',
    theme: 'Thème',
    themeLight: 'clair',
    themeDark: 'sombre',
    themeSystem: 'système',
    language: 'Langue',
    step: (position: number, total: number) => `Étape ${position} sur ${total}`,
    percent: (value: number) => `${value} %`,
  },

  /** Le nom court de chaque étape, tel qu'il tient dans la barre de progression. */
  steps: {
    create: 'Nom',
    target: 'Plateformes',
    type: 'Type',
    architecture: 'Architecture',
    stack: 'Stack',
    capabilities: 'Capacités',
    env: 'Environnement',
    infrastructure: 'Infrastructure',
    blueprint: 'Blueprint',
    preview: 'Aperçu',
    generate: 'Génération',
    report: 'Rapport',
  },

  nav: {
    label: 'Navigation principale',
    home: 'Accueil',
    create: 'Créer',
    clone: 'Cloner',
    open: 'Ouvrir',
    projects: 'Projets',
    github: 'GitHub',
    repo: 'Dépôt',
  },

  picker: {
    chooseFolder: 'Choisir un dossier',
    chooseFile: 'Choisir un fichier',
    opening: 'Fenêtre de l’explorateur ouverte…',
    openingHint: 'La fenêtre s’est ouverte sur le bureau de cette machine.',
    cancelled: 'Aucun dossier choisi.',
    unsupported:
      'L’explorateur ne peut pas s’ouvrir depuis un serveur distant. Collez le chemin du dossier.',
    failed: 'L’explorateur n’a pas pu s’ouvrir. Collez le chemin du dossier.',
    clear: 'Effacer le chemin',
  },

  errors: {
    notFoundTitle: 'Cette page n’existe pas',
    notFoundCode: '404',
    notFoundBody:
      'L’adresse demandée ne correspond à aucun écran. Le lien est peut-être périmé, ou le parcours a changé de nom.',
    notFoundHome: 'Retour à l’accueil',
    notFoundCreate: 'Créer un projet',
    crashTitle: 'Cet écran s’est arrêté',
    crashBody:
      'Rien n’a été écrit sur le disque. Réessayez : si le problème revient, revenez à l’accueil et reprenez le brouillon.',
    offline: 'Le serveur ne répond pas. Vérifiez que « pf web » tourne toujours.',
  },

  a11y: {
    progress: 'Progression du parcours',
    stepNavigation: 'Navigation de l’étape',
    themeToggle: (current: string) => `Thème : ${current}`,
    localeToggle: (current: string) => `Langue : ${current}`,
    loading: 'Chargement en cours',
  },
} as const;

const EN_CORE: Widen<typeof FR_CORE> = {
  common: {
    appName: 'BuildIt',
    tagline: 'Describe a project, get a project ready to build on.',
    back: 'Back',
    backHome: 'Home',
    previous: 'Previous',
    continue: 'Continue',
    cancel: 'Cancel',
    retry: 'Try again',
    close: 'Close',
    loading: 'Loading…',
    working: 'Working…',
    copy: 'Copy',
    copied: 'Copied',
    browse: 'Browse…',
    choose: 'Choose',
    change: 'Change',
    search: 'Search',
    skipToContent: 'Skip to content',
    noResults: 'Nothing found.',
    seeAll: 'See all',
    theme: 'Theme',
    themeLight: 'light',
    themeDark: 'dark',
    themeSystem: 'system',
    language: 'Language',
    step: (position: number, total: number) => `Step ${position} of ${total}`,
    percent: (value: number) => `${value}%`,
  },

  steps: {
    create: 'Name',
    target: 'Platforms',
    type: 'Type',
    architecture: 'Architecture',
    stack: 'Stack',
    capabilities: 'Capabilities',
    env: 'Environment',
    infrastructure: 'Infrastructure',
    blueprint: 'Blueprint',
    preview: 'Preview',
    generate: 'Generate',
    report: 'Report',
  },

  nav: {
    label: 'Main navigation',
    home: 'Home',
    create: 'Create',
    clone: 'Clone',
    open: 'Open',
    projects: 'Projects',
    github: 'GitHub',
    repo: 'Repository',
  },

  picker: {
    chooseFolder: 'Choose a folder',
    chooseFile: 'Choose a file',
    opening: 'Explorer window open…',
    openingHint: 'The window opened on this machine’s desktop.',
    cancelled: 'No folder chosen.',
    unsupported: 'The explorer cannot open from a remote server. Paste the folder path instead.',
    failed: 'The explorer could not open. Paste the folder path instead.',
    clear: 'Clear the path',
  },

  errors: {
    notFoundTitle: 'This page does not exist',
    notFoundCode: '404',
    notFoundBody: 'The address matches no screen. The link may be stale, or the path was renamed.',
    notFoundHome: 'Back to home',
    notFoundCreate: 'Create a project',
    crashTitle: 'This screen stopped',
    crashBody:
      'Nothing was written to disk. Try again: if it comes back, return home and resume the draft.',
    offline: 'The server is not answering. Check that “pf web” is still running.',
  },

  a11y: {
    progress: 'Path progress',
    stepNavigation: 'Step navigation',
    themeToggle: (current: string) => `Theme: ${current}`,
    localeToggle: (current: string) => `Language: ${current}`,
    loading: 'Loading',
  },
};

/**
 * Le dictionnaire complet : le noyau plus chaque zone.
 *
 * La composition est explicite et plate — pas de fusion profonde, pas de
 * `Object.assign` récursif. Chaque zone possède ses propres clés de premier
 * niveau, donc une collision serait une faute de conception, et TypeScript la
 * signalerait ici plutôt que de la résoudre en silence à l'exécution.
 */
export const FR = {
  ...FR_CORE,
  ...FR_DASHBOARD,
  ...FR_WORKSPACE,
  ...FR_WIZARD,
  ...FR_BUILD,
  ...FR_ACCOUNT,
};

/** La forme du dictionnaire : le français fait foi. */
export type Messages = Widen<typeof FR>;

export const EN: Messages = {
  ...EN_CORE,
  ...EN_DASHBOARD,
  ...EN_WORKSPACE,
  ...EN_WIZARD,
  ...EN_BUILD,
  ...EN_ACCOUNT,
};

export const MESSAGES: Readonly<Record<'fr' | 'en', Messages>> = { fr: FR, en: EN };
