// The three moods of this Shibuya, each one setting for the whole of it — street and roof alike:
//   sunset  落日观景  a clear October evening a few minutes before sunset (17:05): the sun low in the
//           west-south-west (bearing 251°, just right of where Fuji stands from here), dry streets, no umbrellas;
//           the sun's gold on the towers' tops while the streets between them are already in cool shade; the first
//           of the city's lights coming on
//   clear   夜景观景  20:30, a clear night: a dark sky with the city's glow low round the horizon, every light on —
//           the flats' windows, the offices floor by floor, the streets' lamps and the traffic; dry
//   night   雨夜漫游  21:40 after rain: wet ground, rain, umbrellas, the low cloud lit from below
import * as THREE from 'three';
import { U, col } from './materials.js';

const sunDir = (azDeg, elDeg) => { const a = azDeg * Math.PI / 180, e = elDeg * Math.PI / 180; return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)); };   // (x east, z south)
const NIGHT_HERO = { hemi: [0.36, 0.4, 0.55], gnd: [0.2, 0.18, 0.26], hemiK: 0.85, key: [0.36, 0.4, 0.52], keyK: 1.0 };

export const PRESETS = {
  sunset: {
    name: '落日观景', clock: '17:05', sky: 1, clearSky: 1, sun: sunDir(251, 6.5),
    amb: new THREE.Color(0.17, 0.19, 0.36), gnd: new THREE.Color(0.13, 0.1, 0.13), key: new THREE.Color(1.0, 0.56, 0.3).multiplyScalar(1.3), shade: 0.1,
    keyH: new THREE.Vector3(0.12, 18, 75),                             // (at the street the sun is mostly gone; from 75 m up, all of it)
    fog: col('#6f6f9a', 0.6), haze: col('#b8888a', 0.6), sunHaze: new THREE.Color(0.62, 0.34, 0.12), density: 0.00011,
    wet: 0, rain: 0, day: 1, pool: 0.45, lightsOn: 0.26, cityK: 0.8, roof: 0.05, exposure: 0.95, bloom: [0.3, 0.45, 1.3],
    hero: { hemi: [0.62, 0.68, 0.86], gnd: [0.36, 0.32, 0.34], hemiK: 0.9, key: [1.0, 0.7, 0.48], keyK: 1.25, cap: 2.3 },
  },
  clear: {
    name: '夜景观景', clock: '20:30', sky: 0, clearSky: 1, sun: new THREE.Vector3(-0.3, 0.75, 0.55).normalize(),
    amb: new THREE.Color(0.075, 0.095, 0.17), gnd: new THREE.Color(0.06, 0.05, 0.06), key: new THREE.Color(0.07, 0.085, 0.15), shade: 0.35,
    keyH: new THREE.Vector3(1, 0, 1),
    fog: col('#080a14', 0.6), haze: col('#1c1517', 0.6), sunHaze: new THREE.Color(0, 0, 0), density: 0.00014,
    wet: 0, rain: 0, day: 0, pool: 1, lightsOn: 1, cityK: 1.2, roof: 0.26, exposure: 1.0, bloom: [0.42, 0.38, 1.1],
    hero: NIGHT_HERO,
  },
  night: {
    name: '雨夜漫游', clock: '21:40', sky: 0, clearSky: 0, sun: new THREE.Vector3(0.35, 0.8, 0.45).normalize(),
    amb: new THREE.Color(0.095, 0.13, 0.27), gnd: new THREE.Color(0.065, 0.06, 0.1), key: new THREE.Color(0.11, 0.135, 0.26), shade: 0.3,
    keyH: new THREE.Vector3(1, 0, 1),
    fog: col('#121628', 0.6), haze: col('#2e2830', 0.5), sunHaze: new THREE.Color(0, 0, 0), density: 0.00045,
    wet: 1, rain: 1, day: 0, pool: 1, lightsOn: 0.92, cityK: 1.0, roof: 0.26, exposure: 1.0, bloom: [0.42, 0.38, 1.05],
    hero: NIGHT_HERO,
  },
};
export const MOODS = ['sunset', 'clear', 'night'];

export class TimeOfDay {
  constructor({ sky, renderer, bloom, hero }) { Object.assign(this, { sky, renderer, bloom, hero }); this.name = null; this.rainWanted = 0; }
  // set at once (between scenes the screen is faded, so no blend is needed)
  set(name) {
    const P = PRESETS[name]; if (!P) return; this.name = name; this.P = P;
    U.uSky.value.copy(P.amb); U.uGround.value.copy(P.gnd); U.uMoonDir.value.copy(P.sun); U.uMoonCol.value.copy(P.key);
    U.uKeyH.value.copy(P.keyH); U.uFogColor.value.copy(P.fog); U.uHaze.value.copy(P.haze); U.uSunHaze.value.copy(P.sunHaze); U.uFogDensity.value = P.density;
    U.uStyle.value.z = P.shade; U.uWet.value = P.wet; U.uRain.value = P.rain; this.rainWanted = P.rain; U.uDay.value = P.day; U.uPoolK.value = P.pool;
    U.uLightsOn.value = P.lightsOn; U.uCityLightK.value = P.cityK; U.uRoofK.value = P.roof;
    const su = this.sky.material.uniforms; su.uMode.value = P.sky; su.uSunDir.value.copy(P.sun); su.uClear.value = P.clearSky;
    this.renderer.toneMappingExposure = P.exposure;
    [this.bloom.strength, this.bloom.radius, this.bloom.threshold] = P.bloom;
    if (this.hero) this.hero.lightSet = P.hero;
  }
}
