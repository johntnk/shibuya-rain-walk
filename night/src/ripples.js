// Where you step on the wet street, a ring of water spreads from your foot and fades — as the reference video's girl leaves
// one at every step. A few dozen rings, each a flat quad on the ground drawn as a thin bright circle growing out;
// spawned at the feet, one a stride, left and right in turn, only when it is wet and you are outside.
import * as THREE from 'three';
import { U } from './materials.js';

export class Ripples {
  constructor(n = 32) {
    this.n = n; this.i = 0; this.acc = 0; this.side = 1;
    const g = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4,
      uniforms: { uTime: U.uTime, uWet: U.uWet, uSky: U.uSky },
      vertexShader: `attribute vec2 aBirth; uniform float uTime; varying vec2 vL; varying float vAge;
        void main(){ vL = position.xz * 2.0; vAge = (uTime - aBirth.x) / 1.4;
          float r = 0.12 + 0.75 * sqrt(clamp(vAge, 0.0, 1.0));
          vec4 w = modelMatrix * instanceMatrix * vec4(position * vec3(r * 2.0, 1.0, r * 2.0), 1.0);
          gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float uWet; uniform vec3 uSky; varying vec2 vL; varying float vAge;
        void main(){ if (vAge < 0.0 || vAge > 1.0) discard; float d = length(vL);
          float ring = smoothstep(0.06, 0.0, abs(d - 0.92)) + 0.5 * smoothstep(0.05, 0.0, abs(d - 0.62)) * step(0.25, vAge);
          float a = ring * (1.0 - vAge) * (1.0 - vAge) * uWet;
          gl_FragColor = vec4((vec3(0.55, 0.62, 0.78) + uSky) * a * 0.7, 1.0); }`,
    });
    this.mesh = new THREE.InstancedMesh(g, this.mat, n); this.mesh.frustumCulled = false; this.mesh.userData.noInk = true; this.mesh.renderOrder = 5;
    this.birth = new Float32Array(n * 2).fill(-99); g.setAttribute('aBirth', new THREE.InstancedBufferAttribute(this.birth, 2));
    const M = new THREE.Matrix4().makeTranslation(0, -100, 0); for (let k = 0; k < n; k++) this.mesh.setMatrixAt(k, M);
  }
  // walked: metres this frame; pos, face: where you are and which way you go; y: the ground under you
  update(walked, pos, face, y, time, on) {
    if (!on || walked <= 0) { this.acc = 0; return; }
    this.acc += walked; if (this.acc < 0.68) return; this.acc = 0; this.side = -this.side;
    const px = pos.x + Math.cos(face) * 0.11 * this.side, pz = pos.z - Math.sin(face) * 0.11 * this.side;
    this.mesh.setMatrixAt(this.i, new THREE.Matrix4().makeTranslation(px, y + 0.012, pz)); this.mesh.instanceMatrix.needsUpdate = true;
    this.birth[this.i * 2] = time; this.mesh.geometry.attributes.aBirth.needsUpdate = true; this.i = (this.i + 1) % this.n;
  }
}
