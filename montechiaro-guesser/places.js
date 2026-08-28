/* Montechiaro Guesser — the place data.
 *
 * Everything the game knows about the Vico Equense area lives here. Each entry
 * is one map pin: where it is, what it is, and the one practical thing worth
 * remembering about getting to it.
 *
 * ON THE COORDINATES. `src` says where a position came from:
 *
 *   'cited' — taken from a published coordinate for that exact spot.
 *   'est'   — an estimate placed from addresses and local geography. Good
 *             enough to learn the shape of the area, not good enough to
 *             navigate by. Expect a few hundred metres of error.
 *
 * Rather than leave the estimates standing, the game can fix them itself:
 * "Sync with OpenStreetMap" in Study mode geocodes every entry through
 * Nominatim from your browser, one request a second, and stores the real
 * positions locally. Do that once, on wifi, before you rely on any of it.
 * Anything the sync places more than 15 km from Vico Equense is rejected as a
 * bad match and the seeded position is kept.
 *
 * Addresses, bus lines and the facts in `tip` come from published sources —
 * see README.md for the list. Opening hours and timetables are deliberately
 * absent: they go stale, and a game that teaches you a stale timetable is
 * worse than one that teaches you none.
 */

window.GEO = {

  /* Vico Equense, roughly. Where the map opens. */
  centre: [40.6620, 14.4300],

  /* Anything geocoded outside this radius (km) of `centre` is a bad match. */
  sanityRadiusKm: 15,

  categories: {
    hotel: { label: 'Base',     colour: '#9E3B32', glyph: '⌂' },
    train: { label: 'Train',    colour: '#2F5D8C', glyph: '▬' },
    bus:   { label: 'Bus',      colour: '#3F7A5A', glyph: '▶' },
    food:  { label: 'Eat',      colour: '#8A5A2B', glyph: '◆' },
    shop:  { label: 'Shop',     colour: '#6B4C8A', glyph: '●' },
    beach: { label: 'Sea',      colour: '#1E7A8C', glyph: '≈' },
    town:  { label: 'Village',  colour: '#5C5A52', glyph: '▲' },
    sight: { label: 'Landmark', colour: '#B07A1E', glyph: '★' }
  },

  places: [

    /* ---- base ---------------------------------------------------------- */
    {
      id: 'maison-montechiaro',
      name: 'Maison Montechiaro',
      cat: 'hotel',
      lat: 40.6555, lon: 14.4332, src: 'est',
      addr: 'Via Cappella del Monte 17, Montechiaro, 80069 Vico Equense',
      q: 'Maison Montechiaro, Via Cappella del Monte, Vico Equense, Italia',
      clue: 'Your bed. A guesthouse up in the Montechiaro hamlet, on Via Cappella del Monte.',
      tip: 'Montechiaro sits at roughly 240 m above sea level, up the hill behind the town. Everything at sea level is a descent on the way out and a climb on the way back — which is what the EAV 009 circolare is for.'
    },

    /* ---- trains -------------------------------------------------------- */
    {
      id: 'stz-vico',
      name: 'Vico Equense station (Circumvesuviana)',
      cat: 'train',
      lat: 40.6629, lon: 14.4298, src: 'cited',
      addr: 'Corso Filangieri, 80069 Vico Equense',
      q: 'Stazione di Vico Equense, Corso Filangieri, Vico Equense, Italia',
      clue: 'The station for the town centre, on the Naples–Sorrento Circumvesuviana line. It sits right on the main street.',
      tip: 'This is your hub: the 009 bus from the hamlets terminates here, and the town centre is a short walk along Corso Filangieri. Trains run north to Castellammare and Naples, south to Seiano, Meta and Sorrento.'
    },
    {
      id: 'stz-seiano',
      name: 'Seiano station',
      cat: 'train',
      lat: 40.6560, lon: 14.4268, src: 'cited',
      addr: 'Seiano, 80069 Vico Equense',
      q: 'Stazione di Seiano, Vico Equense, Italia',
      clue: 'The next station south of Vico Equense on the line to Sorrento — the one named after the hamlet above the marina.',
      tip: 'Adjacent to Vico Equense on the Sorrento side. Easy to get off here by mistake; the town centre is at the other station. From Seiano an EAV bus runs down to the marina.'
    },
    {
      id: 'stz-meta',
      name: 'Meta di Sorrento station',
      cat: 'train',
      lat: 40.6415, lon: 14.4180, src: 'est',
      addr: 'Meta, 80062 (NA)',
      q: 'Stazione di Meta, Meta, Napoli, Italia',
      clue: 'Two stops south of Vico Equense, in the next town along, where the road to the Amalfi coast peels off.',
      tip: 'The junction town for the far side of the peninsula: SITA Sud coast buses pass through Meta on the Sorrento–Positano–Amalfi run.'
    },
    {
      id: 'stz-sorrento',
      name: 'Sorrento station',
      cat: 'train',
      lat: 40.6262, lon: 14.3757, src: 'est',
      addr: 'Piazza Giovanni Battista De Curtis, 80067 Sorrento',
      q: 'Stazione di Sorrento, Sorrento, Italia',
      clue: 'The end of the Circumvesuviana line, about 11 km down the coast from Vico Equense.',
      tip: 'Terminus of the line and the hub for everything else: SITA Sud buses to Positano and Amalfi leave from the forecourt, and the ferries to Capri go from Marina Piccola below the town.'
    },
    {
      id: 'stz-castellammare',
      name: 'Castellammare di Stabia station',
      cat: 'train',
      lat: 40.6985, lon: 14.4795, src: 'est',
      addr: 'Castellammare di Stabia (NA)',
      q: 'Stazione Circumvesuviana Castellammare di Stabia, Italia',
      clue: 'The big town up the coast to the north-east, the last sizeable stop before the line turns towards Naples.',
      tip: 'The direction of travel for Pompeii, Herculaneum and Naples. Also where the Monte Faito cable car starts.'
    },

    /* ---- buses --------------------------------------------------------- */
    {
      id: 'bus-montechiaro',
      name: 'Montechiaro — capolinea (bus 009)',
      cat: 'bus',
      lat: 40.6553, lon: 14.4338, src: 'est',
      addr: 'Montechiaro, Vico Equense',
      q: 'Montechiaro, Vico Equense, Italia',
      clue: 'The end of the line for the EAV circolare that serves the hill hamlets — the stop nearest your bed.',
      tip: 'Line 009 "Circolari Vico Equense" runs Montechiaro ↔ Vico Equense station via the hamlets. Learn its shape: it is the difference between a ten-minute ride and a long walk uphill.'
    },
    {
      id: 'bus-vico-stazione',
      name: 'Vico Equense — Staz. Circum. (bus stop)',
      cat: 'bus',
      lat: 40.6631, lon: 14.4302, src: 'est',
      addr: 'Corso Filangieri, Vico Equense',
      q: 'Corso Filangieri, Vico Equense, Italia',
      clue: 'Where the hamlet buses meet the trains, outside the town’s railway station.',
      tip: 'The 009 terminates here, which makes it the interchange for everything: train one way, bus up the hill the other.'
    },
    {
      id: 'bus-massaquano',
      name: 'Massaquano (bus stop)',
      cat: 'bus',
      lat: 40.6578, lon: 14.4392, src: 'est',
      addr: 'Massaquano, Vico Equense',
      q: 'Massaquano, Vico Equense, Italia',
      clue: 'A hamlet stop on the 009 circular, inland and uphill from the town.',
      tip: 'One of the beads on the 009 string: Vico station – Seiano – Ticciano – Moiano – Massaquano – Montechiaro. Knowing the order tells you which way round to catch it.'
    },
    {
      id: 'bus-moiano',
      name: 'Moiano (bus stop)',
      cat: 'bus',
      lat: 40.6520, lon: 14.4462, src: 'est',
      addr: 'Moiano, Vico Equense',
      q: 'Moiano, Vico Equense, Italia',
      clue: 'The furthest of the hill hamlets served by the circular bus, out towards the mountain paths.',
      tip: 'The jumping-off point for the walk up to Santa Maria del Castello and the high paths over to Positano.'
    },
    {
      id: 'bus-ticciano',
      name: 'Ticciano (bus stop)',
      cat: 'bus',
      lat: 40.6498, lon: 14.4405, src: 'est',
      addr: 'Ticciano, Vico Equense',
      q: 'Ticciano, Vico Equense, Italia',
      clue: 'A small hill hamlet on the circular bus route, between Seiano and Moiano.',
      tip: 'On the 009 loop. Useful mostly as a landmark for working out which direction the bus is travelling.'
    },
    {
      id: 'bus-marina-equa',
      name: 'Marina di Equa (bus stop)',
      cat: 'bus',
      lat: 40.6598, lon: 14.4155, src: 'est',
      addr: 'Marina d’Aequa, Vico Equense',
      q: 'Marina di Equa, Vico Equense, Italia',
      clue: 'The stop at the bottom of the hairpins, where the bus reaches the harbour and the sea.',
      tip: 'An EAV bus connects the marina with the town centre. Walking down is fine; walking back up in August is not.'
    },

    /* ---- eating -------------------------------------------------------- */
    {
      id: 'gigino',
      name: 'Pizza a Metro da Gigino',
      cat: 'food',
      lat: 40.6635, lon: 14.4285, src: 'est',
      addr: 'Via Giovanni Nicotera 15, Vico Equense',
      q: 'Pizza a Metro da Gigino, Via Nicotera, Vico Equense, Italia',
      clue: 'The cavernous institution in the town centre where pizza by the metre was invented in the 1930s.',
      tip: 'Via Nicotera 15, a couple of minutes from the station. You order by length, not by the pizza — half a metre feeds three.'
    },
    {
      id: 'torre-saracino',
      name: 'Torre del Saracino',
      cat: 'food',
      lat: 40.6600, lon: 14.4138, src: 'est',
      addr: 'Via Torretta 9, Marina di Equa, Vico Equense',
      q: 'Torre del Saracino, Via Torretta, Vico Equense, Italia',
      clue: 'Gennaro Esposito’s two-star restaurant, in an old watchtower a few metres from the water at the marina.',
      tip: 'Down the hairpins from the coast road to Marina di Equa. Book well ahead, and plan how you are getting back up.'
    },
    {
      id: 'nonna-rosa',
      name: 'Antica Osteria Nonna Rosa',
      cat: 'food',
      lat: 40.6595, lon: 14.4352, src: 'est',
      addr: 'Via Laudano 1, frazione Pietrapiano, Vico Equense',
      q: 'Antica Osteria Nonna Rosa, Via Laudano, Vico Equense, Italia',
      clue: 'Peppe Guida’s Michelin-starred osteria, tucked into a hill hamlet rather than on the seafront.',
      tip: 'In Pietrapiano, up the hill and not far from Montechiaro — one of the few good reasons to be glad you are staying inland.'
    },

    /* ---- shopping ------------------------------------------------------ */
    {
      id: 'conad',
      name: 'Conad, Via Raffaele Bosco',
      cat: 'shop',
      lat: 40.6641, lon: 14.4332, src: 'est',
      addr: 'Via Raffaele Bosco 51/53, Vico Equense',
      q: 'Conad, Via Raffaele Bosco, Vico Equense, Italia',
      clue: 'A full supermarket on the road that climbs east out of town towards the hamlets.',
      tip: 'Via Raffaele Bosco is the road between the town and the hill villages, so this is the shop you pass on the way home. The one to use for a real weekly shop.'
    },
    {
      id: 'deco',
      name: 'Supermercato Decò',
      cat: 'shop',
      lat: 40.6624, lon: 14.4304, src: 'est',
      addr: 'Vico Equense (centro)',
      q: 'Supermercato Deco, Vico Equense, Italia',
      clue: 'A supermarket in the town centre, within walking distance of the station.',
      tip: 'Central and handy for topping up on the way through town, rather than a destination in itself.'
    },
    {
      id: 'alimentari-seiano',
      name: 'Alimentari / minimarket, Seiano',
      cat: 'shop',
      lat: 40.6578, lon: 14.4212, src: 'est',
      addr: 'Seiano, Vico Equense',
      q: 'Seiano, Vico Equense, Italia',
      clue: 'Small local grocery in the hamlet above the marina — bread, water and beach supplies.',
      tip: 'Buy water before you go down to the beach, not at the beach.'
    },

    /* ---- the sea ------------------------------------------------------- */
    {
      id: 'marina-aequa',
      name: 'Marina d’Aequa (Marina di Seiano)',
      cat: 'beach',
      lat: 40.6595, lon: 14.4150, src: 'cited',
      addr: 'Marina d’Aequa, Vico Equense',
      q: 'Marina di Equa, Vico Equense, Italia',
      clue: 'The old fishing village and the only tourist harbour in the comune, with sand-and-pebble beach either side of the port.',
      tip: 'Beaches sit to the right and left of the port, which is sheltered by an artificial breakwater. From April to October boats run from here to Capri. An EAV bus links it to the town centre.'
    },
    {
      id: 'marina-vico',
      name: 'Marina di Vico (Le Postali)',
      cat: 'beach',
      lat: 40.6682, lon: 14.4288, src: 'est',
      addr: 'Marina di Vico, Vico Equense',
      q: 'Marina di Vico, Vico Equense, Italia',
      clue: 'The town’s own beach, dark volcanic sand and pebbles, a few minutes down a scenic descent from the historic centre.',
      tip: 'The most accessible beach: on foot from the centre or by local bus. Lidos, showers and places to eat on the sand — the default when you cannot be bothered to travel.'
    },
    {
      id: 'scrajo',
      name: 'Scrajo Mare',
      cat: 'beach',
      lat: 40.6742, lon: 14.4372, src: 'est',
      addr: 'SS145 Sorrentina 9, Vico Equense',
      q: 'Scrajo Terme, Vico Equense, Italia',
      clue: 'A historic lido on the coast road towards Castellammare, famous for the sulphurous springs that surface at the sea’s edge.',
      tip: 'On the SS145 at km marker 9. Parking is very limited — the advice locally is to come by train and use the shuttle rather than drive.'
    },
    {
      id: 'tartaruga',
      name: 'Spiaggia della Tartaruga',
      cat: 'beach',
      lat: 40.6710, lon: 14.4330, src: 'est',
      addr: 'Costa di Vico Equense',
      q: 'Spiaggia della Tartaruga, Vico Equense, Italia',
      clue: 'A small cove named after a turtle-shaped rock, with no road to it at all.',
      tip: 'Reachable only by a short boat ride from the main marina — in summer the taxi boats run out to it. Do not plan to walk here.'
    },
    {
      id: 'tordigliano',
      name: 'Spiaggia di Tordigliano',
      cat: 'beach',
      lat: 40.6285, lon: 14.4620, src: 'est',
      addr: 'Tordigliano, Vico Equense',
      q: 'Spiaggia di Tordigliano, Vico Equense, Italia',
      clue: 'The wild, undeveloped bay on the far side of the peninsula, on the way round towards Positano.',
      tip: 'No facilities, no road to the sand: you park on the coast road above and walk down a steep path, then walk back up. Take water and shoes.'
    },
    {
      id: 'regina-giovanna',
      name: 'Bagni della Regina Giovanna',
      cat: 'beach',
      lat: 40.6320, lon: 14.3600, src: 'est',
      addr: 'Capo di Sorrento',
      q: 'Bagni della Regina Giovanna, Sorrento, Italia',
      clue: 'A natural rock pool inside a collapsed sea arch, on the headland beyond Sorrento, reached over a Roman villa site.',
      tip: 'Train to Sorrento (or the Capo bus), then a walk of about fifteen minutes over the headland. Rocks, not sand.'
    },
    {
      id: 'punta-scutolo',
      name: 'Punta Scutolo',
      cat: 'sight',
      lat: 40.6470, lon: 14.4085, src: 'est',
      addr: 'tra Vico Equense e Meta',
      q: 'Punta Scutolo, Vico Equense, Italia',
      clue: 'The headland between Vico Equense and Meta — the corner the coast road bends around, with the view back over the gulf.',
      tip: 'The obvious landmark for orienting yourself along this stretch of coast: everything north of it faces Naples and Vesuvius, everything south of it faces Sorrento.'
    },

    /* ---- villages and landmarks ---------------------------------------- */
    {
      id: 'centro-vico',
      name: 'Vico Equense centro (Piazza Umberto I)',
      cat: 'town',
      lat: 40.6640, lon: 14.4272, src: 'est',
      addr: 'Piazza Umberto I, Vico Equense',
      q: 'Piazza Umberto I, Vico Equense, Italia',
      clue: 'The main square of the town, off Corso Filangieri, with the bars, the tabaccheria and the evening passeggiata.',
      tip: 'Your reference point at sea level: station, shops and buses are all within a few minutes of here.'
    },
    {
      id: 'cattedrale',
      name: 'Chiesa della SS. Annunziata',
      cat: 'sight',
      lat: 40.6660, lon: 14.4248, src: 'est',
      addr: 'Via Vescovado, Vico Equense',
      q: 'Chiesa della Santissima Annunziata, Vico Equense, Italia',
      clue: 'The old cathedral on the tufa spur, standing right on the cliff edge above the sea — the picture of Vico Equense you have already seen.',
      tip: 'The single most recognisable silhouette in the town, and therefore the easiest thing to navigate by from the water or the coast road.'
    },
    {
      id: 'seiano',
      name: 'Seiano (village)',
      cat: 'town',
      lat: 40.6578, lon: 14.4205, src: 'est',
      addr: 'Seiano, Vico Equense',
      q: 'Seiano, Vico Equense, Italia',
      clue: 'The hamlet on the shoulder above the harbour, between the station of the same name and the water.',
      tip: 'Sits between its station and its marina, and connected to both. The bridge over the Seiano valley here is the way the main road gets past the ravine.'
    },
    {
      id: 'pietrapiano',
      name: 'Pietrapiano',
      cat: 'town',
      lat: 40.6598, lon: 14.4348, src: 'est',
      addr: 'Pietrapiano, Vico Equense',
      q: 'Pietrapiano, Vico Equense, Italia',
      clue: 'A hill hamlet east of the town, best known outside the area for the osteria in it.',
      tip: 'Close to Montechiaro — worth knowing as a walkable neighbour rather than a bus journey.'
    },
    {
      id: 'montechiaro',
      name: 'Montechiaro (frazione)',
      cat: 'town',
      lat: 40.6552, lon: 14.4330, src: 'est',
      addr: 'Montechiaro, Vico Equense',
      q: 'Montechiaro, Vico Equense, Italia',
      clue: 'Your hamlet: terraced olive groves at around 240 m, above the town and below the ridge.',
      tip: 'Known locally for its extra virgin olive oil and the "uve di Sabato" grapes. The 009 bus terminates here.'
    },
    {
      id: 'faito',
      name: 'Monte Faito',
      cat: 'sight',
      lat: 40.6800, lon: 14.4680, src: 'est',
      addr: 'Monte Faito, Vico Equense / Castellammare',
      q: 'Monte Faito, Italia',
      clue: 'The beech-covered mountain behind the whole area, over 1000 m, with a cable car from the coast on the Castellammare side.',
      tip: 'The high ground on every horizon inland. Part of it — Villaggio Monte Faito — is administratively Vico Equense, and the paths down from it lead to the hamlets.'
    },
    {
      id: 'ponte-seiano',
      name: 'Ponte di Seiano (the viaduct)',
      cat: 'sight',
      lat: 40.6600, lon: 14.4185, src: 'est',
      addr: 'SS145, Seiano, Vico Equense',
      q: 'Ponte di Seiano, Vico Equense, Italia',
      clue: 'The tall arched viaduct that carries the coast road over the ravine west of the town.',
      tip: 'The landmark that marks the Seiano side of Vico Equense. Below it, the valley runs down to Marina d’Aequa.'
    }
  ],

  /* Multiple-choice questions about actually getting around. Index 0 of
   * `options` is always the right answer; the game shuffles them. */
  quiz: [
    {
      q: 'You are at Maison Montechiaro with no car. Which bus line loops the Vico Equense hamlets and finishes at the Circumvesuviana station?',
      options: ['EAV line 009, the "Circolari Vico Equense"', 'SITA Sud line 5070', 'EAV line 5070 from Sorrento', 'The Alibus airport shuttle'],
      why: 'Line 009 is the local circular: Montechiaro is one of its termini and Vico Equense station is the other.'
    },
    {
      q: 'Which railway serves Vico Equense?',
      options: ['The Circumvesuviana (EAV), Naples–Sorrento line', 'Trenitalia regional to Salerno', 'The Circumflegrea', 'The Naples metro line 2'],
      why: 'Vico Equense is on the Circumvesuviana between Castellammare and Sorrento. It is a narrow-gauge commuter line, not a Trenitalia one — different tickets, different platforms in Naples.'
    },
    {
      q: 'Arriving from Naples, which station do you get off at for the Vico Equense town centre?',
      options: ['Vico Equense, on Corso Filangieri', 'Seiano', 'Meta', 'Castellammare di Stabia'],
      why: 'Seiano is the next stop south and serves the hamlet above the marina, not the town centre. Getting off there is the classic mistake.'
    },
    {
      q: 'Heading south towards Sorrento, which station comes immediately after Vico Equense?',
      options: ['Seiano', 'Meta', 'Piano di Sorrento', 'Scrajo'],
      why: 'The order southbound is Vico Equense – Seiano – Meta – Piano – Sant’Agnello – Sorrento.'
    },
    {
      q: 'In summer, where do you catch a boat to Capri without going to Sorrento?',
      options: ['The port at Marina d’Aequa (Marina di Seiano)', 'Marina di Vico', 'Scrajo', 'Punta Scutolo'],
      why: 'Marina d’Aequa is the only tourist port in the comune, and from April to October it has sea connections to Capri.'
    },
    {
      q: 'Which beach is the town’s own, a few minutes’ walk down from the historic centre?',
      options: ['Marina di Vico, also called Le Postali', 'Tordigliano', 'Bagni della Regina Giovanna', 'Spiaggia della Tartaruga'],
      why: 'Marina di Vico is the most central and most accessible — dark sand and pebbles, reached on foot or by local bus.'
    },
    {
      q: 'Which beach has sulphurous springs surfacing at the water’s edge?',
      options: ['Scrajo', 'Marina di Vico', 'Tordigliano', 'Marina d’Aequa'],
      why: 'Scrajo Mare, on the SS145 towards Castellammare, grew up around the thermal springs — hence the old Scrajo Terme.'
    },
    {
      q: 'Which of these can only be reached by boat?',
      options: ['Spiaggia della Tartaruga', 'Scrajo', 'Marina d’Aequa', 'Marina di Vico'],
      why: 'The Tartaruga cove has no land access; taxi boats run out to it from the main marina in summer.'
    },
    {
      q: 'Where is Gennaro Esposito’s Torre del Saracino?',
      options: ['At Marina di Equa, Via Torretta 9', 'In Piazza Umberto I', 'At Montechiaro', 'On Monte Faito'],
      why: 'It is down the hairpins from the coast road, in an old fortified tower a few metres from the sea.'
    },
    {
      q: 'Pizza by the metre was invented at which Vico Equense address?',
      options: ['Da Gigino, Via Nicotera 15', 'Nonna Rosa, Via Laudano 1', 'Torre del Saracino, Via Torretta 9', 'Scrajo Mare, SS145 km 9'],
      why: 'Gigino Dell’Amura started selling pizza by the metre here in the 1930s; the place still bills itself as the university of pizza.'
    },
    {
      q: 'Peppe Guida’s Antica Osteria Nonna Rosa is in which hamlet?',
      options: ['Pietrapiano', 'Seiano', 'Moiano', 'Massaquano'],
      why: 'Via Laudano 1, frazione Pietrapiano — up the hill, near your side of the comune rather than on the seafront.'
    },
    {
      q: 'You want to get to Positano and Amalfi by bus. What do you do?',
      options: ['Train to Sorrento, then a SITA Sud coast bus', 'Take EAV 009 all the way round', 'Take the Circumvesuviana to Amalfi', 'Walk over Monte Faito'],
      why: 'There is no railway along the Amalfi coast. SITA Sud runs the Sorrento–Positano–Amalfi service; the buses also call at Meta.'
    },
    {
      q: 'Roughly how high is Montechiaro above the sea?',
      options: ['About 240 m', 'About 20 m', 'About 700 m', 'About 1100 m'],
      why: 'About 240 m — high enough that the walk back up from the coast is a serious climb, and low enough that Monte Faito still towers over you.'
    },
    {
      q: 'Where does the road to Tordigliano beach leave you?',
      options: ['On the coast road above the bay, with a steep path down and back up', 'In a car park on the sand', 'At a bus stop beside the beach bar', 'At a boat jetty'],
      why: 'Tordigliano is undeveloped: no facilities and no vehicle access to the beach. Take water and proper shoes.'
    },
    {
      q: 'Which road do you take out of the town centre to reach the hill hamlets — and pass a Conad on the way?',
      options: ['Via Raffaele Bosco', 'Corso Filangieri', 'Via Nicotera', 'SS145 towards Meta'],
      why: 'Via Raffaele Bosco climbs inland from the town; the Conad at 51/53 is on it, which makes it the natural stop on the way home.'
    }
  ]
};
