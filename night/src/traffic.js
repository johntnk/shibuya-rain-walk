// The traffic through the Scramble, keeping left as Tokyo does: the deep indigo taxis with their lit roof signs,
// white and black saloons, little white vans, a delivery truck, the buses into the station — along the real
// roads (OpenStreetMap's), stopping at the line while the other road or the walkers have the lights, pulling away
// when theirs turn. Their headlights and red tail lights drawn out long in the wet road (the mirror does that),
// the road lit a little in front of each.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { U, GLSL_COMMON, col } from './materials.js';
import { CORE } from './layout.js';
import { signalState } from './street.js';
import { rng } from './util.js';

const inPoly = (pts, x, z) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };

// ---------------------------------------------------------------- the cars themselves
// Each car is lofted: a row of cross-sections from its tail to its nose, each [z, floor, belt line, roof edge height,
// roof top, half width at the belt, half width at the roof edge] — so the body narrows to the nose and tail, the
// glasshouse leans in (tumblehome) and the windscreen and rear glass slope as they do on the real car. Between two
// sections each band of the body (its underside, lower body, side, shoulder, side glass, roof) is a strip; the side
// glass and the roof band are glass or paint by section (the pillars, the windscreen, the rear glass). Then the
// things a car is recognised by: wheels in dark arches with silver rims, the door seams and handles, mirrors, the
// grille and bumpers, the lamps (aPart.y: 1 head, 2 tail, 3 roof sign, 5 glass, 6 the taxi's red 空車 sign).
// The kinds are what fills Shibuya's roads: the JPN TAXI (most of the taxis now, deep indigo), the Crown-like
// saloon, the Prius-like hatch, the big Alphard-like people carrier, the tall kei car (N-BOX-like), the Hiace-like
// van, a box truck, a Tokyu bus. Sizes are the real cars' (length, width, height).
const CARS = {
  //        L     W     H      wheel r, axles (z)    sections [z, y0, belt, roofEdge, top, w, wRoof], sides (g glass / p paint per gap), tops
  taxi:   { L: 4.40, W: 1.70, r: 0.31, ax: [1.38, -1.30], st: [[-2.20, .26, .62, .64, .66, .76, .74], [-2.14, .20, .96, 1.0, 1.02, .83, .80], [-2.04, .20, .97, 1.66, 1.72, .85, .74], [-1.10, .20, .98, 1.70, 1.75, .85, .74], [-1.00, .20, .98, 1.70, 1.75, .85, .74], [-0.05, .20, .98, 1.70, 1.75, .85, .74], [0.07, .20, .98, 1.70, 1.75, .85, .74], [0.75, .20, .97, 1.66, 1.72, .85, .74], [1.35, .20, .95, 1.00, 1.04, .85, .80], [1.95, .22, .86, .88, .90, .83, .78], [2.14, .26, .72, .74, .76, .80, .74], [2.20, .30, .58, .60, .62, .74, .70]],
            side: 'ppgpgpggppp', top: 'pgpppppgppp', seams: [-1.05, 0.01, 0.78], lantern: true },
  sedan:  { L: 4.90, W: 1.80, r: 0.32, ax: [1.45, -1.40], st: [[-2.45, .22, .62, .66, .70, .78, .74], [-2.35, .18, .86, .90, .92, .86, .80], [-1.95, .16, .90, .94, .97, .90, .84], [-1.45, .16, .92, .96, 1.00, .90, .82], [-0.85, .16, .93, 1.38, 1.44, .90, .70], [-0.25, .16, .93, 1.40, 1.46, .90, .70], [-0.15, .16, .93, 1.40, 1.46, .90, .70], [0.35, .16, .94, 1.40, 1.46, .90, .70], [1.05, .16, .93, .98, 1.02, .90, .82], [1.95, .18, .86, .88, .90, .88, .80], [2.35, .22, .74, .76, .78, .84, .76], [2.45, .26, .60, .62, .64, .76, .70]],
            side: 'ppppgpggppp', top: 'pppgpppgppp', seams: [-0.85, -0.2, 0.95] },
  hatch:  { L: 4.55, W: 1.76, r: 0.32, ax: [1.40, -1.30], st: [[-2.27, .24, .62, .64, .66, .80, .76], [-2.20, .20, .88, .92, .94, .86, .80], [-2.05, .20, .92, 1.05, 1.08, .88, .78], [-1.20, .18, .93, 1.40, 1.46, .88, .70], [-0.20, .18, .93, 1.43, 1.47, .88, .70], [-0.10, .18, .93, 1.43, 1.47, .88, .70], [0.40, .18, .93, 1.40, 1.46, .88, .70], [1.25, .18, .90, .95, .98, .88, .80], [2.05, .22, .78, .80, .82, .84, .76], [2.27, .28, .58, .60, .62, .74, .70]],
            side: 'ppggpggpp', top: 'ppgpppgpp', seams: [-1.1, -0.15, 0.9] },
  minivan:{ L: 4.95, W: 1.85, r: 0.34, ax: [1.50, -1.45], st: [[-2.47, .26, .66, .68, .70, .84, .80], [-2.40, .22, 1.00, 1.04, 1.06, .90, .86], [-2.28, .22, 1.02, 1.80, 1.86, .92, .80], [-1.40, .22, 1.03, 1.84, 1.90, .925, .80], [-1.30, .22, 1.03, 1.84, 1.90, .925, .80], [-0.30, .22, 1.03, 1.84, 1.90, .925, .80], [-0.18, .22, 1.03, 1.84, 1.90, .925, .80], [0.55, .22, 1.02, 1.80, 1.88, .925, .80], [1.55, .22, .98, 1.04, 1.08, .925, .86], [2.15, .24, .90, .92, .94, .90, .84], [2.40, .30, .76, .78, .80, .86, .80], [2.47, .34, .60, .62, .64, .80, .76]],
            side: 'ppgpgpggppp', top: 'pgpppppgppp', seams: [-1.35, -0.24, 0.6] },
  kei:    { L: 3.40, W: 1.48, r: 0.28, ax: [1.10, -1.05], st: [[-1.70, .26, .62, .64, .66, .68, .66], [-1.66, .20, .92, .96, .98, .72, .70], [-1.60, .20, .94, 1.72, 1.78, .74, .66], [-0.95, .20, .95, 1.74, 1.79, .74, .66], [-0.85, .20, .95, 1.74, 1.79, .74, .66], [0.00, .20, .95, 1.74, 1.79, .74, .66], [0.10, .20, .95, 1.74, 1.79, .74, .66], [0.55, .20, .95, 1.72, 1.78, .74, .66], [1.15, .20, .93, .98, 1.00, .74, .70], [1.55, .22, .84, .86, .88, .72, .68], [1.70, .28, .60, .62, .64, .66, .62]],
            side: 'ppgpgpggpp', top: 'pgpppppgpp', seams: [-0.9, 0.05, 0.58] },
  van:    { L: 4.70, W: 1.70, r: 0.33, ax: [1.30, -1.25], st: [[-2.35, .28, .62, .64, .66, .80, .78], [-2.30, .22, .98, 1.02, 1.04, .84, .82], [-2.26, .22, 1.00, 1.90, 1.96, .85, .80], [-0.90, .22, 1.00, 1.92, 1.98, .85, .80], [0.90, .22, 1.00, 1.92, 1.98, .85, .80], [1.00, .22, 1.00, 1.92, 1.98, .85, .80], [1.85, .22, 1.00, 1.90, 1.96, .85, .80], [2.20, .24, .96, 1.02, 1.04, .85, .82], [2.32, .30, .78, .80, .82, .82, .78], [2.35, .34, .60, .62, .64, .78, .74]],
            side: 'pppgpggpp', top: 'pgppppgpp', seams: [0.95, 1.85], panel: true },
  truck:  { L: 6.20, W: 2.00, r: 0.40, ax: [2.10, -1.70], st: [[1.30, .40, 1.25, 1.30, 1.32, .98, .96], [1.36, .36, 1.28, 2.30, 2.36, 1.0, .92], [2.55, .36, 1.28, 2.30, 2.36, 1.0, .92], [2.95, .40, 1.25, 1.32, 1.36, 1.0, .96], [3.06, .48, 1.0, 1.02, 1.04, .96, .92], [3.10, .55, .75, .77, .78, .92, .88]],
            side: 'pgppp', top: 'ppgpp', seams: [], box: [-3.10, 1.20, 0.75, 2.95, 1.04] },
  bus:    { L: 10.5, W: 2.50, r: 0.50, ax: [3.10, -2.60], st: null, seams: [] },
};
// the bus: a long box with its window bays, a section every bay
(() => {
  const B = CARS.bus, st = [[-5.25, .40, .95, .97, 1.0, 1.15, 1.1], [-5.20, .32, 1.60, 1.65, 1.68, 1.22, 1.20], [-5.12, .32, 1.62, 2.95, 3.05, 1.25, 1.18]];
  let side = 'pp', top = 'pg';
  for (let z = -4.6; z < 4.4; z += 1.45) { st.push([z, .32, 1.62, 3.0, 3.1, 1.25, 1.18], [z + 0.15, .32, 1.62, 3.0, 3.1, 1.25, 1.18]); side += (st.length > 5 ? 'g' : 'p') + 'p'; top += 'pp'; }
  st.push([4.95, .32, 1.62, 3.0, 3.1, 1.25, 1.18], [5.18, .32, 1.05, 2.92, 3.02, 1.24, 1.18], [5.25, .40, .90, .95, .98, 1.18, 1.12]);
  side += 'gpp'; top += 'ppp'; B.st = st; B.side = side; B.top = top;
})();

function carModel(kind) {
  const P = CARS[kind], parts = [], hl = P.L / 2;
  const add = (g, c, paint = 0, light = 0) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); if (!g.attributes.normal) g.computeVertexNormals(); const n = g.attributes.position.count, C = new Float32Array(n * 3), A = new Float32Array(n * 2); const cc = col(c); for (let i = 0; i < n; i++) { C.set([cc.r, cc.g, cc.b], i * 3); A.set([paint, light], i * 2); } g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setAttribute('aPart', new THREE.BufferAttribute(A, 2)); parts.push(g); };
  const box = (w, h, d, x, y, z, ry = 0) => new THREE.BoxGeometry(w, h, d).rotateY(ry).translate(x, y, z);
  const GLASS = '#10141c', DARK = '#1c1e22', TRIM = '#2b2e33';
  // ---- the loft
  const st = P.st, ring = ([z, y0, yb, yr, yt, w, wr]) => [[0, y0], [w - 0.1, y0], [w, y0 + 0.14], [w, yb], [w - 0.05, yb + 0.03], [wr, yr], [0, yt]];
  const R = st.map(ring);
  const strip = (band, i0, i1, sgn) => {                              // band k from section i0 to i1 (one side), as one smooth strip
    const pos = [], idx = [];
    for (let i = i0; i <= i1; i++) for (const k of [band, band + 1]) { const [x, y] = R[i][k]; pos.push(x * sgn, y, st[i][0]); }
    for (let i = 0; i < i1 - i0; i++) { const a = i * 2, b = a + 1, c = a + 3, d = a + 2; if (sgn > 0) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  };
  const flags = [null, null, null, null, P.side, P.top];
  for (const sgn of [1, -1]) for (let band = 0; band < 6; band++) {
    const f = flags[band];
    // runs of the same kind of surface
    let i0 = 0;
    for (let i = 1; i <= st.length - 1; i++) {
      const kind0 = f ? f[i0] : 'p', kindI = f ? f[i] : 'p';
      if (i === st.length - 1 || kindI !== kind0) {
        const g = strip(band, i0, i, sgn), glass = kind0 === 'g';
        if (band === 0) add(g, DARK); else if (band === 1) add(g, TRIM); else add(g, glass ? GLASS : '#ffffff', glass ? 0 : 1, glass ? 5 : 0);
        i0 = i;
      }
    }
  }
  // the nose and the tail: each section's outline filled
  for (const [i, face] of [[st.length - 1, 1], [0, -1]]) {
    const r = R[i], pts = [...r.slice(0, 7), ...r.slice(1, 6).reverse().map(([x, y]) => [-x, y])];
    const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
    const g = new THREE.ShapeGeometry(shape); if (face < 0) g.rotateY(Math.PI); g.translate(0, 0, st[i][0]); add(g, '#ffffff', 1);
  }
  const front = st[st.length - 1], back = st[0], fz = front[0], bz = back[0];
  const at = z => { let i = 1; while (i < st.length - 1 && st[i][0] < z) i++; const a = st[i - 1], b = st[i], t = Math.max(0, Math.min(1, (z - a[0]) / (b[0] - a[0] || 1))); return a.map((v, k) => v + (b[k] - v) * t); };
  // ---- the truck's box, behind the cab
  if (P.box) { const [z0, w, y0, y1, z1] = P.box; const g = box(P.W + 0.04, y1 - y0, z1 - z0, 0, (y0 + y1) / 2, (z0 + z1) / 2); add(g, '#eceef0'); add(box(P.W + 0.06, 0.22, z1 - z0 - 0.2, 0, 1.6, (z0 + z1) / 2), '#2d8a4a'); add(box(P.W * 0.9, 0.3, z1 - z0, 0, 0.6, (z0 + z1) / 2), DARK);
    for (const sx of [-1, 1]) add(box(0.22, 0.14, 0.05, sx * (P.W / 2 - 0.2), 0.62, z0 - 0.03), '#ff2a20', 0, 2); }
  // ---- the bus's front: its great windscreen, its destination board, the red band along it
  if (kind === 'bus') {
    add(box(2.2, 1.7, 0.04, 0, 2.05, fz - 0.02), GLASS, 0, 5); add(box(1.7, 0.3, 0.05, 0, 2.78, fz + 0.005), '#ffb000', 0, 3);
    for (const sx of [-1, 1]) add(box(0.025, 0.24, P.L - 0.6, sx * 1.255, 1.35, 0), '#c8102e');
    add(box(1.5, 0.28, 0.05, 0, 2.7, bz - 0.01), '#ffb000', 0, 3);
  }
  // ---- wheels: tyre, silver rim with its spokes, the dark arch round it
  for (const z of P.ax) {
    const s0 = at(z), w = s0[5], r = P.r;
    for (const sx of [-1, 1]) {
      add(new THREE.CylinderGeometry(r, r, 0.22, 20).rotateZ(Math.PI / 2).translate(sx * (w - 0.1), r, z), '#141518');
      add(new THREE.CylinderGeometry(r * 0.66, r * 0.66, 0.02, 20).rotateZ(Math.PI / 2).translate(sx * (w + 0.012), r, z), '#b4bac2');
      add(new THREE.CylinderGeometry(r * 0.2, r * 0.2, 0.03, 10).rotateZ(Math.PI / 2).translate(sx * (w + 0.02), r, z), '#5a5f66');
      for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5; add(box(0.02, r * 0.5, 0.06, sx * (w + 0.026), r + Math.cos(a) * r * 0.36, z + Math.sin(a) * r * 0.36).rotateX(0), '#d4d8de'); }
      const arch = new THREE.CircleGeometry(r * 1.14, 18, 0, Math.PI).rotateY(sx * Math.PI / 2).translate(sx * (w + 0.004), r, z); add(arch, '#0b0c0e');
    }
  }
  // ---- the door seams and handles, the mirrors
  for (const z of P.seams || []) { const s0 = at(z); for (const sx of [-1, 1]) { add(box(0.012, s0[2] - s0[1] - 0.2, 0.014, sx * (s0[5] + 0.004), (s0[1] + 0.2 + s0[2]) / 2, z), '#0e0f12'); if (!P.panel || z > 1) add(box(0.025, 0.035, 0.14, sx * (s0[5] + 0.012), s0[2] - 0.12, z - 0.22), '#d9dde2'); } }
  if (kind !== 'bus') { const wi = [...P.top].findIndex((f, i) => f === 'g' && i > st.length / 2), cz = wi >= 0 ? st[wi + 1] : front, sc = at(cz[0]); for (const sx of [-1, 1]) { add(box(0.16, 0.1, 0.2, sx * (sc[5] + 0.08), sc[2] + 0.1, cz[0] - 0.05), '#ffffff', 1); add(box(0.02, 0.09, 0.15, sx * (sc[5] + 0.165), sc[2] + 0.1, cz[0] - 0.05), GLASS, 0, 5); } }
  // ---- the face: grille, lamps, bumper, plate; the tail: lamps across, bumper, plate
  const fw = front[5], by = front[1] + 0.06, bw = back[5];
  add(box(fw * 2 + 0.06, 0.2, 0.12, 0, front[1] + 0.12, fz - 0.03), kind === 'taxi' || kind === 'bus' ? TRIM : '#ffffff', kind === 'taxi' || kind === 'bus' ? 0 : 1);
  add(box(fw * 0.9, 0.14, 0.04, 0, front[2] - 0.14, fz + 0.005), DARK);                   // (the grille)
  for (const sx of [-1, 1]) {
    add(box(fw * 0.42, 0.11, 0.05, sx * fw * 0.62, front[2] - 0.08, fz + 0.01), '#fff6e6', 0, 1);
    add(box(fw * 0.12, 0.05, 0.05, sx * fw * 0.86, front[1] + 0.25, fz + 0.01), '#ffb24a', 0, 4);
    add(box(bw * 0.36, 0.16, 0.05, sx * bw * 0.7, back[2] - 0.12, bz - 0.01), '#ff2a20', 0, 2);
  }
  add(box(bw * 2 + 0.04, 0.2, 0.12, 0, back[1] + 0.12, bz + 0.03), TRIM);
  add(box(0.5, 0.12, 0.02, 0, front[1] + 0.3, fz + 0.02), '#eef2e6'); add(box(0.5, 0.12, 0.02, 0, back[1] + 0.34, bz - 0.02), '#eef2e6');
  // ---- the taxi: its lantern on the roof, its red 空車 sign low in the windscreen on the passenger's (left) side
  if (P.lantern) {
    const rz = 0.55, rs = at(rz); add(box(0.36, 0.14, 0.12, 0, rs[4] + 0.08, rz), '#ffd36a', 0, 3); add(box(0.4, 0.03, 0.16, 0, rs[4] + 0.01, rz), TRIM);
    const cs = at(1.28), y = cs[4] + (cs[3] - cs[4]) * (0.42 / cs[6]); add(box(0.24, 0.07, 0.03, 0.42, y + 0.03, 1.28), '#ff2a20', 0, 6);
  }
  const g = mergeGeometries(parts); parts.forEach(p => p.dispose());
  g.computeBoundingSphere(); return { g, L: P.L, W: P.W, H: Math.max(...st.map(s => s[4])) };
}

function carMaterial() {
  return new THREE.ShaderMaterial({
    name: 'cars', uniforms: { ...U },
    vertexShader: `attribute vec3 color; attribute vec2 aPart; attribute vec2 aState;
      varying vec3 vC, vN, vW; varying vec2 vP, vS;
      void main(){ vC = aPart.x > 0.5 ? instanceColor : color; vP = aPart; vS = aState;
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${GLSL_COMMON} varying vec3 vC, vN, vW; varying vec2 vP, vS;
      void main(){
        vec3 n = normalize(vN), V = normalize(cameraPosition - vW);
        vec3 c = cleanColour(vC) * toonLight(n, vW);
        // paint and glass catch the street: a sheen along the top, the lights of the city in the glass
        float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
        c += (uSky * 1.4 + streetLight(vW, n) * 0.6) * fres * (vP.x > 0.5 ? 0.5 : 0.8) * (0.4 + 0.6 * max(n.y, 0.0));
        int L = int(vP.y + 0.5);
        if (L == 1) c = vC * 2.6;                                         // headlamps
        if (L == 2) c = vC * (0.9 + 1.8 * vS.x);                          // tail lamps, bright when braking
        if (L == 3) c = vC * 1.8;                                         // the taxi's lantern, the bus's board
        if (L == 4) c = vC * (0.8 + 1.4 * uLightsOn);                     // (the indicators, the side lamps)
        if (L == 5) c = vC * 0.5 + (uSky * 0.7 + streetLight(vW, n) * 0.5) * (0.12 + 0.88 * fres) * (0.5 + 0.5 * max(n.y, 0.0)) + vec3(0.02, 0.025, 0.035);   // (glass: dark, the sky and street in it at a glancing look)
        if (L == 6) c = vC * (1.2 + 1.2 * uLightsOn);                     // (空車, red)
        gl_FragColor = vec4(fogIt(c, vW), 1.0);
      }`,
  });
}

// ---------------------------------------------------------------- where they drive
// polylines through the crossing (keeping left), which light they obey; built from the real roads' lines
export class Traffic {
  constructor(scene, L, { count = 56 } = {}) {
    this.count = count;
    this.scene = scene; this.R = rng(505); this.cars = []; this.models = {};
    const way = name => L.ways.filter(w => w.name === name && w.kind === 'hw');
    // the main lines as point lists (metres), and the routes made of them
    const DOGEN = [[-160, 15], [-125, 7], [-109, 1], [-102, -2], [-94, -5], [-88, -6], [-76, -8], [-69, -9], [-37, -6], [-30, -5], [1, 0]];
    const EAST = [[1, 0], [19, 1], [22, 2], [35, 3], [48, 3], [80, 3], [132, -2], [170, -6]];
    const NORTH = [[24, -181], [24, -123], [24, -106], [23, -93], [20, -76], [16, -60], [9, -28], [7, -20], [1, 0]];
    const SOUTH = [[1, 0], [1, 18], [-2, 31], [-5, 40], [-8, 49], [-13, 60], [-15, 68], [-14, 80], [-13, 88], [-11, 94], [-9, 102], [-6, 109]];
    const R = (pts, off) => offsetLine(pts, off);
    const rev = p => p.slice().reverse();
    this.routes = [
      { pts: R([...DOGEN, ...EAST.slice(1)], -1.8), sig: 'ew', w: 3 },            // west to east, the left lane (north side)
      { pts: R([...DOGEN, ...EAST.slice(1)], -5.0), sig: 'ew', w: 2 },
      { pts: R(rev([...DOGEN, ...EAST.slice(1)]), -1.8), sig: 'ew', w: 3 },       // east to west
      { pts: R(rev([...DOGEN, ...EAST.slice(1)]), -5.0), sig: 'ew', w: 2 },
      { pts: R([...NORTH, ...SOUTH.slice(1)], -1.8), sig: 'ns', w: 3 },           // down Jingū-dōri to the station
      { pts: R(rev([...NORTH, ...SOUTH.slice(1)]), -1.8), sig: 'ns', w: 2 },
      { pts: R([...NORTH, ...DOGEN.slice().reverse().slice(1)], -1.8), sig: 'ns', w: 1 },   // down Jingū-dōri, right up Dōgenzaka
      { pts: R([...DOGEN, ...SOUTH.slice(1)], -1.8), sig: 'ew', w: 1 },            // from Dōgenzaka, left to the station
    ];
    for (const r of this.routes) {
      r.s = [0]; for (let i = 1; i < r.pts.length; i++) r.s.push(r.s[i - 1] + Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]));
      r.L = r.s[r.s.length - 1];
      // the stop line: a little short of where the route enters the Scramble
      let enter = 0; for (let s = 0; s < r.L; s += 0.5) { const p = this.at(r, s); if (inPoly(CORE, p.x, p.z)) { enter = s; break; } }
      r.stop = enter - 4.5; r.cars = [];
    }
    // the models, instanced, one draw each
    const KINDS = Object.keys(CARS), mat = carMaterial();
    for (const k of KINDS) {
      const m = carModel(k), n = count, im = new THREE.InstancedMesh(m.g, mat, n);
      im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
      const st = new THREE.InstancedBufferAttribute(new Float32Array(n * 2), 2); st.setUsage(THREE.DynamicDrawUsage); im.geometry.setAttribute('aState', st);
      im.count = 0; im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(im);
      this.models[k] = { ...m, im, st, n: 0 };
    }
    // the light each throws on the road ahead: soft pools, drawn over the wet road
    this.beams = beamMesh(count * 2); scene.add(this.beams);
    for (let i = 0; i < count; i++) this.spawn(true);
  }
  at(r, s) {
    let i = 1; while (i < r.pts.length - 1 && r.s[i] < s) i++;
    const a = r.pts[i - 1], b = r.pts[i], f = Math.max(0, Math.min(1, (s - r.s[i - 1]) / Math.max(1e-6, r.s[i] - r.s[i - 1])));
    return { x: a[0] + (b[0] - a[0]) * f, z: a[1] + (b[1] - a[1]) * f, yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) };
  }
  spawn(anywhere = false) {
    const R = this.R, rs = this.routes, tot = rs.reduce((t, r) => t + r.w, 0); let k = R() * tot, r = rs[0];
    for (const x of rs) { k -= x.w; if (k <= 0) { r = x; break; } }
    // (what fills the roads round the Scramble: taxis most, then saloons and people carriers, kei cars, vans, a truck, a bus)
    const u = R(), kind = u < 0.34 ? 'taxi' : u < 0.48 ? 'sedan' : u < 0.57 ? 'hatch' : u < 0.70 ? 'minivan' : u < 0.80 ? 'kei' : u < 0.88 ? 'van' : u < 0.94 ? 'truck' : 'bus';
    const paint = kind === 'taxi' ? (R() < 0.88 ? '#1b2140' : R() < 0.5 ? '#121418' : '#e9e4d2')
      : kind === 'sedan' ? R.pick(['#f2f2f0', '#121418', '#121418', '#c9ccd0', '#2a2f3a', '#6b1e24'])
      : kind === 'minivan' ? R.pick(['#121418', '#121418', '#f2f2f0', '#f2f2f0', '#3b3f46'])
      : kind === 'hatch' ? R.pick(['#f2f2f0', '#c9ccd0', '#2a2f3a', '#7a8796'])
      : kind === 'kei' ? R.pick(['#f2f2f0', '#e8dcc0', '#9fb7c9', '#d9c8b8', '#121418', '#b23a3a'])
      : kind === 'van' ? '#f2f2f0' : kind === 'bus' ? '#f2f2ef' : '#ffffff';
    let s = anywhere ? R() * r.L * 0.9 : 0;
    // not on top of another
    for (const c of r.cars) if (Math.abs(c.s - s) < 9) { if (anywhere) s = c.s - 12 - R() * 10; else return; }
    if (s < 0 && !anywhere) return;
    const car = { r, kind, s: Math.max(0, s), v: anywhere ? 6 : 8, paint: col(paint), brake: 0, len: this.models[kind].L, vmax: (kind === 'bus' || kind === 'truck' ? 8 : 10.5) * (0.85 + R() * 0.3) };
    r.cars.push(car); this.cars.push(car);
  }
  update(dt, time) {
    const st = signalState(time);
    for (const r of this.routes) {
      r.cars.sort((a, b) => b.s - a.s);                               // (the one ahead first)
      const green = st[r.sig] === 'g', yellow = st[r.sig] === 'y';
      r.cars.forEach((c, i) => {
        const ahead = r.cars[i - 1];
        // the gap to keep: to the car ahead, and to the stop line if the light isn't ours
        let room = 1e9;
        if (ahead) room = ahead.s - ahead.len / 2 - (c.s + c.len / 2) - 2.2;
        const toStop = r.stop - (c.s + c.len / 2);
        if (!green && toStop > -0.5 && !(yellow && toStop < c.v * 1.2)) room = Math.min(room, toStop);
        // drive: speed up to the limit, ease off to stop within the room left
        const want = Math.max(0, Math.min(c.vmax, Math.sqrt(Math.max(0, 2 * 3.0 * Math.max(0, room - 0.5)))));
        const a = want > c.v ? 2.2 : -4.5; c.v = Math.max(0, c.v + Math.max(-6 * dt, Math.min(a * dt, want - c.v)));
        c.brake += ((want < c.v - 0.3 || c.v < 0.2 ? 1 : 0) - c.brake) * Math.min(1, dt * 8);
        c.s += c.v * dt;
      });
      for (let i = r.cars.length - 1; i >= 0; i--) if (r.cars[i].s > r.L - 2) { const c = r.cars.splice(i, 1)[0]; this.cars.splice(this.cars.indexOf(c), 1); }
    }
    while (this.cars.length < this.count) { const n = this.cars.length; this.spawn(); if (this.cars.length === n) break; }
    // into the drawing
    for (const m of Object.values(this.models)) m.n = 0;
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s1 = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
    let nb = 0;
    for (const c of this.cars) {
      const p = this.at(c.r, c.s), pb = this.at(c.r, c.s - c.len * 0.4), pf = this.at(c.r, c.s + c.len * 0.4);
      const yaw = Math.atan2(pf.x - pb.x, pf.z - pb.z), m = this.models[c.kind];
      q.setFromAxisAngle(up, yaw); v.set(p.x, 0, p.z); M.compose(v, q, s1);
      m.im.setMatrixAt(m.n, M); m.im.instanceColor.setXYZ(m.n, c.paint.r, c.paint.g, c.paint.b); m.st.setXY(m.n, c.brake, 0); m.n++;
      // the pool of its headlights on the road ahead
      v.set(p.x + Math.sin(yaw) * (c.len / 2 + 4.5), 0.02, p.z + Math.cos(yaw) * (c.len / 2 + 4.5)); M.compose(v, q, s1); this.beams.setMatrixAt(nb++, M);
    }
    for (const m of Object.values(this.models)) { m.im.count = m.n; m.im.instanceMatrix.needsUpdate = true; m.im.instanceColor.needsUpdate = true; m.st.needsUpdate = true; }
    this.beams.count = nb; this.beams.instanceMatrix.needsUpdate = true;
  }
}
// a line moved sideways by off metres (left of the way it goes is negative x of its right hand: off < 0 keeps left)
function offsetLine(pts, off) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1;
    const rx = -dz / L, rz = dx / L;                                  // (right hand, going a → b, with x east and z south: (−dz, dx))
    out.push([pts[i][0] + rx * off, pts[i][1] + rz * off]);
  }
  return out;
}
function beamMesh(n) {
  const g = new THREE.PlaneGeometry(4.2, 9).rotateX(-Math.PI / 2);
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -3,
    vertexShader: `varying vec2 vL; void main(){ vL = position.xz; gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec2 vL; void main(){ vec2 q = vL / vec2(2.1, 4.5); float r = length(q * vec2(1.0, 1.0)); float a = (1.0 - smoothstep(0.2, 1.0, r)) * smoothstep(-1.0, -0.4, q.y + 0.4 * abs(q.x));
      gl_FragColor = vec4(vec3(1.0, 0.95, 0.85) * a * 0.12, 1.0); }` });
  const im = new THREE.InstancedMesh(g, m, n); im.count = 0; im.frustumCulled = false; im.layers.set(1); im.userData.noInk = true; return im;
}
