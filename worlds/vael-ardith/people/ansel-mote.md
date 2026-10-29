---
type: npc
name: Ansel Mote
players: true
summary: The Assessor's mousy, apologetic clerk, sent ahead to open the office; nobody looks at him twice.
parent: assessors-office
tags: [ npc, regency, clerk ]
gmTags: [ quiet-office, villain ]
image: sil:ansel-mote
status: alive
statusKnown: true
fields:
  Ancestry: Human
  Role: Clerk to the Assessor
  Faction: The Regency Council (Assessor's Office)
  Where: The Assessor's Office
gmFields:
  True role: Quiet Office assassin and paymaster
  5e: "Spy, upgraded: AC 14, HP 45, two shortsword attacks; Sneak Attack 3d6; Assassinate (advantage on creatures that haven't acted, crits on surprised targets); poison needle (DC 13 CON, 3d6 poison and poisoned for 1 hour). CR 3."
relations:
  - to: marius-vell
    kind: serves
    note: Takes his orders from the Regent-Chancellor's own office.
  - to: f-quiet-office
    kind: serves
  - to: garrick-sallow
    kind: pays
    note: For a mutiny.
  - to: dannic-rook
    kind: killed
    note: Drowned him under the third pier.
  - to: pell-quillon
    kind: hides behind
    known: false
---

### Look and voice
Small, pale and forgettable: thinning mouse-brown hair, a long nose that is always slightly pink, spectacles he pushes up with one ink-stained finger. He wears a clerk's grey coat and a scarf even indoors. He sniffles. He carries a ledger against his chest like a shield.

Everything about him is pitched to be overlooked: the apology comes first, the sniffle second, and he agrees with you before you have finished disagreeing.

> "Sorry. Sorry. Was I in the way? I'm always in the way. Please, carry on."

> "Oh, I wouldn't know anything about that. I just copy things out."

### Who he is
Ansel Mote is the clerk of [[Pell Quillon]], the Assessor, and arrived in [[Cinderford]] on 16 Reaping, a month ahead of him, with nine crates and a tenth of his own, to "set the office in order" at [[The Assessor's Office]] and reopen it with [[Hester Pruitt|Widow Pruitt]]. He has put it in a very good order. On his first evening in town he took tea in the parlour of [[The Velvet Ledger]] and asked nothing; on his second he bought a round at [[The Last Candle]] and asked nothing; he tipped well both times. He lodges above Gannet's Tallow & Wicks on [[Temple Row]], pays his rent early, attends no temple, and is in bed by nine. People forget he's in the room. He is very good at being forgotten.

### What he wants
Nobody knows. If asked, he wants a quiet life and a good pension.

### What he knows
He says he knows nothing. He has read every file in the Assessor's Office and copied the interesting ones.

### How he treats the PCs
Mildly, helpfully, invisibly. He is the clerk who finds the form they need. He remembers their names, and their friends' names, and where they sleep.

:::gm
**The truth.** Ansel Mote is an agent of [[The Quiet Office]], the Regency's spies and assassins, sent by [[Marius Vell]]'s own office to bring the Ninth Lantern's flame under Regency control. His orders: break the company, put a pliant captain in charge, and have the lantern "escorted to the capital for safekeeping". Vell knows what the flame is. Mote does not, quite; he knows only that his master wants it badly and wants it alive.

- He pays [[Garrick Sallow]] in new Regency silver, struck at the Caer Ardith mint, to brew the mutiny.
- He buys sealed Keel oil tins at [[Hesk's Chandlery]] through "a clerk with a cold", cuts them with lake-ash from [[Stillwater]], given gladly by [[The Dreaming Widow]], and reseals them with Hesk's own grey wax. The ash chokes the flame without killing it. Sallow paid [[Dannic Rook]] to swap the tins in the lantern store.
- On the night of 7 Ashfall, when Rook tried to back out and ran with a clean tin and a cut one, Mote caught him at [[The Ford]] and held him under the third pier. The body wouldn't stay down. Nan Crupp saw a scarfed man and a splash from her hut door.
- He wrote the wanted poster himself ([[Wanted: Dannic Rook]], dated the 13th, signed "A.M."), with an invented sighting on the 12th, so the company would hunt a living deserter and nobody would look for a body. He had it set at Ottun Fray's on Temple Row; Pruitt paid the printer. He never saw Rook alive, which is why the description is guesswork: wrong age, wrong ear, wrong accent.
- He keeps a black second ledger, which [[Nib]] has seen, with the payments to Sallow and the key to his cipher. His cipher is on the back of Form 9-K; a fifth line mentions "the girl at the Ledger" ([[Tesh]]).
- Sallow holds a Quiet Office copy of the second cage key; Mote holds a copy of the third. Neither fits the first lock, so even together they cannot open the cage without the lamp-keeper's key. Sallow does not know Mote drowned Rook.
- He keeps a Quiet Office file on the orc Mothers' lineages. If he learns who [[Varra Nine-Knuckles]]'s grandmother is, he will move on her.

He is patient, methodical and completely without malice. He likes Pell, genuinely, and will kill him if ordered.
:::

== GM notes ==

**Voice:** soft, sniffly, apologetic; agrees with everyone; never finishes an accusation. Put him in scenes early as furniture so the players forget him.

**Across the arc:**
1. Barely seen. But he wrote the wanted poster (signed "A.M."), and the scrap of paper in Dannic's pocket says "Then the clerk wants a word. Dont like the clerk." Let the players forget it.
2. Arrives "properly" with Pell; helps everyone.
3. On the red moon night, he is the only person in the Assessor's Office who isn't afraid.
4–5. If the PCs get close, Bray or a hired thug tries to kill whoever's investigating. Mote is never there.
6. While the PCs are in the Rent, he tightens his grip on Sallow and sends a report to Caer Ardith (a page the PCs can intercept through [[Kettle Brindlewake]]).
7. **Three Knives**: makes his move on the night of the 5th, with two hired knives. Burns the Assessor's files, then comes for the lantern and Ysse's key. Kills Bray if Bray talks. Unmasked, he fights only to escape.
8. If he lives, he's at the Rent, waiting for the flame to change hands.
