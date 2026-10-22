/**
 * Random-table generators for improvising at the table. No AI: just curated tables.
 * Everything is system-agnostic; prices are in generic "gp" so they read naturally for most fantasy games.
 */
import { blankEntity, type Entity } from './db'

const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]
const pickN = <T>(xs: readonly T[], n: number): T[] => [...xs].sort(() => Math.random() - 0.5).slice(0, n)
const roll = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1))

const FIRST = [
  'Aldric', 'Brienne', 'Corvin', 'Dagny', 'Elric', 'Fenna', 'Garrick', 'Hilde', 'Isolde', 'Jory', 'Kestrel', 'Lysa',
  'Marek', 'Nim', 'Orla', 'Perrin', 'Quill', 'Rowan', 'Sabine', 'Tamsin', 'Ulric', 'Vesna', 'Wren', 'Yorick', 'Zara',
  'Bram', 'Cass', 'Dorn', 'Esme', 'Fitz', 'Greta', 'Hob', 'Ivo', 'Juna', 'Kael', 'Lark', 'Mira', 'Nox', 'Odo', 'Pip',
]
const LAST = [
  'Ashdown', 'Blackwood', 'Copperkettle', 'Dunmore', 'Emberly', 'Fairweather', 'Greaves', 'Hollow', 'Ironfoot',
  'Kettleburn', 'Longbarrow', 'Marsh', 'Nettle', 'Oakhart', 'Quickwater', 'Ravensworth', 'Stonebrook', 'Thistle',
  'Underhill', 'Vane', 'Whitlock', 'Yarrow',
]
const ANCESTRIES = ['human', 'human', 'human', 'elf', 'dwarf', 'halfling', 'gnome', 'half-orc', 'tiefling', 'dragonborn', 'half-elf', 'goblin']
const LOOKS = [
  'a crooked nose and a booming laugh', 'ink-stained fingers', 'a missing front tooth', 'immaculately braided hair',
  'a burn scar across one hand', 'mismatched eyes', 'an enormous moustache', 'a nervous tic', 'a fine but threadbare coat',
  'calloused, scarred knuckles', 'a sing-song voice', 'a stare that lingers too long', 'flour on everything',
  'a pet rat on one shoulder', 'tattoos of old sailing ships',
]
const MANNER = [
  'warm and chatty', 'suspicious of strangers', 'boastful', 'tired and blunt', 'overly formal', 'flirtatious',
  'distracted, always busy', 'superstitious', 'gruff but fair', 'gossipy', 'nervous', 'cheerfully greedy',
]
const WANTS = [
  'to pay off a debt to the wrong people', 'news of a missing sibling', 'to get out of this town', 'respect from the guild',
  'a rare ingredient from the wilds', 'to win back a lost love', 'revenge on a rival business', 'to keep a secret buried',
  'adventurers to clear out the cellar', 'a quiet life, finally',
]
const SECRETS = [
  'is an informant for the local thieves', 'is secretly nobility in hiding', 'once was an adventurer and ran away',
  'is being blackmailed', 'waters down the ale', 'knows where the old smuggler tunnels are', 'worships a forbidden god',
  'saw something terrible in the woods last week', 'is wanted in another city', 'is a doppelganger (the real one is in the cellar)',
]

export interface GeneratedNpc {
  name: string
  ancestry: string
  role: string
  look: string
  manner: string
  wants: string
  secret: string
}

export function generateNpc(role = pick(['merchant', 'guard', 'farmer', 'priest', 'noble', 'scholar', 'sailor', 'thief', 'hunter', 'bard'])): GeneratedNpc {
  return {
    name: `${pick(FIRST)} ${pick(LAST)}`,
    ancestry: pick(ANCESTRIES),
    role,
    look: pick(LOOKS),
    manner: pick(MANNER),
    wants: pick(WANTS),
    secret: pick(SECRETS),
  }
}

export function npcMarkdown(n: GeneratedNpc) {
  return `A ${n.manner} ${n.ancestry} ${n.role} with ${n.look}.\n\n**Wants:** ${n.wants}.\n\n:::gm\n**Secret:** ${n.secret}.\n:::`
}

const TAVERN_A = ['Prancing', 'Gilded', 'Drunken', 'Rusty', 'Sleeping', 'Laughing', 'Crooked', 'Salty', 'Silver', 'Wandering', 'Howling', 'Lucky']
const TAVERN_B = ['Pony', 'Griffin', 'Tankard', 'Dragon', 'Goose', 'Barrel', 'Anchor', 'Lantern', 'Stag', 'Kraken', 'Wyvern', 'Boot']
const TAVERN_VIBE = [
  'smoky, loud and full of dockhands', 'quiet and candle-lit, favoured by scholars', 'rowdy with an arm-wrestling table',
  'cosy, with a roaring hearth and a sleeping dog', 'shabby but cheap, nobody asks questions', 'upscale, with velvet booths and a bard',
  'half-empty and a little eerie', 'packed with off-duty guards',
]
const DRINKS = [
  ['House ale', '4 cp'], ['Dwarven stout', '8 cp'], ['Elven wine', '2 gp'], ['Spiced mead', '5 cp'], ['Goblin grog', '1 cp'],
  ['Hot cider', '3 cp'], ['Dragon’s Breath whiskey', '1 gp'], ['Small beer', '1 cp'],
] as const
const FOOD = [
  ['Mutton stew & bread', '3 sp'], ['Roast fowl', '5 sp'], ['Fish pie', '4 sp'], ['Cheese & pickles', '1 sp'],
  ['Mystery meat skewers', '2 sp'], ['Honey cakes', '1 sp'], ['Mushroom pottage', '2 sp'],
] as const
const RUMOURS = [
  'Lights have been seen in the old watchtower at night.', 'The mayor’s daughter has run off with a travelling performer.',
  'A merchant caravan went missing on the east road.', 'Someone is buying up all the silver in town.',
  'The well water tastes of copper since the earthquake.', 'A dragon was spotted over the mountains.',
  'The temple’s relic is a fake; the real one was stolen years ago.', 'Wolves are walking on two legs in the forest.',
  'There’s a reward for whoever clears the sewer of “the thing”.', 'A noble is hiring discreet adventurers. No questions.',
]

export interface GeneratedPlace {
  type: 'tavern' | 'shop'
  name: string
  summary: string
  body: string
  keeper: GeneratedNpc
  patrons: GeneratedNpc[]
  fields: { key: string; value: string }[]
}

export function generateTavern(): GeneratedPlace {
  const keeper = generateNpc('innkeeper')
  const name = `The ${pick(TAVERN_A)} ${pick(TAVERN_B)}`
  const vibe = pick(TAVERN_VIBE)
  const patrons = [generateNpc(), generateNpc()]
  const drinks = pickN(DRINKS, 3)
  const food = pickN(FOOD, 3)
  const rumours = pickN(RUMOURS, 3)
  const room = pick(['5 sp a night', '1 gp a night', '2 sp for a spot by the fire', '8 sp, breakfast included'])
  const body = [
    `A tavern that's ${vibe}. Run by [[${keeper.name}]].`,
    `### Menu\n${[...drinks, ...food].map(([n, p]) => `- ${n}: ${p}`).join('\n')}\n- Room: ${room}`,
    `### Patrons\n${patrons.map((p) => `- [[${p.name}]], a ${p.manner} ${p.role}`).join('\n')}`,
    `### Rumours\n:::gm\n${rumours.map((r) => `- ${r}`).join('\n')}\n:::`,
  ].join('\n\n')
  return { type: 'tavern', name, summary: `Tavern, ${vibe}`, body, keeper, patrons, fields: [{ key: 'Room', value: room }] }
}

const SHOP_KINDS: Record<string, { names: readonly string[]; stock: readonly (readonly [string, string])[] }> = {
  blacksmith: {
    names: ['Anvil & Ember', 'The Iron Maw', 'Hammerfall Forge', 'Sparks & Steel'],
    stock: [
      ['Dagger', '2 gp'], ['Longsword', '15 gp'], ['Battleaxe', '10 gp'], ['Shield', '10 gp'], ['Chain shirt', '50 gp'],
      ['Horseshoes (4)', '2 gp'], ['Crowbar', '2 gp'], ['Masterwork blade (on request)', '300 gp'], ['Arrowheads (20)', '1 gp'],
    ],
  },
  'general store': {
    names: ['Odds & Ends', 'The Well-Stocked Pack', 'Barrow’s Goods', 'Everything But Dragons'],
    stock: [
      ['Rope, 50 ft', '1 gp'], ['Torches (10)', '1 sp'], ['Rations (1 day)', '5 sp'], ['Bedroll', '1 gp'], ['Lantern', '5 gp'],
      ['Backpack', '2 gp'], ['Chalk', '1 cp'], ['Tinderbox', '5 sp'], ['Waterskin', '2 sp'],
    ],
  },
  alchemist: {
    names: ['The Bubbling Flask', 'Mortar & Moonlight', 'Fumes & Fortunes', 'Vials of Vesna'],
    stock: [
      ['Healing potion', '50 gp'], ['Antitoxin', '50 gp'], ['Alchemist’s fire', '50 gp'], ['Acid (vial)', '25 gp'],
      ['Smelling salts', '1 gp'], ['Holy water', '25 gp'], ['Suspicious love tonic', '10 gp'],
    ],
  },
  'magic shop': {
    names: ['Curios & Cantrips', 'The Arcane Attic', 'Wands & Wonders', 'Glimmerglass Emporium'],
    stock: [
      ['Spell scroll (1st level)', '75 gp'], ['Bag of holding', '500 gp'], ['Driftglobe', '200 gp'], ['Cloak of protection', '600 gp'],
      ['Wand of magic missiles', '400 gp'], ['Everburning torch', '25 gp'], ['Unidentified ring', '??? gp'],
    ],
  },
}
export type ShopKind = string
export const SHOP_KIND_NAMES = Object.keys(SHOP_KINDS)

export function generateShop(kind: ShopKind): GeneratedPlace {
  const def = SHOP_KINDS[kind]
  const keeper = generateNpc(kind === 'blacksmith' ? 'smith' : kind === 'alchemist' ? 'alchemist' : 'shopkeeper')
  const name = pick(def.names)
  const stock = pickN(def.stock, roll(4, 6))
  const haggle = pick(['won’t budge on price', 'loves to haggle', 'gives discounts to regulars', 'charges strangers double'])
  const hook = pick([
    'is short on a key material and will pay well for it', 'has a locked chest nobody can open', 'is being leaned on by a protection racket',
    'is looking for an apprentice', 'sold a cursed item by mistake and wants it back',
  ])
  const body = [
    `A ${kind} run by [[${keeper.name}]], who ${haggle}.`,
    `### Stock\n${stock.map(([n, p]) => `- ${n}: ${p}`).join('\n')}`,
    `:::gm\n**Hook:** the owner ${hook}.\n:::`,
  ].join('\n\n')
  return { type: 'shop', name, summary: `${kind[0].toUpperCase()}${kind.slice(1)}`, body, keeper, patrons: [], fields: [{ key: 'Haggling', value: haggle }] }
}

/** Lines an NPC might open with, for improvising conversations. */
export function npcGreeting(n: GeneratedNpc) {
  return pick([
    `“Well met, travellers. Name’s ${n.name.split(' ')[0]}. What’ll it be?”`,
    `“Don’t touch that. …Sorry. Long day. What do you need?”`,
    `“Adventurers, eh? Last lot didn’t pay their tab.”`,
    `“If you’re here about the noise last night, I didn’t see anything.”`,
    `“Ah! Customers! Come in, come in, mind the cat.”`,
  ])
}

/** A generated NPC as a codex page (GM only to start with). */
export function npcToEntity(worldId: string, n: GeneratedNpc, parentId?: string): Entity {
  const e = blankEntity(worldId, 'npc', n.name)
  e.summary = `${n.manner} ${n.ancestry} ${n.role}`
  e.body = npcMarkdown(n)
  e.parentId = parentId
  e.tags = ['generated']
  e.fields = [
    { key: 'Ancestry', value: n.ancestry },
    { key: 'Role', value: n.role },
  ]
  return e
}

/** A generated tavern or shop as codex pages: the place first, then its keeper and patrons inside it. */
export function placeToEntities(worldId: string, place: GeneratedPlace, parentId?: string): Entity[] {
  const p = blankEntity(worldId, 'shop', place.name)
  p.summary = place.summary
  p.body = place.body
  p.fields = place.fields
  p.parentId = parentId
  p.tags = ['generated', place.type]
  // The keeper and patrons live inside the new place, so they show up when it's clicked on a map.
  return [p, ...[place.keeper, ...place.patrons].map((n) => npcToEntity(worldId, n, p.id))]
}
