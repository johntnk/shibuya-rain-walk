// An older man's face on a VRoid head: the jaw squared off (VRoid's chins come to a point; this widens the jaw
// below the mouth, more the lower it goes, till the chin is a short flat line), and a couple of lines of age — the
// folds from the nose down past the corners of the mouth. Done on the face mesh at rest; its expressions still
// play over it.
import * as THREE from 'three';
import { each } from './wear.js';
import { repaint } from './kit.js';

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// the face's landmarks, at rest: the mouth's box, the tip of the nose, the bottom of the chin, the head's middle
export function landmarks(vrm) {
  vrm.scene.updateMatrixWorld(true);
  const hd = vrm.humanoid.getRawBoneNode('head').getWorldPosition(new THREE.Vector3());
  const m = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 }; each(vrm, /FaceMouth/, (x, y) => { m.x0 = Math.min(m.x0, x); m.x1 = Math.max(m.x1, x); m.y0 = Math.min(m.y0, y); m.y1 = Math.max(m.y1, y); });
  let nose = { y: 0, z: -1e9 }, chin = 1e9; const cx = (m.x0 + m.x1) / 2;
  each(vrm, /Face_00_SKIN/, (x, y, z) => { if (Math.abs(x - cx) < 0.004) { if (y > m.y1 && y < m.y1 + 0.04 && z > nose.z) nose = { y, z }; if (z > hd.z) chin = Math.min(chin, y); } });
  return { cx, mouth: m, nose, chin, hd };
}

// extra: how much wider each side of the jaw goes at the chin (metres)
export function squareJaw(av, { extra = 0.018 } = {}) {
  const vrm = av.vrm, L = landmarks(vrm), top = (L.mouth.y0 + L.mouth.y1) / 2, zb = L.hd.z - 0.02;
  // the face's half-width now, every 5 mm down, in front
  const half = new Map(), band = y => Math.round(y / 0.005);
  each(vrm, /Face_00_SKIN/, (x, y, z) => { if (z > zb) { const k = band(y); half.set(k, Math.max(half.get(k) || 0, Math.abs(x - L.cx))); } });
  vrm.scene.traverse(o => {
    if (!o.isMesh || ![].concat(o.material).some(m => /Face_00_SKIN/.test(m.name))) return;
    const P = o.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i); if (y > top || y < L.chin - 0.03) continue;
      const w = Math.max(0.004, half.get(band(y)) || 0.004), add = extra * sm(top, L.chin, y), front = sm(zb, zb + 0.05, z);
      const k = Math.min(4, 1 + add / w) ; P.setX(i, L.cx + (x - L.cx) * (1 + (k - 1) * front));
    }
    P.needsUpdate = true; o.geometry.computeVertexNormals(); o.geometry.computeBoundingSphere();
  });
}

// the lines from the wings of the nose down past the corners of the mouth: faint, short, drawn on the skin
export function faceLines(av, { color = 0x7a625a } = {}) {
  const vrm = av.vrm, L = landmarks(vrm), tri = [];
  vrm.scene.traverse(o => {
    if (!o.isMesh || !o.geometry.index) return; const ms = [].concat(o.material), g = o.geometry, P = g.attributes.position, I = g.index;
    for (const gr of g.groups.length ? g.groups : [{ start: 0, count: I.count, materialIndex: 0 }]) { const m = ms[gr.materialIndex ?? 0]; if (!m || !/Face_00_SKIN/.test(m.name) || /Outline/.test(m.name)) continue;
      for (let k = gr.start; k < gr.start + gr.count; k++) { const i = I.getX(k); tri.push(P.getX(i), P.getY(i), P.getZ(i)); } }
  });
  const front = (x, y) => { let z = -1e9; for (let t = 0; t < tri.length; t += 9) { const ax = tri[t], ay = tri[t + 1], bx = tri[t + 3], by = tri[t + 4], cx = tri[t + 6], cy = tri[t + 7], d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(d) < 1e-12) continue; const u = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d, v = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d; if (u < 0 || v < 0 || u + v > 1) continue; z = Math.max(z, u * tri[t + 2] + v * tri[t + 5] + (1 - u - v) * tri[t + 8]); } return z; };
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.38, depthWrite: false }), grp = new THREE.Group();
  const mw = (L.mouth.x1 - L.mouth.x0) / 2;
  for (const s of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10, x = L.cx + s * (mw * 0.55 + (mw * 1.15 - mw * 0.55) * t + 0.004 * Math.sin(t * Math.PI)), y = L.nose.y - 0.002 - (L.nose.y - 0.002 - (L.mouth.y0 + 0.002)) * t;
      const z = front(x, y); if (z > -1e8) pts.push(new THREE.Vector3(x, y, z + 0.0008));
    }
    if (pts.length < 4) continue;
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.00045, 4, false), mat); m.userData.noInk = true; m.renderOrder = 2; grp.add(m);
  }
  const b = vrm.humanoid.getRawBoneNode('head'); b.updateMatrixWorld(true); grp.applyMatrix4(new THREE.Matrix4().copy(b.matrixWorld).invert()); b.add(grp); grp.traverse(c => { c.frustumCulled = false; });
  return grp;
}

// the vertices of the pieces whose material matches re, each moved by fn(Vector3, piece's centre per side) — the
// centre is the middle of that piece on that side of the face (each eye its own)
function reshape(vrm, re, fn) {
  vrm.scene.traverse(o => {
    if (!o.isMesh || !o.geometry.index) return; const ms = [].concat(o.material), g = o.geometry, P = g.attributes.position, I = g.index, ids = new Set();
    for (const gr of g.groups.length ? g.groups : [{ start: 0, count: I.count, materialIndex: 0 }]) { const m = ms[gr.materialIndex ?? 0]; if (!m || !re.test(m.name) || /Outline/.test(m.name)) continue; for (let k = gr.start; k < gr.start + gr.count; k++) ids.add(I.getX(k)); }
    if (!ids.size) return;
    const c = { '-1': new THREE.Vector3(), 1: new THREE.Vector3() }, n = { '-1': 0, 1: 0 }, cx = (() => { let s = 0; for (const i of ids) s += P.getX(i); return s / ids.size; })();
    const box = { '-1': [1e9, -1e9, 1e9, -1e9], 1: [1e9, -1e9, 1e9, -1e9] };
    for (const i of ids) { const s = P.getX(i) < cx ? -1 : 1, b = box[s]; b[0] = Math.min(b[0], P.getX(i)); b[1] = Math.max(b[1], P.getX(i)); b[2] = Math.min(b[2], P.getY(i)); b[3] = Math.max(b[3], P.getY(i)); }
    for (const s of [-1, 1]) { const b = box[s]; c[s].set((b[0] + b[1]) / 2, (b[2] + b[3]) / 2, 0); }
    const v = new THREE.Vector3(); for (const i of ids) { v.fromBufferAttribute(P, i); fn(v, c[v.x < cx ? -1 : 1], cx); P.setXYZ(i, v.x, v.y, v.z); }
    P.needsUpdate = true; g.computeBoundingSphere();
  });
}

// eyes for a grown man: narrower (the lids lower), the irises a touch smaller and a plain dark brown, no sparkle
export function matureEyes(av, { lid = 0.78, iris = 0.86, rgb = [62, 46, 38] } = {}) {
  const vrm = av.vrm;
  reshape(vrm, /EyeWhite|EyeIris|EyeHighlight|FaceEyeline/, (v, c) => { v.y = c.y + (v.y - c.y) * lid; });
  reshape(vrm, /EyeIris/, (v, c) => { v.x = c.x + (v.x - c.x) * iris; v.y = c.y + (v.y - c.y) * iris; });
  vrm.scene.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) {
    if (/EyeHighlight/.test(m.name)) m.visible = false;
    if (/EyeIris/.test(m.name) && !/Outline/.test(m.name) && m.map) repaint(m, (r, g, b) => { const l = (r + g + b) / 765, k = 0.35 + 0.9 * Math.pow(l, 1.3); return [rgb[0] * k, rgb[1] * k, rgb[2] * k]; });
  } });
}

// a fuller mouth, drawn over the character's own: the lips themselves in a muted rose (the upper one with its little
// bow, the lower one fuller), a clear darker line between them turning down a little at the corners, and the soft
// shadow under the lower lip
export function fullerMouth(av, { line = 0x5a3634, lip = 0xb7837a, shade = 0xb78f86 } = {}) {
  const vrm = av.vrm, L = landmarks(vrm), tri = [];
  vrm.scene.traverse(o => {
    if (!o.isMesh || !o.geometry.index) return; const ms = [].concat(o.material), g = o.geometry, P = g.attributes.position, I = g.index;
    for (const gr of g.groups.length ? g.groups : [{ start: 0, count: I.count, materialIndex: 0 }]) { const m = ms[gr.materialIndex ?? 0]; if (!m || !/Face_00_SKIN/.test(m.name) || /Outline/.test(m.name)) continue;
      for (let k = gr.start; k < gr.start + gr.count; k++) { const i = I.getX(k); tri.push(P.getX(i), P.getY(i), P.getZ(i)); } }
  });
  const front = (x, y) => { let z = -1e9; for (let t = 0; t < tri.length; t += 9) { const ax = tri[t], ay = tri[t + 1], bx = tri[t + 3], by = tri[t + 4], cx = tri[t + 6], cy = tri[t + 7], d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(d) < 1e-12) continue; const u = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d, v = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d; if (u < 0 || v < 0 || u + v > 1) continue; z = Math.max(z, u * tri[t + 2] + v * tri[t + 5] + (1 - u - v) * tri[t + 8]); } return z; };
  const my = (L.mouth.y0 + L.mouth.y1) / 2, mw = (L.mouth.x1 - L.mouth.x0) / 2, grp = new THREE.Group();
  const strip = (half, yAt, th, mat, lift = 0.001, order = 2) => {
    const N = 20, pos = [], idx = [];
    for (let i = 0; i <= N; i++) { const t = -1 + 2 * i / N, x = L.cx + t * half, y = yAt(t), w = th(t);
      for (const yy of [y + w / 2, y - w / 2]) { const z = front(x, yy); pos.push(x, yy, (z > -1e8 ? z : L.nose.z - 0.02) + lift); } }
    for (let i = 0; i < N; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
    const m = new THREE.Mesh(geo, mat); m.userData.noInk = true; m.renderOrder = order; grp.add(m);
  };
  const lipMat = new THREE.MeshBasicMaterial({ color: lip, side: THREE.DoubleSide, transparent: true, opacity: 0.8, depthWrite: false });
  strip(mw * 0.56, t => my + 0.0017 - 0.0011 * t * t - 0.0004 * Math.exp(-t * t * 40), t => 0.0032 * Math.pow(Math.max(0, 1 - t * t), 0.55), lipMat, 0.0009, 2);   // (upper lip, its bow in the middle)
  strip(mw * 0.5, t => my - 0.0036 - 0.0004 * t * t, t => 0.0052 * Math.pow(Math.max(0, 1 - t * t), 0.6), lipMat, 0.0009, 2);   // (lower lip, fuller)
  strip(mw * 0.62, t => my - 0.0012 * t * t, t => 0.0021 * (1 - 0.55 * t * t), new THREE.MeshBasicMaterial({ color: line, side: THREE.DoubleSide }), 0.0013, 3);
  strip(mw * 0.36, t => my - 0.0078 - 0.0005 * (1 - t * t), t => 0.0022 * (1 - t * t), new THREE.MeshBasicMaterial({ color: shade, side: THREE.DoubleSide, transparent: true, opacity: 0.5, depthWrite: false }), 0.0009, 2);
  const b = vrm.humanoid.getRawBoneNode('head'); b.updateMatrixWorld(true); grp.applyMatrix4(new THREE.Matrix4().copy(b.matrixWorld).invert()); b.add(grp); grp.traverse(c => { c.frustumCulled = false; });
  // and VRoid's own thin pink line hidden under it
  vrm.scene.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) if (/FaceMouth/.test(m.name)) m.visible = false; });
  return grp;
}

// straight, rising "sword" brows, a little thick: heavy at the inner end, running up and out to a sharp tip.
// Drawn on the brow over each eye (the character's own brows taken away)
export function swordBrows(av, { color = 0x2e2b2c, thick = 0.0055 } = {}) {
  const vrm = av.vrm, L = landmarks(vrm), tri = [];
  const eyes = { '-1': [1e9, -1e9, 1e9, -1e9], 1: [1e9, -1e9, 1e9, -1e9] };
  each(vrm, /EyeWhite/, (x, y) => { const e = eyes[x < L.cx ? -1 : 1]; e[0] = Math.min(e[0], x); e[1] = Math.max(e[1], x); e[2] = Math.min(e[2], y); e[3] = Math.max(e[3], y); });
  vrm.scene.traverse(o => {
    if (!o.isMesh || !o.geometry.index) return; const ms = [].concat(o.material), g = o.geometry, P = g.attributes.position, I = g.index;
    for (const m of ms) if (/FaceBrow/.test(m.name)) m.visible = false;
    for (const gr of g.groups.length ? g.groups : [{ start: 0, count: I.count, materialIndex: 0 }]) { const m = ms[gr.materialIndex ?? 0]; if (!m || !/Face_00_SKIN/.test(m.name) || /Outline/.test(m.name)) continue;
      for (let k = gr.start; k < gr.start + gr.count; k++) { const i = I.getX(k); tri.push(P.getX(i), P.getY(i), P.getZ(i)); } }
  });
  const front = (x, y) => { let z = -1e9; for (let t = 0; t < tri.length; t += 9) { const ax = tri[t], ay = tri[t + 1], bx = tri[t + 3], by = tri[t + 4], cx = tri[t + 6], cy = tri[t + 7], d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(d) < 1e-12) continue; const u = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d, v = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d; if (u < 0 || v < 0 || u + v > 1) continue; z = Math.max(z, u * tri[t + 2] + v * tri[t + 5] + (1 - u - v) * tri[t + 8]); } return z; };
  const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }), grp = new THREE.Group();
  for (const s of [-1, 1]) {
    const e = eyes[s]; if (e[1] < e[0]) continue;
    const inner = s > 0 ? e[0] : e[1], outer = s > 0 ? e[1] : e[0], w = Math.abs(outer - inner), top = e[3];
    const x0 = inner - s * 0.004, x1 = outer + s * w * 0.02, ya = top + 0.011, yb = top + 0.018, N = 16, pos = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, x = x0 + (x1 - x0) * t, yc = ya + (yb - ya) * Math.pow(t, 0.9) + 0.0025 * Math.sin(Math.PI * t * 0.8);
      const th = thick * (t < 0.12 ? 0.75 + 2 * t : 1 - Math.pow(Math.max(0, t - 0.35) / 0.65, 1.6) * 0.95);   // (blunt at the inner end, tapering to a point)
      for (const yy of [yc + th * 0.6, yc - th * 0.4]) { const z = front(x, yy); pos.push(x, yy, (z > -1e8 ? z : L.hd.z + 0.08) + 0.0012); }
    }
    for (let i = 0; i < N; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
    const m = new THREE.Mesh(geo, mat); m.userData.noInk = true; m.renderOrder = 2; grp.add(m);
  }
  const b = vrm.humanoid.getRawBoneNode('head'); b.updateMatrixWorld(true); grp.applyMatrix4(new THREE.Matrix4().copy(b.matrixWorld).invert()); b.add(grp); grp.traverse(c => { c.frustumCulled = false; });
  return grp;
}

// how far forward the face's skin is at (x, y), at rest (for drawing things on it)
function faceFront(vrm) {
  const tri = [];
  vrm.scene.traverse(o => {
    if (!o.isMesh || !o.geometry.index) return; const ms = [].concat(o.material), g = o.geometry, P = g.attributes.position, I = g.index;
    for (const gr of g.groups.length ? g.groups : [{ start: 0, count: I.count, materialIndex: 0 }]) { const m = ms[gr.materialIndex ?? 0]; if (!m || !/Face_00_SKIN/.test(m.name) || /Outline/.test(m.name)) continue;
      for (let k = gr.start; k < gr.start + gr.count; k++) { const i = I.getX(k); tri.push(P.getX(i), P.getY(i), P.getZ(i)); } }
  });
  return (x, y) => { let z = -1e9; for (let t = 0; t < tri.length; t += 9) { const ax = tri[t], ay = tri[t + 1], bx = tri[t + 3], by = tri[t + 4], cx = tri[t + 6], cy = tri[t + 7], d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(d) < 1e-12) continue; const u = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d, v = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d; if (u < 0 || v < 0 || u + v > 1) continue; z = Math.max(z, u * tri[t + 2] + v * tri[t + 5] + (1 - u - v) * tri[t + 8]); } return z; };
}

// a grown man's nose: the tip brought forward and the bridge raised a little (VRoid's is barely there), and drawn —
// a soft shadow down one side of the bridge, the shade under the tip, the two nostrils
export function manNose(av, { push = 0.009, side = 1 } = {}) {
  const vrm = av.vrm, L = landmarks(vrm);
  const eyes = { x0: 1e9, x1: -1e9, y: 0, n: 0 }; each(vrm, /EyeWhite/, (x, y) => { if (Math.abs(x - L.cx) < 0.03) { eyes.x0 = Math.min(eyes.x0, x); eyes.x1 = Math.max(eyes.x1, x); } eyes.y += y; eyes.n++; }); eyes.y /= Math.max(1, eyes.n);
  const top = eyes.y - 0.004, tipY = L.nose.y;
  // the shape: forward along the bridge (more towards the tip), within a narrow ridge
  vrm.scene.traverse(o => {
    if (!o.isMesh || ![].concat(o.material).some(m => /Face_00_SKIN/.test(m.name))) return;
    const P = o.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i); if (z < L.nose.z - 0.03 || y > top + 0.006 || y < tipY - 0.012) continue;
      const along = Math.min(1, Math.max(0, (top - y) / (top - tipY))), wide = 0.006 + 0.007 * along, across = Math.exp(-Math.pow((x - L.cx) / wide, 2));
      const below = y < tipY ? Math.max(0, 1 - (tipY - y) / 0.012) : 1;
      P.setZ(i, z + push * Math.pow(along, 0.8) * across * below);
    }
    P.needsUpdate = true; o.geometry.computeVertexNormals();
  });
  const front = faceFront(vrm), grp = new THREE.Group();
  const stroke = (pts, w, color, opacity, order = 2) => {
    const pos = [], idx = [];
    pts.forEach(([x, y, k]) => { const ww = w * k; for (const dx of [-ww / 2, ww / 2]) { const z = front(x + dx, y); pos.push(x + dx, y, (z > -1e8 ? z : L.nose.z) + 0.0009); } });
    for (let i = 0; i < pts.length - 1; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity, depthWrite: false })); m.userData.noInk = true; m.renderOrder = order; grp.add(m);
  };
  // the bridge's shadow side: from between the brows down to beside the tip, widest on the side of the nose
  const bridge = []; for (let i = 0; i <= 14; i++) { const t = i / 14, y = top - (top - tipY - 0.002) * t; bridge.push([L.cx + side * (0.0042 + 0.0022 * t), y, Math.sin(Math.PI * Math.min(1, t * 1.1)) * 0.9 + 0.1]); }
  stroke(bridge, 0.0032, 0xb38a80, 0.8);
  // under the tip: a short curve of shade
  const under = []; for (let i = 0; i <= 10; i++) { const t = -1 + 2 * i / 10; under.push([L.cx + t * 0.0085, tipY - 0.0042 + 0.0018 * t * t, 1 - 0.55 * t * t]); }
  stroke(under, 0.003, 0x9a6c64, 0.9);
  // the wing of the nose on the shadow side, curving round into the cheek
  const wing = []; for (let i = 0; i <= 8; i++) { const t = i / 8, a = Math.PI * (0.15 + 0.7 * t); wing.push([L.cx + side * (0.0075 + 0.0035 * Math.sin(a)), tipY - 0.001 - 0.0042 * (1 - Math.cos(a)) / 2 + 0.002, Math.sin(Math.PI * t)]); }
  stroke(wing, 0.0022, 0xa47a72, 0.75);
  // the nostrils
  for (const s of [-1, 1]) { const n = []; for (let i = 0; i <= 6; i++) { const t = i / 6; n.push([L.cx + s * (0.0035 + 0.0035 * t), tipY - 0.0046 + 0.0012 * Math.sin(Math.PI * t), Math.sin(Math.PI * t)]); } stroke(n, 0.0021, 0x553a37, 0.95, 3); }
  const b = vrm.humanoid.getRawBoneNode('head'); b.updateMatrixWorld(true); grp.applyMatrix4(new THREE.Matrix4().copy(b.matrixWorld).invert()); b.add(grp); grp.traverse(c => { c.frustumCulled = false; });
  return grp;
}
