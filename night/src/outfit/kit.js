// What the outfits share: painting over a VRoid model's own textures here in the page (found by material name,
// so a fresh export from VRoid with the same pieces picks the paint up again), and putting things on its bones.
import * as THREE from 'three';

export const hash = (x, y) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// soft blotches s pixels across, 0–1 (value noise)
export const blotch = (x, y, s, seed = 0) => {
  const fx = x / s, fy = y / s, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, ex = tx * tx * (3 - 2 * tx), ey = ty * ty * (3 - 2 * ty);
  const a = hash(ix + seed, iy), b = hash(ix + 1 + seed, iy), c = hash(ix + seed, iy + 1), d = hash(ix + 1 + seed, iy + 1);
  return a + (b - a) * ex + (c - a) * ey + (a - b - c + d) * ex * ey;
};

// the materials of the model by name (outlines left out)
export function materials(vrm) {
  const mats = new Map();
  vrm.scene.traverse(o => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (!m.name.includes('Outline')) mats.set(m.name, m); }); });
  return s => [...mats.entries()].filter(([n]) => n.includes(s)).map(([, m]) => m);
}

// redraw a material's texture through fn(r, g, b, u, v, x, y, a) → [r, g, b] (0–255) or [r, g, b, a]; a piece
// painted fully transparent is cut away (the material gets an alpha cutoff). all: the see-through pixels are
// offered too (to fill holes)
export function repaint(mat, fn, all = false) { const g = repaintSteps(mat, fn, all); let r; while (!(r = g.next()).done); return r.value; }
// the same, some rows at a time (a room got ready ahead: residents.js)
export function* repaintSteps(mat, fn, all = false) {
  const src = mat.map && mat.map.image; if (!src) return;
  const w = src.width, h = src.height, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(src, 0, 0);
  yield;
  const img = g.getImageData(0, 0, w, h), d = img.data; let cut = false;
  yield;
  for (let y = 0; y < h; y++) { if (y % 48 === 47) yield; for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4; if (d[i + 3] < 8 && !all) continue;
    const o = fn(d[i], d[i + 1], d[i + 2], (x + 0.5) / w, (y + 0.5) / h, x, y, d[i + 3]); if (!o) continue;
    d[i] = Math.max(0, Math.min(255, o[0])); d[i + 1] = Math.max(0, Math.min(255, o[1])); d[i + 2] = Math.max(0, Math.min(255, o[2]));
    if (o.length > 3) { d[i + 3] = o[3]; if (o[3] < 128) cut = true; }
  } }
  yield;
  g.putImageData(img, 0, 0);
  const old = mat.map, t = new THREE.CanvasTexture(cv);
  t.colorSpace = old.colorSpace; t.flipY = old.flipY; t.wrapS = old.wrapS; t.wrapT = old.wrapT; t.anisotropy = 8; t.needsUpdate = true;
  mat.map = t;
  if (mat.shadeMultiplyTexture && mat.shadeMultiplyTexture.image === src) mat.shadeMultiplyTexture = t;
  if (cut) { mat.alphaTest = 0.5; mat.needsUpdate = true; }
  return t;
}

export const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0, ...o });
// a thing built in the character's rest pose, parented to one of its bones
export function attach(av, bone, mesh) {
  const b = av.vrm.humanoid.getRawBoneNode(bone); b.updateMatrixWorld(true);
  mesh.applyMatrix4(new THREE.Matrix4().copy(b.matrixWorld).invert()); b.add(mesh); mesh.traverse(o => { o.frustumCulled = false; });
}

// recolour a garment to rgb (0–255) keeping its own folds, seams and weave: each pixel takes the colour scaled by
// how light it was against the cloth's average. keep: pixels lighter than this and nearly grey (white trims,
// soles, laces, a shirt collar) stay as they are. quilt: down-jacket channels across the cloth (horizontal in the
// texture, which VRoid lays out upright for body and sleeves), except where skip(u, v) says (the hood). mend: the
// holes torn in it (VRoid's ripped trousers) filled with the plain cloth.
export function tint(mat, rgb, o = {}) { const g = tintSteps(mat, rgb, o); let r; while (!(r = g.next()).done); return r.value; }
export function* tintSteps(mat, rgb, { keep = 0, quilt = 0, skip = null, gamma = 0.85, max = 1.6, mend = false } = {}) {
  const src = mat.map && mat.map.image; if (!src) return;
  const w = src.width, h = src.height, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(src, 0, 0);
  const d = g.getImageData(0, 0, w, h).data; let sum = 0, n = 0;
  const kept = (r, gg, b) => { const l = (r + gg + b) / 765, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b); return keep && l > keep && (mx - mn) / 255 < 0.12; };
  for (let i = 0; i < d.length; i += 16) if (d[i + 3] > 128 && !kept(d[i], d[i + 1], d[i + 2])) { sum += (d[i] + d[i + 1] + d[i + 2]) / 765; n++; }
  const mean = Math.max(0.02, n ? sum / n : 0.5);
  yield; return yield* repaintSteps(mat, (r, gg, b, u, v, x, y, a) => {
    if (mend && a < 250) return [rgb[0] * 0.92, rgb[1] * 0.92, rgb[2] * 0.92, 255];
    if (kept(r, gg, b)) return null;
    let k = Math.min(max, Math.pow(((r + gg + b) / 765) / mean, gamma));
    if (quilt && !(skip && skip(u, v))) {
      const f = (v / quilt) % 1, puff = Math.sin(Math.PI * f);
      k *= 0.8 + 0.28 * puff;                                         // (each channel full in the middle)
      k *= 1 - 0.35 * (1 - smooth(0.0, 0.06, Math.min(f, 1 - f)));    // (the stitched seam between)
    }
    return [rgb[0] * k, rgb[1] * k, rgb[2] * k];
  }, mend);
}
