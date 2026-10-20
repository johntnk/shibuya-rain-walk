// 渋谷 — the Scramble Crossing and the roof of Shibuya Scramble Square, to walk round in the anime look of the
// Norwegian town: the real streets and buildings (OpenStreetMap), the towers lit floor by floor, shop fronts and
// screens, the crowd and the traffic keeping the crossing's rhythm; from the street, in at the tower's door and up in
// the lift (SKY GATE) to SHIBUYA SKY 229 m up, its escalator rising open to the sky — at sunset, or on a wet night.
// Everything is made here in the browser.
import './fastgeo.js';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { U } from './materials.js';
import { loadLayout } from './layout.js';
import { Ground } from './ground.js';
import { City } from './city.js';
import { LightPainter } from './lightpaint.js';
import { makeSky } from './sky.js';
import { Mirror, PlaneMirror, GLASS_LAYER } from './reflect.js';
import { InkPass } from './ink.js';
import { Avatar } from './avatar.js';
import { Follow } from './follow.js?v=r17-20261016';
import { Atlas, SignKit } from './signs.js';
import { Screens } from './screens.js';
import { NearSigns, NEAR_BOX } from './nearsigns.js';
import { Konbini, KB } from './konbini.js';
import { Ripples } from './ripples.js';
import { Landmarks } from './landmarks.js';
import { Glows } from './glow.js';
import { Kit, at } from './kit.js';
import { Street } from './street.js';
import { Crowd } from './crowd.js';
import { Traffic } from './traffic.js';
import { Rain } from './rain.js';
import { Umbrella } from './umbrella.js';
import { CrossingLight } from './crosslight.js';
import { CityAudio } from './audio.js';
import { mountManualRecording } from './manual-recording.js';
import { TimeOfDay, PRESETS, MOODS } from './timeofday.js';
import { FarCity } from './farcity.js';
import { SkyStage, SKY, RUN, stairY } from './skystage.js';
import { SunShadow, LampShadow, castShadow, SHADOW_LAYER } from './shadow.js';
import { nearest } from './geom.js';

const params = new URLSearchParams(location.search);
const $ = id => document.getElementById(id);

// ---------------------------------------------------------------- renderer, camera
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: params.get('shots') === '1' });
renderer.setPixelRatio(Math.min(devicePixelRatio, Number(params.get('dpr') || 1.5)));   // (adapt() below brings it down if the frames run slow)
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.12, 9000);
camera.layers.enable(1);
window.__dbg = { camera, scene, THREE, U, renderer };

// ---------------------------------------------------------------- the city
const L = await loadLayout('./data/shibuya.json');
const BOX = [-220, -220, 440, 440];
const light = new LightPainter();
const ground = new Ground(L, { box: BOX });
scene.add(ground.group);
// the buildings made by hand (landmarks.js) are left out of the plain ones
const HAND = new Set(['w136690966', 'w114755219', 'w904652357', ...L.buildings.filter(b => (b.h || 0) < 5 && (b.h || 0) > 4 && Math.hypot(b.c[0], b.c[1]) < 70 && b.a < 40).map(b => b.id)]);
const city = new City(L, light, { skip: HAND });
city.meshes.forEach(m => scene.add(m));
const atlas = new Atlas(4096), signs = new SignKit(atlas), screens = new Screens(atlas), screenLight = new LightPainter(), towerLights = [];
const marks = new Landmarks(L, { facade: city.facade, roof: city.roof, atlas, signs, screens, light, glows: towerLights });
scene.add(marks.group);
city.colliders.push(...marks.colliders);
const glows = new Glows(), RED = new THREE.Color(1.0, 0.08, 0.04).multiplyScalar(3);
const streetKit = new Kit(), street = new Street(ground, streetKit, light, glows, signs, atlas);
// SHIBUYA SKY on the tower's roof
const stage = new SkyStage(marks.scrambleTower); scene.add(stage.group);
const crossing = new CrossingLight(stage.beams, [stage.F.ux, stage.F.uz]); scene.add(crossing.mesh);   // (the searchlights' show: crosslight.js)
castShadow(stage.group); stage.deck.layers.disable(2); stage.glassMesh.layers.disable(2);
stage.group.traverse(o => { if ((o.isMesh || o.isInstancedMesh) && !o.userData.noMirror) o.layers.enable(GLASS_LAYER); }); stage.glassMesh.layers.disable(GLASS_LAYER);
// the ways in: at Hachikō square the station's passage through to the tower (signposted), and the tower's own door
const SQ = marks.scrambleTower.pts;
const doorB = nearest(SQ, 113, 101), doorA = { x: 42.65, z: 35.5, nx: -1, nz: 0 };
const ENTRANCES = [
  { x: doorA.x - 1.4, z: doorA.z, face: Math.PI / 2, label: '进入 渋谷スクランブルスクエア 直结通道（乘电梯去 SHIBUYA SKY）' },
  { x: doorB.x + doorB.nx * 1.4, z: doorB.z + doorB.nz * 1.4, face: Math.atan2(doorB.nx, doorB.nz), label: '进入 渋谷スクランブルスクエア（乘电梯去 SHIBUYA SKY）' },
];
{ // their doors and signs
  const K = streetKit;
  K.box('glow', 3.2, 2.6, 0.06, at(doorA.x + 0.05, 1.45, doorA.z, Math.PI / 2), new THREE.Color(1.0, 0.9, 0.76).multiplyScalar(0.75));
  for (const dz of [-1.65, 0, 1.65]) K.box('metal', 0.12, 2.75, 0.1, at(doorA.x - 0.02, 1.52, doorA.z + dz), '#3b404a');
  K.box('metal', 0.14, 0.14, 3.45, at(doorA.x - 0.02, 2.82, doorA.z), '#3b404a');
  signs.box(at(doorA.x - 0.4, 4.0, doorA.z, -Math.PI / 2), 5.2, 0.9, 0.18, { pz: { r: atlas.add('SHIBUYA SKY ↗ スクランブルスクエア直結', { px: 80, weight: 700 }), fill: 0.92 } }, '#151a2a', '#ffd9a6', 1.1);
  const yb = Math.atan2(doorB.nx, doorB.nz);
  K.box('glow', 4.0, 3.0, 0.06, at(doorB.x + doorB.nx * 0.06, 1.65, doorB.z + doorB.nz * 0.06, yb), new THREE.Color(1.0, 0.9, 0.76).multiplyScalar(0.75));
  signs.box(at(doorB.x + doorB.nx * 0.3, 4.4, doorB.z + doorB.nz * 0.3, yb), 6.0, 1.0, 0.2, { pz: { r: atlas.add('SHIBUYA SKY  14F ⇧', { px: 84, weight: 700, font: 'Helvetica Neue' }), fill: 0.9 } }, '#151a2a', '#ffd9a6', 1.1);
  // on the roof: the gallery doors' sign, the lifts' building's name
  const ds = stage.doorSign; signs.box(at(ds.p.x, ds.p.y, ds.p.z, ds.yaw), 2.4, 0.42, 0.06, { pz: { r: atlas.add('46F  SKY GALLERY · 電梯', { px: 72, weight: 600 }), fill: 0.9 } }, '#1a1f2b', '#ffffff', 0.8);
  for (const g of stage.gallery.signs) signs.box(at(g.p.x, g.p.y, g.p.z, g.yaw), g.w, g.h, 0.03, { pz: { r: atlas.add(g.text, { px: 76, weight: g.neon ? 300 : 600, font: g.neon ? 'Snell Roundhand' : 'Helvetica Neue' }), fill: 0.88 } }, g.neon ? '#14070d' : '#101216', g.neon ? '#ff6fb2' : '#f2f4f8', g.neon ? 1.7 : 0.8);   // (the gallery's: skygallery.js)
  const cs = stage.coreSign; signs.box(at(cs.p.x, cs.p.y, cs.p.z, cs.yaw), 3.4, 0.5, 0.06, { pz: { r: atlas.add('THE ROOF', { px: 90, weight: 300, font: 'Helvetica Neue' }), fill: 0.86 } }, '#20242c', '#ffe2b8', 0.9);   // (the rooftop bar's sign)
}
// every block's signs and roof plant, the far streets' lamps and glow (nearsigns.js)
const nearSigns = new NearSigns(L, city, { signs, atlas, skipSigns: new Set(['w116806280', 'w138670889', 'w116806279']) }); scene.add(nearSigns.group);
// the convenience store on 渋谷駅前ビル's ground floor, to walk into (konbini.js)
const konbini = new Konbini(marks.konbini, { light, signs, atlas, ground }); scene.add(konbini.group);
const ripples = new Ripples(); scene.add(ripples.mesh);
await konbini.addClerk(scene);
city.facade.uniforms.uPack.value = konbini.atlas.tex; city.facade.uniforms.uPackOn.value = 1;   // (the shops' goods seen through their windows printed as the store's are) street.colliders.push(...konbini.colliders);
streetKit.build().forEach(m => { scene.add(m); if (m.name !== 'glow') m.layers.enable(SHADOW_LAYER); }); scene.add(street.lampMesh());   // (the street's things cast the lamps' shadows)
konbini.group.traverse(o => { if (o.isMesh && o.userData.cast) o.layers.enable(SHADOW_LAYER); });
// the lights the street's shadows are cast from: its lamps, and the store's front and its machines
const shadowLamps = [...street.lamps, ...[[6, -0.6], [12.6, -1.2], [13.7, -1.2]].map(([x, z]) => { const [wx, wz] = konbini.site.toW(x, z); return new THREE.Vector3(wx, 2.6, wz); })];
const signMesh = signs.build(); if (signMesh) scene.add(signMesh);
screens.setAtlas(atlas.texture());
screens.paint(screenLight);
for (const t of city.towerTops) for (const [x, z] of t.pts.filter((_, i) => i % 2 === 0)) glows.add(new THREE.Vector3(x, t.h + 0.6, z), RED, 1.4, 0);
for (const g of towerLights) glows.add(new THREE.Vector3(g.x, g.y, g.z), RED.clone().multiplyScalar(g.size ? 0.5 : 1), g.size ?? 1.6, 0);
const far = await FarCity.load('./data/farcity.json'); scene.add(far.group);
far.setNearGlow(nearSigns.glowTex, NEAR_BOX); nearSigns.points.material.uniforms.uScale = far.lightPoints.material.uniforms.uScale;
console.log('far city', JSON.stringify(far.stats));
scene.add(glows.build());
for (const b of L.buildings) {                                       // (the dark where every building meets the ground)
  if (b.part || (b.minh || 0) > 1 || Math.hypot(b.c[0], b.c[1]) > 220) continue;
  for (let i = 0; i < b.pts.length; i++) {
    const [x0, z0] = b.pts[i], [x1, z1] = b.pts[(i + 1) % b.pts.length], len = Math.hypot(x1 - x0, z1 - z0); if (len < 0.3) continue;
    light.shadeOBB((x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / len, (z1 - z0) / len, len / 2, 0.02, 1.1, 0.5);
  }
}
U.uLightTex.value = light.bake(renderer, new THREE.Vector4(BOX[0], BOX[1], BOX[2], BOX[3]), 2048, 2048);
U.uLightBox.value.set(BOX[0], BOX[1], BOX[2], BOX[3]);
U.uScreenTex.value = screenLight.bake(renderer, new THREE.Vector4(BOX[0], BOX[1], BOX[2], BOX[3]), 1024, 1024);
const sky = makeSky(); scene.add(sky);
const mirror = new Mirror(renderer, 0.5); mirror.on = params.get('refl') !== '0'; if (stage.deck) mirror.hide.push(stage.deck);
const sun = new SunShadow(renderer), lampShadow = new LampShadow(renderer);
const glassMirror = new PlaneMirror(renderer, 0.5); glassMirror.setPlane(stage.glassPlane.p, stage.glassPlane.n);
// 46F's mirror bay: its side wall a mirror of its own (the ceiling's is the glass mirror, re-aimed: pickMirror)
const sideMirror = new PlaneMirror(renderer, 0.5, (S => ({ tex: S.uSideTex, mat: S.uSideMat, on: S.uSideOn }))(stage.gallery.sideU)); { const m = stage.gallery.mirrorPlanes[1]; sideMirror.setPlane(m.p, m.n); sideMirror.all = true; }
window.__dbg.ground = ground; window.__dbg.city = city; window.__dbg.screens = screens; window.__dbg.street = street; window.__dbg.atlas = atlas; window.__dbg.mirror = mirror; window.__dbg.L = L; window.__dbg.stage = stage; window.__dbg.far = far; window.__dbg.glassMirror = glassMirror; window.__dbg.nearSigns = nearSigns; window.__dbg.konbini = konbini; window.__dbg.lampShadow = lampShadow; window.__dbg.crossing = crossing;

// ---------------------------------------------------------------- post: bloom, a gentle grade, the drawn line
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
// what is behind the glass, for the drops on it to see through (glassrain.js): the scene as just drawn, kept at half
// size for the next frame — a frame late, which no one can tell in a drop a few millimetres across
const behindRT = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, depthBuffer: false });
U.uBehind.value = behindRT.texture;
composer.addPass(new (class extends Pass {
  constructor() { super(); this.needsSwap = false; this.quad = new FullScreenQuad(new THREE.ShaderMaterial({ uniforms: { t: { value: null } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `uniform sampler2D t; varying vec2 vUv; bool bad(float x){ return (floatBitsToUint(x) & 0x7f800000u) == 0x7f800000u; }
      void main(){ vec3 c = texture2D(t, vUv).rgb; if (bad(c.r) || bad(c.g) || bad(c.b)) c = vec3(0.0); gl_FragColor = vec4(clamp(c, 0.0, 24.0), 1.0); }` })); }
  render(renderer, writeBuffer, readBuffer) { this.quad.material.uniforms.t.value = readBuffer.texture; renderer.setRenderTarget(behindRT); this.quad.render(renderer); }
  setSize(w, h) { behindRT.setSize(Math.max(2, w >> 1), Math.max(2, h >> 1)); }
})());
// a broken pixel (a shader's NaN or infinity: some GPUs, Safari's among them, make one where another wouldn't) must not
// reach the bloom, which spreads it into a great black block or a white blaze: each is replaced by black, and the
// brightest are held to a ceiling. Tested on the float's bits, which no fast-math compiler can optimise away.
composer.addPass(new ShaderPass({
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    bool bad(float x){ return (floatBitsToUint(x) & 0x7f800000u) == 0x7f800000u; }
    void main(){ vec4 c = texture2D(tDiffuse, vUv);
      if (bad(c.r) || bad(c.g) || bad(c.b)) c.rgb = vec3(0.0);
      gl_FragColor = vec4(clamp(c.rgb, 0.0, 24.0), 1.0); }`,
}));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.42, 0.4, 1.05);
composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uDay: U.uDay },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uDay; varying vec2 vUv;
    vec3 rgb2hsv(vec3 c){ vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0); vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g)); vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r)); float d = q.x - min(q.w, q.y); return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x); }
    vec3 hsv2rgb(vec3 c){ vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0); return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y); }
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb; float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      // the night as the reference video's: deep blue, white light, the warm of the shops — the dim purple cast (the blue
      // ambient mixed with the screens' pink, over the walls, the paving, the sky) drawn toward blue; the bright
      // signs and screens keep their colour
      { vec3 h = rgb2hsv(max(c, 0.0)); float pm = smoothstep(0.7, 0.78, h.x) * (1.0 - smoothstep(0.94, 0.99, h.x)), dim = 1.0 - smoothstep(0.25, 0.8, l), k = pm * dim * (1.0 - uDay);
        h.x = mix(h.x, 0.625, k * 0.7); h.y *= 1.0 - 0.25 * k; c = hsv2rgb(h); }
      c = max(mix(vec3(l), c, mix(1.14, 1.12, uDay)), 0.0);
      c += mix(vec3(0.002, 0.004, 0.012), vec3(0.004, 0.006, 0.014), uDay) * (1.0 - smoothstep(0.0, 0.12, l));   // (the dark leans blue, never black)
      vec2 d = vUv - 0.5; c *= 1.0 - 0.5 * dot(d, d);
      gl_FragColor = vec4(c, 1.0);
    }`,
});
composer.addPass(grade);
const ink = new InkPass(scene, camera, innerWidth, innerHeight, { width: Number(params.get('inkw') || 1.0), strength: 0.8 });
ink.quad.material.uniforms.uSoft.value = 1;
ink.quad.material.uniforms.uFade.value.set(25, 160, 0.85);
if (params.get('ink') !== '0') composer.addPass(ink);
composer.addPass(new OutputPass());
window.__dbg.composer = composer; window.__dbg.bloom = bloom; window.__dbg.ink = ink;
// which pane of the roof's glass gets the true reflection this frame: the plane of glass most in front of you (near,
// looked at, seen face on), you on its inner side
const _mf = new THREE.Vector3(), _md = new THREE.Vector3();
let runFace;
function pickMirror() {
  U.uGPlane.value.w = 1e9;
  const cp = camera.position; camera.getWorldDirection(_mf); let best = null, bs = 0;
  glassMirror.all = false; glassMirror.hide.length = 0;
  if (stage.gallery.group.visible) {                                  // (in 46F: its mirrors, giving back everything — the city too)
    const m = stage.gallery.pickMirror();
    glassMirror.setPlane(m.p, m.n); U.uGPlane.value.set(m.n.x, m.n.y, m.n.z, m.d); glassMirror.all = true; glassMirror.hide.push(...stage.gallery.readers, stage.glassMesh); return true;
  }
  // in the escalators' run, on them or at their foot or on the stairs: its tall outer glass, always (the reflection of
  // the escalators, their lights, you, over the city — the run's look, as it was from the first)
  if (runFace === undefined) { const o = stage.glassPlane.n, d0 = o.x * stage.glassPlane.p.x + o.z * stage.glassPlane.p.z; runFace = (stage.mirrorFaces || []).find(f => f.n.dot(o) > 0.99 && Math.abs(f.d - d0) < 1.0) || null; }
  { const [u, v] = stage.F.toL(cp.x, cp.z); if (runFace && u > -3 && u < RUN.comb1 + 4 && v > -0.5 && v < RUN.inner + 3 && cp.y > SKY.YLOW - 1 && cp.y < SKY.YDECK + 6 && runFace.n.x * cp.x + runFace.n.z * cp.z - runFace.d < -0.1) best = runFace; }
  if (!best) for (const f of stage.mirrorFaces || []) {
    if (f.n.x * cp.x + f.n.z * cp.z - f.d > -0.1) continue;
    let sc = 0;
    for (const m of f.mids) { _md.subVectors(m, cp); const dist = _md.length(); _md.divideScalar(dist); const c = _md.dot(_mf); if (c < 0.55) continue; sc += (c - 0.55) * Math.abs(_md.dot(f.n)) / (1 + dist * 0.12); }
    if (sc > bs) { bs = sc; best = f; }
  }
  if (!best) return false;
  glassMirror.setPlane(best.mids[0], best.n); U.uGPlane.value.set(best.n.x, 0, best.n.z, best.d);
  return true;
}
function sizeAll() {
  const v = renderer.getDrawingBufferSize(new THREE.Vector2());
  mirror.setSize(v.x, v.y); glassMirror.setSize(v.x, v.y); sideMirror.setSize(v.x, v.y); U.uRes.value.copy(v);
}
sizeAll();

// ---------------------------------------------------------------- you
const follow = new Follow(camera); follow.want = 4.2; follow.eye = 1.52;   // (your eyes: the character is 1.7 m tall)
const hero = await Avatar.load(scene, './assets/avatar/me.vrm', './assets/anim/ual-standard.glb', './assets/anim/mixamo-walk-male.fbx',
  { turnL: './assets/anim/mixamo-turn-left.fbx', turnR: './assets/anim/mixamo-turn-right.fbx', start: './assets/anim/mixamo-walk-start.fbx', stop: './assets/anim/mixamo-walk-stop.fbx', door: './assets/anim/mixamo-door-inwards.fbx' },
  './assets/anim/mixamo-run-male.fbx');
hero.setLight(light.sampler(renderer));
hero.view = { camera, renderer };
castShadow(hero.root); hero.root.traverse(o => o.layers.enable(GLASS_LAYER)); hero.roofSample = (x, z, o) => stage.roofSample(x, z, o);
const umbrella = new Umbrella(scene, hero); window.__dbg.umbrella = umbrella; umbrella.group.traverse(o => o.layers.enable(GLASS_LAYER));
const tod = new TimeOfDay({ sky, renderer, bloom, hero });
let mood = MOODS.includes(params.get('mood')) ? params.get('mood') : 'sunset';
tod.set(mood); crossing.setEvening(mood === 'clear');

const traffic = params.get('cars') === '0' ? null : new Traffic(scene, L);
const rain = new Rain(26000); scene.add(rain.mesh, rain.splashes); rain.setGround(ground); rain.setGallery(stage.F, stage.gallery.Y45 - 0.5, stage.gallery.CEIL + 0.3);
{ const s = marks.konbini; rain.setRoom(new THREE.Vector2(...s.toW(0, 0)), new THREE.Vector2(s.ux, s.uz), new THREE.Vector3(KB.W, KB.D, 4.6)); }
window.__dbg.traffic = traffic; if (traffic) for (const m of Object.values(traffic.models)) m.im.layers.enable(SHADOW_LAYER);
// the crowd: loaded once the city is up (a few seconds), then always there; and the people on the roof
let crowd = null;
if (params.get('crowd') !== '0') Crowd.load(scene, { count: Number(params.get('n') || 180), ground, roof: 230 }).then(c => {
  crowd = c; c.camera = camera; c.setObstacles(street.colliders, (x, z) => blockedStreet(x, z)); window.__dbg.crowd = c; ink.extra = (r, cam) => c.drawND(r, cam, 26);
  c.roofPeople?.(stage, 150); c.addPeople(stage.gallery.people(c.R)); c.root.traverse(o => o.layers.enable(GLASS_LAYER));
}).catch(e => console.error('crowd', e));

// ---------------------------------------------------------------- where you can walk: the street, or the roof
// the street: not inside a building (footprints in 8 m cells), not into a post, pole or tree bed (circles)
const grid = new Map();
city.colliders.forEach((pts, i) => {
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  for (let a = Math.floor(x0 / 8); a <= Math.floor(x1 / 8); a++) for (let b = Math.floor(z0 / 8); b <= Math.floor(z1 / 8); b++) { const k = a * 100003 + b; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(i); }
});
const inPoly = (pts, x, z) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
const cgrid = new Map();
street.colliders.forEach(([x, z, r], i) => { for (let a = Math.floor((x - r) / 8); a <= Math.floor((x + r) / 8); a++) for (let b = Math.floor((z - r) / 8); b <= Math.floor((z + r) / 8); b++) { const k = a * 100003 + b; if (!cgrid.has(k)) cgrid.set(k, []); cgrid.get(k).push(i); } });
function blockedStreet(x, z) {
  if (Math.abs(x) > 200 || Math.abs(z) > 200) return true;
  if (konbini.fixtureAt(x, z, 0.3, -1)) return true;                  // (the store's things: you keep your body clear of them, not just your middle)
  const k = Math.floor(x / 8) * 100003 + Math.floor(z / 8);
  for (const i of grid.get(k) || []) if (inPoly(city.colliders[i], x, z)) return true;
  for (const i of cgrid.get(k) || []) { const [cx, cz, r] = street.colliders[i]; if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return true; }
  return false;
}
// what stops the camera on the street: only the solid things (walls, tree beds, the police box — not thin poles)
function camBlockedStreet(x, z) {
  if (Math.abs(x) > 200 || Math.abs(z) > 200) return true;
  if (konbini.fixtureAt(x, z, 0.28, hero.pos.y + 1.5)) return true;   // (the store's shelves, fridges, counter, machines: the camera keeps out of them)
  const k = Math.floor(x / 8) * 100003 + Math.floor(z / 8);
  for (const i of grid.get(k) || []) if (inPoly(city.colliders[i], x, z)) return true;
  for (const i of cgrid.get(k) || []) { const [cx, cz, r] = street.colliders[i]; if (r > 0.6 && (x - cx) ** 2 + (z - cz) ** 2 < r * r) return true; }
  return false;
}
let level = 'street';
const groundAt = (x, z) => level === 'roof' ? stage.heightAt(x, z, hero.pos.y) : ground.height(x, z);   // (up there two storeys: the gallery under the deck, the deck)
const blocked = (x, z) => level === 'roof' ? stage.blocked(x, z, hero.pos.y) : blockedStreet(x, z);
// on the roof the camera may go a little way out past the glass (to look back at the escalator from outside), not into the lifts' building
const camBlocked = (x, z) => level === 'roof' ? (galleryOn ? !stage.gallery.contains(x, z, 0.15) : stage.camBlocked(x, z)) : camBlockedStreet(x, z);

// ---------------------------------------------------------------- the screen: start, pause, prompts
const overlay = $('overlay'), hud = $('hud'), promptEl = $('prompt'), hintEl = $('hint'), toastEl = $('toast'), transitEl = $('transit');
let entered = false, locked = false, paused = false, dragging = false;
const audio = new CityAudio();
const startAudio = () => { if (params.get('mute') !== '1') audio.start({ signals: street.heads.filter(h => h.lamp === 'pg').filter((_, i) => i % 2 === 0).map(h => ({ x: h.x, y: h.y, z: h.z })), screens: screens.list.filter(s => s.channel >= 0) }); };
// the mouse locked to the view where the browser allows it; where it doesn't (or it fails), dragging turns the view
function tryLock() {
  try { const p = document.body.requestPointerLock?.(); if (p && p.catch) p.catch(() => { setDragHint(); }); if (!document.body.requestPointerLock) setDragHint(); }
  catch (e) { setDragHint(); }
}
function setDragHint() { renderer.domElement.classList.add('drag'); toast('鼠标锁定不可用：按住拖动画面转视角'); }
function enter(where) {
  entered = true; paused = false; overlay.classList.add('hidden');
  if (where === 'sky') goSkyNow(); else if (where === 'street' && !startedOnce) jumpTo(0);
  startedOnce = true; startAudio(); tryLock(); refreshHint();
}
let startedOnce = false;
$('goSky').addEventListener('click', () => enter('sky'));
$('goStreet').addEventListener('click', () => enter('street'));
for (const b of document.querySelectorAll('.moods button')) b.addEventListener('click', () => { setMood(b.dataset.mood, false); });
function showMoods() { for (const b of document.querySelectorAll('.moods button')) b.classList.toggle('on', b.dataset.mood === mood); if (!startedOnce || paused) $('goSky').textContent = mood === 'sunset' ? '乘落日扶梯（直达屋顶）' : '乘扶梯上 SHIBUYA SKY（直达）'; }
function pause(on) { paused = on; overlay.classList.toggle('hidden', !on); if (on) { $('goStreet').textContent = '继续'; showMoods(); clearKeys(); } }
document.addEventListener('pointerlockchange', () => {
  const was = locked; locked = document.pointerLockElement === document.body;
  renderer.domElement.classList.toggle('drag', !locked);
  if (was && !locked && entered) pause(true);                      // (Esc releases the mouse: pause)
});
document.addEventListener('pointerlockerror', () => setDragHint());
renderer.domElement.addEventListener('mousedown', e => { if (!entered || paused) return; dragging = true; if (!locked) tryLockQuiet(); });
const tryLockQuiet = () => { try { const p = document.body.requestPointerLock?.(); if (p && p.catch) p.catch(() => {}); } catch (e) {} };
addEventListener('mouseup', () => { dragging = false; });
document.addEventListener('mousemove', e => {
  if (!entered || paused) return;
  if (locked) follow.look(e.movementX || 0, e.movementY || 0);
  else if (dragging) follow.look((e.movementX || 0) * 0.7, (e.movementY || 0) * 0.7);
});
addEventListener('wheel', e => { if (entered && !paused) follow.zoom(e.deltaY); }, { passive: true });
const keys = {};
const clearKeys = () => { for (const k in keys) keys[k] = false; dragging = false; follow.resetKeyLook(); };
// Scripted lift/tunnel shots and C's alternate views keep their existing framing.
function canLookAround() { return !transit && !pod && (!tunnel || follow.first) && (!rideState || camMode === 0 || follow.first); }
function updateKeyLook(dt, on) {
  if (!on || !canLookAround()) { follow.resetKeyLook(); return; }
  if (keys.ArrowLeft || keys.ArrowRight || keys.ArrowUp || keys.ArrowDown) camTurn = null; // Manual input takes over from the boarding turn.
  follow.lookKeys(dt, keys);
}
addEventListener('blur', clearKeys); document.addEventListener('visibilitychange', () => { if (document.hidden) clearKeys(); });
addEventListener('keydown', e => {
  if (e.code === 'KeyR') return; // The recorder owns R in every mood, including rain.
  if (e.code === 'Escape' && entered && !locked) { pause(!paused); return; }
  if (e.code === 'KeyP' && entered) { pause(!paused); return; }
  if (paused || !entered) { if (e.code === 'Enter' && !entered) enter('sky'); return; }
  if (e.code.startsWith('Arrow')) {
    if (e.altKey || e.ctrlKey || e.metaKey || e.isComposing || e.target?.closest?.('input, textarea, select, [contenteditable]')) return;
    e.preventDefault();
    if (!canLookAround()) return;
  }
  keys[e.code] = true;
  if (e.repeat) return;
  if (e.code === 'KeyV') { follow.first = !follow.first; follow.snap = true; follow.resetKeyLook(); }
  if (e.code === 'KeyJ' && mood === 'night' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.isComposing && !e.target?.closest?.('input, textarea, select, [contenteditable]')) { tod.rainWanted = tod.rainWanted > 0.5 ? 0 : 1; toast(tod.rainWanted ? '下雨' : '雨停'); }
  if (e.code === 'KeyT') setMood(MOODS[(MOODS.indexOf(mood) + 1) % MOODS.length], true);
  if (e.code === 'KeyM') audio.setMuted(!audio.muted);
  if (e.code === 'KeyC' && rideState) { camMode = (camMode + 1) % 3; follow.resetKeyLook(); toast(['镜头：跟在身后', '镜头：侧面看乘梯', '镜头：前方回望'][camMode]); }
  if (e.code === 'KeyE') interact();
  if (e.code === 'Backquote') hud.classList.toggle('on');
  const n = Number(e.key); if (n >= 1 && n <= VIEWS.length && !transit) jumpTo(n - 1);
  if (e.key === '0' && !transit) { if (level === 'roof') placeOnRoof('bottom'); else jumpTo(0); toast('回到起点'); }
});
addEventListener('keyup', e => { keys[e.code] = false; });
let toastT = 0;
function toast(s) { toastEl.textContent = s; toastEl.classList.add('on'); toastT = 2.6; }
function refreshHint() {
  hintEl.innerHTML = (level === 'roof' ? 'SHIBUYA SKY · 229 m · ' : '渋谷スクランブル交差点 · ') + PRESETS[mood].name + ' ' + PRESETS[mood].clock + '<br>' +
    (rideState ? 'C 换镜头 · 跟随镜头：鼠标 / ↑↓←→ 看四周' : level === 'roof' ? (mood === 'night' ? '下雨天屋顶对游客关闭，只有你在 · E 乘扶梯 · 下段平台的玻璃门 E 回 46F' : 'E 乘扶梯 · 下段平台的玻璃门 E 进 46F 回廊，下楼电梯在回廊里') : '去八公广场的车站入口或 Scramble Square 门口按 E 上楼') + (rideState ? '' : ' · ↑↓←→ 转视角') + (locked ? '' : ' · 按住拖动转视角') + '<br>R 开始 / 停止录屏' + (mood === 'night' ? ' · J 下雨 / 雨停' : '');
}
// sunset or night: the whole of it at once (behind a moment's dark when asked for in the street or on the roof)
function setMood(m, fade) {
  if (m === mood) return;
  const apply = () => { mood = m; tod.set(m); crossing.setEvening(m === 'clear'); showMoods(); refreshHint(); toast(`${PRESETS[m].name} · ${PRESETS[m].clock}${m === 'night' ? ' 雨' : ' 晴'}`); };
  if (fade && entered) { transit = { t: 0, dur: 1.2, mid: 0.5, kind: 'fade', apply }; } else apply();
}
showMoods();

// the places the number keys take you: [where you stand (x, z), what you look at (x, y, z)]
const VIEWS = [
  [[19, 15], [-14, 12, -32]],          // 1 Hachikō's corner, looking over the crossing to Q-FRONT
  [[-9, -20], [40, 60, 30]],           // 2 Q-FRONT's corner, looking across to the station and the towers
  [[5, -2], [130, 120, 100]],          // 3 in the middle of the Scramble, the tower over the station
  [[-30, 8], [-120, 20, -10]],         // 4 the foot of Dōgenzaka
  [[36, 34], [43, 4, 35.5]],           // 5 Hachikō square, the way in to SHIBUYA SKY
];
function jumpTo(i) {
  rideState = null; pod = null; tunnel = null; hero.stance = 0;
  if (level !== 'street') setLevel('street');
  const [[x, z], [tx, ty, tz]] = VIEWS[i], y = groundAt(x, z);
  hero.place(x, y, z, Math.atan2(tx - x, tz - z)); vel.set(0, 0, 0);
  follow.aimAt(new THREE.Vector3(x, y + 1.5, z), new THREE.Vector3(tx, ty, tz), -0.08); follow.snap = true;
}
// the two levels: the street, the roof (the far city and the sun's shadows matter only up there)
function setLevel(l) {
  level = l;
  camera.near = l === 'roof' ? 0.15 : 0.12; camera.far = l === 'roof' ? 30000 : 9000; camera.updateProjectionMatrix();
  refreshHint();
}
// on the roof, at the lower landing by the gallery's doors, facing up the run
function placeOnRoof(at = 'bottom') {
  rideState = null; pod = null; tunnel = null; hero.stance = 0;
  setLevel('roof');
  const F = stage.F;
  if (at === 'bottom') {
    // (just out of the gallery's doors, a step aside from the escalators' foot: the run open in front of you, up to the sky)
    const [x, z] = F.toW(1.3, 2.0);
    hero.place(x, SKY.YLOW, z, F.yaw); vel.set(0, 0, 0);
    const [lx, lz] = F.toW(RUN.comb1 + 6, 1.4);
    follow.want = 3.6; follow.aimAt(new THREE.Vector3(x, SKY.YLOW + 1.5, z), new THREE.Vector3(lx, SKY.YDECK + 3.0, lz), -0.02); follow.snap = true;
  } else {
    const [x, z] = F.toW(RUN.comb1 + 3.5, 6), [lx, lz] = F.toW(RUN.comb1 - 6, -30);
    hero.place(x, SKY.YDECK, z, Math.atan2(lx - x, lz - z)); vel.set(0, 0, 0);
    follow.aimAt(new THREE.Vector3(x, SKY.YDECK + 1.5, z), new THREE.Vector3(lx, SKY.YDECK - 20, lz), -0.05); follow.snap = true;
  }
}
// the quick way to it (the start screen's first button): sunset, the escalator's foot
function goSkyNow() { placeOnRoof('bottom'); }

// ---------------------------------------------------------------- the things you can do here (E)
let rideState = null, camMode = 0, transit = null, near = null, pod = null, tunnel = null, galleryOn = false;
const BOARD = stage.boardings();
function hotspots() {
  const p = hero.pos, out = [];
  if (level === 'street') for (const e of ENTRANCES) out.push({ d: Math.hypot(p.x - e.x, p.z - e.z), r: 2.2, label: e.label, go: () => startPod(1) });
  else if (galleryOn) {
    const L = stage.gallery.liftAt, D = stage.gallery.doorIn; out.push({ d: Math.hypot(p.x - L.x, p.z - L.z), r: 2.2, label: '乘电梯下楼（14F，回到街头）', go: () => startPod(-1) });
    out.push({ d: Math.hypot(p.x - D.x, p.z - D.z), r: 1.8, label: '推门出去：扶梯下段（SKY STAGE）', go: () => throughDoors(false) });
  } else {
    const D = stage.doorAt; if (Math.abs(p.y - SKY.YLOW) < 0.6) out.push({ d: Math.hypot(p.x - D.x, p.z - D.z), r: 1.6, label: '推门进去：46F SKY GALLERY', go: () => throughDoors(true) });
    for (const b of BOARD) if (Math.abs(p.y - b.y) < 0.6) out.push({ d: Math.hypot(p.x - b.p[0], p.z - b.p[1]), r: 1.4, label: b.label, go: () => board(b) });
  }
  return out.filter(h => h.d < h.r).sort((a, b) => a.d - b.d)[0] || null;
}
function interact() { if (rideState || transit || pod || tunnel) return; const h = hotspots(); if (h) h.go(); }
function board(b) {
  follow.resetKeyLook();
  rideState = { b, s: stage.snap(b.lane, b.s0), dir: b.dir, on: 0, from: hero.pos.clone() }; camMode = 0;   // (on: the pace onto the step, 0 … 1)
  hero.face = b.dir > 0 ? stage.F.yaw : stage.F.yaw + Math.PI; vel.set(0, 0, 0);
  camTurn = { yaw: hero.face + Math.PI, pitch: follow.first ? (b.dir > 0 ? 0.12 : -0.15) : (b.dir > 0 ? -0.05 : -0.22) }; refreshHint();   // (the camera comes round behind you as you step on, not cut there)
}
// the camera turning itself to a view (stepping on to an escalator): eased round the shorter way, a half second or so
let camTurn = null;
function turnCamera(dt) {
  if (!camTurn) return; const k = 1 - Math.exp(-dt * 6), e = Math.atan2(Math.sin(camTurn.yaw - follow.yaw), Math.cos(camTurn.yaw - follow.yaw)), ep = camTurn.pitch - follow.pitch;
  const ey = Math.sign(e) * Math.min(Math.abs(e * k), 2.6 * dt);    // (no quicker than 2.6 rad/s: round behind you in about a second, never a jump)
  follow.yaw += ey; follow.pitch += ep * k; if (Math.abs(e) < 0.004 && Math.abs(ep) < 0.004) camTurn = null;
}
// the lift: the screen goes dark, the floors count past, and you are there
function startTransit(dir) {
  transit = { t: 0, dur: 3.4, mid: 1.2, kind: dir, apply: () => {
    if (dir === 'up') placeOnRoof('bottom');
    else { setLevel('street'); const e = ENTRANCES[0]; hero.place(e.x - 1.2, groundAt(e.x - 1.2, e.z), e.z, -Math.PI / 2); vel.set(0, 0, 0); follow.aimAt(new THREE.Vector3(e.x - 1.2, 1.6, e.z), new THREE.Vector3(-10, 8, -20), -0.08); follow.snap = true; }
  } };
  $('tname').textContent = dir === 'up' ? 'SKY GATE' : 'SHIBUYA SKY';
}
function runTransit(dt) {
  const T = transit; T.t += dt;
  const k = T.t < T.mid ? THREE.MathUtils.smoothstep(T.t, 0, T.mid * 0.75) : 1 - THREE.MathUtils.smoothstep(T.t, T.dur - 0.9, T.dur);
  transitEl.style.opacity = k.toFixed(3);
  if (T.kind === 'up' || T.kind === 'down') {
    const f = Math.min(1, Math.max(0, (T.t - 0.4) / (T.dur - 1.4))), fl = T.kind === 'up' ? Math.round(14 + 31 * f) : Math.round(45 - 44 * f);
    $('tfloor').textContent = (T.kind === 'up' && f >= 1 ? '46F · SKY STAGE ↑' : fl + 'F'); transitEl.querySelector('.name').style.opacity = 1; $('tfloor').style.opacity = 1;
  } else { $('tfloor').style.opacity = 0; transitEl.querySelector('.name').style.opacity = 0; }
  if (!T.applied && T.t >= T.mid) { T.applied = true; T.apply(); }
  if (T.t >= T.dur) { transit = null; transitEl.style.opacity = 0; }
}

// the lift (TRANSITION POD, skygallery.js): you are in its car, its ceiling's picture streaming as it rises, the floors
// counting; its doors open on 45F, dark, and the escalator up its tunnel of light (LEADING LINE) carries you into the
// 46th floor's gallery. Down: from the gallery's lifts, the car, the street.
const podHud = document.createElement('div'); podHud.id = 'podhud';
Object.assign(podHud.style, { position: 'fixed', left: '50%', bottom: '9%', transform: 'translateX(-50%)', color: '#e8ecff', font: '300 15px/1 "Helvetica Neue", -apple-system, sans-serif', letterSpacing: '.35em', opacity: 0, transition: 'opacity .4s', pointerEvents: 'none', zIndex: 3, textShadow: '0 0 8px #000' });
document.body.appendChild(podHud);
const GALLERY_LIGHT = { hemi: [0.5, 0.46, 0.42], gnd: [0.1, 0.1, 0.12], k: 0.6, key: [1.0, 0.86, 0.7], keyK: 0.45 };
const TUNNEL_LIGHT = { hemi: [0.32, 0.4, 0.55], gnd: [0.06, 0.07, 0.1], k: 0.55, key: [0.75, 0.85, 1.0], keyK: 0.35, dir: [0, 0] };
function startPod(dir) {
  transit = { t: 0, dur: 1.2, mid: 0.55, kind: 'fade', apply: () => { setLevel('roof'); rideState = null; tunnel = null; hero.stance = 0; vel.set(0, 0, 0); pod = { t: 0, dir }; umbrella.fold(); refreshHint(); } };
}
function runPod(dt) {
  const P = pod, G = stage.gallery; P.t += dt;
  const ride = THREE.MathUtils.clamp((P.t - 1.4) / 8.0, 0, 1), prog = ride * ride * (3 - 2 * ride), speed = 6 * ride * (1 - ride) / 1.5;
  const k = THREE.MathUtils.smoothstep(P.t, 0.3, 1.4) * (1 - 0.55 * THREE.MathUtils.smoothstep(P.t, 9.3, 9.9));
  G.setPod(P.dir > 0 ? k : k * 0.75, dt * (0.25 + 2.4 * speed), P.dir, THREE.MathUtils.smoothstep(P.t, 9.7, 10.5));
  const fl = P.dir > 0 ? Math.round(14 + 31 * prog) : Math.round(46 - 32 * prog);
  podHud.textContent = `TRANSITION POD   ${fl}F  ${P.dir > 0 ? '↑' : '↓'}`; podHud.style.opacity = P.t > 0.6 && P.t < 10.4 ? 1 : 0;
  if (P.t > 10.6 && !transit) transit = { t: 0, dur: 1.2, mid: 0.55, kind: 'fade', apply: () => { pod = null; podHud.style.opacity = 0; G.setPod(0.2, 0, 1, 0); if (P.dir > 0) startTunnel(); else toStreet(); } };
}
function startTunnel() {
  const G = stage.gallery, q = G.tunnelAt(0); tunnel = { s: 0 };
  hero.place(q.x, q.y, q.z, G.tunnelFace); vel.set(0, 0, 0); follow.snap = true; refreshHint();
}
function runTunnel(dt) {
  const G = stage.gallery, ws = hero.walkSpeed || 1.35;
  if (tunnel.off) {                                                   // (stepped off at the top: a pace or so on into the gallery, walked; then the camera behind you, from where it was)
    const O = tunnel.off; O.t = Math.min(O.dur, O.t + dt); const k = O.t / O.dur, x = O.a.x + (O.e.x - O.a.x) * k, z = O.a.z + (O.e.z - O.a.z) * k;
    walked = Math.hypot(x - hero.pos.x, z - hero.pos.z); pace = ws; hero.pos.set(x, SKY.YLOW, z); hero.stance = Math.max(0, (hero.stance || 0) - dt * 4);
    if (k >= 1) {
      tunnel = null; vel.set(0, 0, 0); hero.face = G.arrive.face;
      follow.pivot.set(hero.pos.x, hero.pos.y + 1.3, hero.pos.z); follow.cur = Math.max(1.6, camera.position.distanceTo(follow.pivot)); follow.snap = false;
      handover = { p: camera.position.clone(), q: camera.quaternion.clone(), t: 0 };   // (from where the tunnel's camera was: placeCamera)
      refreshHint(); toast('46F · SKY GALLERY');
    }
    return;
  }
  tunnel.s += G.steps.speed * dt; hero.stance = Math.min(1, (hero.stance || 0) + dt * 2.5);
  const q = G.tunnelAt(tunnel.s); hero.pos.set(q.x, q.y, q.z);
  if (tunnel.s >= G.tunnelLen - 0.5) { const a = hero.pos.clone(), e = G.arrive.p; tunnel.off = { a, e, t: 0, dur: Math.max(0.3, Math.hypot(e.x - a.x, e.z - a.z) / ws) }; }
}
// the glass doors between the escalators' foot and the gallery: a moment's dark, and you are on the other side
function throughDoors(into) {
  transit = { t: 0, dur: 1.0, mid: 0.45, kind: 'fade', apply: () => {
    const F = stage.F, u = (RUN.door0 + RUN.door1) / 2, [x, z] = F.toW(into ? u + 0.6 : u, into ? 10.7 : RUN.inner - 1.0);
    const fa = Math.atan2(F.ux, F.uz);                                   // (in: along the gallery toward the west windows; out: up the escalators, the view they are known for)
    hero.place(x, SKY.YLOW, z, fa); vel.set(0, 0, 0); follow.yaw = fa + Math.PI; follow.pitch = -0.05; follow.snap = true; refreshHint();
    if (into) { toast('46F · SKY GALLERY'); umbrella.fold(); } else if (U.uRain.value > 0.3) toast('下雨天屋顶对游客关闭（真实的 SHIBUYA SKY 也是），上面只有你');
  } };
}
function toStreet() { setLevel('street'); const e = ENTRANCES[0]; hero.place(e.x - 1.2, groundAt(e.x - 1.2, e.z), e.z, -Math.PI / 2); vel.set(0, 0, 0); follow.aimAt(new THREE.Vector3(e.x - 1.2, 1.6, e.z), new THREE.Vector3(-10, 8, -20), -0.08); follow.snap = true; refreshHint(); }

// up on SHIBUYA SKY (the roof, 46F) the people standing about are solid: you can't walk into one, only round them (a
// body's width apart, 0.45 m); a step that takes you away from them is always allowed, so you are never caught
function intoSomeone(x, z, p) {
  if (level !== 'roof' || !crowd) return false;
  for (const a of crowd.agents) {
    if (a.roofY == null || a.y == null || a.moving || Math.abs(a.y - p.y) > 1.2) continue;
    const dn = (a.x - x) ** 2 + (a.z - z) ** 2; if (dn > 0.2025) continue;
    if (dn < (a.x - p.x) ** 2 + (a.z - p.z) ** 2 - 1e-6) return true;
  }
  return false;
}
// ---------------------------------------------------------------- walking, riding
const fwd = new THREE.Vector3(), right = new THREE.Vector3(), move = new THREE.Vector3(), vel = new THREE.Vector3();
let walked = 0, heading = null, pace = 1.35;
function walk(dt) {
  const fast = keys.ShiftLeft || keys.ShiftRight, speed = pace = fast ? (hero.runSpeed || 3.2) : (hero.walkSpeed || 1.35);
  follow.flatForward(fwd); follow.flatRight(right); move.set(0, 0, 0);
  if (keys.KeyW) move.add(fwd); if (keys.KeyS) move.sub(fwd);
  if (keys.KeyD) move.add(right); if (keys.KeyA) move.sub(right);
  const p = hero.pos;
  if (move.lengthSq() > 0) { move.normalize(); heading = Math.atan2(move.x, move.z); move.multiplyScalar(speed); }
  if (hero.rootSpeed != null) vel.set(Math.sin(hero.face), 0, Math.cos(hero.face)).multiplyScalar(hero.rootSpeed);
  else vel.lerp(move, 1 - Math.exp(-dt * (move.lengthSq() > vel.lengthSq() ? 5.5 : 8)));
  if (!move.lengthSq() && vel.lengthSq() < 1e-4) vel.set(0, 0, 0);
  if (vel.lengthSq() > 0) {
    const x0 = p.x, z0 = p.z, mx = vel.x * dt, mz = vel.z * dt;
    const step = (x, z) => !blocked(x, z) && Math.abs(groundAt(x, z) - p.y) < 0.5 && !intoSomeone(x, z, p);   // (never off an edge: a step up or down, no more; nor into someone standing)
    if (step(p.x + mx, p.z)) p.x += mx; else vel.x = 0;
    if (step(p.x, p.z + mz)) p.z += mz; else vel.z = 0;
    walked = Math.hypot(p.x - x0, p.z - z0);
  }
  p.y += (groundAt(p.x, p.z) - p.y) * Math.min(1, dt * 14);
}
// standing on a step: carried along the escalator's path at its speed (your feet on its tread, still), off at the end.
// On and off are walked, not jumped: from where you stood a pace or so onto the step as it moves off; at the top (or
// the foot) over the comb and a pace or two on, and the walk is yours again
function rideStep(dt) {
  const R = rideState, b = R.b, ws = hero.walkSpeed || 1.35;
  if (R.off) {
    const O = R.off; O.t = Math.min(O.dur, O.t + dt); const k = O.t / O.dur, x = O.a.x + (O.e.x - O.a.x) * k, z = O.a.z + (O.e.z - O.a.z) * k;
    walked = Math.hypot(x - hero.pos.x, z - hero.pos.z); pace = ws; hero.pos.set(x, O.e.y, z); hero.stance = Math.max(0, (hero.stance || 0) - dt * 4);
    if (k >= 1) { rideState = null; vel.set(0, 0, 0); if (camMode > 0) follow.snap = true; refreshHint(); }
    return;
  }
  R.s += R.dir * SKY.SPEED * dt;
  const q = stage.ride(b.lane, R.s);
  if (R.on < 1) {
    R.onDur ??= Math.max(0.45, 1.4 * Math.hypot(q.x - R.from.x, q.z - R.from.z) / ws);   // (eased: its quickest no quicker than a walk)
    R.on = Math.min(1, R.on + dt / R.onDur); const k = R.on * R.on * (3 - 2 * R.on);
    const x = R.from.x + (q.x - R.from.x) * k, z = R.from.z + (q.z - R.from.z) * k, y = R.from.y + (q.y - R.from.y) * k;
    walked = Math.hypot(x - hero.pos.x, z - hero.pos.z); pace = ws; hero.pos.set(x, y, z);
    hero.stance = R.on > 0.8 ? Math.min(1, (hero.stance || 0) + dt * 2.5) : 0;
  } else { hero.pos.set(q.x, q.y, q.z); hero.stance = Math.min(1, (hero.stance || 0) + dt * 2.5); }
  const done = R.dir > 0 ? R.s >= b.s1 : R.s <= b.s1;
  if (done) { const [x, z] = b.exit, a = hero.pos.clone(), e = new THREE.Vector3(x, b.exitY, z); R.off = { a, e, t: 0, dur: Math.max(0.3, Math.hypot(e.x - a.x, e.z - a.z) / ws) }; }
}
// where the camera may be, at the height it is (follow.js asks along its line of sight, and the same test is the
// safety net after it, so the two never disagree and jump): in the kombini inside its room or out past its glass front,
// out of its shelves, fridges and counter — over a low one it may be; in 46F inside its rooms, clear of its columns,
// sofas and bar, under its ceiling; elsewhere as before
function storeCamOK(x, y, z) {
  const [lx, lz] = konbini.site.toL(x, z), out = lz < -0.1;
  return (out || (lx > 0.35 && lx < KB.W - 0.35 && lz < KB.D - 0.35 && y < KB.Y0 + KB.H - 0.25)) && (!out || (lx > -0.5 && lx < KB.W + 0.5) || lz < -3) && !konbini.fixtureAt(x, z, 0.22, y);
}
// what the line from the kombini's camera to you may not pass through: its walls, floor and ceiling, and its shelves,
// fridges and counter themselves (5 cm round them, 15 cm over their tops) — not the camera's own margins: over a low
// shelf the line may go, so the camera may stand up beyond it (follow.js indoorBoom). Out past its glass front: nothing.
function storeSolid(x, y, z) {
  const [lx, lz] = konbini.site.toL(x, z);
  if (lz < -0.1) return false;
  if (lx < 0.1 || lx > KB.W - 0.1 || lz > KB.D - 0.1 || y > KB.Y0 + KB.H || y < KB.Y0) return true;
  for (const [x0, x1, z0, z1, top] of konbini.fixtures) if (y < top + 0.15 && lx > x0 - 0.05 && lx < x1 + 0.05 && lz > z0 - 0.05 && lz < z1 + 0.05) return true;
  return false;
}
function camFree(x, y, z) {
  if (hero.indoors) return storeCamOK(x, y, z);
  if (galleryOn) return stage.gallery.camFree(x, y, z);
  return !camBlocked(x, z);
}
// the camera: behind you as you walk; on the escalator, behind, beside (from the stairs, the glass and the city
// behind you), or ahead looking back down the run at you
let handover = null, storeNet = 0;                                                  // (the tunnel's camera handing you back to the one that follows: where it was, eased from)
function placeCamera(dt) {
  if (pod) {                                                          // (in the lift's car: your eyes, looking up into its ceiling)
    const G = stage.gallery, e = G.carEye(), l = G.carLook(), a = pod.t;
    camera.position.copy(e); camera.position.y += 0.012 * Math.sin(a * 1.7) - 0.03 * THREE.MathUtils.smoothstep(a, 1.4, 2.4) * (1 - THREE.MathUtils.smoothstep(a, 2.4, 3.4)) * pod.dir;
    camera.lookAt(l); hero.visible = false; follow.snap = true; handover = null; return;
  }
  if (tunnel && !follow.first) {                                      // (on the tunnel's escalator: behind you and below, looking up it to the light)
    const G = stage.gallery, sb = tunnel.s - 2.4, q = G.tunnelAt(sb);   // (s < 0: still in the hall below, behind you there)
    const cam = new THREE.Vector3(q.x, q.y + 1.85, q.z), look = new THREE.Vector3(hero.pos.x, hero.pos.y + 1.35, hero.pos.z);
    camera.position.lerp(cam, follow.snap ? 1 : 1 - Math.exp(-dt * 5)); camera.lookAt(look); follow.snap = false; hero.visible = true;
    const dv = look.clone().sub(camera.position); follow.yaw = Math.atan2(-dv.x, -dv.z); follow.pitch = Math.atan2(dv.y, Math.hypot(dv.x, dv.z));
    handover = null; return;
  }
  if (rideState && camMode > 0 && !follow.first) {
    const F = stage.F, [u] = F.toL(hero.pos.x, hero.pos.z), b = rideState.b;
    let cam, look;
    if (camMode === 1) { const uc = Math.min(RUN.st1 - 0.2, Math.max(RUN.st0, u + 2.4 * rideState.dir)), [x, z] = F.toW(uc, RUN.stair0 + 1.1); cam = new THREE.Vector3(x, Math.max(stairY(uc), hero.pos.y - 0.6) + 1.6, z); look = new THREE.Vector3(hero.pos.x, hero.pos.y + 1.2, hero.pos.z); }
    else { const sa = rideState.s + 4.8 * rideState.dir, q = stage.ride(b.lane, sa), [x, z] = F.toW(q.u, b.lane.v - 0.15); cam = new THREE.Vector3(x, q.y + 1.75, z); look = new THREE.Vector3(hero.pos.x, hero.pos.y + 1.3, hero.pos.z); }
    camera.position.lerp(cam, follow.snap ? 1 : 1 - Math.exp(-dt * 4)); camera.lookAt(look); follow.snap = false; hero.visible = true;
    // (the mouse's yaw kept in step, so going back to following is smooth)
    const dv = look.clone().sub(camera.position); follow.yaw = Math.atan2(-dv.x, -dv.z); follow.pitch = Math.atan2(dv.y, Math.hypot(dv.x, dv.z));
    return;
  }
  if (follow.snap || follow.first) handover = null;                   // (a cut, or your own eyes: nothing to ease from)
  const d = follow.update(dt, hero.pos, { blocked: camBlocked, free: camFree, vel, over: (x, z, y) => camBlocked(x, z) && y < 40 + (level === 'roof' ? 300 : 0), ground: (x, z) => level === 'roof' ? Math.min(groundAt(x, z), hero.pos.y) : groundAt(x, z), ceil: null, indoor: hero.indoors ? 3.4 : galleryOn ? 3.0 : 0, solid: hero.indoors ? storeSolid : null });
  if (galleryOn && !follow.first) { const c = camera.position, p = follow.pivot; for (let k = 0; k < 30 && !stage.gallery.camOK(c); k++) c.lerp(p, 0.14); }   // (in the gallery: inside its rooms, under its ceiling)
  // in the store the camera keeps inside its room (pulled in along the line it looks down), under its ceiling
  // (in the store the camera keeps out of its side and back walls and under its ceiling; out past the glass front it
  // may stay — you see in through it — so stepping in or out it neither jumps nor comes up behind your head)
  if (hero.indoors && !follow.first) {
    const s = konbini.site, c = camera.position, p = follow.pivot;
    if (!storeCamOK(c.x, c.y, c.z)) storeNet++;                         // (counted: it should never have to — round 17's check)
    for (let k = 0; k < 24; k++) { if (storeCamOK(c.x, c.y, c.z)) break; c.lerp(p, 0.12); }   // (a safety net only: the camera's own test is the same — camFree)
  }
  // (pinched behind you against a shelf, the camera rises over the low shelves and stands back, looking down at you:
  // follow.js indoorBoom does it now, with the coming in and the coming round, so nothing here corrects it after)
  // (the tunnel's top: its camera stood back down the tunnel, further than 46F's corridor lets this one, which would have
  // cut in to where it may be — 2.4 m in a frame. It goes there in 0.6 s instead, along the line it looks at you down:
  // the line it sees you by, clear)
  if (handover) {
    handover.t += dt; const k = THREE.MathUtils.smoothstep(handover.t, 0, 0.6);
    camera.position.lerpVectors(handover.p, camera.position, k); camera.quaternion.slerpQuaternions(handover.q, camera.quaternion, k);
    if (k >= 1) handover = null;
  }
  hero.visible = follow.first ? false : camera.position.distanceTo(follow.pivot) > 0.45;
}

// ---------------------------------------------------------------- loop
function resizeView() {
  // Safari's pointer-lock banner also resizes the viewport. Fit the existing
  // canvas to the window while recording, without changing the encoded size.
  if (recording.busy) {
    Object.assign(renderer.domElement.style, { width: '100vw', height: '100vh', objectFit: 'contain' });
    return;
  }
  renderer.domElement.style.objectFit = '';
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); ink.setSize(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio()); sizeAll();
}
addEventListener('resize', resizeView);
const clock = new THREE.Clock(); let time = 0, frames = 0, acc = 0, lastPrompt = '';
function step(dt) {
  time += dt; U.uTime.value = time; screens.update(time); street.update(time);
  const frozen = paused && entered;                                   // (paused: you and the escalator you are on hold still; the city goes on)
  if (!frozen) stage.update(dt);
  walked = 0; heading = null;
  if (transit) runTransit(dt);
  const on = (entered && !paused) || window.__dbg.drive;
  updateKeyLook(dt, on);
  if (pod) { if (!frozen) runPod(dt); }
  if (rideState) { if (!frozen) rideStep(dt); }
  else if (tunnel) { if (!frozen) runTunnel(dt); }
  else { hero.stance = Math.max(0, (hero.stance || 0) - dt * 4); if (on && !transit && !pod) walk(dt); }
  galleryOn = level === 'roof' && !pod && hero.pos.y < SKY.YLOW + 1.5 && stage.gallery.contains(hero.pos.x, hero.pos.z);
  const indoors = level === 'street' && konbini.update(dt, hero.pos); hero.indoors = indoors; hero.atDoor = level === 'street' && konbini.open > 0.35;
  hero.sheltered = indoors || galleryOn || !!tunnel || !!pod;           // (under a roof: the kombini, SHIBUYA SKY's 46F, 45F and the tunnel, the lift — the umbrella folded)
  hero.roomLight = galleryOn ? GALLERY_LIGHT : tunnel ? TUNNEL_LIGHT : null; { const r = indoors || galleryOn || !!tunnel; if (hero.inRoom !== r) hero.setRoom(r); }
  konbini.clerkUpdate(dt, time, hero.pos, indoors);
  turnCamera(dt);
  if (on || follow.snap || rideState || pod || tunnel) placeCamera(dt);
  hero.update(dt, time, walked, pace, rideState ? null : heading, follow.yaw + Math.PI, null);
  ripples.update(walked, hero.pos, hero.face, groundAt(hero.pos.x, hero.pos.z), time, level === 'street' && U.uWet.value > 0.3 && !hero.indoors);
  umbrella.update(dt);
  U.uRain.value += (tod.rainWanted - U.uRain.value) * Math.min(1, dt * 0.5);
  crowd?.update(dt, time, street.state.walk, hero.pos);
  traffic?.update(dt, time);
  rain.update(camera, level === 'street');
  far.group.visible = level === 'roof' || camera.position.y > 40; if (far.group.visible) far.update(camera, renderer);
  // what you can do here, said once, where you are
  const h = !rideState && !transit && hotspots(), label = h ? h.label : '';
  if (label !== lastPrompt) { lastPrompt = label; promptEl.innerHTML = label ? `<kbd>E</kbd>${label}` : ''; promptEl.classList.toggle('on', !!label); }
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) toastEl.classList.remove('on'); }
  if (audio.ctx) {
    const cp = camera.position; let people = 0, cars = 0;
    if (crowd) for (const a of crowd.agents) if ((a.x - cp.x) ** 2 + ((a.y ?? 0) - cp.y) ** 2 + (a.z - cp.z) ** 2 < 225) people++;
    if (traffic && level === 'street') for (const c of traffic.cars) { const q = traffic.at(c.r, c.s); if (c.v > 1 && (q.x - cp.x) ** 2 + (q.z - cp.z) ** 2 < 900) cars++; }
    audio.update(dt, { camera, rain: U.uRain.value, umbrella: umbrella.k, people, cars, walkOn: level === 'street' && street.state.walk, walked, stepLen: hero.stepLen ? hero.stepLen[pace > hero.stepLen[2] ? 1 : 0] : 0.72, roof: level === 'roof', escalator: !!rideState });
  }
  if (window.__dbg.camOverride) window.__dbg.camOverride(camera, dt);   // (a scripted camera, for filming shots)
  // 46F drawn only from inside it: from the roof and the escalators the view is as it always was (under the run's upper
  // end, between the escalators, the city and the sky — round 12 had put the gallery's wall there)
  { const G = stage.gallery, cp = camera.position, inside = level === 'roof' && (galleryOn || !!tunnel || !!pod || (cp.y < G.CEIL + 0.3 && G.contains(cp.x, cp.z)));
    G.group.visible = inside; if (crowd) { crowd.indoorShown = inside; crowd.roofClosed = U.uRain.value > 0.3; } }   // (the real roof is shut in the rain: no one up there but you)
  sky.position.copy(camera.position);
  camera.updateMatrixWorld();
  // the sun's shadows on the roof (by day), the wet street's mirror (when it is wet)
  U.uShadowOn.value = level === 'roof' && U.uDay.value > 0.5 ? 1 : 0;
  if (U.uShadowOn.value) sun.render(scene, hero.pos);
  else if (level === 'street' && U.uDay.value < 0.5 && !hero.indoors && params.get('shadows') !== '0') { lampShadow.aim(hero.pos, shadowLamps, dt); lampShadow.render(scene, hero.pos); U.uShadowOn.value = 1; }
  // the wet's mirror: the street's, or up on the roof its deck's (the deck kept out of its own picture while it reads it)
  { const roofWet = level === 'roof' && U.uWet.value > 0.05 && !stage.gallery.group.visible;
    mirror.on = params.get('refl') !== '0' && U.uWet.value > 0.05 && (level === 'street' || roofWet); mirror.y = level === 'roof' ? SKY.YDECK : 0;
    stage.deck.layers.set(roofWet ? 1 : 0); stage.deck.layers.enable(GLASS_LAYER); }
  crowd?.limit(26); mirror.render(scene, camera); crowd?.restore();
  crossing.update(dt, mood === 'clear' && U.uRain.value < 0.1 && U.uDay.value < 0.3); crossing.cloudHits(camera, sky.material.uniforms.uBeamHit.value);
  glassMirror.on = level === 'roof' && pickMirror(); glassMirror.render(scene, camera);
  sideMirror.on = stage.gallery.group.visible && stage.gallery.seesBaySide(camera); if (sideMirror.on) { sideMirror.hide.length = 0; sideMirror.hide.push(...stage.gallery.readers, stage.glassMesh); } sideMirror.render(scene, camera);
  composer.render(dt);
  frames++; acc += dt; if (acc > 1) { hud.textContent = `${Math.round(frames / acc)} fps · ${renderer.getPixelRatio().toFixed(2)}x`; frames = 0; acc = 0; }
}
// the picture's sharpness kept to what the machine can draw smoothly: every two seconds, a little less if the frames
// have been slow, a little more back if there is room (between 0.85 and the chosen best)
let qAcc = 0, qN = 0, qPR = renderer.getPixelRatio(); const qMax = qPR, qMin = Math.min(0.85, qMax);
function adapt(dt) {
  // MediaRecorder needs stable canvas dimensions; resume adaptation after saving.
  if (recording.busy) { qAcc = 0; qN = 0; return; }
  if (params.get('dpr') || window.__dbg.paused) return;
  qAcc += dt; qN++;
  if (qAcc < 2) return;
  const ms = qAcc / qN * 1000; qAcc = 0; qN = 0;
  const next = ms > 24 ? qPR - 0.125 : ms < 14 ? qPR + 0.125 : qPR, pr = Math.max(qMin, Math.min(qMax, next));
  if (Math.abs(pr - qPR) > 1e-3) { qPR = pr; renderer.setPixelRatio(pr); composer.setPixelRatio?.(pr); composer.setSize(innerWidth, innerHeight); sizeAll(); }
  window.__dbg.pixelRatio = qPR;
}
function loop() { const dt = Math.min(clock.getDelta(), 0.05); if (!window.__dbg.paused) { step(dt); adapt(dt); } requestAnimationFrame(loop); }
Object.assign(window.__dbg, {
  hero, follow, keys, jumpTo, VIEWS, ENTRANCES, groundAt, blocked, tod, placeOnRoof, board, BOARD, startTransit, startPod, startTunnel, setMood, interact, enter,
  tick: (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) step(dt); },
  setTime: t => { time = t; }, getTime: () => time,
  viewport: (w, h, pr = 1) => { renderer.setPixelRatio(pr); camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h, false); composer.setPixelRatio?.(pr); composer.setSize(w, h); ink.setSize(w * pr, h * pr); sizeAll(); },
  // a picture of this moment (debug: needs a server that accepts POST /save; the bundled one does not)
  shot: async (name, q = 0.9) => { step(1 / 60); const url = renderer.domElement.toDataURL('image/jpeg', q); await fetch('/save?name=' + name, { method: 'POST', body: url }); return name; },
});
Object.defineProperties(window.__dbg, {                             // (live: Object.assign would copy the values once)
  level: { get: () => level }, lift: { get: () => ({ k: follow.bt || 0, have: (follow.bt || 0) > 0, to: null }) }, storeNet: { get: () => storeNet }, ride: { get: () => rideState }, pod: { get: () => pod }, tunnel: { get: () => tunnel }, galleryOn: { get: () => galleryOn }, transit: { get: () => transit }, mood: { get: () => mood },
  camMode: { get: () => camMode, set: v => { camMode = v; } },
});
// ready: the start screen's buttons
jumpTo(0);
for (const id of ['goSky', 'goStreet']) $(id).disabled = false;
showMoods();
if (params.get('go') === 'sky') { goSkyNow(); }
const recording = mountManualRecording({ canvas: renderer.domElement, audio, ready: () => true,
  startAudio, showResult: () => { pause(true); resizeView(); } });
loop();
