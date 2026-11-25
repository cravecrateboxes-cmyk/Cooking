import * as THREE from 'three';
import { toonRamp } from '../engine/toon';

interface P {
  alive: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rot: THREE.Euler;
  spin: THREE.Vector3;
  life: number;
  max: number;
  size: number;
  grav: number;
  drag: number;
  shrink: boolean;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

/** A pool of 3D particles drawn with one instanced mesh (one draw call per pool). */
class Pool {
  readonly mesh: THREE.InstancedMesh;
  private readonly ps: P[] = [];
  private next = 0;

  constructor(geo: THREE.BufferGeometry, count: number) {
    const mat = new THREE.MeshToonMaterial({ gradientMap: toonRamp() });
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    for (let i = 0; i < count; i++) {
      this.ps.push({
        alive: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        rot: new THREE.Euler(),
        spin: new THREE.Vector3(),
        life: 0,
        max: 1,
        size: 1,
        grav: 0,
        drag: 0,
        shrink: true,
      });
      this.mesh.setColorAt(i, _c.set('#ffffff'));
      _m.makeScale(0, 0, 0);
      this.mesh.setMatrixAt(i, _m);
    }
  }

  emit(pos: THREE.Vector3, vel: THREE.Vector3, color: THREE.ColorRepresentation, size: number, life: number, grav: number, drag: number, shrink = true): void {
    const i = this.next;
    this.next = (this.next + 1) % this.ps.length;
    const p = this.ps[i];
    p.alive = true;
    p.pos.copy(pos);
    p.vel.copy(vel);
    p.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    p.spin.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14);
    p.life = 0;
    p.max = life;
    p.size = size;
    p.grav = grav;
    p.drag = drag;
    p.shrink = shrink;
    this.mesh.setColorAt(i, _c.set(color));
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number): void {
    let any = false;
    for (let i = 0; i < this.ps.length; i++) {
      const p = this.ps[i];
      if (!p.alive) continue;
      any = true;
      p.life += dt;
      if (p.life >= p.max) {
        p.alive = false;
        _m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, _m);
        continue;
      }
      p.vel.y -= p.grav * dt;
      p.vel.multiplyScalar(Math.exp(-p.drag * dt));
      p.pos.addScaledVector(p.vel, dt);
      if (p.pos.y < 0.03) {
        p.pos.y = 0.03;
        p.vel.y *= -0.35;
        p.vel.x *= 0.6;
        p.vel.z *= 0.6;
        p.spin.multiplyScalar(0.6);
      }
      p.rot.x += p.spin.x * dt;
      p.rot.y += p.spin.y * dt;
      p.rot.z += p.spin.z * dt;
      const k = p.life / p.max;
      const sc = p.size * (p.shrink ? (k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.6) / 0.4)) : 1);
      _q.setFromEuler(p.rot);
      _s.setScalar(Math.max(0, sc));
      _m.compose(p.pos, _q, _s);
      this.mesh.setMatrixAt(i, _m);
    }
    if (any) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

const CONFETTI = ['#ff4b55', '#ffd23f', '#3fa9f5', '#5ccf54', '#ff79b4', '#8a5cf5', '#ff8a2b'];

export class Particles {
  readonly group = new THREE.Group();
  private readonly confetti: Pool;
  private readonly puffs: Pool;
  private readonly sparks: Pool;
  private readonly v = new THREE.Vector3();
  private readonly p = new THREE.Vector3();

  constructor() {
    this.confetti = new Pool(new THREE.BoxGeometry(0.09, 0.016, 0.06), 260);
    this.puffs = new Pool(new THREE.IcosahedronGeometry(0.5, 1), 120);
    this.sparks = new Pool(new THREE.OctahedronGeometry(0.06, 0), 120);
    this.group.add(this.confetti.mesh, this.puffs.mesh, this.sparks.mesh);
  }

  confettiBurst(at: THREE.Vector3, n = 60, power = 6): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = 0.55 + Math.random() * 0.45;
      const sp = power * (0.45 + Math.random() * 0.55);
      this.v.set(Math.cos(a) * sp * (1 - up * 0.6), sp * up * 1.3, Math.sin(a) * sp * (1 - up * 0.6));
      this.confetti.emit(at, this.v, CONFETTI[i % CONFETTI.length], 1 + Math.random() * 0.8, 1.6 + Math.random() * 0.9, 11, 1.6, false);
    }
  }

  /** Soft ground puff, e.g. a footstep or something landing. */
  dust(at: THREE.Vector3, n = 5, color: THREE.ColorRepresentation = '#ffe3b5', size = 0.16): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.6 + Math.random() * 0.9;
      this.v.set(Math.cos(a) * sp, 0.4 + Math.random() * 0.8, Math.sin(a) * sp);
      this.p.copy(at).add(this.v.clone().multiplyScalar(0.08));
      this.puffs.emit(this.p, this.v, color, size * (0.7 + Math.random() * 0.6), 0.45 + Math.random() * 0.25, -0.6, 3.5);
    }
  }

  /** Big poof when something appears. */
  poof(at: THREE.Vector3, radius = 1, color: THREE.ColorRepresentation = '#fff1d6'): void {
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      const sp = 2.4 + Math.random() * 1.6;
      this.v.set(Math.cos(a) * sp, 0.6 + Math.random() * 1.4, Math.sin(a) * sp);
      this.p.set(at.x + Math.cos(a) * radius * 0.5, at.y + 0.15, at.z + Math.sin(a) * radius * 0.5);
      this.puffs.emit(this.p, this.v, color, 0.3 + Math.random() * 0.25, 0.6 + Math.random() * 0.3, -0.5, 3.2);
    }
  }

  sparkle(at: THREE.Vector3, color: THREE.ColorRepresentation, n = 8, power = 2.4): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const up = Math.random();
      this.v.set(Math.cos(a) * power * (1 - up * 0.5), power * (0.6 + up), Math.sin(a) * power * (1 - up * 0.5));
      this.sparks.emit(at, this.v, color, 0.8 + Math.random() * 0.8, 0.5 + Math.random() * 0.3, 7, 2.2);
    }
  }

  /** Rising steam or smoke column. */
  steam(at: THREE.Vector3, color: THREE.ColorRepresentation = '#ffe8cc'): void {
    this.v.set((Math.random() - 0.5) * 0.25, 0.9 + Math.random() * 0.5, (Math.random() - 0.5) * 0.25);
    this.puffs.emit(at, this.v, color, 0.07 + Math.random() * 0.06, 0.9 + Math.random() * 0.4, -0.8, 0.8);
  }

  update(dt: number): void {
    this.confetti.update(dt);
    this.puffs.update(dt);
    this.sparks.update(dt);
  }
}
