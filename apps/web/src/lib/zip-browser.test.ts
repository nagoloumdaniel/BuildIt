import { describe, expect, it } from 'vitest';
import { createZip as createNodeZip } from './zip';
import { createBrowserZip } from './zip-browser';

describe('createBrowserZip — archive sans Node, pour le navigateur', () => {
  it('produit octet pour octet la même archive que la version serveur', () => {
    const entries = [
      { path: 'demo/README.md', text: '# démo\n' },
      { path: 'demo/docs/architecture/README.md', text: 'vue' },
    ];
    const browser = createBrowserZip(entries);
    const node = createNodeZip(
      entries.map((entry) => ({ path: entry.path, data: Buffer.from(entry.text, 'utf8') })),
    );
    expect(Buffer.from(browser).equals(node)).toBe(true);
  });
});
