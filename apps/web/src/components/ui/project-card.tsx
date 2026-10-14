'use client';

import type { Manifest } from '@buildit/manifest';
import Link from 'next/link';
import { type ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import type { GenerationView } from '../../app/actions';
import { shareLinkBaseAction } from '../../app/actions-share';
import { encodeShareLink, shareOrigin } from '../../app/share/codec';
import { useLocale, useMessages } from '../../lib/i18n/provider';
import { formatBytes, formatDate, type StoredProject } from '../../lib/projects';
import { toast } from '../../lib/toasts';
import { Card, CardHead } from './card';
import { DisclosureButton } from './disclosure-button';
import { Icon, type IconName } from './icon';
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
 * - les **gestes** sont de deux sortes, et la frontière est celle de
 *   l'engagement. Les quatre gestes **courts** (architecture, graphe de
 *   dépendances, copie du lien GitHub, copie du lien de partage) sont en
 *   **icône seule** : à quatre, leurs libellés occupaient trois lignes de la
 *   carte, et ce qui ouvre vraiment le projet se perdait dedans. Le geste n'est
 *   pas perdu pour autant : chaque icône porte son `aria-label` (le nom lu par
 *   le lecteur d'écran) et son `title` (l'infobulle au survol), donc rien
 *   n'oblige à cliquer pour savoir ce qu'on clique. Les gestes **principaux**
 *   (ouvrir ou connecter GitHub, exporter, retirer, supprimer) gardent leur
 *   libellé : ils engagent le projet, et l'un d'eux efface des fichiers.
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

/** Le temps pendant lequel un bouton de copie reste « copié ». */
const COPY_FEEDBACK_MS = 1_600;

interface IconCopyButtonProps {
  /** Ce qui est copié, nommé pour le lecteur d'écran : « le lien GitHub ». */
  readonly what: string;
  /** Le libellé complet, pour l'infobulle. */
  readonly label: string;
  /** L'icône qui identifie la destination : un lien GitHub ou un lien de partage. */
  readonly icon: IconName;
  /**
   * Le texte à copier, **préparé au clic**.
   *
   * Le lien de partage ne peut pas être calculé au rendu : il dépend de
   * l'origine publique, que seul le serveur connaît (`shareLinkBaseAction`) et
   * qui n'arrive que par un appel asynchrone. Le préparer ici, c'est rendre le
   * bouton tout de suite utilisable, plutôt qu'un bouton grisé le temps d'un
   * aller-retour ou pire, un lien encodé sur `window.location.origin` qui ne
   * s'ouvrirait que sur cette machine.
   */
  readonly prepare: () => Promise<string> | string;
}

/**
 * Un bouton de copie en icône, posé dans la rangée des gestes.
 *
 * Il reprend le comportement de `CopyButton` (échange copier → coché, échec
 * dit) mais porte l'icône de ce qu'il copie : deux boutons marqués d'une même
 * icône de copie ne se distingueraient pas l'un de l'autre.
 */
function IconCopyButton({ what, label, icon, prepare }: IconCopyButtonProps): ReactElement {
  const t = useMessages();
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const copy = useCallback(async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(await prepare());
      setDone(true);
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(() => setDone(false), COPY_FEEDBACK_MS);
    } catch {
      toast(t.common.copyFailed, { kind: 'error' });
    }
  }, [t, prepare]);

  const accessible = done ? t.common.copied : t.a11y.copyWhat(what);

  return (
    <button
      aria-label={accessible}
      className="pf-btn pf-btn-ghost pf-btn-sm pf-btn-icon"
      onClick={() => void copy()}
      title={done ? t.common.copied : label}
      type="button"
    >
      <Icon name={done ? 'check' : icon} size={14} />
    </button>
  );
}

interface IconLinkProps {
  readonly href: string;
  /** Le nom accessible : sans lui, un lien en icône n'a **aucun** nom. */
  readonly label: string;
  /** L'infobulle : le libellé long, que la rangée dense ne peut plus porter. */
  readonly title: string;
  readonly icon: IconName;
}

/**
 * Un lien en icône seule, dans la rangée des gestes courts.
 *
 * `aria-label` et `title` reçoivent le même libellé : l'un est le nom du lien
 * pour le lecteur d'écran, l'autre la phrase que le survol affiche. Laisser
 * l'un des deux vide rendrait le geste muet pour qui n'a pas la souris.
 */
function IconLink({ href, label, title, icon }: IconLinkProps): ReactElement {
  return (
    <Link aria-label={label} className="pf-btn pf-btn-sm pf-btn-icon" href={href} title={title}>
      <Icon name={icon} size={14} />
    </Link>
  );
}

/** Le projet dont on dessine les gestes courts : ses liens et ses choix gardés. */
export interface ProjectGesturesProps {
  readonly project: StoredProject;
}

/**
 * Le lien de partage d'un projet : le manifest dans le fragment, l'origine
 * **publique** devant.
 *
 * L'origine du navigateur ne suffit pas : ouverte depuis `127.0.0.1`, elle
 * fabriquerait un lien qui ne s'ouvre que sur cette machine. Le serveur, lui,
 * connaît le nom sous lequel le site est réellement atteint ; c'est la même
 * règle que le plan du projet et l'écran Dépôt. Un échec de l'action n'empêche
 * pas de partager : on retombe alors sur l'origine locale.
 */
export async function projectShareLink(manifest: Manifest, currentOrigin: string): Promise<string> {
  const base = await shareLinkBaseAction().catch(() => '');
  return encodeShareLink(manifest, shareOrigin(base, currentOrigin));
}

/**
 * Les quatre gestes courts d'un projet, en icônes seules.
 *
 * Ils vivent dans un composant à part parce que **deux cartes** les portent :
 * la carte d'un projet enregistré, et la carte « projet terminé » de l'accueil,
 * qui retrouve le projet dans la liste pour lui emprunter son identifiant et
 * son manifest. Un second dessin de ces quatre icônes aurait divergé au premier
 * `aria-label` oublié.
 *
 * Chaque geste n'apparaît que si sa donnée existe : sans manifest gardé, rien
 * ne mène à l'architecture ni au graphe ; sans dépôt, rien à copier.
 */
export function ProjectGestures({ project }: ProjectGesturesProps): ReactElement {
  const t = useMessages();
  const repositoryUrl = project.repositoryUrl;
  const manifest = project.manifest;

  return (
    <>
      {repositoryUrl === undefined ? null : (
        <IconCopyButton
          icon="github"
          label={t.projects.copyGithubLink}
          prepare={() => repositoryUrl}
          what={t.projects.githubWhat}
        />
      )}
      {manifest === undefined ? null : (
        <IconCopyButton
          icon="link"
          label={t.projects.copyShareLink}
          prepare={() => projectShareLink(manifest, window.location.origin)}
          what={t.projects.shareWhat}
        />
      )}
      {manifest === undefined ? null : (
        <>
          <IconLink
            href={`/projects/architecture?id=${encodeURIComponent(project.id)}`}
            icon="folderTree"
            label={t.projects.architecture}
            title={t.projects.architecture}
          />
          {/* Le graphe de dépendances, comme dans le parcours : la route est
              dédiée, la carte ne fait que la pointer. */}
          <IconLink
            href={`/projects/graph?id=${encodeURIComponent(project.id)}`}
            icon="gitBranch"
            label={t.projects.graph}
            title={t.projects.graph}
          />
        </>
      )}
    </>
  );
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

      {/* Les gestes : les quatre courts en icônes seules (architecture,
          graphe, copies des liens), puis les principaux avec leur libellé. Ils
          passent à la ligne au lieu de déborder à 360 px. Un seul geste par
          destination : l'architecture, le graphe, GitHub (copier, ouvrir s'il
          existe, connecter sinon), l'export ; puis, en retrait, retirer et
          supprimer. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ProjectGestures project={project} />
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
