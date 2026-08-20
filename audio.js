/* Ink Circuit — engine audio
 * ---------------------------------------------------------------------------
 * A recorded V10 loop, played faster or slower to follow the revs, with a
 * synthesised sub-octave underneath for weight.
 *
 * Why both: a sample carries character no oscillator stack gets close to, but
 * pitching one up thins its bottom end and pitching it down muddies the top.
 * The synth sub tracks the same frequency and fills the low end at every rate,
 * so the engine keeps its body across the whole range.
 *
 * If the sample can't be decoded — an old browser, a stripped build — the
 * synth runs alone rather than the game falling silent.
 *
 * The gearbox is a fiction. The car has continuous speed and no gears, so the
 * speed range is divided into bands and the playback rate climbs through each
 * and drops at the change. That drop is the upshift you hear, and it is what
 * makes acceleration sound like acceleration rather than a slide whistle.
 *
 * Nothing here can affect the simulation. It only ever reads state.
 */
import { SAMPLE } from './audio-sample.js';

export const TUNING = {
  /* --- gearbox ------------------------------------------------------- */
  gears:        6,
  shiftDrop:    0.58,   // rate sags to this fraction while changing
  shiftTime:    0.10,   // seconds of interrupted drive
  gearOverlap:  0.10,   // later gears start higher, so they aren't identical

  /* --- playback rate ---------------------------------------------------
     The usable window. Past roughly half to double speed a loop stops
     sounding like an engine and starts sounding like a tape effect, so the
     whole speed range maps into this rather than onto true rpm. */
  rateIdle:     0.72,
  rateRedline:  1.95,

  /* --- levels -------------------------------------------------------- */
  sampleGain:   0.85,
  subLevel:     0.40,   // synth sub-octave, where the weight lives
  subTrack:     0.50,   // fraction of the sample's pitch the sub sits at

  /* --- load ---------------------------------------------------------- */
  cutoffIdle:   1400,   // lowpass, hertz, closed throttle
  cutoffFull:  12000,   // wide open
  gainIdle:      0.20,
  gainFull:      0.62,
  loadSlew:      0.07,  // seconds for load changes to take hold
  rateSlew:      0.05,  // stops the pitch stepping between frames

  /* --- tyres -----------------------------------------------------------
     Driven by lateral velocity, which the sim already tracks as car.slip.
     A threshold keeps it quiet through ordinary cornering — a car that
     squeals constantly stops telling you anything. */
  /* Measured against real laps: a tidy lap sits around 75 lateral units most
     of the time and peaks near 180, so silence below 120 keeps ordinary
     cornering quiet and leaves the noise for the corners where the car is
     genuinely sliding. The gain curve is squared on top of that, which makes
     it more selective still. */
  slipStart:   120,     // lateral units per second before any noise at all
  slipFull:    185,     // and where it reaches full volume
  screechGain:   0.34,
  screechHz:   2600,    // centre of the band; rises a little with speed
  screechQ:      5.5,

  /* --- wall contact ----------------------------------------------------
     Paper and ink, not metal: a dull knock rather than a crash, scaled by
     how hard the sim says the hit was. */
  thudGain:      0.75,
  thudHz:        160,   // body of the knock
  thudDecay:     0.20,  // seconds
  scrapeGain:    0.30,  // the rasp riding on top of it

  /* --- chimes ----------------------------------------------------------
     Small struck bells at the sector gates, a fifth apart, with the lap
     chime higher and doubled so finishing reads as an arrival. */
  chimeGain:     0.22,
  chimeHz:       880,
  chimeDecay:    0.9,

  /* --- output -------------------------------------------------------- */
  master:        0.55
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* Speed to gear and position within it. Both are inventions, but consistent
   ones — the same speed always gives the same gear at the same revs. */
export function gearFor(speed, maxSpeed, t = TUNING){
  const f = clamp(speed / maxSpeed, 0, 1);
  const band = 1 / t.gears;
  const gear = Math.min(t.gears - 1, Math.floor(f / band));
  const within = (f - gear * band) / band;         // 0..1 through this gear

  /* Each gear starts a little higher than the last, so pulling away in sixth
     doesn't sound identical to pulling away in first. */
  const lift = t.gearOverlap * (gear / Math.max(1, t.gears - 1));
  const lo = t.rateIdle + (t.rateRedline - t.rateIdle) * lift;
  const rate = lo + (t.rateRedline - lo) * within;
  return { gear, within, rate };
}

/* An mp3 decodes with a little silence in front of it, which would put the
   loop points in the wrong place and click once a second. Find where the
   audio actually starts rather than trusting the file length. */
export function findLoopPoints(buffer, loopSeconds){
  const d = buffer.getChannelData(0);
  let first = 0;
  for (let i = 0; i < d.length; i++){
    if (Math.abs(d[i]) > 0.02){ first = i; break; }
  }
  const start = first / buffer.sampleRate;
  const end = Math.min(buffer.duration, start + loopSeconds);
  return { start, end };
}

/* Shared noise buffer. Two seconds is long enough that the loop point is
   inaudible under everything else, and cheaper than generating noise per
   event. */
function makeNoise(ctx){
  const frames = Math.floor(ctx.sampleRate * 2);
  const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) d[i] = Math.random()*2 - 1;
  return buf;
}

/* The one-shot sounds: tyres, walls, chimes. Separate from the engine
   because they're events rather than a continuous voice, and because a
   failure in one shouldn't silence the other. */
export function createEffects(ctx, t = TUNING){
  const out = ctx.createGain();
  out.gain.value = 1;
  const noise = makeNoise(ctx);

  /* ---- tyre scrub: a continuous voice held at zero until the car slides */
  const screechSrc = ctx.createBufferSource();
  screechSrc.buffer = noise; screechSrc.loop = true;
  const screechBand = ctx.createBiquadFilter();
  screechBand.type = 'bandpass';
  screechBand.frequency.value = t.screechHz;
  screechBand.Q.value = t.screechQ;
  const screechGain = ctx.createGain();
  screechGain.gain.value = 0;
  screechSrc.connect(screechBand); screechBand.connect(screechGain);
  screechGain.connect(out);
  screechSrc.start();

  function setSlip(now, slip, speedFrac){
    /* Below the threshold there is no sound at all, so ordinary cornering
       stays silent and a real slide is worth hearing. */
    const f = clamp((slip - t.slipStart) / (t.slipFull - t.slipStart), 0, 1);
    screechGain.gain.setTargetAtTime(f * f * t.screechGain, now, 0.05);
    screechBand.frequency.setTargetAtTime(
      t.screechHz * (0.75 + 0.5*speedFrac), now, 0.08);
  }

  /* ---- wall contact: a filtered thud with a short rasp over it ---- */
  function thud(now, strength){
    const s = clamp(strength, 0, 1);

    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(t.thudHz * (1 + 0.8*s), now);
    body.frequency.exponentialRampToValueAtTime(t.thudHz * 0.55, now + t.thudDecay);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.0001, now);
    bodyGain.gain.exponentialRampToValueAtTime(t.thudGain * (0.35 + 0.65*s), now + 0.006);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + t.thudDecay);
    body.connect(bodyGain); bodyGain.connect(out);
    body.start(now); body.stop(now + t.thudDecay + 0.05);

    const rasp = ctx.createBufferSource();
    rasp.buffer = noise;
    rasp.playbackRate.value = 0.8 + 0.6*s;
    const raspBand = ctx.createBiquadFilter();
    raspBand.type = 'bandpass';
    raspBand.frequency.value = 900 + 1500*s;
    raspBand.Q.value = 1.1;
    const raspGain = ctx.createGain();
    const len = 0.06 + 0.10*s;
    raspGain.gain.setValueAtTime(t.scrapeGain * s, now);
    raspGain.gain.exponentialRampToValueAtTime(0.0001, now + len);
    rasp.connect(raspBand); raspBand.connect(raspGain); raspGain.connect(out);
    rasp.start(now, Math.random()*1.5); rasp.stop(now + len + 0.02);
  }

  /* ---- chimes: a struck bell, sine plus a quiet inharmonic partial ---- */
  function chime(now, hz, gain, decay){
    for (const [mult, level] of [[1, 1], [2.76, 0.28]]){
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = hz * mult;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(gain * level, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, now + decay);
      osc.connect(g); g.connect(out);
      osc.start(now); osc.stop(now + decay + 0.05);
    }
  }

  /* Sector gates climb a fifth each, so where you are in the lap is audible
     without looking. */
  const SECTOR_STEPS = [1, 1.5, 2];
  function sector(now, index){
    chime(now, t.chimeHz * (SECTOR_STEPS[index] || 1), t.chimeGain, t.chimeDecay);
  }
  /* Crossing the line. An ordinary lap gets two notes falling to rest; a
     personal best gets a third, rising instead, and ringing on longer. The
     shape is the signal — you know which one you've done before you look at
     the clock. */
  function lap(now, best){
    if (!best){
      chime(now,        t.chimeHz * 2,   t.chimeGain * 1.1, t.chimeDecay);
      chime(now + 0.11, t.chimeHz * 1.5, t.chimeGain,       t.chimeDecay);
      return;
    }
    chime(now,        t.chimeHz * 2, t.chimeGain,       t.chimeDecay * 0.8);
    chime(now + 0.10, t.chimeHz * 3, t.chimeGain,       t.chimeDecay * 0.8);
    chime(now + 0.21, t.chimeHz * 4, t.chimeGain * 1.2, t.chimeDecay * 2.0);
  }

  function silence(now){
    screechGain.gain.setTargetAtTime(0, now, 0.05);
  }

  function stop(){ try { screechSrc.stop(); } catch (_) {} }

  return { node: out, setSlip, thud, sector, lap, silence, stop };
}

export async function createEngine(ctx, t = TUNING){
  const out = ctx.createGain();
  out.gain.value = 0;

  /* One lowpass across the whole engine. Throttle opens and closes it, which
     is most of what separates being on the power from coasting — and closing
     it on a lift is the engine braking, with no separate sound needed. */
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = t.cutoffIdle;
  tone.Q.value = 0.7;
  tone.connect(out);

  // ---- the recorded loop ----
  let source = null, usingSample = false;
  const sampleGain = ctx.createGain();
  sampleGain.gain.value = t.sampleGain;
  sampleGain.connect(tone);

  try {
    const bin = atob(SAMPLE.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const buffer = await new Promise((res, rej) => {
      const p = ctx.decodeAudioData(bytes.buffer, res, rej);
      if (p && p.then) p.then(res, rej);      // callback and promise forms
    });
    const pts = findLoopPoints(buffer, SAMPLE.loopSeconds);
    source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = pts.start;
    source.loopEnd = pts.end;
    source.connect(sampleGain);
    source.start(0, pts.start);
    usingSample = true;
  } catch (_){
    usingSample = false;                       // synth carries it alone
  }

  // ---- synthesised sub-octave, and the fallback voice ----
  const subOsc = ctx.createOscillator();
  subOsc.type = 'sawtooth';
  const subGain = ctx.createGain();
  subGain.gain.value = usingSample ? t.subLevel : 1;
  subOsc.connect(subGain); subGain.connect(tone);
  subOsc.start();

  let shiftUntil = 0, lastGear = 0;

  function update(now, { speed, maxSpeed, throttle, brake, running }){
    if (!running){
      out.gain.setTargetAtTime(0, now, 0.08);
      return null;
    }
    const { gear, rate } = gearFor(speed, maxSpeed, t);

    if (gear !== lastGear){
      if (gear > lastGear) shiftUntil = now + t.shiftTime;
      lastGear = gear;
    }
    const shifting = now < shiftUntil;

    // during a change the revs sag rather than the sound cutting out
    const played = shifting ? rate * t.shiftDrop : rate;

    if (source) source.playbackRate.setTargetAtTime(played, now, t.rateSlew);
    subOsc.frequency.setTargetAtTime(
      clamp(SAMPLE.baseHz * played * t.subTrack, 20, 500), now, t.rateSlew);

    let load = throttle ? 1 : 0;
    if (brake) load = -1;
    if (shifting) load = 0;
    const openness = load > 0 ? 1 : (load < 0 ? 0 : 0.28);

    const rf = clamp((played - t.rateIdle) / (t.rateRedline - t.rateIdle), 0, 1);

    const cutoff = t.cutoffIdle + (t.cutoffFull - t.cutoffIdle) * openness * (0.35 + 0.65*rf);
    tone.frequency.setTargetAtTime(clamp(cutoff, 200, 18000), now, t.loadSlew);

    let gain = t.gainIdle + (t.gainFull - t.gainIdle) * (0.3 + 0.7*rf) * (0.35 + 0.65*openness);
    if (shifting) gain *= 0.5;
    out.gain.setTargetAtTime(gain, now, t.loadSlew);
    subGain.gain.setTargetAtTime(usingSample ? t.subLevel : 1, now, 0.1);

    return {
      gear, rate: played, shifting, load, usingSample,
      hz: SAMPLE.baseHz * played,
      rpm: (SAMPLE.baseHz * played) * 60 / 5     // notional, for the readout
    };
  }

  function stop(){
    try { if (source) source.stop(); subOsc.stop(); } catch (_) {}
  }

  return { node: out, update, stop, get usingSample(){ return usingSample; } };
}
