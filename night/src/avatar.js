// You, as an anime character: a VRoid model (VRM) — your own, made in VRoid Studio (assets/avatar/me.vrm), or a
// placeholder until then — moving with real motion, not formulas: captured clips (Quaternius' Universal Animation
// Library: idle, walk, jog; and a man's walk from Mixamo, when it is there, in place of the library's)
// retargeted onto the VRM's humanoid bones and
// blended by speed, the stride timed to the ground so the feet don't slide; it eases into a walk and out of it,
// leans into turns, shuffles as it turns on the spot, turns its head to where you look, blinks; its hair and
// clothes swing on their own spring bones. Lit by the town's own light where it stands — the sky, the moon, the
// windows and lamps nearby (read from the town's light map) — through three.js lights that only the
// character sees (the town's own materials ignore them), so the lighting of the town is untouched.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { U } from './materials.js';
import { shadowDecal } from './hero.js';
import { dress } from './outfit/index.js';
import { Moves } from './moves.js';
import { san, SMAP, XMAP, retarget, restOf } from './retarget.js';

export class Avatar {
  static async load(scene, url, animUrl, walkUrl, moveUrls = null, runUrl = null) {
    const loader = new GLTFLoader(), fbx = u => new FBXLoader().loadAsync(u).catch(() => null); loader.register(p => new VRMLoaderPlugin(p));
    const keys = moveUrls ? Object.keys(moveUrls) : [];
    const [gv, ga, gw, gr, ...gm] = await Promise.all([loader.loadAsync(url), new GLTFLoader().loadAsync(animUrl), walkUrl ? fbx(walkUrl) : null, runUrl ? fbx(runUrl) : null, ...keys.map(k => fbx(moveUrls[k]))]);
    const moves = keys.length && gm.every(Boolean) ? Object.fromEntries(keys.map((k, i) => [k, gm[i]])) : null;
    return new Avatar(scene, gv.userData.vrm, ga, gw, moves, gr);
  }
  constructor(scene, vrm, lib, walk = null, moves = null, run = null) {
    this.vrm = vrm; this.scene = scene;
    VRMUtils.removeUnnecessaryVertices(vrm.scene); if (VRMUtils.combineSkeletons) VRMUtils.combineSkeletons(vrm.scene);
    VRMUtils.rotateVRM0(vrm);                                         // (a VRM 0.x model faces -z; turned to face +z like everything here)
    vrm.scene.traverse(o => { if (o.isMesh) { o.frustumCulled = false; o.castShadow = false; } });
    this.root = new THREE.Group(); this.root.add(vrm.scene); scene.add(this.root);
    this.root.rotation.order = 'YXZ';
    // the library's rest: its T-pose clip, posed on its own rig
    const src = lib.scene, clips = Object.fromEntries(lib.animations.map(c => [c.name, c]));
    const m0 = new THREE.AnimationMixer(src); m0.clipAction(clips.A_TPose).play(); m0.update(0); src.updateMatrixWorld(true);
    const rest = restOf(src, SMAP);
    const srcHips = src.getObjectByName(san('DEF-hips')).getWorldPosition(new THREE.Vector3()).y;
    vrm.scene.updateMatrixWorld(true);
    const hips = vrm.humanoid.getNormalizedBoneNode('hips').getWorldPosition(new THREE.Vector3()).y;
    const hipsScale = hips / srcHips; this.height = vrm.humanoid.getNormalizedBoneNode('head').getWorldPosition(new THREE.Vector3()).y + 0.12;
    // the walk: a man's, from Mixamo (its rig rests in a T-pose as loaded), when it is there
    const mixWalk = walk && walk.animations.length ? (() => {
      const r = restOf(walk, XMAP), h0 = walk.getObjectByName(san('mixamorig:Hips')).getWorldPosition(new THREE.Vector3()).y;
      return skip => { const c = retarget(walk.animations[0], r, vrm, hips / h0, skip, XMAP); c.name = 'Walk_Loop'; return c; };
    })() : null;
    // the run: a man's too, from Mixamo (the library's jog read as a girl's), in place
    const mixRun = run && run.animations.length ? (() => {
      const r = restOf(run, XMAP), h0 = run.getObjectByName(san('mixamorig:Hips')).getWorldPosition(new THREE.Vector3()).y;
      return skip => { const c = retarget(run.animations[0], r, vrm, hips / h0, skip, XMAP); c.name = 'Jog_Fwd_Loop'; return c; };
    })() : null;
    const R = (name, skip) => name === 'Walk_Loop' && mixWalk ? mixWalk(skip) : name === 'Jog_Fwd_Loop' && mixRun ? mixRun(skip) : retarget(clips[name], rest, vrm, hipsScale, skip);
    this.mixer = new THREE.AnimationMixer(vrm.scene);
    const act = (clip, loop = true) => { const a = this.mixer.clipAction(clip); a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity); a.play(); a.setEffectiveWeight(0); return a; };
    const LOCO = ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop'];
    this.full = LOCO.map(n => act(R(n)));
    for (const a of this.full) a.timeScale = 0;                      // (the locomotion clips are driven by distance walked, not by the clock)
    this.full[0].timeScale = 1;
    // how fast each gait really goes. For the walk, the speed of the planted foot sliding back under the hips;
    // for the jog (its contact too brief to read) the same ratio of ground covered to the foot's reach
    const measure = c => {
      const mm = new THREE.AnimationMixer(vrm.scene), a = mm.clipAction(c); a.play();
      const foot = vrm.humanoid.getNormalizedBoneNode('leftFoot'), N = 60, ys = [], zs = [];
      for (let i = 0; i < N; i++) { a.time = c.duration * i / N; mm.update(0); vrm.scene.updateMatrixWorld(true); const w = foot.getWorldPosition(new THREE.Vector3()); ys.push(w.y); zs.push(w.z); }
      a.stop(); mm.uncacheRoot(vrm.scene);
      const ymin = Math.min(...ys); let sum = 0, cnt = 0;
      for (let i = 0; i < N; i++) if (ys[i] < ymin + 0.025) { const dz = zs[(i + 1) % N] - zs[i]; if (Math.abs(dz) < 0.2) { sum += -dz / (c.duration / N); cnt++; } }
      return { contact: cnt ? sum / cnt : 0, reach: Math.max(...zs) - Math.min(...zs), dur: c.duration, front: zs.indexOf(Math.max(...zs)) / N };
    };
    const gait = this.full.map((a, i) => (i ? measure(a.getClip()) : null));
    // (the jog's ratio comes from the library's own walk, the same mover's, even when the walk is Mixamo's)
    const g1 = mixWalk ? measure(retarget(clips.Walk_Loop, rest, vrm, hipsScale)) : gait[1], kG = g1.contact * g1.dur / g1.reach;
    this.clipSpeed = gait.map((g, i) => (!g ? 0 : i === 1 ? g.contact : kG * g.reach / g.dur));
    this.walkSpeed = this.clipSpeed[1] * 1.15; this.runSpeed = this.clipSpeed[2] * 1.2;   // (what the legs do well: a little faster than the clip, no more)
    this.stepLen = [this.clipSpeed[1] * gait[1].dur / 2, this.clipSpeed[2] * gait[2].dur / 2, (this.walkSpeed + this.runSpeed) / 2];   // (the footsteps' sound keeps time with the feet)
    this.cycle = this.full.map(a => a.getClip().duration);
    this.off = gait.map(g => (g ? g.front : 0));                   // (the two gaits' cycles start where the left foot is furthest forward, so they blend step for step)
    // the one-off moves between the gaits — a turn on the spot, setting off, coming to a stop (Mixamo's, moves.js)
    if (moves) {
      const hipsOf = f => f.getObjectByName(san('mixamorig:Hips')).getWorldPosition(new THREE.Vector3()).y;
      this.moves = new Moves(this, moves, (clip, f, skip) => retarget(clip, restOf(f, XMAP), vrm, hips / hipsOf(f), skip, XMAP), hips / hipsOf(moves.start));
    }
    vrm.humanoid.resetNormalizedPose();
    // the shadows (the same as the old figure's)
    this.shadow = shadowDecal(); this.shadow.material.uniforms.uLen.value = this.height / 0.464; scene.add(this.shadow);
    // lights only the character sees
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1); this.moon = new THREE.DirectionalLight(0xffffff, 1); this.warm = new THREE.DirectionalLight(0xffffff, 1);
    for (const l of [this.hemi, this.moon, this.warm]) scene.add(l);
    scene.add(this.moon.target, this.warm.target);
    this.pos = new THREE.Vector3(); this.face = 0; this.lean = 0; this.pitch = 0; this.sp = 0; this.phase = 0; this.look = 0; this.angV = 0;
    this.inRoom = false; this.shown = true; this.breathT = 1.5; this.blinkT = 2; this.blink = 0;
    this.mouth = new THREE.Object3D(); scene.add(this.mouth);
    // a character with its own outfit on top of what VRoid made (by its name in the VRM)
    dress(this);
    this.MOON = new THREE.Vector2(0.78, -0.46).normalize();
    this._v = new THREE.Vector3(); this._w = new THREE.Vector3(); this._q = new THREE.Quaternion(); this._l = [0, 0, 0]; this._lx = [0, 0, 0]; this._lz = [0, 0, 0]; this._c1 = new THREE.Color();
  }
  setLight(sample) { this.sample = sample; }                        // (x, z) => warm light there, from the town's light map
  place(x, y, z, face) { this.pos.set(x, y, z); if (face !== undefined) this.face = face; this.sp = 0; this.reset = true; this.moves?.reset(); }
  set visible(v) { this.shown = v; this.root.visible = v; this.shadow.visible = v; }
  setRoom(on) { if (on && !this.inRoom) this.onEnter?.(); this.inRoom = on; this.shadow.material.uniforms.uLen.value = on ? 0 : this.height / 0.464; }
  update(dt, t, dist, speed, want, lookYaw, breathe) {
    const vrm = this.vrm, h = vrm.humanoid;
    // speed eases (the body takes a moment to get going and to stop); facing turns at a body's pace, and leans into it
    const spNow = dt > 0 ? dist / dt : 0;
    this.sp += (spNow - this.sp) * Math.min(1, dt * (spNow > this.sp ? 6 : 8));
    const f0 = this.face;
    // a one-off move, if one is due (a turn on the spot turns the body itself)
    const mw = this.moves ? this.moves.update(dt, want, speed > this.walkSpeed * 1.2) : 0, turning = this.moves?.mode === 'turn';
    if (want !== null && !turning) { const d = Math.atan2(Math.sin(want - this.face), Math.cos(want - this.face)), maxT = (this.sp > 2 ? 5 : 7.5) * dt; this.face += THREE.MathUtils.clamp(d * Math.min(1, dt * 10), -maxT, maxT); }
    const angV = dt > 0 ? (this.face - f0) / dt : 0; this.angV += (angV - this.angV) * Math.min(1, dt * 8);
    this.lean += (THREE.MathUtils.clamp(-this.angV * this.sp * 0.045, -0.22, 0.22) - this.lean) * Math.min(1, dt * 6);
    // the gait: idle → walk → jog by speed; the walk and jog share one phase, advanced by distance (no sliding feet)
    const [, vW, vJ] = this.clipSpeed, [, dW, dJ] = this.cycle;
    const turnShuffle = turning ? 0 : Math.min(0.5, Math.abs(this.angV) * 0.18) * (this.sp < 0.4 ? 1 : 0);
    const s = Math.max(this.sp, turnShuffle * vW);
    let wI, wW, wJ;
    if (s < vW) { wW = THREE.MathUtils.smoothstep(s, 0, vW); wI = 1 - wW; wJ = 0; } else { wJ = THREE.MathUtils.smoothstep(s, vW * 1.1, vJ * 0.95); wW = 1 - wJ; wI = 0; }
    const rate = wW * (s / (vW * dW)) + wJ * (s / (vJ * dJ)) + wI * 0;
    this.phase = (this.phase + dt * Math.max(rate, wW > 0.01 ? 0.25 : 0)) % 1;
    const W = [wI, wW, wJ].map(w => w * (1 - mw));
    this.moves?.apply();
    this.full.forEach((a, i) => { a.setEffectiveWeight(W[i]); if (i) a.time = (this.phase + this.off[i]) % 1 * this.cycle[i]; });
    this.mixer.update(dt);
    // on top of the clips: the head turns to where you look (the neck takes some), a little forward lean into a run
    const want2 = Math.atan2(Math.sin(lookYaw - this.face), Math.cos(lookYaw - this.face)), lw = Math.abs(want2) < 2.0 ? THREE.MathUtils.clamp(want2, -0.7, 0.7) : 0;
    this.look += (lw - this.look) * Math.min(1, dt * 3);
    const yA = new THREE.Vector3(0, 1, 0);
    h.getNormalizedBoneNode('neck')?.quaternion.premultiply(this._q.setFromAxisAngle(yA, this.look * 0.35));
    h.getNormalizedBoneNode('head')?.quaternion.premultiply(this._q.setFromAxisAngle(yA, this.look * 0.45));
    this.pose2?.(h, dt);                                               // (anything else over the clips: brushing the snow off, herosnow.js)
    // blinking
    if ((this.blinkT -= dt) < 0) { this.blinkT = 2.5 + Math.random() * 3; this.blink = 0.16; }
    if (this.blink > 0) this.blink -= dt;
    vrm.expressionManager?.setValue('blink', this.blink > 0 ? Math.sin(Math.max(0, this.blink) / 0.16 * Math.PI) : 0);
    // the body in the world
    this.root.position.copy(this.pos); this.root.rotation.set(0.04 * wJ, this.face, this.lean);
    if (this.reset) { this.root.updateMatrixWorld(true); vrm.springBoneManager?.reset(); this.reset = false; }
    vrm.update(dt);
    this.root.updateMatrixWorld(true);
    // breath in the cold, from in front of the face
    const head = h.getRawBoneNode('head'); head.getWorldPosition(this._v);
    this.mouth.position.copy(this._v); this.mouth.rotation.set(0, this.face, 0); this.mouth.updateMatrixWorld();
    if ((this.breathT -= dt) < 0) { this.breathT = wJ > 0.5 ? 1.0 + Math.random() * 0.3 : wW > 0.5 ? 2.2 + Math.random() * 0.8 : 3.0 + Math.random(); if (breathe && !this.inRoom) breathe({ head: this.mouth }); }
    // the light on the character: the night sky and the ground's glow, the moon, the warm light of the windows and
    // lamps where it stands (from their direction) — or, in a room, the room's warm lamplight
    const k = 9.0;
    if (this.inRoom && this.roomLight) {
      // (another room's own light, as main.js gives it: SHIBUYA SKY's black gallery, its tunnel)
      const R = this.roomLight;
      this.hemi.color.setRGB(...R.hemi); this.hemi.groundColor.setRGB(...R.gnd); this.hemi.intensity = R.k;
      this.moon.color.setRGB(...R.key); this.moon.intensity = R.keyK; this.moon.position.set(this.pos.x + (R.dir?.[0] || 0) * 6, this.pos.y + 6, this.pos.z + (R.dir?.[1] || 0) * 6); this.moon.target.position.copy(this.pos); this.warm.intensity = 0;
    } else if (this.inRoom) {
      // (a Tokyo convenience store: rows of white ceiling light, the pale floor throwing it back up — bright, even, cool)
      this.hemi.color.setRGB(0.92, 0.95, 1.0); this.hemi.groundColor.setRGB(0.55, 0.56, 0.56); this.hemi.intensity = 1.35;
      this.moon.color.setRGB(1, 1, 1); this.moon.intensity = 0.55; this.moon.position.set(this.pos.x, this.pos.y + 6, this.pos.z + 0.5); this.moon.target.position.copy(this.pos); this.warm.intensity = 0;
    } else {
      // the night street: a cool, even light from the sky and the lit city all round, a little from the wet ground, and
      // over it the colour of the shop fronts and screens where you stand (the light map), from their side
      // (the colours from the time of day, timeofday.js; at sunset the key is the sun, low and gold, and among the
      // buildings at street level only a little of it gets through, as for the city's own surfaces)
      const LS = this.lightSet || { hemi: [0.36, 0.4, 0.55], gnd: [0.2, 0.18, 0.26], hemiK: 0.85, key: [0.36, 0.4, 0.52], keyK: 1.0 };
      const kh = U.uKeyH.value, reach = kh.x + (1 - kh.x) * THREE.MathUtils.smoothstep(this.pos.y + 1.2, kh.y, kh.z);
      this.hemi.color.setRGB(...LS.hemi); this.hemi.groundColor.setRGB(...LS.gnd); this.hemi.intensity = LS.hemiK;
      this.moon.color.setRGB(...LS.key); this.moon.intensity = LS.keyK * (this.sunK ?? reach);
      this.moon.position.copy(this.pos).addScaledVector(U.uMoonDir.value, 10); this.moon.target.position.copy(this.pos);
      if (this.sample) {
        const smp = this.pos.y > 20 ? (this.roofSample || ((x, z, o) => o.fill(0))) : this.sample;   // (on the roof, the roof's own lamps)
        const L = smp(this.pos.x, this.pos.z, this._l), Lx = smp(this.pos.x + 0.6, this.pos.z, this._lx), Lz = smp(this.pos.x, this.pos.z + 0.6, this._lz);
        const lum = a => (a[0] + a[1] + a[2]) / 3, l0 = lum(L), gx = lum(Lx) - l0, gz = lum(Lz) - l0, gl = Math.hypot(gx, gz);
        const lk = 1 / (1 + (L[0] + L[1] + L[2]) / 3 * U.uLightK.value);   // (held back as the snow's is, materials.js: the character warm as the ground it stands on)
        this.warm.color.setRGB(L[0] * lk, L[1] * lk, L[2] * lk).multiplyScalar(1.6); this.warm.intensity = 2.0;
        this.warm.position.set(this.pos.x + (gl > 1e-4 ? gx / gl : 0) * 4, this.pos.y + 2.2, this.pos.z + (gl > 1e-4 ? gz / gl : 0) * 4); this.warm.target.position.set(this.pos.x, this.pos.y + 0.9, this.pos.z);
      }
      // a VRoid face takes light from every side alike (it is never shaded), so under a lamp the moon and the lamp
      // together would wash it out white: their sum on the character is held to what the moon alone gives, and a little
      const lc = c => (c.r + c.g + c.b) / 3, tot = lc(this.moon.color) * this.moon.intensity + (this.sample ? lc(this.warm.color) * this.warm.intensity : 0), cap = this.lightSet?.cap ?? 1.6;
      if (tot > cap) { this.moon.intensity *= cap / tot; this.warm.intensity *= cap / tot; }
    }
    // the shadows
    const sh = this.shadow; sh.position.set(this.pos.x, this.pos.y + 0.012, this.pos.z); sh.rotation.y = Math.atan2(-this.MOON.y, this.MOON.x);
    sh.material.uniforms.uWalk.value = Math.min(1, wW + wJ);
  }
}
