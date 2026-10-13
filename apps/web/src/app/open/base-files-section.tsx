'use client';

import { type ReactElement, useCallback, useEffect, useState } from 'react';
import { useMessages } from '../../lib/i18n/provider';
import { BasePanel } from './base-panel';
import { type DirectoryHandle, readHandleFolder } from './browser-picker';
import { applyBaseTo, type BaseFilesResult, type BaseFilesView, baseFilesOf } from './local-open';
import type { PickedTarget } from './picked-store';

/**
 * Le panneau des fichiers de base, **hors de `/open`** : à la fin d'une
 * génération ou d'un clone, sur le dossier qui vient d'être écrit.
 *
 * Même calcul et même écriture que `/open` (`baseFilesOf`, `applyBaseTo`) :
 * en local, le serveur écrit en `wx` ; en hébergé, la poignée du dossier
 * écrit en sautant ce qui existe. Rien n'est jamais écrasé.
 */
export type BaseFilesSource =
  | { readonly kind: 'path'; readonly path: string }
  | { readonly kind: 'handle'; readonly handle: DirectoryHandle };

async function targetOf(source: BaseFilesSource): Promise<PickedTarget> {
  if (source.kind === 'path') return source;
  return {
    kind: 'entries',
    value: await readHandleFolder(source.handle),
    access: { kind: 'handle', handle: source.handle },
  };
}

export function BaseFilesSection({
  source,
}: {
  readonly source: BaseFilesSource;
}): ReactElement | null {
  const t = useMessages();
  const [target, setTarget] = useState<PickedTarget | null>(null);
  const [base, setBase] = useState<BaseFilesView | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BaseFilesResult | null>(null);

  // La source par sa valeur : un objet recréé à chaque rendu ne relance rien.
  const key = source.kind === 'path' ? source.path : source.handle;
  // biome-ignore lint/correctness/useExhaustiveDependencies: la clé suffit.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const next = await targetOf(source);
        const view = await baseFilesOf(next);
        if (alive) {
          setTarget(next);
          setBase(view);
        }
      } catch {
        if (alive) setBase(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [key]);

  const apply = useCallback((): void => {
    if (target === null || base === null || base.missing.length === 0) return;
    setBusy(true);
    setResult(null);
    void (async () => {
      try {
        setResult(await applyBaseTo(target, base, t.open.baseDenied));
        setBase(await baseFilesOf(target));
      } catch (error) {
        setResult({ kind: 'failed', detail: String(error) });
      } finally {
        setBusy(false);
      }
    })();
  }, [base, target, t]);

  if (base === null) return null;
  return <BasePanel base={base} busy={busy} onApply={apply} result={result} />;
}
