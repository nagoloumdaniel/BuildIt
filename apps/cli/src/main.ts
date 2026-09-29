import { run } from './cli.js';
import { nodeIo } from './node-io.js';

// Sortie coupée par le lecteur (`pf template list | head`) : rien d'anormal,
// on s'arrête sans pile d'erreur.
for (const stream of [process.stdout, process.stderr]) {
  stream.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EPIPE') {
      process.exit(0);
    }
    throw error;
  });
}

process.exitCode = await run(process.argv.slice(2), nodeIo());
