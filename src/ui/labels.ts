import * as THREE from 'three';

/** DOM elements pinned to points in the 3D world (order bubbles, prices, floating numbers). */
export interface Label {
  el: HTMLElement;
  anchor: THREE.Object3D | null;
  pos: THREE.Vector3;
  offsetY: number;
  /** extra screen offset in px, e.g. for floaters that rise */
  dy: number;
  visible: boolean;
  scale: number;
  /** last opacity written, to skip redundant style writes */
  op: number;
  /** half the element's width, measured now and then, so wide tags stay fully on screen */
  half: number;
}

const _v = new THREE.Vector3();

export class Labels {
  private readonly list: Label[] = [];
  private w = 1;
  private h = 1;
  /** HUD zoom, so the top bar and the corner buttons keep their clear zones at any size */
  private ui = 1;

  constructor(readonly layer: HTMLElement) {}

  resize(w: number, h: number, ui: number): void {
    this.w = w;
    this.h = h;
    this.ui = ui;
  }

  add(content: HTMLElement, anchor: THREE.Object3D | null, offsetY: number, pos?: THREE.Vector3): Label {
    // the wrapper carries the screen position, so the content's own pop and shake animations
    // can use transform without throwing it to the corner of the screen
    const el = document.createElement('div');
    el.className = 'lbl';
    el.appendChild(content);
    this.layer.appendChild(el);
    const l: Label = { el, anchor, pos: pos ? pos.clone() : new THREE.Vector3(), offsetY, dy: 0, visible: true, scale: 1, op: -1, half: 0 };
    this.list.push(l);
    return l;
  }

  remove(l: Label): void {
    const i = this.list.indexOf(l);
    if (i >= 0) this.list.splice(i, 1);
    l.el.remove();
  }

  private tick = 0;

  update(camera: THREE.Camera): void {
    const measure = (this.tick++ & 31) === 0;
    for (const l of this.list) {
      if (!l.visible) {
        if (l.el.style.display !== 'none') l.el.style.display = 'none';
        continue;
      }
      if (l.anchor) l.anchor.getWorldPosition(_v);
      else _v.copy(l.pos);
      _v.y += l.offsetY;
      _v.project(camera);
      if (_v.z > 1) {
        l.el.style.display = 'none';
        continue;
      }
      if (l.el.style.display === 'none') {
        l.el.style.display = '';
        l.half = 0;
      }
      if (measure || l.half === 0) l.half = (l.el.offsetWidth * l.scale) / 2 + 6;
      // keep tags on screen, fade them out under the top bar and the corner buttons
      const x = Math.min(this.w - l.half, Math.max(l.half, (_v.x * 0.5 + 0.5) * this.w));
      const y = (-_v.y * 0.5 + 0.5) * this.h + l.dy;
      const top = (y - (70 * this.ui + 40)) / 40;
      const corner = Math.max((this.w - 120 * this.ui - x) / 40, (this.h - 220 * this.ui - y + 40) / 40);
      const fade = Math.min(1, Math.max(0, Math.min(top, corner)));
      const op = Math.round(fade * 20) / 20;
      if (l.op !== op) {
        l.op = op;
        l.el.style.opacity = String(op);
      }
      l.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -100%) scale(${l.scale.toFixed(3)})`;
    }
  }
}
