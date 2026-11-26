import * as THREE from 'three';
import { sfx } from '../audio/sfx';
import { TUNE, type Dish } from './config';
import type { Station } from './station';
import type { Table } from './table';
import type { World } from './world';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/** Everything the chef does by standing somewhere: cook, pick up, serve, collect, wash, open the board. */
export class Interact {
  private handT = 0;
  private cashT = 0;
  private washT = 0;
  private binT = 0;
  /** seconds the chef has stood on the register pad holding food */
  private serveT = 0;
  private readonly dwell = new Map<Station, number>();
  /** 0..1 lid bounce after something lands in the bin */
  private lid = 0;
  private onBoard = false;
  private cookSound = 0;
  /** station the chef is standing at, if any */
  at: Station | null = null;

  constructor(private readonly w: World) {}

  update(dt: number): void {
    const w = this.w;
    const p = w.player;
    this.handT += dt;
    this.cashT += dt;
    this.washT += dt;
    this.binT += dt;
    this.at = null;

    // kitchen stations
    for (const st of w.stations) {
      const here = st.unlocked && st.pad.contains(p.pos, 0.05);
      if (here) this.at = st;
      st.workers = w.staff.cooksAt(st) + (here ? 1 : 0);
      // a short dwell before grabbing, so walking past a full tray doesn't fill the chef's hands
      const dwell = here ? (this.dwell.get(st) ?? 0) + dt : 0;
      this.dwell.set(st, dwell);
      const settled = here && dwell >= TUNE.grabDwell;
      const canTake = settled && p.canTakeFood();
      st.update(dt, w.cookTime, canTake, {
        cooking: (s) => this.cookingFx(s, dt),
        done: (s, obj, from) => this.dishDone(s, obj, from, canTake),
      });
      st.pad.update(dt, w.time, here, false);
      // grab what is waiting on the side tray
      if (settled && st.tray.items.length && p.canTakeFood() && this.handT >= TUNE.handoffEvery) {
        const it = st.tray.take();
        if (it) {
          this.handT = 0;
          this.toPlayer(it.kind as Dish, it.obj);
        }
      }
    }

    // counter: hand the guest at the front what they want, then stock the counter tray with the rest
    // food only leaves the chef's arms after a short stand on the pad (its fill shows it), so carrying a
    // seated table's order past the register drops nothing
    const onServe = w.servePad.contains(p.pos, 0.05);
    const front = w.service.front();
    const canServe = p.stack.holdsFood && (!w.pass.full || (!!front && p.stack.items.some((i) => front.wants(i.kind as Dish))));
    this.serveT = onServe && canServe ? this.serveT + dt : 0;
    w.servePad.fill = Math.min(1, this.serveT / TUNE.serveDwell);
    w.servePad.update(dt, w.time, onServe, canServe);
    if (this.serveT >= TUNE.serveDwell && this.handT >= TUNE.handoffEvery) {
      const it = front ? this.takeWanted(p.stack, (d) => front.wants(d)) : null;
      if (it && front) {
        this.handT = 0;
        w.service.giveTakeout(front, it.kind as Dish, it.obj);
      } else if (!w.pass.full) {
        const top = p.stack.take();
        if (top) {
          this.handT = 0;
          this.stock(top.kind as Dish, top.obj);
        }
      }
    }

    // counter cash
    if (w.cash.count > 0 || w.cash.value > 0) {
      w.cash.root.getWorldPosition(_a);
      if (Math.hypot(p.pos.x - _a.x, p.pos.z - _a.z) < 1.55 && this.cashT >= TUNE.cashEvery) {
        this.cashT = 0;
        this.collect(w.cash.takeTop());
      }
    }

    // dining tables
    for (const t of w.tables) {
      if (!t.unlocked) continue;
      const near = Math.hypot(p.pos.x - t.def.x, p.pos.z - t.def.z) < 1.75;
      const waiting = w.service.tableWants(t);
      t.area.mesh.visible = waiting && p.stack.holdsFood;
      t.area.update(dt, w.time, near, waiting && p.stack.holdsFood);
      if (!near) continue;
      this.atTable(t);
    }

    // sink
    if (w.sinkOn) {
      const onSink = w.sinkPad.contains(p.pos, 0.05);
      w.sinkPad.update(dt, w.time, onSink, p.stack.holdsPlates);
      if (onSink && p.stack.holdsPlates && this.washT >= 0.09) {
        this.washT = 0;
        const it = p.stack.take('plate');
        if (it) this.wash(it.obj);
      }
    }

    // bin: drop food one item at a time
    const onBin = w.binPad.contains(p.pos, 0.05);
    w.binPad.update(dt, w.time, onBin, false);
    if (onBin && p.stack.holdsFood && this.binT >= TUNE.handoffEvery) {
      this.binT = 0;
      const it = p.stack.take();
      if (it) this.toss(it.obj);
    }
    this.lid = Math.max(0, this.lid - dt * 3.5);
    const b = this.lid;
    w.bin.scale.set(1 + Math.sin(b * Math.PI) * 0.08, 1 - Math.sin(b * Math.PI) * 0.1, 1 + Math.sin(b * Math.PI) * 0.08);

    // upgrade board
    const onBoard = w.boardPad.contains(p.pos, 0);
    w.boardPad.update(dt, w.time, onBoard, false);
    if (onBoard && !this.onBoard && p.vel.lengthSq() < 30) w.ui.openUpgrades();
    this.onBoard = onBoard;
  }

  private atTable(t: Table): void {
    const w = this.w;
    const p = w.player;
    if (this.handT >= TUNE.handoffEvery) {
      // serve the seated guests first
      for (let i = 0; i < t.seats.length; i++) {
        const g = t.seats[i].guest;
        if (!g || g.state !== 'seated') continue;
        const it = this.takeWanted(p.stack, (d) => g.wants(d));
        if (it) {
          this.handT = 0;
          w.service.giveSeated(t, i, it.kind as Dish, it.obj);
          return;
        }
      }
    }
    if ((t.cash.count > 0 || t.cash.value > 0) && this.cashT >= TUNE.cashEvery) {
      this.cashT = 0;
      this.collect(t.cash.takeTop());
      return;
    }
    if (w.sinkOn && t.dirty && !p.stack.holdsFood && !p.full && this.handT >= TUNE.handoffEvery) {
      const plate = t.plates.pop();
      if (plate) {
        this.handT = 0;
        plate.getWorldPosition(_a);
        p.stack.incoming++;
        w.flights.launch(plate, _a, (o) => p.stack.topWorld(o), () => {
          p.stack.incoming--;
          p.stack.push('plate', plate);
          p.char.bump(0.12);
          sfx.play('plate');
        }, { dur: 0.22, arc: 0.5 });
      }
    }
  }

  private takeWanted(stack: World['player']['stack'], wants: (d: Dish) => boolean) {
    for (let i = stack.items.length - 1; i >= 0; i--) {
      const k = stack.items[i].kind;
      if (k !== 'plate' && wants(k)) return stack.take(k);
    }
    return null;
  }

  private cookingFx(s: Station, dt: number): void {
    s.steamT += dt;
    if (s.steamT > 0.09) {
      s.steamT = 0;
      s.workWorld(_b);
      this.w.fx.steam(_b, s.steamColor);
    }
    s.sparkT += dt;
    if (s.sparkT > (s.hot ? 0.16 : 0.4)) {
      s.sparkT = 0;
      s.workWorld(_b);
      if (s.hot) this.w.fx.sparkle(_b, '#ff9a3c', 2, 1.4);
      else this.w.fx.sparkle(_b, s.steamColor, 1, 1.1);
    }
    this.cookSound += dt;
    if (this.cookSound > 0.32 && s.workers > 0 && this.at === s) {
      this.cookSound = 0;
      sfx.play('sizzle');
    }
  }

  private dishDone(s: Station, obj: THREE.Object3D, from: THREE.Vector3, toPlayer: boolean): void {
    this.w.fx.sparkle(from, '#ffd23f', 9, 2.6);
    this.w.fx.dust(from, 4, s.steamColor, 0.12);
    if (toPlayer && this.w.player.canTakeFood()) {
      this.toPlayer(s.dish, obj, from);
      return;
    }
    s.tray.incoming++;
    obj.position.copy(from);
    this.w.flights.launch(obj, from, (o) => s.tray.topWorld(o), () => {
      s.tray.incoming--;
      s.tray.push(s.dish, obj);
      sfx.play('pop', 0.6);
    }, { dur: 0.25, arc: 0.45 });
  }

  toPlayer(dish: Dish, obj: THREE.Object3D, from?: THREE.Vector3): void {
    const p = this.w.player;
    p.stack.incoming++;
    obj.getWorldPosition(_a);
    this.w.flights.launch(obj, from ?? _a, (o) => p.stack.topWorld(o), () => {
      p.stack.incoming--;
      p.stack.push(dish, obj);
      p.char.bump(0.16);
      sfx.play('pickup');
      this.w.ui.impact('light');
    }, { dur: 0.24, arc: 0.6 });
  }

  private collect(bill: { obj: THREE.Object3D; value: number } | null): void {
    if (!bill) return;
    const w = this.w;
    const p = w.player;
    w.flights.launch(bill.obj, bill.obj.position, (o) => o.set(p.pos.x, p.pos.y + 0.9, p.pos.z), () => {
      bill.obj.removeFromParent();
      w.earn(bill.value, p.pos);
      sfx.play('coin');
      w.ui.impact('light');
    }, { dur: 0.26, arc: 0.7, spin: 1, scaleTo: 0.4 });
  }

  private wash(plate: THREE.Object3D): void {
    const w = this.w;
    w.sink.getWorldPosition(_a);
    _a.y = 0.85;
    w.flights.launch(plate, plate.position, (o) => o.copy(_a), () => {
      plate.removeFromParent();
      w.fx.sparkle(_a, '#9fe7ff', 6, 2.2);
      sfx.play('wash');
      w.earn(1, _a);
      w.ui.float(_a, '+1', 'coin');
    }, { dur: 0.25, arc: 0.55 });
  }

  private stock(dish: Dish, obj: THREE.Object3D): void {
    const w = this.w;
    const pile = w.pass.reserve();
    w.flights.launch(obj, obj.position, (o) => pile.topWorld(o), () => {
      pile.incoming--;
      pile.push(dish, obj);
      sfx.play('serve', 0.7);
    }, { dur: 0.2, arc: 0.45 });
  }

  private toss(obj: THREE.Object3D): void {
    const w = this.w;
    const at = w.bin.getWorldPosition(new THREE.Vector3());
    at.y = 0.8;
    w.flights.launch(obj, obj.position, (o) => o.copy(at), () => {
      obj.removeFromParent();
      w.fx.dust(at, 4, '#ffffff', 0.25);
      this.lid = 1;
      sfx.play('whoosh', 0.8);
    }, { dur: 0.24, arc: 0.7, spin: 1, scaleTo: 0.5 });
  }

  dispose(): void {
    this.at = null;
  }
}
