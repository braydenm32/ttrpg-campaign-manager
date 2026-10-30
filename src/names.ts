/**
 * Name generators: people, places, taverns and ships, in a handful of fantasy styles, plus names
 * "like these" learnt from a list the GM gives (their own NPCs, say). No AI: syllables and a small
 * letter-by-letter model.
 */

const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

interface Style {
  label: string
  /** First-name pieces: start, middle (often empty), end. */
  first: [readonly string[], readonly string[], readonly string[]]
  /** Family names: whole words, or two halves joined. */
  family: { whole?: readonly string[]; a?: readonly string[]; b?: readonly string[] }
  /** Place-name pieces, joined. */
  place: [readonly string[], readonly string[]]
}

export const NAME_STYLES = {
  common: {
    label: 'Common',
    first: [['Al', 'Bran', 'Cor', 'Ed', 'Gar', 'Hal', 'Jor', 'Mar', 'Ned', 'Os', 'Per', 'Rob', 'Sel', 'Tam', 'Wil', 'El', 'Ann', 'Bet', 'Mae', 'Ros'], ['', '', '', 'e', 'a', 'i'], ['ric', 'win', 'ett', 'mund', 'wyn', 'ton', 'ard', 'a', 'ie', 'y', 'ina', 'well', 'den', 'by']],
    family: { a: ['Ash', 'Black', 'Brook', 'Copper', 'Fair', 'Green', 'Hay', 'Mill', 'Oak', 'Red', 'Stone', 'Thorn', 'White', 'Wood', 'Cole'], b: ['ford', 'wood', 'field', 'well', 'ridge', 'ley', 'smith', 'ward', 'more', 'by', 'stead', 'wright'] },
    place: [['Ash', 'Bright', 'Cold', 'Elm', 'Fox', 'Hollow', 'King', 'Mill', 'North', 'Oak', 'Raven', 'Salt', 'Thorn', 'West', 'Wolf', 'Brack', 'Dun'], ['bridge', 'ford', 'ham', 'hollow', 'mere', 'stead', 'wick', 'ton', 'by', 'combe', 'moor', 'well', 'gate', 'barrow', 'haven']],
  },
  elvish: {
    label: 'Elvish',
    first: [['Ae', 'Cael', 'El', 'Fae', 'Gal', 'Ith', 'Lae', 'Lir', 'Mae', 'Nim', 'Sil', 'Tha', 'Vae', 'Yll', 'Ara', 'Eri'], ['', 'a', 'i', 'la', 'ri', 'the', 'va'], ['wen', 'thir', 'driel', 'lis', 'ndra', 'rion', 'thas', 'viel', 'nor', 'wyn', 'iel', 'loth', 'ra']],
    family: { a: ['Amar', 'Liad', 'Sil', 'Gala', 'Ilia', 'Nai', 'Ytha', 'Xil', 'Aelo', 'Mira'], b: ['kiir', 'non', 'thanil', 'deth', 'ra', 'vyre', 'lianth', 'quessir', 'sel', 'thorn'] },
    place: [['Ael', 'Cael', 'Ith', 'Lor', 'Mith', 'Sil', 'Tir', 'Ys', 'Fael', 'Nim', 'Ara'], ['andor', 'thalas', 'loren', 'wen', 'aril', 'vanna', 'dell', 'ithil', 'mara', 'nost']],
  },
  dwarvish: {
    label: 'Dwarvish',
    first: [['Bal', 'Bar', 'Dor', 'Dur', 'Gim', 'Gor', 'Har', 'Kil', 'Mor', 'Thor', 'Ul', 'Brom', 'Dag', 'Hild', 'Ris', 'Vond'], ['', '', 'a', 'i', 'o'], ['din', 'grim', 'rak', 'bek', 'li', 'gar', 'nar', 'dra', 'dis', 'vi', 'tok', 'mund']],
    family: { a: ['Iron', 'Stone', 'Fire', 'Gold', 'Deep', 'Battle', 'Rock', 'Anvil', 'Coal', 'Grim', 'Oak', 'Silver'], b: ['beard', 'fist', 'forge', 'hammer', 'delve', 'shield', 'helm', 'mantle', 'brow', 'axe', 'vein'] },
    place: [['Khaz', 'Kar', 'Dun', 'Bar', 'Gund', 'Mor', 'Thar', 'Zirak', 'Bel', 'Grun'], ['ad-dum', 'gath', 'hold', 'dar', 'mak', 'rim', 'zund', 'kol', 'durn', 'gard']],
  },
  orcish: {
    label: 'Orcish',
    first: [['Gr', 'Kr', 'Th', 'Ur', 'Mog', 'Zug', 'Bol', 'Gash', 'Drak', 'Rok', 'Sha', 'Vor', 'Yaz', 'Hurk'], ['a', 'o', 'u', 'ar', 'ag', 'u'], ['nak', 'thak', 'gul', 'mash', 'rok', 'dush', 'gor', 'za', 'ka', 'ruk', 'bash']],
    family: { whole: ['Skullsplitter', 'of the Broken Tusk', 'Bonechewer', 'Ironhide', 'Bloodfang', 'the Unbowed', 'Ashwalker', 'Redhand', 'of the Black Hill', 'Gutripper', 'Stormcaller'] },
    place: [['Gor', 'Ug', 'Kar', 'Dush', 'Mog', 'Ruk', 'Grosh', 'Zul', 'Thrak'], ['gash', 'mor', 'dak', 'nok', 'ruz', 'tal', 'bur', 'ghul']],
  },
  halfling: {
    label: 'Halfling',
    first: [['Bil', 'Cora', 'Dod', 'Fen', 'Lil', 'Mer', 'Mil', 'Nob', 'Pip', 'Pod', 'Rosie', 'Sam', 'Tom', 'Wel', 'Bell', 'Daisy'], ['', '', 'o', 'i', 'a'], ['bo', 'wise', 'ry', 'nie', 'kin', 'by', 'lo', 'mo', 'ly', 'win', '']],
    family: { a: ['Bramble', 'Brandy', 'Good', 'Green', 'Honey', 'Kettle', 'Little', 'Proud', 'Tea', 'Thistle', 'Under', 'Warm'], b: ['bottle', 'barrel', 'foot', 'hill', 'leaf', 'pot', 'wick', 'dale', 'buck', 'cake', 'burrow'] },
    place: [['Bramble', 'Buckle', 'Clover', 'Green', 'Hob', 'Hollin', 'Little', 'Meadow', 'Puddle', 'Tuck'], ['bury', 'bottom', 'hill', 'dell', 'holt', 'wick', 'combe', 'brook']],
  },
  northern: {
    label: 'Northern',
    first: [['As', 'Bjor', 'Ei', 'Frey', 'Gun', 'Hal', 'Ing', 'Kol', 'Ragn', 'Sig', 'Thor', 'Ulf', 'Vig', 'Yr', 'Sol', 'Hil'], ['', '', 'a', 'i'], ['dis', 'grim', 'mund', 'ar', 'rid', 'vald', 'bjorn', 'gerd', 'hild', 'ulf', 'stein', 'run']],
    family: { a: ['Ulf', 'Thor', 'Bjorn', 'Sig', 'Grim', 'Hak', 'Leif', 'Ragn', 'Ein', 'Arn'], b: ['sson', 'sdottir', 'sson', 'sen'] },
    place: [['Frost', 'Grim', 'Hvit', 'Jarn', 'Kald', 'Skal', 'Storm', 'Ulv', 'Vind', 'Yr', 'Svart'], ['heim', 'fjord', 'vik', 'holm', 'gard', 'dal', 'by', 'stad', 'ness']],
  },
  southern: {
    label: 'Southern',
    first: [['Al', 'Cas', 'Dar', 'Fa', 'Ha', 'Ja', 'Ka', 'Le', 'Ma', 'Na', 'Ra', 'Sa', 'Ta', 'Za', 'Ser', 'Ila'], ['', 'ri', 'li', 'si', 'ma', 'na'], ['im', 'ra', 'zar', 'dir', 'mina', 'sim', 'ian', 'ya', 'el', 'una', 'ius', 'ondo']],
    family: { a: ['al-', 'ibn ', 'da ', 'el-', 'di ', ''], b: ['Qasir', 'Marrow', 'Vessa', 'Hadir', 'Corvina', 'Sahar', 'Teodoro', 'Amarin', 'Zahid', 'Lucen'] },
    place: [['Al', 'Kar', 'Mar', 'Sa', 'Tor', 'Vel', 'Zan', 'Cor', 'Dar', 'Isk'], ['adar', 'ezzo', 'imar', 'ossa', 'abad', 'antha', 'ira', 'uba', 'essa', 'oro']],
  },
  infernal: {
    label: 'Infernal',
    first: [['Ak', 'Bar', 'Dam', 'Ka', 'Lev', 'Mal', 'Mor', 'Nem', 'Or', 'Sky', 'Za', 'Cri', 'Ia', 'Ri'], ['', 'a', 'e', 'i', 'o'], ['menos', 'kas', 'thos', 'leth', 'ria', 'deus', 'ax', 'ash', 'ys', 'za', 'rith']],
    family: { whole: ['Hope', 'Sorrow', 'Ember', 'Ash', 'Vigil', 'Torment', 'Quiet', 'Mercy', 'Doubt', 'Thorn', 'Reverie', 'Ruin'] },
    place: [['Abar', 'Dis', 'Geh', 'Mal', 'Nes', 'Phleg', 'Styx', 'Zar', 'Ix', 'Cain'], ['ethon', 'bolge', 'enna', 'thar', 'oth', 'os', 'gora', 'ixis']],
  },
} as const satisfies Record<string, Style>

export type NameStyle = keyof typeof NAME_STYLES
export const NAME_KINDS = { person: 'Person', place: 'Place', tavern: 'Tavern or inn', ship: 'Ship' } as const
export type NameKind = keyof typeof NAME_KINDS

function firstName(s: Style) {
  return cap(`${pick(s.first[0])}${pick(s.first[1])}${pick(s.first[2])}`.toLowerCase())
}
function familyName(s: Style) {
  if (s.family.whole) return pick(s.family.whole)
  const a = pick(s.family.a!)
  const b = pick(s.family.b!)
  // "ibn " and "al-" keep the second word's capital; joined halves read as one word.
  return /[\s-]$/.test(a) ? `${a}${b}` : a ? `${a}${b.toLowerCase()}` : b
}
function placeName(s: Style) {
  return cap(`${pick(s.place[0])}${pick(s.place[1])}`.toLowerCase())
}

const TAVERN_A = ['Prancing', 'Gilded', 'Drunken', 'Rusty', 'Sleeping', 'Laughing', 'Crooked', 'Salty', 'Silver', 'Wandering', 'Howling', 'Lucky', 'Black', 'Merry', 'Lame', 'Golden', 'Broken', 'Jolly', 'Weeping', 'Three']
const TAVERN_B = ['Pony', 'Griffin', 'Tankard', 'Dragon', 'Goose', 'Barrel', 'Anchor', 'Lantern', 'Stag', 'Kraken', 'Wyvern', 'Boot', 'Hound', 'Crown', 'Maiden', 'Ox', 'Candle', 'Wheel', 'Fiddle', 'Crow']
const SHIP_A = ['Restless', 'Silver', 'Grey', 'Bold', 'Last', 'Morning', 'Salt', 'Storm', 'Widow’s', 'Sea', 'Lady', 'Wandering', 'Red', 'Drowned', 'Lucky', 'Faithful']
const SHIP_B = ['Gull', 'Maiden', 'Star', 'Wake', 'Fortune', 'Tide', 'Promise', 'Hope', 'Serpent', 'Swan', 'Lantern', 'Revenge', 'Mercy', 'Heron', 'Crown', 'Wind']

/** One name of a kind, in a style. */
export function generateName(kind: NameKind, style: NameStyle): string {
  const s: Style = NAME_STYLES[style]
  if (kind === 'person') return `${firstName(s)} ${familyName(s)}`
  if (kind === 'place') return placeName(s)
  if (kind === 'tavern') {
    const r = Math.random()
    if (r < 0.6) return `The ${pick(TAVERN_A)} ${pick(TAVERN_B)}`
    if (r < 0.8) return `The ${pick(TAVERN_B)} & ${pick(TAVERN_B)}`
    return `${firstName(s)}’s ${pick(['Rest', 'Hall', 'House', 'Table', 'Taproom', 'Cellar'])}`
  }
  const r = Math.random()
  if (r < 0.65) return `The ${pick(SHIP_A)} ${pick(SHIP_B)}`
  return `The ${firstName(s)}`
}

/** A handful of different names at once, to pick from. */
export function generateNames(kind: NameKind, style: NameStyle, n = 8) {
  const out = new Set<string>()
  for (let i = 0; out.size < n && i < n * 10; i++) out.add(generateName(kind, style))
  return [...out]
}

/** People's names like the ones given: first names from their first names, family names from their family names. */
export function personNamesLike(examples: string[], n = 8): string[] {
  const parts = examples.map((e) => e.trim().split(/\s+/)).filter((p) => p.length > 0)
  const firsts = namesLike(parts.map((p) => p[0]), n)
  const lasts = namesLike(parts.filter((p) => p.length > 1).map((p) => p[p.length - 1]), n)
  return firsts.map((f, i) => (lasts.length ? `${f} ${lasts[i % lasts.length]}` : f))
}

/**
 * Names that sound like the ones given: a small model learns which letters follow which in the
 * examples (three letters at a time) and spells new words from it. Needs a few examples to work
 * well; names it already knows are skipped.
 */
export function namesLike(examples: string[], n = 8): string[] {
  const words = [...new Set(examples.flatMap((e) => e.split(/\s+/)).map((w) => w.replace(/[^\p{L}'’-]/gu, '').toLowerCase()).filter((w) => w.length >= 3))]
  if (words.length < 3) return []
  const order = 2
  const next = new Map<string, string[]>()
  for (const w of words) {
    const padded = `${'^'.repeat(order)}${w}$`
    for (let i = 0; i + order < padded.length; i++) {
      const key = padded.slice(i, i + order)
      const list = next.get(key) ?? []
      list.push(padded[i + order])
      next.set(key, list)
    }
  }
  const known = new Set(words)
  const minLen = Math.max(3, Math.min(...words.map((w) => w.length)))
  const maxLen = Math.max(...words.map((w) => w.length)) + 2
  const out = new Set<string>()
  for (let tries = 0; out.size < n && tries < n * 60; tries++) {
    let w = ''
    let key = '^'.repeat(order)
    for (;;) {
      const options = next.get(key)
      if (!options) break
      const c = pick(options)
      if (c === '$') break
      w += c
      key = (key + c).slice(-order)
      if (w.length > maxLen) break
    }
    if (w.length >= minLen && w.length <= maxLen && !known.has(w)) out.add(cap(w))
  }
  return [...out]
}
