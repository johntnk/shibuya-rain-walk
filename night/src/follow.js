// The camera that follows you: behind and above, far enough back to see you in the street with the
// houses round you and the sky over them. The mouse swings it round you, the wheel brings it in or takes it
// further out — right out over the roofs, far enough to see the whole town. Close to you it never goes
// through a wall — it slides in toward you instead, and eases back out once past. Taken further out than
// that you are looking at the village, so a house between you and it no longer brings it in (that jumped the
// view in at every turn among the real village's houses): the camera rises instead, tilting to look down at you
// over the roofs until the house is out of the way, and settles back once it is; it never stands inside a
// house, and every change is eased. Never under the snow; in a room it comes in closer and stays under the ceiling.
import * as THREE from 'three';

const clamp = THREE.MathUtils.clamp;

export class Follow {
  static FAR = 240;                                                   // (the furthest out the wheel takes it: the whole town, end to end)
  static ROOFS = 16;                                                  // (higher than this over the ground, the camera's line clears every roof but the church's)
  static NEAR = 10;                                                   // (within this a wall between you and the camera brings it in; further out it doesn't)
  static KEY_LOOK = Object.freeze({ yawDegrees: 22.5, pitchDegrees: 15, acceleration: 0.16, braking: 0.08 });
  constructor(camera) {
    this.cam = camera; this.yaw = 0; this.pitch = -0.2; this.want = 4.8; this.cur = 4.8;
    this.first = false; this.free = false; this.snap = true; this.lift = 0;   // (lift: how much further down it is tilted to see you over a roof)
    this.pivot = new THREE.Vector3(); this.f = new THREE.Vector3();
    this.keyYaw = 0; this.keyPitch = 0;
  }
  // the mouse turns it: 0.0055 rad a pixel (a short flick turns you round; ?sens=2 doubles it, 0.5 halves it)
  static SENS = 0.0055 * (typeof location === 'undefined' ? 1 : Number(new URLSearchParams(location.search).get('sens')) || 1);
  turn(yaw, pitch) { this.yaw += yaw; this.pitch = clamp(this.pitch + pitch, -1.25, this.first || this.free ? 1.3 : 0.8); }
  look(dx, dy) { this.turn(-dx * Follow.SENS, -dy * Follow.SENS * 0.85); }
  // Match the Norwegian town: held arrows pan slowly, ease in and brake on release.
  // Integrating the velocity curve keeps the turn independent of frame rate and key repeat.
  resetKeyLook() { this.keyYaw = 0; this.keyPitch = 0; }
  keyTurn(axis, target, dt) {
    const velocity = this[axis], tau = target === 0 ? Follow.KEY_LOOK.braking : Follow.KEY_LOOK.acceleration;
    const decay = Math.exp(-dt / tau);
    this[axis] = target + (velocity - target) * decay;
    if (Math.abs(this[axis] - target) < 0.0001) this[axis] = target;
    return target * dt + (velocity - target) * tau * (1 - decay);
  }
  lookKeys(dt, keys) {
    if (dt <= 0) return;
    const yaw = this.keyTurn('keyYaw', (Number(!!keys.ArrowLeft) - Number(!!keys.ArrowRight)) * Follow.KEY_LOOK.yawDegrees * Math.PI / 180, dt);
    const pitch = this.keyTurn('keyPitch', (Number(!!keys.ArrowUp) - Number(!!keys.ArrowDown)) * Follow.KEY_LOOK.pitchDegrees * Math.PI / 180, dt);
    const previousPitch = this.pitch;
    this.turn(yaw, pitch);
    if (this.pitch !== previousPitch + pitch) this.keyPitch = 0;
  }
  zoom(dy) { this.want = clamp(this.want * Math.exp(dy * 0.0012), 1.6, Follow.FAR); }
  // the way the camera looks, and flat along the ground
  forward(v = this.f) { return v.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)); }
  flatForward(v) { return v.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  flatRight(v) { return v.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }
  aimAt(from, to, tilt = 0) {
    this.resetKeyLook();
    const dx = to.x - from.x, dz = to.z - from.z;
    this.yaw = Math.atan2(-dx, -dz); this.pitch = clamp(Math.atan2(to.y - from.y, Math.hypot(dx, dz)) + tilt, -1.25, 0.8);
  }
  orient() { this.cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ'); }
  // feet: where you stand; o: { blocked(x, z, ox, oz), ground(x, z), ceil (or null), indoor (how far back a room allows, or 0) }
  // returns how far the camera is from the point it looks at (to hide you when it has to come very close)
  update(dt, feet, o) {
    { const d = Math.atan2(Math.sin(this.yaw - (this._yaw0 ?? this.yaw)), Math.cos(this.yaw - (this._yaw0 ?? this.yaw))); this._yaw0 = this.yaw; this._dYaw = this.snap ? 0 : d;
      this.yawVel = this.snap || dt <= 0 ? 0 : (this.yawVel || 0) + (d / dt - (this.yawVel || 0)) * (1 - Math.exp(-dt * 12)); }   // (how fast the view is turning: for looking ahead)
    this.orient();
    // (the kombini's camera may be tilted up over its low shelves — bt — and come round you on its own bearing — by:
    // indoorBoom; anywhere else it is behind the way you look, and a tilt it still has from the kombini's door goes, eased)
    if (this.snap) { this.bt = 0; this.tiltOn = false; }
    if (!o.solid || this.first || this.free || this.snap || this.by == null) this.by = this.yaw;
    if (!o.solid && this.bt > 0) { this.bt -= Math.min(this.bt * (1 - Math.exp(-dt * 3)), 1.0 * dt); if (this.bt < 1e-4) this.bt = 0; }
    if (this.free) return 99;
    const pv = this.pivot, H = o.indoor ? 1.3 : 1.5;              // (a little above your head)
    if (this.snap) { pv.set(feet.x, feet.y + H, feet.z); this.cur = o.indoor ? Math.min(this.want, o.indoor) : this.want; }
    else {
      const kx = 1 - Math.exp(-dt * 18), ky = 1 - Math.exp(-dt * 6);    // (the stride's bob is smoothed out of the view)
      pv.x += (feet.x - pv.x) * kx; pv.z += (feet.z - pv.z) * kx; pv.y += (feet.y + H - pv.y) * ky;
    }
    if (this.first) { this.cam.position.set(feet.x, feet.y + (this.eye ?? 1.2), feet.z); this.snap = false; return 0; }
    const f = this.forward(), maxD = o.indoor ? Math.min(this.want, o.indoor) : this.want;
    if (!o.indoor && maxD > Follow.NEAR) {
      // out over the village. A house between you and the camera: tilt the line down over the roofs (the least
      // that clears them), easing; then where you asked for it, unless that is inside a house — then the nearest
      // free place along the same line, further out first
      const dir = (pt, v) => v.set(-Math.sin(this.yaw) * Math.cos(pt), Math.sin(pt), -Math.cos(this.yaw) * Math.cos(pt)), u = this._u || (this._u = new THREE.Vector3());
      const at = (x, y, z) => (o.over ? o.over(x, z, y) : o.blocked(x, z, x, z)) && y < o.ground(x, z) + Follow.ROOFS;   // (inside a house: under its roof; the cheap test first)
      const hit = (pt, dd) => { dir(pt, u); for (let k = 2; k < dd; k += 1.2 + k * 0.03) { const y = pv.y - u.y * k; if (y > pv.y + Follow.ROOFS) break; if (at(pv.x - u.x * k, y, pv.z - u.z * k)) return true; } return false; };
      let need = 0;
      if (hit(this.pitch, maxD)) for (let a = 0.06; a <= 0.9; a += 0.06) { need = a; if (this.pitch - a < -1.35 || !hit(this.pitch - a, maxD)) break; }
      this.lift = this.snap ? need : this.lift + (need - this.lift) * (1 - Math.exp(-dt * (need > this.lift ? 3.5 : 1.2)));
      dir(this.pitch - this.lift, f);
      const inside = dd => at(pv.x - f.x * dd, pv.y - f.y * dd, pv.z - f.z * dd);
      let d = maxD;
      if (inside(d)) for (let k = 0.5; k <= 16; k += 0.5) {
        if (d + k <= Follow.FAR && !inside(d + k)) { d += k; break; }
        if (d - k > Follow.NEAR * 0.6 && !inside(d - k)) { d -= k; break; }
      }
      this.cur += (d - this.cur) * (this.snap ? 1 : 1 - Math.exp(-dt * 3.5));
    } else {
      this.lift = this.snap ? 0 : this.lift * Math.exp(-dt * 3);
      // (the kombini's camera may be tilted up over its low shelves — bt — and come round you on its own bearing — by;
      // anywhere else it is behind the way you look, and a tilt it still has from the kombini's door goes, eased)
      const store = !!o.solid;
      if (this.lift > 0.002) this.forward(f).set(-Math.sin(this.yaw) * Math.cos(this.pitch - this.lift), Math.sin(this.pitch - this.lift), -Math.cos(this.yaw) * Math.cos(this.pitch - this.lift));
      // close to you: back out along the line of sight until something is in the way (once the line is up over
      // the roofs nothing is: the steps grow with the distance, so a long way out costs no more than a short one).
      // What is in the way is asked at the height the line is at (o.free, where the place gives one: over a low shelf
      // the line goes on), a fifth of a metre kept from it (the near plane).
      const free = o.free || ((x, y, z) => !o.blocked(x, z, x, z));
      const ok = (x, y, z) => (o.indoor === 0 && y > o.ground(x, z) + Follow.ROOFS) || free(x, y, z);
      const reach = (px, py, pz, fx, fy, fz) => { let d = 0; while (d < maxD) { const nd = Math.min(maxD, d + 0.08 + d * 0.03); if (!ok(px - fx * nd, py - fy * nd, pz - fz * nd)) return Math.max(0, d - 0.2); d = nd; } return maxD; };
      const now = reach(pv.x, pv.y, pv.z, f.x, f.y, f.z);
      let want = now, need = 0;                                       // (need: how fast it must come in to be clear in time)
      if (!this.snap) {
        // a moment ahead: where your walk takes you in a third of a second, where the arrows are turning the view to
        // — so it starts in before the shelf or the column is between you, not when it already is
        const ahead = (k, r) => { want = Math.min(want, r); need = Math.max(need, (this.cur - r) / k); };
        // (where you are walking — unless that is into a column or a shelf, where you will be turned aside: no warning then)
        if (o.vel) for (const k of [0.35, 0.15]) { const ax = pv.x + o.vel.x * k, az = pv.z + o.vel.z * k; if (ok(ax, pv.y, az)) { ahead(k, reach(ax, pv.y, az, f.x, f.y, f.z)); break; } }
        // (the view turning — the mouse or the arrows, whichever: how fast it has been turning, a little, a third and
        // over half a second on: a quick swing by a wall is seen coming early enough to come in without a jump)
        if (Math.abs(this.yawVel) > 0.05) for (const k of [0.15, 0.35, 0.6]) { const y2 = this.yaw + THREE.MathUtils.clamp(this.yawVel, -5, 5) * k, cp = Math.cos(this.pitch - this.lift), g = this._g || (this._g = new THREE.Vector3()); g.set(-Math.sin(y2) * cp, f.y, -Math.cos(y2) * cp); ahead(k, reach(pv.x, pv.y, pv.z, g.x, g.y, g.z)); }
      }
      if (store && !this.snap) { this.indoorBoom(dt, pv, o, maxD, now, want, need, ok, reach); }
      else {
      const was = this.cur; let why = 'steady';
      if (this.snap) { this.cur = now; this.hold = 0; why = 'snap'; }
      else if (want < this.cur - 0.01) { why = 'in';
        // in: quick but eased (a tenth of a second), never a cut — and never into anything: if where the easing has got
        // to is inside a thing, it stops short of it (that, and only that, may still move it at once). Its speed: no
        // quicker than 6 m/s, unless the view swinging by a wall needs it quicker to be clear in time (up to 12)
        let c = this.cur + Math.max((want - this.cur) * (1 - Math.exp(-dt / 0.14)), -THREE.MathUtils.clamp(need * 1.15, 6.0, 12.0) * dt);
        if (!ok(pv.x - f.x * c, pv.y - f.y * c, pv.z - f.z * c)) { c = Math.min(c, now); why = 'in, clear of a thing'; }
        this.cur = c; this.hold = 0.4;
      } else {
        // out again once clear, after a moment (no breathing in and out at an edge), slowly
        this.hold = Math.max(0, (this.hold || 0) - dt);
        if (this.hold <= 0) this.cur += (Math.min(want, now) - this.cur) * (1 - Math.exp(-dt * 1.6));
        if (!ok(pv.x - f.x * this.cur, pv.y - f.y * this.cur, pv.z - f.z * this.cur)) { this.cur = Math.min(this.cur, now); why = 'out, clear of a thing'; } else if (this.hold <= 0) why = 'out';
      }
      this.dbg = { why, was, cur: this.cur, now, want };
      }
    }
    const bt = this.bt || 0, e = this.pitch - this.lift - bt;
    if (this.lift > 0.002 || bt > 0 || this.by !== this.yaw) this.cam.rotation.set(e, this.by ?? this.yaw, 0, 'YXZ');
    if (bt > 0 || (this.by != null && this.by !== this.yaw)) { const y = this.by ?? this.yaw; f.set(-Math.sin(y) * Math.cos(e), Math.sin(e), -Math.cos(y) * Math.cos(e)); }
    const p = this.cam.position.copy(pv).addScaledVector(f, -this.cur);
    p.y = Math.max(p.y, o.ground(p.x, p.z) + 0.3);
    if (o.ceil != null) p.y = Math.min(p.y, o.ceil);
    this.snap = false;
    return p.distanceTo(pv);
  }
  get boom() { return { yaw: this.by ?? this.yaw, tilt: this.bt || 0 }; }
  // The kombini (o.solid: the things themselves, which the line from the camera to you may not pass through). Its
  // shelves are low and its aisles narrow: turned quickly between them, the line behind you ran into a shelf half a
  // metre off, and the camera was cut in at once to there, against your back (round 16's review: 2.9 m in a frame).
  // Here the camera is a thing on a boom that cannot pass through shelves: where it would have to, it comes round as
  // far as it may each frame (sliding along them) while it comes in, no quicker than 12 m/s, and up — over the low
  // shelves the room is open — and the line it looks down at you along is clear. Where you are hemmed in it stands
  // up over the shelves, further back, looking down (what main.js's lift did, now one with the rest, so the two
  // never correct each other). Every frame its new place, the way there from where it was, and the line from it to
  // you are checked; it goes where all three are clear.
  indoorBoom(dt, pv, o, maxD, now, want, need, ok) {
    const solid = o.solid, P = this.pitch - this.lift, A = this._A || (this._A = new THREE.Vector3());
    const at = (yaw, t, d, v) => { const e = P - t, c = Math.cos(e); return v.set(pv.x + Math.sin(yaw) * c * d, pv.y - Math.sin(e) * d, pv.z + Math.cos(yaw) * c * d); };
    const sees = v => { for (let j = 1; j < 40; j++) { const k = j / 40; if (solid(pv.x + (v.x - pv.x) * k, pv.y + (v.y - pv.y) * k, pv.z + (v.z - pv.z) * k)) return false; } return true; };   // (every 2.5% of the way: a line grazing a shelf's corner is caught)
    // (tilted up: the furthest it may stand before the line to you meets a thing — it may stand beyond a shelf's edge,
    // over it, where level it could not)
    const reachUp = (yaw, t) => { let best = 0; for (let d = 0.1; d <= maxD + 1e-6; d += 0.05 + d * 0.02) { at(yaw, t, d, A); if (solid(A.x, A.y, A.z)) break; if (ok(A.x, A.y, A.z)) best = d; } return Math.min(best, maxD); };
    // where it should be: level, as everywhere; hemmed in (level, less than 1.5 m behind you; until it is 1.9 again)
    // the tilt that keeps it furthest back, a tilt costing what 0.9 m a radian of distance would, and staying near
    // the tilt it has (no flicking between two)
    this.tiltOn = now < (this.tiltOn ? 1.9 : 1.5);
    // (looking ahead it may start in early, as everywhere — but here not nearer than 1.1 m for it: the boom comes round and up the rest)
    const bt0 = this.bt || 0; let tT = 0, dT = Math.max(want, Math.min(now, 1.1)), nT = now;
    if (this.tiltOn) {
      let best = now - 0.3 * bt0;
      for (let t = 0.1; t <= 1.101; t += 0.1) { const d = reachUp(this.yaw, t), sc = d - 0.9 * t - 0.3 * Math.abs(t - bt0); if (sc > best) { best = sc; tT = t; dT = nT = d; } }
    }
    const was = this.cur, lagging = Math.abs(Math.atan2(Math.sin(this.yaw - this.by), Math.cos(this.yaw - this.by))) > 0.15;   // (swinging round behind you: in as quick as it may)
    let why = 'steady', c = this.cur;
    if (dT < c - 0.01) { why = 'in'; c += Math.max((dT - c) * (1 - Math.exp(-dt / 0.14)), -THREE.MathUtils.clamp((lagging ? 99 : need) * 1.15, 6.0, 12.0) * dt); this.hold = 0.4; }
    else { this.hold = Math.max(0, (this.hold || 0) - dt); if (this.hold <= 0) { c += (Math.min(dT, nT) - c) * (1 - Math.exp(-dt * 1.6)); why = 'out'; } }
    let t = bt0; { const e = tT - t, k = e * (1 - Math.exp(-dt * 8)); t += e > 0 ? Math.min(k, 3.5 * dt) : Math.max(k, -1.0 * dt); }
    // from where it was: its new place clear, the way there clear, the line from it to you clear
    const prev = (this._prevP || (this._prevP = new THREE.Vector3())).copy(this.cam.position);   // (where it was last frame, all said and done)
    // (its new place with the camera's own margins; the way there through nothing itself — a shelf or a fridge, a wall:
    // what is drawn is where it is each frame, so passing within a margin on the way does not show, passing through
    // a thing would)
    const good = (yaw, tt, cc) => { at(yaw, tt, cc, A); if (!ok(A.x, A.y, A.z) || !sees(A)) return false; const L = A.distanceTo(prev), n = Math.ceil(L / 0.04);
      for (let j = 1; j < n; j++) { const k = j / n; if (solid(prev.x + (A.x - prev.x) * k, prev.y + (A.y - prev.y) * k, prev.z + (A.z - prev.z) * k)) return false; } return true; };
    // how far round it goes this frame: with you as you turn (as quick as you turn it, as everywhere); behind you,
    // catching up, no quicker than 12 m/s across. Where that way is shut at this length, a shorter one (in no quicker
    // than 12 m/s all told) that lets it on round — rather than wait and then jump
    const rest = Math.atan2(Math.sin(this.yaw - this.by), Math.cos(this.yaw - this.by)), up = Math.min(1.2, bt0 + 3.5 * dt);
    const cap = Math.max(Math.abs(this._dYaw || 0) * 1.05, 12 * dt / Math.max(0.3, c * Math.cos(P - t))), turn = THREE.MathUtils.clamp(rest, -cap, cap);
    // (not in closer than 1.1 m for it — nearer it waits a moment instead; held up a quarter of a second, to 0.6 m)
    const behind = Math.abs(rest) > 0.03; this.lagT = behind ? (this.lagT || 0) + dt : 0;
    const floor = this.lagT > 0.25 ? 0.6 : 1.1, least = Math.max(floor, Math.min(c, this.cur - 12 * dt));
    const cs = [c]; for (let cc = c - 0.05; cc >= least - 1e-6; cc -= 0.05) cs.push(cc);
    let pick = null;
    search: for (const fr of [1, 0.7, 0.45, 0.25, 0.1]) for (const cc of cs) for (const tt of [t, bt0, up]) if (good(this.by + turn * fr, tt, cc)) { pick = [this.by + turn * fr, tt, cc, fr]; break search; }
    // no way round this frame: behind you, it goes up and in as far as a frame allows, so that next frame it may come
    // round; else on as it is going; and where coming in is shut (a shelf's margin between) it may stay a moment
    if (!pick) for (const [tt, cc] of behind ? [[up, cs[cs.length - 1]], [up, c], [t, cs[cs.length - 1]], [bt0, cs[cs.length - 1]], [t, c], [bt0, c], [bt0, this.cur]] : [[t, c], [bt0, c], [t, this.cur], [bt0, this.cur]])
      if (good(this.by, tt, cc)) { pick = [this.by, tt, cc, 0]; break; }
    if (!pick) {
      // nowhere it may go from where it was (you have walked so that it is hemmed in): only then in along its own line
      // to where it may be — the one move that may be at once; counted apart (why)
      why = 'no way round: in along its line';
      for (let cc = Math.min(c, this.cur); cc > 0.05; cc -= 0.05) { at(this.by, bt0, cc, A); if (ok(A.x, A.y, A.z) && sees(A)) { pick = [this.by, bt0, cc, 0]; break; } }
      if (!pick) pick = [this.by, bt0, 0.05, 0];
    } else if (pick[3] < 1 || Math.abs(turn) < Math.abs(rest) - 1e-4) why += ', coming round';
    [this.by, this.bt, this.cur] = pick;
    this.dbg = { why, was, cur: this.cur, now, want: dT, tilt: this.bt, tiltTo: tT, lag: Math.atan2(Math.sin(this.yaw - this.by), Math.cos(this.yaw - this.by)) };
  }
}
