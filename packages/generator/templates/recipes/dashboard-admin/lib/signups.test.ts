import { describe, expect, it } from 'vitest';
import { signupsByDay } from './signups';

const NOW = new Date('2026-09-28T15:00:00Z');

describe('signupsByDay', () => {
  it('rend un point par jour, jours vides compris, du plus ancien au plus récent', () => {
    const days = signupsByDay([], NOW, 7);
    expect(days.map((day) => day.date)).toEqual([
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
      '2026-09-28',
    ]);
    expect(days.every((day) => day.count === 0)).toBe(true);
  });

  it('compte les inscriptions de chaque jour', () => {
    const days = signupsByDay(
      [
        new Date('2026-09-28T01:00:00Z'),
        new Date('2026-09-28T23:00:00Z'),
        new Date('2026-09-26T12:00:00Z'),
      ],
      NOW,
      7,
    );
    expect(days.find((day) => day.date === '2026-09-28')?.count).toBe(2);
    expect(days.find((day) => day.date === '2026-09-26')?.count).toBe(1);
  });

  it('ignore ce qui sort de la période', () => {
    const days = signupsByDay([new Date('2026-01-01T00:00:00Z')], NOW, 7);
    expect(days.reduce((total, day) => total + day.count, 0)).toBe(0);
  });
});
