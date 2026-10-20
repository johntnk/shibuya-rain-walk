// Small shared helpers: seeded random, Blender->three coordinates, and the batcher that merges every
// static piece of the town into one mesh per material (a few draw calls for the whole street).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function rng(seed) {
  let a = seed >>> 0;
  const f = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (lo, hi) => lo + (hi - lo) * f();
  f.pick = arr => arr[Math.floor(f() * arr.length) % arr.length];
  f.peek = () => { const s0 = a, v = f(); a = s0; return v; };      // the next value, without using it up
  return f;
}

// the layout is written in the Blender scene's metres (x along the street, y north, z up)
export const B = (x, y, z = 0) => new THREE.Vector3(x, z, -y);

export const col = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);   // sRGB hex -> linear

const M4 = new THREE.Matrix4();
export const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
export const RY = a => new THREE.Matrix4().makeRotationY(a);
export const mul = (...ms) => ms.reduce((a, b) => a.multiply(b), new THREE.Matrix4());

const TILE = 120;                                                 // (the village is drawn in tiles this big: out of view, not drawn)
export class Batcher {
  constructor() { this.groups = new Map(); }
  add(kind, geo, matrix, color) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    const keep = !color && g.attributes.color;                     // no colour given: the geometry carries its own per-vertex colours
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && !(keep && k === 'color')) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (matrix) g.applyMatrix4(matrix);
    if (!keep) {
      const n = g.attributes.position.count, c = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { c[i * 3] = color.r; c[i * 3 + 1] = color.g; c[i * 3 + 2] = color.b; }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    }
    g.computeBoundingBox(); const bb = g.boundingBox, tile = `${kind}|${Math.floor((bb.min.x + bb.max.x) / 2 / TILE)},${Math.floor((bb.min.z + bb.max.z) / 2 / TILE)}`;
    if (!this.groups.has(tile)) this.groups.set(tile, []);
    this.groups.get(tile).push(g);
  }
  build(materials) {
    const out = [];
    for (const [tile, list] of this.groups) {
      const k = tile.split('|')[0];
      const geo = mergeGeometries(list);
      const amp = (typeof location !== "undefined" && location.search.includes("nojit")) ? null : JITTER[k];
      if (amp) {                                                   // nothing hand-built is ruler-straight: a smooth 3D
        const p = geo.attributes.position;                          // wobble field (a vector per point, so faces sharing
        for (let i = 0; i < p.count; i++) {                         // a corner stay joined)
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
          p.setXYZ(i, x + amp[0] * (vn3(x * amp[1], y * amp[1], z * amp[1]) - 0.5) + amp[2] * (vn3(x * amp[3] + 11, y * amp[3], z * amp[3]) - 0.5),
                      y - amp[0] * vn3(x * amp[1] + 37, y * amp[1], z * amp[1]) * 0.5 - amp[2] * vn3(x * amp[3] + 53, y * amp[3], z * amp[3]) * 0.6,   // only ever settles down onto what holds it, never floats
                      z + amp[0] * (vn3(x * amp[1], y * amp[1] + 71, z * amp[1]) - 0.5) + amp[2] * (vn3(x * amp[3], y * amp[3] + 97, z * amp[3]) - 0.5));
        }
      }
      const m = new THREE.Mesh(geo, materials[k]);
      m.name = k; m.matrixAutoUpdate = false; out.push(m);
      list.forEach(g => g.dispose());
    }
    this.groups.clear();
    return out;
  }
}
export { M4 };

// what you can't walk through: a rectangle in frame M (local x0…x1, z0…z1), kept as the box round it plus the
// turned rectangle itself — [x0, x1, z0, z1, cx, cz, ux, uz, hu, hv] (an old-style collider is only the box)
export function obbCollider(M, x0, x1, z0, z1, pad = 0.3) {
  const c = new THREE.Vector3((x0 + x1) / 2, 0, (z0 + z1) / 2).applyMatrix4(M), u = new THREE.Vector3(1, 0, 0).transformDirection(M);
  const hu = Math.abs(x1 - x0) / 2 + pad, hv = Math.abs(z1 - z0) / 2 + pad, ex = Math.abs(u.x) * hu + Math.abs(u.z) * hv, ez = Math.abs(u.z) * hu + Math.abs(u.x) * hv;
  return [c.x - ex, c.x + ex, c.z - ez, c.z + ez, c.x, c.z, u.x, u.z, hu, hv];
}
export function inCollider(k, x, z) {
  if (!(x > k[0] && x < k[1] && z > k[2] && z < k[3])) return false;
  if (k.length < 10) return true;
  const dx = x - k[4], dz = z - k[5], u = dx * k[6] + dz * k[7], v = -dx * k[7] + dz * k[6];
  return Math.abs(u) < k[8] && Math.abs(v) < k[9];
}

// [low amplitude m, its frequency, fine amplitude, its frequency] per material
const JITTER = { snow: [0.07, 0.9, 0.025, 3.7], ice: [0.02, 2.0, 0.008, 9.0], stone: [0.02, 1.3, 0.008, 6.0], plain: [0.012, 0.8, 0.004, 5.0] };
function h3(i, j, k) { let h = (i * 374761393 + j * 668265263 + k * 1440662683) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function vn3(x, y, z) {
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z), fx = x - i, fy = y - j, fz = z - k;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const a = h3(i, j, k), b = h3(i + 1, j, k), c = h3(i, j + 1, k), d = h3(i + 1, j + 1, k);
  const e = h3(i, j, k + 1), f = h3(i + 1, j, k + 1), g = h3(i, j + 1, k + 1), hh = h3(i + 1, j + 1, k + 1);
  const x1 = a + (b - a) * u, x2 = c + (d - c) * u, x3 = e + (f - e) * u, x4 = g + (hh - g) * u;
  const y1 = x1 + (x2 - x1) * v, y2 = x3 + (x4 - x3) * v;
  return y1 + (y2 - y1) * w;
}
