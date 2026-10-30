import { blankEntity, type Entity } from './db'

/**
 * Starter random tables: ready-made, editable tables a GM can add to a world in one click, so the
 * table roller isn't empty on day one. Entries can roll dice ({1d6}) like any other table. They
 * stay system-agnostic.
 */

export interface StarterTable {
  name: string
  summary: string
  entries: string[]
}

export const STARTER_TABLES: StarterTable[] = [
  {
    name: 'Tavern rumours',
    summary: 'What the regulars are muttering about',
    entries: [
      'Lights have been seen in the old watchtower at night.',
      'A merchant caravan went missing on the east road, {1d4+1} wagons and all.',
      'Someone is buying up all the silver in town.',
      'The well water has tasted of copper since the tremor.',
      'A noble is hiring discreet adventurers. No questions asked.',
      'The temple’s relic is a fake; the real one was stolen years ago.',
      'Wolves are walking on two legs in the forest.',
      'The old miller died, but his mill still turns at night.',
      'There’s a reward for whoever clears the sewer of “the thing”.',
      'A stranger paid for every drink in the house last night, in coins nobody recognised.',
      'The ferryman refuses to cross after dark, and won’t say why.',
      'Somebody dug up the graveyard’s oldest grave, and filled it in again.',
    ],
  },
  {
    name: 'Plot hooks',
    summary: 'A reason to go somewhere, right now',
    entries: [
      'A dying messenger presses a sealed letter into a hero’s hand.',
      'A child begs the party to find a lost pet that went into the old ruins.',
      'A rival group of adventurers is heading for the same prize, a day ahead.',
      'The party wakes up owing {2d10}0 gold to someone they don’t remember meeting.',
      'A statue in the town square has started weeping.',
      'An old friend sends word: “Come quickly. Trust no one in red.”',
      'Bounty posters show a face exactly like one of the heroes’.',
      'A storm wrecks a ship nearby; something crawls out of the hold.',
      'The local lord offers land to whoever ends the bandit raids.',
      'A map turns up in a second-hand book, marked with today’s date.',
      'A festival’s guest of honour has gone missing the night before it starts.',
      'A god’s priest says the party appeared in a vision. It did not end well.',
    ],
  },
  {
    name: 'Road encounters',
    summary: 'Who or what is on the road today',
    entries: [
      'A merchant with a broken wagon wheel, eager to pay for help.',
      'Pilgrims singing on their way to a shrine; one of them is not who they say.',
      'A toll gate that wasn’t here last week, run by bored “soldiers”.',
      'A fresh grave by the roadside, a sword stuck in the earth for a marker.',
      '{1d6+2} bandits, hungry rather than brave.',
      'A lost courier who has forgotten their message.',
      'A travelling circus with a caged beast that speaks.',
      'A patrol hunting a deserter, who is hiding in a ditch nearby.',
      'A farmer’s cart of turnips, and a very nervous stowaway under them.',
      'Storm clouds and a shepherd’s hut with the door wide open.',
      'A knight who challenges anyone who wants to cross the bridge.',
      'Nothing at all. Too quiet. The birds have stopped singing.',
    ],
  },
  {
    name: 'Wilderness encounters',
    summary: 'Forest, hills and wild places',
    entries: [
      'A wounded beast, more frightened than dangerous.',
      'Hunters’ snares, one holding something that shouldn’t exist.',
      'A ring of mushrooms; anyone who steps in hears music.',
      'An abandoned camp, the fire still warm, {1d4} bedrolls.',
      'A hermit who trades advice for news of the outside world.',
      'A pack of {1d6+1} wolves shadowing the party at a distance.',
      'A ruined shrine to a nature spirit, overgrown but tended.',
      'A river in flood where the ford should be.',
      'Giant footprints, a day old, heading where the party is going.',
      'A tree carved with the names of travellers; the last one is a hero’s.',
      'Bandits’ lookout in the treetops, signalling with mirrors.',
      'A hidden valley full of strange, peaceful creatures.',
    ],
  },
  {
    name: 'Dungeon dressing',
    summary: 'What’s in this room, besides trouble',
    entries: [
      'Scratch marks counting days on the wall: {3d20} of them.',
      'A collapsed tunnel with a draught coming through the rubble.',
      'An old campfire and a torn page from someone’s journal.',
      'Bones arranged in a neat, deliberate spiral.',
      'A puddle that reflects a different ceiling.',
      'Rusted manacles, one still locked around a bony wrist.',
      'A faded mural of the dungeon’s builders, one face scratched out.',
      'Dripping water and the faint smell of the sea.',
      'A door painted on the wall. It doesn’t open. Probably.',
      'Spider webs thick as curtains, recently torn through.',
      'A shrine with fresh offerings. Someone still comes here.',
      'Total silence: no echo, no drip, nothing.',
    ],
  },
  {
    name: 'Trinkets',
    summary: 'Small, odd things found in pockets and chests',
    entries: [
      'A tiny silver bell with no clapper.',
      'A glass eye that sometimes seems to look around.',
      'A pressed flower from a plant nobody has seen.',
      'A wooden token stamped “ONE FREE DRINK”.',
      'A key on a chain, warm to the touch.',
      'A letter that ends mid-sentence.',
      'A coin with a different face on each side, neither a ruler you know.',
      'A whistle that only cats seem to hear.',
      'A child’s drawing of the party. It is dated next year.',
      'A vial of sand that falls upwards.',
      'A ring too small for any finger.',
      'A lock of hair tied with a blue ribbon.',
    ],
  },
  {
    name: 'NPC quirks',
    summary: 'Make anyone memorable in one line',
    entries: [
      'Ends every sentence as if it were a question?',
      'Collects buttons and asks for yours.',
      'Hums the same four notes over and over.',
      'Refers to themselves by their full name.',
      'Is terrified of birds.',
      'Constantly eating something crunchy.',
      'Quotes a holy book, slightly wrong.',
      'Never quite makes eye contact.',
      'Laughs at their own jokes before the punchline.',
      'Keeps a running tally of favours owed.',
      'Speaks very, very quietly; you lean in.',
      'Names everything: their sword, their horse, their spoon.',
    ],
  },
  {
    name: 'Town events',
    summary: 'What’s happening in town today',
    entries: [
      'Market day: crowds, pickpockets and bargains.',
      'A public hanging at noon; the condemned swears they’re innocent.',
      'A wedding procession blocks the main street.',
      'The town crier announces new taxes; the crowd turns ugly.',
      'A fire breaks out in the tanners’ quarter.',
      'A famous bard is in town for one night only.',
      'Soldiers are searching every house for a fugitive.',
      'A strange ship has docked; nobody has come ashore.',
      'The guilds are on strike; nothing can be bought or mended.',
      'A religious festival: masks, music and too much wine.',
      'A beast has escaped from the menagerie.',
      'Nothing much. Children play, dogs bark, the baker burns the bread.',
    ],
  },
]

/** A starter table as a GM-only random-table page. */
export function starterTableEntity(worldId: string, t: StarterTable): Entity {
  const e = blankEntity(worldId, 'table', t.name)
  e.summary = t.summary
  e.entries = [...t.entries]
  e.tags = ['starter']
  return e
}
