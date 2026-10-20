// The warm light on the snow, painted once from above into a half-float texture:
//   pool()   light falling out of a window: starts at the wall, widens and fades away from it;
//   radial() a lamp's round pool;
//   shade()  contact shadow around a house's footprint, into the alpha channel (the snow darkens
//            where it meets the walls, and the walls darken toward the snow).
// Every surface shader samples this texture at its own x/z (fading with height), so the window light
// really lands on the snow in front of the house, on the banks, steps and the neighbours' walls.
import * as THREE from 'three';

export class LightPainter {
  constructor() { this.q = []; }
  shade(x0, x1, z0, z1, m = 1.7, k = 0.85) {                     // footprint rectangle, margin, strength
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, hx = (x1 - x0) / 2, hz = (z1 - z0) / 2;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]])
      this.q.push(cx + a * (hx + m), cz + b * (hz + m), a * (hx + m), b * (hz + m), 2, k, hx, hz, m);
  }
  // the same round a turned footprint: centre, the unit along its width (ux, uz), half-sides hx (along) and hz (across)
  shadeOBB(cx, cz, ux, uz, hx, hz, m = 1.7, k = 0.85) {
    const vx = -uz, vz = ux;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const lu = a * (hx + m), lv = b * (hz + m);
      this.q.push(cx + ux * lu + vx * lv, cz + uz * lu + vz * lv, lu, lv, 2, k, hx, hz, m);
    }
  }
  radial(x, z, r, c) {
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) this.q.push(x + a * r, z + b * r, a, b, 0, 1, c.r, c.g, c.b);
  }
  // (x, z) wall foot, (ux, uz) outward unit, len metres, w0 width at the wall, w1 at the far end
  pool(x, z, ux, uz, len, w0, w1, c, start = 0) {
    const tx = -uz, tz = ux, k = w0 / w1;
    for (const [a, b] of [[-0.15, -1], [1, -1], [1, 1], [-0.15, 1]]) {
      const d = start + a * len, s = b * w1 / 2;
      this.q.push(x + ux * d + tx * s, z + uz * d + tz * s, a, b, 1, k, c.r, c.g, c.b);
    }
  }
  bake(renderer, box, w = 2048, h = 1024) {
    const n = this.q.length / 9, nq = n / 4;
    const pos = new Float32Array(n * 3), loc = new Float32Array(n * 2), sh = new Float32Array(n * 2), cc = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const o = i * 9;
      pos.set([this.q[o], this.q[o + 1], 0], i * 3); loc.set([this.q[o + 2], this.q[o + 3]], i * 2);
      sh.set([this.q[o + 4], this.q[o + 5]], i * 2); cc.set([this.q[o + 6], this.q[o + 7], this.q[o + 8]], i * 3);
    }
    const idx = [];
    for (let i = 0; i < nq; i++) idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aLocal', new THREE.BufferAttribute(loc, 2));
    g.setAttribute('aShape', new THREE.BufferAttribute(sh, 2)); g.setAttribute('aCol', new THREE.BufferAttribute(cc, 3));
    g.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uBox: { value: box } }, depthTest: false, depthWrite: false, transparent: true,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
      vertexShader: `attribute vec2 aLocal, aShape; attribute vec3 aCol; uniform vec4 uBox; varying vec2 vL, vS; varying vec3 vC;
        void main(){ vL = aLocal; vS = aShape; vC = aCol; vec2 uv = (position.xy - uBox.xy) / uBox.zw; gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0); }`,
      fragmentShader: `varying vec2 vL, vS; varying vec3 vC;
        void main(){
          float v;
          if (vS.x > 1.5) {                                        // contact shadow: distance to the footprint
            vec2 dd = max(abs(vL) - vC.xy, 0.0); float dist = length(dd);
            float a = (1.0 - smoothstep(0.0, vC.z, dist)); a *= a;
            gl_FragColor = vec4(0.0, 0.0, 0.0, a * vS.y); return;
          }
          if (vS.x < 0.5) { float d2 = dot(vL, vL); v = exp(-2.6 * d2) * clamp(1.0 - d2, 0.0, 1.0); }
          else {
            float a = vL.x, half_ = mix(vS.y, 1.0, clamp(a, 0.0, 1.0));
            float acr = abs(vL.y) / half_;
            v = exp(-2.3 * max(a, 0.0)) * smoothstep(-0.15, 0.04, a) * (1.0 - smoothstep(0.45, 1.0, acr)) * (1.0 - smoothstep(0.8, 1.0, a));
          }
          gl_FragColor = vec4(vC * v, 0.0);
        }`,
    });
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    const scene = new THREE.Scene(), mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; scene.add(mesh);
    const prev = renderer.getRenderTarget(), cl = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, new THREE.Camera());
    renderer.setRenderTarget(prev); renderer.setClearColor(cl, ca);
    g.dispose(); mat.dispose();
    this.rt = rt; this.box = box;
    return rt.texture;
  }
  // the same light, read back once, so things lit by three.js lights (the VRoid character) can be lit by it too:
  // returns (x, z) => [r, g, b], the warm light on the ground there (world units, bilinear)
  sampler(renderer) {
    const rt = this.rt, w = rt.width, h = rt.height, px = new Uint16Array(w * h * 4), box = this.box;
    renderer.readRenderTargetPixels(rt, 0, 0, w, h, px);
    const f = THREE.DataUtils.fromHalfFloat, at = (i, j, c) => f(px[(Math.min(h - 1, Math.max(0, j)) * w + Math.min(w - 1, Math.max(0, i))) * 4 + c]);
    return (x, z, out = [0, 0, 0]) => {
      const u = (x - box.x) / box.z * w - 0.5, v = (z - box.y) / box.w * h - 0.5, i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
      for (let c = 0; c < 3; c++) out[c] = (at(i, j, c) * (1 - fu) + at(i + 1, j, c) * fu) * (1 - fv) + (at(i, j + 1, c) * (1 - fu) + at(i + 1, j + 1, c) * fu) * fv;
      return out;
    };
  }
}
