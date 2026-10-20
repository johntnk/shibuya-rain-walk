// The townsfolk: the twelve VRoid characters (assets/npc/npc01–12.vrm, dressed by outfit/npcs.js) out in the
// street on a December evening, in place of the old faceless figures — the same few people doing the same things:
// a young couple walking up the street side by side, two young people chatting at the market fire (one with a warm mug), a father
// pushing his little boy on a kick-sled, a woman back from the shops with her bag, an old man with his stick, an
// old lady on her way to church, an old man walking his malamute (dog/), a little girl kneeling at her snowman, a girl
// sweeping the snow from in front of the flower shop.
// Moving with captured motion (the animation library's clips, and Mixamo's walks for a man and for a woman),
// retargeted onto each one's bones; a walker's stride is timed to the ground it covers, so the feet don't slide.
// They look round at you when you come close, blink, breathe out white in the cold. Lit like you, by the lights only
// the characters see (avatar.js), so the town's own lighting is untouched. They load after the town is up: the
// street fills a moment later. Kept light: left out of the sea's mirror, not drawn or moved when out of view, and
// far off without their drawn outlines, little pieces, or the swing of hair and clothes.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { NPCS, dressNpc } from './outfit/npcs.js';
import { SMAP, XMAP, retarget, restOf, san } from './retarget.js';
import { shadowDecal } from './hero.js';
import { part } from './figure.js';
import { kickSled, shoppingBag } from './people.js';
import { loadMalamute } from './dog/malamute.js';
import { col } from './util.js';

const UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);

// who does what, and where — written as on the old straight street (x along it, z across; the market's fire pit at
// (5, 7.2), the flower shop's door at (-3.5, -3.85)) and carried onto the village as it is (Frame below): the walkers
// along Dreyers gate, those at the market round its fire, the girl at the flower shop's window
const ROLES = {
  npc01: { walk: true, x0: -60, x1: 62, x: -30, z: 1.15, speed: 0.95 },                       // the couple, side by side
  npc02: { walk: true, with: 'npc01', z: 1.62 },
  npc03: { stand: true, at: 'market', x: 3.7, z: 6.15, face: 0.95, clip: 'Idle_Talking_Loop' },  // at the fire, chatting (both hands busy talking: no mug)
  npc04: { stand: true, at: 'market', x: 6.3, z: 6.05, face: -1.2, clip: 'Idle_Loop', cup: true },          // listening, her gløgg in hand
  npc05: { walk: true, x0: -50, x1: 30, x: -12, z: -0.9, speed: 1.0, clip: 'Push_Loop', sled: true },   // pushing the kick-sled
  npc06: { walk: true, x0: -20, x1: 66, x: 20, z: 1.95, speed: 1.05, bag: true },
  npc07: { walk: true, x0: -45, x1: 40, x: 5, z: -1.6, speed: 0.62, clip: 'Walk_Formal_Loop', stick: true },
  npc08: { walk: true, x0: 66, x1: 80, x: 70, z: -0.4, speed: 0.7, clip: 'Walk_Formal_Loop' },    // to church
  npc09: { walk: true, x0: 8, x1: 64, x: 40, z: 2.05, speed: 0.95, dog: true },
  npc10: { ride: 'npc05', clip: 'Sitting_Idle_Loop' },                                          // on the sled
  npc11: { stand: true, at: 'market', x: 9.15, z: 5.85, face: 0.17, clip: 'Fixing_Kneeling', snowman: [9.55, 6.35] },
  npc12: { stand: true, at: 'flower', x: -3.3, z: -3.0, face: -Math.PI / 2, clip: 'Idle_Loop', sweep: true },  // sweeping before the flower shop's window (clear of the candle lantern on its step, whose glow would wash her out)
};

// the old street's places carried onto the village: along the street (x the distance along Dreyers gate from its
// middle, z across it), or round an anchor (the market, the flower shop) as they stood round the old one
export class Frame {
  constructor(a = {}) {
    const st = a.street || [[-100, 0, 0], [100, 0, 0]]; this.pts = st; this.s = [0];
    for (let i = 1; i < st.length; i++) this.s.push(this.s[i - 1] + Math.hypot(st[i][0] - st[i - 1][0], st[i][2] - st[i - 1][2]));
    this.L = this.s[this.s.length - 1]; this.k = Math.min(1, this.L / 150); this.mid = a.mid != null ? this.s[Math.min(a.mid, this.s.length - 1)] : this.L / 2;
    const old = { market: new THREE.Matrix4().makeTranslation(5, 0, 6.6).multiply(new THREE.Matrix4().makeRotationY(Math.PI)), flower: new THREE.Matrix4().makeTranslation(-3.5, 0, -3.85) };
    this.anchor = {};
    for (const [k, M] of Object.entries(a.frames || {})) if (old[k] && M) this.anchor[k] = { M: M.clone().multiply(new THREE.Matrix4().copy(old[k]).invert()), rot: new THREE.Euler().setFromRotationMatrix(M).y - new THREE.Euler().setFromRotationMatrix(old[k]).y };
  }
  // a place on the street: { x, z, rot } (rot: how much the street there is turned from the old one's +x)
  street(x, z) {
    const s = Math.min(this.L - 0.01, Math.max(0, this.mid + x * this.k)); let i = 1; while (i < this.s.length - 1 && this.s[i] < s) i++;
    const a = this.pts[i - 1], b = this.pts[i], f = (s - this.s[i - 1]) / Math.max(1e-6, this.s[i] - this.s[i - 1]), L = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1, tx = (b[0] - a[0]) / L, tz = (b[2] - a[2]) / L;
    return { x: a[0] + (b[0] - a[0]) * f - tz * z, z: a[2] + (b[2] - a[2]) * f + tx * z, rot: Math.atan2(tx, tz) - Math.PI / 2 };
  }
  place(role, x, z) {
    const A = role.at && this.anchor[role.at];
    if (!A) return role.walk || !role.at ? this.street(x, z) : { x, z, rot: 0 };
    const v = new THREE.Vector3(x, 0, z).applyMatrix4(A.M); return { x: v.x, z: v.z, rot: A.rot };
  }
}

export class Townsfolk {
  // everyone, loaded and dressed; mat: the town's material for the things they carry; ground(x, z): the snow's height
  static async load(scene, mat, ground, breathe, frame = new Frame()) {
    const loader = new GLTFLoader(); loader.register(p => new VRMLoaderPlugin(p));
    const fbx = u => new FBXLoader().loadAsync(u).catch(() => null);
    const [lib, wm, ww, dog, ...vrms] = await Promise.all([new GLTFLoader().loadAsync('./assets/anim/ual-standard.glb'), fbx('./assets/anim/mixamo-walk-male.fbx'), fbx('./assets/anim/mixamo-walk-female.fbx'),
      loadMalamute().catch(e => { console.error('malamute', e); return null; }),
      ...NPCS.map(s => loader.loadAsync(`./assets/npc/${s.id}.vrm`).then(g => g.userData.vrm).catch(() => null))]);
    return new Townsfolk(scene, mat, ground, breathe, lib, { m: wm, f: ww }, vrms, dog, frame);
  }
  constructor(scene, mat, ground, breathe, lib, walks, vrms, dog = null, frame = new Frame()) {
    this.scene = scene; this.ground = ground; this.breathe = breathe; this.list = []; this.malamute = dog; this.where = frame;
    const clips = Object.fromEntries(lib.animations.map(c => [c.name, c])), src = lib.scene;
    const m0 = new THREE.AnimationMixer(src); m0.clipAction(clips.A_TPose).play(); m0.update(0); src.updateMatrixWorld(true);
    const rest = restOf(src, SMAP), srcHips = src.getObjectByName(san('DEF-hips')).getWorldPosition(new THREE.Vector3()).y;
    const byId = {};
    NPCS.forEach((spec, i) => {
      const vrm = vrms[i], role = ROLES[spec.id]; if (!vrm || !role) return;
      VRMUtils.removeUnnecessaryVertices(vrm.scene); VRMUtils.combineSkeletons?.(vrm.scene); VRMUtils.rotateVRM0(vrm);
      vrm.scene.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; } });
      vrm.scene.updateMatrixWorld(true);
      dressNpc({ vrm }, spec); healNormals(vrm.scene);
      vrm.humanoid.resetNormalizedPose(); vrm.scene.updateMatrixWorld(true);
      const hips = vrm.humanoid.getNormalizedBoneNode('hips').getWorldPosition(new THREE.Vector3()).y, hs = hips / srcHips;
      const mix = walks[spec.sex === 'm' ? 'm' : 'f'];
      const R = name => {                                             // a clip on this one's bones (a plain walk is Mixamo's)
        if (name === 'Walk_Loop' && mix?.animations.length) { const r = restOf(mix, XMAP), h0 = mix.getObjectByName(san('mixamorig:Hips')).getWorldPosition(new THREE.Vector3()).y; return retarget(mix.animations[0], r, vrm, hips / h0, null, XMAP); }
        return retarget(clips[name], rest, vrm, hs);
      };
      const root = new THREE.Group(); root.rotation.order = 'YXZ'; root.add(vrm.scene); scene.add(root);
      const mixer = new THREE.AnimationMixer(vrm.scene), clip = R(role.clip || (role.walk ? 'Walk_Loop' : 'Idle_Loop'));
      const act = mixer.clipAction(clip); act.play(); act.time = Math.random() * clip.duration;
      const p = { id: spec.id, spec, role, vrm, root, mixer, act, clip, x: role.x ?? 0, z: role.z ?? 0, dir: 1, sface: role.face ?? Math.PI / 2, look: 0, phase: Math.random() * 6,
        breathT: 1 + Math.random() * 2, blinkT: 1 + Math.random() * 3, blink: 0, shades: !!vrm.scene.userData.shades, height: vrm.humanoid.getNormalizedBoneNode('head').getWorldPosition(new THREE.Vector3()).y + 0.12 };
      if (role.walk && !role.with) p.speed = role.speed, p.clipSpeed = gaitSpeed(vrm, clip);
      if (!role.ride) {                                               // a shadow on the snow, like yours
        p.shadow = shadowDecal(); p.shadow.material.uniforms.uLen.value = p.height / 0.464; scene.add(p.shadow);
      }
      p.mouth = new THREE.Object3D(); scene.add(p.mouth);
      this.props(p, mat, scene, R);
      this.list.push(p); byId[spec.id] = p;
    });
    for (const p of this.list) {                                      // drawn on the layer the sea's mirror leaves out (too small to matter in it, and it saves drawing them twice); the drawn outlines kept, to be put away when they're far
      p.root.traverse(o => { o.layers.set(1); });
      p.outlines = []; p.vrm.scene.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) if (m.isOutline) p.outlines.push(m); });
      if (p.dog) p.outlines.push(...p.dog.outlines);
      p.tiny = []; p.vrm.scene.traverse(o => {                        // the little made pieces (laces, buttons, studs): under a pixel from afar, each one a draw of its own
        if (!o.isMesh || !o.visible || /^(Face|Body|Hair)/.test(o.name)) return; const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
        if (g.boundingSphere.radius * o.getWorldScale(new THREE.Vector3()).x < 0.04) p.tiny.push(o);
      });
      if (!p.rider) p.root.matrixWorldAutoUpdate = false;              // (their matrices are brought up to date here, and only when they move)
      for (const o of [p.leash, p.broom, p.stick, p.cup, p.snowman, p.shadow]) o?.traverse(c => c.layers.set(1));
    }
    for (const p of this.list) {                                      // who goes with whom: the girl beside her boyfriend, the boy on his father's sled
      if (p.role.with) { p.lead = byId[p.role.with]; if (p.lead) { p.speed = p.lead.speed; p.clipSpeed = gaitSpeed(p.vrm, p.clip); } }
      if (p.role.ride && byId[p.role.ride]?.sled) { const f = byId[p.role.ride]; f.sled.add(p.root); p.root.position.set(0, 0.46, 0.64); p.rider = true; }   // (sat on the sheepskin, his legs over its front edge)
    }
    this._v = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._w = new THREE.Vector3(); this._fr = new THREE.Frustum(); this._m = new THREE.Matrix4(); this._s = new THREE.Sphere(); this.frame = 0;
  }

  // what each one has with them
  props(p, mat, scene) {
    const r = p.role, h = p.vrm.humanoid, hand = s => h.getRawBoneNode(s + 'Hand');
    if (r.cup) {                                                      // a red mug of gløgg in the right hand, held up in front
      const cup = new THREE.Group();
      cup.add(part(new THREE.CylinderGeometry(0.042, 0.036, 0.1, 14), col('#b0201a'), mat));
      cup.add(part(new THREE.TorusGeometry(0.026, 0.008, 6, 12).translate(0.05, 0, 0), col('#b0201a'), mat));   // (the handle)
      cup.add(part(new THREE.CircleGeometry(0.036, 14).rotateX(-Math.PI / 2).translate(0, 0.042, 0), col('#4a1610'), mat));   // (the dark gløgg inside)
      scene.add(cup); p.cup = cup;                                    // (set each frame just before the hand, upright: in the hand itself a sleeve hides it)
    }
    if (r.bag) { const bg = shoppingBag(mat); bg.position.set(0.04, -0.06, 0); bg.rotation.z = Math.PI / 2; hand('left').add(bg); }
    if (r.stick) {                                                    // a walking stick, from the right hand down to the snow
      const g = new THREE.Group(); g.add(part(new THREE.CylinderGeometry(0.012, 0.012, 1, 6).translate(0, -0.5, 0), col('#3a2a1e'), mat));
      g.add(part(new THREE.SphereGeometry(0.02, 8, 6).scale(1, 0.8, 1.6).translate(0, 0, 0.02), col('#3a2a1e'), mat));   // (the knob under his palm)
      scene.add(g); p.stick = g;                                      // (set each frame from his hand to the snow, as he walks)
    }
    if (r.sled) { const s = kickSled(mat, { bar: 1.13 }); s.position.set(0, 0, 0.76); p.root.add(s); p.sled = s; }   // (the handle where his pushing hands are)
    if (r.dog) {
      const d = this.malamute; if (!d) return;                         // (his malamute, a little ahead on his right, on a slack leash)
      d.root.position.set(-0.6, 0, 0.95); p.root.add(d.root); p.dog = d; p.dogBreathT = 1.5;
      const lg = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 12 }, () => new THREE.Vector3()));
      p.leash = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0x1a1410 })); p.leash.frustumCulled = false; scene.add(p.leash);
    }
    if (r.snowman) {                                                  // her snowman: three balls of snow, coal eyes and buttons, a carrot, stick arms
      const sm = new THREE.Group(), snow = col('#eef2f7'), coal = col('#1a1a1c'), [sx, sz] = r.snowman;
      const balls = [[0.26, 0.22], [0.19, 0.6], [0.14, 0.88]];
      for (const [rr, y] of balls) sm.add(part(new THREE.SphereGeometry(rr, 18, 14).scale(1, 0.92, 1).translate(0, y, 0), snow, mat));
      for (const sx2 of [-0.05, 0.05]) sm.add(part(new THREE.SphereGeometry(0.014, 6, 5).translate(sx2, 0.92, 0.125), coal, mat));
      for (const y of [0.52, 0.62, 0.72]) sm.add(part(new THREE.SphereGeometry(0.015, 6, 5).translate(0, y, 0.185), coal, mat));
      sm.add(part(new THREE.ConeGeometry(0.018, 0.11, 8).rotateX(Math.PI / 2).translate(0, 0.88, 0.18), col('#e07a1f'), mat));
      for (const s2 of [-1, 1]) sm.add(part(new THREE.CylinderGeometry(0.008, 0.006, 0.32, 5).rotateZ(s2 * 1.1).translate(s2 * 0.3, 0.68, 0), col('#4a3424'), mat));
      const ws = this.where.place(r, sx, sz), wp = this.where.place(r, p.x, p.z);
      sm.position.set(ws.x, this.ground(ws.x, ws.z), ws.z); sm.rotation.y = Math.atan2(wp.x - ws.x, wp.z - ws.z) + 0.4; scene.add(sm); p.snowman = sm;
    }
    if (r.sweep) {                                                    // a broom: a long handle in both hands, a bristle head on the snow
      const br = new THREE.Group(), wood = col('#5a4030'), bristle = col('#9c7c48'), cord = col('#6e2420');
      br.add(part(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 6).translate(0, -0.5, 0), wood, mat));
      // a besom of birch twigs: bound tight at the top, fanning out flat and ragged toward the snow
      br.add(part(new THREE.CylinderGeometry(0.028, 0.034, 0.05, 8).translate(0, -1.0, 0), cord, mat));
      const fan = new THREE.CylinderGeometry(0.03, 0.13, 0.27, 12, 3, true).scale(1, 1, 0.32).translate(0, -1.155, 0), F = fan.attributes.position;
      for (let i = 0; i < F.count; i++) { const y = F.getY(i); if (y < -1.2) F.setY(i, y - 0.03 * Math.abs(Math.sin(i * 2.7))); }   // (the ends uneven)
      br.add(part(fan, bristle, mat));
      p.broom = br; this.scene.add(br);
    }
  }

  update(dt, t, you, camera) {
    if (camera) this._fr.setFromProjectionMatrix(this._m.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    this.frame++;
    for (const p of this.list) {
      const r = p.role;
      // where they are and which way they face
      if (r.walk) {
        if (p.lead) {                                                 // (she keeps to his right whichever way they go, and turns with him)
          const off = r.z - p.lead.role.z; p.sface = p.lead.sface; p.x = p.lead.x - Math.cos(p.sface) * off; p.z = p.lead.z + Math.sin(p.sface) * off;
        } else {
          p.x += p.dir * p.speed * dt; if (p.x > r.x1) { p.x = r.x1; p.dir = -1; } if (p.x < r.x0) { p.x = r.x0; p.dir = 1; }
          const want = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2; let d = want - p.sface; d = Math.atan2(Math.sin(d), Math.cos(d));
          p.sface += d * Math.min(1, dt * 2.2);
        }
        p.act.timeScale = p.speed / (p.clipSpeed || 1.2);              // (the stride timed to the ground covered)
      }
      if (!p.placed || r.walk) { const w = this.where.place(r, p.x, p.z); p.wx = w.x; p.wz = w.z; p.face = p.sface + w.rot; p.placed = true; }   // (on the village's own street, or round its anchor)
      if (!p.rider) { p.root.position.set(p.wx, this.ground(p.wx, p.wz), p.wz); p.root.rotation.y = p.face; }
      // only those in view are drawn and moved; far off they move less often, without their drawn outlines or the
      // swing of their hair and clothes (none of it shows at that distance)
      const base = p.rider ? p.root.parent.parent : p.root, cd = camera ? camera.position.distanceTo(base.position) : 10;
      const seen = !camera || this._fr.intersectsSphere(this._s.set(this._w.copy(base.position).setY(base.position.y + 0.9), p.sled || p.dog ? 1.9 : 1.2));
      if (!p.rider) base.visible = seen;
      if (p.shadow) p.shadow.visible = seen; if (p.leash) p.leash.visible = seen; if (p.broom) p.broom.visible = seen; if (p.stick) p.stick.visible = seen; if (p.cup) p.cup.visible = seen;
      p.acc = (p.acc || 0) + dt;
      if (!seen) continue;
      const every = cd > 45 ? 3 : cd > 25 ? 2 : 1; if ((this.frame + p.spec.id.charCodeAt(4)) % every) continue;
      const back = p.acc > 0.5, step = Math.min(p.acc, 1 / 15); p.acc = 0;   // (back in view after a while: the springs start afresh, not swung by all the time away)
      const outl = cd < 18; if (p.outl !== outl) { p.outl = outl; for (const m of p.outlines) m.visible = outl; }
      const near = cd < 15; if (p.near !== near) { p.near = near; for (const o of p.tiny) o.visible = near; }
      p.mixer.update(step);
      // a look round at you when you're close, otherwise now and then about them
      const h = p.vrm.humanoid; p.root.updateMatrixWorld(true);
      this._v.copy(you).sub(p.root.getWorldPosition(this._w)); const dist = this._v.length();
      let want = dist < 6 ? Math.atan2(this._v.x, this._v.z) - (p.rider ? p.root.parent.parent.rotation.y : p.face) : 0.4 * Math.sin(t * 0.13 + p.phase) * (Math.sin(t * 0.05 + p.phase * 3) > 0.5 ? 1 : 0);
      want = Math.atan2(Math.sin(want), Math.cos(want)); want = Math.abs(want) < 2 ? THREE.MathUtils.clamp(want, -0.8, 0.8) : 0;
      p.look += (want - p.look) * Math.min(1, step * 2.5);
      h.getNormalizedBoneNode('neck')?.quaternion.premultiply(this._q.setFromAxisAngle(UP, p.look * 0.35));
      h.getNormalizedBoneNode('head')?.quaternion.premultiply(this._q.setFromAxisAngle(UP, p.look * 0.45));
      this.pose(p, t);
      if (!p.shades) {                                                // blinking (not behind dark glasses: the eyes are shut there)
        if ((p.blinkT -= step) < 0) { p.blinkT = 2.5 + Math.random() * 3.5; p.blink = 0.16; }
        if (p.blink > 0) p.blink -= step;
        p.vrm.expressionManager?.setValue('blink', p.blink > 0 ? Math.sin(Math.max(0, p.blink) / 0.16 * Math.PI) : 0);
      }
      if (!p.settled || back) { p.root.updateMatrixWorld(true); p.vrm.springBoneManager?.reset(); p.settled = true; }
      if (p.dog) p.dog.update(step, r.walk ? p.speed : 0, t, dist < 8 ? you : null);
      if (cd < 25) p.vrm.update(step); else { p.vrm.humanoid.update(); p.vrm.expressionManager?.update(); }   // (far off, the hair and clothes needn't swing)
      p.root.updateMatrixWorld(true);
      // the shadow, the breath, what they're holding
      if (p.shadow) { p.shadow.position.set(p.root.position.x, p.root.position.y + 0.012, p.root.position.z); p.shadow.rotation.y = Math.atan2(0.46, 0.78); p.shadow.material.uniforms.uWalk.value = r.walk ? 1 : 0; }
      const head = h.getRawBoneNode('head'); head.getWorldPosition(this._v);
      p.mouth.position.copy(this._v); p.mouth.rotation.set(0, p.rider ? p.root.parent.parent.rotation.y : p.face, 0); p.mouth.updateMatrixWorld();
      if ((p.breathT -= dt) < 0) { p.breathT = (r.walk ? 2.2 : 3.0) + Math.random(); this.breathe?.({ head: p.mouth }); }
      if (p.dog) {                                                    // the leash from his hand to the ring on the collar, sagging a little; the dog's breath in the cold too
        const hand = h.getRawBoneNode('rightHand').getWorldPosition(this._v), ring = p.dog.ring.getWorldPosition(this._w), pp = p.leash.geometry.attributes.position, n = pp.count;
        const sag = Math.max(0.03, 0.22 * (1.3 - hand.distanceTo(ring)));
        for (let i = 0; i < n; i++) { const f = i / (n - 1); pp.setXYZ(i, hand.x + (ring.x - hand.x) * f, hand.y + (ring.y - hand.y) * f - sag * 4 * f * (1 - f), hand.z + (ring.z - hand.z) * f); }
        pp.needsUpdate = true;
        if ((p.dogBreathT -= step) < 0) { p.dogBreathT = 1.6 + Math.random() * 1.2; this.breathe?.({ head: p.dog.snout }); }
      }
      if (p.cup) {                                                    // the mug: just out before the hand, upright, its handle to the side
        const hp = h.getRawBoneNode('rightHand').getWorldPosition(this._v);
        p.cup.position.set(hp.x + Math.sin(p.face) * 0.07, hp.y + 0.01, hp.z + Math.cos(p.face) * 0.07); p.cup.rotation.set(0, p.face + 2.2, 0);
      }
      if (p.stick) {                                                  // the stick: from his hand down to the snow a little ahead and out to the side
        const top = h.getRawBoneNode('rightHand').getWorldPosition(this._v), f = p.face;
        const tip = this._w.set(top.x + Math.sin(f) * 0.12 - Math.cos(f) * 0.07, 0, top.z + Math.cos(f) * 0.12 + Math.sin(f) * 0.07); tip.y = this.ground(tip.x, tip.z) + 0.01;
        const dir = tip.clone().sub(top), len = dir.length();
        p.stick.position.copy(top); p.stick.quaternion.setFromUnitVectors(DOWN, dir.normalize()); p.stick.scale.set(1, len, 1);
      }
      if (p.broom) {                                                  // the broom: from her hands down to the snow at her front, swept to and fro
        const a = h.getRawBoneNode('rightHand').getWorldPosition(new THREE.Vector3()), b = h.getRawBoneNode('leftHand').getWorldPosition(new THREE.Vector3());
        const grip = a.clone().lerp(b, 0.5), fwd = new THREE.Vector3(Math.sin(p.face), 0, Math.cos(p.face)), side = new THREE.Vector3(Math.cos(p.face), 0, -Math.sin(p.face));
        const foot = p.root.position.clone().addScaledVector(fwd, 0.55).addScaledVector(side, 0.28 * Math.sin(t * 2.6 + p.phase)); foot.y += 0.06;
        const dir = foot.clone().sub(grip), len = dir.length(); dir.normalize();
        p.broom.position.copy(grip); p.broom.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir); p.broom.scale.set(1, len / 1.28, 1);
      }
    }
  }

  // on top of the clip: hands holding what they hold, a stoop for the stick, the sweeper's arms and swing
  pose(p, t) {
    const h = p.vrm.humanoid, N = n => h.getNormalizedBoneNode(n), rot = (n, x, y, z) => { const b = N(n); if (b) b.quaternion.multiply(this._q.setFromEuler(this._e.set(x, y, z))); };
    if (p.cup) { rot('rightUpperArm', 0, 0, -0.25); rot('rightLowerArm', 0, 1.9, 0); rot('rightHand', 0, 0, 0.3); }   // (elbow bent, the mug up before the chest)
    if (p.role.stick) { rot('spine', 0.1, 0, 0); rot('rightLowerArm', 0, 0.35, 0); }
    if (p.role.bag) { rot('leftUpperArm', 0, 0, 0.12); rot('leftLowerArm', 0, -0.15, 0); }
    if (p.broom) {                                                    // both hands down in front on the handle, the body turning with each stroke
      const s = Math.sin(t * 2.6 + p.phase);
      rot('spine', 0.2, 0.25 * s, 0); rot('chest', 0.1, 0.1 * s, 0);
      rot('rightUpperArm', 0.0, -0.7, 0.75); rot('rightLowerArm', 0, 0.7, 0);
      rot('leftUpperArm', 0.0, 0.5, -0.95); rot('leftLowerArm', 0, -0.6, 0);
    }
  }
}

// a point of a made garment left with no facing (on a sliver of a triangle) shades as not-a-number, and the glow
// spreads that one pixel into a black square: given the way out from the middle of its piece instead
function healNormals(root) {
  const c = new THREE.Vector3(), v = new THREE.Vector3();
  root.traverse(o => {
    const N = o.isMesh && o.geometry.attributes.normal, P = N && o.geometry.attributes.position; if (!N) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); c.copy(o.geometry.boundingSphere.center); let fixed = 0;
    for (let i = 0; i < N.count; i++) {
      const x = N.getX(i), y = N.getY(i), z = N.getZ(i); if (x * x + y * y + z * z > 1e-8 && isFinite(x + y + z)) continue;
      v.fromBufferAttribute(P, i).sub(c); if (v.lengthSq() < 1e-10) v.set(0, 0, 1); v.normalize(); N.setXYZ(i, v.x, v.y, v.z); fixed++;
    }
    if (fixed) N.needsUpdate = true;
  });
}

// how fast a walk clip's feet move over the ground (m/s): the planted foot sliding back under the hips
function gaitSpeed(vrm, clip) {
  const mm = new THREE.AnimationMixer(vrm.scene), a = mm.clipAction(clip); a.play();
  const foot = vrm.humanoid.getNormalizedBoneNode('leftFoot'), N = 60, ys = [], zs = [];
  for (let i = 0; i < N; i++) { a.time = clip.duration * i / N; mm.update(0); vrm.scene.updateMatrixWorld(true); const w = foot.getWorldPosition(new THREE.Vector3()); ys.push(w.y); zs.push(w.z); }
  a.stop(); mm.uncacheRoot(vrm.scene); vrm.humanoid.resetNormalizedPose();
  const ymin = Math.min(...ys); let sum = 0, cnt = 0;
  for (let i = 0; i < N; i++) if (ys[i] < ymin + 0.025) { const dz = zs[(i + 1) % N] - zs[i]; if (Math.abs(dz) < 0.2) { sum += -dz / (clip.duration / N); cnt++; } }
  return cnt && sum > 0.1 ? sum / cnt : 1.2;
}
