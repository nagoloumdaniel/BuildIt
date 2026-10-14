'use client';

import Link from 'next/link';
import { type ReactElement, useState } from 'react';
import type { GenerationView } from '../../app/actions';
import { useLocale, useMessages } from '../../lib/i18n/provider';
import { formatBytes, formatDate, type StoredProject } from '../../lib/projects';
import { Card, CardHead } from './card';
import { CopyButton } from './copy';
import { DisclosureButton } from './disclosure-button';
import { Icon } from './icon';
import { ProgressBar } from './loading';
import { ProjectExport } from './project-export';
import { TechIcon } from './tech-icon';

/**
 * La carte d'un projet déjà généré.
 *
 * Elle existe comme composant partagé parce que le tableau de bord et l'écran
 * « Tous les projets » montrent **la même chose** : deux dessins pour un seul
 * objet auraient divergé au premier ajustement, et l'utilisateur aurait appris
 * deux fois la même lecture.
 *
 * Trois registres, et c'est volontaire :
 * - le **nom** est de la prose (Inter), c'est ce qu'on cherche du regard ;
 * - la **mesure** (date, nombre de fichiers, poids) est en chasse fixe : ce
 *   sont des valeurs, et la famille le dit mieux qu'une étiquette ;
 * - les **gestes** portent icône *et* libellé. Une rangée d'icônes nues
 *   obligerait à survoler pour savoir laquelle télécharge et laquelle oublie —
 *   sur un geste destructif, c'est inacceptable.
 *
 * Elle lit la langue par les hooks plutôt que par des props : hors fournisseur
 * (rendu statique d'un test), `useMessages`/`useLocale` rendent le français,
 * donc la carte reste vérifiable sans monter l'arbre complet.
 */

/**
 * Au-delà, les logos deviennent une frise illisible et poussent les gestes
 * hors de la carte sur un écran de 360 px. Le reste est compté, pas caché.
 */
export const MAX_TECH_LOGOS = 6;

export interface ProjectCardProps {
  readonly project: StoredProject;
  /**
   * Une sortie réussie depuis la carte (archive ou dossier). Absent : la carte
   * ne propose pas l'export c'est le cas de l'accueil, qui montre les deux
   * derniers projets sans multiplier les gestes.
   */
  readonly onExported?: ((result: GenerationView) => void) | undefined;
  /** Donné : la carte porte « Retirer de la liste » (écran Projets). */
  readonly onForget?: (() => void) | undefined;
  /**
   * Donné : la carte porte la **suppression du dossier**. Deux gestes distincts
   * et nommés comme tels : retirer de la liste n'efface rien, supprimer efface
   * tout. Les confondre sous un seul bouton « Supprimer » ferait perdre des
   * fichiers à qui voulait seulement ranger sa liste.
   */
  readonly onDelete?: (() => void) | undefined;
  /** La suppression est partie et le disque travaille. */
  readonly deleting?: boolean;
}

export function ProjectCard({
  project,
  onExported,
  onForget,
  onDelete,
  deleting = false,
}: ProjectCardProps): ReactElement {
  const t = useMessages();
  const { locale } = useLocale();
  const [confirming, setConfirming] = useState(false);
  const [exporting, setExporting] = useState(false);
  const manifest = project.manifest;
  const shown = project.technologies.slice(0, MAX_TECH_LOGOS);
  const hidden = project.technologies.length - shown.length;
  // Sans dossier (mode hébergé : rien n'a été écrit), il n'y a rien à
  // supprimer : le geste disparaît plutôt que d'échouer après le clic.
  const deletable = onDelete !== undefined && project.directory !== '';

  return (
    <Card>
      <CardHead
        icon="package"
        title={<span className="truncate">{project.name}</span>}
        actions={
          <span className="pf-badge pf-badge-ok flex-none">
            <Icon name="check" size={11} />
            {t.projects.done}
          </span>
        }
      />

      {/* Les mesures : une rangée de badges qui passe à la ligne plutôt qu'un
          tableau à 360 px, trois colonnes de valeurs ne tiennent pas. */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span
          className="pf-badge"
          title={t.projects.generatedOn(formatDate(project.generatedAt, locale))}
        >
          <Icon name="clock" size={11} />
          {formatDate(project.generatedAt, locale)}
        </span>
        <span className="pf-badge">
          <Icon name="file" size={11} />
          {t.projects.files(project.fileCount)}
        </span>
        <span className="pf-badge" title={t.projects.sizeOf(formatBytes(project.bytes, locale))}>
          <Icon name="database" size={11} />
          {formatBytes(project.bytes, locale)}
        </span>
      </div>

      {/* Le dossier est une donnée technique : il n'est ni traduit ni mis en
          prose, et il se coupe sur n'importe quel caractère un chemin
          Windows n'a pas d'espace où revenir à la ligne. */}
      {project.directory === '' ? null : (
        <div className="mt-2.5 flex items-start gap-1">
          <p
            className="pf-mono min-w-0 flex-1"
            style={{ color: 'var(--pf-muted)', lineHeight: '1.75rem', wordBreak: 'break-all' }}
          >
            {project.directory}
          </p>
          <CopyButton value={project.directory} what={t.projects.pathWhat} />
        </div>
      )}

      {/* Les logos sont une **liste** : chacun est un élément, et le compte
          des technologies masquées en est un aussi. Le nom accessible vient de
          la langue courante. */}
      {shown.length === 0 ? null : (
        <ul
          aria-label={t.projects.techLabel}
          className="m-0 mt-3 flex list-none flex-wrap items-center gap-1.5 p-0"
        >
          {shown.map((id) => (
            <li key={id}>
              <TechIcon id={id} size={18} />
            </li>
          ))}
          {hidden > 0 ? (
            <li>
              <span className="pf-badge" title={t.projects.moreTech(hidden)}>
                +{hidden}
              </span>
            </li>
          ) : null}
        </ul>
      )}

      <p className="pf-hint mt-3">{t.projects.locked}</p>

      {/* Les gestes : tous de la même taille, icône **et** libellé, et ils
          passent à la ligne au lieu de déborder à 360 px. Un seul geste par
          destination : l'architecture, GitHub (ouvrir s'il existe, connecter
          sinon), l'export ; puis, en retrait, retirer et supprimer. */}
      {manifest === undefined ? <p className="pf-hint mt-3">{t.projects.legacy}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {manifest === undefined ? null : (
          <Link
            className="pf-btn pf-btn-sm"
            href={`/projects/architecture?id=${encodeURIComponent(project.id)}`}
          >
            <Icon name="folderTree" size={14} />
            {t.projects.architecture}
          </Link>
        )}
        {project.repositoryUrl === undefined ? (
          project.directory === '' ? null : (
            <Link className="pf-btn pf-btn-sm" href="/repo">
              <Icon name="github" size={14} />
              {t.projects.connectGithub}
            </Link>
          )
        ) : (
          <a
            className="pf-btn pf-btn-sm"
            href={project.repositoryUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <Icon name="github" size={14} />
            {t.projects.openGithub}
            <Icon name="externalLink" size={12} />
          </a>
        )}
        {manifest === undefined || onExported === undefined ? null : (
          <DisclosureButton
            className="pf-btn-sm"
            expanded={exporting}
            lessLabel={t.projects.exportLess}
            moreLabel={t.projects.exportMore}
            onToggle={() => setExporting((value) => !value)}
          />
        )}
        {onForget === undefined ? null : (
          <button className="pf-btn pf-btn-sm" onClick={onForget} type="button">
            <Icon name="close" size={14} />
            {t.projects.forget}
          </button>
        )}
        {!deletable ? null : (
          <button
            className="pf-btn pf-btn-sm pf-btn-danger"
            disabled={deleting || confirming}
            onClick={() => setConfirming(true)}
            type="button"
          >
            <Icon name="trash" size={14} />
            {t.projects.delete}
          </button>
        )}
      </div>

      {exporting && manifest !== undefined && onExported !== undefined ? (
        <div className="pf-card-progress">
          <ProjectExport
            initiallyOpen
            manifest={manifest}
            onGenerated={onExported}
            projectName={project.name}
          />
        </div>
      ) : null}

      {/* La confirmation reste **dans** la carte : on voit encore le nom et le
          dossier qu'on s'apprête à effacer, ce qu'une fenêtre modale cacherait
          justement au moment où il faut le lire. */}
      {deleting ? (
        <div className="pf-card-progress">
          <ProgressBar label={t.projects.deleting} />
          <p className="pf-hint mt-1.5">{t.projects.deleting}</p>
        </div>
      ) : confirming && deletable ? (
        <div className="pf-card-progress" role="alert">
          <p className="pf-title-sm flex items-center gap-2">
            <span aria-hidden="true" style={{ color: 'var(--pf-danger)' }}>
              <Icon name="warning" size={16} />
            </span>
            {t.projects.deleteConfirmTitle}
          </p>
          <p className="pf-hint mt-1">{t.projects.deleteConfirmBody}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              className="pf-btn pf-btn-sm pf-btn-danger"
              onClick={() => {
                setConfirming(false);
                onDelete?.();
              }}
              type="button"
            >
              <Icon name="trash" size={14} />
              {t.projects.deleteConfirmAction}
            </button>
            <button
              className="pf-btn pf-btn-sm pf-btn-ghost"
              onClick={() => setConfirming(false)}
              type="button"
            >
              <Icon name="close" size={14} />
              {t.common.cancel}
            </button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
