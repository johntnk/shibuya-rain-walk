// A necktie worn over the shirt: a neat knot at the collar, the blade widening down the shirt front to a point at the
// belt, in a small floral print (dark red flowers on black). It lies on the shirt as worn (its
// front down the middle, measured), and moves with it: each point skinned as the nearest point of the shirt is.
import * as THREE from 'three';
import { attach } from './kit.js';
import { toon } from './boots.js';

// a small floral print (ditsy), one 8 cm tile that repeats: little dark red flowers of five petals scattered close
// over a black ground, a pair of dark green leaves at each, the odd one with a speck of cream at its heart
const TILE = 0.08;
function print() {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d');
  g.fillStyle = '#151217'; g.fillRect(0, 0, S, S);
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const spots = []; for (let n = 0; n < 400 && spots.length < 30; n++) { const x = rnd() * S, y = rnd() * S; if (spots.every(([a, b]) => { const dx = Math.min(Math.abs(a - x), S - Math.abs(a - x)), dy = Math.min(Math.abs(b - y), S - Math.abs(b - y)); return dx * dx + dy * dy > 40 * 40; })) spots.push([x, y]); }
  const reds = ['#7c161b', '#931f25', '#651116', '#86191f'];
  for (const [x0, y0] of spots) {
    const r = 9 + rnd() * 4, rot = rnd() * Math.PI, col = reds[Math.floor(rnd() * reds.length)], heart = rnd() < 0.35;
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S], [S, S], [-S, -S], [S, -S], [-S, S]]) {   // (drawn across the edges too, so the tile meets itself)
      const x = x0 + ox, y = y0 + oy; if (x < -30 || x > S + 30 || y < -30 || y > S + 30) continue;
      g.fillStyle = '#2f3b26'; for (const a of [rot + 2.2, rot + 4.1]) { g.beginPath(); g.ellipse(x + Math.cos(a) * r * 1.35, y + Math.sin(a) * r * 1.35, r * 0.7, r * 0.3, a, 0, 7); g.fill(); }   // (two leaves)
      g.fillStyle = col; for (let k = 0; k < 5; k++) { const a = rot + k * Math.PI * 2 / 5; g.beginPath(); g.arc(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.48, 0, 7); g.fill(); }   // (five round petals)
      g.fillStyle = heart ? '#cdb991' : '#3d0a0d'; g.beginPath(); g.arc(x, y, r * 0.22, 0, 7); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function necktie(av) {
  const vrm = av.vrm, h = vrm.humanoid; vrm.scene.updateMatrixWorld(true);
  const W = b => h.getRawBoneNode(b).getWorldPosition(new THREE.Vector3());
  const nk = W('neck'), hp = W('hips'), cx = hp.x;
  let src = null; vrm.scene.traverse(o => { if (!src && o.isSkinnedMesh && o.name !== 'Jacket' && [].concat(o.material).some(m => !m.isOutline && /Tops/.test(m.name))) src = o; });
  if (!src) return;
  // the shirt's front down the middle, a centimetre at a time
  const P = src.geometry.attributes.position, I = src.geometry.index, fz = new Map(), band = y => Math.round(y / 0.01);
  for (let k = 0; k + 2 < I.count; k += 3) { const t = [I.getX(k), I.getX(k + 1), I.getX(k + 2)]; if (t[0] === t[1] && t[1] === t[2]) continue;
    for (const i of t) { if (Math.abs(P.getX(i) - cx) > 0.05 || P.getZ(i) < hp.z) continue; const b = band(P.getY(i)); fz.set(b, Math.max(fz.get(b) ?? -1e9, P.getZ(i))); } }   // (the front only, as wide as the tie: it lies over a sweater's edges, not between them)
  const known = [...fz.keys()].sort((a, b) => a - b);
  const zAt = y => { const b = band(y); let m = -1e9; for (let d = -3; d <= 3; d++) m = Math.max(m, fz.get(b + d) ?? -1e9); if (m > -1e8) return m;   /* (the most forward a few centimetres round: it hangs over bumps, not into them) */
    const lo = known.filter(k => k < b).pop(), hi = known.find(k => k > b); if (lo === undefined && hi === undefined) return nk.z + 0.09; if (lo === undefined) return fz.get(hi); if (hi === undefined) return fz.get(lo);
    return fz.get(lo) + (fz.get(hi) - fz.get(lo)) * (b - lo) / (hi - lo); };   // (where the front has a gap, across it from above and below)
  const yK = nk.y - 0.04, yEnd = hp.y + 0.07, top = yK - 0.013;
  // the blade
  const NR = 26, pos = [], uv = [], idx = [];
  let zs = Array.from({ length: NR + 1 }, (_, j) => zAt(top + (yEnd - top) * j / NR) + 0.011);   // (how far out each row lies, smoothed: no dips, no kinks)
  for (let pass = 0; pass < 4; pass++) zs = zs.map((z, j) => Math.max(z, j && j < NR ? (zs[j - 1] + zs[j + 1]) / 2 : z));
  for (let pass = 0; pass < 2; pass++) zs = zs.map((z, j) => j && j < NR ? (zs[j - 1] + 2 * z + zs[j + 1]) / 4 + 0.0005 : z);
  for (let j = 0; j <= NR; j++) {
    const t = j / NR, y = top + (yEnd - top) * t, w = (0.017 + 0.026 * Math.pow(t, 0.8)), z = zs[j];
    for (const c of [-1, 0, 1]) { const tip = j === NR && c === 0 ? -0.034 : 0; pos.push(cx + c * w, y + tip, z + (c === 0 ? 0.0025 : 0)); uv.push(c * w / TILE, (top - y - tip) / TILE); }   // (the print at its own size, however wide the tie is there)
  }
  for (let j = 0; j < NR; j++) for (let c = 0; c < 2; c++) { const k = j * 3 + c; idx.push(k, k + 1, k + 3, k + 1, k + 4, k + 3); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  // skinned as the shirt under it is: each point takes the skinning of the nearest point of the shirt's front, so
  // the two move as one (skinned its own way, by height, the shirt came through it as he breathed and swayed)
  const SI = src.geometry.attributes.skinIndex, SW = src.geometry.attributes.skinWeight, near = [];
  for (let i = 0; i < P.count; i++) if (Math.abs(P.getX(i) - cx) < 0.08 && P.getZ(i) > hp.z && P.getY(i) > yEnd - 0.1) near.push(i);
  const si = [], sw = [];
  for (let k = 0; k < pos.length; k += 3) {
    let best = -1, bd = 1e9; for (const i of near) { const d = (P.getX(i) - pos[k]) ** 2 + (P.getY(i) - pos[k + 1]) ** 2 + (P.getZ(i) - pos[k + 2]) ** 2; if (d < bd) { bd = d; best = i; } }
    for (let c = 0; c < 4; c++) { si.push(best < 0 ? 0 : SI.getComponent(best, c)); sw.push(best < 0 ? (c ? 0 : 1) : SW.getComponent(best, c)); }
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  const mats = toon(av, print(), 'Tie', [0.7, 0.68, 0.74]); for (const m of mats) { m.vertexColors = false; m.ignoreVertexColor = true; } mats[0].side = THREE.DoubleSide;
  mats[0].polygonOffset = true; mats[0].polygonOffsetFactor = -2; mats[0].polygonOffsetUnits = -8;   // (drawn over the shirt where they all but touch)
  if (mats.length > 1) { geo.addGroup(0, idx.length, 0); geo.addGroup(0, idx.length, 1); }
  const blade = new THREE.SkinnedMesh(geo, mats.length > 1 ? mats : mats[0]); blade.name = 'Tie'; blade.frustumCulled = false;
  src.parent.add(blade); blade.bind(src.skeleton, src.bindMatrix);
  // the knot: a small tapered block at the collar
  const kg = new THREE.BoxGeometry(0.034, 0.03, 0.014, 2, 2, 1), KP = kg.attributes.position;
  for (let i = 0; i < KP.count; i++) { const y = KP.getY(i); KP.setX(i, KP.getX(i) * (y < 0 ? 0.68 : 1)); if (KP.getZ(i) > 0) KP.setZ(i, KP.getZ(i) + 0.002 * (1 - Math.abs(KP.getX(i)) / 0.017)); }
  kg.computeVertexNormals(); { const KU = kg.attributes.uv; for (let i = 0; i < KU.count; i++) KU.setXY(i, KU.getX(i) * 0.034 / TILE, KU.getY(i) * 0.03 / TILE); }   // (the print at its own size on the knot too)
  const knot = new THREE.Mesh(kg, mats.length > 1 ? mats : mats[0]); if (mats.length > 1) { kg.clearGroups(); kg.addGroup(0, kg.index.count, 0); kg.addGroup(0, kg.index.count, 1); }
  knot.position.set(cx, yK, zAt(yK) + 0.008); knot.rotation.x = -0.12; attach(av, 'upperChest', knot);
  return blade;
}
