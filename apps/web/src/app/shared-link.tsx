'use client';

import { useRouter } from 'next/navigation';
import { type ReactElement, useState } from 'react';

/**
 * « Lien partagé reçu » (§20, Phase 9).
 *
 * Le lien porte le manifest **après le `#`** : cette partie n'est jamais
 * envoyée au serveur. Le champ ne fait donc que naviguer dans le navigateur —
 * rien à décoder ici, la page `/share` s'en charge.
 */
export function SharedLink(): ReactElement {
  const router = useRouter();
  const [link, setLink] = useState('');

  function open(): void {
    const value = link.trim();
    if (value === '') {
      return;
    }
    try {
      // Une URL complète ou un chemin collé : on ne garde que le chemin et le
      // fragment, pour ne pas suivre un hôte étranger collé par erreur.
      const url = new URL(value, window.location.origin);
      router.push(`${url.pathname}${url.search}${url.hash}`);
    } catch {
      // Un lien illisible ne doit pas lever : le champ reste tel quel.
    }
  }

  return (
    <section className="pf-card pf-card-pad mt-3">
      <p className="pf-eyebrow">Lien partagé reçu</p>
      <label className="pf-label mt-2" htmlFor="pf-shared-link">
        Lien d’un projet partagé
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="pf-shared-link"
          className="pf-input pf-mono"
          placeholder="/share#…"
          autoComplete="off"
          value={link}
          onChange={(event) => {
            setLink(event.target.value);
          }}
        />
        <button type="button" className="pf-btn" disabled={link.trim() === ''} onClick={open}>
          Ouvrir
        </button>
      </div>
      <p className="pf-hint mt-1">
        Lecture seule. Le manifest est encodé après le <span className="pf-mono">#</span> : cette
        partie ne quitte jamais votre navigateur, elle n’est donc ni journalisée ni indexée.
      </p>
    </section>
  );
}
