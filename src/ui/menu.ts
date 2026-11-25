import { onTap } from './tap';
import { sfx } from '../audio/sfx';
import { MAPS } from '../game/maps';
import { mapProgress, type MapId, type SaveData } from '../game/save';
import { iconFor } from './icons';
import { el, Sheet } from './panels';
import { icon } from './svg';

const ORDER: MapId[] = ['barn', 'truck'];
const CARD_DISH: Record<MapId, 'burger' | 'hotdog'> = { barn: 'burger', truck: 'hotdog' };

/** Title screen laid over the live restaurant: the logo, the places you can cook at and one big Play. */
export class MainMenu {
  readonly root: HTMLDivElement;
  private readonly cards: HTMLDivElement;
  private readonly chestDot: HTMLSpanElement;
  readonly settingsBtn: HTMLButtonElement;
  readonly chestBtn: HTMLButtonElement;
  private readonly playBtn: HTMLButtonElement;
  private pick: MapId = 'barn';
  onPlay: ((map: MapId) => void) | null = null;
  onSelect: ((map: MapId) => void) | null = null;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'menu layer', parent);
    const logo = el('div', 'menu-logo', this.root);
    el('div', 'disp logo-a', logo, 'Order');
    el('div', 'disp logo-b', logo, 'Up!');
    el('div', 'logo-tag', logo, 'Cook it. Serve it. Grow it.');

    const corner = el('div', 'menu-corner', this.root);
    this.chestBtn = el('button', 'round-btn small chest-btn', corner);
    this.chestBtn.type = 'button';
    this.chestBtn.setAttribute('aria-label', 'Daily gift');
    this.chestBtn.appendChild(icon('chest'));
    this.chestDot = el('span', 'badge-dot', this.chestBtn);
    this.settingsBtn = el('button', 'round-btn small', corner);
    this.settingsBtn.type = 'button';
    this.settingsBtn.setAttribute('aria-label', 'Settings');
    this.settingsBtn.appendChild(icon('gear'));

    const foot = el('div', 'menu-foot', this.root);
    this.cards = el('div', 'map-cards', foot);
    this.playBtn = el('button', 'gel play-btn', foot);
    this.playBtn.type = 'button';
    this.playBtn.appendChild(icon('play', 'ico play-ico'));
    el('span', 'disp play-text', this.playBtn, 'Play');
    onTap(this.playBtn, () => {
      sfx.resume();
      sfx.play('pop');
      this.onPlay?.(this.pick);
    });
  }

  /** Rebuild the map cards from the save; locked places say where they are opened. */
  render(save: SaveData, dailyReady: boolean): void {
    this.pick = save.current;
    this.chestDot.style.display = dailyReady ? '' : 'none';
    this.cards.innerHTML = '';
    ORDER.forEach((id, i) => {
      const def = MAPS[id];
      const open = id === 'barn' || (save.maps.barn?.unlocked.includes('next') ?? false);
      const prog = mapProgress(save, id);
      const total = def.unlocks.length;
      const done = prog.unlocked.length;
      const card = el('button', `map-card ${def.theme}${open ? '' : ' locked'}${id === this.pick ? ' picked' : ''}`, this.cards);
      card.type = 'button';
      card.style.setProperty('--tilt', `${i % 2 ? 2 : -2}deg`);
      const pic = el('img', 'map-pic', card);
      pic.src = iconFor(CARD_DISH[id]);
      pic.alt = '';
      el('div', 'disp map-card-name', card, def.name);
      if (open) {
        const track = el('div', 'map-card-track', card);
        const fill = el('div', 'map-card-fill', track);
        fill.style.width = `${Math.round((done / total) * 100)}%`;
        el('div', 'map-card-sub', card, done >= total ? 'All built' : `${done} of ${total} built`);
      } else {
        card.appendChild(icon('lock', 'ico map-lock'));
        el('div', 'map-card-sub', card, `Open it at ${MAPS.barn.name}`);
      }
      onTap(card, () => {
        if (!open) {
          sfx.play('deny');
          card.classList.remove('shake');
          void card.offsetWidth;
          card.classList.add('shake');
          return;
        }
        sfx.play('click');
        this.pick = id;
        for (const c of this.cards.children) c.classList.toggle('picked', c === card);
        this.onSelect?.(id);
      });
    });
  }

  show(on: boolean): void {
    this.root.classList.toggle('on', on);
  }
}

/** Sound and music switches, and the way back to the title screen. */
export class SettingsPanel {
  readonly sheet: Sheet;
  private readonly toggles = new Map<'sound' | 'music', HTMLButtonElement>();
  readonly homeBtn: HTMLButtonElement;
  onToggle: ((what: 'sound' | 'music', on: boolean) => void) | null = null;

  constructor(parent: HTMLElement) {
    this.sheet = new Sheet(parent, 'Settings', 'sheet-set');
    this.row('sound', 'Sound effects');
    this.row('music', 'Music');
    this.homeBtn = el('button', 'gel home-btn', this.sheet.body);
    this.homeBtn.type = 'button';
    el('span', 'disp', this.homeBtn, 'Title screen');
  }

  private row(what: 'sound' | 'music', label: string): void {
    const row = el('div', 'set-row', this.sheet.body);
    row.appendChild(icon(what, 'ico set-ico'));
    el('div', 'set-label', row, label);
    const btn = el('button', 'toggle', row);
    btn.type = 'button';
    el('span', 'toggle-knob', btn);
    onTap(btn, () => {
      const on = !btn.classList.contains('on');
      this.set(what, on);
      this.onToggle?.(what, on);
    });
    this.toggles.set(what, btn);
  }

  set(what: 'sound' | 'music', on: boolean): void {
    const btn = this.toggles.get(what);
    if (!btn) return;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', `${what === 'sound' ? 'Sound effects' : 'Music'} ${on ? 'on' : 'off'}`);
  }

  show(inGame: boolean): void {
    this.homeBtn.style.display = inGame ? '' : 'none';
    this.sheet.show();
  }
}
