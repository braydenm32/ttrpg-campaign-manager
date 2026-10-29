---
type: quest
name: The Lost Pay Order
players: true
summary: "The post-stair box at the Low Quay has never lost a letter, except one, in 3009. It was the pay order, and somebody has been keeping it ever since."
parent: low-quay
tags: [ side quest, regency, letters ]
questStatus: open
fields:
  Given by: Fennick Bottlebrook (or Pell Quillon, once he has found the Account Deferred entry)
  Reward: "The order's own text: the Regent-Chancellor's hand on the Ninth's wages"
gmFields:
  Sessions: "2 to 3; payoff in session 7"
relations:
  - to: fennick
    kind: given by
    note: "Wants proof the Regency ordered the stop."
    known: true
  - to: pell-quillon
    kind: given by
    note: "Wants a copy for his Claim of Arrears."
    known: true
  - to: kettle
    kind: leads to
  - to: npc-posy-reedmarsh
    kind: leads to
  - to: ev-regency-stops
    kind: concerns
  - to: ansel-mote
    kind: secretly involves
---

[[Fennick Bottlebrook]] has an itch that has gone on for two years. The Regency stopped the Ninth's pay on 1 Hollowfrost 3009 with a three-page notice that arrived on every garrison desk in the Ashenreach. But a notice is the Regency telling you. Somebody, Fennick is certain, must have *told the Paymaster first*, in writing, with an order, and an honest paymaster tells the garrison to expect it. Nobody did. He has gone through the Keep's post-books four times. He has gone through the Low Quay's post-stair, where letters are left in a box under a tarpaulin and picked up by whichever barge is going the right way, and which has never lost a letter. "Except," says Kettle, a little too brightly, "the one."

[[Pell Quillon]] needs the same piece of paper from the other side: Form 44-A claims the company's arrears, and a Claim of Arrears needs a **copy of the instruction** under which payment was suspended. Once he finds the Treasury's ledger entry (sessions 4 to 5) he will have the sum; he will not have the instruction.

### Steps
1. **Fennick or Pell asks.** Fennick: "Someone should have warned us. There was a letter, I think. There is always a letter." Pell: "If I had the instruction itself, I could cite it."
2. **Kettle.** She says the box has never lost a letter, which is false and which she knows. Insight DC 14 shows she is nervous in the particular way of someone who has been asked the right question. If pressed: in the thaw-spate of Thawmere 3009 the box flooded and she fished out forty sodden letters, dried them on the stove, delivered thirty-nine. One carried a Regency seal. She read it (steam, a hot knife). She kept it, as insurance. She is quite open about the insurance.
3. **She no longer has it.** She gave it to [[Barge-Mother Posy Reedmarsh]], for safe-keeping, on the day [[Ansel Mote]] came to town. She knows Posy kept it. She does not say why she gave it away: she says she is "afraid of him, love, in a perfectly sensible way". If the cat is mentioned, she blames Regent.
4. **Sedgemere.** Posy will see them (see [[Sedgemere]]). She will make them wait. She has the order. She will trade it, not for coin, but for help (see below).
5. **The favour.** Posy's price is one of two things. Either the party gets her a written waiver of the bridge foot-penny for barge-folk from the Reeve (hard: it needs [[Odile Fairweather]], and the weight of [[The Charter of the Open River]]; or a hundred paces of rope and a very straight face, see the handout's "rope trick"), or the party agrees to leave her tithe out of anything they bring to [[Mistress Hebbe]] (see [[The Unmarked Barrel]]). She does not say which she prefers. She waits to see which the party offers.

### Complications
- **Mote wants it.** He has asked Kettle, politely, whether anything "from the Paymaster in Fallowden" ever came through the post-stair. She said no. If he learns that Posy holds it before session 7, two Quiet Office men take the *Long Patience*'s cabin to pieces on a Tideday night. Posy is unhurt and furious. The order is not found (she moved it the day before).
- **Regent is blamed.** Kettle's explanation to Fennick, until she is pressed, is that "the cat ate it". Regent, who was present, does not contradict her.
- **Fennick's guilt.** The order was addressed to him. He never received it. He has had two years to suspect his own post, and is not pleased to learn it was lost by a cousin he considers a disappointment.

### Reward
The order's text, which proves the stoppage came from the Regent-Chancellor's own hand, and that the Treasury's "Account Deferred" is not an accident of bookkeeping but an instruction. With it, [[Pell Quillon]]'s Claim of Arrears is a case and not a gesture.

:::gm
**The truth.** The letter is a private warning from **Paymaster Corin Blythe** of the Fallowden Pay Office to the Ninth Lantern's quartermaster, copying an instruction he was not allowed to copy. He sent it by barge-post because the Regency's own riders are read. It was lost in the Thawmere spate, and it was never replaced because Blythe, frightened, did not write twice. He has since been transferred to a lighthouse (the Regency's idea of a joke).

**The text** (a handout the GM can read aloud; Blythe's covering note first, then the order, copied):

> *To the Quartermaster, Lantern Keep, by clan boat. Sir, I am sorry. I am not at liberty to send you the enclosed, so I send it by water. I have been a paymaster for nineteen years and have never been ashamed of a sheet of paper until this one. C. Blythe, Fallowden, 28 Longnight.*
>
> *Office of Martial Disbursement, by order of the Regent-Chancellor. To the Paymaster at Fallowden. From the first day of Hollowfrost next, the sums voted by the Council for the garrison of the Ninth Lantern at Cinderford are to be entered each quarter "to Account Deferred, by order of the Regent-Chancellor", and no wagon is to be made up. Arrears are deferred until the garrison is relieved. This instruction is not to be repeated to the garrison, its officers or its quartermaster. Under the Regent-Chancellor's own seal.*

The words *"arrears deferred until the garrison is relieved"* are the same as the pay notice's ([[Pay Notice]]); the "not to be repeated" clause is what makes it a proof of intent rather than policy. The seal is Vell's private one (compare the pay-chit in the Cold Room).

**Mote's interest.** He suspects a letter exists because it is the one thing in the Ashenreach that would show the Regent-Chancellor is the author. He will not hurry. He asks, and if he is answered falsely he checks.

**Outcomes.** Trade for the foot-penny: Posy brings the order to the Keep gate in session 7 on her own legs. Trade for her tithe: Posy hands it over on the quay, quietly; the Clans' neutrality is intact, and the party owes her. Fail and Mote finds her first: the order is destroyed, Posy becomes an enemy of the Quiet Office, and Kettle acquires a very serious look.
:::
