import * as THREE from 'three';
import { padMaterial } from './padMaterial';

const geo = new THREE.PlaneGeometry(1, 1);
geo.rotateX(-Math.PI / 2);

/** A flat square on the floor that reacts when the chef steps on it. */
export class Pad {
  readonly mesh: THREE.Mesh;
  readonly mat: THREE.ShaderMaterial;
  readonly pos: THREE.Vector3;
  readonly half: number;
  active = true;
  /** 0..1, drawn as a rising fill */
  fill = 0;
  private pulse = 0;
  private hot = 0;
  private appear = 1;

  constructor(x: number, z: number, size: number, color: THREE.ColorRepresentation, rim: THREE.ColorRepresentation) {
    this.mat = padMaterial(color, rim);
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.scale.set(size, 1, size);
    this.mesh.position.set(x, 0.02, z);
    this.mesh.renderOrder = 1;
    this.pos = this.mesh.position;
    this.half = size / 2;
  }

  contains(p: THREE.Vector3, margin = 0): boolean {
    return Math.abs(p.x - this.pos.x) < this.half + margin && Math.abs(p.z - this.pos.z) < this.half + margin;
  }

  /** Pop in with an overshoot when the pad first appears. */
  popIn(): void {
    this.appear = 0;
  }

  update(dt: number, time: number, occupied: boolean, wants: boolean): void {
    this.hot += ((occupied ? 1 : 0) - this.hot) * (1 - Math.exp(-dt * 12));
    this.pulse = wants ? 0.5 + 0.5 * Math.sin(time * 5) : this.hot;
    if (this.appear < 1) this.appear = Math.min(1, this.appear + dt * 3.2);
    const a = this.appear;
    const s = a < 1 ? 1 + Math.sin(a * Math.PI) * 0.35 - (1 - a) * 0.9 : 1;
    this.mesh.scale.set(this.half * 2 * s * (1 + this.hot * 0.06), 1, this.half * 2 * s * (1 + this.hot * 0.06));
    const u = this.mat.uniforms;
    u.uFill.value = this.fill;
    u.uPulse.value = this.pulse;
    u.uTime.value = time;
    u.uDash.value = 1 - this.hot;
    u.uAlpha.value = Math.min(1, a * 2);
  }
}
