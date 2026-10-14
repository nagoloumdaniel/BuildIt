import { loadCatalogue, type RegistryEntry } from '@buildit/registry';
import { describe, expect, it } from 'vitest';
import { freshDraft } from './draft';
import { draftToManifest } from './draft-to-manifest';

/**
 * Chaque technologie frontend/backend du catalogue, choisie seule, doit
 * atterrir dans le bon champ du manifest (§10) jamais perdue dans
 * `services`, jamais absente sans que le schéma le dise.
 *
 * Portée : « toutes les combinaisons possibles » au sens strict est
 * 2^283 intraitable. Ce test couvre la forme réaliste du bug rapporté
 * (« j'ai choisi une techno frontend, le manifest dit qu'aucune ne l'est ») :
 * chaque fiche `frontend`/`backend`, seule, sur chacune de ses cibles
 * déclarées c'est `place()` dans `draft-to-manifest.ts` qui est en cause
 * si une seule de ces fiches échoue. Des combinaisons à deux cibles
 * (web + api) s'y ajoutent pour couvrir le placement croisé entre
 * applications.
 */

function catalogueEntries(): readonly RegistryEntry[] {
  const result = loadCatalogue();
  if (!result.ok) {
    throw new Error(
      `Catalogue illisible : ${result.issues.map((issue) => issue.code).join(', ')}.`,
    );
  }
  return result.value.entries();
}

const entries = catalogueEntries();
// Les frameworks web seulement : Expo, Flutter, Electron… vont à `mobile` et `desktop`.
const frontends = entries.filter(
  (entry) => entry.category === 'frontend' && entry.targets.includes('web'),
);
const backends = entries.filter((entry) => entry.category === 'backend');

describe('draftToManifest chaque fiche frontend, seule, atterrit dans frontend.framework', () => {
  it.each(frontends.map((entry) => [entry.id, entry] as const))('%s', (_id, entry) => {
    expect(entry.targets).toContain('web');
    const result = draftToManifest({
      ...freshDraft(),
      name: 'sonde-frontend',
      targets: ['web'],
      architecture: 'single-app',
      // `language` est obligatoire au schéma (§10) : sans lui, le refus
      // attendu est `MANIFEST_FIELD_REQUIRED`, pas un bug de placement.
      // On l'isole en testant le framework seul, langage à part.
      technologies: [entry.id, 'typescript'],
    });
    expect(result.ok, JSON.stringify(!result.ok ? result.issues : [])).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.frontend?.framework).toBe(entry.id);
    // La sonde négative : une fiche perdue dans `services` est le bug
    // exact rapporté elle ne doit jamais s'y trouver.
    expect(result.value.services ?? []).not.toContain(entry.id);
  });
});

describe('draftToManifest chaque fiche backend, seule, atterrit dans backend.framework', () => {
  it.each(backends.map((entry) => [entry.id, entry] as const))('%s', (_id, entry) => {
    expect(entry.targets).toContain('api');
    const result = draftToManifest({
      ...freshDraft(),
      name: 'sonde-backend',
      targets: ['api'],
      architecture: 'single-app',
      technologies: [entry.id],
    });
    expect(result.ok, JSON.stringify(!result.ok ? result.issues : [])).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.backend?.framework).toBe(entry.id);
    expect(result.value.services ?? []).not.toContain(entry.id);
  });
});

describe('draftToManifest web + api ensemble : chaque paire place les deux frameworks', () => {
  // Échantillon raisonnable plutôt que le produit cartésien complet (13 × 16
  // = 208 paires, déjà loin d'être « rien ») : un frontend et un backend au
  // hasard de chaque bout du catalogue suffisent à prouver que la présence
  // d'une seconde application ne fait pas perdre la première.
  const sampleFrontends = frontends.filter((_entry, index) => index % 3 === 0);
  const sampleBackends = backends.filter((_entry, index) => index % 3 === 0);

  it.each(
    sampleFrontends.flatMap((frontend) =>
      sampleBackends.map(
        (backend) => [`${frontend.id} + ${backend.id}`, frontend, backend] as const,
      ),
    ),
  )('%s', (_label, frontend, backend) => {
    const result = draftToManifest({
      ...freshDraft(),
      name: 'sonde-fullstack',
      targets: ['web', 'api'],
      architecture: 'monorepo',
      technologies: [frontend.id, 'typescript', backend.id],
    });
    expect(result.ok, JSON.stringify(!result.ok ? result.issues : [])).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.frontend?.framework).toBe(frontend.id);
    expect(result.value.backend?.framework).toBe(backend.id);
  });
});

describe('draftToManifest front + back sans monorepo ne bloque plus la génération', () => {
  // L'architecture se choisit (écran 4) **avant** la stack (écran 5) : un
  // brouillon « single-app » qui reçoit ensuite next + hono était refusé au
  // moment de générer (MANIFEST_APPS_NEED_MONOREPO). Deux applications
  // imposent le monorepo : le brouillon y est porté au lieu d'échouer.
  it.each(['single-app', 'modular-monolith', 'microservices', 'serverless', 'event-driven'])(
    '%s devient monorepo',
    (architecture) => {
      const result = draftToManifest({
        ...freshDraft(),
        name: 'sonde-deux-apps',
        targets: ['web', 'api'],
        architecture,
        technologies: ['next', 'typescript', 'hono'],
      });
      expect(result.ok, JSON.stringify(!result.ok ? result.issues : [])).toBe(true);
      if (result.ok) {
        expect(result.value.architecture).toBe('monorepo');
      }
    },
  );
});
