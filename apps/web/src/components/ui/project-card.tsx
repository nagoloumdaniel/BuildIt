'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';
import { useLocale, useMessages } from '../../lib/i18n/provider';
import { formatBytes, formatDate, type StoredProject } from '../../lib/projects';
import { Icon } from './icon';
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
   * Le re-téléchargement n'est proposé que si l'archive est **réellement** en
   * main (rapport de la session courante). Sans elle, le bouton promettrait un
   * fichier que rien ne peut produire : le geste disparaît plutôt que de
   * mentir.
   */
  readonly onRedownload?: (() => void) | undefined;
  /** Donné : la carte porte « Retirer de la liste » (écran Projets). */
  readonly onForget?: (() => void) | undefined;
}

export function ProjectCard({ project, onRedownload, onForget }: ProjectCardProps): ReactElement {
  const t = useMessages();
  const { locale } = useLocale();
  const shown = project.technologies.slice(0, MAX_TECH_LOGOS);
  const hidden = project.technologies.length - shown.length;

  return (
    <section className="pf-card pf-card-pad">
      <div className="pf-card-head">
        <div className="min-w-0">
          <h3 className="pf-title-sm flex min-w-0 items-center gap-2">
            <span aria-hidden="true" className="flex-none" style={{ color: 'var(--pf-accent)' }}>
              <Icon name="package" size={18} />
            </span>
            <span className="truncate">{project.name}</span>
          </h3>
        </div>
        <span className="pf-badge pf-badge-ok flex-none">
          <Icon name="check" size={11} />
          {t.projects.done}
        </span>
      </div>

      {/* Les mesures : une rangée de badges qui passe à la ligne plutôt qu'un
          tableau — à 360 px, trois colonnes de valeurs ne tiennent pas. */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="pf-badge" title={t.projects.generatedOn(formatDate(project.generatedAt, locale))}>
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
          prose, et il se coupe sur n'importe quel caractère — un chemin
          Windows n'a pas d'espace où revenir à la ligne. */}
      {project.directory === '' ? null : (
        <p className="pf-mono mt-2.5" style={{ color: 'var(--pf-muted)', wordBreak: 'break-all' }}>
          {project.directory}
        </p>
      )}

      {shown.length === 0 ? null : (
        <div
          aria-label={t.projects.techLabel}
          className="mt-3 flex flex-wrap items-center gap-1.5"
          role="group"
        >
          {shown.map((id) => (
            <TechIcon id={id} key={id} size={18} />
          ))}
          {hidden > 0 ? (
            <span className="pf-badge" title={t.projects.moreTech(hidden)}>
              +{hidden}
            </span>
          ) : null}
        </div>
      )}

      <p className="pf-hint mt-3">{t.projects.locked}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link className="pf-btn pf-btn-sm" href="/create/report">
          <Icon name="file" size={14} />
          {t.projects.report}
        </Link>
        <Link className="pf-btn pf-btn-sm" href="/repo">
          <Icon name="github" size={14} />
          {t.projects.connectGithub}
        </Link>
        {onRedownload === undefined ? null : (
          <button className="pf-btn pf-btn-sm" onClick={onRedownload} type="button">
            <Icon name="download" size={14} />
            {t.projects.download}
          </button>
        )}
        {onForget === undefined ? null : (
          <button className="pf-btn pf-btn-sm pf-btn-danger" onClick={onForget} type="button">
            <Icon name="trash" size={14} />
            {t.projects.forget}
          </button>
        )}
      </div>
    </section>
  );
}
