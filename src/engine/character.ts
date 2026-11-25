import * as THREE from 'three';
import { cloneCharacter, getAssets, hasTemplate, spawn } from './assets';
import { toonMat } from './toon';

export type Anim =
  | 'idle'
  | 'walk'
  | 'run'
  | 'carry_idle'
  | 'carry_walk'
  | 'carry_run'
  | 'cheer'
  | 'sit'
  | 'sit_eat'
  | 'wave'
  | 'angry';

export type WearSlot = 'hat' | 'outfit' | 'shoes';

/** Metres covered per animation loop, so the feet never skate. */
const STRIDE: Partial<Record<Anim, number>> = {
  walk: 1.15,
  carry_walk: 1.1,
  run: 1.45,
  carry_run: 1.4,
};

/**
 * A skinned blob character: one colour, crossfaded skeletal animation and a little squash and stretch
 * applied on top so starts, stops and landings feel springy.
 */
export class Character {
  readonly root = new THREE.Group();
  readonly body: THREE.Object3D;
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions = new Map<Anim, THREE.AnimationAction>();
  private current: Anim | null = null;
  private squash = 0;
  private squashVel = 0;
  readonly headBone: THREE.Bone;
  readonly chestBone: THREE.Bone;
  private mesh: THREE.SkinnedMesh;
  private readonly worn = new Map<WearSlot, THREE.Object3D[]>();

  constructor(color: THREE.ColorRepresentation, scale = 1) {
    this.body = cloneCharacter();
    this.body.scale.setScalar(scale);
    this.root.add(this.body);
    let skinned: THREE.SkinnedMesh | null = null;
    this.body.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh) {
        skinned = m;
        m.castShadow = true;
        m.receiveShadow = false;
        m.frustumCulled = false;
      }
    });
    if (!skinned) throw new Error('character has no skinned mesh');
    this.mesh = skinned;
    this.setColor(color);
    this.headBone = this.body.getObjectByName('head') as THREE.Bone;
    this.chestBone = this.body.getObjectByName('spine') as THREE.Bone;
    this.mixer = new THREE.AnimationMixer(this.body);
    for (const [name, clip] of getAssets().clips) {
      const a = this.mixer.clipAction(clip);
      a.enabled = true;
      this.actions.set(name as Anim, a);
    }
    this.play('idle', 0);
    // desync crowds so idle loops never breathe in lockstep
    this.mixer.setTime(Math.random() * 2);
  }

  setColor(color: THREE.ColorRepresentation): void {
    this.mesh.material = toonMat(color, { key: 'chr' });
  }

  play(name: Anim, fade = 0.18, timeScale = 1): void {
    const next = this.actions.get(name);
    if (!next) return;
    next.timeScale = timeScale;
    if (this.current === name) return;
    const prev = this.current ? this.actions.get(this.current) : null;
    next.reset();
    next.setEffectiveWeight(1);
    next.play();
    if (prev && fade > 0) {
      // keep gait phase continuous when switching between locomotion loops
      const loco = STRIDE[name] && this.current && STRIDE[this.current];
      if (loco) next.time = (prev.time / prev.getClip().duration) * next.getClip().duration;
      prev.crossFadeTo(next, fade, false);
    } else if (prev) {
      prev.stop();
    }
    this.current = name;
  }

  get anim(): Anim | null {
    return this.current;
  }

  /** Locomotion blend: picks idle, walk or run from speed and keeps foot contact by scaling playback. */
  locomote(speed: number, carrying: boolean, runThreshold = 2.4): void {
    let name: Anim;
    if (speed < 0.15) name = carrying ? 'carry_idle' : 'idle';
    else if (speed < runThreshold) name = carrying ? 'carry_walk' : 'walk';
    else name = carrying ? 'carry_run' : 'run';
    const stride = STRIDE[name];
    let ts = 1;
    if (stride) {
      const clip = this.actions.get(name)!.getClip();
      ts = THREE.MathUtils.clamp((speed * clip.duration) / stride, 0.55, 2.2);
    }
    const fade = name === 'idle' || name === 'carry_idle' ? 0.22 : 0.14;
    this.play(name, fade, ts);
  }

  /** Kick the squash spring: positive squashes (landing, pickup), negative stretches (start, pop). */
  bump(amount: number): void {
    this.squashVel += amount * 14;
  }

  update(dt: number): void {
    this.mixer.update(dt);
    // critically damped-ish spring on a squash value
    const k = 260;
    const d = 18;
    this.squashVel += (-k * this.squash - d * this.squashVel) * dt;
    this.squash += this.squashVel * dt;
    const s = THREE.MathUtils.clamp(this.squash, -0.35, 0.35);
    const sy = 1 - s;
    const sxz = 1 / Math.sqrt(Math.max(0.4, sy));
    this.root.scale.set(sxz, sy, sxz);
  }

  /**
   * Put on a hat, outfit or pair of shoes. Wearables are modelled in character space, so each one is
   * parented to its bone through that bone's inverse bind matrix and then follows the animation exactly.
   */
  wear(slot: WearSlot, name: string | null): void {
    for (const o of this.worn.get(slot) ?? []) o.removeFromParent();
    this.worn.delete(slot);
    if (!name) return;
    const parts: [string, string][] =
      slot === 'shoes' ? [[`${name}_l`, 'shinL'], [`${name}_r`, 'shinR']] : [[name, slot === 'hat' ? 'head' : 'spine']];
    const list: THREE.Object3D[] = [];
    const sk = this.mesh.skeleton;
    for (const [model, boneName] of parts) {
      if (!hasTemplate(model)) continue;
      const bone = this.body.getObjectByName(boneName) as THREE.Bone | undefined;
      if (!bone) continue;
      const idx = sk.bones.indexOf(bone);
      const o = spawn(model);
      o.matrixAutoUpdate = false;
      o.matrix.copy(sk.boneInverses[idx]).multiply(this.mesh.bindMatrix);
      o.traverse((c) => {
        if ((c as THREE.Mesh).isMesh) c.castShadow = true;
      });
      bone.add(o);
      list.push(o);
    }
    this.worn.set(slot, list);
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.root.removeFromParent();
  }
}
