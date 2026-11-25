import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import charUrl from '../assets/character.glb?url';
import foodUrl from '../assets/food.glb?url';
import propsUrl from '../assets/props.glb?url';
import cosUrl from '../assets/cosmetics.glb?url';
import { toonify } from './toon';

export interface Assets {
  character: GLTF;
  clips: Map<string, THREE.AnimationClip>;
  templates: Map<string, THREE.Object3D>;
}

let assets: Assets | null = null;

export async function loadAssets(onProgress: (f: number) => void): Promise<Assets> {
  const loader = new GLTFLoader();
  const urls = [charUrl, foodUrl, propsUrl, cosUrl];
  let done = 0;
  // the models are inlined as data URLs; decode them here because the artifact sandbox blocks fetch() of data: URLs
  const load = async (u: string) => {
    const buf = u.startsWith('data:') ? toBuffer(u) : await (await fetch(u)).arrayBuffer();
    return loader.parseAsync(buf, '').then((g) => {
      done++;
      onProgress(done / urls.length);
      return g;
    });
  };
  const [character, food, props, cos] = await Promise.all(urls.map(load));
  const templates = new Map<string, THREE.Object3D>();
  for (const g of [food, props, cos]) {
    for (const child of [...g.scene.children]) {
      toonify(child);
      child.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });
      child.position.set(0, 0, 0);
      templates.set(child.name, child);
    }
  }
  const clips = new Map(character.animations.map((c) => [c.name, c]));
  assets = { character, clips, templates };
  return assets;
}

function toBuffer(url: string): ArrayBuffer {
  const b64 = url.slice(url.indexOf(',') + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export function getAssets(): Assets {
  if (!assets) throw new Error('assets not loaded');
  return assets;
}

/** Clone a static prop or food template by name. Meshes share geometry and materials. */
export function spawn(name: string): THREE.Object3D {
  const t = getAssets().templates.get(name);
  if (!t) throw new Error(`missing template ${name}`);
  return t.clone(true);
}

export function hasTemplate(name: string): boolean {
  return getAssets().templates.has(name);
}

export function cloneCharacter(): THREE.Object3D {
  return cloneSkinned(getAssets().character.scene);
}
