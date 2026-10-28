---
type: npc
name: Hester Pruitt
players: true
summary: Clerk of the Assessor's Office who does the sums, has done them alone for two years, and distrusts the new clerk on principle.
parent: assessors-office
aliases: [ Widow Pruitt ]
tags: [ npc, regency, clerk ]
image: sil:npc-widow-pruitt
status: alive
statusKnown: true
fields:
  Ancestry: Human
  Role: Clerk (sums)
  Faction: The Regency Council (Assessor's Office)
  Where: The Assessor's Office
gmFields:
  5e: "Commoner: AC 10, HP 6. Investigation +5 on any ledger; a heavy brass abacus (1d4 bludgeoning)."
relations:
  - to: ansel-mote
    kind: distrusts
    note: '"Nobody has a cold for three weeks."'
    known: true
  - to: npc-nib
    kind: feeds
    known: true
---

Sixty, thin, black-clad, sharp-nosed, with a brass abacus she treats as both instrument and weapon. Widow Pruitt has kept the books of [[The Assessor's Office]] alone for two years, writing to the capital monthly to ask for help and receiving, monthly, more forms. She is delighted [[Pell Quillon]] has finally come, and horrified by how nice he is.

> "A man who has a cold for three weeks is either dying or lying, and that one's not dying."

She means [[Ansel Mote]]. She has no evidence. She has a long memory, a suspicious nature and every receipt since 3009.

:::gm
Pruitt's receipts can show that the Assessor's Office paid a Temple Row printer for a wanted poster on the 13th, signed off by "A.M.". She'll find it if asked to look, and she'll be smug about it. She's also the one who notices, in session 7, that the office's lamp oil has gone missing. Mote wants to burn the place.
:::
