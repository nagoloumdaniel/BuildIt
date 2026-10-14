import type { Widen } from './widen';

/**
 * Les textes de l'accueil, de la liste des projets et du partage.
 *
 * Un fichier par zone de l'interface : plusieurs écrans se construisent en
 * parallèle, et un dictionnaire unique de mille lignes serait le seul endroit
 * où tout le monde se marcherait dessus. `messages.ts` les recompose.
 */

export const FR_DASHBOARD = {
  dashboard: {
    title: 'BuildIt',
    description:
      'Décrivez un projet, obtenez un projet prêt à développer. Trois façons de commencer.',
    pathsLabel: 'Par où commencer',
    createTitle: 'Créer un projet',
    createNote: 'Le parcours complet : nom, plateformes, stack, blueprint, génération.',
    cloneTitle: 'Cloner un projet',
    cloneNote: 'Vos dépôts GitHub, ou n’importe quel lien Git. Installation proposée après.',
    openTitle: 'Ouvrir un projet local',
    openNote: 'Reconnaître un projet déjà sur cette machine et proposer l’installation.',
    accountLabel: 'Compte et dépôt',
    githubTitle: 'Compte GitHub',
    githubNote: 'Se connecter, voir les permissions accordées, se déconnecter.',
    repoTitle: 'Dépôt & partage',
    repoNote: 'Créer le dépôt GitHub d’un projet, inviter des collaborateurs.',
    projectsTitle: 'Projets créés',
    projectsEmpty: 'Aucun projet généré pour l’instant. Le premier apparaîtra ici.',
    projectsAll: 'Voir tous les projets',
    projectDone:
      'Ce projet est généré : il ne se modifie plus depuis BuildIt. Connectez-le à GitHub, consultez sa documentation d’installation, ou téléchargez-le à nouveau.',
    projectReport: 'Voir le rapport & la doc d’installation',
    draftTitle: 'Brouillon en cours',
    draftStep: {
      create: 'nom du projet',
      target: 'plateformes cibles',
      type: 'type de projet',
      architecture: 'architecture',
      stack: 'stack technique',
      capabilities: 'capacités',
      env: 'environnement & secrets',
      infrastructure: 'infrastructure',
      blueprint: 'blueprint',
      preview: 'aperçu des fichiers',
      generate: 'génération',
      report: 'rapport',
    },
    draftEmpty:
      'Aucun brouillon en cours. Choisissez un chemin : tout est conservé au fur et à mesure.',
    draftEmptyAfterProject:
      'Rien à reprendre. Choisissez un chemin ci-dessus pour démarrer un autre projet.',
    draftLastScreen: (label: string) => `Dernier écran : ${label}.`,
    draftKept: 'Le brouillon se reprend tout seul si vous fermez l’onglet.',
    resume: 'Reprendre',
    reset: 'Repartir de zéro',
    deleteDraft: 'Supprimer le brouillon',
    unnamed: 'Projet sans nom',
  },
  projects: {
    title: 'Projets créés',
    description: 'Tous les projets générés depuis ce navigateur, du plus récent au plus ancien.',
    empty: 'Aucun projet généré pour l’instant.',
    emptyAction: 'Créer un premier projet',
    loading: 'Lecture des projets enregistrés…',
    done: 'Terminé',
    locked: 'Ce projet est généré : il ne se modifie plus depuis BuildIt.',
    generatedOn: (date: string) => `Généré le ${date}`,
    files: (count: number) => `${count} fichier${count > 1 ? 's' : ''}`,
    architecture: 'Architecture du projet',
    graph: 'Graphe de dépendances',
    /**
     * La page `/projects/graph?id=` : les deux états sans équivalent côté
     * graphe d'étape (un projet sans manifest, un manifest sans technologie).
     * Le reste de ses phrases vient de `messages.graph.ts` et des états communs
     * à toute page de projet (`architecture.project`) : pas de copie ici.
     */
    graphLegacyBody:
      'Ce projet a été généré avant que BuildIt ne conserve ses choix : sans eux, le moteur ne peut pas recalculer son graphe. Le dossier sur le disque, lui, est intact.',
    graphEmptyBody:
      'Le manifest de ce projet ne nomme aucune technologie : il n’y a pas de graphe à dessiner.',
    connectGithub: 'Connecter à GitHub',
    openGithub: 'Ouvrir sur GitHub',
    exportMore: 'Télécharger le ZIP ou installer',
    exportLess: 'Masquer l’export',
    legacy:
      'Généré avant la version 0.2.0 : BuildIt n’a pas gardé ses choix, l’export et l’architecture ne sont pas disponibles. Le dossier sur le disque est intact.',
    forget: 'Retirer de la liste',
    forgetAll: 'Vider la liste',
    pathWhat: 'le chemin du projet',
    copyGithubLink: 'Copier le lien GitHub',
    copyShareLink: 'Copier le lien de partage',
    githubWhat: 'le lien GitHub',
    shareWhat: 'le lien de partage',
    /**
     * Le libellé de la poubelle : des points de suspension, parce que le geste
     * **ouvre** une question (« supprimer quoi ? ») au lieu d'effacer. Le nom
     * accessible et l'infobulle disent la même chose que le bouton.
     */
    delete: 'Supprimer…',
    /**
     * La popup de suppression d'une carte : un seul titre, une seule
     * confirmation, et **les cibles à cocher**. Le projet n'est pas
     * nécessairement aux trois endroits : une archive ZIP n'a pas de dossier,
     * un projet jamais poussé n'a pas de dépôt. Les notes disent ce que chaque
     * cible détruit, parce qu'aucune des trois n'est réversible.
     */
    deleteChoicesTitle: (name: string) => `Supprimer « ${name} » ?`,
    deleteChoicesBody:
      'Choisissez ce qui doit disparaître. Les cases cochées le seront définitivement : il n’y a pas de corbeille.',
    deleteChoicesAction: 'Supprimer la sélection',
    deleteTargetSite: 'Retirer de la liste BuildIt',
    deleteTargetSiteNote: 'La ligne disparaît de « Projets créés ». Rien n’est effacé.',
    deleteTargetGithub: 'Supprimer le dépôt GitHub',
    deleteTargetGithubNote: 'Le dépôt et son historique seront supprimés sur github.com.',
    deleteTargetLocal: 'Supprimer le dossier local',
    deleteTargetLocalNote:
      'Le dossier et tout ce qu’il contient seront effacés de cette machine. Définitif.',
    deleteWorking: 'Suppression en cours…',
    deleting: 'Suppression des fichiers…',
    deleted: (name: string) => `Projet supprimé : ${name}.`,
    deletedSite: 'Retiré de la liste BuildIt.',
    deletedRepository: 'Dépôt GitHub supprimé.',
    deletedLocal: 'Dossier local supprimé.',
    /**
     * Le suivi d'une suppression de dépôt : il ne referme pas la popup sur un
     * silence. Le projet reste dans la liste, **détaché** de son adresse, et
     * deux issues sont proposées créer un nouveau dépôt, ou laisser tel quel.
     */
    repositoryDeletedTitle: 'Dépôt GitHub supprimé',
    repositoryDeletedBody:
      'Le projet est détaché de GitHub : son ancienne adresse a été retirée de la liste, rien d’autre n’a changé.',
    repositoryGoneTitle: 'Dépôt introuvable sur GitHub',
    repositoryGoneBody:
      'Le dépôt n’existe plus sur GitHub. Le projet est détaché : son ancienne adresse a été retirée de la liste, et l’application reste utilisable.',
    repositoryMissingBody:
      'Aucune adresse de dépôt n’est enregistrée pour ce projet. Vous pouvez en créer un nouveau, ou continuer sans GitHub.',
    repositoryConnect: 'Connecter un nouveau dépôt',
    repositoryArchiveOnly:
      'Ce projet a été téléchargé en archive : il n’y a pas de copie locale à pousser sur un nouveau dépôt. « Fermer » le laisse tel quel.',
    repositoryFailed: (name: string) =>
      `Le dépôt GitHub de ${name} n’a pas pu être supprimé : votre compte n’y a peut-être plus accès, ou GitHub n’a pas répondu. L’adresse est conservée pour que vous puissiez réessayer.`,
    deleteFailed: (message: string) => `La suppression n’a pas abouti : ${message}`,
    forgetHint: 'Retirer un projet d’ici ne supprime aucun fichier sur le disque.',
    openInExplorer: 'Ouvrir dans l’explorateur',
    openInExplorerLabel: (directory: string) =>
      `Ouvrir dans l’explorateur de fichiers : ${directory}`,
    openInExplorerFailed: 'L’explorateur de fichiers n’a pas pu s’ouvrir.',
    /** Les refus de l’ouverture, dits en une phrase à côté de la carte. */
    openInExplorerRefusals: {
      hosted: 'BuildIt n’est pas lancé sur cette machine : le dossier ne peut pas s’ouvrir d’ici.',
      empty: 'Aucun dossier n’a été indiqué.',
      notRegistered: 'Ce dossier n’a pas été écrit par BuildIt : il ne sera pas ouvert d’ici.',
      missing: 'Ce dossier n’existe plus à cet endroit.',
      failed: 'L’explorateur de fichiers n’a pas pu s’ouvrir. Ouvrez le dossier vous-même.',
    },
    /** Le vidage de la liste demande **quelles plateformes** vider. */
    clearConfirmTitle: 'Vider la liste ?',
    clearConfirmBody:
      'Choisissez ce qui doit disparaître. Par défaut, seule la liste BuildIt est vidée : les projets et leurs dépôts restent en place.',
    clearConfirmAction: 'Vider la sélection',
    clearTargetSite: 'Vider la liste BuildIt',
    clearTargetSiteNote: 'Les lignes disparaissent. Un projet régénéré y reviendra.',
    clearTargetGithub: 'Supprimer les dépôts GitHub',
    clearTargetGithubNote: 'Tous les dépôts listés seront supprimés sur github.com. Définitif.',
    clearTargetLocal: 'Supprimer les dossiers locaux',
    clearTargetLocalNote: 'Tous les dossiers listés seront effacés de cette machine. Définitif.',
    clearWorking: 'Suppression en cours…',
    clearDone: 'Liste vidée.',
    clearRemoved: (count: number) => `Projets retirés de la liste : ${count}.`,
    clearRepositories: (count: number) => `Dépôts GitHub supprimés : ${count}.`,
    clearGone: (count: number) => `Dépôts déjà absents sur GitHub : ${count}.`,
    clearLocal: (count: number) => `Dossiers locaux supprimés : ${count}.`,
    clearFailures: (count: number) => `Échecs : ${count}.`,
    sizeOf: (size: string) => `Poids : ${size}`,
    techLabel: 'Technologies',
    moreTech: (count: number) =>
      `${count} autre${count > 1 ? 's' : ''} technologie${count > 1 ? 's' : ''}`,
  },
} as const;

export const EN_DASHBOARD: Widen<typeof FR_DASHBOARD> = {
  dashboard: {
    title: 'BuildIt',
    description: 'Describe a project, get a project ready to build on. Three ways to start.',
    pathsLabel: 'Where to start',
    createTitle: 'Create a project',
    createNote: 'The full path: name, platforms, stack, blueprint, generation.',
    cloneTitle: 'Clone a project',
    cloneNote: 'Your GitHub repositories, or any Git link. Install offered afterwards.',
    openTitle: 'Open a local project',
    openNote: 'Recognise a project already on this machine and offer to install it.',
    accountLabel: 'Account and repository',
    githubTitle: 'GitHub account',
    githubNote: 'Sign in, review granted permissions, sign out.',
    repoTitle: 'Repository & sharing',
    repoNote: 'Create a project’s GitHub repository, invite collaborators.',
    projectsTitle: 'Projects created',
    projectsEmpty: 'No project generated yet. The first one will show up here.',
    projectsAll: 'See all projects',
    projectDone:
      'This project is generated: BuildIt no longer edits it. Connect it to GitHub, read its install documentation, or download it again.',
    projectReport: 'See the report & the install documentation',
    draftTitle: 'Draft in progress',
    draftStep: {
      create: 'project name',
      target: 'target platforms',
      type: 'project type',
      architecture: 'architecture',
      stack: 'technical stack',
      capabilities: 'capabilities',
      env: 'environment & secrets',
      infrastructure: 'infrastructure',
      blueprint: 'blueprint',
      preview: 'file preview',
      generate: 'generation',
      report: 'report',
    },
    draftEmpty: 'No draft in progress. Pick a path: everything is kept as you go.',
    draftEmptyAfterProject: 'Nothing to resume. Pick a path above to start another project.',
    draftLastScreen: (label: string) => `Last screen: ${label}.`,
    draftKept: 'The draft comes back on its own if you close the tab.',
    resume: 'Resume',
    reset: 'Start over',
    deleteDraft: 'Delete the draft',
    unnamed: 'Untitled project',
  },
  projects: {
    title: 'Projects created',
    description: 'Every project generated from this browser, newest first.',
    empty: 'No project generated yet.',
    emptyAction: 'Create a first project',
    loading: 'Reading saved projects…',
    done: 'Done',
    locked: 'This project is generated: BuildIt no longer edits it.',
    generatedOn: (date: string) => `Generated on ${date}`,
    files: (count: number) => `${count} file${count > 1 ? 's' : ''}`,
    architecture: 'Project architecture',
    graph: 'Dependency graph',
    graphLegacyBody:
      'This project was generated before BuildIt kept its choices: without them, the engine cannot recompute its graph. The folder on disk is untouched.',
    graphEmptyBody: 'This project’s manifest names no technology: there is no graph to draw.',
    connectGithub: 'Connect to GitHub',
    openGithub: 'Open on GitHub',
    exportMore: 'Download the ZIP or install',
    exportLess: 'Hide export',
    legacy:
      'Generated before version 0.2.0: BuildIt did not keep its choices, so export and architecture are unavailable. The folder on disk is intact.',
    forget: 'Remove from list',
    forgetAll: 'Clear the list',
    pathWhat: 'the project path',
    copyGithubLink: 'Copy the GitHub link',
    copyShareLink: 'Copy the share link',
    githubWhat: 'the GitHub link',
    shareWhat: 'the share link',
    delete: 'Delete…',
    deleteChoicesTitle: (name: string) => `Delete “${name}”?`,
    deleteChoicesBody:
      'Choose what should disappear. The ticked boxes will be gone for good: there is no recycle bin.',
    deleteChoicesAction: 'Delete the selection',
    deleteTargetSite: 'Remove from the BuildIt list',
    deleteTargetSiteNote: 'The row leaves “Projects created”. Nothing is erased.',
    deleteTargetGithub: 'Delete the GitHub repository',
    deleteTargetGithubNote: 'The repository and its history will be deleted on github.com.',
    deleteTargetLocal: 'Delete the local folder',
    deleteTargetLocalNote:
      'The folder and everything in it will be erased from this machine. Final.',
    deleteWorking: 'Deleting…',
    deleting: 'Deleting the files…',
    deleted: (name: string) => `Project deleted: ${name}.`,
    deletedSite: 'Removed from the BuildIt list.',
    deletedRepository: 'GitHub repository deleted.',
    deletedLocal: 'Local folder deleted.',
    repositoryDeletedTitle: 'GitHub repository deleted',
    repositoryDeletedBody:
      'The project is detached from GitHub: its old address was removed from the list, nothing else changed.',
    repositoryGoneTitle: 'Repository not found on GitHub',
    repositoryGoneBody:
      'The repository no longer exists on GitHub. The project is detached: its old address was removed from the list, and the app keeps working.',
    repositoryMissingBody:
      'No repository address is stored for this project. You can create a new one, or carry on without GitHub.',
    repositoryConnect: 'Connect a new repository',
    repositoryArchiveOnly:
      'This project was downloaded as an archive: there is no local copy to push to a new repository. “Close” leaves it as is.',
    repositoryFailed: (name: string) =>
      `The GitHub repository of ${name} could not be deleted: your account may no longer have access, or GitHub did not answer. The address is kept so you can try again.`,
    deleteFailed: (message: string) => `The deletion did not go through: ${message}`,
    forgetHint: 'Removing a project from here deletes no file on disk.',
    openInExplorer: 'Open in the file explorer',
    openInExplorerLabel: (directory: string) => `Open in the file explorer: ${directory}`,
    openInExplorerFailed: 'The file explorer could not be opened.',
    openInExplorerRefusals: {
      hosted: 'BuildIt is not running on this machine: the folder cannot be opened from here.',
      empty: 'No folder was given.',
      notRegistered: 'This folder was not written by BuildIt: it will not be opened from here.',
      missing: 'This folder no longer exists at that location.',
      failed: 'The file explorer could not be opened. Open the folder yourself.',
    },
    clearConfirmTitle: 'Clear the list?',
    clearConfirmBody:
      'Choose what should disappear. By default only the BuildIt list is cleared: the projects and their repositories stay in place.',
    clearConfirmAction: 'Clear the selection',
    clearTargetSite: 'Clear the BuildIt list',
    clearTargetSiteNote: 'The rows disappear. A regenerated project comes back to it.',
    clearTargetGithub: 'Delete the GitHub repositories',
    clearTargetGithubNote: 'Every listed repository will be deleted on github.com. Final.',
    clearTargetLocal: 'Delete the local folders',
    clearTargetLocalNote: 'Every listed folder will be erased from this machine. Final.',
    clearWorking: 'Deleting…',
    clearDone: 'List cleared.',
    clearRemoved: (count: number) => `Projects removed from the list: ${count}.`,
    clearRepositories: (count: number) => `GitHub repositories deleted: ${count}.`,
    clearGone: (count: number) => `Repositories already gone on GitHub: ${count}.`,
    clearLocal: (count: number) => `Local folders deleted: ${count}.`,
    clearFailures: (count: number) => `Failures: ${count}.`,
    sizeOf: (size: string) => `Size: ${size}`,
    techLabel: 'Technologies',
    moreTech: (count: number) => `${count} more technolog${count > 1 ? 'ies' : 'y'}`,
  },
};
