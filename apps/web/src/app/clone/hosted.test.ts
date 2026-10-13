import { describe, expect, it } from 'vitest';
import type { ArchiveFetch } from '../../lib/clone-archive';
import { buildZip } from '../../lib/clone-zip.fixture';
import {
  downloadError,
  extractError,
  hostedResponse,
  planHostedCopy,
  readHostedRequest,
  statusOf,
} from './hosted';
import { type HostedEvent, parseHostedEvent } from './hosted-protocol';

/**
 * La copie hébergée côté serveur : validation, refus avec leur statut, et le
 * flux des fichiers, contre un faux GitHub.
 */

const TOKEN = 'gho_hosted_0123456789abcdef';
const LIMITS = {
  maxArchiveBytes: 1024 * 1024,
  maxFiles: 50,
  maxTotalBytes: 100_000,
  maxFileBytes: 50_000,
};

const REPO = buildZip([
  { name: 'octo-hello-1a2b/' },
  { name: 'octo-hello-1a2b/package.json', data: '{"name":"hello"}' },
  { name: 'octo-hello-1a2b/pnpm-lock.yaml', data: 'lockfileVersion: 9' },
  { name: 'octo-hello-1a2b/src/index.ts', data: 'export const x = 1;\n' },
  { name: 'octo-hello-1a2b/aux.txt', data: 'windows refuse' },
]);

function github(
  body: Buffer | null,
  init: ResponseInit = {},
): {
  readonly fetch: ArchiveFetch;
  readonly urls: string[];
  readonly headers: Record<string, string>[];
} {
  const urls: string[] = [];
  const headers: Record<string, string>[] = [];
  return {
    urls,
    headers,
    fetch: async (url, request) => {
      urls.push(url);
      headers.push(request.headers as Record<string, string>);
      return new Response(body === null ? null : new Uint8Array(body), init);
    },
  };
}

async function events(response: Response): Promise<HostedEvent[]> {
  const text = await response.text();
  return text
    .split('\n')
    .map((line) => parseHostedEvent(line))
    .filter((event): event is HostedEvent => event !== undefined && event !== 'malformed');
}

describe('readHostedRequest', () => {
  it('ne lit que les trois actions connues', () => {
    expect(readHostedRequest({ action: 'files', link: 'o/r', folder: 'r' })).toEqual({
      action: 'files',
      link: 'o/r',
      folder: 'r',
    });
    expect(readHostedRequest({ action: 'zip', link: 3 })).toEqual({
      action: 'zip',
      link: '',
      folder: '',
    });
    expect(readHostedRequest({ action: 'rm' })).toBeUndefined();
    expect(readHostedRequest(null)).toBeUndefined();
    expect(readHostedRequest([])).toBeUndefined();
  });
});

describe('planHostedCopy', () => {
  it('reconnaît un dépôt GitHub et propose son nom comme dossier', () => {
    const plan = planHostedCopy('https://github.com/octo/hello', '');
    expect(plan.github).toEqual({ owner: 'octo', repo: 'hello' });
    expect(plan.view).toEqual({
      ok: true,
      label: 'octo/hello',
      url: 'https://github.com/octo/hello',
      folder: 'hello',
      github: true,
      issues: [],
    });
    expect(planHostedCopy('git@github.com:octo/hello.git', ' mon-dossier ').view.folder).toBe(
      'mon-dossier',
    );
  });

  it('refuse un lien invalide avec le refus du moteur', () => {
    const plan = planHostedCopy('--upload-pack=evil', '');
    expect(plan.view).toMatchObject({ ok: false, error: { code: 'link' } });
    expect(plan.view.issues.length).toBeGreaterThan(0);
    expect(plan.github).toBeUndefined();
  });

  it('dit qu’un lien hors GitHub ne se copie qu’avec git, sur la machine', () => {
    const plan = planHostedCopy('https://gitlab.com/team/app.git', '');
    expect(plan.view).toMatchObject({
      ok: false,
      github: false,
      label: 'https://gitlab.com/team/app.git',
      url: 'https://gitlab.com/team/app.git',
      folder: 'app',
      error: { code: 'notGithub' },
    });
  });

  it('refuse un nom de dossier qui n’est pas un seul segment simple', () => {
    for (const folder of ['../x', 'a/b', 'C:\\x', '..']) {
      expect(planHostedCopy('octo/hello', folder).view.error, folder).toEqual({ code: 'folder' });
    }
  });
});

describe('les refus, en vocabulaire d’écran', () => {
  it('traduit l’ouverture et l’extraction, et choisit le statut HTTP', () => {
    expect(downloadError({ code: 'http', status: 500 })).toEqual({ code: 'http', status: 500 });
    expect(downloadError({ code: 'cancelled' })).toEqual({ code: 'network' });
    expect(downloadError({ code: 'notFound' })).toEqual({ code: 'notFound' });

    expect(extractError({ reason: 'tooManyFiles' }, LIMITS)).toEqual({
      code: 'tooManyFiles',
      limit: 50,
    });
    expect(extractError({ reason: 'tooLarge' }, LIMITS)).toEqual({
      code: 'tooLarge',
      limit: 100_000,
    });
    expect(extractError({ reason: 'fileTooLarge', detail: 'gros' }, LIMITS)).toEqual({
      code: 'fileTooLarge',
      limit: 50_000,
      detail: 'gros',
    });
    expect(extractError({ reason: 'unsafePath', detail: '../x' }, LIMITS)).toEqual({
      code: 'unsafePath',
      detail: '../x',
    });
    expect(extractError({ reason: 'corrupt' }, LIMITS)).toEqual({ code: 'corrupt' });
    expect(extractError({ reason: 'encrypted', detail: 'x' }, LIMITS)).toEqual({
      code: 'unsupported',
      detail: 'encrypted',
    });

    expect(statusOf({ code: 'notFound' })).toBe(404);
    expect(statusOf({ code: 'unauthorized' })).toBe(401);
    expect(statusOf({ code: 'rateLimited' })).toBe(429);
    expect(statusOf({ code: 'archiveTooLarge' })).toBe(413);
    expect(statusOf({ code: 'notGithub' })).toBe(422);
    expect(statusOf({ code: 'network' })).toBe(502);
  });
});

describe('hostedResponse — vérification et refus avant le flux', () => {
  it('rend le plan en JSON, sans toucher à GitHub', async () => {
    const fake = github(REPO);
    const response = await hostedResponse(
      { action: 'plan', link: 'octo/hello', folder: '' },
      { fetch: fake.fetch },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, label: 'octo/hello' });
    expect(fake.urls).toEqual([]);
  });

  it('refuse une action inconnue, un lien hors GitHub, un dossier invalide', async () => {
    const unknown = await hostedResponse({ action: 'shell' });
    expect(unknown.status).toBe(422);
    expect(await unknown.json()).toEqual({ error: { code: 'link', detail: 'action' } });

    const gitlab = await hostedResponse({ action: 'files', link: 'https://gitlab.com/a/b' });
    expect(gitlab.status).toBe(422);
    expect(await gitlab.json()).toEqual({ error: { code: 'notGithub' } });

    const folder = await hostedResponse({ action: 'zip', link: 'octo/hello', folder: '../x' });
    expect(await folder.json()).toEqual({ error: { code: 'folder' } });

    const link = await hostedResponse({ action: 'zip', link: '' });
    expect(await link.json()).toEqual({ error: { code: 'link' } });
  });

  it('rend le refus de GitHub avec son statut, et le jeton ne sort jamais', async () => {
    const fake = github(null, { status: 404 });
    const response = await hostedResponse(
      { action: 'files', link: 'octo/private' },
      { fetch: fake.fetch, token: TOKEN },
    );
    expect(response.status).toBe(404);
    const text = await response.text();
    expect(text).toBe(JSON.stringify({ error: { code: 'notFound' } }));
    expect(text).not.toContain(TOKEN);
    expect(fake.urls).toEqual(['https://api.github.com/repos/octo/private/zipball']);
    expect(fake.headers[0]?.['authorization']).toBe(`Bearer ${TOKEN}`);
  });
});

describe('hostedResponse — le flux des fichiers', () => {
  it('annonce le manifeste, envoie chaque fichier, et finit par `done`', async () => {
    const fake = github(REPO);
    const response = await hostedResponse(
      { action: 'files', link: 'octo/hello', folder: 'hello' },
      { fetch: fake.fetch, token: TOKEN, limits: LIMITS },
    );
    expect(response.headers.get('content-type')).toContain('application/x-ndjson');
    const list = await events(response);

    expect(list[0]).toEqual({ type: 'download', received: REPO.length });
    expect(list[1]).toMatchObject({
      type: 'manifest',
      total: 3,
      skipped: ['aux.txt'],
      symlinks: [],
      installCommand: 'pnpm install',
      project: { packageManager: 'pnpm', directory: 'hello' },
    });
    const files = list.filter((event) => event.type === 'file');
    expect(files.map((event) => event.type === 'file' && event.path)).toEqual([
      'package.json',
      'pnpm-lock.yaml',
      'src/index.ts',
    ]);
    const index = files[2];
    expect(index?.type === 'file' && Buffer.from(index.data, 'base64').toString('utf8')).toBe(
      'export const x = 1;\n',
    );
    expect(list.at(-1)).toEqual({ type: 'done', sent: 3 });
  });

  it('pousse les octets reçus pendant un long téléchargement', async () => {
    const big = buildZip([{ name: 'r/big.bin', data: Buffer.alloc(600 * 1024, 7), method: 0 }]);
    const list = await events(
      await hostedResponse(
        { action: 'files', link: 'octo/big' },
        {
          fetch: github(big).fetch,
          limits: { ...LIMITS, maxFileBytes: 1024 * 1024, maxTotalBytes: 1024 * 1024 },
        },
      ),
    );
    const downloads = list.filter((event) => event.type === 'download');
    expect(downloads.length).toBeGreaterThan(1);
    expect(list.at(-1)).toEqual({ type: 'done', sent: 1 });
  });

  it('sans projet reconnu, n’invente aucune commande', async () => {
    const list = await events(
      await hostedResponse(
        { action: 'files', link: 'octo/notes' },
        { fetch: github(buildZip([{ name: 'r/notes.md', data: '# notes' }])).fetch },
      ),
    );
    const manifest = list.find((event) => event.type === 'manifest');
    expect(manifest).not.toHaveProperty('installCommand');
    expect(manifest).not.toHaveProperty('project');
  });

  it('s’arrête sur une archive trop grosse, illisible ou hostile', async () => {
    const tooBig = await events(
      await hostedResponse(
        { action: 'files', link: 'octo/hello' },
        { fetch: github(REPO).fetch, limits: { ...LIMITS, maxArchiveBytes: 10 } },
      ),
    );
    expect(tooBig).toEqual([{ type: 'error', error: { code: 'archiveTooLarge', limit: 10 } }]);

    const notZip = await events(
      await hostedResponse(
        { action: 'files', link: 'octo/hello' },
        { fetch: github(Buffer.from('<html>')).fetch },
      ),
    );
    expect(notZip.at(-1)).toEqual({
      type: 'error',
      error: { code: 'unsupported', detail: 'notZip' },
    });

    const hostile = await events(
      await hostedResponse(
        { action: 'files', link: 'octo/hello' },
        { fetch: github(buildZip([{ name: 'r/../../x', data: 'x' }])).fetch },
      ),
    );
    expect(hostile.at(-1)).toEqual({
      type: 'error',
      error: { code: 'unsafePath', detail: 'r/../../x' },
    });
  });

  it('nomme le fichier abîmé au moment de l’envoyer', async () => {
    const list = await events(
      await hostedResponse(
        { action: 'files', link: 'octo/hello' },
        {
          fetch: github(
            buildZip([
              { name: 'r/ok.txt', data: 'ok' },
              { name: 'r/bad.txt', data: 'bad', crc: 1 },
            ]),
          ).fetch,
        },
      ),
    );
    expect(list.at(-1)).toEqual({ type: 'error', error: { code: 'corrupt', detail: 'bad.txt' } });
  });

  it('dit une liaison perdue pendant le téléchargement', async () => {
    const failing: ArchiveFetch = async () =>
      new Response(
        new ReadableStream({
          pull(controller) {
            controller.error(new Error('coupé'));
          },
        }),
      );
    const list = await events(
      await hostedResponse({ action: 'files', link: 'octo/hello' }, { fetch: failing }),
    );
    expect(list).toEqual([{ type: 'error', error: { code: 'network' } }]);
  });

  it('s’arrête proprement si le navigateur s’en va', async () => {
    const response = await hostedResponse(
      { action: 'files', link: 'octo/hello' },
      { fetch: github(REPO).fetch },
    );
    const reader = response.body?.getReader();
    await reader?.read();
    await reader?.cancel();
    expect(reader).toBeDefined();
  });
});

describe('hostedResponse — l’archive pour Firefox et Safari', () => {
  it('relaie l’archive de GitHub comme un téléchargement nommé', async () => {
    const response = await hostedResponse(
      { action: 'zip', link: 'octo/hello', folder: 'hello' },
      { fetch: github(REPO).fetch, limits: LIMITS },
    );
    expect(response.headers.get('content-type')).toBe('application/zip');
    expect(response.headers.get('content-disposition')).toBe('attachment; filename="hello.zip"');
    expect(Buffer.from(await response.arrayBuffer()).equals(REPO)).toBe(true);
  });

  it('refuse une archive annoncée trop grosse, ou sans corps', async () => {
    const declared = await hostedResponse(
      { action: 'zip', link: 'octo/hello' },
      {
        fetch: github(REPO, { headers: { 'content-length': String(REPO.length) } }).fetch,
        limits: { ...LIMITS, maxArchiveBytes: 10 },
      },
    );
    expect(declared.status).toBe(413);
    expect(await declared.json()).toEqual({ error: { code: 'archiveTooLarge', limit: 10 } });

    const empty = await hostedResponse(
      { action: 'zip', link: 'octo/hello' },
      { fetch: github(null).fetch },
    );
    expect(empty.status).toBe(502);
  });

  it('passe le signal de la requête à GitHub', async () => {
    const seen: (AbortSignal | null | undefined)[] = [];
    const controller = new AbortController();
    await hostedResponse(
      { action: 'zip', link: 'octo/hello' },
      {
        fetch: async (_url, init) => {
          seen.push(init.signal);
          return new Response(new Uint8Array(REPO));
        },
        signal: controller.signal,
      },
    );
    expect(seen[0]).toBe(controller.signal);
  });
});
