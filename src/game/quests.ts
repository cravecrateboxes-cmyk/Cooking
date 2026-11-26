import { Rng } from './rng';

/** Things a day's quests can ask for. A combo quest counts the best combo reached, the rest add up. */
export type QuestKind = 'serve' | 'seated' | 'earn' | 'combo' | 'vip';

export interface Quest {
  kind: QuestKind;
  goal: number;
  got: number;
  gems: number;
  claimed: boolean;
}

export interface QuestDay {
  /** local calendar day the quests belong to, as Date.toDateString() gives it */
  day: string;
  list: Quest[];
}

/** Goals for an easy, a medium and a hard quest of each kind, and what each tier pays. */
const GOALS: Record<QuestKind, [number, number, number]> = {
  serve: [20, 45, 80],
  seated: [6, 14, 25],
  earn: [500, 1400, 3500],
  combo: [4, 6, 8],
  vip: [1, 3, 5],
};
const TIER_GEMS = [2, 3, 5];
const KINDS = Object.keys(GOALS) as QuestKind[];

/** Today's quests: the saved set if it is from today, otherwise a fresh easy, medium and hard trio of different kinds. */
export function questsFor(day: string, saved: QuestDay | undefined): QuestDay {
  if (saved && saved.day === day && saved.list.length === 3) return saved;
  const rng = new Rng(hash(day));
  const pool = [...KINDS];
  const list: Quest[] = [];
  for (let tier = 0; tier < 3; tier++) {
    const kind = pool.splice(rng.int(pool.length), 1)[0];
    list.push({ kind, goal: GOALS[kind][tier], got: 0, gems: TIER_GEMS[tier], claimed: false });
  }
  return { day, list };
}

/** Records progress; returns the quests this step just completed, so the game can celebrate them once. */
export function bump(q: QuestDay, kind: QuestKind, n: number): Quest[] {
  const done: Quest[] = [];
  for (const it of q.list) {
    if (it.kind !== kind || it.got >= it.goal) continue;
    it.got = Math.min(it.goal, kind === 'combo' ? Math.max(it.got, n) : it.got + n);
    if (it.got >= it.goal) done.push(it);
  }
  return done;
}

export function claimable(q: QuestDay): number {
  return q.list.filter((it) => it.got >= it.goal && !it.claimed).length;
}

export function questText(it: Quest): string {
  switch (it.kind) {
    case 'serve':
      return `Serve ${it.goal} guests`;
    case 'seated':
      return `Serve ${it.goal} guests at tables`;
    case 'earn':
      return `Earn ${it.goal.toLocaleString('en-US')} coins`;
    case 'combo':
      return `Reach a x${it.goal} serving combo`;
    case 'vip':
      return it.goal === 1 ? 'Serve a VIP guest' : `Serve ${it.goal} VIP guests`;
  }
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
