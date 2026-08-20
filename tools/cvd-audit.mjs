/* Colour-vision audit for the Ink Circuit palette.
 *
 *   node tools/cvd-audit.mjs
 *
 * Simulates protanopia, deuteranopia and tritanopia on every colour the game
 * uses and reports WCAG contrast ratios. Run it whenever the palette changes.
 *
 * The finding that matters: red and ink cannot be separated from each other
 * under protanopia while both keep good contrast against paper — going lighter
 * to escape the ink costs contrast against the page. So the design must never
 * rely on telling red from ink. It doesn't: every use of the accent is
 * redundant with a label, a sign, or a shape. The list at the bottom is that
 * audit, and it should be updated alongside any new use of colour.
 */

const PALETTE = {
  paper: '#F3EEE3',
  ink:   '#22242A',
  red:   '#9E3B32',
  ghost: '#5A7183'
};

const hex2rgb = h => {
  h = h.replace('#', '');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
};
const rgb2hex = c =>
  '#' + c.map(v => Math.round(Math.min(1, Math.max(0, v)) * 255)
    .toString(16).padStart(2, '0').toUpperCase()).join('');

const srgb2lin = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
const lin2srgb = c => c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(Math.max(0, c), 1 / 2.4) - 0.055;

const mul = (m, v) => m.map(row => row.reduce((s, x, i) => s + x * v[i], 0));

// Hunt-Pointer-Estevez, D65
const RGB2LMS = [
  [0.31399022, 0.63951294, 0.04649755],
  [0.15537241, 0.75789446, 0.08670142],
  [0.01775239, 0.10944209, 0.87256922]
];
const LMS2RGB = [
  [ 5.47221206, -4.6419601,   0.16963708],
  [-1.1252419,   2.29317094, -0.1678952 ],
  [ 0.02980165, -0.19318073,  1.16364789]
];
const DEFICIENCIES = {
  protanopia:   [[0, 1.05118294, -0.05116099], [0, 1, 0], [0, 0, 1]],
  deuteranopia: [[1, 0, 0], [0.9513092, 0, 0.04866992], [0, 0, 1]],
  tritanopia:   [[1, 0, 0], [0, 1, 0], [-0.86744736, 1.86727089, 0]]
};

function simulate(hex, kind){
  const lin = hex2rgb(hex).map(srgb2lin);
  const out = mul(LMS2RGB, mul(DEFICIENCIES[kind], mul(RGB2LMS, lin)));
  return rgb2hex(out.map(lin2srgb));
}

const luminance = hex => {
  const [r, g, b] = hex2rgb(hex).map(srgb2lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

const KINDS = ['protanopia', 'deuteranopia', 'tritanopia'];
const pad = (s, n) => String(s).padStart(n);

console.log('\nPalette as seen\n');
console.log('              ' + pad('normal', 9) + KINDS.map(k => pad(k.slice(0, 6), 9)).join(''));
for (const [name, hex] of Object.entries(PALETTE)){
  console.log('  ' + name.padEnd(10) + pad(hex, 9) + KINDS.map(k => pad(simulate(hex, k), 9)).join(''));
}

/* Ink and red carry text, so they need 4.5. The ghost only ever draws a car
   and its trail, which are graphics — those need 3.0. Holding the ghost to the
   text threshold would report a failure that isn't one. */
const FLOOR = { ink: 4.5, red: 4.5, ghost: 3.0 };

console.log('\nContrast against paper   (4.5 for text, 3.0 for graphics)\n');
console.log('              ' + pad('normal', 9) + KINDS.map(k => pad(k.slice(0, 6), 9)).join('') + '   floor');
let paperFailures = [];
for (const name of ['ink', 'red', 'ghost']){
  const vals = [contrast(PALETTE[name], PALETTE.paper),
    ...KINDS.map(k => contrast(simulate(PALETTE[name], k), simulate(PALETTE.paper, k)))];
  const worst = Math.min(...vals);
  if (worst < FLOOR[name]) paperFailures.push(name + ' (' + worst.toFixed(2) + ' < ' + FLOOR[name] + ')');
  console.log('  ' + name.padEnd(10) + vals.map(v => pad(v.toFixed(2), 9)).join('') +
              pad(FLOOR[name].toFixed(1), 8) + (worst >= FLOOR[name] ? '  ok' : '  FAIL'));
}

console.log('\nSeparation between marks\n');
const pairs = [['red', 'ink'], ['ghost', 'ink'], ['ghost', 'red']];
const sep = {};
for (const [a, b] of pairs){
  const vals = [contrast(PALETTE[a], PALETTE[b]),
    ...KINDS.map(k => contrast(simulate(PALETTE[a], k), simulate(PALETTE[b], k)))];
  sep[a + '/' + b] = Math.min(...vals);
  console.log('  ' + (a + '/' + b).padEnd(10) + vals.map(v => pad(v.toFixed(2), 9)).join(''));
}
const inkVals = [sep['red/ink']];

/* Text is drawn as ink at reduced alpha rather than as separate colours, so
   the alphas need checking too — a value that reads fine as a hairline is
   nowhere near readable as a label. */
console.log('\nInk at reduced alpha, against paper\n');
const ALPHAS = [
  ['--ink-faint', 0.22, 'hairlines and borders', 0],
  ['--ink-soft',  0.55, 'secondary text, larger sizes', 3.0],
  ['--ink-label', 0.70, 'small labels and set splits', 4.5],
  ['--ink',       1.00, 'primary text', 4.5]
];
const blend = (fg, bg, a) => rgb2hex(hex2rgb(fg).map((v, i) => v*a + hex2rgb(bg)[i]*(1-a)));
let textFailures = [];
for (const [name, a, use, floor] of ALPHAS){
  const ratio = contrast(blend(PALETTE.ink, PALETTE.paper, a), PALETTE.paper);
  const ok = ratio >= floor;
  if (!ok) textFailures.push(name + ' (' + ratio.toFixed(2) + ' < ' + floor + ')');
  console.log('  ' + name.padEnd(12) + pad(ratio.toFixed(2), 7) +
              pad(floor ? floor.toFixed(1) : 'n/a', 7) + '  ' +
              (floor ? (ok ? 'ok  ' : 'FAIL') : '    ') + '  ' + use);
}

console.log('\n' + '-'.repeat(66));
console.log('text alphas:                  ' +
            (textFailures.length ? 'FAIL — ' + textFailures.join(', ')
                                 : 'every text colour clears its floor'));
console.log('contrast against paper:       ' +
            (paperFailures.length ? 'FAIL — ' + paperFailures.join(', ')
                                  : 'all colours clear their floor'));
console.log('red vs ink separation:        ' + sep['red/ink'].toFixed(2) +
            '  too low to carry meaning on its own');
console.log('ghost vs ink separation:      ' + sep['ghost/ink'].toFixed(2) +
            (sep['ghost/ink'] >= 2.0 ? '  enough to tell two overlapping cars apart' : '  TOO LOW'));

console.log(`
Every use of the accent, and what carries the meaning if colour is lost:

  contact count      the word CONTACT beside it
  wall-hit marks     the shape of the mark itself
  wrong-way banner   the words "Wrong way"
  contact banner     the word "Contact"
  impact burst       a burst shape, plus the contact banner
  start line         hatched across the track; sector gates are posts
  scuff on the wall  short strokes across a long continuous trail
  gap readout        a leading + or - sign
  ghost car          drawn dashed and hollow in its own hue; yours is solid ink

None of these depend on distinguishing red from ink, which is the pairing
that fails. Add a row here whenever colour is used for something new.
`);

process.exit(paperFailures.length || textFailures.length ? 1 : 0);
