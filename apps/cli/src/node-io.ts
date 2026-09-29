import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { nodeCommandRunner } from '@project-factory/exec';
import type { Choice, Io, Prompter } from './io.js';

/**
 * Questions posées dans le terminal, avec `node:readline` : aucune
 * dépendance pour un besoin que Node couvre.
 */
function terminalPrompter(): Prompter {
  async function ask(question: string, muted = false): Promise<string> {
    // Pour une saisie masquée, la sortie de readline est coupée pendant la
    // frappe : l'écho du terminal n'affiche rien de la valeur.
    let silent = false;
    const output = new Writable({
      write(chunk, _encoding, done) {
        if (!silent) {
          process.stdout.write(chunk);
        }
        done();
      },
    });
    const rl = createInterface({ input: process.stdin, output, terminal: true });
    try {
      const answer = rl.question(question);
      silent = muted;
      return (await answer).trim();
    } finally {
      rl.close();
      if (muted) {
        process.stdout.write('\n');
      }
    }
  }

  return {
    async select<T extends string>(message: string, choices: readonly Choice<T>[]): Promise<T> {
      process.stdout.write(`${message}\n`);
      choices.forEach((choice, index) => {
        const hint = choice.hint === undefined ? '' : ` — ${choice.hint}`;
        const mark = choice.disabled === true ? ' (indisponible)' : '';
        process.stdout.write(`  ${index + 1}. ${choice.label}${mark}${hint}\n`);
      });
      for (;;) {
        const picked = choices[Number(await ask('Votre choix : ')) - 1];
        if (picked !== undefined && picked.disabled !== true) {
          return picked.value;
        }
        process.stdout.write('Choix invalide, recommencez.\n');
      }
    },
    async text(message, validate) {
      for (;;) {
        const value = await ask(`${message} `);
        const problem = validate?.(value);
        if (problem === undefined) {
          return value;
        }
        process.stdout.write(`${problem}\n`);
      }
    },
    async confirm(message) {
      return /^(o|oui|y|yes)$/i.test(await ask(`${message} (o/N) `));
    },
    secret(message) {
      return ask(`${message} `, true);
    },
  };
}

export function nodeIo(): Io {
  return {
    out: (text) => process.stdout.write(text.endsWith('\n') ? text : `${text}\n`),
    err: (text) => process.stderr.write(text.endsWith('\n') ? text : `${text}\n`),
    cwd: process.cwd(),
    env: process.env,
    interactive: process.stdin.isTTY === true && process.stdout.isTTY === true,
    prompter: terminalPrompter(),
    async readStdin() {
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk as Buffer);
      }
      return Buffer.concat(chunks).toString('utf8');
    },
    runner: nodeCommandRunner,
    fetch: (input, init) => fetch(input, init),
    platform: process.platform,
    sleep: (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1000)),
  };
}
