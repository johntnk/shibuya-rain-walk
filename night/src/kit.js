// The kit everything built by hand is made with: pieces (boxes, cylinders, panels, beams) placed by a matrix,
// coloured, gathered by what they are made of and merged — a few draws for a whole street of things.
//   solid  painted things lit as the street is (toon)
//   metal  the same, a little brighter on top (steel, aluminium)
//   glow   things that give light: lamp glass, lit panels, LEDs (their colour, bright)
//   dark   glass seen at night where nothing behind it is lit: the sky in it
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toon, glowMat, col, U, GLSL_COMMON } from './materials.js';

const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(), P = new THREE.Vector3();
export const at = (x, y, z, ry = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(P.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz, 'YXZ')), S.set(sx, sy, sz));

export class Kit {
  constructor() { this.parts = new Map(); }
  add(kind, geo, matrix, color, layer = 0) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (matrix) g.applyMatrix4(matrix);
    const c = color.isColor ? color : col(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    const key = kind + '|' + layer;
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key).push(g);
    return this;
  }
  box(kind, w, h, d, matrix, color, layer) { return this.add(kind, new THREE.BoxGeometry(w, h, d), matrix, color, layer); }
  // a box standing on (x, y, z), turned ry
  block(kind, x, y, z, w, h, d, color, ry = 0, layer) { return this.box(kind, w, h, d, at(x, y + h / 2, z, ry), color, layer); }
  cyl(kind, r0, r1, h, matrix, color, seg = 12, layer) { return this.add(kind, new THREE.CylinderGeometry(r0, r1, h, seg), matrix, color, layer); }
  // a beam from a to b, s square
  beam(kind, a, b, s, color, layer, round = false) {
    const d = new THREE.Vector3().subVectors(b, a), L = d.length(); if (L < 1e-4) return this;
    const g = round ? new THREE.CylinderGeometry(s / 2, s / 2, L, 8) : new THREE.BoxGeometry(s, L, s);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return this.add(kind, g, new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)), color, layer);
  }
  build() {
    const out = [], mats = Kit.materials();
    for (const [key, list] of this.parts) {
      const [kind, layer] = key.split('|'), g = mergeGeometries(list); list.forEach(x => x.dispose());
      const m = new THREE.Mesh(g, mats[kind]); m.matrixAutoUpdate = false; m.layers.set(+layer); m.name = kind;
      if (kind === 'glow') m.userData.noInk = false;
      out.push(m);
    }
    this.parts.clear();
    return out;
  }
  static materials() {
    return Kit._m ||= {
      solid: toon({ name: 'solid' }),
      metal: toon({ name: 'metal', defines: { METAL: 1 } }),
      glow: glowMat({ vcol: true, k: 1.0 }),
      dark: darkGlass(),
      solid2: toon({ name: 'solid2', side: THREE.DoubleSide }),
    };
  }
}

// glass at night with nothing lit behind it: the sky and the street's glow in it, darker looked into straight
function darkGlass() {
  return new THREE.ShaderMaterial({
    name: 'darkglass', uniforms: { ...U },
    vertexShader: `attribute vec3 color; varying vec3 vC, vN, vW; void main(){ vC = color; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${GLSL_COMMON} varying vec3 vC, vN, vW;
      void main(){ vec3 n = normalize(vN), V = normalize(cameraPosition - vW); float up = reflect(-V, n).y;
        vec3 sky = mix(uHaze * 0.9, uSky * 0.6, smoothstep(-0.1, 0.5, up)) + streetLight(vW, n) * 0.25;
        float fres = 0.1 + 0.9 * pow(1.0 - abs(dot(V, n)), 4.0);
        gl_FragColor = vec4(fogIt(vC * 0.15 + sky * mix(0.5, 1.0, fres), vW), 1.0); }`,
  });
}
