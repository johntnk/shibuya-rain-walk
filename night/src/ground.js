// The ground of the crossing: the asphalt (a kerb down from the pavement), the pavement's paving, the granite kerb
// between them, the paint on the road — the big crossings of the Scramble, stop lines, lane lines — and after
// rain all of it wet: dark and glossy, the lights of the street given back long and broken in it, sharp in the
// puddles, rings opening on them where the rain falls. The road and the pavement come from the one drawing of the
// ground (layout.js); each is a flat sheet that keeps only its own part of it.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { U, GLSL_COMMON, col, toon } from './materials.js';
import { roadMask, kerbLines, CROSSWALKS, CORE } from './layout.js';

export const KERB = 0.15;

// the wet surface: reflection (the mirror's picture, broken up and drawn out down the screen, as on wet asphalt),
// puddles, rain rings
export const WET_GLSL = /* glsl */`
  uniform sampler2D uRefl; uniform mat4 uReflMat; uniform float uReflOn, uReflY; uniform vec2 uRes;
  // the rings the drops leave on the wet: three sizes of cell, each its own rhythm; every time round a ring opens (or
  // doesn't: not every cell every time) somewhere new in it, as big as that drop was — some small and quick, some
  // wide; thin or thicker; strong or faint; now and then a second, smaller ring inside the first. Fast at first, slowing,
  // fading as it spreads.
  vec3 ripples(vec2 p, float t){
    vec2 acc = vec2(0.0); float ring = 0.0;
    for (int k = 0; k < 3; k++){
      float sc = k == 0 ? 1.6 : k == 1 ? 2.8 : 4.5;
      vec2 q = p * sc + float(k) * 7.31, id = floor(q);
      float h = hash12(id + float(k) * 13.0), per = 0.55 + 1.2 * h;
      float tt = t + h * 9.0, cyc = floor(tt / per), ph = fract(tt / per);
      float act = step(0.38, hash12(id + vec2(cyc * 1.37, float(k))));
      vec2 c = (vec2(hash12(id + vec2(cyc * 3.1, 0.7)), hash12(id + vec2(5.7, cyc * 2.9))) - 0.5) * 0.62;
      vec2 d = fract(q) - 0.5 - c; float r = length(d);
      float big = 0.12 + 0.36 * hash12(id + vec2(cyc * 2.3, 1.9)), R = sqrt(ph) * big;
      float wdt = 22.0 + 40.0 * hash12(id + vec2(4.4, cyc * 0.7)), amp = (0.25 + 0.75 * hash12(id + vec2(cyc * 4.1, 3.3))) * (1.0 - ph) * (1.0 - ph) * act;
      float w = exp(-pow((r - R) * wdt, 2.0)) * amp;
      float w2 = exp(-pow((r - R * 0.55) * wdt * 1.3, 2.0)) * amp * 0.55 * step(0.55, hash12(id + vec2(cyc * 6.1, 8.0))) * step(0.12, ph);
      ring += (w + w2) * (k == 0 ? 1.0 : k == 1 ? 0.75 : 0.5);
      acc += normalize(d + 1e-4) * (w + w2) * 0.6;
    }
    return vec3(acc, ring);
  }
  // what the wet ground gives back of the street: rough = how broken and long the reflection is
  vec3 wetReflection(vec3 w, vec2 nrm, float rough){
    if (uReflOn < 0.5) return vec3(0.0);
    vec4 rp = uReflMat * vec4(w.x, uReflY, w.z, 1.0); vec2 uv = rp.xy / rp.w + nrm * 0.02;   // (uReflY: the mirror's height — the street, or the roof's deck)
    // the surface's own blur: a few taps round the point (wider the rougher)
    vec3 base = vec3(0.0);
    for (int i = 0; i < 5; i++) { float a = float(i) * 1.2566; base += texture2D(uRefl, uv + vec2(cos(a), sin(a)) * 0.006 * rough).rgb; }
    base /= 5.0;
    // the streaks: what is brighter than the street round it, drawn out down the screen
    vec3 st = vec3(0.0); float tot = 0.0;
    for (int i = -3; i <= 7; i++){
      float fi = float(i), wt = exp(-fi * fi * 0.05);
      vec2 o = vec2(sin(fi * 2.3 + w.x * 3.0) * 0.003 * rough, fi * 0.014 * rough);
      vec3 t = texture2D(uRefl, uv + o).rgb; st += max(t - vec3(0.55), 0.0) * wt; tot += wt;
    }
    vec3 c = mix(texture2D(uRefl, uv).rgb, base, clamp(rough, 0.0, 1.0)) + st / tot * 1.6 * rough;
    return c / (1.0 + dot(c, vec3(0.333)) * 0.7);
  }
`;

function groundMaterial(kind, maskTex, box) {
  const road = kind === 'road';
  return new THREE.ShaderMaterial({
    name: kind,
    uniforms: { ...U, uMask: { value: maskTex }, uBox: { value: new THREE.Vector4(...box) } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      ${GLSL_COMMON}
      ${WET_GLSL}
      uniform sampler2D uMask; uniform vec4 uBox; varying vec3 vW;
      void main(){
        vec2 muv = (vW.xz - uBox.xy) / uBox.zw; float m = texture2D(uMask, muv).r;
        ${road ? 'if (m < 0.5) discard;' : 'if (m >= 0.5) discard;'}
        vec2 p = vW.xz;
        float d = distance(vW, cameraPosition), fw = fwidth(p.x) + fwidth(p.y);
        vec3 base; float rough, puddle;
        ${road ? `
          // asphalt: deep blue-grey, a fine grain that fades with distance, darker patched strips and wheel-worn bands
          float grain = (hash12(floor(p * 18.0)) - 0.5) * (1.0 - smoothstep(0.02, 0.12, fw));
          float patchy = smoothstep(0.55, 0.75, vnoise(p * 0.08 + 3.0)) * 0.5 + smoothstep(0.6, 0.8, vnoise(p * vec2(0.03, 0.3) + 9.0)) * 0.4;
          base = mix(vec3(0.115, 0.13, 0.17), vec3(0.075, 0.085, 0.115), patchy) * (1.0 + grain * 0.18);
          base = mix(base, vec3(dot(base, vec3(0.333))) * 0.72, uLightsOn * (1.0 - uDay) * 0.8);   // (at night, in the sodium and white light, the asphalt's blue is gone: dark grey)
          puddle = smoothstep(0.64, 0.7, vnoise(p * 0.11 + 1.7) * 0.85 + vnoise(p * 0.45) * 0.15);
          rough = mix(0.34, 0.08, puddle);                                   // (after rain the asphalt is a dark mirror; its water sharper)
        ` : `
          // the pavement: granite-grey pavers, 30 x 15 cm, laid in courses, each a little different; dark joints
          vec2 q = p / vec2(0.3, 0.15); q.x += floor(q.y) * 0.5; vec2 id = floor(q), f = fract(q);
          float h = hash12(id);
          float joint = 1.0 - smoothstep(0.0, 0.05 + fw * 6.0, min(min(f.x, 1.0 - f.x) * 0.3 / 0.15, min(f.y, 1.0 - f.y)));
          joint *= 1.0 - smoothstep(0.03, 0.09, fw);
          // round the crossing the pavers are a dull brick red, banded with grey; further off, grey granite
          float redK = 1.0 - smoothstep(55.0, 85.0, length(p - vec2(5.0, 5.0)));
          vec3 grey = mix(vec3(0.30, 0.31, 0.33), vec3(0.40, 0.395, 0.39), h);
          vec3 brick = mix(vec3(0.34, 0.2, 0.16), vec3(0.44, 0.28, 0.22), h);
          float band = step(0.9, fract(floor(q.y) / 12.0));                   // (a course of grey granite every 1.8 m)
          base = mix(grey, brick, redK * (1.0 - band)) * (1.0 - 0.06 * step(0.85, hash12(id + 7.0)));
          base *= 1.0 - joint * 0.55;
          // (small puddles in the low places, many of them, now and then a bigger one; dry-ish paving between)
          puddle = max(smoothstep(0.71, 0.76, vnoise(p * 0.95 + 5.3) * 0.75 + vnoise(p * 3.1 + 2.0) * 0.25), smoothstep(0.8, 0.85, vnoise(p * 0.21 + 9.1))) * 0.9;
          rough = mix(0.9, 0.16, puddle);
        `}
        vec3 n = vec3(0.0, 1.0, 0.0);
        float ringK = ${road ? '0.6 + 0.4 * puddle' : '0.3 + 0.7 * puddle'};
        vec3 rp = uRain > 0.01 ? ripples(p, uTime) * uRain * ringK * (1.0 - smoothstep(0.025, 0.1, fw)) : vec3(0.0);
        // lit as the street is
        vec3 c = cleanColour(base) * toonLight(n, vW) * (1.0 - 0.6 * contactShade(vW));
        // at night the street's countless lamps, signs and headlights: the asphalt warm, the pavement paler (from up on
        // the tower the roads are lines of light)
        c += ${road ? 'vec3(1.0, 0.7, 0.4) * 0.055' : 'vec3(1.0, 0.9, 0.78) * 0.07'} * uLightsOn * (1.0 - uDay) * (1.0 - 0.5 * uWet) * (0.75 + 0.5 * vnoise(p * 0.07));
        // wet: the colour goes darker, and the street comes back in it, most at a glancing look
        vec3 V = normalize(cameraPosition - vW); float fres = 0.04 + 0.96 * pow(1.0 - max(V.y, 0.0), 5.0);
        float wet = uWet;
        c *= 1.0 - wet * (${road ? '0.42' : '0.22'} + 0.3 * puddle);
        vec3 refl = wetReflection(vW, rp.xy, rough);
        float rk = wet * mix(${road ? '0.2 + 0.36 * fres' : '0.03 + 0.06 * fres'}, 0.6 + 0.35 * fres, puddle);
        c += refl * rk * vec3(0.82, 0.88, 1.05);                         // (the night's blue in the water: the city's colours in it quieter)
        // under the lamps at night, the shadows of what stands between them and the ground (shadow.js, LampShadow): over
        // the wet shine too (what the lamp lit there, gone; the water's mirror of the far lights mostly with it)
        c *= 1.0 - (1.0 - sunShadow(vW + vec3(0.0, 0.04, 0.0))) * 0.66 * (1.0 - uDay);
        c += (refl * 0.8 + streetLight(vW, n) * 0.35 + vec3(0.09, 0.1, 0.13)) * rp.z * 1.05 * wet;   // (the rings catch what is round them: lit by the shop fronts, the screens, dim where it is dark)
        gl_FragColor = vec4(fogIt(c, vW), 1.0);
      }`,
  });
}

export class Ground {
  constructor(L, { box = [-220, -220, 440, 440], k = 5 } = {}) {
    this.box = box; this.k = k;
    const canvas = roadMask(L, box, k), img = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    this.img = img; this.W = img.width; this.H = img.height;
    const red = new Uint8Array(this.W * this.H); for (let i = 0; i < red.length; i++) red[i] = img.data[i * 4];
    const tex = this.maskTex = new THREE.DataTexture(red, this.W, this.H, THREE.RedFormat); tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
    this.group = new THREE.Group();
    const plane = y => new THREE.PlaneGeometry(box[2], box[3]).rotateX(-Math.PI / 2).translate(box[0] + box[2] / 2, y, box[1] + box[3] / 2);
    this.roadMat = groundMaterial('road', tex, box); this.walkMat = groundMaterial('walk', tex, box);
    const road = new THREE.Mesh(plane(0), this.roadMat), walk = new THREE.Mesh(plane(KERB), this.walkMat);
    for (const m of [road, walk]) { m.layers.set(1); m.userData.ground = true; this.group.add(m); }
    // the kerbs
    this.kerbs = kerbLines(img, box, k);
    this.group.add(this.kerbMesh());
    this.group.add(this.paint(L));
  }
  // road here? (the drawing, read back: bilinear)
  road(x, z) {
    const u = (x - this.box[0]) * this.k - 0.5, v = (z - this.box[1]) * this.k - 0.5, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j, W = this.W, H = this.H, d = this.img.data;
    const at = (a, b) => d[(Math.max(0, Math.min(H - 1, b)) * W + Math.max(0, Math.min(W - 1, a))) * 4] / 255;
    return ((at(i, j) * (1 - fu) + at(i + 1, j) * fu) * (1 - fv) + (at(i, j + 1) * (1 - fu) + at(i + 1, j + 1) * fu) * fv) > 0.5;
  }
  height(x, z) { return this.road(x, z) ? 0 : KERB; }
  // granite kerb stones along every edge of the road: the face toward the road, a top 18 cm wide, joints every metre
  kerbMesh() {
    const P = [], N = [], C = [];
    const push = (a, b, c, n, col3) => { P.push(...a, ...b, ...c); for (let i = 0; i < 3; i++) { N.push(...n); C.push(...col3); } };
    for (const line of this.kerbs) {
      for (let i = 0; i < line.length - 1; i++) {
        const [x0, z0] = line[i], [x1, z1] = line[i + 1], L = Math.hypot(x1 - x0, z1 - z0); if (L < 1e-3) continue;
        let nx = -(z1 - z0) / L, nz = (x1 - x0) / L;                     // (a normal: which way is the road?)
        const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
        if (!this.road(mx + nx * 0.35, mz + nz * 0.35)) { nx = -nx; nz = -nz; }
        const top = KERB + 0.012, wd = 0.18, sx = -nx * wd, sz = -nz * wd;   // (the top goes back over the pavement)
        const tone = 0.42 + 0.06 * Math.sin(i * 12.9898) , c3 = [tone * 0.95, tone * 0.97, tone];
        // face
        push([x0, 0, z0], [x1, 0, z1], [x1, top, z1], [nx, 0, nz], c3); push([x0, 0, z0], [x1, top, z1], [x0, top, z0], [nx, 0, nz], c3);
        // top
        push([x0, top, z0], [x1, top, z1], [x1 + sx, top, z1 + sz], [0, 1, 0], c3); push([x0, top, z0], [x1 + sx, top, z1 + sz], [x0 + sx, top, z0 + sz], [0, 1, 0], c3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    const m = new THREE.Mesh(g, toon({ name: 'kerb' })); m.material.side = THREE.DoubleSide; m.layers.set(1);
    return m;
  }
  // the white paint: the crossings (bars 45 cm wide, 45 cm apart, across the way you walk), stop lines before them,
  // lane lines on the streets running in (not across the crossing itself)
  paint(L) {
    const quads = [], add = (cx, cz, ux, uz, len, wid, c = [0.86, 0.87, 0.88]) => quads.push([cx, cz, ux, uz, len, wid, c]);
    const inCore = (x, z) => { let inside = false; for (let i = 0, j = CORE.length - 1; i < CORE.length; j = i++) { const [xi, zi] = CORE[i], [xj, zj] = CORE[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside; } return inside; };
    for (const cw of CROSSWALKS) {
      const dx = cw.b[0] - cw.a[0], dz = cw.b[1] - cw.a[1], len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len;
      const n = Math.floor(len / 0.9);
      for (let i = 0; i < n; i++) {
        const s = (i + 0.5) * 0.9 + (len - n * 0.9) / 2, cx = cw.a[0] + ux * s, cz = cw.a[1] + uz * s;
        if (!this.road(cx, cz)) continue;
        add(cx, cz, -uz, ux, cw.w, 0.45);                                // (each bar runs across the way you walk)
      }
    }
    // lane lines along the streets that run in, outside the Scramble: a centre line, and dashes between lanes
    for (const w of L.roads) {
      if (!['tertiary', 'secondary', 'primary', 'trunk'].includes(w.type)) continue;
      const lanes = w.lanes || 2;
      for (let i = 0; i < w.pts.length - 1; i++) {
        const [x0, z0] = w.pts[i], [x1, z1] = w.pts[i + 1], len = Math.hypot(x1 - x0, z1 - z0); if (len < 0.5) continue;
        const ux = (x1 - x0) / len, uz = (z1 - z0) / len;
        for (let s = 0; s < len; s += 1) {
          const x = x0 + ux * s, z = z0 + uz * s; if (inCore(x, z) || Math.hypot(x, z) > 180) continue;
          if (!w.oneway && lanes >= 2 && this.road(x, z)) add(x + ux * 0.5, z + uz * 0.5, ux, uz, 1.02, 0.15, [0.82, 0.68, 0.22]);   // (a yellow centre line: no overtaking)
          if (lanes >= 3 || (w.oneway && lanes >= 2)) {
            const off = w.oneway ? [0] : [-3.2, 3.2];
            for (const o of off) { const px = x - uz * o, pz = z + ux * o; if ((Math.floor(s / 5) % 2) === 0 && this.road(px, pz)) add(px + ux * 0.5, pz + uz * 0.5, ux, uz, 1.02, 0.12); }
          }
        }
      }
    }
    const P = [], C = [], N = [];
    for (const [cx, cz, ux, uz, len, wid, c] of quads) {
      const ax = ux * len / 2, az = uz * len / 2, bx = -uz * wid / 2, bz = ux * wid / 2, y = 0.018;   // (clear of the road: no flicker with it far off)
      const v = [[cx - ax - bx, cz - az - bz], [cx + ax - bx, cz + az - bz], [cx + ax + bx, cz + az + bz], [cx - ax + bx, cz - az + bz]];
      for (const k of [0, 2, 1, 0, 3, 2]) { P.push(v[k][0], y, v[k][1]); C.push(...c); N.push(0, 1, 0); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    const mat = paintMaterial(); const m = new THREE.Mesh(g, mat); m.layers.set(1); m.userData.noInk = true; m.renderOrder = 1;
    this.paintMat = mat;
    return m;
  }
}

// road paint: worn at the edges and where wheels and feet go, glossy when wet, giving back the street a little
function paintMaterial() {
  return new THREE.ShaderMaterial({
    name: 'paint', polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8,
    uniforms: { ...U },
    vertexShader: `attribute vec3 color; varying vec3 vC, vW; void main(){ vC = color; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      ${GLSL_COMMON}
      ${WET_GLSL}
      varying vec3 vC, vW;
      void main(){
        vec2 p = vW.xz;
        float wear = smoothstep(0.5, 0.85, vnoise(p * 1.7) * 0.7 + vnoise(p * 7.0) * 0.3);
        if (wear > 0.93) discard;
        vec3 c = cleanColour(vC) * (1.0 - wear * 0.25) * toonLight(vec3(0.0, 1.0, 0.0), vW);
        vec3 V = normalize(cameraPosition - vW); float fres = 0.04 + 0.96 * pow(1.0 - max(V.y, 0.0), 5.0);
        c *= 1.0 - (1.0 - sunShadow(vW + vec3(0.0, 0.04, 0.0))) * 0.6 * (1.0 - uDay);
        c *= 1.0 - uWet * 0.3;
        c += wetReflection(vW, vec2(0.0), 0.35) * uWet * (0.22 + 0.4 * fres);
        gl_FragColor = vec4(fogIt(c, vW), 1.0);
      }`,
  });
}
