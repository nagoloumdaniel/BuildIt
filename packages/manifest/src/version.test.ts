import { describe, expect, it } from 'vitest';
import { isSupportedManifestVersion, MANIFEST_VERSION } from './version.js';

describe('MANIFEST_VERSION', () => {
  it('vaut 1 — première version publiée du schéma', () => {
    expect(MANIFEST_VERSION).toBe(1);
  });
});

describe('isSupportedManifestVersion', () => {
  it('accepte la version courante', () => {
    expect(isSupportedManifestVersion(MANIFEST_VERSION)).toBe(true);
  });

  it('refuse une version future — un manifest v2 ne doit jamais être lu à l’aveugle', () => {
    expect(isSupportedManifestVersion(MANIFEST_VERSION + 1)).toBe(false);
  });

  it('refuse la version 0', () => {
    expect(isSupportedManifestVersion(0)).toBe(false);
  });

  it('refuse un nombre non entier', () => {
    expect(isSupportedManifestVersion(1.5)).toBe(false);
  });

  it('refuse NaN', () => {
    expect(isSupportedManifestVersion(Number.NaN)).toBe(false);
  });

  it('refuse une chaîne, même numérique — le champ vient de JSON non fiable', () => {
    expect(isSupportedManifestVersion('1')).toBe(false);
  });

  it('refuse null et undefined', () => {
    expect(isSupportedManifestVersion(null)).toBe(false);
    expect(isSupportedManifestVersion(undefined)).toBe(false);
  });
});
