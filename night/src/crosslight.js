// CROSSING LIGHT: SHIBUYA SKY's eighteen searchlights (docs/research/调研-SHIBUYA SKY屋顶夜景与室内.md). From 19:00 to 22:00, on
// the hour and the half hour, a show of light and music: the beams straight up into the night, pale blue-white, thin
// (the photographs: Commons, Dick Thomas Johnson 2020-01-02 20:31). What they do in a show — how long it lasts, whether
// they lean and cross — isn't written anywhere; here (a guess the name invites): they come on one by one, stand, then
// lean so that the two rows cross over the roof, sway, stand again, and go out, about four minutes in all.
// A beam is not a line of light but the air lit: the haze and dust it passes through throw a little of its light
// out to the eye. So, worked out for each pixel of it —
//   · across it soft (the lamp's light falls off from its axis), with a faint wide halo of the light scattered twice;
//   · the light spreading as it goes (half a degree), so the same light over more air: dimmer in proportion;
//   · the air thinning with height (the haze is mostly in the lowest kilometre): the beam fades out upward of itself,
//     there is no end to it — it goes on, unseen, past where there is air enough to show it;
//   · brighter where you look along it (more lit air on the line of sight), brighter looking toward the lamp than
//     away from it (haze throws light forward), drifting thicker and thinner as the haze moves through it;
//   · where it meets a cloud, the cloud's underside lit in a small soft patch (the sky does that: sky.js, setBeams).
// Not in rain (the roof is shut). The clock: the evening's starts at 20:29:20 when the clear night is chosen, and runs.
import * as THREE from 'three';
import { U } from './materials.js';

const N = 18, LEN = 7000, SEG = 48;
export class CrossingLight {
  constructor(points, out) {
    this.points = points; this.out = new THREE.Vector3(out[0], 0, out[1]);   // (out: the way the rows lean, across them)
    const P = [], A = [], S = [];
    points.forEach((p, i) => {
      for (let k = 0; k < SEG; k++) {
        const s0 = LEN * (k / SEG) ** 2.2, s1 = LEN * ((k + 1) / SEG) ** 2.2;   // (the segments short near the lamp, long far up)
        for (const [x, s] of [[-1, s0], [1, s0], [1, s1], [-1, s0], [1, s1], [-1, s1]]) { P.push(x, s, 0); A.push(p.x, p.y, p.z); S.push(i, i < N / 2 ? -1 : 1); }
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('aBase', new THREE.Float32BufferAttribute(A, 3)); g.setAttribute('aIdx', new THREE.Float32BufferAttribute(S, 2));
    this.uniforms = { uTilt: { value: new Float32Array(N * 2) }, uOn: { value: new Float32Array(N) }, uLean: { value: this.out }, uTime: U.uTime, uRain: U.uRain };
    this.mat = new THREE.ShaderMaterial({
      name: 'crossing light', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: this.uniforms,
      vertexShader: /* glsl */`
        attribute vec3 aBase; attribute vec2 aIdx; uniform float uTilt[${N * 2}], uOn[${N}]; uniform vec3 uLean;
        varying float vX, vS, vH, vOn, vIdx, vSin, vCos, vDist;
        vec3 beamDir(int i){ vec3 side = normalize(cross(uLean, vec3(0.0, 1.0, 0.0))); return normalize(vec3(0.0, 1.0, 0.0) + uLean * tan(uTilt[i * 2]) + side * tan(uTilt[i * 2 + 1])); }
        void main(){
          int i = int(aIdx.x + 0.5); vec3 dir = beamDir(i);
          float s = position.y;
          vec3 p = aBase + dir * s;
          vec3 toEye = cameraPosition - p; float dist = length(toEye); toEye /= max(dist, 1e-3);
          vec3 across = normalize(cross(dir, toEye));
          float sig = 0.16 + s * 0.0042;                                 // (the beam's radius, its light's spread: about half a degree)
          p += across * position.x * sig * 3.5;
          vX = position.x * 3.5; vS = s; vH = p.y; vOn = uOn[i]; vIdx = aIdx.x;
          vSin = length(cross(dir, -toEye)); vCos = dot(dir, toEye); vDist = dist;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform float uTime, uRain; varying float vX, vS, vH, vOn, vIdx, vSin, vCos, vDist;
        float hh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }
        void main(){
          if (vOn < 0.002) discard;
          float core = exp(-vX * vX * 0.5), halo = exp(-abs(vX) * 1.1) * 0.06;   // (vX in the beam's radii)
          float spread = 0.16 / (0.16 + vS * 0.0042);                    // (its light over more air as it widens)
          float h = max(vH - 229.0, 0.0), air = exp(-h / 340.0) * 0.93 + exp(-h / 1100.0) * 0.07;    // (the haze thinning with height: most of it in the lowest few hundred metres over the city)
          float g = 0.55, phase = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * vCos, 1.5) * 0.35 + 0.3;   // (thrown forward: brighter toward the lamp)
          float sight = 1.0 / max(vSin, 0.3);                           // (looked along, more of it on the line of sight)
          float drift = 0.72 + 0.5 * vn(vec2(vS * 0.0035 - uTime * 0.06, vIdx * 7.3)) + 0.25 * vn(vec2(vS * 0.02 - uTime * 0.25, vIdx * 3.1));
          float mouth = 1.0 + 1.8 * exp(-vS / 1.0);                      // (the lamp's own glow where it leaves the dome)
          float far = exp(-vDist / 9000.0);
          float k = (core + halo) * pow(spread, 0.85) * air * phase * sight * drift * mouth * far * vOn;
          k = k / (1.0 + k * 0.35);                                      // (never a hard white rod: the brightest held back)
          vec3 c = mix(vec3(0.62, 0.76, 1.0), vec3(0.95, 0.97, 1.0), clamp(core * mouth * 0.25, 0.0, 1.0)) * k * 0.42;
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 7; this.mesh.userData.noInk = true;
    this.clock = null; this.forced = null;
    this.dirs = Array.from({ length: N }, () => new THREE.Vector3(0, 1, 0)); this._s = new THREE.Vector3(); this._u = new THREE.Vector3(0, 1, 0);
  }
  // the evening's clock in seconds after midnight (null: not an evening the show is on)
  setEvening(on) { this.clock = on ? 20 * 3600 + 29 * 60 + 20 : null; }
  update(dt, allowed) {
    if (this.clock != null) this.clock += dt;
    // where in a show we are (s since it began), if one is on
    let t = -1;
    if (this.forced != null) t = this.forced;
    else if (allowed && this.clock != null) { const c = this.clock; if (c >= 19 * 3600 && c < 22 * 3600 + 300) t = c % 1800; }
    const on = this.uniforms.uOn.value, tilt = this.uniforms.uTilt.value, SHOW = 240, side = this._s.crossVectors(this.out, this._u).normalize();
    for (let i = 0; i < N; i++) {
      const row = i < N / 2 ? 0 : 1, k = i % (N / 2);
      let a = 0, lean = 0, sway = 0;
      if (t >= 0 && t < SHOW) {
        a = THREE.MathUtils.smoothstep(t, 2 + k * 1.2, 2.6 + k * 1.2) * (1 - THREE.MathUtils.smoothstep(t, SHOW - 12 + k * 0.8, SHOW - 11.4 + k * 0.8));   // (on one by one along the rows, out the same way: a lamp's quick fade)
        const cross = THREE.MathUtils.smootherstep(t, 40, 56) * (1 - THREE.MathUtils.smootherstep(t, 148, 164));
        lean = (row ? -1 : 1) * 0.19 * cross;                           // (the two rows lean toward each other and cross over the roof)
        sway = Math.sin(t * 0.55 + k * 0.7) * 0.06 * THREE.MathUtils.smootherstep(t, 86, 100) * (1 - THREE.MathUtils.smootherstep(t, 134, 148));
        a *= 0.85 + 0.15 * Math.sin(t * 5.0 + k) * THREE.MathUtils.smoothstep(t, 165, 170) * (1 - THREE.MathUtils.smoothstep(t, 205, 210));   // (a pulse, with the music)
      }
      on[i] = a; tilt[i * 2] = lean; tilt[i * 2 + 1] = sway;
      this.dirs[i].set(0, 1, 0).addScaledVector(this.out, Math.tan(lean)).addScaledVector(side, Math.tan(sway)).normalize();
    }
    this.mesh.visible = on.some(v => v > 0.002);
    return t;
  }
  // where each beam meets the cloud base (about 1.8 km up), seen from the camera: for the sky's lit patches
  cloudHits(camera, out) {
    const on = this.uniforms.uOn.value;
    for (let i = 0; i < N; i++) {
      const d = this.dirs[i], p = this.points[i], t = (1800 - p.y) / Math.max(d.y, 0.05);
      const v = this._s.set(p.x + d.x * t - camera.position.x, p.y + d.y * t - camera.position.y, p.z + d.z * t - camera.position.z).normalize();
      out[i].set(v.x, v.y, v.z, on[i]);
    }
  }
}
