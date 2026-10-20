// The goods' packaging: one picture of 16 × 16 package fronts, drawn once in the Mac's Japanese faces, the kinds a
// Tokyo convenience store's shelves are full of — snack bags and boxes (a picture of what is inside on a coloured
// ground, the name big, a band, a little line of small print), cup noodles, the bottles' labels (a band of
// colour round the middle, the name down it, the cap colour at the top), cans (all colour, the name across), the
// magazines' covers (the title across the top, a face, the lines of headlines), the cigarettes (white, a band of
// colour, a small name). The names are generic words (お茶, うすしお, カレー…) and made-up ones: no real brand.
//   PACK.wide 0–127 · tall 128–175 · can 176–207 · mag 208–231 · cig 232–255
// PackBatch: boxes whose one face (the front) shows a tile of it, the other faces its ground colour.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from './util.js';

export const PACK = { N: 16, wide: [0, 128], tall: [128, 48], can: [176, 32], mag: [208, 24], cig: [232, 24] };
const SNACK = ['ポテトチップス', 'うすしお', 'コンソメ', 'のりしお', 'チョコ', 'ビスケット', 'クッキー', 'グミ', 'のど飴', 'せんべい', 'おかき', 'ポップコーン', 'ラムネ', 'キャラメル', 'わさび', 'チーズ', 'えびせん', 'やきとり', 'からあげ味', 'いちご', '抹茶', 'ミルク', 'ナッツ', 'ドーナツ', 'カップ麺', 'しょうゆ', 'シーフード', 'カレー', 'とんこつ', 'みそ', 'うどん', 'そば', '焼きそば', 'パン', 'メロンパン', 'おにぎり', 'ツナマヨ', '鮭', '梅', 'サンド', 'プリン', 'ヨーグルト', 'アイス', 'ガム', 'ティッシュ', '電池', '歯みがき', 'マスク'];
const MADE = ['KARI', 'POTE', 'SAKU', 'MOGU', 'HONO', 'TOKO', 'NIKO', 'PARI', 'FUWA', 'KORI', 'MIRU', 'YUME', 'HOSHI', 'SORA', 'MARU', 'KIRA'];
const DRINK = ['お茶', '緑茶', 'ほうじ茶', '麦茶', '天然水', 'コーラ', 'サイダー', 'オレンジ', 'りんご', 'カフェラテ', 'ブラック', '微糖', '炭酸水', 'スポーツ', 'ミルクティー', 'レモン', 'ぶどう', 'ジャスミン', '烏龍茶', 'エナジー'];
const MAG = ['週刊 東京', 'TOKYO WALK', '月刊グルメ', 'まんが', 'STYLE', 'GIRLS', 'CAR', 'ゲーム', '旅', 'MUSIC', 'NEWS', 'HOME'];
const FOOD = ['#e8b860', '#d98a3a', '#7a4a2a', '#f1d7a0', '#c9433a', '#f4c94a', '#9ac454', '#e86f8a', '#f2e6c8', '#a35a32', '#6a3a20', '#f0a040'];
const BG = ['#d0262f', '#1f62b0', '#f2c400', '#2f9a55', '#f08a1c', '#7a3ab0', '#e8327a', '#111418', '#f4f2ec', '#f4f2ec', '#1aa6c8', '#c8102e', '#3a3a8a', '#8ac43a', '#f4f2ec', '#5a2a1a'];

export function makePackAtlas(px = 128) {
  const N = PACK.N, c = document.createElement('canvas'); c.width = c.height = N * px;
  const g = c.getContext('2d'), R = rng(7171), tileC = [];
  const font = (w, s, f = 'Hiragino Sans') => `${w} ${s}px "${f}"`;
  const fit = (t, maxW, w, s, f) => { let z = s; g.font = font(w, z, f); while (g.measureText(t).width > maxW && z > 8) { z -= 2; g.font = font(w, z, f); } return z; };
  const lines = (x, y, w, n, col, h = 3) => { g.fillStyle = col; for (let i = 0; i < n; i++) g.fillRect(x, y + i * (h + 3), w * (0.55 + 0.45 * R()), h); };
  for (let k = 0; k < N * N; k++) {
    const x0 = (k % N) * px, y0 = Math.floor(k / N) * px, kind = k < 128 ? 'wide' : k < 176 ? 'tall' : k < 208 ? 'can' : k < 232 ? 'mag' : 'cig';
    g.save(); g.beginPath(); g.rect(x0, y0, px, px); g.clip(); g.translate(x0, y0);
    const bg = R.pick(BG), dark = ['#111418', '#1f62b0', '#3a3a8a', '#5a2a1a', '#7a3ab0', '#c8102e', '#d0262f', '#2f9a55'].includes(bg), fg = dark ? '#ffffff' : R() < 0.5 ? '#d0262f' : '#111418';
    let ground = bg;
    if (kind === 'wide') {
      // a bag or box: the ground, a band across, the picture of what is inside, the name big, small print
      g.fillStyle = bg; g.fillRect(0, 0, px, px);
      const band = R.pick(BG.filter(b => b !== bg)); g.fillStyle = band;
      if (R() < 0.5) { g.beginPath(); g.moveTo(0, px * 0.62); g.lineTo(px, px * 0.48); g.lineTo(px, px * 0.66); g.lineTo(0, px * 0.8); g.fill(); } else g.fillRect(0, px * 0.72, px, px * 0.1);
      const fc = R.pick(FOOD), cx = px * (0.55 + 0.2 * R()), cy = px * 0.55, r = px * (0.2 + 0.08 * R());
      for (let i = 0; i < 5; i++) { const gr = g.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 1, cx, cy, r); gr.addColorStop(0, '#fff6e0'); gr.addColorStop(0.35, fc); gr.addColorStop(1, '#3a2010'); g.fillStyle = gr; g.beginPath(); g.ellipse(cx + (i - 2) * r * 0.35, cy + (i % 2) * r * 0.2, r * 0.7, r * 0.55, 0.3 * i, 0, 7); g.fill(); }
      const name = R.pick(SNACK), mk = R.pick(MADE);
      g.fillStyle = fg; g.textBaseline = 'top'; g.textAlign = 'left';
      fit(mk, px * 0.5, 800, px * 0.13, 'Helvetica Neue'); g.fillText(mk, px * 0.07, px * 0.06);
      const s = fit(name, px * 0.9, 800, px * 0.2); g.lineWidth = s * 0.16; g.strokeStyle = dark ? '#000000' : '#ffffff'; g.strokeText(name, px * 0.06, px * 0.22); g.fillText(name, px * 0.06, px * 0.22);
      lines(px * 0.07, px * 0.86, px * 0.4, 2, dark ? '#ffffffaa' : '#00000088', 3);
      if (R() < 0.5) { g.fillStyle = '#f2c400'; g.beginPath(); g.arc(px * 0.82, px * 0.18, px * 0.1, 0, 7); g.fill(); g.fillStyle = '#d0262f'; g.font = font(800, px * 0.08); g.textAlign = 'center'; g.fillText('NEW', px * 0.82, px * 0.145); }
    } else if (kind === 'tall') {
      // a bottle seen whole: clear or tinted, the cap at the top, the label round the middle with the name down it
      const liquid = R.pick(['#c9dfa0', '#e8d9a0', '#d8eef8', '#3a1a10', '#f2a040', '#e8e0d0', '#9ad0f0', '#c83a3a', '#f4f0e8', '#a0c870']);
      g.fillStyle = liquid; g.fillRect(0, 0, px, px);
      g.fillStyle = '#ffffff55'; g.fillRect(px * 0.12, 0, px * 0.12, px);                          // (the shine down it)
      g.fillStyle = R.pick(['#ffffff', '#2f9a55', '#d0262f', '#1f62b0', '#f2c400']); g.fillRect(0, 0, px, px * 0.12);   // (the cap)
      const lab = R.pick(BG); g.fillStyle = lab; g.fillRect(0, px * 0.34, px, px * 0.4);
      const ld = ['#111418', '#1f62b0', '#3a3a8a', '#5a2a1a', '#7a3ab0', '#c8102e', '#d0262f', '#2f9a55'].includes(lab);
      const name = R.pick(DRINK); g.fillStyle = ld ? '#ffffff' : '#111418'; g.textAlign = 'center'; g.textBaseline = 'middle';
      // (the name across the label: the tile is squeezed thin onto the bottle, so it's drawn wide)
      fit(name, px * 0.95, 800, px * 0.3); g.fillText(name, px / 2, px * 0.52);
      lines(px * 0.15, px * 0.66, px * 0.7, 1, ld ? '#ffffffaa' : '#00000088', 3);
      ground = lab;
    } else if (kind === 'can') {
      g.fillStyle = bg; g.fillRect(0, 0, px, px);
      g.fillStyle = '#c8ccd2'; g.fillRect(0, 0, px, px * 0.08); g.fillRect(0, px * 0.92, px, px * 0.08);   // (the rims)
      g.fillStyle = dark ? '#ffffff33' : '#00000022'; g.beginPath(); g.arc(px * 0.5, px * 0.5, px * 0.3, 0, 7); g.fill();
      const name = R.pick(DRINK); g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
      fit(name, px * 0.95, 900, px * 0.32); g.fillText(name, px / 2, px * 0.5);
      fit('ZERO', px * 0.6, 700, px * 0.12, 'Helvetica Neue'); if (R() < 0.4) g.fillText('ZERO', px / 2, px * 0.78);
    } else if (kind === 'mag') {
      // a cover: a face, the title across the top, the headlines down the side
      g.fillStyle = R.pick(['#f4e0d8', '#d8e8f4', '#f4f0d0', '#e0d0f0', '#2a2a30']); g.fillRect(0, 0, px, px);
      g.fillStyle = '#f0c8a8'; g.beginPath(); g.ellipse(px * 0.58, px * 0.55, px * 0.18, px * 0.22, 0, 0, 7); g.fill();
      g.fillStyle = R.pick(['#2a1a10', '#6a3a20', '#d0a060', '#1a1a1a']); g.beginPath(); g.ellipse(px * 0.58, px * 0.42, px * 0.24, px * 0.2, 0, Math.PI, 0); g.fill(); g.fillRect(px * 0.34, px * 0.42, px * 0.08, px * 0.35); g.fillRect(px * 0.74, px * 0.42, px * 0.08, px * 0.35);
      g.fillStyle = R.pick(['#e8327a', '#1f62b0', '#d0262f', '#111418', '#f08a1c']); g.fillRect(0, px * 0.82, px, px * 0.18);
      g.fillStyle = R.pick(['#d0262f', '#ffffff', '#111418', '#1f62b0']); g.textAlign = 'left'; g.textBaseline = 'top';
      const t = R.pick(MAG); fit(t, px * 0.92, 900, px * 0.2, R() < 0.5 ? 'Didot' : 'Hiragino Sans'); g.fillText(t, px * 0.04, px * 0.03);
      lines(px * 0.04, px * 0.32, px * 0.28, 5, '#d0262f', 4);
      ground = '#f4f2ec';
    } else {
      // cigarettes: a white pack, a band of colour, a small name, the warning panel at the foot
      g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, px, px);
      const band = R.pick(['#c8102e', '#1f62b0', '#2f9a55', '#7a3ab0', '#f2c400', '#111418', '#c8a050']); g.fillStyle = band; g.fillRect(0, px * 0.18, px, px * 0.28);
      g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; const nm = R.pick(MADE); fit(nm, px * 0.85, 700, px * 0.18, 'Helvetica Neue'); g.fillText(nm, px / 2, px * 0.32);
      g.fillStyle = '#111418'; g.fillRect(px * 0.1, px * 0.66, px * 0.8, px * 0.22); g.fillStyle = '#f2f2ee'; g.fillRect(px * 0.14, px * 0.7, px * 0.72, px * 0.14);
      ground = '#f2f2ee';
    }
    g.restore();
    tileC.push(new THREE.Color(ground));
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  return { tex, canvas: c, tileC };
}
export const pickTile = (R, kind) => { const [a, n] = PACK[kind]; return a + Math.floor(R() * n); };

// boxes with their front face printed: add(matrix, w, h, d, front (0 +x, 1 −x, 2 +y, 3 −y, 4 +z, 5 −z), tile, colour)
export class PackBatch {
  constructor() { this.geos = []; }
  add(matrix, w, h, d, front, tile, colour) {
    const g = new THREE.BoxGeometry(w, h, d), n = g.attributes.position.count, T = new Float32Array(n).fill(-1), C = new Float32Array(n * 3);
    for (let i = front * 4; i < front * 4 + 4; i++) T[i] = tile;
    for (let i = 0; i < n; i++) C.set([colour.r, colour.g, colour.b], i * 3);
    g.setAttribute('aTile', new THREE.BufferAttribute(T, 1)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.applyMatrix4(matrix); this.geos.push(g);
  }
  build(material) { if (!this.geos.length) return null; const m = new THREE.Mesh(mergeGeometries(this.geos), material); this.geos.forEach(g => g.dispose()); this.geos = []; m.matrixAutoUpdate = false; m.name = 'packs'; return m; }
}
