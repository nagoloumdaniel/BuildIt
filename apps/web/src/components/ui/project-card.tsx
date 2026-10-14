'use client';

import type { Manifest } from '@buildit/manifest';
import Link from 'next/link';
import { type ReactElement, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteProjectAction,
  type GenerationView,
  openProjectFolderAction,
} from '../../app/actions';
import { deleteRepositoryAction } from '../../app/actions-node';
import { shareLinkBaseAction } from '../../app/actions-share';
import { encodeShareLink, shareOrigin } from '../../app/share/codec';
import type { Messages } from '../../lib/i18n/messages';
import { useLocale, useMessages } from '../../lib/i18n/provider';
import {
  browserProjectStorage,
  detachRepository,
  forgetProject,
  formatBytes,
  formatDate,
  type StoredProject,
} from '../../lib/projects';
import { toast } from '../../lib/toasts';
import { Card, CardHead } from './card';
import {
  ConfirmDeleteDialog,
  type DeleteTarget,
  type DeleteTargetId,
} from './confirm-delete-dialog';
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
 *   (ouvrir ou connecter GitHub, ouvrir le dossier, exporter, supprimer)
 *   gardent leur libellé : ils engagent le projet, et l'un d'eux efface des
 *   fichiers.
 *
 * Un seul geste destructeur, et il est **un** : la **poubelle rouge**, qui
 * ouvre une popup où l'on choisit *ce qui* disparaît la liste BuildIt, le
 * dépôt GitHub, le dossier local. La croix « Retirer de la liste » a été
 * retirée : deux gestes de retrait pour un seul besoin faisaient hésiter, et
 * la popup dit désormais lequel des deux on veut.
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
  /**
   * Appelé dès qu'une suppression a changé la **liste persistée** : le parent
   * relit `localStorage` au lieu de garder une copie qu'il croirait à jour. La
   * carte écrit elle-même (c'est le seul objet qui sait *quoi* supprimer), le
   * parent ne fait que rafraîchir ce qu'il affiche.
   */
  readonly onChanged?: (() => void) | undefined;
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

/**
 * Ce qu'une suppression de dépôt a laissé derrière elle.
 *
 * `gone` est traité **exactement** comme `deleted` : un dépôt déjà supprimé
 * côté GitHub laisse le projet dans le même état qu'une suppression d'ici, et
 * seule la phrase change. Les confondre dans deux flux différents aurait
 * produit deux comportements pour une seule situation.
 */
interface RepositoryState {
  readonly kind: 'deleted' | 'gone';
}

/**
 * Une étape à exécuter, déduite de la cible cochée : retirer la ligne de la
 * liste BuildIt (rien n'est effacé), supprimer le dépôt GitHub (le projet est
 * détaché quoi qu'il arrive), ou effacer le dossier sur le disque.
 */
export type ProjectDeleteStep =
  | { readonly kind: 'site' }
  | { readonly kind: 'repository'; readonly url: string; readonly id: string }
  | { readonly kind: 'local'; readonly directory: string };

/** Une ligne du compte rendu, déjà écrite dans la langue de l'utilisateur. */
interface StepLine {
  readonly key: string;
  readonly text: string;
}

/**
 * Le déroulé d'une suppression, cible par cible, dans l'ordre où les gestes
 * doivent partir.
 *
 * Fonction pure : c'est elle qui décide **ce qui est réellement exécuté**. Une
 * cible cochée dont la donnée manque (une adresse ou un dossier disparus entre
 * l'ouverture de la popup et la confirmation) n'entre pas dans le plan plutôt
 * que de lancer une action sur du vide.
 *
 * L'ordre compte : le site part en premier pour que la carte ait quitté la
 * liste pendant que le disque travaille, puis le dépôt (qui sera détaché dans
 * tous les cas, voir `RepositoryState`), puis le dossier.
 */
export function projectDeletePlan(
  project: StoredProject,
  selected: readonly DeleteTargetId[],
): readonly ProjectDeleteStep[] {
  const url = project.repositoryUrl;
  return [
    ...(selected.includes('site') ? [{ kind: 'site' } as const] : []),
    ...(selected.includes('github') && url !== undefined
      ? [{ kind: 'repository' as const, url, id: project.id }]
      : []),
    ...(selected.includes('local') && project.directory !== ''
      ? [{ kind: 'local' as const, directory: project.directory }]
      : []),
  ];
}

/**
 * Le suivi après suppression du dépôt : le projet est détaché, et la popup
 * propose de le reconnecter tout de suite.
 *
 * Rien n'est fait en silence : garder une adresse morte ferait échouer chaque
 * geste qui s'appuie dessus, et faire disparaître la carte cacherait que le
 * projet, lui, est toujours là. Le lien mène à `/repo`, le seul écran qui
 * **crée** un dépôt et y pousse le dossier.
 */
function RepositoryFollowUp({
  project,
  state,
  lines,
  t,
}: {
  readonly project: StoredProject;
  readonly state: RepositoryState;
  readonly lines: readonly StepLine[];
  readonly t: Messages;
}): ReactElement {
  const m = t.projects;
  const title = state.kind === 'gone' ? m.repositoryGoneTitle : m.repositoryDeletedTitle;
  const body = state.kind === 'gone' ? m.repositoryGoneBody : m.repositoryDeletedBody;

  return (
    <>
      <p className="pf-title-sm">{title}</p>
      <p className="pf-hint mt-1">{body}</p>
      {lines.length === 0 ? null : (
        <ul className="pf-steps-list mt-2">
          {lines.map((line) => (
            <li className="pf-steps-item" key={line.key}>
              <span className="pf-steps-index" aria-hidden="true">
                ·
              </span>
              <span>{line.text}</span>
            </li>
          ))}
        </ul>
      )}
      {/* Un projet téléchargé en ZIP n'a pas de copie locale : proposer de
          créer un dépôt n'aurait rien à pousser. On le dit, et on n'offre que
          la sortie. */}
      {project.directory === '' ? (
        <p className="pf-hint mt-2">{m.repositoryArchiveOnly}</p>
      ) : (
        <p className="mt-3">
          <Link className="pf-btn pf-btn-sm" href="/repo">
            <Icon name="github" size={14} />
            {m.repositoryConnect}
          </Link>
        </p>
      )}
    </>
  );
}

/**
 * Un projet détaché garde une carte : elle dit qu'il n'a plus de dépôt et
 * propose d'en connecter un. Sans cette phrase, le bouton « Connecter à
 * GitHub » réapparaîtrait sans expliquer pourquoi l'ancien lien a disparu.
 */
function DetachedNotice({ project }: { readonly project: StoredProject }): ReactElement | null {
  const t = useMessages();
  if (project.repositoryUrl !== undefined) {
    return null;
  }
  return (
    <p className="pf-hint mt-2">
      {project.directory === ''
        ? t.projects.repositoryArchiveOnly
        : t.projects.repositoryMissingBody}
    </p>
  );
}

/**
 * Les cibles réellement proposées pour un projet : **seulement** les
 * plateformes où il est présent.
 *
 * Le site toujours ; GitHub seulement s'il a une adresse ; le dossier local
 * seulement s'il a été écrit sur le disque. Un projet **téléchargé en ZIP** a
 * `directory === ''` : il n'a jamais eu de dossier ici, donc jamais d'option
 * locale. Proposer une cible absente ferait échouer la suppression après le
 * clic, ce qui est le pire moment pour l'apprendre.
 *
 * Fonction pure et exportée : c'est elle que les tests interrogent, plutôt que
 * de cliquer dans une popup pour découvrir la même liste.
 */
export function projectDeleteTargets(project: StoredProject, t: Messages): readonly DeleteTarget[] {
  const m = t.projects;
  return [
    { id: 'site', label: m.deleteTargetSite, note: m.deleteTargetSiteNote },
    ...(project.repositoryUrl === undefined
      ? []
      : [{ id: 'github' as const, label: m.deleteTargetGithub, note: m.deleteTargetGithubNote }]),
    ...(project.directory === ''
      ? []
      : [{ id: 'local' as const, label: m.deleteTargetLocal, note: m.deleteTargetLocalNote }]),
  ];
}

export function ProjectCard({ project, onExported, onChanged }: ProjectCardProps): ReactElement {
  const t = useMessages();
  const { locale } = useLocale();
  const [confirming, setConfirming] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [lines, setLines] = useState<readonly StepLine[]>([]);
  const [gone, setGone] = useState<RepositoryState | undefined>(undefined);
  const [step, setStep] = useState<'form' | 'result'>('form');
  const [opening, setOpening] = useState(false);
  const [refusal, setRefusal] = useState<string | undefined>(undefined);
  const manifest = project.manifest;
  const shown = project.technologies.slice(0, MAX_TECH_LOGOS);
  const hidden = project.technologies.length - shown.length;
  // Sans dossier, il n'y a rien à ouvrir : c'est le cas d'un projet téléchargé
  // en ZIP, où le navigateur a reçu l'archive et n'a jamais écrit de dossier.
  const openable = project.directory !== '';

  /**
   * Les cibles réellement proposées : **seulement** les plateformes où le
   * projet est présent (voir `projectDeleteTargets`). Le site toujours ;
   * GitHub s'il a une adresse ; le dossier local s'il a été écrit sur le
   * disque.
   */
  const targets = projectDeleteTargets(project, t);

  const open = useCallback(async (): Promise<void> => {
    setOpening(true);
    setRefusal(undefined);
    let message: string | undefined;
    try {
      const outcome = await openProjectFolderAction(project.directory);
      message = outcome.ok ? undefined : t.projects.openInExplorerRefusals[outcome.reason];
    } catch {
      // Une action qui ne répond pas est un échec d'ouverture, pas une carte
      // cassée : la phrase le dit, le reste de la carte continue de vivre.
      message = t.projects.openInExplorerFailed;
    }
    setOpening(false);
    setRefusal(message);
  }, [project.directory, t]);

  const remove = useCallback(
    async (selected: readonly DeleteTargetId[]): Promise<void> => {
      setBusy(true);
      setError(undefined);
      const done: StepLine[] = [];
      let repository: RepositoryState | undefined;
      let failure: string | undefined;

      // L'ordre et le contenu viennent du plan : une cible cochée dont la
      // donnée manque n'y figure pas.
      for (const step of projectDeletePlan(project, selected)) {
        if (step.kind === 'site') {
          // La copie locale est retirée tout de suite : c'est cette liste que
          // le parent relit, et l'oublier après coup ferait réapparaître la
          // carte.
          forgetProject(browserProjectStorage(), project.id);
          done.push({ key: 'site', text: t.projects.deletedSite });
          continue;
        }

        if (step.kind === 'repository') {
          try {
            const outcome = await deleteRepositoryAction(step.url);
            // `gone` est un succès : le dépôt n'est plus là, c'est tout ce que
            // la suppression d'ici aurait obtenu.
            detachRepository(browserProjectStorage(), step.id);
            repository = { kind: outcome.ok ? outcome.status : 'gone' };
            if (outcome.ok) {
              done.push({ key: 'github', text: t.projects.deletedRepository });
            } else {
              failure = t.projects.repositoryFailed(project.name);
            }
          } catch {
            // L'action ne répond pas : l'adresse est peut-être encore vivante,
            // mais rien ne permet de le vérifier. On détache pour ne pas garder
            // un lien sur lequel l'application ne peut plus agir.
            detachRepository(browserProjectStorage(), step.id);
            repository = { kind: 'gone' };
            failure = t.projects.repositoryFailed(project.name);
          }
          continue;
        }

        try {
          const outcome = await deleteProjectAction(step.directory);
          if (outcome.ok) {
            done.push({ key: 'local', text: t.projects.deletedLocal });
          } else {
            failure = t.projects.deleteFailed(outcome.issues.join(' '));
          }
        } catch {
          failure = t.projects.deleteFailed(t.errors.offline);
        }
      }

      setLines(done);
      setGone(repository);
      setError(failure);
      setBusy(false);
      setStep('result');
      onChanged?.();
    },
    [onChanged, project, t],
  );

  const closed = (): void => {
    setConfirming(false);
    setStep('form');
    setLines([]);
    setGone(undefined);
    setError(undefined);
  };

  /**
   * Le suivi après une suppression GitHub. Un projet **détaché** — plus
   * d'adresse, ou adresse qui vient d'être retirée — porte le même message
   * hors de la popup : la carte ne doit pas sembler avoir perdu son dépôt sans
   * raison.
   */
  const result: ReactNode =
    step === 'form' ? undefined : (
      <>
        {gone === undefined ? null : (
          <RepositoryFollowUp lines={lines} project={project} state={gone} t={t} />
        )}
        {gone === undefined && lines.length > 0 ? (
          <ul className="pf-steps-list">
            {lines.map((line) => (
              <li className="pf-steps-item" key={line.key}>
                <span className="pf-steps-index" aria-hidden="true">
                  ·
                </span>
                <span>{line.text}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {error === undefined ? null : (
          <p className="pf-error mt-2" role="status">
            {error}
          </p>
        )}
      </>
    );

  return (
    <Card>
      <CardHead icon="package" title={<span className="truncate">{project.name}</span>} />

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
          existe, connecter sinon), l'explorateur, l'export ; puis, à part, la
          poubelle, qui est le seul geste destructeur. */}
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
        {!openable ? null : (
          <button
            aria-label={t.projects.openInExplorerLabel(project.directory)}
            className="pf-btn pf-btn-sm pf-btn-icon"
            disabled={opening}
            onClick={() => void open()}
            title={t.projects.openInExplorer}
            type="button"
          >
            <Icon name="folderOpen" size={14} />
          </button>
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
        <button
          aria-label={t.projects.delete}
          className="pf-btn pf-btn-sm pf-btn-danger pf-btn-icon"
          disabled={busy}
          onClick={() => setConfirming(true)}
          title={t.projects.delete}
          type="button"
        >
          <Icon name="trash" size={14} />
        </button>
      </div>

      <DetachedNotice project={project} />

      {/* Le refus d'ouvrir l'explorateur ne casse pas la carte : la phrase se
          pose sous les gestes, et le reste continue de fonctionner. */}
      {refusal === undefined ? null : (
        <p className="pf-hint mt-2" role="status">
          {refusal}
        </p>
      )}

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

      {/* La popup n'est montée que lorsqu'elle est demandée : `<dialog>` doit
          être dans le document avant `showModal()`, et un `renderToStaticMarkup`
          n'a pas de document. Le composant ne s'ouvre donc jamais tout seul. */}
      {!confirming ? null : (
        <ConfirmDeleteDialog
          busy={busy}
          busyLabel={t.projects.deleteWorking}
          cancelLabel={t.common.cancel}
          closeLabel={t.common.close}
          confirmLabel={t.projects.deleteChoicesAction}
          description={t.projects.deleteChoicesBody}
          error={error}
          onClose={closed}
          onConfirm={(selection) => void remove(selection)}
          result={result}
          targets={targets}
          title={t.projects.deleteChoicesTitle(project.name)}
        />
      )}
    </Card>
  );
}
