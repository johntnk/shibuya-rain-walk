// A soft cap of the newsboy kind (what's called a beret here): a full, flat crown of eight panels puffed out over a
// band that sits round the head just above the brows, the crown overhanging most in front, a button on top, and a
// short stiff peak. Shaped round the character's own skull; the hair beneath pressed flat.
import * as THREE from 'three';
import { skull, each } from './wear.js';
import { attach } from './kit.js';
import { toon } from './boots.js';

const V = () => new THREE.Vector3();
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function wool(rgb) {
  const W = 512, H = 256, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), img = g.createImageData(W, H), d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, f = (u * 8) % 1, seam = Math.exp(-Math.pow(Math.min(f, 1 - f) / 0.012, 2)), k = (0.95 + 0.05 * Math.sin(x * 1.7) * Math.sin(y * 1.3)) * (1 - 0.3 * seam), i = (y * W + x) * 4;
    d[i] = rgb[0] * k; d[i + 1] = rgb[1] * k; d[i + 2] = rgb[2] * k; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}

export function newsboy(av, rgb = [44, 50, 66]) {
  const vrm = av.vrm, h = vrm.humanoid; vrm.scene.updateMatrixWorld(true);
  const hd = h.getRawBoneNode('head').getWorldPosition(V());
  let ey = 0, n = 0; each(vrm, /EyeWhite/, (x, y) => { ey += y; n++; }); ey = n ? ey / n : hd.y + 0.06;
  let z0 = 1e9, z1 = -1e9; each(vrm, /Face_00_SKIN|Body_00_SKIN/, (x, y, z) => { if (Math.abs(y - ey - 0.03) < 0.012 && Math.abs(x - hd.x) < 0.03 && Math.abs(z - hd.z) < 0.2) { z0 = Math.min(z0, z); z1 = Math.max(z1, z); } });
  const o = V().set(hd.x, ey, z1 > z0 ? (z0 + z1) / 2 : hd.z), S = skull(vrm, o), size = S(Math.PI / 2, 0) / 0.09, PRESS = 0.008 * size;
  // the head's reach out from the middle, level, at height y and angle ph
  const horiz = (y, ph) => { let th = Math.PI / 2; for (let k = 0; k < 6; k++) th = Math.acos(Math.max(-0.9, Math.min(0.99, (y - o.y) / S(th, ph)))); return S(th, ph) * Math.sin(th); };
  const yBand = ph => o.y + (0.024 + 0.02 * Math.cos(ph)) * size, top = o.y + S(0, 0), yE = o.y + 0.066 * size;   // (down to the brows, the front just above the glasses; a short band, then the crown)
  const NP = 72, NS = 28, pos = [], uv = [], idx = [];
  for (let i = 0; i <= NP; i++) {
    const ph = i / NP * Math.PI * 2, s = Math.sin(ph), c = Math.cos(ph), front = Math.max(0, c);
    const r0 = horiz(yBand(ph), ph) + PRESS + 0.003, r1 = horiz(yE, ph) + PRESS + 0.008, r2 = r1 + (0.03 + 0.03 * front) * size, yb = yBand(ph);
    const cx = 0.012 * size, prof = [];                                                 // (the profile up through this angle: band, then the crown out over it and in to the top)
    for (let j = 0; j <= NS; j++) {
      const t = j / NS; let r, y;
      if (t < 0.2) { const u = t / 0.2; r = r0 + (r1 - r0) * u; y = yb + (yE - yb) * u; }
      else { const u = (t - 0.2) / 0.8, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), d = u * u;   // (a curve from the band's top, out over the overhang, in to the crown's middle)
        r = a * r1 + b * (r2 * 1.08) + d * 0; y = a * yE + b * (top - 0.005 * size) + d * (top + 0.018 * size); }   // (full and soft: out over the band and up, flattish on top)
      prof.push([r, y]);
    }
    prof.unshift([r0 - 0.009 * size, yb + 0.004], [r0 - 0.002, yb - 0.004]);           // (the band's lower edge turned in under itself: no hollow to see into)
    for (let j = 0; j <= NS + 2; j++) { const [r, y] = prof[j]; pos.push(o.x + s * r, y, o.z + c * r + cx * sm(0.2, 1, Math.max(0, j - 2) / NS)); uv.push(i / NP, Math.max(0, j - 2) / NS); }
  }
  for (let i = 0; i < NP; i++) for (let j = 0; j < NS + 2; j++) { const k = i * (NS + 3) + j, k2 = (i + 1) * (NS + 3) + j; idx.push(k, k2, k + 1, k + 1, k2, k2 + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const mats = toon(av, wool(rgb), 'Cap', [0.7, 0.7, 0.8]); for (const m of mats) { m.vertexColors = false; m.ignoreVertexColor = true; } mats[0].side = THREE.DoubleSide;
  const grp = new THREE.Group(), add = g => { if (mats.length > 1) { const n2 = g.index.count; g.clearGroups(); g.addGroup(0, n2, 0); g.addGroup(0, n2, 1); } grp.add(new THREE.Mesh(g, mats.length > 1 ? mats : mats[0])); };
  add(geo);
  // the peak: a short stiff curve out from the band in front, tipped down a little
  { const NB = 24, NR = 5, pp = [], pi = [], A = 0.95;
    for (let i = 0; i <= NB; i++) for (let j = 0; j <= NR; j++) {
      const ph = -A + 2 * A * i / NB, t = j / NR, r0 = horiz(yBand(ph), ph) + PRESS - 0.004, reach = 0.05 * size * Math.pow(Math.cos(ph / A * Math.PI / 2), 0.6), r = r0 + reach * t;   // (from inside the band, so it grows out of it)
      pp.push(o.x + Math.sin(ph) * r, yBand(ph) - 0.002 - 0.012 * size * t * t, o.z + Math.cos(ph) * r);
    }
    for (let i = 0; i < NB; i++) for (let j = 0; j < NR; j++) { const k = i * (NR + 1) + j, k2 = (i + 1) * (NR + 1) + j; pi.push(k, k + 1, k2, k + 1, k2 + 1, k2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(pp.map(() => 0.5).slice(0, (pp.length / 3) * 2), 2)); g.setIndex(pi); g.computeVertexNormals(); add(g); }
  // the button on top
  { const b = new THREE.Mesh(new THREE.SphereGeometry(0.008 * size, 12, 8).scale(1, 0.5, 1), mats[0]); b.position.set(o.x, top + 0.018 * size + 0.002, o.z + 0.012 * size); grp.add(b); }
  // the hair beneath, flat under the band and crown; let out below the band
  vrm.scene.traverse(ob => {
    if (!ob.isMesh || !/Hair/i.test([].concat(ob.material).map(m => m.name).join())) return;
    const P = ob.geometry.attributes.position, q = V();
    for (let i = 0; i < P.count; i++) {
      q.fromBufferAttribute(P, i).sub(o); const r = q.length(); if (r < 1e-4) continue;
      const th = Math.acos(q.y / r), ph = Math.atan2(q.x, q.z), below = yBand(ph) - (o.y + q.y);
      const lim = below <= 0 ? S(th, ph) + PRESS - 0.005 * size : S(th, ph) + PRESS - 0.003 * size + (Math.cos(ph) > 0.2 ? 0.02 : 0.5) * below;   // (well under the band; no fringe under the peak)
      if (r > lim) { q.multiplyScalar(lim / r).add(o); P.setXYZ(i, q.x, q.y, q.z); }
    }
    P.needsUpdate = true; ob.geometry.computeBoundingSphere();
  });
  attach(av, 'head', grp); return grp;
}
