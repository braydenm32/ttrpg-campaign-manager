import type { ExPage } from '../types'

/**
 * Gods, peoples and the lore of Vael Ardith: the twelve known deities, the ten playable peoples,
 * and six pages of world lore (the wards, the Nine, magic, the red moon, the calendar, Ul-Tarran).
 */
export const LORE: ExPage[] = [
  // ───────────────────────────── Deities ─────────────────────────────
  {
    key: 'god-aurelan',
    type: 'deity',
    name: 'Aurelan',
    aliases: ['Aurelan, the Crowned Sun', 'the Crowned Sun'],
    players: true,
    image: 'holy:god-aurelan',
    summary: 'The Crowned Sun: god of rule, law and the old empire. His church wants an emperor back, any emperor.',
    fields: [
      { key: 'Domain', value: 'Rule, law, the old empire' },
      { key: 'Symbol', value: 'A gold sun-disc with a crown laid across it' },
      { key: 'State', value: 'Living' },
      { key: 'Holy day', value: 'Crownfast, 15 Highsun' },
    ],
    relations: [
      { to: 'god-corvex', kind: 'rival of', note: 'Law against ledger, since the first imperial loan.', known: true },
      { to: 'god-grum', kind: 'claims as his dog', note: 'Grum disagrees, loudly.', known: true },
      { to: 'god-corporal', kind: 'refuses to acknowledge', known: true },
      { to: 'god-saint', kind: 'courts the church of', note: 'A saint on the throne would do.', known: true },
      { to: 'f-regency-council', kind: 'patron of', known: true },
      { to: 'god-sleeper', kind: 'wants leashed, not eaten', note: 'A crowned mortal on the leash, and Aurelan holding the mortal. The rest of the pantheon knows, and does not agree.' },
    ],
    body: `### What is known
Aurelan is law with a face. He is shown as a stern man of middle years, crowned, one hand open in judgement and the other closed around a rod. His disc hangs above every court in [[The Regency of Ardith]] and above the empty throne in [[Caer Ardith]], where the Regency Council swears each year that it is only keeping his seat warm.

The faithful say he crowned Caedric with his own hand at [[The Crowning of Caedric]], and that every emperor since answered to the sun alone. They say the [[The War of the Empty Throne]] was the sun's anger at a throne left empty, and that the war will not truly end until someone sits down.

### Worship across the nations
In the Regency he is the state: magistrates are his priests, oaths are sworn on his disc, and a tax receipt carries his sun in the corner. In [[The Sevenhaven Concord]] he is a courtesy, a small gold disc on the counting-house wall beside a much larger ledger. In [[Iskaveth]] his temples were burned in the conquest and burned again after it; a few stand roofless, kept by old men. The Grimmark clans call him the Lowland Sun and pay him no mind. Mercenaries swear by him on contracts and by [[Grum]] on everything else.

### The priesthood
The Solar Curia: judges in black edged with gold, Lectors who read the law aloud, and genealogists who keep the imperial rolls in a vault under the capital. The Curia has one policy and has had it for thirty years: find an heir. Any heir. A Lector put it plainly at a Council sitting: "A bad emperor is a throne with a man in it. An empty throne is a hole, and things come up through holes."

### Relations
He and [[Corvex]] have quarrelled since [[The First Imperial Loan]]; law says a crown is above debt, the ledger says nothing is. His priests call Grum the sun's hound. He does not admit that [[The Hanged Corporal]] exists, which is more attention than he gives most. His Curia has sent polite letters to [[Halcyra]], because a saint on the throne would still be a throne.

### Holy days
Crownfast, 15 Highsun, under the full pale moon at the top of the year: oaths of office renewed, prisoners pardoned by the dozen, the empty throne garlanded. In [[Cinderford]], [[Pell Quillon]] keeps it alone at [[The Assessor's Office]] with one candle and the correct form.

:::gm
The Curia's genealogists know what the imperial line was bred for, and the senior Lectors know that no living heir can sit the throne without hearing the Sleeper. They want one anyway: a ward-sensitive emperor is a hand on the leash.

Aurelan wants the Ninth Ward's crack wide, but not for the reason the other gods do. None of the pantheon can reach [[The Sleeper Below]] beneath mortal wards; a crack is a door. Most of them mean to go through it and devour what the Nine left half-dead. Aurelan would rather it were not eaten at all. He wants it leashed: a crowned mortal holding the flame, hearing the Sleeper, and answerable to the sun. A god on a chain is a throne that can never be emptied. The others know this and do not agree, which is why the Solar Curia and the auditors of [[Corvex]] are both in [[Cinderford]] and neither trusts the other. His priests are told only that order needs a throne and a throne needs power, and they are pointed at [[The Rent]]. [[Marius Vell]] has heard the sermon and drawn his own conclusions.
:::`,
    gmNotes: `Voice of the church: measured, patient, certain. Aurelan's priests never threaten; they cite precedent. Use them to make Ending C (use the flame) sound reasonable and lawful: a crowned hand on the leash, an end to the war, pensions paid. When the party meets a Lector, have them offer something real (a pardon, back pay) and want something small (a signature on a document they do not read closely).`,
    tags: ['god', 'living'],
  },
  {
    key: 'god-maelis',
    type: 'deity',
    name: 'Maelis',
    aliases: ['Maelis, the Hearth Mother', 'the Hearth Mother'],
    players: true,
    image: 'holy:god-maelis',
    summary: 'The Hearth Mother: home, harvest and birth. The most prayed-to god on the continent and the least political.',
    fields: [
      { key: 'Domain', value: 'Home, harvest, birth' },
      { key: 'Symbol', value: 'A split loaf on a hearthstone' },
      { key: 'State', value: 'Living' },
      { key: 'Holy days', value: 'Hearthday each week; Sowing (1 Seedwake); Last Sheaf (30 Reaping); Hearthnight (30 Longnight)' },
    ],
    relations: [
      { to: 'god-grum', kind: 'tolerates', note: 'He brings her sons home or he does not.', known: true },
      { to: 'god-isaurana', kind: 'shares Hearthnight with', note: 'Until the doors shut; after that the night is Isaurana\'s.', known: true },
      { to: 'god-hathe', kind: 'mourns', known: true },
      { to: 'god-sleeper', kind: 'has gone silent about', note: 'The one god whose oracles will not say "open it".' },
    ],
    body: `### What is known
Every house has her. A chipped loaf-stone by the fire, a knot of last year's barley over the door, a child's first tooth pressed into the hearth-clay. Maelis is shown as a broad woman with flour to the elbows, or as an old one with a lamp at a window, or as a girl with a lapful of apples: whichever the household needs that year.

She asks little and is asked for everything: rain, a safe birth, a son back from the ash, a loaf that rises. Her priests say she grants about a third of it, which is more than any other god manages.

### Worship across the nations
She is the same everywhere and that is her strength. The Regency's great families keep a gilded hearth and a priestess in silk; a fisherwife in [[Hask]] keeps a stone and says the same words. In the Grimmark the clan hearth is never let out, and letting it die is a crime judged by the clan mother. The halfling [[The Barge Clans]] carry a hearth-coal from boat to boat when a barge is sold. In [[Cinderford]] her shrine on [[Temple Row]] is the only one with a queue.

### The priesthood
Midwives, bakers, and the hearth-wives who sit with the dying. There is no hierarchy worth the name. The nearest thing to a high priestess is whoever has delivered the most children in a district, and she is called Mother and nothing else. They keep the birth-rolls, which is why the Hearth Mother's priestesses were the first to notice that children born in the ash since 3002 were coming out wrong, or different, or both. See [[The Hollowborn]].

### What the faithful believe
That she was the first to take the Stone-Under's hand and the first to let it go; that she fed the Nine as children and will not speak of them; that a door opened to a stranger on Hearthnight is a prayer she always hears.

### Relations
She tolerates [[Grum]] the way a mother tolerates a recruiting sergeant. She shares the last night of the year with [[Isaurana]]: Hearthnight belongs to Maelis until the doors are shut, and after that the night is the Veiled One's. She mourned [[Hathe]] openly, the only god who did; her priestesses still lay a loaf at the door of every [[The Doorkeeper's Chapel]].

### Holy days
Hearthday every week, when bread is baked and quarrels are meant to be put down. Sowing on 1 Seedwake; Last Sheaf on 30 Reaping, when the final sheaf is dressed as a woman and burned; Hearthnight on 30 Longnight, the longest night, when every door on the continent is unbarred and a plate is set for whoever comes.

:::gm
Maelis has not told her priests to want the crack open. She has not told them anything. Her oracles, who used to speak of weather and children, have dreamed for nine years of a cold hearth with something breathing behind it, and when they ask her what it means she does not answer. The other gods each want something from the crack (a meal, a leash, a domain, a settled score, a child freed) and their priests work at cross purposes in the Ashenreach; hers alone do not push. Whether she stands apart from the pantheon's hunger, or wants something she will not name, or is simply the last to be told, is a thing the GM can decide late. Her silence is a clue, and a lever: if the party wants a god's help to reseal the ward, this is the door to knock on, and it may not open.

The Mothers of Cinderford's birth-rolls record 31 Hollowborn births in the Smokes between Ashfall 3002 and Bloomtide 3004. The first six entries are the Cinders-born, all dated the night of the battle. [[Tibbet Marlowe]] is the fourth entry; the midwife noted "one eye wrong, otherwise fine" and underlined it twice.
:::`,
    gmNotes: `Play her priestesses as practical, tired and kind, and immune to politics; they have seen every faction's men born and will see them buried. The birth-rolls at the Temple Row shrine are a real resource: names, dates and the midwife's margin notes on every Hollowborn in town, including the entry for [[The Dreaming Widow]]'s nephew, in her own mother's hand.`,
    tags: ['god', 'living'],
  },
  {
    key: 'god-corvex',
    type: 'deity',
    name: 'Corvex',
    aliases: ['Corvex, the Ledger', 'the Ledger'],
    players: true,
    image: 'holy:god-corvex',
    summary: 'The Ledger: trade, debts and oaths. Patron of the Concord. His priests audit prayers, and a broken oath counts as theft.',
    fields: [
      { key: 'Domain', value: 'Trade, debts, oaths' },
      { key: 'Symbol', value: 'An open ledger, one page black, one page red' },
      { key: 'State', value: 'Living' },
      { key: 'Holy days', value: 'Coinday each week; the Reckoning (1 Longnight)' },
    ],
    relations: [
      { to: 'god-aurelan', kind: 'rival of', note: 'Nothing is above debt, not even a crown.', known: true },
      { to: 'god-sefra', kind: 'partner of', note: 'She wrecks the ships; he insures them.', known: true },
      { to: 'f-concord-houses', kind: 'patron of', known: true },
      { to: 'people-shellbacks', kind: 'is served by, but not worshipped by', note: 'The Shellbacks keep his books and pray to someone else.', known: true },
      { to: 'god-sleeper', kind: 'calls the oldest unpaid debt', note: 'A death owed since 0 AW. He means to collect.' },
    ],
    body: `### What is known
Corvex does not love you. He is the only god who says so. He is drawn as a lean, grey clerk with a stylus behind each ear and a face you forget as soon as you have signed; his temples are counting-houses with a nave, and the nave is where the audit happens.

The Ledger's law is short. Everything is owed to someone. An oath is a loan of your word. A broken oath is theft, and theft is the one sin he has never forgiven anyone for, including other gods.

### Worship across the nations
He rules [[The Sevenhaven Concord]] in all but name; the seven bay-cities signed [[The First Concord]] on his altar, and every contract since carries his red-and-black page. In the Regency his priests are tolerated as useful and watched as foreign. The Grimmark clans distrust him and are in debt to him, which is the usual arrangement. In [[Iskaveth]] the Saint's church has outlawed usury and borrows from him through intermediaries. Orc companies sign their contracts under his page because [[The Mothers of the Iron]] insist: a company that breaks contract answers to the Mothers first, and the Ledger second, and nobody has ever asked which is worse.

### The priesthood
Auditors. They wear grey, carry a slate, and will hear your prayer, record it, and tell you what it will cost. A prayer for rain is cheap. A prayer for a son's life is dear, and paid in instalments, and if you miss one the god remembers. The senior auditors of [[Sevenhaven]] are called the Bench and are said to be able to recite the debt of every crowned head in Vael Ardith, including the empty one.

### What the faithful believe
That the world was made on credit and the final reckoning is the day the books balance; that an honest debtor is holier than a careless rich man; that Corvex has never once lost an argument with [[Aurelan]].

### Relations
He and the Crowned Sun have quarrelled since [[The First Imperial Loan]]. He and [[Sefra]] are partners: she sinks the ships and he insures them, and both do well. He is served by the [[Shellbacks]], who keep his books more faithfully than any priest and have never once prayed to him; his auditors find this discourteous and have never been able to prove it is a sin.

### Holy days
Coinday every week, when wages are paid and debts fall due. The Reckoning on 1 Longnight, when every counting-house on the continent closes at noon, the only half-day of the year, and the books are read aloud. In [[Cinderford]] the Reckoning is kept at [[Tollamund & Daughters]], very slowly.

:::gm
Corvex calls [[The Sleeper Below]] the oldest unpaid debt in the world: a death owed since the Godslaying and never collected. He means to collect it in full, which to the Ledger means the whole god eaten and the books closed, and he regards the others' schemes (a leash for [[Aurelan]], a domain for [[Isaurana]], a share for [[Grum]]) as creditors trying to settle for less. His Bench has been told so in the language they understand: the Ashenreach is a distressed asset, the Ninth Ward is the lien, and the Ledger does not accept partial payment. The Concord's purchase of the mercenaries' debt began as banking and is now also theology. He is in no hurry; a debt accrues.

A broken oath is theft, and the Ninth Lantern's contract (stand down if the lantern goes out) is an oath sworn on his page. If the party puts the lantern out on purpose, the Ledger notices.
:::`,
    gmNotes: `Auditors make excellent scenes: they never lie, they itemise. Use one to tell the party exactly what the company owes and to whom, down to the copper, and let the numbers be the horror. If a PC swears an oath on the red-and-black page, write it down and make the god keep the books.`,
    tags: ['god', 'living'],
  },
  {
    key: 'god-sefra',
    type: 'deity',
    name: 'Sefra',
    aliases: ['Sefra of the Seven Tides', 'the Seven Tides'],
    players: true,
    image: 'holy:god-sefra',
    summary: 'Sefra of the Seven Tides: sea, storms and the southern bays. Each bay keeps its own face of her, and the faces do not agree.',
    fields: [
      { key: 'Domain', value: 'Sea, storms, the seven bays' },
      { key: 'Symbol', value: 'Seven wave-lines under a single eye' },
      { key: 'State', value: 'Living' },
      { key: 'Holy days', value: 'Tideday each week; the Turning (7 Bloomtide); Lastwater (23 Frostcall)' },
    ],
    relations: [
      { to: 'people-shellbacks', kind: 'resents', note: 'They crossed her sea and never once thanked her.', known: true },
      { to: 'god-orvanne', kind: 'quarrels with', note: 'Over the Ness of Thurm, which both claim and neither will enter.', known: true },
      { to: 'god-sleeper', kind: 'wants finished, quickly', note: 'The red moon pulls her tides wrong. She wants the Sleeper dead so the Ember sets, and does not much care who eats it.' },
    ],
    body: `### What is known
Sefra is seven goddesses who happen to be one. The Marrowport Sefra is a drowned woman who walks up the beach at night to count her children. The Cowl Sefra is a laughing fat fishwife who gives and takes with the same hand. The Sevenhaven Sefra is a harbourmistress with a chain and a bell. Gilt's is a miser, Harrowquay's is a widow, Keel's is a sound so deep it has no face at all, and the Sefra of [[Vessary]] is a girl on an island who will not say what she is looking at. Theologians have tried to reconcile the seven. The seven cities have fought three wars over it.

### Worship across the nations
Every bay of [[The Sevenhaven Concord]] keeps its own temple and its own calendar of her, and a sailor who prays in the wrong city's words is politely corrected and then charged for the correction. Beyond the bays she thins out: the Grimmark fishers of [[Coldwater]] call her the Grey Reach's Mother and throw bread to her; in [[Qerath]] on the Glass Sea she is an old name the Saint's church has not bothered to forbid. Inland she is a swear-word for weather.

### The priesthood
Tide-wardens: harbour pilots, salvage-priests, and the women who keep the drowned-lists. A tide-warden's blessing is required for any ship leaving a Concord port, and the fee is set by the bay, and the bay is always a little hungrier than last year.

### What the faithful believe
That she brought the elves to [[Sael]] by sea at [[The Coming of the Elves]] and has been waiting ever since for them to remember to say thank you. That the drowned become hers and are happier for it. That she will let any ship cross any sea but the water around [[The Ness of Thurm]], where her seven faces look away together.

### Relations
She and [[Corvex]] are partners: she wrecks, he insures, and between them a bad year at sea still turns a profit in [[Sevenhaven]]. She resents the [[Shellbacks]], who crossed her sea to the southern bays and never raised a single shrine. She quarrels with [[Orvanne]] over the Ness, which both claim and neither enters. She has nothing to say about [[The Unburnt Saint]], and the Saint's missionaries have noticed that ships bound for [[Ostrakai]] from [[Qerath]] keep sinking.

### Holy days
Tideday every week. The Turning on 7 Bloomtide, the first day of safe sailing, when every bay launches a boat with no crew and watches where she takes it. Lastwater on 23 Frostcall, when the fishing fleets are drawn up and the drowned-lists are read.

:::gm
Sefra's quarrel with the Sleeper is practical. Since the Ember rose there have been two moons on her water, and the tides have run wrong in every bay: double springs, dead neaps, a harbour chain in [[Sevenhaven]] that lifts an hour late. She wants the Sleeper finished so the red moon sets, and she wants it done fast. She does not much care who does the eating or whether anything is left for her. Her tide-wardens have been quietly told that the storms on the Hollow Sea this autumn are not weather: she is pushing ships, and the goods and people in them, toward the ash coast and the Rent, so there are hands enough to pull the Ninth Ward open. The slower gods, [[Corvex]] especially, find her haste dangerous, and the auditors are quietly paying captains not to sail.

Her faces look away from the Ness because something is there that she will not look at: the Shellbacks' god, the Slow One. A tide-warden of Vessary, drunk, will say "she isn't afraid of it. She's embarrassed."
:::`,
    gmNotes: `Use her for texture in Concord scenes: seven contradictory blessings, seven fee schedules. If the party takes ship, the tide-warden's drowned-list is a handout waiting to happen: names of the lost, including one from the Ninth Lantern who was never on a boat.`,
    tags: ['god', 'living'],
  },
  {
    key: 'god-grum',
    type: 'deity',
    name: 'Grum',
    aliases: ['Grum, the Old Iron', 'the Old Iron'],
    players: true,
    image: 'holy:god-grum',
    summary: 'The Old Iron: war, soldiers and the forge. Crude, loud, beloved by mercenaries. Prayers to him are mostly swearing.',
    fields: [
      { key: 'Domain', value: 'War, soldiers, the forge' },
      { key: 'Symbol', value: 'A hammer with a notched blade for a handle' },
      { key: 'State', value: 'Living' },
      { key: 'Holy days', value: 'Ironday each week; Anvil Night (30 Emberwane); the night of Cinders' },
    ],
    relations: [
      { to: 'god-aurelan', kind: 'is not the dog of', note: 'Ask him.', known: true },
      { to: 'god-corporal', kind: 'drinks with', note: 'Half fond, half rival. The Corporal is poaching his congregation.', known: true },
      { to: 'god-tharos', kind: 'learned the forge from', known: true },
      { to: 'god-maelis', kind: 'owes sons to', known: true },
      { to: 'god-sleeper', kind: 'wants a piece of', note: 'For the fight, and to make sure the Saint does not get it. He will take the leavings.' },
    ],
    body: `### What is known
Grum is the sound an anvil makes. He is drawn with a soldier's body and a smith's hands and no face anyone agrees on, because every company paints its own sergeant on him. He has no theology. He has sayings, and the sayings are rude.

Prayers to the Old Iron are not prayers. They are what a soldier says when the strap breaks, when the line holds, when the pay does not come. The faithful hold that any sentence with his name in it and real feeling behind it reaches him, and that he prefers the short ones.

### Worship across the nations
Every army, every forge, every company. The Regency's old imperial legions had his shrine at the gate of every camp and [[The Regency of Ardith]] still sends a chaplain of Grum to the front, in triplicate. The orc companies swear by him in every contract and by the Mothers in every quarrel, and [[Mirrel Vosk]] says there is a difference. In the Grimmark he is a smith first, a soldier second, and the clans call him Uncle. The Concord pays him in weapons contracts. Iskaveth's Saint has tried to replace him in her armies and has had to settle for sharing: a soldier will pray to the Saint for mercy and to Grum for a clean edge.

### The priesthood
Sergeants, farriers, armourers, and anyone who has buried more than ten. There is no ordination; there is seniority. A priest of Grum is whoever the company looks at when it needs a word said over a grave and nobody has a Raveler to hand. In [[Cinderford]] his shrine is the back wall of the drill yard on [[Lantern Hill]], and his altar is the whetstone.

### What the faithful believe
That he learned the forge from [[Tharos]] and the fight from nobody. That he never asked anyone to win, only to stand. That he was at Cinders, in the line, and the eight dark lanterns are the only thing he has ever been heard to weep for.

### Relations
[[Aurelan]]'s priests call him the sun's hound; his own say that the sun has never carried a shield. He drinks with [[The Hanged Corporal]], and the drinking is half fond and half a quarrel, because the Corporal is poaching his congregation one refusal at a time. He owes [[Maelis]] sons and knows it.

### Holy days
Ironday every week, when blades are oiled and nobody is flogged. Anvil Night, 30 Emberwane, when forges are let go cold and relit at midnight with a prayer that is one syllable long. And in the Ashenreach, the night of the Battle of Cinders, when every company lights a lantern and [[The Ninth Lantern]] does not need to.

:::gm
Grum's reasons are the simplest in the pantheon. A god below, half-dead and unguarded, is the biggest fight there has ever been and he wants a piece of it; he does not need the whole carcass, and he has said so to the others, which makes him the one god the rest can bargain with. His second reason is spite: [[The Unburnt Saint]] has been taking his soldiers, and if the crack feeds her she will take the rest. He would rather the Sleeper went to anyone else, [[Corvex]] included. His sergeant-priests are told nothing; they do not need to be. War is the thing most likely to crack the Ninth Ward the rest of the way, and war is what they are for.

He has no quarrel with the Corporal's god-hood except professional: refusal is bad for recruitment. If the Corporal ever refuses the pantheon, Grum has not decided which side of the table he is on.
:::`,
    gmNotes: `Grum is the fun god. Let soldiers swear by him in every scene ("Grum's rusty nails"), let his priest be a one-eyed farrier who blesses by spitting on the blade. If the party needs a god to answer a prayer in a fight, it is this one, and the answer is a held line, never a miracle.`,
    tags: ['god', 'living'],
  },
  {
    key: 'god-isaurana',
    type: 'deity',
    name: 'Isaurana',
    aliases: ['Isaurana the Veiled', 'the Veiled One', 'the Veiled'],
    players: true,
    image: 'holy:god-isaurana',
    summary: 'Isaurana the Veiled: night, secrets and desire. Patron of courtesans, spies and lovers; her temples trade in what people want.',
    fields: [
      { key: 'Domain', value: 'Night, secrets, desire' },
      { key: 'Symbol', value: 'A veil, lifted a finger\'s width' },
      { key: 'State', value: 'Living' },
      { key: 'Holy days', value: 'The Unveiling (the 30th night of each month, Pallas dark); the Long Veil (30 Longnight, after the doors shut)' },
    ],
    relations: [
      { to: 'god-hathe', kind: 'loved', note: 'He kept the doors; she kept what was said at them. She has not finished mourning and does not intend to.', known: true },
      { to: 'god-saint', kind: 'rival of', note: 'The Saint is taking desire from her, and the Veiled One does not share.', known: true },
      { to: 'sorrel-vey', kind: 'speaks through', note: 'Her priestess at the Velvet Ledger.', known: true },
      { to: 'god-sleeper', kind: 'wants the dreams of', note: 'Not the whole god: its domain. Dreams were Ysmereth\'s, and the Veiled One has wanted them for nine thousand years.' },
    ],
    body: `### What is known
She is the hour after the lamps go out. Isaurana is never shown whole: a veil, a wrist, a mouth in the dark of a painting, the shape of a woman behind a screen with a candle on the wrong side of it. Her temples are perfumed and quiet and very well informed. You go in wanting something. You come out having told her what.

Her law is simple and nobody keeps it: desire is holy, and so is silence, and the sin is pretending you do not want what you want.

### Worship across the nations
In the Regency she is the god of the great houses after dark, the patron of the Quiet Office's older trade, the name on the lips of ministers who would not say it in daylight. In the Concord her houses are licensed and taxed and the tax is enormous. In [[Sael]] the elves keep her in the old way, as the goddess of the ink: the needle that writes a memory on skin is hers, and so is the hand that reads it by touch. [[Iskaveth]] has banned her. Her houses in [[Halcyra]] have never been busier. In [[Cinderford]] she keeps [[The Velvet Ledger]], and what is said in its rooms is heard in hers.

### The priesthood
Courtesans, confessors, cipher-clerks, matchmakers, a great many widows. Her priestesses (and priests; she is not particular) take a veil at ordination and wear it only in the temple, so that outside it no one can be sure who serves her. They say a prayer to Isaurana is a secret told to her, and the answer is a secret told to you. Both are true. Neither is free.

### What the faithful believe
That she was the night before there were stars and will be the night after. That she loved [[Hathe]], Keeper of Doors, and sat with him at every threshold, hearing what the dying said as they went through, and that since he died she has been listening at the doors alone. That she knows what you did and finds it interesting.

### Relations
She loved the Doorkeeper, and her houses wore black for a year after Cinders without explaining why. She is at war, quietly, with [[The Unburnt Saint]], who is taking desire from her the way a fire takes air from a room; a priestess of the Veil will tell you the Saint's mercy is a hand on your cheek, and that Isaurana's is a hand somewhere else, and that you should think about which you would rather have on a cold night. She shares the longest night with [[Maelis]]: the hearth until the doors are shut, and then the dark.

### Holy days
The Unveiling, on the thirtieth night of every month when the pale moon is dark: the veil is lifted a finger's width and one true thing is said aloud in every house of hers. The Long Veil on 30 Longnight, which begins when Hearthnight's doors close and lasts until a dawn that is in no hurry.

:::gm
Isaurana is the most particular of the pantheon about what she wants from the crack. She does not want the Sleeper's corpse. She wants its domain. Dreams were Ysmereth's before the Godslaying, and for nine thousand years nobody has held them; night is hers already, and she thinks dreams belong with it. If the others devour [[The Sleeper Below]] whole, the domain is scattered among them like a dead man's coat. So she wants the crack open and the Sleeper reached, but reached by her first, through the one door she knows best: the dreamers. Her priestesses are told to gather what the Hollowborn say in their sleep, and [[Sorrel Vey]] has a book of it. She is also the one god who finds the Sleepless useful rather than mad.

Her menace is the menace of being perfectly known. A priestess of Isaurana who has decided she wants something from a PC does not seduce; she describes the PC to themself, accurately, and waits.
:::`,
    gmNotes: `Allure through implication, never description. Her scenes are candlelight, the sound of a door, an offer that is exactly what the PC wanted and nothing they asked for. Sorrel Vey is her voice in Cinderford; use the Velvet Ledger as the place where the party learns things they would rather not have paid for. Never let the Veil feel safe. Isaurana does not have friends; she has people she finds interesting, and they do well until they stop being so.`,
    tags: ['god', 'living'],
  },
  {
    key: 'god-orvanne',
    type: 'deity',
    name: 'Orvanne',
    aliases: ['Orvanne, the Green Wild', 'the Green Wild'],
    players: true,
    image: 'holy:god-orvanne',
    summary: 'The Green Wild: forests, beasts and the hunt. Sael\'s patron, though the elves no longer remember why.',
    fields: [
      { key: 'Domain', value: 'Forests, beasts, the hunt' },
      { key: 'Symbol', value: 'An antler with a green leaf growing from the tine' },
      { key: 'State', value: 'Living' },
      { key: 'Holy days', value: 'Greening (1 Bloomtide); the Culling (30 Leafrot)' },
    ],
    relations: [
      { to: 'god-sefra', kind: 'quarrels with', note: 'Over the Ness of Thurm.', known: true },
      { to: 'god-hathe', kind: 'hunted for', note: 'What slipped past the Doorkeeper, the Wild ran down. Since Cinders the hunt never ends.', known: true },
      { to: 'sael', kind: 'patron of', known: true },
      { to: 'f-remembrancers', kind: 'is studied by', note: 'They would like to know when he became their god.', known: true },
      { to: 'god-sleeper', kind: 'wants devoured, far from his wood', note: 'Open the Ninth, keep the Fourth shut. The Saelwood drinks from the Fourth Ward.' },
    ],
    body: `### What is known
Orvanne is what is left when the road ends. He is shown as a stag with a man's hands, or a man with a stag's patience, green to the knees with moss and never looking straight at you. His temples are clearings. His priests are whoever came back from the trees with meat.

He is not kind and not cruel. He is the rule that everything eats and everything is eaten, and the faithful say he is the only god who has never lied, because he has never said anything.

### Worship across the nations
He is the god of [[Sael]], and the Saelwood is his cathedral, and the elves keep his rites with great care and cannot tell you when they began. Outside Sael he belongs to huntsmen, foresters, charcoal-burners and poachers: anyone who goes under the trees alone. The Grimmark clans give him the first kill of the season and the Regency's great families keep deer-parks in his name and shoot at them from chairs. In [[Cinderford]] his shrine on [[Temple Row]] is a single antler nailed to a post, and the ash plain has no trees, and the shrine is tended anyway, by people who remember green.

### The priesthood
Wardens of the Wild in Sael, who go barefoot and tattoo his antler on the sole so that every step is a prayer. Elsewhere, hunt-masters, hedge-priests and the old women who know which mushroom. There is no doctrine beyond the Culling: take what you need, leave the rest, and when the Wild takes you, do not complain.

### What the faithful believe
That the Saelwood grew from his first footprint. That the elves came to him across the sea at [[The Coming of the Elves]] and he took them in, for a price they have forgotten. That when the Keeper of Doors let one slip, the Green Wild's hounds ran it down, and that since [[The Death of Hathe]] the hounds have not stopped running.

### Relations
He quarrels with [[Sefra]] over [[The Ness of Thurm]], which the sea claims and the forest claims and neither will enter. He hunted for [[Hathe]] and misses him the way a dog misses the hand. [[The Remembrancers]] of Sael study him politely and would very much like to know what the elves worshipped before.

### Holy days
Greening, 1 Bloomtide, the first day nothing is hunted. The Culling, 30 Leafrot, the last day of the hunt, when the wardens of Sael run a stag through [[Ilmareth]] and nobody asks what happens to it.

:::gm
Orvanne became Sael's god in 1102 AW, the year of [[The Saelish Trespass]]. The elves had another god before that, or the god had them; when they burned the skin that remembered the Trespass they burned that name too, and the Green Wild, who had been a forest spirit the elves tolerated, stepped into the empty place. He has never told them. The Remembrancers are a hundred years from working it out on their own, unless someone reads [[Sorrel Vey]].

His stake in the crack is geography. The Saelwood drinks from the Fourth Ward, weak since the Trespass; every spell in Sael thins it further, and if the Fourth gives way the Wild loses its wood. So he wants the Sleeper devoured, with the rest, but through the Ninth, which is six hundred miles from his trees. Open it over there; keep it shut here. His wardens discourage magic in the Saelwood with a ferocity the elves think is tradition, and his hunt-priests in the Ashenreach say nothing against the Rent at all.

He also wants the hunt to end. Since Hathe died the dead that do not pass are his to run down, and there are too many.
:::`,
    gmNotes: `Orvanne never speaks; play him through weather, animals and the look on a warden's face. A hunt-priest in the Ashenreach is a good quiet NPC: knows every track in the ash, will not go near the Rent, will not say why. If the party reseals the Ninth, Orvanne is neither ally nor enemy, and the Fourth is still weak.`,
    tags: ['god', 'living'],
  },
  {
    key: 'god-tharos',
    type: 'deity',
    name: 'Tharos',
    aliases: ['Tharos, the Stone-Under', 'the Stone-Under'],
    players: true,
    image: 'holy:god-tharos',
    summary: 'The Stone-Under: earth, mountains and endurance. God of the dwarves; once the Lithic\'s father, and the one who cursed them.',
    fields: [
      { key: 'Domain', value: 'Earth, mountains, endurance' },
      { key: 'Symbol', value: 'A closed fist of grey stone' },
      { key: 'State', value: 'Living' },
      { key: 'Holy days', value: 'Wardday each week; the Long Hold (1 Hollowfrost); Stonefast (1 Frostcall)' },
    ],
    relations: [
      { to: 'people-lithic', kind: 'father of, and cursed', note: 'He took mortal lovers; their children were the Nine.', known: true },
      { to: 'people-dwarves', kind: 'god of', known: true },
      { to: 'lore-nine', kind: 'grieves for', note: 'They are still awake in the stone. He can hear them. He has not answered in nine thousand years.' },
      { to: 'god-sleeper', kind: 'wants devoured, and the wards fallen', note: 'All nine. It would free his children and kill the Lithic. He has decided he can bear it.' },
    ],
    body: `### What is known
Tharos does not move. He is the mountain and the thing under the mountain, the patience that outlasts the river. He is shown as a seated giant whose lower half is the rock he sits on, or not shown at all: a closed fist carved into a lintel is enough, and the dwarves of [[Hollowhall]] say a fist is already too much talk.

His law is endurance. Hold. Do not break. What breaks was not stone.

### Worship across the nations
He is the god of the dwarves and always has been: the surface clans of [[The Grimmark Holds]] keep his fist over every door and swear their long oaths on bare rock. Since [[The Return from the Deep]] the Returned keep him too, but differently; they stand at his shrines and do not pray, and the surface dwarves do not ask what they are waiting for. The Grimmark's human clans share him with the dwarves and call him the Old Man. Masons and miners everywhere mutter his name; the Regency's great builders put his fist in the foundation and [[Aurelan]]'s disc on the roof. The Lithic do not worship him. They are his family, and he has not spoken to them since the Godslaying.

### The priesthood
Hold-priests among the dwarves: the oldest in a hold, chosen by sitting longest in silence. They keep the stone-oaths, the mine-rites, and the long list of the dead in the deep. Among the surface dwarves the priesthood also keeps the Lithic holy: a living statue found in the mountains is tended, roofed and left alone, and a dwarf who chips one is buried standing up.

### What the faithful believe
That he was the first thing that was not water. That he took mortal lovers at [[The Stone Marriage]] and their children, the Nine, were the pride of the world until they were its shame. That he cursed them for the Godslaying, and the curse is the stone that creeps up every Lithic body, and that he has never once said he regretted it. The dwarves say that is because he has not finished saying it.

### Relations
He taught [[Grum]] the forge and never forgave him for making it loud. He is the father of [[The Lithic]] and the grandfather, in a way nobody likes to think about, of every ward. He does not answer the Returned. He has not answered anyone, the hold-priests admit, in a very long time; stone is like that.

### Holy days
Wardday every week, when nothing is built or dug and the surface dwarves walk to the nearest standing Lithic and sit with it. The Long Hold on 1 Hollowfrost, the first day of the year, a day and a night of total silence in every dwarven hold. Stonefast on 1 Frostcall, when oaths are renewed on bare rock.

:::gm
Tharos wants every one of the Nine Great Wards to fall. Not the Ninth alone: all of them. His children are awake inside the stones, nine thousand years into a punishment he gave them, and he can hear them, and the only thing that will let them out is the wards breaking and the Sleeper, which they are holding, being finished at last. He would devour it himself for what it cost him, and he does not care who else is at the table.

He knows what that means. The living Lithic are kept alive by the wards they stand in; when the wards fall, the last of his line goes with them, and the Returned's shadows, and whatever the Grimmark's Eighth is holding back. He has decided he can bear it. His hold-priests do not know this. They have noticed that the surface dwarves' prayers for the Lithic have not been answered in living memory and that the Returned stand at his shrines like men outside a door that will not open. Of all the pantheon, Tharos is the one [[Warden Uthrem]] would most like to speak with, and the one who will never answer.

Whatever took the Returned's shadows under the Grimmark was not Tharos. He knows what it was. See [[The Nine Great Wards]].
:::`,
    gmNotes: `Tharos is grief with a mountain on it. Never let him speak; let the dwarves speak around him. A hold-priest from Skarn visiting the Ashenreach to sit with Warden Uthrem is a good late-arc NPC: she knows the rites for a Lithic who is about to finish turning, and nobody has asked her to perform one in forty years.`,
    tags: ['god', 'living'],
  },
  {
    key: 'god-hathe',
    type: 'deity',
    name: 'Hathe',
    aliases: ['Hathe, Keeper of Doors', 'the Keeper of Doors', 'the Doorkeeper'],
    players: true,
    image: 'holy:god-hathe',
    summary: 'Keeper of Doors, god of death\'s threshold. Died at Cinders in 3002 AW; since then the dead do not always pass. Raveler priests still keep his doors.',
    fields: [
      { key: 'Domain', value: 'Death\'s threshold, passage, doors' },
      { key: 'Symbol', value: 'A door standing open a hand\'s width, an iron key in the lock' },
      { key: 'State', value: 'Dead (3002 AW)' },
      { key: 'Holy days', value: 'Doorsnight (1 Leafrot); the night of Cinders, since 3002' },
    ],
    relations: [
      { to: 'people-ravelers', kind: 'is kept by', note: 'His doors are tended by the Rook-Court\'s priests.', known: true },
      { to: 'god-saint', kind: 'was drunk by', note: 'She walked into the fire where he was dying and came out with what was left of him.' },
      { to: 'god-sleeper', kind: 'stood between the gods and', note: 'His doors held both ways. With him dead, the pantheon began to plan.' },
    ],
    body: `### What is known
Hathe was the god you met once. He stood at the door between the last breath and whatever is after, a tall thin shape in a grey coat with a ring of keys, and he opened the door and he did not go through, and everyone went through eventually. He asked nothing. He was not death; death happened to you elsewhere. He was the latch.

He died at [[The Battle of Cinders]] in 3002 AW. Nobody knows how. Priests who had served him for forty years felt the keys drop out of their hands at the same moment, all across the continent, and that night the first soldier who should have died at Cinderford did not go anywhere. See [[The Death of Hathe]].

### Worship across the nations
Before 3002 he had a small, respected priesthood everywhere and a chapel by every graveyard. Since then his worship has become the [[Ravelers]]' alone: the crow-folk undertakers who followed armies as his lay clergy took up the keys when the priests dropped them, and now every [[The Doorkeeper's Chapel]] in Vael Ardith is a Raveler chapel. Humans still say his name at a graveside out of habit. Most add "wherever he is."

### The priesthood
The Rook-Court's Doorkeepers: [[Quorl Many-Words]] in Cinderford, under [[Mother Corvane]]. They keep the rites exactly as they were, open a door at every burial, speak the words, and record what the dying said last, because a dead god cannot hear it and someone should. They are the only priests on the continent who serve knowing nobody is listening, and they will tell you, a little sharply, that it has made them better at it.

### What the faithful believe
That the Keeper's doors are still standing, unattended, and that some of the dead find them and some do not. That the ones who do not are not his fault. That he will be back, because a door with no keeper is a thing the world cannot stand for long, and the world has a way of finding staff.

### Relations
[[Isaurana]] loved him and sat with him at every threshold; her houses wore black for a year. [[Orvanne]]'s hounds ran down what slipped past him, and now cannot stop. [[Maelis]] was the only god who mourned him openly. [[The Unburnt Saint]] walked out of the fire he died in, unburnt, and her church says that was his last mercy.

### Holy days
Doorsnight, 1 Leafrot, the first night of the dying month, when every door in a house is propped open until dawn so that anyone who has lingered can leave. And since 3002, the night of Cinders, when the Ravelers stand on [[Corvel Rise]] and read the year's last words aloud to nobody.

:::gm
Hathe did not die by accident. He was at Cinders because every god is where the dying are thickest, and the battle sorcery that cracked the Ninth Ward broke him open with it; and [[Ilyra of Halcyra]], a camp healer, walked into the fire where he lay dying and drank what was left. She walked out unburnt because the Keeper of Doors was inside her. She is ascending on him. Her church knows and calls it a bequest.

The other thing nobody has worked out: Hathe's doors held both ways. He was the one god who kept the rest of the pantheon from the Sleeper's grave, not out of virtue but out of office; the dead and the gods passed through him or not at all. He is dead, and the door is open, and the gods began to plan the morning after. [[Hathe's Door-Key]] is one of his keys, dropped at Cinders. It still turns.
:::`,
    gmNotes: `Hathe is the ache at the centre of the setting: the one decent god, and he is gone. Play his Raveler priests as dry, faithful and furious at the universe. Quorl's seven whispered sentences and the Rook-Court's ledger both begin here. If a PC dies in the Ashenreach, Hathe's absence is why the body might sit up.`,
    tags: ['god', 'dead'],
  },
  {
    key: 'god-sleeper',
    type: 'deity',
    name: 'The Sleeper Below',
    aliases: ['Ysmereth', 'the Sleeper', 'the Buried God'],
    image: 'holy:god-sleeper',
    summary: 'The buried god, once Ysmereth of dreams and endings, killed by the Nine and held under the continent by the Great Wards. Not dead. Not awake. Wanting to be used.',
    fields: [
      { key: 'Domain', value: 'Once dreams and endings' },
      { key: 'Symbol', value: 'A closed eye (the Sleepless draw it half open)' },
      { key: 'State', value: 'Dead, or sleeping, or neither' },
      { key: 'True name', value: 'Ysmereth, known only to the Lithic and the Nine', gm: true },
      { key: 'Holy day', value: 'Every full Ember, to the Sleepless' },
    ],
    relations: [
      { to: 'lore-nine', kind: 'was killed by', note: 'And holds them in the stone as much as they hold it.' },
      { to: 'lore-wards', kind: 'is held under', note: 'Nine wards, three of them failing.' },
      { to: 'f-sleepless', kind: 'is worshipped by', note: 'They think waking it ends suffering. It lets them think so.' },
      { to: 'item-lantern', kind: 'speaks through', note: 'Whoever holds the flame begins to hear it.' },
      { to: 'ysse', kind: 'calls to', note: 'In dreams, through the lantern. She thinks it is the flame.' },
      { to: 'god-hathe', kind: 'was kept from the gods by', note: 'Until Cinders.' },
    ],
    clocks: [{ name: 'The Sleeper stirs', segments: 12, filled: 3, known: false }],
    body: `### What the world knows
Almost nothing, and most of that wrong. Common folk know that something lies under the continent and that the Great Wards keep it there; children in the Regency are told it is a dragon, in the Grimmark a drowned giant, in Sael nothing at all. The Sleepless of [[The Smokes]] say it is a god who dreams, and that it dreams of an end to pain, and that it only needs waking. Scholars who have read the Lithic fragments say the Nine killed a god and buried what would not stay dead, and are not asked to dinner twice.

### What the Lithic know
Its name is Ysmereth. It was the god of dreams and endings: the one who, some myths say, dreamed the first mortals at [[The Godsdawn]], and who would have dreamed the last. The Nine killed it at [[The Godslaying]] to prove that mortal-born could unmake a god, and learned the one thing the gods already knew: a god cannot fully die. What was left they held under the land with nine wards made of their own divinity, and became stone to do it. See [[The Nine]] and [[Ul-Tarran]].

### What it is now
Something between death, coma and undeath, and nobody, not the Lithic, not the pantheon, knows which. It dreams. The dreams leak where the wards are thin: the [[The Hollowborn]] are born of them, the [[The Weeping Orchard]] bleeds with them, and at every full red moon half of [[Cinderford]] dreams the same dream. Each full Ember the dream is clearer than the last. [[Warden Uthrem]] says that is not the Sleeper waking. He says it is the Sleeper learning to speak.

### What it wants
To be used. This is the secret under the secret. The Sleeper does not want to wake, or does not only want that; it wants a hand on the leash, because a hand on the leash is a mouth it can borrow. Whoever holds [[The Lantern of the Ninth]], lit from a shard of the Ninth Stone, begins to hear it; first in dreams, then in daylight, then in their own voice. [[Brother Tallow]] has held the flame nine years and has started to say things he does not remember saying. [[Ysse Lampwright]] hears it already and thinks it is the lantern. It hides this want well. It lets the Sleepless believe it wants waking, the Saint believe it wants drinking, the Regency believe it wants ruling, and lets each of them pull at the crack.

### The pantheon
The living gods could never finish it: it lies under mortal wards no god can pass, and [[Hathe]] kept the door besides. Hathe is dead and the Ninth Ward is cracked, and every god has a different plan for what comes through. See each god's page. The Sleeper knows this too. It is not afraid of them. It has been dying for nine thousand years and has had time to think.

### The clock
**The Sleeper stirs** ticks one segment at every full Ember. Three are filled at the campaign's start. At six, the dream reaches everyone in the March of Cinders, sleeping or not. At nine, the dead of the Ashenreach stand up on their own at red moon without a ward-crack to help them. At twelve, the Sleeper speaks through whoever holds the flame, in their voice, and does not stop.`,
    gmNotes: `The Sleeper is never a monster on the table. It is a voice, a dream, a feeling of being wanted. Its dreams are on the Sleeper Dreams table; its voice, when it comes through a flame-holder, should be reasonable, tired, and sympathetic to whatever that PC most wants. The Ending C road (use it) is the Sleeper's road: let it feel like winning.

Keep "Ysmereth" out of the players' hearing until Warden Uthrem says it in session 6. The name is a key: a Lithic who hears a mortal say it knows that mortal has been to the Rent.`,
    tags: ['god', 'dead', 'buried'],
    gmTags: ['world-clock'],
  },
  {
    key: 'god-saint',
    type: 'deity',
    name: 'The Unburnt Saint',
    aliases: ['the Saint', 'Saint Ilyra', 'the Unburnt'],
    players: true,
    image: 'holy:god-saint',
    summary: 'Fire, mercy and desire: Ilyra of Halcyra, who walked out of the fire at Cinders unburnt and is becoming a god. Real and dangerous allure.',
    fields: [
      { key: 'Domain', value: 'Fire, mercy, desire' },
      { key: 'Symbol', value: 'An open hand wreathed in flame, the skin unmarked' },
      { key: 'State', value: 'Ascending (declared a living saint, 3007 AW)' },
      { key: 'Holy days', value: 'The Saint\'s Lamp (every full Ember); Firstfire (1 Highsun)' },
    ],
    relations: [
      { to: 'ilyra', kind: 'is', known: true },
      { to: 'f-church-saint', kind: 'is worshipped by', known: true },
      { to: 'seraphine-ashe', kind: 'sent', note: 'Her envoy in Cinderford.', known: true },
      { to: 'god-isaurana', kind: 'rival of', note: 'Desire is contested ground.', known: true },
      { to: 'god-hathe', kind: 'drank', note: 'In the fire at Cinders. Her church calls it a bequest.' },
      { to: 'god-sleeper', kind: 'wants to drink the leak of', note: 'Not devour it with the pantheon: drink the crack alone and finish ascending. The living gods regard her as a thief at their table.' },
    ],
    body: `### What is known
Nine years ago a camp healer named [[Ilyra of Halcyra]] walked into the sorcerous fire at [[The Battle of Cinders]] to pull out the wounded and walked out again with her hair unsinged and three dying men in her arms, and the plain burning behind her to the horizon. She has not been burned by anything since. She has not aged. In 3007 the temple-council of [[Halcyra]] declared her a living saint, and the declaration was a formality; the plateau had been praying to her for five years. See [[The Saint Declared]].

Her mercy is real. That is the first thing anyone says who has met her, and the second thing is that they would have followed her anywhere, and the third thing, said more quietly, is that they still want to.

### Worship across the nations
In [[Iskaveth]] she is the state and the state is on its knees. Her flame burns in every house; her hospitals take anyone, including the empire's old soldiers, and the old soldiers come out converted. Beyond the Saint's Spine her church builds missions, hospitals and the kind of comfortable houses that make a town want them to stay: [[The House of Unburnt Light]] in Cinderford is one. The Regency calls her a heresy and has not banned her, because her hospitals are better than its own. Soldiers across the continent pray to her for mercy and to [[Grum]] for a clean edge, and both gods have noticed.

### The priesthood
The Unburnt: priests who pass a hand through flame at ordination and come out marked or not. Most are marked. The few who are not become her Sisters and Brothers, and the Sisters are the ones sent abroad, because a hand held unburnt in a candle wins more arguments than a sermon. [[Seraphine Ashe]] is one.

### What the faithful believe
That the fire at Cinders was [[Hathe]]'s last act: the Keeper of Doors, dying, chose a healer and gave her his mercy, and that is why the dead no longer pass easily, because mercy went to the living instead. That the Ember is her lamp, lit the night she walked out. That she will finish becoming a god when the world has suffered enough to deserve her, and that the Ashenreach is where it will happen.

### Relations
She is at war with [[Isaurana]] for desire, and the war is fought in every heart that has met her. [[Aurelan]]'s Curia writes her polite letters. [[Grum]] despises her and is losing soldiers to her. The living gods, her priests say, are jealous, as old men are of a young one.

### Holy days
The Saint's Lamp, every night the Ember is full, when her faithful put out every other light and sit with one flame. Firstfire on 1 Highsun, when the year's new fires are lit from a lamp carried from Halcyra.

:::gm
Ilyra drank Hathe. She did not choose to; she walked into the fire to save men and the dying god was in it, and what a healer does with a dying thing is take its weight, and she took it. She has been ascending on him ever since, and she knows exactly what she is now, and her mercy is still real, which is the dangerous part.

Her church wants the Ninth Ward's crack to finish the job. A god cannot fully die, and what leaks from the Sleeper through the crack is divinity with nobody's name on it; her church means to drink it before the pantheon can, and make her a full god in a single night at the Rent. The living gods regard her as a thief at their table and their priests work against hers, except where it suits them: [[Corvex]]'s auditors will fund her mission if it pulls the crack wider, and [[Aurelan]]'s Curia would crown her if she asked.

Her allure is Hathe's gentleness worn by someone who wants something. Everyone who meets her envoy feels wanted. Let the PCs feel it too.
:::`,
    gmNotes: `Seraphine is the Saint at the table: warm, attentive, patient, never pushing. Let her heal someone the party cares about, for free, early. The horror comes later, when the PCs realise they would hand her the flame if she asked nicely, and she has not asked yet. In Ending B she drinks the leak and Iskaveth marches west with hospitals in the van.`,
    tags: ['god', 'ascending'],
  },
  {
    key: 'god-corporal',
    type: 'deity',
    name: 'The Hanged Corporal',
    aliases: ['the Corporal', 'Corporal Rope'],
    players: true,
    image: 'holy:god-corporal',
    summary: 'A soldier hanged in the war for refusing to burn a village. Common soldiers pray to him out of spite, and it is starting to work.',
    fields: [
      { key: 'Domain', value: 'Common soldiers, refusal' },
      { key: 'Symbol', value: 'A frayed rope-end, worn knotted round the wrist' },
      { key: 'State', value: 'Ascending (nobody meant it)' },
      { key: 'Holy days', value: 'Every Restday ("he is owed it"); Rope Day (6 Frostcall)' },
    ],
    relations: [
      { to: 'god-grum', kind: 'drinks with', note: 'And poaches from.', known: true },
      { to: 'god-aurelan', kind: 'is not acknowledged by', note: 'Which he finds very funny.', known: true },
      { to: 'god-saint', kind: 'rival of', note: 'Both born of the war; she asks to be followed, he asks nothing.', known: true },
      { to: 'f-ninth-lantern', kind: 'is prayed to by', note: 'Half the company wears the rope.', known: true },
      { to: 'god-sleeper', kind: 'has no plan for', note: 'The one god with no stake in the crack. He might refuse the pantheon. He might refuse the PCs.' },
    ],
    body: `### What is known
Nobody agrees on his name. The Regency's record of the hanging survives, dated 12 Frostcall 2996, a Restday, at Dunmeer, a village in the Fallowden marches; the corporal's name is blotted with what the clerks swear was spilled ink. The Ninth Lantern calls him Dask. The orc companies call him Hob. In [[Ardmere]] he is Little Fenn. He was a corporal of a Regency line company, ordered to fire a village that had fed the other side, and he said no. Not a speech. He said "No, sir," and stood there, and the lieutenant said it again, and the corporal said "I heard you the first time," and they hanged him from the village's one tree at noon so the company could watch.

The village burned anyway. That is the part the soldiers like least and tell every time.

### Worship across the nations
Soldiers. Only soldiers; a civilian who prays to him gets no answer and, the faithful say, a faint sense of being laughed at. He has no temples. He has the rope: a bit of frayed cord knotted round the wrist, which half of every company on the continent now wears under the sleeve where the sergeant cannot see. The Regency has forbidden it twice. The orders arrived at the front in triplicate and were used, the faithful say with great piety, for the purpose such paper serves at the front. In [[Cinderford]] he has a nail in the wall of [[The Last Candle]] with a rope on it, and the rope has to be replaced every month because people keep taking a strand.

### The priesthood
None. There is a man in every company who knows the words, and the words are: "Corporal, I'm not doing it." That is the whole liturgy. There is a longer version for funerals that adds "and neither was he."

### What the faithful believe
That he started as a joke and the joke went too far. Soldiers prayed to him out of spite, the way you name a dog after an officer. Then, about five years ago, the prayers started being answered. A rope breaks. An order is lost between the tent and the line. A sergeant who was going to make an example of someone forgets why he came. Nothing large. Nothing anyone could prove. A quartermaster in [[Fort Mercy]] prayed to be spared a flogging and the fort burned down that night, and the faithful are honest enough to say that might have been a coincidence and the Glassers.

They believe that he does not want to be a god and is doing it anyway, out of the same stubbornness that got him hanged. They believe he is embarrassed by the whole thing. They find this very moving and will hit you if you say so.

### Relations
He drinks with [[Grum]], who likes him and is losing his congregation to him and has not decided which matters more. [[Aurelan]] does not acknowledge him, which the Corporal finds very funny. He and [[The Unburnt Saint]] were both made by the war, and she asks to be followed and he asks nothing, and soldiers who have met both say that is the whole difference between them.

### Holy days
Every Restday, because he was hanged on one and the faithful say he is owed the day. Rope Day, 6 Frostcall, the first Restday of the month he died, when a company's ropes are checked, nobody is hanged, and the man who knows the words says them over a cup, and it is passed, and nobody drinks until it reaches the newest recruit.

:::gm
The Corporal is real and his ascent is real, and he is the only god on the board with no stake in the crack. He was not at Cinders; he was dead six years before it. He has no domain to gain, no debt to collect, nothing under the stone he wants. He is the god of saying no, and the pantheon has not yet asked him anything, and when they do he will probably say it.

That makes him the one god who might help the party reseal the ward, and the one who might refuse them too, if what they are doing looks like an order. He answers spite better than prayer and refusal better than request. Mechanically: once per arc, when a PC who wears the rope refuses an order or a bargain at real cost, something small goes their way (a rope breaks, a guard forgets, a form is lost). Never more than that. He is a corporal.
:::`,
    gmNotes: `Funny first, moving second, never solemn. The Corporal's miracles are always deniable and always slightly petty. [[Spoons Aldane]] runs a book on whether he is real; [[Mirrel Vosk]] wears the rope and will deny it. The best use of him is the moment a PC says "No, sir" to Sallow, Seraphine or the Regency, and the GM lets a rope break.`,
    tags: ['god', 'ascending'],
  },
  // ───────────────────────────── Peoples ─────────────────────────────
  {
    key: 'people-humans',
    type: 'lore',
    name: 'Humans',
    aliases: ['Human', 'Ardithi'],
    players: true,
    summary: 'The most numerous people of Vael Ardith: squabbling heirs of a broken empire, found everywhere and agreeing on nothing.',
    fields: [
      { key: 'Lifespan', value: 'Sixty to eighty years, less at the front' },
      { key: 'Homelands', value: 'Everywhere; thickest along the Ardis, the bays and the Iskaveth plateau' },
      { key: 'Numbers', value: 'More than everyone else together' },
      { key: '5e', value: 'Human stats. Imperial-blooded humans: advantage on Wisdom (Perception) to notice ward-effects; disadvantage on saves against the Sleeper\'s dreams.', gm: true },
    ],
    body: `### Appearance
Every kind. River-folk of [[The Regency of Ardith]] run pale and sharp-faced, with the long imperial nose the old coins show. Bay-folk of the Concord are darker, salt-cured, and dress as well as they can afford and a little better. The plateau people of [[Iskaveth]] are brown-skinned and black-eyed and wear the Saint's flame on a cord at the throat. Grimmark clansfolk are big, red or black of hair, and scarred where the weather got them. Nine years of ash have given the people of the March one look: grey under the nails, grey in the hair, a cough.

### Culture
Humans built the empire and broke it and are currently arguing about who gets the pieces. They write everything down and lose it. They invented the form in triplicate, the pensioned veteran, the insurance policy and the siege engine, and are proud of all four. They marry young, drink early and bury often, and they have more gods per head than anyone, because they pray to whichever one is nearest when it goes wrong.

What a human respects: holding a place. What a human fears: being forgotten, which is why they carve names on everything, including other people's monuments.

### Names
Given names are plain and old; family names come from a place, a trade or a thing. Men: Osric Vane, Hollis Penrow, Lucan Dray, Corin Blythe, Ruadh Fell. Women: Tamsin Crake, Jessamy Harl, Edwen Tarrow, Maud Severin, Bettany Coyle. Plateau names end soft (Ilyra, Seraphine, Amaris); Grimmark names are short and hard (Hesk, Brann, Ulla).

### Where they live
The river valley of the Ardis from [[Caer Ardith]] to [[Sevenhaven]]; the seven bays; the plateau beyond the Saint's Spine; the highland clans of [[Skarn]]; and every town, fort and mercenary company between. [[Cinderford]] is four parts in five human.

### How others see them
Many, loud, brief. The elves find them touching. The Shellbacks find them a reasonable short-term investment. The orcs were bred to serve them and have not forgotten it. The Lithic remember when there were none.

### Playing a human
You are the default and nobody notices you, which is useful. Decide where you are from, because it decides your god, your accent and who you owe. A Regency human carries paper; a Concord human carries debt; an Iskavethi carries a flame; a clansman carries a grudge. Pick the one thing you would hold a wall for.

:::gm
The imperial bloodlines were bred, over three centuries of magi and marriages, for ward-sensitivity: an emperor was meant to feel the wards and so keep them. It worked. No living heir can sit the throne in [[Caer Ardith]] without hearing [[The Sleeper Below]]; [[Aurel IX]] heard it for twenty years and started digging. The Regency's genealogists have a list of eleven surviving ward-sensitive bloodlines, and three of them have a cousin in the Ninth Lantern's muster, and one of those three is [[Ilse Marrow]]'s mother's line. Whether the GM uses that is up to the GM.
:::`,
    gmNotes: `Humans are the texture of the world: let every human NPC have a nation and a god and a thing they want from the party. The imperial-blood hook is optional; it exists so a human PC can discover they hear the Sleeper too.`,
    tags: ['people', 'playable'],
  },
  {
    key: 'people-elves',
    type: 'lore',
    name: 'Elves',
    aliases: ['Elf', 'Saelish', 'the Inked'],
    players: true,
    summary: 'Long-lived folk of the Saelwood whose memories fade every century; they tattoo their history onto their skin, and the oldest are covered in ink they cannot read.',
    fields: [
      { key: 'Lifespan', value: 'Four to six centuries; memory, about one' },
      { key: 'Homelands', value: 'Sael and the Saelwood; small quarters in Sevenhaven and Caer Ardith' },
      { key: 'Numbers', value: 'Few, and fewer each century' },
      { key: '5e', value: 'Elf stats. Once per long rest an elf may read one of their own tattoos for a fact the GM chooses about their past; DC 15 Intelligence (History) to read someone else\'s.', gm: true },
    ],
    body: `### Appearance
Tall, narrow, long in the hand and the ear, with eyes that catch light like a cat's. Their skin is pale under the ink and there is always ink: a line at the wrist at twenty, a sleeve at eighty, and by two hundred a body written edge to edge in a fine script that goes grey as it ages. The oldest elves are illegible. They wear long sleeves in company, not from shame but from courtesy, because an elf's skin is a book and it is rude to read over someone's shoulder.

### Culture
Every elf forgets. Not slowly: in a season, around each century mark, a hundred years of memory thins to a few images and goes. Elven culture is a set of answers to that. They tattoo what matters while they still know it matters: names, oaths, children, debts, the shape of a lover's hand. They keep Remembrancers, scholars whose whole life is reading other people's skin and writing down what it says before the owner forgets what the words mean. They marry for a century at a time and part kindly. They do not build in stone, because a stone building outlasts the memory of why.

Sael has forgotten most of its history, and knows it has, and is quietly desperate. See [[The Remembrancers]].

### Names
Soft, long, two or three syllables, with a house-name that changes when the house forgets itself. Caelis Tarn, Ismere Vaun, Oriath Senn, Thessaly Morn, Ilvane Sorrow, Nereth Quill, Sabeth Lorne, Eluin Marr, Teiran Voss, Ysolde Fenn. An elf who has crossed a century mark adds "once" before the old house-name: Sabeth once-Lorne.

### Where they live
[[Sael]], down the west coast, in and under the Saelwood; the city of [[Ilmareth]], which is mostly trees. Small inked quarters in [[Sevenhaven]] and [[Caer Ardith]] where elves go to be scholars, courtesans or spies, the three trades that reward a good memory for other people's secrets. [[Sorrel Vey]] of [[The Velvet Ledger]] is one.

### How others see them
Beautiful, sad and not to be trusted with a promise older than a century. Humans find them melancholy; orcs find them soft; Ravelers, who trade in last words, find them fascinating, because an elf's last words are usually a question.

### Playing an elf
Decide what is written on you and what it was for. Pick three tattoos: one you can read, one you can nearly read, one you cannot. The GM will tell you what the third one meant, eventually. You are patient, polite and quietly frightened of the next century; play the fear as curiosity. You are good at listening because you have had to be.

:::gm
In 1102 AW Sael tried to open the Fourth Ward ([[The Saelish Trespass]]), failed, and lost most of a generation doing it. The survivors did the one thing elves can do that nobody else can: they chose to forget. They burned the skin that remembered, flayed the Remembrancers' records and let the century take the rest. The Fourth Ward has been weak ever since and the Saelwood has been drinking from it, and the elves do not know why their forest is slowly dying from the roots.

The record survived once. [[Sorrel Vey]]'s tattoos are a copy of a copy, inked on her by a dying Remembrancer two centuries ago, and she cannot read them, and [[Aelith Sorn]] can. Why the elves tried to open the ward, and who told them to, is the forgotten god's business: see [[Orvanne]].
:::`,
    gmNotes: `Elves are the mystery people: give every elven NPC a tattoo the party notices and a gap where a memory should be. Aelith Sorn will do anything to read Sorrel; Sorrel will do anything not to be read. The Trespass is the reason Sael is in the Ashenreach at all.`,
    tags: ['people', 'playable'],
  },
  {
    key: 'people-dwarves',
    type: 'lore',
    name: 'Dwarves',
    aliases: ['the Returned', 'Dwarf', 'Returned dwarf'],
    players: true,
    summary: 'Highland folk of the Grimmark who revere the Lithic as holy ancestors. Those who went under the mountains in the war came back casting no shadows, and will not speak of the deep.',
    fields: [
      { key: 'Lifespan', value: 'Two to three centuries' },
      { key: 'Homelands', value: 'The Grimmark Holds: Hollowhall, Skarn, the north-coast villages' },
      { key: 'Numbers', value: 'Perhaps forty thousand; the Returned, about nine hundred' },
      { key: '5e', value: 'Dwarf stats. The Returned: immune to effects that target shadows; cannot hide from creatures that see by darkvision in dim light (no shadow to break the outline); once per long rest the GM may have the shadow act.', gm: true },
    ],
    body: `### Appearance
Short, broad, heavy-boned, built for cold and carrying. Grimmark dwarves wear their hair in a single plait, men and women alike, and tie it with wire; the colour of the wire is the hold. Their eyes are small and very good in the dark. The Returned look like any other dwarf, until the sun is out: they cast no shadow. None. A Returned dwarf standing in a doorway at noon leaves the floor bright, and the surface clans have learned not to look down.

### Culture
Two peoples now, who were one in 2981. The **surface dwarves** are clan-folk of [[The Grimmark Holds]], miners, smiths, pass-wardens, poor and proud and owed favours by everyone. Their faith is [[Tharos]] and their holy things are [[The Lithic]]: a living statue found in the mountains is roofed, tended and spoken to, and the hold-priests say the stone ancestors hold the world up, which is more right than they know. Their law is the long oath, sworn on bare rock, kept for life.

The **Returned** went under the Grimmark in the war, when the passes were burning, and came back years later, in 3004, without their shadows and without the deep. They do not say what they met. They do not say it with a discipline that frightens the clans more than any story could. They stand at Tharos's shrines and do not pray. They take a second name: Shadowless, Hollow, Six-Years, Came-Back. They are welcome in the holds and they are watched, and some of them have started leaving, for the lowlands, for the companies, for [[The Ashenreach]]. See [[The Return from the Deep]].

### Names
Hard and short, with a hold-name after. Dagna Stillwell, Harrek Coombe, Morwen Pike, Ulfric Dunn, Brenna Gault, Torvald Hesk, Ingrid Mallow, Eskil Dorn, Greta Holm, Skarri Ulvane. A Returned dwarf adds the second name: Eskil Dorn Six-Years, Brenna Gault Shadowless.

### Where they live
[[Hollowhall]], the dwarf gate carved in 412 AW; the clan seat of [[Skarn]]; the north-coast villages [[Hask]] and [[Coldwater]]; and the passes. Returned dwarves drift south.

### How others see them
Dependable, humourless, honest to a fault and expensive to hire. The Returned are the exception: nobody knows what to think of them, so most think the worst. Halflings will not share a barge with one. Ravelers find them tragic and keep offering to take their last words early, at a discount.

### Playing a dwarf
A surface dwarf: you keep oaths and you keep count. Decide which Lithic statue your hold tends and what your grandmother told you it said. A Returned dwarf: you have a gap of years and no shadow and a very good reason not to talk about it, which is that you do not fully remember, and what you do remember you do not believe. Play the silence as courtesy, not sulking. Let the sun be your enemy.

:::gm
Under the Grimmark, the dwarves found the Eighth Ward, the Deep Stone beneath [[Hollowhall]], already breached, and something on the far side of it. It let them through, and back, for a price: their shadows. The shadows are not gone. They are with it, under the mountain, and it knows each Returned dwarf by the shape it keeps. [[Borrin Halt]]'s shadow came back up with him, which should not be possible, and wears him when he is not looking. What the thing is, the Returned do not know; the hold-priests say it was Tharos, and Tharos has not answered a Returned prayer since, and that is the whole case for the defence. See [[The Nine Great Wards]].
:::`,
    gmNotes: `Surface dwarves give the party the Lithic as sacred: a dwarf PC will not let anyone chip Warden Uthrem. The Returned give the party a dread that rides along quietly. Borrin's shadow is the Eighth Ward's hook into a campaign about the Ninth; never let it act in a way the players can prove.`,
    tags: ['people', 'playable'],
  },
  {
    key: 'people-halflings',
    type: 'lore',
    name: 'Halflings',
    aliases: ['Halfling', 'barge-folk', 'the Clans'],
    players: true,
    summary: 'River-barge clans carrying trade, letters and smuggled goods on every river. Neutral by profession, nosy by nature.',
    fields: [
      { key: 'Lifespan', value: 'Ninety to a hundred and ten years' },
      { key: 'Homelands', value: 'The rivers: the Ardis, the Cinder, the bay-mouths. A barge is home; a town is a stop' },
      { key: 'Numbers', value: 'Nobody has counted; the Clans do not hold still' },
      { key: '5e', value: 'Halfling stats. A barge-clan halfling always knows the nearest clan boat within a day\'s travel and can send a message by it for 1 sp.', gm: true },
    ],
    body: `### Appearance
Half a human's height, round-faced, brown and weathered, with big flat feet that grip a wet deck and hands like knotted rope. Hair in every shade of river mud. They dress in oiled wool and more pockets than seems reasonable, and every pocket has something in it that belongs to someone else, in transit.

### Culture
The barge is the family and the river is the country. A clan is a flotilla: anywhere from three boats to forty, with a Mother or Father of the Water at the stern of the biggest, who decides cargo, marriages and which towns are no longer worth stopping at. They carry grain, salt, iron, letters, rumours, refugees, contraband and the occasional corpse, and they carry them for everyone: the Regency, the Concord, the orc companies, the Saint. Neutrality is their trade and they guard it with the ferocity of people who would be sunk without it.

They are nosy. It is not a flaw; it is a cargo. A halfling who has poled through your town knows who is sleeping with whom, who owes whom, and which cellar has the good brandy, and will trade all three at the next stop for the same about somebody else. Nothing is written down. Everything is remembered. See [[The Barge Clans]].

### Names
Given names are small things: tools, plants, weather. Family names are the water they came from. Thimble Fairlock, Bushel Tarrowdown, Posy Reedmarsh, Cobb Latchwater, Pim Silverweed, Wick Bottlebrook, Marigold Dunmow, Tansy Mossbrook, Jory Pennyford, Dilly Eavesham. [[Kettle Brindlewake]] is a typical one, down to the name.

### Where they live
On the water. The Ardis from [[Ardmere]] to [[Sevenhaven]] is theirs; the Cinder below [[Cinderford]] has a floating market at [[The Low Quay]] that moves when the reeve comes to tax it. There are halfling families ashore in every river town, usually running the inn and listening.

### How others see them
Useful, cheerful, untrustworthy in exactly the way you would expect and no other. Everyone uses them. Everyone assumes they are being sold to the other side as well, and they are right, and they keep using them, because the alternative is walking. Soldiers like them; quartermasters fear them.

### Playing a halfling
You are small, overlooked and listening. Decide your clan and your boat and which Mother of the Water you answer to, because you do answer to one, wherever you are. You know a little about everyone and you can get a letter anywhere for a price, and you are honest about what you sell, which is everything. Play the warmth as real and the neutrality as a weapon.

:::gm
The Barge Clans run the best courier and intelligence network on the continent and sell to all sides, and the sides know it, and still buy, because the Clans have never once lied about what they carry; they only charge both parties. The Mothers of the Water meet once a year on the water at [[Sevenhaven]] and decide what the continent will know next season. The Quiet Office, the Concord Houses and the Mothers of the Iron all pay them. [[Fennick Bottlebrook]]'s cooked books are balanced by a halfling loan he has not told the captain about, and the lender is a clan, and the clan sells to [[Grandmother Tollamund]].
:::`,
    gmNotes: `Halflings are the GM's rumour-delivery system. Kettle brings news, prices and a smell of trouble each session. If the party needs to get a message to Halcyra, Skarn or the Mothers, a halfling can, for a price and a secret.`,
    tags: ['people', 'playable'],
  },
  {
    key: 'people-orcs',
    type: 'lore',
    name: 'Orcs',
    aliases: ['Kingslayers', 'Orc', 'the Iron-born'],
    players: true,
    summary: 'The empire\'s bred soldier caste, whose Iron Guard killed the last Emperor. Hated, feared, and holding the peace because nobody can afford to fight them. Matriarchal: the Mothers decide.',
    fields: [
      { key: 'Lifespan', value: 'Fifty to sixty years; the Mothers, longer, out of spite' },
      { key: 'Homelands', value: 'None by right. Company towns, garrisons, the Ashenreach; the Mothers sit at Ardmere' },
      { key: 'Numbers', value: 'Perhaps sixty thousand, two in three under arms' },
      { key: '5e', value: 'Orc stats (SRD half-orc works). An orc exiled by the Mothers has disadvantage on Charisma (Persuasion) with any orc under contract.', gm: true },
    ],
    body: `### Appearance
Tall, heavy through the shoulder, grey-green to iron-dark of skin, with the under-jaw tusks the magi bred for and the broad flat nose they did not intend. Women are larger than men, on average, and the Mothers are larger still. Scars are kept; a healed wound is a line on the ledger. Hair is worn shaved at the sides and long on top, bound with the company's colour, or unbound for the exiled.

### Culture
Orcs were made. In 2104 AW the imperial magi bred a soldier caste from stock the chronicles do not name ([[The Breeding of the Iron Guard]]), and for nine centuries orcs held the empire's walls, took its orders and died at its convenience. In 2981 the Iron Guard killed [[Aurel IX]] in his own hall ([[The Kingslaying]]), and every orc alive has carried that since, in the eyes of every human they meet.

What the humans did not breed, and did not notice, was the Mothers. Orc women bear few children and bear them late, and the oldest women became the keepers of lineage, contract and law while the men were away dying; by the time the empire noticed, the Mothers decided everything. They still do. [[The Mothers of the Iron]] license every orc mercenary company, set its terms, and exile any orc who breaks a contract, and an exiled orc has no company, no kin and no god that will admit to her. Orcs do not have a nation. They have contracts, and the contracts are holy.

### Names
Given names hard in the mouth, with an epithet earned or a Mother's line-name. Dreska Ironmouth, Oruk Thane, Hesha Three-Scars, Kazrim Vosk, Tarnak Shieldbreak, Ghorra Half-Tooth, Ushka Mell, Morrak Lame-Hand, Zhurra Saltwell, Brakka Coldhand. A Mother is called Mother and her line: Mother Vosk. [[Varra Nine-Knuckles]] earned hers at twelve.

### Where they live
Nowhere by right. Company towns, garrison quarters, the march of [[The Ashenreach]] where the treaty put them. The Mothers sit at [[Ardmere]], which they held through the siege in 2994 and never gave back.

### How others see them
Kingslayers. Children are told orcs eat emperors. Adults know orcs hold the peace, because the only thing that could fight an orc company is another one and the Mothers will not license that; and adults resent it more than the children fear it. The orcs know exactly what they are to everyone else and have built a very dark sense of humour on it. [[Mirrel Vosk]] is the type.

### Playing an orc
Decide your company, your Mother and your contract, or that you have none, which is worse. Loyalty is the whole of your law, and it runs to the contract first and the kin second and the self last, and the game is what you do when those pull apart. You are strong and expected to be stupid, and you can use that. Swear by [[Grum]]. Fear the Mothers. Play the humour as armour.

:::gm
The Mothers ordered the Kingslaying. [[Aurel IX]] was digging at three ward sites to open one ([[The Emperor's Digs]]), and the Mothers, who had kept the imperial genealogies alongside their own for three centuries and knew what the imperial line could hear, decided a mad emperor on a ward was worse than no emperor at all. They never said so; nobody would have believed them, and a reason would have made it politics instead of murder. The hand on the blade was [[Grashka]], now Mother of Mothers, and the Mothers' one standing policy ever since has been: the wards stay shut. Varra was exiled for refusing a contract she was never told the purpose of; the purpose was Cinderford.
:::`,
    gmNotes: `Orcs are the setting's soldiers and its scapegoats; let both be true in the same scene. Vosk's gallows wit is the voice. Varra's secret is a slow fuse: the Mothers know she is in the Ninth Lantern, and that is not an accident.`,
    tags: ['people', 'playable'],
  },
  {
    key: 'people-lithic',
    type: 'lore',
    name: 'The Lithic',
    aliases: ['Lithic', 'the Stone-born', 'ward-builders'],
    players: true,
    summary: 'The ward-builders\' last descendants. Their skin turns to stone with age, and the oldest stand still forever as living statues. Few remain.',
    fields: [
      { key: 'Lifespan', value: 'Unknown. They stop moving somewhere past a hundred and fifty. They do not stop' },
      { key: 'Homelands', value: 'None living. Wardens at the ward sites; a scattering in the Grimmark and the Regency' },
      { key: 'Numbers', value: 'Fewer than three hundred who still walk' },
      { key: '5e', value: 'Use dwarf stats with Stone\'s Endurance (reduce damage by 1d12+Con once per short rest). Each decade past 60, lose 5 ft of speed; at 0 the Lithic stands. Wardens near a ward regain 1 HP per hour while touching it.', gm: true },
    ],
    body: `### Appearance
Grey. A Lithic child is born the colour of river pebbles and warm to the touch; by thirty the skin at the knuckles and heels has the grain of sandstone; by seventy the forearms and shins are stone to the elbow and the knee, and the Lithic walks with a slow deliberation that is not age but weight. The face goes last. The oldest Lithic are statues with eyes: a figure in the pose it chose, moss in the folds, and in the face two living eyes that follow you, and a mouth that can still, very slowly, speak. They are tall, long-limbed and still-featured, and their hair is the last thing to grey.

### Culture
The Lithic are what is left of [[Ul-Tarran]], the kingdom that rose around the Great Wards in the first age and petrified around them over nine hundred years. Their culture is a ritual of departure. A Lithic family prepares its elders for the Standing the way other peoples prepare for a wedding: the place is chosen, the pose, the last words, which are spoken while the mouth still moves and recorded by whoever is left. Then the elder walks, as far as they can, to a ward, and stands, and does not stop being alive.

They know the Sleeper's true name. They do not say it to outsiders. They do not say much to outsiders; the Lithic are courteous, formal, and so slow in speech that a conversation is a commitment. They keep the old script, which the glass of the Ashenreach is full of, and they teach it to no one.

### Names
Old, heavy, two syllables, the stress on the first. Omneth, Sarrik, Telune, Hadrun, Ishkeh, Morrun, Quellith, Bastrem, Anuvar, Keth. No family names; a Lithic is named for the ward their line stands at: Sarrik of the Seventh. [[Warden Uthrem]] is Uthrem of the Ninth, and the last of that line.

### Where they live
Nowhere, any more. A handful of Wardens at the ward sites, keeping stones that the nations around them have forgotten are anything but landmarks; a few families in the Grimmark, where the dwarves treat them as holy and tiresome; a scholar or two in [[Caer Ardith]]. [[The Last Wardens]] are most of what remains organised.

### How others see them
The surface dwarves revere them as ancestors made stone. The Regency's scholars collect them. Most people have never seen one walking and think of them as a kind of monument that occasionally blinks. The Vesh can see what they are standing on and are polite about it.

### Playing a Lithic
You are the last of something and you know exactly what. Decide how far the stone has reached and how long you think you have before you stand; decide whether you mean to stand at all, because a Lithic who refuses the Standing is the loneliest person on the continent and the most alive. You are patient to a fault, literal, and carry the weight of a secret you did not choose. Play the slowness as gravity, not weakness.

:::gm
The stone is a curse, laid by [[Tharos]] on the line of the Nine for the Godslaying, and it is also the wards: every Lithic who stands at a Great Ward adds their divinity, thinned by a hundred generations, to the stone, and every living statue is still awake and holding. Fewer Lithic are born each generation because the wards are drinking the line dry. [[Warden Uthrem]], who can barely move, has waited nine years at [[The Ninth Stone]] for someone to come, and knows the Ninth needs a new heart, and knows it does not have to be Lithic; it has to be willing. He is waiting for [[Ysse Lampwright]], because the flame already has her.
:::`,
    gmNotes: `A Lithic PC is a slow fuse the campaign can light: the Standing is Ending A's price with a face. If nobody plays one, Uthrem carries it. The Lithic script in the glass at Fort Mercy and the Glass Barrow is readable only by a Lithic or by someone who has handled the Ward Shard long enough to dream in it.`,
    tags: ['people', 'playable'],
  },
  {
    key: 'people-vesh',
    type: 'lore',
    name: 'The Vesh',
    aliases: ['Vesh', 'moth-folk', 'lamp-keepers'],
    players: true,
    summary: 'Nocturnal moth-folk with feathered antennae, drawn to magic like moths to flame. They keep the lamps and the libraries.',
    fields: [
      { key: 'Lifespan', value: 'Forty to fifty years, awake mostly at night' },
      { key: 'Homelands', value: 'Lamp-towers, libraries and lighthouses everywhere; a quarter in Sevenhaven, the archive at Caer Ardith' },
      { key: 'Numbers', value: 'A few thousand, never many in one place' },
      { key: '5e', value: 'Use elf stats with darkvision 120 ft, no trance. A Vesh senses active magic within 60 ft (as detect magic, no concentration, continuous) and must succeed on a DC 12 Wisdom save to leave a strong source once within 10 ft of it.', gm: true },
    ],
    body: `### Appearance
Slight and soft-footed, a little shorter than a human, covered in a fine dun or grey down that thickens to a ruff at the throat. Their eyes are large and dark and take the light; in a lit room a Vesh's eyes are two lamps. From the brow rise two feathered antennae, long as a hand, that tremble toward anything that is burning or anything that is enchanted. Their wings, if you can call them that, are vestigial: a dust-soft mantle folded flat against the back, useless for flight, lovely when they stretch. They dress in layers against the cold they feel keenly and in colours that do not show the dust they shed.

### Culture
The Vesh keep the light. In every nation they are the lamp-wardens, the lighthouse-keepers, the librarians and the night-clerks, and they have been since before anyone thought to ask them, because it is simply what they are drawn to. A flame is a comfort and an enchanted flame is a hunger; a Vesh near strong magic feels it like warmth on the face, and leans in, and has to be reminded to lean back. Most Vesh regard this as a weakness to be mastered and are a little ashamed of it, the way a drinker is ashamed of the first glass. Vesh scholars and wizards are common for exactly this reason: if you are going to stare at the flame, you may as well learn what it is.

They are quiet, dry, exact and nocturnal. A Vesh household wakes at dusk. They mark the passing of the year not by the sun but by the lamps lit; a Vesh's age is counted in winters, because winter has the longest nights. They have no god of their own and keep everyone else's lamps impartially. See [[Brother Tallow]].

### Names
Soft given names, occupational surnames from the trades of light. Oume Wickmoor, Ilet Candleby, Tessel Lampwright, Auvi Sconce, Mirre Taperling, Peth Ashwick, Soli Mothwaite, Ennu Lanternby, Faelle Oilgrove, Dusk Tallow. [[Ysse Lampwright]] is a cousin, distantly, of half the lamp-wardens in the Regency.

### Where they live
Where there are lamps worth keeping: lighthouses on the seven bays, the imperial archive at [[Caer Ardith]], the Saint's lamp-halls at [[Halcyra]], and the Lantern Keep at [[Cinderford]], where [[The Lantern of the Ninth]] burns and the Vesh who keep it are the only two people in the company who never look away from it.

### How others see them
Harmless, useful, a bit odd. Soldiers call them moths and mean it kindly. Wizards hire them as apprentices and find them unnervingly good at noticing when a spell is about to go wrong. Nobody asks what else they notice.

### Playing a Vesh
You are drawn to what burns and know better. Decide what your flame is: a lamp, a spell, a person, a question. You are precise, night-waking, cold-blooded in the literal sense and warm in most others, and you have a weakness you can name, which makes you more dangerous than the ones who cannot. Play the hunger as curiosity with teeth.

:::gm
Vesh can see where a ward is thin. To a Vesh who looks, the air over a weak place in a Great Ward has a sheen like heat over a road, and the Ninth Ward's crack is a wound of light across half the sky. Most Vesh ignore it on principle; the ones who stared at it went to Cinders and did not come home, and the lamp-wardens' guild has a quiet rule about looking up. [[Brother Tallow]] broke the rule nine years ago, worked out what the lantern was lit from, and has been afraid to say so ever since. [[Ysse Lampwright]] can feel the flame failing and has begun to hear it in her sleep; the flame is the Sleeper's door and she is the moth at it.
:::`,
    gmNotes: `Vesh PCs get the setting's magical senses: let Ysse see the sheen over the Rent before anyone else, and let it cost her sleep. Tallow's blindness is the price of nine years of looking.`,
    tags: ['people', 'playable'],
  },
  {
    key: 'people-hollowborn',
    type: 'lore',
    name: 'The Hollowborn',
    aliases: ['Hollowborn', 'ash-children', 'the Grey-Eyed'],
    players: true,
    summary: 'Born where a ward has failed and touched by the buried god\'s dreams. One eye sees the dead. Many were born the night of Cinders or in its aftermath.',
    fields: [
      { key: 'Lifespan', value: 'As their parents\' people, except the Cinders-born, who grew up in seven years' },
      { key: 'Homelands', value: 'The Smokes in Cinderford; the hamlet of Stillwater; wherever a ward has failed' },
      { key: 'Numbers', value: 'A few hundred, most of them children' },
      { key: '5e', value: 'Use the parent people\'s stats. The grey eye sees invisible undead and spirits within 30 ft. At full Ember: disadvantage on saves against sleep and charm from the Sleeper; advantage on Wisdom (Insight) against anyone who has dreamed the dream.', gm: true },
    ],
    body: `### Appearance
Whatever their parents are, and one thing more: one eye is wrong. It is the grey of ash in water, with no visible pupil, and it does not match the other. Hollowborn children are otherwise ordinary, if slightly too quiet, and most of them are children, born since [[The Battle of Cinders]], who age like anyone else. The exception is the Cinders-born: the six born in Cinderford on the night itself grew from cradle to grown in about seven years, and nobody knows why. They are nine by the calendar and look twenty. A few older Hollowborn exist, born at other failed places and in other years, and they do not advertise.

### Culture
They have none yet. They have mothers. The Hollowborn of [[The Smokes]] are a generation of children raised by tanners and glass-dust workers who were told by the midwives of [[Maelis]] that the eye was a mark of the fire and nothing to fear, and who have watched their children stop in the street to let someone invisible pass. The children see the dead. Not all the dead, not always: the ones who did not pass, who since [[The Death of Hathe]] are many in the ash. The children treat them as neighbours. Some of the neighbours are their relatives. See [[The First Hollowborn]].

What is forming in their place of culture is a dream. Every Hollowborn dreams at full red moon, and they have begun to compare notes, and the Sleepless have begun to listen. [[Stillwater]], the hamlet on the grey lake, is where the families who could not bear the Smokes went, and it is the quietest place in the March, and it is not empty.

### Names
Parents' names, mostly human, with a grey-name given by the other children: Ash, Cinder, Moth, Still, Ember. Wren Ashby, Sable Cordwain, Haskel Grey, Nettie Lowe, Pip Ashcombe, Dorran Stillwater, Ember Tolliver, Moss Quay, Ilka Dunne, Cass Marrowick. [[Tibbet Marlowe]] is called Tick, because of the sound he made as a baby and because he has never since been able to sit still.

### Where they live
The Smokes, Stillwater, and the fringes of the Ashenreach. A few in [[Ardmere]], born during the siege. Rumour puts some in the Grimmark, near the Eighth, and in Sael, near the Fourth, and both nations deny it.

### How others see them
Pitied, feared, and useful. Soldiers pay a Hollowborn child a copper to tell them whether a room is empty. The Saint's mission takes them in and is very kind. The Sleepless call them the Dreamers and treat them as prophets, which the children mostly find embarrassing. Most of Cinderford looks at the grey eye and then looks away.

### Playing a Hollowborn
You see the dead and you were born in the worst night in living memory, and both of those are just your life. Decide who your dead are: there is at least one who walks with you. Decide what you make of the dream. You are young for your people, or old and hiding it; either way you know things you did not learn. Play the eye as ordinary and let everyone else flinch.

:::gm
Every Hollowborn dreams the same dream at full red moon: a vast shape under water, an eye the size of a lake opening, and a voice that says a sentence nobody can remember on waking. It is getting clearer. Each full Ember another word of the sentence survives the waking, and the Sleepless are writing them down. [[The Dreaming Widow]] has seven words. She is [[Marla Marlowe]]'s sister, Tick's aunt, and Tick's dead mother stands at his shoulder and tells him, every red moon, not to listen to her.

The dream is [[The Sleeper Below]] learning to speak. The Hollowborn are its mouths-in-waiting. The Cinders-born grew up first because they were born on the night it dreamed hardest, a step at every full Ember, and they will be the first to hear it in daylight ([[Why did the Cinders-born grow up so fast?]]). Children born in the Smokes this year have two grey eyes.
:::`,
    gmNotes: `The Hollowborn are the Ashenreach's children and its ghosts in one. Tick gives the party a dead mother who is right about everything; the Widow gives them a living aunt who is wrong about the one thing that matters. Use the Sleeper Dreams table at every full Ember for every Hollowborn in earshot.`,
    tags: ['people', 'playable'],
  },
  {
    key: 'people-ravelers',
    type: 'lore',
    name: 'Ravelers',
    aliases: ['Raveler', 'crow-folk', 'rooks'],
    players: true,
    summary: 'Crow-folk who follow armies as undertakers and scavengers, and trade in secrets and the last words of the dead. Funny, morbid, unbribable: they just charge more.',
    fields: [
      { key: 'Lifespan', value: 'Sixty to seventy years, and they will tell you the exact day' },
      { key: 'Homelands', value: 'Rookeries beside battlefields and burial grounds; Corvel Rise outside Cinderford' },
      { key: 'Numbers', value: 'A few thousand, following the armies' },
      { key: '5e', value: 'Use the SRD aarakocra stats without flight (fly speed 0; glide 30 ft from a height, no damage from the fall). Ravelers recall the last words of anyone they heard die, verbatim, without a check.', gm: true },
    ],
    body: `### Appearance
Man-high, lean, black-feathered head to claw, with a heavy grey beak and eyes like wet jet. Their arms end in long, clever, four-fingered hands; their legs are scaled and backward-kneed; from the shoulders hang folded wings, broad enough to glide from a roof, too weak to carry them up. They wear black because it does not show and because they think it is funny. Older Ravelers go grey at the beak and wear their age like a medal; a Raveler will tell you how long they have left to the day, and they are usually right, and they find your discomfort very satisfying.

### Culture
Ravelers follow armies. Where soldiers go to die, Ravelers go to tidy up: they strip the dead with professional courtesy, bury them properly, say the words of [[Hathe]] over them because somebody must, and sell everything they found to whoever is left. They have done this since before the empire and consider it the only honest trade in the world, because their customers never complain.

The real business is last words. A Raveler who hears you die remembers what you said, exactly, forever, and will keep it or sell it or tell your mother, depending on what was agreed and what was paid. Their guild, [[The Rook-Court]], keeps the ledgers; their priests keep the dead god's doors in every [[The Doorkeeper's Chapel]]; their matriarchs, called Mothers, keep the ledger of ledgers and do not show it to anyone. They are unbribable in the sense that they cannot be turned; they can be hired, and the price goes up when you try to be clever.

Their humour is black and constant. A Raveler at a funeral is the one making the jokes, and the family laughs, and that is the service.

### Names
A croak of a given name and a deed-name earned at the first burial. Krael Last-Breath, Abek Counts-Twice, Rhauk Hush-Wing, Tessik Buried-Kings, Vorl Half-Ledger, Issk No-Second-Word, Caddock Pale-Beak, Orrick Three-Graves, Mirl Owes-Nothing, Skree Who-Laughed. [[Quorl Many-Words]] got his name for talking back to a dying sergeant. [[Mother Corvane]] has not used her deed-name in forty years and nobody dares ask it.

### Where they live
Rookeries: stilt-houses and roofed platforms beside burial grounds, built high because they like a view of the field. [[Corvel Rise]] outside Cinderford is the largest in the Ashenreach. Smaller rookeries follow every company. A Raveler in a town without a graveyard is a Raveler passing through.

### How others see them
Bad luck, good undertakers, and the only people who will touch the dead after Cinders. Soldiers like them more than they admit. Priests of the living gods find them insolent. Everyone has, at some point, paid a Raveler not to repeat something.

### Playing a Raveler
You are the funniest person at every graveside and you mean it as kindness. Decide what last words you carry that you have not sold, and whose. You cannot be bought but you can be hired, and you are honest about the difference. You are morbid, loyal to the Court, and quietly furious that your god is dead and you are keeping his doors anyway. Play the jokes as the prayer.

:::gm
The Rook-Court keeps a ledger of every last word heard since the war: nine years, forty thousand entries, cross-indexed by the Mothers. Read in order, the words the dying have said in the Ashenreach form a sentence that repeats, with gaps, and the gaps are closing. [[Mother Corvane]] already guesses it: "the lamp is the lock." [[Quorl Many-Words]] has heard seven soldiers say the same sentence as they died, and has not yet told her, because he is not sure whose side she is on. The Sleeper is speaking through the dying, and the Ravelers, who were made to listen, are the only people on the continent taking dictation.
:::`,
    gmNotes: `Ravelers carry the campaign's best clue-chain: session 5 runs on the ledger. Keep them funny; the moment a Raveler stops joking, the players should be afraid. Quorl's seven sentences and Corvane's guess should arrive at the table a few words apart.`,
    tags: ['people', 'playable'],
  },
  {
    key: 'people-shellbacks',
    type: 'lore',
    name: 'Shellbacks',
    aliases: ['Shellback', 'tortoise-folk', 'counting-folk'],
    players: true,
    summary: 'Slow tortoise-folk who live for centuries and run the Concord\'s banks. Nobody has seen one hurry.',
    fields: [
      { key: 'Lifespan', value: 'Four to five centuries. Grandmother Tollamund is 340 and considers herself middle-aged' },
      { key: 'Homelands', value: 'The seven bay-cities of the Concord; once, the Ness of Thurm' },
      { key: 'Numbers', value: 'Perhaps two thousand, and every one of them owed something' },
      { key: '5e', value: 'Use the SRD tortle stats (natural armour 17, shell defence). Speed 20 ft and nothing on the continent will raise it. Advantage on Wisdom (Insight) against anyone who owes them money.', gm: true },
    ],
    body: `### Appearance
Broad as a door and about as quick, a Shellback is a tortoise stood upright: a domed shell the colour of old bronze, a leathery neck that extends with great deliberation, a beaked mouth, and small black eyes that have seen your grandfather default. They stand a little shorter than a human and weigh three times as much. They dress the shell rather than the body: velvet caparisons, ledgers strapped to the carapace, a house-seal hung at the throat. The old ones' shells are carved with their account-books, line by line, the oldest entries worn smooth.

### Culture
Shellbacks count. They left [[The Ness of Thurm]], the mountainous wedge off Sael's west coast whose great peak their songs still name, in 1350 AW ([[The Shellbacks Leave the Ness]]), came east along the southern bays, and founded counting-houses in all seven before the humans had agreed what a bank was. [[The First Concord]] was signed in a Shellback house. Every loan the empire ever took ran through their ledgers, and the empire is gone, and the ledgers are not.

They do nothing quickly. A Shellback conversation is a thing you clear the afternoon for; a Shellback decision is a thing your heirs will hear. They speak slowly because they are choosing words that will still be correct in a hundred years. They are honest, in the way a tide is honest, and they never forgive a debt, because forgiveness would be a lie about the past. Their houses are families and their families are firms: Tollamund & Daughters, Veramund & Heirs. A Shellback with no house is a thing that does not occur.

They have a god and will not say who. Priests of [[Corvex]], whose books they keep more faithfully than anyone, find this discourteous.

### Names
Long given names, used once a decade, and a house-name ending in the old word for a tally. Ammoset Tollamund, Orrunder Veramund, Bassiline Keelmund, Dromadune Harrowmund, Elevaris Pennamund, Caulwen Oldmund, Isserine Ashmund, Pellamor Giltmund, Thessaumund Vayle (an old form), Morravund the Younger. In daily use a Shellback is Grandmother, Grandfather, Aunt or Cousin and the house-name. [[Grandmother Tollamund]] has a given name; two people alive know it.

### Where they live
The counting-houses of [[Sevenhaven]], [[Marrowport]], [[Cowl]], [[Gilt]], [[Harrowquay]], [[Keel]] and [[Vessary]], and the branch-houses that follow debt inland. [[Tollamund & Daughters]] in Cinderford is a branch-house, which should tell anyone paying attention how much debt is in Cinderford.

### How others see them
Patient, inevitable, faintly comic until you owe them. Humans joke about their speed and pay on time. Halflings respect them as the only people slower to forgive than a Mother of the Water. The orcs' Mothers deal with them as equals and both sides find it restful.

### Playing a Shellback
You are slow and you have decided that is everyone else's problem. Decide your house and what it is owed. You remember everything, you hurry for nothing, you are unfailingly courteous, and you will outlive this argument. You are curious, under the shell, about the one thing your people do not discuss, and you may be the first Shellback in six centuries to go and look. Play the slowness as a weapon and the honesty as a wall.

:::gm
The Shellbacks left the Ness for a reason they will not discuss, and the reason is their god: the Slow One, who lives under the great peak at the root of the wedge, whom they do not name, and who told them to go. Why, they have never said, and most of them no longer know. The Concord Houses' purchase of the Ashenreach's debts is Shellback policy from the Bench down: own the march, own the lantern. [[Grandmother Tollamund]] believes the lantern is a key, and that the door it opens is the one the Slow One shut behind them, and that she will be the one to walk home through it. The charts fail at the Ness. Something is waiting on the far side of the failure, and it has been counting too.
:::`,
    gmNotes: `Tollamund is the long game at the table: she will never threaten, never hurry and never lose a sum. Speak her lines with a pause after every clause. A Shellback PC is a wonderful comic foil and a slow-burning mystery; the Ness is the campaign after this one.`,
    tags: ['people', 'playable'],
  },
  // ───────────────────────────── Lore ─────────────────────────────
  {
    key: 'lore-wards',
    type: 'lore',
    name: 'The Nine Great Wards',
    aliases: ['the Great Wards', 'the Wards', 'the Nine Wards'],
    players: true,
    summary: 'Nine stones that pin the continent shut, raised at the Godslaying by the Nine. Three are failing. Most people think they are landmarks.',
    fields: [
      { key: 'Raised', value: '0 AW, at the Godslaying' },
      { key: 'Failing', value: 'The Fourth (weak), the Eighth (breached), the Ninth (cracked)', gm: true },
    ],
    relations: [
      { to: 'lore-nine', kind: 'anchored by', note: 'One of the Nine inside each stone, awake.' },
      { to: 'god-sleeper', kind: 'hold down', known: true },
      { to: 'f-last-wardens', kind: 'tended by', known: true },
    ],
    body: `### What everyone knows
Nine standing stones, each taller than a house, each older than any nation, each in a place nobody would choose. The years are counted from their raising: AW, After the Warding. Children learn that the Nine raised them to keep something under the land, and that the Lithic are the Nine's children, and that is the end of most people's knowledge, because the wards have never needed anything from anyone and so nobody has needed to learn more.

Scholars add this: every spell cast in Vael Ardith draws, a little, on the nearest ward. See [[Magic and Its Cost]]. The Lithic add this, when they speak at all: the wards are not stone. They are the Nine, and the Nine are awake.

### The nine stones
They stand in a loose ring through the interior of the continent, with three flung out to its edges. From the heart of the old empire outward:

**The First Ward, the Hearthstone**: under [[Caer Ardith]], on the river island the capital was built on. The imperial throne room sits over its cap. The emperors called it the keel of the realm.

**The Second Ward, the Wending Stone**: a mound in the Ardis fens a day north of [[Ardmere]], ringed by causeways that sink a little more every year. Orc companies camped on it through the siege of 2994.

**The Third Ward, the Fallow Stone**: in a sheep-down barrow south of [[Fallowden]]. Shepherds leave bread at it. A Lithic has stood beside it for as long as the shepherds remember and they have given her a name of their own.

**The Fourth Ward, the Rooted Stone**: deep in the Saelwood of [[Sael]], grown through by a tree so old the elves have no record of planting it. The wardens of Orvanne forbid fire within a mile.

**The Fifth Ward, the Drowned Stone**: on a tidal islet in the Bay of Tolls, under the great harbour chain of [[Sevenhaven]]. It is dry twice a day. The Concord charges a toll to look at it.

**The Sixth Ward, the Glass Stone**: on the Iskaveth plateau a half-day from [[Qerath]], above the Glass Sea. The Saint's church has built a shrine around it and pilgrims touch it for luck.

**The Seventh Ward, the Standing Stone**: in the Standing Fields of the eastern interior, between the Ardis and the Saint's Spine: a plain of Lithic statues, hundreds of them, facing the stone. The old capital of [[Ul-Tarran]] stood here. Nobody farms it.

**The Eighth Ward, the Deep Stone**: under the Grimmark range, beneath [[Hollowhall]], in galleries the dwarves carved toward it in 412 AW and have since sealed.

**The Ninth Ward, the Ninth Stone**: at the northern lip of [[The Rent]] in [[The Ashenreach]]. It cracked the night of [[The Battle of Cinders]]. See [[The Ninth Stone]].

### Are they failing?
Ask a Regency scholar and you will be told no, the wards are eternal, the Nine saw to that. Ask [[Warden Uthrem]] and he will take an hour to answer and the answer will be yes.

:::gm
Yes, slowly, and three of them quickly. Each ward is anchored by one of [[The Nine]], still awake inside the stone. Living Lithic go to stand at the wards and petrify there to strengthen them, and fewer Lithic are born each generation. Every spell drawn nearby drains the nearest ward. The state of each:

- **First**: strong, but dulled by three centuries of court sorcery and the thing the imperial line was bred to hear. [[Marius Vell]] has had the throne room floor lifted twice.
- **Second**: drained badly by the siege sorcery of 2994. [[Aurel IX]]'s first secret dig was here, at the place his papers call *the Wet Hill*; the shaft is still open under a causeway, and the orcs know where.
- **Third**: the strongest. The Lithic beside it is Quellith of the Third, standing since 2140, and shepherds' bread is not why she is still awake.
- **Fourth**: weak since [[The Saelish Trespass]] in 1102, and the Saelwood drinks from it. The tree is the ward's wound dressing.
- **Fifth**: fair. The Bench of [[Corvex]] pays a Lithic family a stipend to keep a warden on the islet: the only ward with a bought heart, and it works.
- **Sixth**: dulled by nine years of the Saint's miracles. The church has built its shrine on top, and does not like the way the floor hums.
- **Seventh**: strong, the Standing Fields see to that; but the statues face the stone because they are all still awake and all still holding, and the field is getting no bigger.
- **Eighth**: breached, when the dwarves went under in the war and came out again in 3004. Aurel's second dig was here, in the hills above [[Hollowhall]], where the dwarves' oldest stair gave on a sealed door. Whatever is on the far side took their shadows for the passage. It is not Tharos. It may be the Eighth of the Nine, awake and alone for nine thousand years, and bargaining.
- **Ninth**: cracked at Cinders, when the battle sorcery burned years of its strength in a night; Aurel's third dig was here, which is why there was a battle here at all. A shard blown loose in the blast lit [[The Lantern of the Ninth]], and that flame is part of what holds the crack shut. Resealing the Ninth only buys time. Resealing it needs a living heart.
:::`,
    gmNotes: `This is the campaign's map of stakes. Players see nine landmarks; the GM sees nine clocks. The Ninth is session 6 and 8; the Eighth is Borrin's shadow; the Fourth is Sael's reason for being in town; the Fifth is a quiet proof that a bought warden works, which the Concord knows and will use. If a PC asks whether the digs line up with the war's great battles, let them notice that they do.`,
    tags: ['lore', 'wards'],
  },
  {
    key: 'lore-nine',
    type: 'lore',
    name: 'The Nine',
    aliases: ['the Nine Demi-gods', 'the Ward-makers'],
    summary: 'The nine demi-god children of Tharos and his mortal lovers, who killed Ysmereth and became stone to hold it down. Their names were struck from memory; each is still awake inside a Great Ward.',
    fields: [
      { key: 'Parentage', value: 'Tharos the Stone-Under and nine mortal mothers', gm: true },
      { key: 'State', value: 'Stone, and awake', gm: true },
    ],
    relations: [
      { to: 'god-tharos', kind: 'children of' },
      { to: 'god-sleeper', kind: 'killed, and hold' },
      { to: 'lore-wards', kind: 'are' },
      { to: 'people-lithic', kind: 'ancestors of' },
    ],
    body: `### Who they were
Nine children of [[Tharos]] by mortal women, born at [[The Stone Marriage]] in the age before the count: demi-gods of stone and fire, taller than men, who could not be burned or broken and knew it. The myths agree they were proud. The Lithic add that they were loved, which is worse.

At [[The Oath of the Nine]] they swore to prove that the mortal-born could unmake a god. They chose Ysmereth, god of dreams and endings, perhaps because it was the gentlest, perhaps because it was the one who had dreamed mortals into being and they wanted to be sure they were real. They killed it at [[The Godslaying]]. And they learned what the gods already knew: a god does not fully die. What was left of Ysmereth went into the land and began to dream, and the dream came up through the ground, and the first mortals who slept near it did not wake.

So the Nine did the only thing left. They poured their divinity into nine stones around the place where the god lay and became mortal stone themselves to hold it. Their father cursed their line for it: the stone would climb every child of theirs, forever. The rest of the gods, who had not been consulted about the murder and could not reach the body to finish it, struck the Nine's names from all memory, so that the oath could never be sworn again. It was a success and a catastrophe at once, and the world has stood on it ever since.

### Their names
Erased. Not forgotten: erased. A mortal who learns one of the Nine's true names forgets it within the hour; a written name fades from the page; a carved name cracks. [[A Rubbing from the Ninth Stone]] shows a line of Lithic script with one word gouged out, and the gouge is older than the writing around it.

The Lithic keep epithets instead, one for each stone, and will give them up to someone who has stood at a ward. From the First: **the Eldest**, who chose the place; **the Twin who Laughed** and **the Twin who Counted**, in the Second and Third; **the Rooted**, in the Fourth, who was the gardener; **the Drowned**, in the Fifth, who went in willingly under the water; **the Bright**, in the Sixth, who was the fire; **the Still**, in the Seventh, around whom Ul-Tarran grew; **the Deep**, in the Eighth, who was afraid of the dark and asked for it anyway; and **the Youngest**, in the Ninth, who wept when the stone took her, and whose tears the Lithic say are what water the orchard. See [[The Weeping Orchard]].

### What they are now
Awake. All nine, inside the stones, nine thousand years into a watch that was meant to be forever and is not. [[Warden Uthrem]] says the Youngest has been alone and cracked for nine years and that the flame in [[The Lantern of the Ninth]], lit from her shard, is the only company she has had. He says she has started to answer the Sleeper back. He does not say whether that is good.

### GM hints
- The Youngest wants the crack closed and will help anyone trying, as far as a stone can: dreams, a warmth in the shard, the orchard bleeding toward the right path. She is also exhausted, and the Sleeper is very persuasive, and she has been listening to it for nine thousand years.
- The Deep, in the Eighth, is the likeliest candidate for what took the Returned's shadows. Awake, abandoned, afraid of the dark and surrounded by it; a shadow is the one thing a stone in the dark has never had. If so, it is not evil. It is lonely, and it is a demi-god, and it does not understand that it is hurting anyone.
- The Eldest, under the throne, is why emperors hear the Sleeper: the imperial magi bred the line to hear the Eldest, and the Eldest hears the Sleeper, and the line between is thin.
- Tharos can hear all nine and has not answered them. If a PC ever speaks a prayer to him in the Nine's hearing, at a ward, he answers that, and the answer is one word, and it is a name, and the PC forgets it within the hour and the ward is stronger for a season.
- The Standing Fields at the Seventh are the place to learn the epithets in full; the statues speak, slowly, to a Lithic or to anyone holding [[The Ward Shard]].`,
    gmNotes: `Never let the Nine be solved. Hand out epithets, not names; let the gouged word on the rubbing be the moment the players realise someone powerful wanted this forgotten. The Youngest is an ally the party cannot talk to; let her help once, visibly, in session 8.`,
    tags: ['lore', 'myth'],
    gmTags: ['secret-history'],
  },
  {
    key: 'lore-magic',
    type: 'lore',
    name: 'Magic and Its Cost',
    aliases: ['Magic', 'the Tithe', 'sorcery'],
    players: true,
    summary: 'Magic is fairly common in Vael Ardith and every spell has a cost someone pays. Most casters never ask who.',
    fields: [
      { key: 'The rule', value: 'Every spell draws on the nearest Great Ward' },
      { key: 'The exception', value: 'Prayer, which draws on a god, and the god remembers' },
    ],
    body: `### Where it comes from
Magic in Vael Ardith is drawn, not made. A caster reaches for power and the power comes from the nearest of [[The Nine Great Wards]], which were made of divinity and have been bleeding it, a thread at a time, for nine thousand years. Scholars call the draw the Tithe. A hedge-witch calls it the cold, because that is what it feels like: a chill up the arm as the spell goes out, as if something far away had noticed.

Nobody is charged. Nobody sends a bill. That is why magic is common: anyone with the knack and a teacher can learn, and the cost falls somewhere else, on a stone in a fen or under a mountain, and on the Lithic who stand there. The Vesh, who can feel a spell the way you feel a draught, say that the whole continent has been quietly spending down an inheritance and calling it weather.

### The traditions
**Imperial magi**: the Regency's trained wizards, heirs to the academies of [[Caer Ardith]], who bred the orcs and burned the plain at Cinders. Precise, expensive, bureaucratic; a magus files a form before a battle-spell and the form says what was spent. **Lamp-lore**: the Vesh way, slow, careful, a lamp at a time; Vesh wizards are the only tradition that teaches students to feel the cold and stop. **Hedge-craft**: the village witch, the halfling barge-charm, the orc company's scar-singer. Small spells, local costs, long memories. **Prayer**: priests draw on their god instead of a ward, and the god lends, and the loan is recorded. [[Corvex]]'s auditors say the Tithe is theft from the Nine and prayer is honest credit, and the Nine have not been asked.

**Battle sorcery** is all of these at scale and is the reason the Ashenreach is glass. See [[The Battle of Cinders]].

### What magic cannot do
Raise the dead. Hathe could have, perhaps, and did not; since his death the dead sometimes rise on their own, which is not the same thing. Read a Lithic's script without a Lithic. Pass a Great Ward. Hide from a Vesh in a dark room.

### What casters notice
Near a weak ward, magic comes easier and the cold is sharper; near [[The Rent]] a cantrip feels like a shout and a real spell leaves frost on the caster's teeth. At full red moon every caster in the March of Cinders dreams, and some of them dream the same thing. The Lithic ask casters not to cast near a ward. They are rarely obeyed and never rude about it.

:::gm
Rules of thumb for the table. Within a mile of a ward, spells of 1st level and up tick a GM tally; every ten ticks the Sleeper stirs clock gains a notch of pressure the GM may spend as a dream, an omen or a rising corpse. Within sight of the Rent, casters may cast one spell per long rest at one level higher than the slot spent, and must succeed on a DC 12 Wisdom save afterward or take a level of exhaustion and dream that night. At full Ember the DC is 15 and the dream is the Sleeper's. Battle sorcery (any spell of 5th level or higher cast in anger) near the Ninth Stone cracks it visibly; let the players hear it.

Prayer is not free either: a priest who leans on their god for a big miracle owes the god a favour, and the gods of this pantheon call them in.
:::`,
    gmNotes: `This page is why the party cannot simply blast the problem. Let the Vesh PC feel every cost; let a magus NPC file a form for a fireball. Use the mile-rule lightly: it exists to make the Rent feel dangerous to cast near, not to punish wizards everywhere.`,
    tags: ['lore', 'magic'],
  },
  {
    key: 'lore-ember',
    type: 'lore',
    name: 'The Ember',
    aliases: ['the red moon', 'the Sergeant', 'the Saint\'s Lamp'],
    players: true,
    summary: 'The red moon that rose the night of Cinders and has crossed the sky every 23 days since. Soldiers call it the Sergeant, Iskaveth calls it the Saint\'s Lamp, scholars call it impossible.',
    fields: [
      { key: 'Cycle', value: '23 days, full to full' },
      { key: 'First seen', value: 'The night of the Battle of Cinders, 3002 AW' },
      { key: 'Next full', value: '16 Ashfall 3011, two nights after the campaign opens' },
    ],
    relations: [
      { to: 'god-sleeper', kind: 'is the light of', note: 'The Sleeper\'s dream, shown through the crack. It dims if the Ninth is resealed.' },
      { to: 'ev-ember-rises', kind: 'first rose at', known: true },
    ],
    body: `### What it is
A second moon. It is small, a third the width of pale Pallas, and the colour of a coal at the bottom of a fire, and it rose for the first time over the Ashenreach on the night of [[The Battle of Cinders]], in 3002 AW, and nobody has been able to explain it since. It crosses the sky in twenty-three days, full to full, and it does not keep to Pallas's months, and the two moons are full together only twice in three years. See [[The Ember Rises]].

### Its names
Soldiers call it **the Sergeant**, because it is always watching and it is never where the calendar says. Iskaveth calls it **the Saint's Lamp**, lit the night [[Ilyra of Halcyra]] walked out of the fire; the faithful put out every other light when it is full. The Regency's astronomers call it **the Anomaly** in their reports and the Ember in their cups. The Sleepless call it the Eye. The Hollowborn, when asked, say it is not a moon and change the subject.

### What happens when it is full
In most of the continent, nothing you would notice but a redder night. In [[The Ashenreach]], a great deal. The [[The Weeping Orchard]] bleeds sap from its stone trees. The dead that did not pass are restless and sometimes walk. Half of [[Cinderford]] sleeps badly and a third of it dreams the same dream, though most forget it by breakfast. [[The Hollowborn]] all dream it and do not forget. The Sleepless march in [[The Smokes]] with their eyes painted on their foreheads, half open. And [[The Lantern of the Ninth]], which has never gone out, burns a little lower; [[Brother Tallow]] trims it himself on those nights and lets nobody watch.

### What the learned say
That it is a comet caught; that it is a reflection; that it is a wound in the sky where the battle sorcery went up; that it is the Saint's; that it is impossible, and will go away, and has not. The elves of Sael say nothing, which the Remembrancers note is what they say about everything they once knew.

:::gm
The Ember is the Sleeper's dream, shown. The Ninth Ward cracked and the god below has been dreaming through the crack ever since, and the red moon is that dream caught in the sky the way a lamp is caught in a window: not the thing, but the light of it. It is strongest at its full because that is when the dream is strongest, and the dream is stronger each time. **The Sleeper stirs** clock on [[The Sleeper Below]] ticks at every full Ember.

If the Ninth is resealed, the Ember dims over a season and goes dark. If the crack opens, it waxes until it is the size of Pallas and does not set. If the flame is taken and used, it stays as it is, and the holder stops noticing it, and everyone else notices the holder.

Full Ember dates for the campaign year: 16 Ashfall (session 3's night), 9 Leafrot, 2 Frostcall, 25 Frostcall, 18 Longnight. Pallas is full on the 15th of every month, so the first of those is a near double-full, and the Ashenreach is at its worst.
:::`,
    gmNotes: `Count days. The Ember is the campaign's metronome; every 23 days the GM gets a dream scene, a restless graveyard and a clock tick. Tell the players the date often and let them start counting too.`,
    tags: ['lore', 'sky'],
  },
  {
    key: 'lore-reckoning',
    type: 'lore',
    name: 'The Reckoning of Years',
    aliases: ['the Calendar', 'the Reckoning'],
    players: true,
    summary: 'How Vael Ardith counts time: twelve months of thirty days, six-day weeks, two moons, and a year that starts in the dead of winter.',
    fields: [
      { key: 'Era', value: 'AW, After the Warding' },
      { key: 'Year', value: '360 days: 12 months of 30, 5 weeks of 6' },
      { key: 'Now', value: '14 Ashfall 3011 AW, a Coinday, early autumn' },
    ],
    body: `### The count
Years are counted from the raising of [[The Nine Great Wards]]: AW, After the Warding. The count was the Lithic's, kept in stone; the human kingdoms borrowed it, the empire made it law, and even the Concord, which keeps its own fiscal years, dates its contracts AW. There is no year before the first; everything earlier is Before the Count, and the myths do not agree on it.

### The months
Twelve, of thirty days each, and the year opens in the cold:

Hollowfrost, Thawmere, Seedwake, Bloomtide, Greenreach, Highsun, Emberwane, Reaping, Ashfall, Leafrot, Frostcall, Longnight.

Ashfall was called Goldfall until the Battle of Cinders, which fell in it; the companies renamed it the winter after, and the name stuck everywhere but in the Regency's calendars, which still print the old one. Nobody in the Ashenreach uses it.

### The week
Six days: Ironday, Coinday, Hearthday, Tideday, Wardday, Restday. Five weeks to a month, so the first of every month is an Ironday and the thirtieth a Restday, and a date tells you its weekday if you can divide by six. Wages are paid on Coinday. Pay for the mercenary companies of the Ashenreach falls due on the second Coinday of each month, the fourteenth, by [[The Original Treaty]]; the campaign opens on the Coinday it does not come.

### The moons
**Pallas**, the pale moon, runs a thirty-day cycle and is full on the fifteenth of every month, a Hearthday, which is why rents, tides and festivals run on it and why the fifteenth is the day everyone is owed something. Her dark is the thirtieth night, which belongs to [[Isaurana]].

**The Ember**, the red moon, rose the night of Cinders and runs twenty-three days, full to full, in step with nothing. See [[The Ember]].

### The holy days
- **1 Hollowfrost**: the Long Hold ([[Tharos]]); the year's first day, kept in silence by the dwarves.
- **1 Seedwake**: Sowing ([[Maelis]]).
- **1 Bloomtide**: Greening ([[Orvanne]]). **7 Bloomtide**: the Turning ([[Sefra]]), first sailing.
- **1 Highsun**: Firstfire ([[The Unburnt Saint]]). **15 Highsun**: Crownfast ([[Aurelan]]).
- **30 Emberwane**: Anvil Night ([[Grum]]).
- **30 Reaping**: Last Sheaf (Maelis).
- **14 Ashfall**: the night of [[The Battle of Cinders]], kept by every company in the Ashenreach with a lantern.
- **1 Leafrot**: Doorsnight ([[Hathe]]); doors propped open till dawn.
- **1 Frostcall**: Stonefast (Tharos). **6 Frostcall**: Rope Day ([[The Hanged Corporal]]). **23 Frostcall**: Lastwater (Sefra).
- **1 Longnight**: the Reckoning ([[Corvex]]); every counting-house closes at noon. **30 Longnight**: Hearthnight (Maelis) until the doors shut, then the Long Veil (Isaurana).
- **Every week**: Ironday to Grum, Coinday to Corvex, Hearthday to Maelis, Tideday to Sefra, Wardday to Tharos and the Lithic, Restday to the Corporal, who says he is owed it.
- **Every full Ember**: the Saint's Lamp in Iskaveth, and something else in the ash.

### The campaign's dates
The campaign opens on **14 Ashfall 3011 AW**, a Coinday, early autumn, nine years to the night after Cinders, with the Ember two nights from full. Winter in the Ashenreach comes early and grey.

:::gm
Weekday arithmetic for the table: day of month modulo six, where 1 is Ironday and 0 is Restday. Full Ember dates this year: 16 Ashfall, 9 Leafrot, 2 Frostcall, 25 Frostcall, 18 Longnight. Pallas full every 15th. The treaty pay-day (the 14th) falls the day before every Pallas full, which is why the company has always had money for the one night a month the town expects it to spend; and why its absence will be noticed by the whole of Cinderford by the fifteenth.
:::`,
    gmNotes: `Keep this page open at the table. The app's calendar is set from it; when players ask what day it is, give the weekday too, because the weekdays carry the gods and the gods carry the plot.`,
    tags: ['lore', 'calendar'],
  },
  {
    key: 'lore-ul-tarran',
    type: 'lore',
    name: 'Ul-Tarran',
    aliases: ['the Lithic kingdom', 'the Stone Kingdom'],
    summary: 'The lost kingdom of the Lithic, which rose around the Great Wards in the first age and petrified around them over nine hundred years. Its last king is a statue on his throne.',
    fields: [
      { key: 'Span', value: 'About 0 to 940 AW', gm: true },
      { key: 'Capital', value: 'Tarran-Ulm, in the Standing Fields at the Seventh Ward', gm: true },
      { key: 'Last king', value: 'Anuvar the Still, seated 940 AW and seated yet', gm: true },
    ],
    relations: [
      { to: 'people-lithic', kind: 'kingdom of' },
      { to: 'lore-wards', kind: 'built around' },
      { to: 'ev-ul-tarran-falls', kind: 'ended at' },
    ],
    body: `### What it was
When the Nine became stone, their children did not. The Lithic of the first generations were tall, grey, long-lived and barely touched by the curse, and they did what children of demi-gods do: they built. Ul-Tarran rose in the first century AW as nine ward-towns joined by stone roads, with a capital, Tarran-Ulm, at the Seventh Ward in what is now called the Standing Fields. For nine hundred years it was the only kingdom on the continent worth the name. The dwarves carved [[Hollowhall]] in 412 as its northern gate. The first humans along the Ardis paid it tribute and learned its count of years.

It was not a conquering kingdom. It was a watch. Every Lithic was raised knowing what lay under the land and what their family had done, and the whole of Ul-Tarran's law was a rota: who stood at which ward, and when, and who came after.

### How it ended
Slowly, which is how the Lithic do everything. The stone climbed faster each generation. Children were fewer. The rota got shorter. By 700 AW the ward-towns were half statues and the roads between them were kept by the dwarves, who had begun to think of the Lithic as holy because the Lithic had stopped answering. In 940 AW the last king, Anuvar the Still, took his throne in Tarran-Ulm for the last time, gave his last orders (the rota, again), and did not get up. He has not. [[The Silence of Ul-Tarran]] is dated from that sitting. The kingdom did not fall. It stood, and is standing.

### What is left
- **The Standing Fields** at the Seventh Ward: Tarran-Ulm's ruins and several hundred statues facing the stone, the king among them on a chair of grey basalt in a roofless hall. All awake. They speak to a Lithic, or to anyone holding [[The Ward Shard]], at about a sentence an hour.
- **The ward-towns**: a barrow at the Third, a drowned quay under the Fifth, sealed galleries beneath the Eighth, and at the Ninth, a town the glass took. The village under [[Cinderford]]'s ford was built on it; [[The Glass Barrow]] is its upper storeys, fused. [[Vexa Glassjaw]]'s diggers at [[Fort Mercy]] have broken into a lower one and found Lithic script on every wall, which she cannot read and is trying to sell.
- **The script**: a tall, spare writing read top to bottom, kept by the Lithic and taught to no one. It can be read by a Lithic, by someone who has dreamed in the Ward Shard's company for a month, or by nobody. The glass of the Ashenreach is full of it. Most of it is the rota.
- **The count**: AW, which everyone uses and nobody remembers was theirs.

### GM hints
- The script in the glass at Fort Mercy is the Ninth ward-town's rota: the names of who stood at the Ninth and when, and the last entry is Uthrem's line, and the entry after it is blank. A Lithic reading it will go very quiet.
- Anuvar's last orders, if anyone reaches the Standing Fields and waits long enough to hear them, are the method for giving a ward a new heart. It takes a day to hear. It was meant for a Lithic. It does not say it has to be.
- The Remembrancers of Sael want Ul-Tarran's records because Ul-Tarran kept records of its neighbours, and in 1102 one of its wardens at the Fourth was still awake enough to see what the elves did.`,
    gmNotes: `Ul-Tarran is the campaign's deep history and the next campaign's dungeon. Use it in session 6 through Uthrem's telling, and let the glass at Fort Mercy and the Barrow be its fingerprints. The Standing Fields are a late-game journey if the party wants the method for Ending A from the source.`,
    tags: ['lore', 'history'],
    gmTags: ['secret-history'],
  },
]
