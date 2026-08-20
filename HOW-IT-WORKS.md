# How Ink Circuit works

Two systems, both in `sim.js`. Track generation runs once a day; the physics
runs sixty times a second. Everything here is deterministic — same day, same
circuit, everywhere; same inputs, same lap, on any machine.

---

## Part one: making a circuit

The problem is not "draw a closed loop". It is "draw a closed loop that is
**driveable**, **interesting**, and **fits on the page**" — and to do it from a
single number, the day, with no human looking at the result.

The approach is **generate and test**. Make a candidate, measure it against
eight rules, throw it away if it fails any of them, try again. Most candidates
fail. It takes about **44 milliseconds** to find a good one, then the result is
cached for the rest of the day.

### Getting a shape

**Start with random scatter.** Sixteen points dropped inside the page, using a
seeded random number generator so the same day always gives the same points.

**Take the convex hull.** The hull is the shape a rubber band would make around
those points — it discards the interior ones and leaves an outline. This
guarantees the loop never crosses itself, which is the single most important
property and the hardest to fix after the fact. Everything that follows only
nudges points; it never reorders them, so the loop stays simple forever.

**Push the points apart.** A hull can leave two corners almost on top of each
other. A relaxation pass repels any pair closer than about two and a half track
widths.

**Add corners.** A hull is convex — all its turns go the same way, which makes
a rounded blob, not a circuit. So the midpoint of every long edge is pushed
sideways by a random amount. Pushing *inward* creates the concave turns that
make a track feel like a track. This is the step that turns a blob into a
layout.

**Open up the sharp angles.** Any corner tighter than about 94 degrees gets its
neighbours rotated away until it opens up. This runs up to 140 times; if it
still can't fix everything, the candidate is discarded.

**Smooth it.** The points so far are a polygon. Running a *centripetal*
Catmull-Rom spline through them produces a curve that passes through every
point without overshooting between them. Then it is resampled to **360 evenly
spaced points** — even spacing matters because a lot of later code assumes one
sample is the same distance as any other.

### The eight rules

A candidate has to pass all of these:

| test | why |
|---|---|
| at least 6 hull points | fewer isn't a shape |
| angles could be fixed | otherwise there are unfixable hairpins |
| 7 to 14 corners | fewer is boring, more is noise |
| no corner tighter than the track is wide | otherwise the inside edge folds through itself |
| separate parts stay 132+ units apart | otherwise two bits of track visually merge |
| stays clear of the page edge | so it can be drawn with a margin |
| total length 1700–2900 units | a consistent lap of roughly 7 seconds |
| at least 22% straight | somewhere to actually accelerate |

The fold test is the subtle one. If a corner's radius is smaller than the track
is wide, the inner edge turns inside out — the drawn line crosses itself and
the track becomes undriveable at that point. Rather than discard those
candidates outright, a repair pass called `relaxCorners` eases **only** the
offending corners toward the average of their neighbours, leaving straights
untouched. If that fixes it, the candidate survives; if not, it's discarded.

The straightness test is what stops every track being a wiggly mess. It counts
samples where the direction of travel barely changes over the next few samples,
and demands at least a fifth of the lap qualify.

### Finally

The loop is rotated so the start line sits on a straight — nobody wants to
launch into a corner — and the result is bundled with everything downstream
needs: the path, the direction of travel at each point, the perpendicular at
each point, total length, and where the sector gates fall.

**The one-line summary:** *random points → rubber band → push the edges around
→ smooth → check it against eight rules → try again if it fails.*

---

## Part two: driving the car

The physics is deliberately small. There is no engine model, no tyre model, no
suspension. There is one idea, and everything else follows from it.

### The one idea: heading and velocity are separate

Most naive driving code stores a direction and a speed, and moves the car in
the direction it points. That car is on rails — it can never slide.

Here the car has:

- a **heading** — the way the nose points
- a **velocity** — the way it is actually moving

Steering rotates the heading. It does **not** rotate the velocity. If you turn
sharply at speed, the nose swings but the car keeps travelling roughly where it
was going, and for a moment it is moving sideways. That gap between where you
point and where you go *is* the drift, and it is the whole feel of the game.

### What one tick does

Sixty times a second, in this order:

**1. Steer.** The heading rotates by the steering input, but scaled by
*authority*, which ramps from zero to full over the first 70 units of speed. A
stationary car cannot turn — you have to be moving first. Reversing flips the
steering, like a real car.

**2. Split the velocity in two.** The velocity vector is decomposed relative to
the heading: how much is going *forward* along the nose, and how much is going
*sideways*. This is the trick that makes everything else simple, because the
two halves are then treated completely differently.

**3. Forward: apply the pedals.** Throttle adds, brake subtracts. With neither
pressed, engine braking scrubs off speed — the car retains 55% of its speed per
second, so 330 units decays to half in about **1.16 seconds**. Forward speed is
clamped to 330 forward and about 99 in reverse.

**4. Sideways: apply grip.** The sideways component is multiplied down hard —
only 2% survives each second, a **half-life of about 177 milliseconds**. This
one number *is* the grip model. Make it smaller and the car is on rails; make
it bigger and it's an air-hockey puck.

**5. Recombine and move.** The two components are reassembled into a velocity
vector and the car moves along it.

**6. Check the walls.**

### What falls out of that

The interesting behaviours were never programmed in — they emerge:

| behaviour | why it happens |
|---|---|
| understeer at speed | turn hard and the sideways velocity can't decay fast enough |
| tighter turns when slow | less momentum to fight |
| you can't turn while stopped | steering authority is zero below 70 units/s |
| gentle inputs are faster | every slide bleeds forward speed |

Some concrete numbers:

- 0 to top speed: **1.27 s**. Top speed to zero on the brakes: **0.77 s**
- full-lock turning radius: **24 units** at low speed, **114 units** flat out
- steering rate maxes at 166 degrees per second

### Walls

The track is stored as a centreline, so "am I hitting a wall?" is just "am I
further from the centreline than allowed?" — no wall geometry needed.

The allowed distance depends on the car's **angle**. A car pointing along the
track needs less room than one turned broadside, so the reach is computed from
the heading: it varies between 20 units (nose-on) and 13 (square-on). Broadside,
you have 35 units of clearance; square-on, 42. That's why a spin catches the
wall when a straight-line drift wouldn't.

On contact the car is pushed back to the legal distance, and its velocity is
split again — this time into *into the wall* and *along the wall*:

- the **into** part becomes a small bounce (12% of it)
- the **along** part is scraped down, and how much survives depends on how hard
  you hit: a graze keeps 92% of your speed, a solid hit keeps almost nothing

So brushing a wall is survivable and hitting one square-on is very expensive —
without any special cases in the code.

A contact only *counts* if the impact exceeds a threshold, and only once every
0.4 seconds, so scraping along a wall registers as one mistake rather than
twenty-four.

### Why it's identical on every machine

The simulation advances in **fixed steps of exactly 1/60 second**, regardless of
your screen's refresh rate. A fast monitor doesn't get more steps, it gets
smoother interpolation *between* the same steps. Lap time is counted in ticks,
not in seconds measured by a clock.

This is what makes a lap replayable from its inputs alone. Send someone the
sequence of keys you pressed and their machine will reproduce your lap exactly
— which is how ghost cars work, and how a shared lap time can be verified
rather than trusted.

---

## If you only explain two things

**The track:** a rubber band stretched round random points, with the edges
pushed in and out to make corners, thrown away and retried until one passes
eight tests for driveability.

**The car:** the direction it points and the direction it moves are two
different things, and grip is just how fast the difference decays.
