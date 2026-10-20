// A jacket worn open over the top: soft suede, boxy and loose (dropped, roomy, gathered in a little at the hem),
// a stand collar, the zip undone so it hangs open down the front over what's beneath, metal snaps down both
// edges. Made from the character's own top, copied a size up and skinned to the same bones, so it moves as the top
// does; the top stays underneath and shows down the front. Also: the top beneath turned into a black knit.
import * as THREE from 'three';
import { repaint, attach, blotch, std } from './kit.js';
import { subdivide, skinLike } from './puffer.js';
import { suede, toon } from './boots.js';

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// rgb: the suede (0–255); loft: how far it stands off the top; open: half the gap down the front at the chest
export function openJacket(av, { rgb = [92, 86, 58], loft = 0.017, open = 0.04, fold = false, hem = -1, tex = null, fluffy = 0, snaps = true, mend = false } = {}) {   // (mend: small holes in the top it's made from — a pocket's slit — closed up)   // (hem: cut short at this height; tex: its own texture; fluffy: tufted, a fur coat; snaps: the press studs)   // (fold: the stand collar turned down flat over the shoulders, an open-necked jacket)
  const vrm = av.vrm, h = vrm.humanoid; vrm.scene.updateMatrixWorld(true);
  const W = b => h.getRawBoneNode(b).getWorldPosition(new THREE.Vector3());
  const cx = W('hips').x, sh = Math.abs(W('leftUpperArm').x - cx), neckY = W('neck').y;
  let src = null; vrm.scene.traverse(o => { if (!src && o.isSkinnedMesh && [].concat(o.material).some(m => !m.isOutline && /Tops/.test(m.name))) src = o; });
  if (!src) return;
  const base = [].concat(src.material).find(m => !m.isOutline && /Tops/.test(m.name));
  const geo = subdivide(src.geometry), P = geo.attributes.position; geo.computeVertexNormals(); const Nn = geo.attributes.normal;
  // the body's front and its bottom edge, from the top itself
  let zMid = 0, nz = 0, hemY = 1e9; for (let i = 0; i < P.count; i++) { if (Math.abs(P.getX(i) - cx) < sh * 0.8) { zMid += P.getZ(i); nz++; hemY = Math.min(hemY, P.getY(i)); } } zMid /= Math.max(1, nz); if (hem > 0) hemY = Math.max(hemY, hem);
  const key = i => `${Math.round(P.getX(i) * 2e4)},${Math.round(P.getY(i) * 2e4)},${Math.round(P.getZ(i) * 2e4)}`, weld = new Map();
  for (let i = 0; i < P.count; i++) { const k = key(i); (weld.get(k) || weld.set(k, []).get(k)).push(i); }
  const gap = y => open + 0.018 * sm(neckY - 0.25, hemY, y);                           // (falling a little wider open towards the hem)
  const n = new THREE.Vector3(), q = new THREE.Vector3();
  for (const ids of weld.values()) {
    n.set(0, 0, 0); for (const i of ids) { n.x += Nn.getX(i); n.y += Nn.getY(i); n.z += Nn.getZ(i); } n.normalize();
    q.fromBufferAttribute(P, ids[0]); const dx = q.x - cx, body = Math.abs(dx) < sh * 0.95;
    let d = loft;
    if (body) d += 0.008 * sm(hemY + 0.03, hemY + 0.12, q.y) * sm(hemY + 0.22, hemY + 0.1, q.y) - 0.005 * sm(hemY + 0.03, hemY, q.y);   // (roomy above the hem, gathered at it)
    if (fluffy) d += fluffy * (0.5 + 0.5 * Math.sin(q.x * 160 + q.y * 90) * Math.sin(q.z * 140 - q.y * 70) + 0.4 * Math.sin(q.x * 330 - q.y * 260 + q.z * 210));   // (tufts of fur)
    q.addScaledVector(n, d);
    if (body && q.z > zMid) {
      const g = gap(q.y), e = Math.abs(dx) - g;
      if (e <= 0) { q.x = cx + Math.sign(dx || 1) * g; q.z -= 0.004; }                  // (the cloth that was across the opening folded back under the edge: a straight edge, not a cut)
      else if (e < 0.05) { const t = 1 - e / 0.05; q.x += Math.sign(dx) * 0.01 * t; q.z += 0.004 * t; }   // (the fronts hang open)
    }
    for (const i of ids) P.setXYZ(i, q.x, q.y, q.z);
  }
  if (fold) {                                                                         // (the collar turned down: what stood up above the neckline folded out and down over it)
    const nl = neckY - 0.035, axz = new THREE.Vector3(); var folded = new Set();
    for (const ids of weld.values()) { q.fromBufferAttribute(P, ids[0]); if (q.y <= nl) continue; const up = q.y - nl, dx = q.x - cx, dz = q.z - (zMid - 0.01), r = Math.hypot(dx, dz) || 1e-4; if (r > 0.085 || up > 0.08) continue;   // (the collar only: the arms are out at this height too)
      const w = sm(-0.035, 0.02, dz); if (w <= 0) continue;                                          // (turned down only round the front; behind the neck it stands, over the shirt's collar)
      const nx = cx + dx / r * (r + up * 0.9 + 0.006), nz = (zMid - 0.01) + dz / r * (r + up * 0.9 + 0.006), ny = nl - up * 0.55;
      for (const i of ids) { P.setXYZ(i, q.x + (nx - q.x) * w, q.y + (ny - q.y) * w, q.z + (nz - q.z) * w); if (w > 0.5) folded.add(i); } }
    void axz;
  }
  if (fold) {                                                                         // (cloth the fold has stretched long between the turned collar and the jacket, taken away)
    const I0 = geo.index, A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
    for (let k = 0; k + 2 < I0.count; k += 3) { const a = I0.getX(k), b = I0.getX(k + 1), c = I0.getX(k + 2); A.fromBufferAttribute(P, a); B.fromBufferAttribute(P, b); C.fromBufferAttribute(P, c);
      const f = folded.has(a) + folded.has(b) + folded.has(c); if (f > 0 && f < 3 && Math.max(A.distanceTo(B), B.distanceTo(C), C.distanceTo(A)) > 0.03) { I0.setX(k + 1, a); I0.setX(k + 2, a); } }   // (only between the turned collar and the rest)
  }
  // the opening: the strip down the front taken out, collar and all
  const I = geo.index;
  for (let k = 0; k + 2 < I.count; k += 3) {
    const a = I.getX(k), b = I.getX(k + 1), c = I.getX(k + 2), vs = [a, b, c];
    const sides = vs.map(i => Math.sign(P.getX(i) - cx));                               // (only what now spans the gap goes)
    if (vs.every(i => P.getZ(i) > zMid - 0.01) && Math.min(...sides) < 0 && Math.max(...sides) > 0) { I.setX(k + 1, a); I.setX(k + 2, a); }
  }
  I.needsUpdate = true; geo.computeVertexNormals();
  const NN = geo.attributes.normal; for (const ids of weld.values()) { n.set(0, 0, 0); for (const i of ids) { n.x += NN.getX(i); n.y += NN.getY(i); n.z += NN.getZ(i); } n.normalize(); for (const i of ids) NN.setXYZ(i, n.x, n.y, n.z); }
  if (hem > 0) for (let k = 0; k + 2 < I.count; k += 3) { const a = I.getX(k), b = I.getX(k + 1), c = I.getX(k + 2); if (Math.max(P.getY(a), P.getY(b), P.getY(c)) < hem) { I.setX(k + 1, a); I.setX(k + 2, a); } }
  if (hem > 0) for (let i = 0; i < P.count; i++) if (P.getY(i) < hem) P.setY(i, hem);   // (and what still hangs below, taken up to it: a straight hem, not a torn one)
  if (mend) {                                                                         // (the small holes: loops of edges with cloth on one side only, short ones, filled across)
    const canon = new Int32Array(P.count); for (const ids of weld.values()) for (const i of ids) canon[i] = ids[0];
    const seen = new Map();
    for (let k = 0; k + 2 < I.count; k += 3) { const t = [I.getX(k), I.getX(k + 1), I.getX(k + 2)]; if (t[0] === t[1] && t[1] === t[2]) continue;
      for (let e = 0; e < 3; e++) { const u = t[e], v = t[(e + 1) % 3], cu = canon[u], cv = canon[v]; if (cu === cv) continue; const key = cu < cv ? cu + ',' + cv : cv + ',' + cu, s = seen.get(key); if (s) s.n++; else seen.set(key, { n: 1, u: cu, v: cv }); } }
    const next = new Map(); for (const s of seen.values()) if (s.n === 1) next.set(s.u, s.v);
    const add = [], done = new Set();
    for (const start of next.keys()) {
      if (done.has(start)) continue; const loop = [start]; let c = next.get(start), per = 0, ok = false;
      for (let n = 0; n < 200 && c !== undefined; n++) { per += Math.hypot(P.getX(c) - P.getX(loop[loop.length - 1]), P.getY(c) - P.getY(loop[loop.length - 1]), P.getZ(c) - P.getZ(loop[loop.length - 1])); if (c === start) { ok = true; break; } if (done.has(c)) break; loop.push(c); c = next.get(c); }
      for (const v of loop) done.add(v);
      if (ok && loop.length >= 3 && per < 0.22) for (let i = 1; i + 1 < loop.length; i++) add.push(loop[0], loop[i + 1], loop[i]);
    }
    if (add.length) { const all = Array.from(I.array).concat(add); geo.setIndex(all); }
  }
  const tx = tex || suede(rgb), m = base.clone(); m.name = 'Jacket'; m.map = tx; m.shadeMultiplyTexture = tx; m.color.setRGB(1, 1, 1);
  for (const k of ['normalMap', 'emissiveMap', 'shadingShiftTexture', 'rimMultiplyTexture', 'outlineWidthMultiplyTexture', 'uvAnimationMaskTexture', 'matcapTexture']) m[k] = null;
  if (m.emissive) m.emissive.setRGB(0, 0, 0);
  m.alphaTest = 0; m.transparent = false; m.side = THREE.DoubleSide;                    // (its inside shows where the fronts hang open)
  if (m.shadeColorFactor) m.shadeColorFactor.setRGB(0.66, 0.64, 0.6);
  const o = m.clone(); o.name = 'Jacket (Outline)'; o.isOutline = true; o.side = THREE.BackSide;
  const cnt = geo.index.count; geo.clearGroups(); geo.addGroup(0, cnt, 0); geo.addGroup(0, cnt, 1);
  const jm = new THREE.SkinnedMesh(geo, [m, o]); jm.name = 'Jacket'; jm.frustumCulled = false;
  jm.position.copy(src.position); jm.quaternion.copy(src.quaternion); jm.scale.copy(src.scale); jm.bind(src.skeleton, src.bindMatrix);
  src.parent.add(jm); if (Array.isArray(vrm.materials)) vrm.materials.push(m, o);
  // snaps down both front edges
  const metal = new THREE.MeshStandardMaterial({ color: 0x8a8478, metalness: 0.7, roughness: 0.35 });
  if (snaps) for (const s of [-1, 1]) for (let k = 0; k < 5; k++) {
    const y = neckY - 0.07 - k * (neckY - 0.07 - hemY - 0.04) / 4; let best = null, bz = -1e9;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i); if (Math.abs(P.getY(i) - y) < 0.012 && Math.sign(x - cx) === s && Math.abs(Math.abs(x - cx) - gap(y) - 0.012) < 0.012 && P.getZ(i) > bz) { bz = P.getZ(i); best = i; } }
    if (best === null) continue;
    const snap = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.002, 14).rotateX(Math.PI / 2), metal);
    snap.position.set(P.getX(best), P.getY(best), bz + 0.0015); attach(av, y > neckY - 0.2 ? 'upperChest' : 'spine', snap);
  }
  return jm;
}

// the top beneath as a black knit: fine ribs, the cloth's folds kept, any stripes or trims gone dark with it
export function blackKnit(mat, rgb = [24, 24, 28]) {
  const src = mat.map && mat.map.image; if (!src) return;
  const S = src.width / 512;
  repaint(mat, (r, g, b, u, v, x, y) => {
    const l = (r + g + b) / 765, fold = Math.min(1.1, Math.max(0.75, 0.75 + l * 0.9)), rib = 0.88 + 0.12 * (0.5 + 0.5 * Math.cos(x / S * Math.PI * 2 / 4));
    const k = fold * rib * (0.95 + 0.08 * blotch(x, y, 5 * S, 2));
    return [rgb[0] * k, rgb[1] * k, rgb[2] * k];
  });
  if (mat.shadeColorFactor) mat.shadeColorFactor.setRGB(0.7, 0.7, 0.78);
}

// the top beneath done up to the neck: a zip that VRoid leaves a little open down the front, closed
export function closeFront(av) {
  const vrm = av.vrm, h = vrm.humanoid; vrm.scene.updateMatrixWorld(true);
  const cx = h.getRawBoneNode('hips').getWorldPosition(new THREE.Vector3()).x, sh = Math.abs(h.getRawBoneNode('leftUpperArm').getWorldPosition(new THREE.Vector3()).x - cx);
  vrm.scene.traverse(o => {
    if (!o.isSkinnedMesh || o.name === 'Jacket' || ![].concat(o.material).some(m => !m.isOutline && /Tops/.test(m.name))) return;
    const P = o.geometry.attributes.position; let zm = 0, n = 0; for (let i = 0; i < P.count; i++) if (Math.abs(P.getX(i) - cx) < sh * 0.8) { zm += P.getZ(i); n++; } zm /= Math.max(1, n);
    for (let i = 0; i < P.count; i++) { const dx = P.getX(i) - cx; if (P.getZ(i) > zm && Math.abs(dx) < 0.045) P.setX(i, cx + dx * Math.pow(Math.abs(dx) / 0.045, 1.5)); }   // (pulled together down the middle)
    P.needsUpdate = true; o.geometry.computeVertexNormals();
  });
}

// the jacket's own collar stood up round whatever high neck is under it: what of it rises round the neck pushed out
// to at least r from the neck's line, a little more at the top so it stands open — a stand collar of fur
export function standCollar(av, { r = 0.072, flare = 0.008 } = {}) {
  const vrm = av.vrm, h = vrm.humanoid; vrm.scene.updateMatrixWorld(true);
  const nk = h.getRawBoneNode('neck').getWorldPosition(new THREE.Vector3());
  vrm.scene.traverse(o => {
    if (o.name !== 'Jacket' || !o.isMesh) return; const P = o.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const y = P.getY(i), dx = P.getX(i) - nk.x, dz = P.getZ(i) - nk.z, d = Math.hypot(dx, dz) || 1e-4; if (d > 0.1) continue;
      const w = sm(nk.y - 0.06, nk.y - 0.025, y); if (w <= 0) continue;
      const want = Math.max(d, r + flare * sm(nk.y, nk.y + 0.07, y)), nd = d + (want - d) * w; P.setX(i, nk.x + dx / d * nd); P.setZ(i, nk.z + dz / d * nd);
    }
    P.needsUpdate = true;                                                             // (its normals left as they were: welded across the seams)
  });
}

// the top as a plain fine knit in rgb: nothing of its own print kept (a collar, buttons, seams drawn on it), only
// the light on its shape — fine ribs and a soft unevenness in the yarn
export function plainKnit(mat, rgb = [244, 240, 232], { rib = true } = {}) {   // (rib: false for a plain cotton, a shirt)
  const src = mat.map && mat.map.image; if (!src) return;
  const S = src.width / 512;
  repaint(mat, (r, g, b, u, v, x, y) => { const k = (rib ? 0.94 + 0.06 * (0.5 + 0.5 * Math.cos(x / S * Math.PI * 2 / 5)) : 1) * (0.97 + 0.05 * blotch(x, y, 6 * S, 3)); return [rgb[0] * k, rgb[1] * k, rgb[2] * k]; });
  if (mat.shadeColorFactor) mat.shadeColorFactor.setRGB(0.8, 0.78, 0.78);
}

// a turtleneck: the black knit rolled up round the neck to under the jaw (a ribbed tube a little off the skin, its
// top folded over), and the knit filling the front under the top's open zip, so no skin shows down the middle
export function turtleneck(av, rgb = [24, 24, 28], { high = 0.055, panel = true } = {}) {   // (high: how far up the neck it comes — a crew neck barely at all; panel: the knit filling the front under an open top)
  const vrm = av.vrm, h = vrm.humanoid; vrm.scene.updateMatrixWorld(true);
  const W = b => h.getRawBoneNode(b).getWorldPosition(new THREE.Vector3());
  const nk = W('neck'), hd = W('head'), cx = W('hips').x;
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'), img = g.createImageData(S, S), d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const k = 0.82 + 0.18 * (0.5 + 0.5 * Math.cos(x / S * Math.PI * 2 * 40)), i = (y * S + x) * 4; d[i] = rgb[0] * k; d[i + 1] = rgb[1] * k; d[i + 2] = rgb[2] * k; d[i + 3] = 255; }
  g.putImageData(img, 0, 0); const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const mat = new THREE.MeshLambertMaterial({ map: tex, color: 0xffffff });
  // the neck's reach round, every 30°, from its skin
  const NA = 32, y0 = nk.y - 0.035, y1 = Math.min(hd.y - 0.01, nk.y + high), R = new Float32Array(NA);
  vrm.scene.traverse(o => { if (!o.isMesh || ![].concat(o.material).some(m => /Body_00_SKIN/.test(m.name))) return; const P = o.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) { const y = P.getY(i); if (y < y0 || y > y1) continue; const dx = P.getX(i) - nk.x, dz = P.getZ(i) - nk.z, r = Math.hypot(dx, dz); if (r > 0.09) continue; const k = Math.floor(((Math.atan2(dx, dz) / (Math.PI * 2)) + 1) % 1 * NA); R[k] = Math.max(R[k], r); } });
  const Rs = Array.from(R, (_, k) => { let m = 0; for (let j = -2; j <= 2; j++) m = Math.max(m, R[(k + j + NA) % NA]); return (m || 0.05) + 0.009; });
  const pos = [], uv = [], idx = [], NY = 8;
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NA; i++) { const t = j / NY, a = i / NA * Math.PI * 2, r = Rs[i % NA] + 0.004 * Math.sin(Math.PI * t) + (t > 0.8 ? 0.004 : 0); pos.push(nk.x + Math.sin(a) * r, y0 + (y1 - y0) * t, nk.z + Math.cos(a) * r); uv.push(i / NA * 2, t); }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NA; i++) { const k = j * (NA + 1) + i; idx.push(k, k + 1, k + NA + 1, k + 1, k + NA + 2, k + NA + 1); }
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); tg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); tg.setIndex(idx); tg.computeVertexNormals();
  const tube = new THREE.Mesh(tg, mat); attach(av, 'neck', tube);
  // the front panel, just inside the top, from its hem up to the collar
  let src = null; vrm.scene.traverse(o => { if (!src && o.isSkinnedMesh && o.name !== 'Jacket' && [].concat(o.material).some(m => !m.isOutline && /Tops/.test(m.name))) src = o; });
  if (!src || !panel) return;
  const P = src.geometry.attributes.position; let hem = 1e9; const fz = new Map(), band = y => Math.round(y / 0.02);
  for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); if (Math.abs(x - cx) > 0.06) continue; hem = Math.min(hem, y); const k = band(y); fz.set(k, Math.max(fz.get(k) ?? -1e9, z)); }
  for (const [part, ya, yb] of [['spine', hem + 0.01, (hem + y0) / 2], ['upperChest', (hem + y0) / 2 - 0.01, y0 + 0.01]]) {
    const pp = [], pi = [], N = 8;
    for (let j = 0; j <= N; j++) { const y = ya + (yb - ya) * j / N, z = (fz.get(band(y)) ?? nk.z + 0.08) - 0.006; pp.push(cx - 0.035, y, z - 0.004, cx, y, z, cx + 0.035, y, z - 0.004); }
    for (let j = 0; j < N; j++) for (let c = 0; c < 2; c++) { const k = j * 3 + c; pi.push(k, k + 1, k + 3, k + 1, k + 4, k + 3); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); pg.setIndex(pi); pg.computeVertexNormals();
    const m2 = mat.clone(); m2.side = THREE.DoubleSide; attach(av, part, new THREE.Mesh(pg, m2));
  }
}

// rabbit fur: a soft grey-brown, thick with little tufts and the light catching their tips
export function rabbitFur(rgb = [158, 148, 142]) {
  const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'), img = g.createImageData(S, S), d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const hair = blotch(x, y * 0.3, 1.6, 1), tuft = blotch(x, y, 7, 5), soft = blotch(x, y, 40, 9);   // (fine hairs lying down the coat, little tufts, a gentle unevenness)
    const k = 0.9 + 0.1 * hair + 0.08 * (tuft - 0.5) + 0.05 * (soft - 0.5) + 0.06 * Math.pow(tuft * hair, 3), i = (y * S + x) * 4;
    d[i] = Math.min(255, rgb[0] * k); d[i + 1] = Math.min(255, rgb[1] * k); d[i + 2] = Math.min(255, rgb[2] * k); d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// a stand collar of fur: a soft roll standing up round the base of the neck, clear of the high neck under it, open
// at the throat with its corners there rounded off, flaring at the foot onto the coat — on the upper chest, so it
// stays put as the head turns
export function furCollar(av, tex, { height = 0.085, open = 0.55, clear = 0.03 } = {}) {
  const vrm = av.vrm, h = vrm.humanoid; vrm.scene.updateMatrixWorld(true);
  const nk = h.getRawBoneNode('neck').getWorldPosition(new THREE.Vector3()), y0 = nk.y - 0.055, NA = 48, Rn = new Float32Array(NA);
  vrm.scene.traverse(o => { if (!o.isMesh || ![].concat(o.material).some(m => /Body_00_SKIN/.test(m.name))) return; const P = o.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) { const y = P.getY(i); if (y < nk.y + 0.012 || y > nk.y + 0.035) continue; const dx = P.getX(i) - nk.x, dz = P.getZ(i) - nk.z, r = Math.hypot(dx, dz); if (r > 0.072) continue; const k = Math.floor(((Math.atan2(dx, dz) / (Math.PI * 2)) + 1) % 1 * NA); Rn[k] = Math.max(Rn[k], r); } });
  const R = Array.from(Rn, (_, k) => { let m = 0; for (let j = -3; j <= 3; j++) m = Math.max(m, Rn[(k + j + NA) % NA]); return m || 0.045; });
  const Rt = new Float32Array(NA);                                                    // (and the top under it at the collar's foot: it sits on that, not through it)
  vrm.scene.traverse(o => { if (!o.isSkinnedMesh || o.name === 'Jacket' || ![].concat(o.material).some(m => !m.isOutline && /Tops/.test(m.name))) return; const P = o.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) { if (Math.abs(P.getY(i) - y0) > 0.012) continue; const dx = P.getX(i) - nk.x, dz = P.getZ(i) - nk.z, r = Math.hypot(dx, dz); if (r > 0.13) continue; const k = Math.floor(((Math.atan2(dx, dz) / (Math.PI * 2)) + 1) % 1 * NA); Rt[k] = Math.max(Rt[k], r); } });
  const lerpA = (A, a) => { const f = ((a / (Math.PI * 2)) % 1 + 1) % 1 * NA, k = Math.floor(f) % NA, t = f - Math.floor(f); return A[k] * (1 - t) + A[(k + 1) % NA] * t; };
  const at = a => lerpA(R, a), foot = a => lerpA(Rt, a) + 0.007;
  const pos = [], uv = [], idx = [], NU = 72, NV = 10;
  for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
    const t = j / NV, a = open + (Math.PI * 2 - 2 * open) * i / NU, end = Math.min(i, NU - i) / NU;
    const y = y0 + height * (1 - 0.4 * (1 - sm(0, 0.1, end))) * t;                          // (lower and rounded at the ends)
    const fur = 0.0025 * Math.sin(a * 29 + t * 9) * Math.sin(a * 13 - t * 15), top = at(a) + clear, bot = Math.max(top + 0.02, foot(a)), r = top + (bot - top) * Math.pow(1 - t, 2) + 0.006 * Math.sin(Math.PI * t) + fur;
    pos.push(nk.x + Math.sin(a) * r, y, nk.z + Math.cos(a) * r); uv.push(i / NU * 3, t * 0.35);
  }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const k = j * (NU + 1) + i; idx.push(k, k + NU + 1, k + 1, k + 1, k + NU + 1, k + NU + 2); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const mats = toon(av, tex, 'FurCollar', [0.66, 0.64, 0.6]); for (const m of mats) { m.vertexColors = false; m.ignoreVertexColor = true; } mats[0].side = THREE.DoubleSide;
  if (mats.length > 1) { geo.addGroup(0, idx.length, 0); geo.addGroup(0, idx.length, 1); }
  const m = new THREE.Mesh(geo, mats.length > 1 ? mats : mats[0]); attach(av, 'upperChest', m); return m;
}

// black leather: a fine pebbled grain, and here and there the soft creases of a hide that's been worn
export function leather(rgb = [20, 20, 23]) {
  const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'), img = g.createImageData(S, S), d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const grain = blotch(x, y, 1.4, 7), crease = Math.pow(blotch(x * 0.3, y, 6, 11), 6), k = 0.9 + 0.16 * grain + 0.25 * crease, i = (y * S + x) * 4;
    d[i] = rgb[0] * k; d[i + 1] = rgb[1] * k; d[i + 2] = rgb[2] * k; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// a jacket drawn down into a long coat: the coat's skirt made new, one whole piece in the jacket's own cloth, from
// just inside its hem (hidden under it) down to `to`, round the body as wide as the jacket is above, then flaring
// out a little as it falls (an A-line), open down the front where the jacket is. It follows the legs more the lower
// it hangs, so a stride takes it along instead of coming through it. (Carrying the jacket's own hem on down
// tangles in whatever it has there: a doubled band, a pocket, its seams.)
export function lengthen(av, jm, { to, flare = 0.035, open = 0.03 } = {}) {
  const vrm = av.vrm, h = vrm.humanoid; vrm.scene.updateMatrixWorld(true);
  const W = b => h.getRawBoneNode(b).getWorldPosition(new THREE.Vector3());
  const hp = W('hips'), cx = hp.x, sh = Math.abs(W('leftUpperArm').x - cx), g = jm.geometry, P = g.attributes.position, I = g.index;
  const body = i => Math.abs(P.getX(i) - cx) < sh * 0.95;
  let lo = 1e9; for (let k = 0; k + 2 < I.count; k += 3) { if (I.getX(k) === I.getX(k + 1) && I.getX(k + 1) === I.getX(k + 2)) continue; for (let c = 0; c < 3; c++) { const i = I.getX(k + c); if (body(i)) lo = Math.min(lo, P.getY(i)); } }
  const NA = 72, slot = (dx, dz) => Math.floor(((Math.atan2(dx, dz) / (Math.PI * 2)) + 1) % 1 * NA), Rh = new Float32Array(NA), Rw = new Float32Array(NA), yTop = lo + 0.045;
  for (let i = 0; i < P.count; i++) { if (!body(i)) continue; const y = P.getY(i), dx = P.getX(i) - cx, dz = P.getZ(i) - hp.z, r = Math.hypot(dx, dz), s = slot(dx, dz);
    if (Math.abs(y - yTop) < 0.015) Rh[s] = Math.max(Rh[s], r);                         // (the hem's reach, where the skirt tucks in under it)
    if (y > yTop && y < yTop + 0.12) Rw[s] = Math.max(Rw[s], r); }                      // (and the jacket's widest just above)
  const fill = A => Array.from(A, (_, k) => { let m = 0; for (let j = -2; j <= 2; j++) m = Math.max(m, A[(k + j + NA) % NA]); return m; });
  const ease = A => { let B = A; for (let pass = 0; pass < 3; pass++) B = Array.from(B, (_, k) => { let s = 0; for (let j = -5; j <= 5; j++) s += B[(k + j + NA) % NA]; return s / 11; }); return B; };   // (round and even: a pocket in front mustn't push one panel out past the rest)
  const Hs = ease(fill(Rh)), Ws = ease(fill(Rw));
  // and the trousers under it, row by row, every way round: the skirt is kept clear of them (wide trousers would come through)
  const NV = 10, Rt = Array.from({ length: NV + 1 }, () => new Float32Array(NA)), rowOf = y => Math.round((y - yTop) / (to - yTop) * NV);
  vrm.scene.traverse(o => { if (!o.isMesh || ![].concat(o.material).some(m => /Bottoms|Trousers/.test(m.name || ''))) return; const BP = o.geometry.attributes.position;
    for (let i = 0; i < BP.count; i++) { const j = rowOf(BP.getY(i)); if (j < 0 || j > NV) continue; const dx = BP.getX(i) - cx, dz = BP.getZ(i) - hp.z, r = Math.hypot(dx, dz), sl = slot(dx, dz); for (const jj of [j - 1, j, j + 1]) if (jj >= 0 && jj <= NV) Rt[jj][sl] = Math.max(Rt[jj][sl], r); } });
  const Ts = Rt.map(fill);
  const at = (A, a) => { const f = ((a / (Math.PI * 2)) % 1 + 1) % 1 * NA, k = Math.floor(f) % NA, t = f - Math.floor(f); return A[k] * (1 - t) + A[(k + 1) % NA] * t; };
  const bones = jm.skeleton.bones, HIP = bones.indexOf(h.getRawBoneNode('hips')), LL = bones.indexOf(h.getRawBoneNode('leftUpperLeg')), RL = bones.indexOf(h.getRawBoneNode('rightUpperLeg'));
  // the trousers' points, with their skinning (by bone): the skirt moves as the trousers nearest it do, more so lower down
  const tp = []; vrm.scene.traverse(o => { if (!o.isSkinnedMesh || ![].concat(o.material).some(m => /Bottoms|Trousers/.test(m.name || ''))) return; const BP = o.geometry.attributes.position, BI = o.geometry.attributes.skinIndex, BW = o.geometry.attributes.skinWeight;
    for (let i = 0; i < BP.count; i += 2) { const y = BP.getY(i); if (y > yTop + 0.05 || y < to - 0.05) continue; const w = []; for (let c = 0; c < 4; c++) { const wt = BW.getComponent(i, c); if (wt > 0) w.push([bones.indexOf(o.skeleton.bones[BI.getComponent(i, c)]), wt]); } tp.push([BP.getX(i), y, BP.getZ(i), w.filter(([b]) => b >= 0)]); } });
  const NU = 64, pos = [], uv = [], si = [], sw = [], idx = [], maps = [];
  for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
    const t = j / NV, a = open + (Math.PI * 2 - 2 * open) * i / NU, sx = Math.sin(a), cz = Math.cos(a), r0 = Math.max(0.02, at(Hs, a) - 0.004, at(Ws, a) * 0.96), r1 = Math.max(r0, at(Ws, a)) + flare;   // (from the jacket's own width: no step where the one meets the other)
    const r = Math.max(r0 + (r1 - r0) * Math.min(1, Math.pow(t * 2.2, 0.7)) * (0.85 + 0.15 * t), at(Ts[j], a) + 0.04 + 0.01 * t), y = yTop + (to - yTop) * t;   // (out from under the hem to the coat's width, then on down, flaring; clear of the trousers)
    pos.push(cx + sx * r, y, hp.z + cz * r); uv.push(i / NU * 3, -t * 1.5);
    const px = cx + sx * r, pz = hp.z + cz * r, best = [];                              // (the six nearest points of the trousers at its own height, nearer counting more)
    for (const q of tp) { const d = (q[0] - px) ** 2 + 12 * (q[1] - y) ** 2 + (q[2] - pz) ** 2; if (best.length < 6 || d < best[best.length - 1][0]) { best.push([d, q]); best.sort((u, v) => u[0] - v[0]); if (best.length > 6) best.pop(); } }
    const k = Math.min(1, 0.8 + 1.2 * t), wts = new Map([[HIP, 1 - (best.length ? k : 0)]]), tot = best.reduce((s2, [d]) => s2 + 1 / (Math.sqrt(d) + 0.005), 0);
    for (const [d, q] of best) for (const [b, x] of q[3]) wts.set(b, (wts.get(b) || 0) + x * k * (1 / (Math.sqrt(d) + 0.005)) / tot);
    maps.push(wts);
  }
  for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {                          // (each point's skinning evened with its neighbours': no ragged hem where the legs part)
    const acc = new Map(); for (const [dj, di, f] of [[0, 0, 2], [0, -1, 1], [0, 1, 1], [-1, 0, 1], [1, 0, 1]]) { const jj = j + dj, ii = i + di; if (jj < 0 || jj > NV || ii < 0 || ii > NU) continue; for (const [b, x] of maps[jj * (NU + 1) + ii]) acc.set(b, (acc.get(b) || 0) + x * f); }
    const lw = acc.get(LL) || 0, rw = acc.get(RL) || 0;                                   // (a point mostly with one leg goes with that leg alone: only down the middle do the two share it)
    if (lw + rw > 0) { const f = lw / (lw + rw); if (f > 0.7) { acc.set(LL, lw + rw); acc.delete(RL); } else if (f < 0.3) { acc.set(RL, lw + rw); acc.delete(LL); } }
    const w = [...acc].filter(([b, x]) => b >= 0 && x > 0).sort((p, q) => q[1] - p[1]).slice(0, 4), sum = w.reduce((s2, [, x]) => s2 + x, 0) || 1;
    for (let c = 0; c < 4; c++) { si.push(w[c] ? w[c][0] : 0); sw.push(w[c] ? w[c][1] / sum : 0); }
  }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const k = j * (NU + 1) + i; idx.push(k, k + NU + 1, k + 1, k + 1, k + NU + 1, k + NU + 2); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); sg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  sg.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); sg.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4)); sg.setIndex(idx); sg.computeVertexNormals();
  const mats = [].concat(jm.material); if (mats.length > 1) { sg.addGroup(0, idx.length, 0); sg.addGroup(0, idx.length, 1); }
  const sk = new THREE.SkinnedMesh(sg, mats.length > 1 ? mats : mats[0]); sk.name = 'CoatSkirt'; sk.frustumCulled = false;
  jm.parent.add(sk); sk.bind(jm.skeleton, jm.bindMatrix); return sk;
}

// big buttons down the coat's front, on the panel that laps over, at these heights (each carried by the bone
// nearest it)
export function buttons(av, meshes, ys, { rgb = 0x2b1e17, r = 0.009 } = {}) {   // (meshes: the coat's pieces, any of which a button may sit on)
  const vrm = av.vrm, h = vrm.humanoid; vrm.scene.updateMatrixWorld(true);
  const W = b => h.getRawBoneNode(b).getWorldPosition(new THREE.Vector3()), hp = W('hips'), cx = hp.x, Ps = [].concat(meshes).filter(Boolean).map(m => m.geometry.attributes.position);
  const mat = std(rgb, { roughness: 0.35, metalness: 0.05 });
  for (const y of ys) {
    let best = null, bz = -1e9; for (const P of Ps) for (let i = 0; i < P.count; i++) { const dx = P.getX(i) - cx; if (Math.abs(P.getY(i) - y) < 0.014 && dx > -0.045 && dx < -0.006 && P.getZ(i) > bz) { bz = P.getZ(i); best = P.getX(i); } }
    if (best === null) continue;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, 0.003, 18).rotateX(Math.PI / 2), mat); b.position.set(best, y, bz + 0.002);
    attach(av, y > W('chest').y ? 'chest' : y > hp.y + 0.04 ? 'spine' : 'hips', b);
  }
}

// the sleeves' ends turned back to show the lining: the last few centimetres of each sleeve, copied a little out
// from it in rgb
export function cuffs(av, jm, tex, { depth = 0.022 } = {}) {
  const vrm = av.vrm, h = vrm.humanoid; vrm.scene.updateMatrixWorld(true);
  const wr = ['leftHand', 'rightHand'].map(b => h.getRawBoneNode(b).getWorldPosition(new THREE.Vector3())), el = ['leftLowerArm', 'rightLowerArm'].map(b => h.getRawBoneNode(b).getWorldPosition(new THREE.Vector3()));
  const g = jm.geometry, P = g.attributes.position, Nn = g.attributes.normal, I = g.index, keep = [], q = new THREE.Vector3();
  const along = (i, s) => { q.fromBufferAttribute(P, i); const d = el[s].clone().sub(wr[s]).normalize(); return q.clone().sub(wr[s]).dot(d); };   // (how far back up the arm from the wrist)
  for (let k = 0; k + 2 < I.count; k += 3) { const t = [I.getX(k), I.getX(k + 1), I.getX(k + 2)]; if (t[0] === t[1] && t[1] === t[2]) continue;
    for (const s of [0, 1]) if (t.every(i => { q.fromBufferAttribute(P, i); return q.distanceTo(wr[s]) < 0.12 && along(i, s) < depth; })) { keep.push(...t); break; } }
  if (!keep.length) return;
  const cg = g.clone(); const CP = cg.attributes.position; for (let i = 0; i < CP.count; i++) CP.setXYZ(i, P.getX(i) + Nn.getX(i) * 0.003, P.getY(i) + Nn.getY(i) * 0.003, P.getZ(i) + Nn.getZ(i) * 0.003);
  cg.setIndex(keep); cg.clearGroups();
  const mats = toon(av, tex, 'Cuffs', [0.8, 0.78, 0.76]); for (const m of mats) { m.vertexColors = false; m.ignoreVertexColor = true; } mats[0].side = THREE.DoubleSide;
  if (mats.length > 1) { cg.addGroup(0, keep.length, 0); cg.addGroup(0, keep.length, 1); }
  const m = new THREE.SkinnedMesh(cg, mats.length > 1 ? mats : mats[0]); m.name = 'Cuffs'; m.frustumCulled = false;
  jm.parent.add(m); m.bind(jm.skeleton, jm.bindMatrix); return m;
}

// a soft brushed wool, a little hairy, in rgb (the coat), or a plain cream wool (its lining)
export function brushedWool(rgb = [62, 64, 70]) {
  const S = 512, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'), img = g.createImageData(S, S), d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const hair = blotch(x * 0.5, y * 0.12, 1.5, 3), fluff = blotch(x, y, 5, 8), mott = blotch(x, y, 50, 13);
    const k = 0.88 + 0.12 * hair + 0.08 * (fluff - 0.5) + 0.07 * (mott - 0.5), i = (y * S + x) * 4;
    d[i] = rgb[0] * k; d[i + 1] = rgb[1] * k; d[i + 2] = rgb[2] * k; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// a cotton work jacket's cloth over whatever the top was: khaki canvas, a fine twill, the cloth's own folds and seams
// kept as light against its usual shade (its print, buttons and trims gone with the rest)
export function cottonTwill(mat, rgb = [150, 146, 126]) {
  const src = mat.map && mat.map.image; if (!src) return;
  const cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height; const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, cv.width, cv.height).data, ls = []; for (let i = 0; i < d.length; i += 16) if (d[i + 3] > 128) ls.push((d[i] + d[i + 1] + d[i + 2]) / 765);
  ls.sort((p, q) => p - q); const mid = Math.max(0.02, ls.length ? ls[ls.length >> 1] : 0.5), S = cv.width / 512;
  repaint(mat, (r, gg, b, u, v, x, y) => {
    const l = (r + gg + b) / 765, fold = Math.min(1.08, Math.max(0.72, Math.pow(l / mid, 0.6))), twill = 0.95 + 0.05 * Math.sin((x - y) * Math.PI / (1.8 * S)), k = fold * twill * (0.96 + 0.07 * blotch(x, y, 40 * S, 3));
    return [rgb[0] * k, rgb[1] * k, rgb[2] * k];
  });
  if (mat.shadeColorFactor) mat.shadeColorFactor.setRGB(0.7, 0.7, 0.72);
}

// shaggy fur: long dark hairs lying one way, a little lighter at their tips
export function shagFur(rgb = [44, 36, 32]) {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'), img = g.createImageData(S, S), d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const hair = blotch(x, y * 0.12, 1.2, 2), clump = blotch(x, y, 9, 7), k = 0.75 + 0.45 * Math.pow(hair, 1.5) + 0.15 * (clump - 0.5), i = (y * S + x) * 4;
    d[i] = Math.min(255, rgb[0] * k); d[i + 1] = Math.min(255, rgb[1] * k); d[i + 2] = Math.min(255, rgb[2] * k); d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
// a toon fur material: no drawn outline (its tufts would break it into scratches), a soft sheen round its edges
function furMats(av, tex) {
  const [m] = toon(av, tex, 'Fur', [0.7, 0.66, 0.66]); m.vertexColors = true; m.ignoreVertexColor = false; m.side = THREE.DoubleSide;
  if (m.parametricRimColorFactor) { m.parametricRimColorFactor.setRGB(0.28, 0.24, 0.22); m.parametricRimFresnelPowerFactor = 2.2; m.parametricRimLiftFactor = 0.04; m.rimLightingMixFactor = 0.6; }
  return m;
}
// a soft roll of fur along a path (each point [x, y, z, radius]), lying flat if given the surface's normal at each
// point, smooth in itself but its edges fringed with long pointed tufts sticking out every few millimetres, a little
// every which way — the ragged outline is what reads as fur. Skinned as the garment under it is
function furTube(jm, mat, pts, { ring = 20, flat = null, fringe = 0.012 } = {}) {
  const pos = [], uv = [], idx = [], n = pts.length;
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const frames = pts.map((q, j) => {
    const p = new THREE.Vector3(q[0], q[1], q[2]), t = new THREE.Vector3(...pts[Math.min(n - 1, j + 1)].slice(0, 3)).sub(new THREE.Vector3(...pts[Math.max(0, j - 1)].slice(0, 3))).normalize();
    const up = flat ? new THREE.Vector3(...flat[j]).normalize() : (Math.abs(t.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)), a = new THREE.Vector3().crossVectors(t, up).normalize(), b = new THREE.Vector3().crossVectors(a, t).normalize();
    return { p, t, a, b, r: q[3] * (0.4 + 0.6 * Math.sqrt(Math.min(1, Math.min(j, n - 1 - j) / 2.5))) };   // (rounded off at the ends)
  });
  const wa = flat ? 1.5 : 1, wb = flat ? 0.6 : 1;
  for (let j = 0; j < n; j++) { const { p, a, b, r } = frames[j];
    for (let i = 0; i <= ring; i++) { const th = i / ring * Math.PI * 2, f = 1 + 0.08 * Math.sin(th * 4 + j * 0.9), v = p.clone().addScaledVector(a, Math.cos(th) * r * wa * f).addScaledVector(b, Math.sin(th) * r * wb * f); pos.push(v.x, v.y, v.z); uv.push(i / ring, j * 0.12); } }
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < ring; i++) { const k = j * (ring + 1) + i; idx.push(k, k + 1, k + ring + 1, k + 1, k + ring + 2, k + ring + 1); }
  const col = []; for (let k = 0; k < pos.length / 3; k++) col.push(0.85, 0.85, 0.85);
  // the locks: soft tapering strips of fur from round the roll, lying out and down (fur falls), curving as they go,
  // dark at the root and catching the light at the tip; longest at the roll's sides
  if (fringe) for (let j = 0; j < n; j += 1) for (let m = 0; m < 5; m++) {
    const { p, a, b, r } = frames[j], th = (m / 5 + rnd() * 0.15) * Math.PI * 2, side = Math.abs(Math.cos(th));
    const out = a.clone().multiplyScalar(Math.cos(th)).addScaledVector(b, Math.max(0, Math.sin(th)) * 0.5).normalize(), down = new THREE.Vector3(0, -1, 0);
    const base = p.clone().addScaledVector(a, Math.cos(th) * r * wa * 0.85).addScaledVector(b, Math.sin(th) * r * wb * 0.85), len = fringe * (0.5 + 0.7 * side) * (0.7 + 0.6 * rnd()), w = 0.005 + 0.003 * rnd(), k0 = pos.length / 3, NS = 3;
    const across = new THREE.Vector3().crossVectors(out, b).normalize(); if (across.lengthSq() < 0.5) across.copy(a);
    for (let q = 0; q <= NS; q++) { const f = q / NS, c = base.clone().addScaledVector(out, len * f * 0.75).addScaledVector(down, len * f * f * 0.7).addScaledVector(b, 0.002 * f), hw = w * (1 - f) + 0.0004;
      for (const sgn of [-1, 1]) { const v = c.clone().addScaledVector(across, sgn * hw); pos.push(v.x, v.y, v.z); uv.push(0.5 + sgn * 0.05, f * 0.3); const k = 0.7 + 0.6 * f; col.push(k, k, k * 0.95); } }
    for (let q = 0; q < NS; q++) { const k = k0 + q * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  const [si, sw] = skinLike(jm, pos); g.setAttribute('skinIndex', si); g.setAttribute('skinWeight', sw);
  const m = new THREE.SkinnedMesh(g, mat); m.name = 'Fur'; m.frustumCulled = false; jm.parent.add(m); m.bind(jm.skeleton, jm.bindMatrix); return m;
}
// the open edges of a jacket, as runs of points in order (at rest): its front edges and neckline — not its hem, not a
// seam left open down the back, not the sleeves — and the ring at the end of each sleeve
function edges(jm, av) {
  const h = av.vrm.humanoid, sk = jm.skeleton, rest = n => new THREE.Vector3().setFromMatrixPosition(sk.boneInverses[sk.bones.indexOf(h.getRawBoneNode(n))].clone().invert());
  const hp = rest('hips'), cx = hp.x, sh = Math.abs(rest('leftUpperArm').x - cx), hands = [rest('leftHand'), rest('rightHand')];
  const g = jm.geometry, P = g.attributes.position, I = g.index, key = i => `${Math.round(P.getX(i) * 2e4)},${Math.round(P.getY(i) * 2e4)},${Math.round(P.getZ(i) * 2e4)}`, canon = new Map(), cid = new Int32Array(P.count);
  for (let i = 0; i < P.count; i++) { const k = key(i); if (!canon.has(k)) canon.set(k, i); cid[i] = canon.get(k); }
  const cnt = new Map(); for (let k = 0; k + 2 < I.count; k += 3) { const t = [cid[I.getX(k)], cid[I.getX(k + 1)], cid[I.getX(k + 2)]]; if (t[0] === t[1] || t[1] === t[2] || t[0] === t[2]) continue; for (let e = 0; e < 3; e++) { const u = t[e], v = t[(e + 1) % 3], kk = u < v ? u + ',' + v : v + ',' + u; cnt.set(kk, (cnt.get(kk) || 0) + 1); } }
  const bound = [...cnt].filter(([, c]) => c === 1).map(([kk]) => kk.split(',').map(Number)), pt = i => new THREE.Vector3().fromBufferAttribute(P, i);
  const armY = rest('leftUpperArm').y - 0.13, sleeve = i => Math.abs(P.getX(i) - cx) > sh * 0.9 && P.getY(i) > armY;   // (the sleeves: out past the shoulder, at arm's height — the body can be wider than the shoulders lower down)
  let lo = 1e9, zm = 0, nz = 0; for (let i = 0; i < P.count; i++) if (!sleeve(i)) { lo = Math.min(lo, P.getY(i)); if (Math.abs(P.getX(i) - cx) < sh * 0.8) { zm += P.getZ(i); nz++; } } zm /= Math.max(1, nz);
  const nky = rest('neck').y, body = i => !sleeve(i) && !(Math.abs(P.getX(i) - cx) < 0.015 && P.getZ(i) < zm);   // (not the sleeves, not a seam left open down the back)
  const chains = ok => {                                                               // (the edges whose ends both pass, joined up into runs)
    const adj = new Map(); for (const [u, v] of bound) if (ok(u) && ok(v)) { (adj.get(u) || adj.set(u, []).get(u)).push(v); (adj.get(v) || adj.set(v, []).get(v)).push(u); }
    const seen = new Set(), runs = [], walk = s0 => { const run = [s0]; seen.add(s0); let prev = -1, cur = s0; for (;;) { const nx = (adj.get(cur) || []).find(v => v !== prev && !seen.has(v)); if (nx === undefined) break; run.push(nx); seen.add(nx); prev = cur; cur = nx; } return run; };
    for (const [v, a] of adj) if (a.length === 1 && !seen.has(v)) runs.push(walk(v));     // (from their ends first, so each run is whole)
    for (const v of adj.keys()) if (!seen.has(v)) runs.push(walk(v));
    return runs.filter(r => r.length > 4).map(r => r.map(pt));
  };
  const front = chains(i => body(i) && P.getY(i) > lo + 0.02 && P.getY(i) < nky - 0.045 && P.getZ(i) > zm);   // (the opening down the front, where the zip is — not round the neck)
  const hem = chains(i => body(i) && P.getY(i) < lo + 0.025);
  // the sleeves' ends: the edge points out at the end of each arm, within a few centimetres of the wrist
  const cuffs = [];
  for (const hd of hands) { const s0 = Math.sign(hd.x - cx), reach = Math.abs(hd.x - cx), ring = [];
    for (const [u, v] of bound) for (const i of [u, v]) { const x = (P.getX(i) - cx) * s0; if (x > reach - 0.06 && Math.abs(P.getY(i) - hd.y) < 0.1) ring.push(pt(i)); }
    if (ring.length > 4) { let mx = -1e9; for (const q of ring) mx = Math.max(mx, (q.x - cx) * s0); cuffs.push({ ring: ring.filter(q => (q.x - cx) * s0 > mx - 0.02), dir: new THREE.Vector3(s0, 0, 0) }); } }
  return { cuffs, front, hem, hp };
}
// fur lining turned out along a jacket's front edges and round its neckline (a fat shaggy roll lying over the edge),
// and big fur cuffs at the ends of its sleeves, reaching back up the forearm and a little past the sleeve
export function furTrim(av, jm, tex, { r = 0.013, cuff = 0.075 } = {}) {
  const mat = furMats(av, tex), { cuffs, front, hem } = edges(jm, av), made = [], P = jm.geometry.attributes.position, Nn = jm.geometry.attributes.normal;
  const along = (run, lift) => {                                                       // (resampled every half centimetre and smoothed: the cut edge is ragged; lying on the jacket over its edge)
    const curve = new THREE.CatmullRomCurve3(run), len = curve.getLength(); if (len < 0.05) return;
    const sp = curve.getSpacedPoints(Math.max(6, Math.round(len / 0.005)));
    for (let pass = 0; pass < 4; pass++) for (let k = 1; k < sp.length - 1; k++) sp[k].lerp(sp[k - 1].clone().add(sp[k + 1]).multiplyScalar(0.5), 0.5);
    const pts = [], flat = [];
    for (let k = 0; k < sp.length; k++) {
      const p = sp[k], t = sp[Math.min(sp.length - 1, k + 1)].clone().sub(sp[Math.max(0, k - 1)]).normalize(), n = new THREE.Vector3(), c = new THREE.Vector3(); let bd = 1e9, cn = 0;
      for (let i = 0; i < P.count; i += 2) { const q = new THREE.Vector3().fromBufferAttribute(P, i), d = q.distanceTo(p); if (d < bd) { bd = d; n.fromBufferAttribute(Nn, i); } if (d < 0.045) { c.add(q); cn++; } }
      const toward = cn ? c.divideScalar(cn).sub(p) : new THREE.Vector3(); toward.addScaledVector(t, -toward.dot(t)).addScaledVector(n, -toward.dot(n)); if (toward.lengthSq() > 1e-8) toward.normalize();
      const q = p.clone().addScaledVector(toward, r * lift).addScaledVector(n, 0.004); pts.push([q.x, q.y, q.z, r]); flat.push([n.x, n.y, n.z]);
    }
    made.push(furTube(jm, mat, pts, { flat, fringe: 0.016 }));
  };
  for (const run of front) along(run, 0.8);                                          // (the lining turned out down both sides of the zip)
  for (const run of hem) along(run, 0.1);                                            // (and showing all along the hem)
  for (const { ring, dir } of cuffs) {                                                 // (the cuffs: round each sleeve's end, back up the arm, and a little past it)
    const c = ring.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(ring.length), rr = ring.reduce((a, p) => a + Math.hypot(p.y - c.y, p.z - c.z), 0) / ring.length, pts = [], NS = 18;
    for (let k = 0; k <= NS; k++) { const t = k / NS, p = c.clone().addScaledVector(dir, 0.015 - t * cuff); pts.push([p.x, p.y, p.z, rr + 0.008 + 0.006 * Math.sin(Math.PI * t)]); }
    made.push(furTube(jm, mat, pts, { ring: 28, fringe: 0.018 }));
  }
  return made;
}

// a plain round neck for a top whose own neckline is lower or open: a band of the same knit from just inside the
// top's neckline up to sit close round the base of the neck, all the way round, no gap between
export function crewNeck(av, top, rgb = [20, 20, 23], { y0, y1 } = {}) {   // (y0: no higher than this does the top's own edge count; y1: the band's top)
  const vrm = av.vrm, h = vrm.humanoid; vrm.scene.updateMatrixWorld(true);
  const nk = h.getRawBoneNode('neck').getWorldPosition(new THREE.Vector3()), NA = 48, slot = (dx, dz) => Math.floor(((Math.atan2(dx, dz) / (Math.PI * 2)) + 1) % 1 * NA);
  const Rn = new Float32Array(NA), Ty = new Float32Array(NA).fill(-1e9), Tr = new Float32Array(NA), skin = [];
  vrm.scene.traverse(o => { if (!o.isMesh || ![].concat(o.material).some(m => /Body_00_SKIN/.test(m.name || ''))) return; const P = o.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) { const y = P.getY(i), dx = P.getX(i) - nk.x, dz = P.getZ(i) - nk.z, r = Math.hypot(dx, dz);
      if (Math.abs(y - y1) < 0.012 && r < 0.08) Rn[slot(dx, dz)] = Math.max(Rn[slot(dx, dz)], r);
      if (y > y0 - 0.16 && y < y1 + 0.01 && r < 0.17) skin.push([slot(dx, dz), y, r]); } });   // (and the skin all down the front of the chest, to keep the band out over it)
  const over = (k, y) => { let m = 0; for (const [s2, sy, sr] of skin) if (Math.abs(sy - y) < 0.008 && (s2 === k || s2 === (k + 1) % NA || s2 === (k + NA - 1) % NA)) m = Math.max(m, sr); return m; };
  // the top's own edge, every way round: how high it comes there (low down the front, where it's open) and how far out
  { const P = top.geometry.attributes.position, I = top.geometry.index; for (let k = 0; I && k + 2 < I.count; k += 3) { const t = [I.getX(k), I.getX(k + 1), I.getX(k + 2)]; if (t[0] === t[1] && t[1] === t[2]) continue;
    for (const i of t) { const y = P.getY(i); if (y > y0 + 0.002) continue; const dx = P.getX(i) - nk.x, dz = P.getZ(i) - nk.z, r = Math.hypot(dx, dz); if (r > 0.16) continue; const k2 = slot(dx, dz); if (y > Ty[k2]) { Ty[k2] = y; Tr[k2] = r; } } } }
  const fill = (A, none) => { const B = Array.from(A, v => v === none ? null : v); for (let pass = 0; pass < 16; pass++) for (let k = 0; k < NA; k++) if (B[k] === null) { const a = B[(k + NA - 1) % NA], b = B[(k + 1) % NA]; if (a !== null || b !== null) B[k] = a !== null && b !== null ? (a + b) / 2 : a ?? b; }
    return B.map((_, k) => { let s = 0, n = 0; for (let j = -2; j <= 2; j++) { const v = B[(k + j + NA) % NA]; if (v !== null) { s += v; n++; } } return n ? s / n : 0.05; }); };
  const RN = fill(Rn, 0), TY = fill(Ty, -1e9).map((v, k) => Math.cos((k + 0.5) / NA * Math.PI * 2) < 0.2 ? Math.max(v, y0 - 0.01) : v), TR = fill(Tr, 0), pos = [], uv = [], idx = [], NV = 12;   // (round the back it's only the band: the jacket's there)
  for (let j = 0; j <= NV; j++) for (let i = 0; i <= NA; i++) { const t = j / NV, a = i / NA * Math.PI * 2, k = i % NA, e = 1 - (1 - t) * (1 - t), y = (Math.max(TY[k], y0 - 0.14) - 0.015) * (1 - t) + y1 * t, r = Math.max((TR[k] - 0.004) * (1 - e) + (RN[k] + 0.007) * e, over(k, y) + 0.005);   // (from just inside the top's edge, up and in to the neck, never inside the skin)
    pos.push(nk.x + Math.sin(a) * r, y, nk.z + Math.cos(a) * r); uv.push(i / NA * 2, t); }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NA; i++) { const k = j * (NA + 1) + i; idx.push(k, k + 1, k + NA + 1, k + 1, k + NA + 2, k + NA + 1); }
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'), img = g.createImageData(S, S), d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const k = (y < S * 0.15 ? 0.85 + 0.15 * (0.5 + 0.5 * Math.cos(x / S * Math.PI * 2 * 40)) : 0.95 + 0.05 * blotch(x, y, 3, 2)), i = (y * S + x) * 4; d[i] = rgb[0] * k; d[i + 1] = rgb[1] * k; d[i + 2] = rgb[2] * k; d[i + 3] = 255; }   // (the knit, ribbed at the band's top)
  g.putImageData(img, 0, 0); const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping;
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide })); attach(av, 'upperChest', m); return m;
}
