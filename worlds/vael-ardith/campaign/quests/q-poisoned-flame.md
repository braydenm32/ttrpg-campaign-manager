---
type: quest
name: Who Is Poisoning the Flame?
players: true
summary: A tin of lantern oil cut with grey ash, found in the Glass Barrow. Someone wants the lantern to go out.
parent: lantern-keep
tags: [ session 1, mystery ]
questStatus: open
fields:
  Given by: Brother Tallow, once he sees the tin
  Reward: The flame burns clean again, for now
gmFields:
  Sessions: 1 to 7
relations:
  - to: item-oil-tin
    kind: begins with
    known: true
  - to: brother-tallow
    kind: given by
    known: true
  - to: ansel-mote
    kind: leads to
---

The tin was in [[The Glass Barrow]], in a ring round the Cold Captain's chair. The oil inside is cloudy and grey, and when [[Brother Tallow]] rubs it between his fingers his antennae flatten. "Ash," he says. "I think someone has been putting ash in my oil."

The contract says the company stands down if the lantern goes out. Somebody has worked that out.

### Suspects worth a look
- [[Garrick Sallow]], who would like to command something, even the leftovers.
- [[Spoons Aldane]], who runs a book on when the lantern goes out.
- [[Fennick Bottlebrook]], whose oil ledger is a work of fiction.
- [[Seraphine Ashe]], who has been asking very kindly about the flame.
- [[Grandmother Tollamund]], who holds the company's debts.
- [[The Dreaming Widow]] and her Sleepless, who pray for the dark.

### Where the answer lies
The tin is a Keel tin with a grey wax seal pressed with a moth. [[Hesk's Chandlery]] in the Smokes sells those, and keeps an order-book.

:::gm
The full answer is on [[The Lantern Gutters]] page. In short: Marius Vell's Quiet Office pays [[Ansel Mote]], who buys sealed Keel tins at [[Hesk's Chandlery]] through "a clerk with a cold" and cuts them with Stillwater lake-ash supplied by the Dreaming Widow's people (the [[The Sleepless]] want the Rent-ash story believed instead); he reseals them in Hesk's own grey wax and hands them to [[Garrick Sallow]], who pays [[Dannic Rook]] to swap them into the oil store. Mote drowned Dannic when he walked out. [[Spoons Aldane]] saw the swap twice and kept quiet for his pool. Hesk did not cut the oil, and Spoons saw who resealed it.

Run it on the corkboard "Who's poisoning the flame?". Let the party chase the wrong suspect for a while; Fennick's guilty face sells the red herring beautifully.

Proof trail: Spoons cracks if the party covers his debts or threatens the pool (session 2 or 3). Sallow's new coin is Regency silver, mint-fresh, which nobody in the Ashenreach has seen in two years (Quiet Office money). The ash is fine and smells of lake water: only [[Stillwater]] ash smells like that. Mote is the last link, and the hardest; he is not caught until session 7 unless the party is very clever.
:::
