import * as THREE from 'three';

/**
 * Flat toon sea: deep and shallow bands by distance from the shore, drifting foam stripes and a white
 * surf line that laps up the sand. The plane's local +V runs from the shore out to sea.
 */
export function waterMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uShallow: { value: new THREE.Color('#5ee6e0') },
        uMid: { value: new THREE.Color('#2bb8e8') },
        uDeep: { value: new THREE.Color('#2a7fd8') },
        uFoam: { value: new THREE.Color('#f2fdff') },
        uLen: { value: 60 },
      },
    ]),
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime;
      uniform vec3 uShallow;
      uniform vec3 uMid;
      uniform vec3 uDeep;
      uniform vec3 uFoam;
      uniform float uLen;
      varying vec2 vUv;
      varying vec3 vWorld;
      void main() {
        float d = vUv.y * uLen;
        float wob = sin(vWorld.x * 0.7 + uTime * 1.1) * 0.25 + sin(vWorld.z * 0.9 - uTime * 0.8) * 0.2;
        vec3 col = uShallow;
        col = mix(col, uMid, step(3.2 + wob, d));
        col = mix(col, uDeep, step(11.0 + wob * 2.0, d));
        // drifting foam stripes in the mid band
        float stripe = sin((vWorld.x - vWorld.z) * 0.55 + uTime * 0.6) * sin(d * 1.3 - uTime * 0.9);
        col = mix(col, mix(col, uFoam, 0.55), step(0.86, stripe) * step(3.6, d) * (1.0 - step(16.0, d)));
        // surf line that rolls up and back
        float surf = 0.55 + 0.45 * sin(uTime * 1.3);
        float edge = step(d, surf + wob * 0.6) ;
        col = mix(col, uFoam, edge);
        float ring = step(abs(d - (1.6 + surf * 0.9 + wob)), 0.09);
        col = mix(col, uFoam, ring * 0.85);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
}
