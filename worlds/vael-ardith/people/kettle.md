---
type: npc
name: Kettle Brindlewake
players: true
summary: Halfling barge-captain, smuggler and the best-informed gossip on the river Cinder; sells to everyone, and likes the PCs best.
parent: low-quay
tags: [ npc, barge-clans, halfling ]
image: sil:kettle
status: alive
statusKnown: true
fields:
  Ancestry: Halfling
  Role: Barge-captain, smuggler
  Faction: The Barge Clans
  Where: The Low Quay, aboard the Grey Dumpling
gmFields:
  5e: "Bandit captain, reskinned: AC 15 (leather, Dex), HP 40, hand crossbow and boathook. Halfling Lucky. The Grey Dumpling carries a crew of 6 bandits and a hidden hold (DC 18 to find)."
relations:
  - to: f-barge-clans
    kind: serves
    known: true
  - to: vexa-glassjaw
    kind: smuggles for
    known: true
  - to: ansel-mote
    kind: carries letters for
    note: Reads them first.
  - to: fennick
    kind: bought oil from
    note: Four casks of the good stuff.
  - to: npc-jeb-marrowick
    kind: trades with
    note: Other cousins of hers take salt and iron to Ambercote twice a month and bring back cheese and slag.
    known: true
  - to: npc-cass-marrowick
    kind: carries letters for
    note: Sealed with cheese-wax.
    known: true
  - to: npc-posy-reedmarsh
    kind: answers to
    note: Her Mother of the Water on this river, who has predicted a bad end for her for thirty years.
    known: true
  - to: npc-wendel-hoop
    kind: buys casks from
    known: true
  - to: npc-thimble-fairlock
    kind: answers to
    note: '"That one will hang." Kettle has heard it since she was nine.'
    known: true
  - to: npc-fallon-wrass
    kind: owes a true thing to
    note: He told her "down to the last candle". She tipped him one about Keel.
  - to: npc-kettle-cousins
    kind: is cousin to
    note: Dob and Marigold, on her mother's side. They pole; she talks.
    known: true
  - to: npc-nance-oddy
    kind: carries letters for
    note: Through her people, who pass the mill with salt for the south.
    known: true
---

### Look and voice
Tiny, round, sun-browned and freckled, sixty years old and moving like twenty, with grey curls stuffed under a stolen Regency officer's hat and a pipe that never leaves her teeth and is never lit. Bare feet, tough as boot-leather. A long coat with pockets inside the pockets. She stands on a crate to look people in the eye and conducts conversations with the stem of her pipe.

Her talk comes at a run and mostly in questions, and every one of them ends in "love".

> "Gossip's like river water, love. Free to drink, and it'll kill you if you don't boil it."

> "I don't take sides. I take cargo. Sides is just cargo that argues."

### Who she is
Kettle Brindlewake is captain of the barge *Grey Dumpling*, the busiest vessel on the river Cinder, and Barge-Mother of a clan of [[Halflings|halfling]] bargefolk (her cousins [[Dob and Marigold]] pole the barge and say little) who carry grain, letters, salt fish, passengers and anything else that fits in a hold between [[Cinderford]] and the Ardis. Some of what fits in the hold is legal. She runs the floating market on [[The Low Quay]] and is cousin, twice removed, to [[Fennick Bottlebrook]], whom she considers the family disappointment for going straight. On the Cinder she answers to [[Barge-Mother Posy Reedmarsh]] at Sedgemere; on the Ardis to [[Barge-Mother Thimble Fairlock]], who trained her on her own deck and has said since Kettle was nine that she will hang.

### What she wants
Profit. Gossip. A fine dinner. For the river to keep running and nobody important to notice her. Mostly gossip.

### What she knows
Everything that comes down the river and much that goes up it. Who's buying Glasser salvage. Which Regency letters have come for the Assessor's clerk. That [[Dannic Rook]] owed her money. She has a good deal to say about the pay wagon and about Dannic Rook, and will tell you for a price. Her sources are Nan Crupp at the ferry, [[Thistle Weirford]] with her drum and her sticky fingers, and her own two eyes. She sells to every faction in the March. She tells the PCs first, and cheaper. Other cousins of hers are the only people in Cinderford who go to [[Ambercote]], and she knows what stands in its square.

### How she treats the PCs
She likes them best. She liked [[Varra Nine-Knuckles]] the moment Varra stepped onto her barge and asked if she needed a hand with the ropes. She treats the party like favourite nieces and nephews: feeds them, scolds them, overcharges them slightly less than everyone else, and expects visits.

:::gm
**Secret.** Kettle sells to everyone: Quiet Office, Concord, Church, Glassers and the Sleepless. She carries [[Ansel Mote]]'s letters to [[Caer Ardith]] and reads every one first (steam, a hot knife). She knows Mote is not a clerk. She hasn't told anyone, because the price isn't right yet and because she is, very sensibly, afraid of him.

She knows the pay wagon's escort turned back two days out, and that somebody paid them to. She knows Dannic Rook was nowhere on the Quay on the 12th, whatever the poster says.

Last month she bought four casks of the company's good lantern oil from her cousin [[Fennick Bottlebrook]], who needed bread money. She has not sold them yet; they are aboard the *Grey Dumpling*. She smuggles [[Vexa Glassjaw]]'s salvage downriver, including relics that should stay buried. In the false floor of her hold (DC 18) sits a warm thirteenth crate that hums at night: [[The Glass-Fused Hand]], Ketterin's own, bound for [[Aelith Sorn]]. She also carries a sealed vial from the Kneeling Stone, addressed to "the Warden, Ninth Stone".

She fished the lost pay order out of the post-stair box in Thawmere 3009, read it, kept it as insurance, and gave it to [[Barge-Mother Posy Reedmarsh]] on the day Mote arrived (see [[The Lost Pay Order]]). When pressed she blames Regent the cat.

She likes the PCs best because they're the only people in the March who've never tried to buy her.
:::

== GM notes ==

**Voice:** fast, warm, nosy; "love"; points with her pipe. She's your rumour engine: when the players are stuck, Kettle knows somebody.

**Across the arc:**
1. Saw the drowned man go in. Didn't see who with. Saw a clerk's ink-stained cuffs on the bridge.
2. Knows the pay wagon's route and that its escort turned back, paid. Points the PCs to [[Fort Mercy]].
3. Hides children from the dreamers on the Grey Dumpling. One of [[Cass Marrowick]]'s letters, sealed with cheese-wax, reaches the Keep through her on the night of 16 Ashfall.
4–5. Sells the PCs a copy of one of Mote's letters (or gives it free, if they've earned it): "Report on the lamp. Progress satisfactory."
6. Ferries the expedition upriver toward the Rent.
7. Can get anyone out of town by water. Or bring anyone in. If Mote escapes, she sees the post-cart that takes [[Tesh]] east, and tells the party. Her favour to a friend of the party: one free passage by water in session 7 or 8.
8. Whatever happens, she's on the quay afterwards, selling hot chestnuts and the story.
