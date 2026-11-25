import * as THREE from 'three';

/** Shared cel-shading ramp: a lit band, a soft mid band and a tinted shade band. */
let ramp: THREE.DataTexture | null = null;

export function toonRamp(): THREE.DataTexture {
  if (ramp) return ramp;
  const steps = [110, 190, 255];
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  ramp = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  ramp.minFilter = THREE.NearestFilter;
  ramp.magFilter = THREE.NearestFilter;
  ramp.generateMipmaps = false;
  ramp.needsUpdate = true;
  return ramp;
}

const cache = new Map<string, THREE.MeshToonMaterial>();

/** One toon material per colour, shared by every mesh that uses it. */
export function toonMat(color: THREE.ColorRepresentation, opts: { emissive?: number; key?: string } = {}): THREE.MeshToonMaterial {
  const c = new THREE.Color(color);
  const key = `${opts.key ?? ''}${c.getHexString()}:${opts.emissive ?? 0}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color: c, gradientMap: toonRamp() });
    if (opts.emissive) {
      m.emissive = c.clone();
      m.emissiveIntensity = opts.emissive;
    }
    cache.set(key, m);
  }
  return m;
}

/** Replace every glTF material under root with the shared toon equivalent. */
export function toonify(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const swap = (src: THREE.Material): THREE.Material => {
      const std = src as THREE.MeshStandardMaterial;
      const glow = std.emissiveIntensity > 0 && std.emissive && std.emissive.getHex() !== 0 ? 0.6 : 0;
      return toonMat(std.color ?? 0xffffff, { emissive: glow });
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(swap) : swap(mesh.material);
  });
}
