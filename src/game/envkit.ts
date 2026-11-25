import * as THREE from 'three';
import { spawn } from '../engine/assets';
import { toonMat, toonRamp } from '../engine/toon';

/** Building blocks shared by the map environments: canvas textures, floors, boxes and prop placement. */
export function checker(a: string, b: string, cells = 2, px = 64, grout?: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = px * cells;
  const g = c.getContext('2d');
  if (!g) throw new Error('2d canvas unavailable');
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      g.fillStyle = (x + y) % 2 ? a : b;
      g.fillRect(x * px, y * px, px, px);
    }
  }
  if (grout) {
    g.strokeStyle = grout;
    g.lineWidth = 3;
    for (let i = 0; i <= cells; i++) {
      g.beginPath();
      g.moveTo(i * px, 0);
      g.lineTo(i * px, c.height);
      g.moveTo(0, i * px);
      g.lineTo(c.width, i * px);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function planks(a: string, b: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  if (!g) throw new Error('2d canvas unavailable');
  const rows = 8;
  const h = c.height / rows;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * 96;
    for (let x = -off; x < c.width; x += 192) {
      g.fillStyle = (r + Math.floor(x / 192)) % 2 ? a : b;
      g.fillRect(x, r * h, 192, h);
      g.fillStyle = 'rgba(80,30,20,0.35)';
      g.fillRect(x, r * h, 3, h);
    }
    g.fillStyle = 'rgba(80,30,20,0.35)';
    g.fillRect(0, r * h, c.width, 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Vertical diner wallpaper stripes with a thin darker pinstripe. */
export function stripes(a: string, b: string, pin: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 8;
  const g = c.getContext('2d');
  if (!g) throw new Error('2d canvas unavailable');
  g.fillStyle = a;
  g.fillRect(0, 0, 64, 8);
  g.fillStyle = b;
  g.fillRect(64, 0, 64, 8);
  g.fillStyle = pin;
  g.fillRect(62, 0, 4, 8);
  g.fillRect(126, 0, 2, 8);
  g.fillRect(0, 0, 2, 8);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function floor(root: THREE.Group, x0: number, z0: number, x1: number, z1: number, tex: THREE.Texture, tile: number, y = 0): void {
  const w = x1 - x0;
  const d = z1 - z0;
  const t = tex.clone();
  t.needsUpdate = true;
  t.repeat.set(w / tile, d / tile);
  const m = new THREE.MeshToonMaterial({ map: t, gradientMap: toonRamp() });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  mesh.receiveShadow = true;
  root.add(mesh);
}

export function block(root: THREE.Group, x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, colour: string, shadow = true): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), toonMat(colour));
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
}

export function put(root: THREE.Group, name: string, x: number, z: number, rot = 0, s = 1, y = 0): THREE.Object3D {
  const o = spawn(name);
  o.position.set(x, y, z);
  o.rotation.y = rot;
  o.scale.setScalar(s);
  root.add(o);
  return o;
}

