import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { ShareView } from './view';

/**
 * Page 9.1 — configuration partagée en lecture seule (§20).
 *
 * Le `metadata` doit vivre dans un composant serveur : c'est ce qui pose le
 * `noindex`. Un lien de partage peut décrire le projet de quelqu'un ; il n'a
 * rien à faire dans un moteur de recherche, et un fragment d'URL n'est de toute
 * façon jamais indexé — le `noindex` ferme la porte à l'indexation de l'URL
 * elle-même.
 */
export const metadata: Metadata = {
  title: 'Configuration partagée — Project Factory',
  description:
    'Lecture seule d’une configuration partagée : un manifest porté par le lien, sans compte et sans serveur.',
  robots: { index: false, follow: false },
};

export default function SharePage(): ReactElement {
  return <ShareView />;
}
