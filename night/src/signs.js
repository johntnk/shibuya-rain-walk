// The signs: what makes a Tokyo street a Tokyo street at night. Every word on them is drawn once into one big
// picture (the atlas) in the Mac's own Japanese faces — Hiragino's gothic, mincho and rounded — and each sign is a
// box whose faces read from it: the backlit columns of tenants up a building's corner (one floor, one name), the
// boards over shop fronts, the panels on roofs. Lit from inside, so they glow; their colours chosen as real ones
// are (white boards with red or blue letters, yellow with black, red with white), not random.
// The names are made up: generic words for what is on each floor (karaoke, izakaya, dentist…) and invented names.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { U, GLSL_COMMON, col } from './materials.js';

export class Atlas {
  constructor(size = 4096) {
    this.size = size; this.c = document.createElement('canvas'); this.c.width = this.c.height = size;
    this.g = this.c.getContext('2d'); this.cache = new Map();
    this.g.clearRect(0, 0, size, size); this.blank = { u0: 0.5 / size, v0: 0.5 / size, u1: 1.5 / size, v1: 1.5 / size };
    // two packings: vertical words in columns down the left part, horizontal words in rows across the rest
    this.split = Math.round(size * 0.4);
    this.col = { x: 4, y: 4, w: 0 }; this.row = { x: this.split + 4, y: 4, h: 0 };
  }
  // words into the atlas: white on clear; vertical stacks the characters one under the other
  add(text, { font = 'Hiragino Sans', weight = 700, px = 80, vertical = false, pad = 10, spacing = 0.04 } = {}) {
    const key = [text, font, weight, px, vertical].join('|'); if (this.cache.has(key)) return this.cache.get(key);
    const g = this.g; g.font = `${weight} ${px}px "${font}"`;
    const chars = [...text];
    let w, h, x0, y0;
    if (vertical) {
      w = Math.ceil(px * 1.1) + pad * 2; h = Math.ceil(chars.length * px * (1 + spacing)) + pad * 2;
      const C = this.col; if (C.y + h > this.size) { C.x += C.w + 4; C.y = 4; C.w = 0; }
      if (C.x + w > this.split) { this.dropped = (this.dropped || 0) + 1; console.warn('atlas full (vertical)', text); return this.blank; }
      x0 = C.x; y0 = C.y; C.y += h + 4; C.w = Math.max(C.w, w);
    } else {
      w = Math.ceil(g.measureText(text).width) + pad * 2; h = Math.ceil(px * 1.25) + pad * 2;
      const Rw = this.row; if (Rw.x + w > this.size) { Rw.x = this.split + 4; Rw.y += Rw.h + 4; Rw.h = 0; }
      if (Rw.y + h > this.size) { this.dropped = (this.dropped || 0) + 1; console.warn('atlas full', text); return this.blank; }
      x0 = Rw.x; y0 = Rw.y; Rw.x += w + 4; Rw.h = Math.max(Rw.h, h);
    }
    g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.textAlign = 'center';
    if (vertical) chars.forEach((ch, i) => {
      const cy = y0 + pad + (i + 0.5) * px * (1 + spacing);
      if (/[ー〜～]/.test(ch)) { g.save(); g.translate(x0 + w / 2, cy); g.rotate(Math.PI / 2); g.fillText(ch, 0, 0); g.restore(); }   // (the long vowel mark turns in vertical writing)
      else g.fillText(ch, x0 + w / 2, cy);
    });
    else g.fillText(text, x0 + w / 2, y0 + h / 2 + px * 0.04);
    const r = { u0: x0 / this.size, v0: y0 / this.size, u1: (x0 + w) / this.size, v1: (y0 + h) / this.size, aspect: w / h };
    this.cache.set(key, r); return r;
  }
  texture() {
    if (this.tex) { this.tex.needsUpdate = true; return this.tex; }
    const t = this.tex = new THREE.CanvasTexture(this.c); t.flipY = false; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.colorSpace = THREE.NoColorSpace;
    return t;
  }
}

// the colours real signs come in: [board, letters]
export const SCHEMES = [
  ['#f4f2ec', '#d0182a'], ['#f4f2ec', '#1d3f9a'], ['#f4f2ec', '#111111'], ['#ffd400', '#111111'], ['#d8141f', '#ffffff'], ['#16326e', '#ffffff'],
  ['#111111', '#ffd34a'], ['#111111', '#ffffff'], ['#0f7a3a', '#ffffff'], ['#f08a00', '#ffffff'], ['#ffffff', '#e4007f'], ['#2a2a2a', '#7fe8ff'],
  ['#ff4fa0', '#ffffff'], ['#6a1fa0', '#ffffff'], ['#f4f2ec', '#0f7a3a'], ['#ffe9a8', '#7a2a10'],
];
const TENANTS = ['カラオケ', '居酒屋', '焼肉', 'ラーメン', '寿司', '焼鳥', 'もつ鍋', '中華料理', '餃子', '天ぷら', 'そば', 'カフェ', '喫茶', 'BAR', 'ダイニング', '英会話', '歯科', 'クリニック',
  '美容室', 'ネイル', '整体', '眼科', '皮膚科', '不動産', '薬', 'メガネ', '古着', '漫画喫茶', 'ネットカフェ', 'ダーツ', 'ビリヤード', '麻雀', '占い', '学習塾', '両替', 'ホテル', 'ライブハウス', '牛タン', 'しゃぶしゃぶ', 'ステーキ', 'イタリアン', 'タイ料理', '韓国料理', '串カツ', 'おでん', '回転寿司'];
const NAMES = ['月見', 'さくら', '大黒', '和楽', '鳥一', '龍門', '一番', '夜空', '星野', '道玄', '宇田川', '桜丘', '松風', '花月', '銀河', '朝日', '鈴蘭', '白樺', '紅葉', '霧島', '千歳', '若葉', '青葉', '金星', '虹', '雅', '翠', '凛', '灯',
  'KIRA', 'LUNA', 'MIYABI', 'AOI', 'HANA', 'SORA', 'RIN', 'NOA', 'TOKI', 'YUZU', 'MOMO', 'NEON', 'STAR', 'BLUE', 'ROSE', 'JAZZ', 'POP', 'RED', 'GOLD'];
export function tenantName(R) { const t = R.pick(TENANTS), n = R.pick(NAMES); return R() < 0.5 ? t + n : n + t; }
export function tenantWord(R) { return R.pick(TENANTS); }
export function nameWord(R) { return R.pick(NAMES); }

// the sign boxes: each face its words (an atlas rectangle, or none), a board colour, a letter colour, how lit
export class SignKit {
  constructor(atlas) { this.atlas = atlas; this.geos = []; }
  // a box w × h × d at matrix; faces: { px, nx, pz, nz, py, ny } (+x, -x, +z, -z …) each { r, fill } or omitted,
  // or { lit: true } (the board lit, no words), or, for the signs too far off to read, words made up in the shader:
  // { fake: 1 } a vertical word, { fake: 2 } a horizontal one, { fake: 3, n } a column of n tenants' panels one over
  // the other, each its own colours (the real signs' schemes) and word; { seed } varies them
  box(matrix, w, h, d, faces, bg, fg, em = 1.0, housing = '#30343c') {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(), n = g.attributes.position.count;
    const uv = g.attributes.uv, B = new Float32Array(n * 3), F = new Float32Array(n * 3), EM = new Float32Array(n), UVo = new Float32Array(n * 2);
    const bgc = col(bg), fgc = col(fg), hc = col(housing);
    const order = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];               // (BoxGeometry's faces, 6 vertices each once unindexed)
    for (let f = 0; f < 6; f++) {
      const face = faces[order[f]], r = face?.r || null, fill = face?.fill ?? 0.82, aspectFace = f < 2 ? d / h : f < 4 ? w / d : w / h;
      for (let k = 0; k < 6; k++) {
        const i = f * 6 + k; let u = uv.getX(i), v = 1 - uv.getY(i);
        if (face?.fake) { UVo[i * 2] = u; UVo[i * 2 + 1] = v; }
        else if (r) {
          // the words fitted inside the face, kept to their own shape
          const ra = r.aspect, fa = aspectFace; let su = fill, sv = fill; if (ra > fa) sv = fill * fa / ra; else su = fill * ra / fa;
          u = (u - 0.5) / su + 0.5; v = (v - 0.5) / sv + 0.5;
          const inside = u >= 0 && u <= 1 && v >= 0 && v <= 1;
          UVo[i * 2] = r.u0 + (r.u1 - r.u0) * u; UVo[i * 2 + 1] = r.v0 + (r.v1 - r.v0) * v;
          if (!inside) { /* clamped below in the shader by the rectangle */ }
        } else { UVo[i * 2] = -1; UVo[i * 2 + 1] = -1; }
        const lit = r || face?.lit || face?.fake;
        const c = lit ? bgc : hc; B.set([c.r, c.g, c.b], i * 3); F.set([fgc.r, fgc.g, fgc.b], i * 3); EM[i] = lit ? em : 0;
      }
    }
    g.deleteAttribute('uv');
    g.setAttribute('aUv', new THREE.BufferAttribute(UVo, 2)); g.setAttribute('aBg', new THREE.BufferAttribute(B, 3)); g.setAttribute('aFg', new THREE.BufferAttribute(F, 3)); g.setAttribute('aEm', new THREE.BufferAttribute(EM, 1));
    // each face's rectangle in the atlas, so the shader can tell words from the board round them
    const RR = new Float32Array(n * 4);
    for (let f = 0; f < 6; f++) { const fc = faces[order[f]], r = fc?.r; for (let k = 0; k < 6; k++) RR.set(fc?.fake ? [-1 - fc.fake, fc.n || 1, fc.seed ?? Math.random() * 100, 0] : r ? [r.u0, r.v0, r.u1, r.v1] : [0, 0, 0, 0], (f * 6 + k) * 4); }
    g.setAttribute('aRect', new THREE.BufferAttribute(RR, 4));
    g.applyMatrix4(matrix);
    this.geos.push(g);
  }
  build() {
    if (!this.geos.length) return null;
    const g = mergeGeometries(this.geos); this.geos.length = 0;
    const m = new THREE.Mesh(g, signMaterial(this.atlas.texture())); m.matrixAutoUpdate = false; m.name = 'signs';
    return m;
  }
}

// the schemes as the shader has them (for the columns of panels it colours itself)
const SCHEME_GLSL = (() => {
  const v = c => `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
  let s = 'void scheme(float i, out vec3 bg, out vec3 fg){ ';
  SCHEMES.forEach(([b, f], k) => { s += `${k ? 'else ' : ''}if (i < ${k + 0.5}) { bg = ${v(col(b))}; fg = ${v(col(f))}; } `; });
  return s + '}';
})();
const FAKE_GLSL = /* glsl */`
  // a word too far off to read: a few characters' worth of strokes (3 × 3 cells each), along p.y
  float fakeWord(vec2 p, float n, float seed){
    float m = 0.14; if (p.x < m || p.x > 1.0 - m || p.y < 0.07 || p.y > 0.93) return 0.0;
    vec2 c = vec2((p.x - m) / (1.0 - 2.0 * m), (p.y - 0.07) / 0.86 * n);
    float ci = floor(c.y); vec2 f = vec2(c.x, fract(c.y)); if (f.y < 0.08 || f.y > 0.92) return 0.0;
    vec2 g = floor(vec2(f.x, (f.y - 0.08) / 0.84) * 3.0);
    return step(0.42, hash12(g + vec2(ci * 7.3, ci * 1.9) + seed * 13.1));
  }`;

function signMaterial(tex) {
  return new THREE.ShaderMaterial({
    name: 'signs', uniforms: { ...U, uAtlas: { value: tex } },
    vertexShader: `attribute vec2 aUv; attribute vec3 aBg, aFg; attribute float aEm; attribute vec4 aRect;
      varying vec2 vUv; varying vec3 vBg, vFg, vN, vW; varying float vEm; varying vec4 vRect;
      void main(){ vUv = aUv; vBg = aBg; vFg = aFg; vEm = aEm; vRect = aRect; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${GLSL_COMMON} ${SCHEME_GLSL} ${FAKE_GLSL} uniform sampler2D uAtlas; varying vec2 vUv; varying vec3 vBg, vFg, vN, vW; varying float vEm; varying vec4 vRect;
      void main(){
        float a = 0.0; vec3 bg = vBg, fg = vFg;
        if (vRect.x < -3.5) {                                          // a column of tenants' panels
          float n = vRect.y, pi = floor(vUv.y * n), fv = fract(vUv.y * n), sd = vRect.z + pi * 3.7;
          scheme(floor(hash12(vec2(sd, 2.1)) * ${SCHEMES.length}.0), bg, fg);
          a = fakeWord(vec2(vUv.x, fv), 2.0 + floor(hash12(vec2(sd, 5.3)) * 3.0), sd);
          if (fv < 0.035 || fv > 0.965) { bg = vec3(0.03); fg = bg; }
        }
        else if (vRect.x < -2.5) a = fakeWord(vUv.yx, 3.0 + floor(hash12(vec2(vRect.z, 4.0)) * 5.0), vRect.z);
        else if (vRect.x < -1.5) a = fakeWord(vUv, 3.0 + floor(hash12(vec2(vRect.z, 4.0)) * 3.0), vRect.z);
        else if (vRect.z > 0.0 && vUv.x >= vRect.x && vUv.y >= vRect.y && vUv.x <= vRect.z && vUv.y <= vRect.w) a = texture2D(uAtlas, vUv).a;
        vec3 c = mix(bg, fg, a), n = normalize(vN);
        vec3 lit = cleanColour(c) * toonLight(n, vW);
        // lit from inside: the board glows, a little brighter in the middle (the tubes behind it), the letters with it
        vec3 glow = c * (1.15 + 0.45 * a) * vEm;
        gl_FragColor = vec4(fogIt(mix(lit, glow, clamp(vEm, 0.0, 1.0)), vW), 1.0);
      }`,
  });
}
