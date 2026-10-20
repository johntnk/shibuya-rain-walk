// The shadow at your feet. In the night street the light comes from every side — shop fronts, screens, lamps —
// so there is no one long shadow, only the soft dark where you stand, and a fainter one drawn out away from the
// brightest light near you (avatar.js turns it to face away from it).
import * as THREE from 'three';

export function shadowDecal() {
  const L = 2.6, g = new THREE.PlaneGeometry(L + 1.0, 1.2).rotateX(-Math.PI / 2).translate(L / 2, 0, 0);
  const m = new THREE.ShaderMaterial({
    uniforms: { uLen: { value: 2.9 }, uWalk: { value: 0 }, uK: { value: 0.5 } },
    transparent: true, depthWrite: false, premultipliedAlpha: true, blending: THREE.MultiplyBlending,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    vertexShader: `varying vec2 vL; void main(){ vL = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uLen, uWalk, uK; varying vec2 vL;
      void main(){
        float contact = 1.0 - smoothstep(0.03, 0.36, length(vL * vec2(1.0, 1.25)));
        float u = vL.x / uLen, v = abs(vL.y);
        float wdt = u < 0.0 ? 0.0 : mix(0.2, 0.08, clamp(u, 0.0, 1.0));
        float body = (1.0 - smoothstep(wdt - 0.08, wdt + 0.08, v)) * smoothstep(-0.05, 0.05, u) * (1.0 - smoothstep(0.75, 1.0, u));
        float a = max(contact * 0.55, body * 0.32 * uK * (1.0 - 0.6 * u));
        gl_FragColor = vec4(mix(vec3(1.0), vec3(0.3, 0.36, 0.55), a), 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.layers.set(1); mesh.userData.noInk = true;
  return mesh;
}
