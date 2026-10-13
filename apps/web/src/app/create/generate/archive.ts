import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateProject } from '@buildit/generator';
import type { Manifest } from '@buildit/manifest';
import { createZip } from '../../../lib/zip';
import type { GenerationView } from '../../actions';

/**
 * Le projet entier, en archive `.zip` — **une seule** implémentation pour les
 * deux modes.
 *
 * En hébergé, c'est la seule sortie possible : rien ne peut être écrit sur la
 * machine du visiteur. En local, c'est une sortie au choix, à côté du dossier.
 * Dans les deux cas le projet est écrit dans un répertoire temporaire **isolé
 * par requête** (`mkdtemp` dans `os.tmpdir()`), lu, archivé, puis supprimé :
 * jamais d'écriture dans un dossier partagé entre visiteurs, rien qui reste
 * après la réponse.
 *
 * `directory` est vide : il n'y a aucun dossier à montrer, le répertoire
 * temporaire a disparu au retour, et c'est le navigateur qui choisit où
 * l'archive atterrit.
 */
export async function generateArchive(manifest: Manifest): Promise<GenerationView> {
  const tmpRoot = await mkdtemp(join(tmpdir(), 'buildit-hosted-'));
  const directory = join(tmpRoot, manifest.name);
  try {
    const result = await generateProject(manifest, directory);
    if (!result.ok) {
      return {
        ok: false,
        directory: '',
        files: [],
        bytes: 0,
        warnings: [],
        steps: result.completedSteps,
        issues: result.issues.map((issue) => issue.message),
      };
    }
    const entries = await Promise.all(
      result.value.report.written.map(async (file) => ({
        // Le dossier du projet en tête d'archive : décompresser donne
        // `mon-projet/…`, pas vingt fichiers éparpillés dans Téléchargements.
        path: `${manifest.name}/${file}`,
        data: await readFile(join(directory, ...file.split('/'))),
      })),
    );
    return {
      ok: true,
      directory: '',
      files: result.value.report.written,
      bytes: result.value.report.bytes,
      warnings: result.value.warnings.map((warning) => warning.message),
      steps: result.value.completedSteps,
      issues: [],
      zipBase64: createZip(entries).toString('base64'),
    };
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

/** Un fichier du projet, tel que le navigateur l'écrira : chemin relatif et contenu. */
export interface GeneratedFile {
  readonly path: string;
  readonly base64: string;
}

export interface GeneratedFilesView {
  readonly ok: boolean;
  readonly files: readonly GeneratedFile[];
  readonly bytes: number;
  readonly warnings: readonly string[];
  readonly issues: readonly string[];
}

/**
 * Les fichiers du projet, pour que **le navigateur** les écrive.
 *
 * En hébergé, le serveur n'a aucun accès au disque de l'utilisateur. Le
 * navigateur, lui, peut écrire dans un dossier que l'utilisateur vient de
 * désigner (File System Access API). Le serveur génère donc dans un dossier
 * temporaire isolé, comme pour l'archive, et rend les fichiers un par un au
 * lieu de les compresser : le navigateur n'a pas à décompresser, et il peut
 * compter réellement ce qu'il a écrit.
 */
export async function generateFiles(manifest: Manifest): Promise<GeneratedFilesView> {
  const tmpRoot = await mkdtemp(join(tmpdir(), 'buildit-files-'));
  const directory = join(tmpRoot, manifest.name);
  try {
    const result = await generateProject(manifest, directory);
    if (!result.ok) {
      return {
        ok: false,
        files: [],
        bytes: 0,
        warnings: [],
        issues: result.issues.map((issue) => issue.message),
      };
    }
    const files = await Promise.all(
      result.value.report.written.map(async (file) => ({
        path: file,
        base64: (await readFile(join(directory, ...file.split('/')))).toString('base64'),
      })),
    );
    return {
      ok: true,
      files,
      bytes: result.value.report.bytes,
      warnings: result.value.warnings.map((warning) => warning.message),
      issues: [],
    };
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}
