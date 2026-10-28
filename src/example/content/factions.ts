import type { ExPage } from '../types'

export const FACTIONS: ExPage[] = [
  {
    key: 'f-ninth-lantern',
    type: 'faction',
    name: 'The Ninth Lantern',
    players: true,
    image: 'crest:f-ninth-lantern',
    summary: 'The unpaid company that holds Cinderford, bound by contract to stand down only if its lantern goes out.',
    fields: [
      { key: 'Crest', value: 'A black iron cage on grey, with one small gold flame inside a ring of eight dark ones' },
      { key: 'Seat', value: 'The Lantern Keep, Lantern Hill' },
      { key: 'Leader', value: 'Captain Ilse Marrow' },
      { key: 'Strength', value: 'About 140 sworn, mixed peoples' },
      { key: 'Contract', value: 'Garrison the Ashenreach until the lantern goes out' },
    ],
    aliases: ['The Ninth', 'the company'],
    tags: ['company', 'garrison'],
    relations: [
      { to: 'f-concord-houses', kind: 'owes money to', note: 'Tollamund & Daughters holds the company paper.', known: true },
      { to: 'f-mothers', kind: 'licensed by', note: 'The company holds its writ from the Mothers, and loses it if it breaks contract.', known: true },
      { to: 'f-regency-council', kind: 'unpaid by', note: 'The pay stopped in 3009 and the forms did not.', known: true },
      { to: 'f-rook-court', kind: 'buries its dead with', known: true },
    ],
    clocks: [{ name: 'Mutiny', segments: 6, filled: 1, known: true }],
    body: `The Ninth Lantern holds [[Cinderford]] and the road through [[The Ashenreach]]. About 140 soldiers, orcs and humans and dwarves and halflings and anyone else the war left over, quarter in [[The Lantern Keep]] on [[Lantern Hill]]. They have not been paid in a season. They are still here, which is the first thing to understand about them.

### The legend
Everyone in Cinderford tells it and no two tellings match. This is the company's.

Eight companies swore to hold the walls on the night of the Battle of Cinders: the Salt Guard, the Iron Tithe, Greywake's Spears, the Ruddy Hundred, and four more whose names the war ate. Each hung a lantern on the wall so the others would know it still stood. Then the sorcery came and the plain burned, and by dawn all eight lanterns were dark.

A ninth burned on. Nobody had counted it. It was lit from the cooks' last coal, at the cooks' camp in what is now [[The Weeping Orchard]], by Mother Hennet, who ran the Ruddy Hundred's kitchen. A deserter named Pike, who had come back across the ash because he could not stand being the only one alive in a ditch, carried it up to the Keep, and a boy of the walking wounded with a burnt hand and no company of his own followed it. They had no banner and no oath. They wanted a light in the window for the ones still coming home. At dawn the survivors of eight broken companies found one flame and followed it. The treaty clerks wrote down a ninth company because there was a ninth lantern.

Mother Hennet lost an arm that night and keeps [[The Last Candle]] now. Pike, the story goes, walked into the Rent three years later and was not seen again. The boy with the burnt hand is [[Brannoc Saltash]], who cooks for the company and will show you the scar if you ask, and not if you don't.

The Ninth's contract says it garrisons the Ashenreach until the lantern goes out. It has not gone out in nine years. Soldiers touch the cage for luck, and swear on it when they mean it.

:::gm
The legend is true and incomplete. The coal did not light the flame. A splinter of the Ninth Stone, blown loose in the blast, lay in Mother Hennet's cookfire and set the coal alight, and the lantern's flame has burned on that splinter ever since ([[The Ward Shard]]). Hennet carried the splinter up to the Keep that night in a soup-pot, and [[Brother Tallow]] has kept it under the lantern's cage since. The flame is part of what holds the crack in the Ninth Ward shut. Nobody in the company knows what the stone is, and Tallow only suspects. The contract is therefore a trap: if the lantern goes out, the company stands down and the crack opens.

Pike never went into the Rent. He walked as far as its lip, lost his nerve, and came back two years later with a beard and a limp to sign on under his own name, Halloran Pike; there are a great many Pikes, and nobody looked twice. Hennet knew him the first night and has never said, and he drinks free at the Candle. He is the old soldier who dies in his cot in session 5 and sits up at his own funeral ([[The Funeral That Would Not End]]), and his confession tells the rest.
:::

### Structure and ranks
Ten soldiers make a **tally**; fourteen tallies make the company. New recruits are **wicks** until they stand a night watch beside the cage. Above them sit corporals, sergeants, lieutenants, the **Second Blade** (the captain's deputy, by orc custom) and the captain. The **lamp-keeper** answers to nobody but the flame, and the quartermaster answers to everybody.

### Officers
- [[Captain Marrow]]: captain "by attrition", the last officer who could count.
- [[Sergeant Vosk]]: Second Blade, gallows wit, keeps recruits alive.
- [[Brother Tallow]]: lamp-keeper, going blind.
- [[Fennick Bottlebrook]]: quartermaster, balances books that cannot balance.
- [[Garrick Sallow]]: lieutenant, ambitious, popular with the hungry.
- [[Spoons Aldane]]: corporal, runs the betting pool on when the lantern goes out.

### What they want
Food, pay, and not to be the company that lost the lantern. Failing those, a reason to stay.

### How they treat the party
The recruits are wicks: carried, bullied, fed last. A wick who does something brave gets a nickname inside a week. A wick who runs gets the same nickname, but it is less kind.

### Resources
The Keep, the gatehouse tolls at [[The Ford]] (thin), a quartermaster's store that is mostly rumour, and 140 people who can fight. Debts to [[Tollamund & Daughters]] that grow each Coinday.

### How they act
- **Pay-day pools:** Spoons posts new odds; the mood of the Keep shifts with them.
- **Short rations:** Fennick cuts the ration and Sallow notices out loud.
- **Desertions:** a tally goes quiet in the night. The lantern gets a little dimmer in the morning, or seems to.
- **A patrol returns short.** Someone has to write the letters.`,
    gmNotes: `Run the company as a family under strain: every scene should show somebody being kind to somebody else in a way that costs them. Mutiny ticks when pay fails, rations drop, a popular soldier dies pointlessly, or Sallow wins an argument. It rolls back when someone feeds the company, or Marrow does something visibly brave. At 6, the company splits: those loyal to the flame, those loyal to Sallow, and a long night in the Keep.`,
  },
  {
    key: 'f-regency-council',
    type: 'faction',
    name: 'The Regency Council',
    players: true,
    image: 'crest:f-regency-council',
    summary: 'The council that has ruled the Regency of Ardith "until an heir is found" for thirty years, mostly by paperwork.',
    fields: [
      { key: 'Crest', value: 'An empty throne in gold on deep blue, a wax seal pressed into the seat' },
      { key: 'Seat', value: 'Caer Ardith' },
      { key: 'Leader', value: 'Regent-Chancellor Marius Vell' },
      { key: 'Strength', value: 'A civil service, a few regiments, the Quiet Office' },
    ],
    aliases: ['the Regency Council', 'the Council'],
    tags: ['government', 'regency'],
    relations: [
      { to: 'f-quiet-office', kind: 'commands', note: 'Vell signs the work orders himself.', known: false },
      { to: 'f-concord-houses', kind: 'owes money to', note: 'Its debts are being bought up, and the Council knows.', known: true },
      { to: 'f-mothers', kind: 'fears', note: 'The Kingslayers are still the Council\'s unpaid bill.', known: true },
    ],
    body: `The Regency Council has ruled [[The Regency of Ardith]] since the Kingslaying in 2981, "until an heir is found". Thirty years on, no heir has been found, and the Council has stopped looking in the places where he might be. Its members call it a duty. Everyone else calls it a habit.

### Public face
Ledgers, seals and polite regret. The Council is an administration pretending to be a government. It does not lose battles; it loses the paperwork about battles. Letters from [[Caer Ardith]] still reach the front in triplicate, asking after the garrison's readiness, the state of the walls, and why Form 11-C was filed on the wrong colour of paper.

### Structure and ranks
Seven Councillors, each holding a "Seat" (Treasury, War, Justice, Charters, the River, the Mint, and the Seal). Over them the Regent-Chancellor. Beneath them the civil service: Collectors, Under-Collectors, Assistant Under-Collectors, and a great sea of clerks. Rank is shown by the number of ribbons on a document.

### Notable members
- [[Marius Vell]]: Regent-Chancellor, patient, courteous, never in a hurry.
- [[Pell Quillon]]: Fourth Assistant Under-Collector at [[The Assessor's Office]]; harmless, honest, doomed.

### What they want in the Ashenreach
Quiet, taxes, and no debt that can be called in. They want the treaty honoured on paper, the company paid by someone else, and their name on the credit. They are also, increasingly, interested in the lantern.

### How they treat the party
As staff. Orders arrive; thanks do not. Anyone who does the Council a visible favour is offered a title they cannot afford to hold.

### Resources
The treasury, such as it is; the river tolls; the Quiet Office; the old imperial archives, which hold maps nobody should be able to find.

### How they act
- **A Form arrives:** an audit, an inventory, a census, a permission to apply for permission.
- **Withdrawal order:** a polite instruction to stand the garrison down "pending review".
- **A commissioner:** somebody with a letter and no authority, but an escort.
- **Silence:** the correspondence stops, which is worse.

:::gm
Vell wants the power of the ward to crown a puppet emperor. The old imperial bloodlines were bred for ward-sensitivity, and the Council keeps a claimant in comfortable rooms in the capital, a quiet young cousin who has begun to hear things at night. Vell does not need a good emperor. He needs one who can stand near the Ninth Stone and carry what the ward gives, while Vell holds the pen. The Ninth Lantern is the key, and the Quiet Office was sent to Cinderford to turn it.
:::`,
    gmNotes: `Never play Vell on screen unless the story demands it. Play the Council as weather: it arrives as a letter, a clerk, a change in the tax rate. Its menace is that it is reasonable. When the PCs trace the unpaid wagon, the Council's response should look like clerical failure and be anything but.`,
  },
  {
    key: 'f-quiet-office',
    type: 'faction',
    name: 'The Quiet Office',
    image: 'crest:f-quiet-office',
    summary: 'The Regency\'s tax and records service, and its knife in the dark; its man in Cinderford is Pell Quillon\'s clerk.',
    fields: [
      { key: 'Crest', value: 'A closed ledger bound with a black ribbon, a small silver pen laid across it like a blade' },
      { key: 'Seat', value: 'Caer Ardith, the lower archives' },
      { key: 'Leader', value: 'The Registrar (name sealed)' },
      { key: 'Agent in town', value: 'Ansel Mote', gm: true },
    ],
    tags: ['spies', 'regency'],
    relations: [
      { to: 'f-ninth-lantern', kind: 'infiltrates', note: 'Garrick Sallow is on the books under "Contingencies".', known: false },
      { to: 'f-regency-council', kind: 'serves', note: 'Takes work orders from Marius Vell personally.', known: false },
      { to: 'f-rook-court', kind: 'watches', note: 'Ravelers hear everything and sell it to anyone.', known: false },
      { to: 'f-barge-clans', kind: 'buys from', note: 'Kettle Brindlewake sells it letters at a good price.', known: false },
    ],
    clocks: [{ name: 'The Quiet Office closes in', segments: 6, filled: 1, known: false }],
    body: `The public sees a tax and records service: pale clerks, ink-stained sleeves, the sort of people who reconcile accounts at funerals. The truth is that the Quiet Office does the Regency's killing, and it does it by stationery.

### Structure and ranks
**Registrar** at the top, who is never seen. Beneath, **Auditors** (the assassins, who "close accounts"), **Examiners** (spies who read everything), and **Clerks** (watchers, couriers, and the occasional poisoner). Everyone has a legitimate desk in a legitimate office. Their orders arrive as forms with a single extra line.

### Notable members
- [[Ansel Mote]]: Pell Quillon's mousy clerk in Cinderford, and an Auditor.
- [[Pell Quillon]]: not a member, which is the only reason he is still alive. Mote uses his office as cover.
- [[Garrick Sallow]]: paid through Mote, listed as "Contingencies, Cinderford".

### What they want in the Ashenreach
A mutiny at the Lantern Keep, timed to put the lantern in the Council's hands without a shot fired in the Council's name. Then a way to carry the flame to the capital, or to someone who can use it.

### How they treat the party
Carefully. A PC who proves useful to the company is a problem to be reframed, and a PC who looks into Mote is a problem to be closed. The Office would rather borrow a PC than kill one, and rarely says so.

### Resources
Money, forged papers, a little poison, the ear of anyone who ever filed a tax return, and the Council's seal. They are good with small things: a loosened bolt, a note in the wrong hand, a bad bottle sent as a gift.

### How they act
- **Paperwork moves:** an unremarkable inventory shifts, and a soldier is reassigned to a post where he will be alone.
- **Mote helps:** a handy tip, a loan, a favour. He is perfectly sincere about it.
- **Sallow gets a gift:** wine, a sword, a name for the Council to remember.
- **A body, tidily:** someone the PCs trusted is found with their affairs in order.

:::gm
Secret aim: carry out Marius Vell's order. Mote has a stack of unsigned forms, a sleeping draught, and a ledger of everyone in the Keep who is owed more than they can bear. He is not cruel; he is patient. Mote will not act until the clock fills, or until Sallow fails, or until somebody finds him out. If exposed, he claims to be a clerk, and an excellent one.
:::`,
    gmNotes: `The Quiet Office is a clock that ticks when the PCs do not look. Tick it when Sallow gets his way, when the pay wagon stays lost, when the PCs ignore Mote. Roll it back when they catch an agent or burn a paper trail. At 6, the Auditors close the account on whoever is in the way: a captain, a lamp-keeper, a PC. Mote's voice is soft, helpful, apologetic; the horror is in how much he apologises.`,
  },
  {
    key: 'f-concord-houses',
    type: 'faction',
    name: 'The Concord Houses',
    players: true,
    image: 'crest:f-concord-houses',
    summary: 'The merchant houses and Shellback banks of the Sevenhaven Concord, quietly buying the debts of the Ashenreach.',
    fields: [
      { key: 'Crest', value: 'Seven gold coins in a ring around a single pair of scales, on sea-green' },
      { key: 'Seat', value: 'Sevenhaven' },
      { key: 'Local agent', value: 'Tollamund & Daughters, Cinderford' },
      { key: 'Strength', value: 'Fleets, banks, mercenary contracts, everyone\'s IOU' },
    ],
    aliases: ['the Concord'],
    tags: ['merchants', 'banks'],
    relations: [
      { to: 'f-regency-council', kind: 'holds the debts of', note: 'The war was paid for on Concord credit.', known: true },
      { to: 'f-ninth-lantern', kind: 'holds the debts of', note: 'Through Tollamund & Daughters.', known: true },
      { to: 'f-church-saint', kind: 'rival of', note: 'Fire-and-mercy gives away what the Houses sell.', known: true },
      { to: 'f-quiet-office', kind: 'bribes', note: 'A few clerks, a few favours.', known: false },
    ],
    clocks: [{ name: 'Debt called in', segments: 8, filled: 2, known: true }],
    body: `[[The Sevenhaven Concord]] is seven free ports and a great many ledgers. Its houses lend to emperors, councils, kings, companies and the occasional god, and have done so since the first Concord of 1611. The war was fought on their credit. Everyone owes them. They are very polite about it.

### Public face
Cheerful, reasonable, rich. A Concord factor offers terms, never threats. If you default, you receive a letter. A second letter follows. By the third, someone else owns your road.

### Structure and ranks
Seven **Houses**, one per bay, each ruled by a **Principal**. Under them, **Factors** (agents in the field), **Tallymen** (collectors), **Notaries** and **Clerks of Account**. The banks themselves are Shellback, run by long-lived **Grandmothers** and **Grandfathers** who do not hurry and do not forget.

### Notable members
- [[Grandmother Tollamund]]: Shellback banker, 340 years old, who holds the Ninth Lantern's paper.
- [[Fennick Bottlebrook]]: not a member, but owes the House a favour he cannot repay.
- [[Odile Fairweather]]: the town's reeve, who dines with the House more often than she admits.

### What they want in the Ashenreach
Peace until the debt matures. Then a clean transfer of every claim the Regency has made on the march. They would like the company to stay, because an unpaid army is cheaper than a paid one, and to be sad about leaving.

### How they treat the party
With appetite. Credit is offered to anyone with a pulse. A PC in debt to the House becomes a useful friend; a PC who pays in full becomes a mystery.

### Resources
Money, shipping, the best lawyers on the continent, a mercenary company or two on retainer, and the only reliable coin in the Ashenreach.

### How they act
- **A buyer appears:** someone offers to purchase the company's contract, the reeve's charter, or the Ford.
- **A note falls due:** a letter arrives from Tollamund, perfectly civil, with a date on it.
- **A bargain:** something the party needs is offered at a tempting price, with a clause.
- **A rival is ruined:** a competitor's cargo sinks, and no one says why.

:::gm
Secret aim: buy every debt in the Ashenreach and so own it, the lantern with it. The Houses think this is a good investment. Tollamund thinks it is a key: the Shellbacks left [[The Ness of Thurm]] for a reason they do not discuss, and the lantern may open the way home. She has not told the Principals. The Debt clock fills when the company misses a payment, the reeve signs, or the Regency sells its claim. At 8 the House calls the note, and the company is repossessed along with its flame.
:::`,
    gmNotes: `Play the Concord as friendly inevitability. Nothing a factor does is ever rude. Tick Debt called in when a payment is missed, when Fennick's books are audited, when the reeve signs, when the Regency sells a claim. Roll back when the PCs bring real coin, a favour, or leverage. The chilling moment is when the factor says, kindly, "We do not need to take it. We only need you to give it."`,
  },
  {
    key: 'f-church-saint',
    type: 'faction',
    name: 'The Church of the Unburnt Saint',
    players: true,
    image: 'crest:f-church-saint',
    summary: 'Iskaveth\'s faith of fire and mercy, sending envoys, bandages and warm bread to a garrison it means to save.',
    fields: [
      { key: 'Crest', value: 'A woman\'s open hand, unmarked, with a small flame standing in the palm, on warm gold' },
      { key: 'Seat', value: 'Halcyra' },
      { key: 'Envoy in town', value: 'Sister Seraphine Ashe' },
      { key: 'Local base', value: 'The House of Unburnt Light' },
    ],
    aliases: ['the Church'],
    tags: ['church', 'iskaveth'],
    relations: [
      { to: 'f-ninth-lantern', kind: 'courts', note: 'Seraphine brings bread, bandages and an offer.', known: true },
      { to: 'f-mothers', kind: 'fears', note: 'The orcs killed one emperor to keep a ward shut; they might kill a saint.', known: false },
      { to: 'f-sleepless', kind: 'tolerates', note: 'Pilgrims in the Smokes pray beside cultists, and the Church looks away.', known: false },
      { to: 'f-glassers', kind: 'buys from', note: 'Relics from the glass, quietly, for the Saint\'s chapel.', known: false },
    ],
    clocks: [{ name: 'The Saint ascends', segments: 8, filled: 3, known: false }],
    body: `The Church of the Unburnt Saint arrived in the Ashenreach with a hand outstretched. [[Iskaveth]] declared Ilyra of Halcyra a living saint in 3007, when she walked out of the Battle of Cinders unburnt. Now her faith feeds the poor, dresses wounds, and offers fire as comfort: a candle for the dying, a hearth for the cold. It is warm, kind and very persuasive.

### Public face
A mission of mercy. [[The House of Unburnt Light]] stands outside Cinderford with a kitchen, a hospital ward, and more cushions than any soldier has seen since the war. Its priests ask no price. They simply ask you to stay a while.

### Structure and ranks
**The Saint** (far off, felt more than seen). Below her, **Lamp-Mothers** and **Lamp-Fathers** govern houses. **Almoners** give the bread. **Candle-bearers** are the faithful who carry her flame from town to town. Envoys, like [[Sister Seraphine]], speak with the Saint's authority.

### Notable members
- [[Sister Seraphine]]: envoy, charming, quick, a little too certain.
- [[Ilyra of Halcyra]]: the Saint, far away; her presence is felt through her people.

### What they want in the Ashenreach
To "save" the Ninth Lantern, which means taking it into the Church's keeping. They also want the company's loyalty, the town's gratitude, and the good opinion of anyone who matters. They would like a pilgrimage route to the Treaty Stone.

### How they treat the party
With affection. The envoy remembers names and birthdays, and always finds something the PC needs. The warmth is real, and the hunger behind it is just as real.

### Resources
Gold from Iskaveth, food, medicine, a standing army of devoted volunteers, and the ear of the poor. And Ilyra, who can reach anyone she has touched.

### How they act
- **A gift:** a warm meal, a healer, a letter from home.
- **A miracle, small:** a dying soldier lives, or seems to.
- **A procession:** pilgrims arrive at the Keep gates, singing.
- **An offer:** "Let us hold the flame for you, until the pay comes."

:::gm
Secret aim: feed the Saint the Ninth Ward's power so she becomes a full god. Ilyra drank dying Hathe's power in the fire and is ascending on it; she needs the crack open to finish. Her church does not all know. The envoy does. The Saint speaks through Seraphine and wants the PCs; she has felt something in them, and she is very patient. The clock ticks when the flame dims, when the Church gains a foothold in the Keep, when the Smokes riot, when a soldier prays to her instead of the company.
:::`,
    gmNotes: `Seraphine is the Church's face: warm, funny, a little tired, sincere. The pull the PCs feel is real; let them feel desire for her good opinion. Never play the Church as obvious villains. Tick the clock when the lantern gutters, when the Church feeds the town, when someone is "saved" and owes. Roll back when the PCs expose the Saint's hunger or give the lantern to someone else.`,
  },
  {
    key: 'f-mothers',
    type: 'faction',
    name: 'The Mothers of the Iron',
    players: true,
    image: 'crest:f-mothers',
    summary: 'The orc matriarchs who license the mercenary companies and exile anyone who breaks a contract.',
    fields: [
      { key: 'Crest', value: 'A clenched grey fist holding a broken chain, on iron red' },
      { key: 'Seat', value: 'The Iron Hearths, wherever the Mother of Mothers sits' },
      { key: 'Leader', value: 'Grashka, Mother of Mothers' },
      { key: 'Strength', value: 'Every orc company on the continent' },
    ],
    aliases: ['the Mothers'],
    tags: ['orcs', 'mercenaries'],
    relations: [
      { to: 'f-ninth-lantern', kind: 'licenses', note: 'The company\'s writ was signed at the Treaty Stone.', known: true },
      { to: 'f-last-wardens', kind: 'allied with', note: 'They share a quiet oath.', known: false },
      { to: 'f-remembrancers', kind: 'distrusts', note: 'The elves ask the wrong questions about the wrong wards.', known: false },
      { to: 'f-church-saint', kind: 'opposes', note: 'A new god means a new door.', known: false },
    ],
    body: `The Mothers of the Iron are the orcs' mothers, aunts and grandmothers, and they decide who fights, for whom, and for how long. They license every orc company on the continent. A Mother's writ is a contract, and a contract is a promise made in blood. Break it, and you are exiled: no kin, no fire, no name.

### Public face
The people who keep the peace by being too expensive to fight. The Kingslayers are hated and feared, and the Mothers prefer it that way. They are practical, fierce, and unfailingly honest in the ways that matter. They do not discuss the Kingslaying.

### Structure and ranks
**Mother of Mothers** at the top, chosen by the others for life. Beneath her, **Mothers** who each hold a **hearth**: a clan, a region, a set of contracts. **Daughters of the Writ** are their envoys. **Fists** are the officers who carry orders to the companies. Males serve as soldiers and sergeants, and the system works because everyone knows exactly who answers to whom.

### Notable members
- [[Grashka]]: Mother of Mothers, ancient, iron-hard, grandmother of [[Varra Nine-Knuckles]].
- [[Sergeant Vosk]]: Second Blade of the Ninth; old soldiers say he was once of the Iron Guard.

### What they want in the Ashenreach
A garrison that holds, a contract that is honoured, and no one poking at the Ninth Ward. They will tolerate the Ninth Lantern for as long as it keeps its word. If it does not, they will say so once, plainly.

### How they treat the party
Orcs get a measuring look and a short sentence. Everyone else gets courtesy and a precise sense of what is not being said. Varra, an exile, gets nothing from them but cold, and that is its own kind of message.

:::for Varra Nine-Knuckles
Your grandmother Grashka struck the blow that killed the Emperor. Whenever a Daughter of the Writ passes you in silence, that is why they will not look at you, and why they will not speak of it.
:::

### Resources
Soldiers, discipline, the writs that bind the companies, and a network of aunts that carries news faster than a courier.

### How they act
- **A Fist arrives:** a stern officer with an inspection and a short message.
- **A writ is checked:** the company's licence is read aloud in front of the officers.
- **A message to Varra:** or about her. Never from her grandmother.
- **A quiet visit:** to the Treaty Stone, at night, by orcs who do not wish to be seen.

:::gm
Secret aim: keep the wards shut. They ordered the Kingslaying because Aurel IX was digging at three ward sites to open one, and nobody would believe them. They still hold that line. Grashka suspects the Ninth Ward is the next one in danger, and the Mothers will move to close the crack by force, or to destroy whatever opens it. They have an understanding with the [[The Last Wardens|Last Wardens]]; they do not tell the company.
:::`,
    gmNotes: `Orc speech: short, concrete, no flourish. Humour is dry and often at the speaker's own expense. The Mothers never lie, which makes them difficult to read; they simply decline to answer. This is the faction where a PC's backstory (Varra) is most in play. Do not make Grashka a villain: she committed regicide to prevent catastrophe, and she would do it again.`,
  },
  {
    key: 'f-last-wardens',
    type: 'faction',
    name: 'The Last Wardens',
    players: true,
    image: 'crest:f-last-wardens',
    summary: 'The few Lithic still tending the wards, turning slowly to stone as the work outlasts them.',
    fields: [
      { key: 'Crest', value: 'A hand of grey stone pressed flat against a crack, on slate' },
      { key: 'Seat', value: 'None; each Warden stands at a ward' },
      { key: 'Eldest in the Ashenreach', value: 'Warden Uthrem' },
      { key: 'Strength', value: 'Perhaps thirty Lithic still walk the continent' },
    ],
    aliases: ['the Wardens'],
    tags: ['lithic', 'wards'],
    relations: [
      { to: 'f-mothers', kind: 'allied with', note: 'The Mothers send soldiers when asked, and ask nothing in return.', known: false },
      { to: 'f-ninth-lantern', kind: 'depends on', note: 'The flame holds the crack shut while the Wardens search.', known: false },
      { to: 'f-remembrancers', kind: 'avoids', note: 'The elves want to read what the Lithic prefer not to say.', known: false },
    ],
    body: `The Lithic are the ward-builders' last descendants, and the Last Wardens are the few who still tend what their ancestors made. Their skin turns to stone as they age. The oldest stop moving altogether and stand at their wards as living statues. The rest walk slowly between them, carrying messages, tools and the weight of knowing what is at stake.

### Public face
Pilgrims, scholars and the faithful visit the Wardens to ask blessings or answers. The Wardens give neither freely. They are patient, courteous and heartbreakingly slow: a conversation takes an afternoon, and the answer is usually "I will think on it."

### Structure and ranks
No hierarchy that outsiders can see. **Standers** are the ones who have stopped moving and hold a ward. **Walkers** are the ones who still can, and who carry word between Standers. **Keepers** are a Walker bound to a single ward, like [[Warden Uthrem]] at the Ninth Stone. The youngest have almost no stone on them, and the oldest have none left to give.

### Notable members
- [[Warden Uthrem]]: half-stone, nearly unable to move, who has waited nine years for someone to come.

### What they want in the Ashenreach
To keep the Ninth Ward standing. The old stone is failing; the crack widens; the Warden at the Ninth Stone can barely stand. They are running out of time, and they do not say what they hope will save it.

### How they treat the party
Gently, and with a courtesy that is never quite warmth. A Warden who likes a PC will say so slowly, over a long afternoon, and then be silent for a week. They are far more afraid than they appear.

### Resources
Knowledge of the wards that the world forgot; the Ninth Stone itself; a few allies like the Mothers; and time, which is running out.

### How they act
- **A summons:** a Walker arrives at the Keep with a request that cannot wait.
- **A warning:** the ground near the Rent hums, or a ward-song reaches the PCs in sleep.
- **A gift:** old tools, a map, a name nobody remembers.
- **A request:** to do something that sounds small and is not.

:::gm
Secret aim: find a living heart for the Ninth Ward before they turn fully to stone. The ward needs a willing mind to anchor it: Uthrem, a PC, or Ysse, whom the flame calls. They know the Godslaying was a mistake. They do not say the Nine's names, because the names were struck from memory. They will accept a willing sacrifice, and they will not force one, but they will encourage a good one. Uthrem has been waiting for [[Ysse Lampwright]] by name since before she arrived.
:::`,
    gmNotes: `Play slowness as a gift: let the table sit in silence, then deliver one line that matters. The Wardens are not mystical oracles; they are tired professionals. Their urgency should only become visible late. A Warden who says "I do not know" is telling the truth.`,
  },
  {
    key: 'f-remembrancers',
    type: 'faction',
    name: 'The Remembrancers',
    players: true,
    image: 'crest:f-remembrancers',
    summary: 'Sael\'s polite elven loremasters, who tattoo history onto skin and would pay almost anything to read it.',
    fields: [
      { key: 'Crest', value: 'An open eye drawn in a spiral of ink, on pale green' },
      { key: 'Seat', value: 'Ilmareth' },
      { key: 'Scholar in the field', value: 'Aelith Sorn' },
      { key: 'Strength', value: 'Scholars, scribes and a long purse' },
    ],
    tags: ['elves', 'scholars'],
    relations: [
      { to: 'f-glassers', kind: 'buys from', note: 'Anything with writing on it, no questions.', known: true },
      { to: 'f-mothers', kind: 'is watched by', note: 'The orcs do not trust elven curiosity near the wards.', known: false },
      { to: 'f-last-wardens', kind: 'pursues', note: 'The Lithic have the answers the elves burned.', known: false },
      { to: 'f-rook-court', kind: 'trades with', note: 'Last words are the cheapest histories there are.', known: false },
    ],
    body: `Every century the memories of elves fade, so the elves of [[Sael]] write theirs on themselves. The oldest are covered in ink they can no longer read. The Remembrancers are the loremasters who keep the record: tattooists, readers, archivists, and a good many scholars with sleeves rolled up. They are polite, gentle, and tireless.

### Public face
Visiting scholars with letters of introduction, kind questions, and a standing offer to buy anything with writing on it. They call themselves "friends of memory". They are, within their lights, entirely sincere.

### Structure and ranks
**Remembrancers** are full scholars. **Inkwrights** are the tattooists, who set the record into skin. **Readers** interpret old ink for the living. **The Unlettered** are young elves with a few lines on them and a great deal of curiosity. Authority comes from how much you remember, not how much you carry.

### Notable members
- [[Aelith Sorn]]: scholar, in the field, charming, ruthless.
- [[Sorrel Vey]]: not a member, but her tattoos are the first pages the Remembrancers would like to read.

### What they want in the Ashenreach
Lithic writing, ward-lore, anything older than the empire. They will pay well for rubbings, relics and fragments. They are also, quietly, looking for a book that does not exist: Sael's own account of what it did.

### How they treat the party
With flattery and an open purse. A Remembrancer will listen to a PC for hours, take notes, and offer coin for a story. They do not lie. They simply do not tell you what they intend to do with what you give them.

### Resources
Gold, libraries, a network of scholars across the continent, and the most patient memory in Vael Ardith.

### How they act
- **A commission:** an offer for a rubbing, a sketch, a chart.
- **A visit:** Aelith asks to see an object, and takes notes while the party watches.
- **A purchase:** from the Glassers, from the Velvet Ledger, from a drunk veteran.
- **A letter:** from Ilmareth, asking politely for a favour that is not polite at all.

:::gm
Secret aim: recover the memory Sael chose to forget, whatever it costs others. The Saelish Trespass of 1102 AW tried to open the Fourth Ward and failed; the elves burned the skin that remembered. The Remembrancers have begun to suspect, and they want proof. Aelith will betray anyone for a page of the right ink. If the ward cracks, they will count it a price. Sorrel Vey's tattoos record the Trespass; the Remembrancers do not know, but Aelith has begun to wonder.
:::`,
    gmNotes: `Their menace is kindness. Aelith's voice is warm and slightly distracted, like an academic who has just remembered something unrelated and delightful. When Aelith betrays a PC, let her be genuinely sorry, and genuinely not stopped by it.`,
  },
  {
    key: 'f-rook-court',
    type: 'faction',
    name: 'The Rook-Court',
    players: true,
    image: 'crest:f-rook-court',
    summary: 'The Raveler undertakers\' guild, who bury the dead, keep their last words, and are beginning to read them as one message.',
    fields: [
      { key: 'Crest', value: 'A black rook perched on a closed door, a single white feather in its beak, on dusk grey' },
      { key: 'Seat', value: 'The Doorkeeper\'s Chapel and Corvel Rise' },
      { key: 'Head in town', value: 'Mother Corvane' },
      { key: 'Strength', value: 'Hundreds of Ravelers, spread across every battlefield' },
    ],
    aliases: ['the Court'],
    tags: ['ravelers', 'undertakers'],
    relations: [
      { to: 'f-church-saint', kind: 'rival of', note: 'A new goddess of fire is a bad omen for an old god of doors.', known: false },
      { to: 'f-quiet-office', kind: 'evades', note: 'The Office would pay a lot for what the Court has heard.', known: false },
    ],
    clocks: [{ name: 'Last words decoded', segments: 4, filled: 1, known: false }],
    body: `Ravelers follow armies. They bury what armies leave, trade what the dead no longer need, and listen when the dying speak. The Rook-Court is their guild, and it is both a trade union and a priesthood. Its members tend the doors of dead Hathe, Keeper of Doors, because somebody has to.

### Public face
Cheerful, morbid undertakers with a gift for black humour. They take payment in coin, favours or stories. They will not be bribed; they simply charge more. Their funerals are done properly, with the right words and a decent joke.

### Structure and ranks
**Fledglings** learn the work. **Rooks** are the field undertakers. **Elder Rooks** lead a rookery. The head of a Court is called a **Mother** or **Father Rook**. Everyone keeps a **ledger** of what the dead said, and the ledgers are copied up the chain.

### Notable members
- [[Mother Corvane]]: head of the Rook-Court in town, shrewd, funny, careful.
- [[Quorl Many-Words]]: the company's undertaker, who answers to Corvane.

### What they want in the Ashenreach
To bury the dead decently, to keep the doors of [[The Doorkeeper's Chapel]] swinging, and to read the ledger. Since Hathe died, the dead do not always pass, and the Court would very much like to know why.

### How they treat the party
As customers, colleagues, and possible future clients. A Raveler will help anyone, for a price, and will tell any story for a better one. They are never cruel and never entirely candid.

:::for Quorl Many-Words
Seven dying soldiers have whispered the same sentence to you. You have not told Mother Corvane. You are not sure why.
:::

### Resources
A web of rookeries, the ledger of last words, the Doorkeeper's Chapel, a trusted reputation and an uncanny sense of who is about to die.

### How they act
- **A burial:** the Court shows up with a full rite and a quiet question.
- **A word from the ledger:** read aloud, as if by accident.
- **A pilgrim:** a Raveler passes through, gives a name and leaves a gap in the story.
- **A warning:** "somebody is going to die soon, and you should be there."

:::gm
Secret aim: decode the message in the last words. Read together, the ledger says "the lamp is the lock". Corvane has already guessed. She has not told Quorl, because she is unsure what the lock holds, and she suspects that any answer will be worse than the question. The clock ticks when new words are collected, when a veteran confesses, when someone says the sentence aloud. At 4, the message is complete, and the Court must decide what to do with it.
:::`,
    gmNotes: `Play Ravelers with gallows cheer. They should be the funniest faction at the table, with a rooted decency underneath. Corvane's patience is a weapon: she will wait an hour for the right answer and then ask one question. Let the dying soldiers' words be eerie and domestic at once.`,
  },
  {
    key: 'f-sleepless',
    type: 'faction',
    name: 'The Sleepless',
    image: 'crest:f-sleepless',
    summary: 'A dream-cult in the Smokes that marches on red moons, led by the Dreaming Widow, hoping to wake the Sleeper.',
    fields: [
      { key: 'Crest', value: 'An open eye behind a closed lid, scratched in chalk on doors', gm: true },
      { key: 'Leader', value: 'The Dreaming Widow', gm: true },
      { key: 'Meeting place', value: 'Cellars in the Smokes, and the dry fountain', gm: true },
      { key: 'Strength', value: 'About sixty, mostly Hollowborn', gm: true },
    ],
    tags: ['cult', 'smokes'],
    relations: [
      { to: 'dreaming-widow', kind: 'follows', note: 'She is the Widow, and she does not sleep.', known: false },
      { to: 'f-ninth-lantern', kind: 'recruits from', note: 'Soldiers who dream badly come to the cellars for quiet.', known: false },
      { to: 'f-rook-court', kind: 'fears', note: 'Ravelers hear the dream spoken aloud.', known: false },
    ],
    clocks: [{ name: 'The Sleepless rise', segments: 6, filled: 2, known: false }],
    body: `In the Smokes, where the Hollowborn families live and the glass-dust never quite washes out, a handful of people stopped sleeping. They say it is because they dream the same dream on a red moon, and they would rather be awake for it. They sit in cellars, drink bitter tea, speak softly and wait.

### Public face
A quiet fellowship of the troubled. They offer hot food, a place out of the weather, and someone who believes your nightmares. Nobody in the Smokes is quite sure how many belong. Most think they are harmless.

### Structure and ranks
The **Dreaming Widow** at the centre. **Wakers** keep watch through the night and run the cellars. **Dreamers** are the full members, who go to the dream on purpose. **Callers** are the recruiters who bring in the lost. The newest, the **Drowsy**, are still half asleep.

### Notable members
- [[The Dreaming Widow]]: Hollowborn leader, charming, grieving, certain.
- [[Marla Marlowe]]: not a member, but her sister is. Marla's ghost walks beside Tick and does not like the Widow.

### What they want in the Ashenreach
To wake the Sleeper. They believe the buried god dreams all suffering into being, and that waking it will end all of it. They gather at red moons and sing the dream. They are slowly building an army.

### How they treat the party
With kindness, and with interest. Recruits and Hollowborn PCs are offered tea and a place by the fire. A PC who dreams strongly is treated like a saint.

### Resources
The Smokes, a growing congregation, an unusual number of Hollowborn who can see the dead, and the dream itself.

### How they act
- **A vigil:** candles and chalk eyes on doors the night before a red moon.
- **A kindness:** a free meal, a lost child returned, a debt forgiven.
- **A march:** quiet crowds through the Smokes at midnight.
- **A convert:** a soldier, a clerk, a child the party knows is suddenly smiling.

:::gm
Secret aim: wake the Sleeper. The Widow is Tick's mother's sister and has seen the Sleeper's face. She is not mad; she is exhausted, and persuaded. The cult does not know that the Sleeper wants to be used, not woken: its dreams are bait. The clock ticks with each full red moon, each new convert, each night the lantern gutters. At 6 the Sleepless march in force on the Rent.
:::`,
    gmNotes: `Play them as an aid group gone slightly wrong. Warm, a little tired, sincere. Their menace comes from how reasonable the Widow sounds. Let the PCs like them and want to help, and let that be uncomfortable later. Tick the clock when a red moon passes, when Hollowborn PCs engage with the dream, when a soldier switches sides.`,
  },
  {
    key: 'f-glassers',
    type: 'faction',
    name: 'The Glassers',
    players: true,
    image: 'crest:f-glassers',
    summary: 'Salvage gangs who dig the glass-fused ruins, sell anything to anyone, and dig deeper than is wise.',
    fields: [
      { key: 'Crest', value: 'A cracked green glass shard with a pick laid across it, on rust' },
      { key: 'Seat', value: 'Fort Mercy' },
      { key: 'Boss', value: 'Vexa Glassjaw' },
      { key: 'Market', value: 'Gutter Market, Cinderford' },
    ],
    tags: ['salvage', 'gangs'],
    relations: [
      { to: 'f-remembrancers', kind: 'sells to', note: 'Anything with writing on it.', known: true },
      { to: 'f-church-saint', kind: 'sells to', note: 'Relics for the Saint\'s chapel, discreetly.', known: false },
      { to: 'f-concord-houses', kind: 'sells to', known: true },
      { to: 'f-barge-clans', kind: 'pays tolls to', note: 'Everything leaves the glass by barge.', known: true },
      { to: 'f-ninth-lantern', kind: 'bribes', note: 'A few tallies look away from the Fort Mercy road.', known: false },
    ],
    body: `The war fused villages to glass, and glass hides things. The Glassers dig it out. They are salvage gangs, wreckers, grave-robbers and, now and then, historians. They run [[Fort Mercy]], an abandoned Regency fort, and supply [[Gutter Market]] with anything that can be pulled from the ruins. They sell to anyone. They are not proud.

### Public face
Cheerful, filthy scavengers who will sell you a boot, a bell or a king's ring, and tell you honestly which of them is cursed. They call the glass "the Orchard" and a lucky find "a ripe one".

### Structure and ranks
**Boss** at the Fort. **Crew leaders** run a dig, and the crew work in shifts, with the older diggers training the younger. **Cutters** do the careful work; **Breakers** do the loud work. **Runners** carry finds to market. Splits are agreed at the start of a dig, and anyone who cheats is left in the glass.

### Notable members
- [[Vexa Glassjaw]]: orc boss of Fort Mercy, hard, practical, increasingly uneasy.
- [[Kettle Brindlewake]]: not a Glasser, but she carries half of their cargo.

### What they want in the Ashenreach
Coin, food, and a dig that pays. They want the garrison to look away from the Fort Mercy road. They want buyers who will not ask where the thing came from. And they want to know what is written in the glass.

### How they treat the party
As customers first, rivals second, and potential hires third. A fair price is an honest price, and a PC who haggles well is respected.

### Resources
A crowd of strong backs, a fort, a market stall or four, and an unusual collection of relics.

### How they act
- **A find:** a crew brings something to Gutter Market that makes the whole stall go quiet.
- **A bribe:** a sergeant is paid to look elsewhere.
- **A cave-in:** a dig collapses and crews are trapped; someone must go in.
- **A buyer:** an agent from Ilmareth or Halcyra asks a very specific question.

:::gm
Secret aim: sell anything to anyone, including relics that should stay buried. Vexa has found Lithic writing in the glass she cannot read, and it runs beneath Fort Mercy in a direction she does not like. She wants to dig deeper. The crews have started to talk about what they hear at night. Some of them are Sleepless. The Church of the Unburnt Saint quietly pays for the oldest finds.
:::`,
    gmNotes: `Play the Glassers as amiable ghouls: cheerful about death because it pays. Vexa's humour is bone-dry. The tension is the writing: what does it say, who needs it, and what happens if the Glassers sell it to the wrong buyer?`,
  },
  {
    key: 'f-barge-clans',
    type: 'faction',
    name: 'The Barge Clans',
    players: true,
    image: 'crest:f-barge-clans',
    summary: 'Halfling river-barge clans who carry trade, letters and contraband, and sell what they hear to everybody.',
    fields: [
      { key: 'Crest', value: 'A small white sail over three wavy lines of blue, with a tiny lantern at the prow' },
      { key: 'Seat', value: 'The Low Quay, Cinderford' },
      { key: 'Skipper in town', value: 'Kettle Brindlewake' },
      { key: 'Strength', value: 'A few hundred barges on every river' },
    ],
    aliases: ['the Clans'],
    tags: ['halflings', 'smugglers'],
    relations: [
      { to: 'f-quiet-office', kind: 'sells to', note: 'Letters, mostly, and opinions about letters.', known: false },
      { to: 'f-concord-houses', kind: 'sells to', known: true },
      { to: 'f-rook-court', kind: 'trades secrets with', known: false },
      { to: 'f-ninth-lantern', kind: 'sells to', note: 'Food, mostly, on credit nobody expects to be repaid.', known: true },
    ],
    body: `The Barge Clans are halfling families who live on the water. Their barges carry cargo, letters, contraband and gossip up and down every river of [[Vael Ardith]]. They are neutral by profession and nosy by nature, and everyone who matters has used them at least once.

### Public face
Good-natured river people, quick with a joke, slow to take offence. They carry anything, for a fair price, to anywhere with a quay. Every barge has a name, a painted eye on the prow, and a very good reason for being where it is.

### Structure and ranks
Each clan is led by a **Barge-Mother** or **Barge-Father**. Boats are commanded by **skippers**; crews are family. The clans meet in a **Quay-Moot** at every major port, and a Moot's decision binds all. Younger halflings start as **bargelings**, run errands, and learn who to trust.

### Notable members
- [[Kettle Brindlewake]]: halfling barge-captain and smuggler at [[The Low Quay]], gossip, profit-seeker, fond of the PCs.

### What they want in the Ashenreach
Trade routes that stay open, tolls that stay low, and a steady supply of customers. They want the Ninth Lantern to stay because a garrison keeps the road open. They also want to hear everything first.

### How they treat the party
As friends, so long as friendship is profitable. A PC who tells a good story gets a discount. A PC who pays in gossip gets a better one.

### Resources
Boats, contacts, smuggling routes, a network of family ties from the coast to the mountains, and the best information on the continent.

### How they act
- **A rumour:** passed along as a favour, and worth exactly what you pay.
- **A delivery:** a letter, a crate or a person arrives by barge, unannounced.
- **A deal:** a crate "fell off" a barge and is available at a discount.
- **A tip-off:** Kettle warns the party about something, for a price.

:::gm
Secret aim: run the continent's best courier and intelligence network, and sell to all sides. The clans keep a map of every factor's price and every officer's weakness. Kettle knows where the Concord coin in the pay wagon came from, and who ordered the oil cut with ash. She has not decided whether to sell that, because she likes the PCs, and liking customers is a bad business habit.
:::`,
    gmNotes: `Play the clans as cheerful, knowing, and a little too well-informed. Kettle's voice is warm and quick; she asks questions and answers none. They never betray a client's confidence unless the price is right, and they never state the price out loud.`,
  },
]
