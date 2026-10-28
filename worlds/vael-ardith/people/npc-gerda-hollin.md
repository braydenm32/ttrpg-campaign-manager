---
type: npc
name: Gerda Hollin
players: true
summary: Surface dwarf shieldbearer who reveres the Lithic and makes the sign of Tharos whenever Borrin passes.
parent: lantern-keep
tags: [ npc, ninth-lantern, dwarf ]
image: sil:npc-gerda-hollin
status: alive
statusKnown: true
fields:
  Ancestry: Dwarf
  Role: Shieldbearer, corporal of a tally
  Faction: The Ninth Lantern
  Where: The gatehouse at the Ford
gmFields:
  5e: "Guard, upgraded: AC 18 (chain, shield), HP 30, dwarven resilience."
relations:
  - to: borrin
    kind: distrusts
    note: Makes the sign of Tharos at him.
    known: true
  - to: f-last-wardens
    kind: reveres
    known: true
---

Short, square, grey-braided and immovable, Gerda commands a tally at the gatehouse and holds a shield wall like a cliff holds the sea. Like most surface dwarves she reveres [[The Lithic]] as holy ancestors made stone, and she makes a pilgrimage to the [[The Treaty Stone|Treaty Stone]] every Restday to leave a pebble "for the ones who stood".

She does not like [[Borrin Halt]]. She makes the sign of [[Tharos]] whenever he passes, and he has started making it back, which infuriates her.

> "Nothing that walks out of the deep without its shadow walks out alone, boy. My grandmother told me that. She was right about everything else."

:::gm
Gerda is right, which is the worst part. If Borrin's shadow-thing acts before session 6, Gerda is the one who sees it, and the company will believe her. Win her over (save her tally, show her the respect due a Lithic shrine) and she becomes Borrin's fiercest defender instead.
:::
