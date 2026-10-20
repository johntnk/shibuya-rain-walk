// Winter things the townsfolk put on, built round each one's own head and neck at rest and carried on their
// bones: a knitted beanie (ribbed brim, a pompom if it has one), a scarf wound once round the neck with its two
// ends hanging down the front, glasses for the old. Sized from the character's own hair and body, so the same
// beanie fits a child and a grandfather.
import * as THREE from 'three';
import { std, attach } from './kit.js';

const knit = c => std(c, { roughness: 0.97 });
const V = () => new THREE.Vector3();
// every vertex of the model's meshes whose material name matches re, in the rest pose (VRoid meshes sit at the origin)
export function each(vrm, re, fn) {
  vrm.scene.traverse(o => {
    if (!o.isMesh) return; const ms = [].concat(o.material), P = o.geometry.attributes.position, I = o.geometry.index, g = o.geometry;
    const groups = g.groups.length ? g.groups : [{ start: 0, count: I ? I.count : P.count, materialIndex: 0 }];
    for (const gr of groups) { const m = ms[gr.materialIndex ?? 0]; if (!m || !re.test(m.name) || /Outline/.test(m.name)) continue;
      for (let k = gr.start; k < gr.start + gr.count; k++) { const i = I ? I.getX(k) : k; fn(P.getX(i), P.getY(i), P.getZ(i)); } }
  });
}
// an ellipse (centre, radii) round what lies in a thin slice at height y
function slice(vrm, re, y, half = 0.012, around = null, reach = 0.2) {
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  each(vrm, re, (x, yy, z) => { if (Math.abs(yy - y) > half) return; if (around && Math.hypot(x - around.x, z - around.z) > reach) return;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); });
  return x1 < x0 ? null : { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, rx: (x1 - x0) / 2, rz: (z1 - z0) / 2 };
}
// a tube along an ellipse at height y, its cross-section w wide (radially) and h tall
function band(e, y, w, h, mat) {
  const N = 48, pts = []; for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; pts.push(new THREE.Vector3(Math.sin(a) * e.rx, 0, Math.cos(a) * e.rz)); }
  const curve = new THREE.CatmullRomCurve3(pts, true), g = new THREE.TubeGeometry(curve, 96, 1, 10, true), p = g.attributes.position, c = V(), t = V();
  for (let i = 0; i < p.count; i++) { t.fromBufferAttribute(p, i); curve.getPointAt((Math.floor(i / 11) / 96) % 1, c); const d = t.sub(c); p.setXYZ(i, c.x + d.x * w, c.y + d.y * h, c.z + d.z * w); }
  g.computeVertexNormals(); const m = new THREE.Mesh(g, mat); m.position.set(e.cx, y, e.cz); return m;
}

// yarn for things knitted for a character: the character's own toon material (copied from its clothes, so the
// light falls on it the same way and it gets the same outline), over a knit drawn here in the colour wanted. The
// texture: below v = 0.33 a ribbed cuff, above it plain knit, with the crown's four seams at the top
function yarn(av, color, { seams = true, ribbed = false } = {}) {
  const c = new THREE.Color(color), W = 512, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), img = g.createImageData(W, H), d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = 1 - y / H, rib = v < 0.33 || ribbed;
    let k = rib ? 0.86 + 0.14 * Math.pow(0.5 + 0.5 * Math.cos(u * Math.PI * 2 * (v < 0.33 ? 72 : 96)), 0.6)   // (ribs: knit and purl)
                : 0.95 + 0.05 * (0.5 + 0.5 * Math.cos(u * Math.PI * 2 * 96)) * (0.6 + 0.4 * Math.cos(v * Math.PI * 2 * 40));
    if (seams && v > 0.82) { const f = (u * 4) % 1, e = Math.min(f, 1 - f); k *= 1 - 0.12 * Math.max(0, 1 - e * 60) * (v - 0.82) / 0.18; }
    const i = (y * W + x) * 4; d[i] = 255 * c.r * k; d[i + 1] = 255 * c.g * k; d[i + 2] = 255 * c.b * k; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.LinearSRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.anisotropy = 8;
  let base = null; av.vrm.scene.traverse(o => { if (base || !o.isMesh) return; for (const m of [].concat(o.material)) if (m.isMToonMaterial && !m.isOutline && /Tops|Onepiece|CLOTH/.test(m.name)) { base = m; break; } });
  if (!base) return [std(color, { roughness: 0.97, map: null })];
  const m = base.clone(); m.name = 'Knit';
  m.map = tex; m.shadeMultiplyTexture = tex; m.color.setRGB(1, 1, 1);
  for (const k of ['normalMap', 'emissiveMap', 'shadingShiftTexture', 'rimMultiplyTexture', 'outlineWidthMultiplyTexture', 'uvAnimationMaskTexture', 'matcapTexture']) m[k] = null;
  m.alphaTest = 0; m.transparent = false; m.side = THREE.FrontSide;
  const o = m.clone(); o.name = 'Knit (Outline)'; o.isOutline = true; o.side = THREE.BackSide;
  if (Array.isArray(av.vrm.materials)) av.vrm.materials.push(m, o);
  return [m, o];
}
// a mesh wearing yarn (with its outline when the yarn has one)
function knitted(geo, mats) {
  if (mats.length > 1) { const n = geo.index ? geo.index.count : geo.attributes.position.count; geo.clearGroups(); geo.addGroup(0, n, 0); geo.addGroup(0, n, 1); }
  return new THREE.Mesh(geo, mats.length > 1 ? mats : mats[0]);
}
// how far the skull reaches from o, every way round and up (from the head's own skin under the hair: VRoid's face
// mesh is only the face, the scalp is part of the body's): sample(θ from straight up, φ round from the front) → metres
export function skull(vrm, o) {
  const NT = 18, NP = 32, TMAX = Math.PI * 0.8, S = Array.from({ length: NT }, () => new Float32Array(NP));
  each(vrm, /Face_00_SKIN|Body_00_SKIN/, (x, y, z) => {
    const dx = x - o.x, dy = y - o.y, dz = z - o.z, r = Math.hypot(dx, dy, dz), th = Math.acos(dy / r); if (th > TMAX || r > 0.2) return;
    if (dy < 0 && dz > 0.02) return;                                                  // (not the face below the eyes: nose and cheeks would push a hat out off the brow)
    const i = Math.min(NT - 1, Math.floor(th / TMAX * NT)), j = Math.floor(((Math.atan2(dx, dz) / (Math.PI * 2)) + 1) % 1 * NP); S[i][j] = Math.max(S[i][j], r);
  });
  { const top = Math.max(...S[0]); if (top > 0) S[0].fill(top); }
  for (let pass = 0; pass < 12; pass++) for (let i = 0; i < NT; i++) for (let j = 0; j < NP; j++) if (!S[i][j]) {      // (gaps filled from round about)
    let s = 0, n = 0; for (const [a, b] of [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]]) { if (a < 0 || a >= NT) continue; const v = S[a][(b + NP) % NP]; if (v) { s += v; n++; } }
    if (n) S[i][j] = s / n;
  }
  for (let pass = 0; pass < 2; pass++) { const T = S.map(r => r.slice()); for (let i = 0; i < NT; i++) for (let j = 0; j < NP; j++) {
    let s = 0, n = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const ii = i + a; if (ii < 0 || ii >= NT) continue; s += T[ii][(j + b + NP) % NP]; n++; } S[i][j] = s / n; } }
  return (th, ph) => {
    const fi = Math.min(NT - 1.001, Math.max(0, th / TMAX * NT - 0.5)), fj = (((ph / (Math.PI * 2)) % 1 + 1) % 1) * NP - 0.5;
    const i0 = Math.floor(fi), ti = fi - i0, j0 = Math.floor(fj), tj = fj - j0, A = S[i0], B = S[Math.min(NT - 1, i0 + 1)], j1 = (j0 + 1 + NP) % NP, jj = (j0 + NP) % NP;
    return (A[jj] * (1 - tj) + A[j1] * tj) * (1 - ti) + (B[jj] * (1 - tj) + B[j1] * tj) * ti;
  };
}

// a knitted beanie pulled down to just above the brows and over the tops of the ears, shaped round the skull with
// the hair pressed flat beneath it (only what falls below its cuff still shows: the fringe, the hair at the back
// and sides); a turned-up ribbed cuff, the knit a little slouched at the back. pompom: its colour, or null.
// slouch: instead, the loose ribbed kind with no cuff, pulled right down to the brows, over the ears and down to the
// nape; the knit it has to spare doesn't stand up off the crown but hangs back and down behind the head, gathered
// in again at the nape
export function beanie(av, color, { pompom = null, brim = null, slouch: loose = false, text = null, dome = 0 } = {}) {   // (dome: the crown rounded up higher, m)   // (text: words embroidered across the cuff's front, { str, color })
  const vrm = av.vrm, h = vrm.humanoid; vrm.scene.updateMatrixWorld(true);
  const hd = h.getRawBoneNode('head').getWorldPosition(V()), le = h.getRawBoneNode('leftEye'), re = h.getRawBoneNode('rightEye');
  const eye = le && re ? le.getWorldPosition(V()).add(re.getWorldPosition(V())).multiplyScalar(0.5) : hd.clone().add(V().set(0, 0.06, 0.06));
  // the skull's middle: level with the eyes, midway between brow and the back of the head
  let z0 = 1e9, z1 = -1e9; each(vrm, /Face_00_SKIN|Body_00_SKIN/, (x, y, z) => { if (Math.abs(y - eye.y - 0.03) < 0.012 && Math.abs(x - hd.x) < 0.03 && Math.abs(z - hd.z) < 0.2) { z0 = Math.min(z0, z); z1 = Math.max(z1, z); } });
  const o = V().set(hd.x, eye.y, z1 > z0 ? (z0 + z1) / 2 : hd.z), S = skull(vrm, o);
  const size = S(Math.PI / 2, 0) / 0.09;                                             // (a child's head is smaller)
  const P0 = (loose ? 0.011 : 0.012) * size, KNIT = (loose ? 0.004 : 0.006) * size, CUFF = (loose ? 0.007 : 0.034) * size, BUL = (loose ? 0.0008 : 0.006) * size;
  const press = ph => P0 * ((loose ? 0.3 : 0.45) + (loose ? 0.7 : 0.55) * (1 - Math.pow(Math.max(0, Math.cos(ph)), 2)));   // (the hair pressed under it: thin over the brow)
  const yBrim = loose ? ph => o.y + (-0.0273 + 0.0505 * Math.cos(ph) - 0.0073 * Math.cos(2 * ph) + 0.0025 * Math.sin(7 * ph + 0.6) * Math.max(0, -Math.cos(ph))) * size   // (on the brows, over the ears, down to the nape; the soft edge not quite even behind)
                      : ph => o.y + (0.012 + 0.022 * Math.cos(ph)) * size;                    // (down to the brows in front, lower at the back)
  const slouch = loose ? () => 0
                       : (th, ph) => 0.014 * size * Math.max(0, -Math.cos(ph)) * Math.sin(Math.min(Math.PI, th * 2.2));
  // the loose knit hanging behind: carried back and a little down, most at the back of the head, none over the
  // crown or the brow, and none down at the nape where the edge gathers it in
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const drape = (th, ph) => {                                                         // (hanging straight down the back to the edge, gathered only right at it)
    const tb = thBrim(ph), w = Math.pow(Math.max(0, 0.15 - Math.cos(ph)) / 1.15, 1.2) * sm(0.5, 1.3, th) * (1 - sm(tb - 0.1, tb + 0.02, th)) * 0.017 * size;
    return V().set(0, -0.6 * w, -w);                                                  // (only a little: it wraps the head)
  };
  const R = (th, ph) => S(th, ph) + press(ph) + KNIT + slouch(th, ph) + dome * size * Math.pow(Math.max(0, Math.cos(th)), 2);   // the knit's outer face
  const thBrim = ph => { let th = Math.PI / 2; for (let k = 0; k < 6; k++) th = Math.acos(Math.max(-0.85, Math.min(0.99, (yBrim(ph) - o.y) / R(th, ph)))); return th; };
  // the slack knit doesn't hang smooth: it lies in soft folds across the back, a little skewed, deepest low down
  // where it bunches above the nape
  const fold = (th, ph) => {
    const back = Math.pow(Math.max(0, 0.25 - Math.cos(ph)) / 1.25, 1.1), tb = thBrim(ph), w = back * sm(0.9, 1.5, th) * (1 - sm(tb - 0.05, tb + 0.02, th));
    const phase = th * 19 + 1.6 * Math.sin(ph * 2.3 + 1) + 0.7 * Math.sin(ph * 5.1);
    return 0.0058 * size * w * Math.pow(0.5 - 0.5 * Math.cos(phase), 1.6);
  };
  const at = (th, ph, r) => {
    if (loose) r += fold(th, ph);
    const p = V().set(o.x + r * Math.sin(th) * Math.sin(ph), o.y + r * Math.cos(th), o.z + r * Math.sin(th) * Math.cos(ph)); return loose ? p.add(drape(th, ph)) : p;
  };
  const mats = yarn(av, color, { ribbed: loose, seams: !loose }), cuffMats = brim ? yarn(av, brim, { seams: false }) : mats, grp = new THREE.Group();
  const NP = loose ? 96 : 64, NT = loose ? 56 : 18, TB = Array.from({ length: NP + 1 }, (_, i) => thBrim(i / NP * Math.PI * 2));
  // the crown: from the brim up, rows of φ round, closed at the top
  { const pos = [], uv = [], idx = [];
    for (let j = 0; j < NT; j++) for (let i = 0; i <= NP; i++) { const t = j / NT, ph = i / NP * Math.PI * 2, th = TB[i] * (1 - t); const p = at(th, ph, R(th, ph)); pos.push(p.x, p.y, p.z); uv.push(i / NP, 0.34 + 0.66 * t); }
    const top = at(0, 0, R(0, 0)); pos.push(top.x, top.y, top.z); uv.push(0.5, 1); const pole = NT * (NP + 1);
    for (let j = 0; j < NT - 1; j++) for (let i = 0; i < NP; i++) { const k = j * (NP + 1) + i; idx.push(k, k + 1, k + NP + 1, k + 1, k + NP + 2, k + NP + 1); }
    for (let i = 0; i < NP; i++) { const k = (NT - 1) * (NP + 1) + i; idx.push(k, k + 1, pole); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    grp.add(knitted(geo, mats)); }
  // the cuff: turned up from the brim, rounded over at its top and bottom, ribbed
  { const pos = [], uv = [], idx = [], NS = 8;
    for (let s = 0; s <= NS; s++) for (let i = 0; i <= NP; i++) {
      const f = s / NS, ph = i / NP * Math.PI * 2, y = yBrim(ph) - 0.004 * size + f * CUFF, th = Math.acos(Math.max(-0.85, Math.min(0.99, (y - o.y) / R(TB[i], ph))));
      const r = R(th, ph) + 0.0015 * size + BUL * Math.pow(Math.sin(Math.PI * (0.08 + 0.84 * f)), 0.5);
      const p = at(th, ph, r); pos.push(p.x, p.y, p.z); uv.push(i / NP, 0.32 * f);
    }
    for (let s = 0; s < NS; s++) for (let i = 0; i < NP; i++) { const k = s * (NP + 1) + i; idx.push(k, k + 1, k + NP + 1, k + 1, k + NP + 2, k + NP + 1); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
    grp.add(knitted(geo, cuffMats));
    if (text) {                                                                       // (the words: a band lying on the cuff's front, the stitched letters on it, nothing else)
      const W2 = 1024, H2 = 160, cv = document.createElement('canvas'); cv.width = W2; cv.height = H2; const c2 = cv.getContext('2d');
      c2.fillStyle = text.color || '#f4f1ea'; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.font = `bold italic ${text.size || 104}px "Snell Roundhand", "Brush Script MT", "Savoye LET", cursive`;
      c2.save(); c2.translate(W2 / 2, H2 / 2 + 6); c2.rotate(-0.05); c2.fillText(text.str, 0, 0); c2.lineWidth = 3; c2.strokeStyle = text.color || '#f4f1ea'; c2.strokeText(text.str, 0, 0); c2.restore();   // (a little thick: thread, not ink)
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      const A = text.arc || 1.15, tp = [], tu = [], ti = [], NU = 48, NV = 6;
      for (let s = 0; s <= NV; s++) for (let i = 0; i <= NU; i++) {
        const f = 0.12 + 0.76 * s / NV, ph = -A + 2 * A * i / NU, ii = Math.round(((ph / (Math.PI * 2)) % 1 + 1) % 1 * NP), y = yBrim(ph) - 0.004 * size + f * CUFF, th = Math.acos(Math.max(-0.85, Math.min(0.99, (y - o.y) / R(TB[ii], ph))));
        const p = at(th, ph, R(th, ph) + 0.0015 * size + BUL * Math.pow(Math.sin(Math.PI * (0.08 + 0.84 * f)), 0.5) + 0.0012); tp.push(p.x, p.y, p.z); tu.push(i / NU, (f - 0.12) / 0.76);
      }
      for (let s = 0; s < NV; s++) for (let i = 0; i < NU; i++) { const k = s * (NU + 1) + i; ti.push(k, k + 1, k + NU + 1, k + 1, k + NU + 2, k + NU + 1); }
      const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3)); tg.setAttribute('uv', new THREE.Float32BufferAttribute(tu, 2)); tg.setIndex(ti); tg.computeVertexNormals();
      const tm = new THREE.Mesh(tg, std(0xffffff, { map: tex, transparent: true, alphaTest: 0.35, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 })); tm.userData.noInk = true; grp.add(tm);
    } }
  if (pompom) {                                                                       // a fluffy ball of yarn on top
    const pm = yarn(av, pompom, { seams: false }), r = 0.032 * size, geo = new THREE.SphereGeometry(1, 40, 28), P = geo.attributes.position, q = V();
    for (let i = 0; i < P.count; i++) { q.fromBufferAttribute(P, i); const n = 1 + 0.035 * Math.sin(q.x * 9 + q.y * 5) * Math.sin(q.z * 8 - q.y * 4) + 0.02 * Math.sin(q.x * 23 - q.z * 17 + q.y * 11); P.setXYZ(i, q.x * r * n, q.y * r * n * 0.94, q.z * r * n); }
    geo.computeVertexNormals();                                                       // (soft, a little lumpy: tufts of yarn)
    const m = knitted(geo, pm), tp = at(0.12, Math.PI, R(0.12, Math.PI)); m.position.set(tp.x, tp.y + r * 0.75, tp.z); grp.add(m);
  }
  // the hair beneath, pressed down: above the brim, nothing stands out past the knit's inside; just below it, the
  // hair coming out from under the cuff is let out gradually
  vrm.scene.traverse(ob => {
    if (!ob.isMesh || !/Hair/i.test([].concat(ob.material).map(m => m.name).join())) return;
    const P = ob.geometry.attributes.position, q = V();
    for (let i = 0; i < P.count; i++) {
      q.fromBufferAttribute(P, i).sub(o); const r = q.length(); if (r < 1e-4) continue;
      const th = Math.acos(q.y / r), ph = Math.atan2(q.x, q.z), below = yBrim(ph) - (o.y + q.y);
      const lim = below <= 0 ? S(th, ph) + press(ph) - 0.002 * size : S(th, ph) + press(ph) + KNIT + BUL - 0.004 * size + 0.9 * below;
      if (r > lim) { q.multiplyScalar(lim / r).add(o); P.setXYZ(i, q.x, q.y, q.z); }
    }
    P.needsUpdate = true; ob.geometry.computeBoundingSphere();
  });
  attach(av, 'head', grp); return grp;
}

// a scarf wound round the neck: a soft knitted wrap from the collar up to under the chin, a little fuller in the
// middle, folds running round it the way it was wound; the two ends come out from under it in front, just off to
// one side, and lie down the chest (long: to the waist)
export function scarf(av, color, { stripe = null, long = false } = {}) {
  const vrm = av.vrm, h = vrm.humanoid; vrm.scene.updateMatrixWorld(true);
  const nk = h.getRawBoneNode('neck').getWorldPosition(V()), hd = h.getRawBoneNode('head').getWorldPosition(V());
  const mat = std(color, { roughness: 0.97, side: THREE.DoubleSide }), grp = new THREE.Group();
  const nh = hd.y - nk.y, y0 = nk.y - 0.28 * nh, y1 = nk.y + 0.55 * nh, NA = 40, NT = 10, cx = nk.x, cz = nk.z + 0.006;
  // how far out the neck and collar reach in each direction, low (on the collar) and high (under the chin): the
  // wrap goes just outside, every way round
  const reachAt = (ya, yb) => {
    const r = new Float32Array(NA);
    each(vrm, /SKIN|Tops|Onepiece|CLOTH/, (x, y, z) => {
      if (y < ya || y > yb) return; const d = Math.hypot(x - cx, z - cz); if (d > 0.14) return;
      const k = Math.floor(((Math.atan2(x - cx, z - cz) / (Math.PI * 2)) + 1) % 1 * NA); r[k] = Math.max(r[k], d);
    });
    return Array.from(r, (v, k) => { let m = 0, s = 0, n = 0; for (let d = -2; d <= 2; d++) { const u = r[(k + d + NA) % NA]; if (u > 0) { s += u; n++; m = Math.max(m, u); } } return n ? Math.max(0.045, 0.5 * (s / n) + 0.5 * m) : 0.05; });
  };
  const lo = reachAt(y0 - 0.012, y0 + 0.02), hi = reachAt(y1 - 0.035, y1 + 0.005);
  const ring = [];
  for (let j = 0; j <= NT; j++) for (let i = 0; i < NA; i++) {
    const t = j / NT, a = i / NA * Math.PI * 2, k = i, f = Math.max(0, Math.cos(a));
    const fold = 0.0035 * Math.sin(2 * a + t * Math.PI * 2.4) + 0.0025 * Math.sin(5 * a - t * 7);   // (wound: the turns lie at a slant)
    const r = Math.max(lo[k] + (hi[k] - lo[k]) * t, (lo[k] + hi[k]) / 2 - 0.004) + 0.008 + 0.013 * Math.sin(Math.PI * t) + fold;
    ring.push(cx + Math.sin(a) * r, y0 + t * (y1 - y0) - 0.012 * f * (1 - t), cz + Math.cos(a) * r);
  }
  const idx = []; for (let j = 0; j < NT; j++) for (let i = 0; i < NA; i++) { const k = j * NA + i, k1 = j * NA + (i + 1) % NA; idx.push(k, k1, k + NA, k1, k1 + NA, k + NA); }   // (closed round: no seam)
  const cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.Float32BufferAttribute(ring, 3)); cg.setIndex(idx); cg.computeVertexNormals();
  grp.add(new THREE.Mesh(cg, mat));
  // the ends: strips of knit, gently rounded across, lying on the chest just in front of whatever is under them
  const under = (x, y) => { let z = -1e9; each(vrm, /SKIN|Tops|Onepiece|CLOTH/, (vx, vy, vz) => { if (Math.abs(vx - x) < 0.042 && Math.abs(vy - y) < 0.015) z = Math.max(z, vz); }); return z; };   // (under all its width)
  const L = long ? 0.34 + 0.1 * nh / 0.09 : 0.24 + 0.06 * nh / 0.09, w = 0.062 * Math.min(1, nh / 0.09 + 0.15), zr = cz + lo[0] + 0.02, yt = y0 + 0.022;
  for (const [dx, len, back, lean] of [[-0.008, L, 0.003, -0.004], [0.052, L * 0.82, 0, 0.018]]) {
    const N = 12, x0 = cx + dx, zs = [];
    for (let j = 0; j <= N; j++) zs.push(under(x0 + lean * j / N, yt - len * j / N));
    for (let j = 0; j <= N; j++) if (zs[j] < -1e8) zs[j] = j ? zs[j - 1] - 0.01 : zr;
    const zz = zs.map((z, j) => Math.max(...[-2, -1, 0, 1, 2].map(d => zs[Math.min(N, Math.max(0, j + d))])) + 0.016);   // (over the bumps: a lapel, buttons)
    for (let pass = 0; pass < 2; pass++) for (let j = 1; j < N; j++) zz[j] = Math.max(zs[j] + 0.013, (zz[j - 1] + zz[j] + zz[j + 1]) / 3);
    zz[0] = Math.max(zz[0], zr - 0.004);
    const C = 5, sp = [], si = [], row = (j, dz = 0, dy = 0) => {                  // (C points across, on a shallow arc)
      const yy = yt - len * j / N + dy, xx = x0 + lean * j / N, z = zz[j] - back + dz, o = [];
      for (let c = 0; c < C; c++) { const u = c / (C - 1) - 0.5; o.push(xx + u * w, yy, z - 0.02 * u * u); } return o;
    };
    for (let j = 0; j <= N; j++) sp.push(...row(j));
    for (let j = 0; j < N; j++) for (let c = 0; c < C - 1; c++) { const k = j * C + c; si.push(k, k + 1, k + C, k + 1, k + C + 1, k + C); }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); tg.setIndex(si); tg.computeVertexNormals();
    grp.add(new THREE.Mesh(tg, mat));
    if (stripe) for (const f of [0.7, 0.8]) {                                      // two bands across near the end
      const j = Math.round(f * N), a2 = row(j, 0.0015, 0.009), b2 = row(j, 0.0015, -0.009), g = new THREE.BufferGeometry();
      const gi = []; for (let c = 0; c < C - 1; c++) gi.push(c, c + 1, c + C, c + 1, c + C + 1, c + C);
      g.setAttribute('position', new THREE.Float32BufferAttribute([...a2, ...b2], 3)); g.setIndex(gi); g.computeVertexNormals();
      grp.add(new THREE.Mesh(g, std(stripe, { roughness: 0.97, side: THREE.DoubleSide })));
    }
  }
  attach(av, 'upperChest', grp); return grp;
}

// fluffy earmuffs on a band over the head (for a child whose hair is up in buns)
export function earmuffs(av, color) {
  const vrm = av.vrm, h = vrm.humanoid; vrm.scene.updateMatrixWorld(true);
  const le = h.getRawBoneNode('leftEye'), hd = h.getRawBoneNode('head').getWorldPosition(V());
  const ey = le ? le.getWorldPosition(V()).y : hd.y + 0.08, e = slice(vrm, /Face_00_SKIN/, ey - 0.01, 0.012, hd, 0.15);
  if (!e) return;
  const fur = knit(color), grp = new THREE.Group(), half = e.rx + 0.012;
  for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.04, 2).scale(0.55, 1, 1), fur); m.position.set(e.cx + s * half, ey - 0.012, e.cz - 0.008); grp.add(m); }
  const arc = new THREE.Mesh(new THREE.TorusGeometry(half, 0.007, 6, 24, Math.PI), fur); arc.position.set(e.cx, ey - 0.012, e.cz - 0.012); arc.scale.y = 1.25; grp.add(arc);
  attach(av, 'head', grp); return grp;
}

// glasses: round wire rims, for the old; bold: thick black frames, softly squared (the classic heavy acetate kind).
// Sized and set by the eyes as they're drawn (the whites and irises — VRoid's eye bones sit back near the middle
// of the head, not in the eyes)
export function glasses(av, color = 0x5a4632, { bold = false } = {}) {
  const vrm = av.vrm, h = vrm.humanoid; vrm.scene.updateMatrixWorld(true);
  const hd = h.getRawBoneNode('head').getWorldPosition(V());
  const eyes = { '-1': { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 }, 1: { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 } };
  each(vrm, /EyeWhite|EyeIris/, (x, y) => { const e = eyes[x < hd.x ? -1 : 1]; e.x0 = Math.min(e.x0, x); e.x1 = Math.max(e.x1, x); e.y0 = Math.min(e.y0, y); e.y1 = Math.max(e.y1, y); });
  if (eyes[1].x1 < eyes[1].x0 || eyes[-1].x1 < eyes[-1].x0) return;
  const ec = s => ({ x: (eyes[s].x0 + eyes[s].x1) / 2, y: (eyes[s].y0 + eyes[s].y1) / 2, w: (eyes[s].x1 - eyes[s].x0) / 2, h: (eyes[s].y1 - eyes[s].y0) / 2 });
  const L = ec(1), R = ec(-1), midY = (L.y + R.y) / 2, ew = Math.max(L.w, R.w), eh = Math.max(L.h, R.h);
  let zf = -1e9; each(vrm, /Face_00_SKIN/, (x, y, z) => { if (Math.abs(y - midY) < eh + 0.01 && Math.abs(x - hd.x) < Math.max(Math.abs(L.x - hd.x), Math.abs(R.x - hd.x)) + ew) zf = Math.max(zf, z); });
  const z = (zf > -1e8 ? zf : hd.z + 0.08) + (bold ? 0.007 : 0.005), grp = new THREE.Group();
  const wire = bold ? std(0x121212, { roughness: 0.35, metalness: 0.1 }) : std(color, { metalness: 0.5, roughness: 0.4 });
  const th = bold ? 0.0032 : 0.0018;
  const rw = bold ? ew * 1.12 + 0.005 : Math.max(ew, eh) * 1.05 + 0.003, rh = bold ? eh * 1.15 + 0.004 : rw;   // (the rim's half-width and half-height, round the eye)
  const rims = {};
  for (const [s, E] of [[1, L], [-1, R]]) {
    let rim;
    if (bold) {                                                                         // (a rounded rectangle, a touch wider than tall)
      const c = Math.min(rw, rh) * 0.45, pts = [];
      for (let i = 0; i < 48; i++) {
        const t = i / 48 * Math.PI * 2, cx = Math.cos(t), cy = Math.sin(t), px = Math.sign(cx) * Math.min(1, Math.abs(cx) * 1.6), py = Math.sign(cy) * Math.min(1, Math.abs(cy) * 1.6);
        pts.push(new THREE.Vector3(px * (rw - c) + cx * c, py * (rh - c) + cy * c, 0));
      }
      rim = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 96, th, 6, true), wire);
    } else rim = new THREE.Mesh(new THREE.TorusGeometry(rw, th, 6, 28), wire);
    rim.position.set(E.x, E.y + (bold ? 0.001 : 0), z); grp.add(rim); rims[s] = E;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(bold ? 0.004 : 0.0025, bold ? 0.005 : 0.0025, 0.11).translate(0, 0, -0.055), wire);
    arm.position.set(E.x + s * rw, E.y + rh * 0.5, z - 0.003); grp.add(arm);
  }
  const inner = Math.abs(L.x - R.x) - 2 * rw, bridge = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.004, inner + 0.002), bold ? 0.004 : 0.0022, bold ? 0.004 : 0.0022), wire);
  bridge.position.set((L.x + R.x) / 2, midY + rh * 0.45, z + 0.001); grp.add(bridge);
  attach(av, 'head', grp); return grp;
}

// big fluffy fur earmuffs: a round puff of fur over each ear (a lumpy ball, its outline broken into tufts) on a
// thin band over the top of the head — placed by the skull's own sides at the ears' height
export function furMuffs(av, color = 0xf6f4f0, { size = 0.052 } = {}) {
  const vrm = av.vrm, h = vrm.humanoid; vrm.scene.updateMatrixWorld(true);
  const hd = h.getRawBoneNode('head').getWorldPosition(V());
  let ey = 0, n = 0; each(vrm, /EyeWhite/, (x, y) => { ey += y; n++; }); ey = n ? ey / n : hd.y + 0.06;
  let z0 = 1e9, z1 = -1e9; each(vrm, /Face_00_SKIN|Body_00_SKIN/, (x, y, z) => { if (Math.abs(y - ey - 0.03) < 0.012 && Math.abs(x - hd.x) < 0.03 && Math.abs(z - hd.z) < 0.2) { z0 = Math.min(z0, z); z1 = Math.max(z1, z); } });
  const o = V().set(hd.x, ey, z1 > z0 ? (z0 + z1) / 2 : hd.z), S = skull(vrm, o), k = S(Math.PI / 2, 0) / 0.09;
  // where the ears are: the sides of the skull a little below the eyes, a little behind the middle
  let hairOut = 0; each(vrm, /HAIR/i, (x, y, z) => { if (Math.abs(y - (ey - 0.012)) < 0.02 && Math.abs(z - (o.z - 0.01)) < 0.03) hairOut = Math.max(hairOut, Math.abs(x - o.x)); });
  const side = Math.max(S(Math.PI / 2 + 0.12, Math.PI / 2), S(Math.PI / 2 + 0.12, -Math.PI / 2), hairOut * 0.9), r = size * k;
  const furTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d'), img = g.createImageData(128, 128), d = img.data, c = new THREE.Color(color);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const f = 0.94 + 0.06 * Math.abs(Math.sin(x * 0.9 + Math.sin(y * 0.7) * 2) * Math.sin(y * 1.1 + x * 0.3)), i = (y * 128 + x) * 4; d[i] = 255 * c.r * f; d[i + 1] = 255 * c.g * f; d[i + 2] = 255 * c.b * f; d[i + 3] = 255; }
    g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
  let base = null; vrm.scene.traverse(ob => { if (base || !ob.isMesh) return; for (const m of [].concat(ob.material)) if (m.isMToonMaterial && !m.isOutline && /CLOTH/.test(m.name)) { base = m; break; } });
  let fur = new THREE.MeshStandardMaterial({ map: furTex, roughness: 1 }), grp = new THREE.Group();
  if (base) { fur = base.clone(); fur.name = 'Fur'; fur.map = furTex; fur.shadeMultiplyTexture = furTex; fur.color.setRGB(1, 1, 1); for (const k of ['normalMap', 'emissiveMap', 'shadingShiftTexture', 'rimMultiplyTexture', 'matcapTexture']) fur[k] = null; if (fur.emissive) fur.emissive.setRGB(0, 0, 0); if (fur.shadeColorFactor) fur.shadeColorFactor.setRGB(0.84, 0.84, 0.9); fur.alphaTest = 0; fur.transparent = false; fur.side = THREE.FrontSide; }   // (toon-lit like her clothes)
  for (const s of [-1, 1]) {
    const geo = new THREE.IcosahedronGeometry(1, 5), P = geo.attributes.position, q = V();
    for (let i = 0; i < P.count; i++) { q.fromBufferAttribute(P, i); const tuft = 1 + 0.035 * Math.sin(q.x * 9 + q.y * 6) * Math.sin(q.z * 7 - q.y * 5) + 0.02 * Math.sin(q.x * 17 - q.z * 13 + q.y * 11); P.setXYZ(i, q.x * r * 0.66 * tuft, q.y * r * tuft, q.z * r * 0.95 * tuft); }   // (a soft round puff)
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, fur); m.position.set(o.x + s * (side + r * 0.42), ey - 0.012 * k, o.z - 0.012 * k); grp.add(m);
  }
  const top = S(0, 0) + 0.008 * k, band = new THREE.Mesh(new THREE.TorusGeometry(1, 0.006 * k / (side + 0.01), 8, 40, Math.PI), new THREE.MeshStandardMaterial({ color: 0xe8e6e2, roughness: 0.6 }));
  band.scale.set(side + 0.006, top - (ey - 0.012 * k - o.y), 1); band.position.set(o.x, ey - 0.012 * k, o.z - 0.012 * k); grp.add(band);
  attach(av, 'head', grp); return grp;
}
