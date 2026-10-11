import { basename, resolve as resolvePath } from 'node:path';
import { parseArgs } from 'node:util';
import { type Report, runDoctor } from '@buildit/doctor';
import { type Manifest, parseManifest } from '@buildit/manifest';
import { loadCatalogue, type Registry } from '@buildit/registry';
import { printIssues, usageError } from '../format.js';
import { EXIT, type ExitCode, type Io } from '../io.js';
import { applyFixes, fileSourceAt, findManifestFile, readFacts } from './doctor-model.js';

export const DOCTOR_USAGE: string = `Usage : pf doctor [dossier] [--fix] [--json]

Diagnostique un projet (§16) : un score de 0 à 100, un constat par point du
cahier des charges, et les corrections proposées. Ne modifie rien sans --fix,
et --fix n'écrase jamais un fichier existant.

  dossier   Racine du projet à analyser (défaut : dossier courant)
  --fix     Propose les corrections, puis les applique après confirmation
  --json    Rend le rapport en JSON, pour un outil

Code de sortie 1 si un constat est un échec : \`pf doctor\` s'utilise aussi
comme contrôle dans un pipeline.`;

/** Le symbole du constat, dans l'ordre du §16. */
function symbol(status: string): string {
  if (status === 'pass') {
    return '✓';
  }
  if (status === 'warn') {
    return '⚠';
  }
  if (status === 'fail') {
    return '✕';
  }
  return '–';
}

/**
 * Le rapport lisible. Le score et les constats viennent du moteur ; ce module
 * ne fait que les mettre en page — aucune règle, aucun calcul.
 */
export function formatReport(report: Report, title: string): string {
  const lines: string[] = [`${title} — santé du projet : ${report.score}/100`, ''];
  for (const entry of report.checks) {
    lines.push(`${symbol(entry.status)} ${entry.title} — ${entry.detail}`);
  }
  const fixes = report.open.filter((entry) => entry.fix !== undefined);
  if (fixes.length > 0) {
    lines.push('', 'Corrections proposées :');
    for (const [index, entry] of fixes.entries()) {
      lines.push(`${index + 1}. ${entry.fix?.reason ?? entry.title} → ${entry.fix?.path ?? ''}`);
    }
  }
  if (report.open.length === 0) {
    lines.push('', 'Rien à corriger.');
  } else {
    lines.push(
      '',
      `${report.open.length} point(s) ouvert(s) sur ${report.checks.length} constats.`,
    );
  }
  return lines.join('\n');
}

/**
 * `pf doctor` — le diagnostic d'un projet (§16).
 *
 * Un manifest présent mais invalide est une erreur, pas un silence : les
 * constats seraient faux sans lui.
 */
export async function doctor(args: readonly string[], io: Io): Promise<ExitCode> {
  const { values, positionals } = parseArgs({
    args: [...args],
    allowPositionals: true,
    options: {
      fix: { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    io.out(DOCTOR_USAGE);
    return EXIT.ok;
  }
  const [directory, ...extra] = positionals;
  if (extra.length > 0) {
    return usageError(io, 'Un seul dossier attendu.', DOCTOR_USAGE);
  }
  const root = resolvePath(io.cwd, directory ?? '.');
  const source = fileSourceAt(root);

  let registry: Registry | undefined;
  const catalogue = loadCatalogue();
  if (catalogue.ok) {
    registry = catalogue.value;
  } else {
    printIssues(io, catalogue.issues);
  }

  const manifestPath = await findManifestFile(source);
  let manifest: Manifest | undefined;
  if (manifestPath !== undefined) {
    const raw = await source.read(manifestPath);
    if (raw !== undefined) {
      const parsed = parseManifest(JSON.parse(raw) as unknown);
      if (!parsed.ok) {
        printIssues(io, parsed.issues);
        return EXIT.failure;
      }
      manifest = parsed.value;
    }
  }

  const facts = await readFacts(source, { manifest, registry, name: basename(root) });
  const report = runDoctor(facts, { nameOf: (id) => registry?.get(id)?.name });

  if (values.json) {
    io.out(
      JSON.stringify(
        {
          directory: root,
          manifest: manifestPath ?? null,
          score: report.score,
          checks: report.checks,
        },
        null,
        2,
      ),
    );
    return report.checks.some((entry) => entry.status === 'fail') ? EXIT.failure : EXIT.ok;
  }

  io.out(formatReport(report, facts.name));

  const fixable = values.fix ? report.open.filter((entry) => entry.fix !== undefined) : [];
  if (fixable.length > 0) {
    const plan = fixable.map((entry) => entry.fix).filter((fix) => fix !== undefined);
    io.out('');
    for (const fix of plan) {
      io.out(`✎ ${fix.action === 'create' ? 'créer' : 'compléter'} ${fix.path} — ${fix.reason}`);
    }
    const confirmed =
      io.interactive && (await io.prompter.confirm(`Appliquer ces ${plan.length} correction(s) ?`));
    if (!confirmed) {
      io.out('Rien n’a été écrit. Relancez avec --fix dans un terminal pour confirmer.');
    } else {
      const written = await applyFixes(plan, source);
      for (const path of written) {
        io.out(`✓ ${path} écrit.`);
      }
      const after = await readFacts(source, { manifest, registry, name: facts.name });
      io.out(
        `Score après correction : ${runDoctor(after, { nameOf: (id) => registry?.get(id)?.name }).score}/100.`,
      );
    }
  }

  return report.checks.some((entry) => entry.status === 'fail') ? EXIT.failure : EXIT.ok;
}
