// Hair combed straight back, parted on one side (the grown-up slicked-back cut): a smooth swept layer of hair over
// the skull, from a clean hairline — high on the brow, in at the temples, just over the ears — back over the crown
// and down to the nape, every strand running front to back like meridians; lifted a little at the front, dipping
// at the part. Grey shot through with streaks of silver-white. Built round the character's own skull; his own
// short hair is pressed flat underneath and coloured to match what shows of it below.
import * as THREE from 'three';
import { skull, each } from './wear.js';
import { repaint, attach, hash, blotch } from './kit.js';
import { toon } from './boots.js';

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// the streaks: which strands are silver, across (u), a little wavering along (v)
const streak = (u, v) => {
  const k = Math.floor(u * 140), fine = hash(k, 3), band = blotch(u * 900, v * 40, 60, 11);
  return Math.min(1, Math.max(0, (fine > 0.74 ? 0.45 : 0.2) * (0.6 + 0.8 * band) + 0.08 * (hash(k, 9) - 0.5)));   // (salt and pepper, soft)
};
function strands(base, light) {
  const W = 512, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), img = g.createImageData(W, H), d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H, s = streak(u, v), c = mix(base, light, s), clump = blotch(u * 1400 + v * 30, v * 60, 26, 5), i = (y * W + x) * 4;
    const k = 0.84 + 0.2 * clump + 0.05 * Math.sin(u * Math.PI * 2 * 70 + clump * 6);                            // (locks of hair, not a comb's even lines)
    d[i] = c[0] * k; d[i + 1] = c[1] * k; d[i + 2] = c[2] * k; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// base / light: the grey and the silver (0–255); part: where the part runs, in the strands' angle round from the
// top (negative: his right)
export function slickBack(av, { base = [108, 108, 114], light = [214, 214, 220], part = -0.36 } = {}) {
  const vrm = av.vrm, h = vrm.humanoid, V = () => new THREE.Vector3(); vrm.scene.updateMatrixWorld(true);
  const hd = h.getRawBoneNode('head').getWorldPosition(V()), le = h.getRawBoneNode('leftEye'), re = h.getRawBoneNode('rightEye');
  const eye = le && re ? le.getWorldPosition(V()).add(re.getWorldPosition(V())).multiplyScalar(0.5) : hd.clone().add(V().set(0, 0.06, 0.06));
  let z0 = 1e9, z1 = -1e9; each(vrm, /Face_00_SKIN|Body_00_SKIN/, (x, y, z) => { if (Math.abs(y - eye.y - 0.03) < 0.012 && Math.abs(x - hd.x) < 0.03 && Math.abs(z - hd.z) < 0.2) { z0 = Math.min(z0, z); z1 = Math.max(z1, z); } });
  const o = V().set(hd.x, eye.y, z1 > z0 ? (z0 + z1) / 2 : hd.z), S = skull(vrm, o), size = S(Math.PI / 2, 0) / 0.09;
  // the hairline's height round the head (φ from the front): high on the brow, over the ears, down at the nape
  const yHair = ph => o.y + (0.00875 + 0.0625 * Math.cos(ph) - 0.01125 * Math.cos(2 * ph) + 0.012 * Math.exp(-Math.pow((Math.abs(ph) - 0.62) / 0.22, 2))) * size;   // (a man's hairline: up a little at the temples)
  // the strands: side by side across the head (s, -1 to 1), each running from the brow over the top and down to the
  // nape (g, the angle up from the front, past straight up, round to below the back) — parallel, so they never
  // gather into a whorl anywhere; at the sides they run back level over the ears
  const K = 2.6, G0 = 0.45, G1 = 3.95;
  const dir = (sx, g) => { const flat = 0.85 * Math.pow(Math.abs(sx), 1.4); return V().set(sx * K, Math.sin(g) * (1 - flat), Math.cos(g)).normalize(); };   // (out at the sides the strands lie flat, straight back from the temple)
  const onSkull = v => { const th = Math.acos(Math.max(-1, Math.min(1, v.y))), ph = Math.atan2(v.x, v.z); return S(th, ph); };
  const above = (a, b) => { const v = dir(a, b), p = v.clone().multiplyScalar(onSkull(v)).add(o); return p.y - yHair(Math.atan2(p.x - o.x, p.z - o.z)); };
  // how thick the hair stands: some volume all over, lifted at the front, dipping at the part, thinning to the edge
  const thick = (a, b, b0, b1) => {
    const big = sm(part - 0.05, part + 0.5, a);                                        // (the seven side of a three-seven part carries the height)
    const lift = sm(1.35, 0.3, b) * (0.3 + 0.7 * big), dip = Math.exp(-Math.pow((a - part) / 0.045, 2)) * sm(1.8, 0.5, b);
    const edge = sm(0, 0.12, b - b0) * sm(0, 0.18, b1 - b);
    return size * (0.013 + 0.034 * lift - 0.02 * dip + 0.0009 * Math.sin(a * 23 + Math.sin(b * 3) * 2)) * (0.45 + 0.55 * edge);   // (full, not flat to the scalp; soft combed ridges)
  };
  const NA = 84, NB = 72, pos = [], uv = [], idx = [], rows = [];
  for (let i = 0; i <= NA; i++) {
    const sx = -1 + 2 * i / NA, a = Math.atan(sx * K);                                  // (a: how far round from the top this strand lies, as the part and the lift see it)
    // where this strand comes out of the hairline in front, and goes back into it at the nape
    let b0 = null, b1 = null;
    for (let k = 0; k <= 160; k++) { const g = G0 + (G1 - G0) * k / 160; if (above(sx, g) > 0) { b0 = g; break; } }
    for (let k = 0; k <= 160; k++) { const g = G1 - (G1 - G0) * k / 160; if (above(sx, g) > 0) { b1 = g; break; } }
    if (b0 === null || b1 === null || b1 - b0 < 0.3) { rows.push(null); continue; }
    const row = [];
    for (let j = 0; j <= NB; j++) {
      const b = b0 + (b1 - b0) * j / NB, v = dir(sx, b), r = onSkull(v) + thick(a, b, b0, b1), p = v.multiplyScalar(r).add(o);
      row.push(pos.length / 3); pos.push(p.x, p.y, p.z); uv.push(i / NA, j / NB);
    }
    rows.push(row);
  }
  for (let i = 0; i < NA; i++) { const A = rows[i], B = rows[i + 1]; if (!A || !B) continue; for (let j = 0; j < NB; j++) idx.push(A[j], B[j], A[j + 1], A[j + 1], B[j], B[j + 1]); }   // (facing out)
  // which way the hair lies on it (the streaks): combed from the brow over the head to below the nape, round the
  // line from a point low on the forehead to one low behind the neck — so over the sides it runs back above the ears
  // and down, as combed hair does, and nothing gathers anywhere it can be seen
  { const F = V().set(0, 0.12, 1).normalize(), C = V().set(0, -0.72, -0.7).normalize(), A = F.clone().sub(C).normalize(), M = F.clone().add(C).multiplyScalar(0.5 * 0.1 * size);
    const X = V().set(1, 0, 0).sub(A.clone().multiplyScalar(A.x)).normalize(), Y = A.clone().cross(X), q = V();
    for (let k = 0; k < pos.length / 3; k++) {
      q.set(pos[k * 3] - o.x, pos[k * 3 + 1] - o.y, pos[k * 3 + 2] - o.z).sub(M); const along = q.dot(A); q.addScaledVector(A, -along);
      uv[k * 2] = 0.5 + Math.atan2(q.dot(X), q.dot(Y)) / (Math.PI * 2) * 1.6; uv[k * 2 + 1] = 0.5 + along / (0.25 * size);
    } }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  // its own toon material, the hair's
  let src = null; vrm.scene.traverse(ob => { if (src || !ob.isMesh) return; for (const m of [].concat(ob.material)) if (m.isMToonMaterial && !m.isOutline && /Tops|Bottoms|CLOTH/.test(m.name)) { src = m; break; } });   // (a plain toon material: VRoid's hair one carries tints of its own)
  const tex = strands(base, light);
  let mats;
  if (src) {
    const m = src.clone(); m.name = 'SlickBack'; m.map = tex; m.shadeMultiplyTexture = tex; m.color.setRGB(1, 1, 1); m.side = THREE.FrontSide; m.alphaTest = 0; m.transparent = false;
    for (const k of ['normalMap', 'emissiveMap', 'shadingShiftTexture', 'rimMultiplyTexture', 'outlineWidthMultiplyTexture', 'uvAnimationMaskTexture']) m[k] = null;
    if (m.shadeColorFactor) m.shadeColorFactor.setRGB(0.62, 0.62, 0.7);
    if (m.emissive) m.emissive.setRGB(0, 0, 0); m.matcapTexture = null;                 // (VRoid's hair glows its highlight through an emissive map; without the map it would glow all over)
    const ol = m.clone(); ol.name = 'SlickBack (Outline)'; ol.isOutline = true; ol.side = THREE.BackSide;
    if (Array.isArray(vrm.materials)) vrm.materials.push(m, ol);
    mats = [m, ol]; geo.addGroup(0, idx.length, 0); geo.addGroup(0, idx.length, 1);
  } else mats = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
  const mesh = new THREE.Mesh(geo, mats); attach(av, 'head', mesh);
  // his own hair: what lies under the swept layer is pressed flat beneath it; all of it coloured grey and silver
  vrm.scene.traverse(ob => {
    if (!ob.isMesh || ob === mesh) return; const ms = [].concat(ob.material); if (!ms.some(m => /HAIR/i.test(m.name))) return;
    const P = ob.geometry.attributes.position, q = V();
    for (let i = 0; i < P.count; i++) {
      q.fromBufferAttribute(P, i).sub(o); const r = q.length(); if (r < 1e-4) continue;
      const ph = Math.atan2(q.x, q.z), under = o.y + q.y >= yHair(ph) - 0.004;
      const lim = onSkull(q.clone().normalize()) + (under ? 0.0005 : 0.006) * size;       // (under the swept layer: flat; below it: cut short and neat round the back and sides)
      if (r > lim) { q.multiplyScalar(lim / r).add(o); P.setXYZ(i, q.x, q.y, q.z); }
    }
    P.needsUpdate = true; ob.geometry.computeBoundingSphere();
    const I = ob.geometry.index;                                                         // (and cut above the ears: no long sideburns)
    if (I) { for (let k = 0; k + 2 < I.count; k += 3) { const a = I.getX(k), b = I.getX(k + 1), c = I.getX(k + 2), ys = Math.max(P.getY(a), P.getY(b), P.getY(c)), zs = Math.max(P.getZ(a), P.getZ(b), P.getZ(c)) - o.z;
      if (ys < o.y - 0.012 * size && zs > -0.03 * size) { I.setX(k + 1, a); I.setX(k + 2, a); } } I.needsUpdate = true; }
    for (const m of ms) if (/HAIR/i.test(m.name) && !/Outline/.test(m.name) && m.map) {
      repaint(m, (r, g, b) => { const l = (r + g + b) / 765, k = Math.min(1.15, 0.7 + l * 1.2), c = mix(base, light, 0.18); return [c[0] * k, c[1] * k, c[2] * k]; });   // (the short sides: grey, silvered a little)
      if (m.shadeColorFactor) m.shadeColorFactor.setRGB(0.62, 0.62, 0.7);
      if (m.emissive) m.emissive.setRGB(0, 0, 0);
    }
  });
  return mesh;
}

// her hair put up in one bun on the crown: the buns she had (hair standing well out from the skull high on the head)
// taken off, and a round twisted knot of hair set on top, a little back
export function topBun(av, rgb = [42, 33, 30]) {
  const vrm = av.vrm, h = vrm.humanoid; vrm.scene.updateMatrixWorld(true);
  const hd = h.getRawBoneNode('head').getWorldPosition(new THREE.Vector3());
  let ey = 0, n = 0; each(vrm, /EyeWhite/, (x, y) => { ey += y; n++; }); ey = n ? ey / n : hd.y + 0.06;
  let z0 = 1e9, z1 = -1e9; each(vrm, /Face_00_SKIN|Body_00_SKIN/, (x, y, z) => { if (Math.abs(y - ey - 0.03) < 0.012 && Math.abs(x - hd.x) < 0.03 && Math.abs(z - hd.z) < 0.2) { z0 = Math.min(z0, z); z1 = Math.max(z1, z); } });
  const o = new THREE.Vector3(hd.x, ey, z1 > z0 ? (z0 + z1) / 2 : hd.z), S = skull(vrm, o), size = S(Math.PI / 2, 0) / 0.09;
  vrm.scene.traverse(ob => {
    if (!ob.isMesh || !/HAIR/i.test([].concat(ob.material).map(m => m.name).join()) || !ob.geometry.index) return;
    // the hair's pieces (each a separate island of triangles, welded where the texture is cut): a piece high on the
    // head that stands well out from the skull is a bun
    const P = ob.geometry.attributes.position, I = ob.geometry.index, q = new THREE.Vector3(), par = new Int32Array(P.count).map((_, i) => i);
    const find = i => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; }, join = (a, b) => { a = find(a); b = find(b); if (a !== b) par[a] = b; };
    const seen = new Map(); for (let i = 0; i < P.count; i++) { const k = `${Math.round(P.getX(i) * 1e4)},${Math.round(P.getY(i) * 1e4)},${Math.round(P.getZ(i) * 1e4)}`; if (seen.has(k)) join(i, seen.get(k)); else seen.set(k, i); }
    for (let k = 0; k + 2 < I.count; k += 3) { join(I.getX(k), I.getX(k + 1)); join(I.getX(k + 1), I.getX(k + 2)); }
    const isl = new Map(); for (let i = 0; i < P.count; i++) { const r0 = find(i); q.fromBufferAttribute(P, i).sub(o); const r = q.length(), th = Math.acos(q.y / r), ph = Math.atan2(q.x, q.z), e = isl.get(r0) || { n: 0, y: 0, out: 0 }; e.n++; e.y += q.y; e.out = Math.max(e.out, r - S(th, ph)); isl.set(r0, e); }
    const bun = r0 => { const e = isl.get(r0); return e.n < P.count * 0.3 && e.y / e.n > 0.06 * size && e.out > 0.04 * size; };
    for (let k = 0; k + 2 < I.count; k += 3) { const a = I.getX(k); if (bun(find(a))) { I.setX(k + 1, a); I.setX(k + 2, a); } }
    I.needsUpdate = true;
  });
  // the knot: a squat ball wound round, the strands' twist in it
  const S2 = 128, cv = document.createElement('canvas'); cv.width = cv.height = S2; const g = cv.getContext('2d'), img = g.createImageData(S2, S2), d = img.data;
  for (let y = 0; y < S2; y++) for (let x = 0; x < S2; x++) { const u = x / S2, v = y / S2, k = 0.55 + 0.6 * Math.pow(0.5 + 0.5 * Math.sin((u * 7 + v * 3) * Math.PI * 2), 2) + 0.15 * Math.sin(u * 90 + v * 20), i = (y * S2 + x) * 4; d[i] = rgb[0] * k; d[i + 1] = rgb[1] * k; d[i + 2] = rgb[2] * k; d[i + 3] = 255; }
  g.putImageData(img, 0, 0); const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const mats = toon(av, tex, 'Bun', [0.6, 0.6, 0.7]); for (const m of mats) { m.vertexColors = false; m.ignoreVertexColor = true; }
  const th = 0.3, rb = 0.04 * size, at = S(th, Math.PI) + rb * 0.55, geo = new THREE.SphereGeometry(rb, 24, 16).scale(1, 0.82, 1);
  const P = geo.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), f = 1 + 0.06 * Math.sin(Math.atan2(x, z) * 3 + y * 60); P.setXYZ(i, x * f, y, z * f); } geo.computeVertexNormals();   // (lumpy where it's wound)
  if (mats.length > 1) { geo.addGroup(0, geo.index.count, 0); geo.addGroup(0, geo.index.count, 1); }
  const m = new THREE.Mesh(geo, mats.length > 1 ? mats : mats[0]); m.position.set(o.x, o.y + Math.cos(th) * at, o.z - Math.sin(th) * at); m.rotation.x = -th; attach(av, 'head', m); return m;
}

// the pieces a hair mesh is made of: each strand or lock a separate island of triangles (welded where the texture
// is cut) — its root for every vertex
function islands(g) {
  const P = g.attributes.position, I = g.index, par = new Int32Array(P.count).map((_, i) => i);
  const find = i => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; }, join = (a, b) => { a = find(a); b = find(b); if (a !== b) par[a] = b; };
  const seen = new Map(); for (let i = 0; i < P.count; i++) { const k = `${Math.round(P.getX(i) * 1e4)},${Math.round(P.getY(i) * 1e4)},${Math.round(P.getZ(i) * 1e4)}`; if (seen.has(k)) join(i, seen.get(k)); else seen.set(k, i); }
  if (I) for (let k = 0; k + 2 < I.count; k += 3) { join(I.getX(k), I.getX(k + 1)); join(I.getX(k + 1), I.getX(k + 2)); }
  return Int32Array.from({ length: P.count }, (_, i) => find(i));
}

// long hair worn loose in big soft waves, parted in the middle: the blunt fringe taken away (the locks that end in
// front of the face around the brows), and every lock below the cheek swung in S-curves side to side and in and out
// as it falls — each lock with its own phase, near ones nearly together — and fuller, standing out more the lower
// it goes. amp: how far a wave swings; wave: its length (m)
export function wavyHair(av, { amp = 0.013, wave = 0.075, volume = 0.022 } = {}) {
  const vrm = av.vrm, h = vrm.humanoid; vrm.scene.updateMatrixWorld(true);
  const hd = h.getRawBoneNode('head').getWorldPosition(new THREE.Vector3());
  let ey = 0, n = 0; each(vrm, /EyeWhite/, (x, y) => { ey += y; n++; }); ey = n ? ey / n : hd.y + 0.06;
  let z0 = 1e9, z1 = -1e9; each(vrm, /Face_00_SKIN|Body_00_SKIN/, (x, y, z) => { if (Math.abs(y - ey - 0.03) < 0.012 && Math.abs(x - hd.x) < 0.03 && Math.abs(z - hd.z) < 0.2) { z0 = Math.min(z0, z); z1 = Math.max(z1, z); } });
  const o = new THREE.Vector3(hd.x, ey, z1 > z0 ? (z0 + z1) / 2 : hd.z), y0 = ey - 0.035;
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  vrm.scene.traverse(ob => {
    if (!ob.isMesh || !/HAIR/i.test([].concat(ob.material).map(m => m.name).join()) || !ob.geometry.index) return;
    const g = ob.geometry, P = g.attributes.position, I = g.index, root = islands(g), low = new Map();
    for (let i = 0; i < P.count; i++) { const r = root[i], e = low.get(r); if (!e || P.getY(i) < P.getY(e)) low.set(r, i); }
    // the fringe: locks whose lowest point is in front of the face, about the brows
    const fringe = r => { const i = low.get(r), x = P.getX(i) - o.x, y = P.getY(i), z = P.getZ(i) - o.z; return z > 0.035 && y < ey + 0.06 && (y > ey - 0.055 && Math.abs(x) < 0.065 || y > ey - 0.09 && Math.abs(x) < 0.035); };   // (and right in the middle, a lock that hangs further, down to the nose)
    const brow = i => { const x = P.getX(i) - o.x, y = P.getY(i), z = P.getZ(i) - o.z; return z > 0.03 && Math.abs(x) < 0.045 && y < ey + 0.075 && y > ey - 0.09; };   // (and whatever hangs down over the middle of the brow, part of a lock or not)
    for (let k = 0; k + 2 < I.count; k += 3) { const a = I.getX(k), b = I.getX(k + 1), c = I.getX(k + 2); if (fringe(root[a]) || (brow(a) && brow(b) && brow(c))) { I.setX(k + 1, a); I.setX(k + 2, a); } }
    I.needsUpdate = true;
    const phase = new Map(); for (const r of low.keys()) phase.set(r, ((Math.imul(r + 1, 2654435761) >>> 0) / 4294967296) * 2.2);
    for (let i = 0; i < P.count; i++) {
      const y = P.getY(i); if (y > y0) continue;
      const dx = P.getX(i) - o.x, dz = P.getZ(i) - o.z, ph = Math.atan2(dx, dz), d = y0 - y, ramp = sm(0, 0.07, d);
      const t = 2 * Math.PI * d / wave + phase.get(root[i]) + ph * 1.6, side = amp * ramp * Math.sin(t), out = ramp * (volume * sm(0, 0.25, d) + 0.45 * amp * Math.cos(t));
      P.setX(i, P.getX(i) + Math.cos(ph) * side + Math.sin(ph) * out); P.setZ(i, P.getZ(i) - Math.sin(ph) * side + Math.cos(ph) * out);
    }
    P.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere();
  });
}
