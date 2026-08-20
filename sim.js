/* ============================================================================
   sim.js — the canonical Ink Circuit simulation.

   Imported by the page, by the API, and by anything that needs to reproduce a
   lap. There is exactly one copy of the physics and one copy of the track
   generator. Nothing in here touches the DOM, canvas, storage or the clock.

   Two rules keep it honest:
     1. The sim advances only in whole FIXED ticks. It never sees wall time.
     2. A lap is fully described by (day, input stream). Given those two, the
        time and the contact count are recomputable anywhere.

   Bump SIM_VERSION whenever anything below changes the outcome of a lap.
   Stored results carry it so old times are never silently compared to new.
   ========================================================================= */

/* Version 7/8: sector splits fire on a strict centreline crossing rather than
   a proximity band, so a recorded split matches the drawn gate exactly. This
   changes lap times, so both encodings bump together — streams from earlier
   versions are rejected rather than silently mis-timed.

   Two numbers because the input encoding is an independent axis: the same
   physics can be driven by discrete keys or by analog values. */
export const SIM_VERSION_DISCRETE = 7;   // one nibble per tick
export const SIM_VERSION_ANALOG   = 8;   // 16-bit word per tick

/* Rollback flag. When false the sim takes discrete input and stamps laps with
   SIM_VERSION_DISCRETE. Every analog addition is gated on this — flipping it
   doesn't just hide the path, it takes it out of the loop entirely. */
export const SIM_ANALOG = false;
export const ACTIVE_VERSION = SIM_ANALOG ? SIM_VERSION_ANALOG : SIM_VERSION_DISCRETE;

/* Aliases, so existing imports keep working. */
export const SIM_VERSION = SIM_VERSION_ANALOG;
export const SIM_VERSION_LEGACY = SIM_VERSION_DISCRETE;

/* ---- world ---- */
export const DW = 1000, DH = 580;   // design space
export const HALF_W = 55;           // half the track width
export const FIXED = 1 / 60;        // seconds per tick

/* ---- car ---- */
export const MAX_SPD = 330;
export const ACCEL   = 260;
export const BRAKE   = 430;
export const TURN    = 2.9;
export const GRIP    = 0.02;
export const CAR_L   = 20, CAR_W = 13;
export const BOUNCE  = 0.12;

/* ---- rules ---- */
/* Three sectors, as on a real circuit: the start/finish line plus two
   intermediate splits at a third and two thirds of the way round. The splits
   double as the anti-shortcut checkpoints — they must be taken in order. */
export const SECTORS       = 3;
export const HIT_IMPACT    = 35;    // below this, contact isn't counted
export const HIT_DEBOUNCE  = 24;    // ticks; 0.4s of scraping is one contact
export const GRID_BACK_UNITS = 72;
export const GRID_SIDE     = -16;
export const CHECKPOINTS   = [1/3, 2/3];

/* A run has to be able to end. Without a cap, a player who drives the wrong
   way or simply stops is stuck forever: no result, no share, and the day never
   resolves. Two minutes is far beyond any real lap. */
export const MAX_LAP_TICKS = 60 * 120;

/* Sustained backward progress, in centre-line samples, before we say so.
   Forward progress pays it down at double rate so a wobble never trips it. */
export const WRONG_WAY_SAMPLES = 10;

/* ---- v5 input encoding: one nibble per tick, kept for rollback ---- */
export const IN_UP = 1, IN_DOWN = 2, IN_LEFT = 4, IN_RIGHT = 8;

/* ---- v6 analog encoding, 16 bits per tick ----
   bits  0..2  throttle   0..7  (0 = none, 7 = full)
   bits  3..5  brake      0..7
   bits  6..9  steer      -7..+7 signed, stored as 4-bit two's complement
   bits 10..15 reserved for future per-tick flags without a version bump */
export const STEER_LEVELS    = 7;   // 0..7 in each direction, so 15 total incl. zero
export const THROTTLE_LEVELS = 7;
export const BRAKE_LEVELS    = 7;

/* Keyboard ramp — a held key reaches full throw in this many ticks. Below
   this the player emits a partial value, matching what a touch driver can do
   with a gentle wheel tilt. Roughly 150ms at 60Hz. */
export const KEY_RAMP_TICKS = 9;

/** Build a v6 packed input word from analog components in [-1..1] or [0..1]. */
export function analogInput(throttle, brake, steer){
  const t = Math.round(Math.max(0, Math.min(1, throttle)) * THROTTLE_LEVELS);
  const b = Math.round(Math.max(0, Math.min(1, brake))    * BRAKE_LEVELS);
  const s = Math.round(Math.max(-1, Math.min(1, steer))   * STEER_LEVELS);
  const sMasked = s & 0x0F;   // 4-bit two's complement window
  return (t & 0x07) | ((b & 0x07) << 3) | (sMasked << 6);
}

/** Decode a v6 word back to floats. */
export function decodeAnalog(word){
  const t = word & 0x07;
  const b = (word >> 3) & 0x07;
  let s = (word >> 6) & 0x0F;
  if (s & 0x08) s |= ~0x0F;   // sign-extend 4-bit
  return {
    throttle: t / THROTTLE_LEVELS,
    brake:    b / BRAKE_LEVELS,
    steer:    s / STEER_LEVELS
  };
}

/** Decode a v5 nibble to the same shape, so step() can be encoding-agnostic. */
export function decodeLegacy(nibble){
  return {
    throttle: (nibble & IN_UP)    ? 1 : 0,
    brake:    (nibble & IN_DOWN)  ? 1 : 0,
    steer:    ((nibble & IN_RIGHT) ? 1 : 0) - ((nibble & IN_LEFT) ? 1 : 0)
  };
}

/* ============================================================================
   Geometry
   ========================================================================= */
export const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

function mixp(a, b, ta, tb, t){
  const d = (tb - ta) || 1e-6, u = (tb - t) / d, v = (t - ta) / d;
  return [a[0]*u + b[0]*v, a[1]*u + b[1]*v];
}

/* Centripetal Catmull-Rom: passes through every point, never cusps. */
export function catmullRom(pts, steps = 18, alpha = 0.5){
  const out = [], n = pts.length;
  for (let i = 0; i < n; i++){
    const p0 = pts[(i-1+n)%n], p1 = pts[i], p2 = pts[(i+1)%n], p3 = pts[(i+2)%n];
    const t0 = 0,
          t1 = t0 + Math.pow(dist(p0,p1), alpha) || 1e-4,
          t2 = t1 + Math.pow(dist(p1,p2), alpha) || 1e-4,
          t3 = t2 + Math.pow(dist(p2,p3), alpha) || 1e-4;
    for (let s = 0; s < steps; s++){
      const t  = t1 + (t2-t1)*(s/steps);
      const A1 = mixp(p0,p1,t0,t1,t), A2 = mixp(p1,p2,t1,t2,t), A3 = mixp(p2,p3,t2,t3,t);
      const B1 = mixp(A1,A2,t0,t2,t), B2 = mixp(A2,A3,t1,t3,t);
      out.push(mixp(B1,B2,t1,t2,t));
    }
  }
  return out;
}

export function tangents(P){
  const n = P.length;
  return P.map((_, i) => {
    const a = P[(i-1+n)%n], b = P[(i+1)%n];
    const tx = b[0]-a[0], ty = b[1]-a[1], l = Math.hypot(tx,ty) || 1;
    return [tx/l, ty/l];
  });
}

export function resample(P, count){
  const n = P.length, cum = [0];
  for (let i = 0; i < n; i++) cum.push(cum[i] + dist(P[i], P[(i+1)%n]));
  const total = cum[n], out = [];
  let j = 0;
  for (let i = 0; i < count; i++){
    const d = total*i/count;
    while (j < n && cum[j+1] < d) j++;
    const t = (d - cum[j]) / ((cum[j+1]-cum[j]) || 1e-6);
    const a = P[j], b = P[(j+1)%n];
    out.push([a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t]);
  }
  return out;
}

/* How much room is left before an offset edge doubles back on itself. This,
   not corner radius, is the real ceiling on how wide a track can be. */
export function foldPerSample(P, w){
  const n = P.length, T = tangents(P), out = new Array(n).fill(Infinity);
  for (const side of [1, -1]){
    const E = P.map((p, i) => [p[0] - T[i][1]*side*w, p[1] + T[i][0]*side*w]);
    for (let i = 0; i < n; i++){
      const a = E[i], b = E[(i+1)%n];
      const adv = (b[0]-a[0])*T[i][0] + (b[1]-a[1])*T[i][1];
      const r = adv / (dist(P[i], P[(i+1)%n]) || 1e-6);
      out[i] = Math.min(out[i], r);
      out[(i+1)%n] = Math.min(out[(i+1)%n], r);
    }
  }
  return out;
}
const foldWorst = (P, w) => Math.min(...foldPerSample(P, w));

/* ============================================================================
   Track generation — deterministic in the day number alone
   ========================================================================= */
export function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a>>>15, 1|a);
    t = t + Math.imul(t ^ t>>>7, 61|t) ^ t;
    return ((t ^ t>>>14) >>> 0) / 4294967296;
  };
}

function hull(pts){
  const p = pts.slice().sort((a,b) => a[0]-b[0] || a[1]-b[1]);
  const cross = (o,a,b) => (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0]);
  const lo = [], up = [];
  for (const q of p){ while (lo.length>=2 && cross(lo[lo.length-2],lo[lo.length-1],q)<=0) lo.pop(); lo.push(q); }
  for (let i=p.length-1;i>=0;i--){ const q=p[i]; while (up.length>=2 && cross(up[up.length-2],up[up.length-1],q)<=0) up.pop(); up.push(q); }
  lo.pop(); up.pop();
  return lo.concat(up);
}

function separate(pts, minD, iters = 80){
  const n = pts.length;
  for (let it = 0; it < iters; it++){
    let moved = false;
    for (let i = 0; i < n; i++) for (let j = i+1; j < n; j++){
      const d = dist(pts[i], pts[j]);
      if (d < minD && d > 1e-6){
        const push = (minD-d)/2, dx = (pts[j][0]-pts[i][0])/d, dy = (pts[j][1]-pts[i][1])/d;
        pts[i][0] -= dx*push; pts[i][1] -= dy*push;
        pts[j][0] += dx*push; pts[j][1] += dy*push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  return pts;
}

/* Long hull edges stay as straights; displaced midpoints become corners. */
function addCorners(pts, rnd, amount){
  const out = [], n = pts.length;
  for (let i = 0; i < n; i++){
    const a = pts[i], b = pts[(i+1)%n];
    out.push(a);
    const len = dist(a,b);
    if (len < 150) continue;
    const dx = (b[0]-a[0])/len, dy = (b[1]-a[1])/len;
    const disp = (rnd()*2-1) * amount * Math.min(1, len/300);
    out.push([(a[0]+b[0])/2 - dy*disp, (a[1]+b[1])/2 + dx*disp]);
  }
  return out;
}

function fixAngles(pts, minAngle, iters = 140){
  const n = pts.length;
  for (let it = 0; it < iters; it++){
    let bad = false;
    for (let i = 0; i < n; i++){
      const prev = pts[(i-1+n)%n], cur = pts[i], next = pts[(i+1)%n];
      let v1x = prev[0]-cur[0], v1y = prev[1]-cur[1];
      let v2x = next[0]-cur[0], v2y = next[1]-cur[1];
      const l1 = Math.hypot(v1x,v1y)||1, l2 = Math.hypot(v2x,v2y)||1;
      v1x/=l1; v1y/=l1; v2x/=l2; v2y/=l2;
      const ang = Math.acos(Math.max(-1, Math.min(1, v1x*v2x + v1y*v2y)));
      if (ang >= minAngle) continue;
      bad = true;
      const need = (minAngle-ang)*0.5;
      const sign = (v1x*v2y - v1y*v2x) > 0 ? -1 : 1;
      const c = Math.cos(need*sign), s = Math.sin(need*sign);
      pts[(i+1)%n] = [cur[0] + (v2x*c - v2y*s)*l2, cur[1] + (v2x*s + v2y*c)*l2];
    }
    if (!bad) return true;
  }
  return false;
}

/* Relax only the corners too tight for the width. Straights survive. */
function relaxCorners(P, w, target = 0.30, iters = 600){
  const n = P.length;
  for (let it = 0; it < iters; it++){
    const f = foldPerSample(P, w);
    if (Math.min(...f) >= target) return true;
    const Q = P.map(p => p.slice());
    for (let i = 0; i < n; i++){
      if (f[i] >= target) continue;
      const a = 0.22 * Math.min(1, (target-f[i])/target);
      const m1 = P[(i-5+n)%n], m2 = P[(i+5)%n];
      Q[i][0] = P[i][0]*(1-a) + ((m1[0]+m2[0])/2)*a;
      Q[i][1] = P[i][1]*(1-a) + ((m1[1]+m2[1])/2)*a;
    }
    for (let i = 0; i < n; i++){
      const near = f[i] < target || f[(i-1+n)%n] < target || f[(i+1)%n] < target;
      if (!near){ P[i] = Q[i]; continue; }
      const m1 = Q[(i-1+n)%n], m2 = Q[(i+1)%n], b = 0.16;
      P[i] = [Q[i][0]*(1-b) + ((m1[0]+m2[0])/2)*b, Q[i][1]*(1-b) + ((m1[1]+m2[1])/2)*b];
    }
  }
  return Math.min(...foldPerSample(P, w)) >= target;
}

function attempt(seed, w){
  const rnd = mulberry32(seed);
  const padX = w+26, padY = w+22;
  const scatter = [];
  for (let i = 0; i < 16; i++) scatter.push([padX + rnd()*(DW-2*padX), padY + rnd()*(DH-2*padY)]);
  let pts = hull(scatter);
  if (pts.length < 6) return null;
  separate(pts, 2.4*w);
  pts = addCorners(pts, rnd, w*1.5);
  separate(pts, 2.15*w, 40);
  if (!fixAngles(pts, Math.PI*0.52)) return null;
  separate(pts, 2.05*w, 30);
  for (const p of pts){
    p[0] = Math.max(padX, Math.min(DW-padX, p[0]));
    p[1] = Math.max(padY, Math.min(DH-padY, p[1]));
  }
  if (pts.length < 7 || pts.length > 14) return null;

  let P = resample(catmullRom(pts), 360);
  if (foldWorst(P, w) < 0.30 && !relaxCorners(P, w)) return null;
  P = resample(P, 360);
  const n = P.length;

  let gap = Infinity;
  for (let i = 0; i < n; i += 2) for (let j = i+2; j < n; j += 2){
    const sep = Math.min(j-i, n-(j-i));
    if (sep < 44) continue;
    const d = dist(P[i], P[j]);
    if (d < gap) gap = d;
  }
  if (gap < 2*w + 22) return null;

  let page = Infinity;
  for (const p of P) page = Math.min(page, p[0], DW-p[0], p[1], DH-p[1]);
  if (page < w+4) return null;

  let len = 0;
  for (let i = 0; i < n; i++) len += dist(P[i], P[(i+1)%n]);
  if (len < 1700 || len > 2900) return null;

  const T = tangents(P);
  let straight = 0;
  for (let i = 0; i < n; i++){
    const a = T[i], b = T[(i+6)%n];
    if (Math.acos(Math.max(-1, Math.min(1, a[0]*b[0] + a[1]*b[1]))) < 0.10) straight++;
  }
  if (straight/n < 0.22) return null;

  return P;
}

/* Start line goes on the longest straight, rotated to index 0. */
function rotateToStraight(P){
  const n = P.length, T = tangents(P);
  let bestI = 0, bestTurn = Infinity;
  for (let i = 0; i < n; i++){
    let turn = 0;
    for (let k = -9; k < 9; k++){
      const a = T[(i+k+n)%n], b = T[(i+k+1+n)%n];
      turn += Math.abs(Math.acos(Math.max(-1, Math.min(1, a[0]*b[0] + a[1]*b[1]))));
    }
    if (turn < bestTurn){ bestTurn = turn; bestI = i; }
  }
  return P.slice(bestI).concat(P.slice(0, bestI));
}

const trackCache = new Map();

/* Everything downstream — physics, rendering, checkpoints — reads geometry
   from this bundle rather than from the module constants, so a track can come
   from the generator, from a real circuit's control points, or from a test
   fixture and behave identically. */
function assembleTrack(path, meta){
  const n = path.length;
  const T = tangents(path);
  const normals = T.map(t => [-t[1], t[0]]);
  let length = 0;
  for (let i = 0; i < n; i++) length += dist(path[i], path[(i+1)%n]);
  const spacing = length / n;

  return {
    path, normals, tangents: T, length, spacing, n,
    /* Half the track width, in design units. Per-track rather than global:
       imported circuits need their own, and varying it deliberately is the
       track-width experiment. */
    halfWidth: meta.halfWidth === undefined ? HALF_W : meta.halfWidth,
    /* Where the track came from. `generated` circuits are novel to everyone,
       which is what the research design depends on; anything else is not. */
    source: meta.source || 'generated',
    name: meta.name || null,
    day: meta.day === undefined ? null : meta.day,
    gridIndex: (n - Math.max(8, Math.round(GRID_BACK_UNITS/spacing)) + n) % n,
    checkpoints: CHECKPOINTS.map(f => Math.floor(n*f))
  };
}

/** The circuit for a given day. Same day, same track, anywhere. */
export function buildTrack(day){
  if (trackCache.has(day)) return trackCache.get(day);
  let path = null;
  for (let k = 0; k < 800 && !path; k++){
    const P = attempt(day*7919 + k*104729 + 13, HALF_W);
    if (P) path = rotateToStraight(P);
  }
  if (!path) throw new Error('no valid track for day ' + day);

  const track = assembleTrack(path, { day, source: 'generated' });
  trackCache.set(day, track);
  return track;
}

/* ============================================================================
   Importing a real circuit

   A real circuit arrives as a handful of control points traced from a map.
   Two things make it usable:

   1. It is resampled through the same Catmull-Rom path the generator uses, so
      nothing downstream can tell an imported track from a generated one.

   2. It is normalised to fill the design space. Faithful scaling is not an
      option — a real circuit is roughly 1:280 to 1:540 in width-to-length,
      against this game's 1:18, so a true-to-scale import would be a hairline
      nobody could drive. Imported tracks are therefore caricatures: the corner
      sequence and shape are real, the proportions are not.
   ========================================================================= */

/** Resample a closed loop of control points to `count` evenly spaced samples. */
function resampleLoop(points, count){
  const m = points.length;
  if (m < 4) throw new Error('need at least 4 control points');

  /* Centripetal Catmull-Rom (alpha = 0.5) rather than the uniform form.
     Uniform splines overshoot where control points bunch up, which on a
     traced circuit means the spline invents corners tighter than the real
     ones — Zandvoort's Tarzan hairpin came out at 60% of its true radius.
     Centripetal parameterisation is the standard fix and cannot cusp or
     self-intersect between points. */
  const ALPHA = 0.5;
  const knot = (ti, a, b) => {
    const d = Math.hypot(b[0]-a[0], b[1]-a[1]);
    return ti + (d < 1e-9 ? 1e-9 : Math.pow(d, ALPHA));
  };
  const lerp = (a, b, ta, tb, t) => {
    const span = (tb - ta) || 1e-9;
    const w = (tb - t)/span, v = (t - ta)/span;
    return [a[0]*w + b[0]*v, a[1]*w + b[1]*v];
  };

  const dense = [];
  const STEPS = 24;
  for (let i = 0; i < m; i++){
    const p0 = points[(i-1+m)%m], p1 = points[i];
    const p2 = points[(i+1)%m],   p3 = points[(i+2)%m];
    const t0 = 0, t1 = knot(t0,p0,p1), t2 = knot(t1,p1,p2), t3 = knot(t2,p2,p3);
    for (let s = 0; s < STEPS; s++){
      const t = t1 + (t2 - t1) * (s/STEPS);
      const A1 = lerp(p0,p1,t0,t1,t), A2 = lerp(p1,p2,t1,t2,t), A3 = lerp(p2,p3,t2,t3,t);
      const B1 = lerp(A1,A2,t0,t2,t), B2 = lerp(A2,A3,t1,t3,t);
      dense.push(lerp(B1,B2,t1,t2,t));
    }
  }

  const dn = dense.length;
  const cum = [0];
  for (let i = 0; i < dn; i++) cum.push(cum[i] + dist(dense[i], dense[(i+1)%dn]));
  const total = cum[dn];

  const out = [];
  let j = 0;
  for (let i = 0; i < count; i++){
    const target = (i/count) * total;
    while (j < dn && cum[j+1] < target) j++;
    const seg = cum[j+1] - cum[j] || 1;
    const f = (target - cum[j]) / seg;
    const a = dense[j], b = dense[(j+1)%dn];
    out.push([a[0] + (b[0]-a[0])*f, a[1] + (b[1]-a[1])*f]);
  }
  return out;
}

/** Scale and centre a loop to fill a box, preserving aspect ratio. */
function fitToBox(points, margin, boxW, boxH){
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX || 1, h = maxY - minY || 1;
  const s = Math.min((boxW - margin*2) / w, (boxH - margin*2) / h);
  const ox = (boxW - w*s)/2 - minX*s;
  const oy = (boxH - h*s)/2 - minY*s;
  return points.map(p => [p[0]*s + ox, p[1]*s + oy]);
}

/* How tight a corner the car can actually take, as a radius in design units.
   Below this the track is undriveable however wide it is. */
export function minCornerRadius(halfWidth){
  return Math.max(18, (CAR_L + CAR_W) * 1.4 - (halfWidth - HALF_W) * 0.3);
}

/**
 * Build a track from traced control points.
 *
 *   trackFromPoints(points, { name, halfWidth, margin, samples })
 *
 * `points` is a closed loop in any coordinate space — latitude/longitude,
 * pixels off a screenshot, whatever. Only the shape matters; it is normalised.
 * Returns the same object shape as buildTrack, plus a report of any corners
 * too tight for the car, so an import can be checked rather than assumed.
 */
export function trackFromPoints(points, opts = {}){
  const samples  = opts.samples || 360;
  /* The world a track lives in need not be the screen. A circuit drawn at
     realistic proportions is far larger than the canvas, and is viewed
     through a camera that follows the car. */
  const boxW = opts.width  || DW;
  const boxH = opts.height || DH;
  /* Margin is on top of the track's own half-width, which is already added
     below — 70 as well left imported circuits floating in the middle of the
     canvas. */
  const margin   = opts.margin === undefined ? 22 : opts.margin;
  const halfWidth = opts.halfWidth === undefined ? HALF_W : opts.halfWidth;

  const fitted = fitToBox(points, margin + halfWidth, boxW, boxH);
  let path = resampleLoop(fitted, samples);
  path = rotateToStraight(path);

  const track = assembleTrack(path, {
    halfWidth,
    source: opts.source || 'circuit',
    name: opts.name || null,
    day: opts.day
  });
  track.report = inspectCorners(track);
  track.world = { width: boxW, height: boxH };
  track.report.proximity = closestApproach(track);
  return track;
}

/* How close two non-adjacent parts of the loop come to each other. Below
   twice the track width their tarmac overlaps on screen, which is the thing
   that makes real circuits hard to draw at exaggerated widths. */
function closestApproach(track){
  const { path, n, halfWidth } = track;
  const skip = Math.max(4, Math.round(n * 0.10));
  let worst = Infinity, overlapping = 0;
  for (let i = 0; i < n; i++){
    for (let j = i + skip; j < n - (i < skip ? skip : 0); j++){
      const d = Math.hypot(path[i][0]-path[j][0], path[i][1]-path[j][1]);
      if (d < worst) worst = d;
      if (d < halfWidth*2) overlapping++;
    }
  }
  return { closest: +worst.toFixed(1), needed: halfWidth*2, overlapping };
}

/* Corners an imported circuit can't support, reported rather than silently
   smoothed — a traced track should be checked by a person before it ships.

   Two distinct failures, which want different fixes:

     tooTightToDrive  the centreline turns harder than the car can, even using
                      the full width. Widen the track or ease the corner.

     edgeFolds        the corner radius is smaller than the track is wide, so
                      the inner edge crosses itself and the drawing breaks.
                      Narrow the track or ease the corner.

   A hairpin on a wide track often hits the second and not the first. */
function inspectCorners(track){
  const { path, n, halfWidth } = track;
  const driveLimit = minCornerRadius(halfWidth);
  const tooTightToDrive = [], edgeFolds = [];
  let tightest = Infinity;

  for (let i = 0; i < n; i++){
    const a = path[(i-4+n)%n], b = path[i], c = path[(i+4)%n];
    const ab = dist(a,b), bc = dist(b,c), ca = dist(c,a);
    const area = Math.abs((b[0]-a[0])*(c[1]-a[1]) - (c[0]-a[0])*(b[1]-a[1])) / 2;
    if (area < 1e-6) continue;
    const radius = (ab*bc*ca) / (4*area);
    tightest = Math.min(tightest, radius);
    if (radius < driveLimit) tooTightToDrive.push({ index: i, radius: +radius.toFixed(1) });
    if (radius < halfWidth)  edgeFolds.push({ index: i, radius: +radius.toFixed(1) });
  }
  return {
    tooTightToDrive, edgeFolds,
    tightestRadius: +tightest.toFixed(1),
    driveLimit: +driveLimit.toFixed(1),
    ok: tooTightToDrive.length === 0 && edgeFolds.length === 0
  };
}

/* Render-only: the drawn edges drift slightly so the line reads as inked.
   Whole harmonics of the loop, so it closes with no seam. Physics uses the
   exact width and ignores this. */
export function edgePoints(track, side, seed){
  const { path, normals, n } = track;
  const hw = track.halfWidth === undefined ? HALF_W : track.halfWidth;
  return path.map((p, i) => {
    const u = (i/n) * Math.PI * 2;
    const w = Math.sin(u*3 + seed)*0.9 + Math.sin(u*5 + seed*2.3)*0.6;
    const off = side*hw + w;
    return [p[0] + normals[i][0]*off, p[1] + normals[i][1]*off];
  });
}

/* ============================================================================
   The simulation
   ========================================================================= */
export function createSim(track){
  const { path: PATH, normals: NORMALS, n: N, gridIndex, checkpoints: CPS } = track;
  /* Width comes from the track, not the module constant, so imported circuits
     and width experiments both work without touching the physics. */
  const HW = track.halfWidth === undefined ? HALF_W : track.halfWidth;

  const car  = { x:0, y:0, h:0, vx:0, vy:0, spd:0, slip:0 };
  const prev = { x:0, y:0, h:0 };

  let ticks = 0, hits = 0, lastHitTick = -1e9;
  let nextCp = 0, lastIdx = 0, state = 'grid';
  let sectorHits = new Array(SECTORS).fill(0);
  let splitTicks = [];             // tick count as each split was crossed
  let reverseRun = 0;              // how far we've been going the wrong way

  function placeOnGrid(){
    const i = gridIndex;
    const a = PATH[i], b = PATH[(i+1)%N];
    car.h = Math.atan2(b[1]-a[1], b[0]-a[0]);
    car.x = a[0] + NORMALS[i][0]*GRID_SIDE;
    car.y = a[1] + NORMALS[i][1]*GRID_SIDE;
    car.vx = car.vy = car.spd = car.slip = 0;
    prev.x = car.x; prev.y = car.y; prev.h = car.h;
    lastIdx = i;
  }

  /* Nearest point on the centre line, projected onto each segment so the
     wall doesn't feel faceted when you scrape along it. */
  function nearest(x, y){
    let best = Infinity, bi = 0, bx = 0, by = 0;
    for (let i = 0; i < N; i++){
      const a = PATH[i], b = PATH[(i+1)%N];
      const ax = b[0]-a[0], ay = b[1]-a[1];
      const t = Math.max(0, Math.min(1, ((x-a[0])*ax + (y-a[1])*ay) / (ax*ax + ay*ay || 1)));
      const qx = a[0]+ax*t, qy = a[1]+ay*t;
      const dx = x-qx, dy = y-qy, d2 = dx*dx + dy*dy;
      if (d2 < best){ best = d2; bi = i; bx = qx; by = qy; }
    }
    return { d: Math.sqrt(best), i: bi, px: bx, py: by };
  }

  /* The track edge is solid. Past half-width minus the car's own reach along
     the wall normal is a hit; head-on stops you, a graze scrubs and slides. */
  function collide(){
    const near = nearest(car.x, car.y);
    let ox = car.x - near.px, oy = car.y - near.py;
    const d = Math.hypot(ox, oy);
    if (d < 1e-4) return { near, hit: null };
    ox /= d; oy /= d;

    const c = Math.abs( Math.cos(car.h)*ox + Math.sin(car.h)*oy);
    const s = Math.abs(-Math.sin(car.h)*ox + Math.cos(car.h)*oy);
    const limit = HW - (CAR_L*c + CAR_W*s);
    if (d <= limit) return { near, hit: null };

    car.x = near.px + ox*limit;
    car.y = near.py + oy*limit;

    const into = car.vx*ox + car.vy*oy;
    const alongX = car.vx - into*ox, alongY = car.vy - into*oy;
    const impact = Math.max(0, into);
    const bite = Math.min(1, impact/110);
    const keep = 0.92 - 0.85*bite;

    car.vx = alongX*keep - ox*impact*BOUNCE;
    car.vy = alongY*keep - oy*impact*BOUNCE;
    car.spd = car.vx*Math.cos(car.h) + car.vy*Math.sin(car.h);
    car.slip = 0;

    if (impact <= HIT_IMPACT) return { near, hit: null };

    let counted = false;
    if (state === 'running' && ticks - lastHitTick > HIT_DEBOUNCE){
      lastHitTick = ticks;
      hits++;
      sectorHits[Math.min(SECTORS-1, Math.floor(near.i/N*SECTORS))] = 1;
      counted = true;
    }
    return { near, hit: { x: car.x, y: car.y, ox, oy, bite, counted } };
  }

  /* Each checkpoint as a line: a point on the centreline plus the forward
     tangent there. A crossing is the signed distance along that tangent
     flipping from negative to positive — the same test the drawn sector beam
     uses, so the recorded split and the visible gate agree exactly. */
  const CP_LINES = CPS.map(idx => {
    const a = PATH[(idx-1+N)%N], b = PATH[(idx+1)%N];
    const tx = b[0]-a[0], ty = b[1]-a[1], l = Math.hypot(tx,ty) || 1;
    return { idx, p: PATH[idx], tx: tx/l, ty: ty/l };
  });
  let cpPrev = null;          // last signed distance to the current target

  /* Checkpoints must be taken in order, so the lap can't be shortcut. The
     line only ever ends the lap — the clock starts on the first input. */
  function progress(i){
    if (state === 'running' && nextCp < CP_LINES.length){
      const s = CP_LINES[nextCp];
      const dx = car.x - s.p[0], dy = car.y - s.p[1];
      const along = dx*s.tx + dy*s.ty;
      /* Only test near the gate, or a distant part of the loop with the same
         tangent orientation could trip it. */
      const near = Math.hypot(dx, dy) < HW*2.5;
      if (!near){
        cpPrev = null;
      } else if (cpPrev !== null && cpPrev < 0 && along >= 0){
        nextCp++;
        splitTicks.push(ticks);
        cpPrev = null;
      } else {
        cpPrev = along;
      }
    }

    /* Signed progress along the loop, shortest way round. Driving backwards
       still collects checkpoints in order, but the finish needs a forward
       crossing — so without this the player just circles forever. */
    let d = i - lastIdx;
    if (d >  N/2) d -= N;
    if (d < -N/2) d += N;
    if (state === 'running'){
      if (d < 0)      reverseRun = Math.min(WRONG_WAY_SAMPLES*4, reverseRun - d);
      else if (d > 0) reverseRun = Math.max(0, reverseRun - d*2);
    } else {
      reverseRun = 0;
    }

    const crossed = lastIdx > N*0.9 && i < N*0.1;
    lastIdx = i;
    if (crossed && state === 'running' && nextCp >= CPS.length){
      state = 'done';
      return true;
    }
    return false;
  }

  function step(input){
    ticks++;
    prev.x = car.x; prev.y = car.y; prev.h = car.h;

    /* input is either a v5 nibble (0..15) or a v6 packed word. Decoding both
       to the same {throttle, brake, steer} shape means the physics below is
       identical in either mode — full throw analog exactly reproduces v5. */
    const cmd = SIM_ANALOG ? decodeAnalog(input) : decodeLegacy(input);
    const authority = Math.min(1, Math.abs(car.spd)/70);
    car.h += cmd.steer * TURN * authority * Math.sign(car.spd || 1) * FIXED;

    const fx = Math.cos(car.h), fy = Math.sin(car.h);
    let fwd = car.vx*fx + car.vy*fy;
    let lat = -car.vx*fy + car.vy*fx;

    fwd += cmd.throttle * ACCEL * FIXED;
    fwd -= cmd.brake    * BRAKE * FIXED;
    /* engine braking still kicks in when neither pedal is pressed. In v5 this
       was a hard "no keys held" test; in v6 it fades in as both pedals lift. */
    const idle = Math.max(0, 1 - cmd.throttle - cmd.brake);
    fwd *= Math.pow(0.55 + 0.45*(1-idle), FIXED);

    fwd = Math.max(-MAX_SPD*0.3, Math.min(MAX_SPD, fwd));
    lat *= Math.pow(GRIP, FIXED);

    car.spd = fwd; car.slip = Math.abs(lat);
    car.vx = fx*fwd - fy*lat;
    car.vy = fy*fwd + fx*lat;

    car.x += car.vx*FIXED;
    car.y += car.vy*FIXED;

    const { near, hit } = collide();
    let finished = progress(near.i);

    // the run always terminates, one way or another
    if (!finished && state === 'running' && ticks >= MAX_LAP_TICKS){
      state = 'dnf';
      finished = true;
    }
    return { hit, finished, nearIndex: near.i };
  }

  placeOnGrid();

  return {
    track, car, prev, nearest,
    get ticks(){ return ticks; },
    get hits(){ return hits; },
    get state(){ return state; },
    get sectorHits(){ return sectorHits.slice(); },
    get nextCp(){ return nextCp; },
    get wrongWay(){ return state === 'running' && reverseRun >= WRONG_WAY_SAMPLES; },
    get ticksLeft(){ return Math.max(0, MAX_LAP_TICKS - ticks); },

    /* Which sector the car is in right now, 1-based, for a live readout. */
    get sector(){ return Math.min(SECTORS, splitTicks.length + 1); },

    /* Duration of each sector in ticks. Sector 1 contains the run from the
       grid to the line, so the three always sum to the lap time. Entries are
       null for sectors not yet completed. */
    get sectorTicks(){
      const bounds = [0, ...splitTicks];
      if (state !== 'running') bounds.push(ticks);
      const out = [];
      for (let k = 0; k < SECTORS; k++)
        out.push(bounds[k+1] === undefined ? null : bounds[k+1] - bounds[k]);
      return out;
    },
    get splitTicks(){ return splitTicks.slice(); },
    elapsedMs(){ return ticks * FIXED * 1000; },
    start(){
      if (state !== 'grid') return false;
      placeOnGrid();
      ticks = 0; hits = 0; lastHitTick = -1e9; nextCp = 0;
      sectorHits = new Array(SECTORS).fill(0);
      splitTicks = [];
      cpPrev = null;
      reverseRun = 0;
      state = 'running';
      return true;
    },
    /* Seed the car's state before a replay. Practice laps roll continuously,
       so most of them begin mid-circulation rather than on the grid — without
       this, replaying one from a standstill would diverge immediately. */
    seedCar(st){
      car.x = st.x; car.y = st.y; car.h = st.h;
      car.vx = st.vx; car.vy = st.vy;
      car.spd = st.spd; car.slip = st.slip || 0;
      prev.x = car.x; prev.y = car.y; prev.h = car.h;
      lastIdx = nearest(car.x, car.y).i;
      cpPrev = null;
    },

    /* Snapshot, for recording where a lap began. */
    carState(){
      return { x:car.x, y:car.y, h:car.h, vx:car.vx, vy:car.vy,
               spd:car.spd, slip:car.slip };
    },

    /* Player gives up. A real outcome, not an error state — it gets a result
       card and a share line like any other run. */
    retire(){
      if (state !== 'running') return false;
      state = 'retired';
      return true;
    },

    /* Roll straight into another lap without stopping the car. Practice only —
       the daily attempt always ends at the line, which is what makes it a
       single attempt. Clears the lap's timing, checkpoints and contact count
       but leaves position, heading and velocity untouched, so speed carries
       across the start/finish line the way it does in a real session. */
    continueLap(){
      if (state !== 'done') return false;
      ticks = 0;
      hits = 0;
      lastHitTick = -1e9;
      nextCp = 0;
      sectorHits = new Array(SECTORS).fill(0);
      splitTicks = [];
      cpPrev = null;
      reverseRun = 0;
      state = 'running';
      return true;
    },
    reset(){
      placeOnGrid();
      ticks = 0; hits = 0; lastHitTick = -1e9; nextCp = 0;
      sectorHits = new Array(SECTORS).fill(0);
      splitTicks = [];
      cpPrev = null;
      reverseRun = 0;
      state = 'grid';
    },
    step
  };
}

/* ============================================================================
   Input streams — one nibble per tick

   Header is 3 bytes: version, then tick count big-endian. That makes a stream
   self-describing, so it survives a URL with no other context. ~275 URL-safe
   characters for a seven second lap.
   ========================================================================= */
const B64URL = s => s.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const UNB64URL = s => s.replace(/-/g,'+').replace(/_/g,'/');

function bytesToB64(bytes){
  if (typeof btoa === 'function'){
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return B64URL(btoa(bin));
  }
  return B64URL(Buffer.from(bytes).toString('base64'));
}
function b64ToBytes(str){
  const s = UNB64URL(str);
  if (typeof atob === 'function'){
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(s, 'base64'));
}

/* CRC-16/CCITT over the header and payload. This is an integrity check, not
   an authenticity one: it catches a URL truncated by a chat app or mangled by
   an email client, and lets us say "this link is damaged" instead of the
   misleading "this lap is invalid".

   It deliberately does NOT stop deliberate tampering — anyone can recompute
   it. Forgery is already handled by the fact that a lap's time comes from
   replaying its inputs, so an edited stream just produces whatever time it
   actually drives, not a faster one. Real authenticity needs a server-side
   secret, which belongs with the backend rather than in shipped JavaScript. */
export function crc16(bytes){
  let crc = 0xFFFF;
  for (let i = 0; i < bytes.length; i++){
    crc ^= bytes[i] << 8;
    for (let b = 0; b < 8; b++){
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
  }
  return crc;
}

/* Header is 5 bytes: version, length (2), checksum (2). The checksum covers
   the version, the length and the payload — everything but itself. */
const HEADER_BYTES = 5;

function finishPack(bytes){
  const covered = new Uint8Array(bytes.length - 2);
  covered[0] = bytes[0];
  covered[1] = bytes[1];
  covered[2] = bytes[2];
  covered.set(bytes.subarray(HEADER_BYTES), 3);
  const crc = crc16(covered);
  bytes[3] = (crc >> 8) & 0xFF;
  bytes[4] = crc & 0xFF;
  return bytesToB64(bytes);
}

export function packInputs(inputs){
  const n = inputs.length;
  if (n > 0xFFFF) throw new Error('lap too long to encode');

  /* Discrete format: one nibble per tick, two per byte. */
  if (!SIM_ANALOG){
    const bytes = new Uint8Array(HEADER_BYTES + Math.ceil(n/2));
    bytes[0] = SIM_VERSION_DISCRETE;
    bytes[1] = (n >> 8) & 0xFF;
    bytes[2] = n & 0xFF;
    for (let i = 0; i < n; i++){
      const v = inputs[i] & 0x0F;
      if (i % 2 === 0) bytes[HEADER_BYTES + (i>>1)] |= v << 4;
      else             bytes[HEADER_BYTES + (i>>1)] |= v;
    }
    return finishPack(bytes);
  }

  /* Analog format: 16-bit little-endian word per tick. Same header, wider
     payload — roughly 3x the size, still comfortably URL-safe. */
  const bytes = new Uint8Array(HEADER_BYTES + n*2);
  bytes[0] = SIM_VERSION_ANALOG;
  bytes[1] = (n >> 8) & 0xFF;
  bytes[2] = n & 0xFF;
  for (let i = 0; i < n; i++){
    const w = inputs[i] & 0xFFFF;
    bytes[HEADER_BYTES + i*2]     = w & 0xFF;
    bytes[HEADER_BYTES + i*2 + 1] = (w >> 8) & 0xFF;
  }
  return finishPack(bytes);
}

/* Thrown when the checksum fails, so callers can tell a damaged link from an
   invalid lap and say something useful about it. */
export class CorruptStreamError extends Error {
  constructor(msg){ super(msg); this.name = 'CorruptStreamError'; }
}

export function unpackInputs(str){
  const bytes = b64ToBytes(str);
  if (bytes.length < HEADER_BYTES) throw new Error('input stream too short');
  const version = bytes[0];
  const n = (bytes[1] << 8) | bytes[2];

  const stride = version === SIM_VERSION_ANALOG ? 2 : 0.5;
  const expected = HEADER_BYTES + (stride === 2 ? n*2 : Math.ceil(n/2));
  if (version !== SIM_VERSION_DISCRETE && version !== SIM_VERSION_ANALOG)
    throw new Error('unknown sim version ' + version);
  if (bytes.length < expected)
    throw new CorruptStreamError('link is truncated \u2014 it may have been cut short in transit');

  /* Checksum first: a damaged link should say so, rather than decoding into
     nonsense and reporting an invalid lap. */
  const covered = new Uint8Array(bytes.length - 2);
  covered[0] = bytes[0];
  covered[1] = bytes[1];
  covered[2] = bytes[2];
  covered.set(bytes.subarray(HEADER_BYTES), 3);
  const want = (bytes[3] << 8) | bytes[4];
  if (crc16(covered) !== want)
    throw new CorruptStreamError('link is damaged \u2014 some of it was changed or lost in transit');

  const out = new Uint16Array(n);
  if (version === SIM_VERSION_DISCRETE){
    for (let i = 0; i < n; i++){
      const b = bytes[HEADER_BYTES + (i>>1)];
      out[i] = (i % 2 === 0) ? (b >> 4) & 0x0F : b & 0x0F;
    }
  } else {
    for (let i = 0; i < n; i++){
      out[i] = bytes[HEADER_BYTES + i*2] | (bytes[HEADER_BYTES + i*2 + 1] << 8);
    }
  }
  return { version, inputs: out };
}

/* ============================================================================
   Replay and verification

   Because the sim is deterministic, a submitted lap can be recomputed from
   its inputs alone. The server trusts the input stream, never the claim.
   ========================================================================= */
export function replay(day, inputs, onTick){
  const sim = createSim(buildTrack(day));
  sim.start();
  for (let i = 0; i < inputs.length; i++){
    const ev = sim.step(inputs[i]);
    if (onTick) onTick(i, sim, ev);
    if (ev.finished) break;
  }
  return {
    finished: sim.state === 'done',
    outcome: sim.state,
    ticks: sim.ticks,
    ms: sim.elapsedMs(),
    hits: sim.hits,
    sectorHits: sim.sectorHits,
    sectorTicks: sim.sectorTicks
  };
}

/**
 * Recompute a claimed lap. Returns { ok, reason, ...result }.
 * Everything a client sends is treated as a claim until this agrees.
 */
export function verifyLap({ day, packed, claimedTicks, claimedHits, maxTicks = 60*60*5 }){
  let parsed;
  try { parsed = unpackInputs(packed); }
  catch (e){
    /* A damaged link and a bogus one deserve different messages: the first is
       usually a chat app truncating a long URL, which the sender can fix. */
    return {
      ok: false,
      corrupt: e && e.name === 'CorruptStreamError',
      reason: (e && e.message) || 'unreadable input stream'
    };
  }

  if (parsed.version !== ACTIVE_VERSION)
    return { ok: false, reason: 'sim version ' + parsed.version + ', expected ' + ACTIVE_VERSION };
  if (parsed.inputs.length > maxTicks)
    return { ok: false, reason: 'too many ticks' };

  const r = replay(day, parsed.inputs);
  if (!r.finished) return { ok: false, reason: 'lap never crossed the line', ...r };
  if (claimedTicks !== undefined && claimedTicks !== r.ticks)
    return { ok: false, reason: 'time mismatch: claimed ' + claimedTicks + ', replayed ' + r.ticks, ...r };
  if (claimedHits !== undefined && claimedHits !== r.hits)
    return { ok: false, reason: 'contact mismatch: claimed ' + claimedHits + ', replayed ' + r.hits, ...r };

  return { ok: true, ...r };
}

/* Two different day counts, on purpose.

   dayNumber() seeds the track. It counts from a fixed epoch and must never
   change, or every past circuit changes with it.

   puzzleNumber() is the number players see. It counts from launch, so the
   first live circuit is Day 1 and everything before it reads Day 0. Tracks
   still rotate daily before launch — only the label is held at zero. */
export const EPOCH  = Date.UTC(2026, 0, 1);

/** The day the game goes live. Everything before it reads as a preview, and
 *  the first public circuit is Day 1. Months are zero-indexed, so 8 = September.
 *
 *  CHANGE THIS ONE LINE to move launch. Nothing else depends on it — the
 *  tracks themselves are seeded from EPOCH, so moving the launch date changes
 *  the labels but never the circuits. */
export const LAUNCH = Date.UTC(2026, 7, 24);  // 24 August 2026

const dayOf = now => Math.floor(
  (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - EPOCH) / 86400000);

export function dayNumber(now = new Date()){
  return dayOf(now);
}

export function puzzleNumber(now = new Date()){
  const launchDay = Math.floor((LAUNCH - EPOCH) / 86400000);
  return Math.max(0, dayOf(now) - launchDay + 1);
}
