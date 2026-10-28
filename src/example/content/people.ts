import type { ExPage } from '../types'

/**
 * People of the example world: the five player characters, the major NPCs of the registry,
 * and the minor folk of Cinderford and the Ninth Lantern (keys prefixed npc-).
 */
export const PEOPLE: ExPage[] = [
  // ───────────────────────────── The player characters ─────────────────────────────
  {
    key: 'varra',
    type: 'pc',
    name: 'Varra Nine-Knuckles',
    players: true,
    parent: 'lantern-keep',
    image: 'sil:varra',
    status: 'alive',
    statusKnown: true,
    summary: 'Orc fighter cast out by the Mothers for refusing a contract; the newest heavy blade in the Ninth Lantern.',
    fields: [
      { key: 'Ancestry', value: 'Orc' },
      { key: 'Role', value: 'Recruit, heavy infantry' },
      { key: 'Class (5e)', value: 'Fighter' },
      { key: 'Level', value: '1' },
      { key: 'Background', value: 'Soldier' },
      { key: '5e', value: 'AC 16 (chain mail), HP 12. STR 16, DEX 12, CON 15, INT 8, WIS 13, CHA 10. Greatsword 2d6+3. Second Wind (bonus action, 1d10+1 HP); Great Weapon Fighting; orc Relentless Endurance (drop to 1 HP instead of 0, once per long rest).', gm: true },
    ],
    tags: ['pc', 'recruit', 'orc'],
    relations: [
      { to: 'f-ninth-lantern', kind: 'serves', note: 'Signed on at half pay, which is currently no pay.', known: true },
      { to: 'grashka', kind: 'granddaughter of', note: 'Her lineage name, which she may no longer speak.', known: true },
      { to: 'mirrel-vosk', kind: 'drills under', note: 'He knows more about her than he says.', known: true },
      { to: 'borrin', kind: 'shield-sister of', note: 'Signed the roll the same morning.', known: true },
    ],
    body: `### Who she is
In the orc way her name is **Varra, Grashka's daughter's daughter**, and until last winter she said it the way other people say a prayer. She may not say it now. The [[The Mothers of the Iron|Mothers of the Iron]] took that name from her when they cast her out. The other name she earned at twelve, when she caught a falling portcullis chain that would have taken her mother's head, and left the first knuckle of her little finger in the links. Ten knuckles on a soldier's hands; she has nine. Her mother's company did the arithmetic, and it stuck.

### Look
Big even for an orc: slate-grey skin, a jaw like a shut gate, tusks capped in old brass (one cap missing, lost to a tavern table in Fallowden). She shaves the sides of her head and wears the rest in a single braid with a lead weight tied in the end, which is less a fashion than a weapon. Her mail is good, her boots are bad, and the stump of her little finger is wrapped in red thread, which among orcs means *I am still owed*.

### Manner
Speaks little and plainly. Laughs at the wrong times: at funerals, during sermons, once at a man trying to kill her. Sings marching songs off-key and knows all the verses, including the ones about the Emperor. Eats like someone who has gone hungry and expects to again.

### Background
Varra was raised in the barrack-halls of her mother's company, the Rust Choir, and was carrying a pike before she could read. Orc companies hold the peace in half of [[Vael Ardith]] for one reason: their contracts are absolute. A company of the Iron that signs, delivers. That is the whole of orc honour and most of orc survival.

Last Leafrot the Rust Choir took a Regency lord's contract to clear a hill village outside [[Fallowden]] of tenants who owed him rent. Clear it to the stones. Varra's file was given the north road. She stood aside and let forty people run past her into the dark, and when her sergeant asked why, she said, "Because I'm not a fire."

The Mothers heard the case in three days. Nobody argued that the village deserved burning. They argued that the Iron's word had been broken, and that the next time an orc company swore to hold a wall, somebody would remember the Rust Choir and not pay. They were right. Varra knew they were right. She would do it again, and that frightens her more than the exile.

### Why you're in Cinderford
No company licensed by the Mothers will take her, and [[The Ninth Lantern]] holds its writ from the Mothers like every other. Signing an exile could cost the company that writ. [[Captain Marrow]] looked at her hand, looked at the roll, and said, "Can you hold a line? Good. You're hired. The pay is late. And the Mothers haven't sent anyone to check on us in nine years, so that's a problem for another day." The pay has been late ever since.

### Ties
- **[[Sergeant Vosk]]**, the company's orc Second Blade, looked at her face for a long moment on the first day and said nothing at all. She is fairly sure he knows whose granddaughter she is.
- **[[Kettle Brindlewake]]** brought her downriver on a barge full of salt fish and charged her nothing, which worries her.
- **[[Borrin Halt]]** signed the roll the same morning. She is the only one in the barracks who doesn't flinch at the place his shadow should be. They share a bench, a whetstone and an unspoken agreement not to ask.
- **[[Tick]]** nearly took her eyebrows off with a test charge in her first week. She has since appointed herself his bodyguard in [[The Smokes]], mostly to stop him doing it to anyone else.
- **[[Quorl Many-Words]]** measured her for a coffin the day she arrived. Ravelers do that for every recruit. She asked him to make it roomy.

### Playing her
A soldier who chose her conscience once and paid for it with everything. Every contract, oath and order in this campaign asks her the same question again: would she?

:::for Varra Nine-Knuckles
**Your secret.** Your grandmother is Grashka, now Mother of Mothers, and thirty years ago she was the orc of the Iron Guard who struck the blow that killed Emperor Aurel IX. Your mother told you once, drunk, and never again. Nobody alive outside the Mothers' council knows the Kingslayer's name. If the Regency learned it, every agent they have would want you, as bait or as proof or as a head on a gate.

Your grandmother told you only one thing about it, the night before you went to your first war: "There are worse things than a dead emperor. Pray you never see one." She has never explained. You have never stopped wondering.
:::

:::gm
**How her secret pays off.**
- [[Sergeant Vosk]] served under Grashka in the Iron Guard and recognised the face at once. He stood at the door of the Gilded Gallery the afternoon she struck. Whether he tells Varra he knows (and what he saw) is a good session 3 or 5 scene.
- [[Ansel Mote]] has a Quiet Office file on the Mothers' lineages. If he learns who Varra is, she becomes a target in **Three Knives** (session 7): a Kingslayer's blood to hang publicly, or a hostage to force the Mothers' hand.
- In **Into the Rent** (session 6), [[Warden Uthrem]] explains that Aurel IX was digging at three ward sites. That is why Grashka killed him. Varra is the only person in the party who can carry that truth to the Mothers, and be believed.
- In the finale, a letter from Grashka can arrive (or Grashka herself, if you want a big entrance): the Mothers will back resealing the ward, at a price. Ending her exile is one of the prices on the table.
- Optional twist: Grashka chose that contract for the Rust Choir knowing her granddaughter would refuse it, and so put Varra where the Mothers needed eyes. Never confirm it outright.
:::`,
    gmNotes: `Varra's arc is about contracts. The Ninth Lantern's own contract says it stands down if the lantern ever goes out; in ending A, she is the one who will feel that hardest. Give her an oath to make in session 1 or 2 (to Marrow, to a dying soldier, to the company) and test it in session 7 when [[Garrick Sallow]]'s mutiny asks her to break it.`,
  },
  {
    key: 'ysse',
    type: 'pc',
    name: 'Ysse Lampwright',
    players: true,
    parent: 'lantern-keep',
    image: 'sil:ysse',
    status: 'alive',
    statusKnown: true,
    summary: 'Vesh wizard apprenticed to Brother Tallow, here to study the only lantern that never goes out.',
    fields: [
      { key: 'Ancestry', value: 'Vesh' },
      { key: 'Role', value: 'Recruit, apprentice lantern-keeper' },
      { key: 'Class (5e)', value: 'Wizard' },
      { key: 'Level', value: '1' },
      { key: 'Background', value: 'Sage' },
      { key: '5e', value: 'AC 12 (15 with mage armour), HP 7. STR 8, DEX 14, CON 13, INT 16, WIS 12, CHA 10. Cantrips fire bolt, light, mage hand; prepared magic missile, shield, detect magic, find familiar (a lantern-beetle called Wick). Arcane Recovery; Vesh ward-sight (sees where a ward runs thin, 60 ft).', gm: true },
    ],
    tags: ['pc', 'recruit', 'vesh'],
    relations: [
      { to: 'f-ninth-lantern', kind: 'serves', note: 'On the roll as "lamp clerk".', known: true },
      { to: 'item-lantern', kind: 'studies', known: true },
      { to: 'tick', kind: 'friends with', note: 'He calls her Moth. She allows it.', known: true },
    ],
    body: `### Who she is
Ysse came three hundred miles on foot, in the dark, to look at a lamp. The libraries of [[The Vesh]] have a shelf of folios about [[The Lantern of the Ninth]], the lantern on [[Lantern Hill]] that has not gone out in nine years of wind, rain, greywinds and neglect, and every one of them is guesswork. She wanted to stop guessing.

### Look
Small, narrow, and grey-brown as a moth's wing, with large dark eyes that catch the light like coins at the bottom of a well. Her antennae are long and feathered and very expressive; she has learned to keep a hood up in company because they say what her face won't. Soft fur at the throat and wrists. Fingers stained with lamp-black and ink. She wears a lantern-keeper's leather apron over a scholar's coat with too many pockets, and in one of them, always, a lantern-beetle called Wick.

### Manner
Quiet, precise, and then suddenly not: get her talking about flames and she talks for an hour. Nocturnal, so she is sharp at midnight and useless at noon. Leans toward any lit lamp without noticing. Apologises to candles before she snuffs them, a Vesh habit she has stopped explaining.

### Background
Ysse was a copyist in a Vesh lamp-library in the Regency, the kind that keeps every lamp burning all night so the readers can work. She was good at it, too good: she started noticing where the old wards ran thin, as all Vesh can, and writing it down, which almost no Vesh does. Her elders told her it was rude. The Vesh have a long tradition of seeing things and politely saying nothing.

She knows the cost every spell carries, the rule set down in [[Magic and Its Cost]]: magic drawn near a ward drains it. She casts anyway, carefully, and keeps a tally in the back of her notebook of every spell she has cast within sight of [[The Ninth Stone]]'s country. The tally is not short.

When she heard the old lantern-keeper of the Ninth was going blind, she wrote to him. [[Brother Tallow]] wrote back one line: "Come before I can't see you."

### Why you're in Cinderford
Officially: to apprentice under Brother Tallow, keep the oil log, trim the wick, and learn the lantern so it outlives him. Unofficially: to find out why it burns.

### Ties
- **Brother Tallow** is her master and the closest thing she has to a grandfather. He is frightened of something and won't say what.
- **[[Tick]]** calls her "Moth", brings her things that burn oddly from the glass, and is the only one who asks what she sees in the flame.
- **[[Quorl Many-Words]]** shares the night watch on Lantern Hill with her. She keeps the flame; he keeps the words of the dead. They have long, strange conversations at three in the morning.
- **[[Borrin Halt]]**: where his shadow should be, she sees something she cannot name. She has not told him.
- **[[Sister Seraphine]]** has invited her to the House twice "to talk about fire". Both times Ysse went home and couldn't sleep.

### Playing her
Curiosity as courage. She will walk into the dark for a question. The campaign will eventually offer her an answer she might not survive.

:::for Ysse Lampwright
**Your secret.** You can feel the flame failing. Nobody told you; you just know, the way you know when a candle is near the end of its wick. It burns a little thinner every week, and it burns thinnest when the red moon is full.

And it has started speaking in your dreams. Not words, at first: warmth, and weight, and the sense of something very large holding its breath. Lately there are words. *Not yet.* *Hold.* Once, last week: *You came.* You have not told Brother Tallow. You think he would be frightened, and you think he already is.
:::

:::gm
**How her secret pays off.**
- The voice is (mostly) the Ninth: one of [[The Nine]], awake inside [[The Ninth Stone]], speaking through the shard that lights the lantern. At full Ember a second voice answers it, warmer and kinder and far more patient. That one is [[The Sleeper Below]]. Ysse should not be able to tell them apart until session 6, when [[A Rubbing from the Ninth Stone]] spells it out: "It is not the Ninth asking. The One Below is asking."
- [[Warden Uthrem]] has been waiting nine years for "the one the flame calls". It is Ysse. When she reaches the Ninth Stone in **Into the Rent**, he says her name before she gives it.
- In ending A, Ysse is one of the three possible living hearts for the ward (with Uthrem and any willing PC). The flame wants her. That is not the same as her having to say yes.
- Her spell tally matters: every spell cast near the Rent drains the ward. Let her player keep the count and let it bite in session 8.
- [[Sister Seraphine]] and the Saint want her badly, because a keeper the flame trusts could carry it to Halcyra.
:::`,
    gmNotes: `Use Ysse's dreams as a delivery system for clues: after each session, hand her player one line the flame said. After session 3 (red moon), let a dream come that is not from the Ninth at all, and see if anyone notices.`,
  },
  {
    key: 'borrin',
    type: 'pc',
    name: 'Borrin Halt',
    aliases: ['Shadowless'],
    players: true,
    parent: 'lantern-keep',
    image: 'sil:borrin',
    status: 'alive',
    statusKnown: true,
    summary: 'Returned dwarf ranger who came up from under the Grimmark six months ago, casting no shadow, with three years missing.',
    fields: [
      { key: 'Ancestry', value: 'Dwarf (Returned)' },
      { key: 'Role', value: 'Recruit, scout' },
      { key: 'Class (5e)', value: 'Ranger' },
      { key: 'Level', value: '1' },
      { key: 'Background', value: 'Outlander' },
      { key: '5e', value: 'AC 15 (studded leather), HP 13. STR 13, DEX 16, CON 15, INT 10, WIS 14, CHA 8. Longbow 1d8+3, two handaxes. Favoured Enemy (undead); Natural Explorer (underground); darkvision 60 ft; dwarven resilience vs poison.', gm: true },
    ],
    tags: ['pc', 'recruit', 'dwarf', 'returned'],
    relations: [
      { to: 'f-ninth-lantern', kind: 'serves', known: true },
      { to: 'hollowhall', kind: 'came up through', note: 'Six months ago, with three years gone.', known: true },
      { to: 'quorl', kind: 'asks questions of', note: 'Mostly: am I alive?', known: true },
    ],
    body: `### Who he is
Borrin Halt went down under the Grimmark three and a half years ago with a deep-road party out of [[Skarn]], to look for the kin who had gone under in the war and never come back up. He remembers the first week. He remembers coming up through the gate of [[Hollowhall]] six months ago, blinking at a sun he hadn't seen in three years. He does not remember anything in between, and he casts no shadow.

The highland folk have a name for dwarves like him: [[the Returned]]. In the dwarf way a Returned takes a second name, and his is the one the soldiers gave him: **Borrin Halt Shadowless**. He answers to it, because he has stopped expecting better. To the company, he's a wick like any other.

### Look
Broad and short and weathered, beard cut close (Returned dwarves often cut their beards; nobody knows why, and they don't say), with a pale band across his eyes as though he'd worn a blindfold a long time. Grey-green eyes that don't blink quite enough. A longbow of black yew that he did not take down with him and cannot explain. In sunlight he stands in the middle of a lit yard and the ground around his boots is simply bright, all the way round.

### Manner
Patient, watchful, dry. Counts things: steps, coins, people in a room, exits. Sleeps with his back to a wall and wakes before anyone else. Has a habit of stopping mid-sentence as if listening to someone speak behind him. Surface dwarves make the sign of [[Tharos]] when he passes; he has started making it back, which annoys them.

### Background
He was a hunter and pathfinder in the high passes before the war, a good one, with a wife in [[Skarn]] and a dog called Bastard. When he came back, the wife had remarried (she had held his funeral, which he attended, eventually, and stood at the back of) and the dog had died. The clan was polite. Politeness among dwarves is a kind of exile.

He drifted south, taking scout work with caravans, until a caravan master told him that in the [[The Ashenreach|Ashenreach]] nobody minds what you are as long as you can find water. That was nearly true.

### Why you're in Cinderford
The Ninth Lantern needed scouts who could read the ash and see in the dark. He needed somewhere that didn't look at his feet. And there is a dream he keeps having, of a stone with a crack in it and a light at its lip. The first time he saw [[Lantern Hill]] from the road, he knew the light.

### Ties
- **[[Varra Nine-Knuckles]]** signed the roll the same morning. Both outcast from their peoples; neither asks about it. She is the first person in six months to sit beside him without glancing down.
- **[[Quorl Many-Words]]** wants Borrin's last words recorded now, "while you've still got all of them". Borrin keeps asking him, half joking, whether a Raveler can tell if a man is alive.
- **[[Ysse Lampwright]]** looks at the ground near him too long when she thinks he isn't watching.
- **[[Kettle Brindlewake]]** buys his trail maps of the glasslands and pays fair.

### Playing him
A man who lost three years and part of himself and is trying to live in the time he has left. Quiet competence, gallows humour, and the growing suspicion that something remembers those three years for him.

:::for Borrin Halt
**Your secret.** Something followed you up. You know it the way you know someone is standing behind you in a dark room. Three times now, soldiers have told you they saw you somewhere you weren't: on the Low Quay at midnight, on the wall above the Smokes, at the rail of the ford looking down into the water. Once you woke with ash on your boots and no memory of walking.

You think it is your shadow. You think it is wearing your shadow, the way you'd wear a borrowed coat. And when you dream of the stone with the crack in it, you are not the one doing the dreaming.
:::

:::gm
**How his secret pays off.**
- Under the Grimmark the deep-road party reached the breached Eighth Ward. Something there took their shadows as the price of passage. Borrin's was taken by a thing that wanted to come up, and it did, inside the shadow. It is not evil exactly; it is curious, hungry, and very old, and it wants to reach the Ninth Ward's crack to see what's on the other side.
- Plant sightings: old [[Nan Crupp]] at the ferry saw "Borrin" standing on the ford at midnight while he was in his bunk (session 1); [[Mardle Ock]] the Glasser swears he met Borrin in the deep "two years back" (session 2).
- At **Into the Rent** (session 6), the shadow acts on its own: it walks ahead of the party into the Rent, toward the Ninth Stone, and [[Warden Uthrem]] stops dead at the sight of it. Uthrem knows what it is: a thing of the Eighth Ward's dark, one of the forgotten.
- In the finale, the shadow can be bargained with, fought, or sent back through the crack, and if Borrin wants it back he may get it, changed.
:::`,
    gmNotes: `Never describe Borrin's missing shadow as a gimmick: describe what it does to everyone else. Lanterns throw the party's shadows long across the ash, four of them. Let the players count. When the shadow is off doing something, give the GM a quiet beat: "Borrin, roll a Wisdom save. You don't need to know why."`,
  },
  {
    key: 'tick',
    type: 'pc',
    name: 'Tibbet Marlowe',
    aliases: ['Tick'],
    players: true,
    parent: 'the-smokes',
    image: 'sil:tick',
    status: 'alive',
    statusKnown: true,
    summary: 'Hollowborn sapper from the Smokes, hired for his munitions; born the night of the Battle of Cinders, and grown up far too fast.',
    fields: [
      { key: 'Ancestry', value: 'Human (Hollowborn)' },
      { key: 'Role', value: 'Local hire, sapper' },
      { key: 'Class (5e)', value: 'Rogue' },
      { key: 'Level', value: '1' },
      { key: 'Background', value: 'Urchin' },
      { key: '5e', value: 'AC 14 (leather), HP 9. STR 10, DEX 16, CON 13, INT 15, WIS 12, CHA 10. Sneak Attack 1d6; Expertise in tinker\'s tools and Stealth; Thieves\' Cant; Hollowborn dead-sight (left eye sees spirits and the recently dead, 30 ft). Carries 2 flasks of alchemist\'s fire and 1 "Tick special" (DEX save DC 12, 2d6 fire in a 5 ft radius, loud).', gm: true },
    ],
    tags: ['pc', 'local', 'hollowborn'],
    relations: [
      { to: 'f-ninth-lantern', kind: 'serves', note: 'Paid by the barrel, when anyone is paid.', known: true },
      { to: 'npc-ottilie-marlowe', kind: 'raised by', note: 'His grandmother, the Smokes midwife.', known: true },
      { to: 'marla-marlowe', kind: 'son of', note: 'She died the night he was born.' },
      { to: 'npc-skarra', kind: 'rival of', note: 'Professional jealousy, mostly about fuses.', known: true },
    ],
    body: `### Who he is
Tibbet Marlowe was born in the cellar of Marlowe's, his family's house in [[The Smokes]], on the night of [[The Battle of Cinders]], while the plain outside burned and the sky turned red. His grandmother delivered him. His mother died before dawn. He is called **Tick** for the sound he made as a baby and because he has never since sat still; the soldiers assume it's the noise a fuse makes just before it doesn't, and he lets them.

He was one of the first [[The Hollowborn|Hollowborn]]. Thirty-one were born in the Smokes in the two years after Cinders. The twenty-five born after that night are seven and eight years old now, and act it. The six born on the night itself do not. Tick is nine by the calendar, and anyone can see he is not nine. Like the other five, he grew like a weed in ash: walking at four months, talking at six, a gangly lad by three and a man grown by seven. [[Ottilie Marlowe|Mam Ottilie]], the grandmother who raised him and the Smokes' midwife, says he "came out already listening". Nobody knows why the Cinders-born grew so fast, and the midwives of [[Maelis]] have stopped guessing out loud. He has a man's hands, a man's appetites, and occasionally a child's conviction that he cannot possibly die.

### Look
Lanky, sooty, quick, with a wide mouth that is usually grinning and burn-scars on both forearms like a map of bad decisions. His right eye is brown. His left is the milky grey of all Hollowborn eyes, the one that sees the dead, and it is never quite looking where the other one is. He wears a sapper's leather apron with a dozen loops for fuses, and smells permanently of saltpetre and tannery.

### Manner
Fast talker, faster hands. Names his charges ("Little Maelis", "Sorry Darling", "The Reeve's Tax Return"). Laughs when things go bang, every time, even when he shouldn't. Talks to people who aren't there, briefly, and then carries on as if nothing happened.

### Background
Raised by Mam Ottilie and half the Smokes' tanneries, Tick learned his trade from glass-diggers, who need things blown up, and soldiers, who need things blown up more. He was selling blasting-powder to the Glassers before his second birthday, which is a joke the Smokes tell and isn't quite one. He knows every cellar, drain and rooftop in the quarter.

### Why you're in Cinderford
He's from here. [[The Ninth Lantern]] hired him for his munitions after he cleared a collapsed street with one charge and only a little bit of fire, and because [[Fennick Bottlebrook]] can pay him in barrels of salvage, which is cheaper than coin.

### Ties
- **[[Quorl Many-Words]]**: the Doorkeeper's Chapel backs onto the Smokes, and Quorl spent his fledgling years running its errands; they have known each other since Tick was (briefly) small. Quorl says the Rook-Court has Tick's mother's last words in its ledger. Tick has never asked to hear them.
- **[[Ysse Lampwright]]**: "Moth". He brings her things from the glass that burn the wrong colour. She is the only one who looks at the empty space beside him and doesn't look away.
- **[[Varra Nine-Knuckles]]** is his self-appointed bodyguard since he nearly took her eyebrows off. He is grateful and slightly in awe.
- **[[Skarra]]**, the company's orc sapper, thinks he's reckless. He thinks she's slow. They're both right.
- **[[Kettle Brindlewake]]** sells him saltpetre and asks no questions, which is the most suspicious thing about Kettle.

### Playing him
Joy, fire, and something underneath that keeps glancing at the sky. The comic relief who is quietly the most haunted person in the party.

:::for Tibbet Marlowe
**Your secret.** Your mother walks beside you. Marla Marlowe, dead nine years, a little grey woman with ash in her hair and your nose, and only your left eye can see her. She's been there as long as you can remember. She doesn't talk much. She holds your hand at funerals.

When you can't hear her over a crowd, she writes in the ash with one grey finger: short words, badly spelled, gone with the next breath of wind. But mostly she warns you, always, about the red moon. "Don't look at it when it's full, Tibby. It looks back." Lately she has started saying more. "It's nearly time." "Don't let them take you to her." You don't know who *her* is. You don't know what *time* it is nearly. And you have a feeling, which you hate, that your mother is frightened of somebody she knows.

One more thing, small. Every full red moon for as long as you can remember, Mam Ottilie stood you against the cellar door where you were born and cut a mark at the top of your head: at the red moon, never on your birthday. You have counted the marks. They jump at every full Ember, like steps, and between red moons they hardly move at all. They stopped two years ago, when you stopped growing. Mam doesn't know you know.
:::

:::gm
**How his secret pays off.**
- [[Marla Marlowe]] died the night of Cinders, the night [[Hathe]] died, so she could not pass his door. She's one of the first of the unpassing dead, and the Hollowborn eye lets Tick see her.
- Her younger sister, Tick's aunt Wenna, is [[The Dreaming Widow]], leader of [[The Sleepless]]. The Widow knows she is Tick's aunt; Tick does not know who the Widow is. "Her" is the Widow. The Widow believes Tick is the Sleeper's firstborn, the child of the night it dreamed hardest, and she wants him at the Rent's lip under a full red moon. Marla knows. Marla is terrified.
- Tick grew fast, like the five others born in Cinderford that night, because the Sleeper's dream was strongest the night they were born; they grew in steps, one at each full Ember (see [[Why did the Cinders-born grow up so fast?]]). At each full Ember, the dream pulls at him. In **Red Moon Rising** (session 3), he sleepwalks toward the Smokes with the rest of the dreamers unless someone stops him.
- If the ward is resealed, Hathe's old doors steady and Marla can finally pass. Give Tick a goodbye. If it cracks, she stays, and so do thousands more.
:::`,
    gmNotes: `Tick is nine by the calendar and about twenty by any other measure; play it straight and let it be strange, not cute. Marla only appears to Tick's player: pass notes, or whisper. She should be right about everything, three scenes too early to be useful.`,
  },
  {
    key: 'quorl',
    type: 'pc',
    name: 'Quorl Many-Words',
    players: true,
    parent: 'doorkeepers-chapel',
    image: 'sil:quorl',
    status: 'alive',
    statusKnown: true,
    summary: 'Raveler priest of the dead god Hathe and the company\'s undertaker; he buries the Ninth Lantern\'s dead and keeps their last words.',
    fields: [
      { key: 'Ancestry', value: 'Raveler' },
      { key: 'Role', value: 'Local hire, undertaker and chaplain' },
      { key: 'Class (5e)', value: 'Cleric' },
      { key: 'Level', value: '1' },
      { key: 'Background', value: 'Acolyte' },
      { key: '5e', value: 'AC 16 (chain shirt, shield), HP 9. STR 10, DEX 14, CON 12, INT 12, WIS 16, CHA 11. Life Domain (reskinned as the Doors): Disciple of Life. Cantrips spare the dying, thaumaturgy, guidance; bless, cure wounds, healing word. Raveler mimicry (repeats any voice he has heard, perfectly).', gm: true },
    ],
    tags: ['pc', 'local', 'raveler'],
    relations: [
      { to: 'f-ninth-lantern', kind: 'serves', note: 'Paid per burial, which is the only line of the company accounts that never runs short.', known: true },
      { to: 'mother-corvane', kind: 'answers to', known: true },
      { to: 'god-hathe', kind: 'priest of', known: true },
      { to: 'tick', kind: 'grew up with', known: true },
    ],
    body: `### Who he is
Quorl is a priest of a god who has been dead for nine years. He finds this less of a problem than people expect. "Hathe kept doors," he says. "Somebody still has to stand at them." He is [[The Ninth Lantern]]'s undertaker, its chaplain, and its ledger of last words, and he takes all three jobs very seriously and himself not at all.

[[Ravelers]] earn their deed-names at their first burial. Quorl earned his at six years old at [[Corvel Rise]] by talking back to a dying sergeant: at such length, and so well, that the sergeant lived another hour out of sheer irritation and died mid-argument. He has never stopped talking, or collecting.

### Look
Tall, stooped, black-feathered, with a long grey beak notched near the tip and bright black eyes that tilt to look at you sideways. His feathers go iridescent in lamplight. He wears a priest's grey doorkeeper's stole, much mended, over a chain shirt, and carries a ring of old iron keys that open nothing, in honour of the god. Ravelers smell faintly of cold earth and cloves; Quorl smells more of cloves, because he is vain.

### Manner
Morbid, cheerful, curious. Asks people's last words in advance, "in case". Does voices: he can repeat any voice he has heard, perfectly, which he uses for comfort at gravesides and for comedy everywhere else. Tilts his head when interested. Charges for secrets, as all Ravelers do, but his prices are reasonable and he always gives a receipt.

### Background
Fledged at the rookery on Corvel Rise in the last years of the war, Quorl was taught by [[Mother Corvane]] to lay out the dead, keep Hathe's doors, and write down every final word in the Rook-Court's great ledger. He was a fledgling the night of [[The Battle of Cinders]], carrying bodies off the ash until his feathers smoked. The next morning the priests found that Hathe's doors would not open. The dead had begun, sometimes, to stay.

Since then the Rook-Court has buried more carefully. Quorl's prayers are still answered. He has stopped asking by whom.

### Why you're in Cinderford
He's from here, more or less. The Ninth Lantern pays him to bury its dead properly, and properly matters now: an unwatched corpse in the [[The Ashenreach|Ashenreach]] does not always stay down. He keeps the company's death-roll and tells new recruits, kindly, how long the average recruit lasts.

### Ties
- **[[Mother Corvane]]**, head of the Rook-Court, is his teacher and superior. He reports every last word to her. Almost every last word.
- **[[Tick]]** grew up behind the Doorkeeper's Chapel, where Quorl ran errands as a fledgling. Quorl keeps Tick's mother's last words in the ledger and is waiting for Tick to ask.
- **[[Ysse Lampwright]]** shares his night watch. She is the only living person who has asked him what Hathe was like.
- **[[Borrin Halt]]**: Quorl wants his last words on record early. Borrin keeps asking if a Raveler can tell whether a man's alive. Quorl keeps saying "Mostly."
- **[[Varra Nine-Knuckles]]**: he measured her for a coffin on her first day. She asked for a roomy one. He liked her at once.

### Playing him
A gravedigger who loves the living. The party's memory, its conscience at funerals, and the first one to joke when someone dies, because the dead deserve a laugh too.

:::for Quorl Many-Words
**Your secret.** Seven dying soldiers have whispered the same sentence to you. Seven deaths across nine years: different soldiers, different wounds, one of them a recruit who'd been in the company four days. The same words each time, in the same order, in your ear:

*"The lamp is the lock."*

You have written all seven in your own notebook. You have not written them in the Rook-Court's ledger, and you have not told Mother Corvane. You don't know why you haven't. Except that the seventh time, three weeks ago, the dying man gripped your wrist and added, in a voice that wasn't his: "Don't let them put it out."
:::

:::gm
**How his secret pays off.**
- The Rook-Court's ledger, read together, spells out the same words. [[Mother Corvane]] has already guessed, and hasn't told Quorl, just as he hasn't told her. When old Halloran Pike sits up at his own funeral ([[The Funeral That Would Not End]], end of session 4 or start of session 5), his last words make it eight, said aloud in front of Corvane. In **Last Words** (session 5), putting Quorl's notebook beside the ledger confirms the message.
- "Don't let them put it out" is the dead warning him, among others, about Mother Corvane: she believes that putting the lamp out would open Hathe's doors and let the dead rest. She is wrong, and sincere.
- Quorl's prayers are answered, and Hathe is dead. The truth, if you want it: Hathe's dying power went into Ilyra, so prayers to Hathe now reach her, and she has been answering them. She knows Quorl's name. In session 4 [[Sister Seraphine]] can greet him by it, and know what he last prayed for.
:::`,
    gmNotes: `Quorl's mimicry is a gift to the GM: he can repeat any voice he's heard, so let him imitate an NPC to fool a guard, or replay a dead man's last words so others hear them. Every time someone in the company dies, ask Quorl's player what their last words were.`,
  },
  // ───────────────────────────── The Ninth Lantern's officers ─────────────────────────────
  {
    key: 'ilse-marrow',
    type: 'npc',
    name: 'Ilse Marrow',
    aliases: ['Captain Marrow'],
    players: true,
    parent: 'lantern-keep',
    image: 'sil:ilse-marrow',
    status: 'alive',
    statusKnown: true,
    summary: 'Captain of the Ninth Lantern "by attrition": the last officer who could count, holding an unpaid company together by will and arithmetic.',
    fields: [
      { key: 'Ancestry', value: 'Human' },
      { key: 'Role', value: 'Captain of the Ninth Lantern' },
      { key: 'Faction', value: 'The Ninth Lantern' },
      { key: 'Where', value: 'The Lantern Keep' },
      { key: '5e', value: 'Knight, reskinned: AC 16 (brigandine), HP 52, keeps Leadership (1/short rest, allies within 30 ft add 1d4). Swaps Parry for "I said hold": one ally within 30 ft may ignore being frightened.', gm: true },
    ],
    tags: ['npc', 'ninth-lantern', 'officer'],
    relations: [
      { to: 'f-ninth-lantern', kind: 'leads', known: true },
      { to: 'sorrel-vey', kind: 'visits', note: 'By the back stair. The town pretends not to know.', known: true },
      { to: 'sorrel-vey', kind: 'loves', note: 'That part, nobody knows.' },
      { to: 'tollamund', kind: 'owes money to', note: 'The company\'s debts, signed in her hand.', known: true },
      { to: 'fennick', kind: 'trusts', note: 'More than she should, and not as much as he deserves.', known: true },
    ],
    body: `### Look and voice
Forty-four, lean as a fence post, with grey-shot hair cropped short so it won't need doing and a quartermaster's ink stains that never quite washed out. She wears a good officer's coat, brushed every morning, patched at both elbows. Reading spectacles she takes off whenever anyone comes in, and loses daily. Round her neck on a cord, one of the three keys to the lantern's cage.

Her voice is low, dry, and very tired, and it carries across a drill yard without being raised.

> "Captain? By attrition. The first three died of an arrow, the flux and a horse. I was the last one left who could count. Turns out that's the job."

> "I'm not asking you to die for the company. I'm asking you to be on time. The dying is optional."

### Who she is
Ilse Marrow was a supply clerk with the Salt Guard, one of the eight companies that swore to hold Cinderford's walls in 3002. Her company's lantern went dark in the second hour of [[The Battle of Cinders]]. She walked out of the burning with a ledger under one arm and a wounded boy under the other, and found herself among the cooks and deserters who lit the ninth lantern. She has been with [[The Ninth Lantern]] ever since, and its captain since 3007.

### What she wants
Her people fed, paid if possible, alive if not. A winter without a funeral. A contract that means something. She would very much like an evening off.

### What she knows
The real state of the company's money, which is none. That the Regency stopped paying in 3009 ([[The Regency Stops Paying]]) and that the Concord has been buying up the debt. That [[Garrick Sallow]] wants her job. That the lantern matters more than anyone in the company understands, though she couldn't say why; she just knows she sleeps worse when it flickers.

### How she treats the PCs
New, which means not yet in anyone's pocket, which means useful. She is blunt with them, fair, and quietly kind: she learns their names on day one and uses them. She gives them the jobs she can't trust to anyone with a history: following the drowned man, chasing the pay, watching the oil.

:::gm
**Secret.** For the last year Marrow has paid the company out of her own savings, coin by coin, everything she had put by for a farm she was never going to buy. It ran out last month. The day the pay doesn't come is the first day she has nothing left to cover it with. She has told no one, not even [[Fennick Bottlebrook]], who is quietly doing the same thing with the books.

She is also the lover of [[Madame Vey]] of [[The Velvet Ledger]]. The whole town knows the Captain uses the Ledger's back stair and pretends not to; most assume it's business, or comfort. It is love. It began as a negotiation for the company's credit and stopped being one very quickly. Sorrel is the only person she lets see her tired. She does not know what Sorrel's tattoos record, or how much of what she tells Sorrel goes into the Ledger's book.
:::`,
    gmNotes: `**Voice:** short sentences; dry; she thinks in numbers ("Forty-one rations, sixty mouths"). Takes off her spectacles to deliver bad news.

**Across the arc:**
1. **Payday**: announces the pay hasn't come; holds the yard by force of will; sends the PCs after the drowned man.
2. **The Assessor**: has to host [[Pell Quillon]] while he taxes her unpaid company; sends the PCs after the pay wagon.
3. **Red Moon Rising**: the lantern gutters and [[Brother Tallow]] falls; she stands on the wall all night and doesn't sleep.
4. **The House of Unburnt Light**: [[Sister Seraphine]] courts her openly and offers the Saint's coin for the flame. She is tempted, badly. If the PCs learn about Sorrel, they can use it, or protect it.
5. **Last Words**: learns where the lantern was really lit; starts to understand what she's guarding.
6. **Into the Rent**: stays behind to hold the town.
7. **Three Knives**: Sallow's mutiny breaks. She will be deposed, locked up or killed unless the PCs act. If she falls, Vosk or a PC takes command.
8. **The Lantern Gutters**: the contract says the company ends if the lantern goes out. She will ask the PCs to choose the ending knowing it may end her company. She will not order them.`,
  },
  {
    key: 'mirrel-vosk',
    type: 'npc',
    name: 'Mirrel Vosk',
    aliases: ['Sergeant Vosk'],
    players: true,
    parent: 'lantern-keep',
    image: 'sil:mirrel-vosk',
    status: 'alive',
    statusKnown: true,
    summary: 'Orc sergeant and Second Blade of the Ninth Lantern: drills recruits, buries friends, and jokes about both.',
    fields: [
      { key: 'Ancestry', value: 'Orc' },
      { key: 'Role', value: 'Sergeant, Second Blade' },
      { key: 'Faction', value: 'The Ninth Lantern' },
      { key: 'Where', value: 'The Lantern Keep (drill yard)' },
      { key: '5e', value: 'Veteran: AC 17 (splint), HP 67, longsword and heavy crossbow. Adds Relentless Endurance and "Thirty Years of This": advantage on saves against being frightened.', gm: true },
    ],
    tags: ['npc', 'ninth-lantern', 'officer', 'orc'],
    relations: [
      { to: 'grashka', kind: 'served under', note: 'In the Iron Guard, thirty years ago.' },
      { to: 'ilse-marrow', kind: 'protects', known: true },
      { to: 'garrick-sallow', kind: 'despises', known: true },
      { to: 'varra', kind: 'watches over', note: 'He knows whose granddaughter she is.' },
    ],
    body: `### Look and voice
Grey-skinned, grey-maned, built like a door that has been kicked a great deal and stayed shut. One tusk broken to a stump. His left ear is mostly gone and he wears a brass ring through what's left. He moves slowly until he doesn't. When he stands at the end of the drill yard with his arms folded, recruits find they have stopped talking without deciding to.

His voice is deep and gravelly and never in a hurry, and almost everything he says is a joke, delivered with the face of a man reading out a death sentence.

> "Welcome to the Ninth Lantern, wicks. Most of you will die. The rest of you will wish you had. Questions? No? Good. We haven't got time for answers."

> "That's the Sergeant up there." (He points at the red moon.) "Always watching. Never pays. Exactly like me."

### Who he is
Mirrel Vosk has been a soldier for thirty-four years, which is longer than most of the company has been alive. He has served in five companies and buried four of them. He is the Ninth Lantern's **Second Blade**, the captain's deputy by orc custom, who stands at her left and says the things she can't. He carries the third of the three cage keys. Old soldiers say he was Iron Guard in the old days, before the [[Kingslayers]] got their name. He says he was a baker.

### What he wants
To keep recruits alive long enough to be useful, and the useful ones alive long enough to get old. To see [[Captain Marrow]] sleep a full night. To never again stand in a palace.

### What he knows
Every soldier in the company by name, and which of them are wobbling toward [[Garrick Sallow]]. How to hold a wall with forty people. That the red moon makes the dead restless; he was at Cinders, and he saw what walked the ash the next night.

### How he treats the PCs
Hard, then fair, then fond, in that order, and he never admits to the third. He gives every recruit a nickname in the first week and it is always unkind and always sticks. He looks at [[Varra Nine-Knuckles]] for a long moment on the first day and gives her none.

:::gm
**Secret.** Vosk served in the Iron Guard under Grashka, now Mother of Mothers. On the afternoon of 14 Frostcall 2981 he stood at the door of the Gilded Gallery in [[Caer Ardith]] during petitions on the bean tax, and watched Grashka step out of the line. It took one blow. Then the Guard walked out, all of them, and he walked with them, and nobody stopped them. That was [[The Kingslaying]].

He has never told anyone. He thinks the Mothers had a reason. He has never known what it was, and once a year, on the eve of Cinders, he takes a bottle to the [[The Corporal's Gibbet|Corporal's Gibbet]] and doesn't talk about it.

He recognised Grashka's face in Varra's the moment she walked in.
:::`,
    gmNotes: `**Voice:** slow, deadpan, gravel. All recruits are "wicks" until they stand a night beside the cage; after that, Vosk gives them a nickname (Borrin is "Lamp-Post" because nothing casts a shadow behind him; Tick is "Fuse"; Ysse is "Snuff"; Quorl is "Vicar"). Varra gets none, and the company notices.

**Across the arc:**
1. Runs the yard on payday; first to call the mutterers mutineers, out loud, to their faces.
2. Lends the PCs two soldiers for the ash crossing ([[Jory Dunmore]] and [[Jessom Dunmore]], who argue the whole way).
3. On the red moon night, holds the gate against the dreamers without killing any of them, which is harder.
4–5. If Varra asks him straight, he tells her about the palace. Not before.
6. Wants to go into the Rent; Marrow won't let both of them leave.
7. The mutiny's key: if Vosk stands with Marrow, half the company follows him. Sallow knows this and tries to have him killed first. A strong scene for the PCs to prevent.
8. If the company ends, he says he'll finally open that bakery.`,
  },
  {
    key: 'brother-tallow',
    type: 'npc',
    name: 'Brother Tallow',
    players: true,
    parent: 'lantern-keep',
    image: 'sil:brother-tallow',
    status: 'alive',
    statusKnown: true,
    summary: 'Old Vesh lantern-keeper of the Ninth Lantern, nearly blind, who has tended the flame for nine years and is afraid of what it is.',
    fields: [
      { key: 'Ancestry', value: 'Vesh' },
      { key: 'Role', value: 'Lantern-keeper' },
      { key: 'Faction', value: 'The Ninth Lantern' },
      { key: 'Where', value: 'The lantern cage, Lantern Hill' },
      { key: '5e', value: 'Acolyte, reskinned: AC 10, HP 9. Blind beyond 10 ft, but antennae give blindsight 10 ft. Knows light, sacred flame, sanctuary; can sense any flame within a mile.', gm: true },
    ],
    tags: ['npc', 'ninth-lantern', 'vesh'],
    relations: [
      { to: 'ysse', kind: 'teaches', known: true },
      { to: 'item-lantern', kind: 'tends', note: 'Every night for nine years.', known: true },
      { to: 'mother-corvane', kind: 'confides in', note: 'Old friends; two night-creatures on a hill.' },
    ],
    body: `### Look and voice
Very old for a Vesh, bent nearly double, his wing-like cloak gone threadbare and silver at the edges. His great dark eyes have clouded over with milk; he tilts his long feathered antennae toward voices instead. His hands are spotted with old burns and never stop moving: trimming, polishing, wiping soot. He smells of lamp oil and warm dust.

He speaks softly, with long pauses, and calls everyone "child", including Sergeant Vosk.

> "Mm. Don't say *out*, child. The flame doesn't like the word."

> "I have kept lamps for a hundred and six years. I have never kept one that kept me back."

### Who he is
Brother Tallow was a lamp-keeper in a Vesh library when the war came, and a lamp-keeper in a field hospital when the war came closer. On the night of [[The Battle of Cinders]] he was one of the cooks, drivers and walking wounded hiding in the pear orchard behind the lines, and he followed a ninth lantern nobody had counted up to the Keep. He did not light it; the company's legend names who did, and he lets the legend talk. He was the one who knelt and fed it oil at dawn when it nearly guttered. He has tended it every night since, in its iron cage on [[Lantern Hill]], and in nine years it has not gone out. He carries the first of the three cage keys.

### What he wants
To keep the flame lit. To teach [[Ysse Lampwright]] everything before his eyes go entirely. To be wrong about what he suspects.

### What he knows
The lantern's moods, which he talks about like a horse's: it leans east in a greywind, toward the Rent; it burns blue at full red moon; it has once, during a storm, burned for a whole night with an empty reservoir. He knows the oil has been tasting wrong for a month. He has been blaming his tongue.

### How he treats the PCs
Gentle, delighted by visitors, especially ones who ask questions. He is fiercely protective of Ysse and a little in awe of her. He asks every PC to describe the flame to him, every time they see it, "so I know it's still pretty".

:::gm
**Secret.** In the lantern's iron base, beneath the cage, lies a splinter of grey stone ([[The Ward Shard]]) that Mother Hennet carried up from the orchard in a soup-pot the night the lantern was lit, still burning. Tallow set it there with his own hands, has kept it there for nine years, cleaned round it, and told nobody that it is always cold, even with the flame standing on it.

He suspects what the flame is. He noticed in the first year that it casts no heat on one side, the side facing [[The Rent]]; that it brightens when someone casts a spell nearby, as if it were feeding; that Vesh-sight shows it as a thin place in the world, the way a ward looks. He believes it is a piece of a ward, burning. He is afraid to say so, because if it's true, the company's contract, the town's peace and the lives of everyone in the March hang on one old blind moth trimming a wick, and he is not sure he can bear being that important.

He confides only in [[Mother Corvane]], an old friend, and even to her only in hints.
:::`,
    gmNotes: `**Voice:** slow, gentle, long pauses; "child"; describes the flame as if it's an animal.

**Across the arc:**
1. Notices the oil is wrong; when the lantern gutters at the end of the session, he cries out as if struck.
2. Asks Ysse to taste the oil and tell him he's mad. She can't.
3. **Red Moon Rising**: the flame burns blue and gutters; Tallow collapses at the cage and doesn't wake for a day. Ysse keeps the flame alone.
4. Wakes nearly fully blind; formally names Ysse keeper. Warns her against [[Sister Seraphine]] without saying why.
5. Confesses his suspicion to the PCs: "I think it is not a lamp. I think it is a door, held shut."
6–7. Too frail to travel. In session 7 he is an obvious target: whoever wants the flame wants its keeper out of the way.
8. If the ward is resealed and the flame goes out, he sits with the empty lantern until morning and then says he would like some tea.`,
  },
  {
    key: 'fennick',
    type: 'npc',
    name: 'Fennick Bottlebrook',
    players: true,
    parent: 'lantern-keep',
    image: 'sil:fennick',
    status: 'alive',
    statusKnown: true,
    summary: 'Halfling quartermaster of the Ninth Lantern, balancing books that cannot balance by methods best not examined.',
    fields: [
      { key: 'Ancestry', value: 'Halfling' },
      { key: 'Role', value: 'Quartermaster' },
      { key: 'Faction', value: 'The Ninth Lantern' },
      { key: 'Where', value: 'The stores, Lantern Keep' },
      { key: '5e', value: 'Spy, reskinned: AC 12, HP 22, a short sword he has never drawn. Keeps Cunning Action. Proficient with forgery kit (+6).', gm: true },
    ],
    tags: ['npc', 'ninth-lantern', 'halfling'],
    relations: [
      { to: 'tollamund', kind: 'owes money to', note: 'Personally, and far more than a quartermaster earns.' },
      { to: 'kettle', kind: 'cousin of', note: 'Twice removed, once forgiven.', known: true },
      { to: 'kettle', kind: 'sold oil to', note: 'Six casks of the good oil, for bread.' },
      { to: 'f-barge-clans', kind: 'born into', known: true },
    ],
    body: `### Look and voice
Small, round, pink-cheeked and very neat, with curly brown hair oiled flat, a waistcoat with nine pockets and a pencil behind each ear. He wears spectacles on a ribbon and a look of permanent arithmetic. His storeroom is the tidiest place in the Keep, with three locks on the door; the books on its shelf are the least tidy thing in it.

He talks fast, precisely and slightly too much, especially when nervous, and he is always slightly nervous.

> "It isn't *missing*. It's been reallocated across a temporally flexible ledger. That's an accounting term. I invented it, but it's an accounting term."

> "Forty barrels of salt pork, minus the eleven that were salt, minus the six that were pork in a technical sense only..."

### Who he is
Fennick Bottlebrook was born on a barge on the river Cinder and ran away to be a clerk, which his family of smugglers considers worse than prison. He became quartermaster of [[The Ninth Lantern]] in 3006 when the previous quartermaster was found to have sold the company's winter boots to the company. Fennick has sold nothing to the company. He has sold a great deal *for* it.

### What he wants
For the books to balance. They won't. Failing that, for the company to eat. He would also like, very much, for nobody to look closely at the books.

### What he knows
Exactly how much food is left (eleven days, nine if the new recruits eat like [[Varra Nine-Knuckles]]). Which salvage can be sold at [[Gutter Market]] without questions. That the company has been drawing from three different credit lines, one of which is in his own name. Exactly how much lantern oil the company has bought this quarter, and how much he has written down that it burned, which are not the same number.

### How he treats the PCs
Fussy, friendly and transactional. He will find them gear if they find him something to sell. He keeps a small separate ledger of favours owed, and honours it scrupulously.

:::gm
**Secret.** Fennick cooks the books to feed the company: double-entry with three sets of doubles, salvage sold through his cousin [[Kettle Brindlewake]], and loans he has signed personally with [[Grandmother Tollamund]] at [[Tollamund & Daughters]]. He owes the counting-house more than he will earn in his life. Tollamund has not called it in. Tollamund is waiting for something.

**The red herring.** Last month Fennick sold six casks of the company's good lantern oil to Kettle to buy bread, and wrote them up as burned: twelve casks bought, twelve burned, says the ledger. When the lantern gutters he will be certain it's his fault, and he will act exactly like a guilty man. It isn't his fault. The oil he sold was good; the poisoned oil came from [[Garrick Sallow]] and [[Dannic Rook]]. He is the obvious suspect, and the wrong one.
:::`,
    gmNotes: `**Voice:** fast, fussy, digressive; keeps doing sums aloud.

**Across the arc:**
1. Gets shifty about oil. The ledger says twelve casks bought and twelve burned. Let the PCs suspect him; it's what he's for.
2. Desperately needs the pay wagon found; offers a bonus he can't pay.
3–4. Tollamund's clerk visits him; he comes back grey-faced. The counting-house is starting to collect.
5. If the PCs uncover his debts, he confesses everything in one long breathless paragraph.
7. **Three Knives**: the Concord's move goes through his debt. He can be made to sign the company's stores over, or to hand the Keep's keys to Tollamund's people. What he does depends on whether the PCs stood by him earlier.
8. If the company ends, he insists on closing the books properly. All three sets.`,
  },
  {
    key: 'garrick-sallow',
    type: 'npc',
    name: 'Garrick Sallow',
    aliases: ['Lieutenant Sallow'],
    players: true,
    parent: 'lantern-keep',
    image: 'sil:garrick-sallow',
    status: 'alive',
    statusKnown: true,
    summary: 'Ambitious, handsome lieutenant of the Ninth Lantern who thinks an unpaid company needs a new captain, and says so reasonably.',
    fields: [
      { key: 'Ancestry', value: 'Human' },
      { key: 'Role', value: 'Lieutenant' },
      { key: 'Faction', value: 'The Ninth Lantern' },
      { key: 'Where', value: 'The Lantern Keep; evenings at the Last Candle' },
      { key: 'Paid by', value: 'The Quiet Office, through Ansel Mote', gm: true },
      { key: '5e', value: 'Veteran: AC 17 (half plate, polished), HP 58, rapier instead of longsword. Adds "Reasonable Man": once per scene, advantage on Persuasion with soldiers.', gm: true },
    ],
    tags: ['npc', 'ninth-lantern', 'officer'],
    relations: [
      { to: 'ilse-marrow', kind: 'rival of', note: 'Wants her command.', known: true },
      { to: 'ansel-mote', kind: 'paid by', note: 'Quiet Office silver, for a mutiny.' },
      { to: 'f-quiet-office', kind: 'secretly serves' },
      { to: 'npc-dunstan-bray', kind: 'commands', note: 'His man in the ranks.' },
      { to: 'dannic-rook', kind: 'paid', note: 'To swap the oil. "One more swap and you\'re square."' },
    ],
    body: `### Look and voice
Thirty, tall, fair, and handsome in the way of a portrait commissioned by his mother. His uniform is the only one in the company that fits, and he keeps it that way. He has a soldier's scars, two of them, in places that show. He smiles a great deal and almost always means it, which is what makes him dangerous.

He speaks warmly and reasonably and never raises his voice. He is always the calmest person in the room.

> "Nobody wants a mutiny. Nobody. I'm only saying that a company that isn't paid isn't a company. It's a crowd with swords, waiting for somebody to tell it what to do."

> "The Captain is a good woman. I'd die for her. I'd just rather not die *because* of her."

### Who he is
Garrick Sallow is the third son of a minor Regency house in the [[Fallowden]] country, which means he inherited a name, a good sword and nothing else. He bought a commission in a river company during the last years of [[The War of the Empty Throne]], fought well at the tail end of it, and came to [[The Ninth Lantern]] in 3008, when it still had money. He is a competent officer. He is popular. He thinks, honestly, that he would be a better captain than [[Captain Marrow]], and he may be right.

### What he wants
Command. A paid company. A commission from someone who can afford one. To be on the winning side, once, from the start.

### What he knows
Which soldiers are angriest and what each of them wants. That the Regency could pay, if the company served it directly. That there are people in the Regency who would very much like the lantern brought "under proper authority".

### How he treats the PCs
Charming. He buys new recruits a drink at [[The Last Candle]] in their first week and asks about their families. He will try to recruit at least one PC to his "reasonable" view, and he will remember who said no.

:::gm
**Secret.** Sallow is paid by [[The Quiet Office]], through [[Ansel Mote]], to break the company: mutiny, then a new captain (him), then the lantern handed to the Regency "for safekeeping". He was promised a captaincy under the Regency and a seat on the March's council. He tells himself he's saving the company. The money is very good.

He paid [[Dannic Rook]], who owed money all over the company, to swap the lantern's good oil for tins cut with ash (the tins came from Mote; the ash, Sallow has never asked, came from [[The Dreaming Widow]] and smells of lake water). The idea: frighten the soldiers, make the flame look like it's failing on Marrow's watch. He does not know what the flame is. He thinks it's a symbol. He would be appalled to learn he has been strangling a ward. Mote has given him a copy of one of the cage keys.

He does not know that Mote drowned Rook. He thinks Rook simply ran, and he is relieved. His man in the ranks, [[Dunstan Bray]], counts heads for the mutiny.
:::`,
    gmNotes: `**Voice:** warm, reasonable, never rattled. Uses first names.

**Across the arc:**
1. Leads the grumbling on payday, gently. "Let's hear the Captain out."
2. Volunteers to "help" the Assessor, so he's close to Mote.
3. After the lantern gutters, says aloud what everyone's thinking: "It's going out on her watch."
4–5. Builds his faction; tries to recruit a PC. If a PC investigates the oil too closely, Bray is quietly told to stop them.
6. With the PCs gone into the Rent, he makes his move in the Keep; the PCs return to a company half-turned.
7. **Three Knives**: the mutiny breaks open. If unmasked (Mote's silver, Bray's confession), most soldiers turn on him. Mote will try to kill him before he can talk.
8. If he survives, he may be the one who has to decide whether to stand with the company at the end. Give him a moment of redemption or of cowardice; let the players' choices decide which.`,
  },
  {
    key: 'spoons',
    type: 'npc',
    name: 'Spoons Aldane',
    aliases: ['Spoons'],
    players: true,
    parent: 'last-candle',
    image: 'sil:spoons',
    status: 'alive',
    statusKnown: true,
    summary: 'Corporal of the Ninth Lantern who runs a betting book on everything, including when the lantern goes out.',
    fields: [
      { key: 'Ancestry', value: 'Human' },
      { key: 'Role', value: 'Corporal, bookmaker' },
      { key: 'Faction', value: 'The Ninth Lantern' },
      { key: 'Where', value: 'The Last Candle, corner table' },
      { key: '5e', value: 'Bandit captain, reskinned: AC 14 (studded leather), HP 45, scimitar and dagger; swap Parry for "Lay Off the Bet": once per day, reroll any one die and take either result.', gm: true },
    ],
    tags: ['npc', 'ninth-lantern', 'soldier'],
    relations: [
      { to: 'dannic-rook', kind: 'knows the secret of', note: 'Saw him at the oil store.' },
      { to: 'kettle', kind: 'owes money to', note: 'Lost a bet on the river.', known: true },
      { to: 'garrick-sallow', kind: 'saw', note: 'At the oil store, with Dannic, after midnight.' },
      { to: 'garrick-sallow', kind: 'takes bets on', note: '3 to 1 he\'s captain by Longnight.', known: true },
    ],
    body: `### Look and voice
Short, wiry, quick-eyed, forty-ish, with a broken nose set slightly wrong and a gap in his front teeth he whistles through when he's thinking. He wears a corporal's knot on a coat three sizes too big, won at cards from a man who was three sizes bigger. There is always a wooden spoon in his top pocket.

He talks like a man who never stops working a crowd.

> "Odds on the new girl being dead by Restday are four to one, and I'm being generous, because I like her face."

> "Everything's a bet, friend. Breakfast's a bet. *Getting up* is a bet. I just write it down."

### Who he is
Corporal Aldane has been called **Spoons** so long that the company roll lists him that way. Nobody agrees why. He says it's because he plays them (he does, badly, at every wake). Old hands say it's because he once killed a Regency sergeant with one. He was at Cinders as a camp sutler, selling dice and gin to men who would be dead by morning, and somehow walked into the ninth lantern's light with his pockets full.

He runs the company's betting book from a corner table at [[The Last Candle]]: odds on births, deaths, promotions, desertions, weather, the Captain's temper, the colour of the Reeve's hat. His book is honest. He's very proud of that.

### What he wants
To win the big one. His longest-running pool is on **the night the lantern goes out**: nine years of soldiers have bet a copper on a date, and the pot is real money now. Spoons has his own copper on a date coming up very soon.

### What he knows
Everyone's debts, everyone's vices, and everyone's odds. Who's drinking with [[Garrick Sallow]]. Who slipped out after curfew. And more than he should about the oil.

### How he treats the PCs
As a fresh market. He opens a book on each PC in their first week (odds on survival, on promotion, on "first to sleep with somebody unwise") and tells them their odds, cheerfully. Bet with him and he becomes a friend for life, a short one or long.

:::gm
**Secret.** A fortnight before session 1, Spoons saw [[Garrick Sallow]] and [[Dannic Rook]] at the lantern's oil store after midnight, swapping tins. He knew what it meant. He moved his own copper in the lantern pool to the next red moon, and said nothing, to protect the pool. When Rook deserted, Spoons doubled his stake.

Also among his betting slips, won at cards years ago from a Regency clerk: a torn page of an imperial Treasury ledger with the line *Drainage Works (Western)* on it. He thinks it's funny. It's a thread to [[The Emperor's Digs]].

He is not a monster; he simply never thought it would *work*. Once the lantern gutters in session 1, he is frightened, and guilty, and still has the bet. Press him (or win a large bet from him) and he will trade what he saw for his marker back.
:::`,
    gmNotes: `**Voice:** a bookie's patter; everything quoted in odds; whistles through the gap in his teeth.

**Across the arc:**
1. Takes bets on the drowned man ("five to two he walks again"). Knows about the oil; says nothing.
2. Offers odds on the pay wagon ever being found. Tells the PCs the odds have changed when they come back alive.
3. After the lantern gutters, closes the lantern pool "for maintenance". This is suspicious, and soldiers notice.
4–5. The PCs' best source on who's with Sallow. Gives up what he saw at the oil store if offered a good enough reason or a good enough wager.
7. Bets on the mutiny, both sides. If cornered, chooses the company, to his own surprise.
8. Whatever happens to the lantern, he has to pay out or collect. Let him do it, publicly, at the Last Candle. It's a good epilogue.`,
  },
  // ───────────────────────────── Cinderford's notables ─────────────────────────────
  {
    key: 'odile-fairweather',
    type: 'npc',
    name: 'Odile Fairweather',
    aliases: ['the Reeve', 'Reeve Fairweather'],
    players: true,
    parent: 'cinderford',
    image: 'sil:odile-fairweather',
    status: 'alive',
    statusKnown: true,
    summary: 'Reeve of Cinderford: practical, plain-spoken, and determined that her town will outlive the company that guards it.',
    fields: [
      { key: 'Ancestry', value: 'Human' },
      { key: 'Role', value: 'Reeve of Cinderford' },
      { key: 'Faction', value: 'Cinderford (the town council)' },
      { key: 'Where', value: 'The Reeve\'s hall by the Ford' },
      { key: '5e', value: 'Noble: AC 11, HP 9. Can call 8 guards (town watch) in two rounds. Persuasion +5, Insight +4.', gm: true },
    ],
    tags: ['npc', 'cinderford', 'official'],
    relations: [
      { to: 'cinderford', kind: 'governs', known: true },
      { to: 'f-concord-houses', kind: 'sold the charter to', note: 'Agreed in principle; papers not yet sealed.' },
      { to: 'tollamund', kind: 'bargains with', known: true },
      { to: 'ilse-marrow', kind: 'respects', note: 'And doesn\'t trust her company to last.', known: true },
    ],
    body: `### Look and voice
Fifty-five, broad and weathered, with a farmer's forearms and a magistrate's chain she wears over a waxed coat because she is usually somewhere wet. Iron-grey hair under a hat: a different hat every day, which the soldiers bet on. Clear blue eyes that are always counting heads.

She speaks plainly and quickly, and she has a way of finishing other people's sentences for them, usually more bluntly.

> "Companies come and go, Captain. Cinderford stays. That's what a town is: the thing that's left over."

> "I don't care who's right. I care who's paying for the roof."

### Who she is
Odile Fairweather came to [[Cinderford]] in 3003, the year after [[The Battle of Cinders]], with a wagon, two sons and a charter from the Treaty commissioners to rebuild a town that everyone else had given up for ash. She rebuilt it. Grey stone, slate roofs, wells sunk below the ash line, a toll bridge at [[The Ford]] and a bell to ring it shut. One of her sons died of the glass-lung in 3006; the other runs the toll. She has been Reeve for eight years, elected three times, never opposed.

### What she wants
A town that outlives [[The Ninth Lantern]]. A charter nobody can tear up. Grain stores for two winters. Roads. She thinks of the company the way a farmer thinks of weather: necessary, unreliable, and not to be relied upon for the harvest.

### What she knows
Every family in town and what they owe. That the company can't pay the town for its bread much longer. That the Concord's banks are buying up the March's debts, and what they're offering. That the [[The Sleepless|Sleepless]] are growing in [[The Smokes]], and that half the people who go to their meetings are her own tanners, who are simply very tired.

### How she treats the PCs
Courteous, brisk and practical: they are the company's, so they are useful to her but not hers. She will pay them for jobs the company won't do (a missing child, a flooded cellar, a quarrel on the Low Quay), and she pays on time, which makes her the only employer in the March who does.

:::gm
**Secret.** Odile has quietly agreed to sell Cinderford's charter to [[The Concord Houses]], through [[Grandmother Tollamund]]. In return the Concord will pay the town's debts, guarantee its grain, and garrison it with Concord-paid soldiers if the Ninth Lantern stands down. The papers are drafted and waiting at [[Tollamund & Daughters]]. She hasn't signed. She tells herself she's waiting for the right terms. Really she's waiting to see if the company survives.

She doesn't know that the Concord wants the lantern far more than the town, or that the charter's fine print gives Tollamund the Keep and "all fixtures and fittings thereof".
:::`,
    gmNotes: `**Voice:** brisk, blunt, warm underneath; finishes sentences.

**Across the arc:**
1. Comes up to the Keep on payday to ask, politely, who's paying for the bread now.
2. Gives the Assessor a room and a very long look.
3. After the red moon, she's frightened: a third of the town dreamed the same dream. She asks the PCs what it means.
4. Tollamund presses her to sign. If the PCs learn about the charter, she defends it fiercely: "And what's your plan, soldier? Starve politely?"
5–6. If the PCs have earned her trust, she shows them the fine print and asks what "fixtures and fittings" includes.
7. **Three Knives**: the Concord's move. She signs (and the Concord's people walk into the Keep), or she tears it up publicly (and the town has to face winter alone). The PCs' choices decide.
8. Whatever happens, she rings the Treaty Bell at dawn and starts organising the clean-up.`,
  },
  {
    key: 'pell-quillon',
    type: 'npc',
    name: 'Pell Quillon',
    aliases: ['the Assessor', 'Assessor Quillon'],
    players: true,
    parent: 'assessors-office',
    image: 'sil:pell-quillon',
    status: 'alive',
    statusKnown: true,
    summary: 'Regency Fourth Assistant Under-Collector, come to tax a company the Regency has not paid: earnest, harmless, and drowning in forms.',
    fields: [
      { key: 'Ancestry', value: 'Human' },
      { key: 'Role', value: 'Fourth Assistant Under-Collector (Regency)' },
      { key: 'Faction', value: 'The Regency Council' },
      { key: 'Where', value: 'The Assessor\'s Office' },
      { key: '5e', value: 'Commoner: AC 10, HP 4 (2 if you count his dignity). Investigation +6 for anything written down.', gm: true },
    ],
    tags: ['npc', 'regency', 'official'],
    relations: [
      { to: 'f-regency-council', kind: 'serves', known: true },
      { to: 'ansel-mote', kind: 'employs', note: 'His clerk. A treasure.', known: true },
      { to: 'npc-widow-pruitt', kind: 'relies on', note: 'She does the sums.', known: true },
    ],
    body: `### Look and voice
Thin, stooped, thirty-eight going on sixty, with a long earnest face, ink to the wrists and a Regency official's black coat gone green at the seams. He carries a satchel of forms the size of a small dog and an inkpot on a chain round his neck, "for emergencies". He apologises to doors.

He talks in complete, careful, slightly breathless sentences, as though reading aloud from a regulation.

> "I'm terribly sorry, Captain. I'm afraid I must ask you to complete this form in triplicate. The third copy is for the fire. Should there be a fire. There usually is."

> "Under section nine, subsection four, a company unpaid for more than two years is still liable for the Hearth Levy. I agree it's monstrous. I'm only the collector."

### Who he is
**Assessor Pell Quillon**, Fourth Assistant Under-Collector of the Regency's Office of Revenue for the March of Cinders, has been sent to [[Cinderford]] to assess the Ninth Lantern for back taxes: the Hearth Levy, the Road Levy, the Lantern Duty (a tax on lanterns, passed in 2997 and never repealed) and the Late Assessment Surcharge, which is charged on taxes not yet assessed. He arrives in **The Assessor** (session 2), takes over [[The Assessor's Office]], and finds it already occupied by forms.

### What he wants
To complete his forms. All of them. Correctly. He is the only honest Regency man in the [[The Ashenreach|Ashenreach]], and he does not know it, because it hasn't occurred to him that the others aren't.

### What he knows
The Regency's tax law, in detail. That the company's pay was signed out of the treasury at [[Caer Ardith]] in Reaping, which is odd, because it never arrived. That his clerk, [[Ansel Mote]], is a treasure, and that [[Hester Pruitt|Widow Pruitt]], who does the sums, is a terror.

### How he treats the PCs
With nervous courtesy, then growing horror as he realises the Regency owes the company far more than the company owes the Regency. He is easily bullied and impossible to bribe (he would have to log it). Treat him kindly and he will fight for them in the only way he knows: on paper.

:::gm
**Secret.** He has none. That is the joke and the tragedy. Pell is harmless, honest, and being used: the Quiet Office sent him to the March as cover for Ansel Mote, chosen precisely because nobody would ever suspect him of anything.

**His payoff:** once Pell finds the pay was signed out and diverted (session 2), he files a formal Claim of Arrears on the company's behalf against his own government, in triplicate. In session 7 his paperwork can prove the Regency diverted the pay and that the order came from the Regent-Chancellor's own office. If Mote learns of it, Pell is in danger.
:::`,
    gmNotes: `**Voice:** breathless, apologetic, sub-clause after sub-clause. Hand the players a real form (see [[Tax Notice, in Triplicate]]).

**Across the arc:**
2. Arrives; assesses everything, including the lantern (Lantern Duty, four pence a year, nine years in arrears). Discovers the pay was signed out.
3. Terrified of the dreamers; hides under his desk with a candle and fills in an Incident Report.
4–5. Files his Claim of Arrears. Asks the PCs to carry a copy to safety, "should anything happen to the office". Something will.
7. Mote tries to burn the office and Pell with it. If the PCs save him, his forms are the proof that sinks [[Marius Vell]]'s plan in the March.
8. Whatever happens, he records it. "Someone has to."`,
  },
  {
    key: 'ansel-mote',
    type: 'npc',
    name: 'Ansel Mote',
    players: true,
    parent: 'assessors-office',
    image: 'sil:ansel-mote',
    status: 'alive',
    statusKnown: true,
    summary: 'The Assessor\'s mousy, apologetic clerk, sent ahead to open the office; nobody looks at him twice.',
    fields: [
      { key: 'Ancestry', value: 'Human' },
      { key: 'Role', value: 'Clerk to the Assessor' },
      { key: 'Faction', value: 'The Regency Council (Assessor\'s Office)' },
      { key: 'Where', value: 'The Assessor\'s Office' },
      { key: 'True role', value: 'Quiet Office assassin and paymaster', gm: true },
      { key: '5e', value: 'Spy, upgraded: AC 14, HP 45, two shortsword attacks; Sneak Attack 3d6; Assassinate (advantage on creatures that haven\'t acted, crits on surprised targets); poison needle (DC 13 CON, 3d6 poison and poisoned for 1 hour). CR 3.', gm: true },
    ],
    tags: ['npc', 'regency', 'clerk'],
    gmTags: ['quiet-office', 'villain'],
    relations: [
      { to: 'marius-vell', kind: 'serves', note: 'Takes his orders from the Regent-Chancellor\'s own office.' },
      { to: 'f-quiet-office', kind: 'serves' },
      { to: 'garrick-sallow', kind: 'pays', note: 'For a mutiny.' },
      { to: 'dannic-rook', kind: 'killed', note: 'Drowned him under the ford.' },
      { to: 'pell-quillon', kind: 'hides behind', known: false },
    ],
    body: `### Look and voice
Small, pale and forgettable: thinning mouse-brown hair, a long nose that is always slightly pink, spectacles he pushes up with one ink-stained finger. He wears a clerk's grey coat and a scarf even indoors. He sniffles. He carries a ledger against his chest like a shield.

He speaks softly, apologises constantly, and agrees with everyone.

> "Sorry. Sorry. Was I in the way? I'm always in the way. Please, carry on."

> "Oh, I wouldn't know anything about that. I just copy things out."

### Who he is
Ansel Mote is the clerk of [[Pell Quillon]], the Assessor, and arrived in [[Cinderford]] about three weeks ahead of him to "set the office in order" at [[The Assessor's Office]]. He has put it in a very good order. On his first evening in town he took tea in the parlour of [[The Velvet Ledger]] and asked nothing; on his second he bought a round at [[The Last Candle]] and asked nothing; he tipped well both times. He lodges above a chandler's on [[Temple Row]], pays his rent early, attends no temple, and is in bed by nine. People forget he's in the room. He is very good at being forgotten.

### What he wants
Nobody knows. If asked, he wants a quiet life and a good pension.

### What he knows
He says he knows nothing. He has read every file in the Assessor's Office and copied the interesting ones.

### How he treats the PCs
Mildly, helpfully, invisibly. He is the clerk who finds the form they need. He remembers their names, and their friends' names, and where they sleep.

:::gm
**The truth.** Ansel Mote is an agent of [[The Quiet Office]], the Regency's spies and assassins, sent by [[Marius Vell]]'s own office to bring the Ninth Lantern's flame under Regency control. His orders: break the company, put a pliant captain in charge, and have the lantern "escorted to the capital for safekeeping". Vell knows what the flame is. Mote does not, quite; he knows only that his master wants it badly and wants it alive.

- He pays [[Garrick Sallow]] in Quiet Office silver to brew the mutiny.
- He supplied the cut oil tins. The ash in them is lake-ash from [[Stillwater]], given gladly by [[The Dreaming Widow]], which chokes the flame without killing it. Sallow paid [[Dannic Rook]] to swap the tins in the lantern store.
- On the night of 7 Ashfall, when Rook tried to back out and ran with two tins, Mote caught him at [[The Ford]] and held him under. The body wouldn't stay down.
- He wrote the wanted poster himself ([[Wanted: Dannic Rook]], signed "A.M."), with an invented sighting on the 12th, so the company would hunt a living deserter and nobody would look for a body.
- He and Sallow hold copies of two of the three cage keys.
- He keeps a Quiet Office file on the orc Mothers' lineages. If he learns who [[Varra Nine-Knuckles]]'s grandmother is, he will move on her.

He is patient, methodical and completely without malice. He likes Pell, genuinely, and will kill him if ordered.
:::`,
    gmNotes: `**Voice:** soft, sniffly, apologetic; agrees with everyone; never finishes an accusation. Put him in scenes early as furniture so the players forget him.

**Across the arc:**
1. Barely seen. But he wrote the wanted poster (signed "A.M."), and the scrap of paper in Dannic's pocket says "Then the clerk wants a word. Dont like the clerk." Let the players forget it.
2. Arrives "properly" with Pell; helps everyone.
3. On the red moon night, he is the only person in the Assessor's Office who isn't afraid.
4–5. If the PCs get close, Bray or a hired thug tries to kill whoever's investigating. Mote is never there.
6. While the PCs are in the Rent, he tightens his grip on Sallow and sends a report to Caer Ardith (a page the PCs can intercept through [[Kettle Brindlewake]]).
7. **Three Knives**: makes his move. Tries to kill Marrow and Vosk, burn Pell's proof, and take the lantern. Unmasked, he fights only to escape.
8. If he lives, he's at the Rent, waiting for the flame to change hands.`,
  },
  {
    key: 'tollamund',
    type: 'npc',
    name: 'Grandmother Tollamund',
    aliases: ['Tollamund'],
    players: true,
    parent: 'tollamund-house',
    image: 'sil:tollamund',
    status: 'alive',
    statusKnown: true,
    summary: 'Shellback banker, 340 years old, who holds the Ninth Lantern\'s debts and speaks very, very slowly.',
    fields: [
      { key: 'Ancestry', value: 'Shellback' },
      { key: 'Role', value: 'Head of Tollamund & Daughters, banker' },
      { key: 'Faction', value: 'The Concord Houses' },
      { key: 'Where', value: 'Tollamund & Daughters' },
      { key: '5e', value: 'Noble, reskinned: AC 18 (shell), HP 60, speed 15. Never fights. Four veterans in Concord livery guard the house; the vault door is DC 25.', gm: true },
    ],
    tags: ['npc', 'concord', 'shellback'],
    relations: [
      { to: 'f-concord-houses', kind: 'speaks for', known: true },
      { to: 'f-ninth-lantern', kind: 'holds the debts of', known: true },
      { to: 'ness', kind: 'longs for', note: 'Home.' },
      { to: 'item-lantern', kind: 'covets' },
    ],
    body: `### Look and voice
Enormous, ancient and still. Her shell is the size of a cart, domed and dull green and furrowed with growth-rings like an old tree, and hung with brass chains of office and tiny ledger-books on cords. Her eyes are small, black, wet, half closed and missing nothing. She sits in a chair built to hold her, in the old mill by the bridge where the millrace hums under the floor, and nobody has seen her leave it since the house opened in 3007.

She speaks very slowly. Each sentence arrives the way a barge comes into dock: late, inevitable and heavier than you expected.

> "Captain. ... ... Sit. ... ... The interest ... does not ... sleep."

> "You think ... I am slow. ... ... I am. ... ... But I was here ... before your empire. ... ... I will be here ... after your company."

### Who she is
**Grandmother Tollamund** is three hundred and forty years old and the head of [[Tollamund & Daughters]], the [[Shellbacks|Shellback]] counting-house in [[Cinderford]] and one of the oldest houses of [[The Concord Houses]]. She has bought every debt in the March of Cinders that anyone would sell, including all of the Ninth Lantern's. Her "daughters", Perrin, Odessa and Sal, are sharp, courteous humans in their forties who do her talking and walking. They are not her daughters. The house name is older than any of them. A Concord factor from [[Sevenhaven]], [[Cousin Pennamund]], has lately come to sit beside her and audit, very slowly, her purchases.

### What she wants
To own the company's debt, which she does. To be paid, eventually; she can wait. She can wait longer than anyone in the March will live.

### What she knows
What everyone owes. What everyone can pay. What the Regency's treasury looks like from the inside. That the pay wagon was carrying Concord coin, because the Concord lent it to the Regency. She knows the old Shellback charts of [[The Ness of Thurm]], its mountains and its long arrowhead point out into the Hollow Sea, and she has never once mentioned them.

### How she treats the PCs
Politely, patiently, as future clients. She will lend them money at reasonable interest. She will remember every copper. She asks each of them, once, whether they have ever been to the sea.

:::gm
**Secret.** Tollamund wants the lantern. Not the town, not the company, not even the debt: the flame. Asked straight, she says only: "It is a key. ... To a door ... my people closed." She believes a light of the Nine is the only thing that can open the way back to [[The Ness of Thurm]], which her people sealed behind them when they left in 1350. Her grandmother's grandmother told her of it: the mountains running down to the sea, the long slow songs, the night they went. She will not say why they went. She wants to go home before she dies.

Her instrument is debt: [[Fennick Bottlebrook]]'s personal loans, the company's notes, and the town's charter that [[Odile Fairweather]] has nearly sold her. When she calls it all in at once (session 7), the Keep and "all fixtures and fittings thereof" become hers in law.
:::`,
    gmNotes: `**Voice:** play her VERY slowly. Pause mid-sentence; take a sip of water; carry on. Players will try to finish her sentences. She will wait until they stop.

**Across the arc:**
1–2. Polite letters about the debt. Lends the PCs coin if asked (note it on the party's tab).
2. Knows the pay wagon carried Concord coin; tells the PCs for a price (a favour, unspecified).
4. Begins collecting: Fennick's loans, Odile's charter.
5. If a PC wins her trust (patience is the only way), she speaks of the Ness and the sea. A rare, sad scene.
7. **Three Knives**: calls in every debt at once; Concord veterans arrive to take possession of the Keep. Lawful, bloodless, devastating.
8. If the flame is resealed and out, she closes her ledger, says "Ah," and nothing for a long time. If it's taken, she bids for it.`,
  },
  {
    key: 'sorrel-vey',
    type: 'npc',
    name: 'Sorrel Vey',
    aliases: ['Madame Vey'],
    players: true,
    parent: 'velvet-ledger',
    image: 'sil:sorrel-vey',
    status: 'alive',
    statusKnown: true,
    summary: 'Elven keeper of the Velvet Ledger and priestess of Isaurana, who trades in secrets and wears a history on her skin that nobody can read.',
    fields: [
      { key: 'Ancestry', value: 'Elf' },
      { key: 'Role', value: 'Keeper of the Velvet Ledger, priestess of Isaurana' },
      { key: 'Faction', value: 'Temple of Isaurana (the Velvet Ledger)' },
      { key: 'Where', value: 'The Velvet Ledger' },
      { key: '5e', value: 'Spy with priest spells: AC 13, HP 40. Charm person, suggestion, sanctuary, zone of truth (1/day). Insight +7, Persuasion +8. Keeps a dagger in her hair.', gm: true },
    ],
    tags: ['npc', 'velvet-ledger', 'elf'],
    relations: [
      { to: 'ilse-marrow', kind: 'loves', note: 'More than she meant to.' },
      { to: 'god-isaurana', kind: 'priestess of', known: true },
      { to: 'seraphine-ashe', kind: 'rival of', known: true },
      { to: 'sael', kind: 'exiled from' },
    ],
    body: `### Look and voice
Tall and unhurried, with the stillness of someone who knows she's being watched and has decided to allow it. Black hair worn loose; eyes the grey of woodsmoke. From her collarbones to her fingertips she is covered in ink: dense, ancient, faded elven script and pictures, coiling down her arms and across her shoulders, words in a hand no living elf can read. Her gowns are cut to show it, because, as she says, a temple should display its scripture. A Raveler called Mourn keeps her door and laughs at the wrong things.

Her voice is low and amused, and she makes every visitor feel they are the only interesting person to come through the door all week.

> "Everyone who comes through my door wants something, darling. The ones who know what it is are cheap. The ones who don't, I keep."

> "Isaurana doesn't care what you want. Only that you want it honestly."

### Who she is
**Madame Vey** keeps [[The Velvet Ledger]], [[Cinderford]]'s house of [[Isaurana]], the Veiled: a place of wine, music, soft rooms and closed doors, where the goddess of night, secrets and desire is served in the old way. What people want is the house's trade; what people *say* while they want it is its treasury. Everything is written in the Ledger's book. Everything has a price. Nothing is ever forced, and nothing is ever free.

She came out of [[Sael]] eighty years ago and has never gone back.

### What she wants
Information, as all Isaurana's priests do. And one thing more, privately: to have the ink on her own skin read. She doesn't know what it says. She knows it is old, that her grandmother inked it onto her when she was a girl, and that the Remembrancers of Sael would very much like to read it. A few of them, she suspects, would rather it were gone.

### What she knows
More than anyone in town, about almost everyone. Who's sleeping with whom, who's owed what, who visited the Saint's mission at midnight. She knows the Velvet Ledger's book has exactly one entry about [[Ansel Mote]]: *Paid for tea. Asked nothing.* It worries her more than any other line in the book.

### How she treats the PCs
As guests: warmly, attentively, with interest that may or may not be professional. She will trade a secret for a secret, never for coin. She enjoys clever people and is merciless to clumsy ones.

:::gm
**Secret.** Sorrel Vey is [[Captain Marrow]]'s lover. It began as a negotiation for the company's credit and became something neither of them planned. It is the only thing in Sorrel's life she does not write in the book.

**Her skin** records [[The Saelish Trespass]]: Sael's attempt in 1102 AW to open the Fourth Ward, and what it cost. The Remembrancers burned every skin that remembered; this copy survived. [[Aelith Sorn]] can read parts of it, and has been courting Sorrel for a month for the rest. She will do anything to read it all, including taking it. Sorrel plays Aelith, Seraphine and the Captain against the fourth party in the room, which is her own curiosity.

She loathes [[Sister Seraphine]], who serves desire too, and in a way Sorrel finds dishonest: "She doesn't sell what people want. She sells them the wanting."
:::`,
    gmNotes: `**Voice:** low, unhurried, amused; "darling"; never answers a question first. Write allure through allusion: glances, warmth, a door left ajar. Nothing explicit.

**Across the arc:**
1–2. A source: trades the PCs a secret (Sallow's drinking with a clerk; a Glasser selling Regency coin) for one of theirs.
3. On the red moon night, half her house dreams the same dream. She writes it all down.
4. **The House of Unburnt Light**: the PCs need her help against Seraphine. She gives it, for a price, and to spite her rival.
5. [[Aelith Sorn]] makes an offer for her skin. If refused, Aelith tries to have her taken to Sael.
6. If the PCs can read the Lithic script from [[The Ninth Stone]], part of her ink becomes readable too: it shows the Fourth Ward, and elves standing round a fire.
7. If Marrow is in danger, Sorrel risks the house for her.
8. If her skin has been read, she decides whether to show it to Sael. Or burn it herself.`,
  },
  {
    key: 'mother-corvane',
    type: 'npc',
    name: 'Mother Corvane',
    players: true,
    parent: 'doorkeepers-chapel',
    image: 'sil:mother-corvane',
    status: 'alive',
    statusKnown: true,
    summary: 'Ancient Raveler head of the Rook-Court in Cinderford: undertaker, priest of dead Hathe, and keeper of the ledger of last words.',
    fields: [
      { key: 'Ancestry', value: 'Raveler' },
      { key: 'Role', value: 'Head of the Rook-Court in Cinderford' },
      { key: 'Faction', value: 'The Rook-Court' },
      { key: 'Where', value: 'The Doorkeeper\'s Chapel; often at Corvel Rise' },
      { key: '5e', value: 'Priest: AC 13, HP 27. Spells include speak with dead (3/day, because she likes it), spirit guardians, lesser restoration. Can call 6 Raveler undertakers (scouts with shovels).', gm: true },
    ],
    tags: ['npc', 'rook-court', 'raveler'],
    relations: [
      { to: 'f-rook-court', kind: 'leads', known: true },
      { to: 'god-hathe', kind: 'priestess of', known: true },
      { to: 'brother-tallow', kind: 'old friend of', known: true },
      { to: 'corvel-rise', kind: 'keeps', known: true },
    ],
    body: `### Look and voice
Small, hunched and very old, her black feathers gone white-streaked about the face like frost on a hedge. One eye is bright black; the other is clouded and, people say, sees further. She wears layer on layer of grey shawls hung with keys, bones, buttons, coins and teeth, all of which rattle when she laughs, which is often. Her beak has a crack down it mended with a silver rivet.

She talks like a market trader who happens to be an undertaker: quick, cheerful, morbid, haggling.

> "Last words are cheap, dearie. It's the second-to-last ones that cost."

> "Hathe's dead and I'm still keeping his doors. Somebody's got to. Bit like being married."

### Who she is
Mother Corvane is the head of [[The Rook-Court]] in [[Cinderford]]: the [[Ravelers|Raveler]] undertakers who buried the dead of [[The Battle of Cinders]] and have buried everyone since. She keeps [[The Doorkeeper's Chapel]] on [[Temple Row]], the only shrine in town to a dead god, and the rookery and burial grounds at [[Corvel Rise]]. She taught [[Quorl Many-Words]] his trade.

She is unbribable. She simply charges more. She has not used her deed-name in forty years, and nobody dares ask it.

### What she wants
To decode the last words. Every word spoken by the dying since the war goes into the Rook-Court's great ledger, and for nine years the Ravelers have noticed that the words, set side by side, are not random. Corvane has spent nine years reading them. She is close.

### What she knows
The last words of almost everyone who has died in the March since 3002. Which dead have not passed. That the dead don't pass since Hathe fell, and roughly how many walk the ash at full red moon. That [[Brother Tallow]] is frightened of his own lamp.

### How she treats the PCs
As customers and as future customers. She is helpful, ghoulish and expensive. She will sell them a dead man's last words for a living man's secret. She is fond of Quorl and will be fond of anyone he trusts.

:::gm
**Secret.** Corvane already guesses the message in the ledger: **"the lamp is the lock."** She has not told the Rook-Court elders, or Quorl. When Halloran Pike's funeral goes wrong (session 4 or 5) and his last words say it aloud, she will be sure.

And she has drawn the wrong conclusion. She believes the lamp is what's locking **Hathe's doors**: that since the lantern was lit, the dead can't pass, and that if it went out, the doors would open and the dead could rest. It is half true: the doors are troubled because Hathe is dead and his power is in [[Ilyra of Halcyra]]. But putting out the lamp would open the crack, not the doors.

She loves the dead more than the living. If she becomes certain, she will help put the lantern out. That is why the dead warn Quorl: "Don't let them put it out."
:::`,
    gmNotes: `**Voice:** quick, chatty, haggling, rattling shawls; cackles.

**Across the arc:**
1. Collects the drowned man's body. It gets up on her table. She is delighted.
2–3. On the red moon night, she counts the walking dead from the chapel roof and sends Quorl to tally the Smokes.
4. Lends [[Hathe's Door-Key]] to finish old Pike's jammed funeral rite ([[The Funeral That Would Not End]]). Asks Quorl, casually, whether anyone has said anything "odd" lately.
5. **Last Words**: opens the ledger to the PCs (for a price). Reads them the message. Explains her theory, earnestly.
6. If she learns what the PCs found at the Ninth Stone, she must choose between her theory and the truth. She is old and stubborn.
7–8. She can be an ally in resealing the ward (her undertakers know the Rent's dead roads) or a knife in the dark at the last moment (she'll try to snuff the flame "to let them rest"). Let the PCs talk her round, or not.`,
  },
  {
    key: 'seraphine-ashe',
    type: 'npc',
    name: 'Seraphine Ashe',
    aliases: ['Sister Seraphine'],
    players: true,
    parent: 'house-unburnt-light',
    image: 'sil:seraphine-ashe',
    status: 'alive',
    statusKnown: true,
    summary: 'Envoy of the Unburnt Saint at the House of Unburnt Light: warm, merciful, beautiful, and far too interested in the flame.',
    fields: [
      { key: 'Ancestry', value: 'Human (Iskavethi)' },
      { key: 'Role', value: 'Envoy of the Church of the Unburnt Saint' },
      { key: 'Faction', value: 'The Church of the Unburnt Saint' },
      { key: 'Where', value: 'The House of Unburnt Light' },
      { key: '5e', value: 'Priest: AC 13, HP 45, immune to fire. Spells: sacred flame, command, charm person, burning hands, flame strike (1/day). At full red moon: the Saint speaks through her (advantage on all Charisma checks, frightful presence DC 14 WIS).', gm: true },
    ],
    tags: ['npc', 'church-saint', 'iskaveth'],
    relations: [
      { to: 'ilyra', kind: 'serves', note: 'Sent west by Ilyra herself.', known: true },
      { to: 'ilse-marrow', kind: 'courts', note: 'Openly, warmly, and with gifts.', known: true },
      { to: 'f-church-saint', kind: 'serves', known: true },
      { to: 'ysse', kind: 'covets', note: 'A keeper the flame trusts.' },
    ],
    body: `### Look and voice
Thirty, and lovely the way a fire in winter is lovely: you find yourself drawn nearer without deciding to. Copper-dark skin, black hair bound in gold thread, and eyes the colour of embers, a shade they turned the year she took her vows. She wears the Saint's white and saffron, open at the throat. Her hands are smooth and unmarked. She holds them in candle flames while she talks, absently, the way other people fidget.

Her voice is warm, low and intimate, and she touches people when she speaks to them: a hand on the arm, a palm on the cheek. She is funny, too, and a little tired, which is worse: it makes her easy to like.

> "You're cold. Everyone in this town is cold. Come and sit nearer the fire."

> "The Saint doesn't ask you to stop wanting. She asks you to want *more*."

### Who she is
Sister Seraphine Ashe is the envoy of [[The Church of the Unburnt Saint]] to the March of Cinders, and mistress of [[The House of Unburnt Light]], the mission outside town where the hungry are fed, the sick are tended, the lonely are comforted, and everyone is warm. It is a little too comfortable. People go for a bowl of soup and stay for a week.

She was born in [[Qerath]] by the Glass Sea, walked the coals at [[Halcyra]] at sixteen, and was chosen to come west by [[Ilyra of Halcyra]] herself, who touched her face and said, "You'll do."

### What she wants
The town, for the Saint. The flame, for the Saint, "to keep it safe". And the people around the flame, especially the ones it seems to trust.

### What she knows
That the Saint walked out of the fire at Cinders unburnt. That the Ninth Lantern's flame is holy, though she doesn't know how. That [[Captain Marrow]] is lonely, and that Ysse can't sleep.

### How she treats the PCs
As people worth saving, which is flattering and frightening. She feeds them, mends their wounds without charge, listens. She learns what each one wants and offers it, gently, in the Saint's name. Each PC who visits the House should feel the pull: warmth, belonging, a longing they didn't know they had.

:::gm
**Secret.** The Saint speaks through Seraphine. Not always: in prayer, at full red moon, and whenever Ilyra wishes to look at someone through her eyes. When it happens her eyes go fully ember-red, the room grows hot, and her voice drops half an octave and becomes very, very old.

Through her, [[Ilyra of Halcyra]] wants the PCs: Ysse as a keeper, Quorl because his prayers to Hathe reach Ilyra now, Tick because he was born the night Ilyra rose, Borrin because she can smell what wears his shadow, Varra because of whose blood she carries.

Seraphine's courtship of Marrow is half the Saint's work and half her own. She would like to be loved for herself. She is no longer sure there is a herself.
:::`,
    gmNotes: `**Voice:** warm, low, close; touches people; makes them feel seen. Allure through metaphor and allusion only. The danger is that she is sincere.

**Across the arc:**
1–2. Seen at the edges: feeding the hungry soldiers when the pay fails, which makes the company love her.
3. On the red moon night, she walks the Smokes unafraid, and the dreamers part for her.
4. **The House of Unburnt Light**: offers to "save" the flame by taking it to Halcyra. Courts Marrow openly; courts the PCs privately. The Saint speaks through her to each PC once.
5–6. If refused, grows colder. Iskavethi pilgrims arrive in numbers.
7. **Three Knives**: the church's move: a crowd of faithful march on Lantern Hill to "carry the flame home", with Seraphine at the front, glowing.
8. At the Rent, under the red moon, the Saint speaks through her fully. She can be saved (talked back to herself) or lost (she burns, beautifully, and becomes a door for Ilyra).`,
  },
  {
    key: 'kettle',
    type: 'npc',
    name: 'Kettle Brindlewake',
    players: true,
    parent: 'low-quay',
    image: 'sil:kettle',
    status: 'alive',
    statusKnown: true,
    summary: 'Halfling barge-captain, smuggler and the best-informed gossip on the river Cinder; sells to everyone, and likes the PCs best.',
    fields: [
      { key: 'Ancestry', value: 'Halfling' },
      { key: 'Role', value: 'Barge-captain, smuggler' },
      { key: 'Faction', value: 'The Barge Clans' },
      { key: 'Where', value: 'The Low Quay, aboard the Grey Dumpling' },
      { key: '5e', value: 'Bandit captain, reskinned: AC 15 (leather, Dex), HP 40, hand crossbow and boathook. Halfling Lucky. The Grey Dumpling carries a crew of 6 bandits and a hidden hold (DC 18 to find).', gm: true },
    ],
    tags: ['npc', 'barge-clans', 'halfling'],
    relations: [
      { to: 'f-barge-clans', kind: 'serves', known: true },
      { to: 'vexa-glassjaw', kind: 'smuggles for', known: true },
      { to: 'ansel-mote', kind: 'carries letters for', note: 'Reads them first.' },
      { to: 'fennick', kind: 'bought oil from', note: 'Six casks of the good stuff.' },
    ],
    body: `### Look and voice
Tiny, round, sun-browned and freckled, sixty years old and moving like twenty, with grey curls stuffed under a stolen Regency officer's hat and a pipe that never leaves her teeth and is never lit. Bare feet, tough as boot-leather. A long coat with pockets inside the pockets. She stands on a crate to look people in the eye and conducts conversations with the stem of her pipe.

She talks fast, nosily and affectionately, and calls everyone "love".

> "Gossip's like river water, love. Free to drink, and it'll kill you if you don't boil it."

> "I don't take sides. I take cargo. Sides is just cargo that argues."

### Who she is
Kettle Brindlewake is captain of the barge *Grey Dumpling*, the busiest vessel on the river Cinder, and Barge-Mother of a clan of [[Halflings|halfling]] bargefolk (her cousins Dob and Marigold pole the barge and say little) who carry grain, letters, salt fish, passengers and anything else that fits in a hold between [[Cinderford]] and the Ardis. Some of what fits in the hold is legal. She runs the floating market on [[The Low Quay]] and is cousin, twice removed, to [[Fennick Bottlebrook]], whom she considers the family disappointment for going straight.

### What she wants
Profit. Gossip. A fine dinner. For the river to keep running and nobody important to notice her. Mostly gossip.

### What she knows
Everything that comes down the river and much that goes up it. Who's buying Glasser salvage. Which Regency letters have come for the Assessor's clerk. That the pay wagon's escort turned back two days out, and that somebody paid them to. That [[Dannic Rook]] owed her money, and was nowhere on the Quay on the 12th, whatever the poster says. She sells to every faction in the March. She tells the PCs first, and cheaper.

### How she treats the PCs
She likes them best. She liked [[Varra Nine-Knuckles]] the moment Varra stepped onto her barge and asked if she needed a hand with the ropes. She treats the party like favourite nieces and nephews: feeds them, scolds them, overcharges them slightly less than everyone else, and expects visits.

:::gm
**Secret.** Kettle sells to everyone: Quiet Office, Concord, Church, Glassers and the Sleepless. She carries [[Ansel Mote]]'s letters to [[Caer Ardith]] and reads every one first (steam, a hot knife). She knows Mote is not a clerk. She hasn't told anyone, because the price isn't right yet and because she is, very sensibly, afraid of him.

Last month she bought six casks of the company's good lantern oil from her cousin [[Fennick Bottlebrook]], who needed bread money. She has sold four. She smuggles [[Vexa Glassjaw]]'s salvage downriver, including relics that should stay buried. She has a crate of Lithic-carved glass in her hidden hold right now that hums at night.

She likes the PCs best because they're the only people in the March who've never tried to buy her.
:::`,
    gmNotes: `**Voice:** fast, warm, nosy; "love"; points with her pipe. She's your rumour engine: when the players are stuck, Kettle knows somebody.

**Across the arc:**
1. Saw the drowned man go in. Didn't see who with. Saw a clerk's scarf on the bridge.
2. Knows the pay wagon's route and that its escort turned back, paid. Points the PCs to [[Fort Mercy]].
3. Hides children from the dreamers on the Grey Dumpling.
4–5. Sells the PCs a copy of one of Mote's letters (or gives it free, if they've earned it): "Report on the lamp. Progress satisfactory."
6. Ferries the expedition upriver toward the Rent.
7. Can get anyone out of town by water. Or bring anyone in.
8. Whatever happens, she's on the quay afterwards, selling hot chestnuts and the story.`,
  },
  // ───────────────────────────── The ash and the hidden ─────────────────────────────
  {
    key: 'dreaming-widow',
    type: 'npc',
    name: 'The Dreaming Widow',
    aliases: ['the Widow', 'Wenna Marlowe'],
    parent: 'the-smokes',
    image: 'sil:dreaming-widow',
    status: 'alive',
    summary: 'Seventeen-year-old Hollowborn prophet who leads the Sleepless; she calls herself the widow of a dead god and means to wake him.',
    fields: [
      { key: 'Ancestry', value: 'Human (Hollowborn)' },
      { key: 'Role', value: 'Leader of the Sleepless' },
      { key: 'Faction', value: 'The Sleepless' },
      { key: 'Where', value: 'The Smokes: the Widow\'s yard and the cellars' },
      { key: '5e', value: 'Cult fanatic, upgraded: AC 13, HP 55. At full red moon she also knows the mage\'s spells (counts as 9th-level caster; fear, hold person, sleep at will). Dreamers within 60 ft are charmed by her (DC 14 WIS). Always with 2d6 cultists.', gm: true },
    ],
    tags: ['npc', 'sleepless', 'hollowborn'],
    gmTags: ['villain', 'secret'],
    relations: [
      { to: 'f-sleepless', kind: 'leads' },
      { to: 'marla-marlowe', kind: 'sister of', note: 'Marla raised her, and died the night Tick was born.' },
      { to: 'tick', kind: 'aunt of', note: 'She thinks he is the Sleeper\'s firstborn.' },
      { to: 'god-sleeper', kind: 'worships', note: 'And calls herself its widow.' },
    ],
    body: `### Look and voice
Small and thin and very young: seventeen, with a heart-shaped face, cropped ash-blonde hair and bare feet black with tannery soot. She wears a grey wedding dress three sizes too big, cut down from someone's grandmother's, its hem dragging. Her left eye is the milky Hollowborn grey; her right eye she keeps shut, always, "so it can't wake me", which is why the Sleepless chalk an open eye behind a closed lid on their doors. She is never seen to sleep.

She speaks softly and slowly, in a sing-song half-asleep voice, and she smiles at people as though she has dreamed about them.

> "Shh. Shh. Everyone's so tired. Aren't you tired? He'll let us rest. That's all he wants. That's all he ever wanted."

> "I married him in a dream, the night the moon caught fire. Then they told me he was dead. So I'm a widow. But I don't believe them."

### Who she is
The **Dreaming Widow** leads [[The Sleepless]], the dream-cult of [[The Smokes]]: tanners, glass-dust workers, widows, Hollowborn families, people too tired for hope. About sixty of them, mostly Hollowborn, meet in cellars and in the Widow's yard: Wakers keep the night watch, Callers bring in the lost, Dreamers go to the dream on purpose, and the newest, the Drowsy, are still half asleep. They keep each other awake for days with bitter tea and songs, and wait for the red moon, when they all dream the same dream. The Widow tells them what it means. It means: soon.

Nobody in the Smokes knows her real name. She was born **Wenna Marlowe**, in a pit-camp in the Grimmark foothills, the winter the dwarves went under the mountain and the Eighth Ward broke.

### What she wants
To wake [[The Sleeper Below]]. She believes, completely, that the buried god is the god of endings, and that if he wakes he will end everything that hurts: hunger, grief, cold, debt, war, the long grey grind of the ash. Rest for everyone, forever. She is not wrong about what he was. She is wrong about what he wants.

### What she knows
The dream, better than anyone alive: the vast shape under water, the eye the size of a lake opening, the voice that says a sentence nobody can keep on waking. She keeps more of it than anyone. Who in the Smokes has started to dream it. That the lantern on the hill is "the stopper in the bottle". That the dead are restless and that her sister is one of them.

### How she treats the PCs
As fellow sleepers who haven't woken yet. She is gentle, sad and sincere, and she wants to save them too. Except Tick. She wants Tick very particularly.

:::gm
**Secret.** The Widow is the younger sister of [[Marla Marlowe]], [[Tick]]'s mother, seventeen years her junior, and the younger daughter of [[Ottilie Marlowe]], the Smokes midwife. The family fled south to [[Cinderford]] in the war. On the night of [[The Battle of Cinders]], eight-year-old Wenna sat in the cellar of Marlowe's holding her sister's hand while their mother delivered Tick and Marla died. She ran from the house at twelve, to Stillwater on its grey lake, and was one of the children who came up out of it alive the night it drowned ([[The Drowning of Stillwater]]); she came back to the Smokes' cellars with the dream. She knows exactly who Tick is. Her mother has not spoken to her in five years, and goes to the Sleepless meetings sometimes, at the back, just to look at her. Marla's last words were, "Wenna, hold his hand. Don't look up." Wenna looked up. The red moon was rising through the cellar grating, and the Sleeper looked back.

She gave the ash for the poisoned oil gladly: lake-ash from [[Stillwater]], where the dream runs strongest, which chokes the flame. The Quiet Office thinks it is using her. She thinks the same of them.

She believes Tick is the Sleeper's firstborn, the child of the night it dreamed hardest (she is not wholly wrong: it's why he grew so fast). She wants him at the lip of [[The Rent]] under a full red moon, holding the flame, so the god can wake through him.

She does not know her sister's ghost walks beside Tick. If she learns it, it will break her heart, or her faith.
:::`,
    gmNotes: `**Voice:** whisper-soft, sing-song, sleepy; "shh"; she pats people's hands. Never raise her voice. She is a frightened child who found a god, and a cult leader with a hundred followers.

**Across the arc:**
1–2. Unseen. Sleepless chalk on the Smokes' doors: an open eye behind a closed lid. A Sleepless child ([[Sabe Hollins]]) draws the PCs a picture of the dream. The cut oil smells faintly of lake water.
3. **Red Moon Rising**: leads the Sleepless march through the Smokes; half the town sleepwalks behind her toward Lantern Hill. First meeting with the PCs, if they find her in the crowd. She calls Tick by name.
4–5. Sends [[Ambry Coyle]] to "invite" Tick to the vaults. If refused, tries to take him.
6. The Sleepless follow the expedition toward the Rent.
7. In the chaos of the three knives, the Sleepless try to snuff the lantern.
8. At the Rent under the full red moon, the Widow brings her followers to the lip. She can be stopped, saved (if Marla's ghost can be made to reach her, through Tick), or she can step into the crack.`,
  },
  {
    key: 'vexa-glassjaw',
    type: 'npc',
    name: 'Vexa Glassjaw',
    players: true,
    parent: 'fort-mercy',
    image: 'sil:vexa-glassjaw',
    status: 'alive',
    statusKnown: true,
    summary: 'Orc boss of the Glassers at Fort Mercy, who digs the fused ruins for salvage and wants to dig deeper.',
    fields: [
      { key: 'Ancestry', value: 'Orc' },
      { key: 'Role', value: 'Boss of the Glassers' },
      { key: 'Faction', value: 'The Glassers' },
      { key: 'Where', value: 'Fort Mercy' },
      { key: '5e', value: 'Berserker, reskinned: AC 15 (glass-plated hide), HP 67, greataxe of black glass (1d12+3, +1d4 slashing on a crit, shatters on a 1). Reckless. Keeps 3d6 bandits and 2 thugs at Fort Mercy.', gm: true },
    ],
    tags: ['npc', 'glassers', 'orc'],
    relations: [
      { to: 'f-glassers', kind: 'leads', known: true },
      { to: 'aelith-sorn', kind: 'sells to', note: 'Glass with writing in it.' },
      { to: 'grashka', kind: 'exiled by', note: 'Twenty years ago, for selling a contract.', known: true },
    ],
    body: `### Look and voice
A big orc woman of fifty with skin like weathered slate and a lower jaw that is mostly glass. A siege-stone shattered it in the war; a Glasser surgeon rebuilt it from fused ash-glass and wire, and it clicks when she talks and catches the light when she smiles. Her arms are a lattice of fine white scars from years of cutting through glassland. She wears a leather coat plated with salvaged glass shards, so she glitters when she moves, and a dozen salvaged rings on her fingers, none of them hers.

Her voice is harsh and amused, and it clicks.

> "Everything under the glass is mine. Till somebody pays me more than it's worth. Then it's theirs. That's the whole law of the ash."

> "You want a relic, little soldier? Dig. Want it without digging? Pay."

### Who she is
In the orc way she was once **Vexa, Harrag's daughter**. The [[The Mothers of the Iron|Mothers]] took the name twenty years ago, when Grashka herself cast her out for selling her company's contract to the highest bidder in the middle of a siege. She calls herself Vexa of Nobody now, and laughs about it. She has run [[The Glassers]] out of [[Fort Mercy]], the old abandoned Regency fort on the ash, for eight years: salvage gangs who cut into the glasslands, the villages war-sorcery fused into glass, and dig out what's inside.

### What she wants
To dig deeper. Under the glasslands there are older things than villages: walls, carvings, roads. The deeper she goes the stranger they get, and the better they sell.

### What she knows
The glasslands better than anyone. Where the dead are thickest under the glass. That something has been buying up Lithic relics in quantity: a Remembrancer, paying in Sael silver; and a quieter buyer for the Saint's chapel. That the fort's old records vault holds a box of half-burned imperial papers she's never bothered to read. That something happened out on the ash road two weeks ago that she is not discussing.

### How she treats the PCs
As customers or competitors. She respects strength and despises soldiers who serve for nothing. She'll be interested in [[Varra Nine-Knuckles]] at once (another exile), and try to recruit her.

:::gm
**Secret.** Thirty feet under Fort Mercy, Vexa's diggers broke into a Lithic chamber fused into black glass, and on the glass is writing: the angular script of [[Ul-Tarran]]. She can't read it. She thinks it's a map. It is in fact a warning, and part of an account of the Godslaying, carved by the Lithic before they turned to stone. Its last line reads, if anyone ever reads it, "The lamp holds the lock; the heart holds the lamp."

She has sold rubbings to [[Aelith Sorn]]. She has kept the best piece back. She has been dreaming about it. Some of her crews are Sleepless.

The Ninth Lantern's pay-wagon strongbox is in her cellar, kept "until collected" (details on [[Fort Mercy]]), and she knows it should not be there. She doesn't care whether that makes sense.

The half-burned papers in the records vault are the surviving notes of Ilbert Crane, the Emperor's Master of Works ([[The Emperor's Digs]]). One of his three digs was at the foot of the Ninth Stone.
:::`,
    gmNotes: `**Voice:** harsh, clicking, laughing; sizes people up for what they're worth.

**Across the arc:**
2. **The Assessor**: the PCs track the pay wagon to Fort Mercy. Vexa has the strongbox. She'll trade it, fight for it, or sell it back at a loss to her pride. The Concord coin inside is the session's clue.
3–4. If on good terms, shows the PCs the glass chamber; asks if anyone can read it.
5–6. Sells the PCs a route into the Rent through old glassland tunnels. Wants to come.
7. If the Concord or the Quiet Office offers more, she sells them the PCs' route.
8. Whatever happens at the Rent, she's there with shovels afterwards, digging.`,
  },
  {
    key: 'warden-uthrem',
    type: 'npc',
    name: 'Warden Uthrem',
    parent: 'ninth-stone',
    image: 'sil:warden-uthrem',
    status: 'alive',
    summary: 'Half-stone Lithic warden who keeps the cracked Ninth Stone; he has waited nine years for someone to come.',
    fields: [
      { key: 'Ancestry', value: 'Lithic' },
      { key: 'Role', value: 'Warden of the Ninth Stone' },
      { key: 'Faction', value: 'The Last Wardens' },
      { key: 'Where', value: 'The Ninth Stone, at the lip of the Rent' },
      { key: '5e', value: 'Not a fight. If needed: priest, reskinned: AC 17 (stone), HP 80, speed 0; immune to poison, resistant to bludgeoning, piercing and slashing. Spells: sanctuary, spiritual weapon, spirit guardians, all as the Ward\'s protection.', gm: true },
    ],
    tags: ['npc', 'last-wardens', 'lithic'],
    gmTags: ['secret'],
    relations: [
      { to: 'f-last-wardens', kind: 'serves' },
      { to: 'ninth-stone', kind: 'keeps' },
      { to: 'ysse', kind: 'waits for', note: 'The one the flame calls.' },
      { to: 'brother-tallow', kind: 'has heard of', note: 'A keeper of a small fire, a long way off.' },
    ],
    body: `### Look and voice
From the waist down he is stone, grown into the rock at the foot of [[The Ninth Stone]] like a root. Above that he is grey, granular and cracked, skin halfway to granite, with veins of dull red light where the stone has split. One arm can still move, slowly. His face is long and grave and very old, with deep-set eyes like wet slate, and his beard has gone to grey crystal. Ash has drifted up over his shoulders. Every few minutes he breathes, a long grinding sigh.

He speaks very slowly, in an old and formal way, and each word sounds like it cost him.

> "You came. ... I have been ... counting. Nine years. ... I was beginning ... to doubt ... my arithmetic."

> "Do not ... be sorry for me. ... I chose ... this standing. ... Be sorry ... for the ones ... who did not ... get to choose."

### Who he is
**Uthrem of the Ninth**, last of that line, is one of [[The Last Wardens]], the handful of [[The Lithic]] who still tend the Great Wards. He came to the Ninth Stone forty years ago to stand: to let the stone take him, as his people do, and strengthen the ward with his own slow petrification. In 2979 he watched the Emperor's diggers cut at the stone's foot, and could not move to stop them. He was nearly done turning when the [[The Battle of Cinders|Battle of Cinders]] cracked the stone above him. Since that night he has been holding on, half-made, unable to finish turning and unable to leave.

### What he wants
A new heart for the ward. The crack cannot be sealed with stone or spells. It needs what the Nine gave: a living heart, willing, poured in. He would give his own, but there is too little of it left.

### What he knows
The truth about [[The Godslaying]]. That [[The Nine]] killed [[Ysmereth]], whose name only the Lithic keep, and that a god cannot fully die. That each ward has one of the Nine inside it, still awake. That the lantern in [[Cinderford]] was lit from a piece of this stone, blown loose in the battle, and that its flame is what's been holding the crack shut. That the flame is failing.

### How he treats the PCs
With immense, tired relief. He has rehearsed what he'll say for nine years. He tells them the truth, all of it, because there is no time for less.

:::gm
**Secret and purpose.** Uthrem has waited nine years for someone in particular: "the one the flame calls". When [[Ysse Lampwright]] arrives (**Into the Rent**, session 6), he says her name before she gives it. The Ninth inside the stone has told him about her.

He knows the three ways forward (the endings): reseal (a heart for the ward: his, which buys only a short time; a willing PC's; or Ysse's), let it crack, or take the flame. He will tell the PCs the cost of each honestly. He will beg them not to take the flame: "Whoever holds it ... will hear him. ... And he is ... very persuasive. ... He persuaded ... me ... once."

He also recognises at once what wears [[Borrin Halt]]'s shadow, and is afraid of it.
:::`,
    gmNotes: `**Voice:** extremely slow, formal, grinding pauses. Use him to deliver the campaign's big truths, but make each truth cost him visibly: a new crack, a red glow, a breath he struggles to take.

**Across the arc:**
1–5. Never seen. Hints only: the dream of a stone with a crack and someone sitting at its foot; a rubbing from the Ninth Stone ([[A Rubbing from the Ninth Stone]]) shows a figure carved at the base that wasn't there in old drawings.
6. **Into the Rent**: the PCs reach him. He tells the truth about the Godslaying, the wards and the flame.
7. If the PCs leave him, he holds on. He sends the party back with a message for whoever will listen.
8. At the end, if resealing is chosen, he offers himself first. If a PC or Ysse goes instead, he holds their hand while it happens, and then finally lets himself finish turning to stone.`,
  },
  {
    key: 'aelith-sorn',
    type: 'npc',
    name: 'Aelith Sorn',
    aliases: ['Remembrancer Sorn'],
    players: true,
    parent: 'temple-row',
    image: 'sil:aelith-sorn',
    status: 'alive',
    statusKnown: true,
    summary: 'Elven Remembrancer from Sael, polite and scholarly, collecting old things in the March to learn what her people forgot.',
    fields: [
      { key: 'Ancestry', value: 'Elf' },
      { key: 'Role', value: 'Remembrancer (loremaster) of Sael' },
      { key: 'Faction', value: 'The Remembrancers' },
      { key: 'Where', value: 'Lodging on Temple Row' },
      { key: '5e', value: 'Mage: AC 12 (15 with mage armour), HP 40. Swaps cone of cold for hypnotic pattern. Knows comprehend languages and identify as rituals. Always has a scroll of misty step.', gm: true },
    ],
    tags: ['npc', 'remembrancers', 'elf'],
    relations: [
      { to: 'f-remembrancers', kind: 'serves', known: true },
      { to: 'sorrel-vey', kind: 'hunts', note: 'Wants the ink on her skin.' },
      { to: 'npc-merane-tarn', kind: 'teaches', known: true },
      { to: 'warden-uthrem', kind: 'seeks', note: 'Has read of him; wants to find him.' },
    ],
    body: `### Look and voice
Slender, fine-boned, ageless in the elven way, perhaps three centuries old. She wears Sael's sober grey-green scholar's robes and gloves, always gloves. Her own tattoos are surprisingly few for her age, and new (she lost her old house-name with the last century's memories, and has not bothered with *once-*): crisp black lines on her neck and wrists, re-inked often. She has the habit of copying out anything interesting onto her own skin with a fine needle while she listens.

She speaks with exquisite politeness, quietly and precisely, and she never once seems to want anything.

> "Forgive me. I collect what other people throw away. Memories, mostly. You'd be surprised how many are lying about."

> "Sael has forgotten more than your empire ever knew. That isn't a boast. It's a confession."

### Who she is
Aelith Sorn is a Remembrancer of [[Sael]], one of the elven loremasters of [[The Remembrancers]], whose charge is to keep and recover the history Sael's elves lose as their memories fade each century. She has come to [[Cinderford]] "to study the battlefield and its glass", with letters of introduction from [[Ilmareth]], a modest purse and an apprentice, [[Merane Tarn]]. She lodges on [[Temple Row]] and is unfailingly courteous to everyone.

### What she wants
To learn what Sael forgot. Not the small things; the great one. Elves know there is a hole in their history, a burned place, and nobody left who can say what stood in it. She wants to know what it was.

### What she knows
More history than anyone in the March. The ancient script of [[Ul-Tarran]] (she can half-read it). That the Glassers are digging up Lithic writing. That the keeper of [[The Velvet Ledger]] wears very old ink, and that Aelith can read about one line in five of it.

### How she treats the PCs
As useful, courteous, temporary acquaintances. She will pay well for relics, writing, rubbings and stories. She is a gracious guest and a genuinely brilliant scholar, and she will help them read things nobody else can.

:::gm
**Secret.** Aelith will betray anyone to learn what Sael forgot. She knows the hole in Sael's history is [[The Saelish Trespass]], and she knows that [[Sorrel Vey]]'s skin is the only surviving record of it. She means to read it, with or without Sorrel's consent, and with or without Sorrel attached.

She also wants [[The Ward Shard]] and the lantern. The Remembrancers' oldest fragments suggest Sael once tried to open a ward. Aelith wants to know how. Not, she tells herself, to do it again.
:::`,
    gmNotes: `**Voice:** precise, gracious, quiet; never raises her voice; never says what she wants. The scholar who would sell you for a footnote.

**Across the arc:**
1–2. A friendly scholar in a tavern, asking about the battle. Pays the PCs for anything from [[The Glass Barrow]].
3. Watches the red moon night from a rooftop, taking notes.
4. Has been courting Sorrel for a month; makes a formal offer for a "transcription". Refused.
5. Helps the PCs read the Rook-Court ledger or the Lithic glass, in exchange for copies.
6. Wants to come into the Rent. If she does, she will try to copy the Ninth Stone and to reach Uthrem first.
7. **Three Knives**: in the chaos, she makes her move on Sorrel: a sleeping draught, a hired barge, a cutting-table. The PCs can stop it.
8. If she learns the truth of the Trespass, she has to decide whether to take it home. She will.`,
  },
  // ───────────────────────────── Far away ─────────────────────────────
  {
    key: 'ilyra',
    type: 'npc',
    name: 'Ilyra of Halcyra',
    aliases: ['Ilyra'],
    players: true,
    parent: 'halcyra',
    image: 'sil:ilyra',
    status: 'alive',
    statusKnown: true,
    summary: 'The living saint of Iskaveth, a camp healer who walked out of the fire at Cinders unburnt; now worshipped in Halcyra, and rising.',
    fields: [
      { key: 'Ancestry', value: 'Human' },
      { key: 'Role', value: 'The Unburnt Saint, living saint of Iskaveth' },
      { key: 'Faction', value: 'The Church of the Unburnt Saint' },
      { key: 'Where', value: 'Halcyra (far away)' },
      { key: '5e', value: 'Not a fight at this level. She is felt through Seraphine (see there). If you must: archmage blended with priest, immune to fire and necrotic, 3 legendary resistances, aura of flame 10 ft (2d6 fire).', gm: true },
    ],
    tags: ['npc', 'church-saint', 'far-away'],
    relations: [
      { to: 'f-church-saint', kind: 'is worshipped by', known: true },
      { to: 'god-hathe', kind: 'devoured', note: 'Drank his dying power at Cinders.' },
      { to: 'seraphine-ashe', kind: 'speaks through' },
      { to: 'god-saint', kind: 'is becoming', known: true },
    ],
    body: `### Look and voice
The icons in [[The House of Unburnt Light]] show her as she was: a plain, sturdy camp healer of twenty-five in a blood-stained apron, walking out of a wall of fire with her hair unsinged and three dying men in her arms. Pilgrims who have seen her in [[Halcyra]] since say she no longer looks plain. Her skin has a light under it, like a lamp behind paper. Her hair moves when there is no wind. People who stand near her feel warm, then wanted, then afraid, in that order. Nobody has seen her sleep, eat, or bleed in nine years.

Those who have heard her say her voice is low, fond and enormous.

> "Little lamp. You have carried it so far, and so long. Let me carry it now."

> "I don't want worship. I want *you* to stop hurting. Is that so terrible?"

### Who she is
Ilyra was a healer with a mercenary company at [[The Battle of Cinders]], one of thousands on the plain when the battle-sorcery set the ash alight. She walked into the fire to pull out the wounded and walked out at dawn, unburnt, carrying three dying men, and with her hands she healed the dying for three days without sleeping. The red moon rose the same night. In 3007 the theocracy of [[Iskaveth]] declared her a living saint ([[The Saint Declared]]). Today the faith of [[The Unburnt Saint]] spreads west from Halcyra, and its priests say plainly that she is becoming a god.

### What she wants
Godhood, though she would never use the word. She wants to heal the world's pain, all of it, and to do that she needs more power than any mortal has ever held.

### What she knows
What she is becoming. What she took. What the flame in Cinderford is.

:::gm
**The truth.** Hathe, Keeper of Doors, did not die by accident. The battle-sorcery broke him open; Ilyra was beside him in the fire as he died, and she drank his dying power. She did not choose to, at first: what a healer does with a dying thing is take its weight. She has chosen every day since. She is ascending on it. That is why the dead don't pass: the god of the threshold is gone, and his doors answer, poorly, to her. Prayers to Hathe reach her now. She answers some.

Her church wants the Ninth Ward's crack to open fully, so that she can drink the leak and become a full god. She would call it mercy. She may even be right that she'd be a kinder god than most. She would also be a god who ate two others to get there.

She wants the PCs: they are close to the flame, and the flame trusts them.
:::`,
    gmNotes: `Never bring Ilyra to Cinderford in person. She is felt: heat in a cold room, Seraphine's eyes turning ember-red, a dream with a warm voice in it, a prayer to Hathe answered by someone else.

**Across the arc:** 1–3 rumours and icons; 4 she speaks through Seraphine to each PC once, offering what they most want; 7 her church moves on the lantern; 8 at the Rent under the red moon she is almost present, a shape of fire at the crack's edge, and if the crack opens (ending B), she drinks, ascends, and Iskaveth marches west.`,
  },
  {
    key: 'grashka',
    type: 'npc',
    name: 'Grashka',
    aliases: ['Mother of Mothers'],
    players: true,
    parent: 'vael-ardith',
    image: 'sil:grashka',
    status: 'alive',
    statusKnown: true,
    summary: 'Mother of Mothers of the orc companies: ancient, iron-willed, and the one who cast her granddaughter Varra out.',
    fields: [
      { key: 'Ancestry', value: 'Orc' },
      { key: 'Role', value: 'Mother of Mothers' },
      { key: 'Faction', value: 'The Mothers of the Iron' },
      { key: 'Where', value: 'Wherever the Mothers sit in council (far away)' },
      { key: '5e', value: 'Gladiator, old: AC 16, HP 112, speed 25, Brave, Parry. Her word alone can call a mercenary company off a field.', gm: true },
    ],
    tags: ['npc', 'mothers', 'orc', 'far-away'],
    relations: [
      { to: 'f-mothers', kind: 'leads', known: true },
      { to: 'varra', kind: 'exiled', note: 'Her own granddaughter, for breaking a contract.', known: true },
      { to: 'aurel-ix', kind: 'killed', note: 'The Kingslaying. Her blow.' },
    ],
    body: `### Look and voice
Eighty years old and still the tallest orc in any room: stooped, white-maned, broad as a gate, her grey skin seamed with sixty years of scars. Her tusks are capped in iron. She walks with a pike for a staff and has never once leaned on it in public. Her eyes are pale yellow and very steady. She wears no crown and no jewel; her only ornament is a ring of knuckle-bones on a cord, one for every orc she has exiled.

She speaks slowly and rarely, in a voice like a millstone, and she does not repeat herself.

> "A contract is the only wall we have, child. Everyone hates us. Everyone needs us. The contract is what stands between those two things."

> "I have done worse things than you can imagine, and I would do them all again. Do not mistake that for pride."

### Who she is
In the orc way she is **Grashka, Ulvra's daughter**, and she is **Mother of Mothers**: first among [[The Mothers of the Iron]], the orc matriarchs who license, bind and judge every orc mercenary company in [[Vael Ardith]]. Her word sends companies to war and calls them off the field. Thirty years ago she was a commander of the Iron Guard, the orc soldier caste the empire bred in 2104 to guard its emperors. Everyone knows the Guard murdered Emperor Aurel IX in [[The Kingslaying]]. Nobody outside the Mothers knows whose hand struck.

She is [[Varra Nine-Knuckles]]'s grandmother. She heard Varra's case herself, and cast her out herself, and took the knuckle herself.

### What she wants
The wards shut. The companies paid. The orcs alive. In that order.

### What she knows
Why the Emperor died. What happens if a ward is ever broken.

:::gm
**Secret.** Grashka is the Kingslayer. In 2981, the Mothers learned (from a cook, of all people) that [[Aurel IX]] was secretly digging at three ward sites, trying to open one ([[The Emperor's Digs]]). They ordered him killed. On 14 Frostcall 2981, during an audience for petitions on the bean tax in the Gilded Gallery at [[Caer Ardith]], Grashka stepped out of the Guard's line and struck the blow herself. [[Sergeant Vosk]] stood at the door. The Mothers have never told anyone why, because nobody would believe orcs, and because explaining would tell the world where the wards are weak.

Casting Varra out broke her heart. Whether she chose that contract for the Rust Choir knowing Varra would refuse it, and so put her granddaughter where the Mothers needed eyes, she will never say.
:::`,
    gmNotes: `Grashka should appear late if at all: a letter in session 5 or 7, a messenger with a knuckle-bone, or (for a big finale) Grashka herself arriving at the Rent with an orc company at her back. Her offer: the Mothers will back resealing the ward. The price: Varra comes home, and swears to the Iron again. Or something harder.`,
  },
  {
    key: 'marius-vell',
    type: 'npc',
    name: 'Marius Vell',
    aliases: ['the Regent-Chancellor', 'Regent-Chancellor Vell'],
    players: true,
    parent: 'caer-ardith',
    image: 'sil:marius-vell',
    status: 'alive',
    statusKnown: true,
    summary: 'Regent-Chancellor of Ardith, head of the Regency Council, who has ruled "until an heir is found" for longer than most people can remember.',
    fields: [
      { key: 'Ancestry', value: 'Human' },
      { key: 'Role', value: 'Regent-Chancellor of the Regency Council' },
      { key: 'Faction', value: 'The Regency Council' },
      { key: 'Where', value: 'Caer Ardith (far away)' },
      { key: '5e', value: 'Noble: AC 15 (fine breastplate), HP 27. Never alone: 4 knights and 2 Quiet Office spies. Insight +8, Deception +9.', gm: true },
    ],
    tags: ['npc', 'regency', 'far-away'],
    relations: [
      { to: 'f-regency-council', kind: 'leads', known: true },
      { to: 'f-quiet-office', kind: 'commands' },
      { to: 'item-lantern', kind: 'wants', note: 'As a leash, and a crown.' },
      { to: 'npc-tesh', kind: 'is searching for', note: 'An imperial by-blow. She doesn\'t know. Neither, yet, does he.' },
    ],
    body: `### Look and voice
Sixty-two, silver-haired, handsome in a soft, well-fed, unhurried way, with long pale hands and rings on every finger but the one where an emperor's seal would go. He dresses in black velvet so plain it must have cost a fortune. He smiles often and never with his eyes. His portrait hangs in every Regency office, including [[The Assessor's Office]], slightly crooked.

His voice is light, amused and silky, and he is the only person in the Regency who can make a tax sound like a kindness.

> "The throne is *empty*, my friends. Not *vacant*. There is a difference, and I am it."

> "Pay them? Of course we shall pay them. In time. Everything in the Regency happens in time. That is what the Regency is *for*."

### Who he is
Marius Vell is Regent-Chancellor of [[The Regency Council]], which has ruled [[The Regency of Ardith]] "until an heir is found" since [[The Kingslaying]] in 2981. He was a junior councillor then. He has been its head for nineteen years. In that time no heir has been found, though several have been looked for, and two found dead.

### What he wants
Publicly: order, stability, an heir, and the Treaty honoured. Privately: that no one, not the Concord, not the Mothers, not the Saint, can ever tell the Regency no again.

### What he knows
What the old imperial archives hold, which is more than anyone alive has read. They are very thorough.

:::gm
**Secret.** What Vell wants is a puppet emperor on the empty throne and the power of a ward behind him. He commissioned [[The Quiet Office]]'s work in [[Cinderford]]: stop the company's pay, divert it, break the company from within through [[Garrick Sallow]], and bring the flame to [[Caer Ardith]]. His agent there is [[Ansel Mote]].

He knows what the flame is, roughly, from the archives of [[The Emperor's Digs]]: a light of the Nine, a leash on what's under the wards. He also knows that imperial bloodlines hear the Sleeper, which is why no living heir has been allowed near the throne. His plan: find a pliable heir of the blood, put the flame in their hands, and stand behind them. He thinks he can control the voice that comes out of them. He is wrong.
:::`,
    gmNotes: `Vell never comes to the March. He is felt through paperwork, Mote's letters, and the occasional Regency form signed by "the Office of the Regent-Chancellor". If the PCs intercept a letter (via [[Kettle Brindlewake]]), let it be chillingly polite. In ending C, if the Regency gets the flame, Vell is the man who holds the leash, for a while.`,
  },
  // ───────────────────────────── The dead ─────────────────────────────
  {
    key: 'dannic-rook',
    type: 'npc',
    name: 'Dannic Rook',
    players: true,
    parent: 'the-ford',
    image: 'sil:dannic-rook',
    status: 'dead',
    statusKnown: false,
    summary: 'Private of the Ninth Lantern who deserted a week before payday, taking lantern oil from the stores. Wanted.',
    fields: [
      { key: 'Ancestry', value: 'Human' },
      { key: 'Role', value: 'Private (deserter)' },
      { key: 'Faction', value: 'The Ninth Lantern (deserted)' },
      { key: 'Where', value: 'Unknown (last seen at the Ford)' },
      { key: '5e', value: 'Zombie, drowned: AC 8, HP 30, resists fire, Undead Fortitude. Ash spills from his mouth: when he hits, target makes a DC 11 CON save or is poisoned until the end of its next turn.', gm: true },
    ],
    tags: ['npc', 'ninth-lantern', 'deserter'],
    relations: [
      { to: 'f-ninth-lantern', kind: 'deserted', known: true },
      { to: 'garrick-sallow', kind: 'was paid by', note: 'To swap the oil tins.' },
      { to: 'f-rook-court', kind: 'was raised by', note: 'A foundling at Corvel Rise; ran at fourteen.', known: true },
      { to: 'spoons', kind: 'owed money to', note: 'Eleven silver.', known: true },
      { to: 'kettle', kind: 'owed money to', known: true },
      { to: 'glass-barrow', kind: 'hid the oil in' },
    ],
    body: `### Who he was
Private Dannic Rook, twenty-four: sandy hair, freckles, a crooked front tooth, a laugh you could hear across the drill yard, and a burn scar on the back of his left hand shaped like a key. He was a foundling raised by the Ravelers at [[Corvel Rise]], and ran from them at fourteen to join the company, which the Ravelers took philosophically. A gambler and a decent shot. He'd been with [[The Ninth Lantern]] four years and owed money to half of it, including eleven silver to [[Spoons]] and rather more to [[Kettle Brindlewake]].

He was on the lantern store detail. On the night of 7 Ashfall he walked out of the Keep with two tins of lamp-oil and a grey company blanket and no goodbye. A wanted notice went up a week later in a neat clerk's hand, signed "A.M." ([[Wanted: Dannic Rook]]), saying he'd been seen on the Low Quay on the 12th. The company has a pool on whether he made it to the river.

> "I'll pay you back Restday, Spoons. Swear on the Corporal." (His last words to anyone in the company. Spoons wrote them down.)

### What people say
That he'd been jumpy for a month: couldn't sleep, kept checking the lantern, asked Brother Tallow once whether a flame could "get sick". That he'd been drinking with the Lieutenant, which isn't like Sallow. That he'd come into money, briefly, and lost it at dice. That a man on the bridge the night he ran saw him arguing with someone in a scarf.

:::gm
**The truth.** Dannic Rook is dead. [[Garrick Sallow]] paid him (his debts were the lever: "S. says one more swap and Im square") to swap the lantern's good oil for tins cut with ash. The tins came from [[Ansel Mote]]; the ash, lake-ash from [[Stillwater]], from [[The Dreaming Widow]]. He did it for a month. He watched the flame shrink and felt sick. On 7 Ashfall he tried to back out, took a good tin and a cut one as proof, and ran, meaning to take them to the Captain, or sell them; he never decided.

Mote caught him at [[The Ford]] that night and held him under the water until he stopped. The current took the body through the old culvert under the toll bridge into [[The Glass Barrow]], where the leak runs cold and the dead don't rest.

He didn't stay down. In **Payday** (session 1) the ford-watch hooks him out of the shallows and he stands up, with two other dead nobody recognises, and walks for home. His trail leads into the Barrow and the [[The Cut Oil Tin|tins]]. When he falls for the last time, his last words are: "It's cold under the glass."

The key-shaped scar matches [[Hathe's Door-Key]], which the Rook-Court keeps. Why a Raveler foundling bears its mark is a thread for Quorl, if you want one.
:::`,
    gmNotes: `Session 1's walking clue (see [[The Drowned Man]]). Play Rook as pitiful more than frightening: he stumbles toward home, stops to look at the lantern on the hill, and keeps going. If put down without a proper rite, he gets up again at the next red moon unless Quorl lays him to rest. The dates are the clue: he left on the 7th, the poster says he was seen on the 12th, and anyone with Medicine DC 11 can tell he's been in the water a week.`,
  },
  {
    key: 'marla-marlowe',
    type: 'npc',
    name: 'Marla Marlowe',
    parent: 'the-smokes',
    image: 'sil:marla-marlowe',
    status: 'dead',
    statusKnown: true,
    summary: 'Tick\'s mother, a tannery worker who died giving birth to him the night of the Battle of Cinders; her ghost walks beside him.',
    fields: [
      { key: 'Ancestry', value: 'Human' },
      { key: 'Role', value: 'Tanner (deceased); a ghost' },
      { key: 'Faction', value: 'None' },
      { key: 'Where', value: 'Beside Tick, always' },
      { key: '5e', value: 'Ghost: AC 11, HP 45. Never attacks. Can use Possession only to save Tick (and only once). Etherealness lets her look through walls for him.', gm: true },
    ],
    tags: ['npc', 'ghost', 'the-dead'],
    gmTags: ['secret'],
    relations: [
      { to: 'tick', kind: 'watches over' },
      { to: 'dreaming-widow', kind: 'sister of', note: 'She raised Wenna, and is frightened of her now.' },
      { to: 'npc-ottilie-marlowe', kind: 'daughter of', note: 'Ottilie delivered Tick and closed Marla\'s eyes.' },
    ],
    body: `### Look and voice
A small, tired woman of about twenty-five, grey all over as if she'd been drawn in ash: ash in her hair, ash on her apron, ash on her bare forearms, which are scarred from tanning vats. She has Tick's nose and Tick's wide mouth, though she doesn't smile much now. She walks at Tick's left side, always, where only his Hollowborn eye can see her, and she holds his hand at funerals.

She speaks rarely, in short sentences, in a broad Smokes accent.

> "Don't look at it when it's full, Tibby. It looks back."

> "I'm here. I'm here. Eat something."

### Who she was
Marla Marlowe came south from the Grimmark foothills in the war with her mother [[Ottilie Marlowe]] and her little sister Wenna, and found work in the tanneries of [[The Smokes]]. Tick's father was a soldier of one of the eight companies; she never told anyone which, and he died on the walls at [[The Battle of Cinders]] the same night his son was born. Marla gave birth in the cellar of Marlowe's, the family house, while the plain burned. She died before dawn.

Her mother delivered Tick, closed Marla's eyes, and raised the baby. The Ravelers buried Marla at [[Corvel Rise]].

She did not pass. [[Hathe]] died that night too, and his door stayed shut.

### What she wants
For Tick to live. For Tick to not look at the red moon. For her sister to stop.

### What she knows
Who [[The Dreaming Widow]] is. What the Widow wants with Tick. That the red moon is not a moon, not really, and that something behind it has been watching her son since the night he was born. She can't say how she knows; she's dead, and the dead know things sideways.

:::gm
**Running Marla.** She's real, and only Tick's player should ever be told what she says (pass notes). She cannot touch anything but Tick and loose ash (she can scratch a few words in ash, slowly, which anyone can then read), can't be heard by anyone else (except through Quorl's [[Hathe]]-gifts or a speak with dead), and can't go more than a stone's throw from him.

Her last words, in the Rook-Court ledger: "Wenna, hold his hand. Don't look up." Quorl can read them to Tick if Tick ever asks.

If the ward is resealed, Hathe's old doors steady enough for her to pass. Give Tick a goodbye.
:::`,
    gmNotes: `**Across the arc:** 1 she warns Tick away from the ford ("He's not right, that one"); 3 at the red moon she's frantic, pulling at him, saying "Not you, not you"; 4–5 she begins to say "her" and "Wenna"; 6 at the Rent she grows faint, as though something is pulling her toward the crack; 8 her fate rides on the ending.`,
  },
  {
    key: 'aurel-ix',
    type: 'npc',
    name: 'Aurel IX',
    aliases: ['Emperor Aurel IX', 'the last Emperor'],
    players: true,
    parent: 'caer-ardith',
    image: 'sil:aurel-ix',
    status: 'dead',
    statusKnown: true,
    summary: 'The last Emperor of Ardith, murdered by his own orc Iron Guard in 2981: the Kingslaying that broke the empire.',
    fields: [
      { key: 'Ancestry', value: 'Human' },
      { key: 'Role', value: 'Emperor of Ardith (deceased)' },
      { key: 'Faction', value: 'The old empire' },
      { key: 'Where', value: 'The imperial tombs, Caer Ardith' },
      { key: '5e', value: 'Dead. If you want him back: his ghost haunts the Gilded Gallery (ghost, with the mage\'s spells; speaks with the Sleeper\'s voice at full red moon).', gm: true },
    ],
    tags: ['npc', 'the-dead', 'history'],
    relations: [
      { to: 'caer-ardith', kind: 'ruled from', known: true },
      { to: 'god-sleeper', kind: 'heard', note: 'In dreams, for years before he died.' },
      { to: 'god-aurelan', kind: 'was anointed by', known: true },
    ],
    body: `### Who he was
Aurel IX, last of the line of Caedric, Emperor of Ardith by the grace of [[Aurelan]], the Crowned Sun. He reigned twenty-two years from [[Caer Ardith]] and was by most accounts a clever, cultivated, distant man who loved architecture and astronomy and disliked people. The coins of his reign show him in profile: a long nose, a high forehead, a slight frown, as though listening to something.

> "An empire is a promise the dead make to the unborn. I intend to keep it." (Carved over the palace gate. Soldiers have added a word to it in several places.)

On 14 Frostcall 2981 his orc Iron Guard murdered him in the Gilded Gallery, in the middle of petitions on the bean tax: [[The Kingslaying]]. He left no heir anyone has been able to seat. [[The Regency Council]] has ruled "until one is found" ever since, and the twenty-year [[The War of the Empty Throne]] was fought over who should find one.

### What people say
That the orcs were bought by the Concord. That they went mad. That the Emperor had insulted the Mothers. That he was planning to disband the Guard. That the Guard did it for no reason at all, because orcs are orcs. Every version has its tavern and its songs.

:::gm
**The truth.** Aurel IX heard the Sleeper. Imperial bloodlines were bred for ward-sensitivity, and he had it worse than most: from his thirties on, [[The Sleeper Below]] spoke to him in dreams, warmly, wisely, patiently, and promised him an empire that would never end. In 2979 he began secret digs at three ward sites ([[The Emperor's Digs]]): above [[Hollowhall]], at the foot of [[The Ninth Stone]] near Cinderford, and at a place his papers call only *the Wet Hill*, all booked to the Treasury as *Drainage Works (Western)*. He meant to open a ward and let the voice out. He thought it would make him a god-emperor. It would have made him a door.

The [[The Mothers of the Iron|Mothers]] found out and ordered him killed. [[Grashka]] struck the blow. The digging at the Ninth Stone's foot weakened it years before the Battle of Cinders cracked it. The Regency sealed the archives; [[Marius Vell]] has read them.
:::`,
    gmNotes: `Aurel IX is a history page and a warning. If the PCs take the flame (ending C), the voice that speaks to them is the one that spoke to him, and it will use the same words: "an empire that never ends", "a promise to the unborn".`,
  },
  // ───────────────────────────── Minor folk: the company ─────────────────────────────
  {
    key: 'npc-brannoc-saltash',
    type: 'npc',
    name: 'Brannoc Saltash',
    aliases: ['Cookie'],
    players: true,
    parent: 'lantern-keep',
    image: 'sil:npc-brannoc-saltash',
    status: 'alive',
    statusKnown: true,
    summary: 'The Ninth Lantern\'s cook, who swears exclusively in prayer.',
    fields: [
      { key: 'Ancestry', value: 'Human' },
      { key: 'Role', value: 'Company cook' },
      { key: 'Faction', value: 'The Ninth Lantern' },
      { key: 'Where', value: 'The Keep kitchen' },
      { key: '5e', value: 'Thug with a cleaver: AC 11, HP 32. Pack Tactics with anyone holding a ladle.', gm: true },
    ],
    tags: ['npc', 'ninth-lantern', 'soldier'],
    relations: [
      { to: 'fennick', kind: 'quarrels with', note: 'Every day, about rations.', known: true },
      { to: 'god-maelis', kind: 'swears by', known: true },
    ],
    body: `Big, bald, red-armed and sweating, with a leather apron and a voice like a kettle coming to the boil. Brannoc was pot-boy to Mother Hennet in the Ruddy Hundred's kitchen the night of [[The Battle of Cinders]]: he is the boy with the burnt hand in the company's story of the ninth lantern, and he will show you the scar if you ask, and not if you don't. He has cooked for [[The Ninth Lantern]] ever since, and every Restday he carries a bowl of his stew down to [[The Last Candle]] so that Hennet can tell him it wants salt.

He swears entirely in prayer, which the company finds more frightening than ordinary swearing:

> "[[Maelis]] bless this bastard pot and every bastard who eats from it. [[Grum]] keep the fire hot under that useless halfling's feet. Hearth Mother forgive me, *who took the salt?*"

He feeds the company on eleven days of rations stretched to thirty, and he knows exactly how hungry everyone is. If the pay doesn't come, he's the first to know the mood, and the last to say it out loud.`,
    gmNotes: `Use him as the mutiny's barometer: the thinner his stew, the closer the company is to breaking. If the PCs bring him food, the Mutiny clock rolls back one segment.`,
  },
  {
    key: 'npc-jory-dunmore',
    type: 'npc',
    name: 'Jory Dunmore',
    players: true,
    parent: 'lantern-keep',
    image: 'sil:npc-jory-dunmore',
    status: 'alive',
    statusKnown: true,
    summary: 'Crossbowman of the Ninth Lantern, one of the Dunmore twins, who never agree about anything.',
    fields: [
      { key: 'Ancestry', value: 'Human' },
      { key: 'Role', value: 'Crossbowman' },
      { key: 'Faction', value: 'The Ninth Lantern' },
      { key: 'Where', value: 'The east wall' },
      { key: '5e', value: 'Scout with a heavy crossbow: AC 13, HP 16, +5 to hit, 1d10+3.', gm: true },
    ],
    tags: ['npc', 'ninth-lantern', 'soldier'],
    relations: [
      { to: 'npc-jessom-dunmore', kind: 'twin of', note: 'The elder. He says.', known: true },
      { to: 'ilse-marrow', kind: 'loyal to', known: true },
    ],
    body: `Lanky, red-haired, freckled, and one half of the Dunmore twins, the best crossbow pair in the March and the worst company on a long march. Jory and his brother [[Jessom Dunmore]] have never once agreed about anything: which of them is older (Jory, he says), the range to the next ridge, whether it's raining, the colour of the Captain's eyes, whether the drowned man was actually drowned.

> "Two hundred paces." "Hundred and eighty." "Two hundred." "You've been wrong since the womb, Jory." "*I* came out first."

They shoot together, though, and when they do, nothing within two hundred paces (or a hundred and eighty) lives long. Jory is the steadier of the two, a little slower, very loyal to [[Captain Marrow]].`,
    gmNotes: `Sergeant Vosk lends the twins to the PCs for the ash crossing in session 2. Let them argue the entire way and be right exactly half the time. See Jessom for the twist.`,
  },
  {
    key: 'npc-jessom-dunmore',
    type: 'npc',
    name: 'Jessom Dunmore',
    players: true,
    parent: 'lantern-keep',
    image: 'sil:npc-jessom-dunmore',
    status: 'alive',
    statusKnown: true,
    summary: 'The other Dunmore twin: quicker, angrier, and certain he\'s the elder.',
    fields: [
      { key: 'Ancestry', value: 'Human' },
      { key: 'Role', value: 'Crossbowman' },
      { key: 'Faction', value: 'The Ninth Lantern' },
      { key: 'Where', value: 'The east wall' },
      { key: '5e', value: 'Scout with a heavy crossbow: AC 13, HP 16, +5 to hit, 1d10+3. Quicker on the draw: +2 initiative.', gm: true },
    ],
    tags: ['npc', 'ninth-lantern', 'soldier'],
    relations: [
      { to: 'npc-jory-dunmore', kind: 'rival of', note: 'His twin. Disagrees on principle.', known: true },
      { to: 'garrick-sallow', kind: 'sides with', note: 'Quietly, for now.' },
    ],
    body: `Identical to [[Jory Dunmore]] except in every way that matters: quicker to laugh, quicker to shoot, quicker to anger. He wears his red hair long to be different, and his brother cut his short to be different first. He has a debt to [[Spoons]] and a grudge against everyone who eats regularly.

> "You're wrong." "I haven't said anything yet." "You were about to."

He is a superb shot and a bad loser, and lately he has been drinking with the Lieutenant's friends.

:::gm
Jessom has sided with [[Garrick Sallow]]: he's hungry, angry and owes money, and Sallow listens. Jory doesn't know yet. When the mutiny breaks in session 7, the twins end up on opposite walls, crossbows loaded, finally disagreeing about something that matters. Whether one shoots the other is up to the PCs.
:::`,
    gmNotes: `The twins are comic relief until session 7, when they are suddenly not. Plant Jessom's drinking with Sallow's crowd early.`,
  },
  {
    key: 'npc-noume-flarewick',
    type: 'npc',
    name: 'Noume Flarewick',
    players: true,
    parent: 'lantern-hill',
    image: 'sil:npc-noume-flarewick',
    status: 'alive',
    statusKnown: true,
    summary: 'Vesh signaller of the Ninth Lantern, who talks to the far patrols in lamp-code and can\'t stop looking at the cage.',
    fields: [
      { key: 'Ancestry', value: 'Vesh' },
      { key: 'Role', value: 'Signaller' },
      { key: 'Faction', value: 'The Ninth Lantern' },
      { key: 'Where', value: 'The signal tower, Lantern Hill' },
      { key: '5e', value: 'Scout: AC 13, HP 16. Darkvision 120 ft; can signal a full sentence by lamp in one round.', gm: true },
    ],
    tags: ['npc', 'ninth-lantern', 'vesh'],
    relations: [
      { to: 'ysse', kind: 'admires', known: true },
      { to: 'mirrel-vosk', kind: 'reports to', known: true },
    ],
    body: `A slight, soft-voiced Vesh with silver-dusted wings folded under a signaller's coat and antennae that twitch toward every light. Noume works the shuttered lamps and flares on the signal tower at night, sending lamp-code to the patrols on the ash, and is the only person in the company who can hold a conversation with a sentry two miles away. Off duty, Noume talks with flickering hands out of habit.

> "Patrol says: road buried, all well, send soup. Patrol always says send soup."

Like every Vesh, Noume is drawn to magic like a moth to flame, and drifts toward the lantern's cage between watches without meaning to. Noume thinks [[Ysse Lampwright]] is the most interesting person to arrive in years, and is too shy to say so.

:::gm
Noume can see that the world goes thin around the lantern, the way it does near a ward, and has decided, on principle, to ignore it, as Vesh do. Asked directly by a PC who has earned trust, Noume will admit it. On the red moon night, Noume signals the far patrols and gets back a message from nobody: three flashes from inside the Rent.
:::`,
  },
  {
    key: 'npc-skarra',
    type: 'npc',
    name: 'Skarra',
    aliases: ['Skarra Burnbrow'],
    players: true,
    parent: 'lantern-keep',
    image: 'sil:npc-skarra',
    status: 'alive',
    statusKnown: true,
    summary: 'Orc sapper of the Ninth Lantern: slow, careful, permanently eyebrowless, and Tick\'s professional rival.',
    fields: [
      { key: 'Ancestry', value: 'Orc' },
      { key: 'Role', value: 'Sapper' },
      { key: 'Faction', value: 'The Ninth Lantern' },
      { key: 'Where', value: 'The powder store, below the Keep' },
      { key: '5e', value: 'Veteran without the longsword: AC 15, HP 45. Two flasks of alchemist\'s fire and a satchel charge (DEX save DC 14, 4d6 fire in 10 ft).', gm: true },
    ],
    tags: ['npc', 'ninth-lantern', 'orc'],
    relations: [
      { to: 'tick', kind: 'rival of', note: '"He\'s fast. Fast sappers are dead sappers."', known: true },
      { to: 'f-mothers', kind: 'writes to', note: 'Her mother is Mother Hesha, of the Mothers\' council.' },
    ],
    body: `In the orc way she is **Skarra, Hesha's daughter**; the company calls her Burnbrow, because she has had no eyebrows since 2996 and has stopped pretending they'll grow back. A thick, patient orc woman of forty with scorched gauntlets and a pipe she is forbidden to light within fifty paces of her own store.

> "Measure twice. Fuse once. Pray to [[Grum]] after, if you've still got hands."

She thinks [[Tick]] is a genius who will die young and take a wall with him. He thinks she's a coward who uses three times the fuse she needs. She sends him a jar of burn salve every Restday without a note.

:::gm
Skarra's mother is Mother Hesha, who sits on the Mothers' council. Skarra writes home every month. Her last letter mentioned that "an exile with nine knuckles" has signed with the company. The Mothers now know where [[Varra Nine-Knuckles]] is. Whether they act, and how, is the GM's lever for sessions 5 to 8.
:::`,
  },
  {
    key: 'npc-skrell',
    type: 'npc',
    name: 'Skrell Already-Gone',
    aliases: ['Skrell'],
    players: true,
    parent: 'corvel-rise',
    image: 'sil:npc-skrell',
    status: 'alive',
    statusKnown: true,
    summary: 'Raveler corpse-runner who carries the Ninth Lantern\'s dead to Corvel Rise at a flat sprint.',
    fields: [
      { key: 'Ancestry', value: 'Raveler' },
      { key: 'Role', value: 'Corpse-runner' },
      { key: 'Faction', value: 'The Rook-Court' },
      { key: 'Where', value: 'Anywhere someone has just died' },
      { key: '5e', value: 'Scout: AC 13, HP 16, speed 40 ft (50 ft pushing an empty handcart).', gm: true },
    ],
    tags: ['npc', 'rook-court', 'raveler'],
    relations: [
      { to: 'mother-corvane', kind: 'answers to', known: true },
      { to: 'dannic-rook', kind: 'grew up with', note: 'Fledgling-mates at Corvel Rise.' },
    ],
    body: `A small, scruffy, rust-black Raveler with a handcart, a sackcloth hood and the fastest feet in the March. Skrell runs bodies from the walls, the ash and the alleys up to [[Corvel Rise]] before they can get any ideas. He earned his deed-name at his first burial by being, when the priest turned to thank him, already gone.

> "Dead, is he? Lovely. Lift with your knees, I'm not carrying two of you."

He is cheerful, profane and deeply kind to the bereaved, and he has a joke for every kind of death. He tells the PCs, whenever they head out, which joke he's saving for each of them.

:::gm
Skrell and [[Dannic Rook]] were fledgling-mates at Corvel Rise before Dannic ran away to soldier. When the drowned man walks, Skrell knows the key-shaped scar on his hand at once, and goes very quiet. He has no joke for that one. He'll tell Quorl, if Quorl asks, that Dannic got the scar as a boy, touching something in the Rook-Court's reliquary he shouldn't have.
:::`,
  },
  {
    key: 'npc-ismere',
    type: 'npc',
    name: 'Ismere once-Fenn',
    aliases: ['Old Ismere'],
    players: true,
    parent: 'lantern-keep',
    image: 'sil:npc-ismere',
    status: 'alive',
    statusKnown: true,
    summary: 'Ancient elven veteran of four companies, covered in ink she can no longer read.',
    fields: [
      { key: 'Ancestry', value: 'Elf' },
      { key: 'Role', value: 'Veteran spearwoman' },
      { key: 'Faction', value: 'The Ninth Lantern' },
      { key: 'Where', value: 'The Keep\'s north wall; the Last Candle' },
      { key: '5e', value: 'Veteran with a spear: AC 16, HP 58. Advantage on History about any battle since 2600.', gm: true },
    ],
    tags: ['npc', 'ninth-lantern', 'elf'],
    relations: [
      { to: 'aelith-sorn', kind: 'distrusts', known: true },
      { to: 'sorrel-vey', kind: 'drinks with', known: true },
    ],
    body: `Tall, gaunt, silver-haired and very old, with ink on every inch of skin that shows: her history, battle by battle, back four centuries. Since she crossed her last century mark she has called herself *once-Fenn*, because the house she was born to has gone out of her memory, and the oldest ink on her arms is in a hand she can no longer read.

> "That one, there, on my wrist? Some war. I won, I think. I'm here."

She served with four companies and was at [[The Battle of Cinders]] with the Iron Tithe; its lantern went out in the first hour. She is patient with recruits, merciless on the drill field, and the only person who can make [[Sergeant Vosk]] laugh out loud.

:::gm
Ismere has noticed the Remembrancer, [[Aelith Sorn]], watching her arms in the Last Candle. She doesn't like it. If asked, she can tell the PCs that Remembrancers sometimes "collect" the skins of the old dead: politely, with paperwork, and not always after they're dead.
:::`,
  },
  {
    key: 'npc-gerda-hollin',
    type: 'npc',
    name: 'Gerda Hollin',
    players: true,
    parent: 'lantern-keep',
    image: 'sil:npc-gerda-hollin',
    status: 'alive',
    statusKnown: true,
    summary: 'Surface dwarf shieldbearer who reveres the Lithic and makes the sign of Tharos whenever Borrin passes.',
    fields: [
      { key: 'Ancestry', value: 'Dwarf' },
      { key: 'Role', value: 'Shieldbearer, corporal of a tally' },
      { key: 'Faction', value: 'The Ninth Lantern' },
      { key: 'Where', value: 'The gatehouse at the Ford' },
      { key: '5e', value: 'Guard, upgraded: AC 18 (chain, shield), HP 30, dwarven resilience.', gm: true },
    ],
    tags: ['npc', 'ninth-lantern', 'dwarf'],
    relations: [
      { to: 'borrin', kind: 'distrusts', note: 'Makes the sign of Tharos at him.', known: true },
      { to: 'f-last-wardens', kind: 'reveres', known: true },
    ],
    body: `Short, square, grey-braided and immovable, Gerda commands a tally at the gatehouse and holds a shield wall like a cliff holds the sea. Like most surface dwarves she reveres [[The Lithic]] as holy ancestors made stone, and she makes a pilgrimage to the [[The Treaty Stone|Treaty Stone]] every Restday to leave a pebble "for the ones who stood".

She does not like [[Borrin Halt]]. She makes the sign of [[Tharos]] whenever he passes, and he has started making it back, which infuriates her.

> "Nothing that walks out of the deep without its shadow walks out alone, boy. My grandmother told me that. She was right about everything else."

:::gm
Gerda is right, which is the worst part. If Borrin's shadow-thing acts before session 6, Gerda is the one who sees it, and the company will believe her. Win her over (save her tally, show her the respect due a Lithic shrine) and she becomes Borrin's fiercest defender instead.
:::`,
  },
  {
    key: 'npc-thistle-weirford',
    type: 'npc',
    name: 'Thistle Weirford',
    players: true,
    parent: 'lantern-keep',
    image: 'sil:npc-thistle-weirford',
    status: 'alive',
    statusKnown: true,
    summary: 'Fifteen-year-old halfling drummer and runner of the Ninth Lantern, who carries every message and reads most of them.',
    fields: [
      { key: 'Ancestry', value: 'Halfling' },
      { key: 'Role', value: 'Drummer and runner' },
      { key: 'Faction', value: 'The Ninth Lantern' },
      { key: 'Where', value: 'Everywhere, at a run' },
      { key: '5e', value: 'Commoner, quick: AC 12, HP 6, speed 30 ft, Halfling Nimbleness.', gm: true },
    ],
    tags: ['npc', 'ninth-lantern', 'halfling'],
    relations: [
      { to: 'kettle', kind: 'spies for', note: 'Paid in toffee and gossip.' },
      { to: 'tick', kind: 'admires', known: true },
    ],
    body: `A small, sharp-faced halfling girl with a drum on her back, ink on her fingers and her hair in two furious plaits. Thistle ran away from a barge to join the company at twelve ("barges are boring, they only go two ways"), lied about her age, and was taken on as drummer because nobody else could keep time. She carries messages between the Keep, the Ford and the town, and reads every one that isn't sealed, and some that are.

> "Not reading it. Just *checking it's the right one*."

She thinks [[Tick]] is the most exciting person alive, and follows him around asking what he's going to blow up next.

:::gm
She sells what she reads to [[Kettle Brindlewake]], for toffee and gossip, and Kettle sells it on. If the PCs want to plant false news, Thistle is the pipe. If someone in the company wants to silence a runner, she's the obvious victim. Keep her alive if you can bear it.
:::`,
  },
  {
    key: 'npc-dunstan-bray',
    type: 'npc',
    name: 'Dunstan Bray',
    aliases: ['Corporal Bray'],
    players: true,
    parent: 'lantern-keep',
    image: 'sil:npc-dunstan-bray',
    status: 'alive',
    statusKnown: true,
    summary: 'Big, affable corporal of the Ninth Lantern, everybody\'s friend, and Lieutenant Sallow\'s man.',
    fields: [
      { key: 'Ancestry', value: 'Human' },
      { key: 'Role', value: 'Corporal' },
      { key: 'Faction', value: 'The Ninth Lantern' },
      { key: 'Where', value: 'The barracks; the Last Candle' },
      { key: '5e', value: 'Thug: AC 14 (studded leather), HP 32, mace, Pack Tactics.', gm: true },
    ],
    tags: ['npc', 'ninth-lantern', 'soldier'],
    relations: [
      { to: 'garrick-sallow', kind: 'serves', note: 'His family were Sallow servants for three generations.' },
      { to: 'spoons', kind: 'drinks with', known: true },
    ],
    body: `A broad, ruddy, slow-smiling man with hands like shovels, a laugh that fills a barracks and a gift for remembering birthdays. Corporal Bray buys drinks he can't afford, lends money he doesn't have, and always seems to know who's angry and why.

> "Nobody's saying *mutiny*, lad. We're just saying *hungry*. Out loud. Together."

His family served the Sallows in the [[Fallowden]] country for three generations. He followed the Lieutenant into the company and would follow him anywhere.

:::gm
Bray counts heads for [[Garrick Sallow]]'s mutiny: who's wavering, who's loyal, who could be bought with a hot meal. He knows nothing about the oil and nothing of [[Ansel Mote]]; he thinks the silver Sallow spends is family money. If the PCs pry into the mutiny in sessions 4 to 5, Bray is told to "have a word" with them, and brings friends. Caught and pressed, he folds, weeping, and tells everything he knows, which is only enough to hang Sallow.
:::`,
  },
  {
    key: 'npc-maud-severin',
    type: 'npc',
    name: 'Maud Severin',
    aliases: ['the Surgeon'],
    players: true,
    parent: 'lantern-keep',
    image: 'sil:npc-maud-severin',
    status: 'alive',
    statusKnown: true,
    summary: 'The Ninth Lantern\'s surgeon: sews with fishing line, drinks with both hands, and prays to the Hanged Corporal.',
    fields: [
      { key: 'Ancestry', value: 'Human' },
      { key: 'Role', value: 'Company surgeon' },
      { key: 'Faction', value: 'The Ninth Lantern' },
      { key: 'Where', value: 'The infirmary, Lantern Keep' },
      { key: '5e', value: 'Acolyte, reskinned: AC 10, HP 9. Medicine +7; can stabilise two creatures a round. Knows cure wounds (2/day), which she insists is not a prayer.', gm: true },
    ],
    tags: ['npc', 'ninth-lantern', 'healer'],
    relations: [
      { to: 'god-corporal', kind: 'prays to', note: 'Out of spite. It answers.', known: true },
      { to: 'seraphine-ashe', kind: 'resents', note: 'For healing for free.', known: true },
    ],
    body: `Fifty, grey-haired, sleeves rolled, hands steady as a carpenter's until about the fourth drink, after which they're steadier. Maud has sewn up three armies and sawn off more legs than she can count, and she counts everything. She sews with fishing line because it holds, and keeps a list of her dead pinned inside her apron.

> "Bite this. No, the *leather*, not me. There. You'll live, more's the pity. Next."

She prays to [[The Hanged Corporal]], the common soldiers' saint, every night: not reverently, but the way you'd write to a friend who owes you. Lately she swears he's been answering. Her patients have started recovering from things they shouldn't.

She does not like [[Sister Seraphine]]'s mission healing soldiers for nothing. "Nothing is a very high price," she says.`,
    gmNotes: `A grounded, funny, sad healer for the PCs to come back to. If the Saint's church starts healing the company in session 4, Maud's infirmary empties, and she takes it personally. If she lives to session 8, let the Hanged Corporal answer her once, out loud.`,
  },
  // ───────────────────────────── Minor folk: the town ─────────────────────────────
  {
    key: 'npc-ottilie-marlowe',
    type: 'npc',
    name: 'Ottilie Marlowe',
    aliases: ['Mam Ottilie'],
    players: true,
    parent: 'the-smokes',
    image: 'sil:npc-ottilie-marlowe',
    status: 'alive',
    statusKnown: true,
    summary: 'The Smokes\' midwife, who has delivered nearly every Hollowborn in Cinderford, and raised her grandson Tick.',
    fields: [
      { key: 'Ancestry', value: 'Human' },
      { key: 'Role', value: 'Midwife' },
      { key: 'Faction', value: 'None (the Smokes)' },
      { key: 'Where', value: 'Marlowe\'s, the Smokes' },
      { key: '5e', value: 'Commoner: AC 10, HP 8. Medicine +6. Everyone in the Smokes will hide her.', gm: true },
    ],
    tags: ['npc', 'smokes', 'midwife'],
    relations: [
      { to: 'marla-marlowe', kind: 'mother of' },
      { to: 'dreaming-widow', kind: 'mother of', note: 'Her younger daughter, Wenna. They have not spoken in five years.' },
      { to: 'f-sleepless', kind: 'watches', note: 'Stands at the back of meetings to look at her daughter.' },
    ],
    body: `Small, stooped, nearly seventy, with a voice like a rusty gate, forearms like a blacksmith's and a bag that clanks. Mam Ottilie has delivered nearly every child born in [[The Smokes]] since the war, including thirty-one of the first [[The Hollowborn|Hollowborn]], and the birth-rolls in her hand note each one ("one eye wrong, otherwise fine", underlined twice). She lives in Marlowe's, the narrow house where her grandson [[Tick]] was born, and she raised him there.

> "Push, love. No, *push*. You're not shelling peas. There. There she is. Oh, look at her, she's *looking* at something."

She is brusque, practical, and quietly terrified of the red moon. She calls Tick "my lad" and scolds him like a ten-year-old, which, by the calendar, he nearly is. Ask her about the six born the night of Cinders, Tick among them, and she goes quiet, and then says she has delivered two thousand babies and only six ever came out already counting the days. She measured all six against her cellar door until they stopped growing. The door is still there, and so are the marks.

:::gm
Ottilie's younger daughter, Wenna, ran away from Marlowe's at twelve, and is now [[The Dreaming Widow]]. Ottilie knows. She has never told Tick. She goes to Sleepless meetings sometimes, at the back, just to look at her daughter's face. If the PCs earn her trust, she is the key to reaching the Widow as a person, not a prophet.

The marks on her cellar door jump at every full Ember: the Cinders-born grew in steps, one for each red moon. Ottilie has noticed and written it in the Maelis birth-rolls, and told no one. It is the plainest clue to [[Why did the Cinders-born grow up so fast?]].
:::`,
  },
  {
    key: 'npc-nan-crupp',
    type: 'npc',
    name: 'Nan Crupp',
    players: true,
    parent: 'cinder-ferry',
    image: 'sil:npc-nan-crupp',
    status: 'alive',
    statusKnown: true,
    summary: 'Halfling ferrywoman of the Cinder, eighty if a day, who has carried more secrets across the river than the Velvet Ledger.',
    fields: [
      { key: 'Ancestry', value: 'Halfling' },
      { key: 'Role', value: 'Ferrywoman' },
      { key: 'Faction', value: 'The Barge Clans' },
      { key: 'Where', value: 'The Cinder ferry, below the Ford' },
      { key: '5e', value: 'Commoner: AC 10, HP 5. Never falls in. Advantage on Insight with anyone who pays in silver for a penny crossing.', gm: true },
    ],
    tags: ['npc', 'barge-clans', 'halfling'],
    relations: [
      { to: 'kettle', kind: 'disapproves of', note: '"That girl will hang."', known: true },
      { to: 'borrin', kind: 'has seen', note: 'On the ford at midnight, when he was in his bunk.' },
    ],
    body: `Tiny, toothless, brown and wrinkled as a walnut, Nan Crupp has poled the ferry across the Cinder since the bridge was a wreck. She charges a penny, the same as the bridge, and there is no gate-watch at her landing asking your business. She claims to have taken more secrets across the river than the Velvet Ledger has in its book, "and cheaper".

> "Penny a crossing, love. Two if you're crying. Three if you're bleeding on my boat."

She calls [[Kettle Brindlewake]] "that girl" and is sure she'll hang. She knows the river's moods, which bodies come up where, and how long a drowned man takes to rise.

:::gm
Nan saw [[Borrin Halt]] standing on the ford in the middle of the river at midnight, a week before session 1, looking down into the water. It wasn't Borrin: he was in his bunk. She'll mention it to the PCs, cheerfully, the first time Borrin rides her ferry. She also saw a man in a scarf on the bridge on 7 Ashfall, and heard a splash, and minded her own business, which she now regrets.
:::`,
  },
  {
    key: 'npc-jaspin-sweet',
    type: 'npc',
    name: 'Jaspin Sweet',
    players: true,
    parent: 'gutter-market',
    image: 'sil:npc-jaspin-sweet',
    status: 'alive',
    statusKnown: true,
    summary: 'Silver-voiced fence at Gutter Market who buys anything from the glass and never asks where it came from.',
    fields: [
      { key: 'Ancestry', value: 'Human' },
      { key: 'Role', value: 'Fence' },
      { key: 'Faction', value: 'None (sells to the Glassers\' market)' },
      { key: 'Where', value: 'Gutter Market, the stall with the blue awning' },
      { key: '5e', value: 'Spy: AC 12, HP 27. Appraisal +7. Two Glasser thugs nearby.', gm: true },
    ],
    tags: ['npc', 'gutter-market', 'fence'],
    relations: [
      { to: 'f-glassers', kind: 'buys from', known: true },
      { to: 'fennick', kind: 'buys from', note: 'Company salvage, quietly.' },
    ],
    body: `Slim, dapper and soft-spoken, Jaspin wears grey kid gloves at all times, a silk cravat the colour of a bruise, and a smile that makes you check your pockets. His stall under the blue awning at [[Gutter Market]] sells nothing much: a few rings, some glass beads, a dented helmet. What he buys is the real business. Anything from the glass, from anyone, no questions, cash.

> "Oh, how *lovely*. Where did you get it? No, don't tell me. I adore not knowing things. It's so restful."

He buys company salvage from [[Fennick Bottlebrook]] and is scrupulously fair to him, because a quartermaster in debt is a supplier for life.

:::gm
In the last week Jaspin has bought a great deal of fresh Concord coin from Glassers at a discount: the pay wagon's strongbox, broken up and sold off a handful at a time. A sharp PC who sees him paying out shiny Concord silver in session 2 has a lead straight to [[Fort Mercy]].
:::`,
  },
  {
    key: 'npc-tesh',
    type: 'npc',
    name: 'Tesh',
    players: true,
    parent: 'velvet-ledger',
    image: 'sil:npc-tesh',
    status: 'alive',
    statusKnown: true,
    summary: 'Courtesan of the Velvet Ledger who used to dig the glass, and who cannot sleep at night.',
    fields: [
      { key: 'Ancestry', value: 'Human' },
      { key: 'Role', value: 'Courtesan of the Velvet Ledger' },
      { key: 'Faction', value: 'Temple of Isaurana (the Velvet Ledger)' },
      { key: 'Where', value: 'The Velvet Ledger' },
      { key: 'Bloodline', value: 'Imperial, by a by-blow of Aurel IX\'s uncle', gm: true },
      { key: '5e', value: 'Noble: AC 11, HP 9. Persuasion +6. Hears the Sleeper at full red moon (advantage on checks to know where the Rent is, from anywhere).', gm: true },
    ],
    tags: ['npc', 'velvet-ledger'],
    relations: [
      { to: 'sorrel-vey', kind: 'confides in', known: true },
      { to: 'god-sleeper', kind: 'hears', note: 'Imperial blood. She doesn\'t know why.' },
    ],
    body: `Thirty, dark-eyed and long-limbed, with a laugh like a dropped tray and old white scars across both palms from her years cutting glass for the Glassers. Tesh gave up digging three years ago and came to [[The Velvet Ledger]], where the lamps are lit all night, the music never quite stops, and nobody minds if you don't sleep. She doesn't. She hasn't, properly, since she was a girl.

> "Nights are long, darling. Better to spend them with someone who listens. You'd be amazed what you hear when you listen."

She is warm, clever, a gifted listener and an even better liar, and a favourite of half the officers in town. She knows the Lieutenant's opinions, the Assessor's clerk's tea order, and how the Captain takes her wine.

:::gm
Tesh is of the imperial blood, through a by-blow of Aurel IX's uncle, and she doesn't know it. Imperial lines were bred to feel the wards; she hears [[The Sleeper Below]] in her sleep, which is why she stopped sleeping, and why the glass called to her. [[Ansel Mote]] took tea in the Ledger on his first evening to look at her. [[Marius Vell]]'s office is searching for pliable heirs. If the Regency takes the flame (ending C), Tesh is the puppet they'll put it in the hands of.
:::`,
  },
  {
    key: 'npc-dunny-pike',
    type: 'npc',
    name: 'Dunny Pike',
    players: true,
    parent: 'treaty-bell',
    image: 'sil:npc-dunny-pike',
    status: 'alive',
    statusKnown: true,
    summary: 'Twelve-year-old bell-ward of the Treaty Bell: very serious, very loud, and the best lookout in town for the price of a pear.',
    fields: [
      { key: 'Ancestry', value: 'Human' },
      { key: 'Role', value: 'Bell-ward of the Treaty Bell' },
      { key: 'Faction', value: 'Cinderford (the town)' },
      { key: 'Where', value: 'The Treaty Bell, at the Ford' },
      { key: '5e', value: 'Commoner: AC 10, HP 3. Perception +5. Rings the bell in one action; the whole town hears it.', gm: true },
    ],
    tags: ['npc', 'cinderford', 'child'],
    relations: [
      { to: 'odile-fairweather', kind: 'reports to', known: true },
      { to: 'mirrel-vosk', kind: 'looks up to', known: true },
    ],
    body: `A skinny, solemn boy of twelve with a bowl haircut, enormous ears and a rope-burned palm. Dunny holds the post of bell-ward because his father held it, and his father is dead. He takes it more seriously than anyone has ever taken anything. He rings the Treaty Bell to close the ford at dusk, for fires, for deaths, for the Reeve's announcements, and, once, for a cat stuck on the roof.

> "That's three rings for a fire, two for a death and one for the ford. Four is for the end of the world. I've never done four. I practise it in my head."

He knows everyone who crosses the square and when, and is a better source than the toll-clerk, for the price of a pear. He rang the bell at noon on 14 Ashfall when the ford-watch hooked the drowned man out of the shallows, and he has not stopped thinking about it.`,
    gmNotes: `A lovely source and a lovely hostage. On the red moon night, Dunny rings four. He doesn't know why he did it.`,
  },
  {
    key: 'npc-widow-pruitt',
    type: 'npc',
    name: 'Hester Pruitt',
    aliases: ['Widow Pruitt'],
    players: true,
    parent: 'assessors-office',
    image: 'sil:npc-widow-pruitt',
    status: 'alive',
    statusKnown: true,
    summary: 'Clerk of the Assessor\'s Office who does the sums, has done them alone for two years, and distrusts the new clerk on principle.',
    fields: [
      { key: 'Ancestry', value: 'Human' },
      { key: 'Role', value: 'Clerk (sums)' },
      { key: 'Faction', value: 'The Regency Council (Assessor\'s Office)' },
      { key: 'Where', value: 'The Assessor\'s Office' },
      { key: '5e', value: 'Commoner: AC 10, HP 6. Investigation +5 on any ledger; a heavy brass abacus (1d4 bludgeoning).', gm: true },
    ],
    tags: ['npc', 'regency', 'clerk'],
    relations: [
      { to: 'ansel-mote', kind: 'distrusts', note: '"Nobody has a cold for three weeks."', known: true },
      { to: 'npc-nib', kind: 'feeds', known: true },
    ],
    body: `Sixty, thin, black-clad, sharp-nosed, with a brass abacus she treats as both instrument and weapon. Widow Pruitt has kept the books of [[The Assessor's Office]] alone for two years, writing to the capital monthly to ask for help and receiving, monthly, more forms. She is delighted [[Pell Quillon]] has finally come, and horrified by how nice he is.

> "A man who has a cold for three weeks is either dying or lying, and that one's not dying."

She means [[Ansel Mote]]. She has no evidence. She has a long memory, a suspicious nature and every receipt since 3009.

:::gm
Pruitt's receipts can show that the Assessor's Office paid a Temple Row printer for a wanted poster on the 13th, signed off by "A.M.". She'll find it if asked to look, and she'll be smug about it. She's also the one who notices, in session 7, that the office's lamp oil has gone missing. Mote wants to burn the place.
:::`,
  },
  {
    key: 'npc-nib',
    type: 'npc',
    name: 'Nib',
    players: true,
    parent: 'assessors-office',
    image: 'sil:npc-nib',
    status: 'alive',
    statusKnown: true,
    summary: 'Errand boy of the Assessor\'s Office, paid in biscuits, who sees more than the clerks do.',
    fields: [
      { key: 'Ancestry', value: 'Human' },
      { key: 'Role', value: 'Errand boy' },
      { key: 'Faction', value: 'The Regency Council (Assessor\'s Office), for biscuits' },
      { key: 'Where', value: 'The Assessor\'s Office; the streets' },
      { key: '5e', value: 'Commoner: AC 11, HP 3. Stealth +5. Can get into any room in town through a window.', gm: true },
    ],
    tags: ['npc', 'cinderford', 'child'],
    relations: [
      { to: 'ansel-mote', kind: 'spies on', note: 'If the PCs pay in biscuits.' },
      { to: 'npc-thistle-weirford', kind: 'rival of', note: 'Messengers\' feud.', known: true },
    ],
    body: `A grubby, gap-toothed orphan of nine or ten with a cap too big for him and pockets full of crumbs. Nib runs errands for [[The Assessor's Office]] and is paid in biscuits, which he considers an excellent arrangement and the office considers a budget triumph. He knows every alley in town, and is locked in a bitter feud with the company runner [[Thistle Weirford]] over who is faster.

> "Four biscuits. Five if it's up a hill. Six if it's the clerk. I don't like going near the clerk."

:::gm
Nib has noticed that Mote keeps a second ledger, a small black one, which he never leaves on his desk. Nib has seen him write in it at night, by the window, and then look out at Lantern Hill for a long time. For a sack of biscuits, Nib will try to get it. This could easily get him killed.
:::`,
  },
  {
    key: 'npc-pennamund',
    type: 'npc',
    name: 'Cousin Pennamund',
    aliases: ['Ommerrow Pennamund'],
    players: true,
    parent: 'tollamund-house',
    image: 'sil:npc-pennamund',
    status: 'alive',
    statusKnown: true,
    summary: 'A young Shellback factor of the Concord, a hundred and forty years old and considered dangerously hasty.',
    fields: [
      { key: 'Ancestry', value: 'Shellback' },
      { key: 'Role', value: 'Factor and auditor of the Concord Houses' },
      { key: 'Faction', value: 'The Concord Houses' },
      { key: 'Where', value: 'Tollamund & Daughters' },
      { key: '5e', value: 'Noble: AC 17 (shell), HP 30, speed 20. Arithmetic +9.', gm: true },
    ],
    tags: ['npc', 'concord', 'shellback'],
    relations: [
      { to: 'tollamund', kind: 'audits', known: true },
      { to: 'f-concord-houses', kind: 'serves', known: true },
    ],
    body: `A Shellback the size of a wheelbarrow, his shell still bright green-brown and only lightly ringed, with spectacles perched on his beak-like nose and a satchel of ledgers strapped to his back. **Cousin Pennamund** (his given name is Ommerrow; he's young enough to use it once a year) has come from [[Sevenhaven]] to audit Tollamund's purchases in the March. By Shellback standards he is a reckless youth. He speaks in sentences of almost normal speed and walks nearly as fast as a slow human, which the old Shellbacks regard as vulgar.

> "One hundred and forty is a perfectly respectable age, thank you. I'm *mature*. I simply *finish my sentences*."

He is earnest, a little lonely, and thrilled to talk to anyone who isn't three hundred years old.

:::gm
The Concord Table sent Pennamund because they suspect Grandmother Tollamund is buying the March for reasons of her own. He's right, and he doesn't know what they are. He can be an ally to the PCs against Tollamund's plan, if they help him find out what she wants with the lantern, or a rival if they get in the way of his audit.
:::`,
  },
  {
    key: 'npc-iosune',
    type: 'npc',
    name: 'Brother Iosune',
    players: true,
    parent: 'house-unburnt-light',
    image: 'sil:npc-iosune',
    status: 'alive',
    statusKnown: true,
    summary: 'Young Iskavethi acolyte at the House of Unburnt Light, whose hands are scarred because the fire did not spare him.',
    fields: [
      { key: 'Ancestry', value: 'Human (Iskavethi)' },
      { key: 'Role', value: 'Acolyte of the Unburnt Saint' },
      { key: 'Faction', value: 'The Church of the Unburnt Saint' },
      { key: 'Where', value: 'The House of Unburnt Light' },
      { key: '5e', value: 'Acolyte: AC 10, HP 9. Sacred flame, cure wounds.', gm: true },
    ],
    tags: ['npc', 'church-saint', 'iskaveth'],
    relations: [
      { to: 'seraphine-ashe', kind: 'serves', known: true },
      { to: 'ilyra', kind: 'fears', note: 'Since he saw her look out of Seraphine\'s eyes.' },
    ],
    body: `Nineteen, slight, olive-skinned, with soft dark eyes and both hands wrapped in linen to the wrist. Iosune walked the coals at [[Halcyra]] like every acolyte, and unlike the chosen, he burned. The scars shame him. He serves soup at the [[The House of Unburnt Light|House]], washes the feet of pilgrims and is gentle with everyone, and he looks at [[Sister Seraphine]] the way a moth looks at a lamp.

> "She says the burning was a gift. That I'll understand it later. I'm sure she's right. She's always right."

He wants, desperately, to be worthy. He wants the PCs to come to supper.

:::gm
On a night of the red moon, Iosune saw Seraphine's eyes go fully red and heard a voice that wasn't hers say his name. He has not slept since. He is terrified, and can't tell anyone. If the PCs are kind to him in session 4, he becomes their way in to the House's back rooms, and their warning when the faithful march in session 7.
:::`,
  },
  {
    key: 'npc-merane-tarn',
    type: 'npc',
    name: 'Merane Tarn',
    players: true,
    parent: 'temple-row',
    image: 'sil:npc-merane-tarn',
    status: 'alive',
    statusKnown: true,
    summary: 'Young elven apprentice to the Remembrancer Aelith Sorn, eager, anxious, and starting to be afraid of her teacher.',
    fields: [
      { key: 'Ancestry', value: 'Elf' },
      { key: 'Role', value: 'Remembrancer\'s apprentice' },
      { key: 'Faction', value: 'The Remembrancers' },
      { key: 'Where', value: 'Lodging on Temple Row' },
      { key: '5e', value: 'Acolyte with prestidigitation and comprehend languages: AC 11, HP 9.', gm: true },
    ],
    tags: ['npc', 'remembrancers', 'elf'],
    relations: [
      { to: 'aelith-sorn', kind: 'serves', known: true },
      { to: 'sorrel-vey', kind: 'pities' },
    ],
    body: `Seventy, which is young for an elf: slim, freckled, round-faced, with only three tattoos (all on one wrist, all about exams) and ink on every finger from copying. Merane carries [[Aelith Sorn]]'s satchels, copies her notes, and asks every question that comes into her head, usually twice.

> "Sorry, but does the ash always taste like that? And is that a real Raveler? Can I ask him about his feathers? Sorry. Sorry."

She adores her teacher. She is beginning to notice things about her teacher that she wishes she hadn't.

:::gm
Merane found, in Aelith's papers, a list of the equipment needed to "preserve a skin record intact": a cutting table, salt, a lead-lined case. She has not let herself understand it yet. Treated kindly, she will warn the PCs before Aelith moves on [[Sorrel Vey]] in session 7, and then she will have to decide whether to go home to [[Sael]] at all.
:::`,
  },
  // ───────────────────────────── Minor folk: the ash and the Smokes ─────────────────────────────
  {
    key: 'npc-ambry-coyle',
    type: 'npc',
    name: 'Ambry Coyle',
    players: true,
    parent: 'the-smokes',
    image: 'sil:npc-ambry-coyle',
    status: 'alive',
    statusKnown: true,
    summary: 'Gentle giant of a tannery foreman in the Smokes, who has not slept in eleven days.',
    fields: [
      { key: 'Ancestry', value: 'Human' },
      { key: 'Role', value: 'Tannery foreman' },
      { key: 'Faction', value: 'The Sleepless (a Waker)', gm: true },
      { key: 'Where', value: 'The tanneries, the Smokes' },
      { key: '5e', value: 'Cult fanatic, reskinned: AC 12, HP 33, tanning knife. Can\'t be put to sleep or charmed except by the Widow.', gm: true },
    ],
    tags: ['npc', 'smokes'],
    gmTags: ['sleepless'],
    relations: [
      { to: 'dreaming-widow', kind: 'serves', note: 'Her right hand.' },
      { to: 'f-sleepless', kind: 'serves' },
      { to: 'odile-fairweather', kind: 'works for', note: 'The Reeve\'s family owns two of the vats.', known: true },
    ],
    body: `Huge, soft-spoken and kind, with tannery-brown arms, a shaved head and red-rimmed eyes ringed in shadow. Ambry Coyle runs the biggest tannery in [[The Smokes]], and the men and women under him say he's the fairest foreman in town. He has the lapels of his coat stuck full of pins, which he presses into his palm, gently, when his eyes start to close.

> "Long day, friend? Long life. Come and sit. There's tea. Nobody'll make you do anything."

His wife and daughter died of the glass-lung in 3008. He has been very tired ever since.

:::gm
Ambry is a **Waker** of [[The Sleepless]], and [[The Dreaming Widow]]'s right hand. He keeps the night watch over the cellars, carries her messages, and does the lifting. He believes, completely, that when the Sleeper wakes he'll see his daughter again. In sessions 4 to 5 he is sent to "invite" Tick to the cellars. He does it politely. The second time, he brings help.
:::`,
  },
  {
    key: 'npc-sabe-hollins',
    type: 'npc',
    name: 'Sabe Hollins',
    aliases: ['Still'],
    players: true,
    parent: 'the-smokes',
    image: 'sil:npc-sabe-hollins',
    status: 'alive',
    statusKnown: true,
    summary: 'Seven-year-old Hollowborn girl in the Smokes, called Still, who draws the red-moon dream in chalk on the walls.',
    fields: [
      { key: 'Ancestry', value: 'Human (Hollowborn)' },
      { key: 'Role', value: 'Child of the Smokes' },
      { key: 'Faction', value: 'None (her parents are Sleepless)' },
      { key: 'Where', value: 'The Smokes, on any wall she can reach' },
    ],
    tags: ['npc', 'smokes', 'hollowborn', 'child'],
    relations: [
      { to: 'dreaming-widow', kind: 'follows', note: 'The Widow brushes her hair.' },
      { to: 'tick', kind: 'adores', note: 'He made her a firework once.', known: true },
    ],
    body: `Small, silent and solemn, with one brown eye and one milky Hollowborn grey, a chalk-dusted pinafore and bare grey feet. The other children of [[The Smokes]] named her **Still**, because she can sit without moving for an hour, watching nothing in a corner. She hardly speaks. She draws instead: on walls, doorsteps, cellar floors. Always the same picture, a little more each red moon.

A vast shape under water. An eye the size of a lake, opening. Lately, a light above it, very small, in a cage.

> (She hands a PC a scrap of slate with the picture on it, then points at the lantern on the hill, then at the picture. That's all.)

:::gm
Sabe is a walking [[Sleeper Dreams]] table: each full Ember, her drawing gains a detail. After session 3: the crack. After session 5: a person with moth's wings standing in the light. After session 7: the cage, open, and nobody inside it. Her parents are Sleepless; the Widow is fond of her. If the Sleepless march, Sabe walks at the front, asleep.
:::`,
  },
  {
    key: 'npc-mardle-ock',
    type: 'npc',
    name: 'Mardle Ock',
    aliases: ['Mardle Ock Two-Winters'],
    players: true,
    parent: 'fort-mercy',
    image: 'sil:npc-mardle-ock',
    status: 'alive',
    statusKnown: true,
    summary: 'Returned dwarf digger of the Glassers, who hums in the dark and swears he met Borrin under the mountain.',
    fields: [
      { key: 'Ancestry', value: 'Dwarf (Returned)' },
      { key: 'Role', value: 'Cutter (glass-digger)' },
      { key: 'Faction', value: 'The Glassers' },
      { key: 'Where', value: 'Fort Mercy, the deep cut' },
      { key: '5e', value: 'Thug with a glass-pick: AC 13, HP 32, darkvision 120 ft, never surprised underground.', gm: true },
    ],
    tags: ['npc', 'glassers', 'dwarf', 'returned'],
    relations: [
      { to: 'vexa-glassjaw', kind: 'digs for', known: true },
      { to: 'borrin', kind: 'claims to know', note: 'From the deep. Two winters back.' },
    ],
    body: `A wiry, beardless, bald Returned dwarf with skin gone the colour of candle wax and eyes that don't like daylight. No shadow, of course. He came up from under the Grimmark two winters ago (hence the second name) and went straight into the deepest, darkest digging work he could find, which in the March means [[Fort Mercy]]'s deep cut. He hums while he works, a slow, tuneless, three-note hum, and stops if anyone asks what it is.

> "I'm not frightened of the dark, friend. I'm frightened of what the light shows."

He is the best cutter Vexa has, and he goes deeper than anyone else will.

:::gm
When he meets [[Borrin Halt]], Mardle goes pale and greets him by name: "You made it up, then. You were ahead of me, down there, two winters back. You said you'd wait." Borrin has no memory of it. What Mardle met in the deep was Borrin's shadow, walking on ahead, wearing Borrin's face. The three-note hum is what it was humming.
:::`,
  },
  {
    key: 'npc-tam-sixfingers',
    type: 'npc',
    name: 'Tam Sixfingers',
    players: true,
    parent: 'gutter-market',
    image: 'sil:npc-tam-sixfingers',
    status: 'alive',
    statusKnown: true,
    summary: 'Market Reeve of Gutter Market for the Glassers: a cudgel, a memory for faces, and six fingers since birth.',
    fields: [
      { key: 'Ancestry', value: 'Human' },
      { key: 'Role', value: 'Market Reeve of Gutter Market' },
      { key: 'Faction', value: 'The Glassers' },
      { key: 'Where', value: 'Gutter Market' },
      { key: '5e', value: 'Bandit captain with a cudgel: AC 15, HP 65. Never forgets a face (Insight +5 to spot a liar she has met before).', gm: true },
    ],
    tags: ['npc', 'glassers', 'gutter-market'],
    relations: [
      { to: 'vexa-glassjaw', kind: 'answers to', known: true },
      { to: 'npc-jaspin-sweet', kind: 'tolerates', note: 'Barely.', known: true },
    ],
    body: `A rangy, weather-burned woman of forty with a brass-bound cudgel, a laugh like gravel in a bucket and six fingers on her left hand. Tam keeps the peace at [[Gutter Market]] for [[The Glassers]], which makes her the only law on the Low Quay. Picks are left at the bridge; anyone who starts a fight is thrown in the Cinder; anyone who cheats a Glasser is never seen at market again.

> "Six. Since I was born. Not ward-glass, not a curse, not the Sleeper's mark. My mam counted. Every market day somebody asks."

She knows every face that has ever bought or sold on her stones.

:::gm
Tam has noticed Jaspin Sweet paying out new Concord silver and is annoyed she isn't getting her cut. Ask her the right way and she'll tell the PCs exactly which Glasser crew sold it to him, and that they came in from Fort Mercy.
:::`,
  },
]
