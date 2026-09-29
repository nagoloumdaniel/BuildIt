import { describe, expect, it, vi } from 'vitest';
import { fakeIo } from '../fake-io.js';
import { clone } from './clone.js';
import { create } from './create.js';
import { menu } from './menu.js';
import { open } from './open.js';

vi.mock('./create.js', () => ({ create: vi.fn(async () => 0) }));
vi.mock('./clone.js', () => ({ clone: vi.fn(async () => 0) }));
vi.mock('./open.js', () => ({ open: vi.fn(async () => 0) }));

describe('menu d’accueil', () => {
  it('« Créer un projet » passe la main à pf create, qui pose ses questions', async () => {
    const io = fakeIo({ interactive: true, answers: ['create'] });
    const help = vi.fn(() => 0 as const);
    expect(await menu(io, help)).toBe(0);
    expect(create).toHaveBeenCalledWith([], io);
    expect(help).not.toHaveBeenCalled();
  });

  it.each([
    ['clone', clone],
    ['open', open],
  ] as const)('« %s » passe la main à la commande', async (choice, command) => {
    const io = fakeIo({ interactive: true, answers: [choice] });
    expect(await menu(io, () => 0)).toBe(0);
    expect(command).toHaveBeenCalledWith([], io);
  });
});
