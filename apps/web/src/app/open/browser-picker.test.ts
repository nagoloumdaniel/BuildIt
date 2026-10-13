import { describe, expect, it } from 'vitest';
import { buildZip } from '../../lib/clone-zip.fixture';
import {
  isMobileWithoutFolder,
  readFileList,
  readPlainFiles,
  readZipProject,
} from './browser-picker';

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

describe('mobile — archive .zip ou fichiers, à la place d’un dossier', () => {
  it('reconnaît iPhone, iPad (même déguisé en Mac) et Android', () => {
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15';
    expect(isMobileWithoutFolder({ userAgent: iphone })).toBe(true);
    expect(isMobileWithoutFolder({ userAgent: 'Mozilla/5.0 (Linux; Android 15)' })).toBe(true);
    const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';
    expect(isMobileWithoutFolder({ userAgent: mac, maxTouchPoints: 5 })).toBe(true);
    expect(isMobileWithoutFolder({ userAgent: mac, maxTouchPoints: 0 })).toBe(false);
    expect(isMobileWithoutFolder({ userAgent: 'Mozilla/5.0 (Windows NT 10.0)' })).toBe(false);
  });

  it('lit un zip (deflate et stocké) depuis son dossier racine', async () => {
    const zip = buildZip([
      { name: 'mon-app/', method: 0 },
      { name: 'mon-app/package.json', data: '{"name":"mon-app"}' },
      { name: 'mon-app/pf.manifest.json', data: '{"name":"x"}', method: 0 },
      { name: 'mon-app/components/button.tsx', data: 'export {}' },
      { name: '__MACOSX/mon-app/._package.json', data: 'x' },
    ]);
    const read = await readZipProject(new Uint8Array(zip), 'archive.zip');
    expect(read.value).toEqual({
      name: 'mon-app',
      names: ['package.json', 'pf.manifest.json'],
      dirs: ['components'],
      packageJson: '{"name":"mon-app"}',
      manifest: '{"name":"x"}',
    });
    expect(read.paths).toEqual(['package.json', 'pf.manifest.json', 'components/button.tsx']);
  });

  it('un zip sans dossier racine prend le nom de l’archive', async () => {
    const zip = buildZip([
      { name: 'package.json', data: '{}' },
      { name: 'src/a.ts', data: '' },
    ]);
    const read = await readZipProject(new Uint8Array(zip), 'site.zip');
    expect(read.value.name).toBe('site');
    expect(read.value.dirs).toEqual(['src']);
  });

  it('refuse ce qui n’est pas une archive', async () => {
    await expect(readZipProject(new TextEncoder().encode('pas un zip'), 'x.zip')).rejects.toThrow();
  });

  it('plusieurs fichiers : la racine du projet, nommée par package.json', async () => {
    const plain = (name: string, text = '') => ({
      name,
      size: text.length,
      text: async () => text,
    });
    const read = await readPlainFiles([
      plain('package.json', '{"name":"site"}'),
      plain('README.md'),
    ]);
    expect(read?.value.name).toBe('site');
    expect(read?.paths).toEqual(['package.json', 'README.md']);
    expect(await readPlainFiles([])).toBeUndefined();
  });
});
