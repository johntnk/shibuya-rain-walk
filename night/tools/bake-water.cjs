// OpenStreetMap (ODbL) water round Shibuya out to about 21 km → data/farwater.json, for the far city (farcity.js):
//   coast   Tokyo Bay's coastline (natural=coastline): lines; the sea is found from them in the browser (filled from a
//           point out in the bay)
//   areas   rivers, canals, moats, lakes, reservoirs drawn as areas (natural=water, waterway=riverbank; not ponds or
//           pools): outer rings and inner ones (islands)
//   lines   the rivers and canals as centre lines (waterway=river|canal, not in tunnels or culverts), with a width
// Downloaded with the Overpass API into data/water-dl/ (coast.json, water.json, waterways.json, 2026-10-14).
// Metres from the Scramble Crossing (35.65948, 139.70056), x east, z south, as everywhere else.
//   node night/tools/bake-water.cjs
const fs = require('node:fs'), path = require('node:path');
const D = path.join(__dirname, '..', 'data'), DL = path.join(D, 'water-dl');
const lat0 = 35.65948, lon0 = 139.70056, kx = 111320 * Math.cos(lat0 * Math.PI / 180), kz = 110574, WE = 21000;
const xy = p => [(p.lon - lon0) * kx, -(p.lat - lat0) * kz];
const r1 = v => Math.round(v);
const load = n => JSON.parse(fs.readFileSync(path.join(DL, n + '.json'), 'utf8')).elements;
function simplify(pts, eps) {
  if (pts.length < 3) return pts;
  const d2 = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz; let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / L : 0; t = Math.max(0, Math.min(1, t)); const x = a[0] + t * dx - p[0], z = a[1] + t * dz - p[1]; return x * x + z * z; };
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const st = [[0, pts.length - 1]];
  while (st.length) { const [i, j] = st.pop(); let m = -1, md = eps * eps; for (let n = i + 1; n < j; n++) { const dd = d2(pts[n], pts[i], pts[j]); if (dd > md) { md = dd; m = n; } } if (m >= 0) { keep[m] = 1; st.push([i, m], [m, j]); } }
  return pts.filter((_, i) => keep[i]);
}
const near = pts => pts.some(([x, z]) => Math.abs(x) < WE + 2000 && Math.abs(z) < WE + 2000);
const pack = pts => simplify(pts, 3).map(([x, z]) => [r1(x), r1(z)]);
// a relation's rings of one role, its ways joined end to end
function join(members, role) {
  const segs = members.filter(m => m.role === role && m.geometry).map(m => m.geometry.map(xy)), out = [];
  const same = (a, b) => Math.abs(a[0] - b[0]) < 0.05 && Math.abs(a[1] - b[1]) < 0.05;
  while (segs.length) {
    let cur = segs.shift();
    for (let k = 0; k < 2000 && segs.length; k++) {
      const end = cur.at(-1); if (same(cur[0], end) && cur.length > 3) break;
      const i = segs.findIndex(s => same(s[0], end) || same(s.at(-1), end)); if (i < 0) break;
      let s = segs.splice(i, 1)[0]; if (!same(s[0], end)) s = s.reverse(); cur = cur.concat(s.slice(1));
    }
    if (cur.length > 3) out.push(cur);
  }
  return out;
}
const out = { origin: [lat0, lon0], extent: WE, coast: [], areas: [], lines: [] };
for (const e of load('coast')) if (e.geometry) { const p = e.geometry.map(xy); if (near(p)) out.coast.push(pack(p)); }
const SKIP = /pond|reflecting_pool|wastewater|fountain|swimming|fish/;
for (const e of load('water')) {
  const t = e.tags || {}; if (SKIP.test(t.water || '') || t.covered === 'yes' || t.tunnel) continue;
  let o, i = [];
  if (e.type === 'way') { if (!e.geometry) continue; o = [e.geometry.map(xy)]; }
  else { o = join(e.members || [], 'outer'); i = join(e.members || [], 'inner'); }
  o = o.filter(near); if (!o.length) continue;
  out.areas.push({ o: o.map(pack), i: i.filter(near).map(pack) });
}
const DEF = { river: 16, canal: 10 };
for (const e of load('waterways')) {
  const t = e.tags || {}; if (!e.geometry || t.tunnel || t.covered === 'yes' || (parseFloat(t.layer) || 0) < 0) continue;
  const p = e.geometry.map(xy); if (!near(p)) continue;
  const w = parseFloat(t.width) || DEF[t.waterway] || 8;
  out.lines.push([Math.round(w), pack(p)]);
}
fs.writeFileSync(path.join(D, 'farwater.json'), JSON.stringify(out));
console.log('coast', out.coast.length, 'areas', out.areas.length, 'lines', out.lines.length, 'bytes', fs.statSync(path.join(D, 'farwater.json')).size);
