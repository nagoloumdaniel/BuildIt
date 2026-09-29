import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { usageError } from '../format.js';
import { EXIT, type ExitCode, type Io } from '../io.js';

export const KEY_USAGE = `Usage : pf key <set|status|clear>

  set     Enregistre la clé API LLM, lue sur l'entrée standard ou saisie masquée
          (echo "$CLE" | pf key set) — jamais en argument
  status  Dit si une clé est enregistrée, sans jamais l'afficher
  clear   Supprime la clé`;

const CREDENTIALS_FILE = 'credentials.json';

/**
 * Répertoire de configuration de l'utilisateur. `PF_CONFIG_DIR` d'abord (tests,
 * installations particulières), puis la convention du système.
 */
export function configDir(env: Io['env'], platform: NodeJS.Platform = process.platform): string {
  if (env['PF_CONFIG_DIR'] !== undefined && env['PF_CONFIG_DIR'] !== '') {
    return env['PF_CONFIG_DIR'];
  }
  if (platform === 'win32' && env['APPDATA'] !== undefined) {
    return join(env['APPDATA'], 'project-factory');
  }
  if (env['XDG_CONFIG_HOME'] !== undefined && env['XDG_CONFIG_HOME'] !== '') {
    return join(env['XDG_CONFIG_HOME'], 'project-factory');
  }
  return join(env['HOME'] ?? env['USERPROFILE'] ?? '.', '.config', 'project-factory');
}

interface Credentials {
  llmApiKey?: string;
}

async function readCredentials(path: string): Promise<Credentials> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
    return typeof parsed === 'object' && parsed !== null ? (parsed as Credentials) : {};
  } catch {
    return {};
  }
}

export async function key(args: readonly string[], io: Io): Promise<ExitCode> {
  const [action, ...extra] = args;
  const dir = configDir(io.env);
  const path = join(dir, CREDENTIALS_FILE);

  switch (action) {
    case 'set': {
      if (extra.length > 0) {
        // Une clé en argument reste dans l'historique du shell et dans `ps`.
        return usageError(
          io,
          'La clé ne se passe jamais en argument : elle resterait dans l’historique du shell.',
          'echo "$CLE" | pf key set — ou pf key set dans un terminal, saisie masquée.',
        );
      }
      const value = (
        io.interactive ? await io.prompter.secret('Clé API :') : await io.readStdin()
      ).trim();
      if (value === '') {
        return usageError(io, 'Clé vide : rien n’a été enregistré.');
      }
      await mkdir(dir, { recursive: true, mode: 0o700 });
      await writeFile(path, `${JSON.stringify({ llmApiKey: value }, null, 2)}\n`, { mode: 0o600 });
      // `mode` ne s'applique qu'à la création : un fichier plus ancien garde
      // ses droits, qu'on resserre.
      await chmod(path, 0o600);
      io.out(`✓ Clé enregistrée (${path}, lisible par vous seul).`);
      return EXIT.ok;
    }
    case 'status': {
      const credentials = await readCredentials(path);
      io.out(
        credentials.llmApiKey === undefined || credentials.llmApiKey === ''
          ? 'Clé API : non définie. pf key set pour l’enregistrer.'
          : `Clé API : définie (${path}).`,
      );
      return EXIT.ok;
    }
    case 'clear': {
      await rm(path, { force: true });
      io.out('✓ Clé supprimée.');
      return EXIT.ok;
    }
    case undefined:
    case '--help':
    case '-h':
      io.out(KEY_USAGE);
      return action === undefined ? EXIT.usage : EXIT.ok;
    default:
      return usageError(io, `Action inconnue : « ${action} ».`, KEY_USAGE);
  }
}
