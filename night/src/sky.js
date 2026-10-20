// The sky over Shibuya, in its two moods.
//   night (uMode 0): after rain — deep blue overhead, low cloud close over the towers lit violet from beneath by the
//     city, no stars.
//   sunset (uMode 1): a clear evening — blue overhead, a band of gold low in the west-south-west where the sun is
//     going down, rose and lilac round the rest of the horizon; a few flat clouds lit from below on the sun's side,
//     bright edged as anime draws them; and on the horizon the far mountains, Fuji among them where it really
//     stands from here (bearing 249°, 94 km), dark against the glow. (They are painted in the sky, not built: from
//     this far they are only a silhouette.)
import * as THREE from 'three';
import { U, col } from './materials.js';

export const FUJI_AZ = 249.4 * Math.PI / 180;                       // (bearing from the crossing, clockwise from north)

export function makeSky() {
  const m = new THREE.ShaderMaterial({
    name: 'sky', side: THREE.BackSide, depthWrite: false,
    uniforms: { uTime: U.uTime, uRain: U.uRain, uMode: { value: 0 }, uClear: { value: 0 }, uBeamHit: { value: Array.from({ length: 18 }, () => new THREE.Vector4()) }, uSunDir: { value: new THREE.Vector3(-0.95, 0.07, 0.3).normalize() },
      uZen: { value: col('#050b22', 0.9) }, uMid: { value: col('#0f1a45', 0.95) }, uHor: { value: col('#3a3466', 0.9) }, uGlow: { value: col('#6a4a7a', 0.7) } },
    vertexShader: `varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uZen, uMid, uHor, uGlow, uSunDir; uniform float uTime, uRain, uMode, uClear; uniform vec4 uBeamHit[18]; varying vec3 vD;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * n(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
      const float PI = 3.14159265;
      // the far mountains along the western horizon, as an elevation (radians) for each bearing
      float ridge(float az){
        float r = 0.0;
        // Fuji: a broad cone with the famous concave flanks, its top cut flat
        float d = (az - ${FUJI_AZ.toFixed(5)}) / 0.17;
        float f = max(0.0, 1.0 - abs(d)); f = pow(f, 1.6) * 0.031; f = min(f, 0.0262 + 0.002 * (1.0 - abs(d) * 6.0));
        r = max(r, f);
        // the Tanzawa and Okutama hills: long low ridges, broken
        float w = smoothstep(3.6, 3.9, az) * (1.0 - smoothstep(5.2, 5.5, az));
        r = max(r, w * (0.007 + 0.006 * n(vec2(az * 9.0, 0.0)) + 0.004 * n(vec2(az * 31.0, 3.0))));
        return r;
      }
      // night: a clear night is near black overhead, the city's glow a dull warm band low round the horizon (brightest
      // toward the centre of Tokyo, east and north-east), a few stars; after rain the low cloud over the city is lit
      // orange-grey from beneath
      vec3 night(vec3 d){
        float y = d.y, az = atan(d.x, -d.z);
        vec3 zen = vec3(0.004, 0.006, 0.016), mid = vec3(0.012, 0.016, 0.034);
        float glowK = 0.75 + 0.35 * cos(az - 1.4);                      // (stronger toward central Tokyo)
        vec3 glow = vec3(0.075, 0.05, 0.04) * glowK;
        vec3 c = mix(mid, zen, smoothstep(0.05, 0.6, y)) + glow * pow(1.0 - max(y, 0.0), 24.0) + glow * 0.2 * pow(1.0 - max(y, 0.0), 6.0);
        if (y > 0.0) {
          vec2 p = d.xz / (y + 0.08) * 1.4 + vec2(uTime * 0.004, uTime * 0.0015);
          float cl = fbm(p), k = smoothstep(0.4, 0.78, cl);
          vec3 under = mix(vec3(0.11, 0.075, 0.06), vec3(0.03, 0.03, 0.045), smoothstep(0.0, 0.5, y));   // (cloud lit by the city: sodium grey)
          float cloudy = mix(0.85, 0.12, uClear);
          c = mix(c, under, k * cloudy * (0.8 - 0.4 * smoothstep(0.2, 0.9, y)));
          // where the searchlights' beams meet a cloud (crosslight.js: the directions of those points from here): its
          // underside lit in a small soft patch, the light spreading a little in it; with no cloud there, nothing
          float spot = 0.0;
          for (int i = 0; i < 18; i++) { vec4 b = uBeamHit[i]; if (b.w < 0.01) continue; float t2 = max(0.0, 2.0 * (1.0 - dot(d, b.xyz))); spot += b.w * (0.6 * exp(-t2 / 0.0006) + 0.3 * exp(-t2 / 0.004)); }   // (a soft patch, the light spreading in the cloud)
          c += vec3(0.55, 0.64, 0.85) * min(spot, 1.5) * k * cloudy * 1.4;   // (only where there is cloud: on a clear night a rare wisp)
          // a few stars, only on a clear night, only overhead
          vec2 sp = d.xz / (y + 0.3) * 120.0; float st = step(0.9965, h(floor(sp))) * smoothstep(0.25, 0.6, y) * uClear * (1.0 - k);
          c += vec3(0.5, 0.55, 0.7) * st * (0.4 + 0.6 * h(floor(sp) + 3.1));
        }
        // on a clear night the hills and Fuji stand dark against the faint glow low in the west (the lights of the
        // plain beyond them: Kanagawa's), the snow on Fuji's top just there in the starlight
        { float az2 = az < 0.0 ? az + 2.0 * PI : az, el = asin(clamp(y, -1.0, 1.0)), rg = ridge(az2);
          float west = smoothstep(3.4, 4.0, az2) * (1.0 - smoothstep(4.9, 5.4, az2));
          c += vec3(0.05, 0.04, 0.045) * west * uClear * pow(1.0 - max(y, 0.0), 60.0);
          if (el < rg && el > -0.002) { float top = smoothstep(rg - 0.005, rg - 0.001, el) * step(0.022, rg);
            c = mix(c, vec3(0.006, 0.008, 0.015) + vec3(0.03, 0.035, 0.05) * top, uClear * 0.92); } }
        if (y < 0.0) c = glow * 0.9;
        return c;
      }
      vec3 sunset(vec3 d){
        vec3 s = normalize(uSunDir); float y = d.y, cs = dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(s.x, 0.0, s.z)));
        float toSun = 0.5 + 0.5 * cs, mu = dot(d, s);
        // the gradient: blue overhead; low down gold toward the sun, rose and lilac away from it
        vec3 zen = vec3(0.10, 0.22, 0.52), mid = vec3(0.30, 0.42, 0.72);
        vec3 horSun = vec3(1.45, 0.68, 0.30), horAway = vec3(0.62, 0.46, 0.66);
        vec3 hor = mix(horAway, horSun, pow(toSun, 3.0));
        float t = smoothstep(-0.02, 0.32, y);
        vec3 c = mix(hor, mid, pow(t, 0.7)); c = mix(c, zen, smoothstep(0.25, 0.9, y));
        c += vec3(1.2, 0.55, 0.22) * pow(max(mu, 0.0), 8.0) * 0.55 * (1.0 - smoothstep(0.0, 0.5, y));   // (the glow round the sun)
        // the sun: a white-gold disc just above the haze, softened at its foot
        float disc = smoothstep(0.9993, 0.9996, mu);
        c += vec3(9.0, 6.2, 3.4) * disc * smoothstep(-0.005, 0.02, y);
        c += vec3(2.5, 1.4, 0.6) * pow(max(mu, 0.0), 300.0);
        // flat clouds: lit beneath on the sun's side, bright rims, lilac shade away from it
        if (y > 0.0) {
          vec2 p = d.xz / (y + 0.12) * 0.9 + vec2(uTime * 0.002, 0.0);
          float cl = fbm(p * vec2(1.0, 2.2)), k = smoothstep(0.55, 0.62, cl) * (1.0 - smoothstep(0.35, 0.8, y));
          float rim = smoothstep(0.55, 0.6, cl) - smoothstep(0.6, 0.66, cl);
          vec3 lit = mix(vec3(0.75, 0.52, 0.66), vec3(1.6, 0.9, 0.55), pow(toSun, 2.0));
          c = mix(c, lit * (0.85 + 0.3 * n(p * 6.0)), k * 0.85);
          c += vec3(1.4, 0.9, 0.5) * rim * pow(toSun, 3.0) * 0.6;
        }
        // the far mountains on the horizon: dark lilac, a little lighter where the sun is behind them
        float az = atan(d.x, -d.z); if (az < 0.0) az += 2.0 * PI;
        float el = asin(clamp(y, -1.0, 1.0)), rg = ridge(az);
        if (el < rg && el > -0.002) c = mix(vec3(0.36, 0.30, 0.42), vec3(0.62, 0.42, 0.42), pow(toSun, 4.0)) * (0.9 + 0.1 * el / max(rg, 1e-4));
        if (y < -0.002) c = mix(vec3(0.42, 0.36, 0.42), vec3(0.85, 0.55, 0.38), pow(toSun, 3.0)) * 0.7;   // (below the horizon: the far haze over the plain)
        return c;
      }
      void main(){
        vec3 d = normalize(vD);
        vec3 c = uMode < 0.01 ? night(d) : uMode > 0.99 ? sunset(d) : mix(night(d), sunset(d), uMode);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 24), m);
  mesh.frustumCulled = false; mesh.renderOrder = -10; mesh.userData.noInk = true;
  return mesh;
}
