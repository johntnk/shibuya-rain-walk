// 开放地图（OpenStreetMap，ODbL）的原始数据 → 场景用的紧凑数据 data/shibuya.json
// 坐标：原点是涩谷十字路口中心（35.65948, 139.70056），x 向东、z 向南、单位米。
//   node night/tools/bake-osm.cjs
const fs = require('node:fs'), path = require('node:path');
const D = path.join(__dirname, '..', 'data');
const lat0 = 35.65948, lon0 = 139.70056, kx = 111320 * Math.cos(lat0 * Math.PI / 180), kz = 110574;
const xy = p => [Math.round((p.lon - lon0) * kx * 10) / 10, Math.round(-(p.lat - lat0) * kz * 10) / 10];
const load = n => JSON.parse(fs.readFileSync(path.join(D, n + '.json'), 'utf8')).elements;
const B = load('osm-buildings'), W = load('osm-ways'), N = load('osm-nodes');
const num = v => { const f = parseFloat(v); return Number.isFinite(f) ? f : null; };
const area = pts => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
const ring = g => { const pts = g.map(xy); if (pts.length > 1 && pts[0][0] === pts.at(-1)[0] && pts[0][1] === pts.at(-1)[1]) pts.pop(); return area(pts) < 0 ? pts.reverse() : pts; };   // (counter-clockwise seen from above, with z south: a positive area here)
const out = { origin: [lat0, lon0], buildings: [], ways: [], nodes: [] };
const R = 520;
for (const e of B) {
  const t = e.tags || {};
  let rings = [];
  if (e.type === 'way' && e.geometry) rings = [ring(e.geometry)];
  else if (e.type === 'relation') {
    // outer rings: the members' pieces joined end to end
    const segs = (e.members || []).filter(m => m.role === 'outer' && m.geometry).map(m => m.geometry.map(xy));
    while (segs.length) {
      let cur = segs.shift();
      for (let k = 0; k < 200 && segs.length; k++) {
        const end = cur.at(-1), i = segs.findIndex(s => (s[0][0] === end[0] && s[0][1] === end[1]) || (s.at(-1)[0] === end[0] && s.at(-1)[1] === end[1]));
        if (i < 0) break; let s = segs.splice(i, 1)[0]; if (s[0][0] !== end[0] || s[0][1] !== end[1]) s = s.reverse(); cur = cur.concat(s.slice(1));
      }
      if (cur.length > 3) { if (cur[0][0] === cur.at(-1)[0] && cur[0][1] === cur.at(-1)[1]) cur.pop(); rings.push(area(cur) < 0 ? cur.reverse() : cur); }
    }
  }
  for (const pts of rings) {
    if (pts.length < 3) continue;
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    if (Math.hypot(cx, cz) > R) continue;
    const lv = num(t['building:levels']), h = num(t.height) ?? (lv ? lv * 3.6 + 1 : null), minLv = num(t['building:min_level']);
    out.buildings.push({ id: e.type[0] + e.id, name: t.name || t['name:en'] || '', kind: t.building || ('part:' + (t['building:part'] || 'yes')), part: !!t['building:part'],
      h, lv, minh: num(t.min_height) ?? (minLv != null ? minLv * 3.6 : 0), roof: t['roof:shape'] || '', colour: t['building:colour'] || '', mat: t['building:material'] || '',
      c: [Math.round(cx * 10) / 10, Math.round(cz * 10) / 10], a: Math.round(Math.abs(area(pts))), pts });
  }
}
for (const e of W) {
  const t = e.tags || {}; if (!e.geometry) continue;
  const pts = e.geometry.map(xy); if (!pts.some(p => Math.hypot(p[0], p[1]) < R)) continue;
  const kind = t['area:highway'] ? 'area' : t.railway ? 'rail' : 'hw';
  out.ways.push({ id: e.id, kind, type: t['area:highway'] || t.railway || t.highway, name: t.name || '', lanes: num(t.lanes), width: num(t.width), oneway: t.oneway === 'yes', layer: num(t.layer) || 0,
    bridge: !!t.bridge, tunnel: !!t.tunnel, footway: t.footway || '', crossing: t.crossing || '', area: t.area === 'yes', service: t.service || '', pts });
}
for (const e of N) {
  const t = e.tags || {}; const p = xy(e);
  out.nodes.push({ id: e.id, p, hw: t.highway || '', crossing: t.crossing || '', amenity: t.amenity || '', shop: t.shop || '', name: t.name || '' });
}
fs.writeFileSync(path.join(D, 'shibuya.json'), JSON.stringify(out));
console.log('buildings', out.buildings.length, 'ways', out.ways.length, 'nodes', out.nodes.length, 'bytes', fs.statSync(path.join(D, 'shibuya.json')).size);
