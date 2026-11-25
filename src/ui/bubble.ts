import type * as THREE from 'three';
import type { OrderLine } from '../game/customer';
import { iconFor } from './icons';
import type { Label, Labels } from './labels';

/** Speech bubble above a guest's head listing what they still want, with a patience ring. */
export class Bubble {
  readonly el: HTMLDivElement;
  private readonly label: Label;
  private readonly rows = new Map<string, HTMLSpanElement>();
  private readonly ring: HTMLDivElement;
  private shown = false;

  constructor(
    private readonly labels: Labels,
    anchor: THREE.Object3D,
    offsetY: number,
    vip: boolean,
  ) {
    this.el = document.createElement('div');
    this.el.className = vip ? 'bubble vip' : 'bubble';
    this.ring = document.createElement('div');
    this.ring.className = 'bubble-ring';
    this.el.appendChild(this.ring);
    this.label = labels.add(this.el, anchor, offsetY);
    this.label.visible = false;
  }

  show(lines: OrderLine[]): void {
    this.el.querySelectorAll('.bubble-item').forEach((n) => n.remove());
    this.rows.clear();
    for (const l of lines) {
      const s = document.createElement('span');
      s.className = 'bubble-item';
      const img = document.createElement('img');
      img.src = iconFor(l.dish);
      img.alt = l.dish;
      img.draggable = false;
      const n = document.createElement('b');
      s.append(img, n);
      this.el.appendChild(s);
      this.rows.set(l.dish, s);
    }
    this.update(lines);
    this.label.visible = true;
    if (!this.shown) {
      this.shown = true;
      this.el.classList.remove('pop');
      void this.el.offsetWidth;
      this.el.classList.add('pop');
    }
  }

  update(lines: OrderLine[]): void {
    for (const l of lines) {
      const s = this.rows.get(l.dish);
      if (!s) continue;
      const left = l.want - l.got;
      const b = s.querySelector('b');
      if (b) b.textContent = left > 1 ? `${left}` : '';
      s.classList.toggle('done', left <= 0);
    }
  }

  /** 0 = just ordered, 1 = out of patience */
  patience(k: number): void {
    const deg = Math.round(Math.min(1, k) * 360);
    this.ring.style.setProperty('--p', `${deg}deg`);
    this.el.classList.toggle('late', k >= 1);
  }

  bounce(): void {
    this.el.classList.remove('bump');
    void this.el.offsetWidth;
    this.el.classList.add('bump');
  }

  hide(): void {
    this.label.visible = false;
    this.shown = false;
  }

  remove(): void {
    this.labels.remove(this.label);
  }
}
