import { nodeCommandRunner } from '@buildit/exec';
import type { NextRequest } from 'next/server';
import { isHostedEnvironment } from '../../../lib/hosting';
import { type ClonePlace, cloneProject } from '../../clone/clone';
import { createCloneProgressReader } from '../../clone/progress';
import { sessionDeps } from '../../github/server-deps';
import { type ProjectSummaryView, withoutServerSecrets } from '../../open/project';

/**
 * Le clonage **en flux** (§6.22).
 *
 * Pourquoi une route et pas une Server Action : une action rend son résultat
 * d'un seul coup. Un clone de 200 Mo met des minutes, et un rotor pendant
 * trois minutes ne dit pas si quelque chose avance — c'est exactement la
 * plainte à laquelle cet écran répond. Une route, elle, peut tenir la réponse
 * ouverte et pousser l'avancement réel que `git clone --progress` produit.
 *
 * Le format est celui des **événements serveur** (`text/event-stream`) : géré
 * nativement par le navigateur, rétabli tout seul, et lisible dans l'onglet
 * réseau — un WebSocket serait un protocole de plus pour un flux à sens
 * unique.
 *
 * Ce que cette route ne change pas :
 * - le `middleware` filtre l'hôte avant elle, comme pour toute autre adresse ;
 * - la validation du lien et du dossier reste celle de `planClone`, appelée
 *   par `cloneProject` ; rien n'est cru sur parole ici non plus ;
 * - le jeton GitHub n'est pas dans la réponse : `packages/git` caviarde la
 *   sortie avant que le moindre octet n'atteigne ce fichier.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Un événement poussé au navigateur. Volontairement plat : pas de classe. */
type CloneEvent =
  | {
      readonly type: 'progress';
      readonly phase: string;
      readonly percent: number;
      readonly detail?: string;
    }
  | { readonly type: 'phase'; readonly phase: string }
  | {
      readonly type: 'done';
      readonly ok: boolean;
      readonly directory: string;
      readonly issues: readonly string[];
      readonly warnings: readonly string[];
      readonly installed: boolean;
      readonly installCommand?: string;
      /**
       * Le projet reconnu, en entier : l'écran affiche le gestionnaire, la
       * commande exacte et les avertissements, et ce résultat doit survivre à
       * la fin du flux — le navigateur le garde tel quel.
       */
      readonly project?: ProjectSummaryView;
    };

function record(input: unknown): Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};
}

/** Le refus du mode hébergé, au format du flux : l'écran le lit comme un `done`. */
function hostedRefusal(): Response {
  const event: CloneEvent = {
    type: 'done',
    ok: false,
    directory: '',
    issues: [
      'Le clonage par git ne tourne qu’en local (pf web) : ce serveur hébergé n’a pas git et ne voit pas votre disque. Utilisez la copie depuis GitHub de l’écran Cloner, ou lancez git clone dans un terminal.',
    ],
    warnings: [],
    installed: false,
  };
  return new Response(
    `data: ${JSON.stringify(event)}

`,
    {
      headers: {
        'cache-control': 'no-store, no-transform',
        'content-type': 'text/event-stream; charset=utf-8',
      },
    },
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const input = record(body);

  // En hébergé, `git clone` tournerait dans la fonction serverless : pas de
  // `git` dans ce runtime, et un clone réussi resterait sur un disque
  // éphémère que l'utilisateur ne voit pas. C'était le défaut de production :
  // l'écran disait « échec » sans dire pourquoi. L'écran passe désormais par
  // `/api/clone-archive` ; un appel direct reçoit un refus qui l'explique, au
  // lieu d'une tentative vouée à l'échec.
  if (isHostedEnvironment()) {
    return hostedRefusal();
  }
  const place: ClonePlace = { kind: 'parent', parent: input['parent'] };

  const token = await sessionDeps().store.get();
  const encoder = new TextEncoder();
  const readProgress = createCloneProgressReader();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: CloneEvent): void => {
        if (closed) {
          return;
        }
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Le navigateur est parti. Le clone, lui, va jusqu'au bout : un
          // dossier à moitié écrit serait pire qu'un onglet fermé.
          closed = true;
        }
      };

      send({ type: 'phase', phase: 'starting' });

      try {
        const result = await cloneProject({
          link: input['link'],
          folder: input['folder'],
          install: input['install'] === true,
          ignoreScripts: input['ignoreScripts'] === true,
          root: place,
          runner: withoutServerSecrets(nodeCommandRunner),
          ...(token === undefined ? {} : { token }),
          onProgress: (chunk) => {
            const parsed = readProgress(chunk);
            if (parsed !== undefined) {
              send({
                type: 'progress',
                phase: parsed.phase,
                percent: parsed.percent,
                ...(parsed.detail === undefined ? {} : { detail: parsed.detail }),
              });
            }
          },
          onPhase: (phase) => send({ type: 'phase', phase }),
        });

        send({
          type: 'done',
          ok: result.ok,
          directory: result.directory,
          issues: result.issues,
          warnings: result.warnings,
          installed: result.installed,
          ...(result.installCommand === undefined ? {} : { installCommand: result.installCommand }),
          ...(result.project === undefined ? {} : { project: result.project }),
        });
      } catch {
        send({
          type: 'done',
          ok: false,
          directory: '',
          issues: [
            'Le clonage n’a pas pu être lancé. Rien n’a été laissé sur le disque. Réessayez.',
          ],
          warnings: [],
          installed: false,
        });
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
