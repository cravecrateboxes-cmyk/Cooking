import * as THREE from 'three';
import { spawn } from '../engine/assets';
import type { Env } from './environment';
import { block, checker, floor, planks, put } from './envkit';
import { TRUCK as TRUCK_MAP } from './maps';
import type { Rect } from './nav';
import { Rng } from './rng';
import { waterMaterial } from './water';

/** The food truck's interior centre (floor top at y 0); the hatch faces +X, the cab is at +Z. */
const TRUCK = { x: -3.95, z: -0.9 };
/** Shoreline: points with x + z below -SHORE are sea. */
const SHORE = 16;
const DIAG = Math.SQRT1_2;

function sandTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (!g) throw new Error('2d canvas unavailable');
  g.fillStyle = '#ffd3a1';
  g.fillRect(0, 0, 128, 128);
  const rng = new Rng(11);
  for (let i = 0; i < 140; i++) {
    g.fillStyle = rng.chance(0.5) ? '#f4c08a' : '#ffe2bb';
    const r = rng.range(1, 2.6);
    g.beginPath();
    g.arc(rng.range(0, 128), rng.range(0, 128), r, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A strip along the shoreline: wet sand, then the sea plane running out to the horizon. */
function sea(root: THREE.Group): THREE.ShaderMaterial {
  const sx = -SHORE / 2;
  const wet = new THREE.Mesh(new THREE.PlaneGeometry(200, 2.4), new THREE.MeshToonMaterial({ color: '#efb27c' }));
  wet.rotation.order = 'YXZ';
  wet.rotation.set(-Math.PI / 2, Math.PI / 4, 0);
  wet.position.set(sx + 0.9 * DIAG, -0.012, sx + 0.9 * DIAG);
  wet.receiveShadow = true;
  root.add(wet);
  const len = 60;
  const mat = waterMaterial();
  mat.uniforms.uLen.value = len;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(200, len), mat);
  water.rotation.order = 'YXZ';
  water.rotation.set(-Math.PI / 2, Math.PI / 4, 0);
  water.position.set(sx - (len / 2) * DIAG, -0.004, sx - (len / 2) * DIAG);
  root.add(water);
  return mat;
}

/** The pink walk-in truck with its decorations and the blockers that keep the chef inside. */
function truck(root: THREE.Group, obstacles: Rect[]): void {
  const { x, z } = TRUCK;
  put(root, 'food_truck', x, z);
  floor(root, x - 1.57, z - 4.42, x + 1.57, z + 4.5, checker('#4aa8f0', '#3d97e2', 2, 64, '#2f7fc4'), 0.8, 0.006);
  // giant hot dog sign on the back wall's roof rim
  const sign = spawn('food_hotdog');
  sign.position.set(x - 1.6, 2.62, z - 0.6);
  sign.rotation.y = Math.PI / 4;
  sign.scale.setScalar(7);
  root.add(sign);
  put(root, 'menu_sign', x - 1.55, z + 2.6, Math.PI / 2, 0.9, 1.15);
  // blockers: back wall with wheel arches, end wall, hatch wall with shelf, door post, cab
  obstacles.push(
    { minX: x - 1.95, minZ: z - 4.6, maxX: x - 1.5, maxZ: z + 4.6 },
    { minX: x - 1.95, minZ: z - 4.65, maxX: x + 1.85, maxZ: z - 4.35 },
    { minX: x + 1.55, minZ: z - 4.65, maxX: x + 2.25, maxZ: z + 2.95 },
    { minX: x + 1.5, minZ: z + 4.35, maxX: x + 1.85, maxZ: z + 4.6 },
    { minX: x - 1.9, minZ: z + 4.45, maxX: x + 1.9, maxZ: z + 6.75 },
  );
}

/** Wooden deck in front of the hatch (queue and picnic area) and the boardwalk guests arrive on. */
function decks(root: THREE.Group, obstacles: Rect[]): void {
  const wood = planks('#e5a46b', '#d8955c');
  block(root, -1.95, -3.0, 7.75, 7.5, -0.1, 0.0, '#a7653a', false);
  floor(root, -1.85, -2.9, 7.65, 7.4, wood, 2.4, 0.004);
  block(root, 7.6, -4.7, 26, -2.5, -0.1, 0.0, '#a7653a', false);
  floor(root, 7.6, -4.6, 26, -2.6, wood, 2.4, 0.004);
  // rope posts along the deck's open edges, clear of the paths guests walk
  const posts: [number, number][] = [];
  for (let px = -1.2; px < 5.5; px += 1.55) posts.push([px, -2.8]);
  for (let pz = 2.6; pz < 7.5; pz += 1.6) posts.push([7.55, pz]);
  for (const [px, pz] of posts) {
    put(root, 'bollard', px, pz, 0, 1);
    obstacles.push({ minX: px - 0.15, minZ: pz - 0.15, maxX: px + 0.15, maxZ: pz + 0.15 });
  }
  // little flags strung between neighbouring posts on each edge
  for (let i = 0; i + 1 < posts.length; i++) {
    const [ax, az] = posts[i];
    const [bx, bz] = posts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (len > 2) continue;
    put(root, 'pennant_rope', ax, az, Math.atan2(bx - ax, bz - az), 1).scale.z = len / 1.55;
  }
  // a striped mat under every picnic table and a few deck things around the edge
  for (const t of TRUCK_MAP.tables) put(root, 'rug_stripe', t.x, t.z, 0, 1, 0.006);
  const thing = (name: string, x: number, z: number, rot: number, hx: number, hz: number) => {
    put(root, name, x, z, rot);
    obstacles.push({ minX: x - hx, minZ: z - hz, maxX: x + hx, maxZ: z + hz });
  };
  thing('crates', 0.0, 6.95, 0.2, 0.75, 0.4);
  thing('planter_box', 4.1, 7.1, 0, 0.65, 0.3);
  thing('cooler', 7.05, 5.0, -Math.PI / 2, 0.3, 0.4);
  for (const [lx, lz] of [
    [-1.6, 7.2],
    [7.45, 7.2],
    [7.45, 1.4],
  ]) {
    put(root, 'lamp_post', lx, lz, 0);
  }
}

export function buildBeach(): Env {
  const root = new THREE.Group();
  const obstacles: Rect[] = [];
  const rng = new Rng(21);
  floor(root, -60, -60, 60, 60, sandTex(), 3, -0.02);
  const water = sea(root);
  truck(root, obstacles);
  decks(root, obstacles);

  const solid = (px: number, pz: number, r: number) => obstacles.push({ minX: px - r, minZ: pz - r, maxX: px + r, maxZ: pz + r });
  // palms framing the deck and the beach
  const palms: [number, number][] = [
    [8.7, 1.9],
    [9.3, 7.9],
    [0.6, 8.8],
    [-3.4, 8.2],
    [-8.0, 5.6],
    [-6.6, 9.6],
    [12.5, -7.2],
    [13.6, 3.4],
    [-1.0, -7.8],
    [5.8, -7.6],
    [16.4, -0.6],
    [4.6, 11.4],
  ];
  for (const [px, pz] of palms) {
    put(root, 'palm', px, pz, rng.range(0, 6.28), rng.range(0.9, 1.25));
    solid(px, pz, 0.35);
  }
  // sunbathing spots between the truck and the sea
  const spots: [number, number, number][] = [
    [-8.6, -3.6, 0.8],
    [-4.2, -8.6, 0.6],
    [1.6, -10.4, 0.4],
    [-10.6, 1.4, 1.0],
  ];
  for (const [px, pz, r] of spots) {
    put(root, 'parasol', px, pz, rng.range(0, 6.28));
    put(root, 'lounger', px + 0.9, pz + 0.4, Math.PI / 4 + r * 0.3);
    solid(px, pz, 0.25);
    solid(px + 0.9, pz + 0.4, 0.7);
  }
  put(root, 'beach_ball', -6.6, -6.6, 0, 1);
  put(root, 'beach_ball', 2.8, -6.2, 1.2, 0.9);
  put(root, 'lifeguard_tower', -11.4, -1.2, -Math.PI / 4 - Math.PI / 2);
  for (const [px, pz, rot, name] of [
    [-9.8, 2.2, 0.2, 'surfboard_a'],
    [-9.2, 2.6, -0.15, 'surfboard_b'],
  ] as const) {
    const b = put(root, name, px, pz, Math.PI / 4, 1, 0.75);
    b.rotation.set(-Math.PI / 2 + rot, Math.PI / 4, 0, 'YXZ');
  }
  for (const [px, pz, s] of [
    [-13.2, -2.0, 1.2],
    [-3.6, -12.2, 1.0],
    [6.2, -21.6, 1.5],
    [-20.4, 3.6, 1.3],
  ] as const) {
    put(root, 'rock', px, pz, rng.range(0, 6.28), s);
  }
  // dunes and bushes inland, behind the boardwalk
  for (let i = 0; i < 16; i++) {
    const px = rng.range(9, 28);
    const pz = rng.range(-14, -5.6);
    put(root, 'bush', px, pz, rng.range(0, 6.28), rng.range(0.8, 1.3));
  }
  for (let i = 0; i < 10; i++) put(root, 'bush', rng.range(10, 28), rng.range(9, 16), rng.range(0, 6.28), rng.range(0.8, 1.2));
  return { root, obstacles, traffic: [], water };
}
