// The convenience store on the ground floor of 渋谷駅前ビル, its face to the street that runs south from the crossing
// (cross from Hachikō by the south crossing and it is in front of you). A real one to walk into, as the reference video's
// is: the glass front with its posters and its sliding doors that open as you come; inside under the white ceiling
// lights the low gondolas of goods, the drinks' fridges along the back, the magazines along the window, the
// counter with its tills, the hot snacks' case, the oden, the coffee machine, the wall of cigarettes behind it, the
// ATM and the copier; outside the bins for the rubbish sorted, the umbrella stand, two vending machines and the
// bicycles left by the wall. (The store is made up: its name, and which floor of which building — the real ground
// floor there wasn't to be found. Everything in it is of the kind every Tokyo konbini has.)
// Built in the store's own frame — x along the building's face (from the store's left end, as you face it), z in
// from the glass, y up from the pavement — and set into the city by toW().
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Kit, at } from './kit.js';
import { U, GLSL_COMMON, col } from './materials.js';
import { rng } from './util.js';
import { makePackAtlas, PackBatch, pickTile } from './packs.js';
import { GLASS_RAIN } from './glassrain.js';
import { Avatar } from './avatar.js';
import { materials, tint } from './outfit/kit.js';

export const KB = { t0: 5, W: 12, D: 10, H: 2.95, Y0: 0.15, door: [8.0, 10.0] };

// where it is: on the station-front building's east face (its ring's 4th edge), from 5 m along
export function konbiniSite(pts) {
  const A = pts[3], B = pts[4], L = Math.hypot(B[0] - A[0], B[1] - A[1]), ux = (B[0] - A[0]) / L, uz = (B[1] - A[1]) / L;
  const nx = uz, nz = -ux;                                               // (outward: east, toward the street)
  const toW = (x, z) => [A[0] + ux * (KB.t0 + x) - nx * z, A[1] + uz * (KB.t0 + x) - nz * z];
  const toL = (wx, wz) => { const dx = wx - A[0], dz = wz - A[1]; return [dx * ux + dz * uz - KB.t0, -(dx * nx + dz * nz)]; };
  return { A, B, ux, uz, nx, nz, toW, toL, ry: Math.atan2(-uz, ux), inside: (wx, wz) => { const [x, z] = toL(wx, wz); return x > 0.05 && x < KB.W - 0.05 && z > 0.05 && z < KB.D - 0.05; } };
}

// the light in a konbini: everywhere the same, white and bright — no street light in here
function roomMat() {
  return new THREE.ShaderMaterial({
    name: 'konbini', uniforms: { ...U },
    vertexShader: `attribute vec3 color; varying vec3 vC, vN, vW; void main(){ vC = color; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${GLSL_COMMON} varying vec3 vC, vN, vW;
      void main(){ vec3 n = normalize(vN);
        float l = 0.86 + 0.16 * n.y - 0.1 * step(n.y, -0.5);              // (tops lit from the ceiling, undersides a little darker)
        gl_FragColor = vec4(fogIt(cleanColour(vC) * l * vec3(0.98, 1.0, 1.02), vW), 1.0); }`,
  });
}
// the goods: the front face printed from the packaging picture (packs.js), the rest its ground colour; lit as the
// room is, the print kept bright (a pack's colours are what you see of it)
function packMat(tex) {
  return new THREE.ShaderMaterial({
    name: 'packs', uniforms: { ...U, uPack: { value: tex } },
    vertexShader: `attribute vec3 color; attribute float aTile; varying vec3 vC, vN, vW; varying vec2 vUv; varying float vT;
      void main(){ vC = color; vT = aTile; vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${GLSL_COMMON} uniform sampler2D uPack; varying vec3 vC, vN, vW; varying vec2 vUv; varying float vT;
      void main(){ vec3 n = normalize(vN), c = vC;
        if (vT > -0.5) { float t = floor(vT + 0.5); vec2 cell = vec2(mod(t, 16.0), 15.0 - floor(t / 16.0)); c = texture2D(uPack, (cell + 0.02 + clamp(vUv, 0.0, 1.0) * 0.96) / 16.0).rgb; }
        float up = max(n.y, 0.0), down = max(-n.y, 0.0), side = 1.0 - up - down;
        float l = 0.84 + 0.2 * up - 0.3 * down;                          // (lit from the rows overhead: the top most, the faces less, the underside little)
        if (vT < -0.5) { l *= mix(1.0, 0.74, side); if (up > 0.5) c = mix(c, vec3(0.8, 0.79, 0.76), 0.35) * 0.92; }   // (a pack's sides darker than its face; its top, seen from above, quieter)
        vec2 e2 = min(vUv, 1.0 - vUv); l *= 0.85 + 0.15 * smoothstep(0.0, 0.07, min(e2.x, e2.y));   // (each face a little darker at its rim: a box reads by its edges)
        l *= mix(1.0, 0.7 + 0.3 * smoothstep(0.0, 0.32, vUv.y), side);   // (and at its foot, where it stands on the shelf)
        gl_FragColor = vec4(fogIt(c * l * vec3(0.98, 1.0, 1.02), vW), 1.0); }`,
  });
}
// where things meet, a soft dark (the white light in here comes from everywhere above, so it is only in the corners
// it cannot reach): under the goods along a shelf and at its back, on the panel under the shelf above, on the floor
// round each fixture's foot. Transparent black, its strength per corner.
class Shade {
  constructor() { this.P = []; this.A = []; }
  quad(a, b, c, d, aa, ab, ac, ad) { for (const [p, k] of [[a, aa], [b, ab], [c, ac], [a, aa], [c, ac], [d, ad]]) { this.P.push(...p); this.A.push(k); } }
  build() {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3)); g.setAttribute('aA', new THREE.Float32BufferAttribute(this.A, 1));
    const m = new THREE.ShaderMaterial({ name: 'konbini contact shade', transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      vertexShader: `attribute float aA; varying float vA; void main(){ vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying float vA; void main(){ gl_FragColor = vec4(0.0, 0.0, 0.0, vA * vA * (3.0 - 2.0 * vA)); }` });   // (eased: soft at its edge)
    const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 1; mesh.userData.noInk = true; mesh.matrixAutoUpdate = false; return mesh;
  }
}
// the floor: pale tiles, 30 cm, the ceiling's rows of light in their shine
function floorMat(site) {
  return new THREE.ShaderMaterial({
    name: 'konbini floor', uniforms: { ...U, uO: { value: new THREE.Vector2(...site.toW(0, 0)) }, uUx: { value: new THREE.Vector2(site.ux, site.uz) } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${GLSL_COMMON} uniform vec2 uO, uUx; varying vec3 vW;
      void main(){ vec2 d = vW.xz - uO; float x = dot(d, uUx), z = dot(d, vec2(-uUx.y, uUx.x));
        vec2 t = fract(vec2(x, z) / 0.3); float joint = 1.0 - step(0.035, t.x) * step(0.035, t.y);
        vec3 c = mix(vec3(0.86, 0.86, 0.84), vec3(0.62, 0.63, 0.63), joint) * (0.97 + 0.06 * hash12(floor(vec2(x, z) / 0.3)));
        vec3 V = normalize(cameraPosition - vW); float gl = pow(1.0 - max(V.y, 0.0), 3.0);
        float rows = 0.0; for (int i = 0; i < 5; i++) { float zr = 1.5 + 1.8 * float(i); rows += exp(-pow((z - zr) * 2.2, 2.0)); }
        c += vec3(0.5, 0.52, 0.55) * rows * (0.15 + 0.6 * gl);              // (the lights in the polish)
        gl_FragColor = vec4(fogIt(c, vW), 1.0); }`,
  });
}
// the glass of the front and the doors: you see in; the street's light and the sky in it, more so at a glancing look
// glass: the sky and the street's light caught in it at a slant. The front's (drops = true) has the rain on it
// (glassrain.js) — the pane's own metres from its uv and aSize (its width and height), so the drops go with a door
// as it slides; seen from outside the store's white light is behind them, from inside the street's dark
function glassMat(drops = false) {
  const m = new THREE.ShaderMaterial({
    name: drops ? 'konbini window' : 'konbini glass', uniforms: { ...U, uOut: { value: new THREE.Vector3(0, 0, 1) }, uT: { value: new THREE.Vector3(1, 0, 0) } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    defines: drops ? { DROPS: 1 } : {},
    vertexShader: `varying vec3 vN, vW; varying vec2 vP; varying float vH;
      #ifdef DROPS
      attribute vec2 aSize;
      #endif
      void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
        #ifdef DROPS
        vP = uv * aSize; vH = aSize.y;
        #endif
        gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${GLSL_COMMON} ${GLASS_RAIN} varying vec3 vN, vW; varying vec2 vP; varying float vH; uniform vec3 uOut, uT;
      void main(){ vec3 n = normalize(vN), V = normalize(cameraPosition - vW); float f = pow(1.0 - abs(dot(V, n)), 4.0);
        vec3 r = uSky * 0.8 + uHaze * 0.25 + streetLight(vW, n) * 0.35; float a = 0.06 + 0.55 * f;
        #ifdef DROPS
        float fw = length(fwidth(vP));
        if (uRain > 0.01) {
          bool outside = dot(cameraPosition - vW, uOut) > 0.0;
          vec3 room = vec3(0.92, 0.96, 1.0) * 1.05, street = uSky * 0.9 + uHaze * 0.3 + streetLight(vW, n) * 0.7;
          vec4 d = rainOnGlass(vP, vH, uTime, fw, vW, uT, outside ? street : room * 0.6, outside ? street * 0.25 : room * 0.35) * min(uRain, 1.0);
          gl_FragColor = vec4(r * a * (1.0 - d.a) + d.rgb, 1.0 - (1.0 - a) * (1.0 - d.a)); return;   // (premultiplied: the drops darken what is behind, and add their light)
        }
        gl_FragColor = vec4(r * a, a); return;
        #endif
        gl_FragColor = vec4(r, a); }`,
  });
  if (drops) Object.assign(m, { blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor });
  return m;
}

// packs on the shelves: mostly pale with one strong colour, some all colour, a few dark (as in the shop shader)
function packColour(R) {
  const h = R(), strong = new THREE.Color().setHSL(h, 0.5 + 0.35 * R(), 0.38 + 0.2 * R()), u = R();
  return u < 0.3 ? new THREE.Color(0.94, 0.93, 0.91).lerp(strong, 0.12) : u < 0.8 ? strong : u < 0.9 ? new THREE.Color().setHSL(0.07 + 0.04 * R(), 0.55, 0.32) : new THREE.Color(0.14, 0.13, 0.15);
}

export class Konbini {
  constructor(site, { light, signs, atlas, ground = null }) {
    this.site = site; const S = site, R = rng(909), ry = S.ry, Y0 = KB.Y0;
    const P = (x, y, z) => { const [wx, wz] = S.toW(x, z); return [wx, Y0 + y, wz]; };
    const room = new Kit(), out = new Kit();
    // a box in the store's frame: centre (x, y, z), size w (along), h, d (in), turned a little (yaw) if asked
    const B = (K, kind, x, y, z, w, h, d, c, yaw = 0) => { const [wx, wy, wz] = P(x, y, z); K.box(kind, w, h, d, at(wx, wy, wz, ry + yaw), c); };
    // a pack with its front printed (front: 0 +x, 1 −x, 4 +z, 5 −z of the store's frame), a tile of the given kind;
    // its other faces the ground colour of that tile
    const atlasP = this.atlas = makePackAtlas(), packs = new PackBatch(), packsOut = new PackBatch(), shade = new Shade();
    const PK = (x, y, z, w, h, d, front, kind, batch = packs, tile = pickTile(R, kind)) => { const [wx, wy, wz] = P(x, y, z); batch.add(at(wx, wy, wz, ry), w, h, d, front, tile, atlasP.tileC[tile]); return tile; };
    this.group = new THREE.Group(); this.group.name = 'konbini';
    this.colliders = [];
    // what stands in the store: it stops you (circles every r), and — up to its top — the camera too (fixtureAt)
    this.fixtures = [];
    const block = (x0, x1, z0, z1, r = 0.3, top = 2.2) => { this.fixtures.push([x0, x1, z0, z1, top]); for (let x = x0; x <= x1 + 1e-6; x += r) for (let z = z0; z <= z1 + 1e-6; z += r) { const [wx, wz] = S.toW(x, z); this.colliders.push([wx, wz, r * 0.75]); } };
    const W = KB.W, D = KB.D, H = KB.H;
    // ---- the room: walls, ceiling and its light rows, the floor
    B(room, 'solid', 0.05, H / 2, D / 2, 0.1, H, D, '#eceae4'); B(room, 'solid', W - 0.05, H / 2, D / 2, 0.1, H, D, '#eceae4');
    B(room, 'solid', W / 2, H / 2, D - 0.05, W, H, 0.1, '#eceae4'); B(room, 'solid', W / 2, H + 0.06, D / 2 - 0.1, W, 0.12, D + 0.3, '#f2f1ee');
    for (let i = 0; i < 5; i++) B(room, 'glow', W / 2, H - 0.02, 1.5 + 1.8 * i, W - 1.2, 0.04, 0.2, col('#f4f7ff', 1.6));
    // (the band of colour along the top of the walls, the categories)
    for (const [x, w, c] of [[2.4, 4.8, '#2f8f4f'], [6.6, 3.6, '#1f62b0'], [9.8, 2.8, '#d0402a']]) B(room, 'glow', x, H - 0.35, D - 0.12, w - 0.1, 0.36, 0.02, col(c, 0.9));
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2).translate(W / 2, 0, D / 2), floorMat(S));
    { const [wx, , wz] = P(0, 0.008, 0); floor.position.set(wx, Y0 + 0.008, wz); floor.rotation.y = ry; floor.updateMatrix(); floor.matrixAutoUpdate = false; }
    this.group.add(floor);
    // ---- the drinks: fridges along the back wall, nine glass doors; behind each, lit from the back, five shelves of
    // bottles and cans, the front rows full, a little sign of the price under each
    const fz0 = D - 0.78, fz1 = D - 0.1, fGlass = [];
    B(room, 'solid', 4.1, 2.22, (fz0 + fz1) / 2, 7.2, 0.24, fz1 - fz0, '#3a3d42'); B(room, 'solid', 4.1, 0.07, (fz0 + fz1) / 2, 7.2, 0.14, fz1 - fz0, '#3a3d42');
    B(room, 'glow', 4.1, 2.22, fz0 - 0.005, 7.0, 0.14, 0.01, col('#e8f2ff', 0.9));
    for (let k = 0; k < 9; k++) {
      const x = 0.6 + 0.78 * k + 0.39;
      B(room, 'glow', x, 1.12, fz1 - 0.02, 0.74, 1.95, 0.02, col('#e8f0ff', 0.55));                 // (the lit back)
      B(room, 'solid', x - 0.39, 1.12, (fz0 + fz1) / 2, 0.03, 2.0, fz1 - fz0, '#2a2c30');          // (the partition)
      for (let sh = 0; sh < 5; sh++) {
        const y = 0.22 + sh * 0.38; B(room, 'solid', x, y - 0.012, (fz0 + fz1) / 2 + 0.05, 0.74, 0.02, 0.55, '#d9dde2');
        B(room, 'glow', x, y - 0.03, fz0 + 0.09, 0.7, 0.03, 0.01, col('#ffffff', 0.7));           // (the price strip)
        const can = R() < 0.3, n = can ? 8 : 6, tall = can ? 0.12 : sh < 2 ? 0.27 : 0.21, wd = can ? 0.065 : 0.075; let rowTile = 0;
        for (let b = 0; b < n; b++) for (const dz of [0.0, 0.12, 0.24]) {
          const bx = x - 0.33 + (b + 0.5) * (0.66 / n), bz = fz0 + 0.16 + dz;
          if (b === 0 || R() < 0.35) rowTile = pickTile(R, can ? 'can' : 'tall');            // (the same drink a few facings wide)
          PK(bx, y + tall / 2, bz, wd, tall, wd, 5, null, packs, rowTile);
          if (!can && dz === 0) B(room, 'solid', bx, y + tall + 0.012, bz, 0.03, 0.024, 0.03, R() < 0.5 ? '#f2f2f2' : '#d84a2a');
        }
      }
      // its glass door, in a dark frame, with its handle
      const [gx, , gz] = P(x, 0, fz0 - 0.01); const g = new THREE.PlaneGeometry(0.72, 1.98).translate(0, Y0 + 1.12, 0); g.rotateY(ry); g.translate(gx, 0, gz); fGlass.push(g);
      for (const [dx, w, h, y] of [[-0.37, 0.03, 2.0, 1.12], [0.37, 0.03, 2.0, 1.12], [0, 0.76, 0.04, 0.12], [0, 0.76, 0.04, 2.11]]) B(room, 'metal', x + dx, y, fz0 - 0.015, w, h, 0.03, '#2a2c30');
      B(room, 'metal', x + 0.3, 1.2, fz0 - 0.04, 0.025, 0.5, 0.025, '#b8bec6');
    }
    block(0.6, 7.65, D - 0.85, D - 0.05, 0.3, 2.35);
    { const fm = new THREE.Mesh(mergeGeometries(fGlass), glassMat()); fm.renderOrder = 6; fm.userData.noInk = true; this.group.add(fm); }
    // ---- the left wall: tall shelving of snacks and daily goods
    const shelfRun = (K, x0, z0, len, along, face, h, levels, depth = 0.42) => {   // (along: 'z' or 'x'; face: +1/-1 toward the aisle)
      // its contact shade (along 'z', the shelving the store has): on each shelf, darker toward its back where the goods
      // stand in the shelf above's shadow; on the panel behind, under each shelf above and just over each shelf
      if (along === 'z') for (let l = 0; l < levels; l++) {
        const y = 0.12 + l * (h / levels), yt = y + 0.0135, xf = x0 + face * (depth / 2 - 0.02), xb = x0 - face * (depth / 2 - 0.002), z1 = z0 + len;
        shade.quad(P(xf, yt, z0), P(xf, yt, z1), P(xb, yt, z1), P(xb, yt, z0), 0.2, 0.2, 0.62, 0.62);
        shade.quad(P(xb, yt, z0), P(xb, yt, z1), P(xb, yt + 0.1, z1), P(xb, yt + 0.1, z0), 0.55, 0.55, 0.0, 0.0);
        if (l < levels - 1) { const y2 = y + h / levels - 0.013; shade.quad(P(xb, y2, z0), P(xb, y2, z1), P(xb, y2 - 0.22, z1), P(xb, y2 - 0.22, z0), 0.62, 0.62, 0.0, 0.0); }
      }
      for (let l = 0; l < levels; l++) {
        const y = 0.12 + l * (h / levels);
        if (along === 'z') B(K, 'solid', x0, y, z0 + len / 2, depth, 0.025, len, '#d7d8da'); else B(K, 'solid', x0 + len / 2, y, z0, len, 0.025, depth, '#d7d8da');
        if (along === 'z') B(K, 'glow', x0 + face * depth / 2, y + 0.03, z0 + len / 2, 0.01, 0.04, len, col('#ffe27a', 0.6)); else B(K, 'glow', x0 + len / 2, y + 0.03, z0 + face * depth / 2, len, 0.04, 0.01, col('#ffe27a', 0.6));
        let s = 0.03;
        while (s < len - 0.1) {
          const w = 0.06 + R() * 0.12, hh = (h / levels - 0.05) * (0.35 + R() * 0.5) * (l === levels - 1 ? 0.7 : 1), dd = depth * (0.55 + R() * 0.35), c = packColour(R), inset = R() * 0.05;
          const cx = along === 'z' ? x0 + face * (depth / 2 - dd / 2 - inset) : x0 + s + w / 2, cz = along === 'z' ? z0 + s + w / 2 : z0 + face * (depth / 2 - dd / 2 - inset);
          const kind = hh / w > 1.7 ? 'tall' : 'wide', tile = pickTile(R, kind), reps = R() < 0.4 ? 2 + Math.floor(R() * 2) : 1;   // (often two or three facings of the same)
          for (let k = 0; k < reps && s < len - 0.1; k++) {
            const zz = along === 'z' ? z0 + s + w / 2 : cz, xx = along === 'z' ? cx : x0 + s + w / 2;
            if (along === 'z') PK(xx, y + 0.015 + hh / 2, zz, dd, hh, w - 0.014, face > 0 ? 0 : 1, kind, packs, tile); else PK(xx, y + 0.015 + hh / 2, zz, w - 0.014, hh, dd, face > 0 ? 4 : 5, kind, packs, tile);
            s += w;
          }
        }
      }
    };
    B(room, 'solid', 0.22, 0.95, 6.25, 0.24, 1.9, 5.5, '#e6e7e9'); shelfRun(room, 0.55, 3.5, 5.5, 'z', 1, 1.85, 5); block(0.1, 0.78, 3.5, 9.0, 0.3, 1.95);
    // ---- the gondolas down the middle, both faces stocked, a category board on each
    for (const gx of [2.15, 4.25, 6.35]) {
      B(room, 'solid', gx, 0.75, 5.5, 0.12, 1.5, 5.8, '#e6e7e9'); B(room, 'solid', gx, 0.06, 5.5, 0.9, 0.12, 5.8, '#d2d3d6');
      shelfRun(room, gx + 0.25, 2.6, 5.8, 'z', 1, 1.42, 5, 0.38); shelfRun(room, gx - 0.25, 2.6, 5.8, 'z', -1, 1.42, 5, 0.38);
      // its end toward the door: a display of one thing, piled, and its card
      B(room, 'solid', gx, 0.45, 2.38, 0.86, 0.9, 0.4, '#e6e7e9'); const pt = pickTile(R, 'wide');
      for (let k = 0; k < 12; k++) PK(gx - 0.3 + (k % 4) * 0.2, 0.98 + Math.floor(k / 4) * 0.13, 2.38, 0.18, 0.12, 0.3, 5, null, packs, pt);
      { const [t, bg, fg] = R.pick([['特価 128円', '#ffe94a', '#d0262f'], ['新発売', '#d0262f', '#ffffff'], ['期間限定', '#1f62b0', '#ffffff'], ['2個で 200円', '#ffe94a', '#111418']]), [wx, wy, wz] = P(gx, 1.5, 2.17);   // (its card)
        if (signs) signs.box(at(wx, wy, wz, ry + Math.PI), 0.5, 0.26, 0.01, { pz: { r: atlas.add(t, { px: 88, weight: 900 }), fill: 0.86 } }, bg, fg, 0.7); }
      { const [cat, cc] = [['お菓子', '#d0402a'], ['カップ麺・食品', '#e2a400'], ['日用品', '#1f62b0']][[2.15, 4.25, 6.35].indexOf(gx)], [wx, wy, wz] = P(gx, 2.5, 2.45);   // (its category, hung over the aisle's end, facing the door)
        if (signs) signs.box(at(wx, wy, wz, ry + Math.PI), 0.8, 0.24, 0.03, { pz: { r: atlas.add(cat, { px: 88, weight: 800 }), fill: 0.86 }, nz: { r: atlas.add(cat, { px: 88, weight: 800 }), fill: 0.86 } }, cc, '#ffffff', 0.9); }
      B(room, 'metal', gx, 2.75, 2.45, 0.01, 0.26, 0.01, '#9aa0a8');
      block(gx - 0.47, gx + 0.47, 2.15, 8.42, 0.3, 1.6);   // (with its end display)
    }
    // ---- along the window: the magazines, on a low rack, their covers tilted to you
    B(room, 'solid', 3.5, 0.45, 0.55, 6.0, 0.9, 0.4, '#d9dadc');
    for (let x = 0.62; x < 6.4; x += 0.22) for (const [y, z] of [[0.62, 0.42], [0.98, 0.58]]) PK(x, y, z + 0.05, 0.2, 0.28, 0.02, 4, 'mag');
    block(0.5, 6.5, 0.32, 0.78, 0.3, 1.15);
    // ---- the ice-cream freezer, low, its glass lid
    B(room, 'solid', 5.0, 0.42, 1.7, 1.6, 0.84, 0.75, '#f0f0f2'); B(room, 'glow', 5.0, 0.86, 1.7, 1.5, 0.02, 0.65, col('#dff3ff', 0.8)); block(4.18, 5.82, 1.3, 2.1, 0.3, 0.9);
    // ---- the ATM and the copier by the left wall
    B(room, 'solid', 0.5, 0.7, 1.4, 0.8, 1.4, 0.7, '#e9eaec'); B(room, 'glow', 0.92, 1.05, 1.4, 0.02, 0.3, 0.4, col('#7fc6ff', 1.2)); B(room, 'glow', 0.5, 1.48, 1.4, 0.8, 0.12, 0.7, col('#e2a400', 1.0));
    B(room, 'solid', 0.55, 0.55, 2.55, 0.9, 1.1, 0.9, '#d8dade'); block(0.1, 1.0, 1.0, 3.0, 0.3, 1.6);
    // ---- the counter: two tills, the hot snacks' case, the oden, the coffee machine; behind it the wall of cigarettes
    B(room, 'solid', 10.85, 0.5, 4.7, 0.75, 1.0, 4.6, '#e3e1dc'); B(room, 'solid', 10.85, 1.02, 4.7, 0.8, 0.04, 4.7, '#b9b4aa');
    for (const z of [3.2, 5.6]) { B(room, 'solid', 10.95, 1.15, z, 0.35, 0.22, 0.4, '#3a3d42'); B(room, 'glow', 10.78, 1.32, z, 0.02, 0.2, 0.3, col('#9fd8ff', 1.1)); }
    // (the hot case: a warm-lit back, a lamp along its top, two shelves, the glass round the front; からあげ in it)
    B(room, 'solid', 10.85, 1.07, 4.35, 0.62, 0.06, 0.92, '#3a3d42'); B(room, 'glow', 11.13, 1.32, 4.35, 0.03, 0.46, 0.86, col('#ffcf8a', 0.9));
    B(room, 'glow', 10.85, 1.57, 4.35, 0.6, 0.03, 0.88, col('#fff0d0', 1.3)); B(room, 'metal', 10.85, 1.6, 4.35, 0.64, 0.04, 0.94, '#3a3d42');
    B(room, 'solid', 10.95, 1.33, 4.35, 0.36, 0.015, 0.84, '#c9ccd0');
    for (const [dx, dz] of [[-0.31, 0], [0, -0.45], [0, 0.45]]) B(room, 'metal', 10.85 + dx, 1.33, 4.35 + dz, 0.02, 0.5, 0.02, '#3a3d42');
    { const [wx, , wz] = P(10.54, 0, 4.35); const g = new THREE.PlaneGeometry(0.9, 0.48).rotateY(Math.PI / 2).translate(0, Y0 + 1.33, 0); g.rotateY(ry); g.translate(wx, 0, wz); const gm = new THREE.Mesh(g, glassMat()); gm.renderOrder = 6; gm.userData.noInk = true; this.group.add(gm); }
    for (let k = 0; k < 16; k++) B(room, 'solid', 10.72 + (k % 3) * 0.13, 1.14 + (k % 2) * 0.22, 4.02 + Math.floor(k / 2) * 0.09, 0.09, 0.05, 0.07, R() < 0.6 ? '#c27a2e' : '#e3b35a');   // (からあげ, on the two shelves)
    B(room, 'solid', 10.85, 1.1, 6.55, 0.6, 0.16, 0.5, '#7a7d82'); B(room, 'glow', 10.85, 1.19, 6.55, 0.5, 0.02, 0.4, col('#d6a35a', 0.6));   // (the oden)
    B(room, 'solid', 10.9, 1.4, 2.0, 0.55, 0.8, 0.5, '#1e2024'); B(room, 'glow', 10.62, 1.55, 2.0, 0.02, 0.18, 0.3, col('#ff9a3a', 1.0));        // (the coffee)
    B(room, 'solid', 11.85, 1.9, 4.7, 0.2, 1.1, 4.4, '#cfcbc3');
    // (the cigarettes: mostly white packs, each its band of colour; every row its price strip)
    for (let r = 0; r < 6; r++) { for (let k = 0; k < 24; k++) PK(11.74, 1.42 + r * 0.17, 2.6 + k * 0.18, 0.04, 0.13, 0.15, 1, 'cig');
      B(room, 'solid', 11.71, 1.35 + r * 0.17, 4.7, 0.01, 0.025, 4.3, '#fafafa'); }
    block(10.45, W - 0.05, 2.3, 7.05, 0.3, 1.7);
    if (signs) { const [wx, wy, wz] = P(W - 0.14, 2.55, 4.7); signs.box(at(wx, wy, wz, ry - Math.PI / 2), 3.6, 0.36, 0.04, { pz: { r: atlas.add('からあげ  おでん  中華まん  コーヒー', { px: 88, weight: 800 }), fill: 0.92 } }, '#1f3f86', '#ffffff', 0.9); }
    // (the one at the till: a VRoid character, addClerk() below)
    // ---- the front: glass in its frame, the doors (moving: built separately), the sign band, the posters
    const fr = '#3a3e45', GZ = -0.02;
    B(out, 'metal', W / 2, 2.72, GZ, W, 0.1, 0.12, fr); B(out, 'metal', W / 2, 0.04, GZ, W, 0.08, 0.14, fr);
    for (const x of [0, 2.0, 4.0, 6.0, 8.0, 10.0, W]) B(out, 'metal', Math.min(W - 0.04, Math.max(0.04, x)), 1.38, GZ - 0.02, 0.07, 2.7, 0.1, fr);
    const glass = [], gM = glassMat(true); gM.uniforms.uOut.value.set(S.nx, 0, S.nz); gM.uniforms.uT.value.set(S.ux, 0, S.uz);   // (out to the street; the panes' x, as their uv runs)
    const sized = (g, w, h) => { const a = new Float32Array(g.attributes.position.count * 2); for (let i = 0; i < a.length; i += 2) { a[i] = w; a[i + 1] = h; } g.setAttribute('aSize', new THREE.BufferAttribute(a, 2)); return g; };
    const pane = (x0, x1) => { const [cx, , cz] = P((x0 + x1) / 2, 0, GZ); const g = sized(new THREE.PlaneGeometry(x1 - x0, 2.6), x1 - x0, 2.6).translate(0, Y0 + 1.38, 0); g.rotateY(ry); g.translate(cx, 0, cz); glass.push(g); };
    pane(0, 8.0); pane(10.0, W);
    const gm = new THREE.Mesh(mergeGeometries(glass), gM); gm.renderOrder = 6; gm.userData.noInk = true; this.group.add(gm);
    // the sign band: white, a green and a blue stripe, the name; over it the building's own wall
    B(out, 'glow', W / 2, 3.25, -0.12, W, 0.7, 0.1, col('#f6f7f8', 1.15));
    B(out, 'glow', W / 2, 3.0, -0.18, W, 0.1, 0.02, col('#2f9a55', 1.2)); B(out, 'glow', W / 2, 2.88, -0.18, W, 0.08, 0.02, col('#2a6fc0', 1.2));
    B(out, 'solid', W / 2, 2.84, -0.05, W, 0.14, 0.1, fr); B(out, 'solid', W / 2, 4.15, -0.06, W + 0.2, 1.1, 0.12, '#c4bdb2');
    if (signs) {
      const sign = (txt, x, y, w, h, bg, fg, opt = {}) => { const [wx, wy, wz] = P(x, y, -0.19); signs.box(at(wx, wy, wz, ry + Math.PI), w, h, 0.02, { pz: { r: atlas.add(txt, { px: 96, weight: 800, ...opt }), fill: 0.86 } }, bg, fg, 1.0); };
      sign('HACHI MART  ハチマート', 3.4, 3.28, 5.4, 0.55, '#f6f7f8', '#2a6fc0', { font: 'Hiragino Sans' });
      sign('24H', 10.6, 3.28, 1.1, 0.5, '#2f9a55', '#ffffff', { font: 'Helvetica Neue' });
      // posters stuck on the glass (from outside you read them)
      const poster = (txt, x, y, w, h, bg, fg) => { const [wx, wy, wz] = P(x, y, -0.035); signs.box(at(wx, wy, wz, ry + Math.PI), w, h, 0.005, { pz: { r: atlas.add(txt, { px: 88, weight: 800 }), fill: 0.82 } }, bg, fg, 0.55); };
      poster('おでん  全品70円引き', 1.2, 1.9, 1.3, 0.6, '#d0402a', '#ffffff'); poster('からあげ', 2.8, 2.0, 0.9, 0.5, '#e2a400', '#3a1a08');
      poster('ATM', 0.55, 1.2, 0.5, 0.35, '#1f62b0', '#ffffff'); poster('新発売', 4.5, 2.0, 0.8, 0.45, '#ffffff', '#d0402a'); poster('コーヒー', 10.5, 2.0, 0.9, 0.45, '#2b2118', '#f4d7a8');
    }
    // ---- outside: the mats, the umbrella stand, the bins, two vending machines, the bicycles
    B(out, 'solid', 9.0, 0.006, -0.6, 2.4, 0.012, 1.1, '#2b2e33'); B(room, 'solid', 9.0, 0.012, 0.6, 2.4, 0.012, 1.0, '#3a3e45');
    // the umbrella stand, a few left in it
    B(out, 'metal', 7.4, 0.3, -0.35, 0.5, 0.6, 0.28, '#9aa0a8');
    for (let k = 0; k < 4; k++) { const [wx, wy, wz] = P(7.22 + k * 0.12, 0.6, -0.35); out.cyl('solid', 0.012, 0.012, 0.9, at(wx, wy + 0.15, wz, 0, 0.12 * (k - 1.5), 0.06), R.pick(['#1b2140', '#e8e8ea', '#6b1e24', '#2a2f3a']), 6); }
    // the bins: burnable, plastic bottles, cans and bottles, other — each its colour, its slot
    [['#3a7a3f', 'もえる'], ['#2a6fc0', 'ペット'], ['#e2a400', 'かん・びん'], ['#8a8f96', 'その他']].forEach(([c, t], k) => {
      const x = 10.45 + k * 0.42; B(out, 'solid', x, 0.48, -0.42, 0.38, 0.96, 0.42, '#d9dbde'); B(out, 'solid', x, 0.98, -0.42, 0.4, 0.06, 0.44, c); B(out, 'solid', x, 0.8, -0.64, 0.18, 0.06, 0.02, '#1c1e22');
      if (signs) { const [wx, wy, wz] = P(x, 0.62, -0.645); signs.box(at(wx, wy, wz, ry + Math.PI), 0.32, 0.12, 0.004, { pz: { r: atlas.add(t, { px: 80, weight: 800 }), fill: 0.8 } }, '#ffffff', c, 0.25); }
    });
    block(10.3, 12.1, -0.62, -0.2, 0.25, 1.05);
    // two vending machines: white and red, their faces of drinks lit, the buttons, the slot below
    const vend = (x, body, band) => {
      B(out, 'solid', x, 0.92, -0.42, 1.0, 1.84, 0.78, body);
      B(out, 'glow', x, 1.3, -0.82, 0.86, 0.88, 0.02, col('#f4f6ff', 1.05));
      for (let r = 0; r < 3; r++) for (let k = 0; k < 7; k++) { PK(x - 0.36 + k * 0.12, 0.98 + r * 0.29, -0.84, 0.07, 0.17, 0.05, 5, r === 2 ? 'can' : 'tall', packsOut); B(out, 'glow', x - 0.36 + k * 0.12, 0.88 + r * 0.29, -0.84, 0.05, 0.025, 0.01, col(R() < 0.8 ? '#3aff7a' : '#ff4a3a', 1.0)); }
      B(out, 'solid', x, 1.8, -0.83, 1.0, 0.14, 0.02, band); B(out, 'solid', x, 0.35, -0.83, 0.62, 0.22, 0.03, '#1c1e22'); B(out, 'solid', x + 0.32, 0.7, -0.83, 0.12, 0.2, 0.02, '#c0c4ca');
      const [wx, , wz] = P(x, 0, -0.42), [fx, , fz] = P(x, 0, -0.82); light.pool(fx, fz, S.nx, S.nz, 3.2, 1.3, 3.2, col('#e6eeff', 0.9)); light.shadeOBB(wx, wz, S.ux, S.uz, 0.5, 0.39, 0.5, 0.75);
    };
    vend(12.6, '#f2f2f0', '#d0402a'); vend(13.7, '#c8202a', '#ffffff');
    block(12.0, 14.3, -0.8, -0.1, 0.25, 1.9);
    // the yellow tactile line along the pavement in front, 3 m out (the guiding kind: raised bars along the way)
    if (ground) for (let x = -7; x < 20; x += 0.3) {
      const [wx, wz] = S.toW(x, -3.2); if (ground.road(wx, wz) || ground.road(wx + S.nx * 0.4, wz + S.nz * 0.4)) continue;
      B(out, 'solid', x, 0.006, -3.2, 0.29, 0.012, 0.29, '#e8b400');
      for (const dz of [-0.09, -0.03, 0.03, 0.09]) B(out, 'solid', x, 0.016, -3.2 + dz, 0.25, 0.01, 0.025, '#f2c200');
    }
    // bicycles left by the wall, a little beyond: city bikes, each its basket, a few leaning
    for (let k = 0; k < 5; k++) this.bike(out, P, ry, -4.0 + k * 0.7, -1.0, R, light, S);
    for (const g of out.build()) { this.group.add(g); if (g.name !== 'glow') g.userData.cast = true; }   // (what stands outside casts the lamps' shadows)
    { const pm = packMat(atlasP.tex), a = packs.build(pm), b = packsOut.build(pm); if (a) this.group.add(a); if (b) { b.userData.cast = true; this.group.add(b); } }
    { const y = 0.012, w = 0.36, k = 0.58;                               // (the floor at each fixture's foot: a soft dark out from its edge)
      for (const [x0, x1, z0, z1] of this.fixtures) {
        if (z0 < 0.1 || z1 > D + 0.1 || x1 > W + 0.1) continue;
        const a = [x0 + 0.03, z0 + 0.03], b = [x1 - 0.03, z1 - 0.03];
        shade.quad(P(a[0], y, a[1]), P(b[0], y, a[1]), P(b[0] + w, y, a[1] - w), P(a[0] - w, y, a[1] - w), k, k, 0, 0);
        shade.quad(P(b[0], y, a[1]), P(b[0], y, b[1]), P(b[0] + w, y, b[1] + w), P(b[0] + w, y, a[1] - w), k, k, 0, 0);
        shade.quad(P(b[0], y, b[1]), P(a[0], y, b[1]), P(a[0] - w, y, b[1] + w), P(b[0] + w, y, b[1] + w), k, k, 0, 0);
        shade.quad(P(a[0], y, b[1]), P(a[0], y, a[1]), P(a[0] - w, y, a[1] - w), P(a[0] - w, y, b[1] + w), k, k, 0, 0);
      }
      this.group.add(shade.build()); }
    const roomMeshes = room.build(), rm = roomMat();
    for (const g of roomMeshes) { if (g.name !== 'glow') g.material = rm; this.group.add(g); }
    // ---- the doors: two glass panels in frames, sliding apart as you come
    this.doors = [];
    for (const s of [-1, 1]) {
      const g = new THREE.Group(), dk = new Kit(), w = 1.0;
      dk.box('metal', w, 0.06, 0.06, at(0, 2.6, 0), fr); dk.box('metal', w, 0.08, 0.06, at(0, 0.04, 0), fr); dk.box('metal', 0.06, 2.6, 0.06, at(-w / 2, 1.3, 0), fr); dk.box('metal', 0.06, 2.6, 0.06, at(w / 2, 1.3, 0), fr);
      for (const m of dk.build()) g.add(m);
      const gp = new THREE.Mesh(sized(new THREE.PlaneGeometry(w - 0.08, 2.5), w - 0.08, 2.5).translate(0, 1.3, 0), gM); gp.renderOrder = 6; gp.userData.noInk = true; g.add(gp);
      const x0 = 9.0 + s * 0.5, [wx, , wz] = P(x0, 0, GZ - 0.03);
      g.position.set(wx, Y0, wz); g.rotation.y = ry; this.group.add(g); this.doors.push({ g, s, x0 });
    }
    this.open = 0;
    // ---- its light: out across the pavement from the glass, white; the dark where the bins and machines stand
    { const [wx, , wz] = P(W / 2, 0, 0); light.pool(wx, wz, S.nx, S.nz, 8.5, 12.5, 17, col('#eef3ff', 1.35)); }
    { const [wx, , wz] = P(11.2, 0, -0.42); light.shadeOBB(wx, wz, S.ux, S.uz, 0.85, 0.22, 0.4, 0.7); }
    // its walls stop you; the glass front too, but for the doorway
    block(0.0, 7.95, -0.15, -0.05, 0.25, 0); block(10.05, W, -0.15, -0.05, 0.25, 0);   // (the glass: you, not the camera — it looks in through it)
  }
  // a city bike, standing across the pavement at (x, z) of the store's frame
  bike(K, P, ry, x, z, R, light, S) {
    const frameC = R.pick(['#e8e8ea', '#2a2f3a', '#9fb7c9', '#c8202a', '#e8dcc0', '#3a7a3f']), lean = (R() - 0.5) * 0.16, yaw = ry + (R() - 0.5) * 0.12;   // (front wheel out to the street)
    const [bx, by, bz] = P(x, 0, z), M = new THREE.Matrix4().compose(new THREE.Vector3(bx, by, bz), new THREE.Quaternion().setFromEuler(new THREE.Euler(lean, yaw, 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
    const put = (g, c, kind = 'solid') => { g.applyMatrix4(M); K.add(kind, g, null, c); };
    const r = 0.33;
    for (const zz of [-0.52, 0.52]) {
      put(new THREE.TorusGeometry(r, 0.022, 6, 24).rotateY(Math.PI / 2).translate(0, r, zz), '#16171a');
      put(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 8).rotateZ(Math.PI / 2).translate(0, r, zz), '#9aa0a8', 'metal');
      for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; put(new THREE.BoxGeometry(0.004, r * 1.9, 0.004).rotateX(a).translate(0, r, zz), '#b8bec6', 'metal'); }
    }
    const bar = (a, b, s = 0.032) => { const d = new THREE.Vector3().subVectors(b, a), L = d.length(); const g = new THREE.CylinderGeometry(s / 2, s / 2, L, 6); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); put(g, frameC, 'metal'); };
    const V = (y, zz) => new THREE.Vector3(0, y, zz);
    bar(V(r, -0.52), V(0.36, -0.05)); bar(V(0.36, -0.05), V(r, 0.52)); bar(V(0.36, -0.05), V(0.8, -0.18)); bar(V(r, -0.52), V(0.8, -0.18)); bar(V(0.36, -0.05), V(0.82, 0.38)); bar(V(0.82, 0.38), V(r, 0.52));
    bar(V(0.82, 0.38), V(1.02, 0.36), 0.03); put(new THREE.BoxGeometry(0.56, 0.025, 0.025).translate(0, 1.03, 0.34), '#2a2c30');                 // (the bars)
    put(new THREE.BoxGeometry(0.17, 0.06, 0.26).translate(0, 0.84, -0.2), '#1c1e22');                                                             // (the saddle)
    put(new THREE.BoxGeometry(0.36, 0.22, 0.3).translate(0, 0.86, 0.7), '#3a3d42', 'metal');                                                       // (the basket)
    put(new THREE.BoxGeometry(0.1, 0.32, 0.9).translate(0.16, r + 0.18, -0.15), frameC);                                                         // (the chain guard)
    light.shadeOBB(bx, bz, S.ux, S.uz, 0.15, 0.75, 0.35, 0.45);
  }
  // the one at the till: a young woman (the townsfolk's npc12, as VRoid made her) in the store's blue uniform shirt,
  // a name badge on it, standing between the counter and the cigarettes; she breathes, shifts, and turns her head to
  // you while you are in the store
  async addClerk(scene) {
    const a = await Avatar.load(scene, './assets/npc/npc12.vrm', './assets/anim/ual-standard.glb', null).catch(e => { console.error('clerk', e); return null; });
    if (!a) return null;
    for (const l of [a.hemi, a.moon, a.warm]) l.visible = false;           // (lit by your lights, as you are: there is one set)
    a.root.scale.setScalar(1.6 / a.height);                               // (npc12 is made small, 1.45 m: a grown woman's height behind the counter)
    for (const m of materials(a.vrm)('Tops')) tint(m, [52, 112, 196], { keep: 0.86 });
    const [x, z] = this.site.toW(11.42, 5.15);   // (beside the till, clear of the hot case)
    a.place(x, KB.Y0, z, Math.atan2(-this.site.ux, -this.site.uz)); a.setRoom(true);
    const chest = a.vrm.humanoid.getRawBoneNode('upperChest') || a.vrm.humanoid.getRawBoneNode('chest');
    if (chest) { const badge = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.006), new THREE.MeshBasicMaterial({ color: 0xf4f4f0 })); badge.position.set(0.07, 0.03, 0.13); chest.add(badge); }
    this.clerk = a; return a;
  }
  clerkUpdate(dt, t, hero, inside) {
    const a = this.clerk; if (!a) return;
    const face = Math.atan2(-this.site.ux, -this.site.uz), look = inside ? Math.atan2(hero.x - a.pos.x, hero.z - a.pos.z) : face;
    a.update(dt, t, 0, 0, null, look, null);
  }
  // is (wx, wz) inside something in the store taller than y − 0.3 (with pad round it)? (for the camera)
  fixtureAt(wx, wz, pad, y) {
    const [x, z] = this.site.toL(wx, wz);
    if (x < -1 - pad || x > KB.W + 3 || z < -1.5 || z > KB.D + pad) return false;
    for (const [x0, x1, z0, z1, top] of this.fixtures) if (top > y - 0.3 && x > x0 - pad && x < x1 + pad && z > z0 - pad && z < z1 + pad) return true;
    return false;
  }
  // each frame: the doors open as you come near, close behind you; are you inside?
  update(dt, hero) {
    const [x, z] = this.site.toL(hero.x, hero.z), near = Math.abs(x - 9.0) < 2.2 && z > -2.6 && z < 1.8 ? 1 : 0;
    this.open += (near - this.open) * Math.min(1, dt * (near ? 5 : 2.5));
    const k = this.open * this.open * (3 - 2 * this.open);
    for (const d of this.doors) { const [wx, wz] = this.site.toW(d.x0 + d.s * k * 0.95, -0.05); d.g.position.x = wx; d.g.position.z = wz; }
    return this.site.inside(hero.x, hero.z);
  }
}
