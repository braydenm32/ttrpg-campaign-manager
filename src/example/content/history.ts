import type { ExPage } from '../types'

/**
 * The timeline of Vael Ardith: events from Before the Count to the autumn the campaign opens.
 * Ages: myth, wards, crowns, imperial, ashen. Campaign events live in campaign.ts.
 * The Battle of Cinders is 14 Ashfall 3002 AW; the Ember rises and Hathe dies that same night.
 */
export const HISTORY: ExPage[] = [
  // ---------------------------------------------------------------- BEFORE THE COUNT
  {
    key: 'ev-godsdawn',
    type: 'event',
    name: 'The Godsdawn',
    players: true,
    age: 'myth',
    date: 'Before the Count',
    order: 10,
    parent: 'vael-ardith',
    summary: 'How the gods began, told three ways by three peoples who each swear theirs is the oldest.',
    tags: ['myth'],
    body: `Nobody agrees what came first. The gods, when asked, change the subject.

### The Lithic say
There was no dawn. There was a sleep, and in the sleep a god had a thought, and the thought was *light*. The other gods are what he dreamed while he decided who should hold it. [[The Lithic]] children learn this as a lullaby, which is why it never sounds like a boast.

### The Saelish say
The Green came first, before sun or sea, and the gods grew out of it the way fungus grows out of a fallen oak. [[Orvanne]] was simply the first to stand up. The account is carved above a hundred doorways in [[Sael]], though few of the elves who walk under it could tell you why they believe it.

### The Iskavethi say
In the dark there was a fire that did not burn. It wanted nothing, so it gave. Every other flame in the world is a quarrel with that first one. The fire-priests of [[Iskaveth]] hold that [[The Unburnt Saint]] has simply walked back into it.

### Everyone else
Sailors say [[Sefra]] was first, because the water was already there when they arrived. [[Corvex]]'s auditors say the world began as a loan and the interest has been running ever since. [[Grum]]'s soldiers say it began with a punch, and are loudly unconcerned about whose.

:::gm
The Lithic lullaby is nearest the truth: Ysmereth, the Sleeper, was awake before the other gods, and what woke him is something the pantheon will not discuss. Notice that when any god's priest tells the Godsdawn, the Sleeper's name has been quietly sanded off. The gods have been editing their own beginning for a very long time.
:::`,
    gmNotes: `Treat this as a table of contents for the setting's mysteries: every account has one detail the others lack. A Lithic NPC will recite the lullaby if asked kindly, and go very still if a player says the name Ysmereth aloud.`,
  },
  {
    key: 'ev-long-dreaming',
    type: 'event',
    name: 'The Long Dreaming',
    players: true,
    age: 'myth',
    date: 'Before the Count',
    order: 20,
    parent: 'vael-ardith',
    summary: 'The age in which mortals were dreamed into being, according to the Lithic. The elves are rude about it.',
    tags: ['myth'],
    body: `The Long Dreaming is the stretch of time, tens of thousands of years by the loosest guess, between the gods and the first mortal footprint. It has no date, because nobody was awake to count.

**The Lithic account.** [[The Sleeper Below]], then simply a god of dreams and endings, grew lonely and dreamed company. Mortals were what he dreamed when he could not think of anything else to be. This is why every mortal has a thought they cannot finish: it is the shape of the dream's edge.

**The Saelish account.** The elves were not dreamed. They walked out of the forest already complaining, and everyone else was a sort of echo. [[Humans]], in particular, were an accident in the mud. This account is not widely repeated outside [[Sael]].

**The Iskavethi account.** Mortals are the cinders of the first fire, cooled and given legs. That is why they are always trying to get warm. The Unburnt Saint's preachers like this one: it makes every sinner someone's lost ember.

**The Concord account.** Mortals were issued, and have been in arrears since.

**What the dwarves say.** [[Dwarves]] mostly don't, and politely ask you to pass the salt.

:::gm
Every Hollowborn dreams the same dream at full red moon, and it is the Sleeper dreaming. The Lithic version is closest to the truth, and the gods do not like it taught, because a god that dreams mortals is a god mortals might owe nothing to. The Shellbacks hold a fifth account they refuse to tell, which begins with a creature called the Slow One who was already watching.
:::`,
    gmNotes: `Good fuel for a drunk philosophical scene at The Last Candle. Let each NPC tell it as if the others were fools. If a PC is Hollowborn, quote the Lithic line about the dream's edge back at them.`,
  },
  {
    key: 'ev-stone-marriage',
    type: 'event',
    name: 'The Stone Marriage',
    players: true,
    age: 'myth',
    date: 'Before the Count',
    order: 30,
    parent: 'vael-ardith',
    summary: 'When Tharos took mortal lovers and fathered the Nine. A romance, a scandal or a crime, depending on who is telling.',
    tags: ['myth'],
    body: `[[Tharos]], the Stone-Under, god of mountains and endurance, took mortal lovers. Their children were [[The Nine]], demi-gods of stone and fire. That much is agreed. Everything else is argument.

### The dwarves say
It was an honour. Tharos walked up out of the rock and chose from among the first stone-cutters, men and women both, and asked each of them a single question: *can you stay?* Those who said yes were married to the mountain. Dwarven weddings still include the question, and the answer is traditionally a grunt.

### The Saelish say
It was hunger. A god of stone knows nothing of change, and wanted to see what a short life looked like from the inside. His children were curiosities that grew too large for their cabinet.

### The Iskavethi say
It was a fall. The mercy that made fire gentle was not in Tharos, and so the children had none. The church of the Unburnt Saint teaches that the Nine were born without it, and that is why they could do what they did.

### In the pleasure-houses
The temples of [[Isaurana]] shrug. It was love, they say, and love makes terrible decisions. The Velvet Ledger keeps a candle for the mortals, whose names no one wrote down.

:::gm
Lithic tomb-songs, almost forgotten, count the children as ten and call the tenth *the one who stayed soft*. Nobody has ever said what became of this child. It may be an error in the song, or the thing that Warden Uthrem refuses to mention.
:::`,
    gmNotes: `The Stone Marriage is a good place to seed romance and tragedy at once. Nobody alive can say what the mortal lovers felt, and that is the point.`,
  },
  {
    key: 'ev-nines-oath',
    type: 'event',
    name: 'The Oath of the Nine',
    players: true,
    age: 'myth',
    date: 'Before the Count',
    order: 40,
    parent: 'vael-ardith',
    summary: 'The vow that began everything: the Nine swore that mortal-born could unmake a god.',
    tags: ['myth'],
    body: `Before the Godslaying there was a promise. [[The Nine]], proud and young and half divine, swore that mortal-born hands could unmake a god. Where they swore it, and why, depends on the teller.

**The Lithic version** is brief. They swore on bare rock, at night, with their palms cut. The words are not given to outsiders. A Lithic asked about the Oath will say, "We kept it," in a tone that closes the subject.

**The dwarves** say it was sworn on Tharos's own anvil, and that the anvil cracked, and that the crack is still in a cellar in [[Hollowhall]] where it is shown to apprentices as a warning about promises.

**The Saelish** tell of a feast, a toast and too much wine. They like the version where the whole thing was a dare, because it makes the rest of the story smaller.

**The Church of the Unburnt Saint** holds that the Oath was blasphemy, and that the Nine were punished accordingly. Preachers are careful not to ask what the punishment was for, since that would lead to the next question.

The Oath is the only myth that nearly everyone tells in the first person plural. *We swore.* Ask a Lithic what they mean by it and they will say, "Yes."

:::gm
The Nine did not swear out of simple pride. Ysmereth is the god of endings, and the Nine wanted to end the End: to unmake the thing that makes mortals die. They failed, and the stone that took them is a grim, half-successful kind of never dying. The words of the Oath survive in Warden Uthrem's memory: "Nothing born of us shall kneel."
:::`,
    gmNotes: `Do not let this solve itself. The reveal belongs to Session 6, in Uthrem's mouth, not in a rumour.`,
  },

  // ---------------------------------------------------------------- THE AGE OF WARDS
  {
    key: 'ev-godslaying',
    type: 'event',
    name: 'The Godslaying',
    players: true,
    age: 'wards',
    date: '0 AW',
    order: 10,
    parent: 'vael-ardith',
    summary: 'The Nine killed a god, failed to make it stay dead, and became the stone that holds the grave shut. Year zero.',
    tags: ['myth', 'wards'],
    body: `Every year in the world is counted from this one. The [[The Reckoning of Years|Reckoning of Years]] calls it the Warding, and the dating is the only part nobody argues about.

**What everyone knows.** The Nine, demi-gods of stone and fire, killed a god. They learned too late that a god cannot be killed all the way. To keep the body under the land, they poured every ounce of their own divinity into nine Great Wards and became mortal stone. [[Tharos]] cursed their line and the gods struck their names from memory. Their descendants are [[The Lithic]], who are still turning slowly to the thing their ancestors became.

**What the god was** is where the stories divide. The Lithic say only "the Sleeper". The elves have a name for him on their skins, and cannot read it. The Iskavethi say the dead god was a tyrant. The Concord's historians say it was an unpaid account.

**What it left.** [[The Nine Great Wards]] pin the continent shut. The buried god is called [[The Sleeper Below]]: somewhere between death, coma and undeath. Magic works because the god is not entirely gone, and every spell draws on a ward and costs someone, somewhere.

### How it's told now
Mothers in the Grimmark tell it as a warning about pride. Soldiers tell it as the worst contract in history. In Iskaveth they tell it as a failure of mercy. Nobody tells it as a victory, even though that's what it was.

:::gm
The god was Ysmereth. Each Great Ward is anchored by one of the Nine, still awake inside the stone. The wards are failing, slowly: every spell drains the nearest one, and Lithic who stand at them are fewer each generation. The gods want the crack opened, because a mortal ward is the only thing they cannot cross.
:::`,
    gmNotes: `The Godslaying is the root of everything. Use it as the campaign's hidden argument: every faction is, in some way, still fighting about it.`,
  },
  {
    key: 'ev-first-standing',
    type: 'event',
    name: 'The First Standing',
    players: true,
    age: 'wards',
    date: 'About 31 AW',
    order: 20,
    parent: 'ninth-stone',
    summary: 'The first Lithic to walk to a ward and stand there until she turned to stone, starting a tradition that is now running out.',
    tags: ['lithic'],
    body: `A generation after the Godslaying, the first of the Nine's grandchildren to feel her skin hardening did something nobody had asked her to do. She walked to the [[The Ninth Stone|Ninth Stone]] and stood.

Her name is given as Ketterin. She was a mason, and by every account a cheerful one. She is said to have taken a loaf and a flask of beer, sat on the lip of what is now [[The Rent]], and spent her last season of flesh telling the wind about her day. Then she stood, and did not sit again.

**What she left behind.** The ward grew stronger that year. Scholars of the day recorded it as the first measurable improvement since the Warding. Every Lithic after her who felt the stone coming took the same road. They called it *standing*, and it became the central rite of the Lithic: a good death, a duty and an act of love in one.

**How it is told now.** The Lithic say Ketterin is still there, and that Warden Uthrem will point to her if asked. The dwarves leave bread at the foot of the Ninth Stone on her name-day, and wonder whether the Ashenreach's pilgrims know what they are stepping over. In [[Cinderford]], soldiers say "Ketterin's luck" for any small kindness that costs the giver everything.

:::gm
Ketterin's figure was shattered when the ward cracked at Cinders. Fragments of her still turn up in the ash. A Glasser who has found her stone hand will pay good money to anyone who can tell them what it was holding: a tiny weeping orchard seed, carved with the first word of the Oath.
:::`,
    gmNotes: `A quiet, human anchor for the Lithic. Use it when the party first meets Uthrem: standing is not a tragedy to him, it is a vocation, and he is waiting to be relieved.`,
  },
  {
    key: 'ev-ul-tarran-rises',
    type: 'event',
    name: 'The Raising of Ul-Tarran',
    players: true,
    age: 'wards',
    date: 'About 150 AW',
    order: 30,
    parent: 'vael-ardith',
    summary: 'The Lithic found a kingdom around the wards, with roads, laws and a king who is mostly a very good listener.',
    tags: ['lithic'],
    body: `By 150 AW there were enough Lithic, and enough ordinary folk who had come to live in their shadow, that someone had to tell them where to put things. [[Ul-Tarran]] was the answer: a kingdom of masons, wardkeepers and tithe-collectors, ruled from nine halls and one throne.

**The first king** was Teshar the Long-Handed, said to have been left-handed with both hands. He took the title *Warden-King* rather than king, and refused a crown on the grounds that his head would eventually be stone and a crown would only chip. He built the **Nine Roads**, one running to each ward, so that the Lithic who felt the stone coming could be carried to their place and stood with honour. The Roads were laid wide enough for two biers and a priest.

**What it was like.** Ul-Tarran had law, schools, a postal system and a bureaucracy that would make the Regency weep with envy. It also had a population that shrank, steadily and politely, every generation.

**What it left.** A few of the Nine Roads still run across the [[The Ashenreach|Ashenreach]], glassed in places by the war. The dwarves of [[The Grimmark Holds]] borrowed Ul-Tarran's building codes, and still follow them.

**How people tell it now.** Soldiers call the old road through the ash the Straight Road, and march on it because it's the only one that doesn't vanish in a greywind. They do not know it was laid to carry the dying.

:::gm
The census rolls of Ul-Tarran, which a Remembrancer would give an arm for, show births falling by a fixed fraction each generation. The Roads were not only for funerals. They were a plan for the day when there would be too few Lithic to stand at every ward.
:::`,
    gmNotes: `A reason to keep the Straight Road in play: it can lead the party to a ward-site, a Lithic waystation or a buried census.`,
  },
  {
    key: 'ev-hollowhall',
    type: 'event',
    name: 'The Carving of Hollowhall',
    players: true,
    age: 'wards',
    date: '412 AW',
    order: 40,
    parent: 'hollowhall',
    summary: 'Four hundred and twelve dwarves began carving the great gate into the Grimmark, and did not stop for a hundred years.',
    tags: ['dwarves'],
    body: `The dwarves came out of the northern hills in the year 412, four hundred and twelve of them, and began to cut into the mountain. They had no plan to build a city. They had a plan to build a door.

**Why.** [[Dwarves]] revere the Lithic as ancestors made holy, and the Grimmark is where [[Tharos]] is nearest. The carvers meant to make a hall worthy of a god's attention. They had no way of knowing they were also excavating a hall worthy of something else's.

**What was made.** The great gate of [[Hollowhall]], forty fathoms high, cut in a single face. A hall behind it that could seat a thousand. A Stair of Ten Thousand Steps, which is a modest exaggeration. The first chiselled line is set into the threshold with the name of every dwarf who began it.

**What it left.** A people with a home and a pride. A bloodline of masons who still sign their work with a thumb-print. A habit of keeping the door shut.

**How it is told now.** Surface dwarves say the first carvers were guided by Tharos himself, and that their chisels rang in tune with his heart. The [[Dwarves|Returned]] say nothing at all and look at their feet, where their shadows should be.

:::gm
The lowest stair of Hollowhall stops at a sealed door the first carvers never opened. Their records call it *the Stair That Waits*. It leads down to the Eighth Ward, which the dwarves' war-time retreat would later find. The door was never locked. It was only never asked.
:::`,
    gmNotes: `A fine place to plant a creeping dread in any scene that touches the dwarves: they know the Stair That Waits, and the Returned flinch when it is mentioned.`,
  },
  {
    key: 'ev-elves-come',
    type: 'event',
    name: 'The Coming of the Elves',
    players: true,
    age: 'wards',
    date: '690 AW',
    order: 50,
    parent: 'sael',
    summary: 'Elves arrived on the west coast and made the Saelwood their home. Their own account has been forgotten.',
    tags: ['elves'],
    body: `The elves of [[Sael]] came to the west coast in 690 AW, and settled in a forest that had no people in it. That is the only claim every account supports.

**The Saelish account** was once tattooed into the skin of the oldest elves, who read it aloud to each new generation. Over the centuries those tattoos have blurred, and the elves who wear them can no longer read them. What is said now is a patched story: that the elves walked out of the forest, that they always lived there, that anyone saying otherwise is mistaken.

**The Lithic records** note the arrival with mild surprise. A ship burned off the coast, and strangers waded ashore. [[Ul-Tarran]] sent bread.

**The Concord's historians** say the elves arrived with a Shellback pilot, and have a ledger entry for the fare. The entry has been disputed ever since.

**The Iskavethi** say the elves came to atone for something, and are careful not to say what.

**What it left.** A people who forget their own history on a schedule and have built a culture of ink, ritual and careful politeness to compensate. Every century, a little more of them vanishes.

:::gm
The oldest ink on the oldest elves begins with four words, in a script nobody now can read: *We came because called.* Something at the Fourth Ward in the Saelwood was calling. The [[The Saelish Trespass|Trespass]] came four centuries later, and was not the first time the elves answered.
:::`,
    gmNotes: `Aelith Sorn will pay for a copy of that ink. Sorrel Vey carries it on her back and does not know that is what she is carrying.`,
  },
  {
    key: 'ev-ul-tarran-falls',
    type: 'event',
    name: 'The Silence of Ul-Tarran',
    players: true,
    age: 'wards',
    date: '940 AW',
    order: 60,
    parent: 'vael-ardith',
    summary: 'The Lithic kingdom stopped answering its mail. The last king was found on his throne, as stone.',
    tags: ['lithic'],
    body: `In 940 AW the tax-collectors of [[Ul-Tarran]] stopped returning to their offices. Within a season the roads were empty. Within a year the king's seal stopped appearing on documents, and a delegation from the Ardis valley went north to find out why.

**What they found.** A great hall, every lamp lit, every table laid, and the last Warden-King seated on his throne. He had turned to stone. So had the two hundred or so courtiers still in the building. Not a single door had been forced.

**The tellings.** The humans of the Ardis valley say the Lithic simply gave up, and wrote it off as a lesson in pride. The Lithic say the court *stood*, all at once, to hold something that was slipping. The dwarves say it was an honour, and send a delegation to the hall each year with salt and bread. The Saelish say nothing, since the Silence began around the time their own memory first thinned.

**What it left.** The end of the last Lithic realm. A power vacuum along the Ardis, filled over the next centuries by human kings. A great many stories about the Hall of Standing Kings, which maps disagree on and which no honest cartographer claims to have found.

**How it is told now.** As a ghost story, mostly, and as a joke about the Regency: *at least they stand up for their taxes*.

:::gm
The Court stood because three wards flickered in the same week. The king's statue still sits with one hand open, as if waiting for a coin. The coin is a ward-shard, and the Hall is somewhere a party in Session 6 or later could stumble onto.
:::`,
    gmNotes: `Do not make the Hall a dungeon in the first campaign unless the party really want one. It works better as a rumour that grows each time it is retold.`,
  },

  // ---------------------------------------------------------------- THE AGE OF CROWNS
  {
    key: 'ev-trespass',
    type: 'event',
    name: 'The Saelish Trespass',
    age: 'crowns',
    date: '1102 AW',
    order: 10,
    parent: 'sael',
    summary: 'GM only. Sael tried to open the Fourth Ward, failed, and chose to forget it ever happened.',
    tags: ['secret', 'elves'],
    body: `This is the thing the elves of [[Sael]] do not know that they know.

By 1102 AW the elves had already begun to lose their memory: a century at a time, the oldest of them dimmed and the ink on their skin blurred. A circle of loremasters, the first [[The Remembrancers|Remembrancers]], came to believe that the cause was the buried god, and that the buried god could be reasoned with. They went to the Fourth Ward at the heart of the Saelwood to open it a hand's breadth and speak to the [[The Sleeper Below|Sleeper]].

**What happened.** The ward opened. Something answered. Nobody now agrees what, because the elves who were there did their best to make sure nobody would. The ward was forced shut. Eleven of the circle died in the doing. The survivors decided that the only mercy was forgetting, and arranged it.

**The cost.** Memory was burned out of Sael on purpose: records, songs, and the skin of every elf who had borne a tattoo of the rite. They cut away the ink and burned it in the clearing where the ward lay. The Fourth Ward has been weak ever since, and the elves' forgetting has been worse, as if the god had heard them and was holding onto what they gave it.

**What survives.** A few elves still wear ink they do not understand, among them [[Sorrel Vey]], whose back records the full rite in a script she was taught as a girl to call *decorative*.

:::gm
The Trespass is the most dangerous knowledge in the setting for Sael, and a prize for the Remembrancers' present-day heirs, who will pay any price to recover it. Aelith Sorn suspects. Sorrel Vey does not. If her tattoos are read, the Trespass is read, and the Fourth Ward's weakness becomes a target for every faction with a use for a god-sized door.
:::`,
    gmNotes: `Never delivered as a lecture. It should reach the players in pieces: a tattooed back in the Velvet Ledger, an elf who loses a name mid-sentence, a clearing in the Saelwood with no trees in it. The PCs can learn that Sael did something. They should have to work to learn that it was this.`,
  },
  {
    key: 'ev-toll-war',
    type: 'event',
    name: 'The Toll War',
    players: true,
    age: 'crowns',
    date: '1224 to 1255 AW',
    order: 20,
    parent: 'fallowden',
    summary: 'Thirty-one years of war between the Ardis kingdoms, begun over whether a barge counts as a bridge.',
    tags: ['war', 'halflings'],
    body: `The Toll War began in 1224 AW with a question put by a toll-keeper of Fallowden: is a moored barge a bridge?

The kingdoms of the Ardis charged by the crossing. A barge tied at both banks, said the Reed-King, was a bridge, and should pay. The barge captain said it was a barge. The toll-keeper wrote it down, and the Reed-King's cousin, who held the river upstream, wrote down a different answer. Within the decade four kingdoms were at war over the matter, and the matter had stopped being the matter.

**What it cost.** Thirty-one years of burning boats, drowned toll-houses and raided granaries. Ardmere changed hands nine times. The kingdoms lost a third of their men, and a good part of their dignity.

**How it ended.** By the Charter of the Open River. The kingdoms, exhausted, agreed that the river belonged to nobody and that boats on it were neutral by law. The charter was drafted by a halfling barge-captain who was the only person all four kings trusted, because none of them thought she could possibly want a throne.

**What it left.** The neutrality of [[The Barge Clans]], which to this day is a fact of law, and in the right circumstances a weapon. The rule that no army may stop a barge without a signed writ. And a persistent joke along the Ardis: *"it's not a bridge, it's a barge."* It means, roughly, *I know exactly what I'm doing and you can't prove otherwise.*

**How it is told now.** As a comedy, which it was, until it wasn't.

:::gm
The captain who drafted the Charter wrote in a private clause that no court has ever tested: a barge may carry any letter, from any hand, to any hand, without being searched. The clans have been the continent's post office and its spies ever since.
:::`,
    gmNotes: `Use it for flavour whenever the Barge Clans refuse to answer a question. "It's a barge" is the standard halfling reply to being asked what is in the hold.`,
  },
  {
    key: 'ev-shellbacks-leave',
    type: 'event',
    name: 'The Shellbacks Leave the Ness',
    players: true,
    age: 'crowns',
    date: '1350 AW',
    order: 30,
    parent: 'ness',
    summary: 'The slow tortoise-folk abandoned the Ness of Thurm in a single season and opened counting-houses on the southern bays.',
    tags: ['shellbacks'],
    body: `For as far back as anyone's charts go, the long horn of the Ness of Thurm was Shellback country. In 1350 AW, in a single season, they left.

**What is known.** A fleet of broad, slow ships sailed from the Ness to the southern bays. They carried stone, ledgers, and a great many tortoise-folk who, by every account, were in no hurry. They bought land on the water at every harbour, and opened the first counting-houses in what would become the [[The Sevenhaven Concord|Concord]].

**What the Shellbacks say.** "The Ness grew tired." They say it politely, and with precisely enough conviction to discourage a second question.

**What the elves say.** That they barred the Ness after the Shellbacks left, for the good of everyone. The bar is still there. It is enforced with long ships, black flags and an unaccustomed lack of manners.

**What the maps say.** The old charts show Shellback ruins up to the Ness's tip, then a blank, and then the words *here the charts fail*. Every chart-maker who has tried to correct this has either failed or gone quiet.

**How it is told now.** As a banking joke (*they left because the interest was too high*) and as a children's tale about a land that is waiting for its people to come home. [[Grandmother Tollamund]] is of an age to have heard it from her grandmother's grandmother, and does not tell it.

:::gm
The Shellbacks left because something under the Ness woke, or because they shut something in, or both. The door home needs a key, and Tollamund believes the lantern at Cinderford is that key. The reason behind it is the Slow One: the Shellbacks' god, never named aloud.
:::`,
    gmNotes: `Tollamund will answer any question about the Ness with a question about the interest. Her silence is a clue. The Elves' guard-ships do not stop Shellbacks, but they do stop everyone else, which is itself odd.`,
  },
  {
    key: 'ev-first-concord',
    type: 'event',
    name: 'The First Concord',
    players: true,
    age: 'crowns',
    date: '1611 AW',
    order: 40,
    parent: 'sevenhaven',
    summary: 'Seven bay-cities signed a pact of mutual trade, common law and shared debts, at a table with seven legs.',
    tags: ['concord'],
    body: `By 1611 AW the seven free ports of the southern bays were rich enough to be dangerous to each other. The Concord was their answer: a promise to settle quarrels in the counting-house instead of on the water.

**The signing.** It took place in [[Sevenhaven]], at a table built for the occasion with seven legs, one for each city. No city would sign first, none would sign last, and none would let another sit at the head. So seven clerks signed seven copies at the same moment, to the count of a Shellback bell-ringer who was paid by the hour and took all of them.

**What it said.** Common law for debt. A shared fleet. A single weight for every measure of grain. And a clause that every oath sworn under the Concord is an account with [[Corvex]], and that breaking one is theft. The priests of Corvex have audited the Concord's promises ever since.

**What it left.** The seven ports: [[Marrowport]], [[Cowl]], Sevenhaven, [[Gilt]], [[Harrowquay]], [[Keel]] and [[Vessary]]. Each keeps its own face of [[Sefra]], and a stubborn independence the Concord has never entirely tamed.

**How it is told now.** As a romance of commerce, a tale of seven strangers learning to love the figures. In Cowl they tell it differently, and the version involves a drunk clerk and a bribe.

:::gm
A ninth article of the Concord, signed by all seven and read by none, passes the debts of the dead to the land they died on. Tollamund & Daughters have found a use for it in the Ashenreach, where there are a great many dead and a great deal of land.
:::`,
    gmNotes: `A lawyer PC can find Article Nine in a day or two of reading, if they ask the right clerk. The clerk will become very busy.`,
  },

  // ---------------------------------------------------------------- THE IMPERIAL AGE
  {
    key: 'ev-caedric',
    type: 'event',
    name: 'The Crowning of Caedric',
    players: true,
    age: 'imperial',
    date: '15 Highsun 1740 AW',
    when: { year: 1740, month: 6, day: 15 },
    order: 10,
    parent: 'caer-ardith',
    summary: 'Caedric of Ardis took a plain iron circlet at Caer Ardith and became the first Emperor of Vael Ardith.',
    tags: ['empire', 'crown'],
    body: `On the night of full Pallas, 15 Highsun 1740 AW, a minor king of the Ardis valley put an iron circlet on his own head in front of the whole assembled court of [[Caer Ardith]], and was not struck by lightning. That was the empire.

**Who he was.** Caedric of Ardis, lord of a river and not much else, who had spent a lifetime patiently outliving his rivals. He was, said a chronicler, "tall in the way of a man who has never been refused".

**What it meant.** For eight centuries the human kingdoms of the Ardis had squabbled, bargained and fought. Caedric ended it by outlasting everyone else and then having the good sense to look surprised. He took the title Emperor in the name of [[Aurelan]], whose church promptly adopted him.

**What it left.** The empire: roads, coinage, a legal code, and a bureaucracy of a size and pettiness that has outlived the throne itself. The iron circlet, which hangs in the Hall of Seals under glass. A line of Emperors, from Caedric the First to Aurel the Ninth.

**How it is told now.** The Regency tells it as destiny. The Iskavethi tell it as theft. Soldiers tell it as the story of a man who learned that sitting still, with enough patience, beats most swords.

:::gm
The imperial bloodline was bred, quietly and over generations, for ward-sensitivity, and Caedric was the first. He said his decisions came to him as a voice from underfoot. Every Emperor after him said the same, privately, and none of them admitted what it was. No living heir can sit the throne without hearing the Sleeper.
:::`,
    gmNotes: `Quote Caedric's famous line if a PC mentions patience: "Let them be certain of the day. I am certain of the year."`,
  },
  {
    key: 'ev-iron-guard',
    type: 'event',
    name: 'The Breeding of the Iron Guard',
    players: true,
    age: 'imperial',
    date: '8 Seedwake 2104 AW',
    when: { year: 2104, month: 3, day: 8 },
    order: 20,
    parent: 'caer-ardith',
    summary: 'Imperial magi bred the orc soldier caste that would guard the throne for eight hundred years, then kill the last Emperor.',
    tags: ['empire', 'orcs'],
    body: `In 2104 AW the Emperor Voss II signed a decree that ran to four lines and changed the shape of a people. The Office of Martial Husbandry was to take the best of the hill-clan orcs, and make them better.

**What was done.** Imperial magi, working over a century and a half, bred a soldier caste: bigger, steadier, loyal to a fault. The warriors were housed in barracks, fed from the Emperor's stores, and taught that the throne was their kin. The breeding rosters were kept by orc women, because the magi's clerks could not read the orcs' own tally-sticks, and so left them to it.

**What it left.** The Iron Guard, as proud and as terrible as any soldiers in history. And an unexpected consequence: the [[The Mothers of the Iron|Mothers]], who held the rosters, found themselves holding the whole caste. By the second generation they were the real authority, and the Emperor was an ornament they protected.

**How it is told now.** Humans tell it as a cautionary tale about hubris, usually with an apology for the people it was done to. [[Orcs]] tell it as the day their grandmothers took the empire's pen and kept it. In the pleasure-houses of Caer Ardith, it is sometimes told as a love story, which is its own kind of horror.

:::gm
The magi bred the Guard to be deaf to the dreaming, so that they might stand beside an Emperor who heard it and not be swayed. The Mothers learned this early. It is why they, and no one else, could be trusted to stand between a ruler and the voice under the throne.
:::`,
    gmNotes: `Varra and Sergeant Vosk both live inside this event. Let them have views: she with shame, he with a soldier's pride and a smirk.`,
  },
  {
    key: 'ev-mothers-compact',
    type: 'event',
    name: "The Mothers' Compact",
    players: true,
    age: 'imperial',
    date: '19 Emberwane 2231 AW',
    when: { year: 2231, month: 7, day: 19 },
    order: 30,
    parent: 'caer-ardith',
    summary: 'The Mothers of the Iron won the right to license free companies when the Guard was not needed, and invented the modern mercenary.',
    tags: ['empire', 'orcs', 'mercenaries'],
    body: `In 2231 AW the Mothers of the Iron presented the Emperor Teodric III with a document of two pages. It was courteous, brief and, as every clerk who read it noted afterwards, entirely binding.

**What it said.** The Guard, when not under direct imperial orders, could take contracts. The Mothers would hold the licences, set the prices and exile any warrior who broke a contract. Any company so licensed would carry a Mother's seal, and any employer who defaulted would find the seal withdrawn.

**Why the Emperor agreed.** He was told it would earn the empire coin from soldiers it was paying to sit idle. He was not told that the seal would become the most trusted promise in the world.

**What it left.** The free companies. The Mothers' licence system, still the basis of every mercenary contract on the continent. A culture of oath-keeping among orc soldiers that other peoples have mocked, envied and failed to imitate. And a hunger in the Regency, three centuries later, to find a way to break it.

**How it is told now.** In barracks, as a point of pride: *the Emperor signed it and thought he'd won.* Among clerks it is held up as an example of why one should always read the second page.

:::gm
The Compact's last clause allows the Mothers to void *every* licence if the Guard is turned against the wards. Grashka remembered that clause when the Emperor began to dig.
:::`,
    gmNotes: `Whenever a PC asks why a Mothers' contract cannot be bought out, point at this. The licence is the entire reason the Ninth Lantern exists.`,
  },
  {
    key: 'ev-iskaveth-conquered',
    type: 'event',
    name: 'The Conquest of Iskaveth',
    players: true,
    age: 'imperial',
    date: '22 Ashfall 2390 AW',
    when: { year: 2390, month: 9, day: 22 },
    order: 40,
    parent: 'iskaveth',
    summary: 'The empire took the eastern plateau in eleven days and then spent six centuries failing to keep it quiet.',
    tags: ['empire', 'war'],
    body: `The Iron Guard came over the Saint's Spine in the autumn of 2390 AW and took [[Halcyra]] in eleven days. It was the swiftest campaign in the empire's history. It was also the easiest part.

**The occupation.** The empire declared the plateau a province and installed an administrator, a tax office and a regiment. The Iskavethi paid the taxes, fed the regiment and refused, in every other respect, to be conquered. Shrines were swept, closed and reopened at night. Imperial magistrates found their carriages stoned with pebbles from the temple steps. In six hundred years of occupation, nobody ever found the stone-thrower.

**The Office of Pacification** sent a report to the capital every season for sixty years, each one stating that the province was calm. The reports were signed. The reports were filed. The reports were, so far as anyone has ever proved, entirely made up.

**What it left.** A resentful, devout, unconquerable people who regard the empire as a passing guest and the throne as an error. A taste for fire as a form of resistance. And a pilgrimage route that crosses the empire's old road and uses it without thanks.

**How it is told now.** Iskaveth: as a siege of the heart. The Regency: as a lesson in logistics. [[Qerath]], on the Glass Sea, as a joke about soldiers who came to conquer and stayed for the fish.

:::gm
The Unburnt Saint's rites predate the conquest by centuries, and began as an old practice of walking through coals to show faith. The empire tried to ban it. That ban is the reason the practice survived to become the faith of Ilyra.
:::`,
    gmNotes: `Seraphine Ashe will never mention the conquest unless she is asked directly. When she is, let her answer be gracious, brief and a little too prepared.`,
  },
  {
    key: 'ev-first-loan',
    type: 'event',
    name: 'The First Imperial Loan',
    players: true,
    age: 'imperial',
    date: '3 Thawmere 2650 AW',
    when: { year: 2650, month: 2, day: 3 },
    order: 50,
    parent: 'sevenhaven',
    summary: 'The empire borrowed from the Shellback counting-houses to fix a road, and never stopped borrowing.',
    tags: ['empire', 'concord', 'debt'],
    body: `In the winter of 2650 AW, the Imperial Treasury found itself eleven thousand crowns short of the cost of repairing the Great Road. It sent a clerk to [[Sevenhaven]] with a letter, and the letter was answered.

**The loan.** Eleven thousand crowns from a counting-house run by [[Shellbacks]], at a modest rate, over a long and agreeable term. The empire put up as collateral the western marches along the Cinder, a thin strip of farmland of no great value. The Treasury was delighted. The Shellbacks were not surprised.

**What followed.** Within a generation the empire borrowed again, to pay the first loan. Then again, to pay for a campaign. Then for a harvest, a flood, a marriage, a funeral and a statue of the previous Emperor. By 2979 the empire owed the Concord more than it earned in a year.

**What it left.** The Concord's wealth, the empire's weakness, and a habit of mind in Caer Ardith that treats debt as a kind of weather. A debt-ledger so large that the Shellbacks keep it in its own building, under guard, with a copy in case the first one dies of embarrassment.

**How it is told now.** In the Regency: as a shameful secret. In the Concord: as a prudent investment. By the Shellbacks themselves, not at all. They say only that a loan is a long conversation, and that they are still in the middle of it.

:::gm
The western marches along the Cinder, put up as collateral in 2650, include the ground where Cinderford stands. When the Concord buys the Ashenreach's debts, it is also collecting on this one.
:::`,
    gmNotes: `Fennick Bottlebrook can quote the original loan terms from memory. He found them one night when he was trying to work out who owned the ford.`,
  },
  {
    key: 'ev-digs',
    type: 'event',
    name: "The Emperor's Digs",
    age: 'imperial',
    date: '10 Bloomtide 2979 AW',
    when: { year: 2979, month: 4, day: 10 },
    order: 60,
    parent: 'march-of-cinders',
    summary: 'GM only. Aurel IX secretly began digging at three ward sites, two years before he was killed for it.',
    tags: ['secret', 'empire', 'wards'],
    body: `Two years before the Kingslaying, the Emperor Aurel IX began, in secret, to dig.

**The plan.** Aurel heard the voice that every Emperor heard, and unlike his fathers he believed it. He came to think that one of the Nine Great Wards could be opened, that the god beneath could be used, and that an Emperor who held its power would be an Emperor in fact. He put the Master of Works, a precise and joyless man named Ilbert Crane, in charge of three digs.

**The sites.** In the hills above [[Hollowhall]], where the dwarves' oldest stair gave on a sealed door. In the western marches along the Cinder, in the grain fields beside a leaning stone. And at a third place the Emperor's own papers refer to only as *the Wet Hill*.

**The paperwork.** All three digs were recorded as *Drainage Works (Western)*, a line item the Treasury had been carrying for years. The clerks who processed the budget thought it was dull. In the whole of the Quiet Office's files, it appears under forty-one different codes.

**What it left.** Crane's notes, partly burned. A crew of labourers who were paid well and never spoke of it. A crack in an old stone, which [[The Mothers of the Iron|the Mothers]] heard about from a cook. And, two years later, an Emperor dead on the floor of the Gilded Gallery.

:::gm
The cracked stone in the western marches is the Ninth Stone, then standing in the grain fields east of Cinderford, where the Rent runs now. Digging at its base weakened it before the Battle of Cinders did. Crane's surviving notes are at Fort Mercy, in a records vault, until its burning.
:::`,
    gmNotes: `The thread that ties the Kingslaying, the Concord, the Quiet Office and the Ninth Stone together. Reveal it late. Spoons, of all people, has a ledger page with the code in it.`,
  },

  // ---------------------------------------------------------------- THE ASHEN AGE
  {
    key: 'ev-kingslaying',
    type: 'event',
    name: 'The Kingslaying',
    players: true,
    age: 'ashen',
    date: '14 Frostcall 2981 AW',
    when: { year: 2981, month: 11, day: 14 },
    order: 10,
    parent: 'caer-ardith',
    summary: 'The orc Iron Guard killed Emperor Aurel IX in the Gilded Gallery. Nobody has been able to say why.',
    tags: ['empire', 'orcs', 'crown'],
    body: `On the afternoon of 14 Frostcall 2981 AW, in the middle of an audience for petitions on the bean tax, the Emperor [[Aurel IX]] was killed by his own bodyguard.

**What is known.** The Iron Guard stood the Gilded Gallery that day as they had stood it for eight centuries. A petitioner was speaking. A single guard stepped forward, and then it was over. The Emperor was dead before he reached the floor. The rest of the Guard did not move. They did not run, nor draw, nor speak. The petitioner is said to have finished his sentence, then asked whether the bean tax would still be due.

**What followed.** The Guard walked out, unchallenged, and went home to their Mothers. Within the week the [[The Regency Council|Regency Council]] had formed "until an heir is found". The Council has ruled ever since. The throne is empty, dusted daily by a clerk who is not permitted to sit on it, and who is said to have tried.

**What it left.** The War of the Empty Throne. A hatred of [[Orcs]] that never quite finds a place to land, because nobody can afford to fight them. And a mystery that the Regency has had thirty years to investigate and has chosen not to.

**How it is told now.** The Regency says treason. The orcs say nothing. Soldiers say the Emperor must have earned it, and drink to whoever did it. In every tavern on the continent there is an old man who was *there*, and in no two are the facts the same.

:::gm
The Mothers ordered it: Aurel IX was digging at three ward sites to open one. [[Grashka]], now Mother of Mothers, struck the blow herself, and walked out of the Gallery in the Guard's colours. She is [[Varra Nine-Knuckles|Varra]]'s grandmother. [[Mirrel Vosk|Sergeant Vosk]] stood at the door.
:::`,
    gmNotes: `Never confirm the "why" directly. Let NPCs offer theories: an affair, a debt, a god's command, a loyalty oath gone sour. The Mothers will answer only in silence.`,
  },
  {
    key: 'ev-war',
    type: 'event',
    name: 'The War of the Empty Throne',
    players: true,
    age: 'ashen',
    date: '2981 to 3002 AW',
    when: { year: 2981, month: 12, day: 3 },
    order: 20,
    parent: 'vael-ardith',
    summary: 'Twenty-one years of sieges, famine and mercenaries, as the pieces of the empire fought over its empty chair.',
    tags: ['war', 'empire'],
    body: `The Regency Council declared the throne vacant on 3 Longnight 2981 AW. By spring there were four pretenders. By the next winter, nine.

**What it was.** A war of successor states, free companies and starving provinces. Pretenders raised banners and lost them. Generals changed sides when the pay came late, and the pay came late. The Concord lent to everyone and called it neutrality. [[Grum]]'s priests blessed both sides of a siege and were thanked for it.

**The shape of it.** Sieges (Ardmere was the worst), burned granaries, burned villages, burned crops. A famine that killed more than any army did. Soldiers who had been paid in promises took what they could carry. The roads grew quiet.

**The paperwork.** Throughout, the Regency continued to send forms to the front: requisitions, casualty returns, certificates of death, all in triplicate. Surviving examples include a death certificate for a man named in the same document as "present and correct".

**What it left.** Twenty-one years of grudges. A generation raised to arms. The rise of the mercenary companies as the continent's real armies. And a silence about who actually won, which was nobody, in the end, but the Ashenreach.

**How it is told now.** By veterans, in the evenings, and never in order. They remember the weather, the food and one particular dog. Ask them who was winning and they stare at you until you buy another round.

:::gm
The war was not an accident of ambition. Several of the pretenders were prompted, quietly, by agents of the Quiet Office, to keep the realm divided. A weakened empire is a Regency that cannot be asked, politely, to give the throne back.
:::`,
    gmNotes: `For tone: the war is the thing everyone has survived, and no one wants to describe. Veterans' scenes should be small and strange.`,
  },
  {
    key: 'ev-hanged-corporal',
    type: 'event',
    name: 'The Hanging at Dunmeer',
    players: true,
    age: 'ashen',
    date: '12 Frostcall 2996 AW',
    when: { year: 2996, month: 11, day: 12 },
    order: 55,
    parent: 'fallowden',
    summary: 'A corporal refused to burn a village and was hanged for it. Soldiers pray to him out of spite, and it has started to work.',
    tags: ['war', 'soldiers'],
    body: `The village of Dunmeer lay in the Fallowden marches, held for the wrong pretender by the wrong people. On 12 Frostcall 2996 AW, a Restday, a column of the Regency's levies was ordered to burn it.

**The corporal.** His name is blotted from the record with what the clerks swear was spilled ink. One surviving muster-roll has a corporal *H. Len-* in that column, which may be him or may be more ink. He was thirty-four, they say, a cheesemaker's son turned soldier. The Ninth Lantern calls him Dask, the orc companies Hob, and [[Ardmere]] Little Fenn. He was told to fire the thatch of a village that held, by the roll, eleven old people and forty children. He put down his torch, and told the lieutenant he wasn't going to.

**What happened.** He was tried in an hour and hanged in four. The lieutenant, a stickler, required a rope, and the requisition for a rope had to be signed in triplicate by an officer who was away. He was finally hanged at noon from the village's one tree, on a tent-line that broke twice. The village burned anyway, though the levies, afterwards, were said to have done it badly.

**What it left.** A shrine in the road at Dunmeer made of rope and soldiers' buttons. A prayer, *Corporal, I'm not doing it*, said by soldiers who have been told to do something they won't. And, in the last few years, a handful of stories: a column that stopped, an officer who found he could not give the order, a fire that would not catch.

**How it is told now.** Soldiers swear by [[The Hanged Corporal]] with a grin, to see if anyone will object. Nobody has, yet. In the Ninth Lantern, a man who refuses an order says, "Dask's rule." It's a joke, for now.

:::gm
The Corporal is ascending. Every soldier who invokes him in refusal feeds him a little, and the Hanged Corporal is on his way to being the god of the common soldier's no. He has no priests, no temple, and no politics. That may make him the most dangerous god in the room.
:::`,
    gmNotes: `If a player invokes the Corporal in a moment of real refusal, let something small happen: a gust, a blunt blade, a torch that will not light. Do not explain it.`,
  },
  {
    key: 'ev-ardmere',
    type: 'event',
    name: 'The Siege of Ardmere',
    players: true,
    age: 'ashen',
    date: 'Bloomtide to Frostcall 2994 AW',
    when: { year: 2994, month: 4, day: 6 },
    order: 40,
    parent: 'ardmere',
    summary: 'A 211-day siege that ended when mercenary companies took the town themselves, and the Regency learned who really commanded its armies.',
    tags: ['war', 'siege', 'mercenaries'],
    body: `Ardmere, the river town north of [[Caer Ardith]], was held for the Regency by a garrison of levies and a commander named Helmar Quist. In Bloomtide 2994 AW it was surrounded by the Free Host of the pretender Hallam Ostrey. It held for two hundred and eleven days.

**The siege.** The usual horrors: starvation, disease, the water-gate, the dead thrown from the walls and the dead thrown back. Quist wrote to the Regency every week for relief. The Regency sent forms. Eventually it sent a wagon of forms, to be completed on arrival.

**The end.** On 7 Frostcall, three mercenary companies hired separately by the Regency, the Concord and a nervous duke arrived on the same day and found each other camped outside. They compared contracts, shared a drink, and agreed that the siege was cheaper to end than to continue. The orc company of the **Long Spoons** took the water-gate in an hour. Ostrey's army broke the same night.

**What it left.** A town of ten thousand reduced to four. A garrison that had not been paid in a year and a half. A new fact of life: the mercenary companies were now the real armies. The Regency could not do without them, and they knew it.

**How it is told now.** In Ardmere, by the old, in tones of fond horror. In the companies, as the day they stopped being employees. In the Regency's records, not at all. The official report of the siege, in nineteen pages, says only that it was *concluded satisfactorily*.

:::gm
Quist survived, and later signed the Treaty of Ashes as a Regency observer. He keeps a ledger of every promise made to Ardmere. Most were broken. The Concord bought the Free Host's unpaid wages that winter, and that is how the Concord first learned it could buy an army by the pound.
:::`,
    gmNotes: `Ardmere is a good source for a veteran NPC who is bitter about forms. The Long Spoons were a joke name that stuck: they ate the siege-ration out of one pot, with one spoon each.`,
  },
  {
    key: 'ev-ardmere-aftermath',
    type: 'event',
    name: 'The Ardmere Receipts',
    players: true,
    age: 'ashen',
    date: 'Winter 2994 to Thawmere 2995 AW',
    when: { year: 2995, month: 2, day: 11 },
    order: 50,
    parent: 'ardmere',
    summary: 'After the siege the companies were paid in receipts. The Concord bought the receipts at a discount, and learned how profitable war debt could be.',
    tags: ['debt', 'concord', 'mercenaries'],
    body: `The siege ended with a town in ruins and a victory no one could pay for.

**The receipts.** The Regency had no coin to pay the three companies who broke the siege. Instead it issued a stack of paper: *Ardmere Receipts*, promising payment "upon the settlement of the realm". Each was stamped, signed and numbered. A soldier could not eat one, and several tried.

**The market.** In the thaw of 2995, a Concord broker arrived in Ardmere with a cart and a clerk. She offered the companies forty crowns in the hundred for their receipts, in coin, on the spot. Most took it. By spring every Receipt was in the hands of a Concord house, and the Concord had learned something it would never forget: that a promise from a shattered state could be bought cheap and sold dear.

**What it left.** The Concord's appetite for the Regency's debt. The companies' lasting suspicion of any paper that was not coin. The rebuilt town of Ardmere, now run half by a company, half by a council, and wholly by a bankers' guild. And a sentence you hear in any camp: *"I'll take it in Ardmere Receipts"*, meaning *I do not believe a word of it*.

**How it is told now.** Companies tell it as the day they learned never to take paper. The Concord tells it as the day it first became useful. Both are right.

:::gm
The broker who bought the Receipts was an agent of Tollamund & Daughters. The same house is now buying the Ashenreach's debts on the same terms, and for the same purpose: a cheap claim on a land that cannot pay.
:::`,
    gmNotes: `Use this to explain why the Ninth Lantern does not trust the Concord and why the Concord does not care. A PC who still holds an old Receipt can sell it to Fennick for the amusement value.`,
  },
  {
    key: 'ev-grimmark-feud',
    type: 'event',
    name: 'The Salt Feud',
    players: true,
    age: 'ashen',
    date: '2996 to 3004 AW',
    when: { year: 2996, month: 12, day: 9 },
    order: 60,
    parent: 'hask',
    summary: 'Clan Harl of Skarn and Clan Dunmarrow of Hask fought eight winters over salt-fish dues. It ended when the dwarves came back and made the argument look small.',
    tags: ['grimmark', 'feud'],
    body: `In the Grimmark Holds, a feud is a form of weather. The Salt Feud began on 9 Longnight 2996 AW with a disagreement over a barrel.

**The cause.** Clan Harl of [[Skarn]] held the passes and taxed everything that came through them. Clan Dunmarrow of [[Hask]] held the north-coast fisheries. The agreed tax on salt-fish was one barrel in twelve. That winter, a Harl tallyman counted thirteen, and the Dunmarrow reeve disagreed.

**The feud.** Eight winters of burned boats, cut ropes, stolen sheep and a series of funerals for which both clans turned out, side by side, in good clothes, and glared. A Harl grandmother and a Dunmarrow grandfather are said to have been married in the middle of it, in a mountain hut, without telling anyone. A great deal of salt was spilled. Nobody ate well.

**The end.** In 3004 the [[Dwarves|Returned]] came up from under the mountains with no shadows and few words. Each clan found its own dead among them. The feud did not so much end as run out of anger, in the face of something larger and quieter.

**What it left.** A scar of grudges up the coast. [[Coldwater]] has never forgiven the Harls. A mountain pass with a toll-house at each end, charging for the same road. And a saying: *"Thirteen barrels"*, said when someone is being unreasonable about a small thing.

**How it is told now.** By the Grimmark, as a comedy and a tragedy in the same breath. By visitors, with confusion.

:::gm
The Dunmarrow reeve was right: there were only twelve barrels. A Harl tallyman had been paid to count one extra, by a Quiet Office agent who wished to keep the Grimmark divided and the passes poor.
:::`,
    gmNotes: `Good for a lightly comic subplot if a PC has Grimmark origins. Clan etiquette: never refuse a drink from the clan you are feuding with, and never finish it.`,
  },
  {
    key: 'ev-cinders',
    type: 'event',
    name: 'The Battle of Cinders',
    players: true,
    age: 'ashen',
    date: '14 Ashfall 3002 AW',
    when: { year: 3002, month: 9, day: 14 },
    order: 70,
    parent: 'cinderford',
    summary: 'Eight companies swore to hold the walls of Cinderford. By morning the plain was ash, the Ninth Ward was cracked, and one lantern was still burning.',
    tags: ['war', 'cinders', 'wards'],
    body: `The last battle of the War of the Empty Throne was fought at the ford of the river Cinder on 14 Ashfall 3002 AW, in the month that was still called Goldfall, and it was not meant to be a battle at all. It was meant to be a parley.

**What happened.** Eight mercenary companies, hired by different masters, took the walls of [[Cinderford]] to hold the ford against the armies of three pretenders. Before dusk each company lit a lantern and swore an oath to hold until it burned out. Then the armies arrived, and the battle sorcery began.

Nobody knows who struck first. By midnight the plain was fire: villages fused to glass, the river boiling, the horizon white. The Ninth Ward, which stood in the grain fields east of the ford, took the hits. It cracked.

**What came after.** A red moon rose above the ash. A camp healer walked out of the fire unburnt. By dawn all eight company lanterns had gone dark, but a ninth lantern, lit by deserters, cooks and the walking wounded, still burned in the keep.

**What it left.** [[The Ashenreach]]. [[The Rent]]. A cracked ward, a dead god, a new moon. A company called [[The Ninth Lantern]] that nobody had meant to raise. Sixty thousand dead, give or take, and nobody to count them.

**How it is told now.** Every soldier who was there has a different story, and every story has a dog in it. The Regency says it was a defeat for all. The Church of the Unburnt Saint says it was a miracle. Veterans say it was a Restday, and they were owed one.

:::gm
The ninth lantern was lit from a shard of the Ninth Stone blown loose in the blast. Its flame is part of what holds the crack shut. Ilyra drank [[Hathe]]'s dying power in the fire, and her church wants the crack to finish the job. Nobody who was at the lantern's lighting knows any of this. [[Brother Tallow]] suspects.
:::`,
    gmNotes: `The campaign's anchor event. When asked about it, give each NPC a single, vivid, incompatible memory. Let the party notice that nobody remembers the same moment the same way.`,
  },
  {
    key: 'ev-ember-rises',
    type: 'event',
    name: 'The Ember Rises',
    players: true,
    age: 'ashen',
    date: 'The night of 14 Ashfall 3002 AW',
    when: { year: 3002, month: 9, day: 14 },
    order: 80,
    parent: 'ashenreach',
    summary: 'A new red moon rose over the burning plain on the night of Cinders. Scholars call it impossible. Soldiers call it the Sergeant.',
    tags: ['cinders', 'moon'],
    body: `The red moon was not in the sky at dusk. It was in the sky at midnight.

**What was seen.** Survivors on the ash, in the river, on the walls of [[Cinderford]], all agree on the order of events. The fire was at its height. The smoke had hidden the stars. And then the smoke thinned and the Ember was there: large, low, the colour of a coal. It has not left since.

**What the scholars say.** [[The Ember]] is impossible. A moon cannot rise from nowhere, cannot keep a twenty-three-day cycle and cannot cast a light that makes dead soil weep. The scholars have written eleven papers on this and are working on a twelfth.

**What the soldiers say.** The Sergeant. It is always watching, they say, and it never says what it saw.

**What the Iskavethi say.** The Saint's Lamp. It rose to light her way out of the fire and has stayed to guide the faithful.

**What the Hollowborn say.** Very little, in public. In private, they say the Ember is awake, and that when it is full it knows their names.

**What it left.** A second calendar, and a collection of rituals: drawing curtains, keeping bread by the door, never leaving a child outside in the red light. And a growing unease, felt in every camp and every temple, that the Ember is not a moon but a signal.

:::gm
The Ember is the Sleeper's dream made visible at the sky's edge. Each full red moon its dreams strengthen, and the Sleeper stirs one step on its clock. Whoever holds the Ninth Lantern's flame hears the dream more clearly each time.
:::`,
    gmNotes: `Use the Ember to track time in play. Every full red moon should leave a visible mark on the town: someone sleepwalking, a stranger's face carved in stone, a clock that stops.`,
  },
  {
    key: 'ev-hathe-dies',
    type: 'event',
    name: 'The Death of Hathe',
    age: 'ashen',
    date: 'The night of 14 Ashfall 3002 AW',
    when: { year: 3002, month: 9, day: 14 },
    order: 90,
    parent: 'ashenreach',
    summary: 'GM only. The truth of how the Keeper of Doors died: not an accident of the battle, but a killing by the woman who walked out of the fire.',
    tags: ['secret', 'gods', 'cinders'],
    body: `Publicly, [[Hathe]], Keeper of Doors, died at the Battle of Cinders because a god's threshold cannot survive a field of unmaking. Since that night the dead do not always pass. Raveler priests keep his doors. Everyone accepts this as a tragedy of the war.

It was no accident.

**What happened.** In the heart of the fire, a camp healer named [[Ilyra of Halcyra|Ilyra]] stood among the dying. The Keeper came, as he comes to every death, to open the door for the souls of the battlefield. There were too many. There was too little left of him by the third hour.

Ilyra drank him. She did not draw on a spell or a rite. She drew on the flame itself, and the dying god's power, long meant to carry the dead, poured through her and left her unburnt. She walked out of the fire into the morning, and a legion of dead souls found a door that no longer opened.

**What it left.** A world in which the dead linger. A woman who is becoming a goddess. A church that claims her miracle and hides her method. And a priesthood of Ravelers, still guarding doors that nobody walks through.

**What survives.** A key, perhaps. The last thing a god of doors would keep.

:::gm
Ilyra is ascending on Hathe's stolen power and her church wants the Ninth Ward's crack to finish the job. [[Quorl Many-Words]] has heard seven dying soldiers whisper the same sentence, and the dead who cannot pass are the ones saying it.
:::`,
    gmNotes: `Keep this off the table until Session 5 or later. The easiest thread to pull: the dead who linger near Cinderford. They are not haunting the place. They are waiting at a door that is not there.`,
  },
  {
    key: 'ev-treaty',
    type: 'event',
    name: 'The Treaty of Ashes',
    players: true,
    age: 'ashen',
    date: '20 Frostcall 3002 AW',
    when: { year: 3002, month: 11, day: 20 },
    order: 100,
    parent: 'treaty-stone',
    summary: 'Two months after Cinders the exhausted powers signed a peace that made the Ashenreach a neutral march, garrisoned by mercenaries and paid for by everyone.',
    tags: ['treaty', 'war'],
    body: `Sixty-six days after the battle, delegates from the Regency, the Concord, Iskaveth, the Grimmark and a number of lesser powers met on the northern edge of the ash and signed the Treaty of Ashes.

**The terms.** The Ashenreach became a neutral march, claimed by none. Its garrison was to be the free companies who had survived Cinders, paid by all signatories in equal shares. No signatory might field an army within it. No company might be dismissed without the unanimous consent of all.

**The signing.** It took place at a standing stone on a rise, which became [[The Treaty Stone]]. Because no one trusted any single table, the document was signed on a drumhead set on the stone itself, with nine pens. The Treaty Bell was rung at its end; the sound, a witness noted, was oddly flat, as if the ash had swallowed it.

**What it left.** Peace of a kind. A garrison with duties and no master. A treaty that depends on everyone paying, which in practice means that everyone is waiting for someone else to stop. And a very good source of work for lawyers.

**How it is told now.** Pilgrims touch the Stone and leave coins. Vandals scratch their initials. The Regency says it kept every clause, and the Concord says it kept every ledger. The Ninth Lantern, which was added to the roll in the margin a year later, says it has not seen the money in weeks.

:::gm
The original Treaty, signed in nine hands, carries a margin note in the script of Hathe's priesthood that the signatories could not read: *the dead may not sign*. No one has yet had it translated. It also holds two clauses no public copy has: page seven, on the keeping of the Ninth Ward, and the full pay clause, *or by whosoever shall hold their debt*. See [[The Original Treaty]].
:::`,
    gmNotes: `The Treaty is the party's leverage. A reading of its terms reveals that the Regency cannot legally dismiss the Ninth Lantern without the Concord's consent, and the Concord does not want to give it.`,
  },
  {
    key: 'ev-cinderford-rebuild',
    type: 'event',
    name: 'The Rebuilding of Cinderford',
    players: true,
    age: 'ashen',
    date: 'Seedwake 3003 to Reaping 3005 AW',
    when: { year: 3003, month: 3, day: 5 },
    order: 110,
    parent: 'cinderford',
    summary: 'Cinderford was raised from the ruin of Cinders by people who expected to leave and then did not.',
    tags: ['cinderford', 'rebuilding'],
    body: `When the ash settled, Cinderford was a hundred acres of broken stone around a bridge that had somehow survived. In the spring of 3003 AW the first people came back.

**Who.** Survivors, scavengers, the walking wounded of eight dead companies, and a ragged tide of refugees who had nowhere else to go. Reeve [[Odile Fairweather]], then very young and very tired, took the job of telling them where to put things. [[Halflings]] of the barge clans brought timber upriver and charged for it. [[Ravelers]] buried what they found, and charged more.

**How.** In grey. The only stone in reach was the rubble, and the only mortar was glass-dust from the nearby ruins, which dries the colour of ash and sets like iron. Every building in Cinderford is that grey, and strong, and a little sharp at the edges. The Regency sent funds. They arrived, after a delay, in the form of forms.

**The Assessor's Office** was established in this period: one room, one clerk, a stamp and a promise that more were coming. Three clerks and a mountain of paper later, it is still one room.

**What it left.** A town of two thousand eight hundred that did not expect to stay. A habit of hanging a coat by the door. A grey, odd beauty that visitors find hard to describe.

**How it is told now.** Residents tell it as a story of defiance, usually after the second drink. Visitors say they've never seen a place so determined to leave.

:::gm
Twelve of the first houses were built over cellars the builders did not dig. The glass-dust mortar rings faintly at red moon. The Smokes' oldest families know to keep their doors shut those nights.
:::`,
    gmNotes: `Use the rebuilding as the explanation for odd details in town: a wall that does not match its neighbour, a cellar no one admits to, a bridge that is older than the battle.`,
  },
  {
    key: 'ev-ninth-renewal',
    type: 'event',
    name: "The Ninth's First Renewal",
    players: true,
    age: 'ashen',
    date: '14 Ashfall 3003 AW',
    when: { year: 3003, month: 9, day: 14 },
    order: 120,
    parent: 'lantern-keep',
    summary: 'A year after Cinders the signatories had to renew the garrison contracts, and had to decide what to do about a ninth company nobody had counted.',
    tags: ['ninth-lantern', 'contract'],
    body: `One year to the day after the battle, the signatories met to renew the garrison contracts of the Ashenreach. The roll listed eight companies. All eight were dead or disbanded. A ninth, on no roll at all, was standing in the hall holding a lantern.

**The problem.** The Ninth was not on the roll. Its members were deserters, cooks, wounded and walking dead. Its founding was unrecorded. But its lantern was lit, and the Keep was held, and the first captain, who had no title and no pay, refused to sit down until somebody did the arithmetic.

**The clause.** A Regency drafter, confident that the lantern would go out within a week, proposed a contract: the Ninth would hold the Keep and the ford, paid like any company, and *stand down if the lantern ever goes out*. The Concord's clerk, equally confident, signed. Nobody read it twice. It has been in force ever since.

**What it left.** A company with a legal existence and an unusual weakness: one flame. [[The Ninth Lantern]] has held the Keep for nine years. The lantern has never gone out.

**The betting book.** [[Spoons Aldane]], then a young corporal with an interest in odds, opened the first pool that morning: *when will it go out?* The best early odds were three weeks. They have been revised, regularly, ever since.

**How it is told now.** In the company, as a point of pride: *they bet against us and we're still here*. In the Regency's files, as an administrative oversight.

:::gm
Spoons's first pool recorded one oddity: a bettor who put a large wager on "never". She was a Raveler woman who vanished the next day. The wager has never been collected, and sits in Spoons's strongbox, growing.
:::`,
    gmNotes: `The "stand down if the lantern goes out" clause is the hinge of the campaign. Remind the table that the clause was written by people who wanted the lantern to fail.`,
  },
  {
    key: 'ev-first-hollowborn',
    type: 'event',
    name: 'The First Hollowborn',
    players: true,
    age: 'ashen',
    date: 'Born from 14 Ashfall 3002 AW, recognised Bloomtide 3004 AW',
    when: { year: 3004, month: 4, day: 11 },
    order: 130,
    parent: 'the-smokes',
    summary: 'Children born in and after the night of Cinders came into the world with one eye that sees the dead. It took two years for anyone to count them.',
    tags: ['hollowborn', 'cinders'],
    body: `The first of them were born on the night of Cinders. A midwife in the Smokes delivered a boy in a cellar while the sky burned, and noticed that his left eye did not follow her candle.

**The recognition.** For two years the births went unremarked. A child who stares at an empty corner is not news in a town of ruins, and a baby who walks at four months is a wonder for a week. It was a Raveler, [[Mother Corvane]], who put the pieces together in the spring of 3004 AW. She had been burying the dead of Cinderford, and noticed that a certain number of children kept pointing at the graves.

**What they are.** [[The Hollowborn]]: born where a ward has failed, touched by the dreams of the buried god. One eye sees the dead. Many were born on the night of the battle, or in the days after, and more have been born since, in the Ashenreach and beyond. Dwarves, humans and halflings all bear them. The six born in Cinderford on the night itself are stranger still: they grew from cradle to grown in about seven years, and nobody knows why. Every Hollowborn born since has aged like anyone else.

**How they live.** Mostly quietly. Some are afraid. Some are proud. A few are drawn, as if on a string, to the Rent.

**What it left.** A new people, or an old one made visible. A kind of grief that has two eyes. And a rumour, spreading, that the Hollowborn dream.

**How it is told now.** In the Smokes, as a gift. In the Regency, as a problem. In the Church of the Unburnt Saint, as a sign. The Hollowborn themselves say only that they are tired of being told what they are.

:::gm
Every Hollowborn dreams the same dream at full red moon, and it is getting clearer. Tibbet Marlowe was born that first night, in the Smokes, and the midwife in that cellar was his own grandmother. Why he and the other Cinders-born grew so fast is [[Why did the Cinders-born grow up so fast?]].
:::`,
    gmNotes: `Hollowborn PCs and NPCs should feel like neighbours, not omens. Let them be funny, rude and practical. The dream is the thing that sets them apart, and it can come later.`,
  },
  {
    key: 'ev-returned',
    type: 'event',
    name: 'The Return from the Deep',
    players: true,
    age: 'ashen',
    date: '2 Emberwane 3004 AW',
    when: { year: 3004, month: 7, day: 2 },
    order: 140,
    parent: 'hollowhall',
    summary: 'Dwarves who went under the mountains in the war came back casting no shadows, and will not say where they have been.',
    tags: ['dwarves', 'grimmark'],
    body: `In the last years of the war, the dwarves of the Grimmark went under. Their gates closed, the sound of their forges stopped, and the north grew very quiet. For nearly a decade, there was nothing.

**The return.** On 2 Emberwane 3004 AW the great gate of [[Hollowhall]] opened from the inside. Out came a column of dwarves, thin, grey and silent, who had been presumed dead. They did not cry out. They did not greet their kin. They walked into the light and stopped, blinking, and a child on the road to the gate said what everyone was thinking: *they've lost their shadows.*

**What they are now.** [[Dwarves]] of the Returned cast no shadow in sun, lamp or fire. They eat, drink, laugh, argue and feel pain, and will not speak of the deep. The few who tried, in the first years, went quiet in the middle of the sentence and did not finish it.

**What followed.** More came up in the years since, singly or in groups, the last of them this spring. Some found their families dead. Some found them waiting. The clans of the Grimmark, who had been fighting each other, found they could no longer remember why.

**How it is told now.** The surface dwarves revere the Returned and fear them a little. The Returned ask for no reverence at all. They like warm food, a seat by the fire, and a wall at their backs.

:::gm
Beneath the Grimmark they found the Eighth Ward. Something there took their shadows as the price of passage, and that something has not finished collecting. [[Borrin Halt]] came up six months ago with three missing years, and something followed him.
:::`,
    gmNotes: `Play the Returned as warm, practical and slightly absent. They hold doors, share bread and look at their hands when asked about the war. Never have them speak of the deep unprompted.`,
  },

  {
    key: 'ev-saelwood-closes',
    type: 'event',
    name: 'The Closing of the Saelwood',
    players: true,
    age: 'ashen',
    date: '9 Greenreach 3005 AW',
    when: { year: 3005, month: 5, day: 9 },
    order: 150,
    parent: 'sael',
    summary: 'Sael shut its borders to outsiders three years after Cinders. The elves gave no reason. Scholars are still guessing.',
    tags: ['elves', 'sael'],
    body: `On the ninth of Greenreach 3005 AW, a messenger from [[Ilmareth]] rode to the Concord embassy with a letter on silk. The Saelwood, it said, was closed.

**The terms.** No ships to land at Saelish ports. No travellers on the forest roads. Trade by appointment, through three named gates, with a bond lodged in advance. Elves abroad were recalled, and those who refused were quietly struck from the family tree.

**The reasons given.** None. The letter was four lines, courteous and entirely without content, and ended with "we are grateful for your understanding".

**The reasons guessed.** The Concord's agents decided the Saelish had seen something in the Ember and were frightened. Iskavethi preachers decided Sael was hiding from the Saint. The Regency decided it was a trade tactic. [[Orvanne]]'s hunters in the border villages reported that the forest itself seemed to have shifted: paths that ended, fords that moved, a wind that came from the inside.

**What it left.** A cold dispute with every neighbour. A thriving smugglers' trade in Saelish wine, silk and ink. A stranded community of elves in the cities of the south, holding onto a home they cannot enter. And [[Aelith Sorn]], who left Sael before the closing and has spent the years since trying to find out why her people want her gone.

**How it is told now.** In the Concord, as an unpaid bill. In Sael, as nothing. In the bars of Cinderford, as the best place to buy a decent cloak.

:::gm
The Fourth Ward shuddered the night of Cinders, and every elf with old ink felt it burn. The Remembrancers closed the borders to keep anyone from learning what the ink had begun to say. The closing was a quarantine of memory.
:::`,
    gmNotes: `A closed border is a gift to a smuggler PC. Kettle Brindlewake has a route in. It costs more than the PCs have.`,
  },
  {
    key: 'ev-fort-mercy-burns',
    type: 'event',
    name: 'The Burning of Fort Mercy',
    players: true,
    age: 'ashen',
    date: '20 Emberwane 3005 AW',
    when: { year: 3005, month: 7, day: 20 },
    order: 160,
    parent: 'fort-mercy',
    summary: 'The Regency fort at the edge of the ash went up in one night with refugees inside. Three accounts, none comfortable.',
    tags: ['fort-mercy', 'fire'],
    body: `[[Fort Mercy]] had been built by the Regency in 2996 to hold the eastern road, and named, with imperial humour, for the mercy it was meant to bring the pear country. In the summer of 3005 AW it held a Regency garrison of eighty, a records vault and, that season, nearly three hundred refugees from the glasslands who had been promised shelter.

**The night.** On 20 Emberwane, a little after midnight, the fort began to burn. The fire started in the stores and was in the barracks within minutes. The gates, which opened inward, were found jammed. Two hundred and sixty-one people died. The garrison commander, who was away that night on a matter of paperwork, was not among them.

**The accounts.**
- The Regency says it was an accident: a lamp, a spilled keg, bad luck.
- The garrison's survivors say a company of strangers in plain cloaks arrived at dusk, spent an hour in the records vault, and left before dawn.
- The refugees' kin say the gates were barred from the outside.

**What it left.** A blackened shell on the edge of the glass, too dangerous to restore, too useful to abandon. A grief that has never found a proper owner. And a salvage trade: within a year, the first gangs of [[The Glassers]] were picking through the ruin for iron and lead.

**How it is told now.** The Ninth Lantern's old hands will not discuss it. The Glassers, who live there now, say the place is quiet at night, and that the quiet is the worst part.

:::gm
The strangers were agents of the Quiet Office. The vault held the surviving papers of Ilbert Crane's secret digs, and the burning was meant to destroy them. It did not entirely succeed. Marius Vell does not know that one copy of Crane's survey is still in the glass beneath the fort.
:::`,
    gmNotes: `Fort Mercy is a session 2 location. The first thing a party notices should be the smell, and the last should be the knowledge that someone wanted all of this gone.`,
  },
  {
    key: 'ev-first-riot',
    type: 'event',
    name: 'The Night of Open Eyes',
    players: true,
    age: 'ashen',
    date: '17 Reaping 3006 AW',
    when: { year: 3006, month: 8, day: 17 },
    order: 170,
    parent: 'the-smokes',
    summary: 'Cinderford\'s first Hollowborn riot began with a child telling a widow where her husband was standing, and ended with eleven dead.',
    tags: ['hollowborn', 'riot', 'cinderford'],
    body: `The riot in the Smokes began, as these things do, with a kindness.

**The spark.** A Hollowborn girl of seven, selling matches at the Low Quay, told a woman in the queue that her husband was standing behind her and wanted her to know the roof was fixed. The woman's husband had died at Cinders. She screamed. A crowd formed. In the heat of an August evening, in a town on edge, it did not take long for someone to shout *witch*.

**The night.** Three hours of fighting between Hollowborn families and the neighbours who had lived beside them for years. Tanneries were burned, shutters smashed and a well poisoned with a dead dog. [[Captain Marrow|Ilse Marrow]] marched the company down from the Keep and stood her people between the two crowds with their weapons held low. She held them there until dawn, and a man died on her sword arm's side of the line, which she has never discussed.

**The toll.** Eleven dead, forty hurt, nine households burned out. The company arrested thirty and hanged none, an act of mercy the Regency noted in a file marked *irregular*.

**What it left.** A wary peace. A tradition of the Smokes' door-bells, rung twice for safety. An understanding between the Hollowborn and the company that neither will say aloud: *if it happens again, we come.* And a girl, now eighteen, who still sells matches and no longer tells anyone what she sees.

**How it is told now.** The Smokes remember it as the night the soldiers stood in the street. The Quarter above it remembers it as the night the Smokes burned.

:::gm
The first shout of *witch* came from a man who had arrived in town three days earlier, spent two nights at the Velvet Ledger, and left the day after. He was never found. The Ledger kept his name; Sorrel Vey has not shared it.
:::`,
    gmNotes: `A touchstone for any Hollowborn PC's backstory. Whoever they are, they were in the Smokes that night, or someone they love was.`,
  },
  {
    key: 'ev-stillwater-drowns',
    type: 'event',
    name: 'The Drowning of Stillwater',
    players: true,
    age: 'ashen',
    date: '9 Frostcall 3006 AW',
    when: { year: 3006, month: 11, day: 9 },
    order: 180,
    parent: 'stillwater',
    summary: 'A farming village on a grey lake went under in a night. Its Hollowborn survivors built a new one on the shore.',
    tags: ['hollowborn', 'stillwater'],
    body: `Stillwater was a farming village of about three hundred, set on the shore of a grey lake in the eastern ash. On a night in Frostcall 3006 AW, it was not there in the morning.

**What happened.** The lake rose. Neighbours three miles off saw nothing and heard nothing, only that the stars over the water flickered. At dawn the village was under the grey, and the lake lay as still as a plate. Seventy people came out of it alive. Almost every one was a child, and almost every child was Hollowborn.

**The aftermath.** The survivors were taken in by Cinderford, by passing barge-folk and by [[Ravelers]] who arrived uninvited. Within a year the Hollowborn among them had gone back to the shore and begun to build, a stone's throw above the waterline. They named the new place Stillwater and said no more about it.

**What it left.** A hamlet with a bell that rings itself under the lake at red moon. A tradition that no one fishes after dusk. A rumour that the drowned are still in the water, standing, looking up.

**How it is told now.** The Hollowborn of Stillwater treat it as a family matter. Strangers are welcome, within reason, as long as they leave the lake alone. The Regency, which was once asked to investigate, wrote to say the village did not exist on its maps.

:::gm
The lake rose on a night when the Sleeper's dream was strong enough to reach the surface of the world. The children who lived were the ones who dreamed it with open eyes. A girl among them, twelve years old and newly run away from the Smokes, is now called the Dreaming Widow. She still sits on the shore at red moon.
:::`,
    gmNotes: `Use Stillwater's bell as an ominous timer. The note is low, and slow, and always one beat behind where it should be.`,
  },
  {
    key: 'ev-saint-declared',
    type: 'event',
    name: 'The Saint Declared',
    players: true,
    age: 'ashen',
    date: '1 Highsun 3007 AW',
    when: { year: 3007, month: 6, day: 1 },
    order: 190,
    parent: 'halcyra',
    summary: 'Iskaveth declared the healer who walked out of the fire a living saint. The church of fire and mercy was born that morning.',
    tags: ['iskaveth', 'saint'],
    body: `For five years the woman who walked out of the fire at Cinders lived quietly in [[Halcyra]], in a house of healers, treating the sick for no fee. The crowds outside grew each month. On the first of Highsun 3007 AW, her people came to her door and asked a question.

**The declaration.** The High Council of Iskaveth, meeting in the Hall of Coals, declared [[Ilyra of Halcyra]] a living saint, *Unburnt*, favoured of the first flame. The bells of the city rang for a day. Fire-priests walked barefoot through the streets, and a thousand households lit lamps for her.

**What she said.** Almost nothing. She is said to have stood on the balcony, looked at the crowd, and smiled. Witnesses disagree on whether it was the smile of a woman moved, or of a woman counting.

**What followed.** Pilgrims by the thousand. A flowering of small shrines. A church, [[The Church of the Unburnt Saint]], with its own vestments, liturgy and clerks. And a slow, steady rise in her reputation as a bringer of mercy, healer of the hopeless and, in whispers, the one who will heal the continent.

**How it is told now.** In Iskaveth, as a holy morning. In the Regency, as an irritant. By the Concord, as a growing market. By the soldiers of the Ninth Lantern, who were there that night and saw her walk out of the fire, with a certain amount of suspicion. They don't say why.

:::gm
By 3007 Ilyra had already been drinking the power of Hathe for five years, and it had begun to show. The declaration was her church's first public step toward making her a god. Every prayer in her name feeds her.
:::`,
    gmNotes: `Seraphine Ashe will mention the day of declaration often, always in the same words. Note it. It is a script she has been given.`,
  },
  {
    key: 'ev-house-founded',
    type: 'event',
    name: 'The Founding of the House of Unburnt Light',
    players: true,
    age: 'ashen',
    date: '14 Bloomtide 3008 AW',
    when: { year: 3008, month: 4, day: 14 },
    order: 200,
    parent: 'house-unburnt-light',
    summary: 'Iskaveth opened a mission in the Ashenreach, with soft beds, hot soup and a very patient staff.',
    tags: ['iskaveth', 'saint', 'cinderford'],
    body: `A year after the Saint was declared, Iskaveth sent her faith west. On 14 Bloomtide 3008 AW the doors of [[The House of Unburnt Light]] opened on the edge of Cinderford.

**The founding.** The House was built by Iskavethi masons from a kit of cut stone carried across the plateau by mule. It has a clean refectory, a hospital ward, a library and a chapel in which a single flame has never gone out. The first envoy was [[Seraphine Ashe]], a human woman of grave courtesy, who arrived on foot and was said to have healed the first patient with her hands.

**What it offers.** Soup. Beds. Medicine. Kindness without conditions, apart from the one the staff never mention: that you will sit and listen while they tell you about the Saint. The House does not demand worship. It simply makes it comfortable.

**What it left.** A mission that treats the sick for nothing and has, in four years, become the best-liked institution in the Ashenreach. A rival to the Doorkeeper's Chapel. A rumour that those who pray in the chapel sleep unusually well.

**How it is told now.** The poor love it. The company respects it. The Ravelers are polite about it, with the stiffness of a rival who cannot decide whether to be insulted. The Concord's agents go there for the soup and report on the guests.

:::gm
The House is a lamp. Every prayer offered under its roof is carried east to Halcyra, and the flame in the chapel burns a shade brighter. The staff do not know. The Saint does. Sister Seraphine's hands heal because the Saint wills it.
:::`,
    gmNotes: `Make the House seductive. A PC who spends a night there should sleep better than they have in years and wake with a faint warmth under the breastbone. That's the hook.`,
  },
  {
    key: 'ev-glassers-find',
    type: 'event',
    name: 'The Glassers\' First Big Find',
    players: true,
    age: 'ashen',
    date: '3 Ashfall 3008 AW',
    when: { year: 3008, month: 9, day: 3 },
    order: 210,
    parent: 'ashenreach',
    summary: 'Vexa Glassjaw\'s crew cracked a bubble of fused glass and found the lost pay-chest of the 11th Foot. Within a season there were two hundred diggers.',
    tags: ['glassers', 'salvage'],
    body: `The glasslands are full of things. Most of them are bone.

**The find.** On 3 Ashfall 3008 AW a crew led by the orc [[Vexa Glassjaw]] was working a fused farmstead east of the Rent when their pick opened a bubble in the glass the size of a wagon. Inside, perfectly preserved, was the pay-chest of the Regency's 11th Foot: nine thousand crowns in imperial silver, a roll of company seals and the remains of a quartermaster who had, at the end, been trying to count it.

**The rush.** Word travelled by barge in three days. Within a season there were two hundred diggers on the plain, and the salvage gangs had acquired a name. [[The Glassers]] organised themselves into crews, claimed districts and began selling what they found to anyone who would pay. [[Gutter Market]] in Cinderford grew from a few stalls into a town within the town.

**What it left.** A trade, a culture and a code. A lucrative new grievance for the Regency, which regards the chest as its property and the Glassers as thieves. A fashion for glass jewellery. And a belief, now widespread, that anything in the glass may be worth digging up.

**How it is told now.** The Glassers tell it as luck and good boots. The Regency tells it as theft. The quartermaster, whose body Vexa buried on the spot, is remembered by the crew as Old Tally, and a coin is left on his grave.

:::gm
Among the other things in the bubble was a slab of Lithic stone, cut with writing nobody could read. Vexa kept it. It is the first of several, and she has begun to suspect that the glass was fused around them on purpose.
:::`,
    gmNotes: `Vexa is proud of the find and tired of it being the only thing anyone asks about. Ask her about the writing and she will talk for an hour.`,
  },
  {
    key: 'ev-regency-stops',
    type: 'event',
    name: 'The Regency Stops Paying',
    players: true,
    age: 'ashen',
    date: '1 Hollowfrost 3009 AW',
    when: { year: 3009, month: 1, day: 1 },
    order: 220,
    parent: 'caer-ardith',
    summary: 'On the first day of the year the Regency announced a temporary adjustment of its obligations. The Concord began buying the debt that afternoon.',
    tags: ['regency', 'debt', 'treaty'],
    body: `The notice arrived on every garrison desk in the Ashenreach on 1 Hollowfrost 3009 AW. It was three pages long and began: *"In the interest of the stability of the Realm, the Regency Council wishes to announce a temporary adjustment to certain obligations."*

**What it meant.** The Regency would stop paying its share of the garrison's wages. The other signatories, it was understood, would carry the load. They had no intention of doing so. By spring, the Concord, Iskaveth and the Grimmark had made similar adjustments, quietly, in smaller print.

**Who signed it.** [[Marius Vell]], Regent-Chancellor, who has never been seen to smile and was said to have read the notice aloud twice to be certain it said nothing.

**The Concord's move.** Within hours, Concord houses were buying up the unpaid debts at forty in the hundred. The Regency, they noted, would never repay. They would.

**What it left.** A garrison with no master. A chain of IOUs running from Cinderford to Sevenhaven. A company, the Ninth Lantern, paid late and then barely. A growing awareness that the Ashenreach is not a neutral march any more, but a debt-slave of the Concord's patience.

**How it is told now.** In the Keep, with swearing. In Caer Ardith, with a shrug. In the counting-houses, as the day the Ashenreach became an asset.

:::gm
Vell ordered the stoppage on purpose. A garrison that is not paid will mutiny, and a mutiny gives the Quiet Office an excuse to move into the Ashenreach and take the lantern. The notice is a lit fuse.
:::`,
    gmNotes: `Use the notice's phrasing as a running gag. Fennick can recite it at will. It sounds more insulting each time.`,
  },
  {
    key: 'ev-concord-crash',
    type: 'event',
    name: 'The Gilt Run',
    players: true,
    age: 'ashen',
    date: '22 Seedwake 3010 AW',
    when: { year: 3010, month: 3, day: 22 },
    order: 230,
    parent: 'gilt',
    summary: 'A Concord bank failed in a week, and the Shellbacks bailed it out on terms that nobody will describe.',
    tags: ['concord', 'debt', 'gilt'],
    body: `On the morning of 22 Seedwake 3010 AW a rumour went round the bottle-necked harbour of [[Gilt]] that House Ferrowyn, the city's oldest bank, had lent too deeply to the Regency. By noon there was a queue around the building. By dusk it stretched to the docks.

**The run.** Three days of panic. Merchants sold cargoes at a third of their worth to raise cash. Debtors fled. The Ferrowyn doors were closed on the second day and the Ferrowyn clerks, it was said, wept on the steps. The Concord's other houses watched, and did not intervene. It was not until the fourth morning that the ledger was balanced.

**The rescue.** A Shellback house arrived, slowly, with a cart. [[Grandmother Tollamund]]'s family, it was said, paid Ferrowyn's depositors in full and took, in return, its entire portfolio of Regency debt. Including, in the small print, most of the Ashenreach's.

**What it left.** A Concord richer in its debts and poorer in its trust. A Gilt that no longer boasts about its banks. A great many ruined families. And a quiet shift in the balance of power: the Shellbacks, who had always been the Concord's bankers, were now its owners in all but title.

**How it is told now.** In Gilt, as a lesson in prudence. In Sevenhaven, as a bargain. In the Priesthood of [[Corvex]], as a case study in how a broken promise is a theft, and how a rescue is a purchase.

:::gm
The Shellbacks engineered the run. The rumour was theirs. The rescue let them buy the Ashenreach's debts at a fraction of their worth, and that is the whole of their plan: to own the land the lantern stands on, and then to own the lantern.
:::`,
    gmNotes: `For Tollamund & Daughters, this is the origin of the company's debt. Fennick owes them because he borrowed against the Ferrowyn paper before the crash.`,
  },
]
