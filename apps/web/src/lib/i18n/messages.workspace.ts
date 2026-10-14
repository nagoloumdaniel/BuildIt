import type { Widen } from './widen';

/**
 * Les textes des écrans qui touchent au disque : ouvrir un projet local,
 * cloner un dépôt. Voir `messages.ts` pour la composition.
 */

export const FR_WORKSPACE = {
  open: {
    title: 'Ouvrir un projet local',
    description:
      'Reconnaissez un projet déjà sur cette machine : écosystème, gestionnaire de paquets, et la commande d’installation exacte, affichée avant d’être lancée.',
    folderLabel: 'Dossier du projet',
    folderHint:
      'Seuls les fichiers qui nomment l’outillage sont lus : package.json, pyproject.toml, Cargo.toml…',
    /* En hébergé, l'explorateur est celui du **navigateur** : il ouvre bien
       l'explorateur de Windows, mais ne rend aucun chemin assez pour
       reconnaître le projet, pas pour l'installer. La phrase le dit au moment
       où c'est utile, au lieu de proposer un champ de saisie de chemin. */
    browserNote:
      'Le dossier est lu dans votre navigateur : BuildIt reconnaît le projet, mais n’installe rien sur votre machine depuis cette page. La commande est affichée, à lancer dans votre terminal.',
    noPickerNote:
      'Ce navigateur ne sait pas ouvrir de dossier (navigateur mobile ?). Utilisez un navigateur de bureau Chrome, Edge, Firefox ou Safari ou lancez BuildIt en local avec « pf web ».',
    /* Firefox, Safari : le dossier se choisit par le sélecteur du navigateur,
       en lecture seule. Le navigateur peut demander de confirmer « l'envoi » :
       rien ne quitte la machine hormis les noms et package.json. */
    inputNote:
      'Le dossier est lu dans votre navigateur, en lecture seule : le navigateur peut vous demander de confirmer, mais seuls les noms de fichiers et package.json sont analysés. Les fichiers de base manquants se téléchargent en archive.',
    fallbackNote:
      'Ce navigateur a refusé l’accès direct au dossier. Appuyez de nouveau : le choix passera par le sélecteur de dossier du navigateur.',
    inspectFailed:
      'L’analyse n’a pas pu joindre BuildIt (réseau ou mise à jour du site). Réessayez avec « Analyser à nouveau ».',
    baseTitle: 'Dossiers et fichiers de base',
    baseShape: (architecture: string, fromManifest: boolean) =>
      `Architecture ${fromManifest ? 'déclarée dans pf.manifest.json' : 'déduite des fichiers'} : ${architecture}.`,
    baseNone: 'Tous les dossiers et fichiers de base sont déjà là.',
    baseMissing: (count: number) =>
      `${count} fichier${count > 1 ? 's' : ''} de base manque${count > 1 ? 'nt' : ''} (README par dossier, vue d’architecture, ADR, CONTRIBUTING, SECURITY). Aucun fichier existant n’est modifié.`,
    baseWrite: 'Créer les fichiers manquants',
    baseDownload: 'Télécharger les fichiers manquants (.zip)',
    baseZipNote:
      'Décompressez l’archive à la racine du projet : elle ne contient que ce qui manque.',
    baseWriting: 'Écriture des fichiers de base…',
    baseWritten: (count: number) =>
      `${count} fichier${count > 1 ? 's' : ''} de base créé${count > 1 ? 's' : ''}.`,
    baseZipped: (count: number) =>
      `Archive de ${count} fichier${count > 1 ? 's' : ''} téléchargée.`,
    baseFailed: 'Les fichiers de base n’ont pas pu être écrits',
    baseDenied: 'Le navigateur n’a pas accordé l’écriture dans ce dossier.',
    /* iPhone, iPad, Android : pas de dossier. Une archive du projet, ou
       quelques fichiers de sa racine. */
    mobileNote:
      'Sur iPhone, iPad et Android, le navigateur ne sait pas ouvrir un dossier. Choisissez plutôt l’archive .zip du projet (dans Fichiers : appui long sur le dossier, puis « Compresser »), ou quelques fichiers de sa racine (package.json…). Tout est lu sur l’appareil ; les fichiers de base manquants se téléchargent en .zip.',
    pickZip: 'Choisir l’archive .zip du projet',
    pickZipNote: 'Lue entièrement sur l’appareil : la liste des fichiers et package.json.',
    pickFiles: 'Choisir des fichiers du projet',
    pickFilesNote:
      'package.json, pf.manifest.json… de la racine du projet. Sans les dossiers, l’analyse est plus sommaire.',
    zipUnreadable:
      'Cette archive n’a pas pu être lue (pas un .zip, chiffrée ou trop ancienne). Recompressez le dossier et réessayez.',
    pick: 'Choisir un dossier',
    picking: 'Explorateur ouvert…',
    analysing: 'Analyse du dossier…',
    runYourself: 'À lancer dans votre terminal',
    /* Choisir, c'est demander : l'analyse part au choix du dossier. Ce bouton
       n'est donc pas « l'étape suivante » mais la reprise d'une analyse déjà
       faite le dossier a pu changer sur le disque entre-temps. */
    reanalyse: 'Analyser à nouveau',
    reanalyseFolder: 'Choisir un autre dossier',
    pathWhat: 'le chemin du dossier',
    noFolderTitle: 'Aucun dossier choisi',
    noFolderBody:
      'Ouvrez l’explorateur de cette machine et désignez le dossier du projet : l’analyse démarre aussitôt, et ne lit que les fichiers d’outillage.',
    notRecognised: 'Dossier non reconnu',
    notRecognisedBody:
      'Ce dossier ne porte aucun manifeste reconnu. Choisissez la racine du projet, celle qui contient package.json, pyproject.toml ou Cargo.toml.',
    detection: 'Détection',
    ecosystem: 'Écosystème',
    manager: 'Gestionnaire',
    notApplicable: 'non applicable',
    readFile: 'Fichier lu',
    folderWhat: 'le nom du dossier',
    installCommand: 'Commande d’installation',
    commandWhat: 'la commande',
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
    installFailed: 'L’installation a échoué',
    manualOnly: (command: string) =>
      `L’installation automatique de ce type de projet arrive en V1. Lancez vous-même : ${command}`,
    blockerBusy: 'Une opération est en cours.',
    blockerNoInspection: 'Analysez d’abord le dossier.',
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
    folderFree: 'absent : le clone le créera.',
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
    pathWhat: 'le chemin',
    fullPathUnknown: 'Choisissez le dossier parent pour voir le chemin complet.',
    /* La copie hébergée (trybuildit.vercel.app). Le serveur n'est pas la
       machine de l'utilisateur et n'a pas git : on copie les fichiers depuis
       l'archive GitHub, et on dit **avant** ce que ce n'est pas. */
    hostedTitle: 'Copie depuis la version en ligne',
    hostedIntro:
      'Cette page tourne sur un serveur, pas sur votre ordinateur : elle ne peut pas lancer git chez vous. Elle télécharge les fichiers du dépôt depuis GitHub, et votre navigateur les écrit dans le dossier que vous choisissez.',
    hostedNoHistory:
      'Vous obtenez une copie des fichiers de la branche par défaut, sans historique git (pas de dossier .git). La commande pour un vrai clone est donnée à la fin.',
    hostedNoInstall:
      'Les dépendances ne sont pas installées : une page web ne peut lancer aucun programme sur votre machine. La commande à lancer est donnée à la fin.',
    hostedLimits: (files: number, megabytes: number) =>
      `Au plus ${files} fichiers et ${megabytes} Mo décompressés. Au-delà, utilisez git clone.`,
    hostedFolderLabel: 'Nom du dossier à créer',
    hostedFolderHint:
      'Un seul nom, sans séparateur de chemin. Il sera créé dans le dossier que vous choisirez dans l’explorateur.',
    hostedCheck: 'Vérifier le lien',
    hostedCopy: 'Choisir un dossier et copier',
    hostedDownload: 'Télécharger le ZIP',
    hostedNoFolderApi:
      'Ce navigateur ne sait pas écrire dans un dossier (c’est le cas de Firefox et de Safari). Téléchargez l’archive ZIP du dépôt, ou ouvrez cette page dans Chrome ou Edge pour écrire directement dans un dossier.',
    hostedBlockerCheck: 'Vérifiez d’abord le lien.',
    hostedReady: (label: string) => `Dépôt GitHub reconnu : ${label}.`,
    hostedNotGithubTitle: 'Ce lien ne se clone que sur votre machine',
    hostedNotGithubBody:
      'Hors de GitHub, il n’existe pas d’archive téléchargeable sans git. Ouvrez un terminal dans le dossier où le dépôt doit atterrir, puis lancez ces commandes :',
    hostedDownloading: 'Téléchargement de l’archive depuis GitHub',
    hostedWriting: 'Écriture des fichiers dans le dossier',
    hostedCopying: 'Copie en cours…',
    hostedZipping: 'Téléchargement de l’archive…',
    hostedReceived: (size: string) => `${size} reçus`,
    hostedWritten: (written: number, total: number) => `${written} / ${total} fichiers`,
    sizeKilobytes: (value: number) =>
      `${value.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} Ko`,
    sizeMegabytes: (value: number) =>
      `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`,
    hostedCopied: (directory: string) => `Fichiers copiés dans ${directory}.`,
    hostedCopiedCount: (written: number, size: string) =>
      `${written} fichiers, ${size}. Copie sans historique git.`,
    hostedSkipped: (count: number) =>
      `${count} fichier(s) écarté(s) : leur nom n’est pas accepté par Windows.`,
    hostedSymlinks: (count: number) =>
      `${count} lien(s) symbolique(s) non copié(s) : un navigateur ne sait pas en créer.`,
    hostedZipSaved: (fileName: string, size: string) =>
      `Archive ${fileName} téléchargée (${size}).`,
    hostedZipNext:
      'Décompressez-la : elle contient un dossier nommé propriétaire-dépôt-commit. Copie sans historique git.',
    hostedNextTitle: 'Installer les dépendances',
    hostedInstallStep: (folder: string) =>
      `Ouvrez un terminal dans le dossier ${folder} (dans l’explorateur de Windows : clic droit sur le dossier, puis « Ouvrir dans le Terminal »), et lancez :`,
    hostedNothingToInstall:
      'Aucun gestionnaire de dépendances reconnu dans le dépôt : rien à installer d’après ses fichiers.',
    hostedRealCloneTitle: 'Pour un vrai clone, avec l’historique',
    hostedCloneStep: 'Ouvrez un terminal dans le dossier où le dépôt doit atterrir, puis clonez :',
    hostedCdStep: 'Entrez dans le dossier du dépôt :',
    hostedInstallAfterClone: 'Installez les dépendances :',
    hostedCommandsWhat: 'la commande',
    hostedCancelledTitle: 'Copie arrêtée',
    hostedFailedTitle: 'La copie n’a pas abouti',
    hostedPartial: (written: number, directory: string) =>
      `${written} fichier(s) déjà écrit(s) restent dans ${directory} : supprimez ce dossier avant de recommencer.`,
    hostedNothingWritten: 'Aucun fichier n’a été écrit.',
    hostedErrorLink: 'Le lien n’est pas reconnu.',
    hostedErrorFolder: 'Le nom du dossier n’est pas valide.',
    hostedErrorNotGithub:
      'Ce lien n’est pas sur GitHub : il ne se copie que sur votre machine, avec git.',
    hostedErrorNotFound:
      'Dépôt introuvable sur GitHub. Vérifiez le lien ; s’il est privé, connectez votre compte GitHub.',
    hostedErrorUnauthorized: 'GitHub a refusé l’accès : reconnectez votre compte GitHub.',
    hostedErrorRateLimited:
      'GitHub limite les téléchargements pour le moment. Réessayez dans quelques minutes, ou connectez votre compte GitHub.',
    hostedErrorArchiveTooLarge: (megabytes: number) =>
      `L’archive du dépôt dépasse ${megabytes} Mo : utilisez git clone.`,
    hostedErrorTooManyFiles: (files: number) =>
      `Le dépôt compte plus de ${files} fichiers : utilisez git clone.`,
    hostedErrorTooLarge: (megabytes: number) =>
      `Le dépôt décompressé dépasse ${megabytes} Mo : utilisez git clone.`,
    hostedErrorFileTooLarge: (megabytes: number, name: string) =>
      `Le fichier ${name} dépasse ${megabytes} Mo : utilisez git clone.`,
    hostedErrorUnsafePath: (name: string) =>
      `L’archive contient un chemin qui sortirait du dossier (${name}) : elle est refusée en entier.`,
    hostedErrorUnsupported: 'L’archive reçue n’est pas dans un format lisible ici.',
    hostedErrorCorrupt: (name: string) => `L’archive reçue est abîmée (${name}).`,
    hostedErrorHttp: (status: number) => `Le serveur a répondu HTTP ${status}.`,
    hostedErrorNetwork: 'La liaison avec le serveur a été perdue.',
    hostedErrorTaken: (directory: string) =>
      `Le dossier ${directory} existe déjà et n’est pas vide : rien n’a été écrasé. Choisissez un autre nom ou un autre emplacement.`,
    hostedErrorWrite: (detail: string) => `Le navigateur n’a pas pu écrire : ${detail}`,
    hostedErrorMalformed: 'Réponse du serveur illisible : la copie est arrêtée.',
    hostedErrorIncomplete: 'Le serveur a fermé le flux avant la fin.',
    hostedErrorTimeout: (seconds: number) =>
      `Rien reçu depuis ${seconds} secondes : la copie est arrêtée.`,
    hostedErrorPicker: 'L’explorateur n’a pas pu s’ouvrir. Réessayez.',
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
      'Le serveur n’a pas répondu : le lien et le dossier n’ont pas été vérifiés. Rien n’a été cloné. Réessayez.',
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
      'Recognise a project already on this machine: ecosystem, package manager, and the exact install command, shown before it runs.',
    folderLabel: 'Project folder',
    folderHint:
      'Only the files that name the tooling are read: package.json, pyproject.toml, Cargo.toml…',
    browserNote:
      'The folder is read inside your browser: BuildIt recognises the project, but installs nothing on your machine from this page. The command is shown, to run in your own terminal.',
    noPickerNote:
      'This browser cannot open a folder (mobile browser?). Use a desktop browser Chrome, Edge, Firefox or Safari or run BuildIt locally with “pf web”.',
    inputNote:
      'The folder is read inside your browser, read-only: the browser may ask you to confirm, but only file names and package.json are analysed. Missing base files download as an archive.',
    fallbackNote:
      'This browser refused direct folder access. Press again: the choice will go through the browser’s folder selector.',
    inspectFailed:
      'The analysis could not reach BuildIt (network or site update). Try again with “Analyse again”.',
    baseTitle: 'Base folders and files',
    baseShape: (architecture: string, fromManifest: boolean) =>
      `Architecture ${fromManifest ? 'declared in pf.manifest.json' : 'inferred from the files'}: ${architecture}.`,
    baseNone: 'All base folders and files are already there.',
    baseMissing: (count: number) =>
      `${count} base file${count > 1 ? 's are' : ' is'} missing (README per folder, architecture view, ADR, CONTRIBUTING, SECURITY). No existing file is changed.`,
    baseWrite: 'Create the missing files',
    baseDownload: 'Download the missing files (.zip)',
    baseZipNote: 'Unzip the archive at the project root: it only holds what is missing.',
    baseWriting: 'Writing the base files…',
    baseWritten: (count: number) => `${count} base file${count > 1 ? 's' : ''} created.`,
    baseZipped: (count: number) => `Archive of ${count} file${count > 1 ? 's' : ''} downloaded.`,
    baseFailed: 'The base files could not be written',
    baseDenied: 'The browser did not grant write access to this folder.',
    mobileNote:
      'On iPhone, iPad and Android, the browser cannot open a folder. Choose the project’s .zip archive instead (in Files: long-press the folder, then “Compress”), or a few files from its root (package.json…). Everything is read on the device; missing base files download as a .zip.',
    pickZip: 'Choose the project’s .zip archive',
    pickZipNote: 'Read entirely on the device: the file list and package.json.',
    pickFiles: 'Choose project files',
    pickFilesNote:
      'package.json, pf.manifest.json… from the project root. Without folders, the analysis is shallower.',
    zipUnreadable:
      'This archive could not be read (not a .zip, encrypted or too old). Compress the folder again and retry.',
    pick: 'Choose a folder',
    picking: 'Explorer open…',
    analysing: 'Analysing the folder…',
    runYourself: 'To run in your own terminal',
    reanalyse: 'Analyse again',
    reanalyseFolder: 'Choose another folder',
    pathWhat: 'the folder path',
    noFolderTitle: 'No folder chosen',
    noFolderBody:
      'Open this machine’s explorer and point at the project folder: the analysis starts at once, and reads only the tooling files.',
    notRecognised: 'Folder not recognised',
    notRecognisedBody:
      'This folder carries no recognised manifest. Choose the project root, the one holding package.json, pyproject.toml or Cargo.toml.',
    detection: 'Detection',
    ecosystem: 'Ecosystem',
    manager: 'Package manager',
    notApplicable: 'not applicable',
    readFile: 'File read',
    folderWhat: 'the folder name',
    installCommand: 'Install command',
    commandWhat: 'the command',
    ignoreScripts: 'Install without running the project’s scripts',
    confirm: 'I read the command: run the install',
    install: 'Install dependencies',
    installing: 'Installing dependencies…',
    installNoMeasure:
      'The package manager publishes no progress: the bar says it is working, not how much is left.',
    trustNote:
      'The install runs the project’s scripts with your rights on this machine. The box above disables them.',
    installDone: (command: string) => `Dependencies installed: ${command}.`,
    installFailed: 'The install failed',
    manualOnly: (command: string) =>
      `Automatic install for this kind of project lands in V1. Run it yourself: ${command}`,
    blockerBusy: 'An operation is running.',
    blockerNoInspection: 'Analyse the folder first.',
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
    folderFree: 'absent: the clone will create it.',
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
    pathWhat: 'the path',
    fullPathUnknown: 'Choose the parent folder to see the full path.',
    hostedTitle: 'Copy from the online version',
    hostedIntro:
      'This page runs on a server, not on your computer: it cannot run git on your machine. It downloads the repository files from GitHub, and your browser writes them into the folder you choose.',
    hostedNoHistory:
      'You get a copy of the default branch files, without git history (no .git folder). The command for a real clone is given at the end.',
    hostedNoInstall:
      'Dependencies are not installed: a web page cannot run any program on your machine. The command to run is given at the end.',
    hostedLimits: (files: number, megabytes: number) =>
      `At most ${files} files and ${megabytes} MB uncompressed. Beyond that, use git clone.`,
    hostedFolderLabel: 'Name of the folder to create',
    hostedFolderHint:
      'A single name, with no path separator. It is created inside the folder you choose in the file explorer.',
    hostedCheck: 'Check the link',
    hostedCopy: 'Choose a folder and copy',
    hostedDownload: 'Download the ZIP',
    hostedNoFolderApi:
      'This browser cannot write into a folder (Firefox and Safari cannot). Download the repository ZIP archive, or open this page in Chrome or Edge to write straight into a folder.',
    hostedBlockerCheck: 'Check the link first.',
    hostedReady: (label: string) => `GitHub repository recognised: ${label}.`,
    hostedNotGithubTitle: 'This link only clones on your machine',
    hostedNotGithubBody:
      'Outside GitHub, there is no archive to download without git. Open a terminal in the folder where the repository should land, then run these commands:',
    hostedDownloading: 'Downloading the archive from GitHub',
    hostedWriting: 'Writing the files into the folder',
    hostedCopying: 'Copying…',
    hostedZipping: 'Downloading the archive…',
    hostedReceived: (size: string) => `${size} received`,
    hostedWritten: (written: number, total: number) => `${written} / ${total} files`,
    sizeKilobytes: (value: number) =>
      `${value.toLocaleString('en-GB', { maximumFractionDigits: 0 })} KB`,
    sizeMegabytes: (value: number) =>
      `${value.toLocaleString('en-GB', { maximumFractionDigits: 1 })} MB`,
    hostedCopied: (directory: string) => `Files copied into ${directory}.`,
    hostedCopiedCount: (written: number, size: string) =>
      `${written} files, ${size}. Copy without git history.`,
    hostedSkipped: (count: number) =>
      `${count} file(s) left out: Windows does not accept their name.`,
    hostedSymlinks: (count: number) =>
      `${count} symbolic link(s) not copied: a browser cannot create them.`,
    hostedZipSaved: (fileName: string, size: string) => `Archive ${fileName} downloaded (${size}).`,
    hostedZipNext:
      'Extract it: it holds a folder named owner-repository-commit. Copy without git history.',
    hostedNextTitle: 'Install the dependencies',
    hostedInstallStep: (folder: string) =>
      `Open a terminal in the ${folder} folder (in Windows File Explorer: right-click the folder, then “Open in Terminal”), and run:`,
    hostedNothingToInstall:
      'No dependency manager recognised in the repository: nothing to install according to its files.',
    hostedRealCloneTitle: 'For a real clone, with history',
    hostedCloneStep: 'Open a terminal in the folder where the repository should land, then clone:',
    hostedCdStep: 'Move into the repository folder:',
    hostedInstallAfterClone: 'Install the dependencies:',
    hostedCommandsWhat: 'the command',
    hostedCancelledTitle: 'Copy stopped',
    hostedFailedTitle: 'The copy did not complete',
    hostedPartial: (written: number, directory: string) =>
      `${written} file(s) already written stay in ${directory}: delete that folder before trying again.`,
    hostedNothingWritten: 'No file was written.',
    hostedErrorLink: 'The link is not recognised.',
    hostedErrorFolder: 'The folder name is not valid.',
    hostedErrorNotGithub: 'This link is not on GitHub: it only copies on your machine, with git.',
    hostedErrorNotFound:
      'Repository not found on GitHub. Check the link; if it is private, connect your GitHub account.',
    hostedErrorUnauthorized: 'GitHub refused access: reconnect your GitHub account.',
    hostedErrorRateLimited:
      'GitHub is limiting downloads right now. Try again in a few minutes, or connect your GitHub account.',
    hostedErrorArchiveTooLarge: (megabytes: number) =>
      `The repository archive is over ${megabytes} MB: use git clone.`,
    hostedErrorTooManyFiles: (files: number) =>
      `The repository has more than ${files} files: use git clone.`,
    hostedErrorTooLarge: (megabytes: number) =>
      `The uncompressed repository is over ${megabytes} MB: use git clone.`,
    hostedErrorFileTooLarge: (megabytes: number, name: string) =>
      `The file ${name} is over ${megabytes} MB: use git clone.`,
    hostedErrorUnsafePath: (name: string) =>
      `The archive holds a path that would leave the folder (${name}): it is refused as a whole.`,
    hostedErrorUnsupported: 'The archive received is not in a format readable here.',
    hostedErrorCorrupt: (name: string) => `The archive received is damaged (${name}).`,
    hostedErrorHttp: (status: number) => `The server answered HTTP ${status}.`,
    hostedErrorNetwork: 'The connection to the server was lost.',
    hostedErrorTaken: (directory: string) =>
      `The folder ${directory} already exists and is not empty: nothing was overwritten. Choose another name or another place.`,
    hostedErrorWrite: (detail: string) => `The browser could not write: ${detail}`,
    hostedErrorMalformed: 'Unreadable server response: the copy is stopped.',
    hostedErrorIncomplete: 'The server closed the stream before the end.',
    hostedErrorTimeout: (seconds: number) =>
      `Nothing received for ${seconds} seconds: the copy is stopped.`,
    hostedErrorPicker: 'The file explorer could not open. Try again.',
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
      'The server did not answer: the link and the folder were not checked. Nothing was cloned. Try again.',
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
