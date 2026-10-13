import { describe, expect, it } from 'vitest';
import { readFileList } from './browser-picker';

const file = (webkitRelativePath: string, text = '') => ({
  webkitRelativePath,
  name: webkitRelativePath.split('/').at(-1) ?? '',
  size: text.length,
  text: async () => text,
});

describe('readFileList — repli <input webkitdirectory> (Firefox, Safari)', () => {
  it('rend le dossier, ses fichiers et dossiers du premier niveau, et tous les chemins', async () => {
    const picked = await readFileList([
      file('mon-app/package.json', '{"name":"mon-app"}'),
      file('mon-app/pf.manifest.json', '{"name":"mon-app"}'),
      file('mon-app/src/index.ts'),
      file('mon-app/docs/architecture/README.md'),
    ]);
    expect(picked).toEqual({
      value: {
        name: 'mon-app',
        names: ['package.json', 'pf.manifest.json'],
        dirs: ['src', 'docs'],
        packageJson: '{"name":"mon-app"}',
        manifest: '{"name":"mon-app"}',
      },
      paths: ['package.json', 'pf.manifest.json', 'src/index.ts', 'docs/architecture/README.md'],
    });
  });

  it('une liste vide (dossier vide ou refus) n’est pas un dossier', async () => {
    expect(await readFileList([])).toBeUndefined();
  });
});
