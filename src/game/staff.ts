import * as THREE from 'three';
import { sfx } from '../audio/sfx';
import { TUNE, type Dish } from './config';
import type { Customer } from './customer';
import type { Station } from './station';
import type { Table } from './table';
import { Walker } from './walker';
import type { World } from './world';

const STAFF_COLOUR = { cook: '#ff8a2b', waiter: '#3fa9f5', runner: '#8a5cf5' } as const;
type Role = keyof typeof STAFF_COLOUR;

interface Job {
  kind: 'fetch' | 'deliver' | 'plates' | 'sink' | 'home';
  station?: Station;
  table?: Table;
  dish?: Dish;
}

const _a = new THREE.Vector3();

class Helper extends Walker {
  job: Job | null = null;
  busyT = 0;
  constructor(
    readonly role: Role,
    w: World,
    readonly station: Station | null,
  ) {
    super(STAFF_COLOUR[role], w.nav, TUNE.staff.speed, 1.02);
  }
}

/** Hired help. Cooks work one machine; the waiter runs food to tables and clears plates; the runner serves the counter. */
export class Staffing {
  private readonly helpers: Helper[] = [];
  private handT = 0;

  constructor(private readonly w: World) {}

  cooksAt(st: Station): number {
    let n = 0;
    for (const h of this.helpers) if (h.role === 'cook' && h.station === st && !h.moving) n++;
    return n;
  }

  navChanged(): void {
    for (const h of this.helpers) h.nav = this.w.nav;
  }

  hire(role: Role, stationId?: string, animate = true): void {
    const w = this.w;
    const st = stationId ? (w.stations.find((s) => s.def.id === stationId) ?? null) : null;
    const h = new Helper(role, w, st);
    // a little uniform: cooks get a cap, servers a bow tie, so roles read at a glance
    if (role === 'cook') h.char.wear('hat', 'cos_hat_toque');
    else if (role === 'waiter') h.char.wear('outfit', 'cos_fit_bowtie');
    else h.char.wear('hat', 'cos_hat_cap');
    const home = st ? st.pad.pos : new THREE.Vector3(w.def.staffHome.x, 0, w.def.staffHome.z);
    h.place(animate ? new THREE.Vector3(w.def.staffHome.x, 0, w.def.staffHome.z) : home.clone(), Math.PI);
    w.scene.add(h.char.root);
    this.helpers.push(h);
    if (animate) {
      h.char.play('cheer', 0.1);
      h.char.root.getWorldPosition(_a);
      w.fx.poof(_a, 0.8, STAFF_COLOUR[role]);
      w.fx.confettiBurst(_a.setY(1), 40, 5);
    }
    if (st) h.goTo(st.pad.pos, () => h.face(st.def.rot + Math.PI));
  }

  update(dt: number): void {
    this.handT += dt;
    for (const h of this.helpers) {
      h.update(dt);
      if (h.role === 'cook') {
        if (h.station && !h.moving) h.char.play(h.station.progress > 0 ? 'carry_idle' : 'idle', 0.2);
        continue;
      }
      if (h.moving) continue;
      if (h.busyT > 0) {
        h.busyT -= dt;
        continue;
      }
      if (h.role === 'waiter') this.waiter(h);
      else this.runner(h);
    }
  }

  /** dishes still owed to seated guests, minus what is already being carried to them */
  private owed(): { table: Table; dish: Dish }[] {
    const out: { table: Table; dish: Dish }[] = [];
    for (const t of this.w.tables) {
      for (const s of t.seats) {
        const g = s.guest;
        if (!g || g.state !== 'seated') continue;
        for (const l of g.order) for (let k = l.got; k < l.want; k++) out.push({ table: t, dish: l.dish });
      }
    }
    return out;
  }

  private waiter(h: Helper): void {
    const w = this.w;
    // carrying food: take it to whoever wants it
    if (h.stack.holdsFood) {
      const owed = this.owed().find((o) => h.stack.has(o.dish));
      if (owed) {
        const t = owed.table;
        h.goTo(this.approach(t), () => this.serveTable(h, t));
        return;
      }
      h.goTo(new THREE.Vector3(w.def.staffHome.x, 0, w.def.staffHome.z));
      return;
    }
    if (h.stack.holdsPlates) {
      h.goTo(w.sinkPad.pos, () => this.dropPlates(h));
      return;
    }
    // fetch a dish that a seated guest wants and that is waiting on a tray
    for (const o of this.owed()) {
      const st = w.stations.find((s) => s.dish === o.dish && s.tray.items.length > 0);
      if (st) {
        h.goTo(st.pad.pos, () => this.fetch(h, st));
        return;
      }
    }
    if (w.sinkOn) {
      const dirty = w.tables.find((t) => t.dirty && !t.busy);
      if (dirty) {
        h.goTo(this.approach(dirty), () => this.takePlates(h, dirty));
        return;
      }
    }
    _a.set(w.def.staffHome.x, 0, w.def.staffHome.z);
    if (h.pos.distanceTo(_a) > 0.3) h.goTo(_a.clone());
    else h.busyT = 0.3;
  }

  private runner(h: Helper): void {
    const w = this.w;
    const front = w.service.front();
    if (h.stack.holdsFood) {
      if (front && h.stack.items.some((i) => front.wants(i.kind as Dish))) {
        h.goTo(w.servePad.pos.clone().add(_a.set(-0.6, 0, 0)), () => this.serveCounter(h, front));
        return;
      }
    }
    if (front) {
      const need = front.order.find((l) => l.got < l.want && !h.stack.has(l.dish));
      const st = need && w.stations.find((s) => s.dish === need.dish && s.tray.items.length > 0);
      if (st) {
        h.goTo(st.pad.pos, () => this.fetch(h, st, front));
        return;
      }
    }
    h.busyT = 0.25;
  }

  private approach(t: Table): THREE.Vector3 {
    const s = t.seats[0];
    const dx = s.pos.x - t.def.x;
    const dz = s.pos.z - t.def.z;
    // stand beside the table, between the chairs
    return new THREE.Vector3(t.def.x - dz * 0.95, 0, t.def.z + dx * 0.95 + (dx === 0 ? 0 : 0));
  }

  private fetch(h: Helper, st: Station, forGuest?: Customer): void {
    const w = this.w;
    let n = 0;
    const want = (d: Dish) => (forGuest ? forGuest.wants(d) : this.owed().some((o) => o.dish === d));
    while (st.tray.items.length && h.stack.count < TUNE.staff.capacity && want(st.dish) && n < TUNE.staff.capacity) {
      const it = st.tray.take();
      if (!it) break;
      const dish = st.dish;
      const obj = it.obj;
      h.stack.incoming++;
      w.tweens.wait(n * TUNE.handoffEvery, () =>
        w.flights.launch(obj, obj.position, (o) => h.stack.topWorld(o), () => {
          h.stack.incoming--;
          h.stack.push(dish, obj);
          sfx.play('pickup', 0.5);
        }, { dur: 0.22, arc: 0.5 }),
      );
      n++;
      if (forGuest && n >= forGuest.remaining) break;
    }
    h.busyT = n * TUNE.handoffEvery + 0.25;
  }

  private serveTable(h: Helper, t: Table): void {
    const w = this.w;
    for (let i = 0; i < t.seats.length; i++) {
      const g = t.seats[i].guest;
      if (!g || g.state !== 'seated') continue;
      for (const l of g.order) {
        while (l.got < l.want && h.stack.has(l.dish)) {
          const it = h.stack.take(l.dish);
          if (!it) break;
          w.service.giveSeated(t, i, l.dish, it.obj);
        }
      }
    }
    h.busyT = 0.3;
  }

  private serveCounter(h: Helper, c: Customer): void {
    const w = this.w;
    for (const l of c.order) {
      while (l.got < l.want && h.stack.has(l.dish)) {
        const it = h.stack.take(l.dish);
        if (!it) break;
        w.service.giveTakeout(c, l.dish, it.obj);
      }
    }
    h.busyT = 0.3;
  }

  private takePlates(h: Helper, t: Table): void {
    while (t.plates.length && h.stack.count < TUNE.staff.capacity + 2) {
      const p = t.plates.pop();
      if (!p) break;
      p.getWorldPosition(_a);
      p.removeFromParent();
      p.position.copy(_a);
      h.stack.push('plate', p);
    }
    sfx.play('plate');
    h.busyT = 0.3;
  }

  private dropPlates(h: Helper): void {
    const w = this.w;
    let n = 0;
    while (h.stack.holdsPlates) {
      const it = h.stack.take('plate');
      if (!it) break;
      n++;
      w.flights.launch(it.obj, it.obj.position, (o) => w.sink.getWorldPosition(o).setY(0.85), () => {
        it.obj.removeFromParent();
        sfx.play('wash');
      }, { dur: 0.25, arc: 0.5 });
    }
    if (n) w.earn(n, w.sinkPad.pos);
    h.busyT = 0.4;
  }

  dispose(): void {
    for (const h of this.helpers) h.char.dispose();
    this.helpers.length = 0;
  }
}
