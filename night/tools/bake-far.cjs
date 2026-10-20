// OpenStreetMap (ODbL) round Shibuya out to about 7 km → the far city's compact data, data/farcity.json:
//   roads   the main roads (motorway … tertiary), the Shuto Expressway's elevated parts marked
//   rail    the railways above ground (elevated ones marked)
//   tall    every building 30 m or more (or 10 storeys): its footprint and height
//   green   the parks, gardens, woods, cemeteries over 3000 m²
// Metres from the Scramble Crossing (35.65948, 139.70056), x east, z south, as everywhere else.
//   node night/tools/bake-far.cjs
const fs = require('node:fs'), path = require('node:path');
const D = path.join(__dirname, '..', 'data');
const lat0 = 35.65948, lon0 = 139.70056, kx = 111320 * Math.cos(lat0 * Math.PI / 180), kz = 110574;
const xy = p => [(p.lon - lon0) * kx, -(p.lat - lat0) * kz];
const load = n => JSON.parse(fs.readFileSync(path.join(D, n + '.json'), 'utf8')).elements;
const r1 = v => Math.round(v * 2) / 2;
const num = v => { const f = parseFloat(v); return Number.isFinite(f) ? f : null; };
function simplify(pts, eps, closed = false) {
  if (pts.length < 3) return pts;
  const d2 = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz; let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L : 0; t = Math.max(0, Math.min(1, t)); const x = a[0] + t * dx - p[0], z = a[1] + t * dz - p[1]; return x * x + z * z; };
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
  while (st.length) { const [i, j] = st.pop(); let m = -1, md = eps * eps; for (let n = i + 1; n < j; n++) { const dd = d2(pts[n], pts[i], pts[j]); if (dd > md) { md = dd; m = n; } } if (m >= 0) { keep[m] = 1; st.push([i, m], [m, j]); } }
  const out = pts.filter((_, i) => keep[i]); return closed && out.length < 3 ? pts.slice(0, 3) : out;
}
const area = pts => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
const ccw = pts => (area(pts) < 0 ? pts.slice().reverse() : pts);
function rings(e) {                                                   // a way's ring, or a relation's outer rings joined
  if (e.type === 'way') { if (!e.geometry) return []; const p = e.geometry.map(xy); if (p.length > 1 && p[0][0] === p.at(-1)[0] && p[0][1] === p.at(-1)[1]) p.pop(); return [p]; }
  const segs = (e.members || []).filter(m => m.role === 'outer' && m.geometry).map(m => m.geometry.map(xy)), out = [];
  const same = (a, b) => Math.abs(a[0] - b[0]) < 0.05 && Math.abs(a[1] - b[1]) < 0.05;
  while (segs.length) {
    let cur = segs.shift();
    for (let k = 0; k < 500 && segs.length; k++) { const end = cur.at(-1), i = segs.findIndex(s => same(s[0], end) || same(s.at(-1), end)); if (i < 0) break; let s = segs.splice(i, 1)[0]; if (!same(s[0], end)) s = s.reverse(); cur = cur.concat(s.slice(1)); }
    if (cur.length > 3) { if (same(cur[0], cur.at(-1))) cur.pop(); out.push(cur); }
  }
  return out;
}
const T = { motorway: 0, motorway_link: 1, trunk: 2, trunk_link: 3, primary: 4, primary_link: 5, secondary: 6, tertiary: 7 };
const out = { origin: [lat0, lon0], roads: [], rail: [], tall: [], green: [] };
for (const e of load('far-roads')) {
  const t = e.tags || {}; if (!e.geometry || t.tunnel === 'yes' || t.tunnel === 'building_passage' || t.covered === 'yes' || (num(t.layer) || 0) < 0) continue;
  const pts = simplify(e.geometry.map(xy), 2.5).map(p => [r1(p[0]), r1(p[1])]);
  const up = t.bridge === 'yes' || t.bridge === 'viaduct' || (num(t.layer) || 0) >= 1;
  out.roads.push([T[t.highway] ?? 7, up ? 1 : 0, num(t.lanes) || 0, t.oneway === 'yes' ? 1 : 0, pts]);
}
for (const e of load('far-rail')) {
  const t = e.tags || {}; if (!e.geometry || t.service) continue;
  const up = t.bridge === 'yes' || t.bridge === 'viaduct' || (num(t.layer) || 0) >= 1;
  out.rail.push([up ? 1 : 0, simplify(e.geometry.map(xy), 3).map(p => [r1(p[0]), r1(p[1])])]);
}
const seen = new Set();
for (const e of load('far-tall')) {
  const t = e.tags || {};
  const lv = num(t['building:levels']), h = num(t.height) ?? (lv ? lv * 3.7 + 2 : null); if (!h || h < 30) continue;
  for (const pts0 of rings(e)) {
    const pts = ccw(simplify(pts0, 1.0, true)).map(p => [r1(p[0]), r1(p[1])]); if (pts.length < 3) continue;
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const key = Math.round(cx) + ',' + Math.round(cz); if (seen.has(key)) continue; seen.add(key);
    const minLv = num(t['building:min_level']);
    out.tall.push([Math.round(h * 10) / 10, Math.round((num(t.min_height) ?? (minLv != null ? minLv * 3.7 : 0)) * 10) / 10, t.name || '', t['building:part'] ? 1 : 0, (t.building === 'apartments' || t.building === 'residential' || /マンション|レジデンス|タワー.*(レジ|ハウス)|Residence|Apartment|Tower Residence/i.test(t.name || '')) ? 1 : (t.building === 'hotel' || /ホテル|Hotel/i.test(t.name || '')) ? 2 : 0, pts]);
  }
}
const G = { park: 0, garden: 0, grass: 1, forest: 2, wood: 2, cemetery: 3, golf_course: 1 };
for (const e of load('far-green')) {
  const t = e.tags || {}, k = G[t.leisure] ?? G[t.landuse] ?? G[t.natural]; if (k == null) continue;
  for (const pts0 of rings(e)) { const a = Math.abs(area(pts0)); if (a < 3000) continue; out.green.push([k, Math.round(a), ccw(simplify(pts0, 4, true)).map(p => [r1(p[0]), r1(p[1])])]); }
}
fs.writeFileSync(path.join(D, 'farcity.json'), JSON.stringify(out));
console.log('roads', out.roads.length, 'elevated', out.roads.filter(r => r[1]).length, 'rail', out.rail.length, 'tall', out.tall.length, 'green', out.green.length, 'bytes', fs.statSync(path.join(D, 'farcity.json')).size);
