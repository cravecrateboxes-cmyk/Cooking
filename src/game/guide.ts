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
const TRAIL = 7; // chevrons laid along the route
const GAP = 0.62; // metres between chevrons
const REPLAN = 0.3; // seconds between route updates

function plural(d: Dish): string {
  const n = DISHES[d].name.toLowerCase();
  return n.endsWith('s') ? n : `${n}s`;
}

/** A trail of floor chevrons along the walking route to the next thing to do, and a bobbing marker over it. */
export class Guide {
  private readonly arrow = new THREE.Group();
  private readonly pin: THREE.Mesh;
  private readonly chevrons: THREE.Mesh[] = [];
  private goal: THREE.Vector3 | null = null;
  /** the route from the chef to the goal, around counters and tables, starting at the chef */
  private route: THREE.Vector3[] = [];
  private routeT = 0;
  private fade = 0;
  hint: string | null = null;
  /** seconds the chef has held a full stack nobody wants */
  private stuck = 0;

  constructor(private readonly w: World) {
    const g = chevron();
    const m = toonMat('#ffd23f', { emissive: 0.35, key: 'guide' });
    for (let i = 0; i < TRAIL; i++) {
      const c = new THREE.Mesh(g, m);
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
        this.hint = buyHint(next.def.title);
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
    if (next && canPay && affordable) {
      this.goal = next.pad.pos;
      if (w.progress.unlocked.length < 6) this.hint = buyHint(next.def.title);
    }
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
      this.routeT -= dt;
      if (this.routeT <= 0 || !this.route.length) {
        this.routeT = REPLAN;
        this.route = [p.pos.clone(), ...this.w.nav.path(p.pos, g)];
      } else {
        this.route[0].copy(p.pos);
      }
      // chevrons ride along the route, each turned the way the route goes there, fading out near the goal
      const scroll = (t * 1.4) % GAP;
      this.chevrons.forEach((c, i) => {
        const along = 0.85 + i * GAP + scroll;
        const left = this.along(along, c.position);
        c.rotation.y = Math.atan2(_d.x, _d.z);
        const fadeIn = Math.min(1, (along - 0.85) / GAP);
        const fadeOut = Math.min(1, Math.max(0, left - 0.9) / 0.8);
        c.scale.setScalar(0.62 * Math.min(fadeIn, fadeOut) * this.fade);
        c.position.y = 0.03;
      });
      this.pin.position.set(g.x, 2.0 + Math.sin(t * 4) * 0.15, g.z);
      this.pin.rotation.y = t * 1.5;
    }
  }

  /** the point a distance along the route into out, leaving its direction in _d; returns the distance left */
  private along(dist: number, out: THREE.Vector3): number {
    const r = this.route;
    let d = dist;
    for (let i = 1; i < r.length; i++) {
      const a = r[i - 1];
      const b = r[i];
      const seg = Math.hypot(b.x - a.x, b.z - a.z);
      if (seg < 1e-4) continue;
      _d.set((b.x - a.x) / seg, 0, (b.z - a.z) / seg);
      if (d <= seg) {
        out.set(a.x + _d.x * d, 0, a.z + _d.z * d);
        let left = seg - d;
        for (let k = i + 1; k < r.length; k++) left += Math.hypot(r[k].x - r[k - 1].x, r[k].z - r[k - 1].z);
        return left;
      }
      d -= seg;
    }
    const end = r[r.length - 1];
    out.set(end.x, 0, end.z);
    return 0;
  }
}

/** "Hire Waiter" reads as "hire the waiter", "Open Beach Truck" as "open the Beach Truck", anything else is bought. */
function buyHint(title: string): string {
  const [verb, ...rest] = title.split(' ');
  if (verb === 'Hire') return `Walk onto the glowing pad to hire the ${rest.join(' ').toLowerCase()}`;
  if (verb === 'Open') return `Walk onto the glowing pad to open the ${rest.join(' ')}`;
  return `Walk onto the glowing pad to buy the ${title}`;
}
