import * as THREE from 'three';
import { spawn } from '../engine/assets';
import { CashPile } from './cashPile';
import type { Customer } from './customer';
import type { TableDef } from './maps';
import { ghostOf } from './ghost';
import { Pad } from './pad';

const TOP = { table: 0.67, picnic_table: 0.74 } as const;

export interface Seat {
  pos: THREE.Vector3;
  rot: number;
  chair: THREE.Object3D | null;
  guest: Customer | null;
  /** dishes set down in front of the guest */
  food: THREE.Object3D[];
}

/** A table with its chairs, the money guests leave, and the dirty plates they leave behind. */
export class Table {
  readonly root = new THREE.Group();
  readonly seats: Seat[] = [];
  readonly cash: CashPile;
  readonly plates: THREE.Object3D[] = [];
  readonly top: number;
  readonly area: Pad;
  unlocked = false;
  /** see-through preview shown until bought; the world adds it to the scene */
  readonly ghost: THREE.Group;
  private pop = 1;

  constructor(readonly def: TableDef) {
    this.top = TOP[def.model];
    const t = spawn(def.model);
    t.position.set(def.x, 0, def.z);
    t.rotation.y = def.rot;
    this.root.add(t);
    for (const s of def.seats) {
      let chair: THREE.Object3D | null = null;
      if (def.model === 'table') {
        chair = spawn('chair');
        chair.position.set(s.x, 0, s.z);
        chair.rotation.y = s.rot;
        this.root.add(chair);
      }
      this.seats.push({ pos: new THREE.Vector3(s.x, 0, s.z), rot: s.rot, chair, guest: null, food: [] });
    }
    this.cash = new CashPile(def.x, this.top, def.z + (def.model === 'table' ? 0.22 : 0), def.rot);
    this.cash.root.scale.setScalar(0.8);
    this.root.add(this.cash.root);
    // serving zone drawn around the table, only visible while someone waits
    this.area = new Pad(def.x, def.z, 2.9, '#ffe9a8', '#ff8a2b');
    this.area.mesh.visible = false;
    this.root.visible = false;
    this.ghost = ghostOf([t, ...this.seats.flatMap((s) => (s.chair ? [s.chair] : []))]);
  }

  unlock(animate: boolean): void {
    this.unlocked = true;
    this.root.visible = true;
    this.ghost.visible = false;
    if (animate) this.pop = 0;
  }

  get dirty(): boolean {
    return this.plates.length > 0;
  }

  get busy(): boolean {
    return this.seats.some((s) => s.guest !== null);
  }

  freeSeat(): number {
    if (!this.unlocked || this.dirty || this.cash.value > 0) return -1;
    return this.seats.findIndex((s) => s.guest === null);
  }

  /** Where a dish lands in front of seat i. */
  placeFor(i: number, k: number, out: THREE.Vector3): THREE.Vector3 {
    const s = this.seats[i];
    const dx = this.def.x - s.pos.x;
    const dz = this.def.z - s.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    const side = (k % 2 === 0 ? 1 : -1) * Math.ceil(k / 2) * 0.2;
    const px = -dz / len;
    const pz = dx / len;
    return out.set(s.pos.x + (dx / len) * 0.62 + px * side, this.top, s.pos.z + (dz / len) * 0.62 + pz * side);
  }

  addPlate(): THREE.Object3D {
    const p = spawn('item_dirty_plate');
    p.position.set(this.def.x - 0.15, this.top + this.plates.length * 0.045, this.def.z - 0.12);
    p.rotation.y = this.plates.length * 0.7;
    this.root.add(p);
    this.plates.push(p);
    return p;
  }

  update(dt: number): void {
    if (this.pop < 1) {
      this.pop = Math.min(1, this.pop + dt * 2.6);
      const k = this.pop;
      const s = 1 - Math.cos(k * 9) * Math.exp(-k * 5) * (1 - k);
      for (const c of this.root.children) {
        if (c === this.cash.root) continue;
        c.scale.set(s, 0.6 + 0.4 * s, s);
      }
    }
  }
}
