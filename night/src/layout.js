// Where things are: the real Shibuya round the Scramble Crossing (OpenStreetMap's buildings and streets, data/
// shibuya.json, in metres from the middle of the crossing: x east, z south), and the lie of the ground drawn from it —
// which is road (asphalt, a kerb down) and which is pavement — painted into a picture once, so the kerbs, the road's
// surface and the pavement all come from the one drawing. No three.js here, so other tools can draw it too.

// the carriageways: how wide each kind of street is (metres), when OpenStreetMap gives no width
const WIDTH = { trunk: 15, primary: 14, secondary: 12, tertiary: 0, unclassified: 6, residential: 4.6, service: 3.6, living_street: 4, trunk_link: 7, primary_link: 7, secondary_link: 6, tertiary_link: 6 };
const roadWidth = w => w.width || (w.type === 'tertiary' ? Math.max(6.5, (w.lanes || 2) * 3.2 + 0.8) : WIDTH[w.type] ?? 0);
// streets that are paved for walking though cars may pass (Center-gai): no kerb, the shopping street's paving
const SHARED = new Set(['渋谷センター街']);

// the open asphalt of the Scramble itself, between its four corners (traced over the aerial photograph)
export const CORE = [[-27, -13.5], [-15, -15.5], [-5.5, -17], [1.5, -19.5], [14, -19.5], [17.5, -13], [23.5, -10.5], [25, 5.5], [15, 12], [3, 18.5], [-13, 17.5], [-24, 11], [-28, 5]];

// the crossings painted on it: from a to b (the way you walk), w wide
export const CROSSWALKS = [
  { a: [-11.5, -15.5], b: [12.5, 11.5], w: 9.5, diag: true },        // the long diagonal: Q-FRONT's corner to Hachikō
  { a: [-1.5, -21.5], b: [16.5, -16], w: 6.5 },                        // north: Q-FRONT ↔ MAGNET, over Jingū-dōri
  { a: [20.5, -12.5], b: [21.5, 8.0], w: 6.5 },                        // east: over the road under the railway
  { a: [-17.5, 15.0], b: [2.5, 17.0], w: 6.5 },                        // south: the station-front building ↔ Hachikō
  { a: [-30.5, -12.0], b: [-29.0, 6.5], w: 6.5 },                      // west: over Dōgenzaka
];

export async function loadLayout(url = './data/shibuya.json') {
  const d = await fetch(url).then(r => r.json());
  const roads = d.ways.filter(w => w.kind === 'hw' && roadWidth(w) > 0 && !w.tunnel && !w.bridge && w.layer >= 0 && !SHARED.has(w.name) && !w.area);
  return { ...d, roads, shared: d.ways.filter(w => w.kind === 'hw' && SHARED.has(w.name)) };
}

// the drawing: white where there is road. box = [x0, z0, width, depth] in metres, k pixels a metre
export function roadMask(L, box, k, canvas = null) {
  const W = Math.round(box[2] * k), H = Math.round(box[3] * k);
  const c = canvas || (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H) : Object.assign(document.createElement('canvas'), { width: W, height: H }));
  c.width = W; c.height = H;
  const g = c.getContext('2d'), P = ([x, z]) => [(x - box[0]) * k, (z - box[1]) * k];
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  g.strokeStyle = g.fillStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round';
  for (const w of L.roads) { g.lineWidth = roadWidth(w) * k; g.beginPath(); w.pts.forEach((p, i) => { const [a, b] = P(p); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.stroke(); }
  g.beginPath(); CORE.forEach((p, i) => { const [a, b] = P(p); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.closePath(); g.fill();
  // no road inside a building
  g.fillStyle = '#000';
  for (const b of L.buildings) { if (b.part || (b.minh || 0) > 3) continue; g.beginPath(); b.pts.forEach((p, i) => { const [a, bb] = P(p); i ? g.lineTo(a, bb) : g.moveTo(a, bb); }); g.closePath(); g.fill(); }
  return c;
}

// the kerb lines: where the drawing goes from road to pavement (marching squares on its red channel), as
// polylines in metres, smoothed and thinned
export function kerbLines(img, box, k, step = 1) {
  const { width: W, height: H, data } = img, v = (i, j) => data[(Math.min(H - 1, j) * W + Math.min(W - 1, i)) * 4] / 255;
  const segs = [];
  for (let j = 0; j < H - step; j += step) for (let i = 0; i < W - step; i += step) {
    const a = v(i, j), b = v(i + step, j), c = v(i + step, j + step), d = v(i, j + step);
    const idx = (a > 0.5 ? 8 : 0) | (b > 0.5 ? 4 : 0) | (c > 0.5 ? 2 : 0) | (d > 0.5 ? 1 : 0);
    if (idx === 0 || idx === 15) continue;
    const t = (p, q) => (0.5 - p) / (q - p);
    const top = [i + step * t(a, b), j], right = [i + step, j + step * t(b, c)], bot = [i + step * t(d, c), j + step], left = [i, j + step * t(a, d)];
    const S = { 1: [left, bot], 2: [bot, right], 3: [left, right], 4: [top, right], 5: [left, top, bot, right], 6: [top, bot], 7: [left, top], 8: [left, top], 9: [top, bot], 10: [top, right, left, bot], 11: [top, right], 12: [left, right], 13: [bot, right], 14: [left, bot] }[idx];
    for (let s = 0; s < S.length; s += 2) segs.push([S[s], S[s + 1]]);
  }
  // join the little pieces into lines
  const key = p => Math.round(p[0] * 8) + ',' + Math.round(p[1] * 8), ends = new Map();
  segs.forEach((s, i) => { for (const e of [0, 1]) { const kk = key(s[e]); if (!ends.has(kk)) ends.set(kk, []); ends.get(kk).push(i); } });
  const used = new Uint8Array(segs.length), lines = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue; used[i] = 1; let line = [segs[i][0], segs[i][1]];
    for (const dir of [1, 0]) {
      for (let guard = 0; guard < 100000; guard++) {
        const end = dir ? line[line.length - 1] : line[0], cand = (ends.get(key(end)) || []).find(n => !used[n]); if (cand == null) break;
        used[cand] = 1; const s = segs[cand], nxt = key(s[0]) === key(end) ? s[1] : s[0];
        if (dir) line.push(nxt); else line.unshift(nxt);
      }
    }
    if (line.length > 3) lines.push(line.map(([i2, j2]) => [box[0] + i2 / k, box[1] + j2 / k]));
  }
  return lines.map(l => simplify(smooth(l), 0.06));
}
function smooth(l) { const closed = Math.hypot(l[0][0] - l.at(-1)[0], l[0][1] - l.at(-1)[1]) < 0.3; const o = l.map((p, i) => { if (!closed && (i === 0 || i === l.length - 1)) return p; const a = l[(i - 1 + l.length) % l.length], b = l[(i + 1) % l.length]; return [(a[0] + 2 * p[0] + b[0]) / 4, (a[1] + 2 * p[1] + b[1]) / 4]; }); return o; }
function simplify(pts, eps) {
  if (pts.length < 3) return pts;
  const d2 = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz; let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L : 0; t = Math.max(0, Math.min(1, t)); const x = a[0] + t * dx - p[0], z = a[1] + t * dz - p[1]; return x * x + z * z; };
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
  while (st.length) { const [i, j] = st.pop(); let m = -1, md = eps * eps; for (let n = i + 1; n < j; n++) { const dd = d2(pts[n], pts[i], pts[j]); if (dd > md) { md = dd; m = n; } } if (m >= 0) { keep[m] = 1; st.push([i, m], [m, j]); } }
  return pts.filter((_, i) => keep[i]);
}
