// Captured motion onto a VRoid character: the maps from the two rigs our clips come in — Quaternius' Universal
// Animation Library (Rigify DEF- bones) and Mixamo (mixamorig: bones) — to VRM's humanoid bones, and the
// retargeting itself. Shared by you (avatar.js) and the townsfolk (townsfolk.js).
import * as THREE from 'three';

export const san = n => THREE.PropertyBinding.sanitizeNodeName(n);
// the library's rig (Rigify DEF- bones) → VRM humanoid bones
const MAP = { 'DEF-hips': 'hips', 'DEF-spine.001': 'spine', 'DEF-spine.002': 'chest', 'DEF-spine.003': 'upperChest', 'DEF-neck': 'neck', 'DEF-head': 'head' };
for (const [s, S] of [['L', 'left'], ['R', 'right']]) {
  Object.assign(MAP, {
    [`DEF-shoulder.${s}`]: `${S}Shoulder`, [`DEF-upper_arm.${s}`]: `${S}UpperArm`, [`DEF-forearm.${s}`]: `${S}LowerArm`, [`DEF-hand.${s}`]: `${S}Hand`,
    [`DEF-thigh.${s}`]: `${S}UpperLeg`, [`DEF-shin.${s}`]: `${S}LowerLeg`, [`DEF-foot.${s}`]: `${S}Foot`, [`DEF-toe.${s}`]: `${S}Toes`,
    [`DEF-thumb.01.${s}`]: `${S}ThumbMetacarpal`, [`DEF-thumb.02.${s}`]: `${S}ThumbProximal`, [`DEF-thumb.03.${s}`]: `${S}ThumbDistal`,
  });
  for (const [f, F] of [['index', 'Index'], ['middle', 'Middle'], ['ring', 'Ring'], ['pinky', 'Little']])
    Object.assign(MAP, { [`DEF-f_${f}.01.${s}`]: `${S}${F}Proximal`, [`DEF-f_${f}.02.${s}`]: `${S}${F}Intermediate`, [`DEF-f_${f}.03.${s}`]: `${S}${F}Distal` });
}
export const SMAP = Object.fromEntries(Object.entries(MAP).map(([k, v]) => [san(k), v]));
// Mixamo's rig (mixamorig:… bones) → VRM humanoid bones
const MIX = { Hips: 'hips', Spine: 'spine', Spine1: 'chest', Spine2: 'upperChest', Neck: 'neck', Head: 'head' };
for (const [s, S] of [['Left', 'left'], ['Right', 'right']]) {
  Object.assign(MIX, { [`${s}Shoulder`]: `${S}Shoulder`, [`${s}Arm`]: `${S}UpperArm`, [`${s}ForeArm`]: `${S}LowerArm`, [`${s}Hand`]: `${S}Hand`,
    [`${s}UpLeg`]: `${S}UpperLeg`, [`${s}Leg`]: `${S}LowerLeg`, [`${s}Foot`]: `${S}Foot`, [`${s}ToeBase`]: `${S}Toes`,
    [`${s}HandThumb1`]: `${S}ThumbMetacarpal`, [`${s}HandThumb2`]: `${S}ThumbProximal`, [`${s}HandThumb3`]: `${S}ThumbDistal` });
  for (const [f, F] of [['Index', 'Index'], ['Middle', 'Middle'], ['Ring', 'Ring'], ['Pinky', 'Little']])
    Object.assign(MIX, { [`${s}Hand${f}1`]: `${S}${F}Proximal`, [`${s}Hand${f}2`]: `${S}${F}Intermediate`, [`${s}Hand${f}3`]: `${S}${F}Distal` });
}
export const XMAP = Object.fromEntries(Object.entries(MIX).map(([k, v]) => [san('mixamorig:' + k), v]));

// a clip of the library's rig (or Mixamo's, with its map), as a clip of this VRM's normalized bones. Rotations become each bone's turn away
// from the library's T-pose, in world-aligned axes — what VRM's normalized bones (identity at T-pose) take; the
// hips' travel is scaled to this character's leg length and centred (the clips walk on the spot)
export function retarget(clip, rest, vrm, hipsScale, skip = null, map = SMAP) {
  const tracks = [], v0 = vrm.meta?.metaVersion === '0', q = new THREE.Quaternion(), p = new THREE.Vector3();
  for (const tr of clip.tracks) {
    const k = tr.name.lastIndexOf('.'), node = tr.name.slice(0, k), prop = tr.name.slice(k + 1), bone = map[node];
    if (!bone || (skip && skip.has(bone))) continue;
    const target = vrm.humanoid.getNormalizedBoneNode(bone); if (!target) continue;
    const r = rest.get(node);
    if (prop === 'quaternion') {
      const vals = new Float32Array(tr.values.length);
      for (let i = 0; i < vals.length; i += 4) {
        q.fromArray(tr.values, i).premultiply(r.parentWorld).multiply(r.worldInv);
        vals[i] = v0 ? -q.x : q.x; vals[i + 1] = q.y; vals[i + 2] = v0 ? -q.z : q.z; vals[i + 3] = q.w;
      }
      tracks.push(new THREE.QuaternionKeyframeTrack(`${target.name}.quaternion`, tr.times, vals));
    } else if (prop === 'position' && bone === 'hips') {
      const vals = new Float32Array(tr.values.length); let mx = 0, mz = 0; const n = vals.length / 3;
      for (let i = 0; i < vals.length; i += 3) { p.fromArray(tr.values, i).applyMatrix4(r.parentMatrixWorld); vals[i] = p.x; vals[i + 1] = p.y; vals[i + 2] = p.z; mx += p.x / n; mz += p.z / n; }
      for (let i = 0; i < vals.length; i += 3) {
        const x = (vals[i] - mx) * hipsScale, y = vals[i + 1] * hipsScale, z = (vals[i + 2] - mz) * hipsScale;
        vals[i] = v0 ? -x : x; vals[i + 1] = y; vals[i + 2] = v0 ? -z : z;
      }
      tracks.push(new THREE.VectorKeyframeTrack(`${target.name}.position`, tr.times, vals));
    }
  }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

// a rig at rest: for each of its mapped bones, the turn of its parent and of itself in the world, and its parent's matrix
export function restOf(root, map) {
  root.updateMatrixWorld(true); const rest = new Map();
  root.traverse(o => { if (map[o.name]) rest.set(o.name, { parentWorld: o.parent.getWorldQuaternion(new THREE.Quaternion()), worldInv: o.getWorldQuaternion(new THREE.Quaternion()).invert(), parentMatrixWorld: o.parent.matrixWorld.clone() }); });
  return rest;
}
