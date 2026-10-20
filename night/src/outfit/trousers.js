// Tailored trousers: wide legs that hang straight and heavy from the hip to the shoe (VRoid widens trousers by
// flaring them at the hem; these are drawn in to one steady width all the way down, a touch over the thigh's),
// and a dark grey worsted with fine pale pinstripes running down the legs (VRoid lays a trouser's legs upright in
// its texture, so the stripes are columns across it), the cloth's own folds kept.
import * as THREE from 'three';
import { blotch, repaint } from './kit.js';

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function wideStraight(av, { ease = 1.08, curve = 0 } = {}) {   // (curve: the barrel ('scimitar') cut — fuller at the knee, in again at the hem)
  const h = av.vrm.humanoid; av.vrm.scene.updateMatrixWorld(true);
  let pm = null; av.vrm.scene.traverse(o => { if (!pm && o.isSkinnedMesh && [].concat(o.material).some(m => /Bottoms/.test(m.name))) pm = o; });
  if (!pm) return;
  const g = pm.geometry, P = g.attributes.position, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight, bones = pm.skeleton.bones, n = P.count;
  const L = new Set(['leftUpperLeg', 'leftLowerLeg', 'leftFoot'].map(b => h.getRawBoneNode(b))), R = new Set(['rightUpperLeg', 'rightLowerLeg', 'rightFoot'].map(b => h.getRawBoneNode(b)));
  const side = new Int8Array(n);                                                       // (which leg, by its bones: a flared hem crosses the middle)
  for (let i = 0; i < n; i++) { let l = 0, r = 0; for (let j = 0; j < 4; j++) { const w = SW.getComponent(i, j), b = bones[SI.getComponent(i, j)]; if (L.has(b)) l += w; else if (R.has(b)) r += w; } side[i] = l > r + 0.2 ? 1 : r > l + 0.2 ? -1 : 0; }
  // each leg's line (hip to ankle) and how far the cloth stands from it on average, 2 cm a step: every point is then
  // moved in or out from the line by the same factor as its step, so the folds keep their shape and only the width
  // evens out to the thigh's, all the way down
  const hipL = h.getRawBoneNode('leftUpperLeg').getWorldPosition(new THREE.Vector3()), hipR = h.getRawBoneNode('rightUpperLeg').getWorldPosition(new THREE.Vector3());
  const ankL = h.getRawBoneNode('leftFoot').getWorldPosition(new THREE.Vector3()), ankR = h.getRawBoneNode('rightFoot').getWorldPosition(new THREE.Vector3());
  const axis = (s, y) => { const a = s > 0 ? hipL : hipR, b = s > 0 ? ankL : ankR, t = Math.min(1.2, Math.max(-0.2, (y - b.y) / (a.y - b.y))); return [b.x + (a.x - b.x) * t, b.z + (a.z - b.z) * t]; };
  const B = 0.02, band = y => Math.round(y / B), sum = new Map(), key = (s, b) => s * 1000 + b;
  const rad = i => { const [ax, az] = axis(side[i], P.getY(i)); return Math.hypot(P.getX(i) - ax, P.getZ(i) - az); };
  for (let i = 0; i < n; i++) { if (!side[i]) continue; const k = key(side[i], band(P.getY(i))), e = sum.get(k) || { r: 0, n: 0 }; e.r += rad(i); e.n++; sum.set(k, e); }
  const mean = (s, y) => { let r = 0, c = 0; for (let d = -2; d <= 2; d++) { const e = sum.get(key(s, band(y) + d)); if (e) { r += e.r / e.n; c++; } } return c ? r / c : 0; };
  const hipY = hipL.y, top = hipY - 0.1, want = { 1: mean(1, top) * ease, '-1': mean(-1, top) * ease };
  for (let i = 0; i < n; i++) {
    const s0 = side[i]; if (!s0) continue; const x = P.getX(i), y = P.getY(i), z = P.getZ(i); if (y > top + 0.04) continue;
    const m = mean(s0, y); if (!m) continue;
    const tt = Math.min(1, Math.max(0, (top - y) / (top - 0.12))), bow = 1 + curve * Math.sin(Math.PI * Math.pow(tt, 0.85)) - curve * 0.35 * tt * tt;
    const k = Math.min(1.8, Math.max(0.6, want[s0] * bow / m)), kk = 1 + (k - 1) * sm(top + 0.04, top - 0.06, y), [ax, az] = axis(s0, y);
    P.setXYZ(i, ax + (x - ax) * kk, y, az + (z - az) * kk);
  }
  P.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere();
}

// base / line: the cloth and the chalk stripe (0–255); every: the stripes' spacing in texture pixels (on 512)
export function pinstripe(mat, { base = [54, 56, 62], line = [150, 152, 158], every = 6 } = {}) {
  const src = mat.map && mat.map.image; if (!src) return;
  const cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height;
  const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, cv.width, cv.height).data, ls = [];
  for (let i = 0; i < d.length; i += 16) if (d[i + 3] > 128) ls.push((d[i] + d[i + 1] + d[i + 2]) / 765);
  ls.sort((p, q) => p - q); const mid = Math.max(0.02, ls.length ? ls[ls.length >> 1] : 0.5), S = cv.width / 512, per = every * S;
  repaint(mat, (r, gg, b, u, v, x) => {
    const l = (r + gg + b) / 765, fold = Math.min(1.08, Math.max(0.7, Math.pow(l / mid, 0.5)));   // (the folds and seams kept)
    const f = ((x % per) + per) % per, stripe = 1 - sm(0.25 * S, 0.75 * S, Math.min(f, per - f));   // (a fine chalk line)
    const k = fold * (0.96 + 0.06 * blotch(x, v * cv.height, 3, 7));                   // (worsted: a faint grain)
    return [(base[0] + (line[0] - base[0]) * stripe * 0.4) * k, (base[1] + (line[1] - base[1]) * stripe * 0.4) * k, (base[2] + (line[2] - base[2]) * stripe * 0.4) * k];
  });
  if (mat.shadeColorFactor) mat.shadeColorFactor.setRGB(0.6, 0.62, 0.72);
}
