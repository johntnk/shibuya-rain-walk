// Ink: the drawn line of the anime look. A pass first records what is where — each pixel's facing and its
// distance, seen from the main camera at full size — then a line is inked wherever the distance jumps (an
// outline, laid on the nearer thing) or the facing turns sharply (a corner, a crease). What only gives light —
// the sky and aurora, glows, smoke, falling snow — is left out of that record, so it is never outlined. The line
// darkens the colour it crosses (as a brush stroke over paint), a little toward night blue, and fades with
// distance so the far hills aren't scribbled over.
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

export class InkPass extends Pass {
  constructor(scene, camera, w, h, { width = 1, strength = 0.85 } = {}) {
    super();
    this.scene = scene; this.camera = camera;
    this.nd = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
    // facing (view space) and distance
    const m = this.ndMat = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
    m.onBeforeCompile = sh => {
      sh.vertexShader = 'varying float vInkZ;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
        vInkZ = -mvPosition.z;`);
      sh.fragmentShader = 'varying float vInkZ;\n' + sh.fragmentShader
        .replace('gl_FragColor = vec4( packNormalToRGB( normal ), opacity );', 'gl_FragColor = vec4( normal, vInkZ );')
        .replace('gl_FragColor.a = 1.0;', '');
    };
    this.quad = new FullScreenQuad(new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tND: { value: this.nd.texture }, uTexel: { value: new THREE.Vector2(1 / w, 1 / h) }, uWidth: { value: width }, uStrength: { value: strength }, uDebug: { value: 0 }, uSoft: { value: 0 }, uCrease: { value: 0.55 }, uFade: { value: new THREE.Vector3(30, 180, 0.8) }, uThin: { value: 0.6 } },   // (STYLE.md: creases lighter than outlines; from 30 m the line fades to a fifth by 180 m; thin things keep their colour)
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse, tND; uniform vec2 uTexel; uniform float uWidth, uStrength, uDebug, uSoft, uCrease, uThin; uniform vec3 uFade; varying vec2 vUv;
        vec4 nd(vec2 o){ return texture2D(tND, vUv + o * uTexel * uWidth); }
        void main(){
          vec4 c = texture2D(tDiffuse, vUv), s0 = nd(vec2(0.0));
          if (s0.a <= 0.0) { gl_FragColor = uDebug > 0.5 ? vec4(0.0, 0.0, 0.2, 1.0) : c; return; }   // nothing here but light: no line
          vec4 sl = nd(vec2(-1.0, 0.0)), sr = nd(vec2(1.0, 0.0)), su = nd(vec2(0.0, 1.0)), sd = nd(vec2(0.0, -1.0));
          // the outline: in inverse distance a flat surface is a straight ramp across the screen, so its second
          // difference vanishes on any plane however steeply seen, and stands out only where the distance jumps;
          // positive here means this pixel is the nearer side of the jump. Empty neighbours count as infinitely far.
          float w0 = 1.0 / s0.a, wl = sl.a > 0.0 ? 1.0 / sl.a : 0.0, wr = sr.a > 0.0 ? 1.0 / sr.a : 0.0, wu = su.a > 0.0 ? 1.0 / su.a : 0.0, wd = sd.a > 0.0 ? 1.0 / sd.a : 0.0;
          float jump = max(2.0 * w0 - wl - wr, 2.0 * w0 - wu - wd) / w0;
          float eOut = smoothstep(0.035, 0.09, jump);
          // corners and creases: the facing turns by more than about forty degrees from one pixel to the next
          vec3 n0 = s0.xyz; float turn = 0.0;
          if (sl.a > 0.0) turn = max(turn, 1.0 - dot(n0, sl.xyz)); if (sr.a > 0.0) turn = max(turn, 1.0 - dot(n0, sr.xyz));
          if (su.a > 0.0) turn = max(turn, 1.0 - dot(n0, su.xyz)); if (sd.a > 0.0) turn = max(turn, 1.0 - dot(n0, sd.xyz));
          float eCrease = smoothstep(0.22, 0.4, turn) * uCrease;
          // something thin — a chair leg, a railing, a pole far off — stands nearer than what is on both its sides: inked
          // edge to edge it would be all line, so it keeps its own colour with only a light line on it
          float thin = max(step(0.04, (w0 - wl) / w0) * step(0.04, (w0 - wr) / w0), step(0.04, (w0 - wu) / w0) * step(0.04, (w0 - wd) / w0));
          float e = max(eOut, eCrease) * (1.0 - uFade.z * smoothstep(uFade.x, uFade.y, s0.a)) * uStrength * (1.0 - uThin * thin);
          vec3 ink = min(c.rgb * 0.18, vec3(0.006, 0.008, 0.02)) + vec3(0.002, 0.003, 0.008);   // (dark, a little night blue: never pure black, never lighter than a dark stroke)
          ink = mix(ink, c.rgb * vec3(0.3, 0.33, 0.42) + vec3(0.004, 0.006, 0.014), uSoft);      // (softer: the colour it crosses, darkened and cooled — a coloured line, as modern anime backgrounds draw them)
          gl_FragColor = vec4(mix(c.rgb, ink, e), c.a);
          if (uDebug > 0.5) gl_FragColor = vec4(eOut, eCrease, 0.0, 1.0);          // (debugging: the outline red, the creases green)
        }`,
    }));
    this._hid = []; this._cc = new THREE.Color();
  }
  setSize(w, h) { this.nd.setSize(w, h); this.quad.material.uniforms.uTexel.value.set(1 / w, 1 / h); }
  // the record of facing and distance, once a frame (another pass may have it made first and share it)
  renderND(renderer) {
    const scene = this.scene, hid = this._hid, bg = scene.background, cc = renderer.getClearColor(this._cc), ca = renderer.getClearAlpha();
    const lightOnly = m => m && !Array.isArray(m) && (m.transparent || m.side === THREE.BackSide || m.blending !== THREE.NormalBlending);   // (glows, the sky, the candle's pool, shadow decals)
    hid.length = 0;                                                     // (only what's showing is looked at, and only what's put away remembered)
    scene.traverseVisible(o => { if (o.isPoints || o.isLine || o.isSprite || lightOnly(o.material) || o.userData.noInk) { o.visible = false; hid.push(o); } });
    scene.overrideMaterial = this.ndMat; scene.background = null;
    renderer.setRenderTarget(this.nd); renderer.setClearColor(0x000000, 0); renderer.clear();
    renderer.render(scene, this.camera);
    scene.overrideMaterial = null;
    this.extra?.(renderer, this.camera);                              // (things that draw their own record: the crowd, skinned as it is drawn) scene.background = bg; renderer.setClearColor(cc, ca);
    for (const o of hid) o.visible = true;
    this.fresh = true;
  }
  render(renderer, writeBuffer, readBuffer) {
    if (!this.fresh) this.renderND(renderer); this.fresh = false;
    this.quad.material.uniforms.tDiffuse.value = readBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.quad.render(renderer);
  }
  dispose() { this.nd.dispose(); this.ndMat.dispose(); this.quad.dispose(); }
}
