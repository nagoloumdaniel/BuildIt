import { nodeCommandRunner } from '@buildit/exec';
import type { NextRequest } from 'next/server';
import { isHostedEnvironment } from '../../../lib/hosting';
import { webWorkspaceRoot } from '../../clone/destination';
import { type GenerateStreamEvent, runGenerateStream } from '../../create/generate/stream-server';
import { withoutServerSecrets } from '../../open/project';

/**
 * La génération dans un dossier choisi, **en flux** (§6.13).
 *
 * Même raison d'être que `/api/clone` : une Server Action rend son résultat
 * d'un seul coup, et une installation de dépendances dure des minutes. Une
 * route tient la réponse ouverte et pousse chaque passage réel : écriture,
 * fichiers écrits, installation, fin. Le format est celui des événements
 * serveur (`text/event-stream`), lu par `fetch` côté navigateur parce que la
 * requête est un `POST`.
 *
 * Ce que cette route ne fait pas : décider. La validation (manifest, dossier
 * parent, dossier libre), l'écriture et l'installation sont dans
 * `runGenerateStream`, prouvées sans serveur. En hébergé, la requête est
 * refusée par un `done` lisible : aucun chemin reçu n'y est lu.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: GenerateStreamEvent): void => {
        if (closed) {
          return;
        }
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Le navigateur est parti. L'écriture et l'installation vont jusqu'au
          // bout : un projet à moitié installé serait pire qu'un onglet fermé.
          closed = true;
        }
      };

      try {
        await runGenerateStream(
          body,
          {
            hosted: isHostedEnvironment(),
            registryRoot: webWorkspaceRoot(),
            runner: withoutServerSecrets(nodeCommandRunner),
          },
          send,
        );
      } finally {
        closed = true;
        try {
          controller.close();
        } catch {
          // Déjà fermé par le départ du navigateur.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'cache-control': 'no-store, no-transform',
      connection: 'keep-alive',
      'content-type': 'text/event-stream; charset=utf-8',
      // Un proxy qui met en tampon annulerait tout l'intérêt du flux.
      'x-accel-buffering': 'no',
    },
  });
}
