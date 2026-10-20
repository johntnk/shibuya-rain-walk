// A cowboy hat in dark wine-brown felt: a tall crown with a long crease down its top and a pinch either side at
// the front, a wide brim curled up at the sides and dipping a little front and back, a darker band round the
// crown's foot with small silver studs. Sized round the character's own skull (as the cap is), sitting level just
// above the glasses; the hair beneath pressed flat, what falls below the brim let out.
import * as THREE from 'three';
import { skull, each } from './wear.js';
import { attach, blotch, std } from './kit.js';
import { toon } from './boots.js';

const V = () => new THREE.Vector3();
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// felt: soft, close, a faint mottle, no weave to see
function felt(rgb, S = 256) {
  const cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d'), img = g.createImageData(S, S), d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const k = 0.93 + 0.08 * blotch(x, y, 9, 2) + 0.04 * (blotch(x, y, 2, 5) - 0.5), i = (y * S + x) * 4; d[i] = rgb[0] * k; d[i + 1] = rgb[1] * k; d[i + 2] = rgb[2] * k; d[i + 3] = 255; }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function cowboy(av, { rgb = [50, 22, 23], band = [26, 13, 14] } = {}) {
  const vrm = av.vrm, h = vrm.humanoid; vrm.scene.updateMatrixWorld(true);
  const hd = h.getRawBoneNode('head').getWorldPosition(V());
  let ey = 0, n = 0; each(vrm, /EyeWhite/, (x, y) => { ey += y; n++; }); ey = n ? ey / n : hd.y + 0.06;
  let z0 = 1e9, z1 = -1e9; each(vrm, /Face_00_SKIN|Body_00_SKIN/, (x, y, z) => { if (Math.abs(y - ey - 0.03) < 0.012 && Math.abs(x - hd.x) < 0.03 && Math.abs(z - hd.z) < 0.2) { z0 = Math.min(z0, z); z1 = Math.max(z1, z); } });
  const o = V().set(hd.x, ey, z1 > z0 ? (z0 + z1) / 2 : hd.z), S = skull(vrm, o), size = S(Math.PI / 2, 0) / 0.09, PRESS = 0.008 * size;
  const horiz = (y, ph) => { let th = Math.PI / 2; for (let k = 0; k < 6; k++) th = Math.acos(Math.max(-0.9, Math.min(0.99, (y - o.y) / S(th, ph)))); return S(th, ph) * Math.sin(th); };
  const yBand = ph => o.y + (0.026 + 0.018 * Math.cos(ph)) * size;                        // (level round the head, just above the glasses in front)
  const r0 = ph => horiz(yBand(ph), ph) + PRESS + 0.004;                                  // (the hat's opening, round the head)
  const H = 0.125 * size, NP = 96, grp = new THREE.Group();
  const mats = toon(av, felt(rgb), 'Hat', [0.66, 0.6, 0.66]); for (const m of mats) { m.vertexColors = false; m.ignoreVertexColor = true; } mats[0].side = THREE.DoubleSide;
  const add = (g, ms = mats) => { if (ms.length > 1) { const k = g.index.count; g.clearGroups(); g.addGroup(0, k, 0); g.addGroup(0, k, 1); } const m = new THREE.Mesh(g, ms.length > 1 ? ms : ms[0]); grp.add(m); return m; };
  const build = (NI, NJ, at) => { const pos = [], uv = [], idx = []; for (let i = 0; i <= NI; i++) for (let j = 0; j <= NJ; j++) { const p = at(i, j); pos.push(p[0], p[1], p[2]); uv.push(i / NI * 4, j / NJ); }
    for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) { const k = i * (NJ + 1) + j, k2 = (i + 1) * (NJ + 1) + j; idx.push(k, k2, k + 1, k + 1, k2, k2 + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; };
  // the crown: up from the band, a little in towards the top, pinched in at the front either side; then over the
  // top, a long crease down the middle from front to back
  const pinch = (ph, t) => { const w = Math.atan2(Math.sin(ph), Math.cos(ph)); return 1 - 0.22 * sm(0.3, 1, t) * (Math.exp(-(((w - 0.62) / 0.32) ** 2)) + Math.exp(-(((w + 0.62) / 0.32) ** 2))); };
  const NS = 18, NT = 14, yTop = ph => o.y + S(0, 0) + (0.034 + 0.01 * Math.cos(ph)) * size;   // (well clear of the top of the head, crease and all; a touch higher in front)
  const crease = (lat, ph, u) => { const c = Math.cos(ph), edge = 0.75 * Math.max(0, c) + 0.3 * Math.max(0, -c); return 0.024 * size * Math.exp(-((lat / (0.028 * size)) ** 2)) * (1 - Math.pow(u, 6) * (1 - edge)); };   // (down the middle, front to back; it runs out over the front edge, a notch there, and a little at the back)
  const wall = (ph, t) => { const y = yBand(ph) + (yTop(ph) - yBand(ph)) * t; return Math.max(r0(ph) * (1 - 0.15 * t * t) * pinch(ph, t), y < o.y + S(0, 0) ? horiz(y, ph) + PRESS + 0.006 : 0); };   // (drawn in towards the top, but never inside the head)
  const side = (ph, t) => { const r = wall(ph, t), rim = yTop(ph) - crease(Math.sin(ph) * r, ph, 1);
    return [o.x + Math.sin(ph) * r, yBand(ph) + (rim - yBand(ph)) * t, o.z + Math.cos(ph) * r]; };
  add(build(NP, NS, (i, j) => side(i / NP * Math.PI * 2, j / NS)));
  add(build(NP, NT, (i, j) => {                                                           // (the top: from the crown's rim in to the middle)
    const ph = i / NP * Math.PI * 2, u = 1 - j / NT, [x, , z] = side(ph, 1), px = o.x + (x - o.x) * u, pz = o.z + (z - o.z) * u, dome = 0.01 * size * (1 - u * u);
    return [px, yTop(ph) + dome - crease(px - o.x, ph, u) - 0.008 * size * (1 - u) * Math.max(0, Math.cos(ph)), pz];   // (and the front of the top sloping down to the pinch)
  }));
  // the brim: wide, curled up at the sides, dipping a little at front and back, from just inside the band out
  const NB = 10;
  add(build(NP, NB, (i, j) => {
    const ph = i / NP * Math.PI * 2, t = j / NB, s = Math.sin(ph), c = Math.cos(ph), W = (0.068 + 0.012 * s * s) * size, r = r0(ph) - 0.004 + W * t;
    const curl = 0.04 * size * s * s * t * t, dip = 0.012 * size * c * c * t;
    return [o.x + s * r, yBand(ph) - 0.002 + curl - dip, o.z + c * r];
  }));
  // the band round the crown's foot, and its studs
  const bm = toon(av, felt(band, 64), 'HatBand', [0.6, 0.55, 0.6]); for (const m of bm) { m.vertexColors = false; m.ignoreVertexColor = true; }
  add(build(NP, 2, (i, j) => { const ph = i / NP * Math.PI * 2, t = j / 2 * 0.17, r = wall(ph, t) + 0.0025; return [o.x + Math.sin(ph) * r, yBand(ph) + H * t, o.z + Math.cos(ph) * r]; }), bm);
  const silver = std(0xc9ccd2, { metalness: 0.85, roughness: 0.3 });
  for (let k = 0; k < 14; k++) { const ph = k / 14 * Math.PI * 2 + 0.11, r = wall(ph, 0.085) + 0.0045, st = new THREE.Mesh(new THREE.SphereGeometry(0.0032 * size, 10, 6).scale(1, 1, 0.5), silver);
    st.position.set(o.x + Math.sin(ph) * r, yBand(ph) + H * 0.085, o.z + Math.cos(ph) * r); st.lookAt(st.position.clone().add(V().set(Math.sin(ph), 0, Math.cos(ph)))); grp.add(st); }
  // the hair beneath: flat inside the crown; below the brim let out as it was
  vrm.scene.traverse(ob => {
    if (!ob.isMesh || !/Hair/i.test([].concat(ob.material).map(m => m.name).join())) return;
    const P = ob.geometry.attributes.position, q = V();
    for (let i = 0; i < P.count; i++) {
      q.fromBufferAttribute(P, i).sub(o); const r = q.length(); if (r < 1e-4) continue;
      const th = Math.acos(q.y / r), ph = Math.atan2(q.x, q.z), below = yBand(ph) - (o.y + q.y);
      const lim = below <= 0 ? S(th, ph) + PRESS - 0.004 * size : S(th, ph) + PRESS - 0.003 * size + (Math.cos(ph) > 0.2 ? 0.015 : 0.5) * below;
      if (r > lim) q.multiplyScalar(lim / r);
      if (below <= 0) {                                                                   // (and inside the crown wherever it's drawn in: under the top, inside the wall)
        const t = Math.min(1, (o.y + q.y - yBand(ph)) / (yTop(ph) - yBand(ph))), hr = Math.hypot(q.x, q.z), cap = wall(ph, t) - 0.006;
        if (hr > cap) { q.x *= cap / hr; q.z *= cap / hr; }
        q.y = Math.min(q.y, yTop(ph) - crease(q.x, ph, Math.min(1, hr / Math.max(1e-3, wall(ph, 1)))) - 0.008 - o.y);
      }
      q.add(o); P.setXYZ(i, q.x, q.y, q.z);
    }
    P.needsUpdate = true; ob.geometry.computeBoundingSphere();
  });
  attach(av, 'head', grp); return grp;
}
