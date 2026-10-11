import { type Manifest, serializeManifest } from '@project-factory/manifest';
import { describe, expect, it } from 'vitest';
import {
  decodeShareHash,
  decodeSharePayload,
  encodeShareLink,
  encodeSharePayload,
  payloadFromHash,
  shareOrigin,
  sharePath,
} from './codec';

/**
 * Le codec du partage est une **fonction pure** : tout ce qui suit s'exécute
 * sans DOM, sans réseau, sans serveur.
 *
 * Deux preuves comptent plus que les autres ici :
 *
 * - la **parité** : la charge produite doit être exactement
 *   `base64url(serializeManifest(manifest))`, calculé ici par une
 *   implémentation indépendante (`Buffer`) que le CLI partage. Si l'un des deux
 *   côtés dérive, un test tombe ;
 * - les **refus** : un lien reçu n'est pas de confiance, et un manifest qui
 *   transporterait autre chose que des choix de configuration est rejeté par le
 *   schéma strict — pas ignoré.
 */

const MANIFEST: Manifest = {
  manifestVersion: 1,
  name: 'demo',
  targets: ['web'],
  architecture: 'single-app',
  frontend: { framework: 'next', language: 'typescript' },
};

/**
 * Égal à `sharePayload(MANIFEST)` du CLI (`apps/cli/src/commands/share.ts`) :
 * c'est le contrat de format, partagé par les deux suites. Chacune compare sa
 * charge à ce même littéral ; si l'une dérive, son test tombe.
 */
const GOLDEN_PAYLOAD =
  'ewogICJtYW5pZmVzdFZlcnNpb24iOiAxLAogICJuYW1lIjogImRlbW8iLAogICJ0YXJnZXRzIjogWwogICAgIndlYiIKICBdLAogICJhcmNoaXRlY3R1cmUiOiAic2luZ2xlLWFwcCIsCiAgImZyb250ZW5kIjogewogICAgImZyYW1ld29yayI6ICJuZXh0IiwKICAgICJsYW5ndWFnZSI6ICJ0eXBlc2NyaXB0IgogIH0KfQo';

/** L'implémentation indépendante : ce que le CLI produit pour le même manifest. */
function referencePayload(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return Buffer.from(text, 'utf8').toString('base64url');
}

/** Fabrique une charge hostile, sans passer par l'encodeur testé. */
function payloadOf(value: unknown): string {
  return payloadOrText(JSON.stringify(value));
}

function payloadOrText(text: string): string {
  return referencePayload(text);
}

describe('encodeSharePayload — la forme canonique, en base64url', () => {
  it('produit le littéral de référence, partagé avec le CLI', () => {
    expect(encodeSharePayload(MANIFEST)).toBe(GOLDEN_PAYLOAD);
    // Et ce littéral se relit : c'est la seule copie du contrat.
    const decoded = decodeSharePayload(GOLDEN_PAYLOAD);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.value.name).toBe('demo');
    }
  });

  it('produit exactement base64url(serializeManifest(manifest))', () => {
    expect(encodeSharePayload(MANIFEST)).toBe(referencePayload(serializeManifest(MANIFEST)));
  });

  it('n’emploie que des caractères de fragment', () => {
    const payload = encodeSharePayload(MANIFEST);
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(payload).not.toContain('+');
    expect(payload).not.toContain('/');
    expect(payload).not.toContain('=');
  });

  it('est déterministe : deux choix identiques donnent le même lien', () => {
    const reordered: Manifest = {
      ...MANIFEST,
      targets: ['web'],
    };
    expect(encodeSharePayload(reordered)).toBe(encodeSharePayload(MANIFEST));
  });

  it('n’envoie rien d’autre que le manifest', () => {
    const decoded = JSON.parse(
      Buffer.from(encodeSharePayload(MANIFEST), 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
    expect(Object.keys(decoded).sort()).toEqual([
      'architecture',
      'frontend',
      'manifestVersion',
      'name',
      'targets',
    ]);
  });
});

describe('encodeShareLink — le lien complet', () => {
  it('reste relatif sans origine : l’origine est celle qui sert l’UI', () => {
    expect(encodeShareLink(MANIFEST)).toBe(sharePath(encodeSharePayload(MANIFEST)));
    expect(encodeShareLink(MANIFEST).startsWith('/share#')).toBe(true);
  });

  it('accepte une base, avec ou sans barre oblique finale', () => {
    const payload = encodeSharePayload(MANIFEST);
    expect(encodeShareLink(MANIFEST, 'http://127.0.0.1:4173')).toBe(
      `http://127.0.0.1:4173/share#${payload}`,
    );
    expect(encodeShareLink(MANIFEST, 'https://exemple.fr/')).toBe(
      `https://exemple.fr/share#${payload}`,
    );
    expect(encodeShareLink(MANIFEST, '  http://127.0.0.1:4173/  ')).toBe(
      `http://127.0.0.1:4173/share#${payload}`,
    );
  });
});

describe('shareOrigin — l’origine retenue', () => {
  it('préfère la base configurée, sinon celle du navigateur', () => {
    expect(shareOrigin('', 'http://127.0.0.1:4173')).toBe('http://127.0.0.1:4173');
    expect(shareOrigin('   ', 'http://127.0.0.1:4173')).toBe('http://127.0.0.1:4173');
    expect(shareOrigin(' https://exemple.fr/ ', 'http://127.0.0.1:4173')).toBe(
      'https://exemple.fr',
    );
  });
});

describe('decodeSharePayload — décoder, ou dire pourquoi', () => {
  it('retrouve le manifest tel qu’il a été encodé', () => {
    const result = decodeSharePayload(encodeSharePayload(MANIFEST));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('demo');
      expect(result.value.targets).toEqual(['web']);
      expect(result.value.frontend).toEqual({ framework: 'next', language: 'typescript' });
    }
  });

  it('refuse un fragment vide', () => {
    const result = decodeSharePayload('');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join(' ')).toContain('aucune configuration');
    }
  });

  it('refuse une charge tronquée, sans lever, et sans jamais inventer un autre manifest', () => {
    const payload = encodeSharePayload(MANIFEST);
    let refusals = 0;
    // Toutes les troncatures possibles : un lien recopié à la main s'arrête
    // n'importe où. Aucune ne doit lever, et aucune ne doit rendre un manifest
    // différent — soit elle est refusée, soit elle est identique (perdre le
    // saut de ligne final ne change pas les choix).
    for (let cut = 1; cut < payload.length; cut += 1) {
      const result = decodeSharePayload(payload.slice(0, cut));
      if (result.ok) {
        expect(result.value).toEqual(MANIFEST);
      } else {
        refusals += 1;
        expect(result.issues.length).toBeGreaterThan(0);
      }
    }
    expect(refusals).toBeGreaterThan(0);
  });

  it('refuse du base64 invalide et un fragment qui n’est pas d’ici', () => {
    expect(decodeSharePayload('!!!pas-du-base64!!!').ok).toBe(false);
    expect(decodeSharePayload('a').ok).toBe(false);
    expect(decodeSharePayload('#abc').ok).toBe(false);
  });

  it('refuse des octets qui ne sont pas de l’UTF-8', () => {
    const broken = Buffer.from([0xff, 0xfe, 0xfd, 0x00]).toString('base64url');
    const result = decodeSharePayload(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join(' ')).toContain('texte lisible');
    }
  });

  it('refuse du JSON corrompu', () => {
    const result = decodeSharePayload(payloadOrText('{"name": "demo",'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join(' ')).toContain('configuration exploitable');
    }
  });

  it('refuse un manifest invalide en le disant lisiblement', () => {
    const result = decodeSharePayload(payloadOf({ name: 'demo' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join(' ')).toContain('manifestVersion');
      expect(result.issues.every((issue) => issue.length > 0)).toBe(true);
    }
  });

  it('ne rend jamais de trace technique', () => {
    const cases = ['', '!!!', payloadOrText('{'), payloadOf({ name: 'demo' })];
    for (const payload of cases) {
      const result = decodeSharePayload(payload);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        for (const issue of result.issues) {
          expect(issue).not.toMatch(/Error|at Object|node_modules|\bat \w+ \(/);
        }
      }
    }
  });
});

describe('§9.4 — rien d’autre que des choix de configuration', () => {
  it('refuse une variable d’environnement glissée dans la charge', () => {
    // La chaîne est composée à l'exécution : un faux identifiant écrit en clair
    // ferait échouer le scan de secrets du dépôt (`pnpm lint:secrets`), qui a
    // raison de refuser toute chaîne en forme de secret — même fausse.
    const fakeDatabaseUrl = ['postgres', '://secret:motdepasse@localhost/db'].join('');
    const hostile = {
      ...MANIFEST,
      env: { DATABASE_URL: fakeDatabaseUrl },
    };
    const result = decodeSharePayload(payloadOf(hostile));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Le refus nomme le champ inconnu, jamais la valeur qui y était.
      expect(result.issues.join(' ')).not.toContain('motdepasse');
      expect(result.issues.join(' ')).not.toContain('postgres');
    }
  });

  it('refuse un jeton ou un secret ajouté à la main', () => {
    const hostile = { ...MANIFEST, token: 'ghp_0123456789abcdefghij' };
    const result = decodeSharePayload(payloadOf(hostile));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join(' ')).not.toContain('ghp_0123456789abcdefghij');
    }
  });

  it('refuse un champ qui n’existe pas dans le manifest — nom d’auteur compris', () => {
    for (const field of ['author', 'user', 'owner', 'path', 'directory', 'host']) {
      const result = decodeSharePayload(payloadOf({ ...MANIFEST, [field]: 'quelqu’un' }));
      expect(result.ok).toBe(false);
    }
  });

  it('refuse un nom de projet qui serait un chemin local', () => {
    for (const name of ['C:\\Users\\moi\\projet', '../evade', '~/projet', 'a/b']) {
      const result = decodeSharePayload(payloadOf({ ...MANIFEST, name }));
      expect(result.ok).toBe(false);
    }
  });
});

describe('payloadFromHash — du fragment à la charge', () => {
  it('retire le croisillon et décode un fragment échappé', () => {
    expect(payloadFromHash('#abc')).toBe('abc');
    expect(payloadFromHash('abc')).toBe('abc');
    expect(payloadFromHash('#a%2Fb')).toBe('a/b');
    expect(payloadFromHash('')).toBe('');
  });

  it('ne lève pas sur un pourcentage orphelin', () => {
    expect(payloadFromHash('#a%')).toBe('a%');
    expect(payloadFromHash('#%ZZ')).toBe('%ZZ');
  });
});

describe('decodeShareHash — le chemin complet', () => {
  it('décode un lien réel', () => {
    const link = encodeShareLink(MANIFEST, 'http://127.0.0.1:4173');
    const hash = link.slice(link.indexOf('#'));
    const result = decodeShareHash(hash);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('demo');
    }
  });

  it('dit pourquoi un fragment vide ne montre rien', () => {
    expect(decodeShareHash('').ok).toBe(false);
  });
});
