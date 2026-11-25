/**
 * Floating joystick: press anywhere on the play area, drag to steer. Also WASD / arrow keys.
 * Output is a screen-space direction (x right, y down) with magnitude 0..1.
 */
/** Anything the player taps rather than drags on. */
const UI = 'button, a, input, select, label, .sheet, .scrim, .wallet';

export class Input {
  readonly dir = { x: 0, y: 0 };
  active = false;
  enabled = true;
  private pointerId: number | null = null;
  private ox = 0;
  private oy = 0;
  private stickX = 0;
  private stickY = 0;
  private keys = new Set<string>();
  private readonly base: HTMLDivElement;
  private readonly knob: HTMLDivElement;
  private radius = 56;
  onFirstInput: (() => void) | null = null;

  constructor(private readonly surface: HTMLElement, layer: HTMLElement) {
    this.base = document.createElement('div');
    this.base.className = 'stick';
    this.knob = document.createElement('div');
    this.knob.className = 'stick-knob';
    this.base.appendChild(this.knob);
    layer.appendChild(this.base);

    // listen on the window, not the canvas: overlays above the canvas must never swallow the thumb
    window.addEventListener('pointerdown', this.down, { passive: false });
    window.addEventListener('pointermove', this.move, { passive: false });
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointercancel', this.up);
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      const k = norm(e.key);
      if (k) {
        this.keys.add(k);
        this.onFirstInput?.();
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      const k = norm(e.key);
      if (k) this.keys.delete(k);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.release();
    });
  }

  private down = (e: PointerEvent): void => {
    if (!this.enabled || this.pointerId !== null) return;
    if (e.target !== this.surface && e.target instanceof Element && e.target.closest(UI)) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    this.radius = Math.max(44, Math.min(70, Math.min(innerWidth, innerHeight) * 0.13));
    this.ox = e.clientX;
    this.oy = e.clientY;
    this.stickX = 0;
    this.stickY = 0;
    this.base.style.setProperty('--r', `${this.radius}px`);
    this.base.style.transform = `translate(${this.ox}px, ${this.oy}px)`;
    this.base.classList.add('on');
    this.knob.style.transform = 'translate(0px, 0px)';
    this.onFirstInput?.();
  };

  private move = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    e.preventDefault();
    let dx = e.clientX - this.ox;
    let dy = e.clientY - this.oy;
    const len = Math.hypot(dx, dy);
    const r = this.radius;
    if (len > r) {
      // drag the base along so the stick never "runs out" when the thumb travels far
      const over = len - r;
      this.ox += (dx / len) * over;
      this.oy += (dy / len) * over;
      dx = e.clientX - this.ox;
      dy = e.clientY - this.oy;
      this.base.style.transform = `translate(${this.ox}px, ${this.oy}px)`;
    }
    this.stickX = dx / r;
    this.stickY = dy / r;
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  private up = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    this.release();
  };

  release(): void {
    this.pointerId = null;
    this.stickX = 0;
    this.stickY = 0;
    this.base.classList.remove('on');
  }

  update(): void {
    let x = 0;
    let y = 0;
    if (this.enabled) {
      if (this.keys.has('l')) x -= 1;
      if (this.keys.has('r')) x += 1;
      if (this.keys.has('u')) y -= 1;
      if (this.keys.has('d')) y += 1;
      const kl = Math.hypot(x, y);
      if (kl > 0) {
        x /= kl;
        y /= kl;
      } else {
        const m = Math.hypot(this.stickX, this.stickY);
        const dead = 0.12;
        if (m > dead) {
          // remap so the response starts at zero just past the dead zone and reaches 1 well before the rim
          const k = Math.min(1, (m - dead) / (0.75 - dead));
          x = (this.stickX / m) * k;
          y = (this.stickY / m) * k;
        }
      }
    }
    this.dir.x = x;
    this.dir.y = y;
    this.active = x !== 0 || y !== 0;
  }

  get touching(): boolean {
    return this.pointerId !== null;
  }

  dispose(): void {
    window.removeEventListener('pointerdown', this.down);
  }
}

function norm(key: string): string | null {
  switch (key) {
    case 'ArrowLeft':
    case 'a':
    case 'A':
      return 'l';
    case 'ArrowRight':
    case 'd':
    case 'D':
      return 'r';
    case 'ArrowUp':
    case 'w':
    case 'W':
      return 'u';
    case 'ArrowDown':
    case 's':
    case 'S':
      return 'd';
    default:
      return null;
  }
}
