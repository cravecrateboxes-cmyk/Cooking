import * as THREE from 'three';
import { toonMat } from '../engine/toon';
import { DISHES, type Dish } from './config';
import type { World } from './world';

function chevron(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0.5);
  s.lineTo(0.42, 0.04);
  s.lineTo(0.42, -0.2);
  s.lineTo(0, 0.2);
  s.lineTo(-0.42, -0.2);
  s.lineTo(-0.42, 0.04);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.03, bevelSegments: 2 });
  g.rotateX(-Math.PI / 2);
  return g;
}

function marker(): THREE.BufferGeometry {
  const g = new THREE.ConeGeometry(0.26, 0.5, 4, 1);
  g.rotateX(Math.PI);
  g.rotateY(Math.PI / 4);
  return g;
}

const _d = new THREE.Vector3();

function plural(d: Dish): string {
  const n = DISHES[d].name.toLowerCase();
  return n.endsWith('s') ? n : `${n}s`;
}

/** Floor chevrons around the chef pointing at the next thing to do, and a bobbing marker over it. */
export class Guide {
  private readonly arrow = new THREE.Group();
  private readonly pin: THREE.Mesh;
  private readonly chevrons: THREE.Mesh[] = [];
  private goal: THREE.Vector3 | null = null;
  private fade = 0;
  hint: string | null = null;
  /** seconds the chef has held a full stack nobody wants */
  private stuck = 0;

  constructor(private readonly w: World) {
    const g = chevron();
    const m = toonMat('#ffd23f', { emissive: 0.35, key: 'guide' });
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(g, m);
      c.position.z = 0.95 + i * 0.42;
      c.rotation.y = 0;
      c.scale.setScalar(0.7 - i * 0.12);
      this.arrow.add(c);
      this.chevrons.push(c);
    }
    this.pin = new THREE.Mesh(marker(), toonMat('#ff4b55', { emissive: 0.3, key: 'guide' }));
    w.scene.add(this.arrow, this.pin);
  }

  private pick(dt: number): void {
    const w = this.w;
    const p = w.player;
    this.goal = null;
    this.hint = null;
    const first = w.progress.unlocked.length === 0;
    const next = w.unlocks.next();
    const affordable = next && (next.def.gems ? w.save.gems >= 1 : w.save.coins >= Math.min(next.def.cost, 1));
    const canPay = next && (next.def.gems ? w.save.gems >= next.def.gems : w.save.coins >= next.def.cost);
    const front = w.service.front();
    // hands full of food that can't go anywhere: nobody wants it, or the counter tray is full while the
    // guest in front waits for something else
    const wanted = p.stack.items.some((i) => w.service.someoneWants(i.kind as Dish));
    const frontWants = (d: Dish) => !!front && front.wants(d);
    const jammed = !!front && w.pass.full && !p.stack.items.some((i) => frontWants(i.kind as Dish)) && !w.pass.has(frontWants);
    this.stuck = p.stack.holdsFood && p.full && (!wanted || jammed) ? this.stuck + dt : 0;
    if (this.stuck > 3) {
      this.goal = w.binPad.pos;
      this.hint = 'Hands full? Toss extra food in the bin';
      return;
    }
    if (first) {
      if (canPay && next) {
        this.goal = next.pad.pos;
        this.hint = `Stand here to buy the ${next.def.title}`;
      } else if (w.cash.count > 0) {
        this.goal = w.cash.root.position;
        this.hint = 'Walk over the cash to grab it';
      } else if (p.stack.holdsFood && front) {
        this.goal = w.servePad.pos;
        this.hint = 'Serve the guest at the counter';
      } else if (!p.stack.holdsFood || (front && p.stack.count < front.remaining)) {
        const st = w.stations.find((s) => s.unlocked);
        if (st) {
          this.goal = st.pad.pos;
          this.hint = `Stand here to cook ${plural(st.dish)}`;
        }
      } else if (p.stack.holdsFood) {
        this.goal = w.servePad.pos;
        this.hint = 'Stock the counter tray for the next guests';
      }
      return;
    }
    if (next && canPay && affordable) this.goal = next.pad.pos;
    else if (p.stack.holdsPlates && w.sinkOn) this.goal = w.sinkPad.pos;
    else if (front && front.waited > 6 && !p.stack.items.some((i) => frontWants(i.kind as Dish)) && !w.pass.has(frontWants)) {
      // the guest at the counter is waiting on a dish nobody is bringing: point at the station that makes it
      const line = front.order.find((l) => l.got < l.want);
      const st = line && w.stations.find((s) => s.unlocked && s.dish === line.dish);
      if (line && st) {
        this.goal = st.pad.pos;
        this.hint = `Cook ${plural(line.dish)} for the guest at the counter`;
      }
    }
  }

  hide(): void {
    this.arrow.visible = false;
    this.pin.visible = false;
    this.fade = 0;
  }

  update(dt: number): void {
    this.pick(dt);
    const p = this.w.player;
    const g = this.goal;
    const far = g ? Math.hypot(g.x - p.pos.x, g.z - p.pos.z) : 0;
    const want = g && far > 1.6 ? 1 : 0;
    this.fade += (want - this.fade) * (1 - Math.exp(-dt * 10));
    this.arrow.visible = this.fade > 0.02;
    this.pin.visible = !!g;
    const t = this.w.time;
    if (g) {
      _d.set(g.x - p.pos.x, 0, g.z - p.pos.z);
      this.arrow.position.set(p.pos.x, 0.03, p.pos.z);
      this.arrow.rotation.y = Math.atan2(_d.x, _d.z);
      this.arrow.scale.setScalar(this.fade);
      this.chevrons.forEach((c, i) => {
        c.position.z = 0.9 + i * 0.4 + ((t * 1.6) % 0.4);
      });
      this.pin.position.set(g.x, 2.0 + Math.sin(t * 4) * 0.15, g.z);
      this.pin.rotation.y = t * 1.5;
    }
  }
}
