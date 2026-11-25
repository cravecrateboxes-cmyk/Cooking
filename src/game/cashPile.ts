import * as THREE from 'three';
import { spawn } from '../engine/assets';

const _v = new THREE.Vector3();
const COLS = 3;
const ROWS = 2;
const LAYER = 0.045;

/**
 * Money left on a counter or a table, drawn as a neat pile of bills that grows in layers. The value is
 * exact; the number of bills drawn is capped so a big pile stays cheap.
 */
export class CashPile {
  readonly root = new THREE.Group();
  value = 0;
  private bills: THREE.Object3D[] = [];
  private readonly maxBills = 36;

  constructor(x: number, y: number, z: number, rot = 0) {
    this.root.position.set(x, y, z);
    this.root.rotation.y = rot;
  }

  private slot(i: number, out: THREE.Vector3): THREE.Vector3 {
    const layer = Math.floor(i / (COLS * ROWS));
    const j = i % (COLS * ROWS);
    const c = j % COLS;
    const r = Math.floor(j / COLS);
    return out.set((c - 1) * 0.2, layer * LAYER, (r - 0.5) * 0.3);
  }

  /** World position where the next bill should land. */
  nextWorld(out: THREE.Vector3): THREE.Vector3 {
    this.slot(Math.min(this.bills.length, this.maxBills - 1), out);
    return this.root.localToWorld(out);
  }

  /** Adds value; returns a bill object to place (or null when the pile is visually full). */
  add(value: number, bill?: THREE.Object3D): void {
    this.value += value;
    if (this.bills.length >= this.maxBills) {
      bill?.removeFromParent();
      return;
    }
    const b = bill ?? spawn('item_cash');
    b.removeFromParent();
    this.slot(this.bills.length, b.position);
    b.rotation.set(0, (this.bills.length % 3) * 0.05 - 0.05, 0);
    b.scale.setScalar(1);
    this.root.add(b);
    this.bills.push(b);
  }

  get count(): number {
    return this.bills.length;
  }

  /** Take the top bill off for a collect flight; the last one carries any remainder. */
  takeTop(): { obj: THREE.Object3D; value: number } | null {
    const b = this.bills.pop();
    if (!b) {
      if (this.value > 0) {
        const v = this.value;
        this.value = 0;
        const obj = spawn('item_cash');
        this.root.getWorldPosition(_v);
        obj.position.copy(_v);
        return { obj, value: v };
      }
      return null;
    }
    const share = this.bills.length === 0 ? this.value : Math.min(this.value, Math.max(1, Math.round(this.value / (this.bills.length + 1))));
    this.value -= share;
    b.getWorldPosition(_v);
    b.removeFromParent();
    b.position.copy(_v);
    return { obj: b, value: share };
  }
}
