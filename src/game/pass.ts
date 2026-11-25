import * as THREE from 'three';
import { spawn } from '../engine/assets';
import type { Dish } from './config';
import { Stack, type Item } from './stack';

const STILL = new THREE.Vector2();

/**
 * The pass: a tray on the counter where the chef stocks finished food. Guests at the front of the queue
 * are served from it automatically, so the chef never has to hold a dish while waiting for the right guest.
 * Two short piles side by side keep it readable instead of one tall tower.
 */
export class Pass {
  readonly root = new THREE.Group();
  private readonly piles: Stack[];

  constructor(x: number, y: number, z: number, rot: number, readonly cap: number) {
    this.root.position.set(x, y, z);
    this.root.rotation.y = rot;
    const tray = spawn('tray');
    tray.scale.set(1.25, 1, 1.05);
    this.root.add(tray);
    this.piles = [new Stack(this.root, 0.06, 0), new Stack(this.root, 0.06, 0)];
    this.piles[0].anchor.position.x = -0.16;
    this.piles[1].anchor.position.x = 0.16;
  }

  get count(): number {
    return this.piles[0].count + this.piles[1].count;
  }

  get full(): boolean {
    return this.count >= this.cap;
  }

  /** Reserve a spot on the lower pile; the dish flies to that pile's top. */
  reserve(): Stack {
    const p = this.piles[0].count <= this.piles[1].count ? this.piles[0] : this.piles[1];
    p.incoming++;
    return p;
  }

  has(want: (d: Dish) => boolean): boolean {
    for (const p of this.piles) for (const it of p.items) if (it.kind !== 'plate' && want(it.kind)) return true;
    return false;
  }

  /** Take the highest dish the guest wants, from either pile. */
  take(want: (d: Dish) => boolean): Item | null {
    for (const p of this.piles) {
      for (let i = p.items.length - 1; i >= 0; i--) {
        const k = p.items[i].kind;
        if (k !== 'plate' && want(k)) return p.take(k);
      }
    }
    return null;
  }

  update(dt: number): void {
    for (const p of this.piles) p.update(dt, STILL, 0);
  }

  clear(): void {
    for (const p of this.piles) p.clear();
  }
}
