---
type: quest
name: The Price Was an Arm
players: true
summary: "The Concord's clerks want to buy Mother Hennet's slate-book, nine years of what the Ninth Lantern drank on tick. She wants to know why before she decides whether to burn it."
parent: last-candle
tags: [ side quest ]
questStatus: open
fields:
  Given by: Mother Hennet (or Cousin Pennamund, who wants to buy it)
  Reward: "PAID chalked under your name on the slate, the first in nine years; or every tab on the slate cleared"
gmFields:
  Sessions: 4 to 7 (side quest; the book can be the second hole in the contract in session 7)
  Clocks: "Concord −1 if the certified book reaches the Keep gate in session 7; Mutiny −2 if the book is read and Marrow's savings come out; Quiet Office +1 if it burns"
relations:
  - to: npc-mother-hennet
    kind: given by
    known: true
  - to: npc-pennamund
    kind: involves
    note: His clerks are buying.
    known: true
  - to: ansel-mote
    kind: secretly involves
  - to: fennick
    kind: secretly involves
  - to: npc-brother-audit
    kind: involves
  - to: item-promissory-note
    kind: concerns
  - to: t-marrow-savings
    kind: concerns
---

Under the bar of [[The Last Candle]], wrapped in a grey company blanket, are three fat ledgers bound in canvas. When a column on the great slate fills, [[Mother Hennet]] copies it into the book and starts the column again underneath, smaller. Every soldier who ever drank here is in it, the dead included, and nothing in it has ever been crossed out but one name.

Last Highsun two clerks of the Concord came and asked to see it, and she told them the price was an arm. On market day, 20 Ashfall, they come back: two young men in Sevenhaven grey with an ironbound box between them, sent by [[Cousin Pennamund]]. They do not want to see it any more. They want to buy it, and for the book they will clear every tab on the slate, nine years of them, in new coin, today.

Forty soldiers stop drinking to listen. Hennet asks for a day, which the clerks find very reasonable, and then she finds the party.

> "I've been offered more for that book than I've been paid for anything in my life, and I don't know what it is. When a banker wants a thing that bad, somebody's going to burn my roof down for it. I'd sooner burn it myself. Find out what it's worth. If it's worth more than my roof, it goes in the fire. If it's worth more than that, you can have it."

### What you can find out
- What is actually in the book, which takes a night and a lot of candles.
- What [[Fennick Bottlebrook]] says when he sees it, which is very little, very quickly.
- What [[Pell Quillon]] says when he sees it, which is a great deal, with his hands.
- What [[Brother Audit]] would say a book like this is worth before the Ledger, and what he charges to say so in writing.
- Who else in town has started asking after it.

### Steps
1. **Hear the offer.** At the Candle, 20 Ashfall. The clerks are polite and will wait a day.
2. **Read the book.** Nine years by candlelight. The pattern takes a reader with patience (Investigation DC 13) and its meaning takes someone who understands ledgers (DC 16, or ask Fennick, Pell or Brother Audit).
3. **Ask the right people.** Each of them sees something different in it, and one of them would rather nobody saw it at all.
4. **Keep it.** Somebody besides the Concord wants the book, and not to read.
5. **Decide.** Sell it to the clerks, keep it, give it to someone who can use it, or let Hennet have her fire.

### Complications
- The whole company heard the offer. A good many soldiers would very much like their tabs cleared, and they say so to the party, at length, in the drill yard.
- Fennick asks the party, quietly, not to show the book to anyone in the company. He will not say why.
- The night the Candle is shut, the Candle is empty.

:::gm
**What the book proves.** Hennet's habit, kept since the first winter: at every quarter-day muster, when tabs fall due, she heads the new column with the date, the number who stood at muster, and what came. The headings are the company's pay history in a hand nobody can call the company's:
- **Seedwake to Longnight 3009** (four quarter-days): *"No wagon. The Gilt men at my long table, buying wages, four pence in ten. 131 sold."* and so on, every quarter. The Concord houses' buyers sat at her table on each quarter-day of 3009 and bought each soldier's quarter of wages at four in ten, and the soldiers paid their tabs out of it. She wrote down every sale, because it was her money too.
- **Seedwake 3010:** *"No buyers. The Gilt men did not come. Tabs carried."* (The Gilt Run was eight days later, and by Reaping Tollamund held the whole of Ferrowyn's Regency paper: see [[The Gilt Run]].) **Highsun 3010:** the same.
- **Ashfall 3010 to Highsun 3011** (four quarter-days): *"Paid from the Keep. A part. Old imperial silver, Aurel's head rubbed thin, the same worn coin every time."* That is [[Ilse Marrow]]'s savings (see [[How has Captain Marrow been feeding the company?]]). Hennet noticed the coin was always the same coin and never asked whose.
- **Ashfall 3011:** *"140 at muster. No wagon. Notice: nothing. Cinders. Tabs carried."*

**Why it is a hole in the contract.** The Treaty's pay clause makes the wages payable "by the signatories, or by whosoever shall hold their debt". The book is the only disinterested, unbroken, contemporaneous record that the Concord houses bought the garrison's wage-debt in 3009, and since the Gilt Run nearly all of that debt sits in [[Tollamund & Daughters]]. By the clause Tollamund herself drafted, the House has been the garrison's paymaster for a year and a half, and in place of wages it lent the company its own pay, at a tenth a quarter. At the contract rate the House owes the garrison something over five and a half thousand gold, which is more than the note. This does not save the lamp (page seven does that) and it does not stop the company being pledgeable; what it does is stall collection. Certified by a priest of the Ledger, the account is *in dispute before Corvex*, and no Concord house may seize while its own account is disputed under the god's page. Tollamund's lawyers argue for an afternoon; the Grandmother, who is patient, accepts a stay. Concord clock −1.

**Who wants it, and why.**
- **[[Cousin Pennamund]]** has found the four-in-ten purchases and the credit line in the House's own books (Perrin leaves him notes in the margins: see [[The Tollamund Daughters]]) and understood what the Grandmother has done. He needs the other side of the ledger to prove it to the Concord Table, which sent him to find exactly this, and it would cost her her chair. His offer is real: the slate stands at a little over three hundred gold, and he will pay it. But a book in his satchel goes to Sevenhaven, not to the Keep gate, and does the company no good in session 7.
- **[[Ansel Mote]]** wants it ash. The Treasury signs the Ninth's wages out every quarter "to Account Deferred"; the book proves, at the far end, that nothing ever arrived. With Pell's Treasury entry and a signed Form 44-A it is the proof that Marius Vell's office kept the money. First he sends a bargee nobody knows to buy it, with a purse of new Regency silver; Hennet rings one coin on the bar and looks at the cup underneath, where she keeps the one [[Dannic Rook]] paid with, and the mint year is the same. When she refuses, Mote's man comes back the night the Candle is shut for [[Halloran Pike]] (25 Ashfall, session 5), with lamp-oil for the loft. A party watching the Candle that night catches a hired knife from the Low Quay, who knows only that "a clerk" paid him. If nobody watches, the loft burns, the slate is scorched black, and the book under the bar is the thing he takes. Quiet Office +1.
- **[[Fennick Bottlebrook]]** fears it. His ledger and Hennet's disagree for four quarters: he wrote the Captain's coin in as "advance on the line" so the company would not feel like charity. Read the two books side by side and Marrow's secret is out. Told to the company, that is Mutiny −2.
- **[[Pell Quillon]]** loves it. "Non-receipt, witnessed, contemporaneous, in a hand with no interest in the outcome! I could kiss her." He doesn't. It is the evidence Form 44-A was invented for.

**Certifying it.** [[Brother Audit]] will do it for a copper to the god: one full day at the Corvex lectern, every line read aloud, the dead's tabs included, while Temple Row gathers to listen. It becomes, without anyone planning it, a wake: soldiers shouting out who drank what, and when, and with whom, and Audit pausing to dab his eyes at nine years of a slate that was never once rubbed out. He enters the certificate in his own ledger, which goes to Tollamund at the quarter's end (Longnight), too late to matter.

**How it ends.**
- **Kept and certified:** the second hole in session 7, after [[The Original Treaty]]'s page seven. Hennet does not rub anything out. She chalks PAID under each PC's name, the only PAID on the slate in nine years, and the company comes in for a week to look at it.
- **Sold to Pennamund:** every tab on the slate cleared in new Sevenhaven coin; a night at the Candle the company will talk about for years (roll back the Mutiny clock one segment: someone fed the company). Pennamund becomes a grateful and useful ally against the Grandmother. Hennet serves the party and never calls them by their tab again, because they have none, and it is the coldest thing she knows how to do. A year on, in the epilogue, Tollamund loses her chair at the Table.
- **Burned (by Hennet or by Mote):** nothing, and Hennet's silence.
:::

== GM notes ==

A paper quest with a fire in it. Its job is to make the debt personal: every name in the book is someone the players have drunk with, and the sums are coppers before they are thousands. Let the party read a few columns aloud at the table. Put a name they know in every column, and Dannic Rook's crossed out.

Hennet's line, if someone asks why "an arm": "Because that's what I paid for this company. You want my book, you can pay the same."

Timing: the offer on 20 Ashfall (session 4, market day); the reading and the asking in the days after; Mote's fire on 25 Ashfall (session 5); certification any day before 4 Leafrot; the gate on 5 Leafrot (session 7). Brother Audit, Pell and Hennet all belong on the Keep gate scene if the party brings the book. If the party also has page seven, Tollamund leaves the gate with nothing and says so, very slowly.
