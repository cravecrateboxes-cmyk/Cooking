import * as THREE from 'three';

/**
 * See-through "coming soon" preview of things not bought yet, so even a fresh place looks furnished and
 * the player can see what each purchase adds. A flat violet silhouette with slow diagonal stripes and a
 * toon-stepped light, so it reads as "not built yet" instead of as glass.
 */
const material = new THREE.ShaderMaterial({
  transparent: true,
  // writing depth keeps a ghost's own inner parts from stacking into darker patches
  depthWrite: true,
  uniforms: { uTime: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec3 vWorld;
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorld = wp.xyz;
      vNormal = normalize(mat3(modelMatrix) * normal);
      vView = normalize(cameraPosition - wp.xyz);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    varying vec3 vWorld;
    varying vec3 vNormal;
    varying vec3 vView;
    void main() {
      vec3 n = normalize(vNormal);
      float rim = 1.0 - abs(dot(n, vView));
      float stripe = step(0.5, fract((vWorld.x + vWorld.y + vWorld.z) * 2.2 - uTime * 0.35));
      // two-step toon light from above so the shape keeps its volume
      float lit = step(0.35, dot(n, normalize(vec3(0.3, 1.0, 0.45))));
      vec3 base = mix(vec3(0.42, 0.27, 0.78), vec3(0.58, 0.42, 0.95), lit);
      vec3 col = mix(base, base + vec3(0.1, 0.08, 0.05), stripe);
      col = mix(col, vec3(0.86, 0.78, 1.0), smoothstep(0.6, 0.95, rim) * 0.6);
      gl_FragColor = vec4(col, 0.58);
      #include <colorspace_fragment>
    }
  `,
});

export function tickGhosts(time: number): void {
  material.uniforms.uTime.value = time;
}

/** Clone the given parts (with their local transforms) into one group drawn in the ghost material. */
export function ghostOf(parts: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  for (const p of parts) {
    const c = p.clone(true);
    c.visible = true;
    c.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.material = material;
        o.castShadow = false;
        o.receiveShadow = false;
        o.renderOrder = 2;
      }
    });
    g.add(c);
  }
  return g;
}
