---
number: 1
title: Payday
worldDate: 14 Ashfall 3011
pages: [ q-lantern-gutters, q-payday, q-drowned-man, q-poisoned-flame, q-kettles-cargo, h-pay-notice, h-wanted, ilse-marrow, mirrel-vosk, brother-tallow, fennick, garrick-sallow, spoons, kettle, dannic-rook, marla-marlowe, varra, ysse, borrin, tick, quorl, lantern-hill, lantern-keep, last-candle, the-ford, low-quay, glass-barrow, item-lantern, item-oil-tin, f-ninth-lantern ]
encounters:
  - name: The drowned walk
    notes: "Ash-drowned (zombie, reskinned): grey, bloated, coughing ash. Slam +3, 1d6+1 bludgeoning. Undead Fortitude: dropped to 0 by anything but radiant or a critical hit, Con save DC 5 + damage taken to drop to 1 HP instead. Speed 20. They walk toward the Keep and fight only what blocks them. Dannic is the first to rise and the last to fall; when he does, he speaks."
    foes:
      - { name: Dannic Rook (ash-drowned), count: 1, hp: 22, ac: "8", side: foe, page: dannic-rook }
      - { name: Ash-drowned, count: 2, hp: 22, ac: "8", side: foe }
  - name: Glass-spiders
    notes: "Giant spider, scaled for level 1: glassy, fist-sized eyes, legs that chime. Bite +4, 1d6+2 piercing plus 1d6 poison (Con DC 11 for half). Web (recharge 5-6): +4 ranged, target restrained by ringing glass thread (Strength DC 11 or 10 damage to break). Spider Climb; Web Sense. Use 2 for a quick fight, 3 if the party is rested."
    foes:
      - { name: Glass-spider, count: 3, hp: 13, ac: "13", side: foe }
  - name: The guardian in the dark
    notes: "Ash-wight (wight, scaled down): a lantern-captain of Cinders fused into his armour. Multiattack: two longsword attacks +4, 1d8+2 slashing; or one longsword and Life Drain +4, 1d6+2 necrotic (Con DC 13 or max HP reduced by the damage until a long rest). Resists necrotic, and nonmagical weapons, UNLESS the weapon is lit with the company's lantern oil or flame from the Lantern: then no resistances and he takes +1d6 fire. Flinches from the party's light (a hint). Does not pursue beyond the cold stair."
    foes:
      - { name: The guardian in the dark (ash-wight), count: 1, hp: 30, ac: "14", side: foe }
lectern:
  scene: lantern-hill
  present: [ ilse-marrow, mirrel-vosk, fennick, garrick-sallow, brother-tallow ]
---

## Session 1: Payday
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
The pay wagon (session 2 starts with the Assessor at the gate). Sallow's silver. The clerk Dannic didn't like. Spoons' pool. Fennick's fiddled ledger. The cold under the glass.

== Strong start ==

The bell on Lantern Hill rings once for muster, flat and cracked, the way it has every morning for nine years. Ash is coming down soft as the first snow of winter, settling on helmets and shoulders and the iron cage at the top of the hill, where a small flame burns behind the bars without a flicker.

A hundred and forty soldiers stand in the drill yard in four ragged files. Their boots have been mended with tent canvas. Their breath smokes. Somewhere at the back, a corporal is taking bets.

Captain Ilse Marrow walks out of the Keep with a letter in her hand. It has a Regency seal on it. She breaks it in front of everyone, reads it once, and then, very carefully, reads it again.

"Well," she says. "Good news. We've been paid."

== Scenes ==

- The muster on Lantern Hill: Captain Marrow reads the pay notice. 0 silver. Sallow stirs; Vosk jokes; Tallow asks Ysse if the flame looks right.
- The Last Candle: Sallow buys a round with new silver; Spoons runs a pool on the lantern going out; the wanted poster; a brawl brews.
- The Treaty Bell rings: Dannic Rook climbs out of the ford with two other dead. Fight: the drowned walk.
- Last words ("It's cold under the glass"), Marla points at the culvert, Kettle guides them to the drain and offers her cargo job.
- Into the Glass Barrow: the flooded street, the fused chapel, glass webs. Fight: glass-spiders.
- The cold room: the guardian in the dark, Dannic's stash, the cut oil tin, the new silver, the note about S. and the clerk.
- Back up Lantern Hill at night: the lantern gutters for the first time in nine years. Tallow: "Someone has been feeding my flame ash."

== Clues ==

- The pay notice was dispatched three weeks before the wagon left: the wagon wasn't carrying Regency coin.
- Sallow's silver is new Caer Ardith mint, this year's date. Nobody else has seen new Regency coin in two years.
- Someone has a big bet with Spoons on the lantern going out "before the red moon's gone". Spoons glances at Sallow.
- The wanted poster claims Dannic was seen on the 12th. He drowned around the 7th. Someone made up the sighting. It is signed A.M.
- Bruises on Dannic's shoulders: someone held him under.
- Dannic's last words: "It's cold under the glass."
- Dannic's note: "S. says one more swap and Im square. Then the clerk wants a word. Dont like the clerk."
- The ash in the cut oil smells of lake water: Stillwater ash.
- Fennick's oil ledger is fiddled (four casks too many burned). He looks guilty; he isn't the poisoner.
- Spells cast under the glass make frost bloom on the walls. Something cold breathes through the Barrow.

== Lectern ==

The bell on Lantern Hill rings once for muster, flat and cracked, the way it has every morning for nine years. Ash is coming down soft as the first snow of winter, settling on helmets and shoulders and the iron cage at the top of the hill, where a small flame burns behind the bars without a flicker.

A hundred and forty soldiers stand in the drill yard in four ragged files. Their boots have been mended with tent canvas. Their breath smokes. Somewhere at the back, a corporal is taking bets.

Captain Ilse Marrow walks out of the Keep with a letter in her hand. It has a Regency seal on it. She breaks it in front of everyone, reads it once, and then, very carefully, reads it again.

"Well," she says. "Good news. We've been paid."
