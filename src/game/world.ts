import * as THREE from 'three';
import { sfx } from '../audio/sfx';
import { spawn } from '../engine/assets';
import { Tweens } from '../engine/tween';
import { Particles } from '../fx/particles';
import type { Labels } from '../ui/labels';
import { CashPile } from './cashPile';
import { TUNE, type Dish } from './config';
import { buildBeach } from './beach';
import { buildRestaurant, updateTraffic, type Env } from './environment';
import { Flights } from './flights';
import { ghostOf, tickGhosts } from './ghost';
import { MAPS, type MapDef } from './maps';
import { NavGrid, type Rect } from './nav';
import { Pass } from './pass';
import { Pad } from './pad';
import { Player } from './player';
import { Rng } from './rng';
import { mapProgress, writeSave, type MapId, type MapProgress, type SaveData } from './save';
import { Service } from './service';
import { Staffing } from './staff';
import { Station } from './station';
import { Table } from './table';
import { Unlocks } from './unlocks';
import { Interact } from './interact';

export interface WorldUI {
  money(coins: number, gems: number, from?: THREE.Vector3, kind?: 'coin' | 'gem'): void;
  float(at: THREE.Vector3, text: string, kind: 'coin' | 'gem' | 'tip' | 'info'): void;
  progress(done: number, total: number): void;
  banner(title: string, sub: string): void;
  openUpgrades(): void;
  /** walk onto a travel pad: go to that map */
  nextMap(map: MapId): void;
}

/** One playable map with everything on it. Systems live in their own modules and share this state. */
export class World {
  readonly scene = new THREE.Scene();
  readonly def: MapDef;
  readonly env: Env;
  readonly fx = new Particles();
  readonly flights: Flights;
  readonly tweens = new Tweens();
  readonly rng = new Rng(1234);
  readonly player: Player;
  readonly stations: Station[] = [];
  readonly tables: Table[] = [];
  readonly cash: CashPile;
  readonly servePad: Pad;
  readonly sinkPad: Pad;
  readonly bin: THREE.Object3D;
  readonly pass: Pass;
  readonly binPad: Pad;
  readonly boardPad: Pad;
  readonly sink: THREE.Object3D;
  readonly board: THREE.Object3D;
  readonly register: THREE.Object3D;
  readonly counterRoot = new THREE.Group();
  sinkOn = false;
  sinkGhost: THREE.Group;
  nav: NavGrid;
  staticObstacles: Rect[];
  readonly progress: MapProgress;
  readonly service: Service;
  readonly staff: Staffing;
  readonly unlocks: Unlocks;
  readonly interact: Interact;
  time = 0;
  /** world-space movement wish from the joystick */
  readonly wish = new THREE.Vector3();

  constructor(
    mapId: MapId,
    readonly save: SaveData,
    readonly labels: Labels,
    readonly ui: WorldUI,
  ) {
    this.def = MAPS[mapId];
    this.progress = mapProgress(save, mapId);
    this.env = this.def.theme === 'beach' ? buildBeach() : buildRestaurant();
    this.scene.add(this.env.root, this.fx.group);
    this.flights = new Flights(this.scene);
    this.staticObstacles = [...this.env.obstacles];

    // counter, register and the cash pile
    for (const s of this.def.counter.segments) {
      const o = spawn(s.model);
      o.position.set(s.x, 0, s.z);
      o.rotation.y = s.rot;
      this.counterRoot.add(o);
      this.addBox(o, 0.02);
    }
    this.scene.add(this.counterRoot);
    const r = this.def.counter.register;
    this.register = spawn('register');
    this.register.position.set(r.x, this.def.counter.builtIn ? 1.02 : 0.7, r.z);
    this.register.rotation.y = r.rot;
    this.scene.add(this.register);
    const c = this.def.counter.cash;
    this.cash = new CashPile(c.x, this.def.counter.builtIn ? 1.02 : 0.7, c.z);
    this.scene.add(this.cash.root);
    const ps = this.def.counter.pass;
    this.pass = new Pass(ps.x, this.def.counter.builtIn ? 1.02 : 0.7, ps.z, ps.rot, TUNE.passCap);
    this.scene.add(this.pass.root);
    this.servePad = new Pad(this.def.counter.serve.x, this.def.counter.serve.z, 1.15, '#ffe1f0', '#ff4b8b');
    this.scene.add(this.servePad.mesh);

    for (const sd of this.def.stations) {
      const st = new Station(sd);
      this.stations.push(st);
      this.scene.add(st.root, st.pad.mesh, st.ghost);
    }
    for (const td of this.def.tables) {
      const t = new Table(td);
      this.tables.push(t);
      this.scene.add(t.root, t.area.mesh, t.ghost);
    }
    const sd = this.def.sink;
    this.sink = spawn('st_sink');
    this.sink.position.set(sd.x, 0, sd.z);
    this.sink.rotation.y = sd.rot;
    this.sink.visible = false;
    this.sinkGhost = ghostOf([this.sink]);
    this.scene.add(this.sink, this.sinkGhost);
    this.sinkPad = new Pad(sd.pad.x, sd.pad.z, 1.1, '#d7f6ff', '#2aa7e8');
    this.sinkPad.mesh.visible = false;
    this.scene.add(this.sinkPad.mesh);
    const bn = this.def.bin;
    this.bin = spawn('trash_bin');
    this.bin.position.set(bn.x, 0, bn.z);
    this.scene.add(this.bin);
    this.addBox(this.bin, 0.03);
    this.binPad = new Pad(bn.pad.x, bn.pad.z, 0.8, '#ffe0d1', '#ff6a3d');
    this.scene.add(this.binPad.mesh);
    const bd = this.def.board;
    this.board = spawn('upgrade_board');
    this.board.position.set(bd.x, 0, bd.z);
    this.board.rotation.y = bd.rot;
    this.scene.add(this.board);
    this.addBox(this.board, 0.05);
    this.boardPad = new Pad(bd.pad.x, bd.pad.z, 1.15, '#e9ddff', '#8a5cf5');
    this.scene.add(this.boardPad.mesh);

    this.player = new Player(save.equipped.colour ?? '#ff4b55');
    this.player.onStep = () => {
      this.fx.dust(this.player.pos, 2, this.def.theme === 'beach' ? '#f7dc9c' : '#ffe3b5', 0.1);
      sfx.play('step', 0.7);
    };
    this.scene.add(this.player.char.root);
    this.player.place(this.def.start.x, this.def.start.z, Math.PI);
    this.player.bounds = this.def.play;

    this.nav = new NavGrid(this.def.nav, this.staticObstacles);
    this.service = new Service(this);
    this.staff = new Staffing(this);
    this.unlocks = new Unlocks(this);
    this.interact = new Interact(this);

    // starting kit
    for (const st of this.stations) {
      if (!this.def.startDishes.includes(st.dish)) continue;
      st.unlock(false);
      // the starter stations are solid too, like the ones bought later
      const b = st.footprint();
      this.staticObstacles.push({ minX: b.min.x + 0.04, minZ: b.min.z + 0.04, maxX: b.max.x - 0.04, maxZ: b.max.z - 0.04 });
    }
    this.unlocks.restore();
    this.applyUpgrades();
    this.rebuildNav();
  }

  /** Box3 of an object turned into a collision rect for the chef and the guests. */
  addBox(o: THREE.Object3D, shrink = 0.04): Rect {
    o.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(o);
    const r = { minX: b.min.x + shrink, minZ: b.min.z + shrink, maxX: b.max.x - shrink, maxZ: b.max.z - shrink };
    this.staticObstacles.push(r);
    return r;
  }

  rebuildNav(): void {
    const obs = [...this.staticObstacles];
    for (const t of this.tables) {
      if (!t.unlocked) continue;
      obs.push({ minX: t.def.x - 0.5, minZ: t.def.z - 0.5, maxX: t.def.x + 0.5, maxZ: t.def.z + 0.5 });
    }
    this.nav = new NavGrid(this.def.nav, obs, 0.26);
    // the chef also bumps into chairs
    const chairs: Rect[] = [];
    for (const t of this.tables) {
      if (!t.unlocked) continue;
      for (const s of t.seats) chairs.push({ minX: s.pos.x - 0.22, minZ: s.pos.z - 0.22, maxX: s.pos.x + 0.22, maxZ: s.pos.z + 0.22 });
    }
    this.player.obstacles = [...obs, ...chairs];
    this.service.navChanged();
    this.staff.navChanged();
  }

  applyUpgrades(): void {
    const u = this.progress.upgrades;
    this.player.speed = TUNE.player.speed[u.speed];
    this.player.capacity = TUNE.player.capacity[u.capacity];
  }

  get cookTime(): number {
    const base = TUNE.cookTime[this.progress.upgrades.kitchen];
    return this.save.perks.includes('golden_grill') ? base * 0.6 : base;
  }

  get priceMult(): number {
    return TUNE.priceMult[this.progress.upgrades.menu];
  }

  get rush(): boolean {
    return this.save.rushUntil > Date.now();
  }

  /** dishes guests can order right now */
  menu(): Dish[] {
    const out: Dish[] = [];
    for (const s of this.stations) if (s.unlocked && !out.includes(s.dish)) out.push(s.dish);
    return out;
  }

  earn(coins: number, from: THREE.Vector3): void {
    this.save.coins += coins;
    this.ui.money(this.save.coins, this.save.gems, from, 'coin');
    writeSave(this.save);
  }

  earnGems(n: number, from: THREE.Vector3): void {
    this.save.gems += n;
    this.ui.money(this.save.coins, this.save.gems, from, 'gem');
    this.ui.float(from, `+${n}`, 'gem');
    sfx.play('gem');
    writeSave(this.save);
  }

  update(dt: number): void {
    this.time += dt;
    tickGhosts(this.time);
    this.player.update(dt, this.wish);
    this.interact.update(dt);
    this.service.update(dt);
    this.staff.update(dt);
    this.unlocks.update(dt);
    for (const t of this.tables) t.update(dt);
    this.pass.update(dt);
    this.flights.update(dt);
    this.tweens.update(dt);
    this.fx.update(dt);
    updateTraffic(this.env, dt);
  }

  dispose(): void {
    this.flights.clear();
    this.pass.clear();
    this.service.dispose();
    this.staff.dispose();
    this.unlocks.dispose();
    this.interact.dispose();
  }
}
