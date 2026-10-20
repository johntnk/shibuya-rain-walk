// A chunky knitted scarf in oatmeal wool: wound twice round the neck, plump, over the collar and under the hood, one
// end hanging down the chest a little to one side and finished in a fringe. The knit: rows of big V stitches, a
// little fuzz. Measured round the neck and the collar as worn; carried on the upper chest.
import * as THREE from 'three';
import { attach, blotch } from './kit.js';
import { toon } from './boots.js';

function chunky(rgb) {
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'), img = g.createImageData(S, S), d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const col = (x % 16) / 16, vee = Math.abs(col - 0.5), rib = 0.5 + 0.5 * Math.cos(2 * Math.PI * (y / 14 + vee * 0.9)), gap = Math.exp(-(((col - 0.5) / 0.07) ** 2)) * 0.12 + Math.exp(-((Math.min(col, 1 - col) / 0.05) ** 2)) * 0.18;
    const k = (0.8 + 0.22 * rib - gap) * (0.95 + 0.08 * (blotch(x, y, 2, 4) - 0.5)), i = (y * S + x) * 4;
    d[i] = rgb[0] * k; d[i + 1] = rgb[1] * k; d[i + 2] = rgb[2] * k; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function chunkyScarf(av, { rgb = [214, 196, 160] } = {}) {
  const vrm = av.vrm, h = vrm.humanoid; vrm.scene.updateMatrixWorld(true);
  const W = b => h.getRawBoneNode(b).getWorldPosition(new THREE.Vector3());
  const nk = W('neck'), hd = W('head'), hp = W('hips'), cx = nk.x, nh = hd.y - nk.y;
  const y0 = nk.y - 0.8 * nh, y1 = nk.y + 0.6 * nh, NA = 48, R = new Float32Array(NA);
  const slot = (dx, dz) => Math.floor(((Math.atan2(dx, dz) / (Math.PI * 2)) + 1) % 1 * NA);
  // the neck and collar's reach every way round (not the hood hanging behind: the scarf goes under that)
  vrm.scene.traverse(o => { if (!o.isMesh || !o.geometry.index || ![].concat(o.material).some(m => /SKIN|Tops|Jacket/.test(m.name || ''))) return; const P = o.geometry.attributes.position, I = o.geometry.index;
    for (let k = 0; k + 2 < I.count; k += 3) { const t = [I.getX(k), I.getX(k + 1), I.getX(k + 2)]; if (t[0] === t[1] && t[1] === t[2]) continue;
      for (const i of t) { const y = P.getY(i); if (y < y0 - 0.01 || y > y1) continue; const dx = P.getX(i) - cx, dz = P.getZ(i) - nk.z, r = Math.hypot(dx, dz); if (r > (dz > 0 ? 0.095 : 0.062)) continue;   /* (round the front, over the coat's collar; behind, under its hood) */ const s = slot(dx, dz); R[s] = Math.max(R[s], r); } } });
  const Rs = Array.from(R, (_, k) => { let m = 0; for (let j = -3; j <= 3; j++) m = Math.max(m, R[(k + j + NA) % NA]); return (m || 0.045) + 0.006; });
  const at = a => { const f = ((a / (Math.PI * 2)) % 1 + 1) % 1 * NA, k = Math.floor(f) % NA, t = f - Math.floor(f); return Rs[k] * (1 - t) + Rs[(k + 1) % NA] * t; };
  const mats = toon(av, chunky(rgb), 'Scarf', [0.8, 0.76, 0.72]); for (const m of mats) { m.vertexColors = false; m.ignoreVertexColor = true; } mats[0].side = THREE.DoubleSide;
  const mesh = (pos, uv, idx) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    if (mats.length > 1) { g.addGroup(0, idx.length, 0); g.addGroup(0, idx.length, 1); } const m = new THREE.Mesh(g, mats.length > 1 ? mats : mats[0]); attach(av, 'upperChest', m); return m; };
  // the wrap: two turns, plump, a little lower at the front
  { const pos = [], uv = [], idx = [], NU = 64, NV = 12;
    for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
      const t = j / NV, a = i / NU * Math.PI * 2, front = Math.max(0, Math.cos(a)), r = at(a) + (0.016 + 0.006 * front) * Math.pow(Math.sin(Math.PI * t), 0.6) + 0.005 * Math.sin(2 * Math.PI * t) + 0.003 * Math.sin(a * 7 + t * 5);   // (plump, fullest at the front)
      pos.push(cx + Math.sin(a) * r, y0 + (y1 - y0) * t - 0.012 * front, nk.z + Math.cos(a) * r); uv.push(i / NU * 8, t * 1.4);
    }
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const k = j * (NU + 1) + i; idx.push(k, k + 1, k + NU + 1, k + 1, k + NU + 2, k + NU + 1); }
    mesh(pos, uv, idx); }
  // the hanging end: a thick strip down the chest from the wrap's front, a little to one side, lying on what's there
  const yA = y0 + 0.004, yB = hp.y + 0.6 * (nk.y - hp.y) - 0.04, NR = 14, wd = 0.032, th = 0.012, side = Math.sign(W('leftUpperArm').x - cx) || 1;
  const fz = new Map(), band = y => Math.round(y / 0.01);
  vrm.scene.traverse(o => { if (!o.isMesh || ![].concat(o.material).some(m => /Tops|Jacket/.test(m.name || ''))) return; const P = o.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i) - cx; if (x * side < 0 || x * side > 0.07 || P.getZ(i) < hp.z) continue; const b = band(P.getY(i)); fz.set(b, Math.max(fz.get(b) ?? -1e9, P.getZ(i))); } });
  const zAt = y => { let m = -1e9; for (let d = -2; d <= 2; d++) m = Math.max(m, fz.get(band(y) + d) ?? -1e9); return m > -1e8 ? m : nk.z + 0.07; };
  const rows = []; for (let j = 0; j <= NR; j++) { const t = j / NR, y = yA + (yB - yA) * t, x = cx + side * (0.028 + 0.012 * t + 0.004 * Math.sin(t * 5)); rows.push([x, y, zAt(y) + 0.008 + th / 2 + 0.006 * Math.max(0, 1 - t * 3)]); }   // (standing off the wrap at the top, then lying on the coat)
  { const pos = [], uv = [], idx = [];
    for (let j = 0; j <= NR; j++) { const [x, y, z] = rows[j], lean = 0.25 * (1 - j / NR); for (const [u, v] of [[-1, 1], [1, 1], [1, -1], [-1, -1]]) { pos.push(x + u * wd * Math.cos(lean), y + u * wd * Math.sin(lean) * side, z + v * th / 2); uv.push((u + 1) / 2 * 1.6, j * 0.6); } }
    for (let j = 0; j < NR; j++) for (let c = 0; c < 4; c++) { const a = j * 4 + c, b = j * 4 + (c + 1) % 4; idx.push(a, b, a + 4, b, b + 4, a + 4); }
    const e = NR * 4; idx.push(e, e + 1, e + 2, e, e + 2, e + 3);
    mesh(pos, uv, idx); }
  // the fringe: short strands off the end
  { const pos = [], uv = [], idx = [], [x, y, z] = rows[NR], n = 9;
    for (let s = 0; s < n; s++) { const u = -1 + 2 * (s + 0.5) / n, sx = x + u * wd * 0.92, len = 0.024 + 0.006 * Math.sin(s * 2.3), sway = 0.003 * Math.sin(s * 1.7), b = pos.length / 3;
      for (const [dx, dy] of [[-0.0022, 0.002], [0.0022, 0.002], [0.0022 + sway, -len], [-0.0022 + sway, -len]]) { pos.push(sx + dx, y + dy, z); uv.push(0.5, 0.5); }
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3); }
    mesh(pos, uv, idx); }
}
