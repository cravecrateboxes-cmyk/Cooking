import * as THREE from 'three';
import { spawn } from '../engine/assets';
import { DISHES, TUNE, type Dish } from './config';
import type { StationDef } from './maps';
import { ghostOf } from './ghost';
import { Pad } from './pad';
import { Stack } from './stack';

const TOP = 0.7;

/** Where the dish takes shape on each machine, in the machine's own frame (+Z is the front). */
const WORK: Record<string, { at: [number, number, number]; raw?: string; steam: string; hot?: boolean }> = {
  st_grill: { at: [-0.1, TOP + 0.08, 0.02], raw: 'item_raw_patty', steam: '#ffd9b0', hot: true },
  st_fryer: { at: [-0.33, TOP + 0.2, -0.03], steam: '#ffe7a6', hot: true },
  st_soda: { at: [0, TOP + 0.04, 0.2], steam: '#bfe8ff' },
  st_sundae: { at: [0, TOP + 0.02, 0.24], steam: '#ffd6ec' },
  st_oven: { at: [0, TOP + 0.02, 0.42], raw: 'item_dough', steam: '#ffc88a', hot: true },
  st_hotdog: { at: [0, TOP + 0.1, 0.02], steam: '#ffd2a0', hot: true },
};

const _v = new THREE.Vector3();

export interface StationEvents {
  cooking(st: Station): void;
  done(st: Station, obj: THREE.Object3D, from: THREE.Vector3): void;
}

/**
 * A kitchen machine. Somebody has to stand on its pad for it to cook. Finished dishes go straight to that
 * somebody's arms, or onto the side tray when nobody can take them.
 */
export class Station {
  readonly root = new THREE.Group();
  readonly model: THREE.Object3D;
  readonly stand: THREE.Object3D;
  readonly pad: Pad;
  readonly tray: Stack;
  readonly dish: Dish;
  unlocked = false;
  /** how many people are working the station right now */
  workers = 0;
  progress = 0;
  private precursor: THREE.Object3D;
  /** see-through preview shown until bought; the world adds it to the scene */
  readonly ghost: THREE.Group;
  private readonly workAt: THREE.Vector3;
  readonly steamColor: string;
  /** a hot station sizzles with sparks while it cooks; a cold one sparkles */
  readonly hot: boolean;
  private pop = 1;
  steamT = 0;
  sparkT = 0;

  constructor(readonly def: StationDef) {
    this.dish = def.dish;
    this.root.position.set(def.x, 0, def.z);
    this.root.rotation.y = def.rot;
    this.model = spawn(def.model);
    this.root.add(this.model);
    // side stand with a tray where finished dishes wait for the waiter or the chef
    this.stand = new THREE.Group();
    const base = spawn('counter_end');
    base.scale.set(0.8, 1, 1.05);
    const tray = spawn('tray');
    tray.position.y = TOP;
    this.stand.add(base, tray);
    this.stand.position.set(1.1, 0, 0.05);
    this.root.add(this.stand);
    this.tray = new Stack(this.stand, TOP + 0.06, 0);
    const w = WORK[def.model];
    this.workAt = new THREE.Vector3(...w.at);
    this.steamColor = w.steam;
    this.hot = w.hot === true;
    this.precursor = spawn(w.raw ?? DISHES[def.dish].model);
    this.precursor.position.copy(this.workAt);
    this.precursor.scale.setScalar(0.001);
    this.root.add(this.precursor);
    const front = new THREE.Vector3(0, 0, 1.18).applyAxisAngle(THREE.Object3D.DEFAULT_UP, def.rot);
    this.pad = new Pad(def.x + front.x, def.z + front.z, 1.15, '#fff3c4', '#ff8a2b');
    this.root.visible = false;
    this.ghost = ghostOf([this.model, this.stand]);
    this.ghost.position.copy(this.root.position);
    this.ghost.rotation.copy(this.root.rotation);
  }

  /** Footprint for collision: machine plus its side stand. */
  footprint(): THREE.Box3 {
    this.root.updateMatrixWorld(true);
    return new THREE.Box3().setFromObject(this.root);
  }

  unlock(animate: boolean): void {
    this.unlocked = true;
    this.root.visible = true;
    this.ghost.visible = false;
    if (animate) this.pop = 0;
  }

  /** Point above the work area, used for particles and the progress pip. */
  workWorld(out: THREE.Vector3): THREE.Vector3 {
    return this.root.localToWorld(out.copy(this.workAt));
  }

  /**
   * Advance cooking. `canTake` says whether the person at the pad has room; `cookTime` is seconds per dish.
   * Returns true when a dish was finished this frame.
   */
  update(dt: number, cookTime: number, canTake: boolean, ev: StationEvents): boolean {
    if (this.pop < 1) {
      this.pop = Math.min(1, this.pop + dt * 2.6);
      const k = this.pop;
      const s = k < 1 ? 1 - Math.cos(k * 9) * Math.exp(-k * 5) * (1 - k) : 1;
      this.root.scale.set(s, 0.6 + 0.4 * s + Math.sin(k * Math.PI) * 0.15, s);
    }
    if (!this.unlocked) return false;
    const roomOnTray = this.tray.count < TUNE.stationTray;
    const working = this.workers > 0 && (canTake || roomOnTray);
    let finished = false;
    if (working) {
      // a little faster with two pairs of hands
      this.progress += (dt / cookTime) * (this.workers > 1 ? 1.35 : 1);
      ev.cooking(this);
      if (this.progress >= 1) {
        this.progress = 0;
        const obj = spawn(DISHES[this.dish].model);
        this.workWorld(_v);
        ev.done(this, obj, _v);
        finished = true;
      }
    } else if (this.workers === 0) {
      this.progress = Math.max(0, this.progress - dt * 0.5);
    }
    // the dish-in-progress grows and wobbles on the machine
    const p = this.progress;
    const wob = working ? Math.sin(performance.now() * 0.025) * 0.06 : 0;
    const s = p <= 0.001 ? 0.001 : 0.35 + p * 0.65;
    this.precursor.scale.set(s * (1 + wob), s * (1 - wob), s * (1 + wob));
    this.pad.fill = p;
    return finished;
  }
}
