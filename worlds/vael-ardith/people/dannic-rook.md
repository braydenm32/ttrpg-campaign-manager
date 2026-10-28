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
  Where: Unknown (last seen at the Ford)
gmFields:
  5e: "Zombie, drowned: AC 8, HP 30, resists fire, Undead Fortitude. Ash spills from his mouth: when he hits, target makes a DC 11 CON save or is poisoned until the end of its next turn."
relations:
  - to: f-ninth-lantern
    kind: deserted
    known: true
  - to: garrick-sallow
    kind: was paid by
    note: To swap the oil tins.
  - to: f-rook-court
    kind: was raised by
    note: A foundling at Corvel Rise; ran at fourteen.
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
---

### Who he was
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
:::

== GM notes ==

Session 1's walking clue (see [[The Drowned Man]]). Play Rook as pitiful more than frightening: he stumbles toward home, stops to look at the lantern on the hill, and keeps going. If put down without a proper rite, he gets up again at the next red moon unless Quorl lays him to rest. The dates are the clue: he left on the 7th, the poster says he was seen on the 12th, and anyone with Medicine DC 11 can tell he's been in the water a week.
