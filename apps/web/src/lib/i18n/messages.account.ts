import type { Widen } from './widen';

/**
 * Les textes du compte GitHub, du dépôt, du partage par lien et du graphe de
 * dépendances. Voir `messages.ts` pour la composition.
 *
 * Les identifiants techniques — noms de dépôts, chemins, URLs, slugs de rôle,
 * codes d'erreur de `?error=` — ne sont jamais traduits : ils sont les mêmes
 * dans un terminal et dans la barre d'adresse. Ce qui est traduit, c'est le
 * cadre autour, et les phrases qui expliquent quoi faire.
 */

export const FR_ACCOUNT = {
  /** L'écran 21 — connexion GitHub (§6.21, §20bis). */
  account: {
    title: 'Compte GitHub',
    connection: 'Connexion',
    descriptionDevice:
      'La connexion se fait par un code à saisir sur github.com : aucun mot de passe ne transite par BuildIt, et le jeton reste dans le trousseau de cette machine.',
    descriptionRedirect:
      'La connexion ouvre github.com : choisissez votre compte, acceptez les permissions, vous revenez ici connecté. Aucun mot de passe ne transite par BuildIt.',
    readingStatus: 'Lecture de l’état de la connexion…',
    connected: 'Connecté',
    notConnected: 'Aucun compte GitHub connecté.',
    notConnectedTitle: 'Aucun compte connecté',
    grantedScopes: (list: string) => `Permissions accordées : ${list}.`,
    fineGrainedScopes: 'celles du jeton à grain fin',
    connectedAs: (login: string) => `Connecté : ${login}.`,
    disconnected: 'Compte GitHub déconnecté : le jeton a été retiré du trousseau.',
    tokenStore: (store: string) => `Jeton rangé dans : ${store}. Il ne quitte pas cette machine.`,
    connect: 'Se connecter à GitHub',
    connectHintRedirect:
      'Ouvre github.com dans cet onglet : choisissez votre compte, acceptez les permissions, vous revenez ici connecté.',
    contactingGithub: 'En attente de GitHub…',
    disconnect: 'Se déconnecter',
    /* L'attente de validation dans le navigateur : le code court, l'adresse, et
       le geste qui en sort — sans lui, l'écran resterait bloqué sur GitHub. */
    deviceTitle: 'Validation dans le navigateur',
    deviceInstruction: 'Ouvrez la page GitHub et saisissez ce code :',
    deviceAddress: 'Adresse :',
    deviceWaiting: 'En attente de votre accord sur github.com…',
    cancelWaiting: 'Annuler l’attente',
    cancelled: 'Attente annulée : aucune connexion n’a été établie.',
    deviceUnavailable:
      'La connexion par code n’est pas configurée sur ce déploiement : définissez PF_GITHUB_CLIENT_ID avec l’identifiant de l’application, puis relancez le serveur.',
    permissionReason: (scope: string, fallback: string): string => {
      switch (scope) {
        case 'repo':
          return 'cloner vos dépôts privés, créer un dépôt, gérer ses collaborateurs';
        case 'public_repo':
          return 'dépôts publics seulement : créer un dépôt public, gérer ses collaborateurs';
        default:
          return fallback;
      }
    },
    /* Les refus d'un dépôt : ils viennent du moteur, ils sont affichés tels
       quels — seul le cadre est traduit. */
    connectionIssueTitle: 'La connexion ne peut pas aboutir',
    connectionIssueBody:
      'Ce qui bloque est listé ci-dessous, tel que GitHub et le système le renvoient. Rien n’a été connecté.',
    retryConnection: 'Réessayer la connexion',
    permissionsTitle: 'Permissions demandées',
    permissionsEmpty:
      'La liste des permissions arrive avec le compte : elle est connue dès que la connexion est lue.',
    permissionsNote:
      'Elles ne servent qu’aux actions que vous déclenchez : lister et cloner vos dépôts, créer le dépôt d’un projet, gérer ses collaborateurs. Aucune valeur secrète n’est affichée ni conservée ailleurs que dans le trousseau.',
    /* Le retour de `/github/callback` arrive par l'adresse, avec un code : la
       phrase dit quoi faire, jamais la trace technique. */
    loadFailedTitle: 'L’état de la connexion n’a pas pu être lu',
    loadFailedBody:
      'Le serveur n’a pas répondu. Réessayez : relire l’état ne modifie ni le compte ni le jeton.',
    callbackError: (code: string): string => {
      switch (code) {
        case 'not_configured':
          return 'La connexion GitHub n’est pas configurée sur ce déploiement : PF_GITHUB_CLIENT_ID, PF_GITHUB_CLIENT_SECRET ou SESSION_SECRET manque.';
        case 'denied':
          return 'Connexion refusée sur github.com : rien n’a été connecté.';
        case 'state':
          return 'La réponse de GitHub ne correspond à aucune connexion en cours : relancez-la depuis cet écran.';
        case 'exchange':
          return 'GitHub a refusé l’échange du code d’autorisation : relancez la connexion.';
        case 'store':
          return 'Le jeton n’a pas pu être enregistré : relancez la connexion.';
        default:
          return 'La connexion a échoué pour une raison inconnue : relancez-la.';
      }
    },
  },

  /** Le partage par lien (§20) : lecture seule, hors du parcours. */
  share: {
    title: 'Configuration partagée',
    metaDescription:
      'Lecture seule d’une configuration partagée : un manifest porté par le lien, sans compte et sans serveur.',
    descriptionLoading: 'Lecture seule : ce lien décrit une configuration, il ne l’exécute pas.',
    description:
      'Lecture seule : cette page montre les choix d’un projet. Elle ne modifie rien et ne génère rien.',
    loading: 'Lecture du lien…',
    readingCatalogue: 'Lecture du catalogue pour nommer les technologies…',
    readOnly: 'Lecture seule',
    privacy:
      'La configuration est portée par le fragment du lien : elle n’a été envoyée à aucun serveur, et cette page n’en conserve aucune trace.',
    nextLabel: 'Suite',
    homeLink: 'Accueil',
    backHome: 'Revenir à l’accueil',
    /* Un lien illisible se dit poliment : ce qui a été refusé, puis la sortie —
       sans trace technique, cette page est publique. */
    invalidTitle: 'Ce lien n’a pas pu être lu.',
    invalidBody:
      'Le lien reçu est incomplet, tronqué ou altéré : rien n’a été exécuté, et rien n’a été modifié.',
    invalidIssues: 'Ce que le décodeur a refusé',
    invalidHint:
      'Demandez à la personne qui vous l’a envoyé de recopier le lien en entier, ou recevez-en un nouveau depuis',
    invalidHomeWord: 'l’accueil',
  },

  /** Le champ « lien partagé reçu » de l'accueil (§20, Phase 9). */
  sharedLink: {
    eyebrow: 'Lien partagé reçu',
    label: 'Lien d’un projet partagé',
    placeholder: '/share#…',
    open: 'Ouvrir',
    hintBefore: 'Lecture seule. Le manifest est encodé après le ',
    hintAfter:
      ' : cette partie ne quitte jamais votre navigateur, elle n’est donc ni journalisée ni indexée.',
    invalid:
      'Ce lien n’est pas une adresse de partage exploitable : collez le lien complet, ou ouvrez un projet depuis l’accueil.',
  },

  /** L'écran 24 — dépôt & partage (§6.24, §20bis). */
  repo: {
    title: 'Dépôt & partage',
    description:
      'L’état du dépôt GitHub du projet, sa création si besoin, et les accès : les droits sont ceux de GitHub, BuildIt n’a pas de comptes.',
    pending: 'Opération en cours…',
    directoryLabel: 'Dossier du projet',
    directoryPlaceholder: 'C:\\projets\\mon-projet',
    directoryHint:
      'L’explorateur de cette machine désigne le dossier : l’état du dépôt est lu dès qu’il est choisi. En hébergé, le chemin se colle à la main.',
    inspect: 'Lire l’état du dépôt',
    inspecting: 'Lecture de l’état du dépôt…',
    creating: 'Création du dépôt et envoi du code…',
    inviting: 'Envoi de l’invitation…',
    removing: 'Retrait de l’accès…',
    repositoryEyebrow: 'Dépôt',
    readFailedTitle: 'L’état du dépôt n’a pas pu être lu',
    readFailedBody:
      'Le dossier n’a pas pu être inspecté. Corrigez le chemin, puis relisez : rien n’a été écrit.',
    issuesTitle: 'Ce qui a été refusé',
    visibilityPrivate: 'privé',
    visibilityPublic: 'public',
    visibilityUnknown: 'visibilité inconnue',
    localRepo: (origin: string, visibility: string) =>
      `Dépôt local : ${origin}. Le lien est copiable et le dépôt est ${visibility}.`,
    noOrigin: 'Ce dépôt Git n’a pas d’origine GitHub : le partage passe par GitHub.',
    notRepository:
      'Ce projet n’est pas encore un dépôt Git : le premier commit sera créé avant la création du dépôt.',
    nameLabel: 'Nom du dépôt',
    visibilityLegend: 'Visibilité',
    privateChoice: 'Privé',
    privateNote: 'Recommandé : seuls les collaborateurs invités y accèdent.',
    publicChoice: 'Public',
    publicNote: 'Visible par tout le monde sur GitHub.',
    descriptionLabel: 'Description (facultative)',
    createRepo: 'Créer le dépôt et pousser le code',
    created: (url: string) => `Dépôt créé : ${url}.`,
    shareSection: 'Partager le projet',
    shareProject: 'Partager le projet',
    usernameLabel: 'Nom d’utilisateur GitHub',
    usernamePlaceholder: 'octocat',
    roleLabel: 'Rôle',
    rolesLoading: 'Lecture des rôles disponibles…',
    collaborators: 'Collaborateurs',
    noCollaborators: 'Personne d’autre n’a accès à ce dépôt.',
    invitations: 'Invitations en attente',
    remove: 'Retirer',
    cancelInvite: 'Annuler',
    /* Le lien de configuration en lecture seule : le brouillon part dans le
       fragment de l'URL, donc jamais vers le serveur. */
    shareLinkTitle: 'Lien de partage en lecture seule',
    shareLinkBlocked:
      'Le brouillon est incomplet : le lien ne peut pas être créé tant que le plan du projet n’est pas constructible.',
    shareLinkResume: 'Compléter le brouillon',
    roleNames: {
      read: 'Lecture',
      triage: 'Tri',
      write: 'Écriture',
      maintain: 'Maintenance',
      admin: 'Administration',
    },
    roleNotes: {
      read: 'Voit le dépôt sans écrire : de quoi relire les choix de configuration.',
      triage: 'Gère les tickets et les pull requests, sans toucher au code.',
      write: 'Pousse du code et des branches. Le rôle par défaut d’une invitation.',
      maintain: 'Écriture, plus les réglages du dépôt, sans les accès sensibles.',
      admin: 'Tous les droits, y compris gérer les collaborateurs et le dépôt.',
    },
    /* Pourquoi un bouton est grisé : un bouton désactivé sans phrase est un
       cul-de-sac. */
    blockers: {
      readFirst: 'Lisez d’abord l’état du dépôt.',
      shareNoRepo:
        'Le partage passe par un dépôt GitHub : créez-le d’abord. Le lien de configuration en lecture seule reste possible sans dépôt.',
      busy: 'Une opération est en cours.',
      nameMissing: 'Choisissez un nom de dépôt.',
      alreadyRepo: 'Ce projet a déjà un dépôt GitHub.',
      usernameMissing: 'Indiquez un nom d’utilisateur GitHub.',
    },
  },

  /** L'écran 11 — graphe de dépendances (§6.11), hors parcours. */
  graph: {
    title: 'Graphe de dépendances',
    description:
      'Ce qui a été choisi, ce que le moteur a ajouté, et par quoi les pièces tiennent ensemble.',
    backToBlueprint: 'Retour au Blueprint',
    loading: 'Calcul du graphe…',
    errorTitle: 'Le graphe n’a pas pu être calculé',
    errorBody:
      'Le calcul lit le catalogue local et les relations déclarées. Rien n’a été modifié : réessayez.',
    retry: 'Recalculer le graphe',
    emptyTitle: 'Aucune technologie sélectionnée',
    emptyBody:
      'Le graphe est vide parce que rien n’est coché. Choisissez des technologies, puis revenez ici.',
    emptyAction: 'Choisir des technologies',
    certified: 'Sélection certifiée',
    experimental: 'Sélection valide',
    counts: (nodes: number, edges: number) =>
      `${nodes} nœud${nodes > 1 ? 's' : ''}, ${edges} relation${edges > 1 ? 's' : ''}`,
    diagramTitle: 'Graphe de dépendances de la sélection',
    diagramHeading: 'Dessin du graphe',
    noEdges: 'Aucune relation déclarée entre ces technologies.',
    relationLabels: {
      requires: 'exige',
      compatibleWith: 'compatible avec',
    },
    stateLabels: {
      selected: 'Choisi',
      added: 'Ajouté par le moteur',
    },
    describeNode: (label: string, category: string, state: string) =>
      `${label} (${category}, ${state})`,
    describeEdge: (from: string, relation: string, to: string) => `${from} ${relation} ${to}.`,
  },
} as const;

export const EN_ACCOUNT: Widen<typeof FR_ACCOUNT> = {
  account: {
    title: 'GitHub account',
    connection: 'Connection',
    descriptionDevice:
      'Signing in uses a code you enter on github.com: no password goes through BuildIt, and the token stays in this machine’s keychain.',
    descriptionRedirect:
      'Signing in opens github.com: pick your account, accept the permissions, and you come back here signed in. No password goes through BuildIt.',
    readingStatus: 'Reading the connection state…',
    connected: 'Connected',
    notConnected: 'No GitHub account connected.',
    notConnectedTitle: 'No account connected',
    grantedScopes: (list: string) => `Granted permissions: ${list}.`,
    fineGrainedScopes: 'those of the fine-grained token',
    connectedAs: (login: string) => `Signed in: ${login}.`,
    disconnected: 'GitHub account signed out: the token was removed from the keychain.',
    tokenStore: (store: string) => `Token stored in: ${store}. It never leaves this machine.`,
    connect: 'Connect to GitHub',
    connectHintRedirect:
      'Opens github.com in this tab: pick your account, accept the permissions, and you come back here signed in.',
    contactingGithub: 'Waiting for GitHub…',
    disconnect: 'Sign out',
    deviceTitle: 'Browser confirmation',
    deviceInstruction: 'Open the GitHub page and enter this code:',
    deviceAddress: 'Address:',
    deviceWaiting: 'Waiting for your approval on github.com…',
    cancelWaiting: 'Cancel the wait',
    cancelled: 'Wait cancelled: no connection was established.',
    deviceUnavailable:
      'Code sign-in is not configured on this deployment: set PF_GITHUB_CLIENT_ID with the application id, then restart the server.',
    permissionReason: (scope: string, fallback: string) => {
      switch (scope) {
        case 'repo':
          return 'clone your private repositories, create a repository, manage its collaborators';
        case 'public_repo':
          return 'public repositories only: create a public repository, manage its collaborators';
        default:
          return fallback;
      }
    },
    connectionIssueTitle: 'The connection cannot go through',
    connectionIssueBody:
      'What blocks it is listed below, exactly as GitHub and the system report it. Nothing was connected.',
    retryConnection: 'Try connecting again',
    permissionsTitle: 'Requested permissions',
    permissionsEmpty:
      'The permission list comes with the account: it is known as soon as the connection is read.',
    permissionsNote:
      'They only serve the actions you trigger: listing and cloning your repositories, creating a project’s repository, managing its collaborators. No secret value is shown or kept anywhere but the keychain.',
    loadFailedTitle: 'The connection state could not be read',
    loadFailedBody:
      'The server did not answer. Try again: reading the state changes neither the account nor the token.',
    callbackError: (code: string) => {
      switch (code) {
        case 'not_configured':
          return 'GitHub sign-in is not configured on this deployment: PF_GITHUB_CLIENT_ID, PF_GITHUB_CLIENT_SECRET or SESSION_SECRET is missing.';
        case 'denied':
          return 'Sign-in was refused on github.com: nothing was connected.';
        case 'state':
          return 'GitHub’s answer matches no sign-in in progress: start it again from this screen.';
        case 'exchange':
          return 'GitHub refused the authorization code exchange: start the sign-in again.';
        case 'store':
          return 'The token could not be saved: start the sign-in again.';
        default:
          return 'Sign-in failed for an unknown reason: start it again.';
      }
    },
  },

  share: {
    title: 'Shared configuration',
    metaDescription:
      'Read-only view of a shared configuration: a manifest carried by the link, with no account and no server.',
    descriptionLoading: 'Read-only: this link describes a configuration, it does not run it.',
    description:
      'Read-only: this page shows a project’s choices. It changes nothing and generates nothing.',
    loading: 'Reading the link…',
    readingCatalogue: 'Reading the catalogue to name the technologies…',
    readOnly: 'Read-only',
    privacy:
      'The configuration is carried by the link’s fragment: it was sent to no server, and this page keeps no trace of it.',
    nextLabel: 'Next',
    homeLink: 'Home',
    backHome: 'Back to home',
    invalidTitle: 'This link could not be read.',
    invalidBody:
      'The link received is incomplete, truncated or altered: nothing was run, and nothing was changed.',
    invalidIssues: 'What the decoder refused',
    invalidHint: 'Ask the person who sent it to copy the whole link again, or get a new one from',
    invalidHomeWord: 'home',
  },

  sharedLink: {
    eyebrow: 'Shared link received',
    label: 'Link to a shared project',
    placeholder: '/share#…',
    open: 'Open',
    hintBefore: 'Read-only. The manifest is encoded after the ',
    hintAfter: ': that part never leaves your browser, so it is neither logged nor indexed.',
    invalid:
      'This link is not a usable share address: paste the whole link, or open a project from home.',
  },

  repo: {
    title: 'Repository & sharing',
    description:
      'The project’s GitHub repository state, creating it if needed, and access: rights are GitHub’s, BuildIt has no accounts.',
    pending: 'An operation is running…',
    directoryLabel: 'Project folder',
    directoryPlaceholder: 'C:\\projects\\my-project',
    directoryHint:
      'This machine’s file browser picks the folder: the repository state is read as soon as it is chosen. On a hosted deployment, the path is pasted by hand.',
    inspect: 'Read the repository state',
    inspecting: 'Reading the repository state…',
    creating: 'Creating the repository and pushing the code…',
    inviting: 'Sending the invitation…',
    removing: 'Removing the access…',
    repositoryEyebrow: 'Repository',
    readFailedTitle: 'The repository state could not be read',
    readFailedBody:
      'The folder could not be inspected. Fix the path, then read it again: nothing was written.',
    issuesTitle: 'What was refused',
    visibilityPrivate: 'private',
    visibilityPublic: 'public',
    visibilityUnknown: 'unknown visibility',
    localRepo: (origin: string, visibility: string) =>
      `Local repository: ${origin}. The link is copyable and the repository is ${visibility}.`,
    noOrigin: 'This Git repository has no GitHub origin: sharing goes through GitHub.',
    notRepository:
      'This project is not a Git repository yet: the first commit is created before the repository.',
    nameLabel: 'Repository name',
    visibilityLegend: 'Visibility',
    privateChoice: 'Private',
    privateNote: 'Recommended: only invited collaborators can reach it.',
    publicChoice: 'Public',
    publicNote: 'Visible to everyone on GitHub.',
    descriptionLabel: 'Description (optional)',
    createRepo: 'Create the repository and push the code',
    created: (url: string) => `Repository created: ${url}.`,
    shareSection: 'Share the project',
    shareProject: 'Share the project',
    usernameLabel: 'GitHub username',
    usernamePlaceholder: 'octocat',
    roleLabel: 'Role',
    rolesLoading: 'Reading the available roles…',
    collaborators: 'Collaborators',
    noCollaborators: 'Nobody else has access to this repository.',
    invitations: 'Pending invitations',
    remove: 'Remove',
    cancelInvite: 'Cancel',
    shareLinkTitle: 'Read-only share link',
    shareLinkBlocked:
      'The draft is incomplete: the link cannot be created until the project plan can be built.',
    shareLinkResume: 'Complete the draft',
    roleNames: {
      read: 'Read',
      triage: 'Triage',
      write: 'Write',
      maintain: 'Maintain',
      admin: 'Admin',
    },
    roleNotes: {
      read: 'Sees the repository without writing: enough to re-read the configuration choices.',
      triage: 'Manages issues and pull requests, without touching the code.',
      write: 'Pushes code and branches. The default role of an invitation.',
      maintain: 'Write, plus the repository settings, without the sensitive access.',
      admin: 'Every right, including managing collaborators and the repository.',
    },
    blockers: {
      readFirst: 'Read the repository state first.',
      shareNoRepo:
        'Sharing goes through a GitHub repository: create it first. The read-only configuration link stays possible without one.',
      busy: 'An operation is running.',
      nameMissing: 'Choose a repository name.',
      alreadyRepo: 'This project already has a GitHub repository.',
      usernameMissing: 'Enter a GitHub username.',
    },
  },

  graph: {
    title: 'Dependency graph',
    description: 'What was chosen, what the engine added, and what holds the pieces together.',
    backToBlueprint: 'Back to the Blueprint',
    loading: 'Computing the graph…',
    errorTitle: 'The graph could not be computed',
    errorBody:
      'The computation reads the local catalogue and the declared relations. Nothing was changed: try again.',
    retry: 'Recompute the graph',
    emptyTitle: 'No technology selected',
    emptyBody:
      'The graph is empty because nothing is ticked. Choose technologies, then come back here.',
    emptyAction: 'Choose technologies',
    certified: 'Certified selection',
    experimental: 'Valid selection',
    counts: (nodes: number, edges: number) =>
      `${nodes} node${nodes === 1 ? '' : 's'}, ${edges} relation${edges === 1 ? '' : 's'}`,
    diagramTitle: 'Dependency graph of the selection',
    diagramHeading: 'Graph drawing',
    noEdges: 'No relation declared between these technologies.',
    relationLabels: {
      requires: 'requires',
      compatibleWith: 'compatible with',
    },
    stateLabels: {
      selected: 'Chosen',
      added: 'Added by the engine',
    },
    describeNode: (label: string, category: string, state: string) =>
      `${label} (${category}, ${state})`,
    describeEdge: (from: string, relation: string, to: string) => `${from} ${relation} ${to}.`,
  },
};
