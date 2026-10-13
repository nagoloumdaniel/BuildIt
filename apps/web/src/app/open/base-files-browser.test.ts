import { describe, expect, it } from 'vitest';
import { missingInHandle, writeMissingToHandle } from './base-files-browser';

/** Un dossier en mémoire, à la forme de FileSystemDirectoryHandle. */
function memoryDir(name: string, files: Map<string, string>, prefix = ''): unknown {
  const notFound = () => new DOMException('absent', 'NotFoundError');
  return {
    name,
    kind: 'directory',
    requestPermission: async () => 'granted',
    async *values() {},
    async getDirectoryHandle(child: string, options?: { create?: boolean }) {
      const path = `${prefix}${child}/`;
      const known = [...files.keys()].some((key) => key.startsWith(path));
      if (!known && options?.create !== true) throw notFound();
      return memoryDir(child, files, path);
    },
    async getFileHandle(child: string, options?: { create?: boolean }) {
      const path = `${prefix}${child}`;
      if (!files.has(path) && options?.create !== true) throw notFound();
      return {
        createWritable: async () => {
          let text = '';
          return {
            write: async (data: Uint8Array) => {
              text += new TextDecoder().decode(data);
            },
            close: async () => {
              files.set(path, text);
            },
          };
        },
      };
    },
  };
}

const wanted = [
  { path: 'SECURITY.md', contents: 'neuf' },
  { path: 'docs/architecture/README.md', contents: 'vue' },
];

describe('fichiers de base dans le navigateur (File System Access API)', () => {
  it('ne garde que ce qui manque, puis l’écrit sans toucher au reste', async () => {
    const files = new Map([['docs/architecture/README.md', 'à moi']]);
    const handle = memoryDir('mon-app', files) as never;
    const missing = await missingInHandle(handle, wanted);
    expect(missing.map((file) => file.path)).toEqual(['SECURITY.md']);
    const result = await writeMissingToHandle(handle, wanted);
    expect(result).toEqual({ ok: true, written: ['SECURITY.md'] });
    expect(files.get('SECURITY.md')).toBe('neuf');
    expect(files.get('docs/architecture/README.md')).toBe('à moi');
  });
});
