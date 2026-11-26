/** Every tuning number in one place. Distances in metres, times in seconds, money in coins. */

export type Dish = 'burger' | 'fries' | 'soda' | 'sundae' | 'hotdog' | 'pizza';

export interface DishInfo {
  name: string;
  model: string;
  price: number;
  /** height of one item when stacked in the chef's arms */
  stackH: number;
}

export const DISHES: Record<Dish, DishInfo> = {
  burger: { name: 'Burger', model: 'food_burger', price: 9, stackH: 0.2 },
  soda: { name: 'Soda', model: 'food_soda', price: 6, stackH: 0.17 },
  fries: { name: 'Fries', model: 'food_fries', price: 8, stackH: 0.17 },
  sundae: { name: 'Sundae', model: 'food_sundae', price: 24, stackH: 0.22 },
  hotdog: { name: 'Hot Dog', model: 'food_hotdog', price: 10, stackH: 0.13 },
  pizza: { name: 'Pizza', model: 'food_pizza', price: 18, stackH: 0.08 },
};

export const TUNE = {
  player: {
    speed: [4.6, 5.2, 5.8, 6.4, 7.0, 7.6],
    capacity: [4, 5, 6, 8, 10, 12],
    accel: 34,
    decel: 40,
    turn: 16,
    radius: 0.32,
  },
  /** seconds to cook one dish, by kitchen speed level */
  cookTime: [1.05, 0.9, 0.78, 0.66, 0.56, 0.48],
  /** dish multiplier from the Tasty Menu upgrade */
  priceMult: [1, 1.25, 1.5, 1.8, 2.2, 2.7],
  stationTray: 8,
  /** dishes the counter tray holds */
  passCap: 8,
  /** seconds between dishes handed from the counter tray to the guest in front */
  passServeEvery: 0.14,
  handoffEvery: 0.085,
  /** seconds on a station pad before its waiting dishes jump into the chef's arms */
  grabDwell: 0.18,
  /** seconds standing on the register pad before food leaves the chef's arms, so walking past drops nothing */
  serveDwell: 0.5,
  cashEvery: 0.035,
  customer: {
    walk: 2.15,
    patience: 26,
    /** seconds of patience given back each time part of an order arrives */
    partialBoost: 4,
    spawnEvery: [3.2, 1.7],
    maxInside: 16,
    vipChance: 0.07,
  },
  staff: {
    speed: 3.4,
    capacity: 4,
  },
  eatTime: 6.5,
  tipFast: 8,
  /** seconds between two paying guests that still chain a serving combo, and its highest step */
  comboWindow: 7,
  comboCap: 9,
  gemsPerVip: 1,
  padDrainRate: 0.9,
};

export const UPGRADE_COSTS = {
  speed: [60, 180, 420, 900, 1800],
  capacity: [80, 220, 520, 1100, 2200],
  kitchen: [120, 300, 650, 1300, 2600],
  menu: [150, 400, 900, 1900, 3800],
};

export type UpgradeId = keyof typeof UPGRADE_COSTS;

export const UPGRADE_INFO: Record<UpgradeId, { title: string; stat: (lv: number) => string }> = {
  speed: { title: 'Quick Feet', stat: (lv) => `${TUNE.player.speed[lv].toFixed(1)} m/s` },
  capacity: { title: 'Big Arms', stat: (lv) => `Carry ${TUNE.player.capacity[lv]}` },
  kitchen: { title: 'Hot Kitchen', stat: (lv) => `Cooks ${(1 / TUNE.cookTime[lv]).toFixed(1)}/s` },
  menu: { title: 'Tasty Menu', stat: (lv) => `Prices x${TUNE.priceMult[lv].toFixed(2)}` },
};

/** Gem shop: rarer currency, bigger payoffs. Cosmetics are hats, clothes and shoes only; characters never get faces. */
export type GemKind = 'boost' | 'perk' | 'hat' | 'outfit' | 'shoes' | 'colour';

export interface GemItem {
  id: string;
  title: string;
  blurb: string;
  cost: number;
  kind: GemKind;
  /** model name in cosmetics.glb, or body colour for 'colour' */
  model?: string;
  colour?: string;
}

export const GEM_ITEMS: GemItem[] = [
  { id: 'rush', title: 'Rush Hour', blurb: 'Double cash for 3 minutes', cost: 5, kind: 'boost' },
  { id: 'golden_grill', title: 'Golden Kitchen', blurb: 'Every station cooks 40% faster, forever', cost: 25, kind: 'perk' },
  { id: 'vip_magnet', title: 'Red Carpet', blurb: 'VIP guests come three times as often', cost: 18, kind: 'perk' },
  { id: 'hat_cap', title: 'Ball Cap', blurb: 'A backwards red cap', cost: 4, kind: 'hat', model: 'cos_hat_cap' },
  { id: 'hat_crown', title: 'Royal Crown', blurb: 'For the boss of the block', cost: 12, kind: 'hat', model: 'cos_hat_crown' },
  { id: 'hat_cowboy', title: 'Ten Gallon', blurb: 'A big brown cowboy hat', cost: 8, kind: 'hat', model: 'cos_hat_cowboy' },
  { id: 'fit_apron', title: 'Striped Apron', blurb: 'Classic diner apron', cost: 3, kind: 'outfit', model: 'cos_fit_apron' },
  { id: 'fit_bowtie', title: 'Waiter Bow Tie', blurb: 'Fancy service', cost: 5, kind: 'outfit', model: 'cos_fit_bowtie' },
  { id: 'fit_scarf', title: 'Cosy Scarf', blurb: 'Knitted, two-tone', cost: 7, kind: 'outfit', model: 'cos_fit_scarf' },
  { id: 'shoe_sneaker', title: 'Hi-Tops', blurb: 'Bright teal sneakers', cost: 4, kind: 'shoes', model: 'cos_shoe_sneaker' },
  { id: 'shoe_boot', title: 'Work Boots', blurb: 'Chunky orange boots', cost: 6, kind: 'shoes', model: 'cos_shoe_boot' },
  { id: 'col_mint', title: 'Mint Chef', blurb: 'Cool mint body colour', cost: 6, kind: 'colour', colour: '#4fe3b8' },
  { id: 'col_gold', title: 'Golden Chef', blurb: 'A shiny gold chef', cost: 20, kind: 'colour', colour: '#ffc531' },
];
