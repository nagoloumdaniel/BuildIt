'use client';

import { type ReactElement, useEffect, useRef, useState } from 'react';
import { Icon } from '../../../components/ui/icon';
import { useMessages } from '../../../lib/i18n/provider';
import { githubStatusAction } from '../../actions-node';

/**
 * Connecter le projet à GitHub **avant** la génération (§20bis, §6.13).
 *
 * C'est un choix, jamais une obligation : la génération en dossier écrit et
 * installe le projet, puis — seulement si ce panneau porte un nom de dépôt —
 * crée le dépôt sur le compte connecté et y pousse le contenu (sans le dossier
 * racine, la branche `main`).
 *
 * Le panneau ne crée rien lui-même : il dit l'état de la connexion, propose la
 * connexion quand elle manque (`/github?returnTo=/create/generate`), et rend le
 * nom du dépôt à l'appelant, qui le passe à la génération.
 */

export interface GithubConnectPanelProps {
  /** Le nom par défaut du dépôt : le nom du projet. */
  readonly projectName: string;
  /** Rend le nom du dépôt retenu, ou `undefined` quand GitHub n'est pas demandé. */
  readonly onChange: (github: { readonly name: string } | undefined) => void;
}

type GithubState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'connected'; readonly login: string }
  | { readonly kind: 'disconnected' };

export function GithubConnectPanel({
  projectName,
  onChange,
}: GithubConnectPanelProps): ReactElement {
  const t = useMessages();
  const g = t.build.generate.github;
  const [state, setState] = useState<GithubState>({ kind: 'loading' });
  const [name, setName] = useState(projectName);
  // Le nom du projet au moment du dernier alignement : quand il change, on
  // repart de son nom tant que l'utilisateur n'a pas tapé le sien.
  const lastProjectName = useRef(projectName);

  useEffect(() => {
    let alive = true;
    void githubStatusAction()
      .then((status) => {
        if (alive) {
          setState(
            status.connected
              ? { kind: 'connected', login: status.login ?? '' }
              : { kind: 'disconnected' },
          );
        }
      })
      .catch(() => {
        // Le serveur ne répond pas : on propose la connexion, sans prétendre
        // connaître l'état. Le bouton mène à l'écran de connexion, qui le dira.
        if (alive) {
          setState({ kind: 'disconnected' });
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  const connected = state.kind === 'connected';

  // Le nom suit le projet tant que l'utilisateur n'a pas tapé le sien : un
  // brouillon renommé ne doit pas laisser un dépôt au nom périmé.
  useEffect(() => {
    if (name === lastProjectName.current && name !== projectName) {
      setName(projectName);
    }
    lastProjectName.current = projectName;
  }, [projectName, name]);

  // Le nom retenu ne part à la génération que si GitHub est réellement demandé.
  useEffect(() => {
    onChange(connected && name.trim() !== '' ? { name: name.trim() } : undefined);
  }, [connected, name, onChange]);

  if (state.kind === 'loading') {
    return (
      <section className="pf-card pf-card-pad" aria-busy="true">
        <p className="pf-hint">{g.reading}</p>
      </section>
    );
  }

  return (
    <section className="pf-card pf-card-pad">
      <p className="pf-eyebrow flex items-center gap-2">
        <Icon name="github" size={14} />
        {g.title}
      </p>

      {connected ? (
        <>
          <p className="mt-2 flex flex-wrap items-center gap-2">
            <span className="pf-badge pf-badge-ok flex-none">
              <Icon name="check" size={11} />
              {g.connectedAs(state.login)}
            </span>
          </p>
          <label className="pf-label mt-3" htmlFor="pf-generate-github-name">
            {g.nameLabel}
          </label>
          <input
            autoComplete="off"
            className="pf-input pf-mono"
            id="pf-generate-github-name"
            onChange={(event) => setName(event.target.value)}
            spellCheck={false}
            value={name}
          />
          <p className="pf-hint mt-1">{g.nameHint}</p>
        </>
      ) : (
        <>
          <p className="pf-hint mt-1">{g.notConnected}</p>
          <a className="pf-btn pf-btn-primary mt-3" href="/github?returnTo=/create/generate">
            <Icon name="github" />
            {g.connect}
          </a>
        </>
      )}
    </section>
  );
}
