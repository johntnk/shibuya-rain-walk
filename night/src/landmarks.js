// The buildings that make the Scramble the Scramble, each made by hand on its real footprint (OpenStreetMap) after
// photographs of it: Q-FRONT's rounded glass front in its close silver fins, the big screen across it and the
// lattice crown with its name; the corner block across Center-gai hung with boards and screens; MAGNET's blue glass,
// its corner screen and drum; the station-front building's screens over Dōgenzaka; the station's low glass front
// on Hachikō square; the subway's glass stair-houses at the corners; and over them all Shibuya Scramble Square —
// 230 m, its podium crossed by lit diagonals, its tower in white fins, the open roof of SHIBUYA SKY and the white
// line of light round its crown. The adverts on the screens and the names on the boards are made up.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Kit, at } from './kit.js';
import { col } from './materials.js';
import { wallGeometry, roofGeometry, shopRainMesh } from './city.js';
import { SCHEMES, tenantName } from './signs.js';
import { rng } from './util.js';
import { konbiniSite, KB } from './konbini.js';
import { SKY, RUN, skyFrame } from './skystage.js';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
import { round, offset, along, nearest, yawOf } from './geom.js';


export class Landmarks {
  constructor(L, { facade, roof, atlas, signs, screens, light, glows }) {
    this.kit = new Kit(); this.walls = []; this.roofs = []; this.facade = facade; this.roofMat = roof; this.colliders = [];
    this.atlas = atlas; this.signs = signs; this.screens = screens; this.light = light; this.glows = glows; this.group = new THREE.Group();
    this.R = rng(4242);
    const by = n => L.buildings.find(b => b.name === n);
    this.qfront(by('Q-FRONT'));
    this.cornerBlock(L.buildings.find(b => b.id === 'w136690966'), L.buildings.find(b => b.id === 'w114755219'));
    this.magnet(by('MAGNET SHIBUYA'));
    this.ekimae(by('渋谷駅前ビル'));
    this.synchro7(L.buildings.find(b => b.id === 'w116806280'), L.buildings.find(b => b.id === 'w138670889'), L.buildings.find(b => b.id === 'w116806279'));
    this.station(by('渋谷'));
    this.scramble(by('渋谷スクランブルスクエア'));
    this.hut(L.buildings.filter(b => (b.h || 0) < 5 && (b.h || 0) > 4 && Math.hypot(b.c[0], b.c[1]) < 70 && b.a < 40));
    this.c109(by('Shibuya 109'));
    // the walls and roofs into the city's own materials, the rest in the kit's
    const wg = mergeGeometries(this.walls), rg = mergeGeometries(this.roofs);
    if (wg) this.group.add(Object.assign(new THREE.Mesh(wg, facade), { matrixAutoUpdate: false }));
    { const sr = shopRainMesh(this.walls); if (sr) this.group.add(sr); }   // (the rain on their shop windows)
    if (rg) this.group.add(Object.assign(new THREE.Mesh(rg, roof), { matrixAutoUpdate: false }));
    for (const m of this.kit.build()) this.group.add(m);
  }
  wall(pts, y0, y1, kind, seed, color) { this.walls.push(wallGeometry(pts, y0, y1, kind, seed, col(color))); }
  roof(pts, y, color = '#4a4e56') { this.roofs.push(roofGeometry(pts, y, col(color))); }
  label(text, opt = {}) { return this.atlas.add(text, opt); }
  // a board on a wall: centred at (x, y, z) on the wall whose outward normal is (nx, nz), w × h, standing out d
  board(x, y, z, nx, nz, w, h, text, scheme, { d = 0.35, em = 1.35, vertical = false, font = 'Hiragino Sans', weight = 800, fill = 0.8, housing = '#2b2e35' } = {}) {
    const r = text ? this.label(text, { vertical, font, weight, px: vertical ? 76 : 88 }) : null;
    const yaw = yawOf(nx, nz);
    this.signs.box(at(x + nx * d / 2, y, z + nz * d / 2, yaw), w, h, d, { pz: r ? { r, fill } : { lit: true } }, scheme[0], scheme[1], em, housing);
  }
  // a column of tenants' boxes, one a floor, standing out from the wall (seen from both ways along the street)
  column(x, z, nx, nz, y0, floors, fh, R, { w = 0.9, d = 2.0, gap = 0.12 } = {}) {
    const yaw = yawOf(nx, nz), tx = nz, tz = -nx;
    for (let i = 0; i < floors; i++) {
      const name = tenantName(R), r = this.label(name, { vertical: true, px: 64 }), sc = R.pick(SCHEMES), h = fh - gap;
      // the box sticks out from the wall: its long faces look along the street
      this.signs.box(at(x + nx * d / 2, y0 + i * fh + h / 2, z + nz * d / 2, yaw + Math.PI / 2), d, h, w, { pz: { r, fill: 0.86 }, nz: { r, fill: 0.86 }, px: { lit: true } }, sc[0], sc[1], 1.4);
    }
  }

  // ---------------------------------------------------------------- Q-FRONT
  qfront(b) {
    if (!b) return;
    const pts = round(b.pts, 2, 0.22), K = this.kit, top = 39.0, H = b.h || 45.9;
    this.colliders.push(pts);
    this.wall(pts, 0, top, 5, 101.5, '#3b4250');
    this.roof(offset(pts, -0.2), top, '#3a3d44');
    // the close silver fins all round, from the second floor up
    for (const p of along(pts, 1.05)) {
      K.box('metal', 0.12, top - 8.6, 0.42, at(p.x + p.nx * 0.2, 8.6 + (top - 8.6) / 2, p.z + p.nz * 0.2, yawOf(p.nx, p.nz)), '#c3c8d0');
    }
    // slab edges every floor, a thin band
    for (let y = 8.6; y < top; y += 5.05) for (const p of along(pts, 3.0)) K.box('metal', 3.05, 0.22, 0.16, at(p.x + p.nx * 0.08, y, p.z + p.nz * 0.08, yawOf(p.nx, p.nz)), '#8a909a');
    // the lattice crown: posts and rails round the roof, a grid you see the sky through, lit from below
    const crown = offset(pts, -0.4);
    for (const p of along(crown, 2.1)) K.box('metal', 0.18, H - top, 0.18, at(p.x, top + (H - top) / 2, p.z), '#d9dde3');
    for (const y of [top + 0.4, top + 2.6, top + 4.6, H - 0.15]) for (const p of along(crown, 1.0)) K.box('metal', 1.02, 0.14, 0.14, at(p.x, y, p.z, yawOf(p.nx, p.nz) + Math.PI / 2), '#d9dde3');
    for (const p of along(crown, 2.1)) K.beam('metal', V3(p.x - p.tx * 1.05, top + 0.4, p.z - p.tz * 1.05), V3(p.x + p.tx * 1.05, H - 0.15, p.z + p.tz * 1.05), 0.1, '#d9dde3');
    // its name on the crown's front, white letters lit
    const f = nearest(pts, -13.2, -30.0);
    this.board(f.x + f.nx * 0.5, top + 3.4, f.z + f.nz * 0.5, f.nx, f.nz, 12, 3.4, 'QFRONT', ['#12141a', '#f4f6ff'], { d: 0.2, em: 1.2, font: 'Helvetica Neue', weight: 700, fill: 0.92, housing: '#12141a' });
    // Q'S EYE across its front, curved with it: the main screen 12.8 × 7.32 m, the banner screen 12.8 × 5.18 m under it
    this.screens.add(this.group, { x: f.x + f.nx * 0.75, y: 28.3, z: f.z + f.nz * 0.75, nx: f.nx, nz: f.nz, w: 12.8, h: 7.32, curve: 26, kinds: ['fashion', 'music', 'drink', 'idol'], words: ['NEW SEASON', '秋冬コレクション', 'NEW SINGLE', '今夜、渋谷で'], channel: 0, bright: 1.15 });
    this.screens.add(this.group, { x: f.x + f.nx * 0.75, y: 21.7, z: f.z + f.nz * 0.75, nx: f.nx, nz: f.nz, w: 12.8, h: 5.18, curve: 26, kinds: ['news', 'drink', 'game'], words: ['NEWS', '19:42 渋谷', 'ICE SODA', 'PLAY'], channel: -1, bright: 1.1 });
    // the two shop floors under it: tall glass, steel crosses behind it, the bookshop's name up the corner, the café's
    for (const p of along(pts, 6.0)) {
      const a = V3(p.x + p.nx * 0.25 - p.tx * 3, 0.3, p.z + p.nz * 0.25 - p.tz * 3), c = V3(p.x + p.nx * 0.25 + p.tx * 3, 8.4, p.z + p.nz * 0.25 + p.tz * 3);
      K.beam('metal', a, c, 0.2, '#b8bec8'); K.beam('metal', V3(a.x, 8.4, a.z), V3(c.x, 0.3, c.z), 0.2, '#b8bec8');
    }
    const e = nearest(pts, -3.5, -36.0);
    this.board(e.x + e.nx * 0.2, 15, e.z + e.nz * 0.2, e.nx, e.nz, 1.6, 9.5, 'BOOKS', ['#0d1730', '#ffffff'], { vertical: true, font: 'Helvetica Neue', weight: 700 });
    this.board(f.x + f.nx * 0.6, 7.2, f.z + f.nz * 0.6, f.nx, f.nz, 9, 1.0, 'CAFÉ & BOOKS', ['#0b3d2a', '#e8fff2'], { d: 0.25, font: 'Helvetica Neue', weight: 600 });
    // its light on the plaza in front
    this.light.pool(f.x, f.z, f.nx, f.nz, 14, 18, 26, col('#ffe2bf', 0.9));
  }

  // ---------------------------------------------------------------- the corner block across Center-gai, and its neighbour on Dōgenzaka
  cornerBlock(a, b2) {
    const K = this.kit, R = rng(77);
    for (const b of [a, b2]) {
      if (!b) continue;
      const H = b.h || 24, pts = b.pts; this.colliders.push(pts);
      this.wall(pts, 0, H, 3, 202.5 + H, R.pick(['#9aa0aa', '#b8b2a8']));
      this.roof(pts, H, '#4a4d54');
      // a steel frame on the roof holding a great screen, the sign towers rising behind. On the second (8 storeys, its
      // 28 m face to the crossing) the シブハチヒットビジョン: 24.3 × 17.3 m, 420 m², 2014 — "on the roof of the 9-storey
      // building beside the Scramble, at the Hachikō exit", one big screen facing the crossing (which building exactly
      // the sources don't name: this is the one that fits)
      const f = b === a ? nearest(pts, -40, -27) : nearest(pts, -75, -36);
      const yaw = yawOf(f.nx, f.nz), tx = f.nz, tz = -f.nx;
      const W = b === a ? 16 : 24.3, Hb = b === a ? 10 : 17.3;
      for (const s of [-1, 1]) for (const k of [0, 1]) K.beam('metal', V3(f.x + tx * s * W / 2 - f.nx * k * 2, H, f.z + tz * s * W / 2 - f.nz * k * 2), V3(f.x + tx * s * W / 2 - f.nx * k * 2, H + Hb + 1, f.z + tz * s * W / 2 - f.nz * k * 2), 0.25, '#555a63');
      this.screens.add(this.group, { x: f.x - f.nx * 0.2, y: H + 1 + Hb / 2, z: f.z - f.nz * 0.2, nx: f.nx, nz: f.nz, w: W, h: Hb, kinds: b === a ? ['drink', 'news', 'game'] : ['idol', 'fashion', 'drink'], words: b === a ? ['冷たいのを、どうぞ', '19:42 渋谷 くもり 雨', 'NEON CITY', 'ICE SODA'] : ['新発売', '期間限定', 'TOKYO GIRLS', 'NEW'], channel: b === a ? 1 : 2 });
      // big boards on the face toward the crossing, one over another
      const n = Math.floor((H - 8) / 7);
      for (let i = 0; i < n; i++) {
        const sc = R.pick(SCHEMES), y = 7 + i * 7 + 3, w = Math.min(W, 10 + R() * 4);
        if (i === 1 && b === a) this.screens.add(this.group, { x: f.x + f.nx * 0.6, y, z: f.z + f.nz * 0.6, nx: f.nx, nz: f.nz, w: w, h: 5.8, kinds: ['music', 'fashion'], words: ['LIVE TOUR', 'ドーム公演決定', 'LIVE', '2026'], channel: -1 });
        else this.board(f.x, y, f.z, f.nx, f.nz, w, 5.6, R.pick(['大型書店', 'カラオケ', 'メガネ', 'ドラッグ', '居酒屋', '英会話', 'FOREVER', 'CARD']), sc, { d: 0.5, em: 1.4 });
      }
      // the tenants' columns up both corners of that face
      for (const s of [-1, 1]) this.column(f.x + tx * s * (W / 2 + 0.6), f.z + tz * s * (W / 2 + 0.6), f.nx, f.nz, 4.2, Math.floor((H - 4.2) / 3.4), 3.4, R);
      // a tall sign tower on the roof's back corner: a card company, white, its letters lit
      if (b === b2) {
        const bx = f.x - f.nx * 20 + tx * 8, bz = f.z - f.nz * 20 + tz * 8;
        K.block('metal', bx, H, bz, 0.6, 16, 0.6, '#555a63');
        this.signs.box(at(bx + f.nx * 0.5, H + 9 + 6, bz + f.nz * 0.5, yaw), 4.5, 12, 1.2, { pz: { r: this.label('SKY', { px: 110, weight: 800, font: 'Helvetica Neue' }), fill: 0.8 }, nz: { lit: true }, px: { lit: true }, nx: { lit: true } }, '#ffffff', '#1d3f9a', 1.0);
        this.signs.box(at(bx + f.nx * 0.5, H + 4, bz + f.nz * 0.5, yaw), 4.5, 3.5, 1.2, { pz: { r: this.label('CARD', { px: 110, weight: 800, font: 'Helvetica Neue' }), fill: 0.7 } }, '#1d3f9a', '#ffffff', 1.0);
      }
    }
  }

  // ---------------------------------------------------------------- MAGNET
  magnet(b) {
    if (!b) return;
    const K = this.kit, R = rng(91), H = b.h || 34.2, pts = b.pts; this.colliders.push(pts);
    this.wall(pts, 0, H, 6, 303.5, '#3d5a7a');
    this.roof(pts, H, '#41454c');
    // the corner toward the crossing: a tall screen, its name over it, and the drum beside it
    const c = nearest(pts, 23.7, -17.1), yaw = yawOf(c.nx, c.nz);
    // the 109 Forum Vision (30 × 15 m, put up in 2025), wrapped round its corner to the crossing
    this.screens.add(this.group, { x: c.x + c.nx * 0.9, y: 18.0, z: c.z + c.nz * 0.9, nx: c.nx, nz: c.nz, w: 30, h: 15, curve: 18, kinds: ['idol', 'fashion', 'game', 'music'], words: ['ステージ', 'NEW LOOK', 'ネオン', 'BEAT'], channel: 0, bright: 1.1 });
    this.board(c.x + c.nx * 0.4, 28.2, c.z + c.nz * 0.4, c.nx, c.nz, 9, 2.4, 'MAGNET', ['#14161c', '#ff3b5c'], { d: 0.3, font: 'Didot', weight: 700, fill: 0.92, housing: '#14161c' });
    const dx = 20.2 + 2.0, dz = -21.7 - 3.5;                          // the drum on the corner, an advert wrapped round it
    K.cyl('solid', 2.6, 2.6, 13, at(dx - 1.2, 6.5 + 4.5, dz + 0.5), '#e9e9ee', 28);
    this.signs.box(at(dx - 1.2 + c.nx * 2.2, 11, dz + 0.5 + c.nz * 2.2, yaw), 3.6, 11, 0.3, { pz: { r: this.label('Nº 9', { px: 120, font: 'Didot', weight: 400 }), fill: 0.5 } }, '#f4f2ec', '#111111', 0.9);
    // the long side up Jingū-dōri: boards one over another, a column of tenants
    const w = nearest(pts, 24, -40);
    for (let i = 0; i < 3; i++) this.board(w.x, 9 + i * 7.5, w.z, w.nx, w.nz, 7.5, 5.5, R.pick(['ローン', 'カラオケ', '天津甘栗', '眼科', 'ゲーム']), R.pick(SCHEMES), { d: 0.4 });
    this.column(w.x + w.tx * 6, w.z + w.tz * 6, w.nx, w.nz, 4.2, 8, 3.6, R);
    // the roof garden's railing, glass and lit
    for (const p of along(offset(pts, -0.3), 1.6)) K.box('glow', 1.6, 0.05, 0.05, at(p.x, H + 1.1, p.z, yawOf(p.nx, p.nz) + Math.PI / 2), col('#cfe6ff', 0.9));
    this.light.pool(c.x, c.z, c.nx, c.nz, 16, 12, 22, col('#d8e6ff', 0.6));
  }

  // ---------------------------------------------------------------- the station-front building on Dōgenzaka's corner
  ekimae(b) {
    if (!b) return;
    const R = rng(55), H = b.h || 35.1, pts = b.pts;
    // on its east face, the convenience store you can walk into (konbini.js): there the ground floor is the store's
    // own front, the building's wall starts over it, and the store's room is cut out of the building's solid
    const site = this.konbini = konbiniSite(pts), S0 = site.toW(0, 0), S1 = site.toW(KB.W, 0);
    this.colliders.push([...pts.slice(0, 4), S0, site.toW(0, KB.D), site.toW(KB.W, KB.D), S1, ...pts.slice(4)]);
    const wc = col('#c4bdb2');
    this.walls.push(wallGeometry(pts, 0, H, 3, 404.5, wc, i => i === 3));
    this.walls.push(wallGeometry([pts[3], pts[4]], 4.6, H, 3, 404.5, wc, i => i === 1));
    this.walls.push(wallGeometry([pts[3], S0], 0, 4.6, 3, 404.5, wc, i => i === 1), wallGeometry([S1, pts[4]], 0, 4.6, 3, 404.5, wc, i => i === 1));
    this.roof(pts, H, '#4d5057');
    const f = nearest(pts, -47, 13);                                  // its corner to the crossing: boards one over another
    for (let i = 0; i < 3; i++) this.board(f.x, 12 + i * 7.2, f.z, f.nx, f.nz, Math.min(11, 9 + i), 6.0, R.pick(['カラオケ', '英会話', 'メガネ', 'ドラッグ', '居酒屋']), R.pick(SCHEMES), { d: 0.5, em: 1.4 });
    // on its roof the 渋谷駅前ビジョン (about 20 × 16 m, 350 m², since 2019), turned to the crossing, on its steel frame
    { const L = Math.hypot(f.x, f.z), ux = -f.x / L, uz = -f.z / L, tx = uz, tz = -ux, cx = f.x - ux * 4 - tx * 3.5, cz = f.z - uz * 4 - tz * 3.5;
      this.screens.add(this.group, { x: cx, y: H + 1.2 + 8, z: cz, nx: ux, nz: uz, w: 20, h: 16, kinds: ['news', 'drink', 'fashion', 'idol'], words: ['ニュース', '雨のち くもり', 'SODA', 'NEW'], channel: 1, bright: 1.1 });
      for (const s of [-9, -3, 3, 9]) { const px = cx + tx * s - ux * 0.6, pz = cz + tz * s - uz * 0.6; this.kit.beam('metal', V3(px, H, pz), V3(px, H + 17.4, pz), 0.35, '#555a63'); this.kit.beam('metal', V3(px, H + 12, pz), V3(px - ux * 4, H, pz - uz * 4), 0.25, '#555a63'); } }
    const n = nearest(pts, -60, 7.4);                                  // the face up Dōgenzaka: boards and a column
    for (let i = 0; i < 3; i++) this.board(n.x - n.tx * 3, 10 + i * 7.5, n.z - n.tz * 3, n.nx, n.nz, 9, 5.5, R.pick(['銀行', 'ATM', '回転寿司', 'カフェ', '薬']), R.pick(SCHEMES), { d: 0.4 });
    this.column(n.x + n.tx * 4, n.z + n.tz * 4, n.nx, n.nz, 4.2, 8, 3.6, R);
  }

  // ---------------------------------------------------------------- across the tracks from Hachikō square, toward Miyamasuzaka
  // the シンクロ7シブヤヒットビジョン: seven screens on three buildings on the station's Miyamasuzaka side, looking west over
  // the tracks to Hachikō square (their sizes the sources don't give: these are fitted to the walls)
  synchro7(park, tower, fpg) {
    const K = this.kit, add = (f, y, w, h, kinds, words) => this.screens.add(this.group, { x: f.x + f.nx * 0.5, y, z: f.z + f.nz * 0.5, nx: f.nx, nz: f.nz, w, h, kinds, words, channel: -1, bright: 1.05 });
    if (tower) { const f = nearest(tower.pts, 80, -21); add(f, 30, 8.6, 11, ['drink', 'news', 'fashion'], ['SODA', 'NEWS', 'NEW', '期間限定']); add(f, 19, 8.6, 7, ['idol', 'game'], ['TOKYO', 'GIRLS', 'PLAY', 'NEW']); }
    if (park) {
      const H = park.h || 25.3, f = nearest(park.pts, 100, -27), f2 = nearest(park.pts, 101, -17);
      add({ x: f.x - f.nx * 1.0, z: f.z - f.nz * 1.0, nx: f.nx, nz: f.nz }, H + 1 + 4.5, 14, 9, ['music', 'idol', 'game'], ['LIVE', 'NEW SINGLE', 'GAME', 'TOUR']);
      for (const s of [-6, 0, 6]) K.beam('metal', V3(f.x - f.nx * 1.6, H, f.z + s), V3(f.x - f.nx * 1.6, H + 10.2, f.z + s), 0.3, '#555a63');
      add(f, 15, 11, 6.5, ['fashion', 'drink'], ['SALE', 'NEW SEASON', 'SODA', '期間限定']);
      add(f2, 13, 7.5, 9, ['news', 'idol'], ['NEWS', '天気', 'IDOL', '渋谷']);
    }
    if (fpg) { const f = nearest(fpg.pts, 118, -22); add(f, 34, 13, 6.5, ['game', 'fashion', 'music'], ['GAME', 'NEW', 'LIVE', 'PLAY']); add(f, 28.4, 13, 4.2, ['news', 'drink'], ['NEWS', 'SODA', '19:42', '渋谷']); }
  }

  // ---------------------------------------------------------------- the station on Hachikō square
  station(b) {
    if (!b) return;
    const K = this.kit, pts = b.pts, H = 11.8; this.colliders.push(pts);
    this.wall(pts, 0, H, 4, 505.5, '#d7dbe0');
    this.roof(pts, H, '#565a62');
    // on its roof toward the square, a long row of boards, and the station's name
    const f = nearest(pts, 41, 25);
    this.board(f.x + f.nx * 0.3, 9.6, f.z + f.nz * 0.3, f.nx, f.nz, 14, 1.8, '渋谷駅  ハチ公口', ['#f4f6fa', '#13294b'], { d: 0.3, font: 'Hiragino Sans', weight: 700 });
    const s = nearest(pts, 43, 45);
    this.screens.add(this.group, { x: s.x + s.nx * 0.5, y: H + 5, z: s.z + s.nz * 0.5, nx: s.nx, nz: s.nz, w: 16, h: 9, kinds: ['game', 'idol', 'news'], words: ['GAME', 'NEW', 'NEON CITY', 'PLAY'], channel: 2 });
    for (const k of [-1, 1]) K.beam('metal', V3(s.x + s.tx * k * 8, H, s.z + s.tz * k * 8), V3(s.x + s.tx * k * 8, H + 10, s.z + s.tz * k * 8), 0.3, '#555a63');
    this.light.pool(f.x, f.z, f.nx, f.nz, 12, 22, 30, col('#f2f6ff', 0.7));
  }

  // ---------------------------------------------------------------- Shibuya Scramble Square
  scramble(b) {
    if (!b) return;
    const K = this.kit, pts = b.pts, H = b.h || 229.7; this.colliders.push(pts);
    const pod = 52, crown = H - 18;
    this.wall(pts, 0, pod, 6, 606.5, '#4b5568');
    // the tower: set in from the podium, its faces in glass and white fins
    const tw = offset(pts, -4.0);
    this.wall(tw, pod, crown, 6, 607.5, '#55627a');
    this.roof(pts, pod, '#43474f');
    for (const p of along(tw, 1.5)) {
      const h0 = pod, h1 = crown, fin = 0.5 + 0.4 * Math.sin(p.x * 0.7 + p.z * 0.3);
      K.box('metal', 0.16, h1 - h0, fin, at(p.x + p.nx * fin / 2, (h0 + h1) / 2, p.z + p.nz * fin / 2, yawOf(p.nx, p.nz)), '#dfe3ea');
    }
    // the podium's diagonals: long lines of light crossing its faces
    for (const p of along(pts, 7.0)) {
      const a = V3(p.x + p.nx * 0.3 - p.tx * 3.5, 6, p.z + p.nz * 0.3 - p.tz * 3.5), c = V3(p.x + p.nx * 0.3 + p.tx * 3.5, pod - 4, p.z + p.nz * 0.3 + p.tz * 3.5);
      K.beam('glow', a, c, 0.35, col('#f4f8ff', 1.6));
    }
    // the crown: dark glass up to SHIBUYA SKY's deck (skystage.js builds the roof itself); on its west face, above the
    // run's floor, no wall: the run's own tall glass is the building's face there
    const F = skyFrame(pts), west = (i, x0, z0, x1, z1) => { const [u0, v0] = F.toL(x0, z0), [u1, v1] = F.toL(x1, z1); return Math.abs(v0) < 1.5 && Math.abs(v1) < 1.5; };
    this.wall(tw, crown, SKY.YLOW, 6, 608.5, '#2c3240');
    this.walls.push(wallGeometry(tw, SKY.YLOW, SKY.YDECK, 6, 609.5, col('#2c3240'), west));
    // (and the west face's two ends beyond the run: from its north corner to the run, from the run to its south corner)
    for (const [u0, u1] of [[-2.0, -0.25], [RUN.comb1 + 1.0, F.L + 0.01]]) {
      const p0 = F.toW(u0, -0.25), p1 = F.toW(u1, -0.25);
      this.walls.push(wallGeometry([p1, p0], SKY.YLOW, SKY.YDECK, 6, 610.5, col('#2c3240'), i => i === 1));
    }
    for (const p of along(tw, 1.0)) K.box('glow', 1.02, 0.2, 0.14, at(p.x + p.nx * 0.12, crown, p.z + p.nz * 0.12, yawOf(p.nx, p.nz)), col('#dfe9ff', 1.4));
    // the white line of light round its top edge (lit at night; at sunset a pale band)
    for (const p of along(tw, 1.0)) { const [u, v] = F.toL(p.x, p.z); if (Math.abs(v) < 1.5 && u > -1 && u < 22) continue; K.box('glow', 1.02, 0.22, 0.16, at(p.x + p.nx * 0.15, SKY.YDECK - 0.5, p.z + p.nz * 0.15, yawOf(p.nx, p.nz)), col('#ffffff', 2.0)); }
    // its LED walls behind the podium's windows (north face about 623 m², east face about 156 m² toward its north end,
    // their tops about 50 m up — the 2019 trial's figures): the window frames cross them dark
    { const nf = nearest(pts, 143, 85), ef = nearest(pts, 177, 104);
      this.screens.add(this.group, { x: nf.x + nf.nx * 0.5, y: 50.2 - 7.8, z: nf.z + nf.nz * 0.5, nx: nf.nx, nz: nf.nz, w: 40, h: 15.6, kinds: ['fashion', 'idol', 'music', 'drink'], words: ['SHIBUYA', 'NEW SEASON', 'LIVE', 'TOKYO'], channel: 3, bright: 1.05, frames: [1.6, 5.2] });
      this.screens.add(this.group, { x: ef.x + ef.nx * 0.5, y: 50.2 - 6.3, z: ef.z + ef.nz * 0.5, nx: ef.nx, nz: ef.nz, w: 12.5, h: 12.5, kinds: ['news', 'fashion', 'drink'], words: ['NEWS', 'NEW', 'SODA', '渋谷'], channel: -1, bright: 1.05, frames: [1.6, 5.2] }); }
    // its name low on the podium toward the crossing
    const f = nearest(pts, 112, 105);
    this.board(f.x, 36, f.z, f.nx, f.nz, 14, 2.2, 'SHIBUYA SCRAMBLE SQUARE', ['#1a1f2b', '#ffffff'], { d: 0.2, font: 'Helvetica Neue', weight: 500, fill: 0.95, housing: '#1a1f2b' });
    // red lights on its corners for the aircraft
    for (const p of tw.filter((_, i) => i % 3 === 0)) this.glows.push({ x: p[0], y: SKY.YDECK + 2.6, z: p[1], blink: true, size: 0.35 });
    this.scrambleTower = b;
  }

  // ---------------------------------------------------------------- the subway's stair-houses at the corners
  hut(list) {
    const K = this.kit;
    for (const b of list) {
      const pts = b.pts, H = 3.4; this.colliders.push(pts);
      // the glass box over the stairs, its roof, the line's sign
      for (const p of along(pts, 1.2)) K.box('metal', 0.08, H, 0.08, at(p.x, H / 2, p.z), '#b9c0c8');
      this.walls.push(wallGeometry(pts, 0.15, H, 5, 707.5 + b.c[0], col('#c8d0d8')));
      this.roof(pts, H, '#cfd4da');
      const e = pts.reduce((m, p, i) => { const q = pts[(i + 1) % pts.length], L = Math.hypot(q[0] - p[0], q[1] - p[1]); return L > m.L ? { L, i } : m; }, { L: 0, i: 0 });
      const p0 = pts[e.i], p1 = pts[(e.i + 1) % pts.length], L = e.L, nx = (p1[1] - p0[1]) / L, nz = -(p1[0] - p0[0]) / L;
      this.board((p0[0] + p1[0]) / 2, H + 0.45, (p0[1] + p1[1]) / 2, nx, nz, Math.min(L * 0.8, 4), 0.6, '地下鉄  渋谷駅', ['#123a7a', '#ffffff'], { d: 0.12, weight: 700 });
    }
  }

  // ---------------------------------------------------------------- SHIBUYA109's silver drum, down Dōgenzaka
  c109(b) {
    if (!b) return;
    const K = this.kit, H = b.h || 33.6; this.colliders.push(b.pts);
    this.wall(b.pts, 0, H - 8, 3, 809.5, '#c9ccd2'); this.roof(b.pts, H - 8);
    // the drum at the fork, taller, its name round the top
    const cx = -133.2, cz = -7.6, r = 4.4;
    K.cyl('metal', r, r, H + 6, at(cx, (H + 6) / 2, cz), '#d6dae0', 32);
    this.signs.box(at(cx + 3.2, H + 2.5, cz + 3.2, Math.PI * 0.25), 6.5, 3.2, 0.5, { pz: { r: this.label('109', { px: 130, font: 'Helvetica Neue', weight: 800 }), fill: 0.8 } }, '#111111', '#ff4fa0', 1.2);
    this.screens.add(this.group, { x: cx + 4.2, y: 16, z: cz + 3.4, nx: 0.78, nz: 0.62, w: 6, h: 14, kinds: ['fashion', 'idol'], words: ['SALE', 'NEW', 'GIRLS', '2026'], channel: -1 });
  }
}
