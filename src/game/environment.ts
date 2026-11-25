import * as THREE from 'three';
import { toonRamp } from '../engine/toon';
import { BARN } from './maps';
import { block, checker, floor, planks, put, stripes } from './envkit';
import type { Rect } from './nav';
import { Rng } from './rng';

export interface Env {
  root: THREE.Group;
  /** static blockers for the chef and the nav grid */
  obstacles: Rect[];
  /** cars that drive by on the street */
  traffic: { obj: THREE.Object3D; speed: number; z: number }[];
  water: THREE.ShaderMaterial | null;
}

let wallpaper: THREE.CanvasTexture | null = null;

/** Wall along X (north side) or Z (west side) with a red wainscot, yellow plaster and a trim cap. */
function wall(root: THREE.Group, axis: 'x' | 'z', a0: number, a1: number, at: number, height: number, thick = 0.3): void {
  const half = thick / 2;
  const seg = (y0: number, y1: number, c: string, grow = 0) =>
    axis === 'x'
      ? block(root, a0, at - half - grow, a1, at + half + grow, y0, y1, c)
      : block(root, at - half - grow, a0, at + half + grow, a1, y0, y1, c);
  seg(0, 0.9, '#e8443a', 0.02);
  seg(0.9, 0.98, '#ffb020', 0.05);
  const paper = seg(0.98, height, '#6ad8b6');
  wallpaper ??= stripes('#6ad8b6', '#57c9a6', '#3eae8c');
  const t = wallpaper.clone();
  t.needsUpdate = true;
  t.repeat.set(Math.abs(a1 - a0) / 0.9, 1);
  paper.material = new THREE.MeshToonMaterial({ map: t, gradientMap: toonRamp() });
  seg(height, height + 0.12, '#ff8a2b', 0.06);
}

export function buildRestaurant(): Env {
  const root = new THREE.Group();
  const obstacles: Rect[] = [];
  const rng = new Rng(7);

  // ground: lawn all around, then the street and sidewalk south of the building
  floor(root, -40, -30, 40, 40, checker('#56c24c', '#4fb846', 2, 64), 6, -0.02);
  floor(root, -40, 7.3, 40, 9.9, checker('#b4b9e6', '#a6acdc', 2, 64, '#8d93c8'), 1.2, -0.005);
  block(root, -40, 9.9, 40, 10.1, -0.05, 0.12, '#7d83bd', false);
  floor(root, -40, 10.1, 40, 15.5, checker('#5b4f8a', '#574a85', 2, 64), 4, -0.01);
  for (let x = -38; x < 40; x += 3) block(root, x, 12.72, x + 1.6, 12.88, -0.005, 0.005, '#ffd23f', false);
  block(root, -40, 15.5, 40, 15.7, -0.05, 0.12, '#7d83bd', false);
  floor(root, -40, 15.7, 40, 17.6, checker('#b4b9e6', '#a6acdc', 2, 64, '#8d93c8'), 1.2, -0.005);

  // building floor: teal kitchen tiles, warm planks in the dining room, a slab edge around it
  block(root, -7.3, -7.3, 7.3, 7.3, -0.12, -0.01, '#c06a3a', false);
  floor(root, -7, -7, 7, -2.4, checker('#2fbfa8', '#27a998', 2, 64, '#1f8d80'), 1.2);
  floor(root, -7, -2.4, 7, 7, planks('#f0a05a', '#e48e4c'), 2.4);
  // red runner rug under the queue
  floor(root, -4.1, -2.0, -2.7, 7.0, checker('#ff5a64', '#f24c57', 2, 64), 0.7, 0.004);

  // back walls (north and west) are tall; the camera looks over the low south and east walls
  wall(root, 'x', -7.15, 7.15, -7.15, 2.5);
  wall(root, 'z', -7.15, 7.15, -7.15, 2.5);
  obstacles.push({ minX: -7.4, minZ: -7.4, maxX: 7.4, maxZ: -6.95 }, { minX: -7.4, minZ: -7.4, maxX: -6.95, maxZ: 7.4 });
  // windows on the west wall looking out onto the lawn
  for (const z of [-0.2, 3.2]) put(root, 'window', -6.98, z, Math.PI / 2, 1, 0.95);
  put(root, 'menu_sign', 6.0, -6.98, 0, 1, 1.2);
  put(root, 'menu_sign', -1.0, -6.98, 0, 1, 1.4);
  // south and east low walls with planters; door gap on the south side
  const low = (x0: number, z0: number, x1: number, z1: number) => {
    block(root, x0, z0, x1, z1, 0, 0.55, '#e8443a');
    block(root, x0 - 0.04, z0 - 0.04, x1 + 0.04, z1 + 0.04, 0.55, 0.65, '#ffb020');
    obstacles.push({ minX: x0, minZ: z0, maxX: x1, maxZ: z1 });
  };
  low(-7.15, 6.9, -4.6, 7.2);
  low(-1.6, 6.9, 7.15, 7.2);
  low(6.9, -7.15, 7.2, 7.2);
  for (let x = -0.6; x < 6.6; x += 1.9) put(root, 'plant_small', x, 7.05, 0, 0.9, 0.65);
  for (let z = -5.6; z < 6.6; z += 2.1) put(root, 'plant_small', 7.05, z, 0, 0.9, 0.65);
  put(root, 'plant', -6.4, 6.3, 0, 1);
  obstacles.push({ minX: -6.8, minZ: 5.9, maxX: -6.0, maxZ: 6.7 });
  // potted plants either side of the door gap
  put(root, 'plant', -4.95, 7.65, 0, 0.9);
  put(root, 'plant', -1.25, 7.65, 0, 0.9);
  put(root, 'lamp_post', -5.2, 8.3, 0);
  put(root, 'lamp_post', -0.9, 8.3, 0);

  // dining room life: a rug under every table, a velvet-rope queue lane, a jukebox and a gumball machine
  for (const t of BARN.tables) put(root, 'rug_round', t.x, t.z, 0, 1, 0.006);
  const lane = (x: number, z0: number, n: number) => {
    for (let i = 0; i <= n; i++) put(root, 'stanchion', x, z0 + i * 2, 0, 1, 0.002);
    for (let i = 0; i < n; i++) put(root, 'queue_rope', x, z0 + i * 2, 0, 1, 0.002);
    obstacles.push({ minX: x - 0.05, minZ: z0 - 0.15, maxX: x + 0.05, maxZ: z0 + n * 2 + 0.15 });
  };
  lane(-4.25, -1.1, 3);
  lane(-2.55, 0.9, 2);
  put(root, 'jukebox', -6.45, 1.5, Math.PI / 2);
  obstacles.push({ minX: -6.95, minZ: 0.95, maxX: -6.1, maxZ: 2.05 });
  put(root, 'gumball', -6.4, -1.35, Math.PI / 2);
  obstacles.push({ minX: -6.65, minZ: -1.6, maxX: -6.15, maxZ: -1.1 });

  // outside: trees, bushes, benches, parked cars
  for (let i = 0; i < 26; i++) {
    const side = i % 2 === 0;
    const x = side ? rng.range(-24, -8.6) : rng.range(8.6, 24);
    const z = rng.range(-14, 6.5);
    put(root, rng.chance(0.4) ? 'tree_big' : 'tree', x, z, rng.range(0, 6.28), rng.range(0.85, 1.2));
  }
  for (let i = 0; i < 22; i++) put(root, 'bush', rng.range(-22, 22), rng.range(-16, -8.4), rng.range(0, 6.28), rng.range(0.8, 1.3));
  for (let x = -20; x <= 20; x += 5.5) {
    if (Math.abs(x + 3) < 3) continue;
    put(root, 'bush', x, 7.9, 0, 0.8);
  }
  put(root, 'bench', 3.2, 9.3, Math.PI);
  put(root, 'bench', -9.5, 9.3, Math.PI);
  for (let x = -20; x < 22; x += 7) if (rng.chance(0.6)) put(root, 'tree', x + rng.range(-1, 1), 17.0, 0, 0.9);
  const traffic: Env['traffic'] = [];
  const cars = ['car_a', 'car_b'];
  for (let i = 0; i < 3; i++) {
    const lane = i % 2 === 0 ? 11.6 : 14.1;
    const obj = put(root, cars[i % 2], -30 + i * 21, lane, lane < 12.8 ? Math.PI / 2 : -Math.PI / 2);
    traffic.push({ obj, speed: (lane < 12.8 ? 1 : -1) * rng.range(3.5, 5), z: lane });
  }
  return { root, obstacles, traffic, water: null };
}

export function updateTraffic(env: Env, dt: number): void {
  for (const t of env.traffic) {
    t.obj.position.x += t.speed * dt;
    if (t.obj.position.x > 40) t.obj.position.x = -40;
    if (t.obj.position.x < -40) t.obj.position.x = 40;
  }
  if (env.water) env.water.uniforms.uTime.value += dt;
}
