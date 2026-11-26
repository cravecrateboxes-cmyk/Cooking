import { describe, expect, it } from 'vitest';
import { bump, claimable, questsFor } from './quests';

describe('daily quests', () => {
  it('gives three quests of different kinds, easy to hard, the same all day', () => {
    const a = questsFor('Thu Nov 26 2026', undefined);
    expect(a.list).toHaveLength(3);
    expect(new Set(a.list.map((q) => q.kind)).size).toBe(3);
    expect(a.list.map((q) => q.gems)).toEqual([2, 3, 5]);
    expect(questsFor('Thu Nov 26 2026', undefined)).toEqual(a);
  });

  it('keeps today’s progress and starts fresh the next day', () => {
    const a = questsFor('Thu Nov 26 2026', undefined);
    a.list[0].got = 1;
    expect(questsFor('Thu Nov 26 2026', a)).toBe(a);
    const b = questsFor('Fri Nov 27 2026', a);
    expect(b.day).toBe('Fri Nov 27 2026');
    expect(b.list.every((q) => q.got === 0 && !q.claimed)).toBe(true);
  });

  it('adds up counts, keeps the best combo, and reports each completion once', () => {
    const d = { day: 'x', list: [
      { kind: 'serve' as const, goal: 3, got: 0, gems: 2, claimed: false },
      { kind: 'combo' as const, goal: 6, got: 0, gems: 3, claimed: false },
      { kind: 'vip' as const, goal: 1, got: 0, gems: 5, claimed: false },
    ] };
    expect(bump(d, 'serve', 2)).toHaveLength(0);
    expect(bump(d, 'serve', 2)).toHaveLength(1);
    expect(d.list[0].got).toBe(3);
    expect(bump(d, 'serve', 1)).toHaveLength(0);
    bump(d, 'combo', 5);
    bump(d, 'combo', 2);
    expect(d.list[1].got).toBe(5);
    expect(bump(d, 'combo', 7)).toHaveLength(1);
    expect(claimable(d)).toBe(2);
    d.list[0].claimed = true;
    expect(claimable(d)).toBe(1);
  });
});
