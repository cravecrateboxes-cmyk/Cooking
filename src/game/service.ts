import * as THREE from 'three';
import { sfx } from '../audio/sfx';
import { spawn } from '../engine/assets';
import { Bubble } from '../ui/bubble';
import { DISHES, TUNE, type Dish } from './config';
import { Combo } from './combo';
import { Customer } from './customer';
import type { Table } from './table';
import type { World } from './world';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const v3 = (p: { x: number; z: number }) => new THREE.Vector3(p.x, 0, p.z);

/** Guests: spawning, the counter queue, seating, eating, paying and leaving. */
export class Service {
  private readonly guests: Customer[] = [];
  private passT = 0;
  private readonly queue: (Customer | null)[];
  private spawnT = 0.5;
  private readonly combo = new Combo(TUNE.comboWindow, TUNE.comboCap);
  private readonly slots: THREE.Vector3[];

  constructor(private readonly w: World) {
    this.slots = w.def.counter.queue.map(v3);
    this.queue = this.slots.map(() => null);
  }

  /** guest at the front of the counter line who is waiting for food */
  front(): Customer | null {
    const c = this.queue[0];
    return c && c.state === 'ordering' ? c : null;
  }

  get seated(): Customer[] {
    return this.guests.filter((g) => g.state === 'seated');
  }

  /** True when any guest still on their way or waiting has this dish left on their order. */
  someoneWants(d: Dish): boolean {
    for (const g of this.guests) if (g.state !== 'leaving' && g.state !== 'eating' && g.wants(d)) return true;
    return false;
  }

  tableWants(t: Table): boolean {
    return t.seats.some((s) => s.guest?.state === 'seated');
  }

  navChanged(): void {
    // guests keep their current paths; new paths use the new grid
  }

  private progressFrac(): number {
    return this.w.unlocks.fraction;
  }

  update(dt: number): void {
    const w = this.w;
    this.passT += dt;
    const front = this.front();
    if (front && this.passT >= TUNE.passServeEvery && w.pass.has((d) => front.wants(d))) {
      const it = w.pass.take((d) => front.wants(d));
      if (it) {
        this.passT = 0;
        this.giveTakeout(front, it.kind as Dish, it.obj);
      }
    }
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      const [slow, fast] = TUNE.customer.spawnEvery;
      this.spawnT = THREE.MathUtils.lerp(slow, fast, this.progressFrac()) * w.rng.range(0.75, 1.25);
      this.trySpawn();
    }
    for (let i = this.guests.length - 1; i >= 0; i--) {
      const g = this.guests[i];
      g.update(dt);
      if (g.state === 'ordering' || g.state === 'seated') {
        g.waited += dt;
        const b = g.bubble;
        b.patience(g.waited / TUNE.customer.patience);
        if (!g.grumbled && g.waited > TUNE.customer.patience) {
          g.grumbled = true;
          if (g.state === 'ordering') {
            g.char.play('angry', 0.15);
            w.tweens.wait(1.1, () => g.state === 'ordering' && g.char.play('idle', 0.25));
          }
        }
      } else if (g.state === 'eating') {
        g.eatLeft -= dt;
        if (g.eatLeft <= 0) this.finishMeal(g);
      } else if (g.state === 'gone') {
        g.bubble.remove();
        g.stack.clear();
        g.char.dispose();
        this.guests.splice(i, 1);
      }
    }
  }

  private trySpawn(): void {
    const w = this.w;
    if (this.guests.length >= TUNE.customer.maxInside) return;
    const menu = w.menu();
    if (!menu.length) return;
    const seat = this.findSeat();
    const queueFree = this.queue.indexOf(null);
    const dine = seat !== null && (queueFree < 0 || w.rng.chance(0.55));
    if (!dine && queueFree < 0) return;
    const vipChance = TUNE.customer.vipChance * (w.save.perks.includes('vip_magnet') ? 3 : 1);
    const c = new Customer(w.nav, w.rng, w.rng.chance(vipChance), dine, TUNE.customer.walk);
    c.bubble = new Bubble(w.labels, c.char.root, 1.55, c.vip);
    const extra = Math.min(3, Math.floor(w.unlocks.done / 3));
    const size = dine ? 1 + w.rng.int(Math.min(2, 1 + Math.floor(w.unlocks.done / 4)) + 1) : 1 + w.rng.int(extra + 1);
    c.setOrder(menu, size, w.rng);
    c.place(v3(w.def.spawn), Math.PI / 2);
    w.scene.add(c.char.root);
    this.guests.push(c);
    if (dine && seat) {
      const [t, i] = seat;
      t.seats[i].guest = c;
      c.tableId = t.def.id;
      c.seatIndex = i;
      c.state = 'toSeat';
      const s = t.seats[i];
      const out = _a.set(s.pos.x - t.def.x, 0, s.pos.z - t.def.z).normalize();
      const stand = s.pos.clone().addScaledVector(out, 0.5);
      c.route(w.def.diningEnter.map(v3), stand, () => this.sitDown(c, t, i));
    } else {
      this.queue[queueFree] = c;
      c.queueSlot = queueFree;
      c.state = 'arriving';
      c.route(w.def.enter.map(v3), this.slots[queueFree], () => this.reachedSlot(c));
    }
  }

  private findSeat(): [Table, number] | null {
    const free: [Table, number][] = [];
    for (const t of this.w.tables) {
      const i = t.freeSeat();
      if (i >= 0) free.push([t, i]);
    }
    if (!free.length) return null;
    return free[this.w.rng.int(free.length)];
  }

  private reachedSlot(c: Customer): void {
    c.face(Math.PI);
    if (c.queueSlot === 0) {
      c.state = 'ordering';
      c.waited = 0;
      c.bubble.show(c.order);
      sfx.play('ding');
    } else {
      c.state = 'queue';
    }
  }

  private advanceQueue(): void {
    for (let i = 1; i < this.queue.length; i++) {
      const c = this.queue[i];
      if (!c || this.queue[i - 1]) continue;
      this.queue[i - 1] = c;
      this.queue[i] = null;
      c.queueSlot = i - 1;
      if (c.state === 'queue' || c.state === 'arriving') {
        const wasArriving = c.state === 'arriving';
        if (!wasArriving) c.follow([this.slots[c.queueSlot]], () => this.reachedSlot(c));
        else c.route(this.w.def.enter.map(v3), this.slots[c.queueSlot], () => this.reachedSlot(c));
      }
      i = 0;
    }
  }

  giveTakeout(c: Customer, dish: Dish, obj: THREE.Object3D): void {
    const w = this.w;
    c.receive(dish);
    c.stack.incoming++;
    w.flights.launch(obj, obj.position, (o) => c.stack.topWorld(o), () => {
      c.stack.incoming--;
      c.stack.push(dish, obj);
      c.char.bump(0.12);
      sfx.play('serve');
      c.bubble.update(c.order);
      c.bubble.bounce();
      if (c.remaining === 0 && c.state === 'ordering') this.payAtCounter(c);
    }, { dur: 0.22, arc: 0.55 });
  }

  private billFor(c: Customer): { value: number; tip: boolean } {
    let v = 0;
    for (const l of c.order) v += DISHES[l.dish].price * l.want;
    v *= this.w.priceMult;
    const tip = c.waited < TUNE.tipFast;
    if (tip) v *= 1.25;
    if (c.vip) v *= 2;
    if (this.w.rush) v *= 2;
    return { value: Math.max(1, Math.round(v)), tip };
  }

  private payAtCounter(c: Customer): void {
    const w = this.w;
    const { value, tip } = this.billFor(c);
    c.state = 'leaving';
    c.bubble.hide();
    this.queue[0] = null;
    w.progress.served++;
    this.payInto(c, value, (o) => w.cash.nextWorld(o), (v, obj) => w.cash.add(v, obj));
    c.char.play('cheer', 0.12);
    this.cheer(c, value, tip);
    c.char.root.getWorldPosition(_b);
    _b.y += 1.7;
    if (c.vip) w.earnGems(TUNE.gemsPerVip, _b);
    w.tweens.wait(0.7, () => {
      const exit = w.def.exit.map(v3);
      c.goTo(exit[0], () => c.follow([...exit.slice(1), v3(w.def.despawn)], () => (c.state = 'gone')));
      this.advanceQueue();
    });
  }

  /** Bills hop from the guest onto a pile; values add up to exactly `value`. */
  private payInto(c: Customer, value: number, target: (o: THREE.Vector3) => THREE.Vector3, land: (v: number, obj: THREE.Object3D) => void): void {
    const w = this.w;
    const n = THREE.MathUtils.clamp(Math.ceil(value / 6), 1, 6);
    let left = value;
    c.char.root.getWorldPosition(_a);
    _a.y += 1.0;
    const from = _a.clone();
    for (let i = 0; i < n; i++) {
      const v = i === n - 1 ? left : Math.floor(value / n);
      left -= v;
      w.tweens.wait(i * 0.07, () => {
        const bill = spawn('item_cash');
        w.flights.launch(bill, from, target, () => {
          land(v, bill);
          sfx.play('cash');
        }, { dur: 0.3, arc: 0.8, spin: 0.5 });
      });
    }
    w.tweens.wait(0.05, () => sfx.play('pay'));
  }

  /**
   * A paying guest is the game's main reward: the amount pops over their head, a heart follows, and guests
   * paid close together chain a combo that gets louder each step. Labels are staggered so none overlap.
   */
  private cheer(c: Customer, value: number, tip: boolean): void {
    const w = this.w;
    const head = c.char.root.getWorldPosition(new THREE.Vector3()).setY(1.75);
    w.ui.float(head, `+${value}`, 'coin');
    w.fx.sparkle(head, '#ffd23f', 10, 2.8);
    w.tweens.wait(0.16, () => w.ui.float(head.clone().setY(2.15), '', 'heart'));
    if (tip) w.tweens.wait(0.34, () => w.ui.float(head.clone().setY(2.5), 'Fast!', 'tip'));
    const n = this.combo.hit(w.time);
    if (n < 2) {
      w.ui.impact('light');
      return;
    }
    w.tweens.wait(tip ? 0.52 : 0.34, () => {
      w.ui.float(head.clone().setY(tip ? 2.85 : 2.5), `Combo x${n}`, 'combo');
      sfx.play('combo', n);
      w.fx.confettiBurst(head, 10 + n * 4, 3.5);
    });
    w.ui.impact('medium');
  }

  private sitDown(c: Customer, t: Table, i: number): void {
    const s = t.seats[i];
    c.face(s.rot);
    this.w.tweens.wait(0.18, () => {
      c.stop();
      c.seated = true;
      c.facing = s.rot;
      const fx = Math.sin(s.rot);
      const fz = Math.cos(s.rot);
      c.pos.set(s.pos.x - fx * 0.12, 0.21, s.pos.z - fz * 0.12);
      c.char.play('sit', 0.25);
      c.state = 'seated';
      c.waited = 0;
      c.bubble.show(c.order);
      sfx.play('ding');
    });
  }

  giveSeated(t: Table, i: number, dish: Dish, obj: THREE.Object3D): void {
    const w = this.w;
    const s = t.seats[i];
    const c = s.guest;
    if (!c) return;
    c.receive(dish);
    const k = s.food.length;
    s.food.push(obj);
    const at = t.placeFor(i, k, new THREE.Vector3());
    w.flights.launch(obj, obj.position, (o) => o.copy(at), () => {
      obj.position.copy(at);
      obj.rotation.set(0, w.rng.range(-0.4, 0.4), 0);
      w.scene.add(obj);
      sfx.play('serve');
      w.fx.dust(at, 3, '#fff0c9', 0.08);
      const b = c.bubble;
      b.update(c.order);
      b.bounce();
      if (c.remaining === 0 && c.state === 'seated') this.startMeal(c);
    }, { dur: 0.24, arc: 0.6 });
  }

  private startMeal(c: Customer): void {
    c.state = 'eating';
    c.eatLeft = TUNE.eatTime * this.w.rng.range(0.85, 1.15);
    c.bubble.hide();
    c.char.play('sit_eat', 0.25);
  }

  private finishMeal(c: Customer): void {
    const w = this.w;
    const t = w.tables.find((x) => x.def.id === c.tableId);
    if (!t) return;
    const s = t.seats[c.seatIndex];
    for (const f of s.food) {
      w.fx.dust(f.position, 3, '#fff0c9', 0.09);
      f.removeFromParent();
    }
    s.food.length = 0;
    const { value, tip } = this.billFor(c);
    w.progress.served++;
    t.addPlate();
    this.payInto(c, value, (o) => t.cash.nextWorld(o), (v, obj) => t.cash.add(v, obj));
    this.cheer(c, value, tip);
    c.char.root.getWorldPosition(_b);
    _b.y += 1.4;
    if (c.vip) w.earnGems(TUNE.gemsPerVip, _b);
    c.state = 'leaving';
    s.guest = null;
    w.tweens.wait(0.35, () => {
      c.seated = false;
      const out = _a.set(s.pos.x - t.def.x, 0, s.pos.z - t.def.z).normalize();
      c.pos.set(s.pos.x + out.x * 0.5, 0, s.pos.z + out.z * 0.5);
      c.char.play('cheer', 0.15);
      w.tweens.wait(0.6, () => {
        const exit = w.def.exit.map(v3);
        c.goTo(exit[0], () => c.follow([...exit.slice(1), v3(w.def.despawn)], () => (c.state = 'gone')));
      });
    });
  }

  dispose(): void {
    for (const g of this.guests) {
      g.bubble.remove();
      g.char.dispose();
    }
    this.guests.length = 0;
  }
}
