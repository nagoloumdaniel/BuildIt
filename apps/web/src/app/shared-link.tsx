'use client';

import { useRouter } from 'next/navigation';
import { type ReactElement, useState } from 'react';
import { IssueList } from '../components/ui/empty-state';
import { Icon } from '../components/ui/icon';
import { useMessages } from '../lib/i18n/provider';

/**
 * « Lien partagé reçu » (§20, Phase 9).
 *
 * Le lien porte le manifest **après le `#`** : cette partie n'est jamais
 * envoyée au serveur. Le champ ne fait donc que naviguer dans le navigateur —
 * rien à décoder ici, la page `/share` s'en charge.
 *
 * Un lien illisible n'est plus avalé en silence : le champ reste tel quel, et
 * la phrase dit quoi coller à la place.
 */
export function SharedLink(): ReactElement {
  const t = useMessages();
  const router = useRouter();
  const [link, setLink] = useState('');
  const [issue, setIssue] = useState<string | null>(null);

  function open(): void {
    const value = link.trim();
    if (value === '') {
      return;
    }
    try {
      // Une URL complète ou un chemin collé : on ne garde que le chemin et le
      // fragment, pour ne pas suivre un hôte étranger collé par erreur.
      const url = new URL(value, window.location.origin);
      setIssue(null);
      router.push(`${url.pathname}${url.search}${url.hash}`);
    } catch {
      // Un lien illisible ne doit pas lever : il se dit, et le champ reste.
      setIssue(t.sharedLink.invalid);
    }
  }

  return (
    <section className="pf-card pf-card-pad mt-3">
      <p className="pf-eyebrow">{t.sharedLink.eyebrow}</p>
      <label className="pf-label mt-2" htmlFor="pf-shared-link">
        {t.sharedLink.label}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          autoComplete="off"
          className="pf-input pf-mono"
          id="pf-shared-link"
          onChange={(event) => {
            setLink(event.target.value);
          }}
          placeholder={t.sharedLink.placeholder}
          value={link}
        />
        <button className="pf-btn" disabled={link.trim() === ''} onClick={open} type="button">
          <Icon name="arrowRight" />
          {t.sharedLink.open}
        </button>
      </div>
      <IssueList className="mt-2" issues={issue === null ? [] : [issue]} />
      <p className="pf-hint mt-1">
        {t.sharedLink.hintBefore}
        <span className="pf-mono">#</span>
        {t.sharedLink.hintAfter}
      </p>
    </section>
  );
}
