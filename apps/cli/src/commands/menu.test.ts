import { describe, expect, it, vi } from 'vitest';
import { fakeIo } from '../fake-io.js';
import { create } from './create.js';
import { menu } from './menu.js';

vi.mock('./create.js', () => ({ create: vi.fn(async () => 0) }));

describe('menu d’accueil', () => {
  it('« Créer un projet » passe la main à pf create, qui pose ses questions', async () => {
    const io = fakeIo({ interactive: true, answers: ['create'] });
    const help = vi.fn(() => 0 as const);
    expect(await menu(io, help)).toBe(0);
    expect(create).toHaveBeenCalledWith([], io);
    expect(help).not.toHaveBeenCalled();
  });
});
