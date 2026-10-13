import type { Widen } from './widen';

/**
 * La sortie d'un projet : archive ZIP, dossier choisi, installation des dépendances, rapport.
 *
 * Voir `messages.ts` pour la composition. Le français fait foi : une clé
 * ajoutée d'un côté sans l'autre fait échouer `pnpm typecheck`.
 */

export const FR_OUTPUT = {
  output: {
    /** L'en-tête de l'écran 11, qui n'annonce plus un dossier imposé. */
    generateDescription:
      'Récupérez le projet en archive ZIP, ou écrivez-le dans un dossier de cette machine et installez ses dépendances.',
    start: 'Générer le projet',
    startHint: 'Rien n’est écrit avant votre choix.',
    choicesLabel: 'Comment récupérer le projet',
    zipTitle: 'Générer le ZIP',
    zipNote: 'Une archive à télécharger, à décompresser où vous voulez.',
    folderTitle: 'Choisir un dossier et installer',
    folderNote:
      'Le projet est écrit dans un dossier de cette machine, puis ses dépendances sont installées si vous le souhaitez.',
    folderOpening: 'Fenêtre de l’explorateur ouverte sur le bureau de cette machine…',
    folderHostedTitle: 'Ce navigateur ne sait pas écrire dans un dossier',
    folderHostedBody:
      'Ouvrez BuildIt dans Chrome ou Edge pour choisir un dossier, téléchargez le ZIP, ou lancez BuildIt en local avec la commande ci-dessous.',
    browserNote:
      'Le navigateur écrit les fichiers dans le dossier choisi. L’installation des dépendances ne peut pas se lancer depuis une page web : les commandes s’affichent à la fin, prêtes à copier.',
    browserWriting: (written: number, total: number) =>
      `Écriture des fichiers dans le dossier choisi : ${written} sur ${total}…`,
    browserPreparing: 'Génération des fichiers par le moteur…',
    browserDone: (count: number) =>
      `Génération terminée : ${count} fichier${count > 1 ? 's' : ''} écrit${count > 1 ? 's' : ''}.`,
    browserTaken:
      'Ce dossier contient déjà un dossier du même nom, non vide. Rien n’a été écrasé : choisissez un autre emplacement.',
    browserFailed: 'L’écriture s’est arrêtée. Les fichiers déjà écrits sont restés en place.',
    browserDenied: 'Le navigateur n’a pas obtenu le droit d’écrire dans ce dossier.',
    installTitle: 'Installer les dépendances dans votre terminal',
    installHint:
      'Une page web ne peut pas lancer de programme sur votre machine : copiez ces commandes dans un terminal ouvert sur le dossier choisi.',
    installWhat: 'la commande',
    folderHostedWhat: 'la commande pour lancer BuildIt en local',
    pickCancelled: 'Aucun dossier choisi.',
    pickFailed:
      'L’explorateur n’a pas pu s’ouvrir sur cette machine. Téléchargez le ZIP, ou réessayez.',
    destinationLabel: 'Le projet sera écrit dans',
    destinationWhat: 'le dossier de destination',
    destinationChecking: 'Vérification du dossier choisi…',
    destinationRefused: 'Ce dossier ne convient pas',
    destinationHint:
      'Un dossier du même nom qui contient déjà des fichiers fait refuser la génération : rien n’est jamais écrasé.',
    installNote:
      'L’installation lance le gestionnaire de paquets du projet dans ce dossier. Elle peut prendre quelques minutes.',
    generateAndInstall: 'Générer et installer les dépendances',
    generateOnly: 'Générer sans installer',
    changeFolder: 'Changer de dossier',
    otherOutput: 'Choisir une autre sortie',
    progressLabel: 'Avancement de la génération',
    zipping: 'Génération de l’archive…',
    zipReady: 'Génération terminée : archive prête, téléchargement lancé.',
    zipFailed: 'L’archive n’a pas pu être générée. Rien n’a été écrit.',
    downloadAgain: 'Télécharger à nouveau',
    writing: 'Écriture des fichiers…',
    written: (count: number, size: string) =>
      `Fichiers écrits : ${count} fichier${count > 1 ? 's' : ''}, ${size}.`,
    installing: (command: string) => `Installation des dépendances : ${command}…`,
    installingUnknown: 'Installation des dépendances…',
    done: 'Génération terminée.',
    doneInstalled: 'Génération terminée, dépendances installées.',
    refused: 'La génération a été refusée. Rien n’a été écrit.',
    installFailed: 'Le projet est écrit, mais l’installation des dépendances a échoué.',
    installFailedHint:
      'Les fichiers sont en place. Réessayez l’installation, ou lancez la commande vous-même dans le dossier du projet.',
    retryInstall: 'Réessayer l’installation',
    retryingInstall: 'Nouvelle tentative d’installation…',
    manualCommandWhat: 'la commande d’installation',
    lost: 'Le suivi de la génération s’est interrompu avant la fin.',
    lostTimeout: (seconds: number) =>
      `Le serveur n’a rien dit pendant ${Math.round(seconds / 60)} minutes : le suivi de la génération s’est arrêté.`,
    lostHint:
      'Le projet a peut-être été écrit malgré tout. Vérifiez le dossier choisi avant de relancer : un dossier déjà rempli sera refusé.',
    fatal: 'La génération n’a pas pu être lancée. Rien n’a été écrit.',
    retry: 'Réessayer',
    writtenIn: 'Projet écrit dans',
    writtenWhat: 'le dossier du projet',
    report: {
      architecture: 'Architecture du projet',
      openGithub: 'Ouvrir sur GitHub',
      openGithubLabel: 'Ouvrir le dépôt sur GitHub, dans un nouvel onglet',
      installedNote: 'Les dépendances ont été installées pendant la génération.',
    },
  },
} as const;

export const EN_OUTPUT: Widen<typeof FR_OUTPUT> = {
  output: {
    generateDescription:
      'Get the project as a ZIP archive, or write it into a folder on this machine and install its dependencies.',
    start: 'Generate the project',
    startHint: 'Nothing is written before you choose.',
    choicesLabel: 'How to get the project',
    zipTitle: 'Generate the ZIP',
    zipNote: 'An archive to download and unpack wherever you like.',
    folderTitle: 'Choose a folder and install',
    folderNote:
      'The project is written into a folder on this machine, then its dependencies are installed if you wish.',
    folderOpening: 'Explorer window open on this machine’s desktop…',
    folderHostedTitle: 'This browser cannot write to a folder',
    folderHostedBody:
      'Open BuildIt in Chrome or Edge to pick a folder, download the ZIP, or run BuildIt locally with the command below.',
    browserNote:
      'The browser writes the files into the chosen folder. Installing dependencies cannot start from a web page: the commands are shown at the end, ready to copy.',
    browserWriting: (written: number, total: number) =>
      `Writing files into the chosen folder: ${written} of ${total}…`,
    browserPreparing: 'The engine is generating the files…',
    browserDone: (count: number) =>
      `Generation complete: ${count} file${count > 1 ? 's' : ''} written.`,
    browserTaken:
      'This folder already holds a non-empty folder with the same name. Nothing was overwritten: pick another location.',
    browserFailed: 'Writing stopped. Files already written were left in place.',
    browserDenied: 'The browser did not get permission to write into this folder.',
    installTitle: 'Install dependencies in your terminal',
    installHint:
      'A web page cannot run programs on your machine: copy these commands into a terminal opened on the chosen folder.',
    installWhat: 'the command',
    folderHostedWhat: 'the command to run BuildIt locally',
    pickCancelled: 'No folder chosen.',
    pickFailed: 'The explorer could not open on this machine. Download the ZIP, or try again.',
    destinationLabel: 'The project will be written to',
    destinationWhat: 'the destination folder',
    destinationChecking: 'Checking the chosen folder…',
    destinationRefused: 'This folder cannot be used',
    destinationHint:
      'A folder with the same name that already contains files makes generation refuse: nothing is ever overwritten.',
    installNote:
      'Installing runs the project’s package manager in this folder. It may take a few minutes.',
    generateAndInstall: 'Generate and install dependencies',
    generateOnly: 'Generate without installing',
    changeFolder: 'Change folder',
    otherOutput: 'Choose another output',
    progressLabel: 'Generation progress',
    zipping: 'Generating the archive…',
    zipReady: 'Generation complete: archive ready, download started.',
    zipFailed: 'The archive could not be generated. Nothing was written.',
    downloadAgain: 'Download again',
    writing: 'Writing files…',
    written: (count: number, size: string) =>
      `Files written: ${count} file${count === 1 ? '' : 's'}, ${size}.`,
    installing: (command: string) => `Installing dependencies: ${command}…`,
    installingUnknown: 'Installing dependencies…',
    done: 'Generation complete.',
    doneInstalled: 'Generation complete, dependencies installed.',
    refused: 'Generation was refused. Nothing was written.',
    installFailed: 'The project is written, but installing the dependencies failed.',
    installFailedHint:
      'The files are in place. Retry the installation, or run the command yourself in the project folder.',
    retryInstall: 'Retry the installation',
    retryingInstall: 'Retrying the installation…',
    manualCommandWhat: 'the install command',
    lost: 'Tracking of the generation stopped before the end.',
    lostTimeout: (seconds: number) =>
      `The server said nothing for ${Math.round(seconds / 60)} minutes: tracking of the generation stopped.`,
    lostHint:
      'The project may have been written anyway. Check the chosen folder before trying again: a folder that already has files will be refused.',
    fatal: 'Generation could not be started. Nothing was written.',
    retry: 'Try again',
    writtenIn: 'Project written to',
    writtenWhat: 'the project folder',
    report: {
      architecture: 'Project architecture',
      openGithub: 'Open on GitHub',
      openGithubLabel: 'Open the repository on GitHub, in a new tab',
      installedNote: 'Dependencies were installed during generation.',
    },
  },
};
