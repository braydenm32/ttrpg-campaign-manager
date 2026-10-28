import type { ExPage } from '../types'

export const ITEMS: ExPage[] = [
  {
    key: 'item-lantern',
    type: 'item',
    name: 'The Lantern of the Ninth',
    players: true,
    image: 'item:item-lantern',
    heldBy: 'brother-tallow',
    summary: 'The iron-caged lamp that has burned in the Lantern Keep for nine years, and which the company\'s contract is tied to.',
    aliases: ['the lantern', 'the Ninth Lantern\'s flame'],
    fields: [
      { key: 'Value', value: 'Beyond price to the company; priceless to several others' },
      { key: 'Weight', value: 'About 30 lb in its cage; the cage is bolted to the Keep\'s inner wall' },
      { key: 'Rarity', value: 'Unique' },
      { key: '5e', value: 'Artifact-level flame. Sheds bright light 20 ft, dim 40 ft. Cannot be extinguished by water, wind or ordinary magic. Any creature within 10 ft that makes a Wisdom save (DC 14) at dusk hears a murmur. Dousing it requires the Ward Shard to be removed.', gm: true },
    ],
    tags: ['relic', 'arc'],
    relations: [
      { to: 'item-shard', kind: 'is lit by', note: 'The flame burns on a splinter of the Ninth Stone.', known: false },
    ],
    body: `In the highest room of [[The Lantern Keep]] hangs a plain iron cage the height of a child, and inside it burns a flame about the size of a man's fist. It is gold at the heart, white at the edges, and it does not smoke. It has not gone out in nine years.

### What it looks like
The cage is black iron, riveted, with a hinged door and three locks ([[The Lantern's Cage Keys]] open them). Inside sits a squat brass lamp, dented, patched with solder, and once a cook's. The flame stands above it without a wick, the way a candle might if it believed in itself. There is no oil in it that anyone has seen, though the company pours a measure into the bowl each dawn, and the bowl is always dry by evening.

### What the company says
Soldiers touch the cage for luck. Recruits are made to hold their hand near it, to feel the warmth. Veterans swear on it. The old orcs will not look at it directly. The contract says the Ninth garrisons the Ashenreach until the lantern goes out, and every soldier knows what that means: if it dies, they are free, and nobody can say whether that is a promise or a threat.

### What it does
Quietly, it comforts. People who sleep near it sleep badly but wake with strange clarity. Animals avoid it. The ash will not settle in the room. Anyone who stares into it long enough hears something under the crackle, like a breath held by someone far below.

:::gm
The flame burns on a splinter of the Ninth Stone ([[The Ward Shard]]), set in the lantern's iron base beneath the cage, under the lamp's bowl, and long since fused to it. Mother Hennet carried it up from the orchard in a soup-pot the night the lantern was lit, and Brother Tallow has kept it there since. The splinter keeps the crack in the Ninth Ward from widening. That is why the flame needs no oil, and why the oil that Dannic Rook cut with ash was killing it: the ash fouled the lamp, and the flame guttered because the stone behind it was dimming.

The Sleeper Below hears the flame. Anyone who holds it for long, or who is called by it, begins to hear the Sleeper in dreams, and slowly to become its voice. Ysse feels this already. The Saint wants the flame to feed on. The Concord wants it as a key to the Ness. The Quiet Office wants it for the Regency. The Mothers want it left alone.

If the flame goes out, the crack opens; the dead walk. If the flame is carried away from the stone, it dims. If it is taken by someone willing to bear it, they become a leash on the Sleeper, and the Sleeper's mouthpiece in the same moment.

Running the flame: it gutters when the Ember is full, when a Hollowborn dies near it, when the oil is poisoned, and when the company loses hope. It brightens when someone tells the truth in the Keep. It never goes out during play unless the PCs choose an ending that demands it.
:::`,
    gmNotes: `This is the heart of the arc. Show it in every session: Tallow tending it, a sentry resting a hand on the cage, a stray draught that does nothing. When it gutters (first at the end of session 1), do it plainly: the shadows lean, the room goes cold, Tallow stops mid-sentence. Never explain it. The three possible endings all turn on what a PC does when they stand in front of it.`,
  },
  {
    key: 'item-shard',
    type: 'item',
    name: 'The Ward Shard',
    image: 'item:item-shard',
    heldBy: 'item-lantern',
    summary: 'A splinter of the Ninth Stone, blown loose in the Battle of Cinders, burning inside the lantern and holding the crack shut.',
    fields: [
      { key: 'Value', value: 'Priceless; a ward is worth a kingdom' },
      { key: 'Weight', value: 'About the weight of a cooking spoon' },
      { key: 'Rarity', value: 'Unique' },
      { key: '5e', value: 'Relic. Attuning requires a DC 18 Wisdom save and risks losing a point of Wisdom per day. A creature that holds it can cast detect magic at will, and speak with dead once per long rest, but the Sleeper hears everything they hear.', gm: true },
    ],
    tags: ['relic', 'arc', 'ward'],
    relations: [
      { to: 'item-lantern', kind: 'is the heart of', known: false },
    ],
    body: `A sliver of grey stone, hard as bone and rough as a quarry floor, about the length of a finger. It is cold in the hand even when it lies in a fire. Held to the light, it shows faint lines like the veins in a leaf. It hums, very quietly, if you press it to your ear.

### What it is
When the Battle of Cinders broke the Ninth Ward, a piece of the [[The Ninth Stone|Ninth Stone]] flew free in the blast and landed in the embers of the Ruddy Hundred's cookfire, at the cooks' camp in what is now [[The Weeping Orchard]]. It burned there without wood. Mother Hennet lit the lantern from that fire and carried the stone itself up to the Keep in a soup-pot, and [[Brother Tallow]] has kept it under the lantern's cage ever since.

### What it holds
The Ninth Ward is the work of one of the Nine, who poured their divinity into the stone to bury a god. That stone is cracked, and the Shard is part of it still. While it burns, a thread of the ward remains whole; take it away, and the crack spreads.

:::gm
The Shard is a piece of the anchoring heart of the Ninth Ward. It is awake in the way a sleeper is awake: aware, patient, and hungry for company. It answers the Sleeper's dreams with its own. Brother Tallow suspects; [[Warden Uthrem]] knows. A willing living heart could be bonded to the Shard in the Ninth Stone to reseal the ward (the Reseal ending); an unwilling hand could pull it out and use it as a leash (the Use It ending); and a destroyed or removed Shard opens the crack (the Let It Crack ending).

Revelation order: first Tallow's dreams, then Ysse's, then Uthrem's confession in session 6. The Shard should not leave the lantern until the final night unless the PCs break the lamp.
:::`,
    gmNotes: `Keep the Shard hidden in plain sight. Players may see a lump of grey stone at the heart of the flame and think nothing of it. Hint through the cold: it is the only cold thing in the room. When someone touches it, the Sleeper takes an interest. Never let a faction have it before session 8 without a good reason.`,
  },
  {
    key: 'item-oil-tin',
    type: 'item',
    name: 'The Cut Oil Tin',
    players: true,
    image: 'item:item-oil-tin',
    heldBy: 'party',
    summary: 'A dented tin of lantern oil cut with ash, found with the drowned deserter in the Glass Barrow.',
    fields: [
      { key: 'Value', value: '2 silver as scrap; much more as evidence' },
      { key: 'Weight', value: '1 lb' },
      { key: 'Rarity', value: 'Common' },
    ],
    tags: ['clue', 'poison'],
    body: `A small dented tin, stamped with the broad arrow of the Regency quartermaster, half full of a grey slurry that was once clear oil. It smells of lamp-smoke and old fires. A rag is stuffed under the lid. The label has been scratched off, but the tin has a company mark on the base, a little ring of eight dots around a ninth.

### What it is
Lantern oil, mixed with fine ash. It will burn, but badly, with a sooty flame that leaves a crust on the wick. Poured into the Ninth's lantern, it would dim the flame within a few weeks.

### Clues
The ash is not from a cookfire or a kiln. It is the pale, fine ash of the plain, the kind found only near the Rent. The tin was stolen from the Keep stores: its serial is in the quartermaster's ledger. The cut was done carefully, by someone who knew what they were doing.

:::gm
Dannic Rook stole the oil a week before session 1, cut it, and ran. Someone paid him to do it. Spoons Aldane knows who: he has seen the same hand on the oil barrels and has said nothing, because he has money on the outcome. Fennick suspects the tin was supposed to be found. The ash itself came from the Smokes, where the Sleepless sell ash from the Rent to pilgrims as a charm.
:::`,
    gmNotes: `A clue, not a macguffin. Let the party find the tin in the Glass Barrow, hold it up to the light, and ask questions. Every faction wants a different answer: the Quiet Office wants it to be the Sleepless, the Sleepless want it to be the Church, and the Church wants it to be Sallow.`,
  },
  {
    key: 'item-door-key',
    type: 'item',
    name: 'Hathe\'s Door-Key',
    image: 'item:item-door-key',
    heldBy: 'mother-corvane',
    summary: 'A black iron key that opens any door the dead have closed, kept by the Rook-Court since the god of doors died.',
    fields: [
      { key: 'Value', value: 'Priceless to the Rook-Court' },
      { key: 'Weight', value: 'Under 1 lb' },
      { key: 'Rarity', value: 'Unique' },
      { key: '5e', value: 'Relic. Once per long rest, the wielder can cast knock, or open a door the dead have closed (a ghost, a sealed tomb, a crypt) automatically. The key is warm in the presence of a restless dead.', gm: true },
    ],
    tags: ['relic', 'raveler'],
    body: `A plain key of black iron, about the length of a hand, with a bow shaped like a closed door. The teeth are worn smooth. It hangs on a leather cord and is always slightly cold, as though it were somewhere else.

### What it is
One of the keys Hathe, Keeper of Doors, handed to the first Raveler priests. When the god died at Cinders, the keys stopped answering. This one, kept in [[The Doorkeeper's Chapel]], is the only one that still does.

### What it does
It opens anything a dead person closed: a locked tomb, a grave sealed by a curse, a door in the house of a ghost. It does nothing to ordinary locks. When the dead are near it, the iron warms, and the bow seems to blink.

:::gm
Hathe did not die by accident. Ilyra drank his dying power. The key still carries a thread of that power, and anyone holding it feels a cold pull from Halcyra. [[Mother Corvane]] will lend it to a PC she trusts for a good reason, such as opening a sealed grave, but not for long. The Saint's envoy would pay anything for it.
:::`,
    gmNotes: `Use it as a reward for earning the Rook-Court's trust. A good moment: the key warms in the Weeping Orchard, or opens the Glass Barrow's last door, which no living hand could.`,
  },
  {
    key: 'item-treaty',
    type: 'item',
    name: 'The Original Treaty',
    players: true,
    image: 'item:item-treaty',
    heldBy: 'treaty-stone',
    summary: 'The Treaty of Ashes in its first, signed form: eight pages of vellum, nine seals, and one clause nobody has read.',
    fields: [
      { key: 'Value', value: '300 gold to a collector; more to a lawyer' },
      { key: 'Weight', value: '2 lb in its case' },
      { key: 'Rarity', value: 'Unique' },
    ],
    tags: ['document', 'history'],
    body: `Eight pages of fine vellum, folded in thirds, in a case of waxed oak. The signatures run in a ragged column at the foot of the last page, and beside each is a seal: Regency, Concord, Iskaveth, Grimmark, Sael, the Mothers of the Iron, and three for claimants who no longer exist. The ink has gone brown.

### What it says
The signatories agree that the Ashenreach shall be neutral, garrisoned by mercenary companies paid jointly by all. The Ninth Lantern's contract is attached as a schedule. There is a clause on tolls, one on grazing, one on the movement of pilgrims, and one on pay, which is longer in this copy than in any other. Page six is mostly a list of the dead.

### What people do with it
Lawyers quote it. Pilgrims touch the case. Regency clerks have copies made of the signature page. The company keeps its copy in the Keep. The original is kept at the Treaty Stone, behind a grille, and nobody has read page seven.

:::gm
Page seven is a clause for "the keeping of the Ninth Ward", signed by the Mothers and the Last Wardens alone, in a hand the other signatories did not see. It names the lantern, calls it a "temporary seal", and assigns the Ninth Lantern a duty no clerk has understood: that it shall be "kept lit by those who do not know why". It is the closest thing the world has to an explanation.

The pay clause is the other secret, and it is not on page seven. In the original, and in no public copy, the garrison is to be paid *by the signatories, or by whosoever shall hold their debt*. A Raveler witness scratched those words into the glass at [[The Treaty Stone]] so they could not be lost. Tollamund wrote them, and they are why the Concord, buying up the Regency's paper, becomes in law the garrison's new master. Page seven binds the company to the flame; the pay clause sells the company to whoever owns the debt.
:::`,
    gmNotes: `Use as a paper trail to raise the stakes, or as a prop in session 7 when the factions fight over legal claims. Page seven should be uncovered by someone who reads carefully, probably Pell Quillon.`,
  },
  {
    key: 'item-cage-keys',
    type: 'item',
    name: 'The Lantern\'s Cage Keys',
    players: true,
    image: 'item:item-cage-keys',
    heldBy: 'brother-tallow',
    summary: 'Three iron keys for the three locks on the lantern\'s cage, held by three people who do not trust each other.',
    fields: [
      { key: 'Value', value: 'Nothing, until someone wants the lantern' },
      { key: 'Weight', value: '1 lb the set' },
      { key: 'Rarity', value: 'Unique' },
      { key: '5e', value: 'Thieves\' tools DC 20 to pick any lock, but the cage is warded: opening it without a key triggers a faint chime audible throughout the Keep.', gm: true },
    ],
    tags: ['company', 'keys'],
    body: `Three keys, hand-forged, stamped with a stylised flame. Each fits one of the three locks on the iron cage in the Lantern Keep. By custom, one is kept by the lamp-keeper, one by the captain, and one by the Second Blade, and the cage is never opened unless all three are present.

### What they are used for
Opening the cage to tend the flame, to pour the dawn measure, and to clean the soot from the bars. This happens once a day. Tallow carries the first key on a cord around his neck; [[Captain Marrow]] carries the second; [[Sergeant Vosk]] carries the third.

### Who wants them
Anyone planning to steal, douse, or move the flame. The keys also work as a test of trust: whoever refuses to hand theirs over has something to hide.

:::gm
Sallow has had a copy of the second key made by the Quiet Office. Mote has a copy of the third. Neither works on the first lock, which is why Tallow's key is the one that matters. If Tallow collapses in session 3, someone will need to take his key from his neck.
:::`,
    gmNotes: `Give the players a scene where all three keys are in one room and everyone is holding their breath. Tallow collapsing with the key on his chest is a good session 3 beat.`,
  },
  {
    key: 'item-lantern-token',
    type: 'item',
    name: 'Ninth Lantern Brass Token',
    players: true,
    image: 'item:item-lantern-token',
    heldBy: 'party',
    summary: 'A stamped brass disc proving you belong to the company, and entitling you to a bowl of soup.',
    fields: [
      { key: 'Value', value: '1 copper in trade; priceless to a deserter' },
      { key: 'Weight', value: 'Negligible' },
      { key: 'Rarity', value: 'Common' },
      { key: '5e', value: 'Wearing a token grants advantage on Persuasion checks with company members and a free ration at the Keep (if the quartermaster has one).', gm: true },
    ],
    tags: ['company', 'gear'],
    body: `A palm-sized disc of stamped brass, hung on a leather cord. One side shows a cage and a single flame; the other is numbered. Every member of the Ninth carries one. Recruits get theirs on the night they first stand watch.

### How it is used
It is a pass at the Keep gates, a receipt at the quartermaster's, and a ticket for a hot bowl at the mess. A soldier who loses theirs is docked a week's soup. A soldier who sells theirs is flogged, or worse.

### Quirks
The tokens are made in lots by a tinsmith on Lantern Hill, and the lots have faults. The old ones are worn smooth; some say you can read the numbers with your thumb in the dark. Soldiers rub them for luck. When a member dies, the token goes to the Rook-Court with the body. Some are never returned.

:::gm
Four tokens are unaccounted for since the Siege of Ardmere. If one is found, it could belong to a ghost, a thief, or an ancestor. A forged token is a good hook for a Quiet Office infiltrator.
:::`,
    gmNotes: `Give each PC a token on the night they first stand watch. A token left behind in the Glass Barrow, or found on a corpse, is an excellent small mystery.`,
  },
  {
    key: 'item-grumblers',
    type: 'item',
    name: 'Grumblers',
    players: true,
    image: 'item:item-grumblers',
    quantity: 3,
    summary: 'Clay-shelled alchemical shot that rumbles for a few seconds before it goes off; known to go off early.',
    fields: [
      { key: 'Value', value: '12 silver each' },
      { key: 'Weight', value: '2 lb each' },
      { key: 'Rarity', value: 'Uncommon' },
      { key: '5e', value: 'Thrown, range 20/40. 10 ft radius, Dex save DC 13 or 2d6 thunder and prone. 1-in-6 chance it detonates in the hand (roll when it is drawn). Duds 1-in-10.', gm: true },
    ],
    tags: ['munitions', 'alchemy'],
    body: `A fist-sized ball of grey clay, wrapped in oiled cord and capped with a waxed plug. The plug is pulled with a thumb, and the thing begins to grumble: a low, wet noise like a bear complaining in its sleep. After a few heartbeats it goes off with a flat crack that knocks over anyone nearby.

### What it is for
Breaking up a charge, clearing a doorway, making soldiers lie down. Sappers love them and sergeants do not.

### The catch
Nobody has ever got the timing right. A grumbler thrown at the right moment is a gift from the gods; one that goes early takes your hand. Veterans listen to the rumble and throw on instinct. New recruits learn the hard way.

### Quirks
The Ninth's sappers keep a tally on the wall of the powder store: "days since a grumbler took someone". It has been three days for as long as anyone can remember.

:::gm
Tick Marlowe invented the current recipe. The older, worse version used sulphur from the Smokes and killed two sappers. Tick's version is merely unreliable. He keeps a spare in his sleeve, which he does not mention to Fennick.
:::`,
    gmNotes: `Use for comedy and tension in equal measure: a grumbler rumbling in a pocket at the wrong moment is good for a laugh and a Dex save.`,
  },
  {
    key: 'item-thunderjars',
    type: 'item',
    name: 'Thunderjars',
    players: true,
    image: 'item:item-thunderjars',
    quantity: 2,
    summary: 'Sealed glass jars of alchemical powder that explode when shaken, dropped, or looked at sternly.',
    fields: [
      { key: 'Value', value: '30 silver each' },
      { key: 'Weight', value: '3 lb each' },
      { key: 'Rarity', value: 'Uncommon' },
      { key: '5e', value: 'Thrown, range 20/40. 15 ft radius, Dex save DC 14 or 4d6 thunder, half on a success, and deafened for 1 minute. Falling more than 10 ft while carrying a jar: it explodes.', gm: true },
    ],
    tags: ['munitions', 'alchemy'],
    body: `A squat jar of thick green glass, stoppered with wax and bound in leather. Inside, a fine grey powder shifts like slow water. Carry it gently. Keep it cool. Do not drop it.

### What it is for
Breaking walls, clearing tunnels, making a very loud point. A thunderjar bursts with a crack that is heard in the next valley. Whatever stands near it is flattened, deafened, or both.

### The catch
They are unstable. Shaking one is a bad idea, and so is putting it down quickly. The Ninth's sappers wrap them in rags and carry them in a bucket of sand, and never in a pocket. A jar left in the sun for a Highsun afternoon is a story the sappers tell in hushed tones.

### Quirks
The glass is salvaged from the glasslands. Some jars are slightly warm when picked up. Some are slightly cold. Nobody has yet found out why, and nobody has asked the glass.

:::gm
One of the jars in the Keep's stores has a hairline crack. It is the one at the back. Fennick knows and has not told anyone because the alternative is paying for a new one.
:::`,
    gmNotes: `Use as a ticking clock in any scene where the party must move fast with cargo. A thunderjar in a leaky cart on a rough road is a scene all on its own.`,
  },
  {
    key: 'item-widows-kisses',
    type: 'item',
    name: 'Widow\'s Kisses',
    image: 'item:item-widows-kisses',
    quantity: 6,
    summary: 'Poisoned caltrop-darts that look like sweets and are sold, with a straight face, as such.',
    fields: [
      { key: 'Value', value: '8 silver each' },
      { key: 'Weight', value: '1/4 lb each' },
      { key: 'Rarity', value: 'Uncommon' },
      { key: '5e', value: 'Thrown or scattered. Creatures entering the square take 1 piercing and must make a DC 12 Con save or be poisoned for 1 hour. Handling without gloves: Con save DC 10 or poisoned.', gm: true },
    ],
    tags: ['munitions', 'poison'],
    body: `A small twist of paper holding a dozen red-lacquered burrs, each the size of a thumbnail and sharp as a thorn. They rattle faintly. They smell, of all things, of cinnamon.

### What they are for
Scattered across a doorway or a road, they pierce a boot and put a man on his knees within a minute. They are sold in the Smokes and on the Low Quay as "Widow's Kisses", with a wink, to people who do not need to be told what they are for.

### The catch
The poison is carried in the lacquer and does not require a wound. A careless sapper who picks them up barehanded spends a bad afternoon being sick on the parade ground. A careful one wears gloves, and the gloves are burned afterwards.

### Quirks
A packet of kisses was left on the Ninth's gate one morning with a note: "For the lieutenant." Nobody has been able to find who wrote it, though Spoons has a notion.

:::gm
Tick would never use these on a person; he uses them on animals and, once, on a door. The Sleepless have a stash of them, intended for the day the Church's pilgrims arrive. The packet at the gate was Mote's idea of a joke, or a test.
:::`,
    gmNotes: `Use for traps and for atmosphere. Do not let the party poison a named NPC without the consequences reaching them later.`,
  },
  {
    key: 'item-marigolds',
    type: 'item',
    name: 'Marigolds',
    players: true,
    image: 'item:item-marigolds',
    quantity: 4,
    summary: 'Painted clay smoke-pots that burst into orange clouds, named by a sergeant who had a sense of humour.',
    fields: [
      { key: 'Value', value: '6 silver each' },
      { key: 'Weight', value: '1 lb each' },
      { key: 'Rarity', value: 'Common' },
      { key: '5e', value: 'Thrown, range 30. Creates a 20-ft-radius sphere of heavy obscurement for 1 minute. Burning creatures in the cloud take 1d4 fire (the dye catches).', gm: true },
    ],
    tags: ['munitions', 'alchemy'],
    body: `A small round pot of orange-painted clay, stoppered with cork. Throw it and it bursts into a thick marigold-coloured cloud that smells of pepper and wet hay. It hangs in the air for a minute, coating the tongue and hiding everything inside it.

### What they are for
Covering a retreat, hiding a fight, blinding a sentry. The Ninth uses them on parades, too, for the colour. The captain has asked them to stop.

### The catch
The dye is flammable. A stray spark in a marigold cloud makes a very pretty fireball. The sappers know to keep their lamps out of the smoke, and the recruits learn quickly.

### Quirks
The name came from Sergeant Vosk, who looked at the first batch and said, "They look like flowers on a grave." The sappers took it as a compliment. Civilians find them cheerful.

:::gm
Marigold residue turns Hollowborn eyes pale for an hour. Tick has used this to find out who is Hollowborn and who is pretending. The Church of the Unburnt Saint has noticed.
:::`,
    gmNotes: `A friendly item that adds colour and a small risk. Good for a chase through the Smokes.`,
  },
  {
    key: 'item-glass-hand',
    type: 'item',
    name: 'The Glass-Fused Hand',
    image: 'item:item-glass-hand',
    heldBy: 'gutter-market',
    summary: 'A Lithic hand sealed in green glass that still opens and closes, and has begun to point.',
    fields: [
      { key: 'Value', value: '400 gold to a collector; the Remembrancers will pay more' },
      { key: 'Weight', value: '6 lb' },
      { key: 'Rarity', value: 'Very rare' },
      { key: '5e', value: 'Construct (reskinned animated armour), CR 1. AC 18, HP 33. It cannot speak. It points toward the Ninth Stone, and if lifted by a Lithic or a wizard, grips the bearer (DC 13 Strength to break free).', gm: true },
    ],
    tags: ['salvage', 'lithic'],
    body: `A right hand, half again as large as a man's, carved from grey stone and sealed inside a block of green glass. Each finger is jointed at the knuckle. The glass is warm, and slightly sticky, and if you watch it patiently, you will see the thumb flex.

### Where it came from
It was dug from the glasslands near Fort Mercy by a Glasser crew who did not stay to see what it did next. It is now for sale in [[Gutter Market]] at a price that rises each time someone asks.

### What it does
It opens and closes, slowly. In the dark it points. The stallholder says it points toward whatever it wants most. In daylight it merely twitches.

:::gm
The hand belonged to a Lithic Stander at the Ninth Ward who was shattered in the Battle of Cinders. It is still awake, in the way the Lithic are, and it points toward [[The Ninth Stone]]. [[Warden Uthrem]] would know it. Aelith Sorn would pay anything for it. The hand will attach itself to a Lithic PC or NPC, and speak in their sleep, which is its own problem.
:::`,
    gmNotes: `Use as an uncanny prop: stage the hand in a market scene and let it move once. Later it can guide the party to the Rent if they carry it.`,
  },
  {
    key: 'item-melted-crown',
    type: 'item',
    name: 'The Melted Crown',
    image: 'item:item-melted-crown',
    heldBy: 'vexa-glassjaw',
    summary: 'A gold circlet slumped and fused with green glass, said to belong to an emperor who is not yet dead.',
    fields: [
      { key: 'Value', value: '600 gold as scrap; priceless to claimants' },
      { key: 'Weight', value: '3 lb' },
      { key: 'Rarity', value: 'Rare' },
      { key: '5e', value: 'A wearer who is of imperial blood gains advantage on saves against being frightened; others suffer a headache and a vision (DC 12 Wisdom save).', gm: true },
    ],
    tags: ['salvage', 'imperial'],
    body: `A gold circlet, thick as a thumb, that has slumped sideways like a candle left too near the fire. Green glass has run into the tines and set there, so that the points of the crown look like frozen tears. A single sapphire is still intact. The inner band has a faint inscription in imperial script.

### Where it came from
Vexa Glassjaw's crews dug it from the glass at Fort Mercy and have been trying to sell it ever since. The inscription reads, in the old tongue, "Aurel the Ninth, Crowned Sun's Heir". The Regency would very much like it back.

### What it does
Nothing, if you are sensible. Put it on and you hear a distant, grave voice counting. It stops when you take it off.

:::gm
The crown is a ward-sensitive relic. Marius Vell has been trying to find it for two years, and the Council's claimant would hear the Sleeper more clearly with it. The Glassers have no idea, but Vexa suspects something and is holding out for a better price. The Church of the Unburnt Saint has made an offer.
:::`,
    gmNotes: `A prop for a bidding war. Three factions want it for different reasons, none of which are about gold.`,
  },
  {
    key: 'item-noose-charm',
    type: 'item',
    name: 'The Hanged Corporal\'s Noose-Knot Charm',
    players: true,
    image: 'item:item-noose-charm',
    heldBy: 'mirrel-vosk',
    summary: 'A knot of old rope soldiers wear against bad officers; lately, it has begun to work.',
    fields: [
      { key: 'Value', value: '1 silver; priceless to a soldier who wears one' },
      { key: 'Weight', value: 'Negligible' },
      { key: 'Rarity', value: 'Uncommon' },
      { key: '5e', value: 'Wearer gains advantage on a saving throw against an order that would compel them to harm an innocent, once per long rest.', gm: true },
    ],
    tags: ['relic', 'soldiers'],
    body: `A small knot of hemp rope, black with handling, tied in the shape of a noose and strung on a leather cord. It is worn under the shirt, close to the skin. Soldiers say it is cut from the rope that hanged the Corporal, though they would say that about any rope.

### Where it came from
The Hanged Corporal refused an order to burn a village and was hanged for it. Soldiers began to pray to him out of spite. They tie the knot, hang it on a nail above their bunk, and swear that on bad days it grows warm.

### What it does
When an officer gives an order the wearer does not want to follow, the knot tightens. Sometimes the wearer finds the strength to say no. Sometimes they just feel the knot, and their hand stays still.

:::gm
The charm is an early sign of the Hanged Corporal's ascension. It does what it says now. A PC wearing one will find that being ordered to do something wicked becomes harder than it ought. [[Sergeant Vosk]] wears two. Lieutenant Sallow has one that has never worked, which has made him very nervous.
:::`,
    gmNotes: `Hand these out to soldiers as small tokens of loyalty. They do not solve problems; they make the PCs notice what they are being asked to do.`,
  },
  {
    key: 'item-saint-candle',
    type: 'item',
    name: 'The Saint\'s Candle-Stub',
    image: 'item:item-saint-candle',
    heldBy: 'seraphine-ashe',
    summary: 'A white candle-stub from Halcyra that burns without smoke and warms whoever holds it too much.',
    fields: [
      { key: 'Value', value: '50 gold to the faithful' },
      { key: 'Weight', value: 'Negligible' },
      { key: 'Rarity', value: 'Rare' },
      { key: '5e', value: 'Lit for 1 hour, it casts a calm emotions effect on all within 10 ft (Cha save DC 14 to resist). A creature that has been calmed by it three times is charmed by the bearer until the next dawn.', gm: true },
    ],
    tags: ['relic', 'church'],
    body: `A stub of white wax no longer than a thumb, stained pale gold around the wick. It burns without smoke and without a drip, and smells faintly of honey. The flame is the colour of a winter afternoon.

### Where it came from
[[Sister Seraphine]] carries it from Halcyra, blessed in the Saint's own house, and offers it to the dying, the frightened, and the unhappy. She lights it, sets it beside the bed, and sits with them until it burns down. Everyone who has held it describes the same thing: a warmth, a sense of being wanted.

### What it does
It makes pain a little less sharp and fear a little less loud. It also makes you very much want to be where the candle is.

:::gm
The candle is a conduit for the Saint's regard. Ilyra can hear what is said near it. A PC who sits with the candle three times is touched by the Saint, and the Saint will remember them. The Church gives these out freely; they are the cheapest form of recruitment in the world.
:::`,
    gmNotes: `A temptation more than a weapon. Let the candle genuinely help a dying soldier, and let that be a problem.`,
  },
  {
    key: 'item-velvet-token',
    type: 'item',
    name: 'Velvet Ledger Token',
    image: 'item:item-velvet-token',
    heldBy: 'velvet-ledger',
    summary: 'A black velvet-wrapped coin that buys a night at the Velvet Ledger, and a secret from Isaurana\'s house.',
    fields: [
      { key: 'Value', value: '20 gold' },
      { key: 'Weight', value: 'Negligible' },
      { key: 'Rarity', value: 'Uncommon' },
      { key: '5e', value: 'Present at the door of the Velvet Ledger for entry. Grants advantage on Insight and Persuasion checks with the house\'s staff for one night.', gm: true },
    ],
    tags: ['gear', 'secrets'],
    body: `A thick copper coin wrapped in black velvet and sealed with a drop of dark wax. The wax bears the print of a veil. It is warm to the touch, and no one is certain why.

### What it buys
Entry to [[The Velvet Ledger]], the pleasure-house of [[Isaurana]] on Temple Row. A token buys one night of good company, good wine and perfect discretion. It also buys, if you ask correctly, a secret.

### How it is given
By Madame Vey herself, to people she wants to meet, people she wants to owe her, and people whose secrets she already holds. Nobody has ever been refused a token, and no one has ever been refused anything inside.

:::gm
Each token is tracked in the Ledger. Whoever receives one becomes an entry. The secret you buy is never free: Sorrel Vey asks for another in exchange. She is also collecting information about the lantern, and about the elves who ask after her tattoos.
:::`,
    gmNotes: `A gift to a PC who impresses Madame Vey. Let it open a scene where the PC must buy a secret, and pay for it.`,
  },
  {
    key: 'item-promissory-note',
    type: 'item',
    name: 'The Concord Promissory Note',
    players: true,
    image: 'item:item-promissory-note',
    heldBy: 'tollamund',
    summary: 'The paper that says the Ninth Lantern owes Tollamund & Daughters more than it will ever earn.',
    fields: [
      { key: 'Value', value: '4,800 gold owed, compounding' },
      { key: 'Weight', value: 'Negligible' },
      { key: 'Rarity', value: 'Common, but dangerous' },
    ],
    tags: ['debt', 'concord'],
    body: `A single sheet of heavy Concord paper, watermarked with seven coins and a scale. It is signed by Captain Ilse Marrow on behalf of the Ninth Lantern, countersigned by Fennick Bottlebrook, and sealed with the House of Tollamund. The terms are in a small, perfectly neat hand.

### What it says
The Ninth Lantern borrows money for rations, powder and the rebuilding of the Keep walls. Payment is due on the quarter-day, with interest at a rate that looks reasonable until the third line. If the company fails to pay, the Concord may claim "the company's possessions, contracts and standing" in satisfaction. A clause at the bottom is underlined in red: "including the lantern".

### Who holds it
[[Grandmother Tollamund]] keeps it in a small locked box under her desk. She reads it every morning, slowly, as other people read scripture.

:::gm
The note was written by Tollamund herself. The clause about the lantern was added after the first draft. Marrow has seen it and signed anyway, because the company was starving. Fennick has been juggling the books to keep the due date from falling on a day the company cannot cover. The Debt clock ticks on this paper.
:::`,
    gmNotes: `A prop for a pivotal scene: Tollamund, speaking very slowly, reading the clause aloud. Make the party wait through the whole sentence.`,
  },
  {
    key: 'item-last-words-ledger',
    type: 'item',
    name: 'Quorl\'s Ledger of Last Words',
    image: 'item:item-last-words-ledger',
    heldBy: 'quorl',
    summary: 'A tall black book in which Quorl records the last words of the company\'s dead, one line per soldier.',
    fields: [
      { key: 'Value', value: 'Priceless to the Rook-Court' },
      { key: 'Weight', value: '4 lb' },
      { key: 'Rarity', value: 'Unique' },
      { key: '5e', value: 'Reading it aloud in order grants advantage on saving throws for 1 hour, once per day, and draws the attention of the dead.', gm: true },
    ],
    tags: ['ravelers', 'arc'],
    body: `A tall, narrow ledger bound in black cloth, its edges soft with handling. Each page is ruled into columns: date, name, rank, cause, and a long narrow space for the words. A line of Quorl's cramped, bird-like hand records every soldier the Ninth has buried in nine years.

### What it contains
Names, mostly. Some words are mundane ("Tell my brother the dog was his"). Some are rude. Some are quiet. Some are prayers. A few are in languages Quorl does not speak and has copied phonetically, at the cost of his sleep.

### How it is kept
Quorl copies every entry up the chain to [[Mother Corvane]] once a month. The Court has done this for every battlefield since the war. They are the only archive of the dead the world has.

:::gm
Seven of the entries, spread across years, say the same sentence in different voices. Read together with the other Court ledgers, the whole record spells "the lamp is the lock". Quorl has not yet put it together; Corvane has. If the ledger is stolen, burned, or read aloud at the wrong place, the dead listen.
:::`,
    gmNotes: `A quiet, haunting prop. In session 5, let the players hear lines from the ledger one at a time until the pattern appears.`,
  },
]
