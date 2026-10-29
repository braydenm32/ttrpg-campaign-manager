---
number: 1
title: Payday
worldDate: 14 Ashfall 3011
pages: [ q-lantern-gutters, q-payday, q-drowned-man, q-poisoned-flame, q-kettles-cargo, h-pay-notice, h-wanted, ilse-marrow, mirrel-vosk, brother-tallow, fennick, garrick-sallow, spoons, kettle, dannic-rook, marla-marlowe, varra, ysse, borrin, tick, quorl, npc-mother-hennet, npc-halloran-pike, npc-dunstan-bray, npc-dunny-pike, npc-gerda-hollin, npc-skrell, npc-nan-crupp, mother-corvane, aelith-sorn, lantern-hill, lantern-keep, last-candle, the-ford, treaty-bell, low-quay, hesks-chandlery, glass-barrow, item-lantern, item-oil-tin, item-lantern-token, item-grumblers, item-marigolds, f-ninth-lantern, h-noticeboard, lore-festivals, item-aurels-penny, lore-songs, bellwether, npc-keld-owes-nothing, sedgemere, ford-street, the-bakers-wife, npc-ada-pennock, q-bakers-hoard, the-hock, table-street-events, h-dannic-note ]
encounters:
  - name: The drowned walk
    notes: "Ash-drowned (zombie, scaled for level 1): grey, bloated, coughing ash, speed 20. They walk toward the Keep and fight only what blocks them. Dannic: slam +3, 1d6+1 bludgeoning; a creature he hits makes a DC 11 Con save or is poisoned until the end of its next turn (the ash). Undead Fortitude: dropped to 0 by anything but radiant or a critical hit, he makes a Con save (DC 5 + the damage) to drop to 1 HP instead. The other two are half-made: HP 11, slam +3 for 1d4+1, no Undead Fortitude. A flame from the Lantern (a wick-lamp held to them) denies Undead Fortitude: damage from a blade passed through a wick-lamp this turn (a bonus action), or from the lamp itself thrust at them (improvised, 1 fire), cannot be shrugged off. The ford-watch (Gerda Hollin) holds one of the three off at the water's edge for the whole fight. Dannic is the first to rise and the last to fall; when he does, he speaks."
    foes:
      - { name: Dannic Rook (ash-drowned), count: 1, hp: 22, ac: "8", side: foe, page: dannic-rook }
      - { name: Ash-drowned (half-made), count: 2, hp: 11, ac: "8", side: foe }
      - { name: Gerda Hollin, count: 1, hp: 30, ac: "18", side: ally, page: npc-gerda-hollin }
  - name: Glass-spiders
    notes: "Giant spider, scaled for level 1: glassy, fist-sized eyes, legs that chime. Bite +4, 1d6+2 piercing plus 1d6 poison (Con DC 11 for half). Web (recharge 5-6): +4 ranged, target restrained by ringing glass thread (Strength DC 11, or 10 damage to the web, to break free). Spider Climb; Web Sense. They nest in the bakery ovens only. Two by default; add a third only for a rested party that wants the fight. A group Stealth check (DC 12) gets the party past the bakery door without waking them."
    foes:
      - { name: Glass-spider, count: 2, hp: 13, ac: "13", side: foe }
  - name: The Cold Captain of the Seventh
    notes: "Wight, scaled for level 1. Speed 30. One attack a turn: lantern-pole +4, 1d8+2 bludgeoning; or Life Drain +4, 1d6+2 necrotic, Con DC 11 or hit-point maximum reduced by the damage until a long rest. Resists necrotic and cold; vulnerable to fire. Non-aggressive: he sits until something is lifted from the ring round his chair, then stands and fights only to put it back; set it down and step out of the ring and he stops. Shown a lit wick-lamp or a company token, he stops for a round and asks 'Which lantern is lit?'; the answer 'the Ninth' makes him sit, and he does not rise again for this party. Lantern flame makes him recoil: disadvantage on his attacks against anyone holding a lit wick-lamp. Each spell cast in the Barrow after the first gives him +5 hp (max +10). He never leaves the Cold Room."
    foes:
      - { name: The Cold Captain of the Seventh, count: 1, hp: 30, ac: "13", side: foe }
lectern:
  scene: lantern-hill
  present: [ ilse-marrow, mirrel-vosk, fennick, garrick-sallow, brother-tallow ]
---

## Session 1: Payday
*Level 1. Coinday, 14 Ashfall 3011 AW: the quarter-day, and the ninth anniversary of Cinders. About four hours.*

- *Sky*: Pallas a night from full; the Ember nearly full, rising red at dusk.
- *Weather*: fine ash all day, soft as first snow. No roll needed.
- *Touch these*: Gerda Hollin sees Borrin's late shadow by the cage and says so out loud. Vosk, hungover from his yearly bottle at the Corporal's Gibbet, calls the mutterers mutineers to their faces. Old Halloran Pike tells the lantern story wrong by the Candle fire, on purpose. Spoons opens a book on the drowned man ("five to two he walks again"). After the guttering, Ysse dreams one word in the warm voice: *Hold.*
- *Level-up*: End of session: level 2.

**The shape of the night.** The pay doesn't come on the one day of the year the company can least stand it. The company mutters; a drowned deserter climbs out of the river at noon; the party follows his trail under the ford into [[The Glass Barrow]] and finds [[The Cut Oil Tin]]; they come back up in time to watch the lantern gutter for the first time in nine years.

**Before you start.** Agree the safety tools with the table. Give each player their character page and let them read their own secret. The five PCs are wicks: hangers-on who have been eating the company's bread on promise, to be sworn in at this quarter-day muster. Ask each player one question: *What did you spend your last silver on, and do you regret it?*

**Wick-lamps.** Every soldier of the Ninth carries a hooded tin lamp the size of a fist, lit from the Lantern by the lamp-keeper the morning they sign on; that is why recruits are called wicks. Its flame is the Lantern's flame. It never needs trimming, it shrinks when the Lantern gutters, and a soldier who lets it go out climbs to the cage at dawn and asks for a light, to general mockery. Tonight it is the party's best weapon: it denies the drowned their Undead Fortitude and makes the Cold Captain recoil. If nobody thinks of it, Gerda shouts it at the ford.

---

### Scene 1: The muster (Lantern Hill, morning)
> The handbell on Lantern Hill clanks for muster, dented and tinny, the way it has every morning for nine years. Ash is coming down soft as the first snow of winter, settling on helmets and shoulders and on the iron cage high in its niche on the Keep's east wall, where a small flame burns behind the bars without a flicker.
>
> A hundred and forty soldiers stand in the drill yard in four ragged files. Their boots have been mended with tent canvas. Their breath smokes. Somewhere at the back, a corporal is taking bets.
>
> Captain Ilse Marrow walks out of the Keep with a letter in her hand. It has a Regency seal on it. She breaks it in front of everyone, reads it once, and then, very carefully, reads it again.
>
> "Well," she says. "Good news. We've been paid."

**Before the letter: Cinders morning.** Play a minute of quiet first. It is nine years to the day. Vosk has unlocked the outside ladder, and the veterans who were at Cinders climb it one at a time, touch the bars of the cage, and climb down without a word. Nobody jokes, not even Spoons. Marrow announces the evening as it is every year: "Dusk muster at the cooks' camp in the Orchard. Nobody speaks." Then the swearing-in. Brother Tallow comes down the ladder with a taper cupped in his hands, lit at the cage, and lights the five new wick-lamps one by one while Fennick writes each name in the book. Tallow, to each: "Don't let it go out. I'm too old to climb for you." Fennick issues each wick one marigold smoke-pot "for the parade we're not having", and Skarra Burnbrow, the sapper, will sell anyone a grumbler for two silver they don't have.

**Then the letter.** The notice came by post-rider yesterday; by custom the captain breaks the seal at muster. She reads the total: **0 silver.** Hand round the [[Pay Notice]]. Marrow, before the yard can find its voice: "The coin was supposed to come by wagon behind it. Where is it?" Then, quieter: "Muster at the Orchard is cancelled. Go and be angry somewhere warm."

**Who's here and what they want.**
- [[Ilse Marrow|Captain Marrow]]: keep the company calm and together. "I was made captain by attrition. I was the last one who could count. So I've counted, and we are owed near three years, and I am going to find out where it went." She had been told, privately, that the Concord's Treaty share was coming on the Ashfall wagon. She doesn't say so.
- [[Mirrel Vosk|Sergeant Vosk]]: keep the recruits alive. He sizes up the PCs openly, a little green under the tusks from last night's bottle. "Five new faces. Lovely. I'll learn your names when you've lived a month." When the zero is read: "Don't worry, lads. Nothing's what we were paid last quarter too. At least they're consistent. And nine years to the day since Cinders. Somebody in Caer Ardith has a sense of occasion." The first mutterer who says *pay* too loudly, he calls a mutineer, to his face, by name.

*It is Cinders Muster. Vosk's bottle at the Gibbet and Hennet's reading of the slate were last night; the veterans touch the cage three times on the way down the hill; at dusk the company walks out to the Orchard's cooks' camp in silence and the widows set lamps on the river. The rest is on [[Feasts, Fasts and Holy Days]]. Give each PC [[An Emperor's Penny]] from a veteran, as a kindness, and say nothing about it.*
- [[Garrick Sallow|Lieutenant Sallow]]: plant the idea, gently. "Let's hear the Captain out." Then, loud enough to carry: "Near three years. And still we stand here guarding a candle for people who won't pay for the wick."
- [[Fennick Bottlebrook]]: worried, with his ledger clutched to his chest like a shield. Tells anyone who'll listen there's bread for nine days. (There's flour for eleven at full ration; he says nine because recruits eat.) Asked about the wagon, he blinks: "Tollamund's clerk came by last week asking, very politely, when the pay was due. I thought that was odd. I thought most things were odd."
- [[Brother Tallow]]: old, near-blind Vesh at the foot of the ladder, antennae folded. Takes no notice of the money. Ysse's master: he asks her quietly whether the flame "looks right" to her. (It doesn't, quite. Ysse feels it thin, like a voice going hoarse.)
- [[Gerda Hollin]], corporal of the gatehouse tally, surface dwarf, braids under her helm: she watches Borrin, not the captain.

**Checks.**
- Insight DC 12 on Sallow: he isn't angry. He's *pleased*.
- Insight DC 14 on Marrow: she isn't surprised by the zero. She's been expecting it for a long time.
- Perception DC 13: in plain light Borrin casts no shadow at all. But in the lamplight by the cage, behind him, there is one: faint, late, a heartbeat behind every move. Whether or not a player spots it, Gerda does, and says it aloud: "That one's shadow is walking behind him on its own." She makes the sign of Tharos and will not stand next to him.
- Investigation DC 12 on the notice: genuine seal, dated in Reaping, before the wagon ever left Fallowden. The Regency knew it was sending nothing. Whatever the wagon carried, it wasn't Regency pay.

**How it goes wrong.** If a PC backs Sallow publicly, the yard shouts and two files walk out. Tick the Mutiny clock (it starts at 2 of 6). If a PC backs Marrow well (Persuasion DC 13 or a good speech), the yard settles and Vosk gives that PC a nod they'll remember.

**Ending the scene.** Marrow dismisses the muster and asks the five new hands to "make themselves useful in town and keep their ears open". Vosk adds: "And keep out of the Last Candle." Everyone goes to the Last Candle.

---

### Scene 2: The Last Candle (late morning)
> The Last Candle is a long, low room that smells of wet wool, cheap ale and the pipe-smoke of men who can't afford pipe-weed. Over the bar hangs a dark lantern draped in black, and under it a slate the size of a door, chalked edge to edge with tabs, none of them ever rubbed out. This morning someone has drawn a fresh line across the top of it, nine short strokes, one for each year. On a shelf a stuffed crow in an old sergeant-major's hat faces the door. The woman behind the bar has one arm and uses it to pour, point and keep order, apparently at once. Beside the crow, someone has nailed up a poster.

On the way down the hill the party passes [[The Gatehouse Board]]. The poster in the Candle is [[Wanted: Dannic Rook]]. Let the players read it (and the charcoal comments under it).

**Who's here.**
- [[Mother Hennet]] behind the bar. She calls everyone by their tab total ("Morning, four-and-six"), and the new ones by nothing yet ("Morning, nought. Won't last."). On the slate, one name has a chalk line through it: Dannic Rook's, the only mark of its kind on the whole wall. Asked, she says he paid up on the 5th, and she doesn't keep paid men on her slate. Under the bar is a cup holding the coin he paid with. She'll show it to a PC she likes, or for a good story.
- [[Garrick Sallow]] buys a round for the whole room, with silver. The room cheers. He works the tables: "Someone in Caer Ardith is eating our wages. I say we go and ask for them."
- [[Spoons Aldane]] in the corner with his book. He'll take bets on anything: who gets drunk first, whether Sallow gets a punch in the face by sundown, how long the pay stays missing. His big pool is **the night the lantern goes out**. "Forty to one, any night you like. Some fool's put a fat stack on 'before the red moon's gone'. Won't say who. Book's private, friend."
- [[Halloran Pike]], seventy, bearded, a limp, by the fire, drinking free. He tells new faces the lantern story, wrong in one place on purpose, and watches to see who corrects him: the deserter who carried it up the hill walked into the Rent "three years later" and was never seen again. Hennet, passing with a jug, says "Two," and keeps walking.
- [[Dunstan Bray]], Sallow's corporal: big, ruddy, everybody's friend. "Nobody's saying *mutiny*, lad. We're just saying *hungry*. Out loud. Together."
- Optional: [[Aelith Sorn]], an elf with ink on her cuffs, asking veterans about the battle and paying in coppers. She'll pay real silver for anything the party brings out of the Barrow.
- Tavern regulars: roll on [[Tavern Patrons]] as you like, and on [[Last Candle Rumours]], using only the entries marked safe for session 1.

**Checks.**
- Investigation DC 12 on one of Sallow's coins: new Caer Ardith mint, this year's date. Nobody in the Ashenreach has seen new Regency silver in two years. Hennet's cup holds the same coin.
- Insight DC 13 on Spoons when the lantern pool comes up: he glances at Sallow, then away.
- Anyone who reads the poster carefully: Dannic left on the 7th, "last seen on the Low Quay" on the 12th, poster dated the 13th. Remember that.
- Insight or local knowledge DC 12 on the poster's description: it's wrong. "About thirty, missing an ear-lobe, a Fallowden accent"? Dannic was twenty-four, had both ears, and talked like a Corvel Rise foundling. Only the key-shaped scar is right. Spoons, Quorl or Hennet will say so if asked. Whoever wrote it never saw him alive.

**What can happen.** A fight is close all scene. Bray picks on the nearest recruit: "Fresh meat. Bet you'd sell the candle for a hot meal." If it comes to fists, run a brawl: unarmed, three rounds at most, and anyone dropped to 0 is knocked flat and wakes in a minute with a black eye. Bray (AC 11 in his shirt, HP 32, two punches +4, 1d4+2) enjoys it. Sallow watches and does nothing. In round two Hennet comes round the bar and cracks the nearest head with a soup ladle (+2, 1d4). One arm is plenty. In round three Vosk walks in and ends it with one sentence.

**Short on time?** This scene can run in fifteen minutes: the round, the poster, Bray's shove, the bell.

**Ending the scene.** It's coming up on noon. Go straight into scene 3: it opens with the bell.

---

### Scene 3: The drowned man (the Ford, noon)
> Down at the Ford the bell-ward's mallet strikes three, then three again: someone in the water. Every soldier in the Candle knows the stroke.
>
> By the time you reach the shingle under the bridge, the ford-watch have him out: hooked from the shallows under the third pier by his coat. They are standing back from him in a ragged half-circle. One of them is being sick into the reeds. On the bell-house stair a boy of twelve is still holding the mallet in both hands. On the grey stones lies a man in a company coat, swollen and pale, an eel still caught in his collar. His eyes are open. As you arrive, his fingers start to move in the ash, slowly, like someone feeling for a dropped coin in the dark.
>
> Then he sits up. Behind him, two more shapes rise out of the river.

This is [[Dannic Rook]]: drowned under the third pier on the night of 7 Ashfall, never buried, hooked out of the ford at noon on 14 Ashfall. The two behind him are nameless dead of the Seventh from the Barrow's flooded street, half-made. Run **The drowned walk** (see Encounters). They walk toward the Keep, not toward the living, and fight only what gets in their way. Dannic is heading home.

[[Gerda Hollin]] and the ford-watch are here. Gerda takes one of the half-made on her shield at the water's edge and holds it there; the party has Dannic and the other. The first time Dannic gets up off the ground, Gerda bellows: "Your lamps, wicks! Put the flame to him!" [[Dunny Pike]], the bell-ward, watches from the stair and will remember every blow.

**Checks.**
- Religion DC 12 (or Quorl automatically): the dead haven't passed through Hathe's door. Since Hathe died this happens, but rarely so fast and never three together. Something nearby is "letting the cold in".
- Medicine DC 11 on the body afterwards: drowned about a week ago. Bruises on both shoulders: someone held him under.
- Perception DC 12: his boots and coat are full of fine glass grit, the kind that only comes from the glasslands, or from under the ford.

**Last words.** When Dannic falls for the last time, he speaks. If Quorl is near, it's to him. Otherwise it's to whoever kneels by him.
> His jaw works, grinding grit. His voice comes up from somewhere much further down than his lungs. "It's cold," he says. "It's cold under the glass." Then he's only a dead man, and the river is only a river.

[[Quorl Many-Words]] records the words, as he records all last words. Tick's mother, [[Marla Marlowe]], is standing in the river beside the body, up to her knees, pointing at the old stone culvert in the foot of the third pier. Only Tick sees her.

**After the fight: the rite.** Dannic was never buried, and Hathe's door is shut. Quorl can lay him down properly: Religion DC 12, or anyone who kneels, says his name and the Ravelers' rhyme (*"Your name is said. Your words are kept. The door is there. Go through."*). If it's done, Dannic stays down until Hathe's door is opened for him (the Door-Key, session 5). If it's skipped or fails, the ground will not keep him, and he rises again at the full Ember in session 3, at the oil store.

Either way, [[Skrell Already-Gone]] arrives at a flat sprint with his handcart. He has a joke ready, sees the key-shaped scar on Dannic's hand, and for once has no joke at all. He brings word from [[Mother Corvane]], who has not come down from the Rise in a year and does not intend to start: "She says thank you ever so much for the extra work, she wants him on the Chapel slab by dusk, and to tell the Many-Words he could at least have *asked* before he did her job for her."

**How it goes wrong.** If the party flees or is beaten, the drowned walk up the hill and the company cuts them down in the drill yard. Dannic's last words are lost: let Quorl hear them in a dream that night instead. The trail is not: the ford-watch saw which pier he came from.

---

### Scene 4: The trail (the Ford and the Low Quay, afternoon)
**Following him back.**
- Survival DC 11: the current under the ford pulls into the culvert at the foot of the third pier, an old imperial drain half-choked with glass. A body could go in. A body could come out again.
- [[Kettle Brindlewake]], on [[The Low Quay|the Low Quay]], knows exactly where the culvert goes. "Into the Barrow. The old town under the ford, the bit the fire turned to glass. Smugglers used it till the dead started sitting up in there." She'll guide the party to the drain mouth at the third pier for nothing, and tells them the way out: the smugglers' cut, which comes up under her own quay. While she does, she offers them [[Kettle's Cargo]]: a night job, "the first night the Lieutenant's patrol is looking the other way".
- Kettle on the poster: "The 12th? I was on the Quay all day the 12th. No Dannic. And I'd know. He owed me money." On the night of the 7th: "There was a clerk on the bridge that night. Ink on his cuffs, scarf up to his nose. Not one of ours." On the wagon, if anyone asks: "Turned off by the mill. Ask me tomorrow, I'm busy."
- Witnesses to Borrin's double, if the party asks about him in town: [[Nan Crupp]] at the ferry landing ("Saw you walking on the ford at midnight, a week back. Wasn't you, was it."); Jory Dunmore, who saw "Borrin" on the wall above the Smokes on a night his bunk was empty; Noume Flarewick, who saw a dwarf-shaped shadow standing by the cage at three in the morning.

**Optional: the Keep.** If the party goes to the Keep first, Brother Tallow is uneasy: "Dannic took two tins of oil when he ran. Find them. Please. I'd like to know what he wanted with them." Fennick, asked about oil, gets shifty: his ledger shows twelve casks bought and twelve burned this quarter, which is about four too many (Investigation DC 13: the numbers are fiddled). He isn't the poisoner, but he looks guilty as sin. (GM: the Keep burns oil in its hall and its lamps too, not just the cage; eight casks were really burned. Fennick sold four to Kettle for bread.)

**Optional: Hesk's Chandlery** (the Smokes, open dusk to midnight; best after the Barrow, if the moth seal sends them). Mirrit, the Hollowborn apprentice, has the counter; Hesk coughs in the back and comes out to argue about oil. With trust, or Persuasion DC 13, the order-book: two sealed Keel tins at full price in the last fortnight, one to Dannic Rook on credit, unpaid, and one to "the Assessor's Office, paid in advance", by a clerk with a cold.

**Short on time?** Scene 4 is optional if the players go straight for the culvert: Kettle can shout the useful parts down to them from the Quay as they wade in.

**Before the Barrow.** The culvert is only passable at low water, which comes at dusk. The party gets a short rest on the Quay stair while the water drops. Kettle's cousins sell them hot chestnuts on credit.

---

### Scene 5: Into the Glass Barrow (dusk)
> The culvert is waist-deep and black and colder than it should be. Twenty paces in, the brick walls turn to glass: a whole street fused by the fire of Cinders, the doorways still open, the shutters melted into curtains of grey and green. Your little lamps go into the walls and come back wrong, a hundred small copies of you moving a beat behind. Somewhere ahead, glass ticks as if something is walking on it.

See [[The Glass Barrow]] for the rooms. Keep it to four tonight:
- **The flooded street.** Knee-deep on the low side. Dannic's belt-pouch lies on the dry side, empty but for a single new Regency silver. On the right, under the water, a brick arch with a rope through it: the Quay cut, the way out.
- **The glass chapel.** Forty villagers fused to the pews, heads bowed. Quorl can take their last words (Religion DC 12, or a short rite): they all whisper the same thing, and it is the sentence seven dying soldiers have whispered to him over nine years. Let his player hear it and not yet understand. At the chapel door, scratched in the glass: *D.R. 3 Ashfall. Back for the rest.*
- **The collapsed bakery.** Run **Glass-spiders** (see Encounters) here and only here: two of them, nested in the ovens, webs of glass thread that ring like bells when touched. A group Stealth check (DC 12) gets the party past the door without waking them. Perception DC 13 spots the webs before someone walks into one (restrained, Strength DC 11 to break).
- **The cold stair.** Behind the chapel altar, older than the chapel by a thousand years. Over its first arch, a Lithic lintel: *WHAT WE BURIED IS NOT AT REST* (Ysse Arcana DC 13, Borrin DC 10). Halfway down, a landing with Dannic's gear: a bedroll, an empty dark-lantern, a Glasser's pick, and seven rinsed empty Keel tins, seals broken. Whatever he was doing, he was doing it with oil, and keeping the empties.

**Checks.**
- Arcana DC 14 (Ysse has advantage): the glass is thin here, and something cold is breathing through it. Every spell cast in the Barrow makes frost bloom on the walls. Tell the players that, and let them worry. (Don't tell them the Cold Captain drinks it.)
- Borrin, in the glass reflections, sees a shadow behind him that he does not cast. It is looking at the stair.

---

### Scene 6: The Cold Room (the Cold Captain)
> At the bottom of the stair is a round room of black glass, and it is cold enough that your breath hangs in front of you and doesn't fall. Frost feathers the walls. In the middle, on a plain stone chair, sits a soldier in a captain's coat that has fused to his body, a lantern-pole without a lantern across his knees. On his breast, cast in the glass, is a company badge, and the lantern on it is dark. His eyes are open and white with frost.
>
> Around his chair, in a careful ring, as if he had arranged them: a bundle in a grey company blanket, and three tins.

This is the Cold Captain of the Seventh, the Ruddy Hundred, whose lantern went dark at Cinders; he is still holding his post. He is a puzzle first and a fight only if the party makes him one (see Encounters).

**How it plays.**
- He does not move until something is lifted from the ring. Then he stands and says the one thing he says on rising: "Held. We held. Is it morning?" He fights only to put it back. Set it down and step out of the ring, and he stops.
- Hold up a lit wick-lamp (or a soldier's token), and he stops for a round and looks. "Which lantern is lit?" Answer "the Ninth", truthfully, and he sits down, sets the pole across his knees, and does not rise again for this party. They can take what they like.
- Lantern flame makes him recoil: disadvantage on his attacks against anyone holding a lit wick-lamp. He is vulnerable to fire. Every spell cast down here after the first feeds him (+5 hp, max +10).
- Destroyed, he comes apart into ash and frost. On him: the Seventh's badge (Mother Hennet will want it) and, in his coat, a note folded and refolded in a woman's hand: *come home*.

**The find.**
- **A grey company blanket bundle**, holding a purse of twelve new Caer Ardith silver (the same mint as Sallow's round and Hennet's cup); a scrap of paper in Dannic's scrawl, *"S. says one more swap and Im square. Then the clerk wants a word. Dont like the clerk."* ([[Dannic's Note]]); and a pay-chit of the Ninth Lantern for 3009, stamped PAID IN FULL under a Regency seal nobody in the company has ever seen. (Pell will know it, in session 2 or later: it is Marius Vell's private seal.)
- **Three tins.** One is clean lantern oil. One is [[The Cut Oil Tin]]: a dented Keel tin, Keel bell on the base, grey-wax moth seal, grey slurry that smells of lake water. The third is empty and still smells of it. Dannic was taking good oil out and putting cut oil in.
- How it got here, for the GM: he cached it on 3 Ashfall, with Skelt on the rope; the tins he carried out on the 7th came down with his body.

When anyone lifts the cut tin, everyone's breath stops smoking for a moment, as if the room has warmed. Then it's cold again.

**Clues on the tin.**
- Investigation DC 12: the moth pressed in the grey wax is a Smokes chandler's seal. Any local will tell you whose: Hesk's.
- Nature or Survival DC 13, in good light: the ash is fine and pale and smells of lake water. Locals know only the ash at [[Stillwater]] smells like that.

**Getting out.** Back up the stair and the street; the culvert if the water is still low, the Quay cut if it isn't. The cut is fifty yards, and the last fifty feet are flooded: hoods shut, DC 10 Athletics to swim it in the dark, and a wick-lamp that goes under goes out. They surface under the Low Quay at the floating market's stair, in front of whoever is there at that hour.

**How it goes wrong.** If the Captain is too much, the party only has to set things down and step back. He doesn't pursue past the ring. They can come back, with a lamp held high and a better answer.

---

### Scene 7: The lantern gutters (Lantern Hill, towards midnight)
The party climbs back up through the town. It is Cinders night, and there is a lamp in every window for the dead. The Ember, nearly full, sits red and swollen over the Ashenreach. Then:
> Halfway up Lantern Hill, the light changes. It takes you a moment to understand why. It's the lantern. Up in its iron cage, the flame that has burned without a flicker for nine years is shrinking: yellow, then white, then a bead of blue no bigger than a fingernail. At your belts, five little tin lamps shrink with it.
>
> All over the hill, doors are opening. Soldiers in their shirts, barefoot in the ash, are coming out to look. Nobody says anything. On the ladder under the niche, Brother Tallow has both hands on the bars of the cage, as if he could hold it up by himself.
>
> For the length of one long breath, the flame is gone. Every lamp on the hill goes with it.
>
> Then it comes back.

Give the players the moment. Then let the NPCs react:
- Spoons is seen very slowly closing his book.
- Sallow says, to no one, "Next time."
- Marrow finds the party: "What did you find down there?"
- Tallow, holding the cut tin, his antennae flat: "Someone has been feeding my flame ash." Hand them [[Who Is Poisoning the Flame?]].

Tick the Mutiny clock to 3. End the session on the image of a hundred and forty soldiers standing in the ash in their shirts, each with a small blue light at the belt, looking up.

**End of session: level 2. Mutiny clock 3 of 6.**

---

### If the party wanders
Optional, a few minutes each. Use [[Street Events in Cinderford]] for any walk through town; on 14 Ashfall the bill, the window and the whistle are the best rolls.
- **Ford Street, on the way to the Candle.** [[Ada Pennock]] at [[The Baker's Wife]] puts bread in front of the first soldier, Raveler or hungry face and asks whether anyone is "going down the culvert": [[The Baker's Hoard]]. The ring is in the Collapsed Bakery (Barrow area 3) and Tom is in the Glass Chapel's fourth pew (area 4), so the Barrow pays it off. Her thanks comes with the morning's bread on the 15th.
- **The Hock.** Bushel goes quiet about Dannic's token, then gives the ticket: pawned by Dannic himself on the 6th for 3 cp, redeemed on the 9th, two days after he drowned, by a man with a cold, a scarf and good spectacles, who counted his change in coppers. See [[The Hock]].
- **Cinders night.** A dip burns in every window from the Ford to the Smokes, and up on the Rise the Ravelers read this year's last words aloud; townsfolk climb up to listen for a name. At the Candle the Corporal's Song goes round, badly, and old Pike knows the three verses that were cut and will not sing them ([[Songs of the March]]).
- **Bellwether, after dark.** If they cross the bridge, the bells on every door at [[Bellwether]] ring once as they pass, and nobody opens.
- **The cold weir.** Kettle mentions over tea that the river ran cold at the Sedgemere weir on the 8th and again on the 13th, with glass in it and nobody in it. Her friend nine miles down wrote it on a slate. See [[Keld Owes-Nothing]] and [[Sedgemere]].

### If you're running this as a one-shot
> **One-shot ending.** Skip the guttering as a cliffhanger. Instead, when the party returns with the tin, Sallow is in the oil-room under the cage with two cronies and a tin of cut oil, about to pour it into the oil-port. Spoons, who has worked out that "the lantern goes out" means the company ends and so does his book, shouts a warning. Run a short, sharp fight on the oil-room ladder (Sallow as a veteran, scaled for level 1: AC 15, HP 30; two cronies as bandits, AC 12, HP 11). If the party stops him, the flame gutters and recovers, Marrow arrests Sallow, and as they drag him off he laughs: "You think I'm the one paying for this?" Somewhere below, a clerk in a scarf closes a window. End there.

### Loose ends to carry into session 2
The wagon that should have come behind the notice, and turned off "by the mill". Sallow's new silver, and the same coin in Hennet's cup. The pay-chit with a seal nobody knows. The moth in the grey wax, and Hesk's order-book. The clerk Dannic didn't like. Spoons's pool. Fennick's fiddled ledger. The cold under the glass. Session 2 starts at dawn, with the Assessor at the gate.

== Strong start ==

The handbell on Lantern Hill clanks for muster, dented and tinny, the way it has every morning for nine years. Ash is coming down soft as the first snow of winter, settling on helmets and shoulders and on the iron cage high in its niche on the Keep's east wall, where a small flame burns behind the bars without a flicker.

A hundred and forty soldiers stand in the drill yard in four ragged files. Their boots have been mended with tent canvas. Their breath smokes. Somewhere at the back, a corporal is taking bets.

Captain Ilse Marrow walks out of the Keep with a letter in her hand. It has a Regency seal on it. She breaks it in front of everyone, reads it once, and then, very carefully, reads it again.

"Well," she says. "Good news. We've been paid."

== Scenes ==

- Cinders morning on Lantern Hill: the veterans touch the cage; Tallow lights the five wicks' lamps; Marrow reads the pay notice. 0 silver, and no wagon. The Orchard muster is cancelled.
- The Last Candle: Hennet's slate with Dannic crossed off; Sallow buys a round with new silver; Spoons's pool on the lantern; the wrong poster; Bray starts a brawl and Hennet ends it with a ladle.
- Noon at the Ford: the mallet strikes three and three; Dannic Rook and two half-made dead climb out of the river. Fight: the drowned walk, with Gerda Hollin.
- Last words ("It's cold under the glass"), Quorl's rite, Skrell and Corvane's message, and Marla pointing at the culvert.
- The trail: Kettle on the Low Quay (the clerk in the scarf, the wagon "turned off by the mill"), the Keep's oil ledger, Hesk's order-book.
- Into the Glass Barrow at dusk: the flooded street, the fused chapel, the spiders in the bakery, the cold stair.
- The Cold Room: the Cold Captain of the Seventh, "Which lantern is lit?", Dannic's stash and the Cut Oil Tin.
- Back up Lantern Hill towards midnight: the lantern gutters for the first time in nine years, and every wick-lamp with it. Tallow: "Someone has been feeding my flame ash."

== Clues ==

- The pay notice was dated in Reaping, before the wagon left Fallowden: whatever the wagon carried, it wasn't Regency pay.
- Marrow expected coin "by wagon behind" the notice. Kettle says the wagon "turned off by the mill".
- Tollamund's clerk asked Fennick, very politely, when the pay was due.
- Sallow's silver is new Caer Ardith mint, this year's date. Dannic paid his Candle tab with the same coin on the 5th, and Hennet kept it.
- Someone has a fat stack with Spoons on the lantern going out "before the red moon's gone". Spoons glances at Sallow.
- The wanted poster claims Dannic was seen on the 12th; he drowned on the night of the 7th. Its description is wrong in three places: whoever wrote it never saw him alive. It is signed A.M.
- Kettle saw a clerk with ink-stained cuffs and a scarf on the bridge the night Dannic ran.
- Bruises on Dannic's shoulders: someone held him under.
- Dannic's last words: "It's cold under the glass."
- Dannic's note: "S. says one more swap and Im square. Then the clerk wants a word. Dont like the clerk."
- A 3009 pay-chit stamped PAID IN FULL under a Regency seal nobody in the company knows.
- The cut tin's grey-wax moth is Hesk's seal. Hesk's order-book: a tin to "the Assessor's Office, paid in advance", by a clerk with a cold.
- The ash in the cut oil smells of lake water: Stillwater ash.
- Fennick's oil ledger is fiddled (four casks too many burned). He looks guilty; he isn't the poisoner.
- Spells cast under the glass make frost bloom on the walls. Something cold breathes through the Barrow.

== Lectern ==

The handbell on Lantern Hill clanks for muster, dented and tinny, the way it has every morning for nine years. Ash is coming down soft as the first snow of winter, settling on helmets and shoulders and on the iron cage high in its niche on the Keep's east wall, where a small flame burns behind the bars without a flicker.

A hundred and forty soldiers stand in the drill yard in four ragged files. Their boots have been mended with tent canvas. Their breath smokes. Somewhere at the back, a corporal is taking bets.

Captain Ilse Marrow walks out of the Keep with a letter in her hand. It has a Regency seal on it. She breaks it in front of everyone, reads it once, and then, very carefully, reads it again.

"Well," she says. "Good news. We've been paid."
