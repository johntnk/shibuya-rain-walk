// Halos: camera-facing soft discs around every lamp, bulb, candle star and lit boat window.
// Additive, depth-tested (houses hide them), pulled a little toward the camera so the lamp's own
// housing does not cut them. Optional flicker for candles.
import * as THREE from 'three';
import { U } from './materials.js';

export class Glows {
  constructor() { this.items = []; }
  add(p, c, size, flicker = 0) { this.items.push(p.x, p.y, p.z, c.r, c.g, c.b, size, flicker); }
  build() {
    const n = this.items.length / 8;
    const base = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
    const P = new Float32Array(n * 3), C = new Float32Array(n * 3), S = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const o = i * 8;
      P.set(this.items.slice(o, o + 3), i * 3); C.set(this.items.slice(o + 3, o + 6), i * 3); S.set(this.items.slice(o + 6, o + 8), i * 2);
    }
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(P, 3));
    g.setAttribute('iCol', new THREE.InstancedBufferAttribute(C, 3));
    g.setAttribute('iSize', new THREE.InstancedBufferAttribute(S, 2));
    g.instanceCount = n;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uFogDensity: U.uFogDensity, uDay: U.uDay },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec3 iPos, iCol; attribute vec2 iSize; uniform float uTime, uFogDensity, uDay;
        varying vec2 vUv; varying vec3 vCol;
        void main(){
          vec4 mv = viewMatrix * vec4(iPos, 1.0);
          float s = iSize.x, d0 = length(mv.xyz);
          float pull = min(s * 0.5, 1.0), dp = max(d0 - pull, 0.05);
          mv.xyz += normalize(-mv.xyz) * pull;
          mv.xy += position.xy * min(s, dp * 1.6);                   // (a camera brushing past a lamp head: the halo must not fill the view)
          gl_Position = projectionMatrix * mv;
          vUv = uv;
          float fl = 1.0 + iSize.y * (0.10 * sin(uTime * 7.1 + iPos.x * 13.0) + 0.07 * sin(uTime * 12.7 + iPos.z * 9.0));
          vCol = iCol * fl * exp(-length(mv.xyz) * uFogDensity * 1.6);
          vCol *= smoothstep(0.1, 0.5, dp) * (1.0 - 0.7 * uDay);
        }`,
      fragmentShader: `varying vec2 vUv; varying vec3 vCol;
        void main(){
          float d = length(vUv - 0.5) * 2.0; if (d > 1.0) discard;
          float a = exp(-d * d * 5.5) * 0.28 + exp(-d * d * 60.0) * 1.0;
          gl_FragColor = vec4(vCol * a * (1.0 - d * d), 1.0);
        }`,
    });
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 5;
    return m;
  }
}
