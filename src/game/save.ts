import type { UpgradeId } from './config';
import type { QuestDay } from './quests';

export type MapId = 'barn' | 'truck';

export interface MapProgress {
  unlocked: string[];
  upgrades: Record<UpgradeId, number>;
  served: number;
  /** money already poured into pads that are not finished yet */
  partial?: Record<string, number>;
}

export interface SaveData {
  v: 1;
  coins: number;
  gems: number;
  current: MapId;
  maps: Partial<Record<MapId, MapProgress>>;
  owned: string[];
  equipped: { hat: string | null; outfit: string | null; shoes: string | null; colour: string | null };
  perks: string[];
  rushUntil: number;
  daily: { last: string; streak: number };
  /** today's three quests; replaced by a fresh set on the first progress of a new day */
  quests?: QuestDay;
  sound: boolean;
  music: boolean;
  tutorial: boolean;
}

const KEY = 'order-up-save-v1';

export function freshSave(): SaveData {
  return {
    v: 1,
    coins: 0,
    gems: 0,
    current: 'barn',
    maps: {},
    owned: [],
    equipped: { hat: null, outfit: null, shoes: null, colour: null },
    perks: [],
    rushUntil: 0,
    daily: { last: '', streak: 0 },
    sound: true,
    music: true,
    tutorial: false,
  };
}

export function mapProgress(s: SaveData, id: MapId): MapProgress {
  let p = s.maps[id];
  if (!p) {
    p = { unlocked: [], upgrades: { speed: 0, capacity: 0, kitchen: 0, menu: 0, counter: 0 }, served: 0 };
    s.maps[id] = p;
  }
  // saves from before the Big Counter upgrade
  p.upgrades.counter ??= 0;
  return p;
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshSave();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (parsed.v !== 1) return freshSave();
    const base = freshSave();
    return { ...base, ...parsed, equipped: { ...base.equipped, ...parsed.equipped }, daily: { ...base.daily, ...parsed.daily } };
  } catch (e) {
    console.warn('Save could not be read, starting fresh', e);
    return freshSave();
  }
}

let pending = 0;

/** Debounced write so a burst of coin pickups costs one storage write. */
export function writeSave(s: SaveData, now = false): void {
  const go = () => {
    pending = 0;
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch (e) {
      console.warn('Save could not be written', e);
    }
  };
  if (now) {
    if (pending) clearTimeout(pending);
    go();
    return;
  }
  if (!pending) pending = window.setTimeout(go, 800);
}
