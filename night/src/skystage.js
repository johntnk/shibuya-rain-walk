// SHIBUYA SKY: the open roof of Shibuya Scramble Square, 229 m up, and the escalator up to it — the "sunset
// escalator". Laid out after photographs of it (photographs of the real deck): along one long edge of the roof a
// sunken run open to the sky, between a tall glass wall on its outer side and the building on its inner; in it two
// escalators side by side (one up, one down) and beside them a broad flight of stairs, all rising together from a
// lower landing at the door from the 46th-floor gallery to the roof deck; over them a row of white steel frames on
// round white columns. The deck: pale timber, glass walls round its edge, seats stepped up on its east side facing
// the sunset.
// Which edge it is and the exact sizes are not known from the photographs: put here on the west edge (its glass
// faces 249°, the sunset and Fuji, which is why the photographs of it at sunset are golden), the rise 7.4 m at 30°,
// steps 1 m wide, 0.55 m/s. An informed reconstruction, not a survey.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Kit, at } from './kit.js';
import { U, GLSL_COMMON, col } from './materials.js';
import { offset, along, yawOf } from './geom.js';
import { rng } from './util.js';
import { SkyGallery } from './skygallery.js';
import { WET_GLSL } from './ground.js';

export const SKY = { YDECK: 229.0, RISE: 7.4, get YLOW() { return this.YDECK - this.RISE; }, SPEED: 0.55, SLOPE: Math.tan(30 * Math.PI / 180) };
// the run's plan (u along the edge from its north end, v in from the outer glass), metres
export const RUN = {
  vUp: 2.85, vDn: 1.15, laneW: 1.6, stair0: 3.9, stair1: 9.05, inner: 9.2,   // (the down escalator by the window, the up one inside it: as the user has it)
  escA: 5.4, blend: 1.1, comb0: 3.0, comb1: 20.6,                     // (the incline's start and the soft bends into it; where the steps go under the combs)
  st0: 4.4, nSteps: 46, tread: 0.3,                                     // (the stairs: from 4.4 m along, 46 risers)
  door0: 0.8, door1: 2.6,                                               // (the doors back into the 46th floor)
  get escB() { return this.escA + SKY.RISE / SKY.SLOPE; }, get st1() { return this.st0 + this.nSteps * this.tread; },
};

// where the CROSSING LIGHT's searchlights stand, in a low enclosure along the south edge (u, v as the run's frame)
const PIT = { u0: 45.4, u1: 49.6, v0: 12, v1: 44 };

// the frame of the run, from the tower's footprint: the deck's edge (the tower set in 4 m from the podium, as in
// landmarks.js) and its west side — the longest edge whose outer face looks west-south-west
export function skyFrame(pts) {
  const ring = offset(pts, -4.0);
  let best = null;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1) continue;
    const nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L, az = Math.atan2(nx, -nz) * 180 / Math.PI;
    if (az < 0 ? az + 360 > 200 && az + 360 < 290 : false) { if (!best || L > best.L) best = { a, b, L, nx, nz }; }
  }
  // the edge runs from its south end to its north end in the ring's order: u from the north end, going south
  const north = best.a[1] < best.b[1] ? best.a : best.b, south = north === best.a ? best.b : best.a;
  const ux = (south[0] - north[0]) / best.L, uz = (south[1] - north[1]) / best.L, vx = -best.nx, vz = -best.nz;
  const O = [north[0] + ux * 2.0 + vx * 0.25, north[1] + uz * 2.0 + vz * 0.25];   // (a little in from the corner and the glass)
  return {
    ring, O, ux, uz, vx, vz, L: best.L - 2.0, out: [best.nx, best.nz],
    toW: (u, v) => [O[0] + ux * u + vx * v, O[1] + uz * u + vz * v],
    toL: (x, z) => { const dx = x - O[0], dz = z - O[1]; return [dx * ux + dz * uz, dx * vx + dz * vz]; },
    yaw: Math.atan2(ux, uz),                                           // (facing up the run, toward the south)
  };
}

// the escalators' height along the run: flat at the bottom, a soft bend, 30°, a soft bend, flat at the top
const ramp = (x, r) => x < -r ? 0 : x > r ? x : (x + r) * (x + r) / (4 * r);
export function escY(u) { return SKY.YLOW + SKY.SLOPE * (ramp(u - RUN.escA, RUN.blend) - ramp(u - RUN.escB, RUN.blend)); }
// the stairs' height along the run: the tread you stand on
export function stairY(u) {
  if (u < RUN.st0) return SKY.YLOW; if (u >= RUN.st1) return SKY.YDECK;
  const k = Math.floor((u - RUN.st0) / RUN.tread) + 1; return SKY.YLOW + k * SKY.RISE / RUN.nSteps;
}
// distance along an escalator's path (its steps keep a constant speed along it), and back
const PATH = (() => { const N = 400, u0 = RUN.comb0 - 0.6, u1 = RUN.comb1 + 0.6, us = [], ss = [0]; for (let i = 0; i <= N; i++) us.push(u0 + (u1 - u0) * i / N);
  for (let i = 1; i <= N; i++) ss.push(ss[i - 1] + Math.hypot(us[i] - us[i - 1], escY(us[i]) - escY(us[i - 1]))); return { us, ss, L: ss[N], N }; })();
export function uAtS(s) { const { us, ss, N } = PATH; s = Math.max(0, Math.min(ss[N], s)); let lo = 0, hi = N; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ss[m] < s) lo = m; else hi = m; } const f = (s - ss[lo]) / Math.max(1e-6, ss[hi] - ss[lo]); return us[lo] + (us[hi] - us[lo]) * f; }
export function sAtU(u) { const { us, ss, N } = PATH; const k = Math.max(0, Math.min(N - 1, Math.floor((u - us[0]) / (us[N] - us[0]) * N))); const f = (u - us[k]) / (us[k + 1] - us[k]); return ss[k] + (ss[k + 1] - ss[k]) * Math.max(0, Math.min(1, f)); }

export class SkyStage {
  constructor(tower) {
    const F = this.F = skyFrame(tower.pts), K = this.kit = new Kit(), R = rng(229), Y = SKY.YDECK, Y0 = SKY.YLOW;
    this.group = new THREE.Group(); this.group.name = 'SHIBUYA SKY';
    const W = (u, v, y = 0) => { const [x, z] = F.toW(u, v); return new THREE.Vector3(x, y, z); };
    const yaw = F.yaw;
    const place = (u, v, y, ry = 0) => { const [x, z] = F.toW(u, v); return at(x, y, z, yaw + ry); };
    this.casters = [];                                                // (what throws the sun's shadows on the roof)
    this.roofLamps = [];                                              // ([u, v, strength, reach, colour] in the run's frame; or [x, z, …, 'w'] in the world's)
    // ---------------------------------------------------------------- the deck: timber over all the roof but the run
    const deckRing = offset(F.ring, -0.25);
    this.deckRing = deckRing;
    {
      // (the run cut into the ring's west edge as a notch: its corners put into the edge, in the ring's order)
      const ring = deckRing.slice(), [n0, n1] = (() => { let bi = 0, bd = 1e9; for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], [mu, mv] = F.toL(m[0], m[1]); if (Math.abs(mv) < bd && mu > 0 && mu < F.L) { bd = Math.abs(mv); bi = i; } } return [bi, (bi + 1) % ring.length]; })();
      const [ua] = F.toL(...ring[n0]), notch = [[-0.25, 0], [-0.25, RUN.inner], [RUN.st1, RUN.inner], [RUN.st1, RUN.stair0 - 0.1], [RUN.comb1, RUN.stair0 - 0.1], [RUN.comb1, 0]].map(([u, v]) => F.toW(u, v));
      if (ua > F.L / 2) notch.reverse();                                // (going from the south end to the north, the notch's corners the other way round)
      ring.splice(n0 + 1, 0, ...notch);
      const shape = new THREE.Shape(ring.map(([x, z]) => new THREE.Vector2(x, -z)));
      { const P = PIT; let pts = [[P.u0, P.v0], [P.u1, P.v0], [P.u1, P.v1], [P.u0, P.v1]].map(([u, v]) => { const [x, z] = F.toW(u, v); return new THREE.Vector2(x, -z); }); if (THREE.ShapeUtils.isClockWise(pts) === THREE.ShapeUtils.isClockWise(shape.getPoints())) pts = pts.reverse(); shape.holes.push(new THREE.Path(pts)); }   // (the searchlights' pit, open: its ring wound against the deck's)
      const g = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2).translate(0, Y, 0);
      this.deck = new THREE.Mesh(g, deckMat(F)); this.deck.matrixAutoUpdate = false; this.group.add(this.deck);
      // the deck's thickness at the run's edge, so its edge reads (a fascia in white)
      for (const [a, b] of [[[-1.0, RUN.inner], [RUN.st1, RUN.inner]], [[RUN.st1, RUN.stair0 - 0.1], [RUN.comb1, RUN.stair0 - 0.1]]]) {
        const p0 = W(...a), p1 = W(...b), L = p0.distanceTo(p1), m = p0.clone().add(p1).multiplyScalar(0.5);
        K.box('solid', L, 0.6, 0.12, at(m.x, Y - 0.3, m.z, yaw + Math.PI / 2), '#e8e6e0');
      }
    }
    // ---------------------------------------------------------------- the glass walls round the edge of the roof
    this.glass = [];                                                  // (panels: drawn in the glass material)
    const GH = 2.0, glassPanels = [];
    const panel = (a, b, y0, y1) => glassPanels.push([a, b, y0, y1]);
    for (const p of along(deckRing, 1.8)) {
      const [u, v] = F.toL(p.x, p.z), onRun = v < 1.0 && u > -1.2 && u < RUN.comb1 + 0.4;
      const y0 = onRun ? Y0 : Y, a = new THREE.Vector3(p.x - p.tx * 0.9, 0, p.z - p.tz * 0.9), b = new THREE.Vector3(p.x + p.tx * 0.9, 0, p.z + p.tz * 0.9);
      const gh = u < -4.0 && v < 6.5 ? 1.15 : GH;                     // (SKY EDGE, the north-west corner over the crossing: its glass low)
      panel(a, b, y0, Y + gh);
      // the stainless posts between panels, a top rail — but not along the escalators: there the glass is frameless, a
      // hairline at each joint and nothing standing in it (the user's video of it at sunset, 2026-10)
      if (!onRun) K.box('metal', 0.07, Y + gh - y0, 0.07, at(a.x, y0 + (Y + gh - y0) / 2, a.z), '#c9ced6');
      K.box('metal', 1.8, 0.06, 0.09, at(p.x, Y + gh, p.z, yawOf(p.nx, p.nz)), '#c9ced6');
      if (!onRun) K.box('solid', 1.8, 0.12, 0.3, at(p.x - p.nx * 0.05, Y + 0.06, p.z - p.nz * 0.05, yawOf(p.nx, p.nz)), '#d8d4cc');
    }
    // the run's north end: glass from the landing up
    { const a = W(-0.25, 0.1), b = W(-0.25, RUN.inner); for (let k = 0; k < 5; k++) { const p0 = a.clone().lerp(b, k / 5), p1 = a.clone().lerp(b, (k + 1) / 5); panel(p0, p1, Y0, Y + GH); } }   // (frameless too)
    // the inner wall of the run: the building's face, glass at the bottom (the 46th floor), white panels above; a
    // glass rail along the deck's edge over it
    {
      for (let u = -0.25; u < RUN.st1; u += 1.5) {
        const u1 = Math.min(RUN.st1, u + 1.5), p0 = W(u, RUN.inner + 0.05), p1 = W(u1, RUN.inner + 0.05), m = p0.clone().add(p1).multiplyScalar(0.5), L = p0.distanceTo(p1);
        const yStair = stairY(u);
        K.box('solid', L, Y - yStair, 0.25, at(m.x, (Y + yStair) / 2, m.z, yaw + Math.PI / 2), '#e9e7e2');
        panel(p0, p1, Y, Y + 1.15);
      }
      // the doors: a band of lit glass at the lower landing, its frame, the gallery's light coming out (in through them
      // to the 46th floor's gallery: main.js's hotspot, skygallery.js)
      const d0 = W(RUN.door0, RUN.inner - 0.1), d1 = W(RUN.door1, RUN.inner - 0.1), dm = d0.clone().add(d1).multiplyScalar(0.5);   // (just proud of the wall's face)
      K.box('glow', RUN.door1 - RUN.door0, 2.4, 0.04, at(dm.x, Y0 + 1.2, dm.z, yaw + Math.PI / 2), col('#ffcf96', 1.35));   // (the gallery's warm light through the glass doors)
      for (const u of [RUN.door0, (RUN.door0 + RUN.door1) / 2, RUN.door1]) { const p = W(u, RUN.inner - 0.13); K.box('metal', 0.1, 2.5, 0.12, at(p.x, Y0 + 1.25, p.z), '#2f343c'); }
      { const p = W((RUN.door0 + RUN.door1) / 2, RUN.inner - 0.13); K.box('metal', RUN.door1 - RUN.door0 + 0.2, 0.14, 0.14, at(p.x, Y0 + 2.45, p.z, yaw + Math.PI / 2), '#2f343c'); }
      this.doorAt = W((RUN.door0 + RUN.door1) / 2, RUN.inner - 1.0, Y0);
      this.doorSign = { p: W((RUN.door0 + RUN.door1) / 2, RUN.inner - 0.08, Y0 + 2.9), yaw: yaw - Math.PI / 2 };
    }
    // ---------------------------------------------------------------- the lower landing's floor; the stairs
    {
      const a = W(-0.25, 0), b = W(RUN.comb0, RUN.inner), m = a.clone().add(b).multiplyScalar(0.5);
      K.box('solid', RUN.inner, 0.2, RUN.comb0 + 0.25, place((RUN.comb0 - 0.25) / 2, RUN.inner / 2, Y0 - 0.1), '#cbc6bc');
      // the stairs: stone treads, a dark line along each nosing; the flight's side walls
      for (let k = 1; k <= RUN.nSteps; k++) {
        const u0 = RUN.st0 + (k - 1) * RUN.tread, y = Y0 + k * SKY.RISE / RUN.nSteps, w = RUN.stair1 - RUN.stair0;
        K.box('solid', w, y - Y0 + 0.02, RUN.tread, place(u0 + RUN.tread / 2, (RUN.stair0 + RUN.stair1) / 2, Y0 + (y - Y0) / 2 - 0.01), k % 2 ? '#d9d4ca' : '#d4cfc5');
        K.box('solid', w, 0.012, 0.04, place(u0 + 0.025, (RUN.stair0 + RUN.stair1) / 2, y + 0.004), '#5d5a55');
      }
      // the floor between the stairs' foot and the escalators' combs, and on past the stairs' top
      K.box('solid', RUN.inner - RUN.stair0 + 0.3, 0.2, RUN.st0 - RUN.comb0, place((RUN.st0 + RUN.comb0) / 2, (RUN.stair0 + RUN.inner) / 2, Y0 - 0.1), '#cbc6bc');
      // the stairs' rails: stainless tubes on posts, both sides of the flight
      for (const v of [RUN.stair0 + 0.1, RUN.stair1 - 0.1]) {
        const pts = []; for (let u = RUN.st0 - 0.2; u <= RUN.st1 + 0.3; u += 0.6) pts.push(W(u, v, stairY(u) + 0.9));
        for (let i = 0; i < pts.length - 1; i++) K.beam('metal', pts[i], pts[i + 1], 0.045, '#d4d8de', 0, true);
        for (let i = 0; i < pts.length; i += 3) K.beam('metal', pts[i].clone().setY(pts[i].y - 0.9), pts[i], 0.03, '#d4d8de', 0, true);
      }
    }
    // ---------------------------------------------------------------- the escalators
    this.lanes = [{ v: RUN.vUp, dir: 1, name: '上行' }, { v: RUN.vDn, dir: -1, name: '下行' }];
    for (const ln of this.lanes) this.escalatorBody(ln, K, F, W, place);
    this.steps = this.stepMesh();
    this.rails = this.handrails();
    // ---------------------------------------------------------------- the white frames over the run
    for (let u = 0.5; u < RUN.comb1 + 3; u += 4.4) {
      const top = Y + 4.4, cols = [[u, RUN.inner + 0.25]];             // (on the building's side only: none standing in the glass — the user's video)
      for (const [cu, cv] of cols) { const p = W(cu, cv); const base = cv < 1 ? Y0 - 0.2 : Math.min(Y, stairY(cu)); K.cyl('solid', 0.17, 0.19, top - base, at(p.x, base + (top - base) / 2, p.z), '#f2f2ef', 14); }
      K.beam('solid', W(u, 0.15, top), W(u, RUN.inner + 0.25, top), 0.32, '#f2f2ef');
      K.beam('solid', W(u, 0.15, top - 0.1), W(u + 2.2, -0.9, Y + GH + 0.3), 0.18, '#f2f2ef');   // (the struts out over the glass)
      K.beam('solid', W(u, RUN.inner * 0.5, top), W(u + 4.4 > RUN.comb1 + 3 ? u : u + 4.4, RUN.inner * 0.5, top), 0.16, '#f2f2ef');
      // a downlight under the beam over each escalator and over the stairs (they light the run at night)
      for (const v of [RUN.vUp, RUN.vDn, RUN.stair0 + 1.4, RUN.stair1 - 1.4]) { const p = W(u, v, top - 0.2); K.cyl('glow', 0.09, 0.11, 0.06, at(p.x, p.y, p.z), col('#fff1dc', 1.6), 10); this.roofLamps.push([u, v, 0.75, 3.2, [1.0, 0.88, 0.7]]); }
    }
    // ---------------------------------------------------------------- on the deck, as it is (docs/research/调研-SHIBUYA SKY屋顶夜景与
    // 室内.md, and the photographs on Commons): in its middle the heliport, raised, its top artificial turf marked in
    // yellow (the circle and H, the arrows of the way in); up to it on the west a few broad steps that are the seats,
    // facing the sunset, and on the east five steps to climb; on its top the GEO COMPASS (the world drawn round
    // Tokyo); on the east side the white net hammocks and the low sofas facing Tokyo Tower; the north-west corner over
    // the crossing, SKY EDGE, its glass low; along the south edge, behind a low white wall, the eighteen searchlights of
    // the CROSSING LIGHT under their clear domes. (Where each stands exactly is not known: placed as the accounts have it.)
    {
      const H = this.heli = { u0: 10, u1: 30, v0: 17, v1: 37, h: 1.2, west: 3, wRise: 0.4, wTread: 0.9, east: 5, eRise: 0.24, eTread: 0.4 };
      const top = Y + H.h, uc = (H.u0 + H.u1) / 2, vc = (H.v0 + H.v1) / 2;
      // the platform: timber sides, the turf top (its own mesh, below)
      K.box('solid', H.u1 - H.u0, H.h, H.v1 - H.v0, place(uc, vc, Y + H.h / 2), '#8a7560');
      // the west steps, the seats: three broad ones
      for (let k = 0; k < H.west - 1; k++) { const hh = H.wRise * (k + 1), v0 = H.v0 - H.wTread * (H.west - 1 - k); K.box('solid', H.v0 - v0, hh, H.u1 - H.u0, place(uc, (v0 + H.v0) / 2, Y + hh / 2), k % 2 ? '#9d8468' : '#957c61'); }   // (box: x along v, z along u, in place())
      // the east steps, to climb
      for (let k = 0; k < H.east - 1; k++) { const hh = H.eRise * (k + 1), v1 = H.v1 + H.eTread * (H.east - 1 - k); K.box('solid', v1 - H.v1, hh, H.u1 - H.u0, place(uc, (H.v1 + v1) / 2, Y + hh / 2), k % 2 ? '#9d8468' : '#957c61'); }
      // the steps' nosings lit at night (a warm line under each edge, as the photographs show them) and the light they throw
      this.stepLights = [];
      for (let k = 0; k < H.west; k++) { const hh = H.wRise * (k + 1) - 0.06, v = H.v0 - H.wTread * (H.west - 1 - k) - 0.02; this.stepLights.push([W(H.u0 + 0.3, v, Y + hh), W(H.u1 - 0.3, v, Y + hh)]); for (let u = H.u0 + 1; u < H.u1; u += 2.5) this.roofLamps.push([u, v - 0.4, 0.22, 1.6, [1.0, 0.78, 0.5]]); }
      for (let k = 0; k < H.east; k++) { const hh = H.eRise * (k + 1) - 0.05, v = H.v1 + H.eTread * (H.east - 1 - k) + 0.02; this.stepLights.push([W(H.u0 + 0.3, v, Y + hh), W(H.u1 - 0.3, v, Y + hh)]); }
      for (const [a, b] of this.stepLights) { const m = a.clone().add(b).multiplyScalar(0.5); K.box('glow', a.distanceTo(b), 0.025, 0.04, at(m.x, m.y, m.z, yaw + Math.PI / 2), col('#ffcf96', 1.5)); }
      this.turf = turfMesh(W, H, top); this.group.add(this.turf);
      // the GEO COMPASS: a round plate on the top, the world drawn round Tokyo (drawn simply: the rose, the rings of
      // distance, the cities and how far), lit low at night
      this.compass = compassMesh(W(H.u0 + 4.0, H.v1 - 4.0, top + 0.02), 3.4, yaw); this.group.add(this.compass);
      this.roofLamps.push([H.u0 + 4.0, H.v1 - 4.0, 0.5, 4.2, [0.85, 0.92, 1.0]]);
      // the hammocks: white nets like clouds on low frames, east side, lit from below at night
      this.hammocks = [];
      const nets = [];
      for (const u of [-4, 6, 16, 26]) { const c = W(u, 46.5, Y); this.hammocks.push({ u, v: 46.5 }); nets.push(hammock(K, c, yaw)); this.roofLamps.push([u, 46.5, 0.45, 3.2, [0.9, 0.95, 1.0]]); }
      this.group.add(netMesh(nets));
      // the sofas and low tables round the platform's east side, facing east (Tokyo Tower, the Skytree)
      for (let u = -6; u < 36; u += 4.2) { if (u > -1 && u < 1) continue; sofa(K, W(u, 42.2, Y), yaw + Math.PI / 2); K.box('solid', 0.8, 0.38, 0.5, place(u, 43.4, Y + 0.19), '#3b3a38'); }
      // the bar on the east side (THE ROOF): a low counter
      K.box('solid', 5.0, 1.05, 0.7, place(-6, 38.5, Y + 0.525), '#2c2a28'); K.box('glow', 5.0, 0.04, 0.05, place(-6, 38.86, Y + 0.95), col('#ffcf96', 1.4));
      // SKY EDGE: the north-west corner, over the crossing — its glass low (set in the panels above), the floor at its
      // tip another stone, a little light in it at night
      { const [u, v] = this.edgeTip = [-10.2, 0.2]; K.box('solid', 4.2, 0.02, 4.2, place(u + 2.0, v + 2.0, Y + 0.01), '#c9c6c0'); this.roofLamps.push([u + 1.6, v + 1.6, 0.9, 4.0, [0.95, 0.97, 1.0]]); }
      // the CROSSING LIGHT, as the photograph of it has it (trafficnews.jp 90731_ph2, 2019): along the south edge a low
      // enclosure behind a white wall — its floor a dark steel grating a little below the deck, two long dark plinths
      // along it, the eighteen lamps on them under clear domes, two rows of nine; no one between it and the glass
      const P = this.pit = PIT, GY = Y - 0.45, PY = Y + 0.2;
      // its sides down to the grating; the grating (bars across it, a frame of steel every 1.5 m)
      for (const [a, b] of [[[P.u0, P.v0], [P.u0, P.v1]], [[P.u0, P.v0], [P.u1, P.v0]], [[P.u0, P.v1], [P.u1, P.v1]]]) { const p0 = W(...a), p1 = W(...b), m = p0.clone().add(p1).multiplyScalar(0.5), L = p0.distanceTo(p1); K.box('solid', L, Y - GY, 0.12, at(m.x, (Y + GY) / 2, m.z, Math.atan2(p1.x - p0.x, p1.z - p0.z) + Math.PI / 2), '#33363c'); }
      K.box('solid', P.v1 - P.v0, 0.04, P.u1 - P.u0, place((P.u0 + P.u1) / 2, (P.v0 + P.v1) / 2, GY - 0.02), '#2c2f34');
      for (let v = P.v0 + 0.1; v < P.v1; v += 0.18) K.box('metal', 0.03, 0.03, P.u1 - P.u0, place((P.u0 + P.u1) / 2, v, GY + 0.015), '#565b63');
      for (let v = P.v0; v <= P.v1 + 0.01; v += 1.5) K.box('metal', 0.07, 0.05, P.u1 - P.u0, place((P.u0 + P.u1) / 2, v, GY + 0.03), '#6a7078');
      // the white wall round it on the deck's side and at its ends, a pale cap on it, as the deck's other low walls
      for (const [a, b] of [[[P.u0 - 0.08, P.v0 - 0.08], [P.u0 - 0.08, P.v1 + 0.08]], [[P.u0 - 0.08, P.v0 - 0.08], [P.u1, P.v0 - 0.08]], [[P.u0 - 0.08, P.v1 + 0.08], [P.u1, P.v1 + 0.08]]]) {
        const p0 = W(...a), p1 = W(...b), m = p0.clone().add(p1).multiplyScalar(0.5), L = p0.distanceTo(p1), ry = Math.atan2(p1.x - p0.x, p1.z - p0.z) + Math.PI / 2;
        K.box('solid', L + 0.16, 0.95, 0.16, at(m.x, Y + 0.475, m.z, ry), '#e8e6e0'); K.box('solid', L + 0.2, 0.04, 0.22, at(m.x, Y + 0.97, m.z, ry), '#f2f1ec');
      }
      // the two plinths, dark, their tops at the deck's height and a little over; the lamps on them
      this.beams = [];
      for (let r = 0; r < 2; r++) {
        const u = P.u0 + 1.05 + r * 2.1; K.box('solid', P.v1 - P.v0 - 1.2, PY - GY, 1.2, place(u, (P.v0 + P.v1) / 2, (PY + GY) / 2), '#1f2226');
        for (let v = P.v0 + 0.8; v < P.v1 - 0.6; v += 0.6) K.box('metal', 0.02, 0.012, 1.18, place(u, v, PY + 0.006), '#3b3f46');   // (its top a grating too)
        for (let k = 0; k < 9; k++) {
          const v = P.v0 + 1.8 + k * (P.v1 - P.v0 - 3.6) / 8, p = W(u, v, PY);
          K.box('metal', 0.9, 0.12, 0.9, at(p.x, p.y + 0.06, p.z, yaw), '#bfc4cc'); K.cyl('metal', 0.16, 0.2, 0.42, at(p.x, p.y + 0.33, p.z), '#2a2d33', 12);
          this.beams.push(new THREE.Vector3(p.x, p.y + 0.62, p.z));
        }
      }
      this.domes = domeMesh(this.beams); this.group.add(this.domes);
      this.lamps = this.lamps || [];
      // the low lights round the edge of the deck, at the foot of the glass; the gallery's light through its doors; the
      // escalators' own neon on what is round them
      for (const p of along(offset(deckRing, -0.55), 6)) { K.cyl('glow', 0.07, 0.07, 0.012, at(p.x, Y + 0.005, p.z), col('#ffd9a6', 1.6), 12); this.roofLamps.push([p.x, p.z, 0.45, 3.0, [1.0, 0.76, 0.48], 'w']); }
      this.roofLamps.push([(RUN.door0 + RUN.door1) / 2, RUN.inner - 0.6, 1.3, 3.8, [1.0, 0.82, 0.58]]);
      for (const ln of [RUN.vUp, RUN.vDn]) for (let u = RUN.comb0 - 0.6; u < RUN.comb1 + 0.6; u += 0.7) this.roofLamps.push([u, ln, 0.035, 0.9, [0.6, 1.0, 0.2]]);
      // (the seats, for the people: the west steps — each row [the step's front v, its height])
      this.seats = { u0: H.u0, u1: H.u1, rows: Array.from({ length: H.west }, (_, k) => [H.v0 - H.wTread * (H.west - 1 - k), H.wRise * (k + 1)]) };
      this.coreSign = { p: W(-2.8, 38.86 + 0.05, Y + 2.2), yaw: yaw - Math.PI / 2 };   // (the bar's sign)
    }
    for (const m of K.build()) { this.group.add(m); if (m.name !== 'glow') this.casters.push(m); }
    // (the escalators' glass balustrades: sloped panels between the skirt and the handrail)
    for (const [a, b, y0, y1] of this.balGlass) glassPanels.push([a, b, y0, y0 + 0.74, y1, y1 + 0.74, true]);
    this.glassMesh = glassMesh(glassPanels, (a, b) => Math.abs(F.toL(a.x, a.z)[1]) < 0.6 && Math.abs(F.toL(b.x, b.z)[1]) < 0.6); this.group.add(this.glassMesh);
    // the glass's planes (its upright panes grouped by the plane they lie in, facing out): one at a time is given the
    // true reflection — the one you are looking at (main.js)
    {
      const faces = new Map();
      for (const pn of glassPanels) {
        if (pn.length > 4) continue;
        const [a, b, y0, y1] = pn, L = Math.hypot(b.x - a.x, b.z - a.z); if (L < 0.3) continue;
        let nx = (b.z - a.z) / L, nz = -(b.x - a.x) / L; const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
        if (inRing(deckRing, mx + nx * 0.6, mz + nz * 0.6, 0) && !inRing(deckRing, mx - nx * 0.6, mz - nz * 0.6, 0)) { nx = -nx; nz = -nz; }
        const d = nx * a.x + nz * a.z, key = `${Math.round(Math.atan2(nx, nz) * 60)}|${Math.round(d * 8)}`;
        if (!faces.has(key)) faces.set(key, { n: new THREE.Vector3(nx, 0, nz), d, mids: [], y: (y0 + y1) / 2 });
        faces.get(key).mids.push(new THREE.Vector3(mx, (y0 + y1) / 2, mz));
      }
      this.mirrorFaces = [...faces.values()];
    }
    this.glassPlane = { p: new THREE.Vector3(...F.toW(10, 0).flatMap((c, i) => i ? [Y, c] : [c])), n: new THREE.Vector3(F.out[0], 0, F.out[1]) };
    this.group.add(this.steps.mesh); this.casters.push(this.steps.mesh);
    for (const r of this.rails) this.group.add(r);
    this.group.add(this.skirtLights());
    this.gallery = new SkyGallery(this, SKY, RUN, glassMesh); this.group.add(this.gallery.group);   // (46F and the way up to it, under the deck)
    this.bakeRoofLight();
    this.t = 0;
  }
  // one escalator's body: the skirt and the glass balustrades either side of its steps, their stainless decking,
  // the yellow combs and floor plates at each end
  escalatorBody(ln, K, F, W, place) {
    const v = ln.v, half = 0.5;
    for (const side of [-1, 1]) {
      const vb = v + side * (half + 0.08);
      for (let u = RUN.comb0 - 1.0; u < RUN.comb1 + 0.9; u += 0.5) {
        const u1 = u + 0.5, y0 = escY(u), y1 = escY(u1);
        const a = W(u, vb, y0 + 0.12), b = W(u1, vb, y1 + 0.12);
        // the skirt: a stainless band beside the steps
        K.add('metal', quad(W(u, vb, y0 - 0.15), W(u1, vb, y1 - 0.15), W(u1, vb, y1 + 0.18), W(u, vb, y0 + 0.18)), null, '#c4c9d0');
        // the decking: a sloped stainless cover out to the lane's edge
        const mid = (RUN.vUp + RUN.vDn) / 2, outer = v < mid, vo = outer ? (side < 0 ? 0.0 : mid) : (side < 0 ? mid : RUN.stair0);   // (out to the glass, the middle between the two, or the stairs: by where it is, not which way it goes)
        K.add('metal', quad(W(u, vb, y0 + 0.18), W(u1, vb, y1 + 0.18), W(u1, vo, y1 + 0.05), W(u, vo, y0 + 0.05)), null, '#b9bec6');
        K.add('metal', quad(W(u, vo, y0 + 0.05), W(u1, vo, y1 + 0.05), W(u1, vo, y1 - 1.4), W(u, vo, y0 - 1.4)), null, '#aeb3ba');   // (the escalator's side, down to the run's floor: brushed steel)
      }
      // the newel ends: the balustrade turning round at the top and bottom
    }
    // the glass balustrades: panels from the skirt up to the handrail, along the slope (drawn with the roof's glass)
    this.balGlass ||= [];
    for (const side of [-1, 1]) {
      const vb = v + side * (half + 0.08), pts = [];
      for (let u = RUN.comb0 - 1.05; u <= RUN.comb1 + 1.0; u += 0.6) pts.push(u);
      for (let i = 0; i < pts.length - 1; i++) this.balGlass.push([W(pts[i], vb), W(pts[i + 1], vb), escY(pts[i]) + 0.2, escY(pts[i + 1]) + 0.2]);
    }
    // the combs and floor plates (where the steps slide under: yellow teeth, ribbed stainless)
    for (const [u, y, d] of [[RUN.comb0, SKY.YLOW, -1], [RUN.comb1, SKY.YDECK, 1]]) {
      K.box('solid', 1.0, 0.04, 0.18, place(u, v, y + 0.02), '#f2c200');
      K.box('metal', 1.0, 0.03, 1.2, place(u + d * 0.69, v, y + 0.015), '#b8bdc4');
      for (let k = 0; k < 6; k++) K.box('solid', 0.98, 0.031, 0.02, place(u + d * (0.2 + k * 0.18), v, y + 0.016), '#8d929a');
    }
  }
  // the escalators' night lighting: a white strip along both skirts where the steps run (stainless by day)
  skirtLights() {
    const P = [];
    for (const ln of this.lanes) for (const side of [-1, 1]) {
      const vb = ln.v + side * 0.56;
      for (let u = RUN.comb0 - 0.9; u < RUN.comb1 + 0.8; u += 0.25) {
        const u1 = u + 0.25, [x0, z0] = this.F.toW(u, vb), [x1, z1] = this.F.toW(u1, vb), y0 = escY(u) + 0.05, y1 = escY(u1) + 0.05;
        P.push(x0, y0, z0, x1, y1, z1, x1, y1 + 0.035, z1, x0, y0, z0, x1, y1 + 0.035, z1, x0, y0 + 0.035, z0);
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ side: THREE.DoubleSide, uniforms: { uDay: U.uDay },
      vertexShader: `void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uDay; void main(){ gl_FragColor = vec4(vec3(1.5, 1.55, 1.7) * (1.0 - uDay) + vec3(0.55, 0.58, 0.62) * uDay, 1.0); }` }));
    m.userData.noInk = true; return m;
  }
  // the steps: one instanced draw for both escalators, moved along their paths each frame
  stepMesh() {
    const tread = new THREE.BoxGeometry(0.4, 0.035, 1.0).translate(0.2, -0.0175, 0);
    const riser = new THREE.BoxGeometry(0.02, 1, 0.98).translate(0.01, -0.5, 0);   // (scaled down to the drop to the step below)
    const yel = new THREE.BoxGeometry(0.05, 0.004, 1.0).translate(0.025, 0.002, 0), yel2 = new THREE.BoxGeometry(0.4, 0.004, 0.05);
    const parts = [[tread, [0.13, 0.135, 0.15]], [yel, [0.95, 0.75, 0.05]], [yel2.clone().translate(0.2, 0.002, 0.475), [0.95, 0.75, 0.05]], [yel2.clone().translate(0.2, 0.002, -0.475), [0.95, 0.75, 0.05]]];
    const tg = mergeGeometries(parts.map(([g, c]) => { g = g.toNonIndexed(); const n = g.attributes.position.count, C = new Float32Array(n * 3); for (let i = 0; i < n; i++) C.set(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k); return g; }));
    const rg = riser.toNonIndexed(); { const n = rg.attributes.position.count, C = new Float32Array(n * 3); for (let i = 0; i < n; i++) C.set([0.15, 0.16, 0.18], i * 3); rg.setAttribute('color', new THREE.BufferAttribute(C, 3)); rg.deleteAttribute('uv'); }
    const n = Math.ceil(PATH.L / 0.4) + 4, mat = stepMat();
    const tm = new THREE.InstancedMesh(tg, mat, n * 2), rm = new THREE.InstancedMesh(rg, mat, n * 2);
    for (const m of [tm, rm]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; }
    const g = new THREE.Group(); g.add(tm, rm);
    return { mesh: g, tm, rm, n };
  }
  // the handrails: a black rubber band along each balustrade's top, round at each end; its ribs move with the steps
  handrails() {
    const out = [], mat = handrailMat();
    for (const ln of this.lanes) for (const side of [-1, 1]) {
      const vb = ln.v + side * 0.58, pts = [], H = 0.98, r = 0.32, uA = RUN.comb0 - 1.05, uB = RUN.comb1 + 1.0;
      const P = (u, y) => { const [x, z] = this.F.toW(u, vb); return new THREE.Vector3(x, y, z); };
      for (let k = 6; k >= 0; k--) { const a = Math.PI / 2 + Math.PI * k / 6; pts.push(P(uA + Math.cos(a) * r, SKY.YLOW + H - r + Math.sin(a) * r)); }   // (round the bottom wheel)
      for (let u = uA + 0.25; u <= uB - 0.25; u += 0.25) pts.push(P(u, escY(u) + H));
      for (let k = 0; k <= 6; k++) { const a = Math.PI / 2 - Math.PI * k / 6; pts.push(P(uB + Math.cos(a) * r, SKY.YDECK + H - r + Math.sin(a) * r)); }   // (round the top wheel)
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'), g = new THREE.TubeGeometry(curve, 420, 0.042, 20);   // (round enough that no facet shows, close up)
      g.setAttribute('aDir', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(ln.dir), 1));
      const m = new THREE.Mesh(g, mat); m.matrixAutoUpdate = false; out.push(m); this.casters?.push(m);
    }
    this.railMat = mat; return out;
  }
  // each frame: the steps along their paths (the up one climbing, the down one going down), the handrails' ribs
  update(dt) {
    this.gallery?.update(dt);
    this.t += dt; const S = this.steps, M = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s1 = new THREE.Vector3(1, 1, 1), sr = new THREE.Vector3(1, 1, 1);
    const yq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.F.yaw - Math.PI / 2);
    let k = 0;
    for (const ln of this.lanes) {
      const off = ((this.t * SKY.SPEED * ln.dir) % 0.405 + 0.405) % 0.405;
      for (let i = 0; i < S.n; i++) {
        const s = i * 0.405 + off, u = uAtS(s); if (u < RUN.comb0 - 0.05 || u > RUN.comb1 + 0.05) continue;
        const y = escY(u), uPrev = uAtS(s - 0.405), drop = Math.max(0.002, y - escY(uPrev));
        const [x, z] = this.F.toW(u - 0.2, ln.v);
        M.compose(p.set(x, y, z), yq, s1); S.tm.setMatrixAt(k, M);
        sr.set(1, drop, 1); const [rx, rz] = this.F.toW(u - 0.2, ln.v); M.compose(p.set(rx, y, rz), yq, sr); S.rm.setMatrixAt(k, M);
        k++;
      }
    }
    S.tm.count = S.rm.count = k; S.tm.instanceMatrix.needsUpdate = S.rm.instanceMatrix.needsUpdate = true;
    this.railMat.uniforms.uMove.value = this.t * SKY.SPEED;
  }
  // the roof's light at night, painted from above: each lamp's pool on the floor under it (the floor's height in
  // the alpha, so a lamp over the stairs lights the stairs, not the deck above them)
  bakeRoofLight() {
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of this.deckRing) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    x0 -= 3; z0 -= 3; x1 += 3; z1 += 3;
    const res = 0.25, W = Math.ceil((x1 - x0) / res), H = Math.ceil((z1 - z0) / res), data = new Float32Array(W * H * 4);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const x = x0 + (i + 0.5) * res, z = z0 + (j + 0.5) * res; data[(j * W + i) * 4 + 3] = (this.heightAt(x, z) - 220) / 10; }
    for (const L of this.roofLamps) {
      const [x, z] = L[5] === 'w' ? [L[0], L[1]] : this.F.toW(L[0], L[1]), k = L[2], r = L[3], c = L[4];
      const i0 = Math.max(0, Math.floor((x - r - x0) / res)), i1 = Math.min(W - 1, Math.ceil((x + r - x0) / res)), j0 = Math.max(0, Math.floor((z - r - z0) / res)), j1 = Math.min(H - 1, Math.ceil((z + r - z0) / res));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const dx = x0 + (i + 0.5) * res - x, dz = z0 + (j + 0.5) * res - z, q = 1 - (dx * dx + dz * dz) / (r * r); if (q <= 0) continue;
        const f = q * q * k, o = (j * W + i) * 4; data[o] += c[0] * f; data[o + 1] += c[1] * f; data[o + 2] += c[2] * f;
      }
    }
    const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
    U.uRoofTex.value = t; U.uRoofBox.value.set(x0, z0, W * res, H * res);
    this.roofMap = { data, W, H, x0, z0, res };
  }
  // the roof's light where you stand (for the character's own lights)
  roofSample(x, z, out = [0, 0, 0]) {
    const M = this.roofMap; if (!M) return out.fill(0);
    const i = Math.floor((x - M.x0) / M.res), j = Math.floor((z - M.z0) / M.res); if (i < 0 || j < 0 || i >= M.W || j >= M.H) return out.fill(0);
    const o = (j * M.W + i) * 4, k = U.uRoofK.value; out[0] = M.data[o] * k; out[1] = M.data[o + 1] * k; out[2] = M.data[o + 2] * k; return out;
  }
  // where a rider stands on a lane at distance s along it
  ride(lane, s) { const u = uAtS(s), [x, z] = this.F.toW(u, lane.v); return { x, y: escY(u), z, u }; }
  // the height to stand at, on the roof (null: not on it)
  heightAt(x, z, y = null) {
    const [u, v] = this.F.toL(x, z);
    if (y != null && y < SKY.YLOW + 2.5 && this.gallery?.inRects(u, v)) return SKY.YLOW;   // (down in the gallery, under the deck)
    if (v > -0.3 && v < RUN.inner && u > -0.5 && u < RUN.comb1 + 0.4) {
      if (v >= RUN.stair0 - 0.15) return u < RUN.st0 ? SKY.YLOW : stairY(u);
      if (u < RUN.comb0 + 0.2) return SKY.YLOW;
      if (u > RUN.comb1 - 0.2) return SKY.YDECK;
      return escY(u);
    }
    return SKY.YDECK + this.heliY(u, v);
  }
  // how high the heliport's steps or top are here (0 off it)
  heliY(u, v) {
    const H = this.heli; if (!H || u < H.u0 || u > H.u1) return 0;
    if (v >= H.v0 && v <= H.v1) return H.h;
    if (v < H.v0) { const k = Math.ceil((H.v0 - v) / H.wTread); return k > H.west - 1 ? 0 : H.wRise * (H.west - k); }
    const k = Math.ceil((v - H.v1) / H.eTread); return k > H.east - 1 ? 0 : H.eRise * (H.east - k);
  }
  // where you can't walk on the roof: outside the glass, into the escalators (only by riding), off the deck's edge into
  // the run, through the stair rails, into the lifts' building
  blocked(x, z, y = null) {
    const [u, v] = this.F.toL(x, z);
    if (y != null && y < SKY.YLOW + 2.5 && this.gallery) {              // (down at the gallery's floor: its rooms, or the run's lower landing through its doors)
      const G = this.gallery;
      if (G.inRects(u, v, 0.3)) return G.fixtureAt(u, v);
      if (G.inRects(u, v)) return true;                                 // (too near its walls)
      if (!(u > -0.5 && u < RUN.comb1 + 0.9 && v > -0.3 && v < RUN.inner + 0.15)) return true;
    }
    if (!inRing(this.deckRing, x, z, 0.45)) return true;
    const inRun = u > -0.5 && u < RUN.st1 && v > -0.3 && v < RUN.inner + 0.15;
    if (u > -0.5 && u < RUN.comb1 + 0.4 && v < RUN.stair0 - 0.15 && u > RUN.comb0 - 0.9 && u < RUN.comb1 + 0.9) return true;   // (the escalators themselves)
    if (u > -0.7 && u < -0.05 && v > -0.3 && v < RUN.inner + 0.5) return true;   // (the glass across the run's north end)
    if (!inRun && v < RUN.inner + 0.5 && v > RUN.inner - 0.2 && u < RUN.st1) return true;   // (the rail along the deck's edge over the run)
    if (inRun && v > RUN.inner - 0.4 && u < RUN.st1) return true;     // (the run's inner wall)
    if (u > RUN.st0 - 0.2 && u < RUN.st1 + 0.1 && (Math.abs(v - (RUN.stair0 + 0.1)) < 0.18 || Math.abs(v - (RUN.stair1 - 0.1)) < 0.18)) return true;   // (the stairs' rails)
    const H = this.heli;                                              // (the heliport's north and south sides are sheer)
    if (H && v > H.v0 - H.wTread * (H.west - 1) - 0.1 && v < H.v1 + H.eTread * (H.east - 1) + 0.1 && ((u > H.u0 - 0.3 && u < H.u0 + 0.05) || (u > H.u1 - 0.05 && u < H.u1 + 0.3))) return true;
    const P = this.pit; if (P && u > P.u0 - 0.35 && v > P.v0 - 0.3 && v < P.v1 + 0.3) return true;   // (the searchlights' pit)
    for (const h of this.hammocks || []) if (Math.abs(u - h.u) < 2.3 && Math.abs(v - h.v) < 1.6) return true;
    return false;
  }
  // where the camera may not go on the roof: far out past the glass, or into the lifts' building
  camBlocked(x, z) {
    if (!this._outer) this._outer = offset(this.deckRing, 7.0);
    if (!inRing(this._outer, x, z)) return true;
    return false;
  }
  // the ways on and off the escalators, kept clear (the visitors don't stand or walk in them: crowd.js): at each end,
  // from the combs out past where you step on and off, across both lanes and the glass beside the down one — taken
  // from the boardings themselves, so they stay where the escalators are
  keepClear(x, z, pad = 0) {
    if (!this._keep) {
      this._keep = [];
      for (const top of [true, false]) {
        const at = y => (y > SKY.YLOW + 1) === top, us = [top ? RUN.comb1 : RUN.comb0], vs = [];
        for (const b of this.boardings()) for (const [p, y] of [[b.p, b.y], [b.exit, b.exitY]]) if (at(y)) { const [u, v] = this.F.toL(p[0], p[1]); us.push(u); vs.push(v, b.lane.v); }
        const u0 = Math.min(...us) - (top ? 0.3 : 2.0), u1 = Math.max(...us) + (top ? 2.0 : 0.3);
        this._keep.push([u0, u1, Math.min(...vs) - 1.6, Math.max(...vs) + 1.0, top ? SKY.YDECK : SKY.YLOW]);
      }
    }
    const [u, v] = this.F.toL(x, z);
    return this._keep.some(([u0, u1, v0, v1]) => u > u0 - pad && u < u1 + pad && v > v0 - pad && v < v1 + pad);
  }
  // the escalators' ends, where you get on: [lane, end ('bottom'|'top'), where, which way you face to board]
  boardings() {
    const up = this.lanes[0], dn = this.lanes[1], sB = sAtU(RUN.comb0 + 0.05), sT = sAtU(RUN.comb1 - 0.05);
    return [
      { lane: up, p: this.F.toW(RUN.comb0 - 0.9, up.v), y: SKY.YLOW, s0: sB, s1: sT, dir: 1, exit: this.F.toW(RUN.comb1 + 1.3, up.v), exitY: SKY.YDECK, label: '乘上行扶梯（去屋顶）' },
      { lane: dn, p: this.F.toW(RUN.comb1 + 0.9, dn.v), y: SKY.YDECK, s0: sT, s1: sB, dir: -1, exit: this.F.toW(RUN.comb0 - 1.3, dn.v), exitY: SKY.YLOW, label: '乘下行扶梯（回到 46F 门口）' },
    ];
  }
  // the nearest step's place along the path to s, on a lane (so you stand on a tread, not across two)
  snap(lane, s) { const off = ((this.t * SKY.SPEED * lane.dir) % 0.405 + 0.405) % 0.405; return Math.round((s - off) / 0.405) * 0.405 + off; }
  get pathLength() { return PATH.L; }
}

function inRing(pts, x, z, inset = 0) {
  let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; }
  if (!c || !inset) return c;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz; let t = ((x - a[0]) * dx + (z - a[1]) * dz) / L2; t = Math.max(0, Math.min(1, t)); if (Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z) < inset) return false; }
  return true;
}
function quad(a, b, c, d) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([a, b, c, a, c, d].flatMap(p => [p.x, p.y, p.z]), 3)); g.computeVertexNormals(); return g;
}

// the deck's timber: long pale boards, their joints, a few a shade off; lit as the roof is (sun and shadow). In the
// rain wet as the street is (ground.js): dark, the lamps, the people and the sky given back in it (the street's mirror,
// laid at the deck: main.js), shallow water lying along the boards here and there, rings opening on it
function deckMat(F) {
  return new THREE.ShaderMaterial({
    name: 'deck', uniforms: { ...U, uU: { value: new THREE.Vector2(F.ux, F.uz) } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${GLSL_COMMON} ${WET_GLSL} uniform vec2 uU; varying vec3 vW;
      void main(){
        vec2 p = vec2(dot(vW.xz, uU), dot(vW.xz, vec2(-uU.y, uU.x)));
        vec2 q = vec2(p.x / 2.4 + floor(p.y / 0.15) * 0.37, p.y / 0.15); vec2 id = floor(q), f = fract(q);
        float fw = fwidth(q.y), j = (1.0 - smoothstep(0.0, 0.08 + fw, min(f.y, 1.0 - f.y))) * (1.0 - smoothstep(0.3, 0.8, fw));
        float jj = (1.0 - smoothstep(0.0, 0.02 + fwidth(q.x), min(f.x, 1.0 - f.x))) * (1.0 - smoothstep(0.3, 0.8, fw));
        float h = hash12(id);
        vec3 base = mix(vec3(0.70, 0.60, 0.48), vec3(0.78, 0.68, 0.55), h) * (1.0 - 0.06 * step(0.85, hash12(id + 3.0)));
        base *= 1.0 - 0.45 * max(j, jj);
        base *= mix(vec3(1.0), vec3(0.74, 0.7, 0.66), uLightsOn * (1.0 - uDay));   // (at night the timber dark and warm, as the photographs have it, not grey)
        vec3 c = cleanColour(base) * toonLight(vec3(0.0, 1.0, 0.0), vW);
        if (uWet > 0.0) {
          float pud = smoothstep(0.55, 0.64, vnoise(vec2(p.x * 0.3, p.y * 0.85) + 3.1) * 0.8 + vnoise(p * 2.3) * 0.2);   // (where the water lies: longer along the boards)
          pud = max(pud, max(j, jj) * 0.5);                               // (and in the joints)
          vec3 rp = uRain > 0.01 ? ripples(p * 1.1, uTime) * uRain * (0.35 + 0.65 * pud) * (1.0 - smoothstep(0.025, 0.1, fwidth(p.x))) : vec3(0.0);
          vec3 V = normalize(cameraPosition - vW); float fres = 0.04 + 0.96 * pow(1.0 - max(V.y, 0.0), 5.0);
          c *= 1.0 - uWet * (0.55 + 0.25 * pud);                          // (wet timber: much darker)
          vec3 refl = wetReflection(vW, rp.xy, mix(0.6, 0.12, pud));
          c += refl * uWet * mix(0.2 + 0.5 * fres, 0.65 + 0.3 * fres, pud) * vec3(0.85, 0.9, 1.04);
          c += (uSky * 0.7 + vec3(0.02, 0.025, 0.035)) * fres * 0.5 * uWet * (1.0 - uReflOn);   // (no picture to give back: the sky's sheen)
          c += (refl * 0.8 + streetLight(vW, vec3(0.0, 1.0, 0.0)) * 0.35 + vec3(0.09, 0.1, 0.13)) * rp.z * 0.9 * uWet;
        }
        gl_FragColor = vec4(fogIt(c, vW), 1.0);
      }`,
  });
}
// glass: clear, the city seen through it; a faint sky in it, stronger at a glancing look; its edges catch the light
export function glassMesh(panels, outer = () => false) {
  const P = [], E = [], OUT = [];
  for (const pn of panels) {
    const [a, b, y0, y1] = pn, yb0 = pn.length > 4 ? pn[2] : y0, yt0 = pn.length > 4 ? pn[3] : y1, yb1 = pn.length > 4 ? pn[4] : y0, yt1 = pn.length > 4 ? pn[5] : y1;   // (a sloped panel: its foot and top at each end)
    const v = [[a.x, yb0, a.z], [b.x, yb1, b.z], [b.x, yt1, b.z], [a.x, yt0, a.z]];
    for (const k of [0, 1, 2, 0, 2, 3]) P.push(...v[k]);
    const joint = pn[6] ? 1e3 : Math.hypot(b.x - a.x, b.z - a.z);   // (the balustrades' glass runs on without joints)
    for (const e of [[0, 0], [1, 0], [1, 1], [0, 0], [1, 1], [0, 1]]) E.push(...e, joint, yt0 - yb0);
    const o = outer(a, b) ? 1 : 0; for (let k = 0; k < 6; k++) OUT.push(o);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aE', new THREE.Float32BufferAttribute(E, 4)); g.setAttribute('aOut', new THREE.Float32BufferAttribute(OUT, 1)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, glassMat()); m.renderOrder = 6; m.userData.noInk = true; m.frustumCulled = false;
  return m;
}
export function glassMat() {
  return new THREE.ShaderMaterial({
    name: 'roofglass', transparent: true, depthWrite: false, side: THREE.DoubleSide, uniforms: { ...U },
    vertexShader: `attribute vec4 aE; attribute float aOut; varying vec3 vN, vW; varying vec4 vE; varying float vOut; void main(){ vE = aE; vOut = aOut; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${GLSL_COMMON} uniform sampler2D uGRefl; uniform mat4 uGReflMat; uniform float uGReflOn; uniform vec4 uGPlane; varying vec3 vN, vW; varying vec4 vE; varying float vOut;
      void main(){
        vec3 n = normalize(vN), V = normalize(cameraPosition - vW); if (dot(n, V) < 0.0) n = -n;
        float fres = pow(1.0 - max(dot(n, V), 0.0), 4.0);
        vec3 R = reflect(-V, n); float up = R.y;
        vec3 sky = mix(uHaze, uSky * 1.4, smoothstep(-0.1, 0.5, up));
        float sun = pow(max(dot(R, uMoonDir), 0.0), 1600.0) * 3.0 * uDay;    // (the low sun behind you, a small hard glint in the glass)
        // the panel's edges: a thin bright line where the glass is cut
        vec2 e = vec2(min(vE.x, 1.0 - vE.x) * vE.z, min(vE.y, 1.0 - vE.y) * vE.w);
        // (the escalators' tall frameless glass, from the landing up past the deck: its upright joints only a faint
        // hairline — the user's video — the others as before)
        bool tall = vE.w > 3.0;
        float edgeV = (1.0 - smoothstep(0.0, (tall ? 0.006 : 0.03) + fwidth(e.x) * 1.5, e.x)) * (tall ? 0.16 : 1.0);
        float edgeH = 1.0 - smoothstep(0.0, 0.03 + fwidth(e.y) * 1.5, e.y);
        float edge = max(edgeV, edgeH);
        vec3 c = sky * (0.25 + 0.75 * fres) + uMoonCol * sun + vec3(0.85, 0.92, 1.0) * edge * 0.6;
        float a = 0.06 + 0.45 * fres + edge * 0.55 + min(sun, 1.0) * 0.5;
        if (vE.z > 500.0) {                                                // (the escalators' balustrades: thin clear glass, the rider seen through it;
          a *= 0.42;                                                       //  at night the steps' neon given back low in it)
          c += vec3(0.55, 0.85, 0.15) * 0.35 * pow(1.0 - vE.y, 3.0) * (1.0 - uDay); a += 0.12 * pow(1.0 - vE.y, 3.0) * (1.0 - uDay);
        }
        c *= mix(0.55, 1.0, uDay);                                         // (at night the glass holds only a little of the sky)
        // the pane you are looking at (main.js picks it): the true reflection of what is in front of it — the people at
        // the glass, the deck, the escalators and their lights, you — over the city seen through it (strong at night)
        if (uGReflOn > 0.5 && abs(dot(uGPlane.xyz, vW) - uGPlane.w) < 0.15 && abs(dot(normalize(vN), uGPlane.xyz)) > 0.995) {
          vec4 rp = uGReflMat * vec4(vW, 1.0); vec2 ruv = rp.xy / rp.w;
          if (ruv.x > 0.0 && ruv.y > 0.0 && ruv.x < 1.0 && ruv.y < 1.0) {
            vec3 r = texture2D(uGRefl, ruv).rgb, rs = texture2D(uGRefl, ruv + vec2(0.0015, 0.0)).rgb;
            r = (r + rs) * 0.5;
            float k = mix(0.62 + 0.3 * fres, 0.16 + 0.5 * fres, uDay);
            c += r * k; a += dot(r, vec3(0.33)) * k * 0.9;
          }
        }
        gl_FragColor = vec4(fogIt(c, vW), clamp(a, 0.0, 0.92));
      }`,
  });
}
// the steps: dark grooved aluminium (the grooves read close up), the yellow lines bright
function stepMat() {
  return new THREE.ShaderMaterial({
    name: 'steps', uniforms: { ...U },
    vertexShader: `attribute vec3 color; varying vec3 vC, vN, vW, vL; void main(){ vC = color; vL = position; vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${GLSL_COMMON} varying vec3 vC, vN, vW, vL;
      void main(){ vec3 n = normalize(vN);
        float groove = (n.y > 0.5 && vC.r < 0.5) ? step(0.5, fract(vL.z * 55.0)) * (1.0 - smoothstep(4.0, 10.0, distance(vW, cameraPosition))) : 0.0;
        vec3 base = vC * (1.0 - 0.35 * groove);
        vec3 c = cleanColour(base) * toonLight(n, vW);
        float neon = step(0.9, vC.r) * step(vC.b, 0.2);                  // (the yellow lines round each step: lit from within at night, neon yellow-green)
        c = mix(c, vec3(0.5, 1.0, 0.06) * 1.25, neon * (1.0 - uDay));
        gl_FragColor = vec4(fogIt(c, vW), 1.0); }`,
  });
}
function handrailMat() {
  return new THREE.ShaderMaterial({
    name: 'handrail', uniforms: { ...U, uMove: { value: 0 } },
    vertexShader: `attribute float aDir; varying vec3 vN, vW; varying vec2 vUv; varying float vD; void main(){ vUv = uv; vD = aDir; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${GLSL_COMMON} uniform float uMove; varying vec3 vN, vW; varying vec2 vUv; varying float vD;
      // (smooth black rubber, as a real one is — no ribs: lit softly round its curve, not with the toon's hard edge,
      // a broad soft sheen along it from the sky and the low sun)
      void main(){ vec3 n = normalize(vN), V = normalize(cameraPosition - vW);
        vec3 amb = mix(uGround, uSky, smoothstep(0.0, 1.0, n.y * 0.5 + 0.5));
        float key = smoothstep(-0.35, 0.85, dot(n, uMoonDir)) * mix(uStyle.z, 1.0, sunShadow(vW + n * 0.1 + uMoonDir * 0.05));
        vec3 c = vec3(0.035, 0.035, 0.04) * (amb + uMoonCol * key + streetLight(vW, n)) * 3.0;
        vec3 R = reflect(-V, n);
        c += pow(max(dot(R, uMoonDir), 0.0), 14.0) * uMoonCol * 0.28;    // (the rubber's sheen: broad and soft)
        c += (uSky * 0.5 + streetLight(vW, n) * 0.25) * 0.12 * pow(1.0 - max(dot(n, V), 0.0), 3.0);   // (and the sky along its edge)
        gl_FragColor = vec4(fogIt(c, vW), 1.0); }`,
  });
}

// ---------------------------------------------------------------- the deck's things (SHIBUYA SKY as it is)
// the heliport's top: artificial turf, its markings in yellow paint as the photographs have them — the edge lined, a
// big circle and the H in it, the long arrows of the way in; lit as the deck is (dim green at night)
function turfMesh(W, H, top) {
  const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 1024, 1024);
  g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'butt';
  g.lineWidth = 14; g.strokeRect(30, 30, 964, 964);
  g.lineWidth = 22; g.beginPath(); g.arc(512, 470, 250, 0, Math.PI * 2); g.stroke();
  g.font = '900 330px Helvetica Neue, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', 512, 485);
  g.lineWidth = 26; for (const y of [800, 900]) { g.beginPath(); g.moveTo(170, y - 150); g.lineTo(512, y); g.lineTo(854, y - 150); g.stroke(); }   // (the arrows, pointing the way in)
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 8; tex.colorSpace = THREE.NoColorSpace;
  const a = W(H.u0, H.v0, top + 0.004), b = W(H.u1, H.v0, top + 0.004), cc = W(H.u1, H.v1, top + 0.004), d = W(H.u0, H.v1, top + 0.004);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute([a, b, cc, a, cc, d].flatMap(p => [p.x, p.y, p.z]), 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
  const m = new THREE.ShaderMaterial({ name: 'turf', uniforms: { ...U, uMark: { value: tex } }, polygonOffset: true, polygonOffsetFactor: -2,
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${GLSL_COMMON} uniform sampler2D uMark; varying vec2 vUv; varying vec3 vW;
      void main(){
        float blades = 0.82 + 0.18 * hash12(floor(vW.xz * 60.0)) * (1.0 - smoothstep(4.0, 14.0, distance(vW, cameraPosition)));
        float rows = 0.94 + 0.06 * step(0.5, fract(dot(vW.xz, vec2(0.37, 0.93)) * 0.5));   // (the turf laid in strips, a little two-tone)
        vec3 grass = vec3(0.16, 0.36, 0.12) * blades * rows * (0.9 + 0.2 * vnoise(vW.xz * 0.4));
        float mk = texture2D(uMark, vUv).r;
        vec3 base = mix(grass, vec3(0.95, 0.76, 0.06), mk);
        vec3 c = cleanColour(base) * toonLight(vec3(0.0, 1.0, 0.0), vW);
        { vec3 V = normalize(cameraPosition - vW); float f = pow(1.0 - max(V.y, 0.0), 4.0);   // (in the rain: the turf dark with water, the paint glossy)
          c = c * (1.0 - uWet * (0.42 - 0.2 * mk)) + (uSky * 0.9 + vec3(0.02, 0.025, 0.035)) * f * uWet * (0.25 + 0.5 * mk); }
        gl_FragColor = vec4(fogIt(c, vW), 1.0); }` });
  const mesh = new THREE.Mesh(geo, m); mesh.matrixAutoUpdate = false; mesh.userData.noInk = true; return mesh;
}
// the GEO COMPASS: Tokyo in the middle, the rings of distance, the cities round it at their true bearing and distance
// (great circle, worked out here) — the world as an azimuthal equidistant map would place them; the coasts are not
// drawn (only the rose, the rings, the cities)
function compassMesh(c, r, yaw) {
  const T = [35.68, 139.69], CITIES = [['NEW YORK', 40.71, -74.0], ['LONDON', 51.51, -0.13], ['PARIS', 48.86, 2.35], ['SYDNEY', -33.87, 151.21], ['LOS ANGELES', 34.05, -118.24],
    ['BEIJING', 39.9, 116.4], ['SINGAPORE', 1.35, 103.82], ['HONOLULU', 21.31, -157.86], ['MOSCOW', 55.76, 37.62], ['CAPE TOWN', -33.92, 18.42], ['RIO DE JANEIRO', -22.91, -43.17],
    ['DUBAI', 25.2, 55.27], ['SEOUL', 37.57, 126.98], ['BANGKOK', 13.76, 100.5], ['SAN FRANCISCO', 37.77, -122.42], ['CAIRO', 30.04, 31.24]];
  const rad = Math.PI / 180, R = 6371;
  const bd = ([la, lo]) => { const p1 = T[0] * rad, p2 = la * rad, dl = (lo - T[1]) * rad; const d = Math.acos(Math.min(1, Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl))) * R; const b = Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)); return [b, d]; };
  const cv = document.createElement('canvas'); cv.width = cv.height = 1024; const g = cv.getContext('2d'), O = 512, Rm = 490, k = Rm / 20015;   // (the whole world: the far side of it at the rim)
  g.fillStyle = '#1d2733'; g.beginPath(); g.arc(O, O, Rm, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(200,220,240,0.55)'; g.lineWidth = 2; for (const km of [2500, 5000, 7500, 10000, 12500, 15000, 17500]) { g.beginPath(); g.arc(O, O, km * k, 0, Math.PI * 2); g.stroke(); }
  g.fillStyle = 'rgba(210,225,240,0.8)'; g.font = '600 16px Helvetica Neue, Arial'; g.textAlign = 'left'; for (const km of [5000, 10000, 15000]) g.fillText(km.toLocaleString() + ' km', O + 6, O - km * k - 4);
  g.strokeStyle = 'rgba(230,240,255,0.7)'; g.lineWidth = 3; for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; g.beginPath(); g.moveTo(O, O); g.lineTo(O + Math.sin(a) * Rm, O - Math.cos(a) * Rm); g.globalAlpha = i % 4 ? 0.35 : 0.9; g.stroke(); } g.globalAlpha = 1;
  g.fillStyle = '#fff'; g.font = '800 46px Helvetica Neue, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; [['N', 0], ['E', 1], ['S', 2], ['W', 3]].forEach(([t, i]) => g.fillText(t, O + Math.sin(i * Math.PI / 2) * (Rm - 34), O - Math.cos(i * Math.PI / 2) * (Rm - 34)));
  g.font = '700 19px Helvetica Neue, Arial';
  for (const [name, la, lo] of CITIES) { const [b, d] = bd([la, lo]), x = O + Math.sin(b) * d * k, y = O - Math.cos(b) * d * k; g.fillStyle = '#ffd466'; g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.fillText(name, x, y - 16); g.fillStyle = 'rgba(220,230,240,0.85)'; g.fillText(Math.round(d).toLocaleString() + ' km', x, y + 16); }
  g.fillStyle = '#ff5a4a'; g.beginPath(); g.arc(O, O, 9, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.font = '800 24px Helvetica Neue, Arial'; g.fillText('TOKYO', O, O + 28);
  const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 8; tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.CircleGeometry(r, 64).rotateX(-Math.PI / 2);
  geo.translate(c.x, c.y, c.z);                                       // (the canvas's top, its north, lies to the north: −z)
  const m = new THREE.ShaderMaterial({ name: 'geo compass', uniforms: { ...U, uMap: { value: tex } }, polygonOffset: true, polygonOffsetFactor: -3,
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${GLSL_COMMON} uniform sampler2D uMap; varying vec2 vUv; varying vec3 vW;
      void main(){ vec3 t = texture2D(uMap, vUv).rgb; float night = uLightsOn * (1.0 - uDay);
        vec3 c = t * toonLight(vec3(0.0, 1.0, 0.0), vW) + t * night * 0.55;   // (lit from within at night, low)
        gl_FragColor = vec4(fogIt(c, vW), 1.0); }` });
  const mesh = new THREE.Mesh(geo, m); mesh.matrixAutoUpdate = false; mesh.userData.noInk = true; return mesh;
}
// a cloud hammock: a white net slung low between four short white posts, sagging in the middle (its net: netMesh)
function hammock(K, c, yaw) {
  const a = 2.0, b = 1.25, geo = new THREE.PlaneGeometry(a * 2, b * 2, 20, 12).rotateX(-Math.PI / 2), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) / a, z = p.getZ(i) / b, e = Math.max(0, 1 - x * x * 0.85 - z * z * 0.8); p.setY(i, 0.58 - 0.34 * Math.sqrt(e) + 0.05 * (x * x + z * z)); }
  geo.computeVertexNormals(); geo.rotateY(yaw); geo.translate(c.x, c.y, c.z);
  const cs = Math.cos(yaw), sn = Math.sin(yaw), corner = (dx, dz) => [c.x + dx * cs + dz * sn, c.z - dx * sn + dz * cs];
  for (const [dx, dz] of [[-a, -b], [a, -b], [a, b], [-a, b]]) { const [x, z] = corner(dx, dz); K.cyl('metal', 0.04, 0.04, 0.66, at(x, c.y + 0.33, z), '#f2f3f5', 8); }
  for (const [p0, p1] of [[[-a, -b], [a, -b]], [[a, -b], [a, b]], [[a, b], [-a, b]], [[-a, b], [-a, -b]]]) { const [x0, z0] = corner(...p0), [x1, z1] = corner(...p1), L = Math.hypot(x1 - x0, z1 - z0); K.box('metal', L, 0.06, 0.06, at((x0 + x1) / 2, c.y + 0.64, (z0 + z1) / 2, Math.atan2(-(z1 - z0), x1 - x0)), '#f2f3f5'); }   // (the frame round its edge)
  return geo;
}
// the nets: white cord in a lozenge mesh, the city seen through between, a little light caught in it
function netMesh(geos) {
  const g = mergeGeometries(geos.map(x => { x.deleteAttribute('uv'); return x; }));
  const m = new THREE.ShaderMaterial({ name: 'hammock net', uniforms: { ...U }, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vN, vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${GLSL_COMMON} varying vec3 vN, vW;
      void main(){ vec2 q = vec2(vW.x + vW.z, vW.x - vW.z) / 0.11, f = abs(fract(q) - 0.5), fw = fwidth(q);
        float cord = max(1.0 - smoothstep(0.06, 0.06 + fw.x, f.x), 1.0 - smoothstep(0.06, 0.06 + fw.y, f.y));
        float far = smoothstep(0.08, 0.3, max(fw.x, fw.y)); cord = mix(cord, 0.45, far);   // (far off: the net as a pale veil)
        if (cord < 0.3) discard;
        vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
        vec3 c = cleanColour(vec3(0.93, 0.94, 0.95)) * toonLight(n, vW);
        gl_FragColor = vec4(fogIt(c, vW), 1.0); }` });
  const mesh = new THREE.Mesh(g, m); mesh.matrixAutoUpdate = false; mesh.userData.noInk = true; return mesh;
}
// a low outdoor sofa, its back to the platform, facing east: a frame, two seat cushions, two back cushions, arms
function sofa(K, c, yaw) {
  const cs = Math.cos(yaw), sn = Math.sin(yaw), P = (dx, dz) => [c.x + dx * cs + dz * sn, c.z - dx * sn + dz * cs], fabric = '#8d877e', frame = '#3a3836';
  { const [x, z] = P(0, 0); K.box('solid', 2.1, 0.2, 0.9, at(x, c.y + 0.12, z, yaw), frame); }
  for (const dx of [-0.5, 0.5]) { const [x, z] = P(dx, 0.06); K.box('solid', 0.96, 0.16, 0.74, at(x, c.y + 0.3, z, yaw), fabric); const [bx, bz] = P(dx, -0.36); K.box('solid', 0.96, 0.42, 0.18, at(bx, c.y + 0.55, bz, yaw), fabric); }
  for (const dx of [-1.02, 1.02]) { const [x, z] = P(dx, 0); K.box('solid', 0.12, 0.52, 0.9, at(x, c.y + 0.28, z, yaw), frame); }
}
// the searchlights' domes: clear acrylic bubbles over each lamp, a glint on each
function domeMesh(points) {
  const base = new THREE.SphereGeometry(0.48, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.58), geos = points.map(p => base.clone().translate(p.x, p.y - 0.5, p.z));
  const g = mergeGeometries(geos);
  const m = new THREE.ShaderMaterial({ name: 'domes', uniforms: { ...U }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vN, vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${GLSL_COMMON} varying vec3 vN, vW; void main(){ vec3 n = normalize(vN), V = normalize(cameraPosition - vW); float f = pow(1.0 - abs(dot(n, V)), 3.0);
      vec3 c = (uSky * 0.9 + vec3(0.25, 0.3, 0.38) * (1.0 - uDay) + streetLight(vW, n) * 0.4) * (0.4 + 1.2 * f); gl_FragColor = vec4(c, 0.08 + 0.5 * f); }` });
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 6; mesh.userData.noInk = true; mesh.matrixAutoUpdate = false; return mesh;
}
