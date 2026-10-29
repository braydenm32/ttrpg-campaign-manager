---
type: npc
name: Brother Audit
players: true
summary: "Corvex's lay brother on Temple Row: writes down what you pray for, reads it back on Coinday with the cost, and checks the Gutter Market's weights. Incorruptible, which is not the same as harmless."
parent: temple-row
tags: [ npc, temple-row, priest ]
image: sil:npc-brother-audit
status: alive
statusKnown: true
fields:
  Ancestry: Human
  Role: Lay brother of Corvex, keeper of the Ledger's lectern
  Faction: "None: the god's, not the Concord's, whatever the Quay says"
  Where: The Corvex lectern on Temple Row; Gutter Market on Coinday and Tideday, with his scales
gmFields:
  5e: "Acolyte: AC 10, HP 9. Insight +6, Investigation +6. Itemise: once a day, names exactly what one creature he can see owes, and to whom, as far as any ledger in the March records it. Never lies; will decline to answer, and say that he is declining."
relations:
  - to: god-corvex
    kind: serves
    known: true
  - to: garrick-sallow
    kind: keeps the prayers of
    note: Two of them, dated, paid for in copper.
  - to: tollamund
    kind: lodges his ledger with
    note: Every quarter, sealed, for carriage to the Bench at Sevenhaven. He believes it goes there unread.
---

### Look and voice
A narrow grey man of about fifty-five in a narrow grey robe, with a slate on a cord round his neck and a stylus behind each ear, which he says is doctrine and the Row says is vanity. His hair is cut so short it is nearly an opinion. He has a clerk's stoop, a clerk's chilblains and the fixed, courteous attention of a man reading a contract you have not yet noticed you signed.

He never raises his voice. He never needs to: he itemises.

> "Rain is a copper. Your brother's leg is a silver and a promise, payable Coinday. The god remembers if you miss one. So do I."

> "I don't judge what you pray for. I write it down. Judging is a separate service, and I don't offer it."

### Who he is
The name he was born with is entered in his own ledger as *closed*. He was a tally-clerk in the garrison of [[Ardmere]] through the siege of 2994, counting the bread and then the dead, and after the relief he watched the Regency pay the companies that had saved the town in Ardmere Receipts, bought by the Concord houses at forty crowns in the hundred. He says it was the first time he understood that a ledger could lie, and that only one god had ever admitted to him that it did not love him. He took the grey of [[Corvex]] the following year, as a lay brother, which means no Bench, no stipend and no hope of either, and walked east to [[Cinderford]] in 3005 because a town that was nothing but debts seemed to need someone to keep them honestly.

He keeps the Ledger's shrine on [[Temple Row]]: a lectern, a ledger, a brass lamp and a stool for the petitioner. For a copper he writes down your prayer, word for word, with the date, and on Coinday he reads it back to you at the lectern with what it has cost and what is outstanding, in a clear voice, while the queue behind you listens with interest. On Coinday and Tideday he walks down to [[Gutter Market]] with a box of Sevenhaven-true brass weights and checks the scales, stall by stall. [[Tam Sixfingers]] tolerates this because a stall caught short pays its fine to the market and not to him. He has been offered bribes by most of the stalls, and has written each offer down, dated, and read it back to the stall-holder on Coinday.

The Quay calls him the Concord's man. He is not. He is the god's, and he will tell you the god does not love anybody, including the Concord.

### What he wants
Books that balance. In particular: the market's weights true for one full Coinday without anyone threatening him; the Ninth Lantern's contract kept, because every company contract in the March was signed under the Ledger's red-and-black page and he regards a broken one as theft; and a petitioner, just one, who pays the whole instalment on a dear prayer without being reminded.

### What he knows
What Cinderford prays for, which is more than anyone should know: who wants a husband back and who wants one gone, what the soldiers ask for on the night before a patrol, what the kiln-hands ask for when the dust is bad. He will not repeat a prayer to anyone but the one who made it. He knows to the copper what the company owes and to whom, as far as public books show it, and will tell anyone who asks, with the numbers in order, and let the numbers do the frightening.

### How he treats the PCs
Courteously, exactly, and without favour. He will write down a PC's prayer and hold them to its cost. Ask him what the company owes and he gives a sum that makes the room go quiet. Lie to him and he writes the lie down beside your name, and reads it back to you on Coinday. He likes soldiers, in his way: they are the only people in town who pray as if they expect to be billed.

:::gm
**Secret, his.** He has written down two prayers of [[Garrick Sallow]]'s, paid for in copper, in Sallow's own words:
- *17 Reaping 3011:* "That the Captain be relieved, and soon, and without blood if it can be had." (The day after [[Ansel Mote]] came to town.)
- *8 Ashfall 3011:* "That D. has gone far, and keeps his mouth shut." (The morning after [[Dannic Rook]] walked out of the Keep. Sallow thinks Dannic deserted; he does not know Mote drowned him.)

Under the Ledger's law a prayer is private between the petitioner and the god, except where it proves an oath broken; and the company's contract is an oath sworn on the god's page. If the party shows him Sallow's mutiny in progress (session 7), or proof of the oil, he will walk up to the drill yard, open the ledger and read both prayers aloud, dated, to the company, in his clear Coinday voice. That is Sallow exposed with proof: the Mutiny clock loses a segment.

**Secret, not his.** His ledger is lodged every quarter with [[Tollamund & Daughters]], as the rule says a lay brother's books must be, "with the nearest house that keeps the Reckoning", for carriage to the Bench at [[Sevenhaven]]. It goes sealed. Odessa opens it, reads every page to the Grandmother, and reseals it with the House's own seal, which the rule permits the House to keep. Tollamund knows what Cinderford prays for, Sallow's two prayers included. Audit does not know. If a PC proves it to him he is not angry; he opens an account in the god's ledger under her name and enters a debt: "Reading another's prayer: theft. One count per page." There are a great many pages.

**At the lip.** He is the Corvex priest at the Rent in session 8 (see [[Ending: Let It Crack]]). He believes, as his god does, that the Sleeper is the oldest unpaid debt in the world and that opening the ward is settling an account; he does not know why he has come to believe it so warmly this autumn, and neither does anyone else on the Row. He can be argued down, with a contract: an account in good standing is not called in. Show him the company keeping its oath (the lantern carried, not abandoned) and he puts the stylus behind his ear and steps back.
:::

== GM notes ==

**Voice:** level, precise, faintly amused; numbers in order, never rounded; he says "outstanding" the way other priests say "sin".

**Uses:** the man to tell the party exactly what the company owes, to whom, down to the copper (the Regency's 3,882 silver of tax, Tollamund's 4,800 gold and the 480 of interest due, Spoons's nine years of coppers), and let the sums be the horror. The man to certify a true ledger (see [[The Price Was an Arm]]: he weeps, slightly, at nine years of a slate that was never rubbed out). The man to read a dated prayer aloud when it matters most.

**Across the arc:**
- **S1:** on Temple Row before the muster, writing down soldiers' Cinders-night prayers at a copper each; a long queue.
- **S2:** Rent day. Half the Row is behind on an instalment and he reads each sum aloud.
- **S4 to S7:** certifies Hennet's slate-book, if asked; a full day, every line read aloud, no fee but a copper for the god.
- **S7:** reads Sallow's prayers in the yard, if shown cause.
- **S8:** at the lip, with an audit of the Nine; arguable.
