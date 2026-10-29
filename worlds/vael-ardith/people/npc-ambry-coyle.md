---
type: npc
name: Ambry Coyle
players: true
summary: Gentle giant of a tannery foreman in the Smokes, who has not slept in eleven days.
parent: the-smokes
tags: [ npc, smokes ]
gmTags: [ sleepless ]
image: sil:npc-ambry-coyle
status: alive
statusKnown: true
fields:
  Ancestry: Human
  Role: Tannery foreman
  Where: The tanneries, the Smokes
gmFields:
  Faction: The Sleepless (a Waker)
  5e: "Cult fanatic, reskinned: AC 12, HP 33, tanning knife. Can't be put to sleep or charmed except by the Widow."
relations:
  - to: dreaming-widow
    kind: serves
    note: Her right hand.
  - to: f-sleepless
    kind: serves
  - to: odile-fairweather
    kind: works for
    note: The Reeve's family owns two of the vats.
    known: true
  - to: npc-marn-tolliver
    kind: pays a copper a jar to
    note: "For holding the Stillwater jars in her goat-shed."
  - to: npc-nell-harrow
    kind: holds her secret over
---

Huge, soft-spoken and kind, with tannery-brown arms, a shaved head and red-rimmed eyes ringed in shadow. Ambry Coyle runs the biggest tannery in [[The Smokes]], and the men and women under him say he's the fairest foreman in town. He has the lapels of his coat stuck full of pins, which he presses into his palm, gently, when his eyes start to close.

> "Long day, friend? Long life. Come and sit. There's tea. Nobody'll make you do anything."

His wife and daughter died of the glass-lung in 3008. He has been very tired ever since. **Wants:** to sleep, and to see them when he does. **Fears:** being woken at the wrong moment.

:::gm
Ambry is a **Waker** of [[The Sleepless]], and [[The Dreaming Widow]]'s right hand. He keeps the night watch over the cellars, carries her messages, and does the lifting. He believes, completely, that when the Sleeper wakes he'll see his daughter again. **Beat.** In sessions 4 to 5 he is sent to "invite" Tick to the cellars. He does it politely. The second time, he brings help. In session 7 he is among the Sleepless who try to snuff the lantern, and he is the one who hesitates.
:::
