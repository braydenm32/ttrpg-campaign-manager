---
type: npc
name: Mistress Hebbe
players: true
summary: Toll clerk in the company gatehouse at the west bridge-head, who can tell a Concord coin from a Regency one by the ring and writes down every cart.
parent: the-ford
aliases: [ Hebbe ]
tags: [ npc, cinderford, the-ford ]
image: sil:npc-mistress-hebbe
status: alive
statusKnown: true
fields:
  Ancestry: Human
  Role: Toll clerk
  Faction: Cinderford (the town)
  Where: The gatehouse at the west bridge-head
  Toll: "1 cp a head, 2 a beast, 5 a cart; company soldiers free"
gmFields:
  5e: "Commoner: AC 10, HP 6. Insight +4. A coin's mint, year and metal by its ring on the slate counter, without a check."
relations:
  - to: the-ford
    kind: keeps the toll-log of
    known: true
  - to: odile-fairweather
    kind: clerk to the son of
    note: The Reeve's surviving son holds the toll by charter; Hebbe does the work.
    known: true
  - to: tollamund
    kind: sends the takings to
    note: The House holds the bridge's mortgage. The toll-box goes to the mill on Wardday.
    known: true
---

### Look and voice
A narrow woman of fifty with reading-glass eyes, ink to the second knuckle, and a stool worn to the shape of her. She sits in the company gatehouse at the west end of the bridge with the toll-box chained to the wall and a ledger chained to the box, and she has heard every excuse there is, twice. Her one indulgence is the coin test: she drops every piece on the slate counter and listens, head tilted, like a woman hearing a bird she knows.

> "That's Sevenhaven, this year, and somebody's shaved it. Two pence more or walk."

> "A head is a penny. A beast is two. A cart is five. A story is free and I've got a drawer of them."

### Who she is
The toll on the bridge belongs to the Reeve's son by charter, and he has not sat in the gatehouse since the week he got it. Mistress Hebbe has. She came up from Fallowden with [[Odile Fairweather]]'s household in 3003, clerked the rebuilding accounts, and took the toll-box when the bridge reopened, and nothing has crossed the Cinder by that road since without going into her book: who, what, how many, which way, and in what coin. The company's gatehouse holds the bridge-head and she holds the company's gatehouse, which the duty sergeants have learned to live with. [[Mirrel Vosk]] reads the wanted bills aloud at her counter most mornings; she corrects his pronunciation.

### What she wants
A tidy book, a full box, and the Reeve's son to stay away. She is paid by the quarter, and the quarter is late.

### What she knows
Everything that crossed the bridge, in order, for eight years, and in what coin it paid. Which coin is new and which is clipped. That new Concord silver has started turning up in the toll-box this month when there has been none for two years. That a coin rang wrong on Hearthday last, and she has a name for the hand that passed it.

### How she treats the PCs
As a penny each, free if they are in company colours and she has seen them at muster. She is not unkind; she is busy. A PC who pays with a coin she has not heard before gets her full attention, which is not always a comfort. Ask her a question with a cart in the queue and she answers after the cart. Ask her with a penny on the counter and she answers properly.

:::gm
**The log.** The entry the party needs, in Hebbe's small square hand, under 7 Ashfall, first line of the day: *Dawn. House cart, sealed, east. 5 cp.* The five pence were paid in new Sevenhaven silver with Tollamund's house-mark on it. She noticed the coin, because the House's own drivers pay in Regency copper to be polite; she did not notice the cart, because [[Tollamund & Daughters]] sends glass-carts east every week. She shows the log to the company on the Captain's word or the Reeve's, or for a silver and a promise not to say where it came from, and the entry sends the party to the Burned Mill turn-off and [[Fort Mercy]] (session 2).

**The coin that rang wrong.** One of the Reeve's jobs (see [[Odile Fairweather]]): a silver passed on Hearthday last that rang like lead under the plate. She knows who passed it, a Low Quay fish-seller, and does not know who gave it to him. The Reeve will pay to have it traced.

She knows nothing of the wagon's business and should not be made to. She is a clerk who writes things down, which is the whole of her usefulness, and the whole of her danger to Tollamund if anyone thinks to read her.
:::

== GM notes ==

**Voice:** short, precise, no small talk. Counts under her breath while you talk.

Session 2's cleanest clue if Kettle is missed or the party distrusts her: the toll-log is paper, dated, and in a hand nobody can accuse of imagination. Use her again in session 7 when Tollamund's eight porters and two lawyers cross the bridge: Hebbe charges them a head apiece, writes "Tollamund, 11, west" in the book, and lets the party see her do it.
