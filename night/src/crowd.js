// The crowd of the Scramble: the townsfolk of the Norwegian town (their VRoid characters, dressed as the user
// approved them — winter coats, right for a cold wet night) now a few hundred people at once. Each character is
// drawn many times in one go: its walk and its standing about are worked out once into a picture of where every
// bone is, frame by frame (the bone picture), and each copy reads its own moment from it — so two hundred people
// cost hardly more than twelve. They come out of the station, up Center-gai, along Dōgenzaka; wait at the kerb
// while the cars go; and when the walkers' lights turn, cross every way at once, the diagonal too, step for step
// on the ground they cover. Many carry umbrellas when it rains: most the clear vinyl ones Tokyo buys at the kombini.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { NPCS, dressNpc } from './outfit/npcs.js';
import { SMAP, XMAP, retarget, restOf, san } from './retarget.js';
import { U, GLSL_COMMON } from './materials.js';
import { CROSSWALKS } from './layout.js';
import { KERB } from './ground.js';
import { rng } from './util.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// the right arm holding an umbrella up, as yours holds yours (umbrella.js: P, and the fist C): let down and swung a
// little forward, the elbow bent up, the hand at the chest; the fingers closed round the handle, the thumb over
function holdUp(h) {
  const e = new THREE.Euler(), set = (n, x, y, z) => { const b = h.getNormalizedBoneNode(n); if (b) b.quaternion.setFromEuler(e.set(x, y, z, 'XYZ')); };
  set('rightUpperArm', -0.2, 0.3, 1.45); set('rightLowerArm', 0.0, 1.85, 0.0); set('rightHand', 0, 0, 0);
  for (const f of ['Index', 'Middle', 'Ring', 'Little']) { const sp = f === 'Index' ? 1.0 : f === 'Little' ? 1.1 : 1.05; set('right' + f + 'Proximal', 0, 0, 1.15 * sp); set('right' + f + 'Intermediate', 0, 0, 1.25); set('right' + f + 'Distal', 0, 0, 0.8); }
  set('rightThumbProximal', 0, -0.35 * 0.8, 0.35 * 0.3); set('rightThumbDistal', 0, -0.5 * 0.8, 0.5 * 0.3);
}
// the umbrellas they carry: about a third the clear vinyl ones (the kombini's), some vinyl with a tint, the rest cloth
// in every colour, plain, in panels of two colours, or with a band round the edge
const UMB_TINT = [[1.0, 0.45, 0.68], [0.4, 0.7, 1.0], [0.42, 0.95, 0.7], [1.0, 0.88, 0.35], [0.72, 0.5, 1.0]];   // (pink, sky, mint, lemon, lilac: strong enough to read at night through the clear)
const UMB_CLOTH = [[0.05, 0.05, 0.06], [0.08, 0.12, 0.3], [0.75, 0.08, 0.1], [0.42, 0.05, 0.12], [0.95, 0.75, 0.1], [0.95, 0.45, 0.65], [0.35, 0.65, 0.92], [0.15, 0.5, 0.3], [0.8, 0.7, 0.55], [0.45, 0.25, 0.65], [0.95, 0.45, 0.1], [0.92, 0.92, 0.9], [0.1, 0.55, 0.6], [0.6, 0.6, 0.62]];
function umbrellaFor(R) {
  if (R() >= 0.62) return null;
  const k = R(), spin = R() * Math.PI * 2;
  if (k < 0.34) return { kind: 'vinyl', c: [0.8, 0.86, 0.98], c2: [0, 0, 0], pat: 0, spin };
  if (k < 0.46) return { kind: 'vinyl', c: UMB_TINT[Math.floor(R() * UMB_TINT.length)], c2: [0, 0, 0], pat: 0, spin };
  const c = UMB_CLOTH[Math.floor(R() * UMB_CLOTH.length)], q = R(); let c2 = UMB_CLOTH[Math.floor(R() * UMB_CLOTH.length)]; if (c2 === c) c2 = [0.92, 0.92, 0.9];
  return { kind: 'cloth', c, c2, pat: q < 0.6 ? 0 : q < 0.85 ? 1 : 2, spin };   // (pat: 0 plain, 1 panels in two colours, 2 a band round the edge)
}
const WALK_F = 32, IDLE_F = 32, CLIP_F = 32;                          // frames of each in the bone picture (all the same: walk, stand, talk, sit)
export const POSE = { WALK: 0, STAND: 1, TALK: 2, SIT: 3 };

// ---------------------------------------------------------------- the routes on foot
// corners where people wait, the crossings between them, and the ways in and out (sidewalk polylines, x/z metres)
export const CORNERS = { NW: [-12, -23], NE: [20, -17.5], SE: [20, 13], SW: [-24, 12] };
const ENDS = [ // [crossing index, which end, corner]
  [0, 'a', 'NW'], [0, 'b', 'SE'], [1, 'a', 'NW'], [1, 'b', 'NE'], [2, 'a', 'NE'], [2, 'b', 'SE'], [3, 'a', 'SW'], [3, 'b', 'SE'], [4, 'a', 'NW'], [4, 'b', 'SW'],
];
export const WAYS = {   // ways in and out at each corner: from far off to the corner
  NW: [[[-48, -50], [-35, -38], [-26, -28], [-17, -21]], [[2, -62], [0, -44], [-3, -30], [-6, -25]], [[-76, -19], [-55, -18], [-40, -18], [-31, -17]], [[-30, -56], [-24, -42], [-16, -32], [-12, -26]]],
  NE: [[[27, -64], [23, -46], [20, -32], [18.5, -22]], [[62, -9.5], [45, -9.5], [32, -10.5], [24, -12]]],
  SE: [[[42, 33], [35, 26], [27, 19], [21, 15]], [[30, 60], [26, 46], [22, 30], [19, 18]], [[58, 12.5], [44, 11.5], [32, 11], [24, 11]], [[16, 40], [14, 28], [15, 19]]],
  SW: [[[-72, 3.5], [-56, 4.5], [-42, 9], [-28, 11]], [[-38, 40], [-36, 28], [-31, 18], [-25, 14]]],
};

export class Crowd {
  static async load(scene, opts = {}) {
    const loader = new GLTFLoader(); loader.register(p => new VRMLoaderPlugin(p));
    const fbx = u => new FBXLoader().loadAsync(u).catch(() => null);
    const pick = NPCS.filter(s => !s.child);
    const [lib, wm, ww, ...vrms] = await Promise.all([new GLTFLoader().loadAsync('./assets/anim/ual-standard.glb'), fbx('./assets/anim/mixamo-walk-male.fbx'), fbx('./assets/anim/mixamo-walk-female.fbx'),
      ...pick.map(s => loader.loadAsync(`./assets/npc/${s.id}.vrm`).then(g => g.userData.vrm).catch(e => { console.error(s.id, e); return null; }))]);
    return new Crowd(scene, lib, { m: wm, f: ww }, pick, vrms, opts);
  }
  constructor(scene, lib, walks, specs, vrms, { count = 200, ground = null, blocked = null, roof = 0 } = {}) {
    this.scene = scene; this.ground = ground; this.types = []; this.agents = []; this.R = rng(99); this.root = new THREE.Group(); scene.add(this.root);
    const clips = Object.fromEntries(lib.animations.map(c => [c.name, c])), src = lib.scene;
    const m0 = new THREE.AnimationMixer(src); m0.clipAction(clips.A_TPose).play(); m0.update(0); src.updateMatrixWorld(true);
    const rest = restOf(src, SMAP), srcHips = src.getObjectByName(san('DEF-hips')).getWorldPosition(new THREE.Vector3()).y;
    specs.forEach((spec, i) => { const vrm = vrms[i]; if (vrm) this.types.push(this.bake(vrm, spec, clips, rest, srcHips, walks)); });
    const per = Math.ceil(count / Math.max(1, this.types.length)) + Math.ceil(roof / Math.max(1, this.types.length)) + 4;   // (and room for the visitors on the roof)
    for (const t of this.types) this.instance(t, per);
    // (room for everyone: the street's and the tower's — sized for the street alone, with the roof's and 46F's people
    // as well the shadows' draw was more than its buffer held, and the browser refused it: no one had a shadow)
    const room = per * Math.max(1, this.types.length);                // (as many as there are places for people: each takes one)
    this.umbrellas = this.umbrellaMeshes(room);
    this.shadows = this.shadowMesh(room);
    for (let i = 0; i < count; i++) this.spawn(this.types[i % this.types.length], true);
    this._v = new THREE.Vector3(); this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(1, 1, 1); this._e = new THREE.Euler();
    this._fr = new THREE.Frustum(); this._pm = new THREE.Matrix4(); this._sp = new THREE.Sphere(new THREE.Vector3(), 1.3); this.camera = null;
  }

  // one character worked out: dressed, its walk and its standing put into the bone picture, its pieces made ready to draw many times
  bake(vrm, spec, clips, rest, srcHips, walks) {
    VRMUtils.removeUnnecessaryVertices(vrm.scene); VRMUtils.combineSkeletons?.(vrm.scene); VRMUtils.rotateVRM0(vrm);
    vrm.scene.updateMatrixWorld(true);
    dressNpc({ vrm }, spec); healNormals(vrm.scene);
    vrm.humanoid.resetNormalizedPose(); vrm.scene.updateMatrixWorld(true);
    // the bones every piece is skinned to: the first skeleton found
    let skel = null; vrm.scene.traverse(o => { if (!skel && o.isSkinnedMesh) skel = o.skeleton; });
    const bones = skel.bones, index = new Map(bones.map((b, i) => [b, i])), inv = skel.boneInverses;
    // the clips on this one's bones
    const hips = vrm.humanoid.getNormalizedBoneNode('hips').getWorldPosition(new THREE.Vector3()).y;
    const mix = walks[spec.sex === 'm' ? 'm' : 'f'];
    const walk = mix?.animations.length ? retarget(mix.animations[0], restOf(mix, XMAP), vrm, hips / mix.getObjectByName(san('mixamorig:Hips')).getWorldPosition(new THREE.Vector3()).y, null, XMAP) : retarget(clips.Walk_Loop, rest, vrm, hips / srcHips);
    const idle = retarget(clips.Idle_Loop, rest, vrm, hips / srcHips);
    const talk = retarget(clips.Idle_Talking_Loop, rest, vrm, hips / srcHips), sit = retarget(clips.Sitting_Idle_Loop, rest, vrm, hips / srcHips);
    const speed = gaitSpeed(vrm, walk);
    // the pieces: every visible mesh as a skinned piece on those bones (a rigid one, hung on a bone, skinned to it wholly)
    vrm.humanoid.resetNormalizedPose(); vrm.scene.updateMatrixWorld(true);
    const pieces = [];
    const meshes = []; vrm.scene.traverse(o => { if (o.isMesh && o.visible) meshes.push(o); });
    for (const o of meshes) {
      const mats = [].concat(o.material), groups = o.geometry.groups.length ? o.geometry.groups : [{ start: 0, count: (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count), materialIndex: 0 }];
      let base = o.geometry;
      let skinI, skinW, pos;
      const n = base.attributes.position.count, P = new Float32Array(n * 3), SI = new Float32Array(n * 4), SW = new Float32Array(n * 4), N3 = new Float32Array(n * 3);
      const v = new THREE.Vector3(), nn = new THREE.Vector3();
      if (o.isSkinnedMesh) {
        const map = o.skeleton.bones.map(b => index.get(b) ?? 0), si = base.attributes.skinIndex, sw = base.attributes.skinWeight, bm = o.bindMatrix, nm = new THREE.Matrix3().getNormalMatrix(bm);
        for (let i = 0; i < n; i++) {
          v.fromBufferAttribute(base.attributes.position, i).applyMatrix4(bm); P.set([v.x, v.y, v.z], i * 3);
          nn.fromBufferAttribute(base.attributes.normal, i).applyMatrix3(nm).normalize(); N3.set([nn.x, nn.y, nn.z], i * 3);
          for (let k = 0; k < 4; k++) { SI[i * 4 + k] = map[si.getComponent(i, k)]; SW[i * 4 + k] = sw.getComponent(i, k); }
        }
      } else {
        let b = o.parent; while (b && !index.has(b)) b = b.parent; if (!b) continue;
        const bi = index.get(b), local = new THREE.Matrix4().copy(b.matrixWorld).invert().multiply(o.matrixWorld), M = new THREE.Matrix4().copy(inv[bi]).invert().multiply(local), nm = new THREE.Matrix3().getNormalMatrix(M);
        for (let i = 0; i < n; i++) {
          v.fromBufferAttribute(base.attributes.position, i).applyMatrix4(M); P.set([v.x, v.y, v.z], i * 3);
          if (base.attributes.normal) nn.fromBufferAttribute(base.attributes.normal, i).applyMatrix3(nm).normalize(); else nn.set(0, 1, 0); N3.set([nn.x, nn.y, nn.z], i * 3);
          SI[i * 4] = bi; SW[i * 4] = 1;
        }
      }
      for (const gr of groups) {
        const mat = mats[gr.materialIndex]; if (!mat || mat.isOutline || mat.visible === false || /Outline/.test(mat.name)) continue;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N3, 3));
        g.setAttribute('aSkinI', new THREE.BufferAttribute(SI, 4)); g.setAttribute('aSkinW', new THREE.BufferAttribute(SW, 4));
        if (base.attributes.uv) g.setAttribute('uv', base.attributes.uv);
        if (base.attributes.color) g.setAttribute('color', base.attributes.color);
        if (base.index) g.setIndex(new THREE.BufferAttribute(base.index.array.slice(gr.start, gr.start + gr.count), 1));
        else g.setDrawRange(gr.start, gr.count);
        g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1, 0), 2);
        // how big the piece is (its used vertices): the little ones are drawn only close up
        let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; const idx = g.index ? g.index.array : null, cnt = idx ? idx.length : gr.count;
        for (let j = 0; j < cnt; j += Math.max(1, Math.floor(cnt / 400))) { const vi = idx ? idx[j] : gr.start + j; for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], P[vi * 3 + k]); mx[k] = Math.max(mx[k], P[vi * 3 + k]); } }
        const size = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
        pieces.push({ g, mat, tiny: size < 0.12 });
      }
    }
    // the bone picture: every bone's matrix (4 texels), a row a frame — the walk, then the standing
    const W = bones.length * 3, H = CLIP_F * 6, data = new Float32Array(W * H * 4), mixer = new THREE.AnimationMixer(vrm.scene), M4 = new THREE.Matrix4();
    const grips = [];                                                   // (holding an umbrella: where the fist is, each frame — for the umbrella)
    const rowOf = (clip, f0, F, hold = false) => {
      const act = mixer.clipAction(clip); act.play();
      for (let f = 0; f < F; f++) {
        act.time = clip.duration * f / F; mixer.update(0); if (hold) holdUp(vrm.humanoid); vrm.update?.(0); vrm.scene.updateMatrixWorld(true);
        // (the hips held over the spot: the clips walk in place, but drift a little)
        const root = vrm.humanoid.getRawBoneNode('hips').getWorldPosition(new THREE.Vector3()); root.y = 0;
        bones.forEach((b, i) => { M4.multiplyMatrices(b.matrixWorld, inv[i]); const e = M4.elements; e[12] -= root.x; e[14] -= root.z; const o = ((f0 + f) * W + i * 3) * 4; data.set([e[0], e[4], e[8], e[12], e[1], e[5], e[9], e[13], e[2], e[6], e[10], e[14]], o); });
        if (hold) { const h = vrm.humanoid, g = h.getRawBoneNode('rightHand').getWorldPosition(new THREE.Vector3()), m = h.getRawBoneNode('rightMiddleProximal')?.getWorldPosition(new THREE.Vector3()); if (m) g.lerp(m, 0.75); g.x -= root.x; g.z -= root.z; grips[f0 + f] = [g.x, g.y, g.z]; }
      }
      act.stop();
    };
    rowOf(walk, 0, CLIP_F); rowOf(idle, CLIP_F, CLIP_F); rowOf(talk, CLIP_F * 2, CLIP_F); rowOf(sit, CLIP_F * 3, CLIP_F);
    // (and the walk and the standing again with an umbrella held up in the right hand, as you hold yours: rows 4, 5)
    rowOf(walk, CLIP_F * 4, CLIP_F, true); rowOf(idle, CLIP_F * 5, CLIP_F, true);
    mixer.uncacheRoot(vrm.scene); vrm.humanoid.resetNormalizedPose();
    const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType); tex.needsUpdate = true;
    return { spec, pieces, tex, speed, grips, walkDur: walk.duration, idleDur: idle.duration, durs: [walk.duration, idle.duration, talk.duration, sit.duration, walk.duration, idle.duration], height: vrm.humanoid.getNormalizedBoneNode('head').getWorldPosition(new THREE.Vector3()).y + 0.12, meshes: [], free: [], vrm };
  }

  // the many copies of one character: each piece drawn instanced, each copy its own place and moment
  instance(t, n) {
    t.n = n; t.anim = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);   // (the frame, which clip, and this one's own variation of its clothes) t.anim.setUsage(THREE.DynamicDrawUsage);
    for (const piece of t.pieces) { const { g, mat } = piece;
      const gi = new THREE.InstancedBufferGeometry(); gi.copy(g); gi.instanceCount = n; gi.setAttribute('aAnim', t.anim);
      const m = new THREE.InstancedMesh(gi, crowdMaterial(mat, t.tex), n); m.count = 0; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.layers.set(0); m.userData.crowd = true; m.userData.noInk = true; m.userData.tiny = piece.tiny; m.userData.nd = crowdND(mat, t.tex); m.userData.main = m.material; this.root.add(m); t.meshes.push(m);
    }
    for (let i = 0; i < n; i++) t.free.push(i);
  }

  // the street's fixed things (circles [x, z, r]) sorted into 4 m cells, once
  setObstacles(list, blocked) {
    this.blocked = blocked; this.ob = new Map();
    for (const o of list) for (let a = Math.floor((o[0] - o[2]) / 4); a <= Math.floor((o[0] + o[2]) / 4); a++) for (let b = Math.floor((o[1] - o[2]) / 4); b <= Math.floor((o[1] + o[2]) / 4); b++) { const k = a * 10007 + b; if (!this.ob.has(k)) this.ob.set(k, []); this.ob.get(k).push(o); }
  }
  obstaclesNear(x, z) { return this.ob?.get(Math.floor(x / 4) * 10007 + Math.floor(z / 4)) || []; }
  // only those within d metres drawn (for the mirror, the drawn line), then all again
  limit(d) { for (const t of this.types) { let k = 0; while (k < (t.near?.length || 0) && t.near[k] < d) k++; for (const m of t.meshes) m.count = m.userData.tiny ? Math.min(k, t.close || 0) : k; } }
  restore() { for (const t of this.types) for (const m of t.meshes) m.count = m.userData.tiny ? (t.close || 0) : (t.count || 0); }
  // the drawn line's record of where they are (ink.js calls this after the rest of the city is recorded)
  drawND(renderer, camera, d = 32) {
    this.limit(d);
    const all = this.types.flatMap(t => t.meshes), was = all.map(m => m.visible);   // (the line's pass has put them away with the other things it doesn't record)
    for (const m of all) { m.material = m.userData.nd; m.visible = true; }
    const ac = renderer.autoClear; renderer.autoClear = false; renderer.render(this.root, camera); renderer.autoClear = ac;
    all.forEach((m, i) => { m.material = m.userData.main; m.visible = was[i]; });
    this.restore();
  }
  umbrellaMeshes(n) {
    // the canopy: eight panels sagging between their ribs (rim at y 0, the top 0.175 up)
    const canopy = new THREE.SphereGeometry(0.72, 16, 5, 0, Math.PI * 2, 0, 0.98).translate(0, -0.72 * Math.cos(0.98), 0).scale(1, 0.55, 1);
    const sag = (r, a) => 0.04 * (r / 0.6) * (0.5 + 0.5 * Math.cos(a * 8));
    { const p = canopy.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), r = Math.hypot(x, z); p.setY(i, p.getY(i) - sag(r, a)); } canopy.computeVertexNormals(); }
    // the frame under it: eight ribs along the dome where it doesn't sag, the white tips, the rim between them, the
    // ferrule on top — one shape
    const rimR = 0.72 * Math.sin(0.98), domeAt = r => 0.55 * (Math.sqrt(Math.max(0, 0.72 * 0.72 - r * r)) - 0.72 * Math.cos(0.98)), parts = [];
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2, pts = []; for (let k = 0; k <= 5; k++) { const r = rimR * k / 5; pts.push(new THREE.Vector3(Math.cos(a) * r, domeAt(r) - 0.008, Math.sin(a) * r)); }
      parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 6, 0.007, 3), new THREE.OctahedronGeometry(0.016).translate(Math.cos(a) * rimR, -0.01, Math.sin(a) * rimR));
    }
    parts.push(new THREE.TorusGeometry(rimR, 0.005, 3, 32).rotateX(Math.PI / 2), new THREE.OctahedronGeometry(0.016).translate(0, domeAt(0) + 0.01, 0));
    const frame = mergeGeometries(parts.map(g => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; }));
    // the shaft (from the top down to the hand: 0 to −1, stretched to its length) and the handle (a straight grip — the
    // fist closes on its middle — and the J below)
    const shaft = new THREE.CylinderGeometry(0.0065, 0.0065, 1, 5).translate(0, -0.5, 0);
    const handle = mergeGeometries([new THREE.CylinderGeometry(0.013, 0.012, 0.11, 8).translate(0, 0, 0), new THREE.TorusGeometry(0.036, 0.011, 6, 10, Math.PI).rotateY(Math.PI / 2).translate(0, -0.055, -0.036)].map(g => { g.deleteAttribute('uv'); return g.index ? g.toNonIndexed() : g; }));
    // the clear ones, a tint of their own each; the cloth ones lit as the street is, in panels or with a band
    const vinyl = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { ...U },
      vertexShader: `varying vec3 vN, vW, vC; void main(){ vC = instanceColor; mat4 m = modelMatrix * instanceMatrix; vec4 w = m * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(m) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `${GLSL_COMMON} varying vec3 vN, vW, vC;
        void main(){ vec3 n = normalize(vN), V = normalize(cameraPosition - vW); float f = pow(1.0 - abs(dot(n, V)), 2.5);
          float tint = clamp(1.0 - min(vC.r, min(vC.g, vC.b)) / max(vC.r, max(vC.g, vC.b)), 0.0, 1.0);   // (how coloured it is: 0 for the plain clear)
          vec3 c = vC * (0.35 + 0.65 * f) * (1.0 + 0.4 * tint) + streetLight(vW, n) * 0.7 * (0.3 + f) * mix(vec3(1.0), vC, tint * 0.6);
          gl_FragColor = vec4(c, 0.22 + 0.2 * tint + 0.55 * f); }` });
    const cloth = new THREE.ShaderMaterial({ uniforms: { ...U }, side: THREE.DoubleSide,
      vertexShader: `attribute vec3 aC2; attribute float aPat; varying vec3 vC, vC2, vN, vW; varying vec2 vL; varying float vPat;
        void main(){ vC = instanceColor; vC2 = aC2; vPat = aPat; vL = position.xz; vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `${GLSL_COMMON} varying vec3 vC, vC2, vN, vW; varying vec2 vL; varying float vPat;
        void main(){ vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
          float a = atan(vL.y, vL.x), panel = mod(floor(a / 0.785398 + 8.0), 2.0), r = length(vL);
          vec3 c = vPat < 0.5 ? vC : vPat < 1.5 ? mix(vC, vC2, panel) : mix(vC, vC2, step(0.52, r));
          gl_FragColor = vec4(fogIt(cleanColour(c) * toonLight(n, vW), vW), 1.0); }` });
    const lit = new THREE.ShaderMaterial({ uniforms: { ...U },
      vertexShader: `varying vec3 vC, vN, vW; void main(){ vC = instanceColor; vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `${GLSL_COMMON} varying vec3 vC, vN, vW; void main(){ vec3 n = normalize(vN); gl_FragColor = vec4(fogIt(cleanColour(vC) * toonLight(n, vW), vW), 1.0); }` });
    const mk = (g, m) => { const im = new THREE.InstancedMesh(g, m, n); im.count = 0; im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3); this.scene.add(im); return im; };
    const out = { vinyl: mk(canopy, vinyl), solid: mk(canopy.clone(), cloth), frame: mk(frame, lit), stick: mk(shaft, lit), handle: mk(handle, lit) };
    out.c2 = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3); out.pat = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
    out.solid.geometry.setAttribute('aC2', out.c2); out.solid.geometry.setAttribute('aPat', out.pat);
    out.vinyl.renderOrder = 6;
    return out;
  }
  shadowMesh(n) {
    const g = new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2);
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.MultiplyBlending, premultipliedAlpha: true, polygonOffset: true, polygonOffsetFactor: -4,
      vertexShader: `varying vec2 vL; void main(){ vL = position.xz; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying vec2 vL; void main(){ float a = 1.0 - smoothstep(0.05, 0.42, length(vL * vec2(1.0, 1.4))); gl_FragColor = vec4(mix(vec3(1.0), vec3(0.32, 0.36, 0.52), a * 0.55), 1.0); }` });
    const im = new THREE.InstancedMesh(g, m, n); im.count = 0; im.frustumCulled = false; im.layers.set(1); im.userData.noInk = true; this.scene.add(im); return im;
  }

  // someone new: from a way in at some corner (or, at the start, anywhere along the way), going to another corner's way out
  // the visitors on SHIBUYA SKY's roof, as it is at sunset, its busiest: most of them along the glass, thickest on the
  // side that faces the sun, alone, in twos and threes, looking out (some talking); a row of them sitting on the
  // stepped seats facing the sunset; a few groups talking out on the deck; some walking slowly from one place at the
  // glass to another, stopping a while at each
  roofPeople(stage, n = 150) {
    const R = rng(4646), F = stage.F, sun = F.out, people = [], taken = [];
    this.roofBlocked = (x, z) => stage.blocked(x, z);
    // (not in the ways on and off the escalators: a body's width and its swaying about kept out of them — stage.keepClear)
    const free = (x, z, d = 0.62) => !stage.blocked(x, z) && !stage.keepClear?.(x, z, 0.5) && Math.abs(stage.heightAt(x, z) - 229) < 0.05 && !taken.some(p => (p[0] - x) ** 2 + (p[1] - z) ** 2 < d * d);
    const put = (x, z, face, pose, plan = null) => { taken.push([x, z]); people.push({ x, z, face, pose, plan, outdoor: true }); };
    const seg = [], ring = stage.deckRing;
    for (let k = 0; k < ring.length; k++) { const a = ring[k], b = ring[(k + 1) % ring.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 2) continue; const nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L; seg.push({ a, b, L, nx, nz, w: 0.3 + 1.7 * Math.max(0, nx * sun[0] + nz * sun[1]) }); }
    const wSum = seg.reduce((m, q) => m + q.L * q.w, 0);
    const atGlass = (inset = 0.7) => { let r = R() * wSum; let q = seg[0]; for (const g of seg) { r -= g.L * g.w; if (r <= 0) { q = g; break; } } const f = R(); return { x: q.a[0] + (q.b[0] - q.a[0]) * f - q.nx * inset, z: q.a[1] + (q.b[1] - q.a[1]) * f - q.nz * inset, face: Math.atan2(q.nx, q.nz), q }; };
    // along the glass: groups of one to three side by side
    const nGlass = Math.round(n * 0.6);
    for (let i = 0; i < 900 && people.length < nGlass; i++) {
      const g = atGlass(0.6 + R() * 0.45); if (!free(g.x, g.z, 0.7)) continue;
      const size = R() < 0.4 ? 1 : R() < 0.75 ? 2 : 3, tx = -g.q.nz, tz = g.q.nx, talk = size > 1 && R() < 0.45;
      for (let k = 0; k < size; k++) {
        const x = g.x + tx * k * 0.62 + (R() - 0.5) * 0.12, z = g.z + tz * k * 0.62 + (R() - 0.5) * 0.12; if (k && !free(x, z, 0.5)) break;
        const toFriend = k ? Math.atan2(-tx, -tz) : Math.atan2(tx, tz);   // (talking: half turned to the one beside)
        put(x, z, talk ? g.face + Math.atan2(Math.sin(toFriend - g.face), Math.cos(toFriend - g.face)) * 0.45 : g.face + (R() - 0.5) * 0.5, talk ? 2 : 1);
      }
    }
    // on the heliport's broad west steps, facing the sunset (sitting on one step, feet on the one below)
    const S = stage.seats, nSeat = Math.round(n * 0.2), back = Math.atan2(-(F.toW(0, 1)[0] - F.toW(0, 0)[0]), -(F.toW(0, 1)[1] - F.toW(0, 0)[1]));
    const seated = [];
    for (let i = 0; i < 600 && seated.length < nSeat; i++) {
      const row = Math.floor(R() * S.rows.length), [vf, hh] = S.rows[row], u = S.u0 + 0.6 + R() * (S.u1 - S.u0 - 1.2);
      if (seated.some(p => p.row === row && Math.abs(p.u - u) < 0.62)) continue;
      const [x, z] = F.toW(u, vf - 0.22), p = { x, z, face: back + (R() - 0.5) * 0.3, pose: 3, y: 229 + hh - 0.4, row, u, seat: true };
      seated.push(p); people.push(p);
    }
    // standing up on the heliport's top, looking round
    { const H = stage.heli; for (let i = 0, m = 0; i < 200 && m < Math.round(n * 0.06); i++) { const u = H.u0 + 1 + R() * (H.u1 - H.u0 - 2), v = H.v0 + 1 + R() * (H.v1 - H.v0 - 2), [x, z] = F.toW(u, v); if (people.some(p => (p.x - x) ** 2 + (p.z - z) ** 2 < 1.2)) continue; people.push({ x, z, face: R() * 6.28, pose: R() < 0.5 ? 2 : 1, y: 229 + H.h }); m++; } }
    // at SKY EDGE, the corner over the crossing: two at its tip having their picture taken, the rest waiting their turn
    { const [tu, tv] = stage.edgeTip, toTip = (u, v) => { const [x, z] = F.toW(u, v), [tx, tz] = F.toW(tu, tv); return Math.atan2(tx - x, tz - z); };
      for (const [u, v] of [[tu + 0.9, tv + 0.7], [tu + 0.7, tv + 1.4]]) { const [x, z] = F.toW(u, v); put(x, z, toTip(u, v) + Math.PI, 1); }   // (facing the camera, their backs to the view)
      for (let k = 0; k < 9; k++) { const u = tu + 3.6 + k * 0.75, v = tv + 3.2 + k * 0.55, [x, z] = F.toW(u, v); if (free(x, z, 0.4)) put(x, z, toTip(u, v), R() < 0.4 ? 2 : 1); } }
    // groups talking out on the deck
    for (let i = 0; i < 400 && people.length < Math.round(n * 0.9); i++) {
      const [x, z] = [ring[0][0], ring[0][1]].map((c, j) => { const xs = ring.map(p => p[j]); return Math.min(...xs) + R() * (Math.max(...xs) - Math.min(...xs)); });
      if (!free(x, z, 2.2)) continue;
      const m = R() < 0.5 ? 3 : 4, a0 = R() * 6.28;
      for (let k = 0; k < m; k++) { const a = a0 + k * 6.28 / m, px = x + Math.sin(a) * 0.55, pz = z + Math.cos(a) * 0.55; if (free(px, pz, 0.45)) put(px, pz, a + Math.PI, R() < 0.7 ? 2 : 1); }
    }
    // walking from one place at the glass to another, a while at each (three places, round and round; only where the
    // way between is clear)
    const clear = (p, q) => { const d = Math.hypot(q.x - p.x, q.z - p.z); for (let t = 0; t <= d; t += 0.25) { const x = p.x + (q.x - p.x) * t / d, z = p.z + (q.z - p.z) * t / d; if (stage.blocked(x, z) || stage.keepClear?.(x, z, 0.6)) return false; } return true; };   // (the way between clear: of the escalators' ends too)
    for (let i = 0; i < 900 && people.length < n; i++) {               // (more tries: fewer rounds are clear now the escalators' ends are kept clear)
      const A = atGlass(1.3), B = atGlass(1.3), C = atGlass(1.3);
      if (!clear(A, B) || !clear(B, C) || !clear(C, A) || Math.hypot(A.x - B.x, A.z - B.z) < 6) continue;
      const stay = p => ({ stay: 6 + R() * 22, pose: 1, face: p.face });
      const plan = [{ pts: [[A.x, A.z], [B.x, B.z]] }, stay(B), { pts: [[B.x, B.z], [C.x, C.z]] }, stay(C), { pts: [[C.x, C.z], [A.x, A.z]] }, stay(A)];
      people.push({ x: A.x, z: A.z, face: A.face, pose: 1, plan, walk: true });
    }
    this.addPeople(people, R);
    this.roofCount = people.length;
  }
  // people who stay (or walk a round of their own) up in the tower: [{ x, z, y, face, pose, plan?, walk? }]
  addPeople(people, R = this.R) {
    const placed = [];
    for (const p of people) {
      // not the same one twice close together (a pair of twins at the glass would give it away)
      let t = null;
      for (let k = 0; k < 12; k++) { const c = R.pick(this.types); if (!c.free.length) continue; if (!placed.some(q => q.t === c && (q.x - p.x) ** 2 + (q.z - p.z) ** 2 < 36)) { t = c; break; } t ||= c; }
      if (!t) continue; placed.push({ t, x: p.x, z: p.z });
      this.agents.push({ t, slot: t.free.pop(), plan: p.plan || [{ stay: true, pose: p.pose }], loop: !!p.plan, step: p.plan ? Math.floor(R() * 3) * 2 : 0, seg: 0, x: p.x, z: p.z, face: p.face,
        speed: p.walk ? (0.6 + R() * 0.25) * t.speed : 0, phase: R(), idleP: R(), pose: p.pose, state: 'stay', roofY: p.y ?? 229, indoor: !!p.indoor, outdoor: !!p.outdoor, rate: p.indoor ? 0.8 + R() * 0.4 : 1,   // (rate: 46F's people each their own pace at standing about, so no two sway together)
         umb: null, side: 0 });
    }
  }
  spawn(t, anywhere = false) {
    const R = this.R; if (!t.free.length) return;
    const corners = Object.keys(CORNERS), from = R.pick(corners);
    const inWay = R.pick(WAYS[from]);
    // where to: over one crossing or two (the diagonal counts as one), then out another way
    const route = this.routeFrom(from, R);
    const to = route.length ? route[route.length - 1].to : from;
    const outWay = R.pick(WAYS[to]).slice().reverse();
    const pts = inWay.map(p => [p[0] + (R() - 0.5) * 1.6, p[1] + (R() - 0.5) * 1.6]);
    const plan = [{ pts }];
    for (const r of route) plan.push({ cross: r });
    plan.push({ pts: outWay.map(p => [p[0] + (R() - 0.5) * 1.6, p[1] + (R() - 0.5) * 1.6]) });
    const a = { t, slot: t.free.pop(), plan, step: 0, seg: 0, x: pts[0][0], z: pts[0][1], face: 0, speed: (0.85 + R() * 0.35) * t.speed, phase: R(), idleP: R(), state: 'walk', wait: 0,
      umb: umbrellaFor(R), side: (R() - 0.5) * 1.2 };
    if (anywhere) {                                                    // (the street already full when you arrive)
      const k = Math.floor(R() * plan.length); a.step = k;
      const s = plan[k]; if (s.pts) { a.seg = Math.floor(R() * (s.pts.length - 1)); a.x = s.pts[a.seg][0]; a.z = s.pts[a.seg][1]; } else { const c = s.cross; a.x = c.from[0]; a.z = c.from[1]; a.state = 'wait'; }
    }
    this.agents.push(a);
  }
  routeFrom(corner, R) {
    const out = []; let at = corner;
    const hops = R() < 0.75 ? 1 : 2;
    for (let h = 0; h < hops; h++) {
      const opts = ENDS.filter(e => e[2] === at).map(e => { const c = CROSSWALKS[e[0]], other = e[1] === 'a' ? 'b' : 'a', oe = ENDS.find(x => x[0] === e[0] && x[1] === other); return { c, from: c[e[1]], to: oe[2], toP: c[other] }; }).filter(o => !out.some(p => p.to === o.to) && o.to !== corner);
      if (!opts.length) break; const o = R.pick(opts); out.push(o); at = o.to;
    }
    return out;
  }

  update(dt, time, walkOn, you) {
    const R = this.R, A = this.agents;
    // who is near whom (for keeping a little apart)
    const cell = new Map(), key = (x, z) => Math.floor(x / 1.5) * 10007 + Math.floor(z / 1.5);
    for (const a of A) { const k = key(a.x, a.z); if (!cell.has(k)) cell.set(k, []); cell.get(k).push(a); }
    for (let i = A.length - 1; i >= 0; i--) {
      const a = A[i], s = a.plan[a.step];
      if (s && s.stay) {                                               // (standing, talking or sitting: for good, or a while)
        a.moving = false; a.pose = s.pose || 1; a.idleP = (a.idleP + dt * (a.rate || 1) / a.t.durs[a.pose]) % 1;
        if (s.face != null) a.face += Math.atan2(Math.sin(s.face - a.face), Math.cos(s.face - a.face)) * Math.min(1, dt * 2);
        if (s.stay !== true) { a.wait = (a.wait || 0) + dt; if (a.wait > s.stay) { a.wait = 0; a.step++; if (a.step >= a.plan.length && a.loop) a.step = 0; } }
        continue;
      }
      if (!s && a.loop) { a.step = 0; continue; }
      if (!s) { A.splice(i, 1); a.t.free.push(a.slot); this.spawn(R.pick(this.types)); continue; }
      let tx, tz, go = true;
      if (s.pts) {
        const p = s.pts[a.seg + 1]; if (!p) { a.step++; a.seg = 0; if (a.step >= a.plan.length && a.loop) a.step = 0; continue; }
        tx = p[0]; tz = p[1];
        if (Math.hypot(tx - a.x, tz - a.z) < 0.8) { a.seg++; continue; }
      } else {
        // a crossing: wait at its kerb for the walkers' light, then over (spread across its width)
        const c = s.cross, dx = c.toP[0] - c.from[0], dz = c.toP[1] - c.from[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L, side = a.side * c.c.w * 0.4;
        if (a.state !== 'cross') {
          const wx = c.from[0] - ux * (1.2 + Math.abs(a.side) * 1.5) - uz * side, wz = c.from[1] - uz * (1.2 + Math.abs(a.side) * 1.5) + ux * side;
          tx = wx; tz = wz;
          if (walkOn) a.state = 'cross';
          else if (Math.hypot(tx - a.x, tz - a.z) < 0.5) { go = false; a.state = 'wait'; a.face += Math.atan2(Math.sin(Math.atan2(ux, uz) - a.face), Math.cos(Math.atan2(ux, uz) - a.face)) * Math.min(1, dt * 3); }
        }
        if (a.state === 'cross') {
          tx = c.toP[0] + ux * 1.5 - uz * side; tz = c.toP[1] + uz * 1.5 + ux * side;
          if (Math.hypot(tx - a.x, tz - a.z) < 0.9) { a.step++; a.state = 'walk'; continue; }
        }
      }
      let mv = 0;
      if (go) {
        let dx = tx - a.x, dz = tz - a.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
        // keep a little apart from those near
        let px = 0, pz = 0;
        for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) for (const b of cell.get(key(a.x + ox * 1.5, a.z + oz * 1.5)) || []) {
          if (b === a) continue; const ex = a.x - b.x, ez = a.z - b.z, e2 = ex * ex + ez * ez; if (e2 > 0.6 || e2 < 1e-6) continue; const e = Math.sqrt(e2); px += ex / e * (0.78 - e); pz += ez / e * (0.78 - e);
        }
        if (you) { const ex = a.x - you.x, ez = a.z - you.z, e2 = ex * ex + ez * ez; if (e2 < 1.0 && e2 > 1e-6) { const e = Math.sqrt(e2); px += ex / e * (1.0 - e) * 2; pz += ez / e * (1.0 - e) * 2; } }
        // round the tree beds, posts and poles in the way (and never into a building)
        if (a.roofY == null) for (const o of this.obstaclesNear(a.x, a.z)) { const ex = a.x - o[0], ez = a.z - o[1], rr = o[2] + 0.45, e2 = ex * ex + ez * ez; if (e2 < rr * rr && e2 > 1e-6) { const e = Math.sqrt(e2), k = (rr - e) / rr; px += ex / e * k * 1.4 + (-ez / e) * k * 0.6; pz += ez / e * k * 1.4 + (ex / e) * k * 0.6; } }
        const sp = a.speed * (a.state === 'cross' && walkOn === false ? 1.25 : 1);   // (hurrying when the light has gone)
        const vx = dx * sp + px * 1.6, vz = dz * sp + pz * 1.6;
        const nx = a.x + vx * dt, nz = a.z + vz * dt;
        const blk = a.roofY != null ? this.roofBlocked : this.blocked;   // (up on the roof, its own walls and wells)
        if (!blk || !blk(nx, nz)) { a.x = nx; a.z = nz; } else if (!blk(nx, a.z)) a.x = nx; else if (!blk(a.x, nz)) a.z = nz;
        mv = Math.hypot(vx, vz) * dt;
        const want = Math.atan2(vx, vz); a.face += Math.atan2(Math.sin(want - a.face), Math.cos(want - a.face)) * Math.min(1, dt * 6);
      }
      a.moving = mv > 1e-4;
      if (a.moving) a.phase = (a.phase + mv / (a.t.speed * a.t.walkDur)) % 1;   // (the stride kept to the ground covered)
      else a.idleP = (a.idleP + dt / a.t.durs[a.pose || 1]) % 1;
    }
    // into the drawing: those in view, nearest first (so the mirror and the drawn line can take just the near ones)
    const cam = this.camera, M = this._m, q = this._q, v = this._v, sc = this._s;
    if (cam) { cam.updateMatrixWorld(); this._fr.setFromProjectionMatrix(this._pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)); }
    const vis = new Map(this.types.map(t => [t, []]));
    for (const a of A) {
      if (a.indoor && this.indoorShown === false) { a.y = null; continue; }   // (46F's people, while it isn't drawn: main.js)
      if (this.roofClosed && a.roofY != null && !a.indoor) { a.y = null; continue; }   // (the roof's visitors, all of them: not there while it is shut, in the rain — main.js)
      const y = a.roofY ?? (this.ground ? this.ground.height(a.x, a.z) : KERB); a.y = y;
      if (cam) { a.d = Math.hypot(a.x - cam.position.x, a.z - cam.position.z); if (a.d > 110) continue; this._sp.center.set(a.x, y + 0.9, a.z); if (!this._fr.intersectsSphere(this._sp)) continue; }
      vis.get(a.t).push(a);
    }
    let nv = 0, ns = 0, sh = 0, nf = 0;
    const rainy = U.uRain.value > 0.3;
    for (const a of A) a.holding = false;
    for (const [t, list] of vis) {
      list.sort((p, r) => p.d - r.d);
      t.near = list.map(a => a.d);
      list.forEach((a, k) => {
        q.setFromAxisAngle(UP, a.face); v.set(a.x, a.y, a.z); M.compose(v, q, sc);
        for (const m of t.meshes) m.setMatrixAt(k, M);
        let pose = a.moving ? 0 : (a.pose || 1); a.var ??= Math.random();
        a.holding = !!a.umb && rainy && pose !== 3; if (a.holding) pose = a.moving ? 4 : 5;   // (an umbrella up: the walk or the standing with the right arm holding it — not sitting)
        t.anim.setXYZ(k, pose * CLIP_F + (a.moving ? a.phase : a.idleP) * CLIP_F, pose, a.var + (a.roofY != null ? 2 : 0));   // (+2: up on SHIBUYA SKY's roof, where hats aren't allowed)
      });
      t.count = list.length;
      let close = 0; while (close < t.near.length && t.near[close] < 14) close++;
      t.close = close;
      for (const m of t.meshes) { m.count = m.userData.tiny ? close : t.count; m.instanceMatrix.needsUpdate = true; } t.anim.needsUpdate = true;
    }
    for (const a of A) {
      if (a.y == null) continue; const t = a.t, y = a.y;
      if (a.holding) {
        // in the fist (where it was, this frame of the walk or the standing: the bone picture's own), the shaft up from it
        // to the top of the canopy, which is over the head — leaning back a little from the hand to cover it
        const Uq = this.umbrellas, fi = Math.min(CLIP_F - 1, Math.floor((a.moving ? a.phase : a.idleP) * CLIP_F)), gl = t.grips[(a.moving ? 4 : 5) * CLIP_F + fi];
        const cf = Math.cos(a.face), sf = Math.sin(a.face), G = this._G || (this._G = new THREE.Vector3()), T = this._T || (this._T = new THREE.Vector3()), ax = this._ax || (this._ax = new THREE.Vector3());
        G.set(a.x + gl[0] * cf + gl[2] * sf, y + gl[1], a.z - gl[0] * sf + gl[2] * cf);
        const hx = a.x + sf * 0.03, hz = a.z + cf * 0.03;
        T.set(G.x * 0.35 + hx * 0.65, y + t.height + 0.06 + 0.175, G.z * 0.35 + hz * 0.65);
        ax.subVectors(T, G); const L = ax.length(); ax.divideScalar(L);
        const qa = this._qa || (this._qa = new THREE.Quaternion()), qs = this._qs || (this._qs = new THREE.Quaternion());
        qa.setFromUnitVectors(UP, ax).multiply(qs.setFromAxisAngle(UP, a.face + a.umb.spin));
        const one = this._one || (this._one = new THREE.Vector3(1, 1, 1)), P = this._P || (this._P = new THREE.Vector3());
        P.copy(T).addScaledVector(ax, -0.175); M.compose(P, qa, one);
        const u = a.umb, clear = u.kind === 'vinyl';
        if (clear) { Uq.vinyl.setMatrixAt(nv, M); Uq.vinyl.instanceColor.setXYZ(nv++, ...u.c); }
        else { Uq.solid.setMatrixAt(ns, M); Uq.solid.instanceColor.setXYZ(ns, ...u.c); Uq.c2.setXYZ(ns, ...u.c2); Uq.pat.setX(ns++, u.pat); }
        // (near: its frame, its shaft and its handle — further off they are less than a pixel)
        if (a.d < 40) {
          const fc = clear ? [0.82, 0.85, 0.9] : [0.16, 0.16, 0.18], hc = clear ? [0.93, 0.94, 0.95] : u.c[0] + u.c[1] + u.c[2] > 2.2 ? [0.2, 0.2, 0.22] : [0.32, 0.22, 0.14];
          Uq.frame.setMatrixAt(nf, M); Uq.frame.instanceColor.setXYZ(nf, ...fc);
          M.compose(T, qa, P.set(1, L, 1)); Uq.stick.setMatrixAt(nf, M); Uq.stick.instanceColor.setXYZ(nf, ...fc);
          M.compose(G, qa, one); Uq.handle.setMatrixAt(nf, M); Uq.handle.instanceColor.setXYZ(nf++, ...hc);
        }
      }
      q.identity(); v.set(a.x, y + 0.01, a.z); M.compose(v, q, sc); this.shadows.setMatrixAt(sh++, M);
    }
    const U2 = this.umbrellas; U2.vinyl.count = nv; U2.solid.count = ns; U2.frame.count = U2.stick.count = U2.handle.count = nf;
    for (const m of [U2.vinyl, U2.solid, U2.frame, U2.stick, U2.handle]) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
    U2.c2.needsUpdate = U2.pat.needsUpdate = true;
    this.shadows.count = sh; this.shadows.instanceMatrix.needsUpdate = true;
  }
}
const UP = new THREE.Vector3(0, 1, 0);

// skinning from the bone picture: each bone's matrix three texels (its rows); the in-between of two frames only
// for those near the camera (far off the nearer frame does)
const SKIN_GLSL = /* glsl */`
  attribute vec4 aSkinI, aSkinW; attribute vec3 aAnim;
  void addBone(inout mat4 S, float i, float wt, int f){
    if (wt <= 0.0) return;
    int x = int(i) * 3;
    vec4 r0 = texelFetch(uBones, ivec2(x, f), 0), r1 = texelFetch(uBones, ivec2(x + 1, f), 0), r2 = texelFetch(uBones, ivec2(x + 2, f), 0);
    S += mat4(r0.x, r1.x, r2.x, 0.0, r0.y, r1.y, r2.y, 0.0, r0.z, r1.z, r2.z, 0.0, r0.w, r1.w, r2.w, 1.0) * wt;
  }
  mat4 skinAt(int f){ mat4 S = mat4(0.0); addBone(S, aSkinI.x, aSkinW.x, f); addBone(S, aSkinI.y, aSkinW.y, f); addBone(S, aSkinI.z, aSkinW.z, f); addBone(S, aSkinI.w, aSkinW.w, f); return S; }
  void skinned(out vec3 wp, out vec3 wn){
    float F = ${CLIP_F}.0, f0 = floor(aAnim.y + 0.5) * F, fr = aAnim.x - f0;   // (aAnim: the frame, which clip — walk, stand, talk, sit)
    int a = int(floor(fr)), b = int(mod(floor(fr) + 1.0, F)); float k = fract(fr);
    vec3 at = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    mat4 S = skinAt(int(f0) + a);
    if (distance(at, cameraPosition) < 18.0) S = S * (1.0 - k) + skinAt(int(f0) + b) * k;
    vec4 p = S * vec4(position, 1.0);
    wp = (modelMatrix * instanceMatrix * p).xyz;
    wn = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * mat3(S) * normal);
  }
`;
// the same pieces for the drawn line's record (ink.js): facing and distance, from the same skinning
// (the hats: on SHIBUYA SKY's roof bags, hats, scarves are left in the lockers below — those up there are drawn without)
const HAT = /^(Knit|Cap|Hat|HatBand)$/;
function crowdND(src, boneTex) {
  const map = src.map || null;
  return new THREE.ShaderMaterial({
    name: 'crowd-nd', side: THREE.DoubleSide, defines: { ...(map ? { MAP: 1 } : {}), ...(HAT.test(src.name || '') ? { HAT: 1 } : {}) },
    uniforms: { uBones: { value: boneTex }, uMap: { value: map }, uAlpha: { value: Math.max(0.3, src.alphaTest || 0.3) } },
    vertexShader: `uniform sampler2D uBones; varying vec3 vNv; varying float vZ; varying vec2 vUv;
      ${SKIN_GLSL}
      void main(){
        #ifdef HAT
          if (aAnim.z >= 2.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
        #endif
        vUv = uv; vec3 wp, wn; skinned(wp, wn); vec4 mv = viewMatrix * vec4(wp, 1.0); vZ = -mv.z; vNv = normalize((viewMatrix * vec4(wn, 0.0)).xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D uMap; uniform float uAlpha; varying vec3 vNv; varying float vZ; varying vec2 vUv;
      void main(){
        #ifdef MAP
          if (texture2D(uMap, vUv).a < uAlpha) discard;
        #endif
        vec3 n = normalize(vNv); if (!gl_FrontFacing) n = -n; gl_FragColor = vec4(n, vZ); }`,
  });
}
// a piece of a character, drawn instanced and skinned from the bone picture; lit as the street is
function crowdMaterial(src, boneTex) {
  const map = src.map || null, color = (src.color || new THREE.Color(1, 1, 1)).clone(), vcol = !!src.vertexColors;
  const cloth = /Tops|Bottoms|Puffer|Jacket|Coat|Skirt|Onepiece|Shoes|Beanie|Hat|Scarf/i.test(src.name || '') && !/SKIN|Face|HAIR|EYE/i.test(src.name || '');   // (clothes: each copy of a character its own colours of them)
  const hat = HAT.test(src.name || '');
  const m = new THREE.ShaderMaterial({
    name: 'crowd', side: src.side === THREE.DoubleSide ? THREE.DoubleSide : THREE.FrontSide, defines: { ...(map ? { MAP: 1 } : {}), ...(vcol ? { VCOL: 1 } : {}), ...(cloth ? { CLOTH: 1 } : {}), ...(hat ? { HAT: 1 } : {}) },
    uniforms: { ...U, uMap: { value: map }, uColor: { value: color }, uBones: { value: boneTex }, uAlpha: { value: Math.max(0.3, src.alphaTest || 0.3) } },
    vertexShader: /* glsl */`
      #ifdef VCOL
        attribute vec3 color;
      #endif
      uniform sampler2D uBones; varying vec2 vUv; varying vec3 vN, vW, vC; varying float vVar;
      ${SKIN_GLSL}
      void main(){
        #ifdef HAT
          if (aAnim.z >= 2.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }   // (taken off: no hats on the roof)
        #endif
        vUv = uv; vVar = aAnim.z;
        #ifdef VCOL
          vC = color;
        #else
          vC = vec3(1.0);
        #endif
        vec3 wp, wn; skinned(wp, wn);
        vec4 w = vec4(wp, 1.0); vW = wp; vN = wn;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      ${GLSL_COMMON}
      uniform sampler2D uMap; uniform vec3 uColor; uniform float uAlpha; varying vec2 vUv; varying vec3 vN, vW, vC; varying float vVar;
      void main(){
        vec4 t = vec4(1.0);
        #ifdef MAP
          t = texture2D(uMap, vUv);
        #endif
        if (t.a < uAlpha) discard;
        vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
        vec3 base = t.rgb * uColor * vC;
        #ifdef CLOTH
        { // (the same coat in another colour, a little lighter or darker: the hue turned in YIQ, which keeps its lightness)
          // (a third of them as dressed — the outfits were made from pictures — the rest varied)
          float vv = fract(vVar), on = step(0.35, vv), a = on * (fract(vv * 3.7) - 0.5) * 2.4, cs = cos(a), sn = sin(a);
          vec3 yiq = vec3(dot(base, vec3(0.299, 0.587, 0.114)), dot(base, vec3(0.596, -0.274, -0.322)), dot(base, vec3(0.211, -0.523, 0.312)));
          yiq.yz = mat2(cs, sn, -sn, cs) * yiq.yz; yiq.x *= 1.0 + on * (0.4 * fract(vv * 7.31) - 0.2);
          base = max(vec3(yiq.x + 0.956 * yiq.y + 0.621 * yiq.z, yiq.x - 0.272 * yiq.y - 0.647 * yiq.z, yiq.x - 1.106 * yiq.y + 1.703 * yiq.z), 0.0);
        }
        #endif
        float lum = dot(base, vec3(0.299, 0.587, 0.114));
        base = mix(base, vec3(0.42, 0.45, 0.55), 0.18 * (1.0 - smoothstep(0.0, 0.25, lum)));   // (black cloth kept just off black: its folds still read)
        // the character's light: the street's, lifted (faces and clothes read in the dark), in two tones; and the rim of
        // light round the figure that night scenes in anime give everyone, cool from the sky, warm where the shops are
        vec3 V = normalize(cameraPosition - vW);
        vec3 L = toonLight(n, vW) * 1.35 + vec3(0.04, 0.045, 0.065);
        float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0) * smoothstep(-0.2, 0.4, n.y + 0.3);
        vec3 rimC = vec3(0.35, 0.42, 0.7) * 0.55 + streetLight(vW, n) * 0.8;
        vec3 c = base * L + rimC * rim * 0.55;
        gl_FragColor = vec4(fogIt(c, vW), 1.0);
      }`,
  });
  if (map) { map.colorSpace = THREE.SRGBColorSpace; }
  return m;
}

function healNormals(root) {
  const c = new THREE.Vector3(), v = new THREE.Vector3();
  root.traverse(o => {
    const N = o.isMesh && o.geometry.attributes.normal, P = N && o.geometry.attributes.position; if (!N) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); c.copy(o.geometry.boundingSphere.center);
    for (let i = 0; i < N.count; i++) { const x = N.getX(i), y = N.getY(i), z = N.getZ(i); if (x * x + y * y + z * z > 1e-8 && isFinite(x + y + z)) continue; v.fromBufferAttribute(P, i).sub(c); if (v.lengthSq() < 1e-10) v.set(0, 0, 1); v.normalize(); N.setXYZ(i, v.x, v.y, v.z); }
    N.needsUpdate = true;
  });
}
function gaitSpeed(vrm, clip) {
  const mm = new THREE.AnimationMixer(vrm.scene), a = mm.clipAction(clip); a.play();
  const foot = vrm.humanoid.getNormalizedBoneNode('leftFoot'), N = 60, ys = [], zs = [];
  for (let i = 0; i < N; i++) { a.time = clip.duration * i / N; mm.update(0); vrm.scene.updateMatrixWorld(true); const w = foot.getWorldPosition(new THREE.Vector3()); ys.push(w.y); zs.push(w.z); }
  a.stop(); mm.uncacheRoot(vrm.scene); vrm.humanoid.resetNormalizedPose();
  const ymin = Math.min(...ys); let sum = 0, cnt = 0;
  for (let i = 0; i < N; i++) if (ys[i] < ymin + 0.025) { const dz = zs[(i + 1) % N] - zs[i]; if (Math.abs(dz) < 0.2) { sum += -dz / (clip.duration / N); cnt++; } }
  return cnt && sum > 0.1 ? sum / cnt : 1.2;
}
