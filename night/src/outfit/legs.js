// Legs in winter: opaque tights (a copy of the legs' own skin, just off it, in a soft knit), trousers taken off,
// slouchy Fair Isle leg warmers bunched round the calves, and chunky cable-knit snow boots' texture.
import * as THREE from 'three';
import { blotch, repaint, attach, std } from './kit.js';
import { toon } from './boots.js';
import { subdivide } from './puffer.js';

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const canvasTex = (W, H, fn) => {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'), img = g.createImageData(W, H), d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = fn(x, y), i = (y * W + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
};

// the trousers taken off (their triangles folded away, outline and all)
export function dropTrousers(av) {
  av.vrm.scene.traverse(o => {
    if (!o.isMesh || !o.geometry.index) return; const ms = [].concat(o.material), I = o.geometry.index;
    for (const gr of o.geometry.groups.length ? o.geometry.groups : [{ start: 0, count: I.count, materialIndex: 0 }]) {
      const n = (ms[gr.materialIndex ?? 0] || {}).name || ''; if (!/Bottoms/.test(n)) continue;
      for (let k = gr.start; k + 2 < gr.start + gr.count; k += 3) { const a = I.getX(k); I.setX(k + 1, a); I.setX(k + 2, a); }
    }
    I.needsUpdate = true;
  });
}

// opaque tights from the waist down: the skin's own shape, a hair off it, so they bend exactly as the legs do
export function tights(av, rgb = [238, 236, 232]) {
  const vrm = av.vrm, h = vrm.humanoid; vrm.scene.updateMatrixWorld(true);
  const top = h.getRawBoneNode('hips').getWorldPosition(new THREE.Vector3()).y + 0.04;
  let host = null; vrm.scene.traverse(o => { if (!host && o.isSkinnedMesh && [].concat(o.material).some(m => /Body_00_SKIN/.test(m.name))) host = o; });
  if (!host) return;
  const g = host.geometry, A = g.attributes, I = g.index, ms = [].concat(host.material), keep = [];
  for (const gr of g.groups.length ? g.groups : [{ start: 0, count: I.count, materialIndex: 0 }]) {
    const n = (ms[gr.materialIndex ?? 0] || {}).name || ''; if (!/Body_00_SKIN/.test(n)) continue;
    for (let k = gr.start; k + 2 < gr.start + gr.count; k += 3) { const t = [I.getX(k), I.getX(k + 1), I.getX(k + 2)]; if (t[0] === t[1] && t[1] === t[2]) continue; if (t.every(i => A.position.getY(i) < top)) keep.push(...t); }
  }
  const remap = new Map(), idx = [], out = {}; for (const nm of ['position', 'normal', 'uv', 'skinIndex', 'skinWeight']) if (A[nm]) out[nm] = [];
  for (const i of keep) { if (!remap.has(i)) { remap.set(i, remap.size); for (const nm in out) for (let c = 0; c < A[nm].itemSize; c++) out[nm].push(A[nm].array[i * A[nm].itemSize + c]); } idx.push(remap.get(i)); }
  const geo = new THREE.BufferGeometry();
  for (const nm in out) geo.setAttribute(nm, new THREE.BufferAttribute(new A[nm].array.constructor(out[nm]), A[nm].itemSize, A[nm].normalized));
  geo.setIndex(idx); geo.computeVertexNormals();
  const P = geo.attributes.position, N = geo.attributes.normal;
  for (let i = 0; i < P.count; i++) P.setXYZ(i, P.getX(i) + N.getX(i) * 0.0018, P.getY(i) + N.getY(i) * 0.0018, P.getZ(i) + N.getZ(i) * 0.0018);
  const tex = canvasTex(64, 64, (x, y) => { const k = 0.97 + 0.03 * (blotch(x, y, 8) - 0.5); return [rgb[0] * k, rgb[1] * k, rgb[2] * k]; });   // (plain: tights show no knit at this distance)
  const mats = toon(av, tex, 'Tights', [0.8, 0.8, 0.86]);
  if (mats.length > 1) { geo.addGroup(0, idx.length, 0); geo.addGroup(0, idx.length, 1); }
  const m = new THREE.SkinnedMesh(geo, mats.length > 1 ? mats : mats[0]); m.name = 'Tights'; m.userData.tights = true; m.frustumCulled = false;
  host.parent.add(m); m.bind(host.skeleton, host.bindMatrix);
  for (const x of mats) x.vertexColors = false, x.ignoreVertexColor = true;
  return m;
}

// Fair Isle knit: a grey ground, bands of white diamonds and little crosses between pale stripes
export function fairIsle(grey = [138, 140, 146], white = [236, 234, 230]) {
  const W = 256, H = 128;
  return canvasTex(W, H, (x, y) => {
    const v = y / H, cx = x % 16 - 8, row = Math.floor(y / (H / 16)) % 16;
    let on = false;
    if (v > 0.3 && v < 0.62) { const cy = (v - 0.46) / 0.16 * 8; on = Math.abs(cx) + Math.abs(cy) < 6.5 && Math.abs(cx) + Math.abs(cy) > 3.5 || (Math.abs(cx) < 1.2 && Math.abs(cy) < 1.2); }   // (diamonds with a dot)
    else if ((v > 0.18 && v < 0.22) || (v > 0.7 && v < 0.74)) on = (x >> 2) % 2 === 0;   // (checked stripes)
    else if ((v > 0.08 && v < 0.11) || (v > 0.82 && v < 0.85)) on = true;              // (plain stripes)
    const c = on ? white : grey, k = 0.9 + 0.12 * (0.5 + 0.5 * Math.cos(x / W * Math.PI * 2 * 64)) * (0.7 + 0.3 * Math.cos(y / H * Math.PI * 2 * 24));   // (stitches)
    void row; return [c[0] * k, c[1] * k, c[2] * k];
  });
}

// chunky cable knit, for knitted boots
export function cableKnit(rgb = [236, 232, 226]) {
  return canvasTex(256, 256, (x, y) => {
    const u = x / 256 * 6, v = y / 256 * 4, f = u % 1, twist = Math.abs(((v + (Math.floor(u) % 2) * 0.5) % 1) - 0.5) * 2;
    const rope = Math.exp(-Math.pow((f - 0.5 + 0.18 * (twist - 0.5)) / 0.2, 2)), k = 0.88 + 0.14 * rope + 0.04 * (blotch(x, y, 5) - 0.5);   // (soft relief: strong stripes read as metal)
    return [rgb[0] * k, rgb[1] * k, rgb[2] * k];
  });
}

// slouchy leg warmers from just above the ankle to mid-calf, bunched into soft rings, worn over boots and tights
export function legWarmers(av, { from = 0.12, to = 0.62, tex = null } = {}) {
  const vrm = av.vrm, h = vrm.humanoid; vrm.scene.updateMatrixWorld(true);
  const W = b => h.getRawBoneNode(b).getWorldPosition(new THREE.Vector3());
  let host = null; vrm.scene.traverse(o => { if (!host && o.isSkinnedMesh && [].concat(o.material).some(m => /Body_00_SKIN/.test(m.name))) host = o; });
  if (!host) return;
  const skel = host.skeleton, bi = b => Math.max(0, skel.bones.indexOf(h.getRawBoneNode(b)));
  const skin = []; { const P = host.geometry.attributes.position; for (let i = 0; i < P.count; i++) skin.push([P.getX(i), P.getY(i), P.getZ(i)]); }
  const mats = toon(av, tex || fairIsle(), 'LegWarmers', [0.74, 0.74, 0.8]).slice(0, 1); mats[0].side = THREE.DoubleSide;   // (knit both sides: the inside shows at the top)
  for (const side of ['left', 'right']) {
    const knee = W(side + 'LowerLeg'), ankle = W(side + 'Foot'), y0 = ankle.y + from * (knee.y - ankle.y), y1 = ankle.y + to * (knee.y - ankle.y);
    const axis = y => { const t = (y - ankle.y) / (knee.y - ankle.y); return [ankle.x + (knee.x - ankle.x) * t, ankle.z + (knee.z - ankle.z) * t]; };
    // the calf at each height: its own middle (behind the shin bone) and how far it reaches from there — taken
    // from a band of the skin, then smoothed up and down the leg so the rings run true
    const NA = 40, NY = 24, raw = [];
    for (let j = 0; j <= NY; j++) {
      const y = y0 + (y1 - y0) * j / NY, [ax, az] = axis(y), ring = [];
      for (const [x, yy, z] of skin) if (Math.abs(yy - y) < 0.012 && Math.hypot(x - ax, z - az) < 0.075) ring.push([x, z]);
      if (ring.length < 12) { raw.push(null); continue; }
      let mx = 0, mz = 0; for (const [x, z] of ring) { mx += x; mz += z; } mx /= ring.length; mz /= ring.length;
      const ds = ring.map(([x, z]) => Math.hypot(x - mx, z - mz)).sort((p, q) => p - q);
      raw.push([mx, mz, ds[Math.floor(ds.length * 0.92)]]);                              // (the near-widest, not one stray point)
    }
    for (let j = 0; j <= NY; j++) if (!raw[j]) { let k = 1; while (!raw[j - k] && !raw[j + k] && k < NY) k++; raw[j] = (raw[j - k] || raw[j + k] || [axis(y0)[0], axis(y0)[1], 0.04]).slice(); }
    const cAt = new Map(), rAt = new Map();
    for (let j = 0; j <= NY; j++) { let mx = 0, mz = 0, r = 0, n = 0; for (let d = -3; d <= 3; d++) { const e = raw[Math.min(NY, Math.max(0, j + d))]; mx += e[0]; mz += e[1]; r += e[2]; n++; } cAt.set(j, [mx / n, mz / n]); rAt.set(j, r / n); }
    const pos = [], uv = [], si = [], sw = [], idx = [], li = bi(side + 'LowerLeg');
    for (let j = 0; j <= NY; j++) for (let i = 0; i <= NA; i++) {
      const t = j / NY, a = i / NA * Math.PI * 2, y = y0 + (y1 - y0) * t, [ax, az] = cAt.get(j);
      const bunch = 0.0028 * Math.pow(0.5 + 0.5 * Math.sin(t * Math.PI * 6 + Math.sin(a * 2) * 0.8), 1.5) * (1 - 0.6 * t);   // (soft rings of slack, most low down)
      const r = rAt.get(j) + (0.0035 + bunch + 0.011 * (1 - sm(0, 0.3, t))) * (1 - 0.6 * sm(0.85, 1, t)) + 0.0025;   // (snug round the calf, pooling at the bottom over the boot's top; the top hugging the leg)
      pos.push(ax + Math.sin(a) * r, y, az + Math.cos(a) * r); uv.push(i / NA * 2, 0.1 + t * 0.8);
      si.push(li, 0, 0, 0); sw.push(1, 0, 0, 0);
    }
    for (let j = 0; j < NY; j++) for (let i = 0; i < NA; i++) { const k = j * (NA + 1) + i; idx.push(k, k + 1, k + NA + 1, k + 1, k + NA + 2, k + NA + 1); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    geo.setIndex(idx); geo.computeVertexNormals();
    if (mats.length > 1) { geo.addGroup(0, idx.length, 0); geo.addGroup(0, idx.length, 1); }
    const m = new THREE.SkinnedMesh(geo, mats.length > 1 ? mats : mats[0]); m.name = 'LegWarmers'; m.frustumCulled = false;
    host.parent.add(m); m.bind(skel, host.bindMatrix);
  }
  for (const x of mats) x.vertexColors = false, x.ignoreVertexColor = true;
}

// a plain colour, the faintest grain in it (so it isn't flat plastic)
export function plainTex(rgb) {
  return canvasTex(64, 64, (x, y) => { const k = 0.97 + 0.04 * (blotch(x, y, 10) - 0.5); return [rgb[0] * k, rgb[1] * k, rgb[2] * k]; });
}

// wide-leg trousers in a soft flannel, for a character who has none: the legs' own skin from the waist down,
// copied and moved out — round the hips just off the body, then each leg drawn out round its own line to one
// wide, straight width that falls to the top of the shoes. Skinned as the legs are.
// balloon: full round the knee and gathered in at the ankle instead; hem: where the hem is (default, on the shoes);
// quilt: that many padded channels running down each leg; piping: a cord round each cuff in that colour, tied in a
// little knot at the outside
export function wideTrousers(av, rgb = [126, 124, 122], { width = 0.09, balloon = false, hem = null, quilt = 0, piping = null, tex = null, stack = 0 } = {}) {   // (tex: its own cloth; stack: soft folds where a long hem piles on the shoes)
  const vrm = av.vrm, h = vrm.humanoid; vrm.scene.updateMatrixWorld(true);
  const W = b => h.getRawBoneNode(b).getWorldPosition(new THREE.Vector3());
  const hips = W('hips'), cx = hips.x, waist = hips.y + 0.06, crotch = W('leftUpperLeg').y - 0.05, fy = W('leftFoot').y, low = hem !== null && hem < fy;   // (low: down over the shoes — the feet left out of it, the leg drawn down to the hem)
  const hemY = hem ?? fy - 0.032, ankle = hem !== null && !low ? hem + 0.012 : fy + 0.02, floor = low ? fy - 0.015 : -1;
  let host = null; vrm.scene.traverse(o => { if (!host && o.isSkinnedMesh && [].concat(o.material).some(m => /Body_00_SKIN/.test(m.name))) host = o; });
  if (!host) return;
  const g = host.geometry, A = g.attributes, I = g.index, ms = [].concat(host.material), keep = [];
  for (const gr of g.groups.length ? g.groups : [{ start: 0, count: I.count, materialIndex: 0 }]) {
    const n = (ms[gr.materialIndex ?? 0] || {}).name || ''; if (!/Body_00_SKIN/.test(n)) continue;
    for (let k = gr.start; k + 2 < gr.start + gr.count; k += 3) { const t = [I.getX(k), I.getX(k + 1), I.getX(k + 2)]; if (t[0] === t[1] && t[1] === t[2]) continue;
      const ys = t.map(i => A.position.getY(i)); if (Math.max(...ys) < waist && Math.max(...ys) > ankle && Math.min(...ys) > floor) keep.push(...t); }
  }
  const remap = new Map(), out = {}; let idx = []; for (const nm of ['position', 'normal', 'uv', 'skinIndex', 'skinWeight']) if (A[nm]) out[nm] = [];
  for (const i of keep) { if (!remap.has(i)) { remap.set(i, remap.size); for (const nm in out) for (let c = 0; c < A[nm].itemSize; c++) out[nm].push(A[nm].array[i * A[nm].itemSize + c]); } idx.push(remap.get(i)); }
  let geo = new THREE.BufferGeometry();
  for (const nm in out) geo.setAttribute(nm, new THREE.BufferAttribute(new A[nm].array.constructor(out[nm]), A[nm].itemSize, A[nm].normalized));
  geo.setIndex(idx); if (quilt) { geo = subdivide(subdivide(geo)); idx = Array.from(geo.index.array); } geo.computeVertexNormals();   // (quilted: finer, for the channels to show)
  const P = geo.attributes.position, Nn = geo.attributes.normal, SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight, bones = host.skeleton.bones;
  { const weld = new Map(), v = new THREE.Vector3(); for (let i = 0; i < P.count; i++) { const k = `${Math.round(P.getX(i) * 2e4)},${Math.round(P.getY(i) * 2e4)},${Math.round(P.getZ(i) * 2e4)}`; (weld.get(k) || weld.set(k, []).get(k)).push(i); }   // (one normal where the skin's texture is cut, or it would split there as it moves out)
    for (const ids of weld.values()) { v.set(0, 0, 0); for (const i of ids) v.add(new THREE.Vector3().fromBufferAttribute(Nn, i)); v.normalize(); for (const i of ids) Nn.setXYZ(i, v.x, v.y, v.z); } }
  const Ls = new Set(['leftUpperLeg', 'leftLowerLeg', 'leftFoot'].map(b => h.getRawBoneNode(b))), Rs = new Set(['rightUpperLeg', 'rightLowerLeg', 'rightFoot'].map(b => h.getRawBoneNode(b)));
  const top = { 1: W('leftUpperLeg'), '-1': W('rightUpperLeg') }, bot = { 1: W('leftFoot'), '-1': W('rightFoot') }, col = new Float32Array(P.count * 3).fill(1), cuffR = { 1: [], '-1': [] };
  for (let i = 0; i < P.count; i++) {
    let l = 0, r = 0; for (let j = 0; j < 4; j++) { const w = SW.getComponent(i, j), b = bones[SI.getComponent(i, j)]; if (Ls.has(b)) l += w; else if (Rs.has(b)) r += w; }
    let x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    x += Nn.getX(i) * 0.005; y += Nn.getY(i) * 0.005; z += Nn.getZ(i) * 0.005;          // (just off the body)
    if (y < ankle) y = hemY;                                                             // (a straight hem, falling to the top of the shoes)
    const s = l > r ? 1 : -1, legw = Math.max(l, r), down = sm(crotch + 0.04, crotch - 0.06, y) * Math.min(1, legw * 1.5);
    if (down > 0) {
      const a = top[s], b = bot[s], t = Math.min(1, Math.max(0, (a.y - y) / (a.y - b.y))), ax = a.x + (b.x - a.x) * t, az = a.z + (b.z - a.z) * t + 0.008;
      const dx = x - ax, dz = z - az, rr = Math.hypot(dx, dz) || 1e-4, tl = Math.min(1, Math.max(0, (a.y - y) / (a.y - hemY)));
      let want = Math.max(rr, width + 0.006 * t);                                        // (a touch wider at the hem: it falls straight)
      if (balloon) { const g = sm(0.8, 0.97, tl); want = Math.max(rr, width * (0.8 + 0.32 * Math.sin(Math.PI * Math.min(1, tl * 1.08)))) * (1 - g) + (rr + 0.012) * g; }   // (full, then gathered at the ankle)
      if (stack) want *= 1 + stack * Math.sin(y * 130 + s) * sm(hemY + 0.1, hemY, y);   // (piled up on the shoes: folds round the leg, and a little wider)
      if (quilt) { const f = (((Math.atan2(dx, dz) / (Math.PI * 2)) * quilt) % 1 + 1) % 1, puff = Math.pow(Math.sin(Math.PI * f), 0.5); want *= 1 + 0.07 * puff; col.fill(0.35 + 0.65 * Math.pow(puff, 0.3) + 0.12 * (puff - 0.6), i * 3, i * 3 + 3); }   // (padded channels down the leg, stitched between)
      x = ax + dx / rr * (rr + (want - rr) * down); z = az + dz / rr * (rr + (want - rr) * down);
      if (y <= hemY + 0.001) cuffR[s].push(Math.hypot(x - ax, z - az));
      const out = Math.sign(a.x - cx); if ((x - cx) * out < 0.007) x = cx + out * 0.007;   /* (where the two legs meet they lie flat together, not through each other) */
    }
    P.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  const S = 128; tex = tex || canvasTex(S, S, (x, y) => { const k = 0.93 + 0.08 * (blotch(x, y, 3, 2) - 0.5) + 0.05 * (blotch(x, y, 14, 6) - 0.5); return [rgb[0] * k, rgb[1] * k, rgb[2] * k]; });   // (flannel: a soft heathered grey)
  if (quilt) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mats = toon(av, tex, 'Trousers', [0.74, 0.74, 0.8]); for (const m of mats) { m.vertexColors = !!quilt; m.ignoreVertexColor = !quilt; } mats[0].side = THREE.DoubleSide;
  if (mats.length > 1) { geo.addGroup(0, idx.length, 0); geo.addGroup(0, idx.length, 1); }
  const m = new THREE.SkinnedMesh(geo, mats.length > 1 ? mats : mats[0]); m.name = 'Trousers'; m.frustumCulled = false;
  host.parent.add(m); m.bind(host.skeleton, host.bindMatrix);
  if (piping) for (const s of [1, -1]) {                                                 // (the cord round each cuff, and its knot)
    const rs = cuffR[s]; if (!rs.length) continue; const r = rs.reduce((a2, b2) => a2 + b2, 0) / rs.length + 0.004, a = top[s], b = bot[s], t = Math.min(1, Math.max(0, (a.y - hemY) / (a.y - b.y))), ax = a.x + (b.x - a.x) * t, az = a.z + (b.z - a.z) * t + 0.008;
    const cord = std(new THREE.Color(...piping.map(c => c / 255)).getHex(), { roughness: 0.6 }), grp = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0042, 8, 40).rotateX(Math.PI / 2), cord); ring.position.set(ax, hemY + 0.003, az); grp.add(ring);
    const ox = ax + Math.sign(a.x - cx) * (r + 0.004), knot = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 10, 8), cord); knot.position.set(ox, hemY + 0.004, az); grp.add(knot);
    for (const d of [-1, 1]) { const loop = new THREE.Mesh(new THREE.TorusGeometry(0.006, 0.0022, 6, 14), cord); loop.position.set(ox + Math.sign(a.x - cx) * 0.002, hemY + 0.004, az + d * 0.008); loop.rotation.y = Math.PI / 2; loop.rotation.x = d * 0.5; grp.add(loop); }
    attach(av, s > 0 ? 'leftLowerLeg' : 'rightLowerLeg', grp);
  }
  return m;
}

// hair recoloured, keeping its strands' light and shade: each pixel by how light it was against the hair's usual
// shade, through tone(k) (white: kept round silver; black: dark, the shine still showing)
function hairTone(av, rgb, tone, shade) {
  av.vrm.scene.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) if (/HAIR/i.test(m.name) && !/Outline/.test(m.name) && m.map) {
    const src = m.map.image, cv = document.createElement('canvas'); cv.width = src.width; cv.height = src.height; const cg = cv.getContext('2d', { willReadFrequently: true }); cg.drawImage(src, 0, 0);
    const dd = cg.getImageData(0, 0, cv.width, cv.height).data, ls = []; for (let i = 0; i < dd.length; i += 32) if (dd[i + 3] > 128) ls.push((dd[i] + dd[i + 1] + dd[i + 2]) / 765);
    ls.sort((p, q) => p - q); const mid = Math.max(0.05, ls.length ? ls[ls.length >> 1] : 0.4);
    repaint(m, (r, g, b) => { const k = tone((r + g + b) / 765 / mid); return [rgb[0] * k, rgb[1] * k, rgb[2] * k]; });
    if (m.shadeColorFactor) m.shadeColorFactor.setRGB(...shade); if (m.emissive) m.emissive.setRGB(0, 0, 0);
  } });
}
export const whiteHair = (av, rgb = [226, 225, 224]) => hairTone(av, rgb, l => Math.min(1.06, Math.max(0.42, 0.34 + 0.64 * Math.pow(l, 0.9))), [0.6, 0.62, 0.7]);
export const tintHair = (av, rgb) => hairTone(av, rgb, l => Math.min(1.35, Math.max(0.42, 0.42 + 0.7 * Math.pow(l, 1.15))), [0.64, 0.6, 0.62]);   // (a mid colour, brown: dark at the roots and in the shade, the light catching it)
export const darkHair = (av, rgb = [30, 30, 36]) => hairTone(av, rgb, l => Math.min(2.8, Math.max(0.5, 0.55 + 0.9 * Math.pow(l, 1.4))), [0.55, 0.55, 0.66]);

// a wide black leather belt at the waist, over where the top is tucked into the trousers: a band round whatever is
// widest there (trousers or top), worn on the hips, with a square buckle at the front
export function belt(av, rgb = [26, 24, 24], { width = 0.04, buckle = 0xc8a764, arc = Math.PI } = {}) {   // (arc: how far round from the front it goes — under an open coat, only the front need be there)
  const vrm = av.vrm, h = vrm.humanoid; vrm.scene.updateMatrixWorld(true);
  const hp = h.getRawBoneNode('hips').getWorldPosition(new THREE.Vector3()), y1 = hp.y + 0.062, y0 = y1 - width, NA = 48, R = new Float32Array(NA);
  vrm.scene.traverse(o => {
    if (!o.isMesh || !o.geometry.index || o.name === 'Jacket' || ![].concat(o.material).some(m => /Trousers|Tops/.test(m.name))) return;
    const P = o.geometry.attributes.position, I = o.geometry.index;
    for (let k = 0; k + 2 < I.count; k += 3) { const t = [I.getX(k), I.getX(k + 1), I.getX(k + 2)]; if (t[0] === t[1] && t[1] === t[2]) continue;
      for (const i of t) { const y = P.getY(i); if (y < y0 - 0.006 || y > y1 + 0.006) continue; const dx = P.getX(i) - hp.x, dz = P.getZ(i) - hp.z, r = Math.hypot(dx, dz); if (r > 0.25) continue; const s = Math.floor(((Math.atan2(dx, dz) / (Math.PI * 2)) + 1) % 1 * NA); R[s] = Math.max(R[s], r); } }
  });
  const Rj = new Float32Array(NA).fill(1e9);                                          // (and the coat over it, wherever the coat is: the belt kept under that)
  vrm.scene.traverse(o => { if (o.name !== 'Jacket' || !o.isMesh) return; const P = o.geometry.attributes.position;
    for (let i = 0; i < P.count; i++) { const y = P.getY(i); if (y < y0 - 0.01 || y > y1 + 0.01) continue; const dx = P.getX(i) - hp.x, dz = P.getZ(i) - hp.z, r = Math.hypot(dx, dz); if (r > 0.3) continue; const s = Math.floor(((Math.atan2(dx, dz) / (Math.PI * 2)) + 1) % 1 * NA); Rj[s] = Math.min(Rj[s], r); } });
  const Rs = Array.from(R, (_, k) => { let m = 0, cj = 1e9; for (let j = -2; j <= 2; j++) { m = Math.max(m, R[(k + j + NA) % NA]); cj = Math.min(cj, Rj[(k + j + NA) % NA]); } return Math.min((m || 0.14) + 0.004, cj - 0.004); });
  const pos = [], uv = [], idx = [], NY = 4;
  const at = a => { const f = ((a / (Math.PI * 2)) % 1 + 1) % 1 * NA, k = Math.floor(f) % NA, t = f - Math.floor(f); return Rs[k] * (1 - t) + Rs[(k + 1) % NA] * t; };
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NA; i++) { const t = j / NY, a = -arc + 2 * arc * i / NA, end = Math.min(i, NA - i) / NA, r = at(a) + 0.0015 * Math.sin(Math.PI * t) - (arc < Math.PI ? 0.01 * (1 - sm(0, 0.15, end)) : 0); pos.push(hp.x + Math.sin(a) * r, y0 + width * t, hp.z + Math.cos(a) * r); uv.push(i / NA * 6 * arc / Math.PI, t); }   // (its ends tucked in under the coat)
  for (let j = 0; j < NY; j++) for (let i = 0; i < NA; i++) { const k = j * (NA + 1) + i; idx.push(k, k + 1, k + NA + 1, k + 1, k + NA + 2, k + NA + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const tex = canvasTex(64, 16, (x, y) => { const k = (y < 1.5 || y > 14 ? 0.8 : 1) * (0.96 + 0.06 * (blotch(x, y, 4, 3) - 0.5)); return [rgb[0] * k, rgb[1] * k, rgb[2] * k]; });   // (leather, its edges stitched a shade darker)
  const mats = toon(av, tex, 'Belt', [0.7, 0.7, 0.76]); for (const m of mats) { m.vertexColors = false; m.ignoreVertexColor = true; }
  if (mats.length > 1) { geo.addGroup(0, idx.length, 0); geo.addGroup(0, idx.length, 1); }
  const band = new THREE.Mesh(geo, mats.length > 1 ? mats : mats[0]); attach(av, 'hips', band);
  // the buckle: a square frame of brass, the prong across it
  const metal = std(buckle, { metalness: 0.8, roughness: 0.3 }), bz = hp.z + Rs[0] + 0.002, by = y0 + width / 2, bw = 0.022, bh = width * 0.62, bt = 0.0035, grp = new THREE.Group();
  for (const [w, hh, x, y] of [[bw * 2, bt, 0, bh], [bw * 2, bt, 0, -bh], [bt, bh * 2, bw, 0], [bt, bh * 2, -bw, 0]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w + bt, hh + 0.0001, 0.003), metal); b.position.set(x, y, 0); grp.add(b); }
  const prong = new THREE.Mesh(new THREE.BoxGeometry(bw * 1.1, 0.0022, 0.002), metal); prong.position.set(bw * 0.45, 0, 0.001); grp.add(prong);
  grp.position.set(hp.x, by, bz); attach(av, 'hips', grp);
  return band;
}

// a little embroidered flower on the front of one thigh, red petals round a dark heart and two green leaves, a few
// pale stitches — sewn onto the trousers there, moving with the leg
export function embroidery(av, trousers, { side = 1 } = {}) {
  const h = av.vrm.humanoid; av.vrm.scene.updateMatrixWorld(true);
  const W = b => h.getRawBoneNode(b).getWorldPosition(new THREE.Vector3()), cx = W('hips').x;
  let leg = W('leftUpperLeg'), knee = W('leftLowerLeg'), bone = 'leftUpperLeg'; if (Math.sign(leg.x - cx) !== side) { leg = W('rightUpperLeg'); knee = W('rightLowerLeg'); bone = 'rightUpperLeg'; }
  const y = leg.y - (leg.y - knee.y) * 0.5, x = leg.x + (knee.x - leg.x) * 0.5 + Math.sign(leg.x - cx) * 0.012, P = trousers.geometry.attributes.position;
  let z = -1e9; for (let i = 0; i < P.count; i++) if (Math.abs(P.getX(i) - x) < 0.015 && Math.abs(P.getY(i) - y) < 0.015) z = Math.max(z, P.getZ(i)); if (z < -1e8) return;
  const S = 128, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d');
  g.fillStyle = '#2f5e3c'; for (const a of [2.3, 3.9]) { g.save(); g.translate(64 + Math.cos(a) * 30, 64 + Math.sin(a) * 30); g.rotate(a); g.beginPath(); g.ellipse(0, 0, 20, 8, 0, 0, 7); g.fill(); g.restore(); }
  g.fillStyle = '#b8242c'; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 - 0.3; g.beginPath(); g.arc(64 + Math.cos(a) * 18, 58 + Math.sin(a) * 18, 15, 0, 7); g.fill(); }
  g.fillStyle = '#7a1218'; g.beginPath(); g.arc(64, 58, 10, 0, 7); g.fill();
  g.strokeStyle = '#e8d7bc'; g.lineWidth = 2; g.beginPath(); g.arc(64, 58, 24, 3.6, 4.6); g.stroke(); g.beginPath(); g.arc(64, 58, 24, 0.2, 1.1); g.stroke();
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.046, 0.046), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.4, roughness: 0.85, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }));
  patch.position.set(x, y, z + 0.0015); attach(av, bone, patch); return patch;
}
