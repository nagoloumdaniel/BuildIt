/**
 * « Nouveau projet » : l'adresse qui démarre un brouillon neuf.
 *
 * `/create` seul **reprend** le brouillon (rechargement, Reprendre) ; avec ce
 * paramètre, l'écran 1 le remet à zéro avant de s'afficher (`FreshStart`).
 */
export const NEW_PROJECT_PARAM = 'new';
export const NEW_PROJECT_HREF = `/create?${NEW_PROJECT_PARAM}=1`;
