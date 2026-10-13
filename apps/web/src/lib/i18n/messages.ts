import { EN_ACCOUNT, FR_ACCOUNT } from './messages.account';
import { EN_ARCHITECTURE, FR_ARCHITECTURE } from './messages.architecture';
import { EN_BUILD, FR_BUILD } from './messages.build';
import { EN_DASHBOARD, FR_DASHBOARD } from './messages.dashboard';
import { EN_GRAPH, FR_GRAPH } from './messages.graph';
import { EN_JOURNEY, FR_JOURNEY } from './messages.journey';
import { EN_OUTPUT, FR_OUTPUT } from './messages.output';
import { EN_SHARE, FR_SHARE } from './messages.share';
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
    copyFailed: 'Copie impossible : sélectionnez la valeur et copiez-la à la main.',
    delete: 'Supprimer',
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
    preview: 'Architecture',
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
    graph: 'Graphe',
    source: 'Code source',
  },

  /**
   * Le pied de page : ce qui reste utile une fois la page lue. La version est
   * une valeur technique, la même dans les deux langues — elle n'est pas
   * traduite, seulement affichée.
   */
  footer: {
    navLabel: 'Raccourcis du pied de page',
    licenceLine: 'Logiciel libre, licence MIT',
    version: '0.5.0',
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
    notFoundPathWhat: 'l’adresse demandée',
    notFoundHome: 'Retour à l’accueil',
    notFoundCreate: 'Créer un projet',
    crashTitle: 'Cet écran s’est arrêté',
    crashBody:
      'Rien n’a été écrit sur le disque. Réessayez : si le problème revient, revenez à l’accueil et reprenez le brouillon.',
    offline: 'Le serveur ne répond pas. Vérifiez que « pf web » tourne toujours.',
  },

  /**
   * La carte d'une technologie et sa bulle de détails (`OptionCard`). La
   * conséquence et la solution d'un refus sont choisies par le **code** du
   * moteur : la phrase du moteur dit ce qui coince, celles-ci disent ce que ça
   * change et quoi faire.
   */
  optionCard: {
    recommended: 'Recommandé',
    incompatible: 'Incompatible',
    details: (name: string) => `Détails sur ${name}`,
    stateSelected: 'Choisie pour ce projet.',
    stateAvailable: 'Compatible avec vos choix actuels.',
    conflictsWith: 'En conflit avec',
    consequence: 'Conséquence',
    solution: 'Solution',
    alternatives: (names: string) => `Alternatives compatibles : ${names}.`,
    docs: 'Documentation',
    docsOf: (name: string) => `Documentation officielle de ${name}`,
    advice: {
      ecosystem: {
        consequence:
          'Le projet généré ne démarrerait pas : ces technologies ne s’exécutent pas dans le même moteur.',
        solution: 'Choisissez une alternative du même écosystème, ou changez de framework.',
      },
      exclusive: {
        consequence: 'Le projet n’en câble qu’une : les deux se disputeraient le même rôle.',
        solution: (names: string) =>
          `Retirez ${names} pour choisir celle-ci, ou gardez votre choix actuel.`,
      },
      conflict: {
        consequence:
          'Les deux outils se marcheraient dessus : fichiers de configuration, verrou ou commandes en double.',
        solution: (names: string) =>
          `Gardez-en un seul : retirez ${names}, ou renoncez à celle-ci.`,
      },
      target: {
        consequence: 'Elle ne fonctionne sur aucune des plateformes choisies.',
        solution:
          'Ajoutez la plateforme qu’elle vise à l’étape Plateformes, ou choisissez une alternative.',
      },
      engine: {
        consequence: 'Aucune version du runtime ne satisfait les deux contraintes à la fois.',
        solution: 'Choisissez une alternative, ou une autre version de l’outil en conflit.',
      },
      other: {
        consequence: 'La génération serait refusée avec cette combinaison.',
        solution: 'Choisissez une alternative compatible.',
      },
    },
  },

  a11y: {
    progress: 'Progression du parcours',
    stepNavigation: 'Navigation de l’étape',
    copyWhat: (what: string) => `Copier ${what}`,
    themeSet: (name: string) => `Passer au thème ${name}`,
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
    copyFailed: 'Could not copy: select the value and copy it by hand.',
    delete: 'Delete',
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
    preview: 'Architecture',
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
    graph: 'Graph',
    source: 'Source code',
  },

  footer: {
    navLabel: 'Footer shortcuts',
    licenceLine: 'Open source, MIT licence',
    version: '0.5.0',
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
    notFoundPathWhat: 'the requested address',
    notFoundHome: 'Back to home',
    notFoundCreate: 'Create a project',
    crashTitle: 'This screen stopped',
    crashBody:
      'Nothing was written to disk. Try again: if it comes back, return home and resume the draft.',
    offline: 'The server is not answering. Check that “pf web” is still running.',
  },

  optionCard: {
    recommended: 'Recommended',
    incompatible: 'Incompatible',
    details: (name: string) => `Details about ${name}`,
    stateSelected: 'Chosen for this project.',
    stateAvailable: 'Compatible with your current choices.',
    conflictsWith: 'Conflicts with',
    consequence: 'Consequence',
    solution: 'Solution',
    alternatives: (names: string) => `Compatible alternatives: ${names}.`,
    docs: 'Documentation',
    docsOf: (name: string) => `${name} official documentation`,
    advice: {
      ecosystem: {
        consequence:
          'The generated project would not start: these technologies do not run in the same engine.',
        solution: 'Pick an alternative from the same ecosystem, or change framework.',
      },
      exclusive: {
        consequence: 'The project wires only one: both would compete for the same role.',
        solution: (names: string) =>
          `Remove ${names} to pick this one, or keep your current choice.`,
      },
      conflict: {
        consequence:
          'The two tools would step on each other: duplicate config files, lockfile or commands.',
        solution: (names: string) => `Keep only one: remove ${names}, or drop this one.`,
      },
      target: {
        consequence: 'It runs on none of the chosen platforms.',
        solution: 'Add the platform it targets at the Platforms step, or pick an alternative.',
      },
      engine: {
        consequence: 'No runtime version satisfies both constraints at once.',
        solution: 'Pick an alternative, or another version of the conflicting tool.',
      },
      other: {
        consequence: 'Generation would be refused with this combination.',
        solution: 'Pick a compatible alternative.',
      },
    },
  },

  a11y: {
    progress: 'Path progress',
    stepNavigation: 'Step navigation',
    copyWhat: (what: string) => `Copy ${what}`,
    themeSet: (name: string) => `Switch to the ${name} theme`,
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
  ...FR_JOURNEY,
  ...FR_OUTPUT,
  ...FR_ARCHITECTURE,
  ...FR_GRAPH,
  ...FR_SHARE,
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
  ...EN_JOURNEY,
  ...EN_OUTPUT,
  ...EN_ARCHITECTURE,
  ...EN_GRAPH,
  ...EN_SHARE,
};

export const MESSAGES: Readonly<Record<'fr' | 'en', Messages>> = { fr: FR, en: EN };
