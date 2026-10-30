/**
 * Treasure: a pile of coins, gems, art and odd things for the party to find, sized from a few coins
 * in a pocket to a dragon's hoard. Kept system-agnostic: coins are gp, sp and cp, magic items are
 * described rather than named from one game's rules.
 */

const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]
const between = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1))

export const TREASURE_SIZES = {
  pocket: { label: 'Pocket change', hint: 'A cutpurse’s pouch, a dead bandit' },
  stash: { label: 'Small stash', hint: 'A hidden box, a smuggler’s cache' },
  chest: { label: 'Treasure chest', hint: 'A dungeon’s prize, a noble’s strongbox' },
  hoard: { label: 'Hoard', hint: 'A dragon’s bed, a lost king’s vault' },
} as const
export type TreasureSize = keyof typeof TREASURE_SIZES

export interface TreasureItem {
  name: string
  /** What it's worth, in words ("50 gp"), when it has a price. */
  value?: string
  note?: string
  quantity?: number
  magic?: boolean
}

export interface Treasure {
  coins: { name: string; amount: number }[]
  items: TreasureItem[]
}

const GEMS = [
  ['Banded agate', 10], ['Blue quartz', 10], ['Moss agate', 10], ['Bloodstone', 50], ['Moonstone', 50], ['Onyx', 50],
  ['Amethyst', 100], ['Garnet', 100], ['Pearl', 100], ['Jade', 100], ['Black pearl', 500], ['Topaz', 500],
  ['Emerald', 1000], ['Fire opal', 1000], ['Star sapphire', 1000], ['Diamond', 5000],
] as const
const ART = [
  ['Silver ewer', 25], ['Carved bone statuette', 25], ['Embroidered silk handkerchief', 25], ['Gold locket with a painted portrait', 25],
  ['Small gold idol', 250], ['Silver comb set with moonstones', 250], ['Brass mug with jade inlay', 250], ['Tapestry of a forgotten battle', 250],
  ['Gold ring set with bloodstones', 750], ['Painted icon of a saint, gilded frame', 750], ['Jewelled crown of a minor house', 2500], ['Platinum bracelet set with sapphires', 2500],
] as const
const ODDS = [
  'A map with one corner torn off', 'A letter sealed with a crest nobody recognises', 'A key that fits no lock nearby', 'A child’s wooden horse',
  'A sack of fine flour (and something hard inside it)', 'A spyglass with a cracked lens', 'Three bottles of very old wine', 'A deck of cards with one card missing',
  'A ledger of debts owed, names circled in red', 'A silver holy symbol of a forgotten god', 'A music box that plays a tune the party half remembers', 'A jar of pickled eyes. Not human',
  'A fine cloak, a size too small', 'Masterwork thieves’ tools', 'A bundle of rare herbs', 'A dragon scale the size of a dinner plate',
]
const MAGIC_MINOR = [
  'A potion that heals wounds', 'A scroll with one simple spell', 'A candle that never burns down', 'A ring that keeps its wearer warm',
  'A cloak that turns aside the rain', 'An arrow that always flies true (one use)', 'A pebble that glows when shaken', 'A cup that purifies whatever is poured in',
  'A ribbon that mends small tears it touches', 'Boots that leave no tracks in snow',
]
const MAGIC_MAJOR = [
  'A weapon that hums before danger', 'A shield that remembers every blow (and returns one)', 'A bag far larger inside than out', 'An amulet that wards off charms',
  'A wand of crackling lightning (a few charges left)', 'A staff that speaks with animals', 'Armour that weighs nothing at all', 'A mirror that shows a far-off place',
  'A crown that lets its wearer be heard by any crowd', 'A horn that summons help, once a moon',
]

function gem(): TreasureItem {
  const [name, value] = pick(GEMS)
  return { name, value: `${value} gp` }
}
function art(): TreasureItem {
  const [name, value] = pick(ART)
  return { name, value: `${value} gp` }
}

/** Puts identical things together (three garnets, not three lines of garnet). */
function stack(items: TreasureItem[]) {
  const out: TreasureItem[] = []
  for (const i of items) {
    const same = out.find((o) => o.name === i.name && o.value === i.value && !o.magic && !i.magic)
    if (same) same.quantity = (same.quantity ?? 1) + 1
    else out.push({ ...i })
  }
  return out
}

export function generateTreasure(size: TreasureSize): Treasure {
  const coins: Treasure['coins'] = []
  const items: TreasureItem[] = []
  const add = (n: number, fn: () => TreasureItem) => {
    for (let i = 0; i < n; i++) items.push(fn())
  }
  if (size === 'pocket') {
    coins.push({ name: 'cp', amount: between(2, 30) }, { name: 'sp', amount: between(0, 12) })
    if (Math.random() < 0.3) coins.push({ name: 'gp', amount: between(1, 4) })
    if (Math.random() < 0.4) add(1, () => ({ name: pick(ODDS) }))
  } else if (size === 'stash') {
    coins.push({ name: 'sp', amount: between(20, 120) }, { name: 'gp', amount: between(10, 60) })
    add(between(0, 3), gem)
    if (Math.random() < 0.5) add(1, art)
    add(1, () => ({ name: pick(ODDS) }))
    if (Math.random() < 0.3) add(1, () => ({ name: pick(MAGIC_MINOR), magic: true }))
  } else if (size === 'chest') {
    coins.push({ name: 'gp', amount: between(100, 600) }, { name: 'sp', amount: between(100, 500) })
    if (Math.random() < 0.3) coins.push({ name: 'pp', amount: between(5, 30) })
    add(between(2, 6), gem)
    add(between(1, 3), art)
    add(between(0, 2), () => ({ name: pick(ODDS) }))
    add(between(1, 2), () => ({ name: pick(MAGIC_MINOR), magic: true }))
    if (Math.random() < 0.3) add(1, () => ({ name: pick(MAGIC_MAJOR), magic: true }))
  } else {
    coins.push({ name: 'gp', amount: between(2000, 9000) }, { name: 'pp', amount: between(100, 900) }, { name: 'sp', amount: between(1000, 5000) })
    add(between(6, 14), gem)
    add(between(3, 7), art)
    add(between(1, 3), () => ({ name: pick(ODDS) }))
    add(between(2, 4), () => ({ name: pick(MAGIC_MINOR), magic: true }))
    add(between(1, 3), () => ({ name: pick(MAGIC_MAJOR), magic: true }))
  }
  return { coins: coins.filter((c) => c.amount > 0), items: stack(items) }
}

/** The treasure as a Markdown list, for a page or a note. */
export function treasureMarkdown(t: Treasure) {
  const lines = [
    ...(t.coins.length ? [`- **Coins:** ${t.coins.map((c) => `${c.amount.toLocaleString()} ${c.name}`).join(', ')}`] : []),
    ...t.items.map((i) => `- ${i.quantity && i.quantity > 1 ? `${i.quantity} × ` : ''}${i.name}${i.value ? ` (${i.value}${i.quantity && i.quantity > 1 ? ' each' : ''})` : ''}${i.magic ? ' ✨' : ''}`),
  ]
  return lines.join('\n')
}
