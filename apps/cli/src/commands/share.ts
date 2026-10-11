import { resolve as resolvePath } from 'node:path';
import { parseArgs } from 'node:util';
import { type Manifest, serializeManifest } from '@project-factory/manifest';
import { usageError } from '../format.js';
import { EXIT, type ExitCode, type Io } from '../io.js';
import { readManifestFile } from '../manifest-file.js';
import { DEFAULT_PORT } from './web.js';

export const SHARE_USAGE: string = `Usage : pf share <manifest.json> [--url <base>]

Imprime un lien de partage en lecture seule (§20) : le manifest est encodé dans
le fragment de l'URL, donc il n'est envoyé à aucun serveur. Le lien s'ouvre là
où tourne le configurateur (\`pf web\`).

  --url <base>   Origine du configurateur (défaut http://127.0.0.1:${DEFAULT_PORT})

Le fragment n'est jamais transmis au serveur : ni journal, ni requête, ni
cookie. Ce n'est pas le partage d'un dépôt GitHub — pour cela, \`pf repo create\`.`;

/** Le seul hôte que `pf web` sert (voir `commands/web.ts`). */
const HOST = '127.0.0.1';

/** Le chemin de la page de partage, identique à celui de l'UI web. */
const SHARE_PATH = '/share';

/**
 * La charge utile : `base64url(serializeManifest(manifest))`.
 *
 * C'est **le même calcul** que `encodeSharePayload` de l'UI
 * (`apps/web/src/app/share/codec.ts`). Les deux implémentations sont séparées à
 * dessein — le CLI n'empaquette pas l'application web —, et le format est tenu
 * par les deux suites de tests : chacune compare sa charge à un même littéral,
 * calculé indépendamment. Si l'une dérive, son test tombe.
 */
export function sharePayload(manifest: Manifest): string {
  return Buffer.from(serializeManifest(manifest), 'utf8').toString('base64url');
}

/** Le lien complet : l'origine du configurateur, puis `/share#<charge>`. */
export function shareLink(manifest: Manifest, base: string): string {
  return `${base.trim().replace(/\/+$/, '')}${SHARE_PATH}#${sharePayload(manifest)}`;
}

/**
 * L'origine retenue : celle du configurateur local par défaut, ou `--url`.
 *
 * Refusés : absence de schéma, schéma autre que `http`/`https`, chemin,
 * requête, fragment. Un lien qui ne s'ouvre nulle part vaut moins qu'une erreur
 * d'usage.
 */
export function shareBase(raw: string | undefined): string | undefined {
  if (raw === undefined) {
    return `http://${HOST}:${DEFAULT_PORT}`;
  }
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return undefined;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return undefined;
  }
  if ((url.pathname !== '' && url.pathname !== '/') || url.search !== '' || url.hash !== '') {
    return undefined;
  }
  return url.origin;
}

/**
 * `pf share` imprime le lien, **et rien d'autre** : une ligne sur la sortie
 * standard. Tout ce qui pourrait s'y ajouter (avertissement, rappel, résumé)
 * finirait recopié avec le lien par un script.
 */
export async function share(args: readonly string[], io: Io): Promise<ExitCode> {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: {
      url: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    io.out(SHARE_USAGE);
    return EXIT.ok;
  }
  if (positionals.length !== 1) {
    return usageError(
      io,
      positionals.length === 0 ? 'Manifest manquant.' : 'Un seul manifest attendu.',
      SHARE_USAGE,
    );
  }
  const base = shareBase(values.url);
  if (base === undefined) {
    return usageError(
      io,
      `Origine invalide : « ${values.url ?? ''} ».`,
      `pf share <manifest.json> --url http://${HOST}:${DEFAULT_PORT}`,
    );
  }
  const manifest = await readManifestFile(io, resolvePath(io.cwd, positionals[0] ?? ''));
  if (manifest === undefined) {
    return EXIT.failure;
  }
  io.out(shareLink(manifest, base));
  return EXIT.ok;
}
