import { describe, expect, it } from 'vitest';
import { githubUrl, parseRemote } from './remote.js';

function code(input: string): string | undefined {
  const result = parseRemote(input);
  return result.ok ? undefined : result.issues[0]?.code;
}

describe('parseRemote — acceptés', () => {
  it('le raccourci propriétaire/dépôt pointe vers github.com en HTTPS', () => {
    expect(parseRemote('octocat/Hello-World')).toEqual({
      ok: true,
      value: {
        url: 'https://github.com/octocat/Hello-World.git',
        protocol: 'https',
        host: 'github.com',
        github: { owner: 'octocat', repo: 'Hello-World' },
      },
    });
  });

  it.each([
    ['https://github.com/octocat/Hello-World', 'https', { owner: 'octocat', repo: 'Hello-World' }],
    [
      'https://github.com/octocat/Hello-World.git',
      'https',
      { owner: 'octocat', repo: 'Hello-World' },
    ],
    ['https://github.com/octocat/Hello-World/', 'https', { owner: 'octocat', repo: 'Hello-World' }],
    ['git@github.com:octocat/Hello-World.git', 'ssh', { owner: 'octocat', repo: 'Hello-World' }],
    [
      'ssh://git@github.com/octocat/Hello-World.git',
      'ssh',
      { owner: 'octocat', repo: 'Hello-World' },
    ],
    ['https://gitlab.com/groupe/sous-groupe/projet.git', 'https', undefined],
    ['git@gitlab.example.com:equipe/projet.git', 'ssh', undefined],
    ['ssh://git@git.example.com:2222/equipe/projet.git', 'ssh', undefined],
  ])('%s', (input, protocol, github) => {
    const result = parseRemote(`  ${input}  `);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.url).toBe(input);
      expect(result.value.protocol).toBe(protocol);
      expect(result.value.github).toEqual(github);
    }
  });

  it('un chemin github.com qui n’est pas propriétaire/dépôt n’est pas un dépôt GitHub', () => {
    const result = parseRemote('https://github.com/a/b/c');
    expect(result.ok && result.value.github).toBeUndefined();
  });
});

// Gate 7B : ces liens sont rejetés **avant** tout appel à Git.
describe('parseRemote — refusés', () => {
  it.each([
    ['--upload-pack=touch /tmp/pwned', 'GIT_REMOTE_OPTION'],
    ['-u', 'GIT_REMOTE_OPTION'],
    ['ext::sh -c touch% /tmp/pwned', 'GIT_REMOTE_INVALID'],
    ['ext::sh', 'GIT_REMOTE_PROTOCOL'],
    ['fd::17', 'GIT_REMOTE_PROTOCOL'],
    ['file:///etc', 'GIT_REMOTE_LOCAL'],
    ['/home/user/projet', 'GIT_REMOTE_LOCAL'],
    ['./projet', 'GIT_REMOTE_LOCAL'],
    ['../projet', 'GIT_REMOTE_LOCAL'],
    ['..', 'GIT_REMOTE_LOCAL'],
    ['~/projet', 'GIT_REMOTE_LOCAL'],
    ['C:\\projets\\app', 'GIT_REMOTE_LOCAL'],
    ['http://github.com/a/b', 'GIT_REMOTE_PROTOCOL'],
    ['git://github.com/a/b', 'GIT_REMOTE_PROTOCOL'],
    ['ftp://example.com/a', 'GIT_REMOTE_PROTOCOL'],
    [`https://user:${'s'}ecret@github.com/a/b`, 'GIT_REMOTE_CREDENTIALS'],
    ['https://token@github.com/a/b', 'GIT_REMOTE_CREDENTIALS'],
    ['ssh://git:secret@github.com/a/b', 'GIT_REMOTE_CREDENTIALS'],
    ['', 'GIT_REMOTE_EMPTY'],
    ['   ', 'GIT_REMOTE_EMPTY'],
    ['https://github.com/a/b c', 'GIT_REMOTE_INVALID'],
    ['https://github.com/a/b\n--upload-pack=x', 'GIT_REMOTE_INVALID'],
    ['https://github.com/a/b?x=1', 'GIT_REMOTE_INVALID'],
    ['https://github.com/a/b#frag', 'GIT_REMOTE_INVALID'],
    ['https://github.com/', 'GIT_REMOTE_INVALID'],
    ['https://github.com/-evil', 'GIT_REMOTE_INVALID'],
    ['https:///a/b', 'GIT_REMOTE_INVALID'],
    ['https://[::1', 'GIT_REMOTE_INVALID'],
    ['git@github.com:-evil/x', 'GIT_REMOTE_INVALID'],
    ['git@github.com:/etc/passwd', 'GIT_REMOTE_INVALID'],
    ['git@-oProxyCommand=x:a/b', 'GIT_REMOTE_INVALID'],
    ['-git@github.com:a/b', 'GIT_REMOTE_OPTION'],
    ['owner/..', 'GIT_REMOTE_INVALID'],
    ['own_er/repo', 'GIT_REMOTE_INVALID'],
    ['.hidden/repo', 'GIT_REMOTE_INVALID'],
    ['juste-un-mot', 'GIT_REMOTE_INVALID'],
  ])('%j → %s', (input, expected) => {
    expect(code(input)).toBe(expected);
  });

  it('chaque refus donne les formes acceptées ou la marche à suivre', () => {
    for (const input of ['-x', 'http://a.com/b', `https://u:${'p'}@github.com/a/b`, 'rien']) {
      const result = parseRemote(input);
      expect(!result.ok && result.issues[0]?.hint).toBeTruthy();
    }
  });
});

describe('githubUrl', () => {
  it('le lien web du dépôt', () => {
    expect(githubUrl({ owner: 'octocat', repo: 'Hello-World' })).toBe(
      'https://github.com/octocat/Hello-World',
    );
  });
});
