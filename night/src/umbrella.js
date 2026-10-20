// Your umbrella: a clear vinyl one, the kind every Tokyo convenience store sells, held up in the right hand while
// it rains (as the girl in the reference walks with hers): the arm brought in and bent, the hand at the chest, the
// shaft up from the fist, the canopy over your head — its ribs, the white tips, rain beading on it. Folded as you
// come in out of the rain (at the store's door): the ribs swing down round the shaft, the arm brings it down, and
// you carry it closed, hanging from your hand; opened again as you step out. Put away when the rain stops.
import * as THREE from 'three';
import { U, GLSL_COMMON } from './materials.js';

// the canopy folding: every point of it on its rib, swung down about the top (the rib keeps its length), from its
// open angle to hanging close along the shaft. (Local frame: the rim at y 0, the top at 0.225, the rim 0.683 out.)
const FOLD_GLSL = `uniform float uFold;
  vec3 foldU(vec3 p){
    float r = length(p.xz); if (uFold < 0.001 || r < 1e-4) return p;
    float yt = 0.225, L = length(vec2(r, yt - p.y)), ph = atan(yt - p.y, r), phc = mix(ph, 1.5, uFold);
    float rr = L * cos(phc) + 0.014 * uFold, yy = yt - L * sin(phc); vec2 dir = p.xz / r;
    return vec3(dir.x * rr, yy, dir.y * rr);
  }`;
const GRIP = 0.11;                                                   // (the straight grip of the handle, below the shaft)
const foldify = (m, u) => { m.onBeforeCompile = sh => { sh.uniforms.uFold = u; sh.vertexShader = FOLD_GLSL + '\n' + sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = foldU(vec3(position));'); }; m.customProgramCacheKey = () => 'fold'; return m; };

export class Umbrella {
  constructor(scene, hero) {
    this.hero = hero; this.k = 0; this.open = 0; this.held = 0; this.uFold = { value: 1 };
    const g = new THREE.Group();
    // the canopy: a shallow dome of clear vinyl, eight panels
    const R = 0.52, dome = new THREE.SphereGeometry(0.82, 32, 10, 0, Math.PI * 2, 0, 0.98).translate(0, -0.82 * Math.cos(0.98), 0).scale(1, 0.62, 1);   // (a deep dome, 1.3 m across)
    this.vinyl = vinylMaterial(false, this.uFold);
    const canopy = new THREE.Mesh(dome, this.vinyl); canopy.renderOrder = 7; g.add(canopy);
    // the rain on it: beads of every size across the panels; now and then one lets go and runs down the panel in
    // little jerks, faster as it goes, to the rim and off; drops gathering at the rib tips and falling (drops.js-like,
    // all in the shader: drops(), below)
    this.drops = rainOnCanopy(this.uFold); g.add(this.drops);
    const ribM = foldify(new THREE.MeshBasicMaterial({ color: 0xe6eaf2 }), this.uFold), tipM = foldify(new THREE.MeshBasicMaterial({ color: 0xf4f6fa }), this.uFold);
    // the ribs along the dome (curved, as they bow under the vinyl), the white tips, the rim between them
    const rimY = 0, rimR = 0.82 * Math.sin(0.98), domeAt = r => 0.62 * (Math.sqrt(Math.max(0, 0.82 * 0.82 - r * r)) - 0.82 * Math.cos(0.98));
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2, pts = [];
      for (let k = 0; k <= 8; k++) { const r = rimR * k / 8; pts.push(new THREE.Vector3(Math.cos(a) * r, domeAt(r) - 0.006, Math.sin(a) * r)); }
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.0075, 4), ribM));
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6).translate(Math.cos(a) * rimR, rimY - 0.01, Math.sin(a) * rimR), tipM); g.add(tip);   // (placed in its shape, so the fold moves it)
    }
    const rim = new THREE.Mesh(new THREE.TorusGeometry(rimR, 0.006, 4, 48).rotateX(Math.PI / 2), foldify(new THREE.MeshBasicMaterial({ color: 0xdfe6f2 }), this.uFold)); g.add(rim);
    // the shaft, down to the hand, and its white hook of a handle
    const shaft = this.shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.6, 6).translate(0, -0.3, 0), new THREE.MeshBasicMaterial({ color: 0xc8ccd4 })); g.add(shaft);
    // the handle: a straight grip of white plastic (what the fist closes on), and the J below it
    const hook = this.hook = new THREE.Group();
    hook.add(new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.012, GRIP, 10).translate(0, -GRIP / 2, 0), new THREE.MeshBasicMaterial({ color: 0xeef0f3 })));
    hook.add(new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.011, 8, 14, Math.PI).rotateY(Math.PI / 2).translate(0, -GRIP, -0.038), new THREE.MeshBasicMaterial({ color: 0xeef0f3 })));
    g.add(hook);
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6).translate(0, 0.23, 0), new THREE.MeshBasicMaterial({ color: 0xf4f6fa })));   // (the ferrule at the top)
    g.traverse(o => { o.frustumCulled = false; if (o.isMesh || o.isPoints) o.userData.noInk = true; });   // (no drawn line round it: the ink pass draws it with its own material, which doesn't fold)
    this.group = g; scene.add(g);
    this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3();
    this.qUp = new THREE.Quaternion(); this.qDown = new THREE.Quaternion(); this.pUp = new THREE.Vector3(); this.pDown = new THREE.Vector3();
    // the swing: the far end of it (canopy top, or the tip when carried) a point on a rod from the fist (verlet)
    this.tip = new THREE.Vector3(); this.tipPrev = new THREE.Vector3(); this.u = new THREE.Vector3(0, 1, 0); this.simOn = false;
    this.grip = new THREE.Vector3(); this.qY = new THREE.Quaternion(); this.qT = new THREE.Quaternion(); this.Y = new THREE.Vector3(0, 1, 0);
    // the arm holding it, over whatever the clips do (avatar.js calls pose2 after them)
    const prev = hero.pose2;
    hero.pose2 = (h, dt) => { prev?.(h, dt); this.stand(h); this.pose(h); };
    this.qI = new THREE.Quaternion();
    this.P = { ux: -0.2, uy: 0.3, uz: 1.45, lx: 0.0, ly: 1.85, lz: 0.0, hx: 0.0, hy: 0.0, hz: 0.0 };   // (VRM's frames: right arm along −x, forward +z — the arm let down, swung a little forward, the elbow bent up)   // (tunable: __dbg.umbrella.P)
  }
  // standing on an escalator step (hero.stance 0…1): the legs straightened, feet together under you on the one
  // tread, the left hand resting on the moving rail (the right holds the umbrella when it rains)
  stand(h) {
    const k = this.hero.stance || 0; if (k < 0.001) return;
    for (const n of ['leftUpperLeg', 'rightUpperLeg', 'leftLowerLeg', 'rightLowerLeg', 'leftFoot', 'rightFoot']) h.getNormalizedBoneNode(n)?.quaternion.slerp(this.qI, k);
    const set = (name, x, y, z) => { const b = h.getNormalizedBoneNode(name); if (!b) return; this.q.setFromEuler(this.e.set(x, y, z, 'XYZ')); b.quaternion.slerp(this.q, k * 0.85); };
    const A = this.A || (this.A = { ux: 0.15, uy: 0.0, uz: -0.43, ly: 0.0, hz: -0.25 });   // (tunable: __dbg.umbrella.A; measured so the palm sits on the rail's top, not 10 cm inside it)
    set('leftUpperArm', A.ux, A.uy, A.uz); set('leftLowerArm', 0.0, A.ly, 0.0); set('leftHand', 0.0, 0.0, A.hz);
  }
  pose(h) {
    // the right hand closed round the handle whenever it holds one (open or carried), the thumb over
    const hk = Math.min(1, this.held * 1.5);
    if (hk > 0.001) {
      const C = this.C || (this.C = { p: 1.15, i: 1.25, d: 0.8, tp: 0.35, td: 0.5 });   // (tunable: __dbg.umbrella.C)
      for (const f of ['Index', 'Middle', 'Ring', 'Little']) {
        const spread = f === 'Index' ? 1.0 : f === 'Little' ? 1.1 : 1.05;
        for (const [seg, a] of [['Proximal', C.p * spread], ['Intermediate', C.i], ['Distal', C.d]]) { const b = h.getNormalizedBoneNode('right' + f + seg); if (b) { this.q.setFromEuler(this.e.set(0, 0, a, 'XYZ')); b.quaternion.slerp(this.q, hk); } }   // (+z: toward the palm, for the right hand)
      }
      for (const [seg, a] of [['Proximal', C.tp], ['Distal', C.td]]) { const b = h.getNormalizedBoneNode('rightThumb' + seg); if (b) { this.q.setFromEuler(this.e.set(0, -a * 0.8, a * 0.3, 'XYZ')); b.quaternion.slerp(this.q, hk); } }
    }
    const k = this.k; if (k < 0.001) return;
    const P = this.P, set = (name, x, y, z) => { const b = h.getNormalizedBoneNode(name); if (!b) return; this.q.setFromEuler(this.e.set(x, y, z, 'XYZ')); b.quaternion.slerp(this.q, k); };
    set('rightUpperArm', P.ux, P.uy, P.uz); set('rightLowerArm', P.lx, P.ly, P.lz); set('rightHand', P.hx, P.hy, P.hz);
  }
  fold() { this.open = 0; }                                          // (folded at once: only ever while the screen is dark, going in at a door)
  update(dt) {
    // held while it rains; open out in it, folded under shelter (indoors, or at the store's door as it opens to you)
    const rainy = U.uRain.value > 0.3 && this.hero.shown !== false, shelter = this.hero.indoors || this.hero.sheltered || this.hero.atDoor;
    this.held += ((rainy ? 1 : 0) - this.held) * Math.min(1, dt * 3);
    const want = rainy && !shelter ? 1 : 0, rate = want > this.open ? 1 / 0.75 : 1 / 0.9;   // (opening takes 0.75 s, folding 0.9)
    this.open = Math.max(0, Math.min(1, this.open + Math.sign(want - this.open) * Math.min(Math.abs(want - this.open), rate * dt)));
    // folding: the canopy closes while it is still up, then the arm brings it down; opening, the other way about
    this.uFold.value = 1 - THREE.MathUtils.smoothstep(this.open, 0.45, 1.0);
    this.k = THREE.MathUtils.smoothstep(this.open, 0.0, 0.5);
    this.drops.material.uniforms.uOpen.value = 1 - this.uFold.value;
    const g = this.group; g.visible = this.held > 0.05 && this.hero.root.visible;
    if (!g.visible) { this.simOn = false; return; }
    const hu = this.hero.vrm.humanoid, hand = hu.getRawBoneNode('rightHand').getWorldPosition(this.v), head = hu.getRawBoneNode('head').getWorldPosition(this._h || (this._h = new THREE.Vector3()));
    const mid = hu.getRawBoneNode('rightMiddleProximal')?.getWorldPosition(this._m || (this._m = new THREE.Vector3()));
    // the fist: where the palm is, between the wrist and the knuckles
    const grip = this.grip.copy(hand); if (mid) grip.lerp(mid, 0.75);
    const k = this.k, top = head.y + 0.3;
    // the shaft's length: raised, from the fist up to just over your head; carried, its own (shorter: it hangs clear)
    const S = Math.max(0.3, (top - grip.y) - GRIP * 0.5) * k + 0.5 * (1 - k);
    const L = S + GRIP * 0.5 + (k > 0.5 ? 0 : 0.23);                   // (fist to the far end: the canopy's rim raised, the tip carried)
    // where the far end wants to be: raised, straight up over the fist (leaning a little with you); carried, hanging,
    // a little forward
    const fx = Math.sin(this.hero.face), fz = Math.cos(this.hero.face);
    const rest = this._r || (this._r = new THREE.Vector3());
    if (k > 0.5) rest.set(fx * (0.06 + this.hero.lean * 0.3), 1, fz * (0.06 + this.hero.lean * 0.3)).normalize();
    else rest.set(fx * 0.12, -1, fz * 0.12).normalize();
    // the rod's far end, verlet: it lags when the fist moves, swings under gravity when carried, is held upright when
    // raised (a stiff spring), and never goes into the ground
    const dtc = Math.min(dt, 1 / 20);
    if (!this.simOn) { this.tip.copy(grip).addScaledVector(rest, L); this.tipPrev.copy(this.tip); this.simOn = true; }
    const vel = this._vv || (this._vv = new THREE.Vector3()); vel.subVectors(this.tip, this.tipPrev).multiplyScalar(k > 0.5 ? 0.82 : 0.965);
    this.tipPrev.copy(this.tip); this.tip.add(vel);
    const goal = this._w || (this._w = new THREE.Vector3()); goal.copy(grip).addScaledVector(rest, L);
    const stiff = k > 0.5 ? 0.35 : 0.035;                                // (held up: firm; hanging: the hand barely holds it straight)
    this.tip.lerp(goal, stiff); if (k <= 0.5) this.tip.y -= 9.8 * dtc * dtc * 0.6;
    const ground = this.hero.pos.y + 0.03; if (this.tip.y < ground) this.tip.y = ground;
    const u = this.u.subVectors(this.tip, grip); if (u.lengthSq() < 1e-6) u.copy(rest); u.normalize(); this.tip.copy(grip).addScaledVector(u, L);
    // set it there: the grip in the fist; raised, its local up along the rod; carried, its local up (to the tip)
    // along the rod down. Turned to face your way about the rod.
    const axis = u;
    this.qY.setFromAxisAngle(this.Y, this.hero.face); this.qT.setFromUnitVectors(this.Y, axis); g.quaternion.multiplyQuaternions(this.qT, this.qY);
    // (local: the rim at 0, the shaft down to −S, the grip's middle at −S − GRIP/2 — that point in the fist)
    g.position.copy(grip).addScaledVector(axis, S + GRIP * 0.5);
    this.shaft.scale.y = S / 0.6; this.hook.position.y = -S;
    g.scale.setScalar(Math.min(1, this.held * 1.2));
  }
}

export function vinylMaterial(instanced = false, fold = null) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { ...U, uFold: fold || { value: 0 } },
    vertexShader: `${FOLD_GLSL} varying vec3 vN, vW; void main(){ mat4 m = modelMatrix${instanced ? ' * instanceMatrix' : ''}; vec3 q = foldU(position); vec4 w = m * vec4(q, 1.0); vW = w.xyz; vN = normalize(mat3(m) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${GLSL_COMMON} varying vec3 vN, vW;
      void main(){ vec3 n = normalize(vN), V = normalize(cameraPosition - vW); float f = pow(1.0 - abs(dot(n, V)), 2.5);
        vec3 c = vec3(0.8, 0.86, 0.98) * (0.35 + 0.65 * f) + streetLight(vW, n) * 0.7 * (0.3 + f);
        gl_FragColor = vec4(c, 0.2 + 0.55 * f); }`,
  });
}

// the rain on the canopy, every drop worked out in the shader from its seed: beads (most of them, every size, a few
// growing); runners (a bead that lets go: it moves in little jerks, faster as it goes, down the panel to the rim, and
// falls); and at the rib tips, drops gathering and falling. Each lit as the vinyl is: the street's light, the sky.
function rainOnCanopy(fold) {
  const NB = 170, NR = 40, ND = 8, NT = 7, n = NB + NR * (1 + NT) + ND, A = new Float32Array(n * 4), P = new Float32Array(n * 3);
  let k = 0;
  for (let i = 0; i < NB; i++) A.set([0, Math.random(), Math.random(), Math.random()], 4 * k++);
  for (let i = 0; i < NR; i++) { const s = [Math.random(), Math.random(), Math.random()]; A.set([1, ...s], 4 * k++); for (let j = 1; j <= NT; j++) A.set([3 + j / 10, ...s], 4 * k++); }   // (a runner, and the wet trail it leaves)
  for (let i = 0; i < ND; i++) A.set([2, i / ND, Math.random(), Math.random()], 4 * k++);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aD', new THREE.BufferAttribute(A, 4));
  return new THREE.Points(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { ...U, uFold: fold, uOpen: { value: 1 } },
    vertexShader: `${GLSL_COMMON} ${FOLD_GLSL} attribute vec4 aD; uniform float uOpen; varying float vA, vB; varying vec3 vL;
      float h1(float x){ return fract(sin(x * 127.1) * 43758.5453); }
      float domeAt(float r){ return 0.62 * (sqrt(max(0.0, 0.6724 - r * r)) - 0.82 * cos(0.98)); }
      void main(){
        float kind = aD.x, R0 = 0.683; vec3 p; float size = 0.0, a = 1.0;
        if (kind < 0.5) {                                                  // a bead: where it sits, how big
          float ang = aD.y * 6.2832, r = sqrt(aD.z) * 0.66; p = vec3(cos(ang) * r, domeAt(r) + 0.004, sin(ang) * r);
          size = 0.0035 + 0.0075 * pow(aD.w, 2.0) * (0.85 + 0.15 * sin(uTime * 0.7 + aD.w * 30.0));
        } else if (kind < 1.5 || kind > 2.5) {                                           // a runner: sits, lets go, runs, falls; then again somewhere new
          float T = 2.6 + 3.5 * aD.w, t = uTime + aD.y * 40.0, cyc = floor(t / T), f = fract(t / T);
          float ang = h1(cyc * 3.7 + aD.z * 91.0) * 6.2832, r0 = 0.05 + 0.4 * h1(cyc * 1.3 + aD.y * 53.0);
          float run = smoothstep(0.55, 1.0, f), jerk = run + 0.04 * sin(run * 40.0) * run;   // (in little starts)
          float r = mix(r0, R0, jerk * jerk), trail = kind > 2.5 ? (kind - 3.0) * 10.0 : 0.0;
          r = max(r0, r - trail * 0.016);                                   // (the trail: where it was, a moment ago)
          p = vec3(cos(ang) * r, domeAt(min(r, R0)) + 0.004, sin(ang) * r);
          float off = smoothstep(0.97, 1.0, f); p.y -= off * 0.25; p.xz *= 1.0 + off * 0.04;   // (off the rim, falling)
          size = 0.0075 + 0.004 * aD.z; a = 1.0 - smoothstep(0.985, 1.0, f);
          if (trail > 0.0) { size = 0.0035 * (1.0 - trail / 9.0); a *= step(0.56, f) * (0.55 - trail * 0.06) * step(r0 + 0.002, r); p.y -= off * 10.0; }
        } else {                                                           // a drip at a rib's tip: gathers, falls
          float ang = aD.y * 6.2832, T = 0.9 + 1.4 * aD.w, f = fract((uTime + aD.z * 9.0) / T);
          p = vec3(cos(ang) * R0, -0.012, sin(ang) * R0);
          float fall = smoothstep(0.7, 1.0, f); p.y -= fall * fall * 0.6;
          size = 0.003 + 0.006 * smoothstep(0.0, 0.7, f); a = 1.0 - smoothstep(0.9, 1.0, f);
        }
        p = foldU(p);
        vec4 w = modelMatrix * vec4(p, 1.0), mv = viewMatrix * w;
        vL = streetLight(w.xyz, vec3(0.0, 1.0, 0.0)) * 0.9 + uSky * 1.2 + vec3(0.12, 0.14, 0.18);
        vA = a * uOpen; vB = kind;
        gl_PointSize = clamp(size * 1800.0 / max(-mv.z, 0.1), 1.0, 9.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying float vA, vB; varying vec3 vL;
      void main(){ vec2 q = gl_PointCoord - 0.5; float d = length(q); if (d > 0.5 || vA < 0.01) discard;
        // a drop: clear, dark at its edge, the light caught in it at the top, a glint under it
        // (a drop of water on vinyl seen from a little way: a speck of the light caught in it, its body barely there)
        float body = smoothstep(0.5, 0.2, d), hi = exp(-dot(q - vec2(-0.08, -0.1), q - vec2(-0.08, -0.1)) * 70.0);
        vec3 c = vL * (0.5 + 1.1 * hi);
        gl_FragColor = vec4(c, (0.22 * body + 0.85 * hi) * vA); }`,
  }));
}
