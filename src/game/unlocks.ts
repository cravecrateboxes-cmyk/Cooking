import * as THREE from 'three';
import { sfx } from '../audio/sfx';
import { spawn } from '../engine/assets';
import { iconNamed } from '../ui/icons';
import type { Label } from '../ui/labels';
import { MAPS, type UnlockDef } from './maps';
import { Pad } from './pad';
import { writeSave, type MapId } from './save';
import type { World } from './world';

interface Spot {
  def: UnlockDef;
  pad: Pad;
  label: Label;
  left: HTMLElement;
  coinT: number;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
/** how many purchasable pads are on the floor at once */
const SHOWN = 2;

/**
 * Purchase pads. Standing on one pours money into it; when it fills, the thing it stands for pops into
 * the world with a burst of confetti. Pads appear in a fixed order, a couple at a time.
 */
export class Unlocks {
  private readonly spots: Spot[] = [];
  private travel: { pad: Pad; label: Label; map: MapId } | null = null;
  private onTravel = false;

  constructor(private readonly w: World) {}

  get total(): number {
    return this.w.def.unlocks.length;
  }

  get done(): number {
    return this.w.progress.unlocked.length;
  }

  get fraction(): number {
    return this.done / this.total;
  }

  isDone(id: string): boolean {
    return this.w.progress.unlocked.includes(id);
  }

  /** the first pad still waiting, for the guide arrow */
  next(): Spot | null {
    return this.spots[0] ?? null;
  }

  restore(): void {
    for (const d of this.w.def.unlocks) if (this.isDone(d.id)) this.apply(d, false);
    this.refresh();
    this.w.ui.progress(this.done, this.total);
  }

  private refresh(): void {
    const w = this.w;
    const want = w.def.unlocks.filter((d) => !this.isDone(d.id)).slice(0, SHOWN);
    for (let i = this.spots.length - 1; i >= 0; i--) {
      if (!want.includes(this.spots[i].def)) this.removeSpot(i);
    }
    for (const d of want) {
      if (this.spots.some((s) => s.def === d)) continue;
      // hire pads sit in the walkway beside the stations, so they are smaller and never cover a cooking spot
      const pad = new Pad(d.x, d.z, d.kind === 'cook' ? 1.1 : 1.45, d.gems ? '#e3d4ff' : '#fff0b8', d.gems ? '#8a5cf5' : '#ff8a2b');
      pad.fill = this.paid(d) / this.price(d);
      pad.popIn();
      w.scene.add(pad.mesh);
      const el = document.createElement('div');
      el.className = d.gems ? 'tag gem' : 'tag';
      const title = document.createElement('div');
      title.className = 'tag-title';
      title.textContent = d.title;
      const price = document.createElement('div');
      price.className = 'tag-price';
      const img = document.createElement('img');
      img.src = iconNamed(d.gems ? 'item_gem' : 'item_coin');
      img.alt = '';
      const left = document.createElement('span');
      price.append(img, left);
      el.append(title, price);
      const label = w.labels.add(el, null, 0.25, new THREE.Vector3(d.x, 0, d.z));
      const spot: Spot = { def: d, pad, label, left, coinT: 0 };
      this.setLeft(spot);
      this.spots.push(spot);
    }
    this.spots.sort((a, b) => w.def.unlocks.indexOf(a.def) - w.def.unlocks.indexOf(b.def));
  }

  private removeSpot(i: number): void {
    const s = this.spots[i];
    s.pad.mesh.removeFromParent();
    this.w.labels.remove(s.label);
    this.spots.splice(i, 1);
  }

  private price(d: UnlockDef): number {
    return d.gems ?? d.cost;
  }

  private paid(d: UnlockDef): number {
    return this.w.progress.partial?.[d.id] ?? 0;
  }

  private setLeft(s: Spot): void {
    const left = this.price(s.def) - this.paid(s.def);
    s.left.textContent = left.toLocaleString('en-US');
  }

  update(dt: number): void {
    const w = this.w;
    const p = w.player;
    for (const s of [...this.spots]) {
      const on = s.pad.contains(p.pos, 0.05);
      const d = s.def;
      const wallet = d.gems ? w.save.gems : w.save.coins;
      s.pad.update(dt, w.time, on && wallet > 0, wallet >= this.price(d) - this.paid(d));
      s.label.scale = on ? 1.12 : 1;
      if (!on || wallet <= 0) continue;
      const need = this.price(d) - this.paid(d);
      // fill in about a second and a half whatever the price, but never slower than 25 coins a second
      const rate = d.gems ? 6 : Math.max(25, this.price(d) / 1.5);
      const amt = Math.min(need, wallet, Math.max(1, Math.ceil(rate * dt)));
      if (d.gems) w.save.gems -= amt;
      else w.save.coins -= amt;
      const partial = (w.progress.partial ??= {});
      partial[d.id] = (partial[d.id] ?? 0) + amt;
      s.pad.fill = partial[d.id] / this.price(d);
      this.setLeft(s);
      w.ui.money(w.save.coins, w.save.gems);
      // coins hop from the chef onto the pad
      s.coinT += dt;
      if (s.coinT > 0.055) {
        s.coinT = 0;
        const coin = spawn(d.gems ? 'item_gem' : 'item_coin');
        _a.set(p.pos.x, 1.0, p.pos.z);
        _b.set(d.x + (Math.random() - 0.5) * 0.6, 0.05, d.z + (Math.random() - 0.5) * 0.6);
        const to = _b.clone();
        w.flights.launch(coin, _a, (o) => o.copy(to), () => {
          coin.removeFromParent();
          sfx.play('coin');
        }, { dur: 0.28, arc: 0.9, spin: 1.5, scaleFrom: 1, scaleTo: 0.6 });
      }
      if (partial[d.id] >= this.price(d)) {
        delete partial[d.id];
        this.complete(s);
      }
      writeSave(w.save);
    }
    if (this.travel) {
      const on = this.travel.pad.contains(p.pos, 0);
      this.travel.pad.update(dt, w.time, on, true);
      if (on && !this.onTravel) w.ui.nextMap(this.travel.map);
      this.onTravel = on;
    }
  }

  private complete(s: Spot): void {
    const w = this.w;
    const d = s.def;
    w.progress.unlocked.push(d.id);
    writeSave(w.save, true);
    this.apply(d, true);
    _a.set(d.x, 0.2, d.z);
    w.fx.poof(_a, 1.4);
    w.fx.confettiBurst(_a.setY(0.6), 90, 7);
    w.fx.sparkle(_a.setY(1.2), '#ffd23f', 16, 4);
    sfx.play('unlock');
    w.ui.impact('big');
    w.ui.banner(d.title, d.kind === 'next_map' ? 'A new place to cook' : this.blurb(d));
    w.ui.progress(this.done, this.total);
    // a gem every third purchase keeps the rarer currency trickling in
    if (this.done % 3 === 0) w.tweens.wait(0.6, () => w.earnGems(1, new THREE.Vector3(w.player.pos.x, 1.8, w.player.pos.z)));
    this.removeSpot(this.spots.indexOf(s));
    w.tweens.wait(0.5, () => this.refresh());
  }

  private blurb(d: UnlockDef): string {
    switch (d.kind) {
      case 'station':
        return 'New dish on the menu';
      case 'table':
        return 'More guests can sit down';
      case 'sink':
        return 'Wash plates for coins';
      case 'cook':
        return 'Cooks while you serve';
      case 'waiter':
        return 'Serves tables and clears plates';
      case 'runner':
        return 'Serves the counter';
      default:
        return '';
    }
  }

  /** Is the chef (with their radius) overlapping this box? */
  private inside(minX: number, minZ: number, maxX: number, maxZ: number): boolean {
    const p = this.w.player.pos;
    const r = 0.35;
    return p.x > minX - r && p.x < maxX + r && p.z > minZ - r && p.z < maxZ + r;
  }

  /** Something new was built where the chef stands: glide them onto its work spot instead of leaving them wedged. */
  private stepOut(x: number, z: number): void {
    const p = this.w.player.pos;
    const fx = p.x;
    const fz = p.z;
    this.w.tweens.add(0.28, (k) => {
      p.x = fx + (x - fx) * k;
      p.z = fz + (z - fz) * k;
    });
  }

  private apply(d: UnlockDef, animate: boolean): void {
    const w = this.w;
    switch (d.kind) {
      case 'station': {
        const st = w.stations.find((s) => s.def.id === d.target);
        if (!st) break;
        st.unlock(animate);
        const b = st.footprint();
        w.staticObstacles.push({ minX: b.min.x + 0.04, minZ: b.min.z + 0.04, maxX: b.max.x - 0.04, maxZ: b.max.z - 0.04 });
        w.rebuildNav();
        if (this.inside(b.min.x, b.min.z, b.max.x, b.max.z)) this.stepOut(st.pad.pos.x, st.pad.pos.z);
        break;
      }
      case 'table': {
        const t = w.tables.find((x) => x.def.id === d.target);
        t?.unlock(animate);
        w.rebuildNav();
        if (t) {
          // chairs and the table top spawn around the pad the chef is standing on: step clear to the front
          const p = w.player.pos;
          if (Math.hypot(p.x - t.def.x, p.z - t.def.z) < 1.5) this.stepOut(t.def.x, t.def.z + 1.7);
        }
        break;
      }
      case 'sink': {
        w.sinkOn = true;
        w.sink.visible = true;
        w.sinkGhost.visible = false;
        w.sinkPad.mesh.visible = true;
        w.addBox(w.sink, 0.04);
        w.rebuildNav();
        if (Math.hypot(w.player.pos.x - w.sink.position.x, w.player.pos.z - w.sink.position.z) < 1.0) {
          this.stepOut(w.sinkPad.pos.x, w.sinkPad.pos.z);
        }
        if (animate) this.popObject(w.sink);
        break;
      }
      case 'cook':
        w.staff.hire('cook', d.target, animate);
        break;
      case 'waiter':
        w.staff.hire('waiter', undefined, animate);
        break;
      case 'runner':
        w.staff.hire('runner', undefined, animate);
        break;
      case 'next_map': {
        const pad = new Pad(d.x, d.z, 1.5, '#c9f3ff', '#22c3b0');
        w.scene.add(pad.mesh);
        const el = document.createElement('div');
        el.className = 'tag travel';
        const map = (d.target ?? 'truck') as MapId;
        el.textContent = MAPS[map].name;
        const label = w.labels.add(el, null, 0.25, new THREE.Vector3(d.x, 0, d.z));
        this.travel = { pad, label, map };
        if (animate) w.tweens.wait(1.4, () => w.ui.nextMap(map));
        break;
      }
    }
  }

  private popObject(o: THREE.Object3D): void {
    this.w.tweens.add(0.7, (k) => {
      const s = 1 - Math.cos(k * 9) * Math.exp(-k * 5) * (1 - k);
      o.scale.set(s, 0.6 + 0.4 * s, s);
    });
  }

  dispose(): void {
    while (this.spots.length) this.removeSpot(0);
    if (this.travel) {
      this.travel.pad.mesh.removeFromParent();
      this.w.labels.remove(this.travel.label);
    }
  }
}
