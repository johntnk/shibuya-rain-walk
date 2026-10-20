// The people at home, in the shops and in church: the same twelve VRoid characters as in the street, but as VRoid
// made them — in their own indoor clothes (chunky sweaters, a turtleneck, a sweater vest over a shirt, a long
// dress, hoodies, a school blazer) without the coats, hats and scarves the street puts on them. So they don't look
// like the passers-by come in, each house dresses them in its own colours (what's light enough to take a colour:
// the white sweaters, the hoodies, the beige coat that's a long cardigan indoors) and gives some the hair of the
// north — fair, light brown, auburn — instead of their own.
// Who is who: a household of an old person, an old couple, a young couple, a family with children; a fisherman in
// his rorbu; a shopkeeper behind the counter and a customer or two; the church's congregation.

// each character: whether it wears a skirt or dress (else the skin under its trousers is taken away, as for the
// street: it pokes through at the knees), age (adult / old / child), sex, which of its clothes can take a house's colour (material-name
// pattern), and whether its hair may be coloured (dark, purple or grey hair doesn't lighten by tinting: it's
// repainted, once per colour)
export const BASES = {
  npc01: { age: 'adult', sex: 'm', light: /007_01_Tops/, hair: true },
  npc02: { skirt: true, age: 'adult', sex: 'f', light: /007_03_Tops/, hair: true },
  npc03: { age: 'adult', sex: 'm', light: null, hair: 'always' },        // (purple hair: always given a northern colour)
  npc04: { age: 'adult', sex: 'f', light: /007_03_Tops/, hair: true },
  npc05: { age: 'adult', sex: 'm', light: null, hair: false },
  npc06: { age: 'adult', sex: 'f', light: /Tops_01_CLOTH_01/, hair: true },
  npc07: { age: 'old', sex: 'm', light: null, hair: false },
  npc08: { skirt: true, age: 'old', sex: 'f', light: null, hair: false },
  npc09: { age: 'old', sex: 'm', light: null, hair: false },              // (the sweater vest and the shirt under it are one cloth: left as they are)
  npc10: { age: 'child', sex: 'm', light: /Tops/, hair: true },
  npc11: { skirt: true, age: 'child', sex: 'f', light: /Tops/, hair: true },
  npc12: { skirt: true, age: 'adult', sex: 'f', light: /007_01_Tops_01_CLOTH_01|007_02_Tops/, hair: true },
};
// a house's colours for the light clothes (multiplied into them: knitwear colours, nothing loud), and hair
export const KNITS = [[1, 1, 1], [0.96, 0.92, 0.84], [0.62, 0.2, 0.18], [0.26, 0.34, 0.52], [0.36, 0.48, 0.38], [0.78, 0.66, 0.42], [0.62, 0.7, 0.82], [0.72, 0.56, 0.6], [0.55, 0.55, 0.58]];
export const HAIRS = { fair: [222, 192, 138], light: [168, 126, 84], auburn: [146, 78, 48], brown: [92, 66, 48] };

const pick = (R, a) => a[Math.floor(R() * a.length) % a.length];
const ADULT_M = ['npc01', 'npc03', 'npc05'], ADULT_F = ['npc02', 'npc04', 'npc06', 'npc12'], OLD_M = ['npc07', 'npc09'], OLD_F = ['npc08'], KIDS = ['npc10', 'npc11'];

// the people of a house, in the order its places were chosen: { id, knit, hair } for each place (null: no one)
// h: the house (kind, household); spots: the chosen places (child: a child's place); R: the house's own dice
export function cast(h, spots, R) {
  const shop = h.kind === 'shop' || h.kind === 'shopwh' || h.kind === 'post' || h.kind === 'store' || h.shop === 'cafe';
  const HH = h.household, out = [], used = new Set();
  // who lives here (the grown-ups, in order), and the children
  let grown;
  if (h.kind === 'church' || shop) grown = null;
  else if (HH === 'elder') grown = [pick(R, [...OLD_M, ...OLD_F])];
  else if (HH === 'fisher') grown = [pick(R, ['npc05', 'npc07', 'npc09', 'npc03'])];
  else if (HH === 'couple') grown = R() < 0.35 ? [pick(R, OLD_M), 'npc08'] : (([m, f]) => R() < 0.5 ? [m, f] : [f, m])([pick(R, ADULT_M), pick(R, ADULT_F)]);
  else grown = [pick(R, ADULT_M), pick(R, ADULT_F.filter(f => f !== 'npc12')), R() < 0.4 ? 'npc12' : pick(R, [...OLD_M, ...OLD_F])];
  const kids = R() < 0.5 ? ['npc10', 'npc11'] : ['npc11', 'npc10'];
  const houseKnit = Math.floor(R() * KNITS.length), houseHair = pick(R, Object.keys(HAIRS));
  for (const sp of spots) {
    if (!sp || sp.kind === 'cat') { out.push(null); continue; }
    let id;
    if (sp.child ?? sp.kind === 'kneel') id = kids.find(k => !used.has(k)) || pick(R, KIDS);
    else if (grown) id = grown.find(g => !used.has(g)) || pick(R, grown);
    else if (sp.apron || sp.act === 'counter') id = pick(R, [...ADULT_M, ...ADULT_F]);        // (the shopkeeper)
    else { const pool = [...ADULT_M, ...ADULT_F, ...OLD_M, ...OLD_F, ...(h.kind === 'church' ? KIDS : [])].filter(x => !used.has(x)); id = pool.length ? pick(R, pool) : pick(R, [...ADULT_M, ...ADULT_F]); }
    used.add(id);
    const B = BASES[id], knit = (houseKnit + out.length * 3 + Math.floor(R() * 2)) % KNITS.length;
    const hair = B.hair === 'always' ? (houseHair === 'brown' ? 'light' : houseHair) : B.hair && R() < 0.6 ? houseHair : null;   // (a family's hair alike, mostly)
    out.push({ id, knit, hair });
  }
  return out;
}
