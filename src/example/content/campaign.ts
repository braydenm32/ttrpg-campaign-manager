import type { ExBoard, ExPage, ExSession } from '../types'

/**
 * The campaign "The Lantern Gutters": quests, loose threads, handouts, the three endings, campaign
 * events, the Start Here guide and two templates; then the eight sessions and the corkboard.
 */

const QUESTS: ExPage[] = [
  {
    key: 'q-lantern-gutters',
    type: 'quest',
    name: 'The Lantern Gutters',
    players: true,
    questStatus: 'active',
    parent: 'cinderford',
    summary: 'Keep the Ninth Lantern burning, keep the company alive, and find out what the flame really is.',
    fields: [
      { key: 'Given by', value: 'Captain Marrow, and the contract' },
      { key: 'Reward', value: 'A company that still exists next month' },
      { key: 'Levels', value: '1 to 5, over eight sessions', gm: true },
    ],
    body: `The [[The Ninth Lantern|Ninth Lantern]] holds [[Cinderford]] under the [[The Treaty of Ashes]]. Its contract has one clause everybody knows by heart: if the lantern in its iron cage on [[Lantern Hill]] ever goes out, the company stands down. It has burned for nine years without a flicker.

Now the pay hasn't come, half the company is muttering, and someone is poisoning the flame. The party's job is the oldest one in soldiering: keep the light on, and find out who wants it dark.

### What the party knows
- The pay is late again. Very late.
- [[Brother Tallow]] tends [[The Lantern of the Ninth]] and says it has never once guttered.
- Everyone in town has an opinion about the lantern. Most of them want something from it.

:::gm
### The arc in one breath
The ninth lantern was lit from a shard of [[The Ninth Stone]], blown loose the night of Cinders and kicked into a cook-fire. Its flame is part of what holds the crack in the Ninth Ward shut. Nobody in the company knows. [[Brother Tallow]] suspects. Every faction in the region is about to find out, and every one of them wants the flame for something different. At the end, under a full red moon at [[The Rent]], the party decides its fate: **reseal** the ward, **let it crack**, or **use it**. See [[Ending: Reseal the Ward]], [[Ending: Let It Crack]] and [[Ending: Use It]].

### How the clues connect
1. **Session 1, Payday.** The pay notice reads 0 silver ([[Pay Notice]]). [[Dannic Rook]], a deserter, rises from the ford; his trail leads into [[The Glass Barrow]], where the party finds [[The Cut Oil Tin]]. Someone is poisoning the flame. The lantern gutters for the first time.
2. **Session 2, The Assessor.** [[Pell Quillon]] arrives to tax a company the Regency won't pay ([[Tax Notice, in Triplicate]]). The missing pay wagon leads to [[Fort Mercy]]. Inside: Concord coin where Regency coin should be. [[Grandmother Tollamund]] lent the pay in the company's name and let it be stolen, so the company owes the debt and has none of the money. [[Vexa Glassjaw]] trades [[A Glasser's Chart]] of the Rent.
3. **Session 3, Red Moon Rising.** The Ember comes full. Half the town dreams the same dream. [[The Sleepless]] march in [[The Smokes]], led by [[The Dreaming Widow]], Tick's aunt. The lantern gutters again and [[Brother Tallow]] collapses. [[Ysse Lampwright]] has to tend it.
4. **Session 4, The House of Unburnt Light.** [[Seraphine Ashe]] invites the party ([[A Perfumed Letter]]) and offers to "save" the flame by carrying it to Halcyra. At [[The Velvet Ledger]], [[Sorrel Vey]]'s ink and secrets show that the Saint's church wants the crack to open.
5. **Session 5, Last Words.** [[Mother Corvane]]'s ledger of last words spells out "the lamp is the lock". The sap of [[The Weeping Orchard]] and a dying veteran's confession reveal where the lantern was really lit: from a stone shard, in a cook-fire, by the deserters nobody counted.
6. **Session 6, Into the Rent.** Using the Glasser's chart, the party reaches [[The Ninth Stone]] and [[Warden Uthrem]]. He tells the truth of the Godslaying and asks for a new heart for the ward. [[A Rubbing from the Ninth Stone]] can be taken. Borrin's shadow acts on its own.
7. **Session 7, Three Knives.** [[The Quiet Office]] (through [[Ansel Mote]]), [[The Concord Houses]] (through Tollamund) and [[The Church of the Unburnt Saint]] (through Seraphine) all move on the lantern in the same week. [[Garrick Sallow]]'s mutiny breaks open.
8. **Session 8, The Lantern Gutters.** The last night, under a full red moon, at the Rent.

### Who is poisoning the flame (the answer)
[[Ansel Mote]] of the Quiet Office pays [[Garrick Sallow]]. Sallow paid [[Dannic Rook]] to swap the good oil for tins cut with ash. The ash came from [[The Dreaming Widow]], who gave it gladly: it is lake-ash from [[Stillwater]], and the flame chokes on it. When Dannic got cold feet and ran, Mote drowned him at the ford. [[Spoons Aldane]] saw Sallow and Dannic at the oil store and said nothing, because he holds the biggest pool in the company on the night the lantern goes out. [[Fennick Bottlebrook]] is a red herring: he has been selling the company's good oil downriver to buy bread, which made the swap easy to hide.

### The clocks
Keep [[The Ninth Lantern]]'s Mutiny clock, the Quiet Office clock, the Concord's Debt clock, the Saint's clock and the Sleeper's world clock on [[The Sleeper Below]] moving between sessions. Tick the Sleeper each full red moon (sessions 3 and 8).
:::`,
    gmNotes: `This is the spine page. Read the arc above once, then run session by session from the Sessions list. Every session's prep has a strong start, scenes, clues and fights ready.

If the party wanders, let them. The factions keep moving whether the PCs are watching or not: tick their clocks, and let the consequences arrive at the Keep's gate.`,
    relations: [
      { to: 'f-ninth-lantern', kind: 'given by', known: true },
      { to: 'item-lantern', kind: 'concerns', known: true },
    ],
    tags: ['main quest'],
  },
  {
    key: 'q-payday',
    type: 'quest',
    name: 'The Missing Pay',
    players: true,
    questStatus: 'active',
    parent: 'lantern-keep',
    summary: 'The Regency owes the Ninth Lantern two years of wages. This quarter the notice came and the coin did not.',
    fields: [
      { key: 'Given by', value: 'Captain Marrow' },
      { key: 'Reward', value: 'Wages, if any can be found' },
      { key: 'Sessions', value: '1 to 2', gm: true },
    ],
    body: `The pay notice came up the road from the Regency with its seal and its signatures and, in a clerk's tidy hand, the sum of **0 silver**. The wagon that should have followed it never arrived.

[[Ilse Marrow|Captain Marrow]] wants the wagon found, or at least wants to know who to be angry at. [[Fennick Bottlebrook]] wants it found before the bakers stop giving credit. [[Garrick Sallow]] wants everyone to keep talking about it.

### Leads
- The [[Pay Notice]] itself: a real seal, a real signature, a very real zero.
- The wagon was last seen at the waystation two days east, on the old road past [[The Treaty Stone]].
- The barge-folk on [[The Low Quay]] hear everything that moves on the Cinder and most things that move on the road.

:::gm
The Regency sent no coin at all; the Council stopped paying in 3009 and the notice is a formality its clerks still send. The wagon that set out was **Concord** money: [[Grandmother Tollamund]] "advanced" the quarter's pay as a loan in the company's name, then sold the route to [[The Glassers]] through a barge-runner. The company now owes the loan, and the coin sits in the cellars of [[Fort Mercy]].

Proof comes in session 2: the coin in the strongbox is fresh Sevenhaven mint, stamped with the Tollamund house-mark, and the strongbox carries a loan-chit naming the Ninth Lantern as debtor. Clue for session 1: Fennick mentions that Tollamund's clerk asked, very politely, when the pay was due to arrive. Banks don't ask that unless they already know.
:::`,
    relations: [
      { to: 'ilse-marrow', kind: 'given by', known: true },
      { to: 'tollamund', kind: 'secretly caused by' },
      { to: 'fort-mercy', kind: 'leads to' },
    ],
    tags: ['session 1'],
  },
  {
    key: 'q-poisoned-flame',
    type: 'quest',
    name: 'Who Is Poisoning the Flame?',
    players: true,
    questStatus: 'open',
    parent: 'lantern-keep',
    summary: 'A tin of lantern oil cut with grey ash, found on a dead deserter. Someone wants the lantern to go out.',
    fields: [
      { key: 'Given by', value: 'Brother Tallow, once he sees the tin' },
      { key: 'Reward', value: 'The company survives' },
      { key: 'Sessions', value: '1 to 7', gm: true },
    ],
    body: `The tin was in [[The Glass Barrow]], tucked behind a drowned man. The oil inside is cloudy and grey, and when [[Brother Tallow]] rubs it between his fingers his antennae flatten. "Ash," he says. "Someone has been feeding my flame ash."

The contract says the company stands down if the lantern goes out. Somebody has worked that out.

### Suspects worth a look
- [[Garrick Sallow]], who would like to command something, even the leftovers.
- [[Spoons Aldane]], who runs a book on when the lantern goes out.
- [[Fennick Bottlebrook]], whose oil ledger is a work of fiction.
- [[Seraphine Ashe]], who has been asking very kindly about the flame.
- [[Grandmother Tollamund]], who holds the company's debts.
- [[The Dreaming Widow]] and her Sleepless, who pray for the dark.

:::gm
The full answer is on [[The Lantern Gutters]] page. In short: [[Ansel Mote]] pays, [[Garrick Sallow]] arranges, [[Dannic Rook]] swapped the tins, [[The Dreaming Widow]] supplied the ash, Mote drowned Dannic when he ran, [[Spoons Aldane]] saw and kept quiet for his pool.

Run it on the corkboard "Who's poisoning the flame?". Let the party chase the wrong suspect for a while; Fennick's guilty face sells the red herring beautifully.

Proof trail: Spoons cracks if the party covers his debts or threatens the pool (session 2 or 3). Sallow's new coin is Regency silver, mint-fresh, which nobody in the Ashenreach has seen in two years (Quiet Office money). The ash is fine and smells of lake water: only [[Stillwater]] ash smells like that. Mote is the last link, and the hardest; he is not caught until session 7 unless the party is very clever.
:::`,
    relations: [
      { to: 'item-oil-tin', kind: 'begins with', known: true },
      { to: 'brother-tallow', kind: 'given by', known: true },
      { to: 'ansel-mote', kind: 'leads to' },
    ],
    tags: ['session 1', 'mystery'],
  },
  {
    key: 'q-drowned-man',
    type: 'quest',
    name: 'The Drowned Man',
    players: true,
    questStatus: 'active',
    parent: 'the-ford',
    summary: 'A deserter drowned under the ford a week ago. Today he climbed out.',
    fields: [
      { key: 'Given by', value: 'Sergeant Vosk' },
      { key: 'Reward', value: 'A round at the Last Candle, on the sergeant (allegedly)' },
      { key: 'Sessions', value: '1', gm: true },
    ],
    body: `[[Dannic Rook]] walked out of the Keep a week ago with two tins of lantern oil and no goodbye. This morning the ford-watch hooked his body out of the shallows below the toll bridge, and it stood up.

The dead don't always stay down since [[Hathe]] died. Everyone knows that. But they don't usually climb out of rivers with a purpose, either.

### What the party can find
- What Dannic said, if anyone can get it out of him.
- Where the river carried him: the old culvert under the ford, into the dark.
- Why a man who ran away with oil was dead in the river and not halfway to Sevenhaven.

:::gm
[[Ansel Mote]] held Dannic under at the ford on the night of 7 Ashfall, when Dannic tried to back out. The current took the body through the culvert into [[The Glass Barrow]], where the Sleeper's leak runs cold and the dead don't rest. Dannic walked back to the one place he knew. His last words, to Quorl or to whoever kneels by him: **"It's cold under the glass."**

The quest ends when the party finds his stash in the Barrow and [[The Cut Oil Tin]]. That hands them [[Who Is Poisoning the Flame?]].
:::`,
    relations: [
      { to: 'dannic-rook', kind: 'concerns', known: true },
      { to: 'glass-barrow', kind: 'leads to' },
    ],
    tags: ['session 1'],
  },
  {
    key: 'q-kettles-cargo',
    type: 'quest',
    name: "Kettle's Cargo",
    players: true,
    questStatus: 'open',
    parent: 'low-quay',
    summary: 'Kettle Brindlewake needs a barge-load past the toll bridge without the company patrol looking in it.',
    fields: [
      { key: 'Given by', value: 'Kettle Brindlewake' },
      { key: 'Reward', value: '20 silver and a favour on the river' },
      { key: 'Sessions', value: '1 to 2 (side quest)', gm: true },
    ],
    body: `[[Kettle Brindlewake]] is a halfling barge-captain with a pipe she never lights and a laugh she never stops. She needs her barge, the *Grey Dumpling*, taken under the toll bridge at night while Lieutenant Sallow's patrol is busy elsewhere. "Nothing illegal," she says. "Mostly nothing illegal. Nothing illegal *here*."

She pays in silver, which in Cinderford this month is very nearly a miracle.

:::gm
The cargo is twelve casks of the company's good lantern oil, sold to Kettle by [[Fennick Bottlebrook]] so he could buy bread and boots. Fennick is not poisoning the flame; he is feeding the company the only way he can. If the party opens a cask, the oil is clean and golden, the opposite of [[The Cut Oil Tin]].

There is also a thirteenth crate that isn't on Kettle's manifest. It is warm. Inside, wrapped in sacking, is a stone hand dug from the glass, with Lithic letters on the palm, bound for [[Aelith Sorn]], who paid a Glasser for it. Kettle didn't load it and would like it off her barge.

Outcomes: help Kettle and she becomes the party's eyes on the river (she tells them about the pay wagon's route in session 2). Expose Fennick and the company eats better for a fortnight, then much worse. Keep the stone hand and Aelith Sorn will come asking, politely, then less politely.
:::`,
    relations: [
      { to: 'kettle', kind: 'given by', known: true },
      { to: 'fennick', kind: 'secretly involves' },
      { to: 'aelith-sorn', kind: 'secretly involves' },
    ],
    tags: ['side quest'],
  },
  {
    key: 'q-assessors-form',
    type: 'quest',
    name: "The Assessor's Lost Form",
    questStatus: 'open',
    parent: 'assessors-office',
    summary: 'Pell Quillon has lost Form 9-K, and without it he cannot legally stop taxing anyone.',
    fields: [
      { key: 'Given by', value: 'Assessor Pell Quillon' },
      { key: 'Reward', value: 'Exemption from the Hearth Levy, and Pell’s undying gratitude' },
      { key: 'Sessions', value: '2 to 3 (side quest)', gm: true },
    ],
    body: `[[Pell Quillon]], Fourth Assistant Under-Collector of the Regency, has lost a form. Not just any form. **Form 9-K, Declaration of Wages Owed But Not Payable, Countersigned**, the only document that lets him record that the Ninth Lantern cannot pay its taxes because the Regency hasn't paid the Ninth Lantern.

Without it he must tax the company in full. With it, he can stop. He is close to tears about it.

:::gm
[[Ansel Mote]] took it. The form carries a Regency counter-seal in wax, and Mote has been using its blank reverse for his cipher reports to the Quiet Office (see the loose thread about the clerk's writing). It is in a locked drawer of Mote's desk at [[The Assessor's Office]], under a false bottom (Investigation DC 14 to find, Thieves' tools DC 13 to open).

On its back, in a tiny, neat hand: columns of numbers that look like tax tables. They are a cipher. A wizard or anyone with a week and a dictionary (Intelligence DC 16, or Ysse with an hour) gets one line out: **"S. paid. Oil done by the red moon. Assessor knows nothing."**

Returning the form makes Pell an ally for life. He will stamp anything for them, once, in triplicate.
:::`,
    relations: [
      { to: 'pell-quillon', kind: 'given by' },
      { to: 'ansel-mote', kind: 'secretly involves' },
    ],
    tags: ['side quest', 'comic'],
  },
  {
    key: 'q-weeping-sap',
    type: 'quest',
    name: 'Sap from the Weeping Orchard',
    questStatus: 'open',
    parent: 'weeping-orchard',
    summary: 'Brother Tallow needs the red-moon sap of a petrified orchard to clear the poisoned flame.',
    fields: [
      { key: 'Given by', value: 'Brother Tallow (or Ysse, if Tallow is down)' },
      { key: 'Reward', value: 'The lantern burns clean for a while' },
      { key: 'Sessions', value: '3 to 5 (side quest)', gm: true },
    ],
    body: `The old keepers of the lantern left [[Brother Tallow]] a few lines in a prayer-book: when the flame chokes, feed it the tears of the stone trees. There is only one stone orchard in the Ashenreach. [[The Weeping Orchard]] stands half a day north, every tree turned to grey stone, and on the night of a red moon the stone bleeds sap.

Tallow can't make the walk. Someone has to go, at night, under the Ember, and bring back a flask.

:::gm
The orchard was a Lithic grove in the days of [[Ul-Tarran]]; its "sap" is the slow life of the stone, the same stuff the Lithic become. It does clear the ash from the flame. It also shows that the flame and the stone are kin: dropped on [[The Lantern of the Ninth]], the sap makes it burn tall and white, and for a moment Ysse sees a shape in it like a standing figure.

Complications on the night: Sleepless pilgrims come to drink the sap for dreams (2 cult fanatics and 4 commoners); the trees whisper Sleeper dreams (roll on [[Sleeper Dreams]]); one tree has a soldier's face in its bark. Collecting enough takes an hour (three successes before two failures: Survival, Nature or Medicine DC 12).

This side quest is a good way into session 5's "where was the lantern lit" clue: a dying veteran is waiting under the oldest tree.
:::`,
    relations: [
      { to: 'brother-tallow', kind: 'given by' },
      { to: 'item-lantern', kind: 'concerns' },
    ],
    tags: ['side quest'],
  },
  {
    key: 'q-raveler-funeral',
    type: 'quest',
    name: 'The Funeral That Would Not End',
    questStatus: 'open',
    parent: 'corvel-rise',
    summary: 'A company soldier’s burial at Corvel Rise, where the corpse refuses to go through the door.',
    fields: [
      { key: 'Given by', value: 'Mother Corvane, through Quorl' },
      { key: 'Reward', value: 'A page of the Rook-Court’s ledger' },
      { key: 'Sessions', value: '4 to 5 (side quest)', gm: true },
    ],
    body: `Old Halloran Pike of the Ninth Lantern died in his cot, of nothing much, seventy years old and proud of every one. The Ravelers carried him to [[Corvel Rise]] to send him through Hathe's door the proper way, with salt, crow-song and a coin on the tongue.

He sat up halfway through. Politely. He would like it known that the door is locked, and he isn't going anywhere until somebody opens it.

[[Mother Corvane]] would like the funeral finished. Her rookery is full of mourners, two of them fainted, and the bread is going stale.

:::gm
Since [[Hathe]] died, his doors don't always open. Pike's door is jammed by the same cold leak that raised [[Dannic Rook]]. The way through is [[Hathe's Door-Key]], kept in the Rook-Court's reliquary; Corvane will lend it to Quorl (or a PC who earns it) to finish the rite.

When the door finally opens, Pike says his last words properly, and they are the same as the seven Quorl has already heard: **"The lamp is the lock."** Corvane, standing by, goes very still. She has been waiting for one more voice to be sure. This hands the party into session 5 and the Rook-Court's ledger.

If it goes wrong (the key is refused, the rite is botched), Pike gets up and goes home to the Keep, where he sits on his cot and won't leave. The company is not thrilled.
:::`,
    relations: [
      { to: 'mother-corvane', kind: 'given by' },
      { to: 'item-door-key', kind: 'needs' },
      { to: 'f-rook-court', kind: 'concerns' },
    ],
    tags: ['side quest'],
  },
]

const THREADS: ExPage[] = [
  {
    key: 't-oil-cutter',
    type: 'thread',
    name: 'Who is cutting the lantern oil?',
    threadStatus: 'open',
    threadUrgency: 'high',
    raisedIn: 1,
    summary: 'Ash in the lantern oil. The single most important question in the campaign.',
    body: `**The question.** Who swapped the lantern's oil for tins cut with ash, and why?

**What the GM knows.** [[Ansel Mote]] (Quiet Office) pays [[Garrick Sallow]]. Sallow paid [[Dannic Rook]] to swap the tins. [[The Dreaming Widow]] gave them the ash, lake-ash from [[Stillwater]]. Mote drowned Dannic when he ran. [[Spoons Aldane]] saw Sallow and Dannic at the oil store and keeps quiet to protect his betting pool.

**Where the answer lies.** [[The Cut Oil Tin]] (the ash smells of lake water); Sallow's mint-fresh Regency silver; Spoons' book; the cipher on the back of the Assessor's lost form; the corkboard "Who's poisoning the flame?".

**Payoff.** Sallow and Spoons in session 3 or 4; Mote in session 7.`,
    relations: [{ to: 'q-poisoned-flame', kind: 'tracks' }],
    tags: ['mystery'],
  },
  {
    key: 't-cold-under-glass',
    type: 'thread',
    name: "Why did the drowned man say it's cold under the glass?",
    threadStatus: 'open',
    threadUrgency: 'normal',
    raisedIn: 1,
    summary: "Dannic Rook's last words. They aren't about the river.",
    body: `**The question.** [[Dannic Rook]]'s last words were "It's cold under the glass." What's cold, and which glass?

**What the GM knows.** Under the glasslands, the Ninth Ward's crack leaks. The leak is the Sleeper's dream seeping up, and it feels cold: frost on fused glass in high summer, breath clouding in a sealed room. It's why the dead don't rest in [[The Glass Barrow]], and why Dannic walked. The deeper under the glass, the colder, all the way to [[The Rent]].

**Where the answer lies.** Frost in the Barrow's deepest room (session 1); [[Vexa Glassjaw]]'s diggers, who won't work the cold seams (session 2); [[Warden Uthrem]] (session 6).

**Payoff.** Session 6, when the party stands in the cold at the bottom of the Rent and understands it's the same cold.`,
    tags: ['mystery', 'sleeper'],
  },
  {
    key: 't-marla-warnings',
    type: 'thread',
    name: "What do Tick's mother's warnings mean?",
    threadStatus: 'open',
    threadUrgency: 'normal',
    raisedIn: 1,
    summary: 'Marla Marlowe walks beside her son and keeps pointing at the red moon.',
    body: `**The question.** [[Marla Marlowe]], Tick's dead mother, walks beside him and warns him about the Ember. What is she trying to say?

**What the GM knows.** Marla died the night of Cinders, giving birth to Tick in the Smokes. She sees what Hollowborn dream at every full red moon, and she sees that it's getting clearer: the Sleeper is closer to waking each time. She also knows her sister is [[The Dreaming Widow]], who leads [[The Sleepless]], and that her sister wants Tick. Marla can't speak plainly; she mouths, points, and once scratches a word in the ash: SISTER.

**Where the answer lies.** The Sleepless march (session 3), where Tick meets his aunt; the Sleeper's world clock.

**Payoff.** Session 3 (the aunt) and session 8 (what Marla does at the Rent, if Tick lets her).`,
    relations: [{ to: 'marla-marlowe', kind: 'concerns' }, { to: 'tick', kind: 'concerns' }],
    tags: ['pc thread'],
  },
  {
    // The Cinders-born (owner-confirmed canon): the six children born in Cinderford the night of Cinders grew up in about seven years.
    key: 't-cinders-born',
    type: 'thread',
    name: 'Why did the Cinders-born grow up so fast?',
    threadStatus: 'open',
    threadUrgency: 'low',
    raisedIn: 1,
    summary: 'Tick is nine years old and looks twenty. So do the five others born in Cinderford the night of the battle. Nobody knows why.',
    body: `**The question.** Six children were born in Cinderford on the night of [[The Battle of Cinders]], [[Tibbet Marlowe]] among them. All six grew from cradle to grown in about seven years. Every [[The Hollowborn|Hollowborn]] child born since has aged like anyone else. Why those six, and why that night?

:::gm
**What the GM knows.** They were born in the hours the Ninth Ward cracked and [[The Ember]] rose, the night [[The Sleeper Below]] dreamed hardest, and the dream got into them before their first breath. They did not grow evenly. They grew in steps, one at each full red moon, the dream drawing them up the way a lamp draws seedlings, and they stopped when they were grown enough to be of use. They are the first adult Hollowborn, and so the first who will hear the Sleeper in daylight: it is raising its mouths early. [[The Dreaming Widow]] calls Tick its firstborn and is not wholly wrong.
:::

**Where the answer lies.** The birth-rolls at the Maelis shrine on [[Temple Row]]: six names dated the night of Cinders, with heights that climb by the red moon. [[Ottilie Marlowe]]'s cellar door, where she measured all six. Tick's own memory of the marks. The Sleeper's dreams at each full Ember. [[Warden Uthrem]], if anyone thinks to ask him.

**Payoff.** Session 3, when the red moon pulls hardest on the Cinders-born; session 6, when Uthrem says what a ward's breaking does to the newly born; session 8, at the Rent.`,
    gmNotes: `How it ties to the Sleeper and the Ember: the growth came in steps at each full Ember, so the Cinders-born are a living record of the Sleeper's dream getting stronger. Each full Ember that ticks the Sleeper's clock pulls a little harder on all six, and hardest on Tick, because he stands closest to the flame. Let the players put it together from the clues (the rolls, Ottilie's door, Tick's marks) rather than telling them. If the ward is resealed, the pull stops and the six simply go on being young adults with very short childhoods. If it cracks or the flame is used, they are the first to speak with the Sleeper's voice.`,
    relations: [{ to: 'tick', kind: 'concerns' }, { to: 'people-hollowborn', kind: 'concerns' }, { to: 'god-sleeper', kind: 'concerns' }],
    tags: ['pc thread', 'mystery'],
  },
  {
    key: 't-borrin-shadow',
    type: 'thread',
    name: "Why does Borrin's shadow lag?",
    threadStatus: 'open',
    threadUrgency: 'low',
    raisedIn: 1,
    summary: 'Borrin casts no shadow. Except, now and then, he does, and it is a beat behind him.',
    body: `**The question.** [[Borrin Halt]] came up from the deep without a shadow, like all the Returned. So why, in the lantern light at the muster, did somebody see one behind him, moving a heartbeat late?

**What the GM knows.** Something from the Eighth Ward followed Borrin up. It wears his shadow. It is patient and curious, and close to the Ninth Ward's crack it grows bold. Each session, let one NPC notice the shadow once: a dog barks at it, a Vesh lamp-keeper stares, a child waves at it.

**Where the answer lies.** [[Warden Uthrem]] recognises what it is (session 6). The Returned in Gutter Market won't talk about it, but will leave town if they see it.

**Payoff.** Session 6, when the shadow acts on its own at the Ninth Stone; session 8, where it could take Borrin's place as the ward's heart (it would like that very much, for its own reasons).`,
    relations: [{ to: 'borrin', kind: 'concerns' }],
    tags: ['pc thread'],
  },
  {
    key: 't-clerk-writing',
    type: 'thread',
    name: "What is the Assessor's clerk really writing?",
    threadStatus: 'open',
    threadUrgency: 'normal',
    raisedIn: 2,
    summary: 'Ansel Mote writes all day, and none of it is tax.',
    body: `**The question.** [[Ansel Mote]] never stops writing, and the Assessor's forms never seem to get done. What's he writing?

**What the GM knows.** Cipher reports to [[The Quiet Office]], written on the blank reverse of sealed Regency forms so they travel in the official post unopened. Every report goes to [[Marius Vell]]. The cipher is a tax table: column widths are letters.

**Where the answer lies.** [[The Assessor's Lost Form]]; the post bag that leaves every Coinday; Pell himself, who has noticed that Mote's handwriting is much smaller than any form requires.

**Payoff.** Session 7, when the Quiet Office moves and the party can read what's coming.`,
    relations: [{ to: 'ansel-mote', kind: 'concerns' }, { to: 'q-assessors-form', kind: 'tracks' }],
    tags: ['mystery'],
  },
  {
    key: 't-wanted-date',
    type: 'thread',
    name: "Why is Dannic's wanted poster dated after his death?",
    threadStatus: 'open',
    threadUrgency: 'normal',
    raisedIn: 1,
    summary: 'The poster says he was seen alive on the 12th. He drowned on the 7th.',
    body: `**The question.** The poster on the wall of the Last Candle says Dannic Rook was "last seen on the Low Quay, 12th Ashfall". By the state of him, he'd been in the river since the 7th.

**What the GM knows.** [[Ansel Mote]] wrote the poster (as clerk of [[The Assessor's Office]]) and invented a sighting, so the company would blame a living, runaway Dannic for the oil and nobody would go looking for a body. He didn't count on the body coming back on its own.

**Where the answer lies.** [[Wanted: Dannic Rook]] handout; the printer in Temple Row who set it (paid by "a mousy little clerk"); [[Kettle Brindlewake]], who was on the Low Quay all day on the 12th and saw no Dannic.

**Payoff.** Session 2, when the party meets Mote and sees his handwriting.`,
    relations: [{ to: 'h-wanted', kind: 'concerns' }, { to: 'dannic-rook', kind: 'concerns' }],
    tags: ['mystery'],
  },
  {
    key: 't-pay-wagon',
    type: 'thread',
    name: 'Where did the pay wagon go?',
    threadStatus: 'open',
    threadUrgency: 'high',
    raisedIn: 1,
    summary: 'A wagon set out with the quarter’s pay and never reached Cinderford.',
    body: `**The question.** If the Regency's notice says 0 silver, what was the wagon carrying, and where is it?

**What the GM knows.** Concord coin, lent in the company's name by [[Grandmother Tollamund]], who then sold its route to [[The Glassers]]. The strongbox is in [[Fort Mercy]]'s cellars, unopened, because [[Vexa Glassjaw]] can smell a trap.

**Where the answer lies.** [[Kettle Brindlewake]] (the route); wagon ruts in the ash (Survival DC 12, before a greywind covers them); Fort Mercy.

**Payoff.** Session 2.`,
    relations: [{ to: 'q-payday', kind: 'tracks' }],
    tags: ['mystery'],
  },
  {
    key: 't-seven-whispers',
    type: 'thread',
    name: 'What are the dying whispering to Quorl?',
    threadStatus: 'open',
    threadUrgency: 'normal',
    raisedIn: 1,
    summary: 'Seven dying soldiers have whispered the same sentence to the company’s undertaker.',
    body: `**The question.** Seven soldiers, dying years apart, have said the same last words to [[Quorl Many-Words]]. What does it mean, and who is speaking through them?

**What the GM knows.** The sentence is **"The lamp is the lock."** The dead are close to the Sleeper's leak when they die, and what leaks up is the truth of the ward: the lantern's flame is what keeps the crack shut. [[Mother Corvane]]'s ledger of every last word since the war says the same thing, spread over a thousand mouths. She already guesses.

**Where the answer lies.** [[The Funeral That Would Not End]]; the Rook-Court's ledger at [[Corvel Rise]]; [[The Rook-Court]]'s clock.

**Payoff.** Session 5.`,
    relations: [{ to: 'quorl', kind: 'concerns' }, { to: 'mother-corvane', kind: 'concerns' }],
    tags: ['pc thread', 'mystery'],
  },
  {
    key: 't-ysse-dreams',
    type: 'thread',
    name: "Whose voice is in Ysse's dreams?",
    threadStatus: 'open',
    threadUrgency: 'normal',
    raisedIn: 1,
    summary: 'The flame has started speaking to Ysse in her sleep. It may not be one voice.',
    body: `**The question.** [[Ysse Lampwright]] can feel the flame failing, and it talks to her at night. Who is talking?

**What the GM knows.** Two voices, and Ysse can't yet tell them apart. One is slow and warm and heavy as a hillside: the Ninth of [[The Nine]], awake in the cracked stone, asking for a heart. Under it, sweeter and colder, is [[The Sleeper Below]], wearing the first voice like a coat and saying how much easier it would be just to *hold* the flame. Warm voice: "Stand with me." Cold voice: "Keep me." Give her one line from each, every session.

**Where the answer lies.** [[Brother Tallow]], who heard a voice once himself, decades ago; [[Warden Uthrem]], who has waited nine years for her.

**Payoff.** Session 6 (Uthrem names the warm voice) and session 8 (which voice she answers).`,
    relations: [{ to: 'ysse', kind: 'concerns' }, { to: 'item-lantern', kind: 'concerns' }],
    tags: ['pc thread', 'sleeper'],
  },
  {
    key: 't-marrow-savings',
    type: 'thread',
    name: 'How has Captain Marrow been feeding the company?',
    threadStatus: 'open',
    threadUrgency: 'normal',
    raisedIn: 1,
    summary: 'There has been bread on the tables for a year with no pay. Somebody has been paying for it.',
    body: `**The question.** The company has eaten all year without wages. Where did the money come from?

**What the GM knows.** [[Ilse Marrow]] has paid for it from her own savings, and Fennick has hidden it in his books so nobody would feel like charity. She is now broke. [[Sorrel Vey]], her lover, has been quietly covering her last debts, and wants to be asked for nothing in return, which Marrow can't bear.

**Where the answer lies.** [[Fennick Bottlebrook]]'s second ledger; Marrow's empty strongbox; the Velvet Ledger's accounts (session 4).

**Payoff.** Session 2 or 4. When the company learns, the Mutiny clock loses two segments: nobody mutinies against the woman who fed them.`,
    relations: [{ to: 'ilse-marrow', kind: 'concerns' }],
    tags: ['npc thread'],
  },
  {
    key: 't-sallow-coin',
    type: 'thread',
    name: 'Where is Lieutenant Sallow getting his money?',
    threadStatus: 'open',
    threadUrgency: 'high',
    raisedIn: 1,
    summary: 'Nobody has been paid in months, and Sallow is buying rounds.',
    body: `**The question.** [[Garrick Sallow]] stands the whole Last Candle a round on payday, with silver nobody else has. Where's it from?

**What the GM knows.** The Quiet Office, through [[Ansel Mote]]: forty silver a month to grow a mutiny and see the lantern go out, with a promise of a captaincy in a new Regency company afterwards. The coins are new Caer Ardith mint (Investigation DC 12 on one of them: the year is 3011).

**Where the answer lies.** A coin from Sallow's round; his room in the Keep (a letter, unsigned, in a small neat hand); [[Spoons Aldane]].

**Payoff.** Session 7, when the mutiny breaks open, or earlier if the party pushes. Exposing him early ticks the Quiet Office's clock and makes Mote act sooner.`,
    relations: [{ to: 'garrick-sallow', kind: 'concerns' }, { to: 'f-quiet-office', kind: 'concerns' }],
    tags: ['npc thread'],
  },
  {
    key: 't-lantern-lit',
    type: 'thread',
    name: 'Where was the ninth lantern really lit?',
    threadStatus: 'open',
    threadUrgency: 'low',
    raisedIn: 1,
    summary: 'Every soldier tells the story of the ninth lantern. None of them agree on where its flame came from.',
    body: `**The question.** The story says the deserters and cooks lit the ninth lantern "from the fire". Which fire? Ask Brother Tallow and he changes the subject.

**What the GM knows.** The Ruddy Hundred's cook-fire, at the cooks' camp in [[The Weeping Orchard]], where a shard of [[The Ninth Stone]] landed, blown out of the crack in the blast. It burned without wood all night. Mother Hennet (now of [[The Last Candle]]) lit the lantern from it to see by; Halloran Pike, a deserter, carried the lantern up to the Keep; Hennet carried the burning shard after it in a soup-pot. The flame has been the shard's ever since. [[Brother Tallow]] has kept [[The Ward Shard]] under the lantern's cage for nine years and has never said what it is.

**Where the answer lies.** A dying veteran's confession (old Halloran Pike, session 5); [[The Weeping Orchard]]'s sap; Tallow, if pressed hard after he collapses.

**Payoff.** Session 5.`,
    relations: [{ to: 'item-lantern', kind: 'concerns' }, { to: 'item-shard', kind: 'concerns' }],
    tags: ['mystery'],
  },
  {
    key: 't-saint-courting',
    type: 'thread',
    name: 'Why is the Saint’s envoy courting the party?',
    threadStatus: 'open',
    threadUrgency: 'normal',
    raisedIn: 2,
    summary: 'Sister Seraphine has taken a warm and very personal interest in five unimportant recruits.',
    body: `**The question.** [[Seraphine Ashe]] could court the Reeve, the captain, the bank. Why is she sending perfumed letters to the newest recruits?

**What the GM knows.** [[Ilyra of Halcyra]] speaks through her, and the Saint wants the PCs: they are the ones the flame is starting to notice, and a saint who becomes a god will need people who have stood close to a ward. The pull is real. Each PC who spends a night at [[The House of Unburnt Light]] wakes warm and rested and knowing exactly what they want, and it is always, a little, the Saint.

**Where the answer lies.** [[A Perfumed Letter]]; [[Sorrel Vey]], who knows the Saint's methods because they're her goddess's methods, done badly; [[The Church of the Unburnt Saint]]'s clock.

**Payoff.** Session 4, and again in session 8, when the Saint's priests urge the crack.`,
    relations: [{ to: 'seraphine-ashe', kind: 'concerns' }, { to: 'f-church-saint', kind: 'concerns' }],
    tags: ['mystery'],
  },
  {
    key: 't-reeve-charter',
    type: 'thread',
    name: 'What has the Reeve signed?',
    threadStatus: 'open',
    threadUrgency: 'low',
    raisedIn: 3,
    summary: 'Odile Fairweather keeps a locked letter-case and visits the counting-house after dark.',
    body: `**The question.** [[Odile Fairweather]] is visiting [[Tollamund & Daughters]] late at night. What is the town's Reeve buying, or selling?

**What the GM knows.** The town's charter. She has quietly agreed to sell it to [[The Concord Houses]] the day the company stands down, so that Cinderford has a master who pays its bills. She thinks it's the only way the town outlives the company. She might be right.

**Where the answer lies.** Her letter-case; Tollamund, who never lies but answers only the question asked; the bank's daughters, who are four hundred years younger and gossip.

**Payoff.** Session 7, when the Concord calls in its debt and the Reeve has to stand on one side or the other.`,
    relations: [{ to: 'odile-fairweather', kind: 'concerns' }, { to: 'f-concord-houses', kind: 'concerns' }],
    tags: ['npc thread'],
  },
]

const HANDOUTS: ExPage[] = [
  {
    key: 'h-pay-notice',
    type: 'lore',
    name: 'Pay Notice',
    image: 'handout:h-pay-notice',
    tags: ['handout'],
    summary: 'The Regency’s quarterly pay notice to the Ninth Lantern. The sum is 0 silver.',
    fields: [
      { key: 'Show in', value: 'Session 1, scene 1 (the muster)', gm: true },
      { key: 'Format', value: 'One sheet, wax seal, folded in three' },
    ],
    body: `**THE REGENCY OF ARDITH**
**Office of Martial Disbursement, Caer Ardith**
*Ledger of the Ninth Year of the Treaty, Third Quarter*

**NOTICE OF QUARTERLY REMITTANCE**

To: The Captain or Ranking Officer, the Company of the Ninth Lantern, garrisoned at Cinderford in the March of Cinders, under the Treaty of Ashes (Article XIV, Clause the Second).

Be it known that the Council of the Regency, in its continuing care for the soldiers of the Treaty, has reviewed the remittance due to your Company for the quarter ending the last day of Reaping, 3011 AW, and has set that remittance as follows:

| | |
|---|---|
| Wages of the Ranks (one hundred and thirty-eight souls) | **0 silver** |
| Wages of Officers (four) | **0 silver** |
| Allowance for Fodder, Lamp-oil and Sundries | **0 silver** |
| Arrears of Previous Quarters, Brought Forward | *deferred* |
| **Total Remitted** | **0 silver** |

The Council thanks the Company for its loyal service and reminds the Captain that a receipt for the above sum is to be signed, witnessed and returned within ten days of delivery, by the same post, on Form 7-R.

*Signed for the Office,*
*E. Haverleigh, Disbursing Clerk (Third Grade)*

*Under seal of the Regent-Chancellor*

---

*(In the margin, in a different and much angrier hand:)* RECEIPT FOR WHAT

:::gm
**When to show it.** At the muster in session 1, when Captain Marrow reads it out. Hand it round the table. Let the zeros sink in.

**What it reveals.** The Regency has formally paid nothing, and has done it in writing, so the company can't claim it was lost on the road. The angry marginal note is Marrow's own, from when she first opened it. Sharp eyes (Investigation DC 12) notice the seal is genuine and the paper is new, but the date of dispatch is three weeks old: the notice was sent long before the pay wagon set out. So whatever the wagon was carrying, it wasn't Regency coin. That's the first clue toward [[Grandmother Tollamund]] and session 2.
:::`,
  },
  {
    key: 'h-tax-notice',
    type: 'lore',
    name: 'Tax Notice, in Triplicate',
    image: 'handout:h-tax-notice',
    tags: ['handout'],
    summary: 'The Regency taxes the company it doesn’t pay. Three copies, one in blue.',
    fields: [
      { key: 'Show in', value: 'Session 2, when Pell Quillon arrives', gm: true },
      { key: 'Format', value: 'Three sheets, white, buff and blue, pinned together' },
    ],
    body: `**THE REGENCY OF ARDITH**
**Office of the Assessor for the March of Cinders**
*Fourth Assistant Under-Collector, P. Quillon, presiding*

*COPY THE FIRST (WHITE): to be retained by the Assessed*
*COPY THE SECOND (BUFF): to be returned to the Assessor*
*COPY THE THIRD (BLUE): to be returned to the Assessor by a different route, in case of the loss of Copy the Second*

**NOTICE OF ASSESSMENT AND DEMAND**

WHEREAS the Company of the Ninth Lantern (hereinafter *the Assessed*) has been in receipt of wages from the Regency for the period 3009 to 3011 AW inclusive;

AND WHEREAS the Assessed has not, during the said period, rendered to the Regency the Hearth Levy, the Garrison Tithe, the Tax on Lamps and Lights (Burning), or the Fee for the Assessment of Fees;

AND WHEREAS it is no defence that the wages were not, in point of fact, received, the Regency having recorded their *intended remittance* in good faith, and intention being, under the Ordinance of 2911, equivalent to remittance for all purposes of taxation;

NOW THEREFORE the Assessed is required to pay:

| | |
|---|---|
| Hearth Levy, at one part in ten of wages intended | 418 silver |
| Garrison Tithe | 209 silver |
| Tax on Lamps and Lights (Burning), one lamp, nine years, continuously | 3,285 silver |
| Fee for the Assessment of Fees | 12 silver |
| Fee for the Preparation of this Notice, in Triplicate | 3 silver |
| **Total Demanded** | **3,927 silver** |

Payment is due within thirty days. The Assessed may dispute this Notice by Form 9-K (Declaration of Wages Owed But Not Payable, Countersigned), which the Assessor regrets is at present unavailable.

*The Regency thanks the Assessed for its cooperation and wishes it a long and well-documented life.*

*P. Quillon, F.A.U.C.*
*(and witnessed, A. Mote, Clerk)*

:::gm
**When to show it.** Session 2's strong start, when [[Pell Quillon]] nails it to the Keep gate (apologising to the gate as he does). Give the players all three copies if you can print them; one in blue ink is the joke.

**What it reveals.** That the Regency is taxing a company it hasn't paid: comedy, but also the Quiet Office's lever, since an unpaid tax bill gives the Regency legal grounds to seize "the property of the Assessed", which means the lantern. Note the witness: A. Mote. Compare his signature with the hand on [[Wanted: Dannic Rook]] (Investigation DC 13): it's the same small, neat hand. Also note the reference to Form 9-K, which sets up [[The Assessor's Lost Form]].
:::`,
  },
  {
    key: 'h-wanted',
    type: 'lore',
    name: 'Wanted: Dannic Rook',
    image: 'handout:h-wanted',
    tags: ['handout'],
    summary: 'A wanted poster for a deserter. It says he was seen alive five days after he drowned.',
    fields: [
      { key: 'Show in', value: 'Session 1, scene 2 (the Last Candle) or scene 4', gm: true },
      { key: 'Format', value: 'Cheap press print, nailed up with a horseshoe nail' },
    ],
    body: `### WANTED
**for DESERTION and THEFT of COMPANY STORES**

### DANNIC ROOK

*late of the Company of the Ninth Lantern, Second File*

Human, about thirty years. Middling height, thin, sandy hair worn short. A burn scar on the back of the left hand in the shape of a key. Missing the lobe of the right ear. Speaks with a Fallowden accent and **laughs too much when nervous**.

The said Rook absented himself from the Lantern Keep without leave on the night of the 7th Ashfall, taking with him **two tins of lamp-oil** and **one company blanket (grey)**.

He was **last seen on the Low Quay at Cinderford on the 12th Ashfall**, attempting to buy passage downriver.

A REWARD of **TEN SILVER** is offered for information leading to his return, alive, to the Assessor's Office, Ford Street, Cinderford.

*Given under the hand of the Assessor's Office this 13th day of Ashfall, 3011 AW.*

*By order. A.M.*

---

*(Scrawled underneath in charcoal by someone at the Last Candle:)* 10 silver?? the Regency's got 10 silver?? *(and below that, in another hand:)* owes me 4

:::gm
**When to show it.** Session 1, at [[The Last Candle]] (it's nailed beside the bar), or after the drowned man rises, when someone remembers the poster.

**What it reveals.** The poster was issued on the 13th and claims a sighting on the 12th. Dannic has clearly been in the water about a week: bloated, grey, eels in his coat. Quorl or anyone with Medicine DC 11 confirms he died around the 7th. So someone invented the sighting. "A.M." is [[Ansel Mote]], who came to town ahead of the Assessor to "set the office in order". He wanted the company to blame a living runaway, not look for a body. The poster's reward for return *alive* is a nice touch of his: it costs nothing to offer.

The burn scar shaped like a key is a match for [[Hathe's Door-Key]]: Dannic was raised by the Ravelers, then ran from them. A thread for Quorl, if you want it.
:::`,
  },
  {
    key: 'h-letter',
    type: 'lore',
    name: 'A Perfumed Letter',
    image: 'handout:h-letter',
    tags: ['handout'],
    summary: 'Sister Seraphine’s invitation to the House of Unburnt Light. It smells of warm resin and rain.',
    fields: [
      { key: 'Show in', value: 'Session 4, strong start', gm: true },
      { key: 'Format', value: 'Cream paper, a single pressed ember-flower, sealed in red wax with a small open hand' },
    ],
    body: `*To the five who keep the Lantern's watch,*

Forgive a stranger for writing to you so plainly. I have watched you on the hill at night, standing in the light of that little flame as if it were the only warm thing in the world. Perhaps it is. It is a cold country, the Ashenreach. I know what it is to stand in the cold for someone else's sake, and to be thanked with ash.

You need not stand in the cold tonight.

Come to the House of Unburnt Light at the hour after the bell. There will be wine from the slopes above Halcyra, which does not travel and which I have carried a long way. There will be a fire that asks nothing of you. There will be bread, and baths, and soft voices, and nobody will hand you a form.

I would like to speak with you about the Lantern. Not to take anything. Only to understand what you carry, and whether you might let us help carry it. The Saint has a particular fondness for those who keep a light burning against the dark; she was such a one herself, once, on the night it mattered most.

Come as you are. Stay as long as you like. Leave when you wish, if you wish.

I will be waiting, and I am a patient woman, though not, I confess, endlessly so.

*With warmth, and in her light,*
*Seraphine Ashe*
*Envoy of the Unburnt Saint to the March of Cinders*

*P.S. The door on the garden side is never locked.*

:::gm
**When to show it.** The opening of session 4. Better still, have it arrive by a child messenger who waits for an answer and is very hard to say no to.

**What it reveals.** That [[Seraphine Ashe]] knows exactly who the party are and where they stand at night. "Not to take anything" is the lie: the church wants the flame carried to Halcyra, where the Saint can drink it. The letter is honest about everything else: the wine is extraordinary, the baths are real, nobody hands anyone a form. That's what makes it dangerous.

Anyone who reads it aloud feels warm for a moment, as if someone stood close behind them. A PC with a tie to fire or desire (or Ysse, whose flame-sense is sharp) notices the warmth is coming *from the paper* (Arcana DC 13). The perfume is a faint charm: Wisdom save DC 12 or the reader wants, quite badly, to go.

The postscript is literal. The garden door is never locked, which matters if the party wants to come back later, uninvited.
:::`,
  },
  {
    key: 'h-map-scrap',
    type: 'item',
    name: "A Glasser's Chart",
    image: 'handout:h-map-scrap',
    tags: ['handout'],
    summary: 'A salvage-gang’s chart of the Rent, on stitched hide, with notes no surveyor would write.',
    fields: [
      { key: 'Show in', value: 'Session 2 (traded by Vexa Glassjaw) or session 6', gm: true },
      { key: 'Format', value: 'Hide, two pieces stitched together, charcoal and red ochre' },
      { key: 'Value', value: 'Priceless to anyone going into the Rent; 5 silver to anyone else' },
    ],
    body: `*(A rough chart on stitched hide. North is marked with a crude drawing of a stone leaning over. The Rent runs down the middle like a scar, with notes scrawled along both sides in charcoal.)*

**NORTH LIP**: *THE STONE. dont touch it. dont sleep near it. Hask touched it and now he wont stop SINGING*

**Rope Steps**: *good rope. old company rope. 300 ft down to the first ledge. Count the steps they lie*

**The Glass Stair**: *fused glass, slippy as a priest. Walk the RED bits not the clear bits. Clear bits are thin*

**Halfway Ledge**: *camp here. fire ok. NO MAGIC down here not even a little, it goes into the walls and the walls go COLD*

**The Choir** *(an arrow pointing to a side cleft)*: *voices. NOT ours. Do not answer them even if they say your name. ESPECIALLY then*

**Ninth Lantern's Bones** *(a cluster of crosses)*: *soldiers from Cinders, fell in on the night. Good boots. Leave the boots*

**The Cold Seam** *(drawn in red, running along the bottom of the Rent)*: *dont dig here. Brakk dug here. no Brakk*

**THE OLD MAN** *(a little drawing of a seated figure near the stone, half-coloured grey)*: *he is still alive. he asked us for something. we said no. he said he would wait*

*(In the corner, in a different, neater hand, in red ochre:)* Vexa, this is the last time. I'm not going back. -P

:::gm
**When to show it.** [[Vexa Glassjaw]] trades it in session 2 at [[Fort Mercy]] (for the pay strongbox, or for help reading the Lithic writing she found). If the party doesn't get it there, it turns up in [[Gutter Market]] in session 5, at four times the price.

**What it reveals.** A usable route into [[The Rent]] for session 6: rope steps, the glass stair, a safe camp, and the dangers (the Choir is where the Sleeper's leak speaks; the Cold Seam is the crack itself). "No magic down here" is good advice: spells cast in the Rent drain the ward and chill the walls (see [[Magic and Its Cost]]). "The old man" is [[Warden Uthrem]], who asked the Glassers to bring him a Lithic or a lamp-keeper, and has been waiting since.

Following the chart gives advantage on checks to navigate the descent in session 6, and lets the party skip one of the three descent hazards.
:::`,
  },
  {
    key: 'h-rubbing',
    type: 'lore',
    name: 'A Rubbing from the Ninth Stone',
    image: 'handout:h-rubbing',
    tags: ['handout'],
    summary: 'Charcoal on linen, taken from the cracked face of the Ninth Stone. Half of it is legible. Half of it is worse.',
    fields: [
      { key: 'Show in', value: 'Session 6, at the Ninth Stone', gm: true },
      { key: 'Format', value: 'Linen, charcoal rubbing, smudged; Lithic script with a scholar’s translation pencilled beside it' },
    ],
    body: `*(A charcoal rubbing on a strip of linen. The marks are deep, angular Lithic letters. Where the stone is cracked, the rubbing breaks into a black smear. Beside the legible lines, someone has pencilled a translation.)*

> HERE STANDS THE NINTH, WHO WAS ██████, CHILD OF THE STONE-UNDER
> WHO SWORE WITH EIGHT AND KEPT IT
> WE KILLED THE ███ THAT DREAMED US
> WE COULD NOT KILL ███ ALL THE WAY
> SO WE ARE THE LID AND THE LOCK
> AND THE LOCK MUST HAVE A ████ THAT BEATS

> IF THE LOCK IS BROKEN
> █████████ CARRY THE FLAME TO THE ████
> IT WILL KNOW ITS OWN STONE
> GIVE IT A HEART THAT CHOOSES
> NOT A HEART THAT IS TAKEN
> A TAKEN HEART ████ ROT

> DO NOT LISTEN WHEN IT ASKS TO BE KEPT
> IT IS NOT ████ ASKING
> ██████████████████████
> ████ IS ASKING

*(Pencilled at the bottom, in a small, slanting hand:)* The name on the first line has been chiselled out. Not weathered. Chiselled. Someone wanted it forgotten more than they wanted the warning read.

:::gm
**When to show it.** Session 6, at [[The Ninth Stone]]. Whoever takes the rubbing (Ysse is the natural choice) can read the Lithic with [[Warden Uthrem]]'s help, or with Arcana or History DC 15 and an hour's work.

**What it reveals.** The heart of the endings. "The lamp is the lock" in the Nine's own words. To reseal the ward, carry the flame back to the stone and give it **a heart that chooses**: a willing one, not a sacrifice taken by force (see [[Ending: Reseal the Ward]]). "Do not listen when it asks to be kept": the Sleeper, wearing the Ninth's voice, will ask whoever holds the flame to keep it (see [[Ending: Use It]]).

The erased name is the Ninth's true name, struck from memory by the gods. The last smeared line, if fully restored (only possible with the Rook-Court's ledger or Sorrel Vey's tattoos to cross-check), reads: **"IT IS NOT THE NINTH ASKING. THE ONE BELOW IS ASKING."**
:::`,
  },
]

const ENDINGS: ExPage[] = [
  {
    key: 'end-reseal',
    type: 'lore',
    name: 'Ending: Reseal the Ward',
    summary: 'The intended, hardest road: carry the flame to the Ninth Stone and give the ward a living heart.',
    fields: [
      { key: 'Session', value: '8' },
      { key: 'Cost', value: 'A willing heart, and the company itself' },
    ],
    body: `### How it plays out on the night
Under the full red moon the party carries [[The Lantern of the Ninth]] down [[The Rent]] to [[The Ninth Stone]]. Nobody makes it easy. Run the night as a gauntlet of at least four challenges, each one costing something:

1. **The descent under pursuit.** Whichever factions the party has crossed come after the lantern: Quiet Office knives in the rope steps, Sallow's mutineers if the mutiny wasn't broken, Glassers who think the flame is worth more than their lives.
2. **The Choir.** The Sleeper's leak speaks in the voices of the party's dead. Every PC hears someone they've lost. Wisdom saves, and good roleplay, to keep walking.
3. **The priests at the lip.** [[Seraphine Ashe]] and priests of three or four gods are waiting, and each of them has a reason the party should stop (see [[Ending: Let It Crack]]). Some of them are very persuasive. One of them is a friend.
4. **The stone itself.** The flame must be set back into the crack where the shard came from, and the ward needs a heart: a living, willing one. [[Warden Uthrem]] offers first, but he's nearly spent and it may not hold. A PC can choose. [[Ysse Lampwright]] is the one the flame has been calling. The rubbing's warning matters: a heart that is *taken* rots, so nobody can be pushed in.

When the heart is given, the crack closes with a sound like a held breath let go. The Ember dims to a dull, sullen copper. The lantern on Lantern Hill, two days' ride away, goes out.

### Who pushes for it
Almost nobody, and that's the point. [[Warden Uthrem]] and [[The Last Wardens]] want it. [[Grashka]] and [[The Mothers of the Iron]] want it, and may send help if Varra asks (it is the same choice Grashka made in 2981, and she'll say so). [[Brother Tallow]] wants it and is ashamed of how much he wants it not to be Ysse. [[Mother Corvane]] supports it once the ledger is read: "The lamp is the lock. You do not sell a lock."

### Consequences
- **The Ninth Lantern.** By contract, when the lantern goes out, the company stands down. It's over. Captain Marrow reads the clause aloud and nobody laughs. What they do next (re-form under a new name, go home, stay as townsfolk) is a scene for the epilogue.
- **Cinderford.** Without a garrison, the town is open. If the Reeve's charter sale went through, the Concord owns it by spring. If it didn't, the town has to decide who it is.
- **The Church of the Unburnt Saint.** Denied the leak, Ilyra's ascent stalls. Her church does not forgive. Seraphine is recalled, or stays and becomes something sadder.
- **The Quiet Office and the Regency.** Furious, and blind: the ward's power is gone where they can't reach it. [[Marius Vell]] needs a new plan for his puppet emperor.
- **The Concord.** Tollamund's collateral is a cold lamp. She takes it anyway. She is patient.
- **The Sleeper.** Its world clock drops by three segments. It is not dead. It is never dead. But it sleeps deeper.
- **The PCs.** Whoever became the heart is gone, or rather, is now standing in the stone, awake, for a very long time. Their player should write the words that get carved on the stone.

### Hooks for a second arc
The Ninth is sealed, for now. The Eighth Ward under the Grimmark is breached, and whatever wears Borrin's shadow came from there. The Fourth Ward in Sael is weak, and [[Aelith Sorn]] now knows how a ward is resealed. And the gods, who wanted the crack, have lost: some of them will take that personally.`,
    gmNotes: `This ending should feel earned and expensive. Don't let it be the obvious right answer handed over by an NPC: let the party find the rubbing, read it, argue about it. If no PC volunteers and Uthrem goes in alone, roll a d6 at the end of the epilogue: on a 1-2, the seal holds only a year.`,
    tags: ['ending'],
  },
  {
    key: 'end-crack',
    type: 'lore',
    name: 'Ending: Let It Crack',
    summary: 'Let the flame die and the ward break: the dead walk, the Saint drinks the leak, and the gods come hunting.',
    fields: [
      { key: 'Session', value: '8' },
      { key: 'Cost', value: 'The Ashenreach, and possibly everything west of it' },
    ],
    body: `### How it plays out on the night
The easiest ending: the party need only do nothing, or something small. Tip the lantern. Let the oil run out. Walk away. Under the full red moon the crack in the Ninth Ward widens with a sound like ice on a river in spring. Cold pours out of [[The Rent]]. The flame on Lantern Hill doesn't gutter this time. It goes straight out.

Then the dead of Cinders stand up. All of them. Every soldier buried in the ash plain, every deserter in the glass, every cook and camp-follower who died the night of the battle. They don't attack, at first. They walk toward the town, because it's where they were going when they died.

And far to the east, in Halcyra, a woman who walked out of a fire unburnt lifts her face and breathes in.

### Who pushes for it
**The pantheon's priests, from every direction at once, for every reason but the same one.** Run them as a crowd at the lip of the Rent, all talking, none agreeing:
- [[Seraphine Ashe]] for [[The Unburnt Saint]]: "Let her drink it. She will be merciful. She was one of us." She believes it. Ilyra may even mean it.
- A priest of [[Aurelan]]: the old empire needs an emperor, and a god freed to act can crown one. Any one.
- A priest of [[Corvex]], with an audit: the Nine broke an oath to the gods (the gods' claim on Ysmereth), and a broken oath is theft. Opening the ward is "settling an account".
- A sweating, sincere priest of [[Grum]]: "The gods are going to eat a god. That's a war. I want to be on the winning side of it."
- [[Isaurana|Isaurana's]] priests do not argue in public. They whisper to each PC privately, about the thing each of them wants most, and how it could be had in a world where the gods are stronger.
- Even a frightened priest of [[Maelis]], who simply wants the dreams to stop, and has been told this will stop them.

What none of them say aloud: the gods could never reach the Sleeper under mortal wards. A crack lets them in to devour it. The mortals in between are an acceptable price.

### Consequences
- **The Ashenreach** becomes a land of the walking dead within a month. Cinderford is evacuated, or isn't.
- **The Ninth Lantern** stands down by contract (the lantern went out). Most of them stay and fight anyway, because their own dead are walking.
- **The Church of the Unburnt Saint.** Ilyra drinks the leak and ascends to full godhood within the year. Iskaveth marches west across the Saint's Spine "to bring mercy to the dead lands". It will feel like mercy. It will also be a conquest.
- **The gods** feed. The Sleeper's world clock fills to its last segment and stops ticking: the gods are inside the ward now, and the thing under the land is screaming in a way only the Hollowborn can hear.
- **The Hollowborn** all wake on the same night, weeping. [[The Sleepless]] are ecstatic, then horrified: this isn't the waking they wanted.
- **The PCs** are heroes to the church, traitors to the Mothers, and very interesting to every god. Each gets a divine offer by the next new moon.

### Hooks for a second arc
A war of gods fought over a corpse, with mortals as the ground it's fought on. What happens when a god dies twice? And the gods have now learned that wards can break; the Eighth and Fourth are already weak.`,
    gmNotes: `Play the priests as genuinely varied and genuinely tempting, not as moustache-twirlers. "Many agendas, many moving parts" is the brief: each god's priest wants the crack open for a different reason and they work at cross purposes, sometimes sabotaging each other in the same breath. If the party is wavering, let two priests argue so badly that one of them gives the truth away by accident.`,
    tags: ['ending'],
  },
  {
    key: 'end-use',
    type: 'lore',
    name: 'Ending: Use It',
    summary: 'Take the flame: hold the leash on a buried god. The Sleeper wants this, and hides it.',
    fields: [
      { key: 'Session', value: '8' },
      { key: 'Cost', value: 'Slowly, the holder' },
    ],
    body: `### How it plays out on the night
The party, or a faction they back, takes the flame and keeps it. Not resealed. Not let go. *Held.* Whoever carries [[The Lantern of the Ninth]] holds the crack shut by will alone, and finds, standing at the Ninth Stone under the red moon, that they can open it a little, too. Just a little. Enough to feel what's below. Enough to draw on it.

It feels wonderful. It feels like being the only warm thing in a cold country.

Whoever holds it (a PC, the company, a faction leader) can do terrible, useful things with it: make the dead of Cinders walk or lie down; make a ward-sensitive bloodline hear what they say; threaten to open the crack unless the Regency, the Concord and Iskaveth all pay what they owe. Kingmakers. And targets.

### Who pushes for it, and how
- **[[The Sleeper Below]], secretly.** This is the ending it wants, and it hides that well. Through Ysse's dreams it has been saying "keep me" in the Ninth's warm voice for seven sessions. On the night it speaks through the flame directly, sounding reasonable, sounding kind: why give your life to a stone? Why let the gods feed? Keep the lamp. Be the lock. Be the key.
- **[[The Quiet Office]]** for [[Marius Vell]]: he wants the flame in Caer Ardith beside an empty throne, and a puppet emperor who hears what he's told.
- **[[The Concord Houses]]**: [[Grandmother Tollamund]] calls in the debt with the lantern as collateral, and very slowly explains that the Shellbacks would keep it safe. She wants it as the key home to the Ness of Thurm, and she doesn't say why.
- **[[Garrick Sallow]]**, if alive: "We hold it. The company. Nobody pays us? Now they pay us."
- **[[Aelith Sorn]]** and [[The Remembrancers]], who want to study it, which is how it starts.

### Consequences
- **The holder** begins to hear the Sleeper, more each red moon. First as dreams, then as a second voice in their own thoughts, then as their thoughts. Within a few years they become its voice. Give the player a sealed note at the end: one sentence that their character now believes, that they didn't before.
- **The Ninth Lantern** never stands down (the lantern never went out). It becomes the most powerful company in Vael Ardith, and the most hated.
- **The factions.** Whoever doesn't hold the flame wants it: Regency assassins, Concord lawyers, Iskavethi crusaders, all at once. Cinderford becomes the most important town on the continent, which is the worst thing that can happen to a town.
- **The pantheon** can't reach the Sleeper and can't reach the holder. They begin working through mortals instead, more openly than they have in a thousand years.
- **The Sleeper's clock** doesn't fill. It doesn't need to. It has someone to speak for it now.

### Hooks for a second arc
Being the most powerful people in the world, and the most hunted. Watching a friend become the Sleeper's voice, and deciding when to stop them. Discovering that the Shellbacks left the Ness of Thurm because of something just like this.`,
    gmNotes: `The Sleeper wants this ending and must never say so plainly. Every argument it makes is true. That's the horror. If a PC holds the flame, the change is slow: an opinion here, a dream there. Let them be heroes for a while first.`,
    tags: ['ending'],
  },
]

const EVENTS: ExPage[] = [
  {
    key: 'ev-pay-doesnt-come',
    type: 'event',
    name: "The Pay Doesn't Come",
    age: 'campaign',
    when: { year: 3011, month: 9, day: 14 },
    date: '14 Ashfall 3011 AW, morning',
    parent: 'lantern-hill',
    summary: 'At the morning muster, Captain Marrow reads the quarter’s pay notice. It says 0 silver.',
    body: `At the morning muster on [[Lantern Hill]], [[Ilse Marrow|Captain Marrow]] read the Regency's [[Pay Notice]] to the assembled company. The total was 0 silver. The pay wagon that should have followed it had not arrived.

[[Garrick Sallow]] said what half the company was thinking. [[Mirrel Vosk|Sergeant Vosk]] said something rude enough to make the other half laugh. Nobody was paid.

:::gm
The day the campaign begins. The company's Mutiny clock starts at 2 of 6.
:::`,
    relations: [{ to: 'q-payday', kind: 'begins', known: true }],
  },
  {
    key: 'ev-drowned-man-rises',
    type: 'event',
    name: 'The Drowned Man Rises',
    age: 'campaign',
    when: { year: 3011, month: 9, day: 14 },
    date: '14 Ashfall 3011 AW, noon',
    parent: 'the-ford',
    summary: 'The ford-watch hooks the deserter Dannic Rook out of the river, and he stands up.',
    body: `The Treaty Bell rang at noon. The ford-watch had hooked a body from the shallows below the toll bridge: [[Dannic Rook]], a week gone from the company. He stood up on the bank, and so did two others nobody recognised.

:::gm
See [[The Drowned Man]]. Dannic's last words: "It's cold under the glass."
:::`,
    relations: [{ to: 'q-drowned-man', kind: 'begins', known: true }],
  },
  {
    key: 'ev-lantern-gutters-first',
    type: 'event',
    name: 'The Lantern Gutters for the First Time',
    age: 'campaign',
    when: { year: 3011, month: 9, day: 15 },
    date: '15 Ashfall 3011 AW, just after midnight',
    parent: 'lantern-keep',
    summary: 'For the first time in nine years, the flame of the Ninth Lantern shrinks to a blue bead and nearly dies.',
    body: `A little after midnight, with the whole company awake and watching, the flame in its iron cage on [[Lantern Hill]] shrank to a bead of blue no bigger than a fingernail. For the length of a long breath it seemed to go out. Then it came back.

Nobody spoke. [[Spoons Aldane|Spoons]] was seen closing his betting book very slowly. [[Brother Tallow]] did not leave the cage until dawn.

:::gm
The end of session 1. The Mutiny clock ticks to 3. Sleeper clock unchanged (that ticks at the red moon, two nights later).
:::`,
    relations: [
      { to: 'item-lantern', kind: 'concerns', known: true },
      { to: 'q-poisoned-flame', kind: 'begins', known: true },
    ],
  },
]

const GUIDES: ExPage[] = [
  {
    key: 'guide-start',
    type: 'custom',
    name: 'Start Here',
    summary: 'A friendly tour of Vael Ardith and of the app: what this world is, how to run it tonight, and where to see every feature.',
    body: `Welcome. This is **Vael Ardith**, a complete example world that ships with The Warded Atlas. Read it, borrow from it, take it apart, or run it for your group next week. Nothing here can break: World settings can reset the example to new.

### What this world is
A continent held shut by nine ancient wards, with a dead god buried under it. Nine years ago a war ended in fire at [[Cinderford]], the Ninth Ward cracked, and a ragged mercenary company lit a lantern that has never gone out since. The players are new recruits and locals in that company, [[The Ninth Lantern]], on the day the pay doesn't come.

It's grim and funny in about equal parts: real stakes and hard choices, soldiers' gallows humour, and a Regency that still sends tax forms to the front in triplicate.

### Run it in five minutes
1. Read [[The Lantern Gutters]], the main quest. Its GM section lays out the whole eight-session arc and how the clues connect.
2. Open **Prep**, then the campaign **The Lantern Gutters**, then **Session 1: Payday**. The notes are a full script with read-aloud text, and the prep has a strong start, seven scenes, clues and three fights ready to go.
3. Hand out the five characters: [[Varra Nine-Knuckles]], [[Ysse Lampwright]], [[Borrin Halt]], [[Tibbet Marlowe]] and [[Quorl Many-Words]].
4. Press **Run** to open the Lectern. Read the opening aloud. You're playing.

### A tour of the app, using this world
Each stop below is a real page or screen you can open now. The little **?** buttons next to headings explain any feature in a sentence or two.

**Secrets on a page.** Open [[Varra Nine-Knuckles]]. Some passages show a 🔒: those are GM-only and players never see them. Others are marked for one character: only Varra's player reads that she is the Kingslayer's granddaughter. Every PC page has one. [[Quorl Many-Words]] is a good second look.

**Places inside places.** [[The Lantern Keep]] sits inside [[Lantern Hill]], inside [[Cinderford]], inside [[The March of Cinders]], inside [[The Ashenreach]]. The sidebar opens down to wherever you are, and each place lists what's inside it.

**The relationship web.** [[Ilse Marrow]] loves [[Sorrel Vey]]; [[Garrick Sallow]] takes money from [[Ansel Mote]]. Open **World → Relationships** to see everyone at once, and drag them about. Links the players don't know about stay hidden from them.

**Alive, dead, missing.** [[Dannic Rook]] is marked dead (which doesn't stop him climbing out of the river). Status shows in lists, at the Lectern and on corkboards.

**Clocks.** [[The Ninth Lantern]] has a Mutiny clock; most factions have one. The big one is on [[The Sleeper Below]]: twelve slices, three filled, ticked at every full red moon. **Play → Clocks** shows them all.

**Loose threads.** **Prep → Loose threads** holds every mystery you've left dangling, like "Who is cutting the lantern oil?" and "Why does Borrin's shadow lag?". Each says what you know and when it pays off, and a thread that goes cold gets flagged.

**Random tables.** **Prep → Generators & tables** has tables for this world, like [[Ashenreach Encounters]] and [[Sleeper Dreams]]. Tables can roll dice and call other tables.

**Session prep and the Lectern.** Session 1 is fully prepped: a strong start, scenes and clues to tick off, and three fights. At the Lectern, "Run" on a fight adds everyone to initiative. The Lectern already knows the opening scene and who's at the muster.

**History in ages.** **World → Timeline** splits history into ages, from the myths before the count, through [[The Battle of Cinders]], to the campaign's own events, which start on 14 Ashfall.

**The calendar and two moons.** World settings holds this world's own calendar: twelve months, six-day weeks, and two moons. The pale one sets the rent. The red one, [[The Ember]], rose the night of Cinders, and when it's full the dead dream.

**Party loot.** **Play → Party loot** shows who carries what. Set "Carried by" on any item, like [[The Cut Oil Tin]], once the party finds it.

**The corkboard.** **Prep → Corkboards → "Who's poisoning the flame?"** has the suspects, the clues and red string between them. Drag things about. Rearranging it mid-mystery is half the fun.

**Safety tools.** **Play → Safety tools** has the lines and veils for this world. Agree them with your table before session 1; every player can read them and use the X-card.

**Templates.** Making an NPC or a place? Pick "From template: NPC (Vael Ardith style)" from the New menu and you get the headings this world uses, ready to fill.

**Handouts ready to show.** **Prep → Handouts** lists six letters, notices and charts under "Ready to show", like the [[Pay Notice]] and [[A Perfumed Letter]]. "Reveal and show" puts one on every player's screen at the right moment.

**Maps.** The atlas of Vael Ardith is coming in a later update. Meanwhile, **World → Maps** is where you can upload your own or draw one in the map builder.

**Preview as a player.** At the bottom of the sidebar, "Viewing as" switches to Player and shows exactly what your table sees: all the secrets vanish. Try it on [[Varra Nine-Knuckles]], then switch back.

### Make it yours
Rename people, cut factions, add your players' own characters. Your own worlds work exactly the same way. Have a good game, and keep the light on.`,
    gmNotes: `This page is GM only, like everything in the example until you reveal it. If you run the campaign for real, you can leave it here: players never see it.`,
    tags: ['guide'],
  },
]

const TEMPLATES: ExPage[] = [
  {
    key: 'tpl-npc',
    type: 'npc',
    name: 'NPC (Vael Ardith style)',
    template: true,
    summary: 'One line: who they are and what they want, as the party would put it.',
    fields: [
      { key: 'Ancestry', value: '' },
      { key: 'Role', value: '' },
      { key: 'Faction', value: '' },
      { key: 'Found at', value: '' },
      { key: 'Wants', value: '', gm: true },
      { key: '5e', value: 'CR -, AC -, HP - (SRD stat block, reskinned)', gm: true },
    ],
    body: `### First impression
What the party sees, hears and smells in the first ten seconds. One detail nobody forgets.

### What everyone knows
Their job, their reputation, the story the town tells about them.

### Voice
A phrase they say too often. How they stand. What they do with their hands.

### What they want from the party
Something concrete, this week.

:::gm
### The secret
What they're hiding, and who else knows.

### What changes
How they act if the party helps them, crosses them, or learns the secret.
:::`,
    gmNotes: `Voice, mannerisms and how to run them. Give every NPC a joke or a quirk as well as a secret: the grim lands better next to the funny.`,
    status: 'alive',
    tags: ['template'],
  },
  {
    key: 'tpl-location',
    type: 'location',
    name: 'Location (Vael Ardith style)',
    template: true,
    summary: 'One line: what this place is and why anyone goes there.',
    fields: [
      { key: 'Region', value: '' },
      { key: 'Population', value: '' },
      { key: 'Held by', value: '' },
      { key: 'Known for', value: '' },
      { key: 'Danger', value: '', gm: true },
    ],
    body: `### Arriving
> Read-aloud text: two or three short sentences. A sound, a smell, something moving.

### What's here
- A place to go inside.
- Someone to talk to.
- Something to do, buy or steal.

### Rumours
- Something true.
- Something half true.
- Something wrong but useful.

:::gm
### The truth
What lies under it, who really runs it, and what the party could find.

### If trouble starts
Who comes running, how fast, and how many.
:::`,
    gmNotes: `Set "Inside" (the parent) so the place sits in its town or region. Every place in Vael Ardith has a sensory hook and something to do.`,
    tags: ['template'],
  },
]

const S1_OPENING = `The bell on Lantern Hill rings once for muster, flat and cracked, the way it has every morning for nine years. Ash is coming down soft as the first snow of winter, settling on helmets and shoulders and the iron cage at the top of the hill, where a small flame burns behind the bars without a flicker.

A hundred and forty soldiers stand in the drill yard in four ragged files. Their boots have been mended with tent canvas. Their breath smokes. Somewhere at the back, a corporal is taking bets.

Captain Ilse Marrow walks out of the Keep with a letter in her hand. It has a Regency seal on it. She breaks it in front of everyone, reads it once, and then, very carefully, reads it again.

"Well," she says. "Good news. We've been paid."`

const S1_NOTES = `## Session 1: Payday
*Level 1. 14 Ashfall 3011 AW, two nights before the red moon is full. About four hours.*

**The shape of the night.** The pay doesn't come; the company mutters; a drowned deserter climbs out of the river; the party follows his trail under the ford into [[The Glass Barrow]] and finds [[The Cut Oil Tin]]; they come back up in time to watch the lantern gutter for the first time in nine years.

**Before you start.** Agree the safety tools with the table. Give each player their character page and let them read their own secret. Ask each player one question: *What did you spend your last silver on, and do you regret it?*

---

### Scene 1: The muster (Lantern Hill)
> The bell on Lantern Hill rings once for muster, flat and cracked, the way it has every morning for nine years. Ash is coming down soft as the first snow of winter, settling on helmets and shoulders and the iron cage at the top of the hill, where a small flame burns behind the bars without a flicker.
>
> A hundred and forty soldiers stand in the drill yard in four ragged files. Their boots have been mended with tent canvas. Their breath smokes. Somewhere at the back, a corporal is taking bets.
>
> Captain Ilse Marrow walks out of the Keep with a letter in her hand. It has a Regency seal on it. She breaks it in front of everyone, reads it once, and then, very carefully, reads it again.
>
> "Well," she says. "Good news. We've been paid."

Pause. Then she reads the total: **0 silver.** Hand round the [[Pay Notice]].

**Who's here and what they want.**
- [[Ilse Marrow|Captain Marrow]]: keep the company calm and together. "I was made captain by attrition. I was the last one who could count. So I've counted, and we are owed two years, and I am going to find out where it went."
- [[Mirrel Vosk|Sergeant Vosk]]: keep the recruits alive. He sizes up the PCs openly. "Five new faces. Lovely. I'll learn your names when you've lived a month." When the zero is read: "Don't worry, lads. Nothing's what we were paid last quarter too. At least they're consistent. And nine years to the day since Cinders, too. Somebody in Caer Ardith has a sense of occasion."
- [[Garrick Sallow|Lieutenant Sallow]]: plant the idea. Loud enough to carry: "Two years. And still we stand here guarding a candle for people who won't pay for the wick."
- [[Fennick Bottlebrook]]: worried, with his ledger clutched to his chest like a shield. Tells anyone who'll listen there's bread for nine days.
- [[Brother Tallow]]: old, near-blind Vesh at the lantern cage, antennae folded. Takes no notice of the money. Ysse's master: he asks her quietly whether the flame "looks right" to her. (It doesn't, quite. Ysse feels it thin, like a voice going hoarse.)

**Checks.**
- Insight DC 12 on Sallow: he isn't angry. He's *pleased*.
- Insight DC 14 on Marrow: she isn't surprised by the zero. She's been expecting it a long time.
- Perception DC 13: someone in the back file has a shadow that moves a beat after he does (Borrin). Only one soldier notices; he makes the sign against the evil eye and won't stand near him.
- Investigation DC 12 on the notice: genuine seal, but dispatched three weeks ago, long before the wagon left.

**How it goes wrong.** If a PC backs Sallow publicly, the company shouts and two files walk out. Tick the Mutiny clock (it starts at 2 of 6). If a PC backs Marrow well (Persuasion DC 13 or a good speech), the yard settles and Vosk gives that PC a nod they'll remember.

**Ending the scene.** Marrow dismisses the muster and asks the five new hands to "make themselves useful in town and keep their ears open". Vosk adds: "And keep out of the Last Candle." Everyone goes to the Last Candle.

---

### Scene 2: The Last Candle (mutiny brewing)
> The Last Candle is a long, low room that smells of wet wool, cheap ale and the pipe-smoke of men who can't afford pipe-weed. Every tab on the slate behind the bar is chalked in a different hand, and none of them has ever been rubbed out. Above the bar, beside a stuffed crow in a corporal's hat, someone has nailed up a fresh poster.

The poster is [[Wanted: Dannic Rook]]. Let the players read it (and the charcoal comments).

**Who's here.**
- [[Garrick Sallow]] buys a round for the whole room, with silver. The room cheers. He's working the tables: "Someone in Caer Ardith is eating our wages. I say we go and ask for them."
- [[Spoons Aldane]] in the corner with his book. He'll take bets on anything: who gets drunk first, whether Sallow gets a punch in the face by sundown, how long the pay stays missing. His big pool: **the night the lantern goes out**. "Forty to one, on any night this month. Some fool's put a fat stack on 'before the red moon's gone'. Won't say who. Book's private, friend."
- Tavern regulars (roll on [[Tavern Patrons]] and [[Last Candle Rumours]] as you like).

**Checks.**
- Investigation DC 12 on one of Sallow's coins: new Caer Ardith mint, this year's date. Nobody in the Ashenreach has seen new Regency silver in two years.
- Insight DC 13 on Spoons when the lantern pool comes up: he glances at Sallow, then away.
- Anyone who reads the poster carefully: Dannic left on the 7th, "last seen" on the 12th, poster made on the 13th. Remember that.

**What can happen.** A fight is close all scene. One of Sallow's cronies, a big man called Pruett, picks on the nearest recruit ("Fresh meat. Bet you'd sell the candle for a hot meal"). If it comes to fists, run it as a brawl: three rounds, unarmed, nobody dies, everyone gets a black eye. Sallow watches and does nothing. Vosk arrives in round three and ends it with one sentence.

**Ending the scene.** The Treaty Bell starts ringing down at the Ford: three short, then three short again. That means a body in the water.

---

### Scene 3: The drowned man (the Ford)
> The ford-watch are standing back from the riverbank in a ragged half-circle. One of them is being sick into the reeds. On the grey shingle lies a man in a company coat, swollen and pale, an eel still caught in his collar. His eyes are open. As you arrive, his fingers start to move in the ash, slowly, like someone feeling for a dropped coin in the dark.
>
> Then he sits up. Behind him, two more shapes rise out of the river.

This is [[Dannic Rook]], dead a week, and two nameless dead from the glass. Run **The drowned walk** (see Encounters). The ash-drowned walk toward the Keep, not toward the living: they fight only what gets in their way. Dannic is heading home.

**Checks.**
- Religion DC 12 (or Quorl automatically): the dead haven't passed through Hathe's door. Since Hathe died this happens, but rarely so fast and never three together. Something nearby is "letting the cold in".
- Medicine DC 11 on the body afterwards: drowned about a week ago. Bruises on both shoulders: someone held him under.
- Perception DC 12: his boots and coat are full of fine glass grit, the kind that only comes from the glasslands, or from under the ford.

**How it goes wrong.** If the party flees or is beaten, the drowned walk up the hill and the company kills them in the drill yard. Dannic's body is then burned by the Ravelers, and his last words are lost: let Quorl hear them in a dream that night instead.

---

### Scene 4: Last words and the way down (the Ford and the Low Quay)
When Dannic falls for the last time, he speaks. If Quorl is near, it's to him. Otherwise it's to whoever kneels by him.
> His jaw works, grinding grit. His voice comes up from somewhere much further down than his lungs. "It's cold," he says. "It's cold under the glass." Then he's only a dead man, and the river is only a river.

[[Quorl Many-Words]] records the words, as he records all last words. Tick's mother, [[Marla Marlowe]], is standing in the river beside the body, up to her knees, pointing downstream at the old stone culvert under the toll bridge. Only Tick sees her.

**Following the trail.**
- Survival DC 11: the current under the ford pulls into the culvert, an old imperial drain half-choked with glass. A body could go in. A body could come out again.
- [[Kettle Brindlewake]], on the [[The Low Quay|Low Quay]], knows exactly where the culvert goes. "Into the Barrow. The old town under the ford, the bit the fire turned to glass. Smugglers used it till the dead started sitting up in there." She'll guide the party to the drain mouth for nothing, and while she does, she'll offer them [[Kettle's Cargo]].
- Kettle also says, if asked about the poster: "The 12th? I was on the Quay all day the 12th. No Dannic. And I'd know. He owed me money."

**Optional.** If the party goes to the Keep first, Brother Tallow is uneasy: "Dannic took two tins of oil when he ran. Find them. Please. I'd like to know what he wanted with them." Fennick, asked about oil, gets shifty: his ledger shows twelve casks bought and twelve burned this quarter, which is about four too many (Investigation DC 13: the numbers are fiddled). He isn't the poisoner, but he looks guilty as sin.

---

### Scene 5: Into the Glass Barrow
> The culvert is waist-deep and black and colder than it should be. Twenty paces in, the brick walls turn to glass: a whole street fused by the fire of Cinders, the doorways still open, the shutters melted into curtains of grey and green. Your light goes into the walls and comes back wrong, a hundred little copies of you moving a beat behind. Somewhere ahead, glass ticks as if something is walking on it.

See [[The Glass Barrow]] for the rooms. Keep it to three or four spaces tonight: the flooded street, a glass chapel with its congregation fused to the pews, a collapsed bakery, and the cold stair down.

**Run Glass-spiders** (see Encounters) in the chapel or the bakery. They spin webs of glass thread that ring like bells when touched.

**Checks.**
- Stealth DC 12 to pass the chapel without waking the spiders. Perception DC 13 to spot their glass webs before walking into one (otherwise restrained, Strength DC 11 to break).
- Arcana DC 14 (Ysse has advantage): the glass is thin here, and something cold is breathing through it. Every spell cast in the Barrow makes frost bloom on the walls. Tell the players that, and let them worry.
- Borrin, in the glass reflections, can see his own shadow. It is looking at him.

---

### Scene 6: The cold room (the guardian in the dark)
> At the bottom of the stair is a round room of black glass, and it is cold enough that your breath hangs in front of you and doesn't fall. Frost feathers the walls. In the middle, sitting on an overturned barrel as though he's waiting for someone, is a soldier in armour that has fused to his body. On his chest, cast in the glass, is a lantern badge, and the lantern is dark.
>
> Behind him, wrapped in a grey company blanket, is a bundle. Beside it, two tins.

This is a captain of one of the eight companies whose lanterns went out at Cinders, still holding his post. Run **The guardian in the dark** (see Encounters). He says one thing before he stands: "Held. We held. Is it morning?"

**The weakness.** Fire lit with the company's own lantern oil burns him as if he were dry paper. If anyone thinks to soak a rag from Dannic's *good* tin and set a weapon alight (or Ysse lights anything with flame taken from the Lantern), the guardian loses his resistances. Let a sharp player work it out: hint with the way he flinches from their lamp.

**The find (after the fight).**
- **Two tins.** One is clean lantern oil. The other is [[The Cut Oil Tin]]: cloudy, grey, gritty. A third tin, empty, still smells of it. Dannic took good oil out and was putting cut oil in.
- **A purse.** Twelve new Caer Ardith silver, same mint as Sallow's round.
- **A scrap of paper** in Dannic's scrawl: "S. says one more swap and Im square. Then the clerk wants a word. Dont like the clerk."
- **The ash itself** (Nature or Survival DC 13 when examined in good light): fine and pale and smells of lake water. Locals know: only the ash at [[Stillwater]] smells like that.

When the party picks up the cut tin, everyone's breath stops smoking for a moment, as if the room has warmed. Then it's cold again.

**How it goes wrong.** If the guardian is too much, he doesn't pursue past the stair. The party can come back. But he'll have moved the tins.

---

### Scene 7: The lantern gutters (Lantern Hill)
The party climbs back up through the town at night. Lamps are lit. The Ember, two nights short of full, sits red and swollen over the Ashenreach. Then:
> Halfway up Lantern Hill, the light changes. It takes you a moment to understand why. It's the lantern. Up in its iron cage, the flame that has burned without a flicker for nine years is shrinking: yellow, then white, then a bead of blue no bigger than a fingernail.
>
> All over the hill, doors are opening. Soldiers in their shirts, barefoot in the ash, are coming out to look. Nobody says anything. In the cage, Brother Tallow has both hands around the glass, as if he could hold it up by himself.
>
> For the length of one long breath, the flame is gone.
>
> Then it comes back.

Give the players the moment. Then let the NPCs react:
- Spoons is seen very slowly closing his book.
- Sallow says, to no one, "Next time."
- Marrow finds the party: "What did you find down there?"
- Tallow, holding the cut tin, his antennae flat: "Someone has been feeding my flame ash." Hand them [[Who Is Poisoning the Flame?]].

Tick the Mutiny clock to 3. End the session on the image of a hundred and forty soldiers standing in the ash in their shirts, looking up.

---

### If you're running this as a one-shot
> **One-shot ending.** Skip the guttering as a cliffhanger. Instead, when the party returns with the tin, Sallow is at the cage with two cronies and a tin of cut oil, about to pour. Spoons, who has worked out that "the lantern goes out" means the company ends and so does his book, shouts a warning. Run a short, sharp fight in the cage (Sallow as a veteran, AC 15, HP 30; two cronies as bandits, AC 12, HP 11). If the party stops him, the flame gutters and recovers, Marrow arrests Sallow, and as they drag him off he laughs: "You think I'm the one paying for this?" Somewhere below, a mousy little clerk closes a window. End there.

### Loose ends to carry into session 2
The pay wagon (session 2 starts with the Assessor at the gate). Sallow's silver. The clerk Dannic didn't like. Spoons' pool. Fennick's fiddled ledger. The cold under the glass.`

const SESSION_1: ExSession = {
  number: 1,
  title: 'Payday',
  worldDate: { year: 3011, month: 9, day: 14 },
  notes: S1_NOTES,
  pages: [
    'q-lantern-gutters', 'q-payday', 'q-drowned-man', 'q-poisoned-flame', 'q-kettles-cargo',
    'h-pay-notice', 'h-wanted',
    'ilse-marrow', 'mirrel-vosk', 'brother-tallow', 'fennick', 'garrick-sallow', 'spoons', 'kettle', 'dannic-rook', 'marla-marlowe',
    'varra', 'ysse', 'borrin', 'tick', 'quorl',
    'lantern-hill', 'lantern-keep', 'last-candle', 'the-ford', 'low-quay', 'glass-barrow',
    'item-lantern', 'item-oil-tin', 'f-ninth-lantern',
  ],
  prep: {
    strongStart: S1_OPENING,
    scenes: [
      'The muster on Lantern Hill: Captain Marrow reads the pay notice. 0 silver. Sallow stirs; Vosk jokes; Tallow asks Ysse if the flame looks right.',
      'The Last Candle: Sallow buys a round with new silver; Spoons runs a pool on the lantern going out; the wanted poster; a brawl brews.',
      'The Treaty Bell rings: Dannic Rook climbs out of the ford with two other dead. Fight: the drowned walk.',
      'Last words ("It\'s cold under the glass"), Marla points at the culvert, Kettle guides them to the drain and offers her cargo job.',
      'Into the Glass Barrow: the flooded street, the fused chapel, glass webs. Fight: glass-spiders.',
      'The cold room: the guardian in the dark, Dannic\'s stash, the cut oil tin, the new silver, the note about S. and the clerk.',
      'Back up Lantern Hill at night: the lantern gutters for the first time in nine years. Tallow: "Someone has been feeding my flame ash."',
    ],
    clues: [
      'The pay notice was dispatched three weeks before the wagon left: the wagon wasn\'t carrying Regency coin.',
      'Sallow\'s silver is new Caer Ardith mint, this year\'s date. Nobody else has seen new Regency coin in two years.',
      'Someone has a big bet with Spoons on the lantern going out "before the red moon\'s gone". Spoons glances at Sallow.',
      'The wanted poster claims Dannic was seen on the 12th. He drowned around the 7th. Someone made up the sighting. It is signed A.M.',
      'Bruises on Dannic\'s shoulders: someone held him under.',
      'Dannic\'s last words: "It\'s cold under the glass."',
      'Dannic\'s note: "S. says one more swap and Im square. Then the clerk wants a word. Dont like the clerk."',
      'The ash in the cut oil smells of lake water: Stillwater ash.',
      'Fennick\'s oil ledger is fiddled (four casks too many burned). He looks guilty; he isn\'t the poisoner.',
      'Spells cast under the glass make frost bloom on the walls. Something cold breathes through the Barrow.',
    ],
    encounters: [
      {
        name: 'The drowned walk',
        notes: 'Ash-drowned (zombie, reskinned): grey, bloated, coughing ash. Slam +3, 1d6+1 bludgeoning. Undead Fortitude: dropped to 0 by anything but radiant or a critical hit, Con save DC 5 + damage taken to drop to 1 HP instead. Speed 20. They walk toward the Keep and fight only what blocks them. Dannic is the first to rise and the last to fall; when he does, he speaks.',
        foes: [
          { name: 'Dannic Rook (ash-drowned)', count: 1, hp: 22, ac: '8', side: 'foe', page: 'dannic-rook' },
          { name: 'Ash-drowned', count: 2, hp: 22, ac: '8', side: 'foe' },
        ],
      },
      {
        name: 'Glass-spiders',
        notes: 'Giant spider, scaled for level 1: glassy, fist-sized eyes, legs that chime. Bite +4, 1d6+2 piercing plus 1d6 poison (Con DC 11 for half). Web (recharge 5-6): +4 ranged, target restrained by ringing glass thread (Strength DC 11 or 10 damage to break). Spider Climb; Web Sense. Use 2 for a quick fight, 3 if the party is rested.',
        foes: [{ name: 'Glass-spider', count: 3, hp: 13, ac: '13', side: 'foe' }],
      },
      {
        name: 'The guardian in the dark',
        notes: 'Ash-wight (wight, scaled down): a lantern-captain of Cinders fused into his armour. Multiattack: two longsword attacks +4, 1d8+2 slashing; or one longsword and Life Drain +4, 1d6+2 necrotic (Con DC 13 or max HP reduced by the damage until a long rest). Resists necrotic, and nonmagical weapons, UNLESS the weapon is lit with the company\'s lantern oil or flame from the Lantern: then no resistances and he takes +1d6 fire. Flinches from the party\'s light (a hint). Does not pursue beyond the cold stair.',
        foes: [{ name: 'The guardian in the dark (ash-wight)', count: 1, hp: 30, ac: '14', side: 'foe' }],
      },
    ],
  },
  lectern: {
    scene: 'lantern-hill',
    sceneText: S1_OPENING,
    present: ['ilse-marrow', 'mirrel-vosk', 'fennick', 'garrick-sallow', 'brother-tallow'],
  },
}

const LATER_SESSIONS: ExSession[] = [
  {
    number: 2,
    title: 'The Assessor',
    worldDate: { year: 3011, month: 9, day: 15 },
    notes: `## Session 2: The Assessor
*Level 2. 15 Ashfall 3011 AW, the morning after the guttering. One night before the red moon is full.*

**Goal.** Find the missing pay wagon, and learn that the money in it was never the Regency's.

### Key scenes
1. **The Assessor at the gate.** [[Pell Quillon]] arrives at dawn with a writing-desk strapped to a mule and nails the [[Tax Notice, in Triplicate]] to the Keep gate, apologising to the gate. His clerk [[Ansel Mote]] holds the nails. Marrow, very calmly, asks the party to get the Assessor out of her sight before she does something the Regency would have a form for. Pell is earnest, kind and hopeless. He has lost Form 9-K and is near tears ([[The Assessor's Lost Form]]).
2. **Mote's hand.** Anyone who saw the wanted poster can compare it with Mote's signature as witness on the tax notice (Investigation DC 13): the same small neat hand. Mote, asked, says he copies whatever he's told to copy. Insight DC 15: he's not nervous at all, and he should be.
3. **The road east.** [[Kettle Brindlewake]] (if the party helped with her cargo) or a waystation keeper tells them the wagon turned off the road two days east, toward [[Fort Mercy]]. Tracking it across the ash: Survival DC 12, three successes before a greywind buries the ruts (roll on [[Greywind Weather]]). Failure means they arrive at dusk, tired, with a level of exhaustion.
4. **Fort Mercy.** An abandoned Regency fort, now a Glassers' den. [[Vexa Glassjaw]] runs it with a shovel she calls the Bishop. She has the strongbox, unopened, because "a box nobody comes looking for is a box with teeth". Negotiation, theft or a fight.
5. **The strongbox.** Inside: fresh Sevenhaven coin, stamped with the house-mark of [[Tollamund & Daughters]], and a loan-chit naming the Ninth Lantern as debtor for the full sum, at interest. The company owes money it never received.
6. **Vexa's writing.** Deep in the fort's cellars Vexa's diggers broke into old Lithic stonework with writing on it. She can't read it, and her diggers won't work the cold seam beside it. If Ysse or Borrin can read even a line, she trades [[A Glasser's Chart]] of the Rent for it.

### NPCs
[[Pell Quillon]], [[Ansel Mote]], [[Vexa Glassjaw]], [[Kettle Brindlewake]], [[Ilse Marrow]], [[Fennick Bottlebrook]].

### Encounters
- **Glasser toughs** (bandit, reskinned with glass-shard cudgels): AC 12, HP 11, scimitar +3 1d6+1. Four of them, plus Vexa (thug: AC 11, HP 32, two maces +4 1d6+2) if it goes badly.
- **Something in the cold seam** (ghoul, reskinned as a frost-blackened digger called Brakk): AC 12, HP 22, claws +4 2d4+2 plus Con DC 10 or paralysed for a minute (not elves or Returned). Only if the party goes into the seam.

### Clues revealed
The pay was Concord coin; Tollamund lent it in the company's name. Mote's hand is the poster's hand. The cold seam under Fort Mercy is the same cold as the Barrow. Vexa's Lithic writing names the Ninth Stone.

### Threads
Raises: what is the Assessor's clerk really writing, why is the Saint's envoy courting the party (Seraphine sends the party a basket of warm bread "for the soldiers who kept the light", no note). Ties: where did the pay wagon go.

### How it ends
The party brings the strongbox home. Fennick counts it twice and goes white: with the interest on the chit, the company now owes Tollamund more than it did yesterday. Marrow quietly tells the party she has been paying the company from her own purse for a year, and she's out. Overhead the Ember is one night from full. Tallow says: "Tomorrow. Stay close to the lantern tomorrow."`,
    pages: ['pell-quillon', 'ansel-mote', 'vexa-glassjaw', 'kettle', 'tollamund', 'fort-mercy', 'assessors-office', 'h-tax-notice', 'h-map-scrap', 'q-payday', 'q-assessors-form', 'f-glassers', 'f-concord-houses'],
    prep: {
      strongStart: 'Dawn. Hammering at the Keep gate. A small, pink, anxious man in Regency grey is nailing a notice to the door, saying "Sorry, so sorry" to the wood with every blow. His clerk holds the nails. The notice is in triplicate. It demands 3,927 silver from a company that was paid nothing yesterday.',
      scenes: [
        'Pell Quillon nails the tax notice to the gate; Marrow asks the party to deal with him; Pell has lost Form 9-K.',
        'Comparing Mote\'s signature with the wanted poster: the same hand.',
        'Tracking the wagon east across the ash before a greywind buries the ruts.',
        'Fort Mercy and Vexa Glassjaw: talk, sneak or fight for the strongbox.',
        'Opening the strongbox: Concord coin, Tollamund\'s mark, a loan-chit in the company\'s name.',
        'Vexa\'s Lithic writing in the cold seam; trading for the Glasser\'s chart.',
      ],
      clues: [
        'The pay in the wagon was Sevenhaven coin with the Tollamund house-mark, not Regency silver.',
        'A loan-chit names the Ninth Lantern as debtor for the full sum, at interest.',
        'Mote\'s witness signature matches the hand on the wanted poster.',
        'Pell\'s Form 9-K went missing the day Mote unpacked the office.',
        'Vexa\'s diggers won\'t work the cold seam: "Brakk dug there. No Brakk."',
        'The Lithic writing in the cellar names the Ninth Stone and the word "lock".',
        'Captain Marrow has paid the company from her own savings for a year, and is broke.',
      ],
      encounters: [
        {
          name: 'Glassers at Fort Mercy',
          notes: 'Bandits reskinned: glass-shard cudgels, ash-masks. Scimitar +3, 1d6+1. They break and run at half strength. Vexa (thug) joins if the fight goes past round three: Multiattack two maces +4, 1d6+2; Pack Tactics.',
          foes: [
            { name: 'Glasser tough', count: 4, hp: 11, ac: '12', side: 'foe' },
            { name: 'Vexa Glassjaw', count: 1, hp: 32, ac: '11', side: 'foe', page: 'vexa-glassjaw' },
          ],
        },
        {
          name: 'Brakk in the cold seam',
          notes: 'Ghoul reskinned as a frost-blackened digger. Claws +4, 2d4+2 slashing, Con DC 10 or paralysed for 1 minute (repeat each turn). Bite +2, 2d6+2. Only if the party goes into the seam.',
          foes: [{ name: 'Brakk (ghoul)', count: 1, hp: 22, ac: '12', side: 'foe' }],
        },
      ],
    },
  },
  {
    number: 3,
    title: 'Red Moon Rising',
    worldDate: { year: 3011, month: 9, day: 16 },
    notes: `## Session 3: Red Moon Rising
*Level 2. 16 Ashfall 3011 AW, the night the Ember is full. Tick the Sleeper's clock at the start.*

**Goal.** Keep the lantern lit through the worst night of the year, and meet the Sleepless face to face.

### Key scenes
1. **The dream.** Everyone wakes from the same dream at once: a vast warm dark, a voice saying "nearly", a door with no handle (roll on [[Sleeper Dreams]] for each PC's version). Half the town had it. Hollowborn wake weeping.
2. **The Smokes march.** At dusk [[The Sleepless]] come out of [[The Smokes]] in a long quiet procession with unlit candles, walking toward Lantern Hill. At their head is [[The Dreaming Widow]], veiled, serene. They don't attack. They sit down around the hill and wait for the dark.
3. **Tick's aunt.** The Widow asks for Tick by name. [[Marla Marlowe]] stands between them, furious, invisible to all but Tick. The Widow is her sister and says so: "Your mother dreamed this too, Tibbet. She'd want you with us." Marla scratches in the ash: NO.
4. **The second guttering.** At midnight, under the full Ember, the lantern gutters again, worse than before. [[Brother Tallow]] collapses at the cage. Ysse has to tend the flame (Arcana or Religion DC 13 each round for three rounds; on a failure the flame shrinks and something in the crowd starts to sing).
5. **The cut oil in the store.** While the hill is busy, someone breaks into the oil store. If the party catches them: one of the Widow's people with a jar of Stillwater ash, and he says who he's meeting: "the lieutenant's man".
6. **Spoons cracks.** If confronted with the poster, the coin and the timing, [[Spoons Aldane]] gives up Sallow: "I saw him and Dannic at the oil store. Twice. I didn't say. It was the biggest book I ever ran."

### NPCs
[[The Dreaming Widow]], [[Marla Marlowe]], [[Brother Tallow]], [[Spoons Aldane]], [[Garrick Sallow]], [[Ilse Marrow]], [[Odile Fairweather]] (seen slipping into the counting-house during the march).

### Encounters
- **Sleepless zealots** (cult fanatic): AC 13, HP 33, two dagger attacks +4 1d4+2, spells (command, inflict wounds). One, with four commoners, if the party tries to break up the vigil by force.
- **The dream given shape** (shadow, reskinned as a dream-figure from the crowd's song): AC 12, HP 16, Strength Drain +4 2d6+2 necrotic and Strength reduced 1d4. Two of them rise if Ysse fails the flame twice.

### Clues revealed
The Widow supplied the ash; she knows Sallow's "man" but not who pays Sallow. Spoons saw Sallow and Dannic. The Reeve is meeting Tollamund. Tallow, half-conscious, says: "It isn't oil it wants. It never was."

### Threads
Raises: what has the Reeve signed. Moves: Tick's mother's warnings (the aunt), whose voice is in Ysse's dreams (Ysse hears it clearly as she tends the flame: "Stand with me" and, under it, "Keep me").

### How it ends
Dawn comes; the flame holds; the Sleepless rise and walk home, smiling as if they'd won something. Tallow lives but can't stand. Ysse is now the keeper of the lantern. Tick the Sleepless clock.`,
    pages: ['dreaming-widow', 'marla-marlowe', 'tick', 'brother-tallow', 'ysse', 'spoons', 'garrick-sallow', 'odile-fairweather', 'the-smokes', 'lantern-hill', 'f-sleepless', 'god-sleeper', 'lore-ember'],
    prep: {
      strongStart: 'Every PC wakes at the same moment, gasping, from the same dream: a warm dark, a door with no handle, a voice saying "nearly". Outside, all across Cinderford, people are standing in their doorways in their nightclothes, looking at each other. Nobody needs to ask.',
      scenes: [
        'The shared dream; the town wakes at once.',
        'The Sleepless march out of the Smokes and sit in vigil around Lantern Hill.',
        'The Dreaming Widow asks for Tick; Marla stands between them.',
        'Midnight under the full Ember: the lantern gutters, Tallow collapses, Ysse tends the flame.',
        'Someone breaks into the oil store with Stillwater ash.',
        'Spoons gives up Sallow.',
      ],
      clues: [
        'The Dreaming Widow gave the ash freely to "the lieutenant\'s man".',
        'Spoons saw Sallow and Dannic at the oil store, twice.',
        'Reeve Fairweather slips into Tollamund & Daughters during the vigil.',
        'Tallow: "It isn\'t oil it wants. It never was."',
        'The flame responds to Ysse\'s touch better than to Tallow\'s.',
        'The Widow is Marla Marlowe\'s sister, Tick\'s aunt.',
      ],
      encounters: [
        {
          name: 'Breaking the vigil',
          notes: 'Cult fanatic: Multiattack two daggers +4, 1d4+2; spells command (DC 11), inflict wounds, hold person. Commoners only shove and sing. The Sleepless don\'t fight back unless attacked first.',
          foes: [
            { name: 'Sleepless zealot', count: 1, hp: 33, ac: '13', side: 'foe' },
            { name: 'Sleepless pilgrim', count: 4, hp: 4, ac: '10', side: 'foe' },
          ],
        },
        {
          name: 'The dream given shape',
          notes: 'Shadow reskinned: a figure stepping out of the crowd\'s song. Strength Drain +4, 2d6+2 necrotic, Strength reduced 1d4 (a creature reduced to 0 dies). Resists most nonmagical damage; vulnerable to radiant. Weak in the lantern\'s light (disadvantage on attacks within 10 ft of the cage). Only if Ysse fails the flame twice.',
          foes: [{ name: 'Dream-shape (shadow)', count: 2, hp: 16, ac: '12', side: 'foe' }],
        },
      ],
    },
  },
  {
    number: 4,
    title: 'The House of Unburnt Light',
    worldDate: { year: 3011, month: 9, day: 20 },
    notes: `## Session 4: The House of Unburnt Light
*Level 3. 20 Ashfall 3011 AW.*

**Goal.** Learn what the Saint's church wants with the flame, and survive its kindness.

### Key scenes
1. **The letter.** A child brings [[A Perfumed Letter]] to the party and waits for an answer. Everyone at the Keep has an opinion. Vosk: "Go. Eat everything. Sign nothing."
2. **The House.** [[The House of Unburnt Light]] is warm, beautiful and a little too comfortable: baths, wine from Halcyra, music, soft voices. [[Seraphine Ashe]] is gracious, curious, and very good at listening. She offers to "save" the flame: carry it to Halcyra, where the Saint will keep it safe forever. Wisdom save DC 13 each hour or a PC finds themselves wanting to agree. Each PC gets a private moment with Seraphine (or, briefly, with something speaking through her: her eyes go gold and her voice drops an octave). Keep it allusive: what she offers each PC is the thing they want most.
3. **The Velvet Ledger.** [[Sorrel Vey]] at [[The Velvet Ledger]] trades secrets for secrets. She knows the Saint's methods ("my goddess's arts, done by someone in a hurry"), and for the right secret tells the party what the church really wants: the Ninth Ward's crack to open, so the Saint can drink what leaks. She is also Marrow's lover, which she lets slip so the party can decide what to do with it.
4. **The ink.** If the party wins her trust, Sorrel shows them the oldest tattoos on her back, which she can't read: Saelish script, a list of names, and a ward-sign. (It's a record of the Saelish Trespass. [[Aelith Sorn]] would kill to read it.)
5. **Sallow exposed, or not.** With Spoons' word and the coin, the party can bring Sallow to Marrow. He denies everything, then smiles: "You'd hang an officer on the word of a bookie?" Marrow confines him to quarters. The mutiny goes quiet and underground.
6. **The garden door.** If the party comes back to the House at night, uninvited: Seraphine at prayer, speaking in two voices, and a letter on her desk to Halcyra: "The flame's new keeper is a Vesh girl. Bring her to me."

### NPCs
[[Seraphine Ashe]], [[Ilyra of Halcyra]] (through Seraphine), [[Sorrel Vey]], [[Ilse Marrow]], [[Garrick Sallow]], [[Aelith Sorn]] (watching from a balcony at the Ledger).

### Encounters
- **The Saint's wardens** (veteran): AC 17, HP 58, two longsword attacks +5 1d8+3. Two of them, only if the party is caught at the garden door and refuses to leave politely.
- **Sallow's loyalists** (bandit captain + 2 bandits): if the party tries to arrest Sallow without Marrow. Captain AC 15, HP 65, three attacks; bandits AC 12, HP 11.

### Clues revealed
The church wants the crack open. Seraphine wants Ysse. The Saint speaks through Seraphine. Sorrel's tattoos record something Sael chose to forget. Marrow and Sorrel are lovers.

### Threads
Ties: why is the Saint's envoy courting the party. Moves: how has Captain Marrow been feeding the company (Sorrel has been paying Marrow's debts; Marrow doesn't know the party knows).

### How it ends
The party walks home before dawn, warm and rested and certain they shouldn't feel this good. On the hill, Ysse tends the lantern, and the flame leans toward the east, toward Halcyra, like a plant toward a window. Tick the Saint's clock.`,
    pages: ['seraphine-ashe', 'ilyra', 'sorrel-vey', 'ilse-marrow', 'garrick-sallow', 'aelith-sorn', 'house-unburnt-light', 'velvet-ledger', 'h-letter', 'f-church-saint', 'god-saint', 'god-isaurana'],
    prep: {
      strongStart: 'A small girl in a clean white smock stands at the Keep gate with a letter held in both hands. She has been told to wait for an answer. She has a smudge of honey on her chin and a very serious face, and she is not going anywhere. The letter smells of warm resin and rain.',
      scenes: [
        'The perfumed letter arrives by child messenger; the Keep argues.',
        'An evening at the House of Unburnt Light: Seraphine\'s offer, and each PC\'s private temptation.',
        'Trading secrets with Sorrel Vey at the Velvet Ledger.',
        'Sorrel shows the oldest tattoos on her back.',
        'Bringing Sallow before Marrow.',
        'The garden door at night: Seraphine prays in two voices.',
      ],
      clues: [
        'The church wants the Ninth Ward\'s crack to open so the Saint can drink the leak.',
        'Seraphine\'s letter to Halcyra: "Bring her to me." (Ysse)',
        'The Saint speaks through Seraphine: gold eyes, a deeper voice.',
        'Sorrel Vey\'s oldest tattoos are a Saelish record with a ward-sign in it.',
        'Sorrel Vey has been quietly paying Captain Marrow\'s debts.',
        'The flame leans east, toward Halcyra, after the party visits the House.',
      ],
      encounters: [
        {
          name: 'The Saint\'s wardens',
          notes: 'Veterans in white-and-gold, fighting with real regret. Multiattack: two longsword +5, 1d8+3. They stop the moment Seraphine says so.',
          foes: [{ name: 'Saint\'s warden', count: 2, hp: 58, ac: '17', side: 'foe' }],
        },
      ],
    },
  },
  {
    number: 5,
    title: 'Last Words',
    worldDate: { year: 3011, month: 9, day: 25 },
    notes: `## Session 5: Last Words
*Level 3. 25 Ashfall 3011 AW.*

**Goal.** Find out where the ninth lantern was really lit, and what "the lamp is the lock" means.

### Key scenes
1. **The funeral that would not end.** Old Halloran Pike sits up at his own funeral at [[Corvel Rise]] (see [[The Funeral That Would Not End]]). [[Mother Corvane]] lends [[Hathe's Door-Key]] to finish the rite. Before the door opens, Pike has a confession to make (scene 4). When the door opens Pike's last words are the same as the seven Quorl has heard: "The lamp is the lock."
2. **The ledger.** Corvane takes the party into the rookery's bone-library and opens the Rook-Court's ledger: every last word heard since the war. Read together, a thousand dying sentences make one message. Quorl reading with her: Religion or Investigation DC 14 to see the pattern before Corvane says it. Tick the Rook-Court's clock to full.
3. **The Weeping Orchard.** For [[Sap from the Weeping Orchard]], or following a name from the ledger, the party goes north to [[The Weeping Orchard]], under a waning Ember. The stone trees bleed. Sleepless pilgrims are drinking the sap for dreams.
4. **The dying veteran.** Old Pike's confession, made sitting up on his bier before the door opens (run it in scene 1; it is what sends the party to the orchard). He was the deserter Pike of the company's story, and he never walked into the Rent: he went as far as its lip, lost his nerve, and came back two years later under his own name, and nobody looked twice at another Pike. On the night of Cinders, at the cooks' camp in the orchard, Mother Hennet lit the ninth lantern from a cook-fire that was burning on a lump of grey stone, with no wood, and he carried the lantern up to the Keep. "It was cold. In the fire, and it was cold. It talked. I thought I was dying." Hennet carried the stone after him in a soup-pot, and the boy with the burnt hand, [[Brannoc Saltash]], howled the whole way. The stone was blown out of the Ninth Stone's crack. Under the oldest tree the party finds the fire-pit as he said, with glass in it, and a ring the size of a soup-pot burnt into the stone beside it.
5. **The shard's fate.** Pike's last secret: at the Keep, Hennet tipped the stone out of the pot into [[Brother Tallow]]'s hands. Hennet, asked at the Candle, says only "Took you long enough." Tallow, confronted, admits he has kept [[The Ward Shard]] under the lantern's cage for nine years, and has always been afraid to say what it was.

### NPCs
[[Mother Corvane]], [[Quorl Many-Words]], [[Brother Tallow]], [[The Dreaming Widow]] (at the orchard, if the party hasn't dealt with her), [[Aelith Sorn]] (who has followed them, and wants the stone hand from Kettle's barge).

### Encounters
- **Orchard pilgrims** (cult fanatic + 4 commoners) who won't let outsiders take the sap.
- **The stone-touched dead** (ghoul x3, reskinned as soldiers half-turned to stone, AC 14 for the stone): AC 14, HP 22, claws +4 2d4+2 and paralysis (Con DC 10). They rise from the orchard roots at moonrise.

### Clues revealed
"The lamp is the lock." The ninth lantern was lit from a shard of the Ninth Stone. The shard is under the cage. The flame and the stone are kin (the sap makes it burn white).

### Threads
Ties: what are the dying whispering to Quorl; where was the ninth lantern really lit. Moves: why did the drowned man say it's cold under the glass (Corvane: "The dead are cold because they lie near the leak").

### How it ends
At the Keep, the sap dropped into the lantern makes it burn tall and white, and for a moment Ysse sees a standing figure in the flame, enormous and very tired, looking at her. Tallow: "It wants to go home." Marrow decides: someone has to go to the Ninth Stone.`,
    pages: ['mother-corvane', 'quorl', 'brother-tallow', 'aelith-sorn', 'corvel-rise', 'weeping-orchard', 'doorkeepers-chapel', 'item-door-key', 'item-shard', 'q-raveler-funeral', 'q-weeping-sap', 'f-rook-court', 'god-hathe'],
    prep: {
      strongStart: 'The funeral is going beautifully. The Ravelers are singing, the salt is on the step, the coin is on old Pike\'s tongue. Then Pike spits out the coin, sits up on the bier, and says, with great dignity, "I\'m terribly sorry. The door\'s locked." Two mourners faint. Mother Corvane closes her eyes and says, "Not again."',
      scenes: [
        'Pike sits up at his own funeral; Hathe\'s Door-Key finishes the rite; "The lamp is the lock."',
        'Reading the Rook-Court\'s ledger of last words with Mother Corvane.',
        'The Weeping Orchard under a waning red moon: the stone bleeds, pilgrims drink.',
        'Old Pike\'s confession on his bier: Mother Hennet lit the lantern from a burning stone in the orchard, and he carried it.',
        'Confronting Brother Tallow: the shard has been under the cage for nine years.',
      ],
      clues: [
        'A thousand last words read together say: "The lamp is the lock."',
        'The ninth lantern was lit from a cook-fire burning on a grey stone with no wood, at the cooks\' camp in the Weeping Orchard.',
        'The stone was a shard blown out of the Ninth Stone\'s crack.',
        'Brother Tallow has kept the Ward Shard under the lantern\'s cage for nine years.',
        'Orchard sap makes the flame burn white; Ysse sees a standing figure in it.',
        'The dead lie cold because they lie near the leak.',
      ],
      encounters: [
        {
          name: 'The stone-touched dead',
          notes: 'Ghouls reskinned: soldiers half-turned to stone. Claws +4, 2d4+2 slashing, Con DC 10 or paralysed for 1 minute (not elves or Returned). AC 14 for the stone skin. They rise at moonrise and avoid the sap.',
          foes: [{ name: 'Stone-touched dead', count: 3, hp: 22, ac: '14', side: 'foe' }],
        },
      ],
    },
  },
  {
    number: 6,
    title: 'Into the Rent',
    worldDate: { year: 3011, month: 10, day: 1 },
    notes: `## Session 6: Into the Rent
*Level 4. 1 Leafrot 3011 AW.*

**Goal.** Reach the Ninth Stone, hear the truth from the one who keeps it, and come back.

### Key scenes
1. **The lip.** Two days' ride across the ash to the northern lip of [[The Rent]], where [[The Ninth Stone]] leans over the chasm like a drunk over a well. Roll on [[Ashenreach Encounters]] once each day.
2. **The descent.** With [[A Glasser's Chart]] (advantage, skip one hazard) or without: the rope steps (Athletics DC 13, or a fall of 2d6), the glass stair (Acrobatics DC 13: walk the red glass, not the clear), and the Choir, where the leak speaks in the voices of the party's dead (Wisdom save DC 14 or answer them, and take 2d6 psychic). No magic down here: every spell cast makes the walls frost and ticks the Sleeper's clock one slice on a 1 on a d6.
3. **Warden Uthrem.** At the foot of the Stone, half-turned to stone himself, sits [[Warden Uthrem]]. He has waited nine years. He speaks slowly, and has to rest between sentences. He tells the truth of the Godslaying: the Nine killed a god and couldn't finish it; they became the lid and the lock; the Ninth is still awake inside this stone, and the crack is bleeding the Ninth dry. The flame is the Ninth's. It must come home, and the ward needs a heart: "a heart that chooses".
4. **He waited for Ysse.** Uthrem asks for Ysse by name. He's heard her in the flame. He asks her to stand with him. He does not insist. He is very kind about it, which is worse.
5. **The rubbing.** Ysse (or anyone) takes [[A Rubbing from the Ninth Stone]]. With Uthrem's help, they read it: carry the flame to the stone; give it a heart that chooses; "do not listen when it asks to be kept".
6. **Borrin's shadow.** At the foot of the Stone, Borrin's shadow stands up from the ground on its own, looks at the Stone, and bows to it. Then it looks at Borrin and says, in his voice: "Not yet." Uthrem names it: something from the Eighth Ward, a door-warden that came up with him. It wants to see what the Ninth does.

### NPCs
[[Warden Uthrem]], [[Ysse Lampwright]], [[Borrin Halt]], [[Vexa Glassjaw]] (her people at the lip, if the party traded fairly; robbing the party if not).

### Encounters
- **The Choir** (specter x3, reskinned as voices of the dead given shape): AC 12, HP 22, Life Drain +4 3d6 necrotic, Con DC 10 or max HP reduced. Only if a PC answers the voices.
- **Glass-stalker** (giant scorpion, reskinned as a thing of fused glass): AC 15, HP 52, claws +4 1d8+2 and grappled, sting +4 1d10+2 plus 4d10 poison (Con DC 12 half). Lives on the glass stair.

### Clues revealed
The truth of the Godslaying. The lantern's flame is the Ninth's. Resealing needs a willing heart. The Sleeper speaks in the Ninth's voice. Borrin's shadow is from the Eighth Ward.

### Threads
Ties: why does Borrin's shadow lag (answered, not resolved); why did the drowned man say it's cold under the glass. Moves: whose voice is in Ysse's dreams (Uthrem names the warm voice; the cold one he won't name).

### How it ends
The climb out at dusk. At the top, a rider from Cinderford is waiting, exhausted: "Captain says come home now. They're all moving at once."`,
    pages: ['warden-uthrem', 'ysse', 'borrin', 'vexa-glassjaw', 'the-rent', 'ninth-stone', 'h-map-scrap', 'h-rubbing', 'f-last-wardens', 'lore-nine', 'lore-wards', 'god-sleeper', 'ev-godslaying'],
    prep: {
      strongStart: 'The rope is old company rope, tarred and knotted, and three hundred feet down it runs out. Ysse\'s hand is on the knot when the voice comes up out of the dark, warm and slow and patient: "There you are. I have waited such a long time." Everyone heard it. Nobody else was meant to.',
      scenes: [
        'The ride to the northern lip; the Ninth Stone leaning over the Rent.',
        'The descent: rope steps, glass stair, the Choir.',
        'Warden Uthrem tells the truth of the Godslaying.',
        'Uthrem asks Ysse to stand with him.',
        'Taking and reading the rubbing from the Ninth Stone.',
        'Borrin\'s shadow stands up on its own and bows to the Stone.',
      ],
      clues: [
        'The Nine killed the god Ysmereth and could not finish it; they became the lid and the lock.',
        'The Ninth is still awake inside the Ninth Stone; the crack is bleeding the Ninth dry.',
        'The lantern\'s flame is the Ninth\'s, and it must come home to the stone.',
        'A ward needs a heart that chooses, not one that is taken.',
        'Something below speaks in the Ninth\'s voice and asks to be kept.',
        'Borrin\'s shadow is a door-warden from the Eighth Ward.',
      ],
      encounters: [
        {
          name: 'The glass-stalker',
          notes: 'Giant scorpion reskinned as a thing of fused glass. Multiattack: two claws +4, 1d8+2 bludgeoning, grappled (escape DC 12); sting +4, 1d10+2 piercing plus 4d10 poison (Con DC 12 half). Blindsight 60 ft. Lives on the glass stair.',
          foes: [{ name: 'Glass-stalker', count: 1, hp: 52, ac: '15', side: 'foe' }],
        },
        {
          name: 'The Choir',
          notes: 'Specters reskinned as the voices of the party\'s dead. Life Drain +4, 3d6 necrotic, Con DC 10 or max HP reduced by the damage. Incorporeal; sunlight sensitivity becomes lantern sensitivity. Only if a PC answers.',
          foes: [{ name: 'Voice of the Choir', count: 3, hp: 22, ac: '12', side: 'foe' }],
        },
      ],
    },
  },
  {
    number: 7,
    title: 'Three Knives',
    worldDate: { year: 3011, month: 10, day: 5 },
    notes: `## Session 7: Three Knives
*Level 4. 5 Leafrot 3011 AW. Four nights before the red moon is full again.*

**Goal.** Survive the week every faction moves on the lantern, and break (or win) the mutiny.

### Key scenes
1. **The Concord's knife.** [[Grandmother Tollamund]] calls in the debt, very slowly, in person, at the Keep gate, with lawyers. The collateral named on the chit is "the property of the company, including the lamp". [[Odile Fairweather]] stands beside her: the Reeve has signed the charter over. Talk, stall, or find a hole in the contract (History or Investigation DC 15; [[The Original Treaty]] has one, if the party has it). Tick the Concord's clock.
2. **The Quiet Office's knife.** [[Ansel Mote]] stops pretending. The cipher on [[The Assessor's Lost Form]], if read, says it all: the lantern is to be seized for the Regency under the unpaid tax. At night Mote comes for the lantern himself, with two hired knives, while Pell sleeps. [[Pell Quillon]], if the party returned his form, wakes, sees, and is braver than anyone expects.
3. **The Saint's knife.** [[Seraphine Ashe]] comes for Ysse, not the lantern. Gently. With an offer. If refused, the House's wardens try to take her to the Halcyra road.
4. **Sallow's mutiny.** With the company split by the debt, [[Garrick Sallow]] breaks out of confinement and calls the files to the drill yard: "They've sold us. Let's sell them first." Half the company is listening. Turning it: expose the Quiet Office coin, tell the company Marrow fed them from her own purse, or let [[Mirrel Vosk]] speak (he served under Grashka; he tells them what the Iron Guard did to the last emperor who dug at a ward, and why).
5. **Grashka's answer.** If Varra wrote to the Mothers, a reply arrives in the middle of everything: [[Grashka]]'s seal. "Hold the lamp. I am sending what I can." And, in a different ink: "I did it. Not for the throne. For this. Ask Vosk."

### NPCs
[[Grandmother Tollamund]], [[Odile Fairweather]], [[Ansel Mote]], [[Pell Quillon]], [[Seraphine Ashe]], [[Garrick Sallow]], [[Mirrel Vosk]], [[Ilse Marrow]], [[Grashka]] (by letter).

### Encounters
- **Mote's night** (Ansel Mote as an assassin scaled down: AC 15, HP 45, two shortsword attacks +6 1d6+4, poison 3d6 on a hit, Con DC 13 half; plus two thugs AC 11, HP 32).
- **The mutiny in the yard** (veteran Sallow AC 15, HP 58 and four bandit mutineers AC 12, HP 11), if it comes to blades. Every mutineer knocked out rather than killed is one the company gets back.

### Clues revealed
The Quiet Office answers to [[Marius Vell]], who wants the flame for a puppet emperor. The Concord wants the lantern as collateral (Tollamund, if asked straight: "It is a key. To a door my people closed."). Grashka's confession.

### Threads
Ties: who is cutting the lantern oil (Mote, through Sallow); what is the Assessor's clerk really writing; where is Lieutenant Sallow getting his money; what has the Reeve signed. Moves: the Saint's envoy.

### How it ends
The Mutiny clock is broken or full. Either way, the company, what's left of it, stands round the lantern. The Ember is four nights from full and already the colour of a fresh wound. Marrow: "Whatever we're doing with that thing, we're doing it at the Rent. Under the moon. Together, or not at all."`,
    pages: ['tollamund', 'odile-fairweather', 'ansel-mote', 'pell-quillon', 'seraphine-ashe', 'garrick-sallow', 'mirrel-vosk', 'ilse-marrow', 'grashka', 'marius-vell', 'tollamund-house', 'item-treaty', 'f-quiet-office', 'f-concord-houses', 'f-church-saint', 'f-mothers', 'f-ninth-lantern'],
    prep: {
      strongStart: 'The Keep gate. A Shellback banker three hundred and forty years old is standing in the ash with two lawyers and the Reeve of Cinderford, and she has been saying the same sentence for nearly a minute. She is not finished. The sentence is "We are here to collect."',
      scenes: [
        'Tollamund calls in the debt; the Reeve has signed the charter.',
        'Ansel Mote comes for the lantern by night.',
        'Seraphine comes for Ysse.',
        'Sallow\'s mutiny in the drill yard.',
        'Grashka\'s letter arrives.',
      ],
      clues: [
        'Mote\'s cipher: the lantern is to be seized for the Regency under the unpaid tax.',
        'Marius Vell commissioned the Quiet Office\'s work in Cinderford.',
        'Tollamund wants the lantern as a key "to a door my people closed".',
        'The Reeve signed Cinderford\'s charter to the Concord.',
        'Grashka struck the blow that killed the Emperor, to stop him opening a ward.',
      ],
      encounters: [
        {
          name: 'Mote\'s night',
          notes: 'Ansel Mote as a scaled-down assassin: Multiattack two shortswords +6, 1d6+4 piercing plus 3d6 poison (Con DC 13 half). Assassinate: advantage and auto-crit on surprised targets in round one. Two thugs with him. He flees at half HP and is not above using Pell as a shield.',
          foes: [
            { name: 'Ansel Mote', count: 1, hp: 45, ac: '15', side: 'foe', page: 'ansel-mote' },
            { name: 'Hired knife (thug)', count: 2, hp: 32, ac: '11', side: 'foe' },
          ],
        },
        {
          name: 'The mutiny in the yard',
          notes: 'Sallow as a veteran: two longsword attacks +5, 1d8+3. Mutineers as bandits. Each mutineer reduced to 0 can be knocked out instead of killed; each one spared is one the company gets back. If Vosk or Marrow speaks first, two mutineers switch sides.',
          foes: [
            { name: 'Garrick Sallow', count: 1, hp: 58, ac: '15', side: 'foe', page: 'garrick-sallow' },
            { name: 'Mutineer', count: 4, hp: 11, ac: '12', side: 'foe' },
          ],
        },
      ],
    },
  },
  {
    number: 8,
    title: 'The Lantern Gutters',
    worldDate: { year: 3011, month: 10, day: 9 },
    notes: `## Session 8: The Lantern Gutters
*Level 5. 9 Leafrot 3011 AW, the full red moon. Tick the Sleeper's clock at the start.*

**Goal.** Decide the flame's fate. See [[Ending: Reseal the Ward]], [[Ending: Let It Crack]] and [[Ending: Use It]].

### Key scenes
1. **The road to the Rent.** The company, or what's left, carries the lantern east across the ash under a swelling red moon. The flame is failing fast now; Ysse can barely keep it. Everyone who wants it follows.
2. **The gauntlet.** Whoever the party hasn't dealt with comes for the lantern on the way: Mote's replacements, Sallow's diehards, the Saint's wardens, Glassers, the Sleepless (who want only to watch it go out). Pick two. Make each cost something.
3. **The priests at the lip.** At the northern lip, the pantheon's priests are waiting, every one with a different reason to let it crack, all talking at once. Seraphine is among them. So is a friend.
4. **The voice in the flame.** As the moon tops the sky, the flame speaks aloud for the first time, in the Ninth's warm voice, to whoever holds it: "Keep me." (It isn't the Ninth.)
5. **The choice.** At the Ninth Stone with [[Warden Uthrem]]: reseal it with a willing heart, let it crack, or take it and keep it. Whatever they choose, give each PC one last moment (Marla's, Borrin's shadow's, Quorl's last words, Varra's grandmother, Ysse's answer).
6. **Dawn.** An epilogue in the ash. Who's left, what Cinderford becomes, and what happens to the company now the contract has or hasn't ended.

### NPCs
Everyone still standing. Especially [[Warden Uthrem]], [[Ysse Lampwright]], [[Seraphine Ashe]], [[Ilse Marrow]], [[Brother Tallow]], [[Grandmother Tollamund]], [[The Dreaming Widow]].

### Encounters
- **The dead of Cinders rising** (zombie x6 and wight x1, reskinned as the eight lost lanterns' soldiers): zombie AC 8, HP 22; wight AC 14, HP 45, two longswords +4 1d8+2 or Life Drain. They rise as the crack widens and walk to the Stone, not at the party, unless the party stands in the way.
- **The Saint's champion** (Seraphine with the Saint in her: priest, AC 13, HP 45, spells: guiding bolt, spirit guardians, hold person, plus Ilyra's Kindness: a charmed target walks to her).

### Clues revealed
None left: it's all on the table. Let the players' choices be the revelation.

### Threads
Tie off every thread the party has touched. Leave two open on purpose for a second arc (Borrin's shadow, and whoever the Sleeper whispers to next).

### How it ends
However the party chose. See the three ending pages for consequences, and for hooks if you want to keep going.`,
    pages: ['warden-uthrem', 'ysse', 'seraphine-ashe', 'ilse-marrow', 'brother-tallow', 'tollamund', 'dreaming-widow', 'the-rent', 'ninth-stone', 'item-lantern', 'item-shard', 'end-reseal', 'end-crack', 'end-use', 'god-sleeper', 'god-saint'],
    prep: {
      strongStart: 'The lantern is lashed to a handcart, and the flame inside the glass is the size of a fingernail and blue at the root. Ysse walks beside it with one hand on the cage. Behind you, a hundred soldiers. Ahead, the Rent. Overhead, the Ember has come up full and huge, so close it seems you could hear it breathing. Everyone who has ever wanted this flame is on the road behind you.',
      scenes: [
        'The road east with the failing lantern under a swelling red moon.',
        'The gauntlet: two factions come for the lantern on the way.',
        'The pantheon\'s priests at the lip, each with a different reason to let it crack.',
        'The flame speaks aloud: "Keep me."',
        'The choice at the Ninth Stone with Warden Uthrem.',
        'Dawn and the epilogue.',
      ],
      clues: [
        'The voice that says "Keep me" is not the Ninth\'s.',
        'A heart that is taken rots: nobody can be pushed into the stone.',
        'If the lantern goes out, by contract the company stands down.',
        'The gods\' priests each want the crack open for their own reason, and they want it before dawn.',
      ],
      encounters: [
        {
          name: 'The dead of Cinders',
          notes: 'Zombies (AC 8, HP 22, slam +3 1d6+1, Undead Fortitude) and one wight (Multiattack two longswords +4 1d8+2, or one longsword and Life Drain +4 1d6+2 necrotic). They walk to the Stone, not at the party. Lantern-lit weapons ignore their resistances.',
          foes: [
            { name: 'Dead of Cinders', count: 6, hp: 22, ac: '8', side: 'foe' },
            { name: 'Lost lantern-captain (wight)', count: 1, hp: 45, ac: '14', side: 'foe' },
          ],
        },
        {
          name: 'The Saint\'s champion',
          notes: 'Seraphine with the Saint in her (priest, upgraded): spells guiding bolt, spirit guardians (fire-gold), hold person, mass healing word for her side. Ilyra\'s Kindness (recharge 5-6): one creature within 30 ft, Wisdom DC 14 or charmed and walks to her. Fights to win Ysse, not to kill.',
          foes: [{ name: 'Seraphine Ashe', count: 1, hp: 45, ac: '13', side: 'foe', page: 'seraphine-ashe' }],
        },
      ],
    },
  },
]

export const SESSIONS: ExSession[] = [SESSION_1, ...LATER_SESSIONS]

export const BOARDS: ExBoard[] = [
  {
    name: "Who's poisoning the flame?",
    cards: [
      { key: 'tin', x: 700, y: 420, page: 'item-oil-tin' },
      { key: 'sallow', x: 380, y: 180, page: 'garrick-sallow' },
      { key: 'mote', x: 80, y: 60, page: 'ansel-mote' },
      { key: 'spoons', x: 420, y: 640, page: 'spoons' },
      { key: 'widow', x: 1080, y: 160, page: 'dreaming-widow' },
      { key: 'seraphine', x: 1350, y: 420, page: 'seraphine-ashe' },
      { key: 'tollamund', x: 1100, y: 760, page: 'tollamund' },
      { key: 'fennick', x: 760, y: 820, page: 'fennick' },
      { key: 'dannic', x: 700, y: 60, page: 'dannic-rook' },
      { key: 'n-ash', x: 1080, y: 420, text: 'The ash in the oil is fine and pale and smells of lake water. Stillwater?', color: '#f6e27a' },
      { key: 'n-coin', x: 80, y: 400, text: 'Sallow paid for a round with NEW Regency silver, this year\'s mint. Dannic had the same coin in his purse.', color: '#f6e27a' },
      { key: 'n-poster', x: 80, y: 760, text: 'Wanted poster: "last seen on the 12th". He drowned on the 7th. Signed A.M.', color: '#f4a6a6' },
      { key: 'n-ledger', x: 1350, y: 760, text: 'Fennick\'s oil ledger: four casks too many burned this quarter. Where did the oil go?', color: '#a6d4f4' },
      { key: 'n-note', x: 380, y: 420, text: 'Dannic\'s note: "S. says one more swap and Im square. Then the clerk wants a word."', color: '#f6e27a' },
    ],
    strings: [
      { from: 'dannic', to: 'tin', label: 'carried' },
      { from: 'dannic', to: 'sallow', label: 'paid by' },
      { from: 'sallow', to: 'mote', label: 'paid by?' },
      { from: 'n-note', to: 'sallow', label: '"S."' },
      { from: 'n-note', to: 'mote', label: '"the clerk"?' },
      { from: 'n-coin', to: 'sallow' },
      { from: 'n-coin', to: 'mote', label: 'Regency money' },
      { from: 'n-poster', to: 'mote', label: 'A.M.?' },
      { from: 'spoons', to: 'sallow', label: 'seen near the oil store' },
      { from: 'spoons', to: 'tin', label: 'lying?' },
      { from: 'n-ash', to: 'tin' },
      { from: 'n-ash', to: 'widow', label: 'source of the ash?' },
      { from: 'fennick', to: 'n-ledger', label: 'lying?' },
      { from: 'fennick', to: 'tollamund', label: 'owes money to' },
      { from: 'seraphine', to: 'tin', label: 'wants it lit, not out?' },
      { from: 'tollamund', to: 'tin', label: 'why would a bank?' },
    ],
  },
]

export const CAMPAIGN_PAGES: ExPage[] = [...QUESTS, ...THREADS, ...HANDOUTS, ...ENDINGS, ...EVENTS, ...GUIDES, ...TEMPLATES]
