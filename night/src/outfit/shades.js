// Sunglasses for a woman of style: a cat-eye frame of glossy black acetate (bold along the brow, fine below, the
// outer corners swept up), wrapped a little round the face, with dark lenses that really shine — a curved glass
// in a physical material, so a lamp's highlight slides across it as the light or the head moves, and a soft
// reflection of the sky and the lit windows in it. VRoid's anime eyes are far bigger than a real eye, and a lens
// that covered them would cover half the face: so behind the dark glass the eyes are shut (the lids close the
// opening, nothing shows through), and the frame is sized to the face instead. Whoever later makes the townsfolk
// blink must leave her be: vrm.scene.userData.shades is set.
import * as THREE from 'three';
import { attach } from './kit.js';
import { each } from './wear.js';

// the night it reflects: a deep blue sky with a glow along the horizon, the snow underfoot paler than the sky,
// warm lamps and lit windows at eye height all round, a cool moonlit patch overhead. (Straight on, a lens gives
// back what's in front of the face — the street at eye height and the snow — so that's where the light must be.)
let envCache = null;
function sky() {
  if (envCache) return envCache;
  const W = 1024, H = 512, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'), img = g.createImageData(W, H), d = img.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = y / H, el = (0.5 - v) * Math.PI, i = (y * W + x) * 4; let c;
    if (el > 0) { const t = Math.pow(Math.sin(el), 0.5); c = [120 + (26 - 120) * t, 126 + (36 - 126) * t, 150 + (66 - 150) * t]; }
    else { const t = Math.pow(-Math.sin(el), 0.7); c = [176 + (120 - 176) * t, 182 + (128 - 182) * t, 200 + (150 - 200) * t]; }   // (snow)
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // crisp shapes, not soft blobs (soft ones read as frosted glass): dark house fronts along the street with lit
  // windows in them, lamps as small bright points, the moon
  const hy = H / 2;
  for (const [u, w, h] of [[0.6, 0.07, 0.07], [0.69, 0.05, 0.09], [0.76, 0.08, 0.06], [0.86, 0.06, 0.08], [0.95, 0.07, 0.07], [0.48, 0.06, 0.08], [0.38, 0.08, 0.06], [0.22, 0.07, 0.08], [0.08, 0.06, 0.07]]) {
    g.fillStyle = '#2a2e3c'; g.fillRect((u - w / 2) * W, hy - h * H, w * W, h * H);
    g.fillStyle = '#ffd59a'; for (let k = 0; k < 3; k++) { const wx = (u - w / 2 + w * (0.15 + 0.28 * k)) * W, wy = hy - h * H * 0.75; g.fillRect(wx, wy, w * W * 0.16, h * H * 0.32); }
  }
  for (const u of [0.65, 0.73, 0.81, 0.91, 0.53, 0.43, 0.3, 0.15]) { const x = u * W, y = hy - 0.11 * H; const rg = g.createRadialGradient(x, y, 0, x, y, 9); rg.addColorStop(0, '#fff6e0'); rg.addColorStop(0.35, '#ffe2a8'); rg.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = rg; g.fillRect(x - 9, y - 9, 18, 18); }
  g.fillStyle = '#e8eef8'; g.beginPath(); g.arc(0.75 * W, 0.17 * H, 10, 0, Math.PI * 2); g.fill();
  envCache = new THREE.CanvasTexture(cv); envCache.mapping = THREE.EquirectangularReflectionMapping; envCache.colorSpace = THREE.SRGBColorSpace; return envCache;
}
// the lens's mirror: darkest at the top, a smoky brown-grey towards the bottom (as metal, this is how much it gives back)
let gradCache = null;
function grad() {
  if (gradCache) return gradCache;
  const cv = document.createElement('canvas'); cv.width = 4; cv.height = 64; const g = cv.getContext('2d'), lg = g.createLinearGradient(0, 0, 0, 64);
  lg.addColorStop(0, '#2a2a30'); lg.addColorStop(0.5, '#38363e'); lg.addColorStop(1, '#4e4648'); g.fillStyle = lg; g.fillRect(0, 0, 4, 64);
  gradCache = new THREE.CanvasTexture(cv); gradCache.colorSpace = THREE.SRGBColorSpace; return gradCache;
}

// the cat-eye outline, on the lens's own half-width and half-height (u out towards the temple, v up)
const CAT = [[-0.92, 0.36], [-0.55, 0.62], [0, 0.66], [0.5, 0.78], [0.86, 0.98], [1.02, 0.66], [0.94, 0.08], [0.64, -0.55], [0.16, -0.88], [-0.38, -0.84], [-0.8, -0.48], [-1, -0.04]];
// a triangle soup's faces turned round (its 2nd and 3rd corners swapped, in every attribute)
function flip(g) { for (const at of Object.values(g.attributes)) { const n = at.itemSize, A = at.array; for (let k = 0; k < at.count; k += 3) for (let c = 0; c < n; c++) { const t = A[(k + 1) * n + c]; A[(k + 1) * n + c] = A[(k + 2) * n + c]; A[(k + 2) * n + c] = t; } at.needsUpdate = true; } }
// a narrow rectangle with rounded corners, a little deeper at the outer end (the slim nineties kind)
const RECT = [[-0.98, 0.55], [-0.6, 0.72], [0, 0.74], [0.6, 0.76], [0.95, 0.72], [1.04, 0.3], [1.0, -0.35], [0.8, -0.72], [0.2, -0.78], [-0.5, -0.74], [-0.92, -0.55], [-1.02, 0]];
const outline = (n, shape = CAT) => new THREE.CatmullRomCurve3(shape.map(([u, v]) => new THREE.Vector3(u, v, 0)), true, 'centripetal').getSpacedPoints(n).slice(0, n);

// width / height: one lens across and top to bottom (m); wrap: how far round the face it curves; base: the lens's
// own curve across (its radius, m; twice as tight top to bottom) — what lets a highlight travel over it
export function shades(av, { width = 0.056, height = 0.036, wrap = 3.5, base = 0.1, frame = 0x0c0c0e, shape = 'cat' } = {}) {   // (shape: 'cat' (cat-eye) or 'rect' (slim rectangles))
  const vrm = av.vrm, h = vrm.humanoid; vrm.scene.updateMatrixWorld(true);
  const hd = h.getRawBoneNode('head').getWorldPosition(new THREE.Vector3());
  const eyes = { '-1': { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 }, 1: { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9 } };
  each(vrm, /EyeWhite|EyeIris/, (x, y) => { const e = eyes[x < hd.x ? -1 : 1]; e.x0 = Math.min(e.x0, x); e.x1 = Math.max(e.x1, x); e.y0 = Math.min(e.y0, y); e.y1 = Math.max(e.y1, y); });
  if (eyes[1].x1 < eyes[1].x0 || eyes[-1].x1 < eyes[-1].x0) return;
  const ex = (Math.abs((eyes[1].x0 + eyes[1].x1) / 2 - hd.x) + Math.abs((eyes[-1].x0 + eyes[-1].x1) / 2 - hd.x)) / 2, ey = (eyes[1].y0 + eyes[1].y1 + eyes[-1].y0 + eyes[-1].y1) / 4;
  let zf = -1e9; each(vrm, /Face_00_SKIN/, (x, y, z) => { if (Math.abs(y - ey) < 0.03 && Math.abs(x - hd.x) < ex + 0.03) zf = Math.max(zf, z); });
  const z0 = (zf > -1e8 ? zf : hd.z + 0.08) + 0.006, a = width / 2, b = height / 2, cx = ex - 0.008, cy = ey + 0.002;   // (drawn in a little from the eyes' centres: a short bridge)
  // the eyes shut behind the glass, and the lash and eyeliner strokes (drawn over the skin) put away
  vrm.expressionManager?.setValue('blink', 1); vrm.expressionManager?.update?.();
  vrm.scene.traverse(o => { if (o.isMesh && [].concat(o.material).some(m => /FaceEyelash|FaceEyeline/.test(m.name || ''))) o.visible = false; });
  vrm.scene.userData.shades = true;
  // how far back round the face a point of the glasses sits, by how far out it is from the bridge
  const wz = X => -wrap * X * X, tilt = Math.tan(8 * Math.PI / 180);   // (and the glass turned up a few degrees: lamps above catch in it)
  const env = sky(), acetate = new THREE.MeshPhysicalMaterial({ color: frame, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.04, envMap: env, envMapIntensity: 0.55 });
  const glass = new THREE.MeshPhysicalMaterial({ map: grad(), roughness: 0.03, metalness: 1, clearcoat: 1, clearcoatRoughness: 0.02, envMap: env, envMapIntensity: 1.0 });   // (a smoke mirror coating: plain dark glass gives back only 4% of the light, too little to see)
  // a dark lens gives back so little light that a lamp's own highlight on it all but vanishes: so each light also
  // lays a glint on the glass — a small sharp-edged streak, drawn out sideways as the lens's curve draws it — that slides over it as the light or the head
  // moves (the town's lamps as much as this page's). Worked out on a lens curved far more than this one (each
  // vertex's 'glint normal'), and turned up a little: a real lens, with the head bowed, almost never catches a
  // lamp overhead, and the spot would hardly ever show.
  glass.onBeforeCompile = sh => {
    const was = 'reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );';
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 glintNormal;\nvarying vec3 vGlintN;')
      .replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\nvGlintN = normalize( normalMatrix * glintNormal );');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGlintN;')
      .replace('#include <lights_physical_pars_fragment>', THREE.ShaderChunk.lights_physical_pars_fragment.replace(was, was +
        '\n\t{ vec3 sq = vec3( 0.32, 1.0, 1.0 ), h = normalize( directLight.direction + geometryViewDir ); float nh = dot( normalize( vGlintN * sq ), normalize( h * sq ) ); reflectedLight.directSpecular += directLight.color * ( 1.6 * smoothstep( 0.9980, 0.9989, nh ) + 0.04 * smoothstep( 0.994, 0.998, nh ) ); }'));
  };
  glass.customProgramCacheKey = () => 'shades-glint';
  const grp = new THREE.Group(), N = 96, ring = outline(N, shape === 'rect' ? RECT : CAT);
  let area = 0; for (let i = 0; i < N; i++) { const p = ring[i], q = ring[(i + 1) % N]; area += p.x * q.y - q.x * p.y; } const turn = area < 0 ? 1 : -1;   // (which way round the outline runs: the outside is on its left if clockwise)
  for (const s of [1, -1]) {
    const X = (u) => hd.x + s * (cx + u * a), Y = v => cy + v * b;
    // the lens: rings from its middle out to the outline, bent to the face's wrap and its own curve
    const pos = [], uv = [], idx = [], R = 10, mid = [0.02, -0.04];
    for (let r = 0; r <= R; r++) for (let i = 0; i < N; i++) {
      const t = r / R, u = mid[0] + (ring[i].x - mid[0]) * t, v = mid[1] + (ring[i].y - mid[1]) * t, x = X(u), y = Y(v), dx = (u * a), dy = (v * b);
      pos.push(x, y, z0 + wz(x - hd.x) - dx * dx / (2 * base) - dy * dy / base - dy * tilt); uv.push(0.5, (v + 1) / 2);
    }
    for (let r = 0; r < R; r++) for (let i = 0; i < N; i++) { const p = r * N + i, q = r * N + (i + 1) % N; idx.push(p, p + N, q, q, p + N, q + N); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); lg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); lg.setIndex(idx); lg.computeVertexNormals();
    if (lg.attributes.normal.getZ(0) < 0) { for (let k = 0; k < idx.length; k += 3) [idx[k + 1], idx[k + 2]] = [idx[k + 2], idx[k + 1]]; lg.setIndex(idx); lg.computeVertexNormals(); }   // (facing out, whichever side it's on)
    { const Nn = lg.attributes.normal, c = new THREE.Vector3().fromBufferAttribute(Nn, 0), n = new THREE.Vector3(), gn = [];   // (the glint normals: each one's lean from the lens's middle, made 2.6 times as much, and the lot turned up a touch)
      for (let i = 0; i < Nn.count; i++) { n.fromBufferAttribute(Nn, i).sub(c).multiplyScalar(2.6).add(c); n.y += 0.06; n.normalize(); gn.push(n.x, n.y, n.z); }
      lg.setAttribute('glintNormal', new THREE.Float32BufferAttribute(gn, 3)); }
    const lens = new THREE.Mesh(lg, glass); lens.userData.noInk = true; grp.add(lens);
    // the frame: a band round the lens, bold along the top and fine below, with a little depth and a rounded edge
    const outer = new THREE.Shape(), hole = new THREE.Path();
    ring.forEach((p, i) => { const prev = ring[(i + N - 1) % N], next = ring[(i + 1) % N], tx = (next.x - prev.x) * a, ty = (next.y - prev.y) * b; let nx = -ty * turn, ny = tx * turn; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;   // (outwards, on the lens's own scale)
      const w = shape === 'rect' ? 0.0034 : 0.0016 + 0.0028 * Math.max(0, p.y) ** 1.5 + 0.0012 * Math.max(0, p.x) * Math.max(0, p.y);   // (thickest up at the swept corner; a slim rectangle's frame thick all round)
      const ox = p.x * a + nx * w, oy = p.y * b + ny * w, ix = p.x * a - nx * 0.0004, iy = p.y * b - ny * 0.0004;
      if (i) { outer.lineTo(ox, oy); hole.lineTo(ix, iy); } else { outer.moveTo(ox, oy); hole.moveTo(ix, iy); } });
    outer.holes.push(hole);
    const fg = new THREE.ExtrudeGeometry(outer, { depth: 0.0024, bevelEnabled: true, bevelThickness: 0.0006, bevelSize: 0.0005, bevelSegments: 2, curveSegments: 1 }), FP = fg.attributes.position;
    for (let i = 0; i < FP.count; i++) { const lx = FP.getX(i), ly = FP.getY(i), x = hd.x + s * (cx + lx); FP.setXYZ(i, x, cy + ly, z0 + 0.0008 + wz(x - hd.x) - lx * lx / (2 * base) - ly * ly / base - ly * tilt - FP.getZ(i)); }
    if (s > 0) flip(fg);                                                              // (turned front to back, and on this side not mirrored back: the faces want turning round)
    fg.computeVertexNormals();
    grp.add(new THREE.Mesh(fg, acetate));
    // the arm, from the swept-up corner back over the ear
    const ax = hd.x + s * (cx + 1.0 * a + 0.002), ay = cy + 0.62 * b, az = z0 + wz(ax - hd.x) - 0.003;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.0026, 0.0042, 0.1).translate(0, 0, -0.05), acetate); arm.position.set(ax, ay, az); arm.rotation.y = -s * 0.1; grp.add(arm);
  }
  // the bridge: a fine arch over the nose between the two inner corners
  const ix = cx - 0.92 * a, iy = cy + 0.36 * b + 0.001, iz = z0 + 0.001 + wz(0);
  const br = new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(hd.x - ix, iy, iz), new THREE.Vector3(hd.x, iy + 0.004, iz + 0.002), new THREE.Vector3(hd.x + ix, iy, iz)), 16, 0.0016, 8, false), acetate);
  grp.add(br);
  attach(av, 'head', grp); return grp;
}
