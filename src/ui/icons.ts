import * as THREE from 'three';
import { spawn } from '../engine/assets';
import { DISHES, type Dish } from '../game/config';

const urls = new Map<string, string>();

/** Icons made from several models: a tall carry stack for Big Arms, a side-on running shoe for Quick Feet. */
const COMPOSITES: Record<string, () => THREE.Object3D> = {
  up_capacity: () => {
    const g = new THREE.Group();
    let y = 0;
    for (const d of ['burger', 'fries', 'pizza', 'burger', 'soda'] as Dish[]) {
      const o = spawn(DISHES[d].model);
      const b = new THREE.Box3().setFromObject(o);
      o.position.y = y - b.min.y;
      o.rotation.y = y * 3;
      y += b.max.y - b.min.y + 0.01;
      g.add(o);
    }
    return g;
  },
  up_speed: () => {
    const g = new THREE.Group();
    const o = spawn('cos_shoe_sneaker_l');
    g.add(o);
    // speed streaks trailing behind the heel
    const b = new THREE.Box3().setFromObject(o);
    const size = b.getSize(new THREE.Vector3());
    const mat = new THREE.MeshBasicMaterial({ color: '#ffd23f' });
    const geo = new THREE.CapsuleGeometry(size.y * 0.07, size.z * 0.55, 4, 8).rotateX(Math.PI / 2);
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(b.min.x + size.x * (0.25 + i * 0.25), b.min.y + size.y * (0.3 + i * 0.22), b.min.z - size.z * (0.25 + (i % 2) * 0.12));
      g.add(m);
    }
    return g;
  },
};

function build(name: string): THREE.Object3D {
  return COMPOSITES[name]?.() ?? spawn(name);
}

/**
 * Renders each dish model once, off screen, in the same toon shading as the game, and keeps the result
 * as an image for order bubbles and menus. The UI then shows the actual 3D food, not a drawn stand-in.
 */
export function renderIcons(renderer: THREE.WebGLRenderer, names: string[] = []): void {
  const size = 256;
  const rt = new THREE.WebGLRenderTarget(size, size, { samples: 4 });
  rt.texture.colorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fff6e8', '#ffb59a', 2.0));
  const sun = new THREE.DirectionalLight('#ffffff', 2.4);
  sun.position.set(2, 4, 3);
  scene.add(sun);
  const cam = new THREE.PerspectiveCamera(26, 1, 0.05, 20);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  if (!g) return;
  const px = new Uint8Array(size * size * 4);
  const img = g.createImageData(size, size);
  const prevTarget = renderer.getRenderTarget();
  const prevClear = renderer.getClearAlpha();
  renderer.setClearAlpha(0);
  const all = [...(Object.keys(DISHES) as Dish[]).map((d) => DISHES[d].model), ...names, ...Object.keys(COMPOSITES)];
  for (const name of all) {
    const obj = build(name);
    scene.add(obj);
    const box = new THREE.Box3().setFromObject(obj);
    const c = box.getCenter(new THREE.Vector3());
    const r = box.getSize(new THREE.Vector3()).length() * 0.5;
    const dir = new THREE.Vector3(0.55, 0.62, 1).normalize();
    cam.position.copy(c).addScaledVector(dir, r / Math.sin(THREE.MathUtils.degToRad(13)) * 0.98);
    cam.lookAt(c);
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, cam);
    renderer.readRenderTargetPixels(rt, 0, 0, size, size, px);
    // flip rows: GL reads bottom-up
    for (let y = 0; y < size; y++) {
      const src = (size - 1 - y) * size * 4;
      img.data.set(px.subarray(src, src + size * 4), y * size * 4);
    }
    g.clearRect(0, 0, size, size);
    g.putImageData(img, 0, 0);
    urls.set(name, canvas.toDataURL('image/png'));
    scene.remove(obj);
  }
  renderer.setRenderTarget(prevTarget);
  renderer.setClearAlpha(prevClear);
  rt.dispose();
}

export function iconFor(dish: Dish): string {
  return urls.get(DISHES[dish].model) ?? '';
}

export function iconNamed(name: string): string {
  return urls.get(name) ?? '';
}
