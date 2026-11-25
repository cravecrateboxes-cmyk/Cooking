import * as THREE from 'three';
import { Character } from '../engine/character';
import { TUNE } from './config';
import type { Rect } from './nav';
import { Stack } from './stack';

const _wish = new THREE.Vector3();

/** The chef: joystick-driven, collides with furniture, carries a wobbly stack. */
export class Player {
  readonly char: Character;
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector2();
  readonly stack: Stack;
  facing = 0;
  speed: number = TUNE.player.speed[0];
  capacity: number = TUNE.player.capacity[0];
  obstacles: Rect[] = [];
  bounds: Rect = { minX: -10, minZ: -10, maxX: 10, maxZ: 10 };
  private stepT = 0;
  onStep: (() => void) | null = null;

  constructor(colour: THREE.ColorRepresentation) {
    this.char = new Character(colour, 1.08);
    this.stack = new Stack(this.char.root);
  }

  get full(): boolean {
    return this.stack.count >= this.capacity;
  }

  canTakeFood(): boolean {
    return !this.full && !this.stack.holdsPlates;
  }

  place(x: number, z: number, facing: number): void {
    this.pos.set(x, 0, z);
    this.vel.set(0, 0);
    this.facing = facing;
    this.sync();
  }

  /** `dir` is a world-space XZ direction with length 0..1. */
  update(dt: number, dir: THREE.Vector3): void {
    _wish.copy(dir).multiplyScalar(this.speed);
    const has = dir.lengthSq() > 1e-4;
    const rate = has ? TUNE.player.accel : TUNE.player.decel;
    const k = 1 - Math.exp(-dt * rate * 0.25);
    this.vel.x += (_wish.x - this.vel.x) * k;
    this.vel.y += (_wish.z - this.vel.y) * k;
    if (!has && this.vel.lengthSq() < 0.01) this.vel.set(0, 0);
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.y * dt;
    this.collide();
    if (has) {
      const target = Math.atan2(dir.x, dir.z);
      let d = target - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * (1 - Math.exp(-dt * TUNE.player.turn));
    }
    const sp = this.vel.length();
    this.char.locomote(sp, this.stack.items.length > 0, 3.4);
    if (sp > 1) {
      this.stepT += dt * sp;
      if (this.stepT > 0.62) {
        this.stepT = 0;
        this.onStep?.();
      }
    }
    this.stack.update(dt, this.vel, this.facing);
    this.char.update(dt);
    this.sync();
  }

  private collide(): void {
    const r = TUNE.player.radius;
    const b = this.bounds;
    for (let pass = 0; pass < 2; pass++) {
      for (const o of this.obstacles) {
        const cx = THREE.MathUtils.clamp(this.pos.x, o.minX, o.maxX);
        const cz = THREE.MathUtils.clamp(this.pos.z, o.minZ, o.maxZ);
        const dx = this.pos.x - cx;
        const dz = this.pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= r * r) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          const push = r - d;
          const nx = dx / d;
          const nz = dz / d;
          this.pos.x += nx * push;
          this.pos.z += nz * push;
          // keep sliding along the edge instead of stopping dead
          const vn = this.vel.x * nx + this.vel.y * nz;
          if (vn < 0) {
            this.vel.x -= vn * nx;
            this.vel.y -= vn * nz;
          }
        } else {
          // centre inside the box: push out along the shallowest axis
          const left = this.pos.x - o.minX;
          const right = o.maxX - this.pos.x;
          const top = this.pos.z - o.minZ;
          const bottom = o.maxZ - this.pos.z;
          const m = Math.min(left, right, top, bottom);
          if (m === left) this.pos.x = o.minX - r;
          else if (m === right) this.pos.x = o.maxX + r;
          else if (m === top) this.pos.z = o.minZ - r;
          else this.pos.z = o.maxZ + r;
        }
      }
    }
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, b.minX + r, b.maxX - r);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, b.minZ + r, b.maxZ - r);
  }

  sync(): void {
    this.char.root.position.copy(this.pos);
    this.char.root.rotation.y = this.facing;
  }
}
