import * as THREE from 'three';
import { DISHES, type Dish } from './config';

export type ItemKind = Dish | 'plate';

export interface Item {
  kind: ItemKind;
  obj: THREE.Object3D;
  /** wobble offset, springs back to zero */
  sway: THREE.Vector2;
  swayVel: THREE.Vector2;
}

export function itemHeight(kind: ItemKind): number {
  return kind === 'plate' ? 0.045 : DISHES[kind].stackH;
}

const _v = new THREE.Vector3();

/**
 * A wobbly pile of items held in a character's arms. Higher items lag further behind when the carrier
 * accelerates, then spring back, so a tall stack visibly sways.
 */
export class Stack {
  readonly anchor = new THREE.Group();
  readonly items: Item[] = [];
  private readonly lastVel = new THREE.Vector2();
  /** items currently flying in, reserved so capacity checks stay honest */
  incoming = 0;

  constructor(parent: THREE.Object3D, y = 0.56, forward = 0.34) {
    this.anchor.position.set(0, y, forward);
    parent.add(this.anchor);
  }

  get count(): number {
    return this.items.length + this.incoming;
  }

  heightAt(index: number): number {
    let h = 0;
    for (let i = 0; i < index && i < this.items.length; i++) h += itemHeight(this.items[i].kind);
    return h;
  }

  /** World position where the next item will land. */
  topWorld(out: THREE.Vector3): THREE.Vector3 {
    out.set(0, this.heightAt(this.items.length), 0);
    return this.anchor.localToWorld(out);
  }

  has(kind: ItemKind): boolean {
    return this.items.some((i) => i.kind === kind);
  }

  countOf(kind: ItemKind): number {
    let n = 0;
    for (const i of this.items) if (i.kind === kind) n++;
    return n;
  }

  get holdsPlates(): boolean {
    return this.items.length > 0 && this.items[0].kind === 'plate';
  }

  get holdsFood(): boolean {
    return this.items.length > 0 && this.items[0].kind !== 'plate';
  }

  push(kind: ItemKind, obj: THREE.Object3D): void {
    obj.removeFromParent();
    obj.position.set(0, this.heightAt(this.items.length), 0);
    obj.rotation.set(0, 0, 0);
    obj.scale.setScalar(1);
    this.anchor.add(obj);
    const it: Item = { kind, obj, sway: new THREE.Vector2(), swayVel: new THREE.Vector2() };
    this.items.push(it);
    // landing squash on the new top item
    it.swayVel.set(0, 0);
  }

  /** Remove the topmost item of a kind (or the top item) and hand its object back in world space. */
  take(kind?: ItemKind): Item | null {
    let idx = this.items.length - 1;
    if (kind) {
      idx = -1;
      for (let i = this.items.length - 1; i >= 0; i--) {
        if (this.items[i].kind === kind) {
          idx = i;
          break;
        }
      }
    }
    if (idx < 0) return null;
    const [it] = this.items.splice(idx, 1);
    it.obj.getWorldPosition(_v);
    const q = new THREE.Quaternion();
    it.obj.getWorldQuaternion(q);
    it.obj.removeFromParent();
    it.obj.position.copy(_v);
    it.obj.quaternion.copy(q);
    return it;
  }

  /**
   * Sway the pile against the carrier's acceleration. `vel` is the carrier's world XZ velocity, `facing`
   * its yaw, so the sway is expressed in the carrier's local frame.
   */
  update(dt: number, vel: THREE.Vector2, facing: number): void {
    const ax = (vel.x - this.lastVel.x) / Math.max(dt, 1e-3);
    const az = (vel.y - this.lastVel.y) / Math.max(dt, 1e-3);
    this.lastVel.copy(vel);
    const c = Math.cos(-facing);
    const s = Math.sin(-facing);
    const lx = ax * c - az * s;
    const lz = ax * s + az * c;
    let y = 0;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      // spring towards a lag proportional to acceleration and height in the pile
      const lag = 0.0011 * (i + 1);
      const tx = THREE.MathUtils.clamp(-lx * lag, -0.18, 0.18);
      const tz = THREE.MathUtils.clamp(-lz * lag, -0.18, 0.18);
      it.swayVel.x += (140 * (tx - it.sway.x) - 11 * it.swayVel.x) * dt;
      it.swayVel.y += (140 * (tz - it.sway.y) - 11 * it.swayVel.y) * dt;
      it.sway.addScaledVector(it.swayVel, dt);
      it.obj.position.set(it.sway.x, y, it.sway.y);
      it.obj.rotation.set(it.sway.y * 1.4, 0, -it.sway.x * 1.4);
      y += itemHeight(it.kind);
    }
  }

  clear(): void {
    for (const it of this.items) it.obj.removeFromParent();
    this.items.length = 0;
    this.incoming = 0;
  }
}
