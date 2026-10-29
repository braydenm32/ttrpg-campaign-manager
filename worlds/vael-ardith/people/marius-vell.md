---
type: npc
name: Marius Vell
players: true
summary: Regent-Chancellor of Ardith, head of the Regency Council, who has ruled "until an heir is found" for longer than most people can remember.
parent: caer-ardith
aliases: [ the Regent-Chancellor, Regent-Chancellor Vell ]
tags: [ npc, regency, far-away ]
image: sil:marius-vell
status: alive
statusKnown: true
fields:
  Ancestry: Human
  Role: Regent-Chancellor of the Regency Council
  Faction: The Regency Council
  Where: Caer Ardith (far away)
gmFields:
  5e: "Noble: AC 15 (fine breastplate), HP 27. Never alone: 4 knights and 2 Quiet Office spies. Insight +8, Deception +9."
relations:
  - to: f-regency-council
    kind: leads
    known: true
  - to: f-quiet-office
    kind: commands
  - to: item-lantern
    kind: wants
    note: As a leash, and a crown.
  - to: npc-tesh
    kind: is searching for
    note: An imperial by-blow. She doesn't know. Neither, yet, does he.
---

### Look and voice
Sixty-two, silver-haired, handsome in a soft, well-fed, unhurried way, with long pale hands and rings on every finger but the one where an emperor's seal would go. He dresses in black velvet so plain it must have cost a fortune. He smiles often and never with his eyes. His portrait hangs in every Regency office, including [[The Assessor's Office]], slightly crooked.

He lets a small, pleasant pause open before every refusal, so that you are halfway to thanking him when it lands. He is the only person in the Regency who can make a tax sound like a kindness.

> "The throne is *empty*, my friends. Not *vacant*. There is a difference, and I am it."

> "Pay them? Of course we shall pay them. In time. Everything in the Regency happens in time. That is what the Regency is *for*."

> "I have never lied to a subject. I simply choose which truth they are ready for. It is exhausting, and I do it for nothing."

### Who he is
Marius Vell is Regent-Chancellor of [[The Regency Council]], which has ruled [[The Regency of Ardith]] "until an heir is found" since [[The Kingslaying]] in 2981. He was a junior councillor then; he has been Chair of the Council since 2992, and has styled himself Regent-Chancellor, "acting for a decade", since 3001. In that time no heir has been found, though several have been looked for, and two found dead.

### What he wants
Publicly: order, stability, an heir, and the Treaty honoured. Privately: that no one, not the Concord, not the Mothers, not the Saint, can ever tell the Regency no again.

### What he knows
What the old imperial archives hold, which is more than anyone alive has read. They are very thorough.

:::gm
**Secret.** What Vell wants is a puppet emperor on the empty throne and the power of a ward behind him. He commissioned [[The Quiet Office]]'s work in [[Cinderford]]: stop the company's pay, divert it, break the company from within through [[Garrick Sallow]], and bring the flame to [[Caer Ardith]]. His agent there is [[Ansel Mote]].

He knows what the flame is, roughly, from the archives of [[The Emperor's Digs]]: a light of the Nine, a leash on what's under the wards. He also knows that imperial bloodlines hear the Sleeper, which is why no living heir has been allowed near the throne. His plan: find a pliable heir of the blood, put the flame in their hands, and stand behind them. He thinks he can control the voice that comes out of them. He is wrong.

His own claimant, a cousin of the blood in the capital, has stopped speaking and is failing; the Sleeper has taken his voice. Vell needs another line, and [[Tesh]] at the Velvet Ledger is it.
:::

== GM notes ==

Vell never comes to the March. He is felt through paperwork, Mote's letters, and the occasional Regency form signed by "the Office of the Regent-Chancellor". If the PCs intercept a letter (via [[Kettle Brindlewake]]), let it be chillingly polite. In ending C, if the Regency gets the flame, Vell is the man who holds the leash, for a while.
