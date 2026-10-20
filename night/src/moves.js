// One-off moves between the gaits, from Mixamo (for your own character): a turn on the spot, setting off from
// standing, coming to a stop; and, when you open a door, a reach for its handle and a push (the upper body only,
// over whatever the legs are doing). Each plays once, start to end, over the looping gaits. What a clip does to the
// whole body is taken out of it and handed to the body itself: a turn's swing of the hips becomes the way the
// body faces, and the ground a start or a stop covers becomes how fast the body goes (main.js follows
// hero.rootSpeed while it is set) — so the feet stay where they are put. The hand-overs to and from the walk
// cycle are made at the moment the feet are in the same places in both.
import * as THREE from 'three';

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

// a Mixamo clip with the hips' swing about the vertical (yaw) and/or their forward travel taken out; those come
// back as curves sampled at the clip's keys (radians from the first key; centimetres in the clip's own units)
export function stripRoot(clip, { yaw = false, travel = false }) {
  const c = clip.clone(), hq = c.tracks.find(t => /Hips\.quaternion$/.test(t.name)), hp = c.tracks.find(t => /Hips\.position$/.test(t.name));
  const q = new THREE.Quaternion(), r = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), up = new THREE.Vector3(0, 1, 0);
  const yawAt = new Float32Array(hq.times.length);
  for (let i = 0; i < yawAt.length; i++) { q.fromArray(hq.values, i * 4); e.setFromQuaternion(q); yawAt[i] = e.y; }
  for (let i = 1; i < yawAt.length; i++) yawAt[i] = yawAt[i - 1] + wrap(yawAt[i] - yawAt[i - 1]);   // (unwound: a turn past 180° stays continuous)
  const y0 = yawAt[0]; for (let i = 0; i < yawAt.length; i++) yawAt[i] -= y0;
  if (yaw) for (let i = 0; i < yawAt.length; i++) { r.setFromAxisAngle(up, -yawAt[i]); q.fromArray(hq.values, i * 4).premultiply(r).toArray(hq.values, i * 4); }
  const tr = new Float32Array(hp.times.length), x0 = hp.values[0], z0 = hp.values[2];
  for (let i = 0; i < tr.length; i++) {
    const k = i * 3; tr[i] = hp.values[k + 2] - z0;
    if (travel) { hp.values[k] -= x0; hp.values[k + 2] = 0; }      // (the hips stay over the spot; the body carries the travel)
    else if (yaw) {                                                   // (a turn: the hips' small drift turned back with them)
      const a = -yawAt[Math.min(i, yawAt.length - 1)], dx = hp.values[k] - x0, dz = hp.values[k + 2] - z0;
      hp.values[k] = x0 + dx * Math.cos(a) + dz * Math.sin(a); hp.values[k + 2] = z0 - dx * Math.sin(a) + dz * Math.cos(a);
    }
  }
  return { clip: c, yaw: { times: hq.times, v: yawAt }, travel: { times: hp.times, v: tr } };
}
const sample = (cur, t) => {                                           // a curve at time t (linear between keys)
  const T = cur.times, V = cur.v, n = T.length; if (t <= T[0]) return V[0]; if (t >= T[n - 1]) return V[n - 1];
  let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T[m] <= t) lo = m; else hi = m; }
  return V[lo] + (V[hi] - V[lo]) * (t - T[lo]) / (T[hi] - T[lo]);
};

export class Moves {
  // av: the Avatar (its mixer, gaits, phase); src: { turnL, turnR, start, stop, door? } as loaded FBX scenes;
  // rt(clip, scene, skip): that clip retargeted onto the character; cm: the clips' units to metres on this character
  constructor(av, src, rt, cm) {
    this.av = av; this.mode = 'loco'; this.w = 0; this.t = 0; this.cur = null; av.rootSpeed = null;
    const mk = (fbx, opt) => {
      const s = stripRoot(fbx.animations[0], opt), full = rt(s.clip, fbx, null);
      const act = c => { const a = av.mixer.clipAction(c); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.play(); a.setEffectiveWeight(0); a.timeScale = 0; return a; };
      const m = { full: act(full), dur: full.duration, yaw: s.yaw, travel: { times: s.travel.times, v: s.travel.v.map(v => v * cm) } };
      // its speed over the ground (m/s), smoothed over a few keys
      const T = m.travel.times, V = m.travel.v; m.speed = { times: T, v: new Float32Array(T.length) };
      for (let i = 0; i < T.length; i++) { const a = Math.max(0, i - 2), b = Math.min(T.length - 1, i + 2); m.speed.v[i] = Math.max(0, (V[b] - V[a]) / (T[b] - T[a])); }
      return m;
    };
    this.turnL = mk(src.turnL, { yaw: true }); this.turnR = mk(src.turnR, { yaw: true });
    this.start = mk(src.start, { travel: true }); this.stop = mk(src.stop, { travel: true });
    for (const m of [this.turnL, this.turnR]) m.total = m.yaw.v[m.yaw.v.length - 1];
    // the door: from the clip of walking up to a door and through it, only the reach for the handle and the push
    // (1.5–3.6 s), above the hips; weighed in heavily so it carries the arms and chest over the gait underneath
    if (src.door) {
      const legs = new Set(['hips', ...['left', 'right'].flatMap(s => [s + 'UpperLeg', s + 'LowerLeg', s + 'Foot', s + 'Toes'])]);
      const c = rt(src.door.animations[0], src.door, legs); c.name = 'door_reach';
      const a = av.mixer.clipAction(c); a.setLoop(THREE.LoopOnce, 1); a.clampWhenFinished = true; a.play(); a.setEffectiveWeight(0); a.timeScale = 0;
      this.door = { act: a, t0: 1.5, t1: 3.6, rate: 1.4, t: -1, w: 0 };
    }
    // setting off: from just before the first step (the clip's long gathering of weight is cut short, a game
    // can't wait for it), a little brisker than the clip; handed to the walk cycle a third of a second before its end
    { const m = this.start, V = m.travel.v, T = m.travel.times; let i = 0; while (i < V.length && V[i] < 0.04) i++; m.t0 = Math.max(0, T[i] - 0.1); m.tH = m.dur - 0.35; m.rate = 1.2; }
    // stopping: still once it has covered all but the last centimetre; held a moment more to settle
    { const m = this.stop, V = m.travel.v, T = m.travel.times, end = V[V.length - 1]; let i = 0; while (i < V.length && V[i] < end - 0.01) i++; m.tStill = T[i]; }
    // where the feet are in each: the hand-overs are matched pose to pose
    const vrm = av.vrm, h = vrm.humanoid, lf = h.getNormalizedBoneNode('leftFoot'), rf = h.getNormalizedBoneNode('rightFoot'), hp = h.getNormalizedBoneNode('hips');
    const mm = new THREE.AnimationMixer(vrm.scene), P = new THREE.Vector3(), Q = new THREE.Vector3();
    const pose = (clip, t) => { const a = mm.clipAction(clip); a.reset().play(); a.time = t; mm.update(0); vrm.scene.updateMatrixWorld(true); hp.getWorldPosition(Q); const o = []; for (const f of [lf, rf]) { f.getWorldPosition(P).sub(Q); o.push(P.x, P.y * 2, P.z); } a.stop(); return o; };
    const dist2 = (a, b) => a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0);
    const loop = av.full[1].getClip(), cyc = av.cycle[1], off = av.off[1], N = 24;
    const loopPose = []; for (let k = 0; k < N; k++) loopPose.push(pose(loop, ((k / N + off) % 1) * cyc));
    { const p = pose(this.start.full.getClip(), this.start.tH); let best = 0, bd = 1e9; loopPose.forEach((q, k) => { const d = dist2(p, q); if (d < bd) { bd = d; best = k; } }); this.start.phase = best / N; }
    this.stop.at = loopPose.map(q => { let best = 0, bd = 1e9; for (let t = 0; t < Math.min(1.4, this.stop.tStill); t += 1 / 60) { const d = dist2(pose(this.stop.full.getClip(), t), q); if (d < bd) { bd = d; best = t; } } return best; });
    mm.stopAllAction(); mm.uncacheRoot(vrm.scene); h.resetNormalizedPose();
  }
  reset() { this.mode = 'loco'; this.w = 0; this.av.rootSpeed = null; if (this.door) this.door.t = -1; }
  reach() { if (this.door) this.door.t = this.door.t0; }             // a door is being opened
  begin(mode, m, t) { this.mode = mode; this.cur = m; this.t = t; }
  end() { this.mode = 'loco'; this.av.rootSpeed = null; }
  // before the gaits are weighed: decides the move, turns the body for a turn, sets the body's speed for a start
  // or a stop. want: the way you are steering (null: no input); running: the run key is down
  update(dt, want, running) {
    const av = this.av, d = want === null ? 0 : wrap(want - av.face);
    if (this.mode === 'loco') {
      if (want !== null && av.sp < 0.2 && Math.abs(d) > 1.0) {                  // a turn on the spot first
        const m = d > 0 ? this.turnL : this.turnR; this.begin('turn', m, 0); this.face0 = av.face; this.k = d / m.total;
      } else if (want !== null && av.sp < 0.15 && !running) this.begin('start', this.start, this.start.t0);
      else if (want === null && av.sp > 0.6 && av.sp < av.walkSpeed * 1.4) {   // stepping down from a walk
        const k = Math.round(((av.phase % 1) + 1) % 1 * this.stop.at.length) % this.stop.at.length;
        this.begin('stop', this.stop, this.stop.at[k]);
      }
    }
    const m = this.cur;
    if (this.mode === 'turn') {
      this.t += dt * 1.3;
      av.face = this.face0 + sample(m.yaw, this.t) * this.k;
      av.rootSpeed = 0;
      if (this.t >= m.dur) { av.face = this.face0 + m.total * this.k; this.end(); }
    } else if (this.mode === 'start') {
      this.t += dt * m.rate; av.rootSpeed = sample(m.speed, this.t) * m.rate;
      if (this.t >= m.tH) { av.phase = m.phase; this.end(); }                // into the walk, foot for foot
      else if (want === null || running) this.end();
    } else if (this.mode === 'stop') {
      this.t += dt; av.rootSpeed = this.t < m.tStill ? sample(m.speed, this.t) : 0;
      if (want !== null || this.t > m.tStill + 0.5) this.end();
    } else if (m && this.w > 0.001) this.t = Math.min(m.dur, this.t + dt);    // (fading out: the move plays on under the gaits)
    const on = this.mode !== 'loco';
    this.w += ((on ? 1 : 0) - this.w) * Math.min(1, dt * (on ? 12 : 7));
    const dr = this.door;
    if (dr) {
      const live = dr.t >= 0 && dr.t < dr.t1; if (live) dr.t += dt * dr.rate;
      dr.w += ((live && dr.t < dr.t1 - 0.12 ? 1 : 0) - dr.w) * Math.min(1, dt * 7);
    }
    return this.w;
  }
  // the move's weight among the clips (after update)
  apply() {
    for (const m of [this.turnL, this.turnR, this.start, this.stop]) {
      const on = m === this.cur ? this.w : 0;
      m.full.setEffectiveWeight(on);
      if (on > 0) m.full.time = Math.min(this.t, m.dur - 1e-3);
    }
    const dr = this.door;
    if (dr) { dr.act.setEffectiveWeight(dr.w * 4); if (dr.w > 0) dr.act.time = Math.min(Math.max(dr.t, dr.t0), dr.t1); }   // (four to the gait's one: mostly the reach)
  }
}
