import type { Widen } from './widen';

/**
 * Le plan du projet et son lien de partage.
 *
 * Voir `messages.ts` pour la composition. Le français fait foi : une clé
 * ajoutée d'un côté sans l'autre fait échouer `pnpm typecheck`.
 */

export const FR_SHARE = {
  blueprintShare: {
    /** La ligne de partage : un bouton, le lien créé, sa copie. */
    create: 'Créer un lien de partage',
    created: 'Lien créé',
    linkLabel: 'Lien de partage',
    copy: 'Copier le lien',
    copied: 'Lien copié dans le presse-papiers',
    copyFailed: 'Copie impossible : sélectionnez le lien et copiez-le à la main',
    /** Le crayon posé à côté de chaque choix du plan : il ramène à son étape. */
    edit: (label: string) => `Modifier ${label}`,
    editName: 'Modifier le nom du projet',
    /** Les choix du brouillon qui n'entrent pas au manifest, mais se relisent ici. */
    roles: {
      type: 'Profil du projet',
      env: 'Variables d’environnement',
    },
  },
} as const;

export const EN_SHARE: Widen<typeof FR_SHARE> = {
  blueprintShare: {
    create: 'Create a share link',
    created: 'Link created',
    linkLabel: 'Share link',
    copy: 'Copy the link',
    copied: 'Link copied to clipboard',
    copyFailed: 'Copy failed: select the link and copy it by hand',
    edit: (label: string) => `Edit ${label}`,
    editName: 'Edit the project name',
    roles: {
      type: 'Project profile',
      env: 'Environment variables',
    },
  },
};
