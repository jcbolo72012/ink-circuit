# Ink Circuit

A daily one-shot driving game. One procedurally generated circuit a day, one
attempt, a shareable result.

    npm run dev     serve locally on :8000
    npm run build   regenerate standalone.html from index.html + the modules
    npm test        conformance suite, then a build, then the boot smoke test
    npm run test:sim   conformance only
    npm run test:boot  build + smoke only
    npm run cvd     colour-vision and text-contrast audit

## Layout

    index.html      the page: rendering, input, UI
    sim.js          the deterministic simulation — single source of truth
    audio.js        engine and effects synthesis
    audio-sample.js sample data behind the engine sound
    board.html      the leaderboard page
    standalone.html build output; open from file://. Never edit by hand.
    api/            serverless endpoints (lap verification, error reporting)
    circuits/       traced real-circuit control points
    icons/          favicons and the web manifest
    tools/          the colour audit
    test/           conformance suite and the boot smoke test
    experiments/    parked prototypes, not part of the site

`sim.js` is the canonical simulation. Bump `SIM_VERSION_DISCRETE` whenever a
change alters the outcome of a lap, or stored laps and shared ghosts will be
silently mis-timed against the new physics.

`build.mjs` inlines `sim.js`, `audio-sample.js` and `audio.js` into the page in
that order — dependency order, not import order. A new module has to be added
to the `MODULES` list there or the standalone build will not contain it.

## Documentation

`HOW-IT-WORKS.md` explains the two systems in `sim.js`: how a circuit is
generated and tested against eight rules, and what one tick of the physics
does. `CONSENT.md` covers what is stored and what is sent.
