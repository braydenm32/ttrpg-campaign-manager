---
type: npc
name: Nib
players: true
summary: Errand boy of the Assessor's Office, paid in biscuits, who sees more than the clerks do.
parent: assessors-office
tags: [ npc, cinderford, child ]
image: sil:npc-nib
status: alive
statusKnown: true
fields:
  Ancestry: Human
  Role: Errand boy
  Faction: The Regency Council (Assessor's Office), for biscuits
  Where: The Assessor's Office; the streets
gmFields:
  5e: "Commoner: AC 11, HP 3. Stealth +5. Can get into any room in town through a window."
relations:
  - to: ansel-mote
    kind: spies on
    note: If the PCs pay in biscuits.
  - to: npc-thistle-weirford
    kind: rival of
    note: Messengers' feud.
    known: true
---

A grubby, gap-toothed orphan of nine or ten with a cap too big for him and pockets full of crumbs. Nib runs errands for [[The Assessor's Office]] and is paid in biscuits, which he considers an excellent arrangement and the office considers a budget triumph. He knows every alley in town, and is locked in a bitter feud with the company runner [[Thistle Weirford]] over who is faster. **Wants:** biscuits, and to be believed. **Fears:** the clerk.

> "Four biscuits. Five if it's up a hill. Six if it's the clerk. I don't like going near the clerk."

:::gm
Nib has noticed that Mote keeps a second ledger, a small black one, which he never leaves on his desk. Nib has seen him write in it at night, by the window, and then look out at Lantern Hill for a long time. It holds the Quiet Office's payments to [[Garrick Sallow]] and the key to Mote's cipher. For a sack of biscuits, Nib will try to get it. This could easily get him killed.

**Beat.** Sessions 3 to 5, he is the way into the ledger. In session 7 he is in the office when Mote burns it.
:::
