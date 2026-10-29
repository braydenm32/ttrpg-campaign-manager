---
type: npc
name: Spoons Aldane
players: true
summary: Corporal of the Ninth Lantern who runs a betting book on everything, including when the lantern goes out.
parent: last-candle
aliases: [ Spoons ]
tags: [ npc, ninth-lantern, soldier ]
image: sil:spoons
status: alive
statusKnown: true
fields:
  Ancestry: Human
  Role: Corporal, bookmaker
  Faction: The Ninth Lantern
  Where: The Last Candle, corner table
gmFields:
  5e: 'Bandit captain, reskinned: AC 14 (studded leather), HP 45, scimitar and dagger; swap Parry for "Lay Off the Bet": once per day, reroll any one die and take either result.'
relations:
  - to: dannic-rook
    kind: knows the secret of
    note: Saw him at the oil store.
  - to: kettle
    kind: owes money to
    note: Lost a bet on the river.
    known: true
  - to: garrick-sallow
    kind: saw
    note: At the oil store, with Dannic, after midnight.
  - to: garrick-sallow
    kind: takes bets on
    note: 3 to 1 he's captain by Longnight.
    known: true
  - to: npc-keld-owes-nothing
    kind: holds the stake of
    note: '"Never", 3003, in the strongbox, grown.'
  - to: npc-orla-quist
    kind: has a line held about him by
  - to: npc-ottun-fray
    kind: has his odds printed by
    note: THE BOOK, a sheet a week.
    known: true
---

### Look and voice
Short, wiry, quick-eyed, forty-ish, with a broken nose set slightly wrong and a gap in his front teeth he whistles through when he's thinking. He wears a corporal's knot on a coat three sizes too big, won at cards from a man who was three sizes bigger. There is always a wooden spoon in his top pocket.

He talks like a man who never stops working a crowd.

> "Odds on the new girl being dead by Restday are four to one, and I'm being generous, because I like her face."

> "Everything's a bet, friend. Breakfast's a bet. *Getting up* is a bet. I just write it down."

### Who he is
Corporal Aldane has been called **Spoons** so long that the company roll lists him that way. Nobody agrees why. He says it's because he plays them (he does, badly, at every wake). Old hands say it's because he once killed a Regency sergeant with one. Those who were at Ardmere say he was pot-boy to the orc company called the Long Spoons, and came through the water-gate with the first pot when the siege broke, and that the name was the company's before it was his. He was at Cinders as a camp sutler, selling dice and gin to men who would be dead by morning, and somehow walked into the ninth lantern's light with his pockets full.

He runs the company's betting book from a corner table at [[The Last Candle]]: odds on births, deaths, promotions, desertions, weather, the Captain's temper, the colour of the Reeve's hat. His book is honest. He's very proud of that.

### What he wants
To win the big one. His longest-running pool is on **the night the lantern goes out**: nine years of soldiers have bet a silver on a date, and the pot is real money now: the board says 41 gold, the pot is 43. Spoons will give you forty to one against any named night; the Frostcall window is 14 to 1. He has his own silver on a date coming up very soon.

### What he knows
Everyone's debts, everyone's vices, and everyone's odds. Who's drinking with [[Garrick Sallow]]. Who slipped out after curfew. And more than he should about the oil. He has forty to one against the pear at [[The Burned Mill]] falling "this year".

### How he treats the PCs
As a fresh market. He opens a book on each PC in their first week (odds on survival, on promotion, on "first to sleep with somebody unwise") and tells them their odds, cheerfully. Bet with him and he becomes a friend for life, a short one or long.

:::gm
**Secret.** Twice, the first time about 30 Reaping (a fortnight before session 1), Spoons saw [[Garrick Sallow]] and [[Dannic Rook]] at the lantern's oil store after midnight, swapping tins. He knew what it meant. He moved his own silver in the lantern pool to the next red moon, and said nothing, to protect the pool. When Rook deserted, Spoons doubled his stake. Sallow's own fat stack sits on "before the red moon's gone".

A Raveler woman bet "never" in 3003 and vanished; she was [[Keld Owes-Nothing]], [[Mother Corvane]]'s sister and the Court's first watcher of the lantern, and her stake is still in Spoons's strongbox. If she sees the book in the epilogue she will say: "Don't pay it."

Also among his betting slips, won at cards years ago from a Regency clerk: a torn page of an imperial Treasury ledger with the line *Drainage Works (Western)* on it. He thinks it's funny. It's a thread to [[The Emperor's Digs]].

He is not a monster; he simply never thought it would *work*. Once the lantern gutters in session 1, he is frightened, and guilty, and still has the bet. Press him (or win a large bet from him) and he will trade what he saw for his marker back.
:::

== GM notes ==

**Voice:** a bookie's patter; everything quoted in odds; whistles through the gap in his teeth.

**Across the arc:**
1. Takes bets on the drowned man ("five to two he walks again"). Knows about the oil; says nothing.
2. Offers odds on the pay wagon ever being found. Tells the PCs the odds have changed when they come back alive.
3. After the lantern gutters, closes the lantern pool "for maintenance". This is suspicious, and soldiers notice. This is when he gives the party [[The Wager on Never]], if they ask why.
4–5. The PCs' best source on who's with Sallow. Gives up what he saw at the oil store if offered a good enough reason or a good enough wager.
7. Bets on the mutiny, both sides. If cornered, chooses the company, to his own surprise.
8. Whatever happens to the lantern, he has to pay out or collect. Let him do it, publicly, at the Last Candle. It's a good epilogue. The payout by ending is on [[The Wager on Never]].
