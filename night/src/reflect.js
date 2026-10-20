// The wet street's mirror: the city drawn once more, upside down under the ground (y = 0), into a picture at half
// size that the road, the pavement and the paint read from (uRefl, uReflMat) and break up as wet asphalt does.
// What lies on the ground itself (layer 1: the road, the kerbs, the paint, the rain) is left out of it.
import * as THREE from 'three';
import { U } from './materials.js';

export class Mirror {
  constructor(renderer, scale = 0.5) {
    this.renderer = renderer; this.scale = scale;
    this.rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.cam = new THREE.PerspectiveCamera(); this.cam.layers.set(0);
    this.on = true; this.every = 1; this.n = 0; this.y = 0;          // (y: the height it lies at — the street, or up on the roof, its deck)
    this.hide = [];                                                    // (what reads this picture, kept out of it: the deck — the browser refuses to draw a thing into the picture it reads)
    U.uRefl.value = this.rt.texture;
    this._q = new THREE.Vector4(); this._p = new THREE.Plane(); this._c = new THREE.Vector4();
  }
  setSize(w, h) { this.rt.setSize(Math.max(2, Math.round(w * this.scale)), Math.max(2, Math.round(h * this.scale))); }
  render(scene, camera) {
    U.uReflOn.value = this.on ? 1 : 0; U.uReflY.value = this.y;
    if (!this.on || camera.position.y < this.y + 0.02) { U.uReflOn.value = 0; return; }
    if ((this.n++ % this.every) !== 0) return;
    const c = this.cam;
    // the camera mirrored in the ground
    c.copy(camera, false); c.layers.set(0);
    c.position.set(camera.position.x, 2 * this.y - camera.position.y, camera.position.z);
    const m = camera.matrixWorld.elements, fwd = new THREE.Vector3(-m[8], -m[9], -m[10]), up = new THREE.Vector3(m[4], m[5], m[6]);
    fwd.y = -fwd.y; up.y = -up.y;
    c.up.copy(up); c.lookAt(c.position.x + fwd.x, c.position.y + fwd.y, c.position.z + fwd.z);
    c.updateMatrixWorld(); c.projectionMatrix.copy(camera.projectionMatrix);
    // where the ground's points fall in the picture
    U.uReflMat.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(c.projectionMatrix).multiply(c.matrixWorldInverse);
    // nothing under the ground in it: the near plane laid along the ground (an oblique clip)
    this._p.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, this.y, 0)).applyMatrix4(c.matrixWorldInverse);
    const cp = this._c.set(this._p.normal.x, this._p.normal.y, this._p.normal.z, this._p.constant), P = c.projectionMatrix.elements, q = this._q;
    q.x = (Math.sign(cp.x) + P[8]) / P[0]; q.y = (Math.sign(cp.y) + P[9]) / P[5]; q.z = -1; q.w = (1 + P[10]) / P[14];
    cp.multiplyScalar(2 / cp.dot(q));
    P[2] = cp.x; P[6] = cp.y; P[10] = cp.z + 1 - 0.003; P[14] = cp.w;
    // only the rows of the picture below the horizon are ever read (a point on the ground falls in the mirror's
    // picture where it falls in yours): where is the horizon on the screen, and how much ground is there?
    const fwd2 = new THREE.Vector3(); camera.getWorldDirection(fwd2);
    const pitch = Math.asin(THREE.MathUtils.clamp(fwd2.y, -1, 1)), half = THREE.MathUtils.degToRad(camera.fov / 2);
    const hy = 0.5 - 0.5 * Math.tan(pitch) / Math.tan(half);          // (the horizon's height on the screen, 0 bottom … 1 top)
    const top = Math.min(1, hy + 0.12);                                // (and a margin: the wet streaks reach up)
    if (top <= 0.0) { U.uReflOn.value = 0; return; }
    const r = this.renderer, prev = r.getRenderTarget(), W = this.rt.width, H = this.rt.height;
    U.uCheap.value = 1;
    const was = this.hide.map(o => o.visible); for (const o of this.hide) o.visible = false;
    r.setRenderTarget(this.rt); r.setScissorTest(true); r.setScissor(0, 0, W, Math.ceil(H * top)); r.clear(); r.render(scene, c);
    r.setScissorTest(false); r.setRenderTarget(prev); U.uCheap.value = 0;
    this.hide.forEach((o, i) => { o.visible = was[i]; });
  }
}

// A vertical glass wall's true reflection (the run's tall outer glass on SHIBUYA SKY): the camera mirrored in the
// glass's plane renders only what stands on the roof (layer 3: the roof itself, its lamps, the people, you) into a
// picture the glass reads at each point (uGRefl, uGReflMat); the near plane laid along the glass, so nothing outside
// it is drawn in.
export const GLASS_LAYER = 3;
export class PlaneMirror {
  constructor(renderer, scale = 0.5, uni = { tex: U.uGRefl, mat: U.uGReflMat, on: U.uGReflOn }) {   // (uni: the uniforms its picture goes to — a second mirror has its own)
    this.renderer = renderer; this.scale = scale; this.uni = uni;
    this.rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    this.cam = new THREE.PerspectiveCamera(); this.on = false;
    uni.tex.value = this.rt.texture;
    this.plane = new THREE.Plane(); this.p0 = new THREE.Vector3(); this.n = new THREE.Vector3(1, 0, 0);
    this._v = new THREE.Vector3(); this._t = new THREE.Vector3(); this._q = new THREE.Vector4(); this._c = new THREE.Vector4(); this._p = new THREE.Plane();
    this.all = false; this.hide = [];                                    // (all: everything in the picture, not only the roof's own things — 46F's mirrors; hide: what reads this picture, kept out of it)
  }
  setPlane(p, n) { this.p0.copy(p); this.n.copy(n).normalize(); this.plane.setFromNormalAndCoplanarPoint(this.n, this.p0); }
  setSize(w, h) { this.rt.setSize(Math.max(2, Math.round(w * this.scale)), Math.max(2, Math.round(h * this.scale))); }
  render(scene, camera) {
    this.uni.on.value = 0;
    if (!this.on) return;
    const side = this.plane.distanceToPoint(camera.position); if (side > -0.05) return;   // (only from the roof's side of the glass)
    const c = this.cam, n = this.n, m = camera.matrixWorld.elements;
    const refl = (v, isDir) => { const d = isDir ? v.dot(n) : this.plane.distanceToPoint(v); return v.sub(this._t.copy(n).multiplyScalar(2 * d)); };
    c.copy(camera, false); if (this.all) c.layers.enableAll(); else c.layers.set(GLASS_LAYER);
    c.position.copy(camera.position); refl(c.position, false);
    const fwd = refl(new THREE.Vector3(-m[8], -m[9], -m[10]), true), up = refl(new THREE.Vector3(m[4], m[5], m[6]), true);
    c.up.copy(up); c.lookAt(this._v.copy(c.position).add(fwd)); c.updateMatrixWorld(); c.projectionMatrix.copy(camera.projectionMatrix);
    // (a mirror flips the picture left for right: the reflection matrix is the mirrored camera's, sampled as is)
    this.uni.mat.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(c.projectionMatrix).multiply(c.matrixWorldInverse);
    // the near plane along the glass (keep what is on the roof's side)
    this._p.copy(this.plane).negate().applyMatrix4(c.matrixWorldInverse);
    const cp = this._c.set(this._p.normal.x, this._p.normal.y, this._p.normal.z, this._p.constant), P = c.projectionMatrix.elements, q = this._q;
    q.x = (Math.sign(cp.x) + P[8]) / P[0]; q.y = (Math.sign(cp.y) + P[9]) / P[5]; q.z = -1; q.w = (1 + P[10]) / P[14];
    cp.multiplyScalar(2 / cp.dot(q)); P[2] = cp.x; P[6] = cp.y; P[10] = cp.z + 1 - 0.003; P[14] = cp.w;
    const r = this.renderer, prev = r.getRenderTarget(), bg = scene.background, cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha();
    const was = this.hide.map(o => o.visible); for (const o of this.hide) o.visible = false;
    scene.background = null; r.setRenderTarget(this.rt); r.setClearColor(0x000000, 1); r.clear(); r.render(scene, c);
    this.hide.forEach((o, i) => { o.visible = was[i]; });
    r.setRenderTarget(prev); r.setClearColor(cc, ca); scene.background = bg;
    this.uni.on.value = 1;
  }
}
