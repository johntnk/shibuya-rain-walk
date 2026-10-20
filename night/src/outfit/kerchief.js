// A silk neckerchief: a narrow twisted band round the neck at the collar, knotted at the front a little off to one
// side, its two pointed ends falling out over the chest. Orange silk with a small dark pattern.
import * as THREE from 'three';
import { each } from './wear.js';
import { toon } from './boots.js';

function silk(base, ink) {
  const W = 256, cv = document.createElement('canvas'); cv.width = cv.height = W;
  const g = cv.getContext('2d'); g.fillStyle = `rgb(${base})`; g.fillRect(0, 0, W, W);
  const rnd = (() => { let s = 11; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  g.strokeStyle = `rgb(${ink})`; g.fillStyle = `rgb(${ink})`; g.lineWidth = 2.2;
  for (let y = 0; y < W; y += 32) for (let x = (y / 32) % 2 * 16; x < W + 16; x += 32) {     // (little paisley drops and dots, in rows)
    g.beginPath(); g.ellipse(x, y, 7, 4.5, rnd() * Math.PI, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(x + 9, y - 6, 1.8, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(x - 8, y + 7, 1.4, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = `rgba(${ink},0.8)`; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, W - 6);    // (a border)
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function neckerchief(av, { base = [214, 108, 38], ink = [70, 36, 26] } = {}) {
  const vrm = av.vrm, h = vrm.humanoid; vrm.scene.updateMatrixWorld(true);
  const nk = h.getRawBoneNode('neck').getWorldPosition(new THREE.Vector3()), hd = h.getRawBoneNode('head').getWorldPosition(new THREE.Vector3());
  const nh = hd.y - nk.y, y0 = nk.y + 0.3 * nh, y1 = nk.y + 0.6 * nh, NA = 40, NT = 6, cx = nk.x, cz = nk.z + 0.006;   // (up round the neck itself, above the collar)
  const reach = new Float32Array(NA);
  each(vrm, /Body_00_SKIN|Tops/, (x, y, z) => { if (y < y0 - 0.008 || y > y1 + 0.008) return; const d = Math.hypot(x - cx, z - cz); if (d > 0.075) return;   /* (round the neck and the shirt's collar standing up round it) */ const k = Math.floor(((Math.atan2(x - cx, z - cz) / (Math.PI * 2)) + 1) % 1 * NA); reach[k] = Math.max(reach[k], d); });
  const R = Array.from(reach, (_, k) => { let m = 0; for (let d = -2; d <= 2; d++) m = Math.max(m, reach[(k + d + NA) % NA]); return (m || 0.045) + 0.005; });   // (snug round the collar)
  const tex = silk(base, ink), mats = toon(av, tex, 'Kerchief', [0.8, 0.62, 0.55]); for (const m of mats) { m.vertexColors = false; m.ignoreVertexColor = true; } mats[0].side = THREE.DoubleSide;
  const mesh = g => { if (mats.length > 1) { const n = g.index ? g.index.count : g.attributes.position.count; g.clearGroups(); g.addGroup(0, n, 0); g.addGroup(0, n, 1); } return new THREE.Mesh(g, mats.length > 1 ? mats : mats[0]); };
  const grp = new THREE.Group();
  // the band: twisted, so it bulges and pinches as it goes round
  { const pos = [], uv = [], idx = [];
    for (let j = 0; j <= NT; j++) for (let i = 0; i < NA; i++) {
      const t = j / NT, a = i / NA * Math.PI * 2, twist = 0.0015 * Math.sin(a * 6 + t * 3), out = Math.pow(Math.max(0, Math.cos(a)), 2), r = R[i] + 0.002 + 0.004 * Math.sin(Math.PI * t) + twist - 0.006 * Math.max(0, -Math.cos(a)), f = Math.max(0, Math.cos(a));   // (out on the shirt in front; round the sides and back it goes under the collars)
      pos.push(cx + Math.sin(a) * r, y0 + (y1 - y0) * t - 0.008 * f, cz + Math.cos(a) * r);   // (dipping a little in front, towards the knot)
      uv.push(i / NA * 4, t * 0.3);
    }
    for (let j = 0; j < NT; j++) for (let i = 0; i < NA; i++) { const k = j * NA + i, k1 = j * NA + (i + 1) % NA; idx.push(k, k1, k + NA, k1, k1 + NA, k + NA); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); grp.add(mesh(g)); }
  // the knot, a little to his right of the middle
  const kx = cx - 0.008, ky = y0 - 0.006, kz = cz + R[0] + 0.01;                       // (the knot at the throat)
  { const g = new THREE.IcosahedronGeometry(1, 3), P = g.attributes.position, q = new THREE.Vector3();
    for (let i = 0; i < P.count; i++) { q.fromBufferAttribute(P, i); const b = 1 + 0.12 * Math.sin(q.x * 7 + q.y * 5); P.setXYZ(i, q.x * 0.016 * b, q.y * 0.013 * b, q.z * 0.01 * b); }
    g.computeVertexNormals(); const uv = []; for (let i = 0; i < P.count; i++) uv.push(P.getX(i) * 20, P.getY(i) * 20); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const m = mesh(g); m.position.set(kx, ky, kz); grp.add(m); }
  // the two ends: flat pointed triangles hanging from the knot, splayed apart, lying on the chest
  const under = (x, y) => { let z = -1e9; each(vrm, /SKIN|Tops|CLOTH/, (vx, vy, vz) => { if (Math.abs(vx - x) < 0.02 && Math.abs(vy - y) < 0.012) z = Math.max(z, vz); }); return z; };
  for (const [ang, len, wid] of [[-0.18, 0.16, 0.06], [0.28, 0.13, 0.055]]) {           // (long enough to lie out over the shirt)
    const N = 8, pos = [], uv = [], idx = [];
    for (let j = 0; j <= N; j++) {
      const t = j / N, dx = Math.sin(ang) * len * t, dy = -Math.cos(ang) * len * t, w = wid * (1 - t) * (0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, t * 1.5 + 0.3)));
      const x = kx + dx, y = ky - 0.008 + dy, zu = under(x, y), z = Math.max(kz - 0.004 - 0.02 * t, (zu > -1e8 ? zu : kz - 0.02) + 0.006);
      const px = Math.cos(ang) * w / 2, py = Math.sin(ang) * w / 2;
      pos.push(x - px, y - py, z, x + px, y + py, z + 0.001); uv.push(0, t, 1, t);
    }
    for (let j = 0; j < N; j++) { const k = j * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); grp.add(mesh(g));
  }
  const b = h.getRawBoneNode('upperChest') || h.getRawBoneNode('chest'); b.updateMatrixWorld(true); grp.applyMatrix4(new THREE.Matrix4().copy(b.matrixWorld).invert()); b.add(grp); grp.traverse(c => { c.frustumCulled = false; });
  return grp;
}
