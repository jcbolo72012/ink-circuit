/* Run with: npm test
 *
 * These are the guarantees the rest of the project is built on. If any of
 * them break, ghosts desync, stored times become incomparable and server
 * verification starts rejecting honest laps.
 */
import {
  buildTrack, createSim, replay, verifyLap, trackFromPoints, minCornerRadius,
  packInputs, unpackInputs, dayNumber,
  SIM_VERSION, SIM_VERSION_LEGACY, SIM_ANALOG, ACTIVE_VERSION,
  FIXED, SECTORS, CHECKPOINTS, MAX_LAP_TICKS,
  IN_UP, IN_DOWN, IN_LEFT, IN_RIGHT,
  analogInput, decodeAnalog
} from '../sim.js';

let pass = 0, fail = 0;
function check(name, ok, detail = ''){
  if (ok){ pass++; console.log('  ok    ' + name + (detail ? '  ' + detail : '')); }
  else   { fail++; console.log('  FAIL  ' + name + (detail ? '  ' + detail : '')); }
}

/* Emit an input for whichever encoding is active, from four boolean intents.
   Full-throw analog exactly reproduces v5 discrete — verified below. */
function buildInput({ throttle=false, brake=false, left=false, right=false }){
  if (SIM_ANALOG){
    return analogInput(throttle ? 1 : 0, brake ? 1 : 0,
                       (right ? 1 : 0) - (left ? 1 : 0));
  }
  return (throttle ? IN_UP : 0) | (brake ? IN_DOWN : 0)
       | (left ? IN_LEFT : 0) | (right ? IN_RIGHT : 0);
}

/* A deterministic driver, standing in for a human. */
function drive(day, { look = 26, maxTicks = 60*60 } = {}){
  const track = buildTrack(day);
  const { path: PATH, n: N } = track;
  const sim = createSim(track);
  sim.start();
  const inputs = [];
  for (let t = 0; t < maxTicks && sim.state === 'running'; t++){
    const c = sim.car;
    const i = sim.nearest(c.x, c.y).i;
    const target = PATH[(i + look) % N];
    let want = Math.atan2(target[1]-c.y, target[0]-c.x) - c.h;
    while (want >  Math.PI) want -= Math.PI*2;
    while (want < -Math.PI) want += Math.PI*2;
    const m = buildInput({
      left:     want < -0.05,
      right:    want >  0.05,
      throttle: Math.abs(want) < 0.5 || c.spd < 120,
      brake:    Math.abs(want) > 0.9 && c.spd > 210
    });
    inputs.push(m);
    sim.step(m);
  }
  return { sim, inputs, track };
}

console.log('\nsim v' + ACTIVE_VERSION + (SIM_ANALOG ? ' (analog)' : ' (legacy discrete)') +
            ', tick ' + (FIXED*1000).toFixed(2) + 'ms\n');

if (SIM_ANALOG){
  console.log('analog encoding');
  {
    // full-throw values must round-trip exactly at the 8-level resolution
    const full = analogInput(1, 1, 1);
    const zero = analogInput(0, 0, 0);
    const left = analogInput(0.5, 0, -1);
    check('full-throw decodes to 1/1/1',
      JSON.stringify(decodeAnalog(full)) === JSON.stringify({throttle:1, brake:1, steer:1}));
    check('zero decodes to zeros',
      JSON.stringify(decodeAnalog(zero)) === JSON.stringify({throttle:0, brake:0, steer:0}));
    check('half-throttle full-left round-trips',
      Math.abs(decodeAnalog(left).steer + 1) < 1e-9 &&
      Math.abs(decodeAnalog(left).throttle - 4/7) < 1e-9);
  }

  console.log('\nv5/v6 equivalence');
  {
    /* The single most important property of v6: at full throw, its decoded
       {throttle, brake, steer} triple matches what v5 would produce for the
       equivalent held-key combination. If this ever changes, keyboard
       players' laps silently drift when we upgrade. */
    const combos = [
      { name: 'accel',       cmd: { throttle:1, brake:0, steer:0  }, nib: IN_UP },
      { name: 'brake',       cmd: { throttle:0, brake:1, steer:0  }, nib: IN_DOWN },
      { name: 'full left',   cmd: { throttle:1, brake:0, steer:-1 }, nib: IN_UP|IN_LEFT },
      { name: 'full right',  cmd: { throttle:1, brake:0, steer:1  }, nib: IN_UP|IN_RIGHT },
      { name: 'nothing',     cmd: { throttle:0, brake:0, steer:0  }, nib: 0 }
    ];
    // manually decode v5 the same way sim.js does
    const decodeV5 = n => ({
      throttle: (n & IN_UP)    ? 1 : 0,
      brake:    (n & IN_DOWN)  ? 1 : 0,
      steer:    ((n & IN_RIGHT) ? 1 : 0) - ((n & IN_LEFT) ? 1 : 0)
    });
    let allMatch = true;
    for (const { name, cmd, nib } of combos){
      const a = decodeAnalog(analogInput(cmd.throttle, cmd.brake, cmd.steer));
      const b = decodeV5(nib);
      const match = a.throttle === b.throttle && a.brake === b.brake && a.steer === b.steer;
      if (!match) allMatch = false;
    }
    check('full-throw analog decodes to same values as v5', allMatch);
  }

  console.log('');
}

/* ---------------------------------------------------------------- */
console.log('track generation');
{
  const a = buildTrack(221), b = buildTrack(221);
  check('same day gives the same track', a.path.every((p,i) =>
    p[0] === b.path[i][0] && p[1] === b.path[i][1]));

  const c = buildTrack(222);
  check('a different day gives a different track',
    a.path.some((p,i) => p[0] !== c.path[i][0] || p[1] !== c.path[i][1]));

  let allOk = true, lens = [];
  for (let d = 0; d < 60; d++){
    const t = buildTrack(3000 + d);
    lens.push(t.length);
    if (t.n !== 360 || !(t.length > 1500)) allOk = false;
  }
  check('60 consecutive days all build', allOk,
    '(length ' + Math.min(...lens).toFixed(0) + '–' + Math.max(...lens).toFixed(0) + ')');
}

/* ---------------------------------------------------------------- */
console.log('\nreplay');
let lap;
{
  lap = drive(221);
  check('the driver completes a lap', lap.sim.state === 'done',
    '(' + (lap.sim.elapsedMs()/1000).toFixed(3) + 's, ' + lap.sim.hits + ' contacts)');

  const r = replay(221, lap.inputs);
  check('replay reproduces the tick count', r.ticks === lap.sim.ticks,
    '(' + r.ticks + ' vs ' + lap.sim.ticks + ')');
  check('replay reproduces the contact count', r.hits === lap.sim.hits);
  check('replay reproduces the sector map',
    JSON.stringify(r.sectorHits) === JSON.stringify(lap.sim.sectorHits));

  // the property that matters: replaying twice never diverges
  const r2 = replay(221, lap.inputs);
  check('replay is stable across runs', r.ticks === r2.ticks && r.hits === r2.hits);

  // and the trajectory itself, not just the summary
  const trace = [];
  replay(221, lap.inputs, (i, s) => { if (i % 40 === 0) trace.push([s.car.x, s.car.y, s.car.h]); });
  const trace2 = [];
  replay(221, lap.inputs, (i, s) => { if (i % 40 === 0) trace2.push([s.car.x, s.car.y, s.car.h]); });
  check('trajectories match exactly, not just the result',
    trace.every((p,i) => p[0] === trace2[i][0] && p[1] === trace2[i][1] && p[2] === trace2[i][2]),
    '(' + trace.length + ' sampled points)');
}

/* ---------------------------------------------------------------- */
console.log('\ninput encoding');
{
  const packed = packInputs(lap.inputs);
  const { version, inputs } = unpackInputs(packed);
  check('round-trips exactly', version === ACTIVE_VERSION &&
    inputs.length === lap.inputs.length &&
    lap.inputs.every((v,i) => v === inputs[i]));
  check('is small enough for a URL', packed.length < 4000,
    '(' + lap.inputs.length + ' ticks -> ' + packed.length + ' chars, v' + version + ')');
  check('is URL-safe', !/[+/=]/.test(packed));

  const three = [
    buildInput({ throttle: true }),
    buildInput({ left: true }),
    buildInput({ throttle: true, right: true })
  ];
  check('handles an odd tick count', unpackInputs(packInputs(three)).inputs.length === 3);
}

/* ---------------------------------------------------------------- */
console.log('\nchecksum');
{
  const packed = packInputs(lap.inputs);
  check('a clean link verifies', verifyLap({ day: 221, packed }).ok);

  const truncated = packed.slice(0, packed.length - 20);
  const t = verifyLap({ day: 221, packed: truncated });
  check('a truncated link is reported as damaged', !t.ok && t.corrupt === true,
    '(' + (t.reason || '').slice(0, 40) + ')');

  let caught = 0;
  const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  for (let k = 0; k < 500; k++){
    const i = Math.floor(Math.random() * packed.length);
    let c = alpha[Math.floor(Math.random() * alpha.length)];
    if (c === packed[i]) c = alpha[(alpha.indexOf(c) + 1) % alpha.length];
    const bad = packed.slice(0, i) + c + packed.slice(i + 1);
    if (!verifyLap({ day: 221, packed: bad }).ok) caught++;
  }
  check('single-character corruption is always rejected', caught === 500,
    '(' + caught + '/500)');
}

console.log('\nserver-side verification');
{
  const packed = packInputs(lap.inputs);
  const good = verifyLap({
    day: 221, packed,
    claimedTicks: lap.sim.ticks,
    claimedHits: lap.sim.hits
  });
  check('accepts an honest lap', good.ok, '(' + (good.ms/1000).toFixed(3) + 's)');

  const liedTime = verifyLap({ day: 221, packed, claimedTicks: 1 });
  check('rejects a faked time', !liedTime.ok, '(' + liedTime.reason + ')');

  // needs a lap that actually hits something, or the check proves nothing
  const messy = drive(221, { look: 8 });
  const messyPacked = packInputs(messy.inputs);
  check('the reckless driver does hit walls', messy.sim.hits > 0,
    '(' + messy.sim.hits + ' contacts)');
  const liedHits = verifyLap({
    day: 221, packed: messyPacked,
    claimedTicks: messy.sim.ticks, claimedHits: 0
  });
  check('rejects a faked contact count', !liedHits.ok, '(' + liedHits.reason + ')');
  const honestMessy = verifyLap({
    day: 221, packed: messyPacked,
    claimedTicks: messy.sim.ticks, claimedHits: messy.sim.hits
  });
  check('still accepts the honest messy lap', honestMessy.ok);

  const wrongDay = verifyLap({ day: 222, packed, claimedTicks: lap.sim.ticks });
  check('rejects a lap replayed against the wrong day', !wrongDay.ok,
    '(' + wrongDay.reason + ')');

  const truncated = verifyLap({ day: 221, packed: packInputs(lap.inputs.slice(0, 50)) });
  check('rejects a lap that never finished', !truncated.ok, '(' + truncated.reason + ')');

  check('rejects junk', !verifyLap({ day: 221, packed: 'not-a-stream' }).ok);
}

/* ---------------------------------------------------------------- */
console.log('\nfair play');
{
  // a shortcut across the middle must not count as a lap
  const track = buildTrack(221);
  const sim = createSim(track);
  sim.start();
  for (let t = 0; t < 200; t++) sim.step(buildInput({ brake: true }));
  check('reversing over the line does not finish the lap', sim.state !== 'done');
  check('checkpoints stay unclaimed', sim.nextCp < CHECKPOINTS.length,
    '(' + sim.nextCp + '/' + CHECKPOINTS.length + ')');

  // a run must always terminate, however badly it goes
  const idle = createSim(buildTrack(221));
  idle.start();
  while (idle.state === 'running') idle.step(0);
  check('doing nothing ends as a DNF', idle.state === 'dnf',
    '(' + (idle.ticks/60).toFixed(0) + 's cap)');

  const quit = createSim(buildTrack(221));
  quit.start();
  for (let t = 0; t < 60; t++) quit.step(buildInput({ throttle: true }));
  check('retiring works once, and only once',
    quit.retire() === true && quit.retire() === false, '(state ' + quit.state + ')');
}

/* ---------------------------------------------------------------- */
console.log('\nsectors');
{
  check('there are three of them, as on a real circuit', SECTORS === 3);
  check('splits sit at a third and two thirds', CHECKPOINTS.length === 2 &&
    Math.abs(CHECKPOINTS[0] - 1/3) < 1e-9 && Math.abs(CHECKPOINTS[1] - 2/3) < 1e-9);

  const r = replay(221, lap.inputs);
  const st = r.sectorTicks;
  check('every sector gets a time', st.length === 3 && st.every(t => t != null),
    '(' + st.map(t => (t*FIXED).toFixed(2)).join(' / ') + ')');
  check('sectors sum to the lap time', st.reduce((a,b) => a+b, 0) === r.ticks,
    '(' + r.ticks + ' ticks)');
  check('contacts map onto three sectors', r.sectorHits.length === 3);
}

console.log('\nwrong way');
{
  const track = buildTrack(221);
  const { path: PATH, n: N } = track;
  const s = createSim(track);
  s.start();
  let flagged = null;
  for (let t = 0; t < 60*20 && s.state === 'running'; t++){
    const c = s.car, i = s.nearest(c.x, c.y).i, tgt = PATH[(i-26+N)%N];
    let w = Math.atan2(tgt[1]-c.y, tgt[0]-c.x) - c.h;
    while (w >  Math.PI) w -= Math.PI*2;
    while (w < -Math.PI) w += Math.PI*2;
    const m = buildInput({
      left:     w < -0.05,
      right:    w >  0.05,
      throttle: Math.abs(w) < 0.6 || c.spd < 100
    });
    s.step(m);
    if (s.wrongWay && flagged === null) flagged = s.ticks;
  }
  check('driving backwards raises the flag', flagged !== null,
    flagged ? '(after ' + (flagged/60).toFixed(1) + 's)' : '');

  let falseAlarm = false;
  replay(221, lap.inputs, (i, sm) => { if (sm.wrongWay) falseAlarm = true; });
  check('a clean lap never raises it', !falseAlarm);
}

console.log('\nimported circuits');
{
  // a rounded rectangle — gentle enough that nothing should be flagged
  const easy = [];
  for (let a = 0; a < 360; a += 15){
    const r = a * Math.PI / 180;
    easy.push([Math.cos(r) * 500, Math.sin(r) * 280]);
  }
  const t = trackFromPoints(easy, { name: 'Oval', halfWidth: 44 });

  check('imports to the same shape as a generated track',
    t.n === 360 && !!t.normals && !!t.tangents && t.checkpoints.length === 2);
  check('carries its own width', t.halfWidth === 44);
  check('is marked as not generated', t.source === 'circuit' && t.name === 'Oval');
  check('is normalised into the design space',
    Math.min(...t.path.map(p => p[0])) >= 0 && Math.max(...t.path.map(p => p[0])) <= 1000 &&
    Math.min(...t.path.map(p => p[1])) >= 0 && Math.max(...t.path.map(p => p[1])) <= 580);
  check('a gentle circuit reports no problems', t.report.ok,
    '(tightest ' + t.report.tightestRadius + ')');

  // the same shape, driven
  const sim = createSim(t);
  sim.start();
  const { path: PATH, n: N } = t;
  for (let k = 0; k < 60*60 && sim.state === 'running'; k++){
    const c = sim.car, i = sim.nearest(c.x, c.y).i, tg = PATH[(i+26)%N];
    let w = Math.atan2(tg[1]-c.y, tg[0]-c.x) - c.h;
    while (w >  Math.PI) w -= Math.PI*2;
    while (w < -Math.PI) w += Math.PI*2;
    sim.step(buildInput({
      left: w < -0.05, right: w > 0.05,
      throttle: Math.abs(w) < 0.5 || c.spd < 120
    }));
  }
  check('an imported circuit is driveable', sim.state === 'done',
    '(' + (sim.ticks/60).toFixed(2) + 's, ' + sim.hits + ' contacts)');
  check('sectors work on it', sim.sectorTicks.reduce((a,b) => a+b, 0) === sim.ticks);

  // a deliberate hairpin should be caught
  const spiky = [[0,0],[400,0],[420,60],[380,70],[360,20],[300,200],[0,200]];
  const bad = trackFromPoints(spiky, { halfWidth: 50 });
  check('a hairpin is flagged rather than silently shipped',
    !bad.report.ok && bad.report.edgeFolds.length > 0,
    '(' + bad.report.edgeFolds.length + ' folding, ' +
    bad.report.tooTightToDrive.length + ' undriveable)');

  // generated tracks are untouched by any of this
  const gen = buildTrack(221);
  check('generated tracks still report as generated',
    gen.source === 'generated' && gen.halfWidth === 55);
}

console.log('\nday numbering');
{
  const d1 = dayNumber(new Date(2026, 0, 1, 23, 59));
  const d2 = dayNumber(new Date(2026, 0, 2, 0, 1));
  check('rolls over at local midnight', d2 === d1 + 1, '(' + d1 + ' -> ' + d2 + ')');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
