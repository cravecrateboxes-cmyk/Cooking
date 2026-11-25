import * as THREE from 'three';

/**
 * Isometric-style follow camera. Framing adapts to the aspect ratio so a portrait phone, a tablet and a
 * wide desktop window all see roughly the same play area around the chef.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly target = new THREE.Vector3();
  private readonly focus = new THREE.Vector3();
  private readonly offsetDir = new THREE.Vector3();
  private readonly baseYaw = THREE.MathUtils.degToRad(42);
  private readonly basePitch = THREE.MathUtils.degToRad(52);
  yaw = this.baseYaw;
  pitch = this.basePitch;
  /** title-screen mode: pull back and sway slowly around the place; eases in and out */
  showcase = false;
  private show = 0;
  private time = 0;
  private readonly goal = new THREE.Vector3();
  /** world metres that must fit across the narrow side of the screen (set from the screen size) */
  private span = 7.6;
  private dist = 18;
  private shake = 0;
  private zoomPunch = 0;
  private readonly right = new THREE.Vector3();
  private readonly up = new THREE.Vector3();
  lookAhead = new THREE.Vector3();
  bounds: THREE.Box2 | null = null;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(32, aspect, 0.5, 120);
    this.resize(aspect, 400);
  }

  /** @param short the screen's shorter side in CSS px: bigger screens see more of the place, not bigger people */
  resize(aspect: number, short: number): void {
    const cam = this.camera;
    this.span = THREE.MathUtils.clamp(7.6 + (short - 420) * 0.0085, 7.6, 11.5);
    cam.aspect = aspect;
    // narrower field of view on wide screens keeps the iso look; portrait needs a bit more vertical room
    cam.fov = aspect < 1 ? 34 : 28;
    const vt = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const ht = vt * aspect;
    // fit the span across the narrow axis, but never zoom in tighter than a sensible minimum on desktops
    const across = aspect < 1 ? this.span / (2 * ht) : (this.span * 0.95) / (2 * vt);
    this.dist = THREE.MathUtils.clamp(across, 11, 34);
    cam.updateProjectionMatrix();
  }

  /** Screen-space stick (x right, y down) to a world XZ direction. */
  screenToWorld(x: number, y: number, out: THREE.Vector3): THREE.Vector3 {
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    this.up.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    out.set(0, 0, 0).addScaledVector(this.right, x).addScaledVector(this.up, -y);
    return out;
  }

  snap(p: THREE.Vector3): void {
    this.target.copy(p);
    this.focus.copy(p);
    this.apply(0);
  }

  addShake(a: number): void {
    this.shake = Math.min(0.5, this.shake + a);
  }

  punch(a: number): void {
    this.zoomPunch = Math.max(this.zoomPunch, a);
  }

  update(dt: number): void {
    // exponential smoothing that is frame-rate independent
    const k = 1 - Math.exp(-dt * 6.5);
    this.time += dt;
    this.show += ((this.showcase ? 1 : 0) - this.show) * (1 - Math.exp(-dt * 2.2));
    const s = this.show * this.show * (3 - 2 * this.show);
    this.yaw = this.baseYaw + Math.sin(this.time * 0.13) * 0.5 * s;
    this.pitch = this.basePitch - 0.1 * s;
    const goal = this.goal.copy(this.target).add(this.lookAhead);
    if (this.bounds) {
      goal.x = THREE.MathUtils.clamp(goal.x, this.bounds.min.x, this.bounds.max.x);
      goal.z = THREE.MathUtils.clamp(goal.z, this.bounds.min.y, this.bounds.max.y);
    }
    this.focus.lerp(goal, k);
    this.apply(dt);
  }

  private apply(dt: number): void {
    this.zoomPunch = Math.max(0, this.zoomPunch - dt * 1.8);
    const d = this.dist * (1 - this.zoomPunch * 0.08) * (1 + this.show * 0.3);
    this.offsetDir.set(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    this.camera.position.copy(this.focus).addScaledVector(this.offsetDir, d);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.5);
      const s = this.shake * this.shake * 0.35;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }
    this.camera.lookAt(this.focus);
  }
}
