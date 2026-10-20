// The street's furniture, where it is at the Scramble: at the end of every crossing the yellow warning studs along
// the kerb and the pedestrians' signal facing across (a red man standing, a blue man walking); on the corners the
// signal poles with their arms out over the road, the cars' lights hung on them; low granite posts along the
// corners' kerbs; white pipe railings along the streets running in; tall street lamps; on Hachikō square its trees
// in their round beds hung with little lights, the dog on his plinth, the police box. The signals keep the
// crossing's real rhythm — the cars of one road, then the other, then everyone on foot at once, every way.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { at } from './kit.js';
import { U, GLSL_COMMON, col } from './materials.js';
import { CROSSWALKS, CORE } from './layout.js';
import { KERB } from './ground.js';
import { rng } from './util.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
// the corner made close (the station-front building's side, where the store is): its railings the barred kind
export const CORNER = [-28, 34, 42];
// the signals' cycle, seconds: cars along Dōgenzaka and the road east, cars on Jingū-dōri, then the scramble
export const CYCLE = { ew: [0, 28], ewY: [28, 31], ns: [33, 58], nsY: [58, 61], walk: [63, 93], flash: [87, 93], len: 95 };
export function signalState(t) {
  const p = ((t % CYCLE.len) + CYCLE.len) % CYCLE.len, inn = ([a, b]) => p >= a && p < b;
  return { ew: inn(CYCLE.ew) ? 'g' : inn(CYCLE.ewY) ? 'y' : 'r', ns: inn(CYCLE.ns) ? 'g' : inn(CYCLE.nsY) ? 'y' : 'r', walk: inn(CYCLE.walk), flash: inn(CYCLE.flash), p };
}

const inPoly = (pts, x, z) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
function nearKerb(kerbs, x, z) {
  let best = null, bd = 1e9;
  for (const l of kerbs) for (let i = 0; i < l.length - 1; i++) {
    const a = l[i], b = l[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L2 = dx * dx + dz * dz; if (!L2) continue;
    let t = ((x - a[0]) * dx + (z - a[1]) * dz) / L2; t = Math.max(0, Math.min(1, t));
    const px = a[0] + dx * t, pz = a[1] + dz * t, d = Math.hypot(px - x, pz - z);
    if (d < bd) { bd = d; const L = Math.sqrt(L2); best = { x: px, z: pz, tx: dx / L, tz: dz / L, d }; }
  }
  return best;
}

export class Street {
  constructor(ground, kit, light, glows, signs = null, atlas = null) {
    this.kit = kit; this.ground = ground; this.light = light; this.glows = glows; this.lamps = []; this.colliders = [];
    this.R = rng(1717);
    const K = kit, R = this.R;
    // the side of a kerb point toward the pavement
    const walkSide = (k) => { let nx = -k.tz, nz = k.tx; if (ground.road(k.x + nx * 0.4, k.z + nz * 0.4)) { nx = -nx; nz = -nz; } return [nx, nz]; };
    const nearCrossing = (x, z, m = 1.2) => CROSSWALKS.some(c => { const dx = c.b[0] - c.a[0], dz = c.b[1] - c.a[1], L = Math.hypot(dx, dz), u = ((x - c.a[0]) * dx + (z - c.a[1]) * dz) / L, v = Math.abs(((x - c.a[0]) * -dz + (z - c.a[1]) * dx) / L); return u > -3 && u < L + 3 && v < c.w / 2 + m; });
    // ---- at the end of every crossing: warning studs, the walkers' signal
    this.heads = [];
    for (const c of CROSSWALKS) {
      const dx = c.b[0] - c.a[0], dz = c.b[1] - c.a[1], L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
      for (const [e, s] of [[c.a, -1], [c.b, 1]]) {
        // walk back from the end until the pavement starts
        let x = e[0], z = e[1]; for (let k = 0; k < 40 && ground.road(x, z); k++) { x -= ux * s * 0.25; z -= uz * s * 0.25; }
        for (let k = 0; k < 40 && !ground.road(x + ux * s * 0.25, z + uz * s * 0.25); k++) { x += ux * s * 0.25; z += uz * s * 0.25; }
        const kb = nearKerb(ground.kerbs, x, z); if (!kb) continue;
        const [nx, nz] = walkSide(kb);
        // the yellow studs: two rows of 30 cm tiles along the kerb, the crossing's width
        const n = Math.floor(c.w / 0.3);
        for (let i = 0; i < n; i++) for (const row of [0, 1]) {
          const t = (i - (n - 1) / 2) * 0.3, px = kb.x + kb.tx * t + nx * (0.45 + row * 0.3), pz = kb.z + kb.tz * t + nz * (0.45 + row * 0.3);
          if (ground.road(px, pz)) continue;
          K.box('solid', 0.29, 0.02, 0.29, at(px, KERB + 0.01, pz, Math.atan2(kb.tx, kb.tz)), '#e8b400', 1);
          for (const [a, b] of [[-0.08, -0.08], [0.08, -0.08], [-0.08, 0.08], [0.08, 0.08], [0, 0]]) K.cyl('solid', 0.025, 0.03, 0.012, at(px + kb.tx * a + nx * b, KERB + 0.026, pz + kb.tz * a + nz * b), '#f2c200', 6, 1);
        }
        // the walkers' signal, on a pole at the crossing's edge, its face toward the far end
        const side = 1, sx = kb.x + kb.tx * (c.w / 2 + 0.7) * side + nx * 0.9, sz = kb.z + kb.tz * (c.w / 2 + 0.7) * side + nz * 0.9;
        this.pole(sx, sz, 4.2);
        const fy = Math.atan2(-ux * s, -uz * s);                     // (facing back across the crossing, to those coming)
        this.walkSignal(sx, 2.75, sz, fy);
        if (!c.diag) this.pushButton(sx, sz, fy);
      }
    }
    // ---- the corners' granite posts, and railings along the streets coming in. Each kerb line walked as one: a post
    // every 1.8 m along it (not starting again at each of its little pieces), set 0.45 m in on the pavement side; the
    // rails run from each post to the next, so they follow the kerb round its curves. A run breaks — an end post —
    // at a crossing, at a sharp corner, where the pavement side changes, where a post would stand in the road.
    for (const l of ground.kerbs) {
      const pts = []; let acc = 0;
      for (let i = 0; i < l.length - 1; i++) {
        const a = l[i], b = l[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); if (L < 1e-3) continue;
        const tx = dx / L, tz = dz / L;
        for (; acc < L; acc += 1.8) pts.push({ x: a[0] + tx * acc, z: a[1] + tz * acc, tx, tz });
        acc -= L;
      }
      let prev = null;
      for (const p of pts) {
        const d = Math.hypot(p.x, p.z);
        let ok = d <= 120 && !nearCrossing(p.x, p.z, 1.0);
        const [nx, nz] = ok ? walkSide(p) : [0, 0], px = p.x + nx * 0.45, pz = p.z + nz * 0.45;
        if (ok && ground.road(px, pz)) ok = false;
        if (ok && d < 34) { this.post(px, pz); prev = null; continue; }   // (round the Scramble itself: granite posts)
        if (!ok) { prev = null; continue; }
        const q = { x: px, z: pz, nx, nz, tx: p.tx, tz: p.tz };
        const joins = prev && Math.hypot(px - prev.x, pz - prev.z) < 2.6 && nx * prev.nx + nz * prev.nz > 0.6 && p.tx * prev.tx + p.tz * prev.tz > 0.6;
        this.railPost(px, pz);
        if (joins) this.railSpan(prev.x, prev.z, px, pz, Math.hypot(px - CORNER[0], pz - CORNER[1]) < CORNER[2]);
        prev = q;
      }
    }
    // ---- signal poles on the corners, their arms out over the road
    const ARMS = [   // [x, z, arm direction (x, z), length, which road's cars they face (ew/ns), facing yaw of the heads]
      [-25.5, -15.5, [0.15, 1], 7.5, 'ew'], [-26.5, 9.5, [0.1, -1], 6.0, 'ew'], [17.5, -20.0, [-0.2, 1], 5.5, 'ns'], [26.5, 8.5, [-1, -0.05], 7.0, 'ew'],
      [-3.5, -21.5, [0.95, 0.3], 6.5, 'ns'], [3.5, 19.5, [-0.95, 0.15], 6.0, 'ns'], [26, -11.5, [-0.1, 1], 6.5, 'ew'], [-15, 17.5, [0.95, -0.2], 5.5, 'ns'],
    ];
    for (const [x, z, [ax, az], len, road] of ARMS) {
      const l = Math.hypot(ax, az), dx = ax / l, dz = az / l;
      this.pole(x, z, 6.6, 0.11);
      K.beam('metal', V3(x, 6.0, z), V3(x + dx * len, 6.25, z + dz * len), 0.13, '#8e949c', 0, true);
      K.beam('metal', V3(x, 4.9, z), V3(x + dx * len * 0.45, 6.05, z + dz * len * 0.45), 0.06, '#8e949c', 0, true);
      // the cars' lights at the arm's end, facing out from the crossing to the cars that come at them; a second set half way
      for (const k of [1.0, 0.55]) { const hx = x + dx * len * k, hz = z + dz * len * k; this.carSignal(hx, 6.0, hz, null, road, Math.atan2(hx, hz)); }
      // the crossing's name on a blue plate under the arm
      const nx = x + dx * len * 0.3, nz = z + dz * len * 0.3;
      if (signs) signs.box(at(nx, 5.35, nz, Math.atan2(nx, nz)), 1.9, 0.55, 0.06, { pz: { r: atlas.add('渋谷駅前', { px: 90, weight: 700 }), fill: 0.86 }, nz: { r: atlas.add('Shibuya Sta.', { px: 90, weight: 600, font: 'Helvetica Neue' }), fill: 0.86 } }, '#1f4fa8', '#ffffff', 0.15);
    }
    // ---- street lamps along the kerbs, further out
    for (const l of ground.kerbs) {
      let acc = 11;
      for (let i = 0; i < l.length - 1; i++) {
        const a = l[i], b = l[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz); acc += L;
        if (acc < 24) continue; acc = 0;
        const x = (a[0] + b[0]) / 2, z = (a[1] + b[1]) / 2, d = Math.hypot(x, z); if (d < 30 || d > 170 || nearCrossing(x, z, 2)) continue;
        const [nx, nz] = walkSide({ x, z, tx: dx / L, tz: dz / L });
        this.lamp(x + nx * 0.7, z + nz * 0.7, -nx, -nz);
      }
    }
    // ---- Hachikō square: its trees in round beds with little lights, the dog, the police box, old lamps
    for (const [x, z, r] of [[21, 25, 3.2], [29, 33, 3.6], [19, 40, 3.0], [33, 46, 3.4], [27, 52, 3.0], [14, 30, 2.6]]) this.tree(x, z, r, true);
    this.gate(-31.5, -35.5, -0.64, -0.77, 12.5);
    this.hachiko(26.5, 27.0);
    this.koban(33.5, 17.5);
    for (const [x, z] of [[14, 20], [24, 18], [16, 36], [36, 30]]) this.oldLamp(x, z);
    if (signs && this.gateSign) {
      const g = this.gateSign;
      signs.box(at(g.x, g.y, g.z, g.yaw), g.w, 1.15, 0.28, { pz: { r: atlas.add('SHIBUYA CENTER-GAI', { px: 96, weight: 800, font: 'Helvetica Neue' }), fill: 0.86 }, nz: { r: atlas.add('渋谷センター街', { px: 96, weight: 800 }), fill: 0.84 } }, '#f6f4ee', '#d4162c', 1.0, '#c9ccd2');
    }
  }
  pole(x, z, h, r = 0.075) { this.kit.cyl('metal', r, r * 1.15, h, at(x, KERB + h / 2, z), '#8e949c', 10); this.colliders.push([x, z, r + 0.2]); }
  post(x, z) {                                                       // a low granite post, a little rounded on top
    const K = this.kit; K.cyl('solid', 0.16, 0.17, 0.72, at(x, KERB + 0.36, z), '#a8a59e', 10); K.add('solid', new THREE.SphereGeometry(0.16, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), at(x, KERB + 0.72, z), '#a8a59e');
    this.colliders.push([x, z, 0.3]);
  }
  // white pipe railing (the Tokyo guard fence): a post with a rounded cap, and two rails from one post to the next
  railPost(x, z) { const K = this.kit, y = KERB; K.cyl('metal', 0.032, 0.035, 0.8, at(x, y + 0.4, z), '#e8ebef', 8); K.add('metal', new THREE.SphereGeometry(0.036, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), at(x, y + 0.8, z), '#e8ebef'); }
  // (bars: the other kind Tokyo puts along its pavements — a top rail and a foot rail, upright bars close between them)
  railSpan(x0, z0, x1, z1, bars = false) {
    if (!bars) { for (const h of [0.76, 0.42]) this.kit.beam('metal', V3(x0, KERB + h, z0), V3(x1, KERB + h, z1), 0.042, '#e8ebef', 0, true); return; }
    const K = this.kit, L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(L / 0.13)), yaw = Math.atan2(x1 - x0, z1 - z0);
    K.beam('metal', V3(x0, KERB + 0.8, z0), V3(x1, KERB + 0.8, z1), 0.05, '#e8ebef', 0, true); K.beam('metal', V3(x0, KERB + 0.12, z0), V3(x1, KERB + 0.12, z1), 0.035, '#e8ebef', 0, true);
    for (let i = 1; i < n; i++) { const t = i / n; K.box('metal', 0.016, 0.66, 0.016, at(x0 + (x1 - x0) * t, KERB + 0.46, z0 + (z1 - z0) * t, yaw), '#e8ebef'); }
  }
  walkSignal(x, y, z, yaw) {                                         // two boxes, one over the other, each with its visor
    const K = this.kit, f = (dy, lamp) => {
      K.box('solid', 0.42, 0.42, 0.2, at(x, y + dy, z, yaw), '#2f3238');
      K.box('solid', 0.44, 0.04, 0.24, at(x + Math.sin(yaw) * 0.12, y + dy + 0.22, z + Math.cos(yaw) * 0.12, yaw), '#2f3238');
      this.heads.push({ x: x + Math.sin(yaw) * 0.105, y: y + dy, z: z + Math.cos(yaw) * 0.105, yaw, lamp, w: 0.34, h: 0.34 });
    };
    f(0.23, 'pr'); f(-0.23, 'pg');
  }
  pushButton(x, z, yaw) { this.kit.box('solid', 0.16, 0.24, 0.12, at(x + Math.sin(yaw) * 0.1, KERB + 1.15, z + Math.cos(yaw) * 0.1, yaw), '#e9d84a'); }
  carSignal(x, y, z, _unused, road, yaw) {                           // a long box of three lights: blue-green, yellow, red
    const K = this.kit, sx = Math.cos(yaw), sz = -Math.sin(yaw);
    K.box('solid', 1.3, 0.44, 0.24, at(x, y - 0.3, z, yaw), '#3a3e45');
    for (const [k, lamp] of [[-0.42, road + 'g'], [0, road + 'y'], [0.42, road + 'r']]) {
      const lx = x + sx * k + Math.sin(yaw) * 0.13, lz = z + sz * k + Math.cos(yaw) * 0.13;
      K.box('solid', 0.36, 0.05, 0.16, at(lx + Math.sin(yaw) * 0.06, y - 0.3 + 0.2, lz + Math.cos(yaw) * 0.06, yaw), '#3a3e45');
      this.heads.push({ x: lx, y: y - 0.3, z: lz, yaw, lamp, w: 0.3, h: 0.3, round: true });
    }
  }
  lamp(x, z, nx, nz) {                                               // a tall lamp, its head out over the road
    const K = this.kit, h = 8.0, a = V3(x, KERB + h - 0.3, z), b = V3(x + nx * 1.6, KERB + h, z + nz * 1.6);
    this.pole(x, z, h - 0.3, 0.09); K.beam('metal', a, b, 0.09, '#8e949c', 0, true);
    K.box('metal', 0.7, 0.14, 0.3, at(b.x + nx * 0.2, b.y, b.z + nz * 0.2, Math.atan2(nx, nz)), '#7f858d');
    K.box('glow', 0.6, 0.03, 0.24, at(b.x + nx * 0.2, b.y - 0.08, b.z + nz * 0.2, Math.atan2(nx, nz)), col('#f4f1e8', 2.2));
    this.light.radial(b.x + nx * 0.2, b.z + nz * 0.2, 7.5, col('#e9e6dc', 0.5)); this.lamps.push(V3(b.x + nx * 0.2, b.y, b.z + nz * 0.2));
    this.glows.add(V3(b.x + nx * 0.2, b.y - 0.15, b.z + nz * 0.2), col('#fff8ea', 0.6), 1.2, 0);
  }
  oldLamp(x, z) {                                                    // Hachikō square's old lamp: a dark post and a white globe
    const K = this.kit, h = 4.6; this.pole(x, z, h, 0.08); this.lamps.push(V3(x, KERB + h + 0.3, z));
    K.cyl('metal', 0.14, 0.2, 0.4, at(x, KERB + 0.2, z), '#3c4048', 10);
    K.add('glow', new THREE.SphereGeometry(0.34, 16, 10), at(x, KERB + h + 0.3, z), col('#fff3df', 1.6));
    K.cyl('metal', 0.2, 0.12, 0.12, at(x, KERB + h + 0.66, z), '#3c4048', 10);
    this.light.radial(x, z, 6, col('#ffe4bc', 0.55)); this.glows.add(V3(x, KERB + h + 0.3, z), col('#ffe9c8', 0.9), 2.2, 0);
  }
  tree(x, z, r, lights) {                                            // a zelkova in its round bed: trunk, limbs fanning up, a crown of soft clumps
    const K = this.kit, R = this.R, bed = 1.5;
    K.cyl('solid', bed, bed, 0.45, at(x, KERB + 0.22, z), '#8f8c86', 28); K.cyl('solid', bed - 0.12, bed - 0.12, 0.47, at(x, KERB + 0.23, z), '#2f2a26', 28);
    this.colliders.push([x, z, bed + 0.2]);
    const th = 2.6 + R() * 0.6; K.cyl('solid', 0.15, 0.24, th, at(x, KERB + th / 2, z), '#4a3c34', 10);
    const tips = [];
    for (let i = 0; i < 5; i++) {                                    // (the zelkova's limbs part low and fan up into a vase)
      const a = i * 1.26 + R() * 0.5, l = 2.4 + R() * 1.2, tx = x + Math.cos(a) * l * 0.55, tz = z + Math.sin(a) * l * 0.55, ty = KERB + th + l * 0.85;
      K.beam('solid', V3(x, KERB + th - 0.2, z), V3(tx, ty, tz), 0.14, '#4a3c34', 0, true);
      tips.push([tx, ty, tz]);
    }
    const leaf = ['#22402f', '#2b4c37', '#1e3a2b', '#335640'];
    for (let i = 0; i < 16; i++) {                                    // clumps: soft lumpy spheres along the vase's top
      const t = tips[i % tips.length], a = R() * Math.PI * 2, rr = 0.6 + R() * 1.4;
      const cx = t[0] + Math.cos(a) * rr * 0.6, cy = t[1] + 0.3 + R() * 1.6, cz = t[2] + Math.sin(a) * rr * 0.6, rad = 0.9 + R() * 0.9;
      const g = new THREE.SphereGeometry(rad, 14, 10), p = g.attributes.position;
      for (let k = 0; k < p.count; k++) { const vx = p.getX(k), vy = p.getY(k), vz = p.getZ(k), n = 1 + 0.16 * Math.sin(vx * 3.1 + i) * Math.sin(vy * 2.7 + 2 * i) + 0.1 * Math.sin(vz * 4.3 - i); p.setXYZ(k, vx * n, vy * n * 0.8, vz * n); }
      g.computeVertexNormals();
      K.add('solid', g, at(cx, cy, cz), leaf[i % 4]);
    }
    if (lights) for (let i = 0; i < 70; i++) {                         // the little warm lights hung through it
      const a = R() * Math.PI * 2, rr = Math.sqrt(R()) * (r + 0.6), y = KERB + th + 1.2 + R() * 3.4 - rr * 0.2;
      this.glows.add(V3(x + Math.cos(a) * rr, y, z + Math.sin(a) * rr), col('#ffd9a0', 0.9), 0.26, 1);
    }
    if (lights) this.light.radial(x, z, r + 2, col('#ffcf96', 0.3));
  }
  // the gate over the mouth of Center-gai: two posts, the arch of its lit name between them
  gate(x, z, ux, uz, w) {
    const K = this.kit, px = -uz, pz = ux, H = 6.2;                   // (across the street: p; along it: u)
    for (const s of [-1, 1]) { const gx = x + px * s * w / 2, gz = z + pz * s * w / 2; K.cyl('metal', 0.16, 0.16, H, at(gx, KERB + H / 2, gz), '#d6d9de', 12); this.colliders.push([gx, gz, 0.35]); }
    K.beam('metal', V3(x - px * w / 2, KERB + H - 0.2, z - pz * w / 2), V3(x + px * w / 2, KERB + H - 0.2, z + pz * w / 2), 0.14, '#d6d9de', 0, true);
    this.gateSign = { x, y: KERB + H + 0.55, z, yaw: Math.atan2(ux, uz), w: w * 0.92 };
  }
  hachiko(x, z) {                                                    // the dog on his plinth, in bronze, sitting, looking toward the station
    const K = this.kit, y = KERB, B = '#3a3a30', yaw = Math.atan2(1, 0.3);
    K.block('solid', x, y, z, 1.6, 1.25, 1.0, '#9b968c', yaw);
    const T = (dx, dy, dz) => { const c = Math.cos(yaw), s = Math.sin(yaw); return [x + dx * c + dz * s, y + 1.25 + dy, z - dx * s + dz * c]; };
    const part = (g, dx, dy, dz, rx = 0, ry = 0) => { const [a, b, c] = T(dx, dy, dz); K.add('solid', g, at(a, b, c, yaw + ry, rx), B); };
    part(new THREE.SphereGeometry(0.34, 12, 8).scale(1, 1.25, 1.5), 0, 0.4, -0.1, -0.5);                         // body, sitting up
    part(new THREE.SphereGeometry(0.22, 12, 8).scale(1, 1, 1.3), 0, 0.92, 0.18);                                  // head
    part(new THREE.CylinderGeometry(0.08, 0.1, 0.22, 8), 0, 0.86, 0.42, Math.PI / 2);                              // muzzle
    for (const s of [-1, 1]) {
      part(new THREE.ConeGeometry(0.07, 0.18, 6), s * 0.12, 1.15, 0.12);                                            // ears (one droops, as his does)
      part(new THREE.CylinderGeometry(0.06, 0.07, 0.5, 8), s * 0.14, 0.22, 0.25, -0.15);                            // forelegs
      part(new THREE.SphereGeometry(0.16, 10, 8).scale(1, 0.7, 1.4), s * 0.2, 0.08, -0.25);                        // haunches
    }
    part(new THREE.TorusGeometry(0.12, 0.04, 6, 12, Math.PI), 0, 0.15, -0.52, Math.PI / 2);                         // the curled tail
    this.colliders.push([x, z, 1.2]);
  }
  koban(x, z) {                                                      // the police box: a small house, its red lamp over the door
    const K = this.kit, y = KERB;
    K.block('solid', x, y, z, 4.2, 3.2, 3.4, '#b9b3a8', 0.2);
    K.block('solid', x, y + 3.2, z, 4.6, 0.35, 3.8, '#5b5650', 0.2);
    K.block('glow', x - Math.sin(0.2) * 0.0 - 1.72, y + 0.2, z + 1.0, 0.04, 2.4, 1.6, col('#fff3dc', 1.2), 0.2);
    K.add('glow', new THREE.SphereGeometry(0.2, 12, 8), at(x - 2.2, y + 2.9, z + 0.6), col('#ff2a1c', 2.5));
    this.glows.add(V3(x - 2.2, y + 2.9, z + 0.6), col('#ff3020', 1.0), 1.0, 0);
    this.colliders.push([x, z, 2.6]);
    this.kobanSign = { x: x - 2.15, y: y + 3.5, z, yaw: -Math.PI / 2 + 0.2 };
  }
  // the lit faces of all the signals, one draw: each lamp knows what it shows, the cycle decides when
  lampMesh() {
    const P = [], A = [], N = [];
    const KIND = { pr: 0, pg: 1, ewg: 2, ewy: 3, ewr: 4, nsg: 5, nsy: 6, nsr: 7 };
    for (const h of this.heads) {
      const g = h.round ? new THREE.CircleGeometry(h.w / 2, 16) : new THREE.PlaneGeometry(h.w, h.h);
      g.applyMatrix4(at(h.x, h.y, h.z, h.yaw)); const nn = g.toNonIndexed(), p = nn.attributes.position;
      for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); A.push(KIND[h.lamp], h.round ? 0 : (i % 2)); N.push(Math.sin(h.yaw), 0, Math.cos(h.yaw)); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aLamp', new THREE.Float32BufferAttribute(A, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    // the local uv for drawing the little men on the walkers' lamps
    const uv = []; for (const h of this.heads) { const gg = (h.round ? new THREE.CircleGeometry(h.w / 2, 16) : new THREE.PlaneGeometry(h.w, h.h)).toNonIndexed(); for (let i = 0; i < gg.attributes.uv.count; i++) uv.push(gg.attributes.uv.getX(i), gg.attributes.uv.getY(i)); }
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    this.sigU = { uEW: { value: 0 }, uNS: { value: 0 }, uWalk: { value: 0 } };
    const m = new THREE.ShaderMaterial({
      name: 'signals', uniforms: { ...U, ...this.sigU },
      vertexShader: `attribute vec2 aLamp; varying vec2 vUv; varying float vK; varying vec3 vW; void main(){ vUv = uv; vK = aLamp.x; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float uEW, uNS, uWalk; varying vec2 vUv; varying float vK; varying vec3 vW;
        // the little men: standing (red), walking (blue-green)
        float man(vec2 p, float walking){
          float head = step(length(p - vec2(0.5, 0.8)), 0.08);
          float body = step(abs(p.x - 0.5), 0.07) * step(0.42, p.y) * step(p.y, 0.7);
          float legs = walking > 0.5 ? max(step(abs(p.x - 0.42 + (p.y - 0.42) * 0.35), 0.04), step(abs(p.x - 0.58 - (p.y - 0.42) * 0.35), 0.04)) * step(0.15, p.y) * step(p.y, 0.44)
                                     : max(step(abs(p.x - 0.45), 0.035), step(abs(p.x - 0.55), 0.035)) * step(0.15, p.y) * step(p.y, 0.44);
          float arms = walking > 0.5 ? step(abs(p.y - 0.62 + (p.x - 0.5) * 0.6), 0.03) * step(abs(p.x - 0.5), 0.2) : step(abs(p.y - 0.62), 0.03) * step(abs(p.x - 0.5), 0.12);
          return max(max(head, body), max(legs, arms));
        }
        void main(){
          int k = int(vK + 0.5); vec3 c = vec3(0.05); float on = 0.0;
          if (k == 0) { on = 1.0 - uWalk; c = vec3(1.0, 0.12, 0.08) * mix(0.06, 2.2, on * man(vUv, 0.0)); }
          else if (k == 1) { on = uWalk; c = vec3(0.1, 0.95, 0.75) * mix(0.05, 2.2, on * man(vUv, 1.0)); }
          else { float st = k < 5 ? uEW : uNS, want = float(k < 5 ? k - 2 : k - 5);   // (0 green, 1 yellow, 2 red)
            on = step(abs(st - want), 0.1);
            vec3 lc = want < 0.5 ? vec3(0.1, 1.0, 0.75) : want < 1.5 ? vec3(1.0, 0.7, 0.05) : vec3(1.0, 0.1, 0.06);
            c = lc * mix(0.06, 2.4, on); }
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const mesh = new THREE.Mesh(g, m); mesh.matrixAutoUpdate = false; mesh.name = 'signal lamps'; mesh.userData.noInk = true;
    return mesh;
  }
  update(time) {
    const s = signalState(time), code = c => c === 'g' ? 0 : c === 'y' ? 1 : 2;
    this.sigU.uEW.value = code(s.ew); this.sigU.uNS.value = code(s.ns);
    this.sigU.uWalk.value = s.walk ? (s.flash ? (Math.floor(time * 2) % 2) : 1) : 0;
    this.state = s;
  }
}
