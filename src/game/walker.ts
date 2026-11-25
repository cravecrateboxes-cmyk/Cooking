import * as THREE from 'three';
import { Character } from '../engine/character';
import type { NavGrid } from './nav';
import { Stack } from './stack';

const _d = new THREE.Vector3();
const _v2 = new THREE.Vector2();

/** A character that walks along nav paths, turns smoothly and carries a stack. Base for customers and staff. */
export class Walker {
  readonly char: Character;
  readonly pos = new THREE.Vector3();
  facing = 0;
  speed: number;
  readonly vel = new THREE.Vector2();
  readonly stack: Stack;
  private path: THREE.Vector3[] = [];
  private arrive: (() => void) | null = null;
  private faceGoal: number | null = null;
  seated = false;
  private stepT = 0;
  onStep: ((p: THREE.Vector3) => void) | null = null;

  constructor(
    color: THREE.ColorRepresentation,
    public nav: NavGrid,
    speed: number,
    scale = 1,
  ) {
    this.char = new Character(color, scale);
    this.speed = speed;
    this.stack = new Stack(this.char.root);
  }

  place(p: THREE.Vector3, facing = 0): void {
    this.pos.copy(p);
    this.facing = facing;
    this.sync();
  }

  get moving(): boolean {
    return this.path.length > 0;
  }

  goTo(target: THREE.Vector3, done?: () => void, direct = false): void {
    this.path = direct ? [target.clone()] : this.nav.path(this.pos, target);
    this.arrive = done ?? null;
    this.faceGoal = null;
  }

  /** Follow an explicit list of waypoints (queues, doors) without pathfinding. */
  follow(points: THREE.Vector3[], done?: () => void): void {
    this.path = points.map((p) => p.clone());
    this.arrive = done ?? null;
    this.faceGoal = null;
  }

  stop(): void {
    this.path = [];
    this.arrive = null;
  }

  face(yaw: number): void {
    this.faceGoal = yaw;
  }

  update(dt: number): void {
    if (this.path.length && !this.seated) {
      const goal = this.path[0];
      _d.set(goal.x - this.pos.x, 0, goal.z - this.pos.z);
      const dist = _d.length();
      const step = this.speed * dt;
      if (dist <= step + 1e-3) {
        this.pos.x = goal.x;
        this.pos.z = goal.z;
        this.path.shift();
        if (!this.path.length) {
          this.vel.set(0, 0);
          const cb = this.arrive;
          this.arrive = null;
          cb?.();
        }
      } else {
        _d.multiplyScalar(1 / dist);
        this.pos.addScaledVector(_d, step);
        this.vel.set(_d.x * this.speed, _d.z * this.speed);
        this.turnTowards(Math.atan2(_d.x, _d.z), dt, 10);
      }
    } else {
      this.vel.set(0, 0);
      if (this.faceGoal !== null) this.turnTowards(this.faceGoal, dt, 8);
    }
    const sp = this.vel.length();
    if (!this.seated) this.char.locomote(sp, this.stack.items.length > 0, 3.2);
    if (sp > 0.5 && this.onStep) {
      this.stepT += dt * sp;
      if (this.stepT > 0.7) {
        this.stepT = 0;
        this.onStep(this.pos);
      }
    }
    _v2.copy(this.vel);
    this.stack.update(dt, _v2, this.facing);
    this.char.update(dt);
    this.sync();
  }

  protected turnTowards(target: number, dt: number, rate: number): void {
    let d = target - this.facing;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.facing += d * (1 - Math.exp(-dt * rate));
  }

  sync(): void {
    this.char.root.position.copy(this.pos);
    this.char.root.rotation.y = this.facing;
  }
}
