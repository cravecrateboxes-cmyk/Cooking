import { onTap } from './tap';
import { sfx } from '../audio/sfx';
import { GEM_ITEMS, UPGRADE_COSTS, UPGRADE_INFO, type GemItem, type UpgradeId } from '../game/config';
import type { MapProgress, SaveData } from '../game/save';
import { formatMoney } from './hud';
import { iconNamed } from './icons';
import { icon } from './svg';

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent?.appendChild(e);
  return e;
}

const openSheets = new Set<Sheet>();

/** Dim layer behind any open sheet; tapping it closes the sheet. One per parent, shared by its sheets. */
function scrimFor(parent: HTMLElement): HTMLElement {
  const found = parent.querySelector<HTMLElement>(':scope > .scrim');
  if (found) return found;
  const s = el('div', 'scrim', parent);
  onTap(s, () => {
    for (const sh of [...openSheets]) sh.hide();
  });
  return s;
}

/** Sheet over the scene: a bottom drawer on phones, a centred card on wide or short screens. */
export class Sheet {
  readonly root: HTMLDivElement;
  readonly body: HTMLDivElement;
  open = false;
  onClose: (() => void) | null = null;
  private readonly scrim: HTMLElement;

  constructor(parent: HTMLElement, title: string, tone: string) {
    this.scrim = scrimFor(parent);
    this.root = el('div', `sheet ${tone}`, parent);
    const head = el('div', 'sheet-head', this.root);
    el('div', 'disp sheet-title', head, title);
    const x = el('button', 'sheet-x', head);
    x.type = 'button';
    x.setAttribute('aria-label', 'Close');
    x.appendChild(icon('close'));
    onTap(x, () => this.hide());
    this.body = el('div', 'sheet-body', this.root);
  }

  show(): void {
    this.open = true;
    openSheets.add(this);
    this.root.classList.add('on');
    this.scrim.classList.add('on');
  }

  hide(): void {
    if (!this.open) return;
    this.open = false;
    openSheets.delete(this);
    this.root.classList.remove('on');
    if (![...openSheets].some((o) => o.scrim === this.scrim)) this.scrim.classList.remove('on');
    sfx.play('click');
    this.onClose?.();
  }
}

const UP_ICON: Record<UpgradeId, string> = {
  speed: 'up_speed',
  capacity: 'up_capacity',
  kitchen: 'st_grill',
  menu: 'food_sundae',
};
const UP_TONE: Record<UpgradeId, string> = { speed: 't-teal', capacity: 't-orange', kitchen: 't-red', menu: 't-pink' };

/** Four upgrade tracks, each row showing the stat now and after the next level. */
export class UpgradePanel {
  readonly sheet: Sheet;
  private rows = new Map<UpgradeId, { btn: HTMLButtonElement; now: HTMLElement; next: HTMLElement; price: HTMLElement; pips: HTMLElement }>();
  onBuy: ((id: UpgradeId) => void) | null = null;

  constructor(parent: HTMLElement) {
    this.sheet = new Sheet(parent, 'Upgrades', 'sheet-up');
    for (const id of Object.keys(UPGRADE_INFO) as UpgradeId[]) {
      const row = el('div', `up-row ${UP_TONE[id]}`, this.sheet.body);
      const pic = el('img', 'up-pic', row);
      pic.src = iconNamed(UP_ICON[id]);
      pic.alt = '';
      const mid = el('div', 'up-mid', row);
      el('div', 'up-title', mid, UPGRADE_INFO[id].title);
      const stat = el('div', 'up-stat', mid);
      const now = el('span', 'up-now', stat);
      stat.appendChild(icon('arrow', 'up-arrow'));
      const next = el('span', 'up-next', stat);
      const pips = el('div', 'up-pips', mid);
      for (let i = 0; i < UPGRADE_COSTS[id].length; i++) el('i', '', pips);
      const btn = el('button', 'gel buy', row);
      btn.type = 'button';
      const pi = el('img', 'buy-ico', btn);
      pi.src = iconNamed('item_coin');
      pi.alt = '';
      const price = el('span', 'num', btn);
      onTap(btn, () => this.onBuy?.(id));
      this.rows.set(id, { btn, now, next, price, pips });
    }
  }

  render(p: MapProgress, coins: number): void {
    for (const [id, r] of this.rows) {
      const lv = p.upgrades[id];
      const costs = UPGRADE_COSTS[id];
      const maxed = lv >= costs.length;
      r.now.textContent = UPGRADE_INFO[id].stat(lv);
      r.next.textContent = maxed ? 'Max' : UPGRADE_INFO[id].stat(lv + 1);
      r.pips.querySelectorAll('i').forEach((pip, i) => pip.classList.toggle('on', i < lv));
      r.btn.classList.toggle('maxed', maxed);
      r.btn.classList.toggle('poor', !maxed && coins < costs[lv]);
      r.btn.classList.toggle('ready', !maxed && coins >= costs[lv]);
      r.price.textContent = maxed ? 'Max' : formatMoney(costs[lv]);
      r.btn.disabled = maxed;
    }
  }

  flash(id: UpgradeId): void {
    const r = this.rows.get(id);
    const row = r?.btn.parentElement;
    if (!row) return;
    row.classList.remove('flash');
    void row.offsetWidth;
    row.classList.add('flash');
  }
}

const SECTIONS: { title: string; kinds: GemItem['kind'][] }[] = [
  { title: 'Boosts', kinds: ['boost', 'perk'] },
  { title: 'Hats', kinds: ['hat'] },
  { title: 'Clothes and shoes', kinds: ['outfit', 'shoes'] },
  { title: 'Chef colour', kinds: ['colour'] },
];

/** Gem shop: boosts and permanent perks first, then the wardrobe (hats, clothes, shoes, colours). */
export class GemShop {
  readonly sheet: Sheet;
  private readonly cards = new Map<string, { card: HTMLElement; btn: HTMLButtonElement; label: HTMLElement }>();
  onBuy: ((item: GemItem) => void) | null = null;
  readonly dailyBtn: HTMLButtonElement;
  private readonly dailyText: HTMLElement;

  constructor(parent: HTMLElement) {
    this.sheet = new Sheet(parent, 'Gem Shop', 'sheet-gem');
    this.dailyBtn = el('button', 'daily', this.sheet.body);
    this.dailyBtn.type = 'button';
    this.dailyBtn.appendChild(icon('chest', 'daily-ico'));
    const dt = el('div', 'daily-t', this.dailyBtn);
    el('div', 'daily-title', dt, 'Daily chest');
    this.dailyText = el('div', 'daily-sub', dt);
    for (const s of SECTIONS) {
      el('div', 'shop-h', this.sheet.body, s.title);
      const grid = el('div', 'shop-grid', this.sheet.body);
      for (const it of GEM_ITEMS.filter((g) => s.kinds.includes(g.kind))) {
        const card = el('div', `shop-card k-${it.kind}`, grid);
        const pic = el('div', 'shop-pic', card);
        if (it.model) {
          const img = el('img', '', pic);
          img.src = iconNamed(it.kind === 'shoes' ? `${it.model}_l` : it.model);
          img.alt = '';
        } else if (it.colour) {
          const sw = el('div', 'swatch', pic);
          sw.style.background = it.colour;
        } else {
          const img = el('img', '', pic);
          img.src = iconNamed(it.id === 'rush' ? 'item_cash' : it.id === 'golden_grill' ? 'st_grill' : 'red_carpet');
          img.alt = '';
        }
        el('div', 'shop-name', card, it.title);
        el('div', 'shop-blurb', card, it.blurb);
        const btn = el('button', 'gel gem-buy', card);
        btn.type = 'button';
        const gi = el('img', 'buy-ico', btn);
        gi.src = iconNamed('item_gem');
        gi.alt = '';
        const label = el('span', 'num', btn, `${it.cost}`);
        onTap(btn, () => this.onBuy?.(it));
        this.cards.set(it.id, { card, btn, label });
      }
    }
  }

  render(s: SaveData, dailyReady: boolean, dailyGems: number): void {
    this.dailyBtn.classList.toggle('ready', dailyReady);
    this.dailyText.textContent = dailyReady ? `Open for ${dailyGems} gems` : 'Come back tomorrow';
    for (const it of GEM_ITEMS) {
      const c = this.cards.get(it.id);
      if (!c) continue;
      const owned = s.owned.includes(it.id) || s.perks.includes(it.id);
      const equipped =
        (it.kind === 'hat' && s.equipped.hat === it.id) ||
        (it.kind === 'outfit' && s.equipped.outfit === it.id) ||
        (it.kind === 'shoes' && s.equipped.shoes === it.id) ||
        (it.kind === 'colour' && s.equipped.colour === it.colour);
      const wearable = it.kind === 'hat' || it.kind === 'outfit' || it.kind === 'shoes' || it.kind === 'colour';
      c.card.classList.toggle('owned', owned);
      c.card.classList.toggle('worn', equipped);
      c.btn.classList.toggle('poor', !owned && s.gems < it.cost);
      const img = c.btn.querySelector('img');
      if (img) img.style.display = owned ? 'none' : '';
      if (it.kind === 'perk' && owned) c.label.textContent = 'Owned';
      else if (owned && wearable) c.label.textContent = equipped ? 'Take off' : 'Wear';
      else c.label.textContent = `${it.cost}`;
      c.btn.disabled = it.kind === 'perk' && owned;
    }
  }
}
