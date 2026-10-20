// The big screens over the crossing, each running its own (made-up) adverts — a fashion house's new season, a
// band's new single, a cold drink, the news and the weather — cut together, changing every few seconds as the
// real ones do; their glow drawn out in the wet road below and their changing colour cast onto the street round
// them (four of them each paint a pool of the light map's screen picture, coloured each frame by what they show).
import * as THREE from 'three';
import { U, col } from './materials.js';

const PROGRAMS = { fashion: 0, music: 1, drink: 2, news: 3, idol: 4, game: 5 };

const SCREEN_GLSL = /* glsl */`
  uniform sampler2D uAtlas; uniform float uTime, uSeed, uProg, uBright; uniform vec4 uW0, uW1, uW2, uW3; uniform vec2 uAspect;
  varying vec2 vUv; varying vec3 vW;
  float h1(float x){ return fract(sin(x * 127.1) * 43758.5453); }
  float word(vec4 r, vec2 p, vec2 c, float hgt){                      // a word from the atlas placed centred at c, hgt of the screen tall
    if (r.z <= r.x) return 0.0;
    float ra = (r.z - r.x) / (r.w - r.y), A = uAspect.x / uAspect.y;
    vec2 q = (p - c) / vec2(hgt * ra / A, hgt) + 0.5;
    if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) return 0.0;
    return texture2D(uAtlas, vec2(mix(r.x, r.z, q.x), mix(r.y, r.w, 1.0 - q.y))).a;
  }
  vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d){ return a + b * cos(6.2831 * (c * t + d)); }
  float sdBox(vec2 p, vec2 b){ vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
  // one advert, by kind: what the screen shows at time t (a cut every few seconds)
  vec3 advert(float kind, vec2 p, float t){
    float cut = floor(t / 7.0), ft = fract(t / 7.0), s = h1(cut + uSeed * 13.0);
    vec3 c;
    if (kind < 0.5) {                                                // fashion: a pale ground, a figure in silhouette, the name
      vec3 bg = pal(s, vec3(0.5), vec3(0.32), vec3(1.0), vec3(0.0, 0.15, 0.3));   // (a season's colour, not a white)
      c = bg * (0.85 + 0.15 * p.y);
      vec2 q = p - vec2(0.68 - 0.05 * ft, 0.0);
      float body = smoothstep(0.01, 0.0, sdBox(q - vec2(0.0, -0.18), vec2(0.09 + 0.05 * q.y, 0.3)) - 0.03);
      float head = smoothstep(0.01, 0.0, length((q - vec2(0.0, 0.25)) * vec2(1.0, 0.8)) - 0.08);
      float hair = smoothstep(0.01, 0.0, length((q - vec2(0.01, 0.27)) * vec2(0.9, 0.7)) - 0.1) * step(0.22, q.y);
      c = mix(c, vec3(0.08, 0.07, 0.1), max(body, hair));
      c = mix(c, vec3(0.95, 0.82, 0.74), head * (1.0 - hair));
      c = mix(c, vec3(0.1), word(uW0, p, vec2(0.28, 0.12 + 0.03 * smoothstep(0.0, 0.15, ft)), 0.2) * smoothstep(0.05, 0.2, ft));
      c = mix(c, vec3(0.25), word(uW1, p, vec2(0.28, -0.12), 0.08) * smoothstep(0.2, 0.35, ft));
    } else if (kind < 1.5) {                                         // music: dark, rings and bars pulsing to a beat
      float beat = pow(fract(t * 2.0), 3.0);
      vec3 a = pal(s, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.8, 0.9, 0.3));
      c = vec3(0.02, 0.01, 0.05);
      float r = length((p - vec2(0.5, 0.5)) * vec2(uAspect.x / uAspect.y, 1.0));
      c += a * smoothstep(0.03, 0.0, abs(fract(r * 4.0 - t * 0.6) - 0.5) - 0.12) * 0.7;
      float bars = step(fract(p.x * 24.0), 0.6) * step(p.y, 0.15 + 0.3 * h1(floor(p.x * 24.0) + floor(t * 6.0)) * (0.5 + beat));
      c = mix(c, a.zxy * 1.2, bars);
      c = mix(c, vec3(1.0), word(uW2, p, vec2(0.5, 0.62), 0.22));
      c = mix(c, a, word(uW3, p, vec2(0.5, 0.36), 0.1));
    } else if (kind < 2.5) {                                         // a cold drink: bright sky blue, the bottle, bubbles
      c = mix(vec3(0.1, 0.55, 0.95), vec3(0.85, 0.96, 1.0), p.y);
      vec2 q = p - vec2(0.3, 0.42);
      float bottle = smoothstep(0.01, 0.0, sdBox(q, vec2(0.07, 0.28)) - 0.04);
      float neck = smoothstep(0.01, 0.0, sdBox(q - vec2(0.0, 0.33), vec2(0.025, 0.06)));
      c = mix(c, vec3(0.92, 0.2, 0.15), max(bottle, neck));
      c = mix(c, vec3(1.0), step(abs(q.y + 0.02), 0.06) * bottle);
      for (int i = 0; i < 9; i++) { float fi = float(i); vec2 b = vec2(fract(h1(fi) + 0.03 * sin(t + fi)), fract(t * 0.18 * (0.6 + h1(fi + 3.0)) + h1(fi + 7.0)));
        c = mix(c, vec3(1.0), smoothstep(0.012, 0.0, abs(length((p - b) * vec2(uAspect.x / uAspect.y, 1.0)) - 0.03))); }
      c = mix(c, vec3(0.05, 0.15, 0.45), word(uW0, p, vec2(0.68, 0.6), 0.2));
      c = mix(c, vec3(0.9, 0.15, 0.1), word(uW1, p, vec2(0.68, 0.32), 0.12));
    } else if (kind < 3.5) {                                         // the news: a studio blue, the headline, a ticker
      c = mix(vec3(0.02, 0.08, 0.25), vec3(0.05, 0.22, 0.5), p.y);
      c = mix(c, vec3(0.95), word(uW0, p, vec2(0.45, 0.6), 0.18));
      float band = step(p.y, 0.2) * step(0.04, p.y);
      c = mix(c, vec3(0.92, 0.92, 0.95), band);
      vec2 tp = vec2(fract(p.x * 0.5 + t * 0.06) * 2.0, p.y);
      c = mix(c, vec3(0.05, 0.08, 0.3), word(uW1, tp, vec2(0.6, 0.12), 0.1) * band);
      c = mix(c, vec3(0.85, 0.1, 0.15), step(p.x, 0.12) * band);
    } else if (kind < 4.5) {                                         // an idol group's poster: pink, sparkles, the name big
      c = mix(vec3(0.9, 0.32, 0.62), vec3(0.5, 0.32, 0.92), p.x + 0.2 * sin(t * 0.5));   // (deep pink to violet: a screen at night is colour, not white)
      for (int i = 0; i < 3; i++) { float fi = float(i); vec2 q = p - vec2(0.25 + 0.25 * fi, 0.38);
        float head = smoothstep(0.01, 0.0, length(q * vec2(uAspect.x / uAspect.y, 1.0) - vec2(0.0, 0.12)) - 0.09);
        float body = smoothstep(0.01, 0.0, sdBox(q - vec2(0.0, -0.18), vec2(0.07, 0.2)) - 0.02);
        c = mix(c, vec3(0.92, 0.9, 0.96), body); c = mix(c, vec3(0.95, 0.8, 0.72), head); }
      float sp = pow(max(0.0, sin(t * 3.0 + p.x * 40.0) * sin(p.y * 30.0 + t * 2.0)), 30.0);
      c += sp * 0.8;
      c = mix(c, vec3(1.0), word(uW2, p, vec2(0.5, 0.82), 0.16));
    } else {                                                         // a game: a night city, a hero, the title
      c = mix(vec3(0.05, 0.02, 0.12), vec3(0.4, 0.1, 0.4), p.y);
      float sky = step(p.y, 0.25 + 0.2 * h1(floor(p.x * 18.0)));
      vec2 wq = p * vec2(120.0, 60.0), wf = fract(wq);                      // (the windows: small, in rows, gaps between)
      float win = step(0.72, h1(floor(wq.x) + floor(wq.y) * 7.0)) * step(0.3, wf.x) * step(wf.x, 0.75) * step(0.25, wf.y) * step(wf.y, 0.7);
      c = mix(c, vec3(0.02, 0.02, 0.06) + vec3(0.6, 0.5, 0.2) * win * 0.7, sky);
      c = mix(c, vec3(1.0, 0.85, 0.2), word(uW3, p, vec2(0.5, 0.7), 0.22));
    }
    // between adverts: a white flash and wipe
    c = mix(c, vec3(1.0), smoothstep(0.97, 1.0, ft) * 0.6);
    return c;
  }
`;

export class Screens {
  constructor(atlas) { this.atlas = atlas; this.list = []; this.mats = []; }
  // a screen: centre, which way it faces (unit x, z), its width and height, what it plays, which of the four
  // light channels it casts its colour into (or -1)
  add(group, { x, y, z, nx, nz, w, h, kinds = ['fashion', 'music'], words = [], channel = -1, tilt = 0, bright = 1.0, curve = 0, frames = null }) {
    const W = words.map(t => t ? this.atlas.add(t, { px: 96, weight: 800 }) : null);
    const r = i => W[i] ? new THREE.Vector4(W[i].u0, W[i].v0, W[i].u1, W[i].v1) : new THREE.Vector4(0, 0, 0, 0);
    const seed = this.list.length * 3.17 + 0.5;
    const mat = new THREE.ShaderMaterial({
      name: 'screen',
      uniforms: { ...U, uAtlas: { value: null }, uSeed: { value: seed }, uProg: { value: 0 }, uKinds: { value: new THREE.Vector4(...[0, 1, 2, 3].map(i => PROGRAMS[kinds[i % kinds.length]])) },
        uW0: { value: r(0) }, uW1: { value: r(1) }, uW2: { value: r(2) }, uW3: { value: r(3) }, uAspect: { value: new THREE.Vector2(w, h) }, uBright: { value: bright }, uFrames: { value: new THREE.Vector2(...(frames || [0, 0])) } },
      vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `
        ${SCREEN_GLSL}
        uniform vec4 uKinds; uniform vec2 uFrames; uniform float uLightsOn, uDay;
        void main(){
          vec2 p = vUv; float t = uTime + uSeed * 11.0;
          float slot = mod(floor(t / 7.0), 4.0), kind = slot < 0.5 ? uKinds.x : slot < 1.5 ? uKinds.y : slot < 2.5 ? uKinds.z : uKinds.w;
          vec3 c = advert(kind, p, t);
          // the LEDs: a fine grid, seen close; the panel's seams
          float d = distance(vW, cameraPosition), grid = 1.0 - smoothstep(18.0, 40.0, d);
          vec2 px = fract(p * uAspect * 28.0); c *= 1.0 - grid * 0.35 * (1.0 - smoothstep(0.15, 0.5, min(min(px.x, 1.0 - px.x), min(px.y, 1.0 - px.y)) * 2.0));
          vec2 seam = abs(fract(p * uAspect / 1.92) - 0.5); c *= 1.0 - 0.25 * grid * step(0.49, max(seam.x, seam.y));
          // (an LED wall set behind windows: its pixels skip the window frames, which cross it dark — every uFrames.x m, every floor)
          if (uFrames.x > 0.0) { vec2 q = fract(p * uAspect / uFrames); float fr = step(0.06, q.x) * step(q.x, 0.94) * step(0.05, q.y) * step(q.y, 0.95); c = mix(vec3(0.02, 0.025, 0.035), c, fr); }
          gl_FragColor = vec4(c * uBright * mix(0.85, 1.35, uLightsOn * (1.0 - uDay)), 1.0);
        }`,
    });
    mat.uniforms.uAtlas.value = this.atlas.tex || null;
    const g = curve ? curvedPlane(w, h, curve) : new THREE.PlaneGeometry(w, h);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, y, z); m.rotation.order = 'YXZ'; m.rotation.y = Math.atan2(nx, nz); m.rotation.x = -tilt; m.updateMatrix(); m.matrixAutoUpdate = false; m.updateMatrixWorld(true);
    group.add(m);
    this.list.push({ m, mat, seed, kinds: kinds.map(k => PROGRAMS[k]), channel, x, y, z, nx, nz, w, h });
    return m;
  }
  setAtlas(tex) { for (const s of this.list) s.mat.uniforms.uAtlas.value = tex; }
  // the light they cast: a broad pool on the street in front of each (into its channel of the screen picture)
  paint(painter) {
    for (const s of this.list) {
      if (s.channel < 0) continue;
      const c = new THREE.Color(s.channel === 0 ? 1 : 0, s.channel === 1 ? 1 : 0, s.channel === 2 ? 1 : 0), k = Math.min(1.6, s.w * s.h / 60);
      const reach = Math.min(45, 10 + s.y * 0.9), wid = Math.max(s.w * 1.4, 12);
      painter.pool(s.x - s.nx * 0.5, s.z - s.nz * 0.5, s.nx, s.nz, reach, wid, wid * 2.0, c.multiplyScalar(k));
    }
  }
  // each frame: the colour each casts, from what it is showing now (the same adverts, read on the CPU coarsely)
  update(time) {
    const out = U.uScreenCol.value; out.forEach(c => c.setRGB(0, 0, 0));
    for (const s of this.list) {
      if (s.channel < 0) continue;
      const t = time + s.seed * 11, slot = Math.floor(t / 7) % 4, kind = s.kinds[slot % s.kinds.length], cut = Math.floor(t / 7), sd = frac(Math.sin((cut + s.seed * 13) * 127.1) * 43758.5453);
      let r, g, b;
      if (kind === 0) { const v = 0.75 + 0.2 * Math.cos(6.2831 * sd); r = v; g = 0.75 + 0.2 * Math.cos(6.2831 * (sd + 0.1)); b = 0.75 + 0.2 * Math.cos(6.2831 * (sd + 0.2)); }
      else if (kind === 1) { const beat = Math.pow(frac(t * 2), 3); r = 0.25 + 0.3 * beat; g = 0.12; b = 0.35 + 0.2 * beat; }
      else if (kind === 2) { r = 0.4; g = 0.72; b = 0.98; }
      else if (kind === 3) { r = 0.15; g = 0.25; b = 0.5; }
      else if (kind === 4) { r = 0.95; g = 0.6; b = 0.9; }
      else { r = 0.25; g = 0.1; b = 0.3; }
      const flash = smooth(0.97, 1, frac(t / 7)) * 0.6; r += flash; g += flash; b += flash;
      out[s.channel].r += r * 0.55; out[s.channel].g += g * 0.55; out[s.channel].b += b * 0.55;
    }
  }
}
const frac = x => x - Math.floor(x), smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function curvedPlane(w, h, radius) {
  const g = new THREE.PlaneGeometry(w, h, 24, 1), p = g.attributes.position, ang = w / radius;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), a = x / w * ang; p.setX(i, Math.sin(a) * radius); p.setZ(i, (Math.cos(a) - 1) * radius); }
  g.computeVertexNormals(); return g;
}
