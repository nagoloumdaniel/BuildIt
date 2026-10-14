import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { FR } from '../../lib/i18n/messages';
import { ShareView } from './view';

/**
 * Page 9.1 configuration partagée en lecture seule (§20).
 *
 * Le `metadata` doit vivre dans un composant serveur : c'est ce qui pose le
 * `noindex`. Un lien de partage peut décrire le projet de quelqu'un ; il n'a
 * rien à faire dans un moteur de recherche, et un fragment d'URL n'est de toute
 * façon jamais indexé le `noindex` ferme la porte à l'indexation de l'URL
 * elle-même.
 *
 * Le titre et la description viennent du dictionnaire : une seule source pour
 * le texte de l'onglet et celui de l'écran.
 */
export const metadata: Metadata = {
  title: FR.share.title,
  description: FR.share.metaDescription,
  robots: { index: false, follow: false },
};

export default function SharePage(): ReactElement {
  return <ShareView />;
}
