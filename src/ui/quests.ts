import { questText, type Quest, type QuestDay, type QuestKind } from '../game/quests';
import { formatMoney } from './hud';
import { iconFor, iconNamed } from './icons';
import { el, Sheet } from './panels';
import { icon } from './svg';
import { onTap } from './tap';

const PIC: Record<QuestKind, () => string> = {
  serve: () => iconFor('burger'),
  seated: () => iconNamed('table'),
  earn: () => iconNamed('item_cash'),
  combo: () => iconNamed('quest_combo'),
  vip: () => iconNamed('cos_hat_crown'),
};
const TONE: Record<QuestKind, string> = { serve: 't-orange', seated: 't-teal', earn: 't-blue', combo: 't-pink', vip: 't-red' };

/** Today's three quests: what each asks, how far along it is, and a Claim button once it is done. */
export class QuestPanel {
  readonly sheet: Sheet;
  onClaim: ((i: number) => void) | null = null;
  private readonly list: HTMLDivElement;
  private readonly reset: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.sheet = new Sheet(parent, 'Daily quests', 'sheet-quest');
    this.list = el('div', 'quest-list', this.sheet.body);
    this.reset = el('div', 'quest-reset', this.sheet.body);
  }

  render(q: QuestDay): void {
    this.list.innerHTML = '';
    q.list.forEach((it, i) => this.row(it, i));
    const left = new Date();
    left.setHours(24, 0, 0, 0);
    const mins = Math.max(1, Math.round((left.getTime() - Date.now()) / 60000));
    const h = Math.floor(mins / 60);
    this.reset.textContent = `New quests in ${h ? `${h} h ` : ''}${mins % 60} min`;
  }

  private row(it: Quest, i: number): void {
    const done = it.got >= it.goal;
    const row = el('div', `up-row quest-row ${TONE[it.kind]}${it.claimed ? ' claimed' : ''}`, this.list);
    const pic = el('img', 'up-pic', row);
    pic.src = PIC[it.kind]();
    pic.alt = '';
    const mid = el('div', 'up-mid', row);
    el('div', 'up-title quest-title', mid, questText(it));
    const track = el('div', 'quest-track', mid);
    el('div', 'quest-fill', track).style.width = `${Math.round((it.got / it.goal) * 100)}%`;
    el('span', 'num quest-n', track, `${formatMoney(it.got)}/${formatMoney(it.goal)}`);
    const btn = el('button', 'gel buy', row);
    btn.type = 'button';
    if (it.claimed) {
      btn.classList.add('maxed');
      btn.disabled = true;
      btn.appendChild(icon('check', 'buy-ico'));
      return;
    }
    const gi = el('img', 'buy-ico', btn);
    gi.src = iconNamed('item_gem');
    gi.alt = '';
    el('span', 'num', btn, String(it.gems));
    btn.classList.toggle('poor', !done);
    btn.classList.toggle('ready', done);
    btn.disabled = !done;
    onTap(btn, () => this.onClaim?.(i));
  }
}
