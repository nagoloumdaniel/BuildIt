import type { Widen } from './widen';

/**
 * Les textes des écrans qui touchent au disque : ouvrir un projet local,
 * cloner un dépôt. Voir `messages.ts` pour la composition.
 */

export const FR_WORKSPACE = {
  open: {
    title: 'Ouvrir un projet local',
    description:
      'Reconnaissez un projet déjà sur cette machine : écosystème, gestionnaire de paquets, et la commande d’installation exacte — affichée avant d’être lancée.',
    folderLabel: 'Dossier du projet',
    folderHint:
      'Seuls les fichiers qui nomment l’outillage sont lus : package.json, pyproject.toml, Cargo.toml…',
    /* En hébergé, il n'y a pas de bureau à ouvrir : le champ de saisie est le
       repli, et il dit pourquoi plutôt que de laisser croire à un oubli. */
    hostedNote:
      'L’explorateur s’ouvrirait sur le serveur, pas sur votre machine : saisissez le chemin du dossier.',
    pick: 'Choisir un dossier',
    picking: 'Explorateur ouvert…',
    noFolder: 'Aucun dossier choisi.',
    analyse: 'Analyser le dossier',
    analysing: 'Analyse du dossier…',
    /* Choisir, c'est demander : l'analyse part au choix du dossier. Ce bouton
       n'est donc pas « l'étape suivante » mais la reprise d'une analyse déjà
       faite — le dossier a pu changer sur le disque entre-temps. */
    reanalyse: 'Analyser à nouveau',
    noFolderTitle: 'Aucun dossier choisi',
    noFolderBody:
      'Ouvrez l’explorateur de cette machine et désignez le dossier du projet : l’analyse démarre aussitôt, et ne lit que les fichiers d’outillage.',
    notRecognised: 'Dossier non reconnu',
    notRecognisedBody:
      'Ce dossier ne porte aucun manifeste reconnu. Choisissez la racine du projet — celle qui contient package.json, pyproject.toml ou Cargo.toml.',
    detection: 'Détection',
    ecosystem: 'Écosystème',
    manager: 'Gestionnaire',
    notApplicable: 'non applicable',
    readFile: 'Fichier lu',
    installCommand: 'Commande d’installation',
    ignoreScripts: 'Installer sans exécuter les scripts du projet',
    confirm: 'J’ai lu la commande : lancer l’installation',
    install: 'Installer les dépendances',
    installing: 'Installation des dépendances…',
    /* Ni npm, ni pnpm, ni yarn ne publient d'avancement exploitable : la barre
       est indéterminée, et cette phrase dit pourquoi plutôt que de laisser
       croire à un pourcentage manquant. */
    installNoMeasure:
      'Le gestionnaire de paquets ne publie pas d’avancement : la barre dit que ça travaille, pas combien il reste.',
    trustNote:
      'L’installation exécute les scripts du projet avec vos droits sur cette machine. La case ci-dessus les désactive.',
    installDone: (command: string) => `Dépendances installées : ${command}.`,
    installTitle: 'Installation',
    installFailed: 'L’installation a échoué',
    manualOnly: (command: string) =>
      `L’installation automatique de ce type de projet arrive en V1. Lancez vous-même : ${command}`,
    blockerBusy: 'Une opération est en cours.',
    blockerNoInspection: 'Analysez d’abord le dossier.',
    blockerUnknown: 'Ce dossier n’est pas un projet reconnu : rien à installer.',
    blockerManual: 'L’installation automatique de ce type de projet arrive en V1.',
    blockerUnconfirmed: 'Cochez la confirmation : rien ne se lancera sans votre accord.',
  },
  clone: {
    title: 'Cloner un projet',
    description:
      'Clonez un de vos dépôts GitHub ou n’importe quel lien Git. Le dossier de destination doit être absent ou vide : un clone n’écrase rien.',
    sourceLabel: 'Source du dépôt',
    tabMine: 'Mes dépôts',
    tabLink: 'Depuis un lien',
    searchLabel: 'Rechercher un dépôt',
    searchPlaceholder: 'nom ou description',
    loadingRepositories: 'Lecture de vos dépôts…',
    noMatch: (query: string) => `Aucun dépôt ne correspond à « ${query} ».`,
    pickRepository: 'Choisir ce dépôt',
    private: 'privé',
    public: 'public',
    notConnected:
      'Connectez-vous à GitHub pour retrouver vos dépôts. Un dépôt public se clone aussi par son lien, sans connexion.',
    connect: 'Connecter un compte GitHub',
    linkLabel: 'Lien du dépôt',
    /* L'exemple est une **forme** d'adresse : il suit la langue de l'écran
       (`propriétaire/dépôt` / `owner/repository`), mais reste un exemple, pas
       une phrase. */
    linkPlaceholder: 'https://github.com/propriétaire/dépôt, git@…, propriétaire/dépôt',
    folderNamePlaceholder: 'mon-projet',
    destinationLabel: 'Dossier de destination',
    destinationHint:
      'Le dossier doit être absent ou vide. Choisissez où le dépôt atterrit : le clone y crée un sous-dossier au nom du dépôt.',
    parentLabel: 'Dossier parent',
    pickParent: 'Choisir où cloner',
    afterClone: 'Après le clone',
    installAfter: 'Installer les dépendances',
    ignoreScripts: 'Installer sans exécuter les scripts du projet (recommandé)',
    untrusted:
      'Un dépôt cloné n’est pas du code de confiance : ses scripts d’installation s’exécutent sur cette machine. La commande exacte est affichée avant d’être lancée.',
    check: 'Vérifier le lien et le dossier',
    checking: 'Vérification…',
    clone: 'Cloner',
    cloning: 'Clonage en cours…',
    destination: 'Destination',
    repository: 'Dépôt',
    folder: 'Dossier',
    folderFree: 'absent — le clone le créera.',
    folderEmpty: 'existant et vide.',
    folderTaken: 'existant et non vide : refusé.',
    folderUnknown: 'inconnu.',
    result: 'Résultat',
    cloned: (directory: string) => `Dépôt cloné dans ${directory}.`,
    installed: 'Dépendances installées.',
    detected: (description: string) => `Projet détecté : ${description}.`,
    blockerBusy: 'Une opération est en cours.',
    blockerNoPreview: 'Vérifiez d’abord le lien et le dossier de destination.',
    /* En local, le parent est un dossier absolu choisi dans l'explorateur : sans
       lui, il n'y a rien à vérifier. */
    blockerNoParent: 'Choisissez d’abord le dossier où cloner.',
    folderNameLabel: 'Nom du sous-dossier',
    folderNameHint:
      'Un seul nom, sans séparateur de chemin. Le clone crée ce dossier dans le dossier parent choisi.',
    fullPath: 'Chemin complet qui sera écrit',
    fullPathUnknown: 'Choisissez le dossier parent pour voir le chemin complet.',
    /* Le repli de l'hébergé : un chemin absolu venu du navigateur y serait une
       écriture de fichier arbitraire sur le serveur. */
    hostedFallback: (root: string) =>
      `Serveur hébergé : le clone s’exécute sur le serveur, pas sur votre machine. Le dossier reste relatif à la racine de travail : ${root}. Il doit être absent ou vide.`,
    pickOtherFolder: 'Choisir un autre dossier',
    destinationUnavailable: 'Dossier pas accessible',
    destinationUnavailableBody:
      'Ce dossier n’existe pas, ou ce compte n’a pas le droit d’y écrire. Choisissez-en un autre : le clone créera le sous-dossier du dépôt à l’intérieur.',
    reachedPhase: 'Dernière phase atteinte',
    gitDetail: 'Sortie brute de git',
    /* L'annulation arrête **le suivi**, pas le clone : le dire exactement, et ne
       jamais laisser croire que le disque est propre. */
    cancelledTitle: 'Suivi interrompu',
    cancelledBody:
      'L’avancement n’est plus suivi : le clonage peut continuer côté serveur, et le dossier de destination peut rester incomplet. Vérifiez-le avant de l’utiliser.',
    streamFailedTitle: 'Le suivi du clone s’est arrêté',
    /* La vérification est une Server Action : si elle ne répond pas, l'écran
       le dit au lieu de rester sur « Vérification… ». */
    checkFailedTitle: 'La vérification n’a pas abouti',
    checkFailedBody:
      'Le serveur n’a pas répondu : le lien et le dossier n’ont pas été vérifiés. Rien n’a été cloné — réessayez.',
    streamTimeout: (seconds: number) =>
      `Aucun événement reçu depuis ${seconds} secondes : le suivi est arrêté. Vérifiez le dossier de destination sur le disque avant de réessayer.`,
    streamNetwork:
      'La liaison avec le serveur a été perdue : le suivi est arrêté. Le clonage peut continuer côté serveur, et le dossier peut rester incomplet.',
    streamHttp: (status: number) =>
      `Le serveur a refusé la requête (HTTP ${status}) : rien n’a été cloné.`,
    streamMalformed:
      'Réponse d’avancement illisible : le suivi est arrêté. Vérifiez le dossier de destination sur le disque.',
    streamIncomplete:
      'Le serveur a fermé le flux avant la fin : le suivi est arrêté. Le dossier de destination peut être incomplet.',
    resultFailed: 'Le clone n’a pas été effectué',
    installCommand: (command: string) => `Commande d’installation : ${command}.`,
    phaseCounting: 'Comptage des objets',
    phaseCompressing: 'Compression',
    phaseReceiving: 'Réception des objets',
    phaseResolving: 'Résolution des deltas',
    phaseCheckout: 'Extraction des fichiers',
    phaseStarting: 'Connexion au dépôt',
    phaseInstalling: 'Installation des dépendances',
    phaseDone: 'Terminé',
  },
} as const;

export const EN_WORKSPACE: Widen<typeof FR_WORKSPACE> = {
  open: {
    title: 'Open a local project',
    description:
      'Recognise a project already on this machine: ecosystem, package manager, and the exact install command — shown before it runs.',
    folderLabel: 'Project folder',
    folderHint:
      'Only the files that name the tooling are read: package.json, pyproject.toml, Cargo.toml…',
    hostedNote: 'The explorer would open on the server, not on your machine: type the folder path.',
    pick: 'Choose a folder',
    picking: 'Explorer open…',
    noFolder: 'No folder chosen.',
    analyse: 'Analyse the folder',
    analysing: 'Analysing the folder…',
    reanalyse: 'Analyse again',
    noFolderTitle: 'No folder chosen',
    noFolderBody:
      'Open this machine’s explorer and point at the project folder: the analysis starts at once, and reads only the tooling files.',
    notRecognised: 'Folder not recognised',
    notRecognisedBody:
      'This folder carries no recognised manifest. Choose the project root — the one holding package.json, pyproject.toml or Cargo.toml.',
    detection: 'Detection',
    ecosystem: 'Ecosystem',
    manager: 'Package manager',
    notApplicable: 'not applicable',
    readFile: 'File read',
    installCommand: 'Install command',
    ignoreScripts: 'Install without running the project’s scripts',
    confirm: 'I read the command: run the install',
    install: 'Install dependencies',
    installing: 'Installing dependencies…',
    installNoMeasure:
      'The package manager publishes no progress: the bar says it is working, not how much is left.',
    trustNote:
      'The install runs the project’s scripts with your rights on this machine. The box above disables them.',
    installDone: (command: string) => `Dependencies installed: ${command}.`,
    installTitle: 'Install',
    installFailed: 'The install failed',
    manualOnly: (command: string) =>
      `Automatic install for this kind of project lands in V1. Run it yourself: ${command}`,
    blockerBusy: 'An operation is running.',
    blockerNoInspection: 'Analyse the folder first.',
    blockerUnknown: 'This folder is not a recognised project: nothing to install.',
    blockerManual: 'Automatic install for this kind of project lands in V1.',
    blockerUnconfirmed: 'Tick the confirmation: nothing runs without your go-ahead.',
  },
  clone: {
    title: 'Clone a project',
    description:
      'Clone one of your GitHub repositories or any Git link. The destination folder must be absent or empty: a clone overwrites nothing.',
    sourceLabel: 'Repository source',
    tabMine: 'My repositories',
    tabLink: 'From a link',
    searchLabel: 'Search a repository',
    searchPlaceholder: 'name or description',
    loadingRepositories: 'Reading your repositories…',
    noMatch: (query: string) => `No repository matches “${query}”.`,
    pickRepository: 'Choose this repository',
    private: 'private',
    public: 'public',
    notConnected:
      'Sign in to GitHub to find your repositories. A public repository also clones from its link, without signing in.',
    connect: 'Connect a GitHub account',
    linkLabel: 'Repository link',
    linkPlaceholder: 'https://github.com/owner/repository, git@…, owner/repository',
    folderNamePlaceholder: 'my-project',
    destinationLabel: 'Destination folder',
    destinationHint:
      'The folder must be absent or empty. Choose where the repository lands: the clone creates a subfolder named after it.',
    parentLabel: 'Parent folder',
    pickParent: 'Choose where to clone',
    afterClone: 'After the clone',
    installAfter: 'Install dependencies',
    ignoreScripts: 'Install without running the project’s scripts (recommended)',
    untrusted:
      'A cloned repository is not trusted code: its install scripts run on this machine. The exact command is shown before it runs.',
    check: 'Check the link and the folder',
    checking: 'Checking…',
    clone: 'Clone',
    cloning: 'Cloning…',
    destination: 'Destination',
    repository: 'Repository',
    folder: 'Folder',
    folderFree: 'absent — the clone will create it.',
    folderEmpty: 'present and empty.',
    folderTaken: 'present and not empty: refused.',
    folderUnknown: 'unknown.',
    result: 'Result',
    cloned: (directory: string) => `Repository cloned into ${directory}.`,
    installed: 'Dependencies installed.',
    detected: (description: string) => `Project detected: ${description}.`,
    blockerBusy: 'An operation is running.',
    blockerNoPreview: 'Check the link and the destination folder first.',
    blockerNoParent: 'Choose where to clone first.',
    folderNameLabel: 'Subfolder name',
    folderNameHint:
      'A single name, with no path separator. The clone creates this folder inside the chosen parent folder.',
    fullPath: 'Full path that will be written',
    fullPathUnknown: 'Choose the parent folder to see the full path.',
    hostedFallback: (root: string) =>
      `Hosted server: the clone runs on the server, not on your machine. The folder stays relative to the working root: ${root}. It must be absent or empty.`,
    pickOtherFolder: 'Choose another folder',
    destinationUnavailable: 'Folder not reachable',
    destinationUnavailableBody:
      'This folder does not exist, or this account may not write to it. Choose another one: the clone will create the repository subfolder inside it.',
    reachedPhase: 'Last phase reached',
    gitDetail: 'Raw git output',
    cancelledTitle: 'Tracking stopped',
    cancelledBody:
      'Progress is no longer tracked: the clone may keep running on the server, and the destination folder may stay incomplete. Check it before using it.',
    streamFailedTitle: 'Clone tracking stopped',
    checkFailedTitle: 'The check did not complete',
    checkFailedBody:
      'The server did not answer: the link and the folder were not checked. Nothing was cloned — try again.',
    streamTimeout: (seconds: number) =>
      `No event received for ${seconds} seconds: tracking is stopped. Check the destination folder on disk before trying again.`,
    streamNetwork:
      'The connection to the server was lost: tracking is stopped. The clone may keep running on the server, and the folder may stay incomplete.',
    streamHttp: (status: number) =>
      `The server refused the request (HTTP ${status}): nothing was cloned.`,
    streamMalformed:
      'Unreadable progress response: tracking is stopped. Check the destination folder on disk.',
    streamIncomplete:
      'The server closed the stream before the end: tracking is stopped. The destination folder may be incomplete.',
    resultFailed: 'The clone was not performed',
    installCommand: (command: string) => `Install command: ${command}.`,
    phaseCounting: 'Counting objects',
    phaseCompressing: 'Compressing',
    phaseReceiving: 'Receiving objects',
    phaseResolving: 'Resolving deltas',
    phaseCheckout: 'Checking out files',
    phaseStarting: 'Connecting to the repository',
    phaseInstalling: 'Installing dependencies',
    phaseDone: 'Done',
  },
};
