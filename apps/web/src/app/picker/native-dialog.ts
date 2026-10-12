import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import { platform } from 'node:os';
import { isAbsolute, normalize } from 'node:path';

/**
 * L'explorateur de fichiers **de la machine**, ouvert depuis l'écran.
 *
 * Pourquoi côté serveur. Un navigateur ne rend jamais un chemin absolu : la
 * File System Access API donne une poignée opaque, `<input type="file"
 * webkitdirectory>` donne des chemins relatifs et copie les fichiers. Or ce
 * configurateur a besoin de `C:\projets\mon-projet` — un chemin que seul le
 * système sait produire. Comme l'interface tourne dans le **même processus que
 * le moteur, sur la machine de l'utilisateur** (`pf web`), ouvrir la boîte de
 * dialogue native côté serveur est exactement ce que le CLI ferait, et ça
 * remplace le champ « collez un chemin absolu » que personne ne veut remplir.
 *
 * Pourquoi jamais en hébergé. Sur un serveur distant, « l'explorateur » serait
 * celui de la machine du serveur, invisible au visiteur, et attendrait un clic
 * qui ne viendra pas. L'appelant vérifie `isHostedEnvironment()` et le code de
 * retour `unsupported` le dit à l'écran, qui retombe sur la saisie manuelle.
 *
 * Invariants tenus ici :
 * - **jamais de shell** : `spawn` sans `shell`, arguments passés en tableau ;
 * - aucune entrée utilisateur n'entre dans le script — seul un titre choisi
 *   dans une table figée, et un dossier de départ validé comme absolu ;
 * - une attente bornée : une boîte laissée ouverte ne retient pas la requête
 *   indéfiniment.
 */

export type DialogKind = 'folder' | 'file';

export type DialogOutcome =
  | { readonly ok: true; readonly path: string }
  /** L'utilisateur a fermé la boîte sans choisir. Ce n'est pas une panne. */
  | { readonly ok: false; readonly reason: 'cancelled' }
  /** Pas de bureau à qui parler : hébergement, conteneur, session sans écran. */
  | { readonly ok: false; readonly reason: 'unsupported' }
  | { readonly ok: false; readonly reason: 'failed' };

/** Le délai au-delà duquel on considère la boîte abandonnée : cinq minutes. */
const DIALOG_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Le script PowerShell de la boîte Windows.
 *
 * `-STA` est obligatoire : les boîtes de dialogue Windows Forms exigent un fil
 * en appartement cloisonné, et sans lui `ShowDialog` lève. Le formulaire
 * fantôme sert de propriétaire : sans lui, la boîte s'ouvre **derrière** le
 * navigateur et l'utilisateur croit que rien ne s'est passé.
 */
function windowsScript(kind: DialogKind, startAt: string | undefined): string {
  const start = startAt === undefined ? '' : startAt.replace(/'/g, "''");
  const owner = `
$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.ShowInTaskbar = $false
$owner.Opacity = 0
$owner.StartPosition = 'Manual'
$owner.Location = New-Object System.Drawing.Point(-3000, -3000)
$owner.Show()
`;
  const close = `
$owner.Close()
$owner.Dispose()
`;
  if (kind === 'file') {
    return `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
${owner}
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = 'BuildIt - choisir un fichier'
$dialog.Filter = 'Tous les fichiers (*.*)|*.*'
${start === '' ? '' : `if (Test-Path -LiteralPath '${start}') { $dialog.InitialDirectory = '${start}' }`}
$result = $dialog.ShowDialog($owner)
${close}
if ($result -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dialog.FileName) }
`;
  }
  return `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
${owner}
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = 'BuildIt - choisir un dossier'
$dialog.ShowNewFolderButton = $true
${start === '' ? '' : `if (Test-Path -LiteralPath '${start}') { $dialog.SelectedPath = '${start}' }`}
$result = $dialog.ShowDialog($owner)
${close}
if ($result -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dialog.SelectedPath) }
`;
}

/** Le script AppleScript de la boîte macOS. */
function macosScript(kind: DialogKind, startAt: string | undefined): string {
  const verb = kind === 'file' ? 'choose file' : 'choose folder';
  const prompt = kind === 'file' ? 'Choisir un fichier' : 'Choisir un dossier';
  const from =
    startAt === undefined ? '' : ` default location POSIX file "${startAt.replace(/"/g, '')}"`;
  return `try
  tell application "System Events" to activate
  set chosen to (${verb} with prompt "${prompt}"${from})
  return POSIX path of chosen
on error number -128
  return ""
end try`;
}

/** La commande et ses arguments, par système. `undefined` : pas de bureau. */
function dialogCommand(
  kind: DialogKind,
  startAt: string | undefined,
  system: string = platform(),
  env: Readonly<Record<string, string | undefined>> = process.env,
): { readonly file: string; readonly args: readonly string[] } | undefined {
  if (system === 'win32') {
    return {
      file: 'powershell.exe',
      args: [
        '-NoProfile',
        '-NonInteractive',
        '-STA',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        windowsScript(kind, startAt),
      ],
    };
  }
  if (system === 'darwin') {
    return { file: 'osascript', args: ['-e', macosScript(kind, startAt)] };
  }
  // Linux : un bureau est nécessaire. Sans `DISPLAY` ni `WAYLAND_DISPLAY`,
  // zenity échoue de toute façon — autant le dire tout de suite.
  if (env['DISPLAY'] === undefined && env['WAYLAND_DISPLAY'] === undefined) {
    return undefined;
  }
  const args = [
    '--file-selection',
    '--title',
    kind === 'file' ? 'BuildIt : choisir un fichier' : 'BuildIt : choisir un dossier',
  ];
  if (kind === 'folder') {
    args.push('--directory');
  }
  if (startAt !== undefined) {
    args.push('--filename', startAt.endsWith('/') ? startAt : `${startAt}/`);
  }
  return { file: 'zenity', args };
}

/** Un dossier de départ ne sert qu'à poser la boîte : absolu, ou rien. */
async function usableStart(startAt: unknown): Promise<string | undefined> {
  if (typeof startAt !== 'string' || startAt.trim() === '') {
    return undefined;
  }
  const value = normalize(startAt.trim());
  // biome-ignore lint/suspicious/noControlCharactersInRegex: c'est précisément ce qu'on refuse
  if (!isAbsolute(value) || /[\u0000-\u001f\u007f]/.test(value)) {
    return undefined;
  }
  try {
    return (await stat(value)).isDirectory() ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Ouvre la boîte native et rend le chemin choisi.
 *
 * Le chemin rendu n'est **pas** considéré comme sûr pour autant : il repart au
 * navigateur, qui le renverra au serveur dans une autre action, où
 * `resolveLocalDirectory` le validera comme n'importe quelle saisie. Cette
 * fonction ne court-circuite aucune vérification — elle remplace un clavier.
 */
export async function openNativeDialog(
  kind: DialogKind,
  startAt?: unknown,
): Promise<DialogOutcome> {
  const start = await usableStart(startAt);
  const command = dialogCommand(kind, start);
  if (command === undefined) {
    return { ok: false, reason: 'unsupported' };
  }

  return new Promise<DialogOutcome>((resolve) => {
    let settled = false;
    const finish = (outcome: DialogOutcome): void => {
      if (!settled) {
        settled = true;
        resolve(outcome);
      }
    };

    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(command.file, [...command.args], {
        // Jamais de shell : les arguments restent des arguments.
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: false,
      });
    } catch {
      finish({ ok: false, reason: 'unsupported' });
      return;
    }

    let out = '';
    child.stdout?.on('data', (chunk: Buffer) => {
      out += chunk.toString('utf8');
    });
    // La sortie d'erreur est lue pour ne pas remplir le tampon du tube, et
    // jetée : elle ne porte que du bruit de boîte de dialogue.
    child.stderr?.resume();

    const timer = setTimeout(() => {
      child.kill();
      finish({ ok: false, reason: 'cancelled' });
    }, DIALOG_TIMEOUT_MS);

    child.on('error', () => {
      clearTimeout(timer);
      finish({ ok: false, reason: 'unsupported' });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      const chosen = out.trim();
      if (chosen === '') {
        // zenity rend 1 à l'annulation, PowerShell et osascript rendent 0 avec
        // une sortie vide : dans les trois cas, personne n'a choisi.
        finish({ ok: false, reason: code === 0 || code === 1 ? 'cancelled' : 'failed' });
        return;
      }
      finish({ ok: true, path: normalize(chosen) });
    });
  });
}

export { dialogCommand };
