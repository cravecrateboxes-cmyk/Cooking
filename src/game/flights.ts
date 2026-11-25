import * as THREE from 'three';

interface Flight {
  obj: THREE.Object3D;
  from: THREE.Vector3;
  to: (out: THREE.Vector3) => THREE.Vector3;
  t: number;
  dur: number;
  arc: number;
  spin: number;
  scaleFrom: number;
  scaleTo: number;
  done: () => void;
  quat: THREE.Quaternion;
}

const _to = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _id = new THREE.Quaternion();

/**
 * Things that hop from one place to another on a little arc: dishes onto a stack, bills onto a pile,
 * coins into the chef. The target is a function so it follows a moving carrier.
 */
export class Flights {
  private readonly list: Flight[] = [];

  constructor(private readonly scene: THREE.Object3D) {}

  get busy(): number {
    return this.list.length;
  }

  launch(
    obj: THREE.Object3D,
    from: THREE.Vector3,
    to: (out: THREE.Vector3) => THREE.Vector3,
    done: () => void,
    opts: { dur?: number; arc?: number; spin?: number; scaleFrom?: number; scaleTo?: number } = {},
  ): void {
    obj.removeFromParent();
    this.scene.add(obj);
    obj.position.copy(from);
    this.list.push({
      obj,
      from: from.clone(),
      to,
      t: 0,
      dur: opts.dur ?? 0.3,
      arc: opts.arc ?? 0.9,
      spin: opts.spin ?? 0,
      scaleFrom: opts.scaleFrom ?? 1,
      scaleTo: opts.scaleTo ?? 1,
      done,
      quat: obj.quaternion.clone(),
    });
  }

  update(dt: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      f.t += dt / f.dur;
      const k = Math.min(1, f.t);
      f.to(_to);
      const e = k * k * (3 - 2 * k);
      f.obj.position.lerpVectors(f.from, _to, e);
      f.obj.position.y += Math.sin(Math.PI * k) * f.arc;
      _q.slerpQuaternions(f.quat, _id, e);
      f.obj.quaternion.copy(_q);
      if (f.spin) f.obj.rotateY(f.spin * k * Math.PI * 2);
      f.obj.scale.setScalar(f.scaleFrom + (f.scaleTo - f.scaleFrom) * e);
      if (k >= 1) {
        this.list.splice(i, 1);
        f.done();
      }
    }
  }

  clear(): void {
    for (const f of this.list) f.obj.removeFromParent();
    this.list.length = 0;
  }
}
