---
type: npc
name: Dannic Rook
players: true
summary: Private of the Ninth Lantern who deserted a week before payday, taking lantern oil from the stores. Wanted.
parent: the-ford
tags: [ npc, ninth-lantern, deserter ]
image: sil:dannic-rook
status: dead
statusKnown: false
fields:
  Ancestry: Human
  Role: Private (deserter)
  Faction: The Ninth Lantern (deserted)
  Where: Unknown
gmFields:
  5e: "Zombie, drowned: AC 8, HP 30, resists fire, Undead Fortitude. Ash spills from his mouth: when he hits, target makes a DC 11 CON save or is poisoned until the end of its next turn. Session 1 runs him at HP 22 with the ash rider; the two drowned who stand with him are half-made (HP 11, no Undead Fortitude). A flame from the Lantern denies Undead Fortitude."
relations:
  - to: f-ninth-lantern
    kind: deserted
    known: true
  - to: garrick-sallow
    kind: was paid by
    note: To swap the oil tins.
  - to: f-rook-court
    kind: was raised by
    note: A foundling at Corvel Rise; ran at sixteen.
    known: true
  - to: spoons
    kind: owed money to
    note: Eleven silver.
    known: true
  - to: kettle
    kind: owed money to
    known: true
  - to: glass-barrow
    kind: hid the oil in
  - to: npc-mother-hennet
    kind: paid his tab to
    note: In full, on 5 Ashfall, two days before he ran.
  - to: npc-skelt
    kind: was guided by
---

### Who he is
Private Dannic Rook, twenty-four: sandy hair, freckles, a crooked front tooth, a laugh you could hear across the drill yard, and a burn scar on the back of his left hand shaped like a key. He was a foundling raised by the Ravelers at [[Corvel Rise]], and ran from them at sixteen and soldiered with two other companies before he drifted into [[The Ninth Lantern]] four years ago, which the Ravelers took philosophically. A gambler and a decent shot. He owed money to half the company, including eleven silver to [[Spoons]] and rather more to [[Kettle Brindlewake]].

He was on the lantern store detail. On the night of 7 Ashfall he walked out of the Keep with two tins of lamp-oil and a grey company blanket and no goodbye. A wanted notice went up in town on the 13th. The company has a pool on whether he made it to the river.

> "I'll pay you back Restday, Spoons. Swear on the Corporal." (The last thing he said to anyone in the company before he ran. Spoons wrote it down.)

### What people say
That he'd been jumpy for three weeks: couldn't sleep, kept checking the lantern, asked Brother Tallow once whether a flame could "get sick". That he'd been drinking with the Lieutenant, which isn't like Sallow. That he'd come into money, briefly, and lost it at dice. That a man on the bridge the night he ran saw him arguing with someone in the dark.

:::gm
**Which rumours are true.** All of them, more or less. The jumpiness was the swaps; the drinking with the Lieutenant was Sallow paying him; the money was Sallow's new Regency silver. The "man on the bridge" is old Nan Crupp, who saw a scarfed man and a splash from her hut door that night: Mote.

**The poster** ("Wanted: Dannic Rook") is dated the 13th, in a neat clerk's hand, signed "A.M.", and says he was seen on the Low Quay on the 12th. Anyone who knew him can see the description is wrong in three places: it makes him thirty, gives him a missing ear-lobe and a Fallowden accent. The key-shaped scar is the only part it gets right.

**The truth.** Dannic Rook is dead. [[Garrick Sallow]] paid him (his debts were the lever: "S. says one more swap and Im square") to swap the lantern's good oil for tins cut with ash. The tins came from [[Ansel Mote]]; the ash, lake-ash from [[Stillwater]], from [[The Dreaming Widow]]. He did it for three weeks, from the middle of Reaping. He watched the flame shrink and felt sick. He had been into the Barrow once already: on 3 Ashfall he went AWOL, and a Glasser called [[Skelt]] took him in by the culvert to cache his stash in the Cold Room (the purse, the note, the pay-chit he lifted from Sallow's dispatch case, a clean tin and a cut one). He was back at the Keep on the 5th, was docked a week's nothing, and paid [[Mother Hennet]]'s tab in new Regency silver. On 7 Ashfall he tried to back out, walked out with one clean tin, one cut tin and a grey blanket, and meant to take them to the Captain, or sell them; he never decided.

[[Ansel Mote]] caught him at [[The Ford]] that night and held him under at the third pier until he stopped. The current took the body through the old culvert under the toll bridge into [[The Glass Barrow]], where the leak runs cold and the dead don't rest. Nobody buried him. In the cold the body does not lie still: it carries the bundle down to the Cold Room, then comes back up to stand in the shallows under the third pier, facing the Keep. The ford-watch hook him out at noon on 14 Ashfall.

He doesn't stay down. In **Payday** (session 1) he stands up, with two other dead nobody recognises, and walks for home. His trail leads into the Barrow and the [[The Cut Oil Tin|tins]]. When he falls for the last time, his last words are: "It's cold under the glass." If he is put down without a rite (Quorl's, or [[Hathe's Door-Key]] in session 5), he rises again at the full Ember on the 16th.

The poster's description is Mote's guesswork, because Mote never saw him alive. All his money is new Regency silver, Sallow's pay.

The key-shaped scar matches [[Hathe's Door-Key]], which the Rook-Court keeps. Why a Raveler foundling bears its mark is a thread for Quorl, if you want one.
:::

== GM notes ==

Session 1's walking clue (see [[The Drowned Man]]). Play Rook as pitiful more than frightening: he stumbles toward home, stops to look at the lantern on the hill, and keeps going. If put down without a proper rite, he gets up again at the next red moon (the 16th) unless Quorl lays him to rest. The dates are the clue: he left on the 7th, the poster says he was seen on the 12th, and anyone with Medicine DC 11 can tell he's been in the water a week.
