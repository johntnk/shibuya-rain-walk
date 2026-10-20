// The townsfolk (assets/npc/npcNN.vrm, made in VRoid): what each wears, in quiet winter colours — a Japanese winter
// romance manga's palette, nothing loud. VRoid gave the shapes (coat, sweater, hoodie, skirt…); the colours are put
// on here, keeping the cloth's own folds; a hoodie becomes a down jacket by its quilted channels; and each gets
// the scarf, beanie or glasses that make them who they are.
import * as THREE from 'three';
import { materials, repaint, tint } from './kit.js';
import { beanie, scarf, glasses, earmuffs, furMuffs } from './wear.js';
import { puffer, glossy, dropHood, puffCollar, ruffle, zipper } from './puffer.js';
import { denim, denimTex } from './denim.js';
import { uggs, teddy, suede } from './boots.js';
import { necklaces } from './jewellery.js';
import { slickBack, topBun, wavyHair } from './hair.js';
import { openJacket, blackKnit, closeFront, turtleneck, rabbitFur, plainKnit, standCollar, furCollar, leather, lengthen, buttons, cuffs, brushedWool, cottonTwill, shagFur, furTrim, crewNeck } from './jacket.js';
import { wideStraight, pinstripe } from './trousers.js';
import { squareJaw, faceLines, matureEyes, fullerMouth, swordBrows, manNose } from './jaw.js';
import { goatee } from './beard.js';
import { tights, dropTrousers, legWarmers, cableKnit, plainTex, wideTrousers, whiteHair, darkHair, tintHair, belt, embroidery } from './legs.js';
import { newsboy } from './cap.js';
import { neckerchief } from './kerchief.js';
import { shades } from './shades.js';
import { cowboy } from './cowboy.js';
import { necktie } from './tie.js';
import { chunkyScarf } from './scarf.js';

const hood = (u, v) => u > 0.23 && u < 0.77 && v < 0.43;              // (a down jacket's hood is not quilted)
export const NPCS = [
  { id: 'npc01', name: '青年男', note: '情侣·男', sex: 'm', puffer: { color: [238, 239, 242] } },   // (the user's own, as made in VRoid; a white down jacket over it)
  { id: 'npc02', name: '青年女', note: '情侣·女', sex: 'f', skirt: true, tint: { Shoes: [[92, 62, 46], { keep: 0.85 }] }, beanie: { color: 0xe8c4c4, pompom: 0xf6eaea } },
  { id: 'npc03', name: '青年男', note: '篝火边', sex: 'm', puffer: { color: [26, 26, 30], gloss: true }, beanie: { color: 0x34353d, slouch: true } },   // (the user's own; a shiny black down jacket and a slouchy black beanie)
  { id: 'npc04', name: '青年女', note: '篝火边', sex: 'f', denim: true, uggs: true, necklace: true },   // (the user's own; skinny jeans, sheepskin boots, a fine gold chain)
  { id: 'npc05', name: '中年男', note: '推雪橇的爸爸', sex: 'm', slick: true, glasses: { bold: true }, jacket: { rgb: [40, 48, 38] }, innerKnit: true, tailored: true, mature: true },   // (the user's: three-seven slicked back, grey and silver; black-frame glasses; an ink-green suede jacket worn open over a black knit; wide pinstripe trousers)
  { id: 'npc06', name: '中年女', note: '提购物袋', sex: 'f', skirt: true, snowGirl: true },   // (after the user's picture: a long white down coat, white tights, grey and white Fair Isle leg warmers, short white knit snow boots, white fur earmuffs)
  { id: 'npc07', name: '老爷爷', note: '拄拐杖', sex: 'm', old: true, dapper: true, glasses: { bold: true }, brows: [222, 220, 214] },   // (after the user's picture: a dark cap, black-frame glasses, an orange silk neckerchief, a tan casual jacket worn open over a denim shirt, wide barrel jeans)
  { id: 'npc08', name: '老奶奶', note: '去教堂', sex: 'f', old: true, chic: true, brows: [228, 226, 222] },   // (after the user's picture: white hair, black sunglasses, a grey rabbit-fur stand-collar coat over a cream high-necked top, grey flannel wide trousers, orange leather shoes, a jewelled pendant)
  { id: 'npc09', name: '老爷爷', note: '遛狗', sex: 'm', old: true, western: true, glasses: { bold: true }, brows: [226, 224, 220] },   // (after the user's picture: a wine-brown cowboy hat, black-frame glasses, a white shirt and a graphic print tie, a big black leather jacket worn open, very wide black trousers, black shoes)
  { id: 'npc10', name: '小男孩', note: '坐雪橇', sex: 'm', child: true, coatBoy: true },   // (after the user's picture: tousled black hair, a long charcoal wool coat with a hood and big buttons, its cuffs turned back, an oatmeal chunky scarf, a grey sweater, light vintage wide jeans, beige suede shoes)
  { id: 'npc11', name: '小女孩', note: '堆雪人', sex: 'f', child: true, skirt: true, puffGirl: true },   // (after the user's picture: dark hair up in a bun, a pale grey down jacket with a stand collar, a zip and a ruffled peplum, navy quilted balloon trousers piped in red at the cuffs with a little embroidered flower, grey-brown fleece shoes)
  { id: 'npc12', name: '少女', note: '店门口扫雪', sex: 'f', skirt: true, street: true, brows: [96, 76, 62] },   // (after the user's picture: long ash-brown hair in loose waves, parted in the middle; a navy cuffed beanie with 'Rest & Recreation' in white script; slim black sunglasses; a khaki cotton jacket worn open, its dark fur lining showing down the front and round the neck, big fur cuffs; a black fitted top; very wide dark-rinse jeans piled on the shoes; brown suede trainers with yellow laces)
];

// a character's brows to rgb, keeping their strokes
function brows(av, rgb) {
  for (const m of materials(av.vrm)('FaceBrow')) repaint(m, (r, g, b) => { const k = Math.min(1.25, 0.62 + (r + g + b) / 765 * 2.2); return [rgb[0] * k, rgb[1] * k, rgb[2] * k]; });
}

// each piece of each mesh (I: index, P: positions at rest, gr: its range, n: its material's name), outlines left out
function pieces(av, fn) {
  av.vrm.scene.traverse(o => {
    if (!o.isMesh) return; const ms = [].concat(o.material), g = o.geometry, I = g.index; if (!I) return;   /* (a cut stone and such: made whole, nothing to drop) */
    for (const gr of g.groups.length ? g.groups : [{ start: 0, count: I.count, materialIndex: 0 }]) {
      const n = (ms[gr.materialIndex ?? 0] || {}).name || ''; if (!/Outline/.test(n)) fn(I, g.attributes.position, gr, n);
    }
  });
}
// the triangles of the pieces matching re that gone(lowest y, highest y) says to drop, folded to nothing
function drop(av, re, gone) {
  pieces(av, (I, P, gr, n) => {
    if (!re.test(n)) return;
    for (let k = gr.start; k + 2 < gr.start + gr.count; k += 3) {
      const a = I.getX(k), b = I.getX(k + 1), c = I.getX(k + 2), ya = P.getY(a), yb = P.getY(b), yc = P.getY(c);
      if (gone(Math.min(ya, yb, yc), Math.max(ya, yb, yc))) { I.setX(k + 1, a); I.setX(k + 2, a); }
    }
    I.needsUpdate = true;
  });
}
const extent = (av, re) => { let lo = 1e9, hi = -1e9; pieces(av, (I, P, gr, n) => { if (re.test(n)) for (let k = gr.start; k < gr.start + gr.count; k++) { const y = P.getY(I.getX(k)); lo = Math.min(lo, y); hi = Math.max(hi, y); } }); return { lo, hi }; };
// legs in trousers: the skin under them taken away, so a bent knee doesn't come through the cloth (in the rest
// pose the arms are out level with the shoulders, well clear)
function cover(av) { const t = extent(av, /Bottoms/); drop(av, /Body.*SKIN/, (lo, hi) => lo > t.lo + 0.03 && hi < t.hi - 0.06); }
export { cover as coverLegs };                                       // (the people indoors need it too)
// trousers tucked into tall boots: what of them lies wholly inside the boot is taken away (VRoid leaves them
// straight down over the shaft, poking through)
function tuck(av) { const top = extent(av, /Shoes/).hi; drop(av, /Bottoms/, (lo, hi) => hi < top + 0.004); }

export function dressNpc(av, spec) {
  const find = materials(av.vrm);
  if (spec.mature) { squareJaw(av); manNose(av); fullerMouth(av); matureEyes(av); swordBrows(av); faceLines(av); goatee(av); }
  if (spec.snowGirl) {
    tights(av); dropTrousers(av);
    uggs(av, { height: 0.3, tuck: false, cuff: false, tex: plainTex([180, 162, 128]) });   // (khaki, plain)
    legWarmers(av, { from: 0.25, to: 0.66 });
    for (const m of find('CLOTH_01')) if (/Tops/.test(m.name)) tint(m, [236, 235, 230], { gamma: 0.2 });   // (the coat underneath white too, where it shows at the edges)
    puffer(av, [242, 241, 236], { match: /CLOTH_01/, band: 0.095, loft: [0.016, 0.044], plain: true });
    av.vrm.scene.traverse(o => { if (o.isMesh && o.name !== 'Puffer') for (const m of [].concat(o.material)) if (/Tops_01_CLOTH_01/.test(m.name)) m.visible = false; });   // (the coat it was made from, put away: its hem showed under the down)
    furMuffs(av);
  }
  if (spec.dapper) {
    drop(av, /001_02_Bottoms/, () => true);                                          // (the turned-up cuffs off: the jeans run to the shoes)
    wideStraight(av, { ease: 1.15, curve: 0.22 });
    for (const m of find('001_01_Bottoms')) denim(m, { deep: [88, 116, 154], pale: [172, 194, 216], detail: 0.15, bold: true });
    openJacket(av, { rgb: [158, 104, 58], loft: 0.016, fold: true });
    for (const m of find('Tops')) if (m.name !== 'Jacket') denim(m, { deep: [62, 88, 126], pale: [118, 146, 180], detail: 0.35, bold: true });
    for (const m of find('Shoes')) tint(m, [34, 32, 32], { gamma: 0.6 });
    newsboy(av); neckerchief(av); matureEyes(av); faceLines(av);
  }
  if (spec.chic) {
    const cream = [248, 244, 236], waist = av.vrm.humanoid.getRawBoneNode('hips').getWorldPosition(new THREE.Vector3()).y + 0.03;
    whiteHair(av);
    const fur = rabbitFur([152, 142, 136]);
    openJacket(av, { tex: fur, loft: 0.02, fluffy: 0.004, hem: 0.6, open: 0.07, snaps: false, mend: true });   // (the fur coat, made from the long top before it's cut)
    drop(av, /Tops/, (lo, hi) => hi < waist + 0.035);                                 // (the top beneath ends at the waist, tucked in under the belt)
    pieces(av, (I, P, gr, n) => { if (/Tops/.test(n)) for (let i = 0; i < P.count; i++) if (P.getY(i) < waist - 0.006) P.setY(i, waist - 0.006); });   // (and what still hangs below, taken up under the belt)
    for (const m of find('Tops')) plainKnit(m, cream);                               // (a plain cream knit: its shirt collar and buttons were only drawn on — under them it's a high neck)
    standCollar(av); furCollar(av, fur);                                              // (her top is high-necked already; the fur collar stands round it)
    wideTrousers(av, [128, 126, 124]); belt(av, undefined, { arc: 1.3 });
    for (const m of find('Shoes')) tint(m, [200, 100, 42], { gamma: 0.6 });
    necklaces(av, /SKIN|Tops/, { gold: true, strands: [[0.2, 0.07, 'gem']], gem: 0x1a8c5e });
    shades(av);                                                                       // (black cat-eye sunglasses)
  }
  if (spec.western) {
    whiteHair(av); matureEyes(av); faceLines(av);
    const jk = openJacket(av, { tex: leather(), loft: 0.028, open: 0.05, fold: true, snaps: false });   // (the leather jacket, made from his shirt and sweater vest)
    if (jk) glossy([].concat(jk.material)[0], 0.06, { soft: true });   /* (black leather gives back only a little: any more and it reads as vinyl) */                                     // (and a soft shine where the lamps catch it)
    for (const m of find('Tops')) plainKnit(m, [240, 240, 238], { rib: false });        // (under it all a plain white shirt, the vest with it)
    necktie(av);
    wideStraight(av, { ease: 1.7, curve: 0.12 }); for (const m of find('Bottoms')) pinstripe(m, { base: [28, 28, 32], line: [28, 28, 32] });   // (very wide, black, falling straight)
    for (const m of find('Shoes')) tint(m, [24, 24, 26], { gamma: 0.5 });
    cowboy(av);
  }
  if (spec.coatBoy) {
    const H = av.vrm.humanoid, Y = b => H.getRawBoneNode(b).getWorldPosition(new THREE.Vector3()).y, nky = Y('neck'), hy = Y('hips'), ky = Y('leftLowerLeg');
    darkHair(av);
    wideStraight(av, { ease: 1.35 }); for (const m of find('Bottoms')) denim(m, { deep: [112, 142, 168], pale: [196, 202, 186], detail: 0.2, bold: true });   // (light vintage jeans, wide)
    const jk = openJacket(av, { tex: brushedWool([84, 86, 92]), loft: 0.022, open: 0.012, snaps: false });   // (the coat, from his hoodie: hood and all)
    if (jk) { const sk = lengthen(av, jk, { to: ky - 0.03, flare: 0.025, open: 0.16 }); buttons(av, [jk, sk], [nky - 0.09, nky - 0.17, hy + 0.03, hy - 0.08]); cuffs(av, jk, brushedWool([226, 218, 204])); }
    for (const m of find('Tops')) blackKnit(m, [104, 106, 112]);                       // (the hoodie under it a grey knit)
    for (const m of find('Shoes')) tint(m, [196, 172, 138], { gamma: 0.5 });           // (beige suede)
    chunkyScarf(av);
  }
  if (spec.puffGirl) {
    const H = av.vrm.humanoid, Y = b => H.getRawBoneNode(b).getWorldPosition(new THREE.Vector3()).y, nky = Y('neck'), fy = Y('leftFoot'), lo = extent(av, /Tops/).lo;
    darkHair(av, [42, 33, 30]); topBun(av, [42, 33, 30]);
    drop(av, /Bottoms/, () => true);                                                  // (the skirt off: trousers instead)
    const tr = wideTrousers(av, [40, 48, 80], { width: 0.07, balloon: true, hem: fy + 0.058, quilt: 9, piping: [96, 10, 18] });
    if (tr) embroidery(av, tr, { side: 1 });
    drop(av, /Body.*SKIN/, (l, h2) => l > fy + 0.05 && h2 < Y('hips') + 0.02);               // (the legs inside them taken away: they came through at the sides)
    uggs(av, { height: 0.065 / (Y('leftLowerLeg') - fy), tuck: false, cuff: false, tex: teddy([150, 134, 122]), fluffy: 0.0045, laces: [176, 160, 146] });   // (short snow boots in teddy fleece, laced up the front, tied in a bow)
    dropHood(av, hood);                                                               // (no hood: a stand collar instead)
    const [jk] = puffer(av, [206, 207, 199], { plain: true, band: 0.06, loft: [0.012, 0.022] });
    av.vrm.scene.traverse(o => { if (o.isMesh && o.name !== 'Puffer') for (const m of [].concat(o.material)) if (/Tops/.test(m.name || '')) m.visible = false; });   // (the hoodie it was made from, put away)
    if (jk) { puffCollar(av, jk); ruffle(av, jk); zipper(av, jk, { from: nky + 0.035, to: lo - 0.03 }); }
  }
  if (spec.street) {
    const H = av.vrm.humanoid, Y = b => H.getRawBoneNode(b).getWorldPosition(new THREE.Vector3()).y, nky = Y('neck'), hy = Y('hips'), fy = Y('leftFoot');
    tintHair(av, [122, 100, 84]); wavyHair(av);                                       // (ash brown, in loose waves, no fringe)
    drop(av, /Bottoms|Accessory_Tie|Tops_01_CLOTH_02/, () => true);                     // (the skirt, the bow and the blazer's lapels off)
    drop(av, /N00_007_02_Tops/, (lo, hi) => lo > nky - 0.035 || hi < hy + 0.045);         // (the shirt: no collar — a plain round neck — and ending at the waist, tucked in)
    av.vrm.scene.traverse(o => { if (!o.isSkinnedMesh || ![].concat(o.material).some(m => /N00_007_02_Tops/.test(m.name || ''))) return; const P = o.geometry.attributes.position;   // (tucked in at the waist; its open front closed, its neckline level: a plain round neck)
      let zm = 0; for (let i = 0; i < P.count; i++) zm += P.getZ(i); zm /= P.count; const cx = H.getRawBoneNode('hips').getWorldPosition(new THREE.Vector3()).x;
      for (let i = 0; i < P.count; i++) { if (P.getY(i) < hy + 0.04) P.setY(i, hy + 0.04); if (P.getY(i) > nky - 0.04) P.setY(i, nky - 0.04); const dx = P.getX(i) - cx; if (P.getZ(i) > zm && Math.abs(dx) < 0.05) P.setX(i, cx + dx * Math.pow(Math.abs(dx) / 0.05, 1.5)); }
      P.needsUpdate = true; o.geometry.computeVertexNormals(); });
    for (const m of find('N00_007_02_Tops')) blackKnit(m, [20, 20, 23]);
    { let top = null; av.vrm.scene.traverse(o => { if (!top && o.isSkinnedMesh && [].concat(o.material).some(m => /N00_007_02_Tops/.test(m.name || ''))) top = o; }); if (top) crewNeck(av, top, [20, 20, 23], { y0: nky - 0.04, y1: nky + 0.004 }); }   // (a round neck, close at the base of the neck)
    let jk = null; av.vrm.scene.traverse(o => { if (!jk && o.isSkinnedMesh && [].concat(o.material).some(m => /Tops_01_CLOTH_01/.test(m.name || ''))) jk = o; });
    if (jk) {                                                                          // (the blazer made a roomy cotton work jacket: let out a little all over, khaki)
      const P = jk.geometry.attributes.position, Nn = jk.geometry.attributes.normal, cx = H.getRawBoneNode('hips').getWorldPosition(new THREE.Vector3()).x;
      for (let i = 0; i < P.count; i++) { const x0 = P.getX(i), seam = Math.abs(x0 - cx) < 0.004 && P.getZ(i) < 0; P.setXYZ(i, seam ? x0 : x0 + Nn.getX(i) * 0.009, P.getY(i) + Nn.getY(i) * 0.009, P.getZ(i) + Nn.getZ(i) * 0.009); } P.needsUpdate = true;   // (the two halves kept meeting down the back seam)
      for (const m of [].concat(jk.material)) if (!/Outline/.test(m.name || '')) cottonTwill(m, [148, 144, 124]);
      furTrim(av, jk, shagFur([40, 32, 29]));
    }
    wideTrousers(av, [30, 46, 88], { width: 0.105, hem: fy + 0.004, stack: 0.035, tex: denimTex() });   // (very wide, dark rinse, piled on the shoes)
    drop(av, /Body.*SKIN/, (l, h2) => l > fy + 0.03 && h2 < hy + 0.02);
    uggs(av, { height: 0.04 / (Y('leftLowerLeg') - fy), tuck: false, cuff: false, tex: suede([92, 64, 48]), laces: [222, 214, 62], lacing: { from: 0.032, to: 0.07, bow: 1.5, r: 0.0032 } });   // (brown suede trainers, yellow laces)
    beanie(av, 0x252c52, { text: { str: 'Rest & Recreation' }, dome: 0.012 });
    shades(av, { shape: 'rect', width: 0.054, height: 0.022 });
  }
  if (spec.slick) slickBack(av, spec.slick === true ? {} : spec.slick);
  if (spec.jacket) openJacket(av, spec.jacket);
  if (spec.innerKnit) { closeFront(av); for (const m of find('Tops')) blackKnit(m); turtleneck(av); }
  if (spec.tailored) { wideStraight(av); for (const m of find('Bottoms')) pinstripe(m); }
  if (spec.uggs) uggs(av, spec.uggs === true ? {} : spec.uggs);                    // (first: they're made from the legs as they are)
  if (spec.denim) for (const m of find('Bottoms')) denim(m);
  if (spec.necklace) necklaces(av, /SKIN|Tops|Onepiece/, { gold: true, strands: [[0.17, 0.062, 'disc']] });
  if (!spec.skirt) cover(av);
  if (spec.tuck) tuck(av);
  for (const [part, [rgb, opt]] of Object.entries(spec.tint || {})) for (const m of find(part)) tint(m, rgb, opt || {});
  if (spec.puffer) puffer(av, spec.puffer.color, spec.puffer);
  if (spec.brows) brows(av, spec.brows);
  if (spec.beanie) beanie(av, spec.beanie.color, spec.beanie);
  if (spec.scarf) scarf(av, spec.scarf.color, spec.scarf);
  if (spec.earmuffs) earmuffs(av, spec.earmuffs.color);
  if (spec.glasses) glasses(av, undefined, spec.glasses === true ? {} : spec.glasses);
}
