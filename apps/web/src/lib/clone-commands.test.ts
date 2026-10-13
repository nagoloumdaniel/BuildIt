import { describe, expect, it } from 'vitest';
import { cloneCommands, shellQuote } from './clone-commands';

describe('cloneCommands', () => {
  it('donne le clone, l’entrée dans le dossier et l’installation', () => {
    expect(cloneCommands('https://github.com/octo/hello.git', 'hello', 'pnpm install')).toEqual({
      clone: 'git clone https://github.com/octo/hello.git hello',
      cd: 'cd hello',
      install: 'pnpm install',
    });
    expect(cloneCommands('git@gitlab.com:team/app.git', 'app')).toEqual({
      clone: 'git clone git@gitlab.com:team/app.git app',
      cd: 'cd app',
    });
    expect(cloneCommands('https://x/y', 'y', '')).not.toHaveProperty('install');
  });

  it('cite ce qui en a besoin, et seulement ça', () => {
    expect(shellQuote('mon-app_2.0')).toBe('mon-app_2.0');
    expect(shellQuote('mon app')).toBe(`'mon app'`);
    expect(shellQuote(`l'app`)).toBe(`'l'"'"'app'`);
  });
});
