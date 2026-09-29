// Le binaire publié embarque le moteur (tsdown, `noExternal`). Le generator y
// cherche ses templates à `../templates` de son code — soit, une fois
// empaqueté, `apps/cli/templates`. On les y recopie à chaque construction.
import { cp, rm } from 'node:fs/promises';

const from = new URL('../../../packages/generator/templates/', import.meta.url);
const to = new URL('../templates/', import.meta.url);

await rm(to, { recursive: true, force: true });
await cp(from, to, { recursive: true });
