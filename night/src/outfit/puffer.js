// A down jacket over a character's top: the top itself, copied and blown out round the body into puffed channels
// of down with the stitching pulled in between — bands across the body, rings round the sleeves (laid out by where
// the cloth is on the body at rest, arms out level, not by its texture). The copy is skinned to the same bones, so
// it moves as the top does; the top stays underneath, its collar showing at the neck. Its material is the top's own
// toon material in the colour wanted, so the light and the outline fall on it the same way, and the town's ink
// line finds the stitching in the creases.
import * as THREE from 'three';
import { tint, attach } from './kit.js';

// every triangle into four (positions, normals, uvs halfway along each edge; the bones' pull on a new point shared
// between the two ends)
export function subdivide(g) {
  const A = { ...g.attributes }, names = Object.keys(A), I = g.index.array, out = {}, mid = new Map(), idx = [];
  for (const n of names) if (A[n].normalized) {                                         // (packed weights: read as fractions)
    const s = A[n].itemSize, f = new Float32Array(A[n].count * s); for (let i = 0; i < A[n].count; i++) for (let c = 0; c < s; c++) f[i * s + c] = A[n][["getX", "getY", "getZ", "getW"][c]](i);
    A[n] = new THREE.BufferAttribute(f, s);
  }
  for (const n of names) out[n] = Array.from(A[n].array);
  let count = A.position.count;
  const at = (a, b) => {
    const k = a < b ? `${a}_${b}` : `${b}_${a}`; if (mid.has(k)) return mid.get(k);
    for (const n of names) {
      const s = A[n].itemSize, o = out[n];
      if (n === 'skinIndex' || n === 'skinWeight') continue;
      for (let c = 0; c < s; c++) o.push((o[a * s + c] + o[b * s + c]) / 2);
    }
    if (A.skinIndex) {
      const w = new Map(); for (const v of [a, b]) for (let c = 0; c < 4; c++) { const bi = out.skinIndex[v * 4 + c], bw = out.skinWeight[v * 4 + c] / 2; if (bw > 0) w.set(bi, (w.get(bi) || 0) + bw); }
      const top = [...w.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4), sum = top.reduce((s, [, x]) => s + x, 0) || 1;
      for (let c = 0; c < 4; c++) { out.skinIndex.push(top[c] ? top[c][0] : 0); out.skinWeight.push(top[c] ? top[c][1] / sum : 0); }
    }
    mid.set(k, count); return count++;
  };
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2], ab = at(a, b), bc = at(b, c), ca = at(c, a);
    idx.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
  }
  const r = new THREE.BufferGeometry();
  for (const n of names) { const T = A[n].array.constructor; r.setAttribute(n, new THREE.BufferAttribute(new T(out[n]), A[n].itemSize, A[n].normalized)); }
  r.setIndex(idx); return r;
}

// shiny (patent-look) nylon: a highlight from each real light the character is lit by — where the light is, in
// its colour, as strong as it is (none in the dark) — hard-edged the toon way, with a fainter sheen round it. Put
// into the toon shader's own handling of each light
export function glossy(m, strength = 0.5, { soft = false } = {}) {   // (soft: a leather's broad, gentle sheen instead of the patent nylon's hard-edged one)
  m.uniforms.glossStrength = { value: strength };
  m.fragmentShader = m.fragmentShader
    .replace('struct MToonMaterial {', '#define GLOSS\nuniform float glossStrength;\nvec3 glossAcc = vec3( 0.0 );\nstruct MToonMaterial {')
    .replace(/(void RE_Direct_MToon\( const in IncidentLight directLight, const in vec3 geometryPosition[^{]*\{)/, `$1
    {
      vec3 hv = normalize( directLight.direction + geometryViewDir );
      float s = pow( max( dot( geometryNormal, hv ), 0.0 ), ${soft ? '32.0' : '64.0'} );
      float lit = step( 0.0, dot( geometryNormal, directLight.direction ) ) * shadow;
      glossAcc += directLight.color * glossStrength * lit * ${soft ? '( smoothstep( 0.25, 0.85, s ) + 0.15 * smoothstep( 0.05, 0.3, s ) )' : '( smoothstep( 0.46, 0.53, s ) + 0.12 * smoothstep( 0.1, 0.15, s ) )'};
    }`)
    .replace('  col += rimMix * rim;', '  col += rimMix * rim;\n  #if defined( GLOSS ) && !defined( OUTLINE )\n    col += glossAcc;\n  #endif');
  if (!/glossAcc \+=/.test(m.fragmentShader)) console.warn('gloss: shader not patched');
}

// rgb: 0–255. band: the channels' width (metres). loft: how far the down stands out at the stitching and at the
// middle of a channel. gloss: shiny (patent-look) nylon
export function puffer(av, rgb, { band = 0.07, loft = [0.013, 0.033], gloss = false, match = /Tops/, plain = false } = {}) {   // (plain: the top's print and trims not carried over)   // (match: which of the tops, by material name)
  const vrm = av.vrm, h = vrm.humanoid, made = []; vrm.scene.updateMatrixWorld(true);
  const W = b => h.getRawBoneNode(b).getWorldPosition(new THREE.Vector3());
  const cx = W('hips').x, sh = Math.abs(W('leftUpperArm').x - cx) + 0.02, top = W('neck').y - 0.02, armY = W('leftUpperArm').y;
  const isArm = (x, y) => x > sh && Math.abs(y - armY) < 0.11;                         // (the sleeves: out at the sides at shoulder height — a coat's skirt can be wider than the shoulders)
  vrm.scene.traverse(src => {
    if (!src.isSkinnedMesh || src.userData.puffer) return;
    const mats = [].concat(src.material), base = mats.find(m => !m.isOutline && /Tops/.test(m.name) && match.test(m.name)); if (!base) return;
    const geo = subdivide(subdivide(src.geometry)), P = geo.attributes.position;
    geo.computeVertexNormals(); const Nn = geo.attributes.normal;
    // the same point of the cloth can be several vertices (where the texture is cut): they move together, or the
    // jacket would split along its seams
    const key = i => `${Math.round(P.getX(i) * 2e4)},${Math.round(P.getY(i) * 2e4)},${Math.round(P.getZ(i) * 2e4)}`, weld = new Map();
    for (let i = 0; i < P.count; i++) { const k = key(i); (weld.get(k) || weld.set(k, []).get(k)).push(i); }
    const n = new THREE.Vector3(), q = new THREE.Vector3(), col = new Float32Array(P.count * 3);
    let yMin = 1e9; for (let i = 0; i < P.count; i++) if (!isArm(Math.abs(P.getX(i) - cx), P.getY(i))) yMin = Math.min(yMin, P.getY(i));
    for (const ids of weld.values()) {
      n.set(0, 0, 0); for (const i of ids) { n.x += Nn.getX(i); n.y += Nn.getY(i); n.z += Nn.getZ(i); } n.normalize();
      const i0 = ids[0], x = Math.abs(P.getX(i0) - cx), y = P.getY(i0);
      const hem = !isArm(x, y) ? 1 - Math.min(1, (y - yMin) / 0.08) : 0;                       // (at the hem the down goes out, not down — pushed down, its edge would fray into points — and the hem itself rounds in under the last channel)
      if (hem > 0) { n.y *= 1 - hem; if (n.lengthSq() > 1e-6) n.normalize(); else n.set(0, 0, 0); }
      const along = isArm(x, y) ? (x - sh) / (band * 0.85) : (top - y) / band;         // (rings down the arm, bands down the body)
      const f = ((along % 1) + 1) % 1, d = (loft[0] + (loft[1] - loft[0]) * Math.pow(Math.sin(Math.PI * f), 0.45)) * (1 - hem) + loft[1] * 0.9 * Math.sin(Math.PI * Math.min(1, hem * 1.6)) * (1 - hem) - 0.012 * Math.pow(hem, 2);
      const k = 0.6 + 0.4 * Math.pow(Math.sin(Math.PI * f), 0.6);                         // (a little grey down in the stitching)
      for (const i of ids) { q.fromBufferAttribute(P, i).addScaledVector(n, d); P.setXYZ(i, q.x, q.y, q.z); col.fill(k, i * 3, i * 3 + 3); }
    }
    geo.computeVertexNormals(); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const NN = geo.attributes.normal;                                                  // (smooth across the texture's cuts too, or the ink line would find them)
    for (const ids of weld.values()) { n.set(0, 0, 0); for (const i of ids) { n.x += NN.getX(i); n.y += NN.getY(i); n.z += NN.getZ(i); } n.normalize(); for (const i of ids) NN.setXYZ(i, n.x, n.y, n.z); }
    const m = base.clone(); m.name = 'Puffer';
    tint(m, rgb, { keep: 0, max: 1.15, gamma: plain ? 0.08 : 0.85 }); m.vertexColors = true; m.ignoreVertexColor = false;
    if (gloss) glossy(m);
    const o = m.clone(); o.name = 'Puffer (Outline)'; o.isOutline = true; o.side = THREE.BackSide;
    const cnt = geo.index.count; geo.addGroup(0, cnt, 0); geo.addGroup(0, cnt, 1);
    const jm = new THREE.SkinnedMesh(geo, [m, o]); jm.name = 'Puffer'; jm.userData.puffer = true; jm.userData.rgb = rgb; jm.frustumCulled = false;
    jm.position.copy(src.position); jm.quaternion.copy(src.quaternion); jm.scale.copy(src.scale); jm.renderOrder = src.renderOrder;
    jm.bind(src.skeleton, src.bindMatrix);
    made.push([src.parent, jm]);
    if (Array.isArray(vrm.materials)) vrm.materials.push(m, o);
  });
  for (const [parent, jm] of made) parent.add(jm);
  return made.map(([, jm]) => jm);
}

// skinning for a piece made new, taken from the nearest points of a garment it lies on (by bone, so it moves as the
// garment does); pos: flat [x, y, z, …] at rest
export function skinLike(jm, pos, n = 4) {
  const P = jm.geometry.attributes.position, SI = jm.geometry.attributes.skinIndex, SW = jm.geometry.attributes.skinWeight, si = [], sw = [];
  for (let k = 0; k < pos.length; k += 3) {
    const best = []; for (let i = 0; i < P.count; i += 2) { const d = (P.getX(i) - pos[k]) ** 2 + (P.getY(i) - pos[k + 1]) ** 2 + (P.getZ(i) - pos[k + 2]) ** 2; if (best.length < n || d < best[best.length - 1][0]) { best.push([d, i]); best.sort((a, b) => a[0] - b[0]); if (best.length > n) best.pop(); } }
    const acc = new Map(); let tot = 0; for (const [d, i] of best) { const f = 1 / (Math.sqrt(d) + 0.004); tot += f; for (let c = 0; c < 4; c++) { const w = SW.getComponent(i, c); if (w > 0) acc.set(SI.getComponent(i, c), (acc.get(SI.getComponent(i, c)) || 0) + w * f); } }
    const w = [...acc].sort((a, b) => b[1] - a[1]).slice(0, 4), sum = w.reduce((s, [, x]) => s + x, 0) || 1;
    for (let c = 0; c < 4; c++) { si.push(w[c] ? w[c][0] : 0); sw.push(w[c] ? w[c][1] / sum : 0); }
  }
  return [new THREE.Uint16BufferAttribute(si, 4), new THREE.Float32BufferAttribute(sw, 4)];
}
// a piece made new, in the jacket's colour (a plain toon of its own: the jacket's texture is an atlas, and a new
// piece mapped into it lands on its gaps), its down's light and shade in the vertex colours, skinned as the jacket
// is under it
function addPiece(jm, pos, idx, uv, col, name) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
  const [si, sw] = skinLike(jm, pos); g.setAttribute('skinIndex', si); g.setAttribute('skinWeight', sw);
  const rgb = jm.userData.rgb || [220, 220, 220], cv = document.createElement('canvas'); cv.width = cv.height = 4; const c2 = cv.getContext('2d'); c2.fillStyle = `rgb(${rgb.join(',')})`; c2.fillRect(0, 0, 4, 4);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const base = [].concat(jm.material)[0], m = base.clone(); m.name = name; m.map = tex; if ('shadeMultiplyTexture' in m) m.shadeMultiplyTexture = tex; m.alphaTest = 0; m.transparent = false; m.side = THREE.DoubleSide; m.vertexColors = true; m.ignoreVertexColor = false;
  const o = m.clone(); o.name = name + ' (Outline)'; o.isOutline = true; o.side = THREE.BackSide; const om = [].concat(jm.material)[1]; if (om) for (const k of ['outlineWidthFactor', 'outlineWidthMode', 'outlineColorFactor', 'outlineLightingMixFactor']) if (k in om) o[k] = om[k]?.clone ? om[k].clone() : om[k];
  g.addGroup(0, idx.length, 0); g.addGroup(0, idx.length, 1);
  const mesh = new THREE.SkinnedMesh(g, [m, o]); mesh.name = name; mesh.frustumCulled = false; jm.parent.add(mesh); mesh.bind(jm.skeleton, jm.bindMatrix); return mesh;
}

// a hoodie's hood taken off it (for a jacket with a stand collar instead), by where the hood lies in VRoid's hoodie
// texture: done to the hoodie itself, before anything is made from it
export function dropHood(av, inHood = (u, v) => u > 0.23 && u < 0.77 && v < 0.43) {
  av.vrm.scene.traverse(o => {
    if (!o.isSkinnedMesh || !o.geometry.index || !o.geometry.attributes.uv) return; const ms = [].concat(o.material), g = o.geometry, I = g.index, U = g.attributes.uv;
    for (const gr of g.groups.length ? g.groups : [{ start: 0, count: I.count, materialIndex: 0 }]) {
      const m = ms[gr.materialIndex ?? 0]; if (!m || m.isOutline || !/Tops/.test(m.name || '')) continue;
      for (let k = gr.start; k + 2 < gr.start + gr.count; k += 3) { const a = I.getX(k), b = I.getX(k + 1), c = I.getX(k + 2), u = (U.getX(a) + U.getX(b) + U.getX(c)) / 3, v = (U.getY(a) + U.getY(b) + U.getY(c)) / 3; if (inHood(u, v)) { I.setX(k + 1, a); I.setX(k + 2, a); } }
    }
    I.needsUpdate = true;
  });
}

// a stand collar of down, round the neck from the jacket's neckline to under the chin, in two soft puffs, open a
// finger's width at the front where the zip runs up
export function puffCollar(av, jm, { height = 0.07, open = 0.1 } = {}) {
  const vrm = av.vrm, h = vrm.humanoid; vrm.scene.updateMatrixWorld(true);
  const nk = h.getRawBoneNode('neck').getWorldPosition(new THREE.Vector3()), NA = 48, Rn = new Float32Array(NA), y0 = nk.y - 0.03;
  vrm.scene.traverse(o => { if (!o.isMesh || ![].concat(o.material).some(m => /Body_00_SKIN/.test(m.name || ''))) return; const P = o.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) { const y = P.getY(i); if (y < nk.y + 0.005 || y > nk.y + 0.03) continue; const dx = P.getX(i) - nk.x, dz = P.getZ(i) - nk.z, r = Math.hypot(dx, dz); if (r > 0.07) continue; const k = Math.floor(((Math.atan2(dx, dz) / (Math.PI * 2)) + 1) % 1 * NA); Rn[k] = Math.max(Rn[k], r); } });
  const R = Array.from(Rn, (_, k) => { let m = 0; for (let j = -3; j <= 3; j++) m = Math.max(m, Rn[(k + j + NA) % NA]); return m || 0.04; });
  const at = a => { const f = ((a / (Math.PI * 2)) % 1 + 1) % 1 * NA, k = Math.floor(f) % NA, t = f - Math.floor(f); return R[k] * (1 - t) + R[(k + 1) % NA] * t; };
  const pos = [], uv = [], col = [], idx = [], NU = 64, NV = 12;
  for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
    const t = j / NV, a = open + (Math.PI * 2 - 2 * open) * i / NU, puff = Math.pow(Math.abs(Math.sin(Math.PI * t * 2)), 0.6), r = at(a) + 0.016 + 0.007 * puff + 0.01 * (1 - t) * (1 - t);
    pos.push(nk.x + Math.sin(a) * r, y0 + height * t, nk.z + Math.cos(a) * r); uv.push(0.5, 0.5); const k = 0.7 + 0.3 * puff; col.push(k, k, k);
  }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const k = j * (NU + 1) + i; idx.push(k, k + 1, k + NU + 1, k + 1, k + NU + 2, k + NU + 1); }
  return addPiece(jm, pos, idx, uv, col, 'PuffCollar');
}

// a peplum ruffle of down round the jacket's hem: gathered into soft folds, standing out and falling a little,
// its edge rippling
export function ruffle(av, jm, { depth = 0.055, out = 0.03, waves = 16 } = {}) {
  const vrm = av.vrm, h = vrm.humanoid; vrm.scene.updateMatrixWorld(true);
  const W = b => h.getRawBoneNode(b).getWorldPosition(new THREE.Vector3()), hp = W('hips'), cx = hp.x, sh = Math.abs(W('leftUpperArm').x - cx), P = jm.geometry.attributes.position, I = jm.geometry.index;
  let lo = 1e9; for (let k = 0; k + 2 < I.count; k += 3) { if (I.getX(k) === I.getX(k + 1) && I.getX(k + 1) === I.getX(k + 2)) continue; for (let c = 0; c < 3; c++) { const i = I.getX(k + c); if (Math.abs(P.getX(i) - cx) < sh * 0.8) lo = Math.min(lo, P.getY(i)); } }
  const NA = 72, Rh = new Float32Array(NA), slot = (dx, dz) => Math.floor(((Math.atan2(dx, dz) / (Math.PI * 2)) + 1) % 1 * NA);
  for (let i = 0; i < P.count; i++) { if (Math.abs(P.getX(i) - cx) > sh * 0.8 || P.getY(i) > lo + 0.03) continue; const dx = P.getX(i) - cx, dz = P.getZ(i) - hp.z, s = slot(dx, dz); Rh[s] = Math.max(Rh[s], Math.hypot(dx, dz)); }
  const Rs = Array.from(Rh, (_, k) => { let m = 0; for (let j = -3; j <= 3; j++) m = Math.max(m, Rh[(k + j + NA) % NA]); return m || 0.1; });
  const at = a => { const f = ((a / (Math.PI * 2)) % 1 + 1) % 1 * NA, k = Math.floor(f) % NA, t = f - Math.floor(f); return Rs[k] * (1 - t) + Rs[(k + 1) % NA] * t; };
  const top = lo + 0.018, Rt = new Float32Array(NA);                                    // (and whatever trousers are under it, so they don't come through)
  vrm.scene.traverse(o => { if (!o.isMesh || ![].concat(o.material).some(m => /Bottoms|Trousers/.test(m.name || ''))) return; const Q = o.geometry.attributes.position;
    for (let i = 0; i < Q.count; i++) { const y = Q.getY(i); if (y > top + 0.01 || y < top - depth - 0.01) continue; const dx = Q.getX(i) - cx, dz = Q.getZ(i) - hp.z, s = slot(dx, dz); Rt[s] = Math.max(Rt[s], Math.hypot(dx, dz)); } });
  const Ts = Array.from(Rt, (_, k) => { let m = 0; for (let j = -2; j <= 2; j++) m = Math.max(m, Rt[(k + j + NA) % NA]); return m; });
  const tAt = a => { const f = ((a / (Math.PI * 2)) % 1 + 1) % 1 * NA, k = Math.floor(f) % NA, t = f - Math.floor(f); return Ts[k] * (1 - t) + Ts[(k + 1) % NA] * t; };
  const pos = [], uv = [], col = [], idx = [], NU = 144, NV = 8;
  for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) {
    const t = j / NV, a = i / NU * Math.PI * 2, fold = Math.sin(waves * a), r = Math.max(at(a) - 0.003 + out * Math.pow(t, 0.8) + 0.009 * Math.sin(Math.PI * t), tAt(a) + 0.018) + 0.012 * t * fold;   // (out from under the hem, folding as it goes, plump; clear of the trousers)
    pos.push(cx + Math.sin(a) * r, top - depth * t + 0.006 * t * Math.cos(waves * a + 0.6), hp.z + Math.cos(a) * r); uv.push(0.5, 0.5); const k = 0.82 + 0.18 * (0.5 + 0.5 * fold); col.push(k, k, k);
  }
  for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const k = j * (NU + 1) + i; idx.push(k, k + NU + 1, k + 1, k + 1, k + NU + 1, k + NU + 2); }
  return addPiece(jm, pos, idx, uv, col, 'Ruffle');
}

// a zip up the front, collar to hem: a narrow silver track lying on the jacket, with its pull at the top
export function zipper(av, jm, { from, to } = {}) {
  const vrm = av.vrm, h = vrm.humanoid; vrm.scene.updateMatrixWorld(true);
  const W = b => h.getRawBoneNode(b).getWorldPosition(new THREE.Vector3()), hp = W('hips'), cx = hp.x, P = jm.geometry.attributes.position, fz = new Map(), band = y => Math.round(y / 0.008);
  for (const o of [jm, ...jm.parent.children.filter(c => /PuffCollar|Ruffle/.test(c.name))]) { const Q = o.geometry.attributes.position; for (let i = 0; i < Q.count; i++) { if (Math.abs(Q.getX(i) - cx) > 0.015 || Q.getZ(i) < hp.z) continue; const b = band(Q.getY(i)); fz.set(b, Math.max(fz.get(b) ?? -1e9, Q.getZ(i))); } }
  const zAt = y => { let m = -1e9; for (let d = -2; d <= 2; d++) m = Math.max(m, fz.get(band(y) + d) ?? -1e9); return m > -1e8 ? m : hp.z + 0.1; };
  const pos = [], uv = [], col = [], idx = [], NR = 40, w = 0.0035;
  for (let j = 0; j <= NR; j++) { const y = from + (to - from) * j / NR, z = zAt(y) + 0.0015; pos.push(cx - w, y, z, cx + w, y, z); uv.push(0, j, 1, j); col.push(1, 1, 1, 1, 1, 1); }
  for (let j = 0; j < NR; j++) { const k = j * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const [si, sw] = skinLike(jm, pos); g.setAttribute('skinIndex', si); g.setAttribute('skinWeight', sw);
  const metal = new THREE.MeshStandardMaterial({ color: 0xc4c6cc, metalness: 0.8, roughness: 0.35, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const m = new THREE.SkinnedMesh(g, metal); m.name = 'Zip'; m.frustumCulled = false; jm.parent.add(m); m.bind(jm.skeleton, jm.bindMatrix);
  const pull = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.018, 0.003), metal); pull.position.set(cx + 0.004, from - 0.012, zAt(from) + 0.004); attach(av, 'upperChest', pull);
  return m;
}
