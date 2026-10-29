---
type: quest
name: The Unmarked Barrel
players: true
summary: "New Concord silver is turning up in Hebbe's toll-box, and it is not the Treaty's. She thinks somebody should go and count at Sedgemere."
parent: sedgemere
tags: [ side quest, concord, river ]
questStatus: open
fields:
  Given by: Mistress Hebbe, the toll clerk (or Kettle Brindlewake, for a favour)
  Reward: Hebbe makes the party toll-free for life (worth more than it sounds)
gmFields:
  Sessions: "2 to 5 (salt-tows come up on Tidedays: 16 Ashfall at dusk, 22 and 28 are the clean windows); payoff in session 7"
relations:
  - to: npc-mistress-hebbe
    kind: given by
    known: true
  - to: kettle
    kind: given by
    note: "If Hebbe is missed."
    known: true
  - to: tollamund
    kind: secretly involves
  - to: npc-posy-reedmarsh
    kind: secretly involves
  - to: npc-keld-owes-nothing
    kind: leads to
  - to: t-reeve-charter
    kind: leads to
---

[[Mistress Hebbe]] drops coins on a slate for a living, and for three weeks the slate has been ringing wrong. Not false: *new*. Bright Sevenhaven silver, house-marked, turning up in the toll-box in a fish-seller's pocket, in a goat-boy's hand, in a bargeling's change. There has been none in the March for two years. "It's coming from somewhere with a tap," she says. "I only count what goes by. Everything on this river goes through Sedgemere. Somebody should go and count there."

Kettle says the same thing differently ("It's a barge, love, it's all a barge") and charges for it.

### Steps
1. Look at the silver Hebbe has caught in the toll-box.
2. Go and count at Sedgemere, nine miles downriver.

:::gm
### Steps in full
1. **The ring.** Hebbe shows the party the toll-box's silver (eleven pieces in three weeks, all Tollamund-marked, from the Quay trade). Investigation DC 12, or Hebbe's ear: it is the House's *working* coin, not the Treaty's.
2. **Sedgemere.** Nine miles downriver: half a day by barge (Kettle will carry them, with questions), a day on foot. The Weir, the Barrel, and the slate. See [[Sedgemere]].
3. **Count the barrels.** A tow of three Concord barges comes up on Tideday evenings (22 and 28 Ashfall are the clean windows). Salt-barrels, twelve to a tow, burnt with the Concord's salt-mark, and a thirteenth, plain, which the barrel-count sweepstake at [[The Thirteenth Barrel]] never includes. Counting from the Weir-walk is a DC 10 Perception check; noticing that the house always guesses twelve is a DC 12 Insight.
4. **The thirteenth goes first.** At the Weir the plain barrel is taken off the tow in the dusk, rolled to the *Long Wait* by Posy's bargelings, and opened under the floor. (Stealth DC 14 to watch it; Thieves' tools DC 13 for the trapdoor in the third bench.) Inside: new Sevenhaven silver in lead-sealed rolls packed in salt, about two hundred gold in each barrel. Then it goes upriver again: not in the tow, but by night, in a House glass-cart from the Quay to the mill-yard at the Ford.
5. **Posy's tithe.** One coin in thirteen goes into a bag in the bilge of the *Long Patience*. Posy knows what it is. Keld's slate has the stave. Cobb's cord has the knot.

### Complications
- **Barge Clan neutrality.** A Clans barge cannot be searched without a signed writ; a barrel on a Clans barge cannot be opened without a Moot. Posy will invoke [[The Charter of the Open River]] before anyone has said a word. This is not an obstacle, it is the whole shape of the puzzle: the Concord's coin travels in the one hold nobody can inspect.
- **Posy.** She is not an enemy; she is a person who made a bargain she is ashamed of. Press her publicly and the Clans lose their Mother of the Water; speak to her alone and she will trade (see [[The Lost Pay Order]]).
- **Cousin Pennamund** does not know the barrels exist and will be horrified; Perrin knows. If the party goes to Pennamund he becomes an ally for a week and then discovers whose side his own House is on.
- **Keld's slate.** The stave, the dates, the two cold lines. Keld will show it, and say nothing more; she does not take sides in a toll.
- **The Reeve's son** is Hebbe's employer and holds the toll. If the party goes to him first, nothing happens, nicely.

### Reward
Hebbe makes the party toll-free for life: their names go into the toll-log under "exempt" in her own hand, and she waves the soldiers' toll for every cart they bring. In a town where a penny is a head, it is worth more than it sounds, and it is a quiet credential: Hebbe's word is the one at the bridge that cannot be bought. And a sight of what the Reeve signed (see [[What has the Reeve signed?]]): Hebbe has been filing the Reeve's son's copy of the draft charter since Longnight, because it mentions the toll, and she will show it the day the Concord's porters cross the bridge in session 7.

**The truth.** The silver in the thirteenth barrel is [[Tollamund & Daughters]]' working coin for buying the town: the Reeve's charter, [[Fennick Bottlebrook]]'s credit and signatures, [[Jaspin Sweet]]'s Glasser purchases, the Bridle and Yoke's debts. It does not travel through the Regency's customs because it does not travel *at all*, in the House's own reckoning: it is "salt". The Concord's tow-masters do not know what the thirteenth is. The tithe is **one coin in thirteen**, the Barge-Mother's own invention, called "the barrel's share" and put in the ballast.

Hebbe suspects, not knows. She can ring a coin, not a motive.

**Outcomes.** Trace the silver with proof (the stave, the barrel-count, Cobb's cord, a roll of Tollamund silver): Concord clock +1 (the House notices it has been seen, and moves its calendar up), and the party has a clean case that the House is buying Cinderford with coin the Regency has not paid. Keep Posy's tithe out of what is shown to Hebbe: Posy gives up the pay order. Show the tithe: the Quay-Moot may depose Posy, Kettle becomes the senior Mother on the river and does not want to be, and the Clans swear off the March for a season. Do nothing: the silver arrives, the charter is sealed on 5 Leafrot, and nobody is surprised.

**The Concord factor.** Cousin Pennamund can be shown a roll of the House's own coin and the stave and asked who sent it. He will say, in a very shaken voice, that he did not.
:::
