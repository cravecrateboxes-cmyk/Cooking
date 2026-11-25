import * as THREE from 'three';

/**
 * Floor pad drawn in a shader: rounded square with a thick rim, a fill that rises from the near edge
 * as money is paid in (or as a dish cooks), and a gentle breathing glow when it wants attention.
 */
export function padMaterial(color: THREE.ColorRepresentation, rim: THREE.ColorRepresentation): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uRim: { value: new THREE.Color(rim) },
      uFill: { value: 0 },
      uPulse: { value: 0 },
      uTime: { value: 0 },
      uDash: { value: 1 },
      uAlpha: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform vec3 uRim;
      uniform float uFill;
      uniform float uPulse;
      uniform float uTime;
      uniform float uDash;
      uniform float uAlpha;
      varying vec2 vUv;
      float sdRound(vec2 p, vec2 b, float r) {
        vec2 q = abs(p) - b + r;
        return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
      }
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float d = sdRound(p, vec2(0.92), 0.34);
        float aa = fwidth(d) * 1.2;
        float outer = 1.0 - smoothstep(-aa, aa, d);
        float inner = 1.0 - smoothstep(-aa, aa, d + 0.17);
        float rim = outer - inner;
        // dashes around the rim when the pad is idle
        float ang = atan(p.y, p.x);
        float dash = step(0.0, sin(ang * 14.0 + uTime * 1.6));
        rim *= mix(1.0, 0.55 + 0.45 * dash, uDash);
        float fillLine = -0.92 + uFill * 1.84;
        float filled = step(p.y, fillLine) * inner;
        vec3 base = uColor * (0.88 + 0.12 * uPulse);
        vec3 col = mix(base, uRim, filled * 0.85);
        float a = inner * (0.55 + 0.25 * uPulse) + filled * 0.35;
        col = mix(col, uRim, rim);
        a = max(a, rim);
        // soft halo when pulsing
        float halo = (1.0 - smoothstep(0.0, 0.35, d)) * (1.0 - outer) * uPulse * 0.5;
        col = mix(col, uRim, halo);
        a = max(a, halo);
        gl_FragColor = vec4(col, a * uAlpha);
        #include <colorspace_fragment>
      }
    `,
  });
}
