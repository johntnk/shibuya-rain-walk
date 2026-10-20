// His own things, whatever he wears: two black cords round the neck, one with a silver ring, the other longer
// with a long silver fang; leather bands round the right wrist. Built in the character's rest pose; the cords
// lie on the chest as it is dressed (`under`: the materials they rest on — the skin and the top next to it).
import * as THREE from 'three';
import { std, attach } from './kit.js';

// strands: [how far it drops, how wide it hangs, its pendant ('ring', 'fang', 'disc')] each; gold: a fine gold
// chain instead of black cord
export function necklaces(av, under, { strands = [[0.11, 0.058, 'ring'], [0.19, 0.064, 'fang']], gold = false, gem = 0xd2782a } = {}) {   // (gem: the stone's colour, for a 'gem' pendant)
  const vrm = av.vrm, h = vrm.humanoid; vrm.scene.updateMatrixWorld(true);
  const neck = h.getRawBoneNode('neck').getWorldPosition(new THREE.Vector3());
  const tri = [], skin = [];                                           // (the chest's triangles, 9 numbers each, and its vertices with their skinning; a merged mesh keeps each material in a group)
  let host = null;
  vrm.scene.traverse(o => {
    if (!o.isSkinnedMesh) return; const ms = Array.isArray(o.material) ? o.material : [o.material], g = o.geometry, P = g.attributes.position, I = g.index;
    const want = m => m && under.test(m.name || '') && !/Outline/.test(m.name);
    const groups = g.groups.length ? g.groups : [{ start: 0, count: I ? I.count : P.count, materialIndex: 0 }];
    for (const gr of groups) if (want(ms[gr.materialIndex ?? 0])) for (let k = gr.start; k + 2 < gr.start + gr.count; k += 3) {
      const ids = [0, 1, 2].map(j => I ? I.getX(k + j) : k + j), v = ids.map(i => [P.getX(i), P.getY(i), P.getZ(i)]);
      if (v.every(q => Math.abs(q[0]) > 0.16 || q[1] < neck.y - 0.4 || q[1] > neck.y + 0.06)) continue;
      tri.push(...v[0], ...v[1], ...v[2]); host = host || o;
      for (const i of ids) skin.push({ p: new THREE.Vector3(P.getX(i), P.getY(i), P.getZ(i)), ix: new THREE.Vector4().fromBufferAttribute(g.attributes.skinIndex, i), w: new THREE.Vector4().fromBufferAttribute(g.attributes.skinWeight, i) });
    }
  });
  if (!host) return;
  // a cord moves with the cloth under it: each of its points takes the skinning of the nearest point of the chest
  // (the upper chest alone is not enough: as he moves the lower chest comes forward over a cord that only follows the upper chest)
  // (blended from the few nearest, so a cord passing from skin onto cloth bends smoothly instead of kinking)
  // (only the trunk and neck carry it: the chest's spring bones would kink a fine chain as they bounce)
  const allowed = new Set(['hips', 'spine', 'chest', 'upperChest', 'neck'].map(n => h.getRawBoneNode(n)).filter(Boolean)), bones = host.skeleton.bones, lift = new Map();
  const trunk = b => { if (lift.has(b)) return lift.get(b); let n = bones[b]; while (n && !allowed.has(n)) n = n.parent; const r = n ? Math.max(0, bones.indexOf(n)) : b; lift.set(b, r); return r; };
  const nearest = p => {
    const best = []; for (const s of skin) { const e = s.p.distanceToSquared(p); if (best.length < 8 || e < best[7].e) { best.push({ s, e }); best.sort((a, b) => a.e - b.e); if (best.length > 8) best.pop(); } }
    const acc = new Map(); for (const { s, e } of best) { const k = 1 / (Math.sqrt(e) + 0.004); for (let j = 0; j < 4; j++) { const w = s.w.getComponent(j); if (w > 0) { const b = trunk(s.ix.getComponent(j)); acc.set(b, (acc.get(b) || 0) + w * k); } } }
    const top = [...acc].sort((a, b) => b[1] - a[1]).slice(0, 4), sum = top.reduce((a, t) => a + t[1], 0);
    const ix = new THREE.Vector4(0, 0, 0, 0), w = new THREE.Vector4(0, 0, 0, 0); top.forEach(([b, x], j) => { ix.setComponent(j, b); w.setComponent(j, x / sum); });
    return { ix, w };
  };
  const skinTo = (geo, at) => {
    const P = geo.attributes.position, n = P.count, ix = new Uint16Array(n * 4), w = new Float32Array(n * 4), v = new THREE.Vector3();
    // (a fine chain goes smoothly from the upper chest at the top to the chest lower down — blended from the nearest
    // cloth point by point, its links pull apart into kinks; held by the upper chest alone, the chest swallows its end)
    const bix = n => Math.max(0, host.skeleton.bones.indexOf(h.getRawBoneNode(n))), uc = bix('upperChest'), ch = bix('chest'), yN = neck.y - 0.085;
    const byHeight = y => { const t = Math.min(1, Math.max(0, (yN - y) / 0.12)), k = t * t * (3 - 2 * t); return { ix: new THREE.Vector4(uc, ch, 0, 0), w: new THREE.Vector4(1 - k, k, 0, 0) }; };
    const one = gold ? (at ? byHeight(at.y) : null) : at && nearest(at);
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(P, i); const s = one || (gold ? byHeight(v.y) : nearest(v)); s.ix.toArray(ix, i * 4); s.w.toArray(w, i * 4); }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(ix, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(w, 4));
    return geo;
  };
  const onSkin = (geo, mat, at) => { const m = new THREE.SkinnedMesh(skinTo(geo, at), mat); host.parent.add(m); m.bind(host.skeleton, host.bindMatrix); m.frustumCulled = false; return m; };
  // how far forward the dressed chest is at (x, y): a ray from the front onto those triangles
  const hit = (x, y) => {
    let z = -1;
    for (let t = 0; t < tri.length; t += 9) {
      const ax = tri[t], ay = tri[t + 1], bx = tri[t + 3], by = tri[t + 4], cx = tri[t + 6], cy = tri[t + 7];
      const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy); if (Math.abs(d) < 1e-12) continue;
      const u = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d, v = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d;
      if (u < 0 || v < 0 || u + v > 1) continue;
      z = Math.max(z, u * tri[t + 2] + v * tri[t + 5] + (1 - u - v) * tri[t + 8]);
    }
    return z;
  };
  const frontAt = (x, y, r = 0.006) => Math.max(hit(x, y), hit(x - r, y), hit(x + r, y), hit(x, y - r), hit(x, y + r), neck.z);   // (a little round, so a cord between two samples stays out)
  const silver = std(0xe6e8ee, { metalness: 0.75, roughness: 0.25, emissive: 0x30323a });   // (a little of its own light: the night has nothing for it to mirror)
  const metal = gold ? std(0xdcb46e, { metalness: 0.8, roughness: 0.28, emissive: 0x3a2a12 }) : silver, cord = gold ? metal : std(0x0c0c0c, { roughness: 0.6 });
  // a chain goes all the way round the neck: round the outside of whatever is there (a chunky turtleneck stands well
  // out), clear of the knit everywhere at that height, and from there it falls down the front
  const cxN = neck.x, czN = neck.z, yArc = neck.y - 0.008, NA = 36, ring = new Float32Array(NA);
  if (gold) {
    for (let t = 0; t < tri.length; t += 3) {
      const x = tri[t], y = tri[t + 1], z = tri[t + 2]; if (y < yArc - 0.006 || y > yArc + 0.02) continue; const d = Math.hypot(x - cxN, z - czN); if (d > 0.13) continue;   // (the collar from here up, not the shoulders sloping away below)
      const k = Math.floor(((Math.atan2(x - cxN, z - czN) / (Math.PI * 2)) + 1) % 1 * NA); ring[k] = Math.max(ring[k], d);
    }
  }
  const ringS = Array.from(ring, (_, k) => { let m = 0; for (let d = -1; d <= 1; d++) m = Math.max(m, ring[(k + d + NA) % NA]); return (m || 0.06) + 0.004 + 0.005 * Math.max(0, -Math.cos(k / NA * Math.PI * 2)); });   // (a little proud of the knit's bumps behind)
  const rAt = a => { const f = (((a / (Math.PI * 2)) % 1 + 1) % 1) * NA, k = Math.floor(f), t = f - k; return ringS[k % NA] * (1 - t) + ringS[(k + 1) % NA] * t; };
  for (const [drop, W0, pend] of strands) {
    const yTop = neck.y - 0.035, pts = [], a0 = 0.95;                                  // (gold: the front hangs from the ring 54° either side of the middle)
    const W = gold ? Math.sin(a0) * rAt(a0) : W0, yHang = gold ? yArc : yTop, fall = drop + (yHang - yTop);
    if (!gold) pts.push(new THREE.Vector3(-W * 0.85, yTop + 0.012, neck.z - 0.035));          // (from behind the neck, under the hair)
    const front = [];
    for (let i = 0; i <= 28; i++) {
      const a = -1 + 2 * i / 28, x = W * Math.sin(a * Math.PI / 2), y = yHang - fall * Math.pow(Math.cos(a * Math.PI / 2), 1.4), z = frontAt(x, y) + 0.004;
      front.push(new THREE.Vector3(x, y, z));
    }
    // (a cord pulled taut: smoothed over the seams and folds of the cloth, never into it)
    if (gold) {                                                                          // (a fine chain lies in one smooth curve over the knit's ups and downs)
      const env = front.map(p => frontAt(p.x, p.y, 0.008) + 0.003), top3 = env.map((_, i) => Math.max(...env.slice(Math.max(0, i - 3), i + 4)));
      front.forEach((p, i) => { p.z = top3[i]; });
      for (let k = 0; k < 12; k++) for (let i = 1; i < front.length - 1; i++) { const p = front[i]; p.z = Math.max(env[i], (front[i - 1].z + 2 * p.z + front[i + 1].z) / 4); }
    } else for (let k = 0; k < 4; k++) for (let i = 1; i < front.length - 1; i++) { const p = front[i], z = (front[i - 1].z + 2 * p.z + front[i + 1].z) / 4; p.z = Math.max(z, frontAt(p.x, p.y, 0.003) + 0.003); }
    if (gold) for (const [i, sg] of [[0, -1], [front.length - 1, 1]]) front[i].z = Math.max(front[i].z, czN + Math.cos(a0) * rAt(sg * a0));   // (its ends on the ring)
    if (gold) pts.push(...front.filter((_, i) => Math.abs(-1 + 2 * i / 28) < 0.78)); else pts.push(...front);   // (gold: the curve finds its own way round onto the ring, no corner)
    if (gold) {
      for (let i = 0; i <= 18; i++) {                                                 // (round the back, on the ring)
        const a = a0 + 0.1 + (Math.PI * 2 - 2 * a0 - 0.2) * i / 18, r = rAt(a);
        pts.push(new THREE.Vector3(cxN + Math.sin(a) * r, yArc, czN + Math.cos(a) * r));
      }
    } else pts.push(new THREE.Vector3(W * 0.85, yTop + 0.012, neck.z - 0.035));
    onSkin(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, gold), gold ? 160 : 90, gold ? 0.0012 : 0.0022, 6, gold), cord);
    // the pendant hangs from the bottom of the cord and rests on the chest along its length; it moves as one piece with the point it lies on
    const yl = yTop - drop - 0.004, len = pend === 'ring' ? 0.03 : pend === 'disc' ? 0.02 : pend === 'gem' ? 0.026 : 0.065, z0 = frontAt(0, yl, 0.012), z1 = frontAt(0, yl - len, 0.012);
    const pg = pend === 'ring' ? new THREE.TorusGeometry(0.014, 0.0035, 8, 20).translate(0, -0.015, 0)
      : pend === 'disc' ? new THREE.CylinderGeometry(0.0085, 0.0085, 0.0022, 24).rotateX(Math.PI / 2).translate(0, -0.0045, 0)   // (a small round charm, hung right on the chain)
      : pend === 'gem' ? new THREE.OctahedronGeometry(0.011, 0).scale(0.85, 1.25, 0.5).translate(0, -0.016, 0)   // (a cut stone, a drop)
      : new THREE.ConeGeometry(0.0075, 0.065, 10).rotateX(Math.PI).translate(0, -0.034, 0);
    pg.rotateX(-Math.atan2(z1 - z0, len)).translate(0, yl, z0 + 0.008);   // (tilted out where the chest comes forward)
    onSkin(pg, pend === 'gem' ? std(gem, { metalness: 0.1, roughness: 0.08, emissive: new THREE.Color(gem).multiplyScalar(0.25).getHex(), flatShading: true }) : metal, new THREE.Vector3(0, yl - len / 2, (z0 + z1) / 2));
  }
}

// leather bands round the right wrist
export function wristbands(av) {
  const h = av.vrm.humanoid; av.vrm.scene.updateMatrixWorld(true);
  const lo = h.getRawBoneNode('rightLowerArm').getWorldPosition(new THREE.Vector3()), hand = h.getRawBoneNode('rightHand').getWorldPosition(new THREE.Vector3());
  const dir = hand.clone().sub(lo).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const leather = std(0x2a1a12, { roughness: 0.7 }), black = std(0x141414, { roughness: 0.6 });
  [[0.035, leather, 0.0055], [0.055, black, 0.004], [0.072, leather, 0.0035]].forEach(([back, m, th]) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.032, th, 6, 20).rotateX(Math.PI / 2), m);
    ring.quaternion.copy(q); ring.position.copy(hand).addScaledVector(dir, -back); attach(av, 'rightLowerArm', ring);
  });
}
