// Sheepskin snow boots (the UGG kind), made for the character's own legs: a straight, loose shaft up the calf round
// the line of the shin, running down at the ankle into a round, soft-toed foot on a flat sole, a seam down the front
// and the back, and the fleece showing in a fluffy roll round the top. Skinned to her bones — the shaft to the
// shin, the foot to the foot, blended round the ankle — so they walk as she does. Chestnut suede, the sole darker.
// Her shoes, and whatever of her legs and trousers the boots cover, are taken away: the jeans tuck in.
import * as THREE from 'three';
import { blotch } from './kit.js';

export function suede(rgb) {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), img = g.createImageData(S, S), d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const k = 0.92 + 0.12 * (blotch(x, y, 26) - 0.5) + 0.06 * (blotch(x, y, 3, 9) - 0.5), i = (y * S + x) * 4;   // (the nap: soft patches, fine grain)
    d[i] = rgb[0] * k; d[i + 1] = rgb[1] * k; d[i + 2] = rgb[2] * k; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
// sheepskin fleece: cream wool in tight curls, each with its own little shadow
function wool(rgb) {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), img = g.createImageData(S, S), d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const c1 = blotch(x, y, 5, 3), c2 = blotch(x, y, 11, 8), curl = Math.pow(Math.abs(Math.sin((c1 * 2.2 + c2) * Math.PI * 2)), 0.6);   // (rings of curl)
    const k = 0.78 + 0.26 * curl + 0.06 * (blotch(x, y, 32, 4) - 0.5), i = (y * S + x) * 4;
    d[i] = Math.min(255, rgb[0] * k); d[i + 1] = Math.min(255, rgb[1] * k * 0.99); d[i + 2] = Math.min(255, rgb[2] * k * 0.97); d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
// teddy fleece (sherpa): little round clumps of curly pile packed close, each lit on top and shadowed round its
// edge, the gaps between them dark — one 6 cm square that repeats seamlessly
export const TEDDY = 0.06;
export function teddy(rgb) {
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const g = cv.getContext('2d');
  const c = (k, a = 1) => `rgba(${Math.min(255, rgb[0] * k) | 0},${Math.min(255, rgb[1] * k) | 0},${Math.min(255, rgb[2] * k) | 0},${a})`;
  g.fillStyle = c(0.8); g.fillRect(0, 0, S, S);                                           // (between the clumps, a little darker)
  let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let n = 0; n < 900; n++) {
    const x0 = rnd() * S, y0 = rnd() * S, r = 7 + rnd() * 6, tone = 0.95 + rnd() * 0.1;   // (packed close, overlapping)
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S], [S, S], [-S, -S], [S, -S], [-S, S]]) {   // (across the edges too: the tile meets itself)
      const x = x0 + ox, y = y0 + oy; if (x < -15 || x > S + 15 || y < -15 || y > S + 15) continue;
      const gr = g.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r);       // (lit from above, shadowed round the edge)
      gr.addColorStop(0, c(1.06 * tone)); gr.addColorStop(0.6, c(0.99 * tone)); gr.addColorStop(0.9, c(0.88 * tone, 0.8)); gr.addColorStop(1, c(0.84, 0));
      g.fillStyle = gr; g.beginPath(); for (let k = 0; k <= 14; k++) { const a = k / 14 * Math.PI * 2, rr = r * (0.88 + 0.12 * Math.sin(a * 5 + x0)); k ? g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill();
      g.strokeStyle = c(1.12 * tone, 0.25); g.lineWidth = 1; g.beginPath(); g.arc(x - r * 0.15, y - r * 0.1, r * 0.45, 3.6, 5.6); g.stroke();   // (a curl of the pile catching the light)
    }
  }
  g.filter = 'blur(0.8px)'; g.drawImage(cv, 0, 0); g.filter = 'none';                     // (soft: pile, not pebbles)
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
// a toon material like her clothes', over the given texture (with its outline twin)
export function toon(av, tex, name, shade) {
  let base = null; av.vrm.scene.traverse(o => { if (base || !o.isMesh) return; for (const m of [].concat(o.material)) if (m.isMToonMaterial && !m.isOutline && /Shoes|Bottoms|CLOTH/.test(m.name)) { base = m; break; } });
  if (!base) return [new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, vertexColors: true })];
  const m = base.clone(); m.name = name; m.map = tex; m.shadeMultiplyTexture = tex; m.color.setRGB(1, 1, 1);
  for (const k of ['normalMap', 'emissiveMap', 'shadingShiftTexture', 'rimMultiplyTexture', 'outlineWidthMultiplyTexture', 'uvAnimationMaskTexture', 'matcapTexture']) m[k] = null;
  m.alphaTest = 0; m.transparent = false; m.side = THREE.FrontSide; m.vertexColors = true; m.ignoreVertexColor = false;
  if (m.shadeColorFactor) m.shadeColorFactor.setRGB(...shade);
  const o = m.clone(); o.name = name + ' (Outline)'; o.isOutline = true; o.side = THREE.BackSide;
  if (Array.isArray(av.vrm.materials)) av.vrm.materials.push(m, o);
  return [m, o];
}
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// rgb: the suede (0–255); fleece: the cuff's colour (0–255); height: how far up the calf (knee = 1) at least —
// higher if that's what it takes to take in the trousers' hems
export function uggs(av, { rgb = [184, 134, 92], fleece = [242, 234, 220], height = 0.62, tuck = true, cuff = true, tex = null, fluffy = 0, laces = null, lacing = null } = {}) {   // (tuck: rise to take in the trousers' hems; cuff: the fleece roll; tex: the boot's own texture; fluffy: the surface lumpy with curls, teddy fleece; laces: their colour, criss-crossed up the instep and tied in a bow; lacing: { from, to } heights above the ground, bow (its size), r (the lace's thickness))
  const vrm = av.vrm, h = vrm.humanoid; vrm.scene.updateMatrixWorld(true);
  const W = b => { const n = h.getRawBoneNode(b); return n && n.getWorldPosition(new THREE.Vector3()); };
  let host = null, ground = 1e9, hem = 1e9, skinR = { left: 0, right: 0 };
  const knee0 = W('leftLowerLeg'), ankle0 = W('leftFoot');
  vrm.scene.traverse(o => {
    if (!o.isSkinnedMesh || !o.geometry.index) return; const ms = [].concat(o.material), g = o.geometry, I = g.index, P = g.attributes.position;
    for (const gr of g.groups.length ? g.groups : [{ start: 0, count: I.count, materialIndex: 0 }]) {
      const n = (ms[gr.materialIndex ?? 0] || {}).name || ''; if (/Outline/.test(n)) continue;
      if (/Body.*SKIN/.test(n)) host = host || o;
      for (let k = gr.start; k < gr.start + gr.count; k++) { const i = I.getX(k), y = P.getY(i);
        if (/Shoes/.test(n)) ground = Math.min(ground, y);
        if (/Body.*SKIN/.test(n)) ground = Math.min(ground, y);
        if (/Bottoms/.test(n) && y < knee0.y) hem = Math.min(hem, y);                  // (the lowest the trousers come)
      }
    }
  });
  if (!host) return;
  const top = Math.max(ankle0.y + height * (knee0.y - ankle0.y), tuck && hem < 1e8 ? hem + 0.03 : 0), skel = host.skeleton;
  const bi = b => skel.bones.indexOf(h.getRawBoneNode(b));
  const mats = toon(av, tex || suede(rgb), 'Boots', [0.74, 0.64, 0.6]).slice(0, fluffy ? 1 : 2); mats[0].side = THREE.DoubleSide;   // (fleece: no drawn outline, its lumps would break it into scratches)
  if (fluffy && mats[0].parametricRimColorFactor) { mats[0].parametricRimColorFactor.setRGB(0.32, 0.29, 0.26); mats[0].parametricRimFresnelPowerFactor = 2.5; mats[0].parametricRimLiftFactor = 0.05; mats[0].rimLightingMixFactor = 0.6; }   // (a soft glow round its edges, as pile has against the light)   // (where the shaft turns into the foot the surface folds over on itself; both sides drawn, no hole shows)
  const fur = toon(av, wool(fleece), 'Fleece', [0.86, 0.8, 0.76]).slice(0, 1);       // (no drawn outline round every curl: the ink line is enough)
  const meshes = [];
  for (const side of ['left', 'right']) {
    const knee = W(side + 'LowerLeg'), ankle = W(side + 'Foot'), toes = W(side + 'Toes') || ankle.clone().add(new THREE.Vector3(0, -0.06, 0.12));
    // how round her calf is just under the top (the shaft hangs straight from there, loose)
    // her calf just under the top: its middle (behind the shin bone) and how far round it reaches from there
    const ring = []; each(vrm, /Body.*SKIN/, (x, y, z) => { if (Math.abs(y - (top - 0.02)) < 0.012) { const t = (y - ankle.y) / (knee.y - ankle.y), bx = ankle.x + (knee.x - ankle.x) * t, bz = ankle.z + (knee.z - ankle.z) * t; if (Math.abs(x - bx) < 0.08 && Math.hypot(x - bx, z - bz) < 0.1) ring.push([x, z]); } });
    let mx = 0, mz = 0; for (const [x, z] of ring) { mx += x; mz += z; } const nR = Math.max(1, ring.length); mx /= nR; mz /= nR;
    let r = 0; for (const [x, z] of ring) r = Math.max(r, Math.hypot(x - mx, z - mz));
    const R = Math.max(r, 0.04) + 0.008, calf = ring.length ? [mx, mz] : null;        // (the shaft's half-width: leg plus sheepskin)
    const toeDir = new THREE.Vector2(toes.x - ankle.x, toes.z - ankle.z).normalize(), aToe = Math.atan2(toeDir.x, toeDir.y);
    const reach = Math.hypot(toes.x - ankle.x, toes.z - ankle.z) + 0.055;             // (ankle to the tip of the boot's toe)
    const axisAt = y => {                                                                // (from the ankle up to the middle of the calf at the top)
      const yt = top - 0.02, t = Math.min(1, Math.max(0, (y - ankle.y) / (yt - ankle.y))), ex = calf ? calf[0] : ankle.x + (knee.x - ankle.x) * (yt - ankle.y) / (knee.y - ankle.y), ez = calf ? calf[1] : ankle.z + (knee.z - ankle.z) * (yt - ankle.y) / (knee.y - ankle.y);
      const k = Math.min(1.15, (y - ankle.y) / (yt - ankle.y)) ; return [ankle.x + (ex - ankle.x) * Math.max(0, k), ankle.z + (ez - ankle.z) * Math.max(0, k)];
    };
    // the outline seen from above at height y, in direction a (round from the toe): the shaft's round, and low
    // down the foot reaching forward to the toe and a little back to the heel
    const radius = (y, a) => {
      const yy = y - ground, c = Math.cos(a - aToe), low = 1 - sm(0.035, 0.095, yy);     // (the foot: below the ankle)
      const fwd = Math.max(0, c), back = Math.max(0, -c);
      const toe = (reach - R) * Math.pow(fwd, 1.6) * low * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, yy - 0.005) / 0.075, 2))) ;
      return R * (1 + 0.06 * c) + toe + 0.012 * Math.pow(back, 2) * low + 0.003 * (1 - sm(0, 0.012, yy));   // (a little proud at the welt)
    };
    const curl = (a, y) => fluffy ? fluffy * sm(0.01, 0.02, y - ground) * (1 - 0.7 * sm(top - 0.012, top, y)) * (0.55 + 0.45 * Math.sin(a * 23 + y * 140) * Math.sin(a * 11 - y * 260) + 0.35 * Math.sin(a * 41 + y * 410)) : 0;   // (teddy fleece: little lumps of curl all over, not on the sole)
    const NA = fluffy ? 96 : 48, ys = [];
    for (let k = 0; k <= (fluffy ? 44 : 28); k++) ys.push(ground + (top - ground) * Math.pow(k / (fluffy ? 44 : 28), 1.35));   // (rows closer together low down, where the shape turns)
    const pos = [], uv = [], col = [], si = [], sw = [], idx = [];
    const wFoot = y => 1 - sm(ankle.y - 0.01, ankle.y + 0.05, y), fi = bi(side + 'Foot'), li = bi(side + 'LowerLeg');
    for (let j = 0; j < ys.length; j++) for (let i = 0; i <= NA; i++) {
      const a = aToe + i / NA * Math.PI * 2, y = ys[j], [ax, az] = axisAt(Math.max(y, ankle.y + 0.02)), rr = radius(y, a) + curl(a, y);
      pos.push(ax + Math.sin(a) * rr, y, az + Math.cos(a) * rr); if (fluffy) uv.push(i / NA * 2 * Math.PI * R / TEDDY, y / TEDDY); else uv.push(i / NA * 2, y * 4);   // (fleece: its clumps at their own size)
      const seam = Math.max(0, 1 - Math.min(Math.abs(Math.sin((a - aToe) / 2)), Math.abs(Math.cos((a - aToe) / 2))) * 40) * sm(ankle.y, ankle.y + 0.03, y);   // (front and back seams)
      const k = (y - ground < 0.014 ? 0.58 : 1) * (1 - 0.18 * seam); col.push(k, k, k);
      const f = wFoot(y); si.push(fi, li, 0, 0); sw.push(f, 1 - f, 0, 0);
    }
    for (let j = 0; j < ys.length - 1; j++) for (let i = 0; i < NA; i++) { const k = j * (NA + 1) + i; idx.push(k, k + 1, k + NA + 1, k + 1, k + NA + 2, k + NA + 1); }   // (facing out)
    // the sole: closed underneath
    const c0 = pos.length / 3; { const [ax, az] = axisAt(ankle.y + 0.02); pos.push(ax + toeDir.x * reach * 0.35, ground, az + toeDir.y * reach * 0.35); uv.push(0, 0); col.push(0.5, 0.5, 0.5); si.push(fi, li, 0, 0); sw.push(1, 0, 0, 0); }
    for (let i = 0; i < NA; i++) idx.push(c0, i + 1, i);                                  // (facing down)
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    geo.setIndex(idx); geo.computeVertexNormals();
    meshes.push([geo, mats]);
    // the laces: through four pairs of eyelets up the instep, crossed between them, tied in a bow at the top with its
    // two ends hanging
    if (laces) {
      const lm = toon(av, suede(laces), 'Laces', [0.8, 0.76, 0.74]); for (const m of lm) { m.vertexColors = false; m.ignoreVertexColor = true; }
      const at = (y, off, lift = 0.003) => { const [ax, az] = axisAt(Math.max(y, ankle.y + 0.02)), r0 = radius(y, aToe), a = aToe + off / r0, r = radius(y, a) + fluffy * 1.2 + lift; return new THREE.Vector3(ax + Math.sin(a) * r, y, az + Math.cos(a) * r); };
      const L = lacing || {}, y0 = ground + (L.from ?? 0.045), y1 = L.to !== undefined ? ground + L.to : top - 0.024, rows = 4, w = 0.011, row = k => y0 + (y1 - y0) * k / (rows - 1), paths = [], bs = L.bow || 1;
      paths.push([at(row(0), -w), at(row(0), 0, 0.005), at(row(0), w)]);
      for (let k = 0; k < rows - 1; k++) for (const s0 of [-1, 1]) { const A = at(row(k), s0 * w), B = at(row(k + 1), -s0 * w), M = at((row(k) + row(k + 1)) / 2, 0, 0.006 + 0.001 * s0); paths.push([A, M, B]); }
      const knot = at(y1, 0, 0.006), side = new THREE.Vector3(Math.cos(aToe), 0, -Math.sin(aToe)), fwd = new THREE.Vector3(Math.sin(aToe), 0, Math.cos(aToe));
      for (const s0 of [-1, 1]) {                                                       // (the bow's two loops, out to the sides and a little up, and the two ends down over the instep)
        const sd = side.clone().multiplyScalar(s0);
        const B = (sx, sy, sf) => knot.clone().addScaledVector(sd, sx * bs).add(new THREE.Vector3(0, sy * bs, 0)).addScaledVector(fwd, sf * bs);
        paths.push([knot, B(0.012, 0.008, 0.004), B(0.02, 0.002, 0.006), B(0.012, -0.005, 0.006), knot.clone()]);
        paths.push([knot, B(0.006, -0.012, 0.006), B(0.012, -0.026, 0.012), B(0.008 + 0.006 * s0, -0.04, 0.02)]);   // (the ends hanging down over the toe, a little apart)
      }
      for (const pts of paths) {
        const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, L.r || 0.0026, 6, false), TP = tg.attributes.position, tsi = [], tsw = [];
        for (let i = 0; i < TP.count; i++) { const f = wFoot(TP.getY(i)); tsi.push(fi, li, 0, 0); tsw.push(f, 1 - f, 0, 0); }
        tg.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(tsi, 4)); tg.setAttribute('skinWeight', new THREE.Float32BufferAttribute(tsw, 4)); meshes.push([tg, lm]);
      }
      { const kg = new THREE.SphereGeometry(0.0055, 10, 8), KP = kg.attributes.position, ksi = [], ksw = []; kg.translate(knot.x, knot.y, knot.z);
        for (let i = 0; i < KP.count; i++) { const f = wFoot(KP.getY(i)); ksi.push(fi, li, 0, 0); ksw.push(f, 1 - f, 0, 0); }
        kg.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(ksi, 4)); kg.setAttribute('skinWeight', new THREE.Float32BufferAttribute(ksw, 4)); meshes.push([kg, lm]); }
    }
    // the fleece rolled out over the top: a fat soft roll of sheepskin, its edge broken into tufts and curls
    if (cuff) { const [ax, az] = axisAt(top), fp = [], fu = [], fc = [], fsi = [], fsw = [], fidx = [], NF = 120, NR = 16;
      const hsh = (i, j) => { let v = Math.imul(i * 73856093 ^ j * 19349663, 2654435761) >>> 0; return v / 4294967296; };
      const tuft = (i, j) => {                                                          // (curls: lumps of every size, a few sticking well out)
        const a = i / NF * Math.PI * 2, t = j / NR * Math.PI * 2;
        const lump = Math.pow(0.5 + 0.5 * Math.sin(a * 19 + 1.7 * Math.sin(a * 5)), 1.6) * (0.6 + 0.4 * Math.sin(t * 2 + a * 3));   // (round lumps of curl, never spikes)
        return 0.9 + 0.3 * lump + 0.08 * Math.sin(a * 37 + t * 3) * Math.sin(a * 13 - t * 2);
      };
      for (let j = 0; j <= NR; j++) for (let i = 0; i <= NF; i++) {
        const a = i / NF * Math.PI * 2, t = j / NR * Math.PI * 2, k = tuft(i, j), base = radius(top, aToe + a) - 0.002;
        const rr = base + 0.011 + Math.cos(t) * 0.014 * k, y = top + 0.006 + Math.sin(t) * 0.016 * k;   // (some 3 cm tall and 2.5 deep, rolled over the rim)
        fp.push(ax + Math.sin(aToe + a) * rr, y, az + Math.cos(aToe + a) * rr); fu.push(i / NF * 5, j / NR * 1.5);
        const sh = 0.86 + 0.14 * Math.min(1, k); fc.push(sh, sh, sh); fsi.push(li, 0, 0, 0); fsw.push(1, 0, 0, 0);
      }
      for (let j = 0; j < NR; j++) for (let i = 0; i < NF; i++) { const k = j * (NF + 1) + i; fidx.push(k, k + 1, k + NF + 1, k + 1, k + NF + 2, k + NF + 1); }
      const fg = new THREE.BufferGeometry();
      fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); fg.setAttribute('uv', new THREE.Float32BufferAttribute(fu, 2)); fg.setAttribute('color', new THREE.Float32BufferAttribute(fc, 3));
      fg.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(fsi, 4)); fg.setAttribute('skinWeight', new THREE.Float32BufferAttribute(fsw, 4));
      fg.setIndex(fidx); fg.computeVertexNormals(); meshes.push([fg, fur]); }
  }
  for (const [geo, m] of meshes) {
    if (m.length > 1) { geo.addGroup(0, geo.index.count, 0); geo.addGroup(0, geo.index.count, 1); }
    const bm = new THREE.SkinnedMesh(geo, m.length > 1 ? m : m[0]); bm.name = 'Boots'; bm.userData.boots = true; bm.frustumCulled = false;
    host.parent.add(bm); bm.bind(skel, host.bindMatrix);
  }
  // the shoes and what's inside the boots go
  vrm.scene.traverse(o => {
    if (!o.isMesh || o.userData.boots || !o.geometry.index) return; const ms = [].concat(o.material), g = o.geometry, I = g.index, P = g.attributes.position;
    for (const gr of g.groups.length ? g.groups : [{ start: 0, count: I.count, materialIndex: 0 }]) {
      const n = (ms[gr.materialIndex ?? 0] || {}).name || ''; const shoe = /Shoes/.test(n), inside = /Body.*SKIN|Bottoms|Tights/.test(n); if (!shoe && !inside) continue;
      for (let k = gr.start; k + 2 < gr.start + gr.count; k += 3) { const a = I.getX(k), b = I.getX(k + 1), c = I.getX(k + 2); if (shoe || Math.max(P.getY(a), P.getY(b), P.getY(c)) < top - 0.008) { I.setX(k + 1, a); I.setX(k + 2, a); } }
      I.needsUpdate = true;
    }
  });
}

// every vertex of the model's meshes whose material name matches re, in the rest pose
function each(vrm, re, fn) {
  vrm.scene.traverse(o => {
    if (!o.isMesh || !o.geometry.index) return; const ms = [].concat(o.material), P = o.geometry.attributes.position, I = o.geometry.index, g = o.geometry;
    for (const gr of g.groups.length ? g.groups : [{ start: 0, count: I.count, materialIndex: 0 }]) { const m = ms[gr.materialIndex ?? 0]; if (!m || !re.test(m.name) || /Outline/.test(m.name)) continue;
      for (let k = gr.start; k < gr.start + gr.count; k++) { const i = I.getX(k); fn(P.getX(i), P.getY(i), P.getZ(i)); } }
  });
}
