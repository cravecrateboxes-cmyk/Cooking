import { iconNamed } from './icons';
import { icon } from './svg';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent?: HTMLElement): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  parent?.appendChild(e);
  return e;
}

/** Counter that ticks towards its target instead of jumping, and pops when it changes. */
class Counter {
  shown = 0;
  target = 0;
  constructor(
    readonly box: HTMLElement,
    readonly text: HTMLElement,
  ) {}

  set(v: number, instant = false): void {
    this.target = v;
    if (instant) this.shown = v;
    this.draw();
  }

  pop(): void {
    this.box.classList.remove('pop');
    void this.box.offsetWidth;
    this.box.classList.add('pop');
  }

  tick(dt: number): void {
    if (this.shown === this.target) return;
    const d = this.target - this.shown;
    const step = Math.sign(d) * Math.max(1, Math.ceil(Math.abs(d) * Math.min(1, dt * 12)));
    this.shown = Math.abs(step) >= Math.abs(d) ? this.target : this.shown + step;
    this.draw();
  }

  private draw(): void {
    this.text.textContent = formatMoney(this.shown);
  }
}

export function formatMoney(v: number): string {
  if (v >= 100000) return `${(v / 1000).toFixed(v >= 1e6 ? 0 : 1).replace(/\.0$/, '')}K`;
  return Math.floor(v).toLocaleString('en-US');
}

/** In-game heads-up display: wallet in the top corners, the map's progress, and two thumb buttons. */
export class Hud {
  readonly root: HTMLDivElement;
  readonly coins: Counter;
  readonly gems: Counter;
  private readonly bar: HTMLDivElement;
  private readonly barText: HTMLSpanElement;
  private readonly mapName: HTMLSpanElement;
  private readonly bannerEl: HTMLDivElement;
  private bannerTimer = 0;
  readonly upgradeBtn: HTMLButtonElement;
  readonly shopBtn: HTMLButtonElement;
  readonly menuBtn: HTMLButtonElement;
  readonly questBtn: HTMLButtonElement;
  private readonly questBadge: HTMLSpanElement;
  readonly hint: HTMLDivElement;
  private readonly fly: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'hud layer', parent);
    const top = el('div', 'hud-top', this.root);
    const coinBox = el('div', 'wallet coin', top);
    const ci = el('img', 'wallet-ico', coinBox);
    ci.src = iconNamed('item_coin');
    ci.alt = '';
    const ct = el('span', 'num wallet-n', coinBox);
    this.coins = new Counter(coinBox, ct);
    const mid = el('div', 'map-prog', top);
    this.mapName = el('span', 'map-name', mid);
    const track = el('div', 'map-track', mid);
    this.bar = el('div', 'map-fill', track);
    this.barText = el('span', 'num map-n', track);
    const gemBox = el('button', 'wallet gem', top);
    gemBox.type = 'button';
    gemBox.setAttribute('aria-label', 'Gem shop');
    const gi = el('img', 'wallet-ico', gemBox);
    gi.src = iconNamed('item_gem');
    gi.alt = '';
    const gt = el('span', 'num wallet-n', gemBox);
    el('span', 'wallet-plus', gemBox).textContent = '+';
    this.gems = new Counter(gemBox, gt);
    this.shopBtn = gemBox;

    const side = el('div', 'hud-side', this.root);
    this.menuBtn = el('button', 'round-btn small', side);
    this.menuBtn.type = 'button';
    this.menuBtn.setAttribute('aria-label', 'Menu');
    this.menuBtn.appendChild(icon('gear'));
    this.questBtn = el('button', 'round-btn small quest', side);
    this.questBtn.type = 'button';
    this.questBtn.setAttribute('aria-label', 'Daily quests');
    this.questBtn.appendChild(icon('quest'));
    this.questBadge = el('span', 'num badge', this.questBtn);
    this.upgradeBtn = el('button', 'round-btn up', side);
    this.upgradeBtn.type = 'button';
    this.upgradeBtn.setAttribute('aria-label', 'Upgrades');
    this.upgradeBtn.appendChild(icon('upgrade'));
    el('span', 'round-label', this.upgradeBtn).textContent = 'Upgrades';

    this.bannerEl = el('div', 'banner', this.root);
    this.hint = el('div', 'hint', this.root);
    this.fly = el('div', 'fly-layer layer', this.root);
  }

  setMap(name: string): void {
    this.mapName.textContent = name;
    // a new map starts empty: snap the bar back instead of letting it slide down from the old map's value
    this.bar.style.transition = 'none';
    this.bar.style.width = '0%';
    void this.bar.offsetWidth;
    this.bar.style.transition = '';
  }

  /** Bigger screens get a proportionally bigger HUD, so it never reads as tiny on a laptop or tablet. */
  resize(w: number, h: number): number {
    const ui = Math.min(1.4, Math.max(1, Math.min(w / 430, h / 700)));
    document.documentElement.style.setProperty('--ui', ui.toFixed(3));
    return ui;
  }

  progress(done: number, total: number): void {
    this.bar.style.width = `${Math.round((done / total) * 100)}%`;
    this.barText.textContent = `${done}/${total}`;
  }

  /** Flashes the name of whatever was just bought across the top of the screen. */
  banner(title: string, sub: string): void {
    this.bannerEl.innerHTML = '';
    el('div', 'disp banner-title', this.bannerEl).textContent = title;
    if (sub) el('div', 'banner-sub', this.bannerEl).textContent = sub;
    this.bannerEl.classList.remove('on');
    void this.bannerEl.offsetWidth;
    this.bannerEl.classList.add('on');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => this.bannerEl.classList.remove('on'), 2200);
  }

  /** Red dot with the number of quests waiting to be claimed. */
  setQuestBadge(n: number): void {
    this.questBadge.textContent = String(n);
    this.questBtn.classList.toggle('has', n > 0);
  }

  setHint(text: string | null): void {
    if (!text) {
      this.hint.classList.remove('on');
      return;
    }
    if (this.hint.textContent !== text) this.hint.textContent = text;
    this.hint.classList.add('on');
  }

  /** A coin or gem image flies from a screen point into its wallet. */
  flyTo(kind: 'coin' | 'gem', x: number, y: number, done: () => void): void {
    const target = (kind === 'coin' ? this.coins.box : this.gems.box).querySelector('img');
    if (!target) return;
    const r = target.getBoundingClientRect();
    const img = el('img', 'fly-ico', this.fly);
    img.src = iconNamed(kind === 'coin' ? 'item_coin' : 'item_gem');
    img.alt = '';
    const tx = r.left + r.width / 2;
    const ty = r.top + r.height / 2;
    const midX = x + (tx - x) * 0.3 + (Math.random() - 0.5) * 60;
    const midY = Math.min(y, ty) - 40 - Math.random() * 40;
    const anim = img.animate(
      [
        { transform: `translate(${x}px, ${y}px) scale(0.6)` },
        { transform: `translate(${midX}px, ${midY}px) scale(1.1)`, offset: 0.4 },
        { transform: `translate(${tx}px, ${ty}px) scale(0.8)` },
      ],
      { duration: 520 + Math.random() * 140, easing: 'cubic-bezier(0.5, 0, 0.75, 0)' },
    );
    anim.onfinish = () => {
      img.remove();
      done();
    };
  }

  update(dt: number): void {
    this.coins.tick(dt);
    this.gems.tick(dt);
  }

  show(on: boolean): void {
    this.root.style.display = on ? '' : 'none';
  }
}
