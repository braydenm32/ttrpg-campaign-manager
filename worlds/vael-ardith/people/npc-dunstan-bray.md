---
type: npc
name: Dunstan Bray
players: true
summary: Big, affable corporal of the Ninth Lantern, everybody's friend, and Lieutenant Sallow's man.
parent: lantern-keep
aliases: [ Corporal Bray ]
tags: [ npc, ninth-lantern, soldier ]
image: sil:npc-dunstan-bray
status: alive
statusKnown: true
fields:
  Ancestry: Human
  Role: Corporal
  Faction: The Ninth Lantern
  Where: The barracks; the Last Candle
gmFields:
  5e: "Thug: AC 14 (studded leather), HP 32, mace, Pack Tactics."
relations:
  - to: garrick-sallow
    kind: serves
    note: His family were Sallow servants for three generations.
  - to: spoons
    kind: drinks with
    known: true
---

A broad, ruddy, slow-smiling man with hands like shovels, a laugh that fills a barracks and a gift for remembering birthdays. Corporal Bray buys drinks he can't afford, lends money he doesn't have, and always seems to know who's angry and why.

> "Nobody's saying *mutiny*, lad. We're just saying *hungry*. Out loud. Together."

His family served the Sallows in the [[Fallowden]] country for three generations. He followed the Lieutenant into the company and would follow him anywhere.

:::gm
Bray counts heads for [[Garrick Sallow]]'s mutiny: who's wavering, who's loyal, who could be bought with a hot meal. He knows nothing about the oil and nothing of [[Ansel Mote]]; he thinks the silver Sallow spends is family money.

**Where he turns up.** He is the big man who starts the brawl in session 1. In session 3 he is "the lieutenant's man" the oil-store intruder name-drops. In session 4 he either fights (use the bandit captain stats the session gives him, AC 15, HP 65) or turns himself in, depending on how hard the PCs pressed. If the PCs pry into the mutiny in sessions 4 to 5, Bray is told to "have a word" with them, and brings friends. Caught and pressed, he folds, weeping, and tells everything he knows, which is only enough to hang Sallow. If he talks, Mote kills him in session 7.
:::
