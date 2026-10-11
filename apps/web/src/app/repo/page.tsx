'use client';

import { type ReactElement, useEffect, useState } from 'react';
import {
  accessListAction,
  createRepositoryAction,
  inviteCollaboratorAction,
  removeCollaboratorAction,
  repositoryRolesAction,
  repositoryStatusAction,
} from '../actions-node';
import type { AccessView, RepositoryStatusView, RoleView } from './sharing';
import { RepoView } from './view';

/** Écran 24 — Repository & Sharing (§6.24) : le branchement des Server Actions. */
export default function RepoPage(): ReactElement {
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
  const [message, setMessage] = useState<string | undefined>(undefined);

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

  async function inspect(): Promise<void> {
    setBusy(true);
    setAccess(null);
    setMessage(undefined);
    const next = await repositoryStatusAction(directory);
    setStatus(next);
    if (next.ok && !next.github && name.trim() === '') {
      setName(next.proposedName);
    }
    if (next.ok && next.github) {
      setAccess(await accessListAction(directory));
    }
    setBusy(false);
  }

  async function create(): Promise<void> {
    setBusy(true);
    const result = await createRepositoryAction({ directory, name, isPrivate, description });
    setMessage(
      result.ok && result.url !== undefined
        ? `Dépôt créé : ${result.url}.`
        : result.issues.join(' '),
    );
    setBusy(false);
    await inspect();
  }

  async function invite(): Promise<void> {
    setBusy(true);
    const result = await inviteCollaboratorAction({ directory, username, role });
    setMessage(result.ok ? result.outcome : result.issues.join(' '));
    if (result.access !== undefined) {
      setAccess(result.access);
      setUsername('');
    }
    setBusy(false);
  }

  async function remove(login: string): Promise<void> {
    setBusy(true);
    const result = await removeCollaboratorAction({ directory, username: login });
    setMessage(result.ok ? result.outcome : result.issues.join(' '));
    if (result.access !== undefined) {
      setAccess(result.access);
    }
    setBusy(false);
  }

  return (
    <RepoView
      directory={directory}
      onDirectory={(value) => {
        setDirectory(value);
        setStatus(null);
        setAccess(null);
      }}
      status={status}
      access={access}
      roles={roles}
      role={role}
      onRole={setRole}
      username={username}
      onUsername={setUsername}
      name={name}
      onName={setName}
      isPrivate={isPrivate}
      onIsPrivate={setIsPrivate}
      description={description}
      onDescription={setDescription}
      busy={busy}
      message={message}
      onInspect={() => void inspect()}
      onCreate={() => void create()}
      onInvite={() => void invite()}
      onRemove={(login) => void remove(login)}
    />
  );
}
