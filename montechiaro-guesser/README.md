# Montechiaro Guesser

A GeoGuessr-style game for one small piece of the Sorrento peninsula: the hill
hamlet of Montechiaro, the town of Vico Equense below it, and everything you
would need to find in a week there — the stations, the bus stops, somewhere to
eat, somewhere to buy food, and every way down to the water.

It is not a tourist guide. The point is to leave you able to picture the place:
which way the coast runs, which side of the hill you are on, and what it costs
in metres and altitude to get from one to the other.

## Running it

    npm run dev        # from the repo root
    open http://localhost:8000/montechiaro-guesser/

It also opens straight from disk (`file://`) — Leaflet comes from a CDN and the
map tiles come from the network, so it needs an internet connection either way.

## The four modes

**Drop the pin** — you are told what the place is; you click where you think it
stands. The guessing map is unlabelled satellite imagery, so you have to read
the coastline and the ravines rather than the street names. Scoring is
distance-based: 5,000 points inside 40 m, halving roughly every 350 m after
that, near zero once you are in the wrong village.

**Name that spot** — a pin lands on the imagery; work out what it is from the
ground around it.

**Getting around** — no map, just the practical stuff: which bus, which station,
which beach you can actually walk to, and where the boat to Capri leaves from.

**Full tour** — six pins, three spots to name, three route questions. The one to
play the night before you fly.

## About the coordinates

The dataset was assembled from published addresses and coordinates without
access to a mapping API, so some positions are estimates and are labelled
`approx` in the game. Estimates are good enough to learn the shape of the area
and not good enough to navigate by.

**Fix them once, on wifi, before you rely on any of it:** Study the map →
*Sync with OpenStreetMap*. That geocodes every entry through Nominatim from
your browser, one request a second, and stores the real positions in
`localStorage`. Anything it places more than 15 km from Vico Equense is
rejected as a bad match and the seeded position is kept.

If the sync cannot find something, *Drag to correct* lets you move any pin by
hand, and *Export corrections* prints the JSON to paste into `places.js` if you
want the fix to be permanent rather than per-device.

## Adding places

Everything lives in `places.js`. One entry per pin:

```js
{
  id: 'unique-slug',
  name: 'What it is called',
  cat: 'beach',                 // hotel|train|bus|food|shop|beach|town|sight
  lat: 40.6595, lon: 14.4150,
  src: 'est',                   // 'cited' if the coordinate is published
  addr: 'street address',
  q:    'geocoder query used by the OpenStreetMap sync',
  clue: 'what the player is told in Drop the pin — no name giveaways',
  tip:  'the one practical thing worth remembering'
}
```

Route questions go in the `quiz` array in the same file; option `[0]` is always
the correct answer and the game shuffles them.

Deliberately absent: opening hours and timetables. They go stale, and a game
that teaches you a stale timetable is worse than one that teaches you none.

## Where the facts came from

Addresses, bus lines and the practical notes come from published sources:
the [EAV](https://www.eavsrl.it/) line 009 "Circolari Vico Equense" timetable
(Montechiaro ↔ Vico Equense station via Seiano, Ticciano, Moiano, Massaquano),
the Michelin Guide and the restaurants' own sites for
[Torre del Saracino](https://torredelsaracino.it/en/) (Via Torretta 9, Marina di
Equa), [Antica Osteria Nonna Rosa](https://guide.michelin.com/us/en/campania/vico-equense/restaurant/antica-osteria-nonna-rosa)
(Via Laudano 1, Pietrapiano) and [Pizza a Metro da Gigino](https://www.pizzametro.it/en/)
(Via Nicotera 15), the comune's tourism site
[goVicoEquense](https://www.vicotourism.it/en/point-of-interest/marine/) for the
marine, [Scrajo Mare](https://www.scrajomare.it/spiaggia/) for the thermal
beach, and Wikipedia/Wikidata for the Circumvesuviana stations.

Map tiles: unlabelled imagery from Esri World Imagery, street map from
OpenStreetMap. Geocoding from Nominatim, throttled to one request a second in
line with its usage policy.
