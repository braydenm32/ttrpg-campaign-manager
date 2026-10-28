import type { ExPage } from '../types'

/**
 * Places: the continent, its nations and far towns, and the starting region in depth
 * (the Ashenreach, Cinderford and its quarters, the Glass Barrow). Nested with `parent`.
 */
export const PLACES: ExPage[] = [
  // ───────────────────────────── The continent and the nations ─────────────────────────────
  {
    key: 'vael-ardith',
    type: 'location',
    name: 'Vael Ardith',
    players: true,
    summary: 'The continent: 1,800 miles of river, forest, mountain and ash, pinned shut by nine Great Wards.',
    fields: [
      { key: 'Size', value: 'about 1,800 miles north to south, 2,300 east to west' },
      { key: 'Seas', value: 'the Hollow Sea (west), the Glass Sea (east), the Grey Reach (north), the Southern Deep (south)' },
      { key: 'Year', value: '3011 AW (After the Warding)' },
    ],
    tags: ['continent'],
    body: `Vael Ardith is a wide, old land with a river down its middle and a corpse underneath it.

The great river **Ardis** runs from the northern mountains to the southern bays, and most of the people who matter live along it: [[The Regency of Ardith]] in the heartland, [[The Sevenhaven Concord]] on the seven bays where it meets the sea. West of the river the land falls through farm and fen to the elven forest of [[Sael]] and the Hollow Sea. East it climbs to the Saint's Spine and the plateau of [[Iskaveth]]. North are the Grimmark mountains and the stubborn clans of [[The Grimmark Holds]]. South-east of the river, where the war ended, is [[The Ashenreach]], and nobody lives there who has a choice.

### The Wards
Everyone knows the story, and nobody agrees on the details. In the year the count began, the Nine killed a god and buried it, and poured themselves into nine Great Wards to hold the grave shut. The Nine are stone now; their descendants, [[The Lithic]], are following them. Where a ward stands the land is quiet. Where one is weak, strange things are born and the dead are slow to leave. See [[The Nine Great Wards]].

Magic works everywhere, and everywhere it costs something. Scholars say the cost falls on the nearest ward. Soldiers say the cost falls on whoever is standing closest. Both are right.

### Thirty years of bad luck
In 2981 AW the Iron Guard killed [[Aurel IX]] and the empire came apart in twenty years of succession war. [[The Battle of Cinders]] ended it, in 3002, by burning the ground nobody could afford to fight over any more. A red moon rose that night and has not set since. Nine years on, the continent is run by a council that was meant to be temporary, banks that are not, and mercenary companies that nobody has paid.

### Beyond the shore
Across the Hollow Sea to the south-west lies drowned [[Qal Merrow]]; across the Glass Sea to the east lies [[Ostrakai]], where the gods are said to be dead. From the middle of Sael's west coast a great mountainous wedge of land, [[The Ness of Thurm]], runs out westward like an arrowhead and all but splits the Hollow Sea in two; the charts stop at its point.

:::gm
The buried god is Ysmereth, [[The Sleeper Below]]. The wards are failing, slowly. Every spell cast weakens the nearest one a little; every Lithic who goes to stand at a ward buys back a little. The Ninth Ward cracked at Cinders and the Ninth Lantern's flame is part of what holds the crack shut. None of this is written down anywhere the players can read.
:::`,
  },
  {
    key: 'regency',
    type: 'location',
    name: 'The Regency of Ardith',
    players: true,
    parent: 'vael-ardith',
    summary: 'The old imperial heartland on the Ardis, ruled for thirty years by a council "until an heir is found".',
    fields: [
      { key: 'Power', value: 'Great' },
      { key: 'Seat', value: 'Caer Ardith' },
      { key: 'Ruler', value: 'Regent-Chancellor Marius Vell, for the Regency Council' },
      { key: 'Population', value: 'perhaps four million, most of them along the river' },
      { key: 'Notable for', value: 'forms in triplicate, the Quiet Office, an empty throne' },
    ],
    tags: ['nation'],
    body: `The Regency is what the empire became when it stopped having an emperor and did not notice for a while.

### The land
Rich river country: the Ardis valley from the Grimmark foothills down to the bays, wheat and vines on the terraces, old imperial roads that are still the best roads on the continent, bridges with the sun of [[Aurelan]] cut into every keystone. The capital, [[Caer Ardith]], sits where the river widens. North of it is [[Ardmere]], which was besieged for a winter in 2994 and still has the scars; south is the market town of [[Fallowden]], fat and bored.

### The people
Imperial humans mostly, with orc companies in the garrisons (never trusted, never dismissed), halfling barges on every river, Vesh in the archives. The old noble families keep the old titles and quarrel about precedence at parties where nobody has paid the caterers. Everyone below them fills in forms. The Regency counts everything, taxes most of it, and spends what it has on the capital.

### Who rules
[[The Regency Council]]: eleven seats, nine of them in the pocket of Regent-Chancellor [[Marius Vell]], a soft-spoken man who has been "acting" for a decade. The throne room is kept swept and the throne is kept empty. Every few years a claimant is found, examined, and quietly withdrawn. The council's records and taxes are gathered by [[The Quiet Office]], which also, everyone knows and nobody says, does the Regency's killing.

### In the Ashenreach
Officially the March of Cinders is "an imperial territory under treaty garrison". Unofficially the Regency stopped paying the garrison in 3009 and has been sending tax assessors instead. It wants the March back, cheaply, and it would prefer the mercenaries to leave on their own.

### Rumours
- The council has a true heir locked in a tower and is waiting for him to go mad. (Half true: the claimants do go mad.)
- Vell sleeps in the throne room. (False. He sleeps very well, elsewhere.)
- The Quiet Office keeps a file on every mercenary captain alive. (True.)

:::gm
Vell wants the Ninth Ward's power as a leash for a puppet emperor; the Regency's secret is that no imperial-blooded heir can sit the throne without hearing the Sleeper, which is why the claimants crack. The agent in Cinderford is [[Ansel Mote]], not [[Pell Quillon]], who is exactly what he appears to be.
:::`,
  },
  {
    key: 'concord',
    type: 'location',
    name: 'The Sevenhaven Concord',
    players: true,
    parent: 'vael-ardith',
    summary: 'Seven free ports on the seven southern bays, run by merchant houses and Shellback banks. Everyone owes them.',
    fields: [
      { key: 'Power', value: 'Great' },
      { key: 'Seat', value: 'Sevenhaven, on the Bay of Tolls' },
      { key: 'Ruler', value: 'the Concord Table: one chair per port, and the banks behind the chairs' },
      { key: 'Notable for', value: 'debt, ships, honest weights and dishonest contracts' },
    ],
    tags: ['nation'],
    body: `Seven bays bite into the south coast of the continent, and on each one sits a free port that would rather sell you a knife than use one. Together they are the Concord. Separately they are seven cities that have agreed not to go to war with each other because war is bad for shipping.

### The ports
West to east: [[Marrowport]] on Marrow Bay, old and rough; [[Cowl]] in the Bight of Cowl, fog and smugglers; [[Sevenhaven]] on the Bay of Tolls at the mouth of the Ardis, the largest and the capital in all but name; [[Gilt]] on the bottle-necked Gilt Water, rich and locked; [[Harrowquay]] on Harrow Bay, shipyards and press-gangs; [[Keel]] in the deep sound called the Bay of Bells; and [[Vessary]], the island city across the mouth of Pale Sound.

### The people
Humans of every coast, halflings running the river trade up from the bays, Vesh keeping the lamps of the lighthouses, and the [[Shellbacks]]: slow, courteous, centuries old, and holding every important ledger on the continent. The Shellback counting-houses lent the empire its first loan in 2650 and have been lending ever since. The war was fought on their credit and the peace is being bought with it.

### Who rules
The Concord Table meets in Sevenhaven, one chair for each port, decisions by a majority that always somehow matches the banks' opinion. Faith goes to [[Corvex]], whose priests audit prayers, and to [[Sefra]], who keeps a different face in every bay. [[The Concord Houses]] are the merchant families and banks who actually decide things.

### In the Ashenreach
Since the Regency stopped paying the treaty garrison, Concord banks have been quietly buying the debt: the company's, the town's, the Regency's share of the treaty. Whoever holds the debt holds the March. [[Tollamund & Daughters]] in Cinderford is their hand on the table.

### Rumours
- The Concord trades with drowned [[Qal Merrow]] and lies about what it brings back. (True.)
- The Shellbacks own the Regency Council outright. (Not quite. Only seven seats.)
- No Shellback has ever been seen to die. (False. They just take a long time about it.)

:::gm
The Concord wants the Ashenreach for what is under it as much as for the land: the Shellbacks believe the lantern's flame is the key that will let them go home to the Ness of Thurm. Grandmother Tollamund is acting for herself as much as for the Table.
:::`,
  },
  {
    key: 'iskaveth',
    type: 'location',
    name: 'Iskaveth',
    players: true,
    parent: 'vael-ardith',
    summary: 'A theocracy on the eastern plateau beyond the Saint\'s Spine, where a living saint is becoming a god.',
    fields: [
      { key: 'Power', value: 'Middle' },
      { key: 'Seat', value: 'Halcyra, the holy city' },
      { key: 'Ruler', value: 'the Synod of Lamps, in the name of the Unburnt Saint' },
      { key: 'Notable for', value: 'fire, mercy, missionaries who do not write home' },
    ],
    tags: ['nation'],
    body: `East of the Ardis the land rises in a wall of mountains called the Saint's Spine, and beyond them lies a high dry plateau of salt lakes, terraced orchards and white towns, falling away at its far edge to the Glass Sea. That is Iskaveth. The empire conquered it in 2390 and spent six hundred years failing to keep it quiet.

### The people
Plateau humans, dark and dry-humoured, who pray with their hands in a lamp flame and consider the rest of the continent damp. Vesh are honoured here as lamp-keepers; orcs are not welcome; Hollowborn are brought to Halcyra for "the Saint's mercy", and some of them come back.

### Who rules
Iskaveth was a dozen temple-cities under an imperial governor until 3002. Then a camp healer named [[Ilyra of Halcyra]] walked out of the fire at Cinders unburnt, and the plateau rose. In 3007 the priests declared her a living saint. She has not been seen outside Halcyra since; her word comes through the Synod of Lamps and through envoys like [[Seraphine Ashe]]. The old gods are still prayed to, politely, as her household. [[The Church of the Unburnt Saint]] is the state.

### In the Ashenreach
Iskaveth calls the Ashenreach the Saint's birthplace and has sent a mission, [[The House of Unburnt Light]], to "tend the wounded land". It feeds the poor, heals the sick, and asks a great many gentle questions about the lantern. The Ember is the Saint's Lamp, in their telling, lit the night she rose.

### Rumours
- The Saint has not aged a day since Cinders. (True.)
- Iskaveth is building an army behind the Spine. (True, called a pilgrimage.)
- Missionaries sent to [[Ostrakai]] have all died. (Nobody knows. None has written.)

:::gm
Ilyra drank the dying god Hathe's power in the fire and is ascending on it. The church wants the Ninth Ward's crack opened so she can drink what leaks out and finish becoming a god; its priests argue, sincerely, that mercy would be best served by a merciful god. The Saint can speak through Seraphine. She wants the PCs, and she is genuinely charming about it.
:::`,
  },
  {
    key: 'grimmark',
    type: 'location',
    name: 'The Grimmark Holds',
    players: true,
    parent: 'vael-ardith',
    summary: 'Highland clans of humans and Returned dwarves holding the northern passes. Proud, poor, owed favours by everyone.',
    fields: [
      { key: 'Power', value: 'Middle' },
      { key: 'Seat', value: 'Skarn' },
      { key: 'Ruler', value: 'the Moot of Holds; High Reeve Osk Harrowborn speaks first' },
      { key: 'Notable for', value: 'passes, grudges, dwarves without shadows' },
    ],
    tags: ['nation'],
    body: `The Grimmark is the mountain wall across the top of the continent, and the Holds are the people who live in its cracks. Human clans in the high valleys, surface dwarves in the hill-forts, and under it all the old dwarven city of [[Hollowhall]], whose gates have stood open since the Returned came up.

### The land
Pine, scree, snow for half the year. Every pass between the Regency and the north coast runs through a Hold, and every Hold charges toll, and every toll is a grievance three hundred years old. North of the mountains a thin strip of fishing villages faces the Grey Reach: [[Hask]], [[Coldwater]], others too small to name.

### The people
Clan humans who count kin to the ninth degree and debts to the tenth. Surface dwarves who hold the Lithic holy, ancestors made stone, and keep little shrines of pebbles at every crossroads. And the Returned: dwarves who went under the mountains during the war to escape it, and came back in 3004 casting no shadow, saying nothing about the deep. Their own kin are not sure whether to grieve them or fear them.

### Who rules
The Moot of Holds meets at [[Skarn]] when it must and agrees on nothing but the tolls. The Holds fought on every side of the War of the Empty Throne, often in the same week, and came out of it owed favours by every faction and paid by none. They remember this.

### In the Ashenreach
The Holds have no claim and want none. But Hold clansmen fill half the mercenary companies, and the Returned have started walking south, one or two a season, toward the Rent, and will not say why.

### Rumours
- The Returned do not sleep. (False. They sleep. They do not dream.)
- Hollowhall's deep gates are sealed from the inside. (True.)
- A Grimmark Hold will sell a pass to anyone who can name its grandmother. (More or less true.)

:::gm
Under the Grimmark the Returned found the Eighth Ward, breached. Something there took their shadows as the price of passage. One of those shadows followed [[Borrin Halt]] up and is wearing the hole where his should be.
:::`,
  },
  {
    key: 'sael',
    type: 'location',
    name: 'Sael',
    players: true,
    parent: 'vael-ardith',
    summary: 'The ancient elven forest down the west coast. It has forgotten most of its history and is quietly desperate to learn it.',
    fields: [
      { key: 'Power', value: 'Minor' },
      { key: 'Seat', value: 'Ilmareth' },
      { key: 'Ruler', value: 'the Circle of Ilmareth; the Remembrancers advise it' },
      { key: 'Notable for', value: 'ink, old trees, polite scholars, a mountain wedge the charts avoid' },
    ],
    tags: ['nation'],
    body: `The Saelwood runs down the west coast for six hundred miles, old, dark and very quiet. The elves came to it by sea in 690 AW, by their own account, and have been there since, which is longer than they can remember.

### The people
[[Elves]] live for centuries and forget as they go: every hundred years or so the memory thins like old cloth, and what was lived must be reread. So they tattoo their history onto their skin, in a script that changes with the generations. The oldest are blue to the fingertips with ink they can no longer read, and keep younger elves to read it to them. Who is reading honestly is a matter of some anxiety.

Humans fish the Saelwood's coast on sufferance; halflings bring letters up its rivers; nobody else is much wanted.

### Who rules
The Circle at [[Ilmareth]], where the forest is oldest, under the green eye of [[Orvanne]], whom the elves worship without quite remembering why. The real power is the loremasters: [[The Remembrancers]], who keep the archives of skin and are very, very interested in anything written before 1200 AW.

### In the Ashenreach
Sael claims nothing. It sends scholars. Remembrancer [[Aelith Sorn]] arrived in Cinderford last spring to "study the Lithic ruins under the glass" and has been exquisitely helpful to everyone.

### The Ness
From the middle of the forest's west coast a broad wedge of mountains runs out into the Hollow Sea: [[The Ness of Thurm]]. The elves bar the way to it with a wall across its root and do not explain. Old Shellback charts show ruins on its southern slopes. Newer charts say: here the charts fail.

### Rumours
- The elves burned a whole generation's skins in a single night, long ago. (No elf will discuss it.)
- Sael's queen is a thousand years old and remembers everything. (There is no queen.)
- There are elves on the Ness who never came to Ilmareth and still remember. (Nobody knows.)

:::gm
Sael tried to open the Fourth Ward in 1102 AW ([[The Saelish Trespass]]), failed horribly, and chose to forget: the skins that recorded it were burned. Not all of them. [[Sorrel Vey]] carries the surviving record on her own body and does not know what it says. Aelith Sorn suspects, and will betray anyone to read it.
:::`,
  },
  {
    key: 'ashenreach',
    type: 'location',
    name: 'The Ashenreach',
    players: true,
    parent: 'vael-ardith',
    summary: 'Grey plains where the war ended and the Ninth Ward cracked. Claimed by all, held by none, garrisoned by the unpaid.',
    fields: [
      { key: 'Power', value: 'Frontier' },
      { key: 'Ruler', value: 'none; a mercenary garrison under the Treaty of Ashes' },
      { key: 'Population', value: 'under 5,000, most of them in Cinderford' },
      { key: 'Dangers', value: 'greywinds, glass underfoot, the walking dead, Glassers, thirst' },
      { key: 'Notable for', value: 'the Rent, the glasslands, a moon that rose here' },
    ],
    tags: ['region', 'wasteland'],
    body: `> Grey to the horizon. Not the grey of stone or sky but of ash, fine as flour, lying in drifts against anything that stands. It gets in your teeth. It gets in your water. When the wind comes up the whole plain lifts and walks, and the road you were following is gone in an hour. Somewhere out in it, at noon, a shard of something catches the light and throws it back red.

Nine years ago this was farmland: the Cinder valley, the pear country, forty villages between the river and the eastern downs. Then eight armies met here and their sorcerers burned the sky. What is left is called the Ashenreach, and [[The Treaty of Ashes]] made it a neutral march, garrisoned by mercenaries at the signatories' expense. The expense has lapsed. The garrison has not.

### The lie of the land
- **The March of Cinders**, the western strip along the river Cinder, where [[Cinderford]] stands and the ash is only ankle deep. See [[The March of Cinders]].
- **The glasslands**, east and south, where war sorcery fused whole villages into sheets and knots of dark glass. The Glassers dig them for anything that will sell. [[Fort Mercy]] is their den.
- **The grey lakes**, north-east, standing water that does not ripple. [[Stillwater]] is the only hamlet on them.
- **The Rent**, in the heart of the plain: a chasm thirty miles long that was not there before the battle. The dead are said to walk its edge. See [[The Rent]].

### Weather
Dry, cold at night, and the **greywinds**: ash-storms that rise without warning, bury a road in an hour, and strip paint from a shield. Travellers carry a veil, a cord to tie themselves together, and a bell. If you can hear the bell you are still with the others.

### Who is out here
[[The Ninth Lantern]] at Cinderford, the last treaty garrison still standing. Hollowborn families who were born to the ash and have nowhere else. [[The Glassers]], who dig. [[Ravelers]], who bury. Pilgrims of several faiths, on their way to the Treaty Stone or the Saint's mission or the edge of the Rent, who mostly come back.

### Rumours
- The ash is what is left of the armies. (Partly. Mostly it is the pear trees.)
- There are villages out in the glass where people are still standing, fused where they stood, and at red moon they turn to watch you. (True of one village. The Glassers do not dig it.)
- Water from the grey lakes shows you the dead. (True, for the Hollowborn. Everyone else just sees mud.)
- The Rent is getting longer. (True.)

:::gm
The Ashenreach is the Ninth Ward's wound. Every spell cast here costs the ward directly; cast enough in one place and the dead rise there the next red moon. Treat the plain as hostile ground: see the Ashenreach Encounters and Greywind Weather tables.
:::`,
  },
  {
    key: 'ness',
    type: 'location',
    name: 'The Ness of Thurm',
    parent: 'sael',
    summary: 'A broad mountainous wedge running west from the middle of Sael\'s coast, almost splitting the Hollow Sea, barred by the elves at its root. Old charts show Shellback ruins on its southern slopes. New charts say: here the charts fail.',
    fields: [
      { key: 'Ruler', value: 'none admitted; the elves hold the wall at its neck' },
      { key: 'Notable for', value: 'Shellback ruins, a wall nobody explains, charts that stop' },
      { key: 'Dangers', value: 'unknown; nothing that goes round the point comes back the same' },
    ],
    tags: ['peninsula', 'mountains', 'ruin', 'mystery'],
    body: `The Ness leaves the middle of Sael's west coast as a broad wedge of mountains, two hundred miles across at its root, and runs west into the Hollow Sea, narrowing all the way, until it ends in a point like an arrowhead that all but splits the sea in two. A great peak stands near the root, snow on it in Highsun, and from it a chain of smaller summits marches out to the tip, each one lower and barer than the last, the final one always in cloud. Across the root, from the forest's edge to the sea on both sides, the elves built a wall, long ago, of dry stone the height of three men, and they keep a watch on it that has not been relieved in anyone's memory.

The Shellbacks lived here once, on the southern slopes where the land falls in terraces to warm water. Their own account says they left in 1350 AW for the southern bays and founded the counting-houses; their account does not say why. The oldest Concord charts show towns on those slopes: round harbours, stepped halls, names in a script the Shellbacks no longer use. The newest charts show the coastline to the wall on either side and then a wedge of blank vellum with the old mariners' phrase along its edge: *here the charts fail*.

Ships that round the point, which is the only way from the northern Hollow Sea to the southern, report nothing wrong. Fog, rock, a long swell. Some report a light. Several have come back with a day missing from the log and a crew that will not discuss it.

### What is known for certain
Very little. The elves will not say what the wall is for. The Shellbacks change the subject, slowly. [[Grandmother Tollamund]] has been asked, by a very brave clerk, and answered: "Not yet."

### What the GM knows
- The Shellbacks did not leave the Ness. They were put out of it, by something they call the Slow One and never name aloud. Their god, or their landlord. The distinction is unclear even to them.
- They believe a ward-flame, held in the right hands, will open the way back. That is why Tollamund wants the Ninth Lantern, and why the Concord Houses are buying the Ashenreach's debt instead of simply calling it in.
- The elven wall is older than the elves' arrival in 690 AW. They do not remember building it. They are afraid that they did.
- The great peak at the root is hollow. The Shellbacks' word for it is the same as their word for a shell.
- Nothing in the campaign requires the party to go to the Ness. It is where the Shellbacks' thread leads if the players pull it, and a strong candidate for a second campaign.`,
    gmNotes: `Keep the Ness a horizon, not a destination, in this campaign. Use it through Tollamund: a word dropped, a chart on her wall with the blank corner facing the room, a clerk who went pale when asked. If a player presses the Shellbacks hard enough, let them learn the phrase "the Slow One" and nothing else.`,
  },
  {
    key: 'qal-merrow',
    type: 'location',
    name: 'Qal Merrow',
    players: true,
    summary: 'A drowned empire of stilt cities and tide-priests across the Hollow Sea to the south-west. Sevenhaven trades with it and lies about how.',
    fields: [
      { key: 'Where', value: 'south-west across the Hollow Sea, three weeks\' sail from Marrowport' },
      { key: 'Ruler', value: 'the Tide-Synod, it is said, from whichever city is above water this year' },
      { key: 'Notable for', value: 'cities on stilts, salt-glass, priests who read the tide like scripture' },
    ],
    tags: ['continent', 'foreign'],
    body: `Qal Merrow was a continent once, say the Concord's pilots, and is now an archipelago of rooftops. Its people live in cities on stilts above the drowned streets of older cities, fish from their windows, and keep calendars by the tide rather than the moons. Their priests, the tide-readers, walk out onto the mud at the ebb and come back with prophecies and crabs.

Nobody on Vael Ardith knows much more than that, and the Concord likes it that way. Sevenhaven ships sail for Qal Merrow from [[Marrowport]] and [[Cowl]] with grain, iron and lamp oil, and come back low in the water with salt-glass, dyes, drowned-ivory, and a sweet black resin the Velvet Ledger burns in its lamps. What else they carry is a matter for the Concord Table and for [[Sefra]], who has a drowned face too.

### Hooks
- A Qal Merrowi tide-priest turned up in [[Sevenhaven]] last year asking, in careful Ardithi, whether "the dreamer under your country" had begun to turn over in its sleep. The Concord put him on a ship home. The ship has not arrived.
- Qal Merrow's drowning is said to have been sudden, within living memory of their oldest, and to have begun with a crack in the sea floor.
- The Shellbacks will not do business with Qal Merrow. They do not say why. They do not say why about most things.

:::gm
Qal Merrow drowned when a ward of its own failed, two centuries ago; its god is awake and in the water, and the tide-priests are its voice. The Concord knows this and trades anyway: the drowned sell cheaply. This is what the Ashenreach looks like if the players choose Ending B and the Sleeper's leak is left to run.
:::`,
  },
  {
    key: 'ostrakai',
    type: 'location',
    name: 'Ostrakai',
    players: true,
    summary: 'The land east across the Glass Sea, where the gods are all said to be dead. Iskaveth\'s missionaries go there and do not write home.',
    fields: [
      { key: 'Where', value: 'east across the Glass Sea from Qerath, two weeks with a fair wind' },
      { key: 'Ruler', value: 'unknown; the few traders speak of "the Hundred Houses"' },
      { key: 'Notable for', value: 'godless temples, mirror-ships, very good steel' },
    ],
    tags: ['continent', 'foreign'],
    body: `Across the Glass Sea from [[Qerath]], a fortnight's sail on a good wind and a month on a bad one, lies a coast of white cliffs and terraced cities called Ostrakai. The Ostrakai say, through interpreters, that their gods are dead, all of them, long ago, and they say it without grief, the way you might mention the weather.

Their temples are kept swept and empty. Their priests are historians. Their ships have mirrored hulls to throw the sun back into the eyes of anything watching from below the water, which they do not explain. They make the best steel anyone on Vael Ardith has handled, and sell very little of it.

Iskaveth has sent missionaries of the Unburnt Saint east every spring since 3007, to bring the godless a living god. Forty-one men and women have gone. None has written home. Qerath's harbourmaster keeps the list on the wall of his office, and adds to it.

### Hooks
- An Ostrakai trader in Sevenhaven, asked how his people killed their gods, answered: "We didn't. We stopped feeding them." Then he sold a sword for eight hundred gold and left on the tide.
- Ostrakai charts of the Glass Sea show a shoal off the Iskavethi coast that is not on any Ardithi chart, marked with a sign their interpreter translated as "sleeping".
- An Ostrakai mirror-ship was seen off [[Qerath]] last Reaping, heading south-west, which is to say toward the Ashenreach's nearest coast.

:::gm
Ostrakai starved its gods by stopping all worship and all magic, generations ago, and lived. It is the continent's proof that Ending A can be survived, and its people know more about buried gods than anyone on Vael Ardith; a surviving missionary, turned, could bring that knowledge back in a sequel. Their mirrored hulls are against things in the Glass Sea that look up.
:::`,
  },
  // ───────────────────────────── Distant towns ─────────────────────────────
  {
    key: 'caer-ardith',
    type: 'location',
    name: 'Caer Ardith',
    players: true,
    parent: 'regency',
    summary: 'The imperial capital on the Ardis: a throne kept empty, a council that meets around it, and a city of clerks.',
    fields: [
      { key: 'Population', value: 'about 300,000' },
      { key: 'Ruler', value: 'the Regency Council, in the Sun Palace' },
      { key: 'Notable for', value: 'the Empty Throne, the Hall of Records, assassins with excellent manners' },
    ],
    tags: ['city', 'capital'],
    body: `Caer Ardith is the biggest city on the continent and the most carefully swept. Seven bridges cross the Ardis under the walls; the Sun Palace stands on the island between them, and in its heart the Empty Throne sits under a dust sheet that is changed every morning by a man whose family has held the post for nine generations.

The city runs on paper. The Hall of Records fills three streets and every transaction in the Regency ends up in it, in triplicate, sooner or later. Vesh archivists keep the stacks; halfling couriers run the corridors; the Quiet Office has a door on every floor and no sign on any of them.

The old nobility live on the terraces above the river in houses they cannot afford to heat, and throw parties. The orc garrison lives in the Iron Barracks across the water, where it has lived since 2104, under a watch that has not been relaxed since the Kingslaying. The Iron Barracks' gate still bears the marks of the night the Guard came out of it.

### Hook
A claimant to the throne was "examined" at the Sun Palace last month. He was a vintner's son from Fallowden with the right chin and the wrong temperament, and after three nights in the palace he began screaming about a voice under the floor. He has been sent home to recover. [[Marius Vell]] attended the examination personally and took notes.`,
  },
  {
    key: 'ardmere',
    type: 'location',
    name: 'Ardmere',
    players: true,
    parent: 'regency',
    summary: 'River town north of the capital, besieged through the winter of 2994. The walls are mended; the people are not.',
    fields: [
      { key: 'Population', value: 'about 9,000, half what it was' },
      { key: 'Ruler', value: 'a Regency prefect; the Widows\' Bench runs the town' },
      { key: 'Notable for', value: 'the Siege, the Hungry Winter, mercenary memorials' },
    ],
    tags: ['town'],
    body: `Ardmere sits on a bend of the Ardis where the river narrows enough to chain. In 2994 three claimant armies sat outside it for a winter and the town ate its horses, its dogs, its boots and, by Thawmere, some of its dead. When [[The Siege of Ardmere]] broke it was not a royal army that broke it but four mercenary companies who had not been paid by anyone and simply decided the siege was bad for business. That was the day everyone understood who the real armies were.

The walls are rebuilt in a different colour of stone. The Widows' Bench, forty women who kept the town alive that winter, still sits in judgment on market days and the prefect does not cross it. Every mercenary company that lifted the siege has a stone on the river wall; the Ninth Lantern's is not there, because the Ninth did not exist yet, but three of its oldest veterans were, under other banners. [[Ilse Marrow]] was one. She does not talk about it.

### Hook
Someone has been scratching a fifth company's name onto the memorial wall at night, a company nobody in Ardmere has heard of. The name is the Ninth Lantern.`,
  },
  {
    key: 'fallowden',
    type: 'location',
    name: 'Fallowden',
    players: true,
    parent: 'regency',
    summary: 'Fat market town south of the capital. Wine, wool, and the road to the Ashenreach that nobody takes any more.',
    fields: [
      { key: 'Population', value: 'about 6,000' },
      { key: 'Ruler', value: 'a Regency prefect; the Vintners\' Guild owns him' },
      { key: 'Notable for', value: 'the last good inn before the ash, pay wagons that leave and do not arrive' },
    ],
    tags: ['town'],
    body: `Fallowden is the last comfortable place on the road south-east. Vines on the slopes, a wool fair in Reaping, a square with a fountain that works, and the Three Cups, an inn where every mercenary bound for the March of Cinders has drunk the pay they have not yet been given.

The old imperial road runs on from here to Cinderford: four days in good weather, through land that gets greyer by the mile. Fallowden's carters used to run it weekly. Now they run it when someone pays double, and the Regency's pay wagons for the treaty garrison left from the Three Cups' yard every quarter-day until 3009, when they stopped. The road has not had traffic enough since to keep the ash off it.

The town is bored, rich, and quietly ashamed of the view to the south-east on clear days.

### Hook
The quarter-day pay wagon that should have reached Cinderford this Ashfall did leave Fallowden, with a Regency escort, on 2 Ashfall. The Three Cups' ostler will swear to it. The escort's sergeant paid for his drinks in new Concord silver.`,
  },
  {
    key: 'sevenhaven',
    type: 'location',
    name: 'Sevenhaven',
    players: true,
    parent: 'concord',
    summary: 'The largest of the seven ports, at the mouth of the Ardis on the Bay of Tolls. Where the Concord Table meets and the debts come home.',
    fields: [
      { key: 'Population', value: 'about 200,000' },
      { key: 'Ruler', value: 'the Concord Table; the Harbour Syndics day to day' },
      { key: 'Notable for', value: 'the Long Counting-House, the Toll Chain, more ships than trees' },
    ],
    tags: ['city', 'port', 'capital'],
    body: `Where the Ardis finally reaches the sea it spreads into the Bay of Tolls, and Sevenhaven covers both banks and most of the islands between them. Every barrel that comes down the river pays a toll at the Chain; every ship that comes in from the Southern Deep pays another at the Mole; and every coin from both goes, by way of a great many hands, into the Long Counting-House on Ledger Island, where the Shellbacks sit in rooms that smell of wax and patience.

The city is loud, salt-stained, polyglot, and honest in a way that has nothing to do with virtue: the weights are true because false weights are bad for business, and the contracts are binding because [[Corvex]] audits them personally. The temple of Corvex is the biggest building in the city. The temple of [[Sefra]] is the oldest, and her face here is the Toll-Keeper, who takes a tenth of every drowning.

### Hook
A clerk of the Long Counting-House, drunk at a quayside tavern, told a halfling barge-captain that the Table had "bought the ash", meaning the Ashenreach's debts, Regency share and all, "down to the last candle". The halfling was [[Kettle Brindlewake]]. She has been thinking about what it means ever since.`,
  },
  {
    key: 'marrowport',
    type: 'location',
    name: 'Marrowport',
    players: true,
    parent: 'concord',
    summary: 'The westernmost port, on Marrow Bay. Old, rough, and the only harbour that sails openly for drowned Qal Merrow.',
    fields: [
      { key: 'Population', value: 'about 40,000' },
      { key: 'Notable for', value: 'the Qal Merrow trade, bone-carvers, a bay that stinks at low tide' },
    ],
    tags: ['town', 'port'],
    body: `Marrow Bay is wide, shallow and foul at the ebb, and Marrowport sits on its only deep channel like a dog on a bone. The town is older than the Concord, older than the empire, built of a grey stone nobody quarries any more, and its people have the long faces and short tempers of a coast that gets the weather first.

Ships for [[Qal Merrow]] sail from here and nowhere else, officially. They come back riding low. Marrowport's bone-carvers work drowned-ivory into combs and dice and the handles of very expensive knives, and the harbour chandlers sell a black resin by the ounce that burns sweet and makes the dreams come easily.

### Hook
The last Qal Merrow ship brought back a passenger who was not on the manifest: a tide-priest, grey-skinned, who walked up the quay asking for "the country with the dreamer under it". The harbour syndic had him put on the next ship home. That ship has not arrived anywhere, and the syndic has started sleeping with a lamp lit.`,
  },
  {
    key: 'cowl',
    type: 'location',
    name: 'Cowl',
    players: true,
    parent: 'concord',
    summary: 'The port in the Bight of Cowl. Fog nine days in ten, and the most honest smugglers on the coast.',
    fields: [
      { key: 'Population', value: 'about 25,000, when you can see them' },
      { key: 'Notable for', value: 'fog, the Smugglers\' Bench, lamps that burn all day' },
    ],
    tags: ['town', 'port'],
    body: `The Bight of Cowl is a deep hooked bay under cliffs, and the fog that lives in it is so reliable that Cowl's lamps are lit at noon and its bells ring the hours for ships that cannot see the mole. The Vesh keep the lamps and are the town's quiet aristocracy. Everyone else smuggles.

Cowl's position on smuggling is that it is trade the Table has not caught up with yet. The Smugglers' Bench, which sits in the back room of a tavern called the Blind Pilot, settles disputes with a speed and fairness the Concord's own courts have never managed, and every barge clan on the continent has a factor here.

### Hook
A Cowl factor has been asking the barge clans to quote for "a sealed cargo, man-sized, not to be opened, from the ash country to the Bight, Frostcall delivery". The pay is very good. The Brindlewakes turned it down. Someone else will not.`,
  },
  {
    key: 'gilt',
    type: 'location',
    name: 'Gilt',
    players: true,
    parent: 'concord',
    summary: 'The richest and most locked of the ports, on the bottle-necked Gilt Water. A chain across the neck and a vault under every house.',
    fields: [
      { key: 'Population', value: 'about 30,000' },
      { key: 'Notable for', value: 'the Neck Chain, goldsmiths, Shellback vaults, nobody getting in after dark' },
    ],
    tags: ['town', 'port'],
    body: `Gilt Water is a long inland bay reached through a gap in the cliffs barely wide enough for two ships abreast, and the Gilt put a chain across it in 1611 and have raised it at sunset every night since. Inside, the water is still as a bowl and the town climbs the slopes in terraces of white stone with gold leaf on the doors, because the Gilt can afford it and want you to know.

This is where the Concord keeps the money. Every great Shellback house has a vault under Gilt, cut into the living rock, and the goldsmiths' street is guarded by veterans who are paid on time, which is the surest sign of wealth on the continent.

### Hook
The vault of Tollamund & Daughters at Gilt has taken a delivery every month for a year: a single sealed crate from the Ashenreach, by way of Cowl, carried by Glassers and paid for in advance. The vault clerks say the crates are heavy, cold, and hum.`,
  },
  {
    key: 'harrowquay',
    type: 'location',
    name: 'Harrowquay',
    players: true,
    parent: 'concord',
    summary: 'Shipyards and press-gangs on Harrow Bay. Half the Concord\'s hulls are built here and a quarter of its sailors are kidnapped here.',
    fields: [
      { key: 'Population', value: 'about 50,000' },
      { key: 'Notable for', value: 'the Yards, the Press, Grum\'s biggest temple on the coast' },
    ],
    tags: ['town', 'port'],
    body: `Harrow Bay is ringed with slipways and the sound of Harrowquay is hammering. The Yards build the Concord's ships and refit everyone else's, and the timber comes down from the Grimmark on halfling rafts a mile long. The Press is the other industry: on any night with a ship short of hands, the harbour taverns are not safe to fall asleep in.

Soldiers like Harrowquay. It is loud, cheap and full of people who understand them, and the temple of [[Grum]] on the Yard Hill is the biggest on the coast, with an anvil for an altar and a liturgy that is mostly swearing. Mercenary companies between contracts winter here and lose their pay in an orderly fashion.

### Hook
Three recruiters in Harrowquay are signing men for a company called the Red Lamp, "to relieve a treaty garrison in the March of Cinders at the Concord's expense". Nobody in the March has heard of the Red Lamp, or of any relief.`,
  },
  {
    key: 'keel',
    type: 'location',
    name: 'Keel',
    players: true,
    parent: 'concord',
    summary: 'A port in the deep narrow sound called the Bay of Bells, where the drowned bells still ring and Sefra wears her oldest face.',
    fields: [
      { key: 'Population', value: 'about 15,000' },
      { key: 'Notable for', value: 'the Drowned Bells, whale-oil, pilots who navigate by ear' },
    ],
    tags: ['town', 'port'],
    body: `The Bay of Bells is a fjord, deep and dark and barely a mile wide, and Keel clings to its western wall in tiers of tarred timber. The name is older than the town. There are bells under the water, say the pilots, a drowned temple's worth, and on still nights with the tide turning you can hear them. Keel's pilots bring ships up the sound in fog by the sound of the bells alone.

[[Sefra]]'s face here is the Bell-Ringer, oldest and least friendly of her seven, and her priests go down on ropes once a year to touch the bells and come up changed. Whale-oil is the trade: Keel's boats go out past the Southern Deep's edge and bring back lamp-oil the whole continent burns, including, until this year, the Lantern Keep.

### Hook
The drowned bells rang on their own on the night of 2 Ashfall, all together, for the length of a breath. The last time they did that was the night of the Battle of Cinders. The priests have written to Sevenhaven and had no reply.`,
  },
  {
    key: 'vessary',
    type: 'location',
    name: 'Vessary',
    players: true,
    parent: 'concord',
    summary: 'The island city across the mouth of Pale Sound, easternmost of the ports. Watchtowers, pearl-divers, and the first sight of anything coming from Iskaveth.',
    fields: [
      { key: 'Population', value: 'about 20,000' },
      { key: 'Notable for', value: 'the Pale Watch, pearls, Iskavethi refugees' },
    ],
    tags: ['town', 'port', 'island'],
    body: `Vessary is an island like a ship at anchor across the mouth of Pale Sound, with a watchtower at each end and a city between them. It is the Concord's eye on the east: the Iskavethi coast is two days' sail, and anything the Saint sends west by sea passes under Vessary's towers first.

The pearl-divers of Vessary are famous and short-lived. Its other trade is people: Iskavethi who did not care to live under a living saint have been coming across the water since 3007, and the Lower Town speaks Iskavethi now, and keeps the old plateau gods in cellar shrines where the Saint's lamps cannot see them.

### Hook
A refugee priest of the old Iskavethi hearth-faith, hiding in Vessary's Lower Town, claims to have been the healer who trained [[Ilyra of Halcyra]] before the war, and to know what she was before the fire. He wants passage to the Ashenreach and protection when he gets there. He has not said from whom.`,
  },
  {
    key: 'halcyra',
    type: 'location',
    name: 'Halcyra',
    players: true,
    parent: 'iskaveth',
    summary: 'The holy city of Iskaveth, high on the plateau. The Unburnt Saint lives at its heart and has not been seen in four years.',
    fields: [
      { key: 'Population', value: 'about 90,000, and 10,000 pilgrims on any given night' },
      { key: 'Ruler', value: 'the Synod of Lamps, for the Saint' },
      { key: 'Notable for', value: 'the Lamp Court, a city that never goes dark, the Mercy Houses' },
    ],
    tags: ['city', 'capital', 'holy'],
    body: `Halcyra is white stone on a hill above a salt lake, and from the plain below it looks on fire every night, because every window, step and rooftop holds a lamp and the lamps are never allowed to go out. The air smells of hot oil and orange blossom. Pilgrims climb the Thousand Steps on their knees and are healed at the top, often.

At the summit is the Lamp Court, the old imperial governor's palace, where [[Ilyra of Halcyra]] lives behind a screen of flame. She has not been seen outside it since 3007. Her voice reaches the city through the Synod and through envoys who come back from her presence with a look that does not fade. The Mercy Houses below the Court take in the sick, the poor, and the Hollowborn, and are famous for their kindness. Not everyone who enters a Mercy House is seen again, and nobody who asks about it is answered unkindly.

### Hook
Four years ago a camp healer named Ilyra had a sister, a mother, and a lover, all in Halcyra. All three now live in the Lamp Court and none has written to anyone since. The lover's brother keeps a stall at the foot of the Thousand Steps and will tell the story to anyone who buys a lamp.`,
  },
  {
    key: 'qerath',
    type: 'location',
    name: 'Qerath',
    players: true,
    parent: 'iskaveth',
    summary: 'Iskaveth\'s port town on the Glass Sea, where the missionaries sail east for Ostrakai and the harbourmaster keeps the list of those who did not come back.',
    fields: [
      { key: 'Population', value: 'about 12,000' },
      { key: 'Notable for', value: 'the Glass Sea, the Missionaries\' Mole, a wall with forty-one names' },
    ],
    tags: ['town', 'port'],
    body: `Qerath is where the plateau falls into the sea in a long white scarp, and the town is built down it in steps to a harbour of black sand. The Glass Sea is named for its calm; on a still day it is a sheet, and from the harbour wall you can see down twenty fathoms to the drowned terraces of whatever stood here before Iskaveth.

Every Seedwake a ship leaves the Missionaries' Mole for [[Ostrakai]] with a dozen of the Saint's faithful aboard, lamps lit, singing. The ships come back with cargo. The missionaries do not. The harbourmaster, an old imperial officer who kept his post through the rising by being useful, paints each name on the wall of his office and has run out of wall.

### Hook
The forty-first name on the harbourmaster's wall was painted over last month, carefully, by someone with a key. The harbourmaster says he did not do it. The missionary in question was a Hollowborn girl from the Smokes of Cinderford, taken to Halcyra for mercy in 3006, and her mother still lives on Tanners' Lane.`,
  },
  {
    key: 'skarn',
    type: 'location',
    name: 'Skarn',
    players: true,
    parent: 'grimmark',
    summary: 'Clan seat of the Grimmark Holds, a hill-fort over the only pass that stays open all winter. The Moot meets here and agrees on nothing but the tolls.',
    fields: [
      { key: 'Population', value: 'about 8,000, double at Moot' },
      { key: 'Ruler', value: 'the Moot of Holds; High Reeve Osk Harrowborn' },
      { key: 'Notable for', value: 'the Moot Stone, the Winter Pass, grudges kept in writing' },
    ],
    tags: ['town', 'capital'],
    body: `Skarn is a fort that grew a town. It sits on a spur above the Winter Pass, the one road through the Grimmark that stays open in Longnight, and its tolls have paid for its walls since before the empire. Grey stone, turf roofs, and a great hall with a fire that has not gone out in three hundred years, which the Skarn mention more than is strictly necessary.

The Moot Stone in the hall's yard is a slab of Lithic stone, a standing figure worn featureless, and every Hold that sits at the Moot must first lay a hand on it. The surface dwarves say it is a Lithic ancestor and still listening. The Returned, when they come to Moot, do not touch it.

### Hook
Skarn's Book of Grudges, in which the Holds have recorded every debt and insult since the founding, has a page torn out. The page covered the winter of 3004, when the Returned came up out of Hollowhall. Nobody admits to tearing it and nobody can remember what it said.`,
  },
  {
    key: 'hollowhall',
    type: 'location',
    name: 'Hollowhall',
    players: true,
    parent: 'grimmark',
    summary: 'The old dwarven gate-city under the Grimmark, carved in 412 AW. Its surface gates stand open; its deep gates are sealed from inside.',
    fields: [
      { key: 'Population', value: 'about 6,000 dwarves in the upper halls; nobody counts the Returned' },
      { key: 'Ruler', value: 'the Hall-Mother Brenna Underlook; the Returned keep their own counsel' },
      { key: 'Notable for', value: 'the Sealed Stair, shadowless dwarves, the finest stonework on the continent' },
    ],
    tags: ['city', 'underground'],
    body: `The dwarves began cutting Hollowhall in 412 AW and have never entirely stopped. Its gate is a cliff face carved into a hundred stone faces, all of them Lithic, all of them worn, and behind it the upper halls run a mile into the mountain under vaults that make visitors whisper. Surface dwarves live here and hold the Lithic holy: ancestors made stone, and the halls are built as a long prayer to them.

The deep halls are another matter. During the war a third of Hollowhall went down the Sealed Stair to wait out the fighting, and in 3004 they came back up casting no shadows and saying nothing. The Stair is sealed now, from below, with a stone no chisel marks. The Returned live in the lowest open halls, work the forges, pay their tithes, and are watched by their own kin with a love that is becoming fear.

### Hook
A Returned smith in Hollowhall has begun forging the same object over and over: a key, hand-long, in a pattern nobody recognises. He melts each one down when it is finished. He says he does not know why. The pattern matches a door at the bottom of the Glass Barrow under Cinderford, which nobody from Hollowhall has ever seen.`,
  },
  {
    key: 'hask',
    type: 'location',
    name: 'Hask',
    players: true,
    parent: 'grimmark',
    summary: 'A north-coast fishing village on the Grey Reach where the boats go out past the ice and the dead come in with the tide.',
    fields: [
      { key: 'Population', value: 'about 400' },
      { key: 'Notable for', value: 'the Tide-Dead, cod, a Raveler who has stayed thirty years' },
    ],
    tags: ['village', 'coast'],
    body: `Hask is forty turf houses on a shingle beach under the northern cliffs, facing the Grey Reach, which is the sea at the top of the world and looks it. The Hask fish cod and seal in boats their grandmothers built, drink something made of fermented whey, and bury their dead at sea because the ground is frozen eight months of the year.

Since 3002 the sea has been sending them back. Not often: a body a season, drifting in on the tide, sometimes one buried thirty years before, and standing up in the shallows with the patience of the very cold. A Raveler priest of dead [[Hathe]] came to Hask in 2981 for a single funeral and has never left; she walks out into the surf each time, says the door-words, and the dead lie down.

### Hook
The Raveler of Hask has written to the Rook-Court at Corvel Rise to say the tide-dead have started speaking before they lie down, and all of them say the same seven words. She has not written the words down. She says they should be heard, not read.`,
  },
  {
    key: 'coldwater',
    type: 'location',
    name: 'Coldwater',
    players: true,
    parent: 'grimmark',
    summary: 'The last village before the ice, where a hot spring keeps a harbour open and a shrine to Tharos sits on a stone that was once a man.',
    fields: [
      { key: 'Population', value: 'about 250' },
      { key: 'Notable for', value: 'the Warm Harbour, the Kneeling Stone, amber' },
    ],
    tags: ['village', 'coast'],
    body: `Coldwater is misnamed: a hot spring comes up under its harbour and the water steams all winter, which is why there is a village here at all. Amber washes up on its beach after storms and the Coldwater trade it south for grain. Their houses are half dug into the hillside and their winters are spent telling the same six stories.

Above the village stands the Kneeling Stone, a Lithic figure the height of two men, on one knee, head bowed, facing inland toward the mountains. The surface dwarves of the Holds say it is a saint of [[Tharos]] and have built a shrine at its feet. The Coldwater say it moved, once, in their great-grandmothers' time, and has not been quite in the same position since.

### Hook
The Kneeling Stone wept this spring. Clear water from the eyes for three days, not the spring's, cold as the Reach. The dwarven priest of the shrine sent a vial of it south to Hollowhall and another, by a halfling courier, to "the Warden at the Ninth Stone", an address the courier had never heard of. The courier was [[Kettle Brindlewake]]. She still has the vial.`,
  },
  {
    key: 'ilmareth',
    type: 'location',
    name: 'Ilmareth',
    players: true,
    parent: 'sael',
    summary: 'Seat of Sael, where the forest is oldest and the Circle sits under a tree the elves cannot remember planting.',
    fields: [
      { key: 'Population', value: 'about 20,000 elves, scattered through a valley of trees' },
      { key: 'Ruler', value: 'the Circle of Ilmareth' },
      { key: 'Notable for', value: 'the Archive of Skins, the Old Tree, polite silence' },
    ],
    tags: ['city', 'capital', 'forest'],
    body: `Ilmareth is not so much a city as a valley the elves have lived in for so long that the trees grew around them. Halls are grown rather than built; the paths are moss; and at the valley's head stands the Old Tree, which is older than the elves' arrival in Sael and which they will not discuss.

The Circle meets at the Tree's roots. Below them, in dry halls cut into the valley wall, is the Archive of Skins: the tanned and inked hides of elves who chose to leave their memory to Sael when they died, racked by century. The Remembrancers tend it. Whole racks are empty between 1050 and 1200 AW, and the Remembrancers say there was a fire.

### Hook
A rack in the Archive that has stood empty for nineteen centuries has a label again, in a modern hand: *Vey, S., living, in the Ashenreach*. Nobody on the Circle admits writing it. [[Aelith Sorn]] left for Cinderford a week later.

:::gm
There was a fire, and the Circle lit it: the skins of 1050 to 1200 AW recorded [[The Saelish Trespass]], and Sael chose to forget.
:::`,
  },
  // ───────────────────────────── The March of Cinders and Cinderford ─────────────────────────────
  {
    key: 'march-of-cinders',
    type: 'location',
    name: 'The March of Cinders',
    players: true,
    parent: 'ashenreach',
    summary: 'The western strip of the Ashenreach along the river Cinder: the only part anyone still farms, garrisoned from Cinderford.',
    fields: [
      { key: 'Population', value: 'about 4,000: 2,800 in Cinderford, the rest in steadings and camps' },
      { key: 'Ruler', value: 'the Reeve of Cinderford, in theory; the Ninth Lantern, in practice' },
      { key: 'Notable for', value: 'the ford, the Treaty Stone, the pear country that was' },
      { key: 'Dangers', value: 'greywinds, Glassers on the eastern road, the odd walking dead' },
    ],
    tags: ['region', 'march'],
    body: `> West of the river there is still grass, thin and grey-green, and the ash lies only in the furrows. East of it the grass gives up. The road runs straight out across the plain toward a smear on the horizon that might be weather and might be the Rent, and the only things standing between here and there are a leaning stone, a line of petrified trees, and the smoke of somebody's cookfire that you would be wise not to walk toward.

The March is what the Treaty of Ashes calls the land ten miles either side of the river Cinder, from the old pear country in the north down to the glasslands. It is the only part of the Ashenreach anyone has rebuilt, because the river is the only water that does not taste of ash. [[Cinderford]] holds the ford; a dozen steadings cling to the western bank; and east of the river a few hard families graze goats on the stubble and keep a bell on the door.

### What is here
- [[Cinderford]], the town, at the ford.
- [[The Treaty Stone]], three miles east on the Ash Road, where the war was signed away.
- [[The Weeping Orchard]], north-east along the old lane, what is left of the pear country.
- [[Corvel Rise]], the Raveler rookery on the hill south of town, above the burial ground.
- [[The House of Unburnt Light]], Iskaveth's mission, a mile out on the eastern road.
- [[The Ash Road]], which runs east to Fort Mercy and the Rent and is lost in every greywind.

### Who is here
[[The Ninth Lantern]] holds the ford under the treaty and patrols as far east as the Treaty Stone, further when paid, which is to say not lately. Reeve [[Odile Fairweather]] speaks for the townsfolk. The steading families answer to nobody and pay the company in goats. [[The Glassers]] come in from Fort Mercy to sell at Gutter Market and are tolerated as long as they leave their picks at the bridge.

### Rumours
- The Treaty Stone bleeds at red moon. (False. That is the Orchard.)
- The Regency is sending a new garrison to replace the Ninth. (False, so far.)
- There is a Lithic city under the whole March and the ford is its roof. (Truer than anyone likes.)
- The pear trees will fruit again when the lantern goes out. (Who knows.)

### Things to do
Escort a steading's goats across the ford. Walk the eastern patrol to the Treaty Stone and back before the wind turns. Help a family dig out after a greywind. Take a Glasser's coin to guide a dig. Carry a letter to the mission and see what the Sister offers for the trouble.

:::gm
The March is the campaign's home ground; everything in sessions 1 to 5 happens within a day's walk of the ford. Keep it small and familiar until the Rent expedition in session 6 makes the horizon suddenly real.
:::`,
  },
  {
    key: 'cinderford',
    type: 'location',
    name: 'Cinderford',
    players: true,
    parent: 'march-of-cinders',
    summary: 'A grey stone town at the ford of the river Cinder, rebuilt from ruin by people who expected to leave. The Ninth Lantern holds it, unpaid.',
    aliases: ['Cinders'],
    fields: [
      { key: 'Population', value: 'about 2,800, and 140 soldiers' },
      { key: 'Ruler', value: 'Reeve Odile Fairweather; garrison Captain Ilse Marrow' },
      { key: 'Notable for', value: 'the lantern that never goes out, the Battle of Cinders, the toll bridge' },
      { key: 'Dangers', value: 'tab-keepers, recruiters, glass-dust in the lungs' },
    ],
    tags: ['town'],
    body: `> The town comes out of the ash all at once: a hill with a squat keep on it, a river the colour of pewter, a bridge of new stone on old piers, and under the keep's wall a point of yellow light in an iron cage, small as a candle at this distance, that does not flicker. Below it the roofs are grey slate, grey thatch, grey canvas. Somebody is ringing a bell. Somebody else is swearing at a goat.

Cinderford was a village of six hundred before the war, a ford and a mill and a chapel. The battle burned it to the footings. The people who came back built in grey stone because grey stone was what there was, and built square and plain because they did not mean to stay. Nine years on they are still here, and so is the company that was supposed to be relieved in a year.

### The quarters
- [[The Ford]], on the west bank around the toll bridge: the Treaty Bell, the company gatehouse, the Reeve's house, the counting-house.
- [[Lantern Hill]], above it: [[The Lantern Keep]], the drill yard, the lantern in its cage.
- [[The Smokes]], downwind to the south: tanneries, glass-dust workshops, the Hollowborn streets.
- [[The Low Quay]], along the river below the bridge: halfling barges, the floating market, everything that comes and goes without paying toll.
- [[Temple Row]], the lane along the hill's foot: a shrine to every god, and one to a dead one.

### Who runs it
Reeve [[Odile Fairweather]] runs the town, holds court in the Ford on Wardday, and has outlasted four company captains. Captain [[Ilse Marrow]] runs the Ninth Lantern, which is to say the walls, the bridge and the law east of the river. Between them is a courtesy that has worn thin in places. The Regency's man is Assessor [[Pell Quillon]], newly arrived, with forms. The Concord's is [[Grandmother Tollamund]], who arrived four years ago and has not been seen to stand up since.

### Rumours
- The company has not been paid since Reaping. (True, and worse: since 3009.)
- The Captain has been paying the men out of her own purse. (She will not discuss it.)
- The Reeve is selling the town. (The Reeve calls this slander.)
- The lantern went out for a moment last Frostcall and Brother Tallow lit it again from his pipe. (False. It has never gone out. Yet.)
- The Velvet Ledger knows what you did before you do. (More or less true.)

### Things to do
Sign on at the gatehouse. Drink on tick at [[The Last Candle]]. Lose money to [[Spoons Aldane]]. Buy salvage you should not at [[Gutter Market]]. Pray on Temple Row and be overheard. Watch the bridge at dawn, when the river is low and the piers show, and see what the night has caught against them.

### On 14 Ashfall 3011
The quarter-day pay wagon from Fallowden is twelve days late. Pallas is a night from full. The Ember is two. The river is lower than anyone remembers, and there is a dead man in the ford who was buried a week ago.

:::gm
Two of the rumours above are true: Marrow has paid the company from her own savings for a year and is nearly broke, and the Reeve has quietly agreed to sell the town's charter to the Concord (not in the way the gossips mean). Cinderford is built on the bones of a Lithic waystation; the Glass Barrow under the ford is its upper hall. The lantern on the hill is holding the Ninth Ward's crack shut, thirty miles away, and nobody in town knows it except, nearly, [[Brother Tallow]]. For the town's temper as the campaign goes on, see the Mutiny clock on the company page and the Sleepless clock in the Smokes.
:::`,
    gmNotes: `Run the town as a character: tired, funny, holding on out of habit. The bells ring the watches from the Keep; the Treaty Bell rings only for alarm or treaty business. Market day is Coinday. The Reeve's court is Wardday. Rents fall due at Pallas full, the 15th, which this month is the day after session 1 starts: everyone is short.`,
  },
  {
    key: 'the-ford',
    type: 'location',
    name: 'The Ford',
    players: true,
    parent: 'cinderford',
    summary: 'The quarter around the toll bridge on the west bank: the Treaty Bell, the company gatehouse, the Reeve\'s house and the counting-house. Where the town does its business and watches its river.',
    fields: [
      { key: 'Population', value: 'about 700' },
      { key: 'Notable for', value: 'the toll bridge, the Treaty Bell, the Reeve\'s court on Wardday' },
      { key: 'Toll', value: '1 cp a head, 2 cp a beast, 5 cp a cart; soldiers of the company free' },
    ],
    tags: ['quarter', 'bridge'],
    body: `> The bridge is new stone on old piers, five arches, and the river under it runs shallow and loud over a bed that glints when the sun hits it. On the near bank a square of grey houses leans in toward a bell on a post. A gatehouse with the company's lantern painted on the door, badly. A clerk at the bridge-head with a toll-box and the expression of a man who has heard every excuse. Beyond him, east, the ash begins.

The Ford is the oldest quarter and the only one with a square. The bridge crosses here because the river is shallowest here, and the river is shallowest here because something lies under it; before the bridge, carts crossed on the glassy shelf you can still see at low water, and the town's name is older than the town.

### What is here
- **The toll bridge.** Five arches, rebuilt 3003 on piers that survived the burning. Toll is taken on the west bank by the Reeve's clerk; the company's gatehouse holds the east end and searches what it likes. At low water the third pier shows a dark hollow at its foot where the river goes in and does not come out.
- [[The Treaty Bell]], on its post in the square, rung for alarm and for treaty business, and otherwise not.
- **The company gatehouse**, where recruits sign the book and the duty sergeant keeps the wanted bills. [[Mirrel Vosk]] is there most mornings, reading them aloud for the illiterate with commentary.
- **The Reeve's house**, grey and square like the rest but with glass in the windows, where [[Odile Fairweather]] holds court on Wardday and dines with whoever is useful on the other five.
- [[Tollamund & Daughters]], the Shellback counting-house, which bought the old mill-house in 3007 and has been quietly buying everything else since.
- [[The Assessor's Office]], one rented room above the cooper's, new this week, already full of paper.
- [[The Glass Barrow]] lies under all of it, though nobody but the Glassers and the drowned have been in.

### Who is here
The Reeve. The toll-clerk, Mistress Hebbe, who can tell a Concord coin from a Regency one by the sound. Sergeant Vosk and the gate-watch. Grandmother Tollamund and her three daughters, who are not her daughters. The Assessor and his clerk [[Ansel Mote]]. On market day, everyone.

### Rumours
- The toll-box takes more in a week than the company is owed in a month. (False. But not by much.)
- Tollamund's daughters are the same daughter three times. (False. Probably.)
- There is a door under the third pier and the drowned deserter went through it. (True.)
- The Reeve keeps the key to the Aurelan chapel on Temple Row and will not say why. (True; she has the only one.)

### Things to do
Pay the toll, or argue about it. Sign the gatehouse book. Watch Hebbe test a coin. Get summoned to the Reeve's table. Be weighed by the Shellbacks' slow eyes. Go down to the water at dawn and see what the river has caught against the piers.

:::gm
The dead man in the ford is [[Dannic Rook]], who drowned here on 7 Ashfall and was pulled out against the third pier with his lantern-oil tin gone and his boots full of glass-sand. He will not stay on the slab, or in the ground, or out of the river. The hollow under the pier is the way into the Barrow; see [[The Drowned Man]].
:::`,
  },
  {
    key: 'lantern-hill',
    type: 'location',
    name: 'Lantern Hill',
    players: true,
    parent: 'cinderford',
    summary: 'The hill above the Ford with the Keep on top, the drill yard below it, and the lantern in its iron cage on the wall, burning as it has for nine years.',
    fields: [
      { key: 'Population', value: 'about 300, mostly the company and its followers' },
      { key: 'Notable for', value: 'the Lantern of the Ninth, the drill yard, the watch-bells' },
    ],
    tags: ['quarter', 'hill'],
    body: `> The hill is not high but it is the only one, and the town climbs it in a lane of steps worn down the middle. Halfway up is a yard of beaten ash where forty people in mismatched armour are being shouted at. Above them, on the Keep's outer wall, hangs an iron cage the size of a beehive, and inside it a flame no bigger than a hand, yellow, steady, not moving in a wind that is moving everything else.

Lantern Hill is the company's ground. Townsfolk come up for the view, for the Last Candle at the hill's foot, and for the lantern, which everyone in Cinderford looks at once a day without admitting it, the way you check a sleeping child is breathing.

### What is here
- [[The Lantern Keep]], the company's house: a square tower, a hall, a kitchen, stores, and the oil-room where [[Brother Tallow]] sleeps beside his flame.
- **The drill yard**, where [[Mirrel Vosk]] turns recruits into something that will live a week, and where the company musters at dawn and sunset.
- **The lantern**, in its iron cage on the east wall, twenty feet up, reached by a ladder that is kept locked. See [[The Lantern of the Ninth]].
- **The followers' lines**, tents and lean-tos along the hill's south flank: washerwomen, a farrier, Spoons's betting table, children, dogs.
- [[The Last Candle]], at the foot of the steps, which is not technically the company's but might as well be.

### Who is here
Captain [[Ilse Marrow]], in the Keep. Lieutenant [[Garrick Sallow]], who has the east wall and makes sure you know it. [[Brother Tallow]] in the oil-room. [[Fennick Bottlebrook]] in the stores, with his ledgers and his three locks. Corporal [[Spoons Aldane]] wherever money is changing hands. [[Quorl Many-Words]], when there is a body, in the cold-cellar under the kitchen.

### Rumours
- The oil for the lantern is whale-oil from Keel and costs more than the company's bread. (True until this year.)
- Tallow has not slept in nine years. (He sleeps. Sitting up, with one hand on the cage.)
- Sallow has been seen coming out of the Assessor's Office after dark. (Sallow says he was lodging a complaint about the pay.)
- The pool on when the lantern goes out stands at forty-one gold. (It stands at forty-three.)

### Things to do
Muster at dawn. Be shouted at by Vosk. Be asked for a loan by Fennick and understand it is an order. Climb the locked ladder on a dare. Bet with Spoons. Sit with Tallow at night and listen to him talk to the flame as if it answered.

:::gm
Sallow's night visits to the Assessor's Office are real: he meets [[Ansel Mote]] there.

The flame's light is a fraction redder than it was a year ago; Tallow has noticed and Ysse will. The oil-room is where the cut oil was swapped in; see [[Who Is Poisoning the Flame?]]. The first time the flame gutters, at the end of session 1, every dog on the hill howls and the Ember seems, for a moment, brighter.
:::`,
  },
  {
    key: 'lantern-keep',
    type: 'location',
    name: 'The Lantern Keep',
    players: true,
    parent: 'lantern-hill',
    summary: 'The Ninth Lantern\'s house on the hill: a square tower, a hall that smells of boiled wool, and the oil-room where the flame is fed.',
    fields: [
      { key: 'Garrison', value: 'about 140 under arms, 60 followers' },
      { key: 'Commander', value: 'Captain Ilse Marrow' },
      { key: 'Notable for', value: 'the lantern, the oil-room, the contract nailed over the hall door' },
    ],
    tags: ['keep', 'fort', 'barracks'],
    body: `> Inside the gate the Keep is smaller than it looked from below. A yard the size of a farm's, a well, a square tower with its top storey still fire-blackened, and a long hall with the company's contract nailed to the lintel in a frame somebody made from a shield. The hall smells of wet wool, onions and lamp-oil. Someone is laughing in the kitchen. Someone is being sick behind the stables. Above it all, through a slit window on the east side, a steady yellow light.

The Keep was the old lord's tower, burned out in 3002 and roofed again by the company in the winter after. It has never been finished; nobody expected to need it finished. The contract over the door is the famous one: *the Company of the Ninth Lantern shall hold Cinderford for the signatories, and shall stand relieved when the lantern is relieved, and not before.* The soldiers' version is shorter: *we go when it goes.*

### Rooms
- **The hall.** Meals, musters, the captain's table on the dais, the company's eight battered lanterns of the other companies hung dark along the wall as a reminder.
- **The captain's room**, above the hall. A desk, a cot, a locked box that is nearly empty, and a window that looks east.
- **The oil-room**, in the tower's base, under the cage. Shelves of oil-tins, a trimming bench, a cot, and the ladder up to the cage through a trap. [[Brother Tallow]] lives here and [[Ysse Lampwright]] has been given the corner. Entry by Tallow's leave.
- **The stores**, three locks, [[Fennick Bottlebrook]]'s kingdom. Grain for three weeks. Salt for one. Arrows for a morning.
- **The cold-cellar**, under the kitchen, where the dead wait for [[Quorl Many-Words]] and the burial cart.
- **The barracks**, the long shed against the north wall. Straw, snoring, a hundred and forty people's worth of smell.
- **The east wall walk**, Lieutenant [[Garrick Sallow]]'s post, with the best view of the ash and the cage.

### Who is here
Everyone who matters in the company, at one time or another in the day. [[Ilse Marrow]] at the table at dusk. [[Mirrel Vosk]] in the yard at dawn. Fennick in the stores at all hours, counting. Tallow, always.

### Things to do
Eat. Be issued kit that does not fit. Hear the contract read aloud, as it is to every recruit, by Vosk, in a voice that makes it sound like a dirty joke. Be sent down to the cold-cellar with a body and come back changed.

:::gm
The oil-room is the crime scene for session 1: the tins are supposed to be sealed Keel whale-oil, and three of the last dozen have been opened and resealed with a Cinderford chandler's wax. See [[The Cut Oil Tin]] and [[Hesk's Chandlery]]. The locked box in the captain's room holds eleven gold and a letter from Sorrel Vey.
:::`,
    gmNotes: `Use the hall for the company's big scenes: payday-that-is-not, Sallow's speeches, the captain standing up slowly. The eight dark lanterns on the wall are a good thing to have a veteran point out to a recruit on their first night.`,
  },
  {
    key: 'the-smokes',
    type: 'location',
    name: 'The Smokes',
    players: true,
    parent: 'cinderford',
    summary: 'The downwind quarter: tanneries, glass-dust workshops, and the streets where the Hollowborn families live. Where the town keeps what it does not want to look at.',
    fields: [
      { key: 'Population', value: 'about 900' },
      { key: 'Notable for', value: 'glass-dust, tanneries, the Hollowborn, the Sleepless' },
      { key: 'Dangers', value: 'the dust-cough, the dreams, a knife in an alley after red moon' },
    ],
    tags: ['quarter', 'slum'],
    body: `> You smell it before the lane turns: tan-bark and piss and something sweeter, the hot-sugar stink of the glass-dust kilns. The houses here are lower, built of whatever came off the plain, ash-brick and glass-slag and old shield-boards. Children in the lane have one pale eye each, and look at the space beside you a moment longer than they look at you.

The Smokes is the south end of town, downwind of everything, and it is where Cinderford puts its tanneries, its kilns, its poor, and the families that were born here the night of the battle and after. Nearly every Hollowborn in the March lives in these six lanes. So does the glass-dust trade: Glassers bring in slag from the plain, the kilns grind and sift it, and the dust goes down the river for glaziers and alchemists who do not ask where it came from.

### What is here
- **Tanners' Lane**, the river end, the smell, the vats.
- **The kilns**, three of them, running day and night, with a dust-haze over the lane that gives everyone the cough by thirty.
- [[Hesk's Chandlery]], where the town buys its candles and the Keep, until this year, bought its oil.
- [[The Ninepenny]], the doss-house, where beds are nine pennies and dreams are free.
- **The Widow's yard**, a walled court at the lane's end where nobody goes after dark except those who do.
- **Marlowe's**, the house [[Tibbet Marlowe]] was born in, still standing, still his.

### Who is here
The Hollowborn families: the Marlowes, the Teals, the Crannocks, forty households that keep their own counsel and bury their own. Hesk the chandler. Auntie Brace at the Ninepenny. And somewhere, not in any house you can point to, [[The Dreaming Widow]], who speaks in the Widow's yard on the nights the Ember is near full, and whom the company has never managed to arrest because nobody will say which door she went in.

### Rumours
- The Hollowborn all dream the same dream. (True, at red moon.)
- The Widow is the Reeve's sister. (False. She is somebody else's.)
- The kilns' dust is what gives the children the eye. (False. They were born with it.)
- The dead walk the Smokes at red moon and the Hollowborn go out to talk to them. (True.)
- The Sleepless are harmless: sad people who want to sleep. (They were, once.)

### Things to do
Buy candles. Be looked at by children. Help a kiln-hand who has collapsed in the dust. Hear the Widow preach, from a doorway, with your hood up. Follow someone from the yard and lose them in a lane that was not there yesterday. Be recognised, if you are Hollowborn, by people who knew your mother.

:::gm
[[The Sleepless]] meet in the Widow's yard; their clock ticks here. The Widow is [[Marla Marlowe]]'s sister and Tick's aunt, and she knows it before he does. At the full red moon in session 3 the whole quarter dreams together and walks out onto the plain in its sleep; the company's attempt to stop it is where the town's goodwill breaks or holds.
:::`,
  },
  {
    key: 'low-quay',
    type: 'location',
    name: 'The Low Quay',
    players: true,
    parent: 'cinderford',
    summary: 'The riverbank below the bridge: halfling barges, a floating market, and everything that enters Cinderford without paying toll.',
    fields: [
      { key: 'Population', value: 'about 400 ashore, and whatever is moored' },
      { key: 'Notable for', value: 'the barge clans, the floating market, letters from anywhere' },
      { key: 'Dangers', value: 'falling in, being sold something, being sold' },
    ],
    tags: ['quarter', 'docks'],
    body: `> Below the bridge the bank drops to a strip of mud and planking crowded with barges, long and low and painted every colour the ash has not yet got to. Halflings move between them on gangplanks without looking down. A floating market of punts and rafts is tied up along the outside, selling river-fish, Fallowden wine, Concord salt, Grimmark wool and things in sacks. A woman the height of your elbow is explaining to a soldier that no, the price is the price, and yes, she knows who his captain is, and she liked her better before she was broke.

The Low Quay is where the Cinder comes in from the north and goes out to the south, which is to say it is where everything else does too. The toll bridge above takes a penny a head; the Quay takes nothing, asks nothing, and remembers everything. [[The Barge Clans]] run it. The Brindlewakes are the clan in residence this year, and [[Kettle Brindlewake]]'s barge, [[The Grey Dumpling]], is moored at the best berth, by the stair.

### What is here
- **The floating market**, every day but Restday, best on Coinday. Food, cloth, salt, wine, tools, letters.
- [[Gutter Market]], ashore at the Quay's downstream end, where the Glassers sell what they dig.
- [[The Cinder Ferry]], a rope-punt below the market, for those who will not pay the bridge.
- **The Brindlewake berth** and the Grey Dumpling.
- **The post-stair**, a cut in the bank where letters are left in a box under a tarpaulin and picked up by whichever barge is going the right way. It works. Nobody knows how.

### Who is here
Kettle, when she is in. Her cousins. Old Nan Crupp at the ferry. The Market Reeve of Gutter Market, Tam Sixfingers, who is a Glasser and counts as the Quay's only law. Soldiers off duty. The occasional Quiet Office clerk pretending to buy fish.

### Rumours
- The barges carry more Concord silver up the river than the Regency has minted in a decade. (True.)
- There is a passage from the Quay into the Barrow under the ford and the smugglers use it. (True; Kettle's people know it.)
- Kettle sells to the Saint's mission, the Reeve, the Glassers and the Keep, and tells each what the others bought. (True, though she edits.)
- The post-stair box has never lost a letter. (False. It lost one, in 3009. It was the pay order.)

### Things to do
Buy supper. Send a letter home. Hire a barge. Ask Kettle a question and pay for the answer in gossip. Watch a Concord factor count out silver to a Glasser for a crate that hums. Find out what the price of the ferry is, and why it is in last words.

:::gm
Kettle likes the PCs best of all her customers and will say so, which is worth more than it sounds. The smugglers' passage from the Quay's culvert into the Barrow (area 6, the Sump) is how Dannic Rook got in, and it is how the PCs can get out if the Drowned Step floods. She has the vial of water from the Kneeling Stone at Coldwater and no idea what to do with it.
:::`,
  },
  {
    key: 'temple-row',
    type: 'location',
    name: 'Temple Row',
    players: true,
    parent: 'cinderford',
    summary: 'The lane along the hill\'s foot where Cinderford keeps a shrine to every god, one to a dead one, and one it does not admit to.',
    fields: [
      { key: 'Population', value: 'about 200, priests and the people who live off them' },
      { key: 'Notable for', value: 'eleven shrines, a locked chapel, a gallows post with flowers on it' },
    ],
    tags: ['quarter', 'temple'],
    body: `> The lane curves along the hill's foot and every third door is a god's. Most are the size of a cowshed. A hearth with a kettle always on it; an anvil under a tin roof with a bucket of nails for offerings; a stone the size of a cart, undressed; a bucket of salt water; a dead tree with ribbons. At the far end a doorway of black stone with no door in it, and a crow-headed figure in a grey robe sweeping the step. Halfway along, a bigger building with a red door and lamps lit in daylight, and the sound of a lute.

Temple Row grew because soldiers from eight companies, then one, wanted somewhere to swear at their gods, and Cinderford obliged. Nothing here is grand. Everything is used.

### The shrines
- **Maelis**: the hearth-house, a kettle, Mother Brisk, soup for anyone. The most visited. The town's birth-rolls are kept here too, in a chest under the kettle-shelf; anyone who stirs the soup may read them.
- **Grum**: the anvil under the tin roof. No priest; the company's farrier says the words. Offerings are nails and curses.
- **Corvex**: a lectern and a ledger, kept by Brother Audit, a Concord counting-priest who writes down what you pray for and reads it back on Wardday.
- **Sefra**: a bucket of salt water carried from Sevenhaven in 3003 and topped up with tears, allegedly.
- **Orvanne**: a dead tree with ribbons. Nobody tends it. It is always tidy.
- **Tharos**: an undressed stone the surface-dwarf masons brought in. The Returned do not go near it.
- **Aurelan**: a proper little chapel with a sunburst door, locked since 3002. The Reeve holds the key.
- [[Isaurana]]: [[The Velvet Ledger]], the red-doored house with the lute, which is a temple whatever the Reeve says.
- [[Hathe]]: [[The Doorkeeper's Chapel]], the black doorway, the Ravelers.
- [[The Hanged Corporal]]: [[The Corporal's Gibbet]], a gallows post at the lane's end with flowers at its foot, which nobody put up and nobody will take down.
- [[The Unburnt Saint]]: a lamp in a niche in the hill wall, lit every night by nobody anyone has seen.

### Who is here
Mother Brisk. Brother Audit. The Ravelers under [[Mother Corvane]]. [[Sorrel Vey]] and her house. Soldiers at all hours, drunk and sober. Pilgrims on their way to the Treaty Stone, looking for a bed.

### Rumours
- The Aurelan chapel is locked because the Emperor's ghost is in it. (False. It is locked because the Reeve took its plate to pay for the bridge.)
- Brother Audit's ledger of prayers is read by the Quiet Office. (False. By Tollamund.)
- The lamp in the Saint's niche is lit by Sister Seraphine herself, walking in from the mission every dusk. (False. It is lit by a kiln-girl from the Smokes whose brother came home from Halcyra.)
- Pray at the Gibbet and your sergeant will take the punishment meant for you. (It has happened twice.)

### Things to do
Eat Mother Brisk's soup. Swear at Grum. Have a prayer written down and regret it. Tie a ribbon on the dead tree and come back next day to find it gone and a pear-stone in its place. Read the birth-rolls for 3002 and find six names dated the night of Cinders, each with a column of heights in the margin, measured every red moon, that climbs twice as fast as any other on the page and then stops. Knock on the red door. Stand in the black doorway and feel the draught that has no source.

:::gm
Every priest on the Row except Brisk and the Ravelers is nudging, gently, toward the crack being opened; they do not know why they think it would be merciful, and the GM does. The dead tree is a cutting from the Weeping Orchard and is not entirely dead. The six names in the birth-rolls are the Cinders-born ([[Why did the Cinders-born grow up so fast?]]); Tick is the fourth.
:::`,
  },
  {
    key: 'ash-road',
    type: 'location',
    name: 'The Ash Road',
    players: true,
    parent: 'march-of-cinders',
    summary: 'The old imperial road east from the bridge across the plain to Fort Mercy and the Rent. A greywind buries it in an hour; the company re-stakes it every spring.',
    fields: [
      { key: 'Distances', value: 'Treaty Stone 3 mi; House of Unburnt Light 1 mi; Fort Mercy 22 mi; the Rent\'s western end 38 mi' },
      { key: 'Dangers', value: 'greywinds, losing the stakes, Glassers, things that walk at red moon' },
    ],
    tags: ['road'],
    body: `> From the east end of the bridge the road goes straight out, imperial-straight, into the grey. Every fifty paces a stake with a rag on it. For a mile there are hoof-marks and cart-ruts and the smoke of the mission off to the right. Then the ruts stop, and it is you and the stakes and a wind that has started to pick up the surface of the plain and carry it, knee-high, east.

The Ash Road was the old road from Fallowden to the pear country and the eastern downs. The battle did not break it, just buried it, and every spring the company sends a work-party out with a cart of stakes to find it again. By Ashfall half the stakes are gone. Travellers go in groups, roped, with a bell at the front and a bell at the back, and if the wind comes up they stop where they are, sit with their backs to it, and wait.

### Along the way
- **One mile**: [[The House of Unburnt Light]], off the road to the south, with its lamps and its garden.
- **Three miles**: [[The Treaty Stone]], where the staked road ends and the company's patrol turns back.
- **Six miles**: the Burned Mill, a landmark, nothing else.
- **Twelve miles**: the first of the glasslands; the road runs over a sheet of fused black glass for two miles, and in the glass are shapes.
- **Twenty-two miles**: [[Fort Mercy]], on its rise, the Glassers' lamps visible on a clear night.
- **Thirty-eight miles**: the western end of [[The Rent]]. The road goes to the lip and stops.

### Rumours
- The stakes move. (False, mostly. The Glassers move them.)
- If you count the stakes and get a different number coming back, do not look behind you. (Soldiers' nonsense. Count anyway.)
- There is a pear tree still alive at the Burned Mill. (True, and it has one fruit on it.)

:::gm
Use the Greywind Weather table every half-day on the road. A party caught in a full greywind without a rope loses someone for 1d4 hours (DC 12 Survival to find them, DC 15 after dark). At the glasslands crossing, Hollowborn characters see the shapes in the glass turn their heads.
:::`,
  },
  // ───────────────────────────── Cinderford: buildings and shops ─────────────────────────────
  {
    key: 'last-candle',
    type: 'shop',
    name: 'The Last Candle',
    players: true,
    parent: 'lantern-hill',
    summary: 'The soldiers\' tavern at the foot of Lantern Hill. Nobody\'s tab is ever settled; the book of debts is longer than the contract.',
    fields: [
      { key: 'Keeper', value: 'Hesper Hennet, called Mother Hennet: one arm, formerly the company cook' },
      { key: 'Hours', value: 'dawn muster to the third night-bell; never closed on a payday, which has not been tested' },
      { key: 'House rule', value: 'No blades on the table. No politics after the second bell. Tabs are kept, not paid.' },
    ],
    tags: ['tavern', 'shop'],
    body: `> Low room, long table, a fire that is mostly ash. Forty soldiers in various states of off-duty. On the wall behind the bar hangs a lantern with no flame in it, draped in black, and under it a slate the size of a door, chalked edge to edge in columns of names and numbers. Beside it, on a shelf, a stuffed crow wearing a corporal's hat. By the bar, nailed up where the drinkers queue, a wanted bill with a bad drawing of a man's face, signed at the bottom in a neat clerk's hand: A.M. The woman behind the bar has one arm and uses it to pour, point, and stop fights, apparently at once. Somebody is singing the one about the Corporal. Somebody else is betting against the singer finishing it.

The Candle was the first building rebuilt after the battle, before the Keep had a roof, because the surviving cook of the Ninth decided her people needed somewhere to drink more than somewhere to sleep. She was right. Hesper Hennet, whom everyone calls Mother Hennet, lost her arm at Cinders and the company's quartermaster's post to [[Fennick Bottlebrook]] shortly after, and has never once let anyone forget either. The dark lantern over the bar is the Ruddy Hundred's, the Seventh Company on the wall that night. She ran their kitchen, before. The company's story says she lit the ninth lantern; she says it was the soup that did it.

The slate is the Candle's famous thing. Every soldier who has ever drunk here is chalked on it, the dead included, and nothing on it is ever rubbed out; when a column fills Hennet copies it into a book under the bar and starts the column again beneath the old one, smaller. The company's pay has been late so often that the slate is, in effect, the only honest account of what the Ninth Lantern is owed, and Hennet knows it. When the Concord's clerks came asking to see the book she told them the price was an arm.

The crow in the corporal's hat was alive once and belonged to the Seventh's sergeant-major; it outlived him by six years and died on the bar, and Hennet had it stuffed because, she says, it was the only one in the company who never ran a tab. It faces the door. The wanted bill beside it went up on the 9th, for [[Dannic Rook]], deserter, with a reward of two silver nobody has claimed and the initials of a clerk nobody can place.

### Menu
- Small beer, 1 cp a jack. The water tastes of ash; the beer tastes of ash and hops.
- Fallowden red, 4 cp a cup, 2 sp the jug, "and don't ask what year".
- Grimmark whey-spirit, 6 cp a thimble. Called "the Returned" because you come back without your shadow.
- Keel oil-fish stew, 3 cp a bowl, with bread. Better than the Keep's.
- Goat, when there is goat, 8 cp.
- Pear brandy, 1 sp a thimble, from the last cask of the pear country. Thirty-one measures left; Hennet counts aloud.
- A bed in the loft, 5 cp, two to a pallet, three on a payday.

### Who is here
[[Mirrel Vosk]] at the end of the long table most nights, holding court on the deaths of recruits. [[Spoons Aldane]] running the book on anything. [[Garrick Sallow]], rarely, buying rounds he cannot afford and watching who drinks them. The Captain never; her credit is in the book like everyone's. Veterans with the Cinders look. New recruits learning the songs.

### Rumours (see Last Candle Rumours)
- Mother Hennet is owed more by the company than the Concord is. (Possibly true.)
- The crow in the hat talks at red moon. (It has not yet. Spoons is taking bets.)
- The dark lantern over the bar lit itself the night of Cinders, once, for a breath. (She says so, sober.)
- Spoons has a side-book on who dies next. (True. He does not take bets on the Captain.)
- The pear brandy is the Ember's colour because the cask was in the orchard that night. (True about the cask.)

### Things to do
Drink on tick. Hear the contract explained by a drunk. Learn the Corporal's song and its forty verses. Be challenged by Vosk to say something funny about your own death. Read the slate and find a name you did not expect: Dannic Rook's, with a chalk line through it, the only mark of its kind on the whole wall. Ask her who did that and watch her face. Read the wanted bill, and wonder who A.M. is and why a Regency clerk is posting rewards for a mercenary's deserter.

:::gm
Hennet crossed out Dannic's name herself the day they pulled him out, because he had paid his tab two days before he ran: in Concord silver, which she still has in a cup under the bar. The wanted bill is the handout [[Wanted: Dannic Rook]], posted by [[Ansel Mote]] in the Assessor's name; Pell did not authorise it and does not know it exists. It is the first Concord coin anyone in the company has handled, and the first clue of session 2 lying in plain sight in session 1.
:::`,
    gmNotes: `Mother Hennet's voice: dry, Grimmark, never raises it. She calls everyone by their tab total ("Evening, four-and-six"). She was in the Seventh and knows exactly how a company dies; she is watching the Ninth for the signs and will say so to a PC she likes, once. She knew old Halloran Pike for the deserter of the legend the night he signed on, and has never said; he drinks free. When Pike dies (session 5) she shuts the Candle for the night, the first time it has ever closed.`,
  },
  {
    key: 'velvet-ledger',
    type: 'shop',
    name: 'The Velvet Ledger',
    players: true,
    parent: 'temple-row',
    summary: 'Isaurana\'s house on Temple Row, red door and lamps lit by day: a pleasure-house that trades in secrets and keeps better accounts than the bank.',
    fields: [
      { key: 'Keeper', value: 'Madame Sorrel Vey, priestess of Isaurana' },
      { key: 'Hours', value: 'dusk to dawn; the front parlour from noon for tea, conversation and confession' },
      { key: 'House rule', value: 'Nothing leaves the house that was not paid for. Nobody is touched who has not asked. Weapons at the door; so are names, if you prefer.' },
    ],
    tags: ['temple', 'pleasure-house', 'shop'],
    body: `> The red door opens on warmth and a smell of black resin and oranges. Lamps in red glass. Rugs on a floor that is, under them, the same grey stone as everywhere else. A long low room with couches, a lute, and a dozen people in good cloth and bad, talking quietly. Behind a desk by the stair sits a tall elf with ink on every inch of visible skin, writing in a ledger with a very fine pen, and she looks up at you as if she has been expecting you and is pleased, on the whole, that you came.

The Velvet Ledger is a temple of [[Isaurana]], the Veiled, who is the goddess of night and secrets and wanting things, and it is also what everyone calls it. Both are true and [[Sorrel Vey]] sees no contradiction. Her people, a dozen of every ancestry, are priests of a sort; what happens upstairs is a sacrament of a sort; and the ledger on the desk, in which every visit, every confidence and every debt is recorded in a cipher only she reads, is the holiest object in the building.

The house's real trade is knowing. People say things here. They are encouraged to. Madame Vey sells what she knows carefully, by the drop, never to the person it would hurt most, and the Reeve, the Captain, the bank and the mission all pay her retainers without admitting it to each other.

### Menu
- Tea in the parlour and an hour's conversation with one of the house, 2 sp. Confession to the goddess, free, and recorded.
- An evening upstairs, 1 gp and up, by arrangement, with anyone willing. The house takes half and the goddess a tithe.
- A night in the Blue Room, which is soundproof, 5 gp, no questions, one question answered.
- Qal Merrow resin for the lamp, 3 sp a knuckle; dreams come easily and are sometimes not yours.
- A secret: price by weight. Madame Vey decides the weight. Payment in coin, or in a secret of equal weight.
- A letter delivered unopened to anyone in the March, 5 sp, by a barge-clan runner who owes the house.

### Who is here
Madame Vey. Her second, a Raveler called Mourn who tends the door and laughs at the wrong things. The house: Perrow from Fallowden, Tesh who was a Glasser, two Iskavethi who left Halcyra, a Vesh boy who plays the lute and watches the lamps. [[Garrick Sallow]] on Coinday nights. The Assessor's clerk [[Ansel Mote]], once, who paid for tea and asked nothing, which Vey found interesting. The Captain, by the back stair, which the whole town knows and pretends not to.

### Rumours
- Madame Vey is three hundred years old and cannot read her own skin. (True, both.)
- The Blue Room has a listening pipe. (True; the goddess listens.)
- Vey has a book that names every spy in town. (False. She has a suspicion or two, which is not the same.)
- The Captain is paying the company with Vey's money. (False. Vey offered. Marrow refused. Twice.)

### Things to do
Confess, and be told what it was worth. Buy a secret and discover it was about you. Sit in the parlour long enough to see who uses the back stair. Be asked, very gently, by an elf with ink to her eyelids, whether anyone in your party reads old scripts.

:::gm
Vey's tattoos record [[The Saelish Trespass]]: she was inked as a child by a grandmother who chose not to burn the record, and she has never been able to read it. [[Aelith Sorn]] can, partly, and has been courting her for a month. The Saint's envoy has also come to tea. Vey plays all three against the fourth, which is her own curiosity. Session 4 lives here.
:::`,
    gmNotes: `Vey is amused, patient, and uses silence as a tool. She likes people who tell the truth badly. She loves Ilse Marrow, has told nobody, and would burn the ledger for her, which is the one thing she must never say out loud. The house treats every PC as a potential source; the players should feel seen, flattered, and slightly fleeced.`,
  },
  {
    key: 'tollamund-house',
    type: 'shop',
    name: 'Tollamund & Daughters',
    players: true,
    parent: 'the-ford',
    summary: 'The Shellback counting-house in the old mill by the bridge, which holds the company\'s debts, the town\'s debts, and lately everyone else\'s.',
    fields: [
      { key: 'Keeper', value: 'Grandmother Tollamund, 340 years old; her three "daughters" do the talking' },
      { key: 'Hours', value: 'Coinday to Wardday, the second bell to the fourth, slowly' },
      { key: 'House rule', value: 'All business in writing. All writing in triplicate. No business in a hurry.' },
    ],
    tags: ['bank', 'shop'],
    body: `> The old mill has thick walls and small windows and the millrace still runs underneath it, so the whole building hums very faintly. Inside, a counter of polished black wood, three clerks in grey, and behind them, in a chair built to hold her, a Shellback the size of a cart, her shell dull green and scored with age, her eyes half closed. She turns her head toward you. It takes a while. When she speaks, each word arrives alone and waits for the next one.

Tollamund & Daughters is a branch of a Sevenhaven house older than the Concord. It opened in Cinderford in 3007 to "offer the garrison the convenience of credit" and within two years held the company's whole arrears, the Reeve's rebuilding loan, the kiln-masters' mortgages and the bridge. In 3009, when the Regency stopped paying, the house bought the Regency's debt to the garrison as well, at a discount, and became, on paper, the only signatory still paying for the peace. It does not say this often. It does not need to.

[[Grandmother Tollamund]] has not been seen to leave her chair. The daughters, Perrin, Odessa and Sal, are humans in their forties, sharp, courteous and perfectly interchangeable, and are her hands, voice and legs. They are not her daughters. They are not, the town suspects, anyone's.

### Stock
- Loans at a tenth per quarter, secured on anything. A soldier's pay-chit is accepted as security, which tells you what the house thinks of the Regency.
- Bills of exchange on any Concord house, 2% to draw.
- Strongbox space in the mill's old grain-vault, 1 sp a month a box. Several boxes are sealed with wax the daughters do not recognise.
- Coin changed at a 5% fee, Regency to Concord, "while the Regency coin lasts".
- Advice, free, slow, and usually correct.

### Who is here
The Grandmother. The daughters. A Vesh scribe called Fennel in the back, who is the only being in the building who moves quickly. On Coinday, half the town, standing in line to beg a fortnight.

### Rumours
- Tollamund owns the bridge. (True.)
- Tollamund owns the Reeve. (The Reeve says no.)
- The strongboxes in the vault hold the eight companies' original lanterns. (False. They hold something colder.)
- A Shellback can hear the river under the floor say your name before you give it. (She says so.)

### Things to do
Beg a loan. Be refused with great kindness. Change a Concord coin and watch Perrin's eyebrow. Ask the Grandmother a question and wait for the answer long enough that the clerks bring you a chair. Notice the old chart on the wall behind her, of a coast you half recognise, with the blank corner turned toward the room.

:::gm
By Frostcall Tollamund will own the Reeve, through the charter sale. She wants [[The Lantern of the Ninth]] itself: a ward-flame is, in Shellback belief, the key that opens the way back to [[The Ness of Thurm]]. The Debt called in clock ticks here. The sealed strongboxes hold Glasser salvage bound for Gilt: pieces of ward-glass from the Rent's edge, cold to the touch and humming, which she is collecting for the journey. [[Fennick Bottlebrook]] owes her personally and signs things for her he should not.
:::`,
    gmNotes: `Play Tollamund with real silences: count three before each clause. She is never rude and never hurried and she has already thought of whatever the PCs are about to say. The daughters finish each other's sentences and know everything the house knows. Fennel the scribe is bribable, in lamp-oil.`,
  },
  {
    key: 'doorkeepers-chapel',
    type: 'location',
    name: 'The Doorkeeper\'s Chapel',
    players: true,
    parent: 'temple-row',
    summary: 'The Ravelers\' chapel of dead Hathe at the end of Temple Row: a black doorway with no door, a draught from nowhere, and a ledger of last words.',
    fields: [
      { key: 'Keeper', value: 'Mother Corvane and the Rook-Court\'s priests in town' },
      { key: 'Hours', value: 'always; the door is the point' },
      { key: 'Notable for', value: 'the Doorway, the Ledger of Last Words, funerals done properly' },
    ],
    tags: ['temple', 'chapel'],
    body: `> A doorway of black stone, taller than a man, standing on the lane with the chapel built round it afterwards. There is no door in it, and through it you can see the chapel's back wall, plain grey, four paces off, and yet air moves through the opening steadily, out, as if from somewhere large. Inside, benches, a cold slab, a lamp, and shelves of narrow ledgers. Three figures in grey with the heads of crows, or masks of them, or something between, are washing a body with the unhurried competence of people who have done it ten thousand times. One of them is humming.

[[Hathe]] kept the doors between living and dead, and died at Cinders, and since then the dead do not always pass. The [[Ravelers]] kept his doors in life and keep them in death: a dead god's priests, doing a job that has got harder. The Chapel is the Rook-Court's house in Cinderford. Every body in the March comes here before it goes into the ground on Corvel Rise, and every one that still has breath when a Raveler reaches it has its last words taken down.

The Doorway is the old lintel of the Cinderford chapel of Hathe, the only thing that survived the battle standing. It was found upright in the ash with the ground glassed round it. The Ravelers say it is still a door. They do not say to where.

### What is here
- **The Doorway.** The draught through it is cold and smells faintly of pears.
- **The slab**, where the dead are washed, and where the drowned are laid when the ford gives them back. Lately the Rook-Court keeps someone sitting up with them.
- **This year's book** of the Ledger of Last Words, on a lectern by the slab: every dying sentence heard by a Raveler in the March since Hollowfrost, in order. The other forty volumes are in the bone-library at [[Corvel Rise]]. Not for sale. Not for reading, except by the Court.
- **The Court's room** upstairs, where [[Mother Corvane]] sits when she comes down from the Rise, with the book open and a pot of ink, and says nothing for hours.

### Who is here
Mother Corvane. [[Quorl Many-Words]], when the company has a body, which is often. Three or four Court priests at any time, and crows, actual crows, on the roof, who are either pets, kin or colleagues depending on which Raveler you ask.

### Rumours
- The Doorway leads to where Hathe is. (The Ravelers do not deny it.)
- Mother Corvane has already read the message in the last words and will not say. (Nearly true.)
- Hathe's own key is kept somewhere on the Rise and opens the Doorway. (It is on the Rise. What it opens is the question.)
- A body laid on the slab three days will speak once more. (True for some.)
- The Ravelers charge the dead for burial and collect in the next life. (A joke. Theirs.)

### Things to do
Bring a body. Hear a last word taken down and witness the signature. Ask what the Doorway is for and be told, "Later." Stand in the draught and smell the pears. Notice, if you are Hollowborn, the queue.

:::gm
Dannic Rook was washed on the slab on 7 Ashfall, buried on Corvel Rise on the 8th, and seen standing in the ford on the 13th with grave-ash still on him; the Ravelers have not tried to stop him, because you do not stop a man looking for a door. See [[The Drowned Man]]. The Rook-Court's clock ticks here. Corvane has guessed "the lamp is the lock" and is waiting for the last words that will tell her which lamp.
:::`,
    gmNotes: `Ravelers are funny; let them be. Deadpan, literal, fond of the living in the way of people who will tidy up after them. Corvane is the exception: she is very old, very tired, and speaks only when she has something to say, which makes the PCs lean in.`,
  },
  {
    key: 'assessors-office',
    type: 'location',
    name: 'The Assessor\'s Office',
    players: true,
    parent: 'the-ford',
    summary: 'One rented room above the cooper\'s in the Ford: three clerks, a Regency Fourth Assistant Under-Collector, and a mountain of forms, newly arrived to tax a company nobody has paid.',
    fields: [
      { key: 'Keeper', value: 'Assessor Pell Quillon; clerks Ansel Mote, Widow Pruitt and a boy called Nib' },
      { key: 'Hours', value: 'the second bell to the fifth, Coinday to Wardday; closed for "reconciliation" on Tideday afternoons' },
      { key: 'Notable for', value: 'forms in triplicate, the only honest Regency man in the March, a clerk nobody looks at twice' },
    ],
    tags: ['office'],
    body: `> Up a stair that smells of barrel-tar, a door with a brass plate screwed on crooked that morning: OFFICE OF THE ASSESSOR OF THE MARCH OF CINDERS, BY WARRANT OF THE REGENCY COUNCIL. Inside, one room, three desks, and paper. Paper in stacks, paper in crates, paper on the sill, a form pinned to the back of the door that says FORM 11-C: REQUEST FOR ADDITIONAL FORMS. A small round man in a grey coat too good for the room is sharpening a pen with enormous care. Behind him a thin clerk with a cold looks up, and down, and you forget his face before you have finished looking.

The Regency has not paid the Ninth Lantern since 3009, and this week it sent, by the same road the pay used to take, an assessor to collect the March's imperial tithe, arrears included. [[Pell Quillon]], Fourth Assistant Under-Collector of the Southern Marches, arrived on 11 Ashfall with two clerks, nine crates of forms, a warrant, and no escort, and rented the cooper's upper room because it was the only one in town with a lockable door and a view of the bridge.

He has been trying to assess the company ever since. The company has been trying to work out whether to laugh. The Captain has agreed to "receive the Regency's representative" on Hearthday and has not said what she will do with him when she has.

### What is here
- **Forms.** Imperial tithe schedules, garrison returns, livestock enumerations, a census form for the dead, and the one Pell is proudest of, Form 44-A, *Declaration of Non-Receipt of Imperial Funds*, which he intends to have the Captain sign so he can file it against the arrears and, he explains, "set the matter moving".
- **The strongbox**, empty but locked, as regulations require.
- **The window**, which looks straight down on the bridge and the gatehouse, and from which a patient man could count every coin that crosses.

### Who is here
Pell, who means every word. Widow Pruitt, who does the sums. Nib, who runs errands and is paid in biscuits. And [[Ansel Mote]], who copies, files, fetches, has a cold, and was in the Velvet Ledger's parlour on his first evening in town, and in the Last Candle on his second, and asked nothing in either, and tipped well.

### Rumours
- The Assessor is here to seize the lantern for the Regency. (False. He has a form for it, but he is here for the tithe.)
- He is Quiet Office. (False. He would be horrified.)
- He has been sent to die, so the Regency has a reason to send soldiers. (Possibly true, and not his idea.)
- The forms are the first Regency paper to reach Cinderford in two years and are therefore worth something. (True; Fennick has already asked for the blanks.)

### Things to do
Be assessed. Fill in Form 7 (Persons Under Arms, Mercenary, Foreign) and discover it has no box for "unpaid". Watch Pell defend the Regency to a room of soldiers with such obvious decency that nobody hits him. Notice that Mote's cough stops when he thinks nobody is listening. Count the crates: nine arrived, ten are in the room.

:::gm
Mote is the Quiet Office's assassin, in town to start a mutiny through [[Garrick Sallow]] and, if the lantern can be made to fail "naturally", to see that it does. He has already paid for a tin of oil at the chandlery in the office's name. Pell knows nothing; the tenth crate is Mote's, and holds a crossbow, three vials and a Regency seal Pell does not have. The Quiet Office clock ticks here. Pell's Form 44-A, if the Captain signs it, is a real lever: see session 2, [[The Missing Pay]].
:::`,
    gmNotes: `Pell is the comic heart of the campaign and must be played straight: he believes in the Regency the way Mother Brisk believes in soup. Let the players grow to protect him. Mote should be in the background of scenes before he is in the foreground of any; describe him once, blandly, and never again until it matters.`,
  },
  {
    key: 'gutter-market',
    type: 'shop',
    name: 'Gutter Market',
    players: true,
    parent: 'low-quay',
    summary: 'The salvage market at the downstream end of the Low Quay, where the Glassers sell anything they have dug out of the glass, and some things they should have left in.',
    fields: [
      { key: 'Keeper', value: 'Tam Sixfingers, Market Reeve, for the Glassers' },
      { key: 'Hours', value: 'Coinday and Tideday, dawn to dusk; some stalls after dark, for a different clientele' },
      { key: 'House rule', value: 'Everything sold as seen. Nothing taken back. Don\'t touch what hums.' },
    ],
    tags: ['market', 'shop'],
    body: `> Where the quay planking ends the bank is paved with something black and glossy that was once a street, and on it the Glassers have set out their blankets. Tarnished mail. Belt-buckles. Half a sword with the glass still on the blade like frozen water. A child's shoe. Pears, actual pears, grey and hard as flint, a copper apiece. A woman with six fingers on her left hand and a cudgel in it sits on an upturned helmet in the middle of it all, and when the arguments start she stands up, and they stop.

Everything in the glasslands belongs to whoever digs it out, says the Treaty of Ashes, which did not foresee the Glassers. They dig, and this is where they sell. Most of it is scrap: forty villages' worth of iron, pewter and bone, melted into glass and chipped out again. Some of it is better. Some of it is wrong, and the stall-holders who deal in wrong keep to the downstream end and trade after dark.

### Stock (see also Gutter Market Salvage)
- Scrap iron and bent mail, 2 cp the pound.
- A serviceable weapon with glass on it, 5 sp to 2 gp. The glass does not come off. Nobody has decided whether this matters.
- Company badges from the eight dark companies, 1 sp each; the Seventh's go for 5, because of Mother Hennet.
- Stone pears from the Orchard, 1 cp. They are warm at red moon.
- Glass-slag by the sack for the kilns, 1 sp.
- Fused coin-lumps, sold by weight as silver, 8 sp an ounce; sometimes there is gold in the middle.
- A Glasser's chart of a dig, 2 sp, usually false, sometimes stolen.
- After dark: ward-glass from the Rent's edge, cold, humming, 5 gp a shard and the seller will not hold it; glass-spider silk, 1 gp a hank, sharp as razors; a thing in a sack that moves, price on enquiry.
- Information about Fort Mercy, 1 sp a sentence, from Tam, who edits.

### Who is here
Tam Sixfingers, who keeps the peace with a cudgel and a memory for faces. Glassers in from the plain, dusty, loud, spending it. Kiln-masters' buyers. [[Kettle Brindlewake]]'s cousins, buying for the barges. Brother Audit, who audits the weights for Corvex and is tolerated. A Concord factor, now and then, who buys the humming things and does not haggle.

### Rumours
- Vexa Glassjaw sends her best finds here and keeps the worst. (Backwards.)
- Tam has six fingers because she touched ward-glass. (She had six when she was born. She says so, every market day.)
- The pay wagon's strongbox has been seen at Gutter Market. (Not yet.)
- A Glasser brought in a stone hand last Reaping that closed on him. (True; he still has the hand, and the hand still has him.)

### Things to do
Buy a sword with a story in it. Haggle with Tam and lose. Hold a shard of ward-glass and feel the lantern on the hill, thirty yards off, as a warmth on one side of your face. Be offered a chart to the Glass Barrow by a Glasser who has clearly been in it and clearly will not go back.

:::gm
The chart offered here is [[A Glasser's Chart]]; the Glasser is a Fort Mercy man named Skelt who went into the Barrow with Dannic Rook and came out alone. After-dark trade here is how [[The Glassers]] move ward-glass to Tollamund's vault and so to Gilt. Tam knows the Concord factor by name and will sell it for a favour, not coin.
:::`,
  },
  {
    key: 'treaty-bell',
    type: 'location',
    name: 'The Treaty Bell',
    players: true,
    parent: 'the-ford',
    summary: 'The bronze bell on its post in the Ford square, rung once at the signing of the Treaty of Ashes and since then only for alarm or treaty business.',
    fields: [
      { key: 'Notable for', value: 'rung nine times in nine years; the crack in the lip' },
      { key: 'Keeper', value: 'Dunny Pike, bell-ward, twelve years old, very serious' },
    ],
    tags: ['landmark', 'bell'],
    body: `> A post of black oak in the middle of the square, iron-strapped, and on it a bell the size of a barrel, green with weather and cracked a hand's width along the lip. A rope hangs from it, looped up out of reach and knotted. A boy sits under it on a stool with a stick across his knees, and looks at you as if you might be thinking of touching it.

The bell was the old Cinderford chapel's, dug out of the ash the week after the battle by cooks and walking wounded who wanted something to ring. It was rung at the signing of [[The Treaty of Ashes]], on the drumhead at the Treaty Stone, and brought back and hung here, and the Reeve's first ordinance was that it should be rung thereafter only for alarm or for matters of the treaty.

It has been rung nine times. Twice for greywinds that reached the walls. Three times for the dead walking in from the plain at red moon. Once when the Regency pay stopped, which the Reeve ruled a treaty matter. Once by a drunk, who was flogged. Once, nobody knows by whom, in the middle of the night of 2 Ashfall this year, a single stroke, with the rope still knotted up out of reach; the bell-ward swears he was awake.

### Who is here
Dunny Pike, who holds the post because his father held it, and his father is dead. He takes it seriously enough that the gate-watch have stopped teasing him. He knows everyone who crosses the square and is a better source than the toll-clerk, for the price of a pear.

### Rumours
- The crack in the lip happened the night of the battle, when the fire came. (True.)
- When the bell rings itself, somebody in the March has died who should not have. (It has rung itself once, and Dannic Rook deserted the next day.)
- The tenth ring will be the last. (Soldiers' talk.)

:::gm
The bell is a plain bell. The stroke on 2 Ashfall was the night the Keel bells rang under the water and the pay wagon left Fallowden with a Concord-paid escort; something tugged at every bell in the south that night and the GM need never say what. Ringing the Treaty Bell for the mutiny in session 7, or the march in session 3, is a strong beat: whoever rings it is claiming the treaty.
:::`,
  },
  {
    key: 'hesks-chandlery',
    type: 'shop',
    name: 'Hesk\'s Chandlery',
    players: true,
    parent: 'the-smokes',
    summary: 'The Smokes\' candle-and-oil shop, kept by a Vesh with the dust-cough. The town buys its candles here; the Keep, until this year, bought its oil.',
    fields: [
      { key: 'Keeper', value: 'Hesk Varro, Vesh, chandler' },
      { key: 'Hours', value: 'dusk to midnight, like any Vesh shop; knock in the day and wait' },
      { key: 'House rule', value: 'Cash. No open flames near the vats. Don\'t tap on the glass; he can hear you perfectly well.' },
    ],
    tags: ['shop', 'chandlery'],
    body: `> The shop is dark, which is how a Vesh likes it, and smells of tallow, beeswax and hot metal. Candles hang from the ceiling in bunches like onions. Along one wall, tins: Keel whale-oil stamped with the bell, Fallowden rape-oil, and a row of the chandler's own, sealed with grey wax and the mark of a moth. The chandler himself stands behind the counter with his antennae drooping, a tall grey Vesh with dust in the fine hairs of his face, and coughs into a cloth before he speaks.

Hesk Varro came to Cinderford with the Seventh Company's baggage as a lamp-boy and stayed when the Seventh did not. His shop lights the town: tallow for the Smokes, beeswax for the Reeve and the Ledger, lamp-oil for everyone. For eight years he was also the Keep's chandler, cutting and sealing the Keel oil that fed the lantern. In Thawmere this year the company, broke, stopped buying Keel oil and asked him to stretch it; he refused, loudly, and the contract went to the Keep's own stores and whatever [[Fennick Bottlebrook]] could get cheap. He has not forgiven anyone and says so to customers.

He is dying, slowly, of the kiln dust, and knows it.

### Stock
- Tallow dips, 1 cp for four. Smoke, stink, light.
- Beeswax candles, 4 cp each; the Ledger's red ones, 6 cp, by order only.
- Fallowden rape-oil, 2 sp the pint.
- Keel whale-oil, stamped, 6 sp the pint, "while it lasts, and it won't".
- Hesk's own blend, moth-sealed, 3 sp the pint; burns clean, smells faintly of pears, and he will not say what is in it.
- Lanterns, plain, 8 sp; a dark-lantern with a shutter, 2 gp.
- A Vesh lamp-trimmer's kit, 5 sp, which [[Ysse Lampwright]] will recognise as very good.

### Who is here
Hesk. His apprentice Mirrit, a Hollowborn girl of fourteen with one pale eye who does the day trade. Brother Tallow, once a month, to argue about wicks, which is how two old Vesh say they are fond of each other.

### Rumours
- Hesk's own blend has Orchard sap in it. (True; a drop a tin. He thinks it is a preservative.)
- He sold the lantern short measure for years and that is why it is failing. (False, and it makes him cough with rage.)
- The Keep has been buying oil from a Glasser. (False. Worse: from a Concord factor, through Fennick, at a very good price.)

### Things to do
Buy a dark-lantern for the Barrow. Ask Hesk about the Keep's oil and get twenty minutes on the subject. See his order-book, if he trusts you, with two entries in the last fortnight for sealed Keel tins at full price: one to Dannic Rook, on credit, unpaid, and one to "the Assessor's Office, paid in advance", by a clerk with a cold.

:::gm
Hesk did not cut the oil. The cut tin in the Barrow was his sealed Keel oil, opened, cut with ash from the plain and resealed with Hesk's own grey wax, which anyone could lift from his bin. Who did the cutting is the question of [[Who Is Poisoning the Flame?]]; the order-book is a lead, not an answer. [[Spoons Aldane]] saw it done.
:::`,
  },
  {
    key: 'ninepenny',
    type: 'location',
    name: 'The Ninepenny',
    players: true,
    parent: 'the-smokes',
    summary: 'The Smokes\' doss-house: a bed for nine pennies, a blanket for one more, and dreams for free, especially near the red moon.',
    fields: [
      { key: 'Keeper', value: 'Auntie Brace, Hollowborn, one milky eye and a ledger of who snores' },
      { key: 'Price', value: '9 cp a bed, 1 cp a blanket, 3 cp for the room with the door' },
      { key: 'Dangers', value: 'the dreams, lice, waking up with company' },
    ],
    tags: ['inn', 'doss-house'],
    body: `> A long low shed with a stove at one end and forty pallets in two rows, most of them full of sleeping kiln-hands, Glassers, pilgrims who could not afford Temple Row, and one orc with her boots on. The air is thick and warm and smells of bodies and wet ash. At the stove a stout woman with one clouded eye is writing in a book by candlelight, and without looking up says: "Nine for the bed, one for the blanket, and if you dream, you tell me what, that's the house rule."

The Ninepenny is the cheapest roof in Cinderford and the only one that asks about your dreams. Auntie Brace was born in the pear country and lost a husband and both sons at Cinders, and has kept the doss-house since because, she says, somebody has to count the sleepers. Her book records, beside every lodger's name, what they dreamed. Most nights it is nothing, or the usual. Three nights either side of a full Ember the entries start to match.

### What is here
- Forty pallets, a stove, a bucket.
- **The room with the door**, at the back, 3 cp, for anyone who needs to be alone, which Brace decides.
- **The dream-book**, nine years of it, on the shelf above the stove.

### Who is here
Brace. Whoever is poor tonight. A Sleepless or two, always, sleeping with their eyes open, which is the sign. [[Tibbet Marlowe]] slept here for a year when he could not stand his mother's house.

### Rumours
- Brace is the Dreaming Widow. (False. She has been asked. She laughed until she coughed.)
- The dream-book is what the Widow preaches from. (True. Brace lends it. She does not approve, and lends it anyway.)
- Sleep three nights at the Ninepenny at red moon and you wake up Hollowborn. (False. You wake up having dreamed their dream, which is worse.)

### Things to do
Sleep cheap. Read the dream-book over Brace's shoulder, and see the same words in forty hands. Wake at the third bell to find half the room sitting up, facing east, eyes open, breathing together.

:::gm
The dream-book is the best evidence in town of what [[The Hollowborn]] dream, and a quiet way to feed the players the Sleeper Dreams table. The matching entries say, in various words, a stone door, a lamp, a hand on the latch from inside. At the session 3 red moon the Ninepenny empties onto the plain at midnight, every sleeper walking.
:::`,
  },
  {
    key: 'cinder-ferry',
    type: 'location',
    name: 'The Cinder Ferry',
    players: true,
    parent: 'low-quay',
    summary: 'A rope-punt below the floating market for those who will not pay the bridge, poled by old Nan Crupp, who takes a penny or a sentence.',
    fields: [
      { key: 'Keeper', value: 'Nan Crupp, halfling, Barge Clans, eighty if a day' },
      { key: 'Fare', value: '1 cp, or something true you have not told anyone' },
      { key: 'Hours', value: 'first light to the Ember rising; never after' },
    ],
    tags: ['ferry'],
    body: `> A flat punt on a rope slung bank to bank, below the last barge, with a halfling woman in a tarred hat sitting in the stern smoking a pipe. The east bank is forty yards off. "Penny," she says, "or tell me something. No soldier's lies. Something you ain't said." She holds out a hand like a walnut.

The bridge takes a penny; so does the ferry, and the ferry does not have a gate-watch at the far end asking your business. The company tolerates it because the company uses it. Nan Crupp has poled it since the bridge was a wreck, and claims to have taken more secrets across the Cinder than the Velvet Ledger has in its book, "and cheaper".

She stops at dusk. Not sunset: the Ember. When the red moon clears the eastern plain she ties up and goes home, and no fare has ever changed her mind. Asked why, she says the river is somebody else's after dark.

### Rumours
- Nan sells what she hears to Kettle. (True; it is a clan arrangement. She sells it slowly and leaves out the names.)
- She once ferried the Emperor's murderer across, in 2981, and would not say which way. (She says so herself. Nobody has checked.)
- Something stands in the shallows under the third pier at Ember-rise and watches the punt. (True since the 7th.)

:::gm
Nan did once ferry someone across in 2981 whom she will not name; [[Grashka]] was in the Ashenreach that year. Nan ferried [[Dannic Rook]] east and back twice in the days before he drowned, and he paid in sentences both times. The first was "I know who waters the lamp." The second, coming back, was "I shouldn't have looked at it." She will give the PCs the first for a penny and the second for a secret of their own.
:::`,
  },
  {
    key: 'grey-dumpling',
    type: 'location',
    name: 'The Grey Dumpling',
    players: true,
    parent: 'low-quay',
    summary: 'Kettle Brindlewake\'s barge at the best berth on the Low Quay: sixty feet of painted larch, a parlour, a hold with a false floor, and the best gossip on the river.',
    fields: [
      { key: 'Master', value: 'Kettle Brindlewake, Barge Clans' },
      { key: 'Notable for', value: 'green and yellow paint, a cat called Regent, a hold that is bigger than it looks' },
    ],
    tags: ['barge', 'ship'],
    body: `> Sixty feet of larch painted green and yellow, broad in the beam and low in the water, moored at the quay stair with a plank out and a cat on the plank. The name on the bow, in yellow, is THE GREY DUMPLING, and the barge looks it. A tin chimney smokes from a cabin aft with real glass in its windows and a geranium on the sill. From inside, the sound of somebody laughing at her own joke, and the smell of frying.

The Grey Dumpling has been in the Brindlewake clan for four generations and in Kettle's hands for one, and it goes everywhere the Cinder goes and several places it does not: Fallowden, the Ardis, Sevenhaven and the bays, and up unnamed creeks into the grey lakes where the Hollowborn trade dried fish for salt. It carries letters, wine, wool, salt, people who would rather not be seen on the road, and, under the false floor of the hold, whatever pays.

### Aboard
- **The parlour**, aft: a stove, a table, four chairs, a shelf of letters tied with string and sorted by destination. Kettle serves tea and does business here, and the tea is always good.
- **The hold**, forward: cargo, bunks for six, and under the boards a space the size of a coffin, currently holding nothing, Kettle says.
- **Regent**, the cat, who hates everyone equally and is therefore trusted.

### Who is here
[[Kettle Brindlewake]]. Her cousins Dob and Marigold, who pole and say little. Passengers, sometimes; this week a Remembrancer's luggage, waiting for its owner, and a sealed box addressed to "the Warden, Ninth Stone", which nobody has claimed because nobody lives there.

### Rumours
- The Dumpling can get into the Barrow under the ford by a culvert from the Quay. (True: it is where the false floor's cargo used to come from.)
- Kettle carried the Concord's clerks' letters to Fallowden the week before the pay wagon vanished. (True. She read them.)
- Regent is a Quiet Office cat. (Nobody can prove otherwise.)

:::gm
Kettle is the campaign's best neutral: she knows a piece of nearly everything and likes the PCs best, which she will prove by telling them one true thing free each session. The sealed box for the Warden holds the vial of water from the Kneeling Stone at [[Coldwater]]; if the PCs carry it to [[Warden Uthrem]] in session 6, he weeps, and the ward holds one month longer.
:::`,
  },
  {
    key: 'corporals-gibbet',
    type: 'location',
    name: 'The Corporal\'s Gibbet',
    players: true,
    parent: 'temple-row',
    summary: 'A gallows post at the end of Temple Row with flowers at its foot: the soldiers\' shrine to the Hanged Corporal, which nobody put up and nobody will take down.',
    fields: [
      { key: 'Keeper', value: 'none; the soldiers' },
      { key: 'Notable for', value: 'flowers that are always fresh, a noose that is always new, prayers that are starting to work' },
    ],
    tags: ['shrine', 'landmark'],
    body: `> Where the lane runs out at the hill's end there is a gallows post, a single upright with an arm, grey and weathered, and from the arm hangs a noose of new rope. At its foot, in the ash, a heap of flowers, a tin cup, three company badges, somebody's boot, and a scrap of paper weighted with a stone that says, in soldier's capitals, SAID NO.

Nobody built it. One morning in 3005 it was there, a gallows post at the end of Temple Row, and under it a bunch of grey plain-flowers, and the Reeve ordered it taken down, and the work party sent to do it came back and said they would rather not. It has stood since. The noose is replaced by hands unseen whenever it frays. The flowers are always fresh and nobody in the March grows flowers.

[[The Hanged Corporal]] was a corporal hanged at Dunmeer in 2996, six years before Cinders, for refusing to burn a village. The village burned anyway. Soldiers started praying to him out of spite, the way you spit on an officer's grave, and it has begun, very quietly, to work. A prayer at the Gibbet is a refusal: *I won't*. Twice in the company's memory a sergeant has woken up with the welts of a flogging meant for the ranker who prayed.

### Who is here
Soldiers, at night, alone, who do not talk about it. [[Mirrel Vosk]], once a year, on the eve of the battle's anniversary, with a bottle. [[Varra Nine-Knuckles]] will find, if she comes here, that an orc's refusal of a contract is the kind of prayer the Corporal hears.

### Rumours
- The Corporal was from the Ninth. (The Ninth did not exist. He was from the First, which is why Marrow will not speak of it.)
- Pray here before a mutiny and the mutiny fails. (Or succeeds. The Corporal was not fussy about which side was giving orders.)
- Touch the noose and you will be hanged yourself within the year. (Nobody has tested it sober.)

:::gm
The Corporal is ascending on refusal and is the one ascending power in the campaign with no interest in the crack. A PC who prays here before a defining refusal (Varra turning down the Mothers again, anyone refusing the Saint, the company refusing Sallow) gets advantage on the roll that follows, once per session, and the GM should describe the rope creaking.
:::`,
  },
  // ───────────────────────────── The Glass Barrow (session 1 dungeon) ─────────────────────────────
  {
    key: 'glass-barrow',
    type: 'location',
    name: 'The Glass Barrow',
    parent: 'the-ford',
    summary: 'The glass-fused ruin of old Cinderford under the ford: a flooded street, a chapel with its congregation still in the pews, a cold stair, and a round frosted room where a dead captain keeps guard over a deserter\'s stash.',
    fields: [
      { key: 'Way in', value: 'the old culvert under the third pier, at low water; or the smugglers\' cut from the Low Quay' },
      { key: 'Dangers', value: 'glass underfoot, glass-spiders, cold, the dead, rising water' },
      { key: 'Notable for', value: 'the Lithic glyph, the glass chapel, the cold room, the Cut Oil Tin' },
      { key: '5e', value: 'Level 1 party of five. Glass-spider = giant spider (CR 1). Spiderlings = giant wolf spider (CR 1/4). The Captain = wight, scaled down (see area 6).', gm: true },
    ],
    tags: ['dungeon', 'ruin'],
    body: `> Under the bridge the river is loud and the light is green. The third pier stands on a shelf of black glass, and at its foot, where the water pulls hardest, a low arch of old brick opens into the dark: the culvert that drained the village square, before the square was the riverbed. Cold air comes out of it, steady, and smells of wet ash and, faintly, pears. On the lip of the arch, in the slime, is a handprint. It is pointing in.

Before the battle, Cinderford's square stood where the ford is now. The sorcery of that night melted the square, the chapel, the bakery and forty houses into a single mass of dark glass and dropped it twenty feet; the river moved over it within the year. The Glassers call what is under the ford the Barrow, because of what is in it. They dug one shaft in 3005 and did not dig another.

The deserter [[Dannic Rook]] went in through the culvert in the first week of Ashfall. He came out once. The second time he came out drowned, on 7 Ashfall, at the ford, and he has not stopped coming out since.

:::gm
**Running it.** Seven areas, roughly in order; the party can skip 3 and 7. Everything is tilted ten to twenty degrees, and the floor is glass under a skin of silt: moving faster than a walk means a DC 10 Dexterity (Acrobatics) check or a fall, 1d4 slashing. Light sources reflect everywhere; Perception checks for ambush are at disadvantage unless the light is hooded. Casting any spell in the Barrow makes the glyph in area 5 glow for a round, wherever the caster is, and the lantern on the hill gutters, once, which nobody down here sees. Each spell cast in the Barrow after the first gives the Captain in area 6 an extra 5 hit points: the ward is paying.

**1. The Culvert.** A brick tunnel, five feet high, forty long, ankle-deep in running water. DC 12 Perception: scuffs on the brick at shoulder height where someone dragged a heavy tin along the wall, and a hank of something like hair caught on a snag: glass-spider silk, razor-fine (1 slashing to a bare hand). The culvert ends in a drop of eight feet onto area 2 (DC 10 Athletics to climb down; the fall is 1d6). At high water the culvert floods to the roof: the party has until the Ember rises to be out this way, or to find the Quay cut from area 2.

**2. The Flooded Street.** The old High Street, canted twenty degrees, knee-deep in black water on the low side, dry on the high side. House-fronts of melted stone lean in like candle wax; a door-knocker is fused mid-knock. Shapes in the walls. Hollowborn characters see them turn their heads. The far end is a slope of rubble up to the chapel (area 4). On the left, half way, the bakery (area 3). On the right, low down and under water, a brick arch with a rope tied through it: the smugglers' cut, which runs two hundred yards to the culvert under the Low Quay. Barge-clan characters, or anyone who asks Kettle, know of it. A tin cup, a boot and a soldier's belt-pouch lie on the dry side: Dannic's, empty but for a Concord silver shilling.

**3. The Collapsed Bakery.** The front has fallen in; the ovens at the back are intact, three brick mouths, and a glass-spider has nested in them. Webs of transparent silk span the room at knee and neck height: DC 13 Perception to see them by hooded light, DC 15 by open; walking into one means a DC 12 Strength save or restrained (5 hp, AC 10, vulnerable to bludgeoning; a web cut with a blade does 1 slashing to the cutter). The spider (giant spider: AC 14, HP 26, bite +5 for 1d8+3 piercing and DC 11 Constitution or 2d8 poison, halved on a save) is the colour of the glass it lives in and has advantage on Stealth here. Two spiderlings (giant wolf spider: AC 13, HP 11, bite +3 for 1d6+1 and DC 11 Constitution or 2d6 poison) drop from the chimney on round two. Treasure in the ovens: a baker's hoard of 23 sp and 140 cp fused into a lump (worth its weight, 4 gp, at Gutter Market), and a stone loaf, perfectly detailed, warm. Hard fight for level 1: let the party retreat into the street and fight at the door, or skip the room if the night is short.

**4. The Glass Chapel.** The old chapel of Hathe, roof gone, walls flowed and set. The pews are full. Forty villagers sit facing the altar, fused where they sat, glass-skinned, heads bowed, and the detail is terrible and exact: a child's hand in its mother's, a man half-turned toward the door. The altar is a black stone slab with a doorway carved in it, Hathe's sign. Anyone who sits in a pew hears, very faintly, forty people breathing in. Quorl, or any priest of Hathe, can take the congregation's last words here (DC 12 Religion or a short rite): they all say the same thing, which is the sentence the dying have been whispering to Quorl. Behind the altar, where the floor dropped, a stair goes down (area 5). At the chapel door, scratched in the glass, in chalk gone hard: *D.R. 3 Ashfall. Back for the rest.*

**5. The Cold Stair.** A spiral stair of fitted stone, older than the chapel by a thousand years, going down a hundred feet, and every step colder. Frost on the walls after thirty. Over the stair's first arch, cut deep into a lintel of grey Lithic stone, a line of glyphs. Ysse (Arcana DC 13), Borrin (surface-dwarf script, DC 10 for a dwarf), or anyone with the Lithic language reads it: *WHAT WE BURIED IS NOT AT REST.* Below it, scratched newer and shallower, a second line in the same script that the readers cannot make out: a rubbing of it is worth something to Aelith Sorn, Warden Uthrem and Tollamund, in that order of honesty. The stair is the Barrow's oldest part: the village was built on a Lithic waystation, and this is its throat. Halfway down, a landing with a pile of Dannic's gear: a bedroll, a dark-lantern out of oil, a Glasser's pick, and seven empty Keel oil-tins with the seals broken, rinsed clean. Whatever he was doing, he was doing it with oil.

**6. The Cold Room.** A round chamber thirty feet across, domed, walls and floor and dome furred with frost that glitters in any light. Breath smokes. In the centre a plain stone chair, Lithic work, and in it sits a dead man in the ruin of a captain's coat, one of the eight companies' badges fused to the breast, a lantern-pole across his knees with no lantern on it. His eyes are open and white with frost. Around the chair, in a ring, Dannic's stash: two sacks, a strongbox with the lock prised, a Glasser's chart, and [[The Cut Oil Tin]], a sealed Keel tin with Hesk's grey wax over the seal, heavier than it should be, which Dannic brought down here and could not make himself take back up. In the strongbox: 31 gp in new Concord silver and gold, a letter of credit on Tollamund & Daughters made out to "bearer", and a pay-chit of the Ninth Lantern for 3009 stamped PAID IN FULL by a Regency seal that nobody in the company has ever seen.

The Captain does not move until something is lifted from the ring. Then he stands. **The Cold Captain** (wight scaled down: AC 13, HP 30, speed 30; Str 15; lantern-pole +4 for 1d8+2 bludgeoning, or Life Drain +4 for 1d6+2 necrotic and DC 11 Constitution save or hit-point maximum reduced by the damage until a long rest; resistance to necrotic and to cold; vulnerable to fire; does not leave the room; does not speak except once). He is slow, sure and silent, and he fights to put things back. A character who sets down what they took and steps out of the ring is not attacked again. A character who says the Ninth Lantern's name, or shows its badge, makes him stop for one round and look, and in that round he says the only thing he says: *"Which lantern is lit?"* If answered truthfully, he sits down again and does not rise for this party. Burned, or reduced to 0 hit points, he comes apart into ash and frost; the chair stays cold. Treasure on him: his company badge (the Second's; Mother Hennet will want it) and, in his coat, a folded and refolded note in a woman's hand that says only *come home*.

**7. The Red Seam.** Behind the chair, a crack in the dome's wall wide enough for one at a time, running down and east. Frost gives way to warmth within twenty feet. The passage ends after sixty at a door of grey Lithic stone with no handle, and across the floor in front of it, under a skin of glass, runs a hairline of red light, the colour of the Ember, pulsing slowly, east. It hums. Hollowborn characters standing here dream awake for a moment. Ysse feels the lantern on the hill as if it were in the next room. The door does not open, this session or for several more. The keyhole in it matches a key the Returned smith in Hollowhall keeps forging and melting; it also matches [[Hathe's Door-Key]], which is not here. Leave it. Note what the players touch.

**Getting out.** Back up the stair and the street; the culvert if the water is low, the Quay cut if it is not (fifty feet of flooded brick: DC 10 Athletics to swim it, with light out). The party surfaces under the Low Quay at the floating market's stair, in front of whoever is there at that hour, with a tin of oil that someone in the Keep does not want found.
:::`,
    gmNotes: `The Barrow should feel like a drowned church, not a cave: quiet, cold, full of people who are still there. Play the congregation for grief, the spiders for sudden violence, the Captain for dread and then, if the players are clever, pity. End the session with the lantern on the hill guttering as they come up, whether or not they have spoken to the Captain; the Cut Oil Tin is the clue, the gutter is the stakes. For the Lithic rubbing, see the handout [[A Rubbing from the Ninth Stone]] for the style of script; this one is shorter.`,
  },
  // ───────────────────────────── The Ashenreach: places ─────────────────────────────
  {
    key: 'treaty-stone',
    type: 'location',
    name: 'The Treaty Stone',
    players: true,
    parent: 'march-of-cinders',
    summary: 'The glass-sheathed boulder three miles east of the bridge where the Treaty of Ashes was signed on a drumhead. Pilgrims, widows and vandals; the company\'s patrol turns back here.',
    fields: [
      { key: 'Notable for', value: 'the signatures, the graffiti, the end of the staked road' },
      { key: 'Dangers', value: 'the wind; the walk back' },
    ],
    tags: ['landmark', 'monument'],
    body: `> The road's last stake has a scrap of red on it, and beyond it the plain is unmarked to the sky except for one thing: a stone the size of a hay-wain, standing alone, sheathed in dark glass that has run down its sides and set in ropes. Around its foot, trodden into the ash, a ring of offerings: bootlaces, ribbons, badges, a wedding ring on a nail, a tin plate with a name scratched on it. The glass is scratched too, everywhere a hand can reach, and the scratches are words.

The stone was a waymark on the old road, a Lithic figure worn to a lump before the empire was born. On the night of the battle the fire came over it and sheathed it in glass. Two months later, because it was the only thing standing between the armies' camps that everyone could see, the signatories' envoys met at it, put a drumhead on top, and signed [[The Treaty of Ashes]] on it in the rain. The Treaty Bell was rung. The envoys went home. The companies stayed.

The signatures are still there, on the glass under the drumhead's rust-ring: nine names scratched with a dagger-point, the Regency's, the Concord's, Iskaveth's, the Holds', Sael's, the Mothers', three claimants nobody remembers, and the eight companies' marks in a row under them, with the ninth added at the end in a different hand, smaller, as an afterthought. Everything below the signatures is graffiti. PAY US, a hundred times. Names of the dead. Prayers. A very good drawing of the Regent-Chancellor. Someone has been scratching the word LIAR under the Regency's signature once a week for two years, and someone else has been polishing it out.

### Who comes here
Pilgrims: widows of the eight companies, who walk out from Fallowden and further to leave a thing and go home. Soldiers of the Ninth, on patrol, who touch the ninth mark and turn round. Iskavethi from the mission, who leave lamps. Vandals, which is to say anyone with a grievance and a knife. Ravelers, who keep an eye on the ring of offerings and take nothing. On the anniversary, 20 Frostcall, everyone.

### Rumours
- The stone weeps at red moon. (False; the Orchard does.)
- There is a tenth signature, under the glass, that was there before the treaty. (True; see below.)
- The Regency's envoy signed with a false name. (True. He was Quiet Office.)
- If you scratch your name on the stone you will die in the March. (Everyone has. Everyone will.)

### Things to do
Walk the patrol and touch the mark. Read the graffiti for news; it is faster than the post-stair. Find your own name, if you were at Cinders. Leave something. Look under the drumhead's rust-ring with a good light and see that the glass is thinner there, and that there is writing in the stone beneath it, older than the glass.

:::gm
Under the glass the Lithic waymark bears the same glyph-line as the Cold Stair in the Barrow and the Ninth Stone: *what we buried is not at rest*. More useful in play: a Raveler witness at the signing scratched the treaty's one honest clause into the glass under the drumhead, where the envoys could not see it, and it reads *paid by the signatories, or by whosoever shall hold their debt*. That clause is in [[The Original Treaty]] and in no public copy, and it is why the Concord's purchase of the Regency's debt makes it, in law, the garrison's new master. Aelith Sorn has read it. Tollamund wrote it.
:::`,
  },
  {
    key: 'weeping-orchard',
    type: 'location',
    name: 'The Weeping Orchard',
    players: true,
    parent: 'march-of-cinders',
    summary: 'What is left of the pear country: four hundred petrified trees in rows, with stone fruit on them, that bleed red sap at the full of the Ember.',
    fields: [
      { key: 'Where', value: 'two miles north-east of the bridge along the old orchard lane' },
      { key: 'Notable for', value: 'stone pears, red sap at red moon, the cooks\' camp' },
      { key: 'Dangers', value: 'the sap, the dreams, whatever stands between the rows at night' },
    ],
    tags: ['orchard', 'ruin', 'haunted'],
    body: `> The lane runs between dry-stone walls that have not fallen, and at its end the orchard begins, and it is still an orchard. Row on row of pear trees, old and well-pruned, in full leaf. Then you are among them and see that every leaf is grey stone, every twig, every fruit, and that the ground under them is not grass but ash with a crust on it, and that the fruit, when you touch it, is warm.

Before the war the Cinder valley was the pear country, and the orchards ran for miles. The battle burned them all but this one, and this one did not burn. It turned to stone in a night, leaves and fruit and the birds in the branches, and nobody knows why, though everyone who was there knows what else happened in it that night: it was where the deserters, the cooks and the walking wounded of eight companies hid, and where, by dawn, a ninth lantern was found burning that nobody had counted.

At the full of the Ember, every twenty-third night, the trees weep. Red sap runs from the bark where the branches fork and from the stems of the stone fruit, and drips, and sets by morning into beads that the Glassers sell as Orchard amber. The Hollowborn of the Smokes walk out here that night and sit under the trees and listen. Nobody else stays past dark if they can help it.

### What is here
- **The rows**: four hundred and eleven trees, in twenty rows, every one bearing.
- **The cooks' camp**, at the orchard's heart, a ring of stone-fused cookpots and a fire-pit with glass in it, where the ninth lantern was first seen lit. The company holds a muster here on the anniversary and nobody speaks.
- **The ribbon tree**, by the lane, the one living thing: a sucker from a stone root, waist-high, with three green leaves and a thousand ribbons tied to it.
- **The grave rows**, along the north wall, where the dead of that night were buried by the Ravelers before Corvel Rise existed. Shallow. Not all still occupied.

### Rumours
- The pears are sweet if you can bite them. (Nobody has.)
- Brother Tallow lit the lantern here, from his pipe. (He says not. He says he found it lit.)
- A stone bird in the fourth row sings at red moon. (True.)
- The sap is the Sleeper's blood. (The Hollowborn say so. They are not entirely wrong.)

### Things to do
Walk the rows and count the fruit, which changes. Tie a ribbon. Sit in the cooks' camp with a veteran who was there and hear what they will say, which is little. Come at red moon, with the Hollowborn, and taste the sap, and dream. Dig, if you dare, in the grave rows, and find that one of the graves holds a lantern-pole and no body.

:::gm
The lantern was lit here, not at the Keep, from [[The Ward Shard]]: a splinter of the Ninth Stone blown thirty miles west in the blast, which fell into the orchard and petrified everything it touched. The trees are, in effect, Lithic now, and the red sap is the ward's own substance leaking through them at the moon's pull. Session 5 brings the party here with the Rook-Court's ledger and a dying veteran's confession; the confession is old Halloran Pike's, the deserter who carried the lantern up to the Keep that night, and it names the cook who lit it from a fire burning on the shard and carried the shard itself to the Keep in a soup-pot: Mother Hennet, who keeps [[The Last Candle]] and has never told anyone. Drinking the sap gives a Hollowborn a true dream and anyone else a DC 12 Wisdom save against a short, horrible one.
:::`,
  },
  {
    key: 'fort-mercy',
    type: 'location',
    name: 'Fort Mercy',
    players: true,
    parent: 'ashenreach',
    summary: 'A burned-out Regency fort twenty-two miles east on the Ash Road, now the Glassers\' den under Vexa Glassjaw. There is Lithic writing in the cellar and a cold seam where a digger vanished.',
    fields: [
      { key: 'Population', value: 'sixty to a hundred Glassers, depending on the season and the dead' },
      { key: 'Ruler', value: 'Vexa Glassjaw, who owns the only well' },
      { key: 'Notable for', value: 'the Bishop, the cellar writing, the cold seam, a strongbox nobody will open' },
      { key: 'Dangers', value: 'Glassers, the seam, what the digs bring up' },
    ],
    tags: ['fort', 'ruin', 'den'],
    body: `> The fort stands on the only rise for ten miles, a square of blackened Regency stone with one tower still roofed and the others open to the sky, and around it, like a skirt, the Glassers' town: tents, lean-tos, carts, a windmill made of shield-boards, and dig-pits going down into the glass in every direction, each with its windlass and its rope and its bucket. Smoke from a dozen fires. A dog barks. From the tower a woman's voice, carrying: "If that's the company, tell them the toll's doubled and I still don't want them."

Fort Mercy was built by the Regency in 2996 to hold the eastern road and named, with imperial humour, for the mercy it was meant to bring the pear country. It burned on a summer night in 3005 with its garrison and three hundred refugees inside, and nobody got the gate open ([[The Burning of Fort Mercy]]). The Glassers moved in the next year and found a well still sweet and a cellar still dry, and have dug from it since. [[Vexa Glassjaw]] took it over in 3008 by the simple method of being the last person standing in the argument.

### What is here
- **The tower**, Vexa's, with a view of every dig and a shovel over the hearth that she calls the Bishop, because it has buried more men than any priest.
- **The yard**, where the Glassers sort, fight, sell to each other and drink something made from stone pears.
- **The well**, the only sweet water east of the Treaty Stone. Vexa charges for it by the bucket and that is the whole of her law.
- **The cellar**, under the keep: cool, dry, and on its far wall, where the Glassers broke through into older stonework, a panel of grey Lithic stone covered in glyphs that Vexa has had lamps on for a year and cannot read.
- [[The Cold Seam]], the deepest dig, below the cellar, where a digger called Brakk went down in Reaping and did not come up, and which Vexa has roped off and goes down herself at night.
- **The dig-pits**, twenty or more, across the glasslands around the rise. Each has a name and a tally of what came up and who did not.

### Who is here
Vexa. Her second, Ottoline Crane, a human dowser who finds metal under glass by walking barefoot and bleeding. Skelt, who went into the Glass Barrow with Dannic Rook and came back alone, and drinks. Sixty diggers of every people, including a Returned dwarf who will not go below the cellar. A Concord factor, often, with a cart. A boy who sells water from Vexa's well to those who cannot reach it and is beaten weekly for it.

### Rumours
- Vexa has found a Lithic city under the fort. (A waystation. Big enough.)
- The Glassers robbed the pay wagon. (Vexa laughs at this, a little too long.)
- Brakk is still alive down the seam and calls up at night. (Something calls up at night.)
- The factor pays in Concord coin for anything that hums and takes it to Gilt. (True.)

### Things to do
Pay for water. Buy a dig's chart. Be hired to go down a pit and bring up what the diggers will not touch. Read the cellar writing, if you can, and watch Vexa's face. Go down the cold seam on a rope and come back up with frost on your beard in Ashfall.

:::gm
Session 2 ends here. The Glassers did not rob the wagon; they were paid to receive it, and are not sure what they did. The pay-wagon strongbox, Regency-sealed, is in the cellar, unopened, behind the Lithic panel's loose corner, where the Concord factor who hired the escort told Vexa to keep it "until collected". She has not opened it because a Shellback told her, very slowly, not to. The cellar writing is the same line as the Barrow's lintel and the Ninth Stone's, with a longer second passage the Glassers chipped into; Aelith Sorn will pay anything to see it. Vexa herself is a fair dealer if dealt with fairly, a terrible enemy if not, and is more frightened of what is under her fort than of anyone in the company.
:::`,
    gmNotes: `Vexa's voice: loud, orcish, funny, no patience for soldiers, enormous patience for stone. She names her tools and talks to the Bishop. She wants someone to read the cellar to her and will trade the strongbox's location for it if the party plays it right.`,
  },
  {
    key: 'cold-seam',
    type: 'location',
    name: 'The Cold Seam',
    parent: 'fort-mercy',
    summary: 'The deepest dig under Fort Mercy: a crack in the glass that goes down into Lithic stone and gets colder every yard. Brakk went down in Reaping and something else answers his name.',
    fields: [
      { key: 'Depth', value: 'ninety feet of rope and then the ladders, and then no one knows' },
      { key: 'Dangers', value: 'cold, falls, the dark, whatever took Brakk' },
      { key: '5e', value: 'Below sixty feet treat the cold as extreme (Con save DC 10 each hour or a level of exhaustion). Whatever is at the bottom is not a session 2 fight: a shadow (CR 1/2), if forced, wearing a digger\'s shape.', gm: true },
    ],
    tags: ['dungeon', 'dig'],
    body: `> Behind the cellar's Lithic panel the Glassers broke through into a crack in the stone, a seam of black glass running down and east at a steep slant, polished on the near side by a year of bodies going down it. A windlass stands over the hole with the rope let all the way out. The air coming up is cold enough to show your breath in Ashfall, and smells of frost and, very faintly, of pears. A tin plate nailed to the post says BRAKK, 19 REAPING, in six languages, because the Glassers are not sure which one he will read.

The seam is where the fort's Lithic foundation opens into something larger. Vexa Glassjaw's diggers followed it for ninety feet in the spring, found steps, then a chamber where the walls were carved with the same glyphs as the cellar panel, and stopped when the cold began to hurt. Brakk, who was a Grimmark man with no fear and less sense, went down alone one night in Reaping with a lamp and a bottle. The lamp was found at the bottom of the ladders, lit. The bottle was found a hundred feet further on, full.

Since then the Glassers do not go below the first chamber. Vexa goes down alone, at night, with the Bishop, and comes up grey and says nothing. On still nights a voice at the bottom of the seam calls up, in Brakk's voice, asking for the rope. The Returned dwarf who digs for Vexa says it is not Brakk. He says it is what Brakk met. He will not say how he knows.

### Rumours (in the Glassers' yard)
- The seam goes all the way to the Rent. (Probably true.)
- Brakk found gold and will not share. (Glassers' optimism.)
- Vexa talks to it. (She does. She asks it questions. It has started answering them.)

:::gm
The seam is a Lithic road, one of the covered ways between the Ninth Stone and its outlying waystations; it runs east under the glasslands toward the Rent and is how session 6's expedition can reach the Ninth Stone's foot without crossing thirty miles of open ash, if the party is brave enough to take it. What took Brakk is a shadow of the same kind that wears Borrin's: a passenger from a breached ward, thin, hungry, patient, and very interested in the Returned dwarf above. It will answer Borrin in his own voice. Not a fight to force on a level 2 party; a conversation, and a reason to come back.
:::`,
  },
  {
    key: 'stillwater',
    type: 'location',
    name: 'Stillwater',
    players: true,
    parent: 'ashenreach',
    summary: 'A Hollowborn hamlet of thirty souls on a grey lake that does not ripple, where the fish have no eyes and the dead can be seen under the water.',
    fields: [
      { key: 'Population', value: 'about thirty, all Hollowborn or their parents' },
      { key: 'Where', value: 'fifteen miles north-east of Cinderford, across the stubble and up a dry creek' },
      { key: 'Ruler', value: 'Gammer Teal, because she is oldest and nobody else wants it' },
      { key: 'Notable for', value: 'the lake, the blind fish, the Widow\'s first sermon' },
    ],
    tags: ['hamlet', 'lake'],
    body: `> The creek bed turns and there is the lake, a mile of water the colour of pewter and as flat as a plate, in a wind that is moving the ash on the shore. Nothing on it moves. Ten houses of ash-brick along the near bank, nets drying, a child on the jetty with a line in the water and one pale eye turned toward you before the other one is. The water by the jetty is clear to the bottom, and the bottom is further down than it should be, and there are people standing on it.

Stillwater is the only settlement on the grey lakes, which filled the low ground north of the Rent in the years after the battle from springs nobody had known were there. The water is drinkable, just, and full of a pale fish without eyes that tastes of nothing and keeps people alive. The hamlet was settled in 3004 by Hollowborn families who had been born in the Smokes and found the town hard, and they fish, dry fish, trade dried fish to Kettle Brindlewake for salt and iron, and look at the water.

The lake does not ripple. Wind, oars, a stone, a body: the surface takes it and is flat again before you can blink. Under it, on calm days, which is all of them, the Hollowborn see the dead standing on the lake bed, hundreds of them, facing east, patient. Everyone else sees mud and fish. The Stillwater folk say the dead are waiting for the door to open and have come to the one place they can see it from.

### Who is here
Gammer Teal, ninety, Hollowborn before anyone knew the word, born at a ward-slip in the north in a year she will not name. Six families. [[The Dreaming Widow]] came here first, in 3006, and gave her first sermon on the jetty; three families followed her back to the Smokes, and three stayed.

### Rumours
- The lake is the top of the Rent, flooded. (No. But it connects.)
- The blind fish see the dead. (The Stillwater folk say so and will not eat the heads.)
- Gammer Teal has spoken to the Sleeper. (She says it spoke to her, once, and said "not yet", and she has not slept properly since.)
- At red moon the dead under the lake take one step. (True. They are closer to the jetty than they were.)

### Things to do
Buy fish. Ask Gammer Teal about the dream and be told, flatly, what it is. Look into the water as a Hollowborn or beside one. Row out, which nobody does, and see the dead look up. Bring [[Tibbet Marlowe]] here and let him look for his mother's face among them.

:::gm
Tick will not find his mother among the dead under the lake, because Marla is standing behind him; let the player notice that first. Gammer Teal is the one person in the March who will tell the PCs the Hollowborn truth plainly: every Hollowborn dreams the same dream at full red moon, a stone door and a lamp and a hand on the latch from inside, and it is getting clearer. She does not want the Sleeper woken and thinks the Widow is a fool, and she is the Sleepless' natural counterweight if the PCs want one. Use the lake for a scene, not a dungeon: the dead under it do not come up until Ending B.
:::`,
  },
  {
    key: 'corvel-rise',
    type: 'location',
    name: 'Corvel Rise',
    players: true,
    parent: 'march-of-cinders',
    summary: 'The Raveler rookery on the hill south of Cinderford, above the burial ground: timber roosts, a bone-library of last words, a reliquary with a dead god\'s key, and nine thousand graves.',
    fields: [
      { key: 'Population', value: 'about sixty Ravelers, and crows' },
      { key: 'Ruler', value: 'Mother Corvane, for the Rook-Court' },
      { key: 'Notable for', value: 'the bone-library, the reliquary, the Field of Lanterns' },
    ],
    tags: ['rookery', 'graveyard', 'temple'],
    body: `> South of the Smokes the ground rises to a long low hill, and the hill is a graveyard, slate after slate in rows that follow the contour, nine years of a town and a company and a battle. At its crest, black against the sky, a tangle of timber: platforms and roosts and walkways built into three dead oaks and out from them on stilts, grey-robed figures moving along the walkways with the bob and tilt of birds, and over all of it, wheeling, crows. Hundreds. They go quiet when you start up the path, and then, when they have had a look at you, start again.

[[Ravelers]] follow armies and bury what is left, and when the armies stopped at Cinders the Ravelers stopped too. Corvel Rise is the biggest rookery in the south: the Rook-Court's seat in the March, where the dead of the battle were laid in the first winter and the dead of everything since have followed. The Ravelers built upward because they do not like to sleep on the ground they have filled.

### What is here
- **The Field of Lanterns**, the battle-dead's ground, where eight iron lanterns stand on poles over eight mass graves, dark, and a ninth pole with no lantern on it, by the company's request.
- **The town rows** and **the company rows**, slate by slate; the company's are the ones with a number instead of a name, because that is how the Ravelers heard them called.
- **The roosts**: the Ravelers' homes, sixty feet up, reached by ladders that are pulled up at night.
- **The bone-library**, a long hall at the heart of the roosts, walled and shelved with bone, where the Rook-Court keeps the Ledger of Last Words: every dying sentence a Raveler has heard in the March since 3002, bound in forty narrow books, in order, with the current year's book kept down in the Doorkeeper's Chapel and carried up at Longnight.
- **The reliquary**, a cage of black iron in the oldest oak, holding the Court's holy things: a feather from before the count, a jar of ash from the battle, the eight companies' burial-rolls, and a plain iron key on a nail that the Ravelers call [[Hathe's Door-Key]] and will not touch.
- **Mother Corvane's roost**, the highest, which she has not come down from in a year.

### Who is here
[[Mother Corvane]]. [[Quorl Many-Words]], who was fledged here and comes up with every burial cart. Sixty Ravelers of all ages with a dead god's humour. The crows, who are consulted.

### Rumours
- The crows carry the last words to Corvane before the Ravelers do. (Possibly.)
- The ninth lantern-pole will get its lantern the day the company's goes out. (The Ravelers do not deny it.)
- The bone-library is built from the battle's dead. (True, with their leave; the Ravelers asked each one.)
- Hathe's key opens the Doorway on Temple Row. (It opens a door. The Ravelers are not sure which, and are afraid it is all of them.)

### Things to do
Bury someone properly. Climb to the roosts and be looked at by sixty crows and sixty Ravelers and not know the difference. Ask to see the ledger and be refused; ask Quorl, and be shown a page. Stand at the ninth pole. Be told by Mother Corvane, if she judges it time, four words.

:::gm
The Rook-Court's clock, Last words decoded, lives here. Corvane has the message nearly whole: *the lamp is the lock*. The ledger's last words, read together, spell it out across nine years, and session 5 is where the party reads enough of them to see it. The Door-Key in the reliquary is the item [[Hathe's Door-Key]]; it opens the Lithic door at the bottom of the Glass Barrow and, in the end, the Ninth Stone itself. Corvane will give it to Quorl when he asks the right question, which is not "can I have it" but "what is it for".
:::`,
    gmNotes: `Ravelers in numbers are a chorus: deadpan, affectionate, morbid, finishing each other's jokes. Corvane is the still point; let her say almost nothing until session 5. The crows should react to the PCs' secrets before the Ravelers do.`,
  },
  {
    key: 'house-unburnt-light',
    type: 'location',
    name: 'The House of Unburnt Light',
    players: true,
    parent: 'march-of-cinders',
    summary: 'Iskaveth\'s mission a mile out on the eastern road: white walls, a garden that should not grow, a lamp in every window, and a welcome that is a little too comfortable.',
    fields: [
      { key: 'Keeper', value: 'Sister Seraphine Ashe, envoy of the Unburnt Saint' },
      { key: 'Population', value: 'a dozen of the Saint\'s household, twenty lay-brothers, and the sick' },
      { key: 'Notable for', value: 'free bread, real healing, a garden door that is never locked' },
    ],
    tags: ['mission', 'temple', 'hospital'],
    body: `> A mile out on the Ash Road a wall rises on the right, whitewashed, the only white thing between here and the sky, and over it the tops of trees. Green trees. Through the gate a courtyard swept clean of ash, a fountain running, a long low house with a lamp burning in every window in daylight, and the smell of bread. A woman in a plain red robe is kneeling by the fountain washing the feet of a kiln-hand with the dust-cough, and she looks up at you with a face that has been waiting for you specifically and is so glad you have come.

The mission came in 3008, by cart from Halcyra with a letter of passage from every signatory, which was a feat in itself, and built on the ruin of a farm where, the Iskavethi say, the camp healer Ilyra had her tent the night of the battle. They dug a well that gave sweet water where no well had, planted a garden that grew, and opened the gate. Bread for anyone, every morning. Healing for anyone, real healing, by the laying on of hands and the lighting of a lamp, and no charge, and no sermon unless you ask. Half the Smokes eats here once a week. The company's surgeon sends his worst cases up the road and they come back walking.

Nobody can say what is wrong with it. Everyone who has eaten the bread knows something is.

### What is here
- **The courtyard** and the fountain, where [[Seraphine Ashe]] receives whoever comes.
- **The Lamp Hall**, the chapel: a long bare room with one lamp on a plain altar and the walls lined with smaller ones, each lit for a petitioner. The Saint's face is not shown. Her hand is: a carving of an open hand, unburnt, in the fire.
- **The infirmary**, thirty beds, clean, warm, full.
- **The garden**, behind the house, pears and figs and herbs in black soil brought from the plateau, and at the bottom of it a door in the wall onto the plain that is never locked. Sister Seraphine says the Saint's house has no locks. The lay-brothers say it is so the dead can come in and be comforted. Both are true.
- **The guest rooms**, four, better than anything in the Keep, offered to the Captain and declined, offered to [[Aelith Sorn]] and accepted.

### Who is here
Sister Seraphine, who is kind, beautiful in a way that is hard to look at and hard to stop looking at, and entirely sincere. Brother Caddis, who runs the kitchen and is the best cook in the March and knows it. The Lamp-Wardens, six quiet men and women in red who carry no weapons anyone has seen. The sick. Aelith Sorn, in the best guest room, being charming.

### Rumours
- The garden grows because the Saint blessed the soil. (The soil is from the plateau. It would grow anywhere. The pears, though, are a different matter.)
- The Lamp-Wardens are soldiers. (They are. Iskaveth's best. They are also devout.)
- Seraphine can heal anything but the dust-cough. (She can heal that too. She has chosen, twice, not to, for people who refused the lamp.)
- The mission is buying the company's debt from Tollamund. (False. It is offering to. Tollamund has not answered. Slowly.)

### Things to do
Eat the bread. Be healed, and lie awake afterwards. Light a lamp for someone and find you meant it. Sit in the garden at dusk and watch the unlocked door, and see who uses it. Be asked by Seraphine, with real warmth, what you dream, and find yourself telling her.

:::gm
The Saint speaks through Seraphine, not always and not on command; the players should notice the moments her eyes catch the lamp-light wrong. The Church's clock, The Saint ascends, ticks here. The healing is real and draws on dead Hathe's stolen power, which is why the healed do not quite sleep. Seraphine wants the flame for the Saint and the PCs for the Saint's household, and she will offer each of them, in session 4, the thing they actually want. The garden door is never locked because the Saint wants the dead to come to her, and they do: at red moon the garden is full of them, standing among the pears, and Seraphine walks among them and they lean toward her like plants to a window.
:::`,
    gmNotes: `Seraphine is the campaign's most dangerous NPC because she is good. Play her warmth straight, give her no sneer, let her be right about the company's suffering and the town's hunger, and make the players argue with each other about her. Her allure is in attention: she listens like nobody else in the March. Brother Caddis is comic relief and a genuinely good man who has started to have doubts.`,
  },
  {
    key: 'the-rent',
    type: 'location',
    name: 'The Rent',
    players: true,
    parent: 'ashenreach',
    summary: 'The chasm at the heart of the Ashenreach, thirty miles long and getting longer, that opened the night of the battle. The dead walk its lip, and at its northern end leans the Ninth Stone.',
    fields: [
      { key: 'Size', value: 'thirty-one miles long, a quarter-mile across at the widest, depth unknown' },
      { key: 'Where', value: 'its western end is thirty-eight miles east of Cinderford by the Ash Road' },
      { key: 'Dangers', value: 'the edge, the dead, the wind out of it, the dreams' },
      { key: 'Notable for', value: 'the Ninth Stone, the Red Breath, the Lithic road' },
    ],
    tags: ['chasm', 'ward', 'wasteland'],
    body: `> You smell it before you see it: cold stone and pears and something under both like a struck match. Then the plain simply stops. A lip of fused glass, and beyond it air, and the far side a quarter-mile off, and between, going down past where the light goes, a wall of layered rock and glass and darkness that breathes. Slowly. Out, warm, red-tinged, for the length of a long breath. Then in, cold. Along the lip in both directions, as far as you can see, figures standing, facing the gap. They do not turn round. They were not there a moment ago.

The Rent opened on the night of the Battle of Cinders, when the sorcery of eight armies met over the Cinder plain and something under the plain gave. It runs north-east to south-west across the heart of the Ashenreach, thirty-one miles long by the company's last survey and thirty-three by the Glassers', because it is growing. Nothing lives within five miles of it. The dead do.

### What is here
- **The lip**: glass for a hundred yards back from the edge, slick, cracked, and lined with the standing dead, who do not move while watched and are nearer every time you look away. They do not attack. They wait.
- **The Red Breath**: the chasm exhales every few minutes, warm, red-lit from below, and the Ember is said to brighten when it does.
- **The Lithic road**: a stepped way of grey stone cut into the northern wall, going down in switchbacks from the lip near the northern end. Older than the chasm, which should be impossible. It is how [[The Last Wardens]] went down, once.
- [[The Ninth Stone]], at the northern end, visible for miles: a leaning finger of grey stone the height of a keep, cracked from crown to root, with the crack glowing faintly at night.
- **The company's survey cairn**, at the western end where the Ash Road stops, with the survey tally scratched on a slate: 3003, 29 miles. 3005, 30. 3007, 30. 3009, 31. 3011, blank.

### Rumours
- The Rent is bottomless. (Nobody has found the bottom. The Lithic road goes a long way down.)
- The dead on the lip are everyone who died in the war, all of them, come to watch. (There are not enough. There are more every red moon.)
- Throw a coin in and you hear it land. (You do. After a very long time. And then you hear it picked up.)
- The Rent will close if the lantern goes out, or open if it does; nobody agrees which. (Nobody has tried it.)

### Things to do
Reach it, which is three days from Cinderford with luck and a rope. Stand on the lip and breathe its breath. Count the dead and lose count. Find the Lithic road and go down a hundred steps and feel the Ember through the rock. Reach the Ninth Stone's foot and meet the one who is waiting.

:::gm
The Rent is the Ninth Ward's crack made visible. The standing dead are its leakage: Hathe's door is broken and the Sleeper's dreams draw them here. They are harmless unless the crack widens (Ending B), when they turn round. Session 6 brings the party here by the Ash Road or the Cold Seam; session 8 ends here under a full red moon. Every spell cast within a mile of the lip is felt by [[Warden Uthrem]] as a blow.
:::`,
  },
  {
    key: 'ninth-stone',
    type: 'location',
    name: 'The Ninth Stone',
    parent: 'the-rent',
    summary: 'The cracked anchor of the Ninth Ward, leaning over the Rent\'s northern lip: a Lithic monolith with one of the Nine still awake inside it, and a half-stone Warden who has waited nine years for someone to come.',
    fields: [
      { key: 'Keeper', value: 'Warden Uthrem, of the Last Wardens' },
      { key: 'Notable for', value: 'the crack, the Anchor, the empty heart-socket' },
      { key: 'Dangers', value: 'the crack, the dreams, what the gods want done here' },
    ],
    tags: ['ward', 'monument', 'ruin'],
    body: `> The Stone is a tower that was never built: a single finger of grey Lithic rock a hundred and forty feet high, leaning twenty degrees out over the chasm as if it had been pushed, and down its whole length from crown to root a crack a hand wide that glows, at night, the colour of the Ember. At its foot a ring of nine lesser stones, each the rough shape of a standing figure, and one of them is missing. On the step of the ninth, where the figure should be, something that was a person sits very still with its legs already grey and its hands folded in its lap, and raises its head, and the sound it makes is of two stones being drawn apart.

:::gm
The Ninth Stone is the anchor of the Ninth Great Ward and the last thing the Nine made. Inside it, awake, is one of the Nine: the youngest, say the Lithic, whose name the gods struck from memory with the rest. She has held the Ninth Ward for three thousand and eleven years. The night of the battle the sorcery cracked her, and a shard the length of a finger blew out of the crack and west, thirty miles, into the Weeping Orchard, and was found by a cook. That shard is the flame in the lantern on Lantern Hill. The ward holds because the shard still burns; the crack widens because it burns thirty miles from where it should be.

### Areas
- **The ring**: nine figure-stones round the foot, the Nine's companions, each a Lithic who came to stand and did. The ninth socket is empty and the step is worn by nine years of a half-stone man sitting on it.
- **The Warden's step**: [[Warden Uthrem]], the last of [[The Last Wardens]] who came east after the battle; the others have stood and set. He can move his head, his hands, and once a day his voice. He has been waiting for someone who could hear the flame to come, because he cannot go and get it, and he has decided, over nine years of watching the plain, that the one who comes will be a Vesh.
- **The crack**: wide enough at the foot to put an arm in, warm, humming. Anyone who touches the Stone with bare skin hears the one inside breathing. A Hollowborn hears her speak. Ysse hears her ask for the flame back.
- **The heart-socket**: inside the crack, ten feet up, a hollow in the stone the exact shape of the Ward Shard, with a hairline of red light running from it down and west under the glass, toward Cinderford. A ward needs a living heart; the Nine's youngest has been the heart alone for three thousand years, and the crack is where she is coming apart.
- **The Lithic road**: comes up out of the chasm to the Stone's foot. Down it, somewhere, is the Sleeper. Uthrem has never gone down. He says the stair is for the one who holds the flame.

### What Uthrem will tell them (session 6)
The truth of [[The Godslaying]], plainly, once, in a voice like gravel: who the Nine were, what they did, what it cost, what the Lithic are, what the lantern is, and what the ward needs. A new heart. Him, if someone carries him into the crack, which will kill him and buy twenty years. A willing PC, which buys a life. Ysse, whom the flame has already chosen, which buys the age. Or nothing, and the crack goes on opening, and he will describe what comes up the stair when it does.

### The three endings, here
- **Reseal**: the shard goes back into the heart-socket with a living heart beside it. The crack closes over a night. The Ember dims. The lantern on the hill goes out, and by contract the company ends.
- **Let it crack**: the shard is kept away, or destroyed, or the Saint's people pour what is leaking into their lamp. The dead on the lip turn round. The Stone falls into the Rent and the Nine's youngest with it.
- **Use it**: the shard is held, by a PC or a faction, and the holder learns to speak to what is under the stair and to be spoken to. The crack stays as it is. The holder starts to dream.
:::`,
    gmNotes: `Keep the Stone off the table until session 6 and then give it the whole session: the approach, the dead, the road, the Warden's voice. Uthrem is not a quest-giver; he is a man who has been sitting on a step for nine years deciding what to say, and he says it badly and all at once. Let Ysse's player feel the flame's pull as a physical thing here. For the script on the Stone, see [[A Rubbing from the Ninth Stone]].`,
  },
]
