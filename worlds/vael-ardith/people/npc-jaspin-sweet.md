---
type: npc
name: Jaspin Sweet
players: true
summary: Silver-voiced fence at Gutter Market who buys anything from the glass and never asks where it came from.
parent: gutter-market
tags: [ npc, gutter-market, fence ]
image: sil:npc-jaspin-sweet
status: alive
statusKnown: true
fields:
  Ancestry: Human
  Role: Fence
  Faction: None (sells to the Glassers' market)
  Where: Gutter Market, the stall with the blue awning
gmFields:
  5e: "Spy: AC 12, HP 27. Appraisal +7. Two Glasser thugs nearby."
relations:
  - to: f-glassers
    kind: buys from
    known: true
  - to: fennick
    kind: buys from
    note: Company salvage, quietly.
---

Slim, dapper and soft-spoken, Jaspin wears grey kid gloves at all times, a silk cravat the colour of a bruise, and a smile that makes you check your pockets. His stall under the blue awning at [[Gutter Market]] sells nothing much: a few rings, some glass beads, a dented helmet. What he buys is the real business. Anything from the glass, from anyone, no questions, cash.

> "Oh, how *lovely*. Where did you get it? No, don't tell me. I adore not knowing things. It's so restful."

He buys company salvage from [[Fennick Bottlebrook]] and is scrupulously fair to him, because a quartermaster in debt is a supplier for life.

:::gm
In the last week Jaspin has bought a great deal of fresh Concord coin from Glassers at a discount: the pay wagon's strongbox, broken up and sold off a handful at a time. A sharp PC who sees him paying out shiny Concord silver in session 2 has a lead straight to [[Fort Mercy]].
:::
