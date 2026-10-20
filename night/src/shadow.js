// The low sun's shadows on the roof: the escalators', the white frames', the glass walls' posts, the seats' and
// yours, long across the timber at sunset. A depth picture of what stands on the roof (everything put on layer 2),
// seen from the sun, around where you are; every surface lit as the city is (materials.js, sunShadow) reads it.
// Only on the roof, only by day.
import * as THREE from 'three';
import { U } from './materials.js';

export const SHADOW_LAYER = 2;
export const castShadow = o => o.traverse(m => { if (m.isMesh) m.layers.enable(SHADOW_LAYER); });

export class SunShadow {
  constructor(renderer, size = 2048, span = 64) {
    this.r = renderer; this.span = span;
    this.rt = new THREE.WebGLRenderTarget(size, size, { depthBuffer: true });
    this.rt.depthTexture = new THREE.DepthTexture(size, size, THREE.UnsignedIntType);
    this.cam = new THREE.OrthographicCamera(-span / 2, span / 2, span / 2, -span / 2, 300, 520);
    this.cam.layers.set(SHADOW_LAYER);
    this.mat = new THREE.MeshDepthMaterial();
    U.uShadowTex.value = this.rt.depthTexture;
  }
  render(scene, c) {
    U.uShadowTex.value = this.rt.depthTexture;
    const d = U.uMoonDir.value, cam = this.cam;
    cam.position.set(c.x + d.x * 400, c.y + d.y * 400, c.z + d.z * 400); cam.up.set(0, 1, 0); cam.lookAt(c.x, c.y, c.z); cam.updateMatrixWorld();
    U.uShadowMat.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    const r = this.r, prev = r.getRenderTarget(), ov = scene.overrideMaterial, bg = scene.background;
    scene.overrideMaterial = this.mat; scene.background = null;
    r.setRenderTarget(this.rt); r.clear(); r.render(scene, cam); r.setRenderTarget(prev);
    scene.overrideMaterial = ov; scene.background = bg;
  }
}

// The street's shadows at night, as they fall under the lamps: of you, the cars, the railings and posts, the trees,
// the bins and machines and bikes. One depth picture round where you are (44 m across), seen from the light of the
// lamps nearest you — their directions weighed by how near each is, so as you walk past a lamp your shadow swings
// round as it does under real ones; never lower than 50° (a lamp is overhead, not a sunset). The crowd isn't in it
// (they are drawn by their own bone-picture shader): they keep their soft round shadows.
export class LampShadow {
  constructor(renderer, size = 2048, span = 44) {
    this.r = renderer;
    this.rt = new THREE.WebGLRenderTarget(size, size, { depthBuffer: true });
    this.rt.depthTexture = new THREE.DepthTexture(size, size, THREE.UnsignedIntType);
    this.cam = new THREE.OrthographicCamera(-span / 2, span / 2, span / 2, -span / 2, 20, 95);
    this.cam.layers.set(SHADOW_LAYER);
    this.mat = new THREE.MeshDepthMaterial();
    this.dir = new THREE.Vector3(0.25, 0.92, 0.3).normalize(); this._t = new THREE.Vector3(); this._v = new THREE.Vector3();
  }
  aim(p, lamps, dt) {
    const t = this._t.set(0, 0, 0), v = this._v;
    for (const L of lamps) { const dx = L.x - p.x, dz = L.z - p.z, dh2 = dx * dx + dz * dz; if (dh2 > 900) continue; v.set(dx, L.y - p.y, dz).normalize(); t.addScaledVector(v, 1 / (dh2 + 9)); }
    if (t.lengthSq() < 1e-8) t.set(0.25, 0.92, 0.3);
    t.normalize(); const h = Math.hypot(t.x, t.z), el = Math.max(Math.atan2(t.y, h), 0.87);
    if (h > 1e-4) t.set(t.x / h * Math.cos(el), Math.sin(el), t.z / h * Math.cos(el)); else t.set(0, 1, 0.001);
    this.dir.lerp(t, 1 - Math.exp(-dt * 1.5)).normalize();
  }
  render(scene, c) {
    const d = this.dir, cam = this.cam;
    cam.position.set(c.x + d.x * 50, c.y + d.y * 50, c.z + d.z * 50); cam.up.set(0, 1, 0); cam.lookAt(c.x, c.y, c.z); cam.updateMatrixWorld();
    U.uShadowMat.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); U.uShadowTex.value = this.rt.depthTexture;
    const r = this.r, prev = r.getRenderTarget(), ov = scene.overrideMaterial, bg = scene.background;
    scene.overrideMaterial = this.mat; scene.background = null;
    r.setRenderTarget(this.rt); r.clear(); r.render(scene, cam); r.setRenderTarget(prev);
    scene.overrideMaterial = ov; scene.background = bg;
  }
}
