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
    draftTitle: 'Brouillon en cours',
    draftEmpty:
      'Aucun brouillon en cours. Choisissez un chemin : tout est conservé au fur et à mesure.',
    draftEmptyAfterProject:
      'Rien à reprendre. Choisissez un chemin ci-dessus pour démarrer un autre projet.',
    draftLastScreen: (label: string) => `Dernier écran : ${label}.`,
    draftKept: 'Le brouillon se reprend tout seul si vous fermez l’onglet.',
    resume: 'Reprendre',
    reset: 'Repartir de zéro',
    unnamed: 'Projet sans nom',
  },
  projects: {
    title: 'Projets créés',
    description: 'Tous les projets générés depuis ce navigateur, du plus récent au plus ancien.',
    empty: 'Aucun projet généré pour l’instant.',
    emptyAction: 'Créer un premier projet',
    done: 'Terminé',
    locked: 'Ce projet est généré : il ne se modifie plus depuis BuildIt.',
    generatedOn: (date: string) => `Généré le ${date}`,
    files: (count: number) => `${count} fichier${count > 1 ? 's' : ''}`,
    report: 'Rapport & installation',
    connectGithub: 'Connecter à GitHub',
    download: 'Télécharger à nouveau',
    forget: 'Retirer de la liste',
    forgetAll: 'Vider la liste',
    forgetHint: 'Retirer un projet d’ici ne supprime aucun fichier sur le disque.',
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
    draftTitle: 'Draft in progress',
    draftEmpty: 'No draft in progress. Pick a path: everything is kept as you go.',
    draftEmptyAfterProject: 'Nothing to resume. Pick a path above to start another project.',
    draftLastScreen: (label: string) => `Last screen: ${label}.`,
    draftKept: 'The draft comes back on its own if you close the tab.',
    resume: 'Resume',
    reset: 'Start over',
    unnamed: 'Untitled project',
  },
  projects: {
    title: 'Projects created',
    description: 'Every project generated from this browser, newest first.',
    empty: 'No project generated yet.',
    emptyAction: 'Create a first project',
    done: 'Done',
    locked: 'This project is generated: BuildIt no longer edits it.',
    generatedOn: (date: string) => `Generated on ${date}`,
    files: (count: number) => `${count} file${count > 1 ? 's' : ''}`,
    report: 'Report & install',
    connectGithub: 'Connect to GitHub',
    download: 'Download again',
    forget: 'Remove from list',
    forgetAll: 'Clear the list',
    forgetHint: 'Removing a project from here deletes no file on disk.',
  },
};
