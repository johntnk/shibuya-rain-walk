// SHIBUYA SKY inside, as it is (docs/research/调研-SHIBUYA SKY屋顶夜景与室内.md; the official map of its spaces — the site's
// about_area svg — and the photographs on Commons, Category:Sky_Gallery):
//   the TRANSITION POD  the lift from 14F to 45F: a dark car whose whole ceiling is one picture, light streaming and
//                       spiralling in time with the car's speed
//   45F                 pitch dark, a white line of light on the floor showing the way
//   LEADING LINE        the escalator up to 46F in a narrow dark tunnel, blue-grey metal walls, thin lines of light down
//                       their joints and along its top; it comes up on the north side (the official map), into the light
//   46F SKY GALLERY     a ring round the building's core, wide and dark: a blue-grey carpet; the ceiling left open and
//                       black — its beams, a duct, square light boxes in a row near the glass, thin lines of light cut
//                       across it at a slant; the glass floor to ceiling in slim black frames, a mirror-faced slope over
//                       it that gives back the city; big black columns standing in from the glass, each with its
//                       compass point and the landmarks that way; at the corner over the crossing, a bay of mirrors
//                       (its ceiling and side) where the street below is seen again overhead. Along the east side
//                       DATA SCAPE (a long LED wall of the city's data) and PARALLEL WINDOWS (three screens set like
//                       windows, a ring of light on the floor before each); on the north, TIME RIVER (ten screens in a
//                       row); the lifts down and the lockers; on the south Paradise Lounge (a long bar, neon, red sofas
//                       to the windows). Its doors to the escalators' foot (the roof) are the lit glass doors there.
// Built in the roof's frame (u along its west edge from the north, v in from it; skystage.js) under the deck, kept out of
// the escalators' run and the space north of it (the run's own look is the roof's, and stays as it was): the floor at
// the escalators' lower landing (SKY.YLOW), the ceiling 3.9 m over it; 45F 4.9 m below.
// Not known, and so placed: where along each side each thing stands, the sizes of the rooms.
import * as THREE from 'three';
import { Kit, at } from './kit.js';
import { U, GLSL_COMMON, col } from './materials.js';

export class SkyGallery {
  constructor(stage, SKY, RUN, glassMesh) {
    const F = stage.F, yaw = F.yaw, Y0 = SKY.YLOW, CEIL = Y0 + 3.9, Y45 = Y0 - 4.9, HEAD = Y0 + 3.2;
    Object.assign(this, { F, yaw, Y0, CEIL, Y45, RUN });
    const W = (u, v, y = 0) => { const [x, z] = F.toW(u, v); return new THREE.Vector3(x, y, z); };
    const box = (K, kind, u0, u1, v0, v1, y0, y1, c) => { const [x, z] = F.toW((u0 + u1) / 2, (v0 + v1) / 2); K.box(kind, Math.abs(v1 - v0), y1 - y0, Math.abs(u1 - u0), at(x, (y0 + y1) / 2, z, yaw), c); };
    const fy = (du, dv) => Math.atan2(du * F.ux + dv * F.vx, du * F.uz + dv * F.vz);   // (the yaw that faces a thing that way in the frame)
    this.W = W;
    const KG = new Kit(), KT = new Kit(), KP = new Kit();
    const windowsLines = [];                                             // (the window lines, for the light coming in: [u0, v0, u1, v1])
    this.group = new THREE.Group(); this.group.name = 'SKY GALLERY';
    // ---------------------------------------------------------------- the plan: the ring's sides as rectangles (u0, u1, v0, v1)
    this.rects = [
      [-10.0, -0.35, 9.45, 14.9],                                      // the north-west end: the mirror bay
      [-0.35, 21.8, 9.45, 14.9],                                       // along the escalators' run (behind its wall): the doors out to it
      [21.8, 49.0, 0.35, 14.9],                                        // the west side: the sunset windows, the lifts down, the lockers; the lounge at its south end
      [-10.0, -4.6, 14.9, 50.4],                                       // the north side: where the LEADING LINE comes up; TIME RIVER
      [-10.0, 49.0, 45.0, 50.4],                                       // the east side: DATA SCAPE, PARALLEL WINDOWS
      [44.0, 49.0, 14.9, 50.4],                                        // the south side: Paradise Lounge
    ];
    const carpet = '#363c48', ceil = '#121316';
    for (const [u0, u1, v0, v1] of this.rects) { box(KG, 'solid', u0, u1, v0, v1, Y0 - 0.15, Y0, carpet); box(KG, 'solid', u0, u1, v0, v1, CEIL, CEIL + 0.1, ceil); }
    // ---------------------------------------------------------------- the glass: floor to ceiling in slim black frames every
    // 1.8 m, a big black column standing in from it every so often; over it a slope of mirror to the ceiling
    const panels = [], faces = [], soffits = [], cols = [];
    const lines = [[[-10.0, 9.45], [-10.0, 50.4], 'NORTH'], [[21.8, 0.35], [49.0, 0.35], 'WEST'], [[49.0, 0.35], [49.0, 50.4], 'SOUTH'], [[-10.0, 50.4], [49.0, 50.4], 'EAST']];
    for (const [[ua, va], [ub, vb], name] of lines) {
      windowsLines.push([ua, va, ub, vb]);
      const L = Math.hypot(ub - ua, vb - va), du = (ub - ua) / L, dv = (vb - va) / L, nU = ua === ub ? (ua < 0 ? 1 : -1) : 0, nV = va === vb ? (va < 1 ? 1 : -1) : 0;   // (inward)
      const n = Math.max(1, Math.round(L / 1.8));
      for (let k = 0; k <= n; k++) {
        const u = ua + du * L * k / n, v = va + dv * L * k / n;
        if (ua === ub) box(KG, 'solid', u, u + nU * 0.22, v - 0.04, v + 0.04, Y0, HEAD, '#0d0e11'); else box(KG, 'solid', u - 0.04, u + 0.04, v, v + nV * 0.22, Y0, HEAD, '#0d0e11');
        if (k < n) { const u1 = ua + du * L * (k + 1) / n, v1 = va + dv * L * (k + 1) / n; panels.push([W(u, v), W(u1, v1), Y0 + 0.02, HEAD]); }
      }
      // over the glass, under its head, a band of mirror 1 m deep (flat: from inside it gives back the city below, beyond the
      // glass, and the heads of those at it), its edge closed up to the ceiling in black
      for (let s = 0; s < L - 0.01; s += 3.6) { const s1 = Math.min(L, s + 3.6); soffits.push([W(ua + du * s, va + dv * s, HEAD), W(ua + du * s1, va + dv * s1, HEAD), W(ua + du * s1 + nU * 1.0, va + dv * s1 + nV * 1.0, HEAD), W(ua + du * s + nU * 1.0, va + dv * s + nV * 1.0, HEAD), W(-nU, -nV).sub(W(0, 0)).normalize()]); }
      if (ua === ub) box(KG, 'solid', ua + nU * 0.98, ua + nU * 1.02, va, vb, HEAD, CEIL, '#0d0e11'); else box(KG, 'solid', ua, ub, va + nV * 0.98, va + nV * 1.02, HEAD, CEIL, '#0d0e11');
      // the black columns, every ~12 m, 0.7 m in from the glass, their compass point on their room side
      const cs = []; for (let s = 6; s < L - 3; s += 12) { const u = ua + du * s + nU * 1.25, v = va + dv * s + nV * 1.25; cs.push(s); box(KG, 'solid', u - 0.55, u + 0.55, v - 0.55, v + 0.55, Y0, CEIL, '#0b0b0d'); cols.push({ u, v, p: W(u + nU * 0.565, v + nV * 0.565, Y0 + 2.25), yaw: fy(nU, nV), name }); }
      // the light boxes in a row 1.6 m in from the glass, under the ceiling (not into the columns)
      for (let s = 1.8; s < L - 0.9; s += 3.6) { if (cs.some(c => Math.abs(c - s) < 1.0)) continue; const u = ua + du * s + nU * 1.6, v = va + dv * s + nV * 1.6; box(KG, 'glow', u - 0.32, u + 0.32, v - 0.32, v + 0.32, CEIL - 0.06, CEIL - 0.02, col('#f3f0ea', 1.25)); }
      const out = new THREE.Vector3().subVectors(W(ua - nU, va - nV), W(ua, va)).normalize(), p0 = W(ua, va, Y0 + 1.6), mids = [];
      for (let s = 1.3; s < L; s += 2.6) mids.push(W(ua + du * s, va + dv * s, Y0 + 1.6));
      faces.push({ n: out, d: out.x * p0.x + out.z * p0.z, mids, y: Y0 + 1.6 });
    }
    this.columns = cols;
    // ---------------------------------------------------------------- the ceiling left open: beams across each side every 3.6 m,
    // a duct along it, thin lines of light cut across at a slant
    const R = (a => () => (a = (a * 16807) % 2147483647) / 2147483647)(4646);
    for (const [ri, [u0, u1, v0, v1]] of this.rects.entries()) {
      const alongU = u1 - u0 > v1 - v0, L = alongU ? u1 - u0 : v1 - v0, w = alongU ? v1 - v0 : u1 - u0;
      for (let s = 1.8; s < L; s += 3.6) { if (alongU) box(KG, 'solid', u0 + s - 0.15, u0 + s + 0.15, v0, v1, CEIL - 0.42, CEIL, '#0c0d0f'); else box(KG, 'solid', u0, u1, v0 + s - 0.15, v0 + s + 0.15, CEIL - 0.42, CEIL, '#0c0d0f'); }
      if (ri > 0) { const [x0, z0] = alongU ? F.toW(u0, (v0 + v1) / 2 + w * 0.12) : F.toW((u0 + u1) / 2 - w * 0.12, v0), [x1, z1] = alongU ? F.toW(u1, (v0 + v1) / 2 + w * 0.12) : F.toW((u0 + u1) / 2 - w * 0.12, v1), Ld = Math.hypot(x1 - x0, z1 - z0);
        KG.cyl('metal', 0.24, 0.24, Ld, at((x0 + x1) / 2, CEIL - 0.6, (z0 + z1) / 2, Math.atan2(x1 - x0, z1 - z0), Math.PI / 2), '#16171a', 10); }
      for (let s = 2; s < L - 4; s += 9 + R() * 8) {                  // (the lines of light: across at a slant, as the photographs have them)
        const a = (R() < 0.5 ? 1 : -1) * (0.35 + R() * 0.35), len = w / Math.cos(a) * 0.95, cU = alongU ? u0 + s : (u0 + u1) / 2, cV = alongU ? (v0 + v1) / 2 : v0 + s;
        const [x, z] = F.toW(cU, cV), dir = alongU ? fy(Math.sin(a), Math.cos(a)) : fy(Math.cos(a), Math.sin(a));
        KG.box('glow', 0.025, 0.02, len, at(x, CEIL - 0.45, z, dir), col('#f4f6ff', 2.0));
      }
    }
    // ---------------------------------------------------------------- the inner walls: black
    const wall = (u0, u1, v0, v1, y0 = Y0, y1 = CEIL, c = '#18191d') => box(KG, 'solid', u0, u1, v0, v1, y0, y1, c);
    // the core in the middle; the LEADING LINE's mouth in its north face (the official map: up on the north side)
    const LV = 30.0;                                                  // (the tunnel's escalator: its lane's middle, in v)
    this.lane = LV;
    wall(-4.6, 44.0, 14.9, 15.1); wall(-4.6, 44.0, 44.8, 45.0);
    wall(-4.6, -4.4, 14.9, LV - 1.3); wall(-4.6, -4.4, LV + 1.3, 45.0); wall(-4.6, -4.4, LV - 1.3, LV + 1.3, Y0 + 2.7, CEIL);
    wall(43.8, 44.0, 14.9, 45.0);
    // along the run: black (the run's white wall is its other face); the north-west end's side, black
    wall(-0.35, 21.8, 9.45, 9.6); wall(-10.0, -0.35, 9.45, 9.6); wall(21.8, 21.95, 0.35, 9.6);
    // the doors out to the escalators' foot: glass, the day or the night beyond (main.js: E to go through)
    this.doorIn = W((RUN.door0 + RUN.door1) / 2, 10.5, Y0);
    for (const u of [RUN.door0, (RUN.door0 + RUN.door1) / 2, RUN.door1]) box(KG, 'metal', u - 0.05, u + 0.05, 9.6, 9.68, Y0, Y0 + 2.5, '#2f343c');
    box(KG, 'metal', RUN.door0 - 0.05, RUN.door1 + 0.05, 9.6, 9.68, Y0 + 2.45, Y0 + 2.6, '#2f343c');
    { const p = W((RUN.door0 + RUN.door1) / 2, 9.62, Y0 + 1.22), g = new THREE.PlaneGeometry(RUN.door1 - RUN.door0 - 0.1, 2.42); g.rotateY(fy(0, 1)); g.translate(p.x, p.y, p.z); const m = new THREE.Mesh(g, doorLightMat()); m.userData.noInk = true; this.group.add(m); }
    // ---------------------------------------------------------------- the mirror bay at the north-west end (the corner over the
    // crossing: the street seen again in the mirror overhead)
    const mirrors = [];
    const north = W(-1, 0).sub(W(0, 0)).normalize();
    mirrors.push([W(-10.0, 9.62, CEIL - 0.7), W(-6.0, 9.62, CEIL - 0.7), W(-6.0, 14.4, CEIL - 0.7), W(-10.0, 14.4, CEIL - 0.7), north]);   // (its ceiling)
    mirrors.push([W(-10.0, 9.62, Y0), W(-6.0, 9.62, Y0), W(-6.0, 9.62, CEIL - 0.7), W(-10.0, 9.62, CEIL - 0.7), north]);           // (its side)
    box(KG, 'solid', -6.05, -5.95, 9.6, 14.4, CEIL - 0.7, CEIL, '#0d0e11');
    this.mirrorPlanes = [{ kind: 'head', n: new THREE.Vector3(0, 1, 0), d: HEAD, p: W(-8, 12, HEAD) },   // (the bands over the glass and the bay's ceiling: one plane — the roof glass's mirror, re-aimed)
      { kind: 'bay side', n: W(0, -1).sub(W(0, 0)).normalize(), d: W(0, -1).sub(W(0, 0)).normalize().dot(W(-8, 9.62)), p: W(-8, 9.62, Y0 + 1.6) }];   // (its own mirror: main.js)
    { const m = this.mirrorPlanes[1]; SIDE.uSidePlane.value.set(m.n.x, 0, m.n.z, m.d); }
    // ---------------------------------------------------------------- the lifts down (the west side, on the core), the lockers
    this.liftAt = W(34.2, 13.6, Y0);
    for (const u0 of [32.6, 34.6]) {
      box(KG, 'metal', u0 - 0.12, u0 + 1.32, 14.78, 14.9, Y0, Y0 + 2.45, '#9aa0a8');
      box(KG, 'metal', u0, u0 + 0.6, 14.74, 14.8, Y0, Y0 + 2.3, '#3a3e45'); box(KG, 'metal', u0 + 0.6, u0 + 1.2, 14.74, 14.8, Y0, Y0 + 2.3, '#3a3e45');
      box(KG, 'glow', u0, u0 + 1.2, 14.72, 14.76, Y0 + 2.5, Y0 + 2.53, col('#e8f0ff', 1.6));
    }
    for (let u = 37.4; u < 43.5; u += 0.42) for (let y = Y0 + 0.1; y < Y0 + 2.0; y += 0.47) box(KG, 'metal', u, u + 0.4, 14.76, 14.9, y, y + 0.45, '#5b616b');
    // ---------------------------------------------------------------- TIME RIVER: ten screens in a row, on the core's north face
    this.screens = [];
    { const P = [], UV = [], u = -4.675;
      for (let k = 0; k < 10; k++) { const v0 = 33.0 + k * 1.15, v1 = v0 + 1.11, y0 = Y0 + 1.0, y1 = Y0 + 1.63, q = [W(u, v1, y0), W(u, v0, y0), W(u, v0, y1), W(u, v1, y1)], s0 = k / 10, s1 = (k + 0.97) / 10;
        for (const i of [0, 1, 2, 0, 2, 3]) { P.push(q[i].x, q[i].y, q[i].z); UV.push([s0, s1, s1, s0][i], [0, 0, 1, 1][i]); } box(KG, 'solid', -4.66, -4.6, v0 - 0.02, v1 + 0.02, y0 - 0.02, y1 + 0.02, '#050506'); }
      this.screens.push(screenMesh(P, UV, 0, 1.0, 'time river')); }
    // DATA SCAPE: the long LED wall on the core's east face
    { const P = [], UV = [], y0 = Y0 + 1.95, y1 = Y0 + 2.95, q = [W(-4.0, 45.03, y0), W(40.0, 45.03, y0), W(40.0, 45.03, y1), W(-4.0, 45.03, y1)];
      for (const i of [0, 1, 2, 0, 2, 3]) { P.push(q[i].x, q[i].y, q[i].z); UV.push([0, 1, 1, 0][i], [0, 0, 1, 1][i]); }
      this.screens.push(screenMesh(P, UV, 1, 44.0, 'data scape')); }
    // PARALLEL WINDOWS: three screens set like windows on the east side, a ring of light on the floor before each
    this.fix = [];
    { const P = [], UV = [];
      for (let k = 0; k < 3; k++) {
        const u0 = 10.4 + k * 3.2, u1 = u0 + 1.6, v = 48.6, y0 = Y0 + 0.5, y1 = Y0 + 2.6, q = [W(u0, v, y0), W(u1, v, y0), W(u1, v, y1), W(u0, v, y1)];
        for (const i of [0, 1, 2, 0, 2, 3]) { P.push(q[i].x, q[i].y, q[i].z); UV.push([k / 3, (k + 1) / 3, (k + 1) / 3, k / 3][i], [0, 0, 1, 1][i]); }
        box(KG, 'solid', u0 - 0.08, u1 + 0.08, v + 0.02, v + 0.2, Y0, Y0 + 2.7, '#0b0c0e');
        const [x, z] = F.toW((u0 + u1) / 2, v - 1.4); KG.cyl('glow', 0.75, 0.75, 0.006, at(x, Y0 + 0.004, z), col('#f2f2ff', 0.6), 32); KG.cyl('solid', 0.68, 0.68, 0.008, at(x, Y0 + 0.006, z), carpet, 32);
        this.fix.push([u0 - 0.1, u1 + 0.1, v - 0.05, v + 0.25]);
      }
      this.screens.push(screenMesh(P, UV, 2, 3.0, 'parallel windows')); }
    // ---------------------------------------------------------------- Paradise Lounge, the south side: the bar along the core
    // (15 m, its back lit, the bottles), the DJ's booth at its end, neon over it, red sofas facing the windows
    box(KG, 'solid', 44.5, 45.3, 16.0, 31.0, Y0, Y0 + 1.08, '#24191a'); box(KG, 'metal', 44.45, 45.35, 15.95, 31.05, Y0 + 1.08, Y0 + 1.12, '#121014');
    box(KG, 'glow', 45.3, 45.33, 16.0, 31.0, Y0 + 0.06, Y0 + 0.1, col('#ffb070', 1.4));
    for (let y = Y0 + 1.25; y < Y0 + 2.6; y += 0.42) { box(KG, 'glow', 44.0, 44.08, 16.2, 30.8, y, y + 0.02, col('#ffcf96', 1.5)); for (let v = 16.4; v < 30.8; v += 0.21) if ((v * 7.3 + y * 3.1) % 1 > 0.35) box(KG, 'glow', 44.08, 44.16, v, v + 0.06, y + 0.03, y + 0.3, col(['#c7e8ff', '#ffd27a', '#ff9a7a', '#d0ffd0'][Math.floor((v * 13 + y * 5) % 4)], 0.7)); }
    box(KG, 'solid', 44.4, 46.0, 31.6, 33.6, Y0, Y0 + 1.15, '#18181c'); for (let v = 31.8; v < 33.4; v += 0.18) box(KG, 'glow', 45.95, 46.0, v, v + 0.06, Y0 + 0.9, Y0 + 0.95, col(v % 0.36 > 0.18 ? '#ff4fa0' : '#4fe0ff', 1.4));
    for (const [c, off] of [['#ff3d8b', 0.0], ['#3de0ff', 0.25]]) box(KG, 'glow', 45.0 + off, 45.06 + off, 16.0, 33.6, CEIL - 0.5 - off * 0.4, CEIL - 0.46 - off * 0.4, col(c, 1.8));
    for (const c of cols) this.fix.push([c.u - 0.6, c.u + 0.6, c.v - 0.6, c.v + 0.6]);   // (the columns: in the way)
    this.fix.push([44.3, 45.5, 15.8, 31.2], [44.2, 46.2, 31.4, 33.8]);
    const clear = r => !this.fix.some(f => r[0] < f[1] && r[1] > f[0] && r[2] < f[3] && r[3] > f[2]);
    this.sofas = [];
    for (let v = 17.4; v < 44; v += 2.6) { const r = [46.8, 48.0, v - 1.05, v + 1.05]; if (!clear(r)) continue; sofaG(KG, box, 47.4, v, 'u+', Y0); this.fix.push(r); this.sofas.push([47.5, v, 1, 0]); }
    for (let u = 36.0; u < 47; u += 2.6) { const r = [u - 1.05, u + 1.05, 1.9, 3.1]; if (!clear(r)) continue; sofaG(KG, box, u, 2.4, 'v-', Y0); this.fix.push(r); this.sofas.push([u, 2.5, 0, -1]); }
    // ---------------------------------------------------------------- 45F: the lift's hall, dark, a white line on the floor
    const U0 = 4.6, U1 = -5.3;                                        // (the tunnel's escalator: its foot at 45F, its top in the gallery's north side)
    const tan = Math.tan(Math.PI / 6), yP = this.yP = u => u >= 4.0 ? Y45 : u <= -4.5 ? Y0 : Y45 + (4.0 - u) * tan;
    box(KT, 'solid', 4.6, 9.2, LV - 1.8, LV + 1.8, Y45 - 0.15, Y45, '#141518'); box(KT, 'solid', 4.6, 9.2, LV - 1.8, LV + 1.8, Y45 + 3.0, Y45 + 3.1, '#0c0d10');
    box(KT, 'solid', 4.6, 9.2, LV - 2.0, LV - 1.8, Y45, Y45 + 3.0, '#1d222b'); box(KT, 'solid', 4.6, 9.2, LV + 1.8, LV + 2.0, Y45, Y45 + 3.0, '#1d222b');
    box(KT, 'solid', 9.15, 9.25, LV - 1.8, LV - 0.55, Y45, Y45 + 3.0, '#1d222b'); box(KT, 'solid', 9.15, 9.25, LV + 0.55, LV + 1.8, Y45, Y45 + 3.0, '#1d222b'); box(KT, 'solid', 9.15, 9.25, LV - 0.55, LV + 0.55, Y45 + 2.3, Y45 + 3.0, '#1d222b');
    box(KT, 'glow', 4.9, 9.1, LV - 0.04, LV + 0.04, Y45 + 0.003, Y45 + 0.01, col('#ffffff', 1.4));
    // the tunnel, 2.5 m wide: blue-grey metal panels, their joints lit, a line of light along its top the whole way
    const quad = (K, a, b, c, d, color, kind = 'solid') => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([a, b, c, a, c, d].flatMap(p => [p.x, p.y, p.z]), 3)); g.computeVertexNormals(); K.add(kind, g, null, color); };
    const US = [5.6, 4.6, 4.0, 3.0, 2.0, 1.0, 0.0, -1.0, -2.0, -3.0, -4.0, -4.5, -5.3];
    for (let i = 0; i < US.length - 1; i++) {
      const u0 = US[i], u1 = US[i + 1], a0 = yP(u0), a1 = yP(u1);
      for (const v of [LV - 1.25, LV + 1.25]) quad(KT, W(u0, v, a0 - 1.4), W(u1, v, a1 - 1.4), W(u1, v, a1 + 2.7), W(u0, v, a0 + 2.7), '#2a3442');
      quad(KT, W(u0, LV - 1.25, a0 + 2.7), W(u0, LV + 1.25, a0 + 2.7), W(u1, LV + 1.25, a1 + 2.7), W(u1, LV - 1.25, a1 + 2.7), '#1c232e');
      quad(KT, W(u1, LV - 1.25, a1 - 0.3), W(u1, LV + 1.25, a1 - 0.3), W(u0, LV + 1.25, a0 - 0.3), W(u0, LV - 1.25, a0 - 0.3), '#0b0c0e');
      for (const v of [LV - 1.21, LV + 1.21]) quad(KT, W(u0, v, a0 + 2.62), W(u1, v, a1 + 2.62), W(u1, v, a1 + 2.66), W(u0, v, a0 + 2.66), col('#cfe0ff', 1.7), 'glow');
    }
    for (let u = 4.4; u > -4.8; u -= 1.6) for (const v of [LV - 1.22, LV + 1.22]) quad(KT, W(u, v, yP(u) + 0.05), W(u - 0.03, v, yP(u - 0.03) + 0.05), W(u - 0.03, v, yP(u - 0.03) + 2.6), W(u, v, yP(u) + 2.6), col('#bcd2ff', 1.2), 'glow');
    this.tunnelGlass = [];
    for (const s of [-1, 1]) {
      const v = LV + s * 0.58;
      for (let i = 0; i < US.length - 1; i++) { const u0 = Math.min(5.1, US[i]), u1 = Math.max(-4.9, US[i + 1]); if (u0 <= u1) continue; this.tunnelGlass.push([W(u0, v), W(u1, v), yP(u0) + 0.2, yP(u0) + 0.95, yP(u1) + 0.2, yP(u1) + 0.95, true]); quad(KT, W(u0, LV + s * 0.52, yP(u0) - 0.1), W(u1, LV + s * 0.52, yP(u1) - 0.1), W(u1, LV + s * 0.52, yP(u1) + 0.18), W(u0, LV + s * 0.52, yP(u0) + 0.18), '#9aa0a8', 'metal'); }
      const pts = []; for (let u = 5.1; u >= -4.9; u -= 0.25) pts.push(W(u, v, yP(u) + 0.98));
      KT.add('solid', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.042, 16), null, '#141416');
    }
    box(KT, 'solid', 4.6, 5.3, LV - 1.25, LV - 0.55, Y45 - 0.1, Y45, '#141518'); box(KT, 'solid', 4.6, 5.3, LV + 0.55, LV + 1.25, Y45 - 0.1, Y45, '#141518');
    box(KT, 'solid', -5.3, -4.4, LV - 1.25, LV + 1.25, Y0 - 0.1, Y0, carpet); box(KT, 'solid', -4.5, -3.9, LV - 1.25, LV - 0.55, Y0 - 0.1, Y0, carpet); box(KT, 'solid', -4.5, -3.9, LV + 0.55, LV + 1.25, Y0 - 0.1, Y0, carpet);
    for (const [u, y] of [[5.15, Y45], [-4.95, Y0]]) box(KT, 'solid', u - 0.09, u + 0.09, LV - 0.5, LV + 0.5, y, y + 0.03, '#f2c200');
    // the moving steps
    const tm = tunnelMat(), gm = galleryMat(F, Y0, CEIL, windowsLines), pm = podMat();
    this.steps = tunnelSteps(W, yaw, LV, yP, U0, U1, tm);
    this.group.add(this.steps.mesh);
    this.fix.push([-5.4, -4.4, LV - 1.4, LV - 1.1], [-5.4, -4.4, LV + 1.1, LV + 1.4]);
    this.arrive = { p: W(-6.4, LV, Y0), face: Math.atan2(-F.ux, -F.uz) };   // (stepped off at the top: in the north side, facing its windows)
    this.tunnelFace = Math.atan2(-F.ux, -F.uz);
    // the hexagonal hall at the tunnel's top (the official map): its faceted soffit, a line of light round it
    { const c = W(-7.2, LV, CEIL - 0.35), r = 2.4; for (let k = 0; k < 6; k++) { const a0 = k * Math.PI / 3, a1 = a0 + Math.PI / 3, p0 = W(-7.2 + Math.cos(a0) * r, LV + Math.sin(a0) * r, CEIL - 0.35), p1 = W(-7.2 + Math.cos(a1) * r, LV + Math.sin(a1) * r, CEIL - 0.35);
      const m = p0.clone().add(p1).multiplyScalar(0.5); KG.box('glow', 0.03, 0.03, p0.distanceTo(p1), at(m.x, m.y, m.z, Math.atan2(p1.x - p0.x, p1.z - p0.z)), col('#eef2ff', 1.6)); quad(KG, c, p0, p1, c, '#16171b'); quad(KG, c, p1, p0, c, '#16171b'); } }
    // ---------------------------------------------------------------- the lift's car (TRANSITION POD), behind the hall's doors
    const C = this.car = { u0: 9.25, u1: 12.0, v0: LV - 1.4, v1: LV + 1.4, y0: Y45, y1: Y45 + 2.6 };
    box(KP, 'solid', C.u0, C.u1, C.v0, C.v1, C.y0 - 0.1, C.y0, '#111215');
    box(KP, 'solid', C.u0, C.u1, C.v0 - 0.1, C.v0, C.y0, C.y1, '#1a1c21'); box(KP, 'solid', C.u0, C.u1, C.v1, C.v1 + 0.1, C.y0, C.y1, '#1a1c21'); box(KP, 'solid', C.u1, C.u1 + 0.1, C.v0, C.v1, C.y0, C.y1, '#1a1c21');
    box(KP, 'solid', C.u0, C.u0 + 0.08, C.v0, LV - 0.55, C.y0, C.y1, '#1a1c21'); box(KP, 'solid', C.u0, C.u0 + 0.08, LV + 0.55, C.v1, C.y0, C.y1, '#1a1c21'); box(KP, 'solid', C.u0, C.u0 + 0.08, LV - 0.55, LV + 0.55, C.y0 + 2.3, C.y1, '#1a1c21');
    box(KP, 'metal', C.u1 - 0.05, C.u1, C.v0 + 0.05, C.v1 - 0.05, C.y0 + 0.9, C.y0 + 0.95, '#7c828a');
    { const a = W(C.u0, C.v0, C.y1), b = W(C.u1, C.v0, C.y1), c = W(C.u1, C.v1, C.y1), d = W(C.u0, C.v1, C.y1); this.ceiling = podCeiling(a, b, c, d); this.group.add(this.ceiling); }
    this.leaves = [];
    for (const s of [-1, 1]) { const g = new THREE.BoxGeometry(0.56, 2.3, 0.035); g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count * 3).fill(0.2), 3)); const m = new THREE.Mesh(g, pm); m.position.copy(W(C.u0 - 0.02, LV + s * 0.28, C.y0 + 1.15)); m.rotation.y = yaw; m.userData.s = s; this.group.add(m); this.leaves.push(m); }
    // ---------------------------------------------------------------- built: each part in its own light
    for (const [K, m] of [[KG, gm], [KT, tm], [KP, pm]]) for (const g of K.build()) { if (g.name !== 'glow') g.material = m; this.group.add(g); }
    this.glass = glassMesh(panels.concat(this.tunnelGlass)); this.glass.userData.noMirror = true; this.group.add(this.glass);
    this.mirrors = [mirrorMesh(soffits, 'soffit'), mirrorMesh(mirrors, 'mirror bay')]; this.group.add(...this.mirrors);
    this.readers = [this.glass, ...this.mirrors];                       // (what reads the mirror's picture: kept out of it)
    for (const s of this.screens) this.group.add(s);
    stage.mirrorFaces.push(...faces);
    // the signs (main.js puts them up: signs.js) — the compass points on the columns, as the photographs show them
    const LANDMARK = { NORTH: 'SHINJUKU  ·  SKYTREE ↗', EAST: 'TOKYO TOWER  ·  ROPPONGI', SOUTH: 'YOKOHAMA  ·  HANEDA', WEST: 'MT. FUJI  ·  SETAGAYA' };
    this.signs = [
      { text: '↓  14F  EXIT', p: W(34.2, 14.68, Y0 + 2.85), yaw: fy(0, -1), w: 2.6, h: 0.32 },
      { text: 'LOCKER  ¥100', p: W(40.5, 14.7, Y0 + 2.3), yaw: fy(0, -1), w: 2.0, h: 0.3 },
      { text: 'SKY STAGE ↑  ROOFTOP', p: W((RUN.door0 + RUN.door1) / 2, 9.7, Y0 + 2.85), yaw: fy(0, 1), w: 2.8, h: 0.32 },
      { text: 'TIME RIVER', p: W(-4.68, 38.8, Y0 + 2.1), yaw: fy(-1, 0), w: 1.8, h: 0.22 },
      { text: 'PARALLEL WINDOWS', p: W(14.4, 48.4, Y0 + 3.0), yaw: fy(0, -1), w: 2.6, h: 0.24 },
      { text: 'Paradise Lounge', p: W(44.2, 23.5, Y0 + 3.05), yaw: fy(1, 0), w: 3.6, h: 0.5, neon: true },
      { text: '46F  SKY GALLERY', p: W(-4.66, LV, Y0 + 3.1), yaw: fy(-1, 0), w: 2.6, h: 0.3 },
      ...cols.flatMap(c => [{ text: c.name, p: c.p, yaw: c.yaw, w: 0.9, h: 0.24 }, { text: LANDMARK[c.name], p: c.p.clone().setY(Y0 + 1.95), yaw: c.yaw, w: 1.0, h: 0.14 }]),
    ];
    this.t = 0;
  }
  inRects(u, v, m = 0) { const In = (a, b) => this.rects.some(([u0, u1, v0, v1]) => a > u0 && a < u1 && b > v0 && b < v1); return In(u, v) && (m <= 0 || (In(u + m, v) && In(u - m, v) && In(u, v + m) && In(u, v - m))); }   // (m: the point that far from every wall — across the joins between rooms too)
  contains(x, z, m = 0) { const [u, v] = this.F.toL(x, z); return this.inRects(u, v, m); }
  fixtureAt(u, v, m = 0.3) { for (const [u0, u1, v0, v1] of this.fix) if (u > u0 - m && u < u1 + m && v > v0 - m && v < v1 + m) return true; return false; }
  camFree(x, y, z) { const [u, v] = this.F.toL(x, z); return y > this.Y0 + 0.3 && y < this.CEIL - 0.55 && this.inRects(u, v, 0.25) && !this.fixtureAt(u, v, 0.22); }   // (the follow camera's test: a little stricter than camOK, so that safety net never has to move it)
  camOK(p) { const [u, v] = this.F.toL(p.x, p.z); return p.y > this.Y0 + 0.3 && p.y < this.CEIL - 0.5 && this.inRects(u, v, 0.2) && !this.fixtureAt(u, v, 0.05); }
  // the one mirror given the true reflection this frame (main.js: the roof's glass mirror, re-aimed): in the mirror bay its
  // ceiling (looking up) or its side; elsewhere the slope over the glass you face, the nearest
  pickMirror() { return this.mirrorPlanes[0]; }
  // is the mirror bay's side in sight from here (its own mirror drawn only then)
  seesBaySide(camera) { const [u, v] = this.F.toL(camera.position.x, camera.position.z); return u < -0.35 && v > 9.6 && v < 24; }
  get sideU() { return SIDE; }
  carEye() { const C = this.car; return this.W(C.u1 - 0.75, this.lane, C.y0 + 1.55); }
  carLook() { const C = this.car; return this.W(C.u0 + 0.2, this.lane, C.y1 - 0.55); }   // (up and ahead: the ceiling over the heads of the others, the doors under it)
  setPod(k, flow, dir, doors) {
    const u = this.ceiling.material.uniforms; u.uBright.value = k; u.uPhase.value += flow * dir; podGlow.value = 0.15 + 0.85 * k;
    for (const m of this.leaves) m.position.copy(this.W(this.car.u0 - 0.02, this.lane + m.userData.s * (0.28 + 0.55 * doors), this.car.y0 + 1.15));
  }
  // the tunnel's escalator: where the path is at distance s from its foot (s < 0: back in the hall below)
  tunnelAt(s) { const u = s < 0 ? Math.min(8.8, 5.6 - s) : this.steps.uAt(s), [x, z] = this.F.toW(u, this.lane); return { u, y: this.yP(u), x, z }; }
  get tunnelLen() { return this.steps.L; }
  update(dt) { this.t += dt; this.steps.update(dt); }
  // the people in it: at its windows (silhouettes against them, as the photographs have them), at TIME RIVER and DATA
  // SCAPE, before PARALLEL WINDOWS, on the lounge's sofas; and in the lift's car
  people(R) {
    const out = [], W = this.W, Y0 = this.Y0, face = (du, dv) => { const a = this.W(0, 0), b = this.W(du, dv); return Math.atan2(b.x - a.x, b.z - a.z); };
    const put = (u, v, du, dv, pose = 1, y = Y0, turn = (R() - 0.5) * 0.5) => { if (!this.inRects(u, v, 0.35) || this.fixtureAt(u, v, 0.2)) return; const p = W(u, v); out.push({ x: p.x, z: p.z, y, face: face(du, dv) + turn, pose, indoor: true }); };
    // at a window line (from (ua, va) to (ub, vb), in from it along (iu, iv)): not a row but as people stand at the glass —
    // alone, in twos turned a little to each other (one of them talking), in threes; some up against it, some a step
    // or two back; a gap now and then (every: metres of glass to a person, on the average)
    const atGlass = (ua, va, ub, vb, iu, iv, every) => {
      const L = Math.hypot(ub - ua, vb - va), tu = (ub - ua) / L, tv = (vb - va) / L;
      for (let s = R() * 1.2; s < L - 0.5;) {
        const r = R(), n = r < 0.45 ? 1 : r < 0.82 ? 2 : 3, back = R() < 0.75 ? 0.55 + R() * 0.45 : 1.3 + R() * 0.9, at = (k, d) => [ua + tu * (s + k) + iu * d, va + tv * (s + k) + iv * d];
        if (n === 1) { const [u, v] = at(0, back); put(u, v, -iu, -iv, R() < 0.12 ? 2 : 1, Y0, (R() - 0.5) * 0.7); }
        else for (let k = 0; k < n; k++) {
          const side = n === 2 ? (k ? 1 : -1) : k - 1, [u, v] = at(k * (0.55 + R() * 0.15), back + (n === 3 && k === 1 ? 0.35 : 0) + (R() - 0.5) * 0.12);
          put(u, v, -iu, -iv, k === 0 || R() < 0.4 ? 2 : 1, Y0, -side * (0.35 + R() * 0.3) + (R() - 0.5) * 0.15);   // (turned to the one beside: half to the view, half to each other)
        }
        s += n * 0.6 + every * n * (0.6 + R() * 0.9);
      }
    };
    atGlass(22.6, 0.35, 38.0, 0.35, 0, 1, 1.15);                                                                 // (the west side, at the sunset windows)
    for (let v = 10.6; v < 14; v += 1.1 + R() * 0.8) put(-9.3 + R() * 0.5, v, -1, 0, R() < 0.4 ? 2 : 1, Y0, (R() - 0.5) * 1.1);   // (in the mirror bay: looking out, up, round at it)
    atGlass(-10.0, 16.0, -10.0, 44.0, 1, 0, 2.2);                                                                // (the north side)
    atGlass(-6.0, 50.4, 42.0, 50.4, 0, -1, 2.6);                                                                 // (the east side)
    atGlass(49.0, 18.0, 49.0, 44.0, -1, 0, 3.2);                                                                 // (the south side, past the sofas)
    for (let u = 2; u < 34; u += 6 + R() * 5) put(u, 46.2, 0, -1, 1);                                            // (looking at DATA SCAPE)
    for (let k = 0; k < 3; k++) put(11.2 + k * 3.2, 47.0, 0, 1, 1);                                                // (before PARALLEL WINDOWS)
    for (let v = 34; v < 44; v += 2.4 + R() * 2) put(-5.6, v, 1, 0, 1);                                          // (at TIME RIVER)
    for (const [u, v, du, dv] of this.sofas) if (R() < 0.65) { const p = W(u + du * 0.05 + (dv ? (R() - 0.5) * 0.6 : 0), v + (du ? (R() - 0.5) * 0.6 : 0)); out.push({ x: p.x, z: p.z, y: Y0 + 0.05, face: face(du, dv), pose: 3, indoor: true }); }   // (on the lounge's sofas)
    const C = this.car;
    for (const [du, dv] of [[0.6, 0.5], [0.7, 2.2], [1.6, 0.6], [1.8, 2.3], [2.3, 1.4]]) { const p = W(C.u0 + du, C.v0 + dv); out.push({ x: p.x, z: p.z, y: C.y0, face: face(-1, 0) + (R() - 0.5) * 0.6, pose: 1, indoor: true }); }
    return out;
  }
}

// ---------------------------------------------------------------- materials
// the gallery: dark; its light mostly what comes in at the glass — strong by the windows, falling off fast into the room
// (so the people at them stand dark against them, as in the photographs), the low sun's warmth on the west side at
// sunset — and a little from the light boxes along the glass and the lines in the black ceiling. A carpet: no sheen.
function galleryMat(F, Y0, CEIL, wins) {
  const L = wins.map(([a, b, c, d]) => new THREE.Vector4(a, b, c, d)); while (L.length < 4) L.push(new THREE.Vector4(1e4, 1e4, 1e4, 1e4));
  return new THREE.ShaderMaterial({
    name: 'gallery', uniforms: { ...U, uO: { value: new THREE.Vector2(...F.toW(0, 0)) }, uUd: { value: new THREE.Vector2(F.ux, F.uz) }, uVd: { value: new THREE.Vector2(F.vx, F.vz) }, uY0: { value: Y0 }, uCeil: { value: CEIL }, uWin: { value: L },
      uWinSun: { value: [0.45, 1.0, 0.55, 0.2] } },                     // (each window line's share of the low sun: north, west, south, east)
    vertexShader: `attribute vec3 color; varying vec3 vC, vN, vW; void main(){ vC = color; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${GLSL_COMMON} uniform vec2 uO, uUd, uVd; uniform float uY0, uCeil, uWinSun[4]; uniform vec4 uWin[4]; varying vec3 vC, vN, vW;
      float segD(vec2 p, vec2 a, vec2 b){ vec2 ab = b - a; float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0); return length(p - a - ab * t); }
      void main(){
        vec3 n = normalize(vN); vec2 q = vW.xz - uO; vec2 uv = vec2(dot(q, uUd), dot(q, uVd));
        float fl = step(0.5, n.y), ce = step(n.y, -0.5), wa = 1.0 - fl - ce, h = clamp((vW.y - uY0) / (uCeil - uY0), 0.0, 1.0);
        float face = fl + wa * (0.55 + 0.45 * (1.0 - h)) + ce * 0.35;
        vec3 L = mix(vec3(0.07, 0.075, 0.095), vec3(0.1, 0.1, 0.115), uDay); float dmin = 1e4;
        vec2 nu = vec2(dot(n.xz, uUd), dot(n.xz, uVd));
        for (int i = 0; i < 4; i++) {
          vec2 a = uWin[i].xy, ab = uWin[i].zw - a; float t = clamp(dot(uv - a, ab) / max(dot(ab, ab), 1e-4), 0.0, 1.0); vec2 to = a + ab * t - uv;
          float d = length(to); dmin = min(dmin, d);
          float facing = wa > 0.5 ? 0.15 + 0.85 * clamp(dot(nu, to / max(d, 1e-3)) * 1.2 + 0.1, 0.0, 1.0) : 1.0;   // (a wall's face toward the glass lit, its back not)
          vec3 c = mix(vec3(0.3, 0.27, 0.28) + uSky * 1.5, uSky * 2.2 + uHaze * 0.4 + uSunHaze * uWinSun[i] * 1.3, uDay);   // (by night: the city's glow from below)
          L += c * (exp(-d / 3.2) * 0.85 + exp(-d / 11.0) * 0.22) * face * facing;
        }
        L += vec3(1.0, 0.93, 0.85) * 0.5 * exp(-(dmin - 1.6) * (dmin - 1.6) / 0.8) * (fl + 0.5 * wa) * (1.0 - 0.5 * uDay);   // (the light boxes along the glass)
        vec3 c = cleanColour(vC) * L;
        if (fl > 0.5) c *= 0.9 + 0.1 * vnoise(vW.xz * 6.0);                                   // (the carpet's pile)
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}
// the tunnel and 45F: near dark, blue-grey; brighter toward the tunnel's top, where the gallery's light comes in
function tunnelMat() {
  return new THREE.ShaderMaterial({
    name: 'tunnel', side: THREE.DoubleSide, uniforms: { ...U },
    vertexShader: `attribute vec3 color; varying vec3 vC, vN, vW;
      void main(){ vC = color; vec4 p = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p; vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        #else
          vN = normalize(mat3(modelMatrix) * normal);
        #endif
        vec4 w = modelMatrix * p; vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${GLSL_COMMON} varying vec3 vC, vN, vW;
      void main(){ vec3 n = normalize(vN); float top = smoothstep(${(229 - 7.4 - 4.0).toFixed(1)}, ${(229 - 7.4 + 0.5).toFixed(1)}, vW.y);
        vec3 L = vec3(0.06, 0.075, 0.11) + vec3(0.55, 0.62, 0.75) * top * 0.55 + vec3(0.25, 0.32, 0.45) * 0.25 * (0.5 + 0.5 * n.y);
        gl_FragColor = vec4(cleanColour(vC) * L, 1.0); }`,
  });
}
// the doors seen from inside: the run's foot beyond them — the day's or the night's light
function doorLightMat() {
  return new THREE.ShaderMaterial({ name: 'gallery doors', uniforms: { ...U }, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `${GLSL_COMMON} varying vec2 vUv; void main(){ vec3 c = mix(vec3(1.0, 0.81, 0.59) * 0.75, vec3(1.0, 0.86, 0.7) * 0.7 + uSky * 0.6, uDay) * (0.65 + 0.45 * vUv.y);
      float frame = step(abs(vUv.x - 0.5), 0.012); c *= 1.0 - 0.8 * frame; gl_FragColor = vec4(c, 1.0); }` });
}
// mirror: the slope over the glass, the mirror bay's ceiling and side — giving back what is before them, worked out for
// the way each pixel looks: the city 220 m below (its blocks and streets, the haze over them, its lights at night), the
// sky over it; the room's dark where it looks back in (aOut: the way out through its glass)
const SIDE = { uSideTex: { value: null }, uSideMat: { value: new THREE.Matrix4() }, uSideOn: { value: 0 }, uSidePlane: { value: new THREE.Vector4(0, 0, 0, 1e9) } };
function mirrorMesh(quads, name) {
  const P = [], O = []; for (const [a, b, c, d, o] of quads) for (const p of [a, b, c, a, c, d]) { P.push(p.x, p.y, p.z); O.push(o.x, o.y, o.z); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aOut', new THREE.Float32BufferAttribute(O, 3)); g.computeVertexNormals();
  const m = new THREE.ShaderMaterial({ name, side: THREE.DoubleSide, uniforms: { ...U, ...SIDE },
    vertexShader: `attribute vec3 aOut; varying vec3 vN, vW, vO; void main(){ vN = normalize(mat3(modelMatrix) * normal); vO = aOut; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${GLSL_COMMON} uniform sampler2D uGRefl, uSideTex; uniform mat4 uGReflMat, uSideMat; uniform float uGReflOn, uSideOn; uniform vec4 uGPlane, uSidePlane; varying vec3 vN, vW, vO;
      // (what it gives back: the glass's own loss and its tint taken off, as it is seen through the windows — the picture is
      // drawn without them — and the brightest held back: the night's horizon, unglazed, would glare)
      vec3 mirrorTone(vec3 c){ c *= 0.62; float m = max(max(c.r, c.g), c.b); return c / (1.0 + m * 0.6); }
      void main(){ vec3 n = normalize(vN), V = normalize(vW - cameraPosition); if (dot(n, V) > 0.0) n = -n;
        if (uGReflOn > 0.5 && abs(dot(uGPlane.xyz, vW) - uGPlane.w) < 0.12 && abs(dot(n, uGPlane.xyz)) > 0.99) {
          vec4 e = uGReflMat * vec4(vW, 1.0); vec3 c = mirrorTone(texture2D(uGRefl, e.xy / e.w).rgb);
          c *= 0.94 + 0.06 * step(0.5, fract(dot(vW.xz, vec2(0.3, 0.3)) * 0.83));
          gl_FragColor = vec4(c, 1.0); return;
        }
        if (uSideOn > 0.5 && abs(dot(uSidePlane.xyz, vW) - uSidePlane.w) < 0.12 && abs(dot(n, uSidePlane.xyz)) > 0.99) {
          vec4 e = uSideMat * vec4(vW, 1.0); gl_FragColor = vec4(mirrorTone(texture2D(uSideTex, e.xy / e.w).rgb), 1.0); return;
        }
        vec3 R = reflect(V, n), c;
        if (R.y < 0.0) {
          float t = (vW.y - 25.0) / max(-R.y, 0.03); vec2 g = vW.xz + R.xz * t, b = g / 28.0, fb = fract(b);
          float street = 1.0 - 0.35 * (1.0 - smoothstep(0.0, 0.1, min(fb.x, fb.y))), h1 = hash12(floor(b)), h2 = hash12(floor(g / 7.0));
          vec3 roof = mix(vec3(0.34, 0.31, 0.31), vec3(0.62, 0.57, 0.53), h1) * (0.75 + 0.25 * h2);
          vec3 day = mix(vec3(0.14, 0.14, 0.16), roof, street) * (uSunHaze * 0.6 + uSky * 1.2 + 0.25);
          vec3 night = vec3(0.012, 0.013, 0.02) + vec3(1.0, 0.82, 0.55) * step(0.93, hash12(floor(g / 3.0))) * 0.35;
          c = mix(night, day, uDay);
          c = mix(c, mix(uFogColor * 3.0 + vec3(0.02, 0.025, 0.04), uFogColor * 1.3 + uHaze * 0.5, uDay), 1.0 - exp(-t / 2600.0));
        } else c = mix(mix(vec3(0.03, 0.035, 0.06), uHaze * 0.8 + uSunHaze * 0.5 + uFogColor, uDay), uSky * 1.3, smoothstep(0.0, 0.35, R.y));
        float away = smoothstep(-0.25, 0.25, dot(normalize(R.xz + 1e-4), normalize(vO.xz)));
        c = mix(vec3(0.018, 0.02, 0.026), c * 0.45, away);
        c *= 0.94 + 0.06 * step(0.5, fract(dot(vW.xz, vec2(0.3, 0.3)) * 0.83));   // (the panels' joints)
        gl_FragColor = vec4(c, 1.0); }` });
  const mesh = new THREE.Mesh(g, m); mesh.userData.noInk = true; mesh.userData.noMirror = true; return mesh;   // (not in its own reflection)
}
// the lift's car: lit only by its ceiling's picture (podGlow: how bright it is now)
const podGlow = { value: 0.2 };
function podMat() {
  return new THREE.ShaderMaterial({
    name: 'pod', uniforms: { ...U, uGlow: podGlow },
    vertexShader: `attribute vec3 color; varying vec3 vC, vN, vW; void main(){ vC = color; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${GLSL_COMMON} uniform float uGlow; varying vec3 vC, vN, vW;
      void main(){ vec3 n = normalize(vN); vec3 c = cleanColour(vC) * (vec3(0.03, 0.03, 0.035) + vec3(0.62, 0.68, 0.85) * uGlow * (0.35 + 0.65 * max(-n.y, 0.0) + 0.3 * (1.0 - abs(n.y))));
        gl_FragColor = vec4(c, 1.0); }`,
  });
}
// the car's ceiling, one picture: light in streaks, streaming in from the edges and turning into a vortex in the middle
// (as the photograph of it, Commons 2023), flowing with the car's speed
function podCeiling(a, b, c, d) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([a, c, b, a, d, c].flatMap(p => [p.x, p.y, p.z]), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1], 2)); g.computeVertexNormals();
  const m = new THREE.ShaderMaterial({ name: 'pod ceiling', side: THREE.DoubleSide, uniforms: { uBright: { value: 0 }, uPhase: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uBright, uPhase; varying vec2 vUv;
      void main(){ vec2 q = (vUv - 0.5) * vec2(1.04, 1.0); float r = length(q), a = atan(q.y, q.x);
        float tw = a + 1.9 * log(r + 0.03) + uPhase;                    // (the spiral: further in, further turned)
        float s1 = pow(0.5 + 0.5 * sin(tw * 9.0 + 1.7 * sin(tw * 2.0 + uPhase * 0.3)), 9.0);
        float s2 = pow(0.5 + 0.5 * sin(tw * 31.0 + r * 7.0 - uPhase * 1.3), 14.0) * 0.6;
        float l = (s1 + s2) * smoothstep(0.01, 0.12, r) * (0.55 + 0.7 * r) + 0.04;
        vec3 c = mix(vec3(0.35, 0.42, 0.7), vec3(1.0, 1.0, 1.05), clamp(s1 * 1.3, 0.0, 1.0)) * l * uBright * 1.15;
        gl_FragColor = vec4(c, 1.0); }` });
  const mesh = new THREE.Mesh(g, m); mesh.userData.noInk = true; return mesh;
}
// the screens: TIME RIVER (kind 0: a river of light across all ten, marks left in it), DATA SCAPE (kind 1: the city's
// numbers, bars and dots, moving), PARALLEL WINDOWS (kind 2: three windows on to Tokyo seen from far above — its
// streets in lines of light, drifting slowly under you)
function screenMesh(P, UV, kind, len, name) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.computeVertexNormals();
  const m = new THREE.ShaderMaterial({ name, side: THREE.DoubleSide, uniforms: { uTime: U.uTime, uKind: { value: kind }, uLen: { value: len } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime, uKind, uLen; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){ vec3 c;
        if (uKind < 0.5) {                                              // TIME RIVER
          float x = vUv.x * 16.0, y = vUv.y, flow = x - uTime * 0.35;
          float mid = 0.5 + 0.18 * sin(flow * 0.9) + 0.08 * sin(flow * 2.3 + 1.0);
          float band = exp(-pow((y - mid) / 0.16, 2.0)), fine = 0.5 + 0.5 * sin((y - mid) * 60.0 + flow * 4.0);
          vec2 cell = floor(vec2(x * 6.0 - uTime * 2.1, y * 14.0)); float dot = step(0.985, h(cell)) * band;
          c = vec3(0.02, 0.04, 0.1) + vec3(0.25, 0.55, 1.0) * band * (0.55 + 0.45 * fine) + vec3(1.0) * dot * 2.0;
        } else if (uKind < 1.5) {                                       // DATA SCAPE
          float x = vUv.x * uLen * 6.0, y = vUv.y; vec2 cell = floor(vec2(x, y * 8.0)), f = fract(vec2(x, y * 8.0));
          float col = floor(x), v = h(vec2(col, floor(uTime * 0.8 + h(vec2(col, 1.0)) * 5.0)));
          float bar = step(y, v * 0.9) * step(0.15, f.x) * step(f.x, 0.85);
          float digit = step(0.7, h(cell + floor(uTime * 3.0))) * step(0.2, f.y) * step(f.y, 0.8) * step(0.25, f.x) * step(f.x, 0.75);
          float row = step(fract(y * 8.0 + uTime * 0.25), 0.04);
          vec3 tint = mix(vec3(0.3, 0.85, 1.0), vec3(1.0, 0.6, 0.25), step(0.82, h(vec2(col, 7.0))));
          c = vec3(0.01, 0.015, 0.03) + tint * (bar * 0.35 + digit * 0.9) + vec3(0.6, 0.9, 1.0) * row * 0.3;
        } else {                                                        // PARALLEL WINDOWS
          float k = floor(vUv.x * 3.0); vec2 q = vec2(fract(vUv.x * 3.0) * 0.76, vUv.y * 1.0) * 9.0 + vec2(k * 17.0, uTime * 0.12 + k * 5.0);
          vec2 b = floor(q), f = fract(q); float road = smoothstep(0.08, 0.0, min(f.x, f.y)) * (0.4 + 0.6 * h(b));
          vec2 q2 = q * 4.0; float lot = step(0.82, h(floor(q2))) * step(0.3, fract(q2.x)) * step(0.3, fract(q2.y));
          float river = exp(-pow((q.x - 4.5 - 1.5 * sin(q.y * 0.35 + k)) / 0.35, 2.0));
          c = vec3(0.015, 0.02, 0.045) + vec3(1.0, 0.72, 0.4) * road * 0.55 + vec3(1.0, 0.9, 0.75) * lot * 0.35 + vec3(0.08, 0.12, 0.25) * river;
          float edge = min(min(fract(vUv.x * 3.0), 1.0 - fract(vUv.x * 3.0)) * 3.0, min(vUv.y, 1.0 - vUv.y)); c *= smoothstep(0.0, 0.06, edge);
        }
        gl_FragColor = vec4(c * 1.6, 1.0); }` });
  const mesh = new THREE.Mesh(g, m); mesh.userData.noInk = true; return mesh;
}
// the tunnel's moving steps (instanced), carried up its path at the escalator's speed: along u, from its foot at 45F
// (u0) up to the gallery (u1, smaller)
const SPEED = 0.75;                                                    // (the tunnel's escalator, m/s: a little quicker than the real 0.5)
function tunnelSteps(W, yaw, LV, yP, u0, u1, mat) {
  const us = [], ss = []; let s = 0, pu = u0 + 1.0; for (let u = u0 + 1.0; u >= u1; u -= 0.05) { const dy = yP(u) - yP(pu); s += Math.hypot(pu - u, dy); us.push(u); ss.push(s); pu = u; }
  const L = s, uAt = s0 => { s0 = Math.max(0, Math.min(L, s0)); let i = 0; while (i < ss.length - 1 && ss[i + 1] < s0) i++; const f = (s0 - ss[i]) / Math.max(1e-6, (ss[i + 1] ?? ss[i]) - ss[i]); return us[i] + ((us[i + 1] ?? us[i]) - us[i]) * Math.min(1, f); };
  // (local z along u: the riser on the step's side toward the foot, +u; its yellow edge toward the top)
  const tread = new THREE.BoxGeometry(1.0, 0.035, 0.4).toNonIndexed(), riser = new THREE.BoxGeometry(0.98, 0.24, 0.02).translate(0, -0.12, 0.2).toNonIndexed(), edge = new THREE.BoxGeometry(1.0, 0.005, 0.04).translate(0, 0.02, -0.18).toNonIndexed();
  const paint = (g, c) => { const n = g.attributes.position.count, C = new Float32Array(n * 3); for (let i = 0; i < n; i++) C.set(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.deleteAttribute('uv'); return g; };
  const geo = mergeG([paint(tread, [0.16, 0.17, 0.19]), paint(riser, [0.12, 0.13, 0.15]), paint(edge, [0.95, 0.75, 0.05])]);
  const n = Math.ceil(L / 0.4) + 2, mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.frustumCulled = false; mesh.userData.noInk = true;
  let phase = 0; const M = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), sc = new THREE.Vector3(1, 1, 1), hide = new THREE.Vector3(0, 0, 0);
  const update = dt => {
    phase = (phase + dt * SPEED) % 0.4;
    for (let i = 0; i < n; i++) { const si = i * 0.4 + phase, u = uAt(si), p = W(u, LV, yP(u) - 0.02), shown = u < u0 + 0.6 && u > u1 + 0.4; M.compose(p, q, shown ? sc : hide); mesh.setMatrixAt(i, M); }
    mesh.instanceMatrix.needsUpdate = true;
  };
  update(0);
  return { mesh, L, uAt, update, speed: SPEED };
}
function mergeG(list) { const P = [], N = [], C = []; for (const g of list) { P.push(...g.attributes.position.array); N.push(...g.attributes.normal.array); C.push(...g.attributes.color.array); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); return g; }
// a red velvet sofa of the lounge, facing the windows (dir: which way it faces, in the frame: 'u+' south, 'v-' west)
function sofaG(K, box, u, v, dir, Y0) {
  const red = '#7a1622', dark = '#3b0c12';
  if (dir === 'u+') { box(K, 'solid', u - 0.45, u + 0.45, v - 1.0, v + 1.0, Y0, Y0 + 0.42, red); box(K, 'solid', u - 0.62, u - 0.42, v - 1.0, v + 1.0, Y0, Y0 + 0.85, dark); }
  else { box(K, 'solid', u - 1.0, u + 1.0, v - 0.45, v + 0.45, Y0, Y0 + 0.42, red); box(K, 'solid', u - 1.0, u + 1.0, v + 0.42, v + 0.62, Y0, Y0 + 0.85, dark); }
}
