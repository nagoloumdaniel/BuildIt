'use client';

import { type ReactElement, useEffect, useMemo, useState } from 'react';
import { useDraft } from '../../components/wizard/draft-provider';
import { draftToManifest } from '../../lib/draft-to-manifest';
import { useMessages } from '../../lib/i18n/provider';
import {
  accessListAction,
  createRepositoryAction,
  inviteCollaboratorAction,
  removeCollaboratorAction,
  repositoryRolesAction,
  repositoryStatusAction,
} from '../actions-node';
import { shareLinkBaseAction } from '../actions-share';
import { encodeShareLink, shareOrigin } from '../share/codec';
import type { AccessView, RepositoryStatusView, RoleView } from './sharing';
import { RepoView } from './view';

/** Écran 24 — Repository & Sharing (§6.24) : le branchement des Server Actions. */
export default function RepoPage(): ReactElement {
  const t = useMessages();
  const draft = useDraft();
  const [directory, setDirectory] = useState('');
  const [status, setStatus] = useState<RepositoryStatusView | null>(null);
  const [access, setAccess] = useState<AccessView | null>(null);
  const [roles, setRoles] = useState<readonly RoleView[]>([]);
  const [role, setRole] = useState('write');
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);

  /**
   * Le manifest du brouillon, pour le lien de partage en lecture seule.
   *
   * Il est recalculé avec le brouillon : le lien suit les choix, il ne fige pas
   * une version périmée. Un brouillon incomplet n'a pas de manifest — l'écran
   * dit alors pourquoi le lien n'est pas encore possible.
   */
  const manifest = useMemo(() => draftToManifest(draft), [draft]);

  useEffect(() => {
    let alive = true;
    void repositoryRolesAction().then((loaded) => {
      if (alive) {
        setRoles(loaded);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  /**
   * Une opération, avec son libellé.
   *
   * L'indicateur nomme le travail en cours (« Lecture de l'état du dépôt… ») :
   * un rotor seul ne dit pas quoi attendre, et un bouton grisé sans phrase
   * laisse l'utilisateur deviner.
   */
  async function withPending(label: string, work: () => Promise<void>): Promise<void> {
    setBusy(true);
    setPending(label);
    try {
      await work();
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  async function inspect(target: string = directory): Promise<void> {
    await withPending(t.repo.inspecting, async () => {
      setAccess(null);
      setMessage(undefined);
      const next = await repositoryStatusAction(target);
      setStatus(next);
      if (next.ok && !next.github && name.trim() === '') {
        setName(next.proposedName);
      }
      if (next.ok && next.github) {
        setAccess(await accessListAction(target));
      }
    });
  }

  async function create(): Promise<void> {
    await withPending(t.repo.creating, async () => {
      const result = await createRepositoryAction({ directory, name, isPrivate, description });
      setMessage(
        result.ok && result.url !== undefined
          ? t.repo.created(result.url)
          : result.issues.join(' '),
      );
    });
    await inspect();
  }

  async function invite(): Promise<void> {
    await withPending(t.repo.inviting, async () => {
      const result = await inviteCollaboratorAction({ directory, username, role });
      setMessage(result.ok ? result.outcome : result.issues.join(' '));
      if (result.access !== undefined) {
        setAccess(result.access);
        setUsername('');
      }
    });
  }

  async function remove(login: string): Promise<void> {
    await withPending(t.repo.removing, async () => {
      const result = await removeCollaboratorAction({ directory, username: login });
      setMessage(result.ok ? result.outcome : result.issues.join(' '));
      if (result.access !== undefined) {
        setAccess(result.access);
      }
    });
  }

  /** Le lien de partage : encodage local, rien n'est envoyé au serveur (§20). */
  async function createShareLink(): Promise<void> {
    if (!manifest.ok) {
      return;
    }
    setShareBusy(true);
    try {
      const base = await shareLinkBaseAction().catch(() => '');
      setShareLink(encodeShareLink(manifest.value, shareOrigin(base, window.location.origin)));
      setShareNote(null);
    } finally {
      setShareBusy(false);
    }
  }

  async function copyShareLink(): Promise<void> {
    if (shareLink === null) {
      return;
    }
    try {
      await navigator.clipboard.writeText(shareLink);
      setShareNote(t.repo.shareLinkCopied);
    } catch {
      // Un presse-papiers inaccessible n'empêche pas le lien d'exister : il
      // reste affiché dans le champ, sélectionnable à la main.
      setShareNote(t.repo.shareLinkCopyManual);
    }
  }

  return (
    <RepoView
      access={access}
      busy={busy}
      description={description}
      directory={directory}
      isPrivate={isPrivate}
      message={message}
      name={name}
      onCreate={() => void create()}
      onDirectory={(value) => {
        setDirectory(value);
        setStatus(null);
        setAccess(null);
        setShareLink(null);
        setShareNote(null);
        // Le dossier choisi dans l'explorateur vaut lecture : l'inspection part
        // au choix, comme sur l'écran « Ouvrir un projet local ».
        if (value.trim() !== '') {
          void inspect(value);
        }
      }}
      onDescription={setDescription}
      onInspect={() => void inspect()}
      onInvite={() => void invite()}
      onIsPrivate={setIsPrivate}
      onName={setName}
      onRemove={(login) => void remove(login)}
      onRole={setRole}
      onUsername={setUsername}
      pendingLabel={pending}
      role={role}
      roles={roles}
      share={{
        link: shareLink,
        note: shareNote,
        busy: shareBusy,
        blocked: manifest.ok ? null : t.repo.shareLinkBlocked,
        onCreate: () => void createShareLink(),
        onCopy: () => void copyShareLink(),
      }}
      status={status}
      username={username}
    />
  );
}
