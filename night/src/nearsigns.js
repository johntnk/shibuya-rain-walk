// Shibuya's signs and roofs, block by block, as the photographs from SHIBUYA SKY show them and Tokyo's rules have it
// (docs/research/调研-近处涩谷夜里的楼灯.md):
//   the older shopping blocks (Center-gai, Udagawachō, Dōgenzaka, Kōen-dōri, round the crossing): up a corner of
//     every wall that faces a street a column of tenants' boxes standing out from it, one a floor, in the real signs'
//     colours; a board of light high on the walls over the bigger streets; on some of the older roofs a big board up
//     on a steel frame, facing the main road
//   the new towers: nothing coloured high up and no adverts on their roofs (the rules: above 10 m a wall sign is only
//     the building's or the firm's name, lit white, not blinking, at most 3 m tall and a third of the wall) — so only
//     their name, in white, near the top
//   every roof its plant: the air-conditioners' outdoor units in rows, the lift's machine room, a water tank
//   and beyond the near ground (more than 220 m out) the streets' light: their lamps as points, and the glow on them
//     (the lamps', the shop fronts') painted into a picture for the far ground to show
// Close to the crossing (where one walks) the columns' words are real, from the atlas; further off they are made up
// in the shader (fake words, a column of panels each its own colours), as they read from up on the roof.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { at, Kit } from './kit.js';
import { col, U, GLSL_COMMON } from './materials.js';
import { SCHEMES, tenantName } from './signs.js';
import { KIND } from './city.js';
import { rng } from './util.js';
import { LightBuffer } from './farcity.js';

export const NEAR_BOX = [-560, -560, 1120, 1120];
const GROUND_HALF = 220;                                               // (the near ground's own box, ±220 m)
const STREET_W = { motorway: 16, motorway_link: 7, trunk: 15, trunk_link: 7, primary: 14, primary_link: 7, secondary: 12, secondary_link: 6, tertiary: 8, tertiary_link: 6, unclassified: 6, residential: 4.6, service: 3.6, living_street: 4, pedestrian: 6, footway: 2.5, path: 2 };
const MAIN = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'trunk_link', 'primary_link']);
const SHOPPING = new Set(['渋谷センター街', '宇田川通り', '文化村通り', 'スペイン坂', '井ノ頭通り', '道玄坂', '公園通り', 'ペンギン通り', '渋谷中央通り', 'プラザ通り', '間坂', 'サンドイッチロード', 'SAKURAストリート', '宮益坂', '美竹通り', 'ウェーヴ通り', '夢二通り', '旧大山街道']);
// the towers' names as they are written on them (where OpenStreetMap has the name only in Japanese)
const TOWER_NAME = { 'セルリアンタワー': 'CERULEAN TOWER', '渋谷ヒカリエ': 'Shibuya Hikarie', '渋谷ストリーム': 'SHIBUYA STREAM', '渋谷フクラス': 'FUKURAS', '渋谷クロスタワー': 'SHIBUYA CROSS TOWER',
  '渋谷ソラスタ': 'SHIBUYA SOLASTA', '渋谷インフォスタワー': 'SHIBUYA INFOSS TOWER', 'ホテルインディゴ東京渋谷': 'HOTEL INDIGO', '渋谷Parco': 'PARCO', '渋谷キャスト': 'SHIBUYA CAST' };
const nameOn = n => { if (!n) return null; if (TOWER_NAME[n]) return TOWER_NAME[n]; const m = n.match(/[A-Za-z][A-Za-z0-9 .\-]{3,}/g); return m ? m.sort((a, b) => b.length - a.length)[0].trim() : null; };
// what the boards on the walls and roofs say (made up: the kinds of thing such boards are for)
const BOARD_WORDS = ['カラオケ', '英会話', '24時間営業', 'ラーメン', '焼肉', '居酒屋', 'ドラッグストア', 'メガネ', '歯科', '不動産', '買取', 'ネットカフェ', 'ゲーム', '脱毛', '学習塾', '整体', 'ローン', 'ホテル',
  'SALE', 'NEW OPEN', 'LIVE', 'CLUB', 'BEAUTY', 'HAIR', 'CAFE', 'BAR', 'KIRA', 'LUNA', 'NEON', 'SORA', 'MIYABI', 'TOKI', 'BLUE', 'STAR'];
const yawOf = (nx, nz) => Math.atan2(nx, nz);
const inPoly = (pts, x, z) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
const edgeDist = (pts, x, z) => { let m = 1e9; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz || 1; let t = ((x - a[0]) * dx + (z - a[1]) * dz) / L; t = Math.max(0, Math.min(1, t)); m = Math.min(m, Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z)); } return m; };
// how much of a shopping quarter a place is (Udagawachō, Center-gai, Dōgenzaka, Jinnan, Kōen-dōri the most; round the
// crossing; less east of the station and in Sakuragaoka, where offices are more)
function busy(x, z) {
  let k = 0.35;
  if (x < 40 && z < 160 && x > -470 && z > -470) k = 1;
  if (Math.hypot(x, z) < 150) k = 1;
  if (x > 120 && x < 430 && z > -290 && z < 90) k = Math.max(k, 0.6);
  if (x > -220 && x < 130 && z > 150 && z < 470) k = Math.max(k, 0.55);
  return k;
}

export class NearSigns {
  constructor(L, city, { signs, atlas, skipSigns = new Set() }) {
    const R = rng(4242), K = new Kit(), t0 = performance.now(); this.plantGeos = [];
    this.group = new THREE.Group(); this.group.name = 'near signs';
    this.stats = { columns: 0, panels: 0, boards: 0, roofBoards: 0, names: 0, plant: 0, lamps: 0 };
    const mask = this.streetMask(L), [bx, bz, bw, bh] = NEAR_BOX, MW = mask.W;
    const at2 = (x, z) => { const i = Math.floor(x - bx), j = Math.floor(z - bz); if (i < 0 || j < 0 || i >= MW || j >= MW) return 0; return j * MW + i; };
    const facing = (x, z, nx, nz) => {                                 // is there a street out from this wall? a main road?
      let s = 0, m = 0;
      for (const d of [2.5, 5, 8]) { const k = at2(x + nx * d, z + nz * d) * 4; s = Math.max(s, mask.d[k]); m = Math.max(m, mask.d[k + 1]); }
      return { street: s > 100, main: m > 100 };
    };
    // the words for the columns near the crossing: a fixed few, so the atlas holds them
    const POOL = Array.from({ length: 90 }, () => tenantName(R));
    const label = (t, o) => atlas.add(t, o);
    const fronts = [];                                                 // (the shop fronts' feet, for the far streets' glow)
    this.pads = []; this.red = new LightBuffer(6000);
    for (const e of city.list) {
      if (e.custom || !e.h) continue;
      const b = e.b, h = e.h, kind = e.kind; if ((b.minh || 0) > 3 || h < 6 || kind === KIND.STATION) continue;
      const pts = b.pts, n = pts.length;
      const cx = pts.reduce((s, p) => s + p[0], 0) / n, cz = pts.reduce((s, p) => s + p[1], 0) / n, dC = Math.hypot(cx, cz), bzK = busy(cx, cz);
      const big = h > 60 || b.a > 3500;
      // its walls, each with its outward way and what it faces
      const walls = [];
      for (let i = 0; i < n; i++) {
        const [x0, z0] = pts[i], [x1, z1] = pts[(i + 1) % n], len = Math.hypot(x1 - x0, z1 - z0); if (len < 3) continue;
        let nx = (z1 - z0) / len, nz = -(x1 - x0) / len; const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
        if (inPoly(pts, mx + nx * 0.4, mz + nz * 0.4)) { nx = -nx; nz = -nz; }
        const f = facing(mx, mz, nx, nz), f2 = len > 12 ? facing(x0 + (x1 - x0) * 0.2, z0 + (z1 - z0) * 0.2, nx, nz) : f;
        walls.push({ x0, z0, x1, z1, len, nx, nz, tx: (x1 - x0) / len, tz: (z1 - z0) / len, street: f.street || f2.street, main: f.main || f2.main });
      }
      const onStreet = walls.filter(w => w.street).sort((a, b) => (b.main - a.main) || (b.len - a.len));
      if (b.part) continue;
      const noSigns = skipSigns.has(b.id);
      if (!big && (b.minh || 0) < 0.5) for (const w of onStreet) fronts.push(w);
      if (noSigns) { /* (its own screens: landmarks.js) */ }
      else if (big) {
        // a tower: its name in white near the top, on the walls facing the main streets (or its two longest)
        const nm = nameOn(b.name);
        if (nm && h > 45) {
          const r = label(nm, { px: 72, weight: 500, font: 'Helvetica Neue' });   // (sizes kept down: the word atlas is shared, and was full)
          const ws = (onStreet.length ? onStreet : walls.slice().sort((a, b) => b.len - a.len)).slice(0, 2);
          for (const w of ws) {
            const lh = 2.6, lw = Math.min(w.len / 3, lh * r.aspect * 0.92); if (lw < 4) continue;
            const t = 0.5, x = w.x0 + (w.x1 - w.x0) * t, z = w.z0 + (w.z1 - w.z0) * t;
            signs.box(at(x + w.nx * 0.12, h - 4.2, z + w.nz * 0.12, yawOf(w.nx, w.nz)), lw, lh / 0.92, 0.12, { pz: { r, fill: 0.94 } }, '#11141b', '#f4f6fa', 1.0);
            this.stats.names++;
          }
        }
      } else {
        const pc = (kind === KIND.SHOPS ? 0.85 : kind === KIND.OFFICE ? 0.6 : 0.12) * (0.45 + 0.55 * bzK) * (dC < 260 ? 1.15 : 1);
        let boards = 0;
        for (const w of onStreet.slice(0, 3)) {
          // the tenants' column at a corner of the wall, standing out over the pavement
          if (w.len >= 4 && R() < pc) {
            const fh = 3.35 + R() * 0.4, y0 = 4.7, floors = Math.min(12, Math.floor((h - 1.0 - y0) / fh));
            if (floors >= 1) {
              const ends = [R() < 0.5 ? 0 : 1]; if (w.len > 18 && R() < 0.35) ends.push(1 - ends[0]);
              for (const e2 of ends) {
                const t = e2 ? w.len - (0.6 + R() * 0.9) : 0.6 + R() * 0.9, x = w.x0 + w.tx * t, z = w.z0 + w.tz * t;
                const d = 1.0 + R() * 0.5, wd = 0.36 + R() * 0.16, yaw = yawOf(w.nx, w.nz) + Math.PI / 2;
                if (dC < 170) {
                  const one = R() < 0.3 ? R.pick(SCHEMES) : null;
                  for (let i = 0; i < floors; i++) {
                    const sc = one || R.pick(SCHEMES), r = label(R.pick(POOL), { vertical: true, px: 64 });
                    signs.box(at(x + w.nx * d / 2, y0 + i * fh + (fh - 0.12) / 2, z + w.nz * d / 2, yaw), d, fh - 0.12, wd, { pz: { r, fill: 0.86 }, nz: { r, fill: 0.86 }, px: { lit: true }, nx: { lit: true } }, sc[0], sc[1], 1.45);
                  }
                } else {
                  const seed = R() * 100, H = floors * fh;
                  signs.box(at(x + w.nx * d / 2, y0 + H / 2, z + w.nz * d / 2, yaw), d, H, wd, { pz: { fake: 3, n: floors, seed }, nz: { fake: 3, n: floors, seed }, px: { lit: true }, nx: { lit: true } }, '#f4f2ec', '#111111', 1.45);
                }
                this.stats.columns++; this.stats.panels += floors;
              }
            }
          }
          // a tall narrow board down the wall (the shopping streets' vertical banners), lit
          if (h >= 14 && w.len > 5 && R() < (dC < 180 ? 0.6 : 0.3) * bzK) {
            const BW = 1.8 + R() * 1.4, BH = Math.min(h - 6, 6 + R() * 8), t = w.len * (0.25 + R() * 0.5), x = w.x0 + w.tx * t, z = w.z0 + w.tz * t, sc = R.pick(SCHEMES);
            const face = dC < 220 ? { r: label(R.pick(POOL), { vertical: true, px: 64 }), fill: 0.86 } : { fake: 1, seed: R() * 100 };
            if (BH > 4) { signs.box(at(x + w.nx * 0.18, h - 1.0 - BH / 2, z + w.nz * 0.18, yawOf(w.nx, w.nz)), BW, BH, 0.3, { pz: face }, sc[0], sc[1], 1.5); this.stats.boards++; }
          }
          // a board of light high on a wall over a bigger street
          // (round the crossing nearly every wall to a street has its big boards, one over another, as the photographs show)
          let under = h - 0.8;
          for (let k = 0; k < (dC < 180 ? 2 : 1); k++)
          if (boards < (dC < 180 ? 4 : dC < 260 ? 3 : 2) && h >= 12 && w.len > 8 && R() < (dC < 180 ? (w.main ? 0.95 : 0.75) : (w.main ? 0.55 : 0.3) * bzK * (dC < 260 ? 1.6 : 1))) {
            const BW = Math.min(dC < 180 ? 16 : 14, Math.max(5, w.len * (0.45 + R() * 0.3))), BH = Math.min(9, Math.max(3.5, BW * (0.4 + R() * 0.3)));
            const top = under - (k ? 1.2 : R() * Math.max(0, h - BH - 10) * 0.4);
            if (top - BH < 5) continue;
            under = top - BH;
            const t = w.len * (0.3 + R() * 0.4), x = w.x0 + w.tx * t, z = w.z0 + w.tz * t, sc = R.pick(SCHEMES);
            const face = dC < 220 ? { r: label(R.pick(BOARD_WORDS), { px: 64, weight: 800 }), fill: 0.8 } : { fake: 2, seed: R() * 100 };
            signs.box(at(x + w.nx * 0.2, top - BH / 2, z + w.nz * 0.2, yawOf(w.nx, w.nz)), BW, BH, 0.35, { pz: face }, sc[0], sc[1], 1.5);
            boards++; this.stats.boards++;
          }
        }
        // a big board up on a steel frame on the roof, facing the main road
        const mw = onStreet.find(w => w.main) || (bzK > 0.9 ? onStreet[0] : null);
        if (mw && h >= 8 && h <= 45 && b.a >= 60 && b.a <= 1800 && mw.len > 6 && R() < (mw.main ? 0.32 : 0.16) * bzK) {
          const BW = Math.min(16, Math.max(6, mw.len * (0.55 + R() * 0.25))), BH = 3.5 + R() * 2.5, lift = 1.4 + R() * 1.2, inset = 1.2;
          const t = mw.len / 2, x = mw.x0 + mw.tx * t - mw.nx * inset, z = mw.z0 + mw.tz * t - mw.nz * inset, yaw = yawOf(mw.nx, mw.nz), sc = R.pick(SCHEMES);
          const face = dC < 220 ? { r: label(R.pick(BOARD_WORDS), { px: 64, weight: 800 }), fill: 0.78 } : { fake: 2, seed: R() * 100 };
          signs.box(at(x, h + lift + BH / 2, z, yaw), BW, BH, 0.4, { pz: face }, sc[0], sc[1], 1.35, '#2b2e35');
          // the frame behind it: posts, a rail, the braces back to the roof
          const nP = Math.max(2, Math.round(BW / 4)), bk = 2.2;
          for (let i = 0; i < nP; i++) {
            const s = (i / (nP - 1) - 0.5) * (BW - 0.6), px = x + mw.tx * s - mw.nx * 0.35, pz = z + mw.tz * s - mw.nz * 0.35;
            K.box('metal', 0.18, h + lift + BH - h, 0.18, at(px, h + (lift + BH) / 2, pz, yaw), '#5d636c');
            K.beam('metal', new THREE.Vector3(px, h + lift + BH * 0.7, pz), new THREE.Vector3(px - mw.nx * bk, h, pz - mw.nz * bk), 0.12, '#5d636c');
          }
          K.box('metal', BW, 0.16, 0.16, at(x - mw.nx * 0.35, h + lift - 0.1, z - mw.nz * 0.35, yaw), '#5d636c');
          this.stats.roofBoards++;
        }
      }
      // the roof's plant; over 60 m, the red aviation lights at its corners, blinking (Japan's rule: a building 60 m or
      // more is lit for aircraft)
      if ((b.minh || 0) < 0.5 && b.a >= 40) this.plant(K, pts, h, b.a, big, walls, R);
      if (h >= 60 && (b.minh || 0) < 3) {
        const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]), ex = [xs.indexOf(Math.min(...xs)), xs.indexOf(Math.max(...xs)), zs.indexOf(Math.min(...zs)), zs.indexOf(Math.max(...zs))];
        for (const i of new Set(h > 120 ? ex : ex.slice(0, 2))) this.red.add(pts[i][0], h + 1.1, pts[i][1], [1, 0.1, 0.05], 1.7, 2.6, 0.0, 1);
      }
    }
    for (const m of K.build()) this.group.add(m);
    this.group.add(this.red.build()); this.red = null;
    if (this.pads.length) this.group.add(padMesh(this.pads));
    // the plant in the roofs' own concrete (so at night it greys with them in the city's glow)
    if (this.plantGeos.length) { const pm = new THREE.Mesh(mergeGeometries(this.plantGeos), city.roof); pm.matrixAutoUpdate = false; pm.name = 'roof plant'; this.group.add(pm); this.plantGeos.forEach(g => g.dispose()); this.plantGeos = []; }
    this.streets(L, mask, fronts, R);
    this.ms = Math.round(performance.now() - t0);
  }

  // which way is street: white where a street is (red), where a main road is (green), black inside the buildings
  streetMask(L) {
    const [bx, bz, bw] = NEAR_BOX, W = bw, c = document.createElement('canvas'); c.width = c.height = W;
    const g = c.getContext('2d', { willReadFrequently: true }), P = ([x, z]) => [x - bx, z - bz];
    g.fillStyle = '#000'; g.fillRect(0, 0, W, W); g.lineCap = g.lineJoin = 'round'; g.globalCompositeOperation = 'lighter';
    this.ways = L.ways.filter(w => w.kind === 'hw' && STREET_W[w.type] && !w.tunnel && (w.layer || 0) >= 0 && !w.area && w.footway !== 'crossing');
    for (const w of this.ways) {
      const main = MAIN.has(w.type), wd = w.width || STREET_W[w.type];
      g.strokeStyle = main ? 'rgb(255,255,0)' : 'rgb(255,0,0)'; g.lineWidth = wd;
      g.beginPath(); w.pts.forEach((p, i) => { const [a, b] = P(p); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.stroke();
    }
    g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000';
    for (const b of L.buildings) { if (b.part || (b.minh || 0) > 3) continue; g.beginPath(); b.pts.forEach((p, i) => { const [a, bb] = P(p); i ? g.lineTo(a, bb) : g.moveTo(a, bb); }); g.closePath(); g.fill(); }
    return { W, d: g.getImageData(0, 0, W, W).data };
  }

  // a roof's plant: the lift's machine room, rows of air-conditioners' outdoor units, now and then a water tank; the
  // towers' big cooling plant
  plant(K0, pts, h, area, big, walls, R) {
    const K = { box: (_, w, hh, d, m, c) => this.plantPiece(new THREE.BoxGeometry(w, hh, d), m, c), cyl: (_, r0, r1, hh, m, c, seg) => this.plantPiece(new THREE.CylinderGeometry(r0, r1, hh, seg), m, c) };
    const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    const lw = walls.length ? walls.reduce((a, b) => (b.len > a.len ? b : a)) : null, yaw = lw ? Math.atan2(lw.tx, lw.tz) : 0;
    // the helicopters' place, painted (Tokyo's fire department asks it of every building over 31 m: a 10 m square marked
    // R where one can hover to lift people off, or a 20 m square marked H to land — H, over 100 m — in yellow paint,
    // its edge lined, the letter facing the way in); where the roof is big enough
    let pad = null;
    if (h >= 31 && (h >= 100 || R() < 0.75)) {
      const S = h >= 100 ? 20 : 10; let p = null;
      for (let k = 0; k < 40 && !p; k++) { const x = x0 + (0.3 + 0.4 * R()) * (x1 - x0), z = z0 + (0.3 + 0.4 * R()) * (z1 - z0); if (inPoly(pts, x, z) && edgeDist(pts, x, z) > S * 0.74) p = [x, z]; }
      if (p) { pad = { x: p[0], z: p[1], S, yaw, letter: S >= 20 ? 'H' : 'R', h }; this.pads.push(pad); }
    }
    const offPad = (x, z, m) => !pad || Math.max(Math.abs((x - pad.x) * Math.cos(pad.yaw) - (z - pad.z) * Math.sin(pad.yaw)), Math.abs((x - pad.x) * Math.sin(pad.yaw) + (z - pad.z) * Math.cos(pad.yaw))) > pad.S / 2 + m + 1;
    const spot = (m) => { for (let k = 0; k < 24; k++) { const x = x0 + R() * (x1 - x0), z = z0 + R() * (z1 - z0); if (inPoly(pts, x, z) && edgeDist(pts, x, z) > m && offPad(x, z, m)) return [x, z]; } return null; };
    const grey = () => R.pick(['#8f9399', '#9da1a7', '#878b91', '#a8acb1']);
    if (big) {
      for (let i = 0, nb = Math.min(6, 2 + Math.floor(area / 1500)); i < nb; i++) { const p = spot(5); if (!p) continue; const w = 5 + R() * 6, d = 4 + R() * 5, hh = 3 + R() * 3; K.box('solid', w, hh, d, at(p[0], h + hh / 2, p[1], yaw), grey()); this.stats.plant++; }
      return;
    }
    if (h >= 15 && area >= 100) { const p = spot(2.5); if (p) { const w = 3.2 + R() * 1.4, hh = 2.8 + R() * 0.7, d = 3.2 + R() * 1.4; K.box('solid', w, hh, d, at(p[0], h + hh / 2, p[1], yaw), grey()); this.stats.plant++; } }
    const rows = Math.max(1, Math.min(7, Math.round(area / 110)));
    for (let i = 0; i < rows; i++) {
      const p = spot(1.2); if (!p) continue; const n = 2 + Math.floor(R() * 4), L = n * 0.95;
      K.box('solid', L, 0.85, 0.42, at(p[0], h + 0.43, p[1], yaw + (R() < 0.5 ? 0 : Math.PI / 2)), '#b0b4b9'); this.stats.plant++;
    }
    if (h > 10 && R() < 0.25) { const p = spot(1.8); if (p) { const r = 0.9 + R() * 0.6, hh = 1.7 + R() * 0.8; K.cyl('solid', r, r, hh, at(p[0], h + 0.6 + hh / 2, p[1]), '#c3c6ca', 12); K.box('metal', r * 1.6, 0.6, r * 1.6, at(p[0], h + 0.3, p[1], yaw), '#6a6f77'); this.stats.plant++; } }
  }

  plantPiece(geo, m, c) {
    const g = geo.toNonIndexed(); geo.dispose(); g.deleteAttribute('uv'); g.applyMatrix4(m);
    const cc = col(c), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([cc.r, cc.g, cc.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); this.plantGeos.push(g);
  }
  // the streets out beyond the near ground: their lamps as points (as the far city's), and the light on them painted
  // for the far ground — the shopping streets white and bright with their shop fronts, the main roads orange
  streets(L, mask, fronts, R) {
    const out = (x, z) => Math.abs(x) > GROUND_HALF || Math.abs(z) > GROUND_HALF, far = (x, z) => Math.hypot(x, z) < 580;
    const LB = new LightBuffer(60000);
    for (const w of this.ways) {
      if (w.type === 'footway' || w.type === 'path' || w.type === 'service') continue;
      const shop = SHOPPING.has(w.name) || w.type === 'pedestrian', main = MAIN.has(w.type), wd = w.width || STREET_W[w.type];
      const gap = shop ? 9 : main ? 14 : 20, c = shop ? [1, 0.95, 0.88] : main ? (R() < 0.6 ? [1, 0.62, 0.3] : [1, 0.9, 0.78]) : [1, 0.86, 0.68];
      let acc = R() * gap;
      for (let i = 0; i < w.pts.length - 1; i++) {
        const [x0, z0] = w.pts[i], [x1, z1] = w.pts[i + 1], len = Math.hypot(x1 - x0, z1 - z0); if (len < 0.5) continue;
        const ux = (x1 - x0) / len, uz = (z1 - z0) / len;
        for (; acc < len; acc += gap) {
          const x = x0 + ux * acc, z = z0 + uz * acc; if (!out(x, z) || !far(x, z)) continue;
          for (const s of shop || main ? [-1, 1] : [R() < 0.5 ? -1 : 1]) { LB.add(x - uz * s * (wd / 2 + 0.4), w.bridge && (w.layer || 0) >= 1 ? 15.5 : shop ? 5.5 : 7.5, z + ux * s * (wd / 2 + 0.4), c, shop ? 1.3 : main ? 1.4 : 0.9, 2.2, 0.15 + R() * 0.1, 0); this.stats.lamps++; }
        }
        acc -= len;
      }
    }
    // the shop fronts: their light out across the pavement, as points along the walls' feet
    for (const w of fronts) for (let s = 1; s < w.len - 0.5; s += 3.2) {
      const x = w.x0 + w.tx * s + w.nx * 1.2, z = w.z0 + w.tz * s + w.nz * 1.2; if (!out(x, z) || !far(x, z) || R() < 0.25) continue;
      LB.add(x, 2.4, z, R() < 0.6 ? [1, 0.86, 0.66] : [0.92, 0.95, 1], 1.1, 2.6, 0.1 + R() * 0.2, 0); this.stats.lamps++;
    }
    this.points = LB.build(); this.group.add(this.points);
    // the glow on the ground, 2 m a pixel
    const [bx, bz, bw] = NEAR_BOX, S = 2, W = bw / S, c = document.createElement('canvas'); c.width = c.height = W;
    const g = c.getContext('2d'), P = ([x, z]) => [(x - bx) / S, (z - bz) / S];
    g.fillStyle = '#000'; g.fillRect(0, 0, W, W); g.lineCap = g.lineJoin = 'round'; g.globalCompositeOperation = 'lighten'; g.filter = 'blur(1px)';   // (the brightest, not the sum: parallel carriageways don't add up)
    const stroke = (pts, wd, col) => { g.strokeStyle = col; g.lineWidth = wd / S; g.beginPath(); pts.forEach((p, i) => { const [a, b] = P(p); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.stroke(); };
    for (const w of this.ways) {
      if (w.type === 'footway' || w.type === 'path' || (w.bridge && (w.layer || 0) >= 1)) continue;   // (not the expressway up on its viaduct)
      const shop = SHOPPING.has(w.name) || w.type === 'pedestrian', main = MAIN.has(w.type), wd = w.width || STREET_W[w.type];
      stroke(w.pts, wd, shop ? 'rgb(120,108,92)' : main ? 'rgb(72,42,20)' : 'rgb(46,37,28)');
    }
    for (const w of fronts) stroke([[w.x0 + w.nx * 1.6, w.z0 + w.nz * 1.6], [w.x1 + w.nx * 1.6, w.z1 + w.nz * 1.6]], 3.2, 'rgb(70,60,48)');
    g.filter = 'none'; g.globalCompositeOperation = 'source-over'; g.fillStyle = '#000';
    const [a, b] = P([-GROUND_HALF + 1, -GROUND_HALF + 1]); g.fillRect(a, b, (2 * GROUND_HALF - 2) / S, (2 * GROUND_HALF - 2) / S);   // (inside, the near ground draws its own)
    this.glowTex = new THREE.CanvasTexture(c); this.glowTex.colorSpace = THREE.NoColorSpace; this.glowTex.flipY = false;
  }
}

// the painted helicopter places: one flat quad each just over the roof, its picture drawn once — the square's yellow
// border, an inner line, the letter large in the middle (H or R); lit as the roof is, the paint a little luminous at
// night (the rule asks for luminous or bead paint)
function padMesh(pads) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  for (const [k, L] of [[0, 'H'], [1, 'R']]) {
    const ox = k * 256; g.clearRect(ox, 0, 256, 256);
    g.strokeStyle = '#ffd21f'; g.lineWidth = 10; g.strokeRect(ox + 8, 8, 240, 240); g.lineWidth = 3; g.strokeRect(ox + 26, 26, 204, 204);
    g.fillStyle = '#ffd21f'; g.font = '900 170px Helvetica Neue, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(L, ox + 128, 136);
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const P = [], UV = [];
  for (const p of pads) {
    const cs = Math.cos(p.yaw), sn = Math.sin(p.yaw), hS = p.S / 2, u0 = p.letter === 'H' ? 0 : 0.5;
    const corner = (a, b) => [p.x + a * cs + b * sn, p.h + 0.03, p.z - a * sn + b * cs];
    const q = [corner(-hS, hS), corner(hS, hS), corner(hS, -hS), corner(-hS, -hS)], t = [[u0, 1], [u0 + 0.5, 1], [u0 + 0.5, 0], [u0, 0]];
    for (const k of [0, 2, 1, 0, 3, 2]) { P.push(...q[k]); UV.push(...t[k]); }
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  const m = new THREE.ShaderMaterial({ name: 'heli pads', uniforms: { ...U, uTex: { value: tex } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2,
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${GLSL_COMMON} uniform sampler2D uTex; varying vec2 vUv; varying vec3 vW;
      void main(){ vec4 t = texture2D(uTex, vUv); if (t.a < 0.02) discard; float night = uLightsOn * (1.0 - uDay);
        vec3 c = t.rgb * 0.8 * toonLight(vec3(0.0, 1.0, 0.0), vW) * (1.0 - 0.4 * night) + t.rgb * night * vec3(0.22, 0.2, 0.12) * 1.2;
        gl_FragColor = vec4(fogIt(c, vW), t.a * 0.9); }` });
  const mesh = new THREE.Mesh(geo, m); mesh.matrixAutoUpdate = false; mesh.renderOrder = 3; mesh.userData.noInk = true; mesh.name = 'heli pads';
  return mesh;
}
