// The look of the night city, shared by everything drawn: the anime look of the Norwegian town carried over —
// clean flat colour, light in two tones, a drawn line (ink.js) — under a Tokyo night: a deep blue sky lit from
// below by the city, every surface near the street washed by the light of the shop fronts, signs and screens
// round it (painted once from above into a light map, as in the town, plus the screens' changing colour on top),
// and, after rain, the wet ground giving back all of it.
import * as THREE from 'three';

export const col = (hex, k = 1) => new THREE.Color(hex).multiplyScalar(k);   // sRGB hex → linear

export const U = {
  uTime: { value: 0 },
  // the night: ambient from the sky above and from the lit street below, and a soft key light from the city glow
  uSky: { value: new THREE.Color(0.11, 0.15, 0.31) }, uGround: { value: new THREE.Color(0.07, 0.065, 0.11) },
  uMoonDir: { value: new THREE.Vector3(0.35, 0.8, 0.45).normalize() }, uMoonCol: { value: new THREE.Color(0.13, 0.16, 0.3) },
  uAurora: { value: new THREE.Color(0, 0, 0) },                     // (the character's lights read it: no aurora over Tokyo)
  uFogColor: { value: col('#101735', 0.6) }, uHaze: { value: col('#2c2a52', 0.5) }, uFogDensity: { value: 0.0006 },
  // the street's own light from above: shop fronts, lamps, the screens (rgb), contact shadow (a)
  uLightTex: { value: null }, uLightBox: { value: new THREE.Vector4(-1, -1, 2, 2) }, uLightH: { value: 7.0 }, uLightK: { value: 0.55 },
  uScreenTex: { value: null }, uScreenCol: { value: [0, 1, 2, 3].map(() => new THREE.Color(0, 0, 0)) },
  uWet: { value: 1.0 }, uRain: { value: 1.0 }, uCheap: { value: 0 },
  uRefl: { value: null }, uReflOn: { value: 0 }, uReflMat: { value: new THREE.Matrix4() }, uReflY: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
  uBehind: { value: null },                                         // (the scene as last drawn, half size: what the drops on the glass see — main.js)
  uStyle: { value: new THREE.Vector4(0.12, 0.08, 0.3, 0.0) },        // x: take out grey, y: lift toward white, z: how light the side away from the key light stays
  // the time of day (timeofday.js): 0 night … 1 a clear evening; how much of the key light (the sun) reaches down
  // among the buildings (x: what's left of it at the street, y–z: the heights over which it comes in); the haze on
  // the sun's side; how strong the shop fronts' pools are against the daylight
  uDay: { value: 0 }, uKeyH: { value: new THREE.Vector3(1, 0, 1) }, uSunHaze: { value: new THREE.Color(0, 0, 0) }, uPoolK: { value: 1 },
  // the sun's shadows where they matter (the roof of Scramble Square): a depth picture from the sun (shadow.js)
  uShadowTex: { value: null }, uShadowMat: { value: new THREE.Matrix4() }, uShadowOn: { value: 0 },
  // the city's lights coming on (0 none … 1 all: farcity.js), how bright they are
  uLightsOn: { value: 1 }, uCityLightK: { value: 1 },
  // the roof's own light at night (skystage.js): its lamps, the downlights on the frames, the escalators' glow,
  // painted from above, the floor's height in the alpha
  uRoofTex: { value: (() => { const t = new THREE.DataTexture(new Float32Array([0, 0, 0, 0.9]), 1, 1, THREE.RGBAFormat, THREE.FloatType); t.needsUpdate = true; return t; })() },
  uRoofBox: { value: new THREE.Vector4(0, 0, 1, 1) }, uRoofK: { value: 0 },
  // the run's tall glass: its true reflection (reflect.js PlaneMirror)
  uGRefl: { value: null }, uGReflMat: { value: new THREE.Matrix4() }, uGReflOn: { value: 0 }, uGPlane: { value: new THREE.Vector4(0, 0, 0, 1e9) },   // (the roof glass's mirror, and which pane of it: n·p = w)
};

export const GLSL_COMMON = /* glsl */`
  uniform vec3 uSky, uGround, uMoonDir, uMoonCol, uFogColor, uHaze; uniform float uFogDensity, uTime, uLightH, uLightK, uWet, uRain;
  uniform sampler2D uLightTex, uScreenTex; uniform vec4 uLightBox; uniform vec3 uScreenCol[4]; uniform vec4 uStyle;
  uniform float uDay, uPoolK, uShadowOn, uLightsOn, uRoofK; uniform vec3 uKeyH, uSunHaze; uniform sampler2D uShadowTex, uRoofTex; uniform mat4 uShadowMat; uniform vec4 uRoofBox;
  // the roof's light: what the lamps there throw on what is over the floor below them
  vec3 roofLight(vec3 w, vec3 n){
    if (uRoofK < 0.001) return vec3(0.0);
    vec2 uv = (w.xz - uRoofBox.xy) / uRoofBox.zw;
    if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec3(0.0);
    vec4 t = texture2D(uRoofTex, uv); float up = w.y - (220.0 + t.a * 10.0);
    if (up < -0.6) return vec3(0.0);
    return t.rgb * exp(-max(up, 0.0) / 2.4) * (0.6 + 0.4 * max(n.y, 0.0) + 0.3 * (1.0 - abs(n.y))) * uRoofK;
  }
  // in the sun's shadow? (soft: four taps)
  float sunShadow(vec3 w){
    if (uShadowOn < 0.5) return 1.0;
    vec4 p = uShadowMat * vec4(w, 1.0); vec3 q = p.xyz / p.w * 0.5 + 0.5;
    if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0 || q.z > 1.0) return 1.0;
    float s = 0.0, e = 1.0 / 2048.0;
    for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) s += step(q.z - 0.0013, texture2D(uShadowTex, q.xy + vec2(float(i), float(j)) * e * 1.2).r);
    float edge = smoothstep(0.75, 0.98, max(abs(q.x - 0.5), abs(q.y - 0.5)) * 2.0);   // (fading out toward its edge)
    return mix(s / 9.0, 1.0, edge);
  }
  float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  float hash13(vec3 p3){ p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y); }
  vec2 lightUV(vec3 w){ return (w.xz - uLightBox.xy) / uLightBox.zw; }
  // the light falling here from the street round it: the painted pools, and the screens' light by its weights
  vec3 streetLight(vec3 w, vec3 n){
    if (w.y > 150.0) return roofLight(w, n);
    vec2 uv = lightUV(w + vec3(n.x, 0.0, n.z) * 0.8);                 // (a wall takes the light of the pool in front of it)
    if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec3(0.0);
    vec3 l = texture2D(uLightTex, uv).rgb * uPoolK;
    vec4 s = texture2D(uScreenTex, uv);
    l += s.x * uScreenCol[0] + s.y * uScreenCol[1] + s.z * uScreenCol[2] + s.w * uScreenCol[3];
    float up = max(w.y, 0.0);
    l *= exp(-up / uLightH) * (0.55 + 0.45 * max(n.y, 0.0) + 0.35 * (1.0 - abs(n.y)));
    return l / (1.0 + dot(l, vec3(0.333)) * uLightK);                  // (never a white centre: the colour and the reach kept, the peak held back)
  }
  float contactShade(vec3 w){ vec2 uv = lightUV(w); if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 0.0; return texture2D(uLightTex, uv).a * exp(-max(w.y, 0.0) / 1.2); }
  // the anime light: ambient from sky and street, a key in two tones (the side away from it is not crushed)
  vec3 toonLight(vec3 n, vec3 w){
    float up = n.y * 0.5 + 0.5;
    vec3 amb = mix(uGround, uSky, smoothstep(0.15, 0.85, up));
    float k = smoothstep(-0.04, 0.08, dot(n, uMoonDir));
    float reach = mix(uKeyH.x, 1.0, smoothstep(uKeyH.y, uKeyH.z, w.y));   // (the low sun reaches the towers' tops, not the street between them)
    k *= reach * sunShadow(w + n * 0.1 + uMoonDir * 0.05);          // (offset along the facing: no speckle on surfaces the low sun grazes)
    k = mix(uStyle.z, 1.0, k);
    return amb + uMoonCol * k + streetLight(w, n);
  }
  vec3 cleanColour(vec3 c){ float l = dot(c, vec3(0.299, 0.587, 0.114)); c = mix(vec3(l), c, 1.0 + uStyle.x); return mix(c, vec3(1.0), uStyle.y * (1.0 - l)); }
  // the wet night air: far things sink into a blue haze, lighter and a little violet low down where the city lights it
  vec3 fogIt(vec3 c, vec3 w){
    vec3 d = w - cameraPosition; float dist = length(d);
    float f = 1.0 - exp(-dist * uFogDensity);
    float low = 1.0 - smoothstep(0.0, 160.0, w.y);
    vec3 fc = mix(uFogColor, uHaze, low * 0.7);
    fc += uSunHaze * pow(max(dot(d / max(dist, 1e-3), uMoonDir), 0.0), 3.0);   // (toward the low sun the haze glows gold)
    return mix(c, fc, f);
  }
`;

// a surface lit as the street is: vertex colour (or a colour) as its paint, emissive parts given by aEm
export function toon({ color = null, emissive = 0, side = THREE.FrontSide, defines = {}, transparent = false, opacity = 1, name = '' } = {}) {
  const m = new THREE.ShaderMaterial({
    name, side, transparent, defines: { ...defines, ...(color ? {} : { VCOL: 1 }) },
    uniforms: { ...U, uColor: { value: color ? col(color) : new THREE.Color(1, 1, 1) }, uEm: { value: emissive }, uOpacity: { value: opacity } },
    vertexShader: /* glsl */`
      #ifdef VCOL
        attribute vec3 color;
      #endif
      attribute float aEm;
      varying vec3 vC, vN, vW; varying float vE;
      void main(){
        #ifdef VCOL
          vC = color;
        #else
          vC = vec3(1.0);
        #endif
        vE = 0.0;
        #ifdef EMISSIVE
          vE = aEm;
        #endif
        vec4 w = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          w = instanceMatrix * w;
          vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        #else
          vN = normalize(mat3(modelMatrix) * normal);
        #endif
        w = modelMatrix * w; vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      ${GLSL_COMMON}
      uniform vec3 uColor; uniform float uEm, uOpacity;
      varying vec3 vC, vN, vW; varying float vE;
      void main(){
        vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
        vec3 base = cleanColour(vC * uColor) * mix(0.8, 1.0, uDay);      // (at night the pale paint and steel sink back a little)
        #ifdef METAL
          base *= mix(0.42, 1.0, uDay);                                    // (polished steel at night: dark, but for its highlights)
        #endif
        vec3 c = base * toonLight(n, vW) * (1.0 - 0.55 * contactShade(vW));
        if (uWet > 0.0 && vW.y > 200.0 && n.y > 0.7) {                 // (up on the roof in the rain, what lies flat wet: darker, the lamps and the sky in its sheen)
          vec3 V = normalize(cameraPosition - vW); float f = pow(1.0 - max(dot(n, V), 0.0), 4.0);
          c = c * (1.0 - 0.32 * uWet) + (streetLight(vW + n * 0.4, n) * 0.6 + uSky * 0.9 + vec3(0.03, 0.035, 0.05)) * f * 0.8 * uWet;
        }
        c = mix(c, vC * uColor * 2.4, clamp(vE + uEm, 0.0, 1.0));       // (what gives light: its own colour, bright)
        #ifdef METAL
          { vec3 V = normalize(cameraPosition - vW); float f = pow(1.0 - max(dot(n, V), 0.0), 3.0); c += (streetLight(vW + n * 0.4, n) * 0.9 + uSky * 0.6) * f; }   // (the lamps' light in its polish)
        #endif
        gl_FragColor = vec4(fogIt(c, vW), uOpacity);
      }`,
  });
  return m;
}

// light-only things: a lamp's glass, a lit sign, a screen's glow — their colour, bright, fading into the haze
export function glowMat({ color = '#ffffff', k = 2.0, vcol = false, side = THREE.FrontSide } = {}) {
  return new THREE.ShaderMaterial({
    side, defines: vcol ? { VCOL: 1 } : {},
    uniforms: { ...U, uColor: { value: col(color, k) } },
    vertexShader: `
      #ifdef VCOL
        attribute vec3 color;
      #endif
      varying vec3 vC, vW;
      void main(){
        #ifdef VCOL
          vC = color;
        #else
          vC = vec3(1.0);
        #endif
        vec4 w = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          w = instanceMatrix * w;
        #endif
        w = modelMatrix * w; vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${GLSL_COMMON} uniform vec3 uColor; varying vec3 vC, vW;
      void main(){ vec3 c = vC * uColor; float d = distance(vW, cameraPosition); gl_FragColor = vec4(mix(c, uFogColor, (1.0 - exp(-d * uFogDensity)) * 0.6), 1.0); }`,
  });
}
