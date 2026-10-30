import { htmlToMarkdown } from '../importers'

/**
 * Reading character sheets from other tools into one shape the app understands:
 *  - Foundry VTT: an actor's "Export Data" file, for any game system (D&D 5e, Pathfinder 2e and
 *    Call of Cthulhu get extra care; every other system still brings its stats, items and biography).
 *  - D&D Beyond: the character's data (fetched from its share link, or saved as a file).
 *  - Pathbuilder 2e: its "Export JSON" link or file.
 *  - Fillable PDF sheets (see pdf.ts): the official D&D sheet, D&D Beyond's PDF and most others.
 *  - Anything else: Claude reads the text (see claude.ts in this folder), returning our own shape.
 * Formats change over time, so every reader is forgiving and leaves out what it can't make sense of.
 * Sheets never hold GM secrets, so nothing here is marked GM only.
 */

export interface Sheet {
  /** Where it came from, e.g. "D&D Beyond". */
  source: string
  name: string
  /** "Level 5 Elf Wizard". */
  summary: string
  /** The key numbers and facts, in the order a sheet shows them. */
  fields: { key: string; value: string }[]
  /** Everything else as Markdown: features, spells, backstory (and gear, when it isn't listed below). */
  body: string
  /** The things they carry, each to become an item page carried by the character. */
  gear?: Gear[]
  /** A web address for the portrait, when the sheet has one. */
  portraitUrl?: string
  /** Numbers we worked out ourselves (D&D Beyond leaves AC and HP to its own app), worth checking. */
  worked?: string[]
}

/** One thing a character carries. */
export interface Gear {
  name: string
  quantity: number
  /** Worn or in hand. */
  equipped?: boolean
  /** What the other tool says about it, as Markdown. */
  description?: string
}

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
const num = (v: unknown): number | undefined => (typeof v === 'number' && isFinite(v) ? v : typeof v === 'string' && v.trim() && isFinite(+v) ? +v : undefined)
const get = (o: unknown, path: string): unknown => path.split('.').reduce<unknown>((x, k) => (isObj(x) ? x[k] : undefined), o)
const signed = (n: number) => (n >= 0 ? `+${n}` : String(n))
const mod = (score: number) => Math.floor((score - 10) / 2)
const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))]

/** Removes empty values and keeps the first of any repeated key. */
function cleanFields(fields: { key: string; value: string }[]) {
  const seen = new Set<string>()
  return fields.filter((f) => {
    const k = f.key.toLowerCase()
    if (!f.value.trim() || seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** One Markdown section, left out when there's nothing in it. */
function section(title: string, content: string | string[]) {
  const text = Array.isArray(content)
    ? uniq(content)
        .map((x) => `- ${x}`)
        .join('\n')
    : lines(content)
  return text ? `### ${title}\n\n${text}` : ''
}
const sections = (...parts: string[]) => parts.filter(Boolean).join('\n\n')

/** A PDF box's text keeps its line breaks: short lines as a list, longer ones as paragraphs. */
function lines(text: string) {
  const ls = text
    .trim()
    .split(/\n/)
    .map((l) => l.trim())
  if (ls.length < 2 || /^\s*([-*#]|\d+\.)\s/m.test(text) || text.includes('\n\n')) return text.trim()
  return ls.filter(Boolean).every((l) => l.length < 80)
    ? ls
        .filter(Boolean)
        .map((l) => `- ${l}`)
        .join('\n')
    : ls.filter(Boolean).join('\n\n')
}

/** "Rock Dwarf", not "Rock Dwarf Dwarf". */
const ancestryOf = (heritage: string, ancestry: string) =>
  heritage.toLowerCase().includes(ancestry.toLowerCase()) && ancestry ? heritage : [heritage, ancestry].filter(Boolean).join(' ')

/** Text that may be HTML (Foundry and D&D Beyond both write HTML) as Markdown. */
const prose = (v: unknown) => {
  const s = str(v)
  return /<[a-z][\s\S]*>/i.test(s) ? htmlToMarkdown(s) : s
}

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const
const ABILITY_NAMES: Record<string, string> = { str: 'Str', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Wis', cha: 'Cha' }

// ---------- what kind of file is this ----------

/** Works out which tool a JSON file came from and reads it, or says why it can't. */
export function parseSheetJson(text: string): Sheet {
  let json: unknown
  try {
    // A saved web page or a copy may wrap the data in a little HTML or text.
    json = JSON.parse(
      text.trim().startsWith('{')
        ? text
        : text
            .slice(text.indexOf('{'), text.lastIndexOf('}') + 1)
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&'),
    )
  } catch {
    throw new Error('That file isn’t a character export the app can read. Pick the .json file the other tool saved, or use “Paste the sheet’s text”.')
  }
  if (!isObj(json)) throw new Error('That file doesn’t look like a character.')
  // D&D Beyond wraps the character in { success, data }; a saved copy may or may not keep that.
  const ddb = isObj(json.data) && ('classes' in json.data || 'stats' in json.data) ? json.data : 'stats' in json && 'classes' in json ? json : undefined
  if (ddb) return fromDdb(ddb)
  if (isObj(json.build) && ('class' in json.build || 'ancestry' in json.build)) return fromPathbuilder(json.build)
  if (json.success === false) throw new Error('That export is empty. In Pathbuilder or D&D Beyond, check the character is shared publicly, then try again.')
  if (typeof json.name === 'string' && (isObj(json.system) || isObj(json.data)) && Array.isArray(json.items)) return fromFoundry(json)
  if (typeof json.name === 'string' && Array.isArray(json.fields)) return fromOurs(json)
  throw new Error(
    'The app doesn’t recognise that file. It reads Foundry VTT, D&D Beyond and Pathbuilder exports; for anything else use “Paste the sheet’s text”.',
  )
}

/** Our own shape, as Claude writes it for "paste the sheet's text". */
export function fromOurs(json: Obj, source = 'Pasted sheet'): Sheet {
  const fields = arr(json.fields)
    .filter(isObj)
    .map((f) => ({ key: str(f.key), value: str(f.value) }))
    .filter((f) => f.key)
  const name = str(json.name)
  if (!name) throw new Error('Claude’s reply has no character name in it.')
  const gear = arr(json.gear)
    .filter(isObj)
    .map((g) => ({
      name: str(g.name),
      quantity: num(g.quantity) ?? 1,
      equipped: g.equipped === true || undefined,
      description: str(g.description) || undefined,
    }))
    .filter((g) => g.name)
  return { source, name, summary: str(json.summary), fields: cleanFields(fields), body: str(json.body), gear: gear.length ? gear : undefined }
}

// ---------- Foundry VTT ----------

/** Systems whose actors we know well; any other system gets the general reading. */
export function fromFoundry(actor: Obj): Sheet {
  // Foundry 10 and later keep the stats under "system"; older versions under "data".
  const sys = (isObj(actor.system) ? actor.system : isObj(actor.data) ? actor.data : {}) as Obj
  const systemId = str(get(actor, '_stats.systemId')) || guessFoundrySystem(sys)
  const items = arr(actor.items).filter(isObj)
  const read = systemId === 'dnd5e' ? foundry5e : systemId === 'pf2e' ? foundryPf2e : systemId === 'CoC7' ? foundryCoc : foundryGeneral
  const sheet = read(actor, sys, items)
  const img = str(actor.img)
  return {
    ...sheet,
    source: `Foundry VTT${systemId ? ` (${FOUNDRY_SYSTEMS[systemId] ?? systemId})` : ''}`,
    name: str(actor.name) || 'Unnamed character',
    portraitUrl: /^(https?:|data:image\/)/.test(img) ? img : undefined,
  }
}

const FOUNDRY_SYSTEMS: Record<string, string> = {
  dnd5e: 'D&D 5e',
  pf2e: 'Pathfinder 2e',
  pf1: 'Pathfinder 1e',
  CoC7: 'Call of Cthulhu',
  swade: 'Savage Worlds',
  wfrp4e: 'Warhammer Fantasy',
  sfrpg: 'Starfinder',
  a5e: 'Level Up 5e',
  shadowdark: 'Shadowdark',
  'cyberpunk-red-core': 'Cyberpunk RED',
  alienrpg: 'Alien RPG',
  blades: 'Blades in the Dark',
  daggerheart: 'Daggerheart',
  dcc: 'Dungeon Crawl Classics',
}

function guessFoundrySystem(sys: Obj) {
  if (isObj(sys.abilities) && isObj(get(sys, 'attributes.hp')) && isObj(sys.details) && 'race' in sys.details) return 'dnd5e'
  if (isObj(sys.characteristics) && isObj(sys.attribs)) return 'CoC7'
  return ''
}

type Read = (actor: Obj, sys: Obj, items: Obj[]) => Omit<Sheet, 'source' | 'name'>

const itemsOf = (items: Obj[], ...types: string[]) => items.filter((i) => types.includes(str(i.type)))
const names = (items: Obj[]) => items.map((i) => str(i.name))
/** "Rope (2)" when there's more than one. */
const withQty = (i: Obj) => {
  const q = num(get(i, 'system.quantity')) ?? num(get(i, 'data.quantity'))
  return `${str(i.name)}${q && q > 1 ? ` (${q})` : ''}`
}
/** Foundry items as gear: how many, whether worn or held, and their description. */
const foundryGear = (items: Obj[]): Gear[] =>
  items
    .map((i) => ({
      name: str(i.name),
      quantity: num(get(i, 'system.quantity')) ?? num(get(i, 'data.quantity')) ?? 1,
      equipped: get(i, 'system.equipped') === true || get(i, 'system.equipped.inSlot') === true || (num(get(i, 'system.equipped.handsHeld')) ?? 0) > 0,
      description: prose(get(i, 'system.description.value')) || undefined,
    }))
    .filter((g) => g.name)
const coins = (c: unknown, order = ['pp', 'gp', 'ep', 'sp', 'cp']) =>
  isObj(c)
    ? order
        .map((k) => [k, num(isObj(c[k]) ? (c[k] as Obj).value : c[k])] as const)
        .filter(([, v]) => v)
        .map(([k, v]) => `${v} ${k}`)
        .join(', ')
    : ''

/** Spells grouped by level, cantrips first. */
function spellList(spells: { name: string; level: number }[]) {
  const byLevel = new Map<number, string[]>()
  for (const s of spells) byLevel.set(s.level, [...(byLevel.get(s.level) ?? []), s.name])
  return [...byLevel.entries()]
    .sort(([a], [b]) => a - b)
    .map(([lvl, ns]) => `**${lvl === 0 ? 'Cantrips' : `Level ${lvl}`}:** ${uniq(ns).sort().join(', ')}`)
    .join('\n\n')
}

const foundry5e: Read = (_actor, sys, items) => {
  const classes = itemsOf(items, 'class')
  const subclasses = itemsOf(items, 'subclass')
  const level = classes.reduce((n, c) => n + (num(get(c, 'system.levels')) ?? 0), 0) || num(get(sys, 'details.level')) || 0
  const classText = classes
    .map((c) => {
      const sub = subclasses.find((s) => str(get(s, 'system.classIdentifier')) === str(get(c, 'system.identifier')))
      return `${str(c.name)}${sub ? ` (${str(sub.name)})` : ''}${classes.length > 1 ? ` ${num(get(c, 'system.levels')) ?? ''}` : ''}`
    })
    .join(' / ')
  const race = str(itemsOf(items, 'race')[0]?.name) || str(get(sys, 'details.race'))
  const background = str(itemsOf(items, 'background')[0]?.name) || str(get(sys, 'details.background'))
  const abilities = ABILITIES.map((a) => [a, num(get(sys, `abilities.${a}.value`))] as const)
  const hp = get(sys, 'attributes.hp')
  const acFlat = num(get(sys, 'attributes.ac.flat')) ?? num(get(sys, 'attributes.ac.value'))
  const walk = num(get(sys, 'attributes.movement.walk'))
  const spells = itemsOf(items, 'spell').map((s) => ({ name: str(s.name), level: num(get(s, 'system.level')) ?? 0 }))
  return {
    summary: [level && `Level ${level}`, race, classText].filter(Boolean).join(' '),
    fields: cleanFields([
      { key: 'Class', value: classText },
      { key: 'Level', value: level ? String(level) : '' },
      { key: 'Species', value: race },
      { key: 'Background', value: background },
      { key: 'Alignment', value: str(get(sys, 'details.alignment')) },
      ...abilities.map(([a, v]) => ({ key: ABILITY_NAMES[a], value: v === undefined ? '' : `${v} (${signed(mod(v))})` })),
      { key: 'HP', value: isObj(hp) && num(hp.max) ? `${num(hp.value) ?? num(hp.max)} / ${num(hp.max)}` : '' },
      { key: 'AC', value: acFlat ? String(acFlat) : '' },
      { key: 'Speed', value: walk ? `${walk} ft` : '' },
    ]),
    body: sections(
      section('Features', names(itemsOf(items, 'feat'))),
      section('Spells', spellList(spells)),
      section('Coins', coins(sys.currency)),
      section('Appearance', prose(get(sys, 'details.appearance'))),
      section(
        'Personality',
        [prose(get(sys, 'details.trait')), prose(get(sys, 'details.ideal')), prose(get(sys, 'details.bond')), prose(get(sys, 'details.flaw'))]
          .filter(Boolean)
          .join('\n\n'),
      ),
      section('Backstory', prose(get(sys, 'details.biography.value'))),
    ),
    gear: foundryGear(itemsOf(items, 'weapon', 'equipment', 'consumable', 'tool', 'loot', 'container', 'backpack')),
  }
}

const foundryPf2e: Read = (_actor, sys, items) => {
  const one = (t: string) => str(itemsOf(items, t)[0]?.name)
  const level = num(get(sys, 'details.level.value')) ?? 0
  const ancestry = ancestryOf(one('heritage'), one('ancestry'))
  // Remastered Pathfinder stores attribute modifiers; older actors stored scores.
  const abilities = ABILITIES.map((a) => {
    const m = num(get(sys, `abilities.${a}.mod`))
    const v = num(get(sys, `abilities.${a}.value`))
    return { key: ABILITY_NAMES[a], value: m !== undefined ? signed(m) : v !== undefined ? signed(mod(v)) : '' }
  })
  const hp = get(sys, 'attributes.hp')
  const spells = itemsOf(items, 'spell').map((s) => ({
    name: str(s.name),
    level: (get(s, 'system.traits.value') as string[] | undefined)?.includes?.('cantrip') ? 0 : (num(get(s, 'system.level.value')) ?? 1),
  }))
  return {
    summary: [level && `Level ${level}`, ancestry, one('class')].filter(Boolean).join(' '),
    fields: cleanFields([
      { key: 'Class', value: one('class') },
      { key: 'Level', value: level ? String(level) : '' },
      { key: 'Ancestry', value: ancestry },
      { key: 'Background', value: one('background') },
      ...abilities,
      { key: 'HP', value: isObj(hp) && num(hp.max) ? `${num(hp.value) ?? num(hp.max)} / ${num(hp.max)}` : '' },
      { key: 'Speed', value: num(get(sys, 'attributes.speed.value')) ? `${num(get(sys, 'attributes.speed.value'))} ft` : '' },
    ]),
    body: sections(
      section('Feats', names(itemsOf(items, 'feat'))),
      section('Spells', spellList(spells)),
      section('Money', itemsOf(items, 'treasure').map(withQty)),
      section('Backstory', prose(get(sys, 'details.biography.backstory')) || prose(get(sys, 'details.biography.appearance'))),
    ),
    gear: foundryGear(itemsOf(items, 'weapon', 'armor', 'shield', 'equipment', 'consumable', 'backpack', 'book')),
  }
}

const COC_CHARS: [string, string][] = [
  ['str', 'STR'],
  ['con', 'CON'],
  ['siz', 'SIZ'],
  ['dex', 'DEX'],
  ['app', 'APP'],
  ['int', 'INT'],
  ['pow', 'POW'],
  ['edu', 'EDU'],
]
const foundryCoc: Read = (_actor, sys, items) => {
  const occupation = str(itemsOf(items, 'occupation')[0]?.name) || str(get(sys, 'infos.occupation'))
  const skills = itemsOf(items, 'skill')
    .map((s) => ({ name: str(s.name), v: num(get(s, 'system.value')) ?? num(get(s, 'system.adjustments.base')) }))
    .filter((s) => s.v !== undefined && s.v > 0)
    .sort((a, b) => b.v! - a.v!)
  return {
    summary: [occupation, str(get(sys, 'infos.age')) && `age ${str(get(sys, 'infos.age'))}`].filter(Boolean).join(', '),
    fields: cleanFields([
      { key: 'Occupation', value: occupation },
      ...COC_CHARS.map(([k, label]) => ({ key: label, value: str(get(sys, `characteristics.${k}.value`)) })),
      { key: 'HP', value: str(get(sys, 'attribs.hp.value')) },
      { key: 'Sanity', value: str(get(sys, 'attribs.san.value')) },
      { key: 'Luck', value: str(get(sys, 'attribs.lck.value')) },
      { key: 'Magic points', value: str(get(sys, 'attribs.mp.value')) },
    ]),
    body: sections(
      section(
        'Skills',
        skills.map((s) => `${s.name} ${s.v}%`),
      ),
      section('Backstory', prose(get(sys, 'biography.personalDescription.value')) || prose(get(sys, 'description.keeper'))),
    ),
    gear: foundryGear(itemsOf(items, 'item', 'weapon', 'armor')),
  }
}

/** Any other system: whatever looks like a stat block, the items by kind, and the biography. */
const foundryGeneral: Read = (_actor, sys, items) => {
  const fields: { key: string; value: string }[] = []
  for (const group of ['abilities', 'attributes', 'characteristics', 'stats', 'attribs', 'traits']) {
    const g = sys[group]
    if (!isObj(g)) continue
    for (const [k, v] of Object.entries(g)) {
      const value = isObj(v) ? (num(v.value) ?? (isObj(v.die) ? `d${num((v.die as Obj).sides) ?? ''}` : undefined)) : num(v)
      const max = isObj(v) ? num(v.max) : undefined
      const label = (isObj(v) && (str(v.label) || str(v.abbreviation))) || k.charAt(0).toUpperCase() + k.slice(1)
      if (value !== undefined && fields.length < 16) fields.push({ key: label, value: max && max !== value ? `${value} / ${max}` : String(value) })
    }
  }
  // Kinds of item that are things to carry, in whatever words the system uses; the rest (skills, edges, powers) stay lists.
  const isGear = (i: Obj) => /weapon|armou?r|shield|equipment|gear|^item|consumable|loot|tool|container|backpack|ammo|cyberware|treasure/i.test(str(i.type))
  const byType = new Map<string, string[]>()
  for (const i of items.filter((i) => !isGear(i))) {
    const t = str(i.type) || 'item'
    byType.set(t, [...(byType.get(t) ?? []), withQty(i)])
  }
  const bio =
    ['details.biography.value', 'details.biography', 'biography', 'details.notes', 'description', 'notes'].map((p) => prose(get(sys, p))).find(Boolean) ?? ''
  return {
    summary: str(get(sys, 'details.class')) || str(get(sys, 'details.archetype')),
    fields: cleanFields(fields),
    body: sections(
      ...[...byType.entries()].map(([t, ns]) =>
        section(`${t.charAt(0).toUpperCase()}${t.slice(1).replace(/([a-z])([A-Z])/g, '$1 $2')}${t.endsWith('s') ? '' : 's'}`, ns),
      ),
      section('Biography', bio),
    ),
    gear: foundryGear(items.filter(isGear)),
  }
}

// ---------- D&D Beyond ----------

const DDB_STATS: Record<number, (typeof ABILITIES)[number]> = { 1: 'str', 2: 'dex', 3: 'con', 4: 'int', 5: 'wis', 6: 'cha' }
const DDB_STAT_NAMES: Record<string, (typeof ABILITIES)[number]> = {
  strength: 'str',
  dexterity: 'dex',
  constitution: 'con',
  intelligence: 'int',
  wisdom: 'wis',
  charisma: 'cha',
}
const ALIGNMENTS = [
  '',
  'Lawful Good',
  'Neutral Good',
  'Chaotic Good',
  'Lawful Neutral',
  'Neutral',
  'Chaotic Neutral',
  'Lawful Evil',
  'Neutral Evil',
  'Chaotic Evil',
]
/** Features every character gets that only clutter a list. */
const DDB_BORING =
  /^(ability score (increase|improvement)s?|hit points|proficiencies|equipment|age|alignment|size|speed|languages|core .* traits|creature type)$/i

/** The D&D Beyond address of a character, as the address its data is read from. */
export function ddbDataUrl(link: string) {
  const id = link.match(/dndbeyond\.com\/(?:profile\/[^/]+\/)?characters\/(\d+)/i)?.[1] ?? (/^\d{5,}$/.test(link.trim()) ? link.trim() : '')
  return id ? `https://character-service.dndbeyond.com/character/v5/character/${id}` : ''
}

/** Pathbuilder's "Export JSON" gives a number; the address to read it from. */
export function pathbuilderDataUrl(link: string) {
  const id = link.match(/pathbuilder2e\.com\/(?:json\.php\?id=|.*[?&]id=)(\d+)/i)?.[1] ?? (/^\d{3,7}$/.test(link.trim()) ? link.trim() : '')
  return id ? `https://pathbuilder2e.com/json.php?id=${id}` : ''
}

/**
 * D&D Beyond sends the raw choices and leaves the arithmetic (ability bonuses, hit points, armour
 * class) to its own app, so we do the common cases here and say they were worked out.
 */
export function fromDdb(c: Obj): Sheet {
  const classes = arr(c.classes).filter(isObj)
  const level = classes.reduce((n, cl) => n + (num(cl.level) ?? 0), 0)
  const inventory = arr(c.inventory).filter(isObj)
  const equipped = new Set(inventory.filter((i) => i.equipped && (!get(i, 'definition.canAttune') || i.isAttuned)).map((i) => num(i.id)))
  // Every bonus from species, class, background and feats, and from gear that's worn (and attuned).
  const mods = Object.entries(isObj(c.modifiers) ? c.modifiers : {}).flatMap(([from, list]) =>
    arr(list)
      .filter(isObj)
      .filter((m) => from !== 'item' || equipped.has(num(m.componentId))),
  )
  const sumMods = (type: string, subType: string) => mods.filter((m) => m.type === type && m.subType === subType).reduce((n, m) => n + (num(m.value) ?? 0), 0)
  const setMods = (subType: string) => mods.filter((m) => m.type === 'set' && m.subType === subType).map((m) => num(m.value) ?? 0)

  const score: Record<string, number> = {}
  for (const [id, a] of Object.entries(DDB_STATS)) {
    const base =
      num(
        arr(c.stats)
          .filter(isObj)
          .find((s) => num(s.id) === +id)?.value,
      ) ?? 10
    const bonus =
      num(
        arr(c.bonusStats)
          .filter(isObj)
          .find((s) => num(s.id) === +id)?.value,
      ) ?? 0
    const override = num(
      arr(c.overrideStats)
        .filter(isObj)
        .find((s) => num(s.id) === +id)?.value,
    )
    const name = Object.keys(DDB_STAT_NAMES).find((k) => DDB_STAT_NAMES[k] === a)!
    const raised = base + bonus + sumMods('bonus', `${name}-score`)
    score[a] = override ?? Math.max(raised, ...setMods(`${name}-score`))
  }

  const conMod = mod(score.con)
  const maxHp =
    num(c.overrideHitPoints) ?? (num(c.baseHitPoints) ?? 0) + (num(c.bonusHitPoints) ?? 0) + conMod * level + sumMods('bonus', 'hit-points-per-level') * level
  const hp = maxHp - (num(c.removedHitPoints) ?? 0)

  // Armour class: worn armour (or 10), Dex as the armour allows, a shield, then any flat bonuses.
  const worn = inventory.filter((i) => i.equipped && num(get(i, 'definition.armorTypeId')))
  const armour = worn.find((i) => num(get(i, 'definition.armorTypeId'))! <= 3)
  const shield = worn.find((i) => num(get(i, 'definition.armorTypeId')) === 4)
  const dex = mod(score.dex)
  const armourType = num(get(armour, 'definition.armorTypeId'))
  const unarmoured = mods
    .filter((m) => m.type === 'set' && m.subType === 'unarmored-armor-class')
    .map((m) => (num(m.statId) ? mod(score[DDB_STATS[num(m.statId)!]]) : 0) + (num(m.value) ?? 0))
  const acBase = armour
    ? (num(get(armour, 'definition.armorClass')) ?? 10) + (armourType === 1 ? dex : armourType === 2 ? Math.min(dex, 2) : 0)
    : 10 + dex + Math.max(0, ...unarmoured)
  const ac =
    num(c.overrideArmorClass) ??
    acBase +
      (shield ? (num(get(shield, 'definition.armorClass')) ?? 2) : 0) +
      sumMods('bonus', 'armor-class') +
      (armour ? sumMods('bonus', 'armored-armor-class') : sumMods('bonus', 'unarmored-armor-class'))

  const classText = classes
    .sort((a, b) => Number(!!b.isStartingClass) - Number(!!a.isStartingClass))
    .map(
      (cl) =>
        `${str(get(cl, 'definition.name'))}${get(cl, 'subclassDefinition.name') ? ` (${str(get(cl, 'subclassDefinition.name'))})` : ''}${classes.length > 1 ? ` ${num(cl.level)}` : ''}`,
    )
    .join(' / ')
  const race = str(get(c, 'race.fullName')) || str(get(c, 'race.baseName'))
  const background = str(get(c, 'background.definition.name')) || str(get(c, 'background.customBackground.name'))
  const speed = num(get(c, 'race.weightSpeeds.normal.walk'))

  const features = [
    ...classes.flatMap((cl) =>
      arr(cl.classFeatures)
        .filter(isObj)
        .filter((f) => (num(get(f, 'definition.requiredLevel')) ?? 1) <= (num(cl.level) ?? 0))
        .map((f) => str(get(f, 'definition.name'))),
    ),
    ...arr(get(c, 'race.racialTraits'))
      .filter(isObj)
      .map((t) => str(get(t, 'definition.name'))),
  ].filter((n) => n && !DDB_BORING.test(n))
  const feats = arr(c.feats)
    .filter(isObj)
    .map((f) => str(get(f, 'definition.name')))
  const spellDefs = [
    ...arr(c.classSpells)
      .filter(isObj)
      .flatMap((cs) => arr(cs.spells)),
    ...Object.values(isObj(c.spells) ? c.spells : {}).flatMap(arr),
  ].filter(isObj)
  const spells = spellDefs.map((s) => ({ name: str(get(s, 'definition.name')), level: num(get(s, 'definition.level')) ?? 0 })).filter((s) => s.name)
  const traits = isObj(c.traits) ? c.traits : {}
  const notes = isObj(c.notes) ? c.notes : {}
  const look = ['gender', 'age', 'height', 'weight', 'hair', 'eyes', 'skin']
    .map((k) => (str(c[k]) ? `${k.charAt(0).toUpperCase() + k.slice(1)}: ${str(c[k])}` : ''))
    .filter(Boolean)
    .join(' · ')

  return {
    source: 'D&D Beyond',
    name: str(c.name) || 'Unnamed character',
    summary: [level && `Level ${level}`, race, classText].filter(Boolean).join(' '),
    fields: cleanFields([
      { key: 'Class', value: classText },
      { key: 'Level', value: level ? String(level) : '' },
      { key: 'Species', value: race },
      { key: 'Background', value: background },
      { key: 'Alignment', value: ALIGNMENTS[num(c.alignmentId) ?? 0] ?? '' },
      ...ABILITIES.map((a) => ({ key: ABILITY_NAMES[a], value: `${score[a]} (${signed(mod(score[a]))})` })),
      { key: 'HP', value: maxHp > 0 ? `${hp} / ${maxHp}` : '' },
      { key: 'AC', value: String(ac) },
      { key: 'Speed', value: speed ? `${speed} ft` : '' },
      { key: 'Proficiency bonus', value: level ? signed(2 + Math.floor((level - 1) / 4)) : '' },
    ]),
    body: sections(
      section('Features', features),
      section('Feats', feats),
      section('Spells', spellList(spells)),
      section('Coins', coins(c.currencies)),
      section('Appearance', [look, prose(traits.appearance)].filter(Boolean).join('\n\n')),
      section('Personality', [traits.personalityTraits, traits.ideals, traits.bonds, traits.flaws].map(prose).filter(Boolean).join('\n\n')),
      section('Backstory', prose(notes.backstory)),
      section('Allies and organisations', [prose(notes.allies), prose(notes.organizations)].filter(Boolean).join('\n\n')),
    ),
    gear: inventory
      .map((i) => ({
        name: str(get(i, 'definition.name')),
        quantity: num(i.quantity) ?? 1,
        equipped: !!i.equipped,
        description: prose(get(i, 'definition.description')) || undefined,
      }))
      .filter((g) => g.name),
    portraitUrl: str(get(c, 'decorations.avatarUrl')) || str(c.avatarUrl) || undefined,
    worked: ['HP', 'AC'],
  }
}

// ---------- Pathbuilder 2e ----------

export function fromPathbuilder(b: Obj): Sheet {
  const level = num(b.level) ?? 1
  const raw = isObj(b.abilities) ? b.abilities : {}
  const values = ABILITIES.map((a) => num(raw[a]) ?? 10)
  // Pathbuilder saved scores (10, 18…) for years; remastered builds may hold modifiers (0, +4…).
  const asMods = values.every((v) => v <= 7)
  const mods = values.map((v) => (asMods ? v : mod(v)))
  const at = isObj(b.attributes) ? b.attributes : {}
  const conMod = mods[2]
  const hp = (num(at.ancestryhp) ?? 0) + (num(at.bonushp) ?? 0) + ((num(at.classhp) ?? 0) + (num(at.bonushpPerLevel) ?? 0) + conMod) * level
  const speed = (num(at.speed) ?? 0) + (num(at.speedBonus) ?? 0)
  const ancestry = ancestryOf(str(b.heritage), str(b.ancestry))
  const classText = [str(b.class), str(b.dualClass)].filter(Boolean).join(' / ')
  const spells = arr(b.spellCasters)
    .filter(isObj)
    .flatMap((sc) =>
      arr(sc.spells)
        .filter(isObj)
        .flatMap((l) => arr(l.list).map((n) => ({ name: str(n), level: num(l.spellLevel) ?? 0 }))),
    )
  return {
    source: 'Pathbuilder 2e',
    name: str(b.name) || 'Unnamed character',
    summary: [`Level ${level}`, ancestry, classText].filter(Boolean).join(' '),
    fields: cleanFields([
      { key: 'Class', value: classText },
      { key: 'Level', value: String(level) },
      { key: 'Ancestry', value: ancestry },
      { key: 'Background', value: str(b.background) },
      { key: 'Deity', value: str(b.deity) },
      { key: 'Alignment', value: str(b.alignment) },
      ...ABILITIES.map((a, i) => ({ key: ABILITY_NAMES[a], value: signed(mods[i]) })),
      { key: 'HP', value: hp > 0 ? String(hp) : '' },
      { key: 'AC', value: str(get(b, 'acTotal.acTotal')) },
      { key: 'Speed', value: speed ? `${speed} ft` : '' },
      { key: 'Languages', value: arr(b.languages).map(str).join(', ') },
    ]),
    body: sections(
      section(
        'Feats',
        arr(b.feats).map((f) => (Array.isArray(f) ? str(f[0]) : str(f))),
      ),
      section('Class features', arr(b.specials).map(str)),
      section('Spells', spellList(spells)),
      section('Money', coins(b.money)),
    ),
    gear: [
      ...arr(b.weapons)
        .filter(isObj)
        .map((w) => ({ name: str(w.display) || str(w.name), quantity: num(w.qty) ?? 1, equipped: true })),
      ...arr(b.armor)
        .filter(isObj)
        .map((a) => ({ name: str(a.display) || str(a.name), quantity: num(a.qty) ?? 1, equipped: !!a.worn })),
      ...arr(b.equipment).map((e) => (Array.isArray(e) ? { name: str(e[0]), quantity: num(e[1]) ?? 1 } : { name: str(e), quantity: 1 })),
    ].filter((g) => g.name),
    worked: ['HP'],
  }
}

// ---------- fillable PDFs ----------

/** What a form box is usually called on a sheet, as a field on the page (names squashed to letters and digits). */
const PDF_FIELDS: [RegExp, string][] = [
  [/^(classlevel|classandlevel|class\d?level)$/, 'Class and level'],
  [/^class$/, 'Class'],
  [/^level$/, 'Level'],
  [/^(race|species|ancestry|race\d?)$/, 'Species'],
  [/^background$/, 'Background'],
  [/^alignment$/, 'Alignment'],
  [/^(str|strength|strscore)$/, 'Str'],
  [/^(dex|dexterity|dexscore)$/, 'Dex'],
  [/^(con|constitution|conscore)$/, 'Con'],
  [/^(int|intelligence|intscore)$/, 'Int'],
  [/^(wis|wisdom|wisscore)$/, 'Wis'],
  [/^(cha|charisma|chascore)$/, 'Cha'],
  [/^(hpmax|maxhp|hitpointmaximum|maxhitpoints|hitpointsmax)$/, 'HP'],
  [/^(ac|armorclass|armourclass)$/, 'AC'],
  [/^speed$/, 'Speed'],
  [/^(initiative|init)$/, 'Initiative'],
  [/^(profbonus|proficiencybonus)$/, 'Proficiency bonus'],
  [/^(occupation)$/, 'Occupation'],
  [/^(san|sanity)$/, 'Sanity'],
  [/^(luck)$/, 'Luck'],
]
const PDF_TEXT: [RegExp, string][] = [
  [/^(featuresandtraits|features|featurestraits|classfeatures)\d*$/, 'Features'],
  [/^(equipment|gear|inventory|treasure)\d*$/, 'Gear'],
  [/^(proficiencieslang|otherproficiencieslanguages|languages)$/, 'Proficiencies and languages'],
  [/^(personalitytraits|ideals|bonds|flaws)$/, 'Personality'],
  [/^(backstory|characterbackstory)$/, 'Backstory'],
  [/^(allies|alliesorganizations)$/, 'Allies and organisations'],
]
const PDF_NAME = /^(charactername|name|charname|investigatorname)\d*$/

/** A sheet from a PDF's filled-in form boxes (pdf.ts reads them). Boxes we don't know go in a list at the end. */
export function fromPdfFields(boxes: { name: string; value: string }[], fileName: string): Sheet {
  const filled = boxes.filter((b) => b.value.trim() && b.value !== 'Off')
  if (!filled.length)
    throw new Error('That PDF has no filled-in boxes the app can read (it may be printed or scanned). Copy its text and use “Paste the sheet’s text” instead.')
  const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  let name = ''
  const fields: { key: string; value: string }[] = []
  const text = new Map<string, string[]>()
  const other: string[] = []
  for (const b of filled) {
    const k = squash(b.name.split('.').pop() ?? b.name)
    const v = b.value.trim()
    if (!name && PDF_NAME.test(k)) name = v
    else if (PDF_NAME.test(k)) continue
    else {
      const f = PDF_FIELDS.find(([re]) => re.test(k))
      const t = PDF_TEXT.find(([re]) => re.test(k))
      if (f) fields.push({ key: f[1], value: v })
      else if (t) text.set(t[1], [...(text.get(t[1]) ?? []), v])
      else if (b.value !== 'Yes' && b.value !== 'On' && !/^(check|box|button)/i.test(b.name)) other.push(`**${b.name.trim()}:** ${v.replace(/\n+/g, ' ')}`)
    }
  }
  const cl = fields.find((f) => f.key === 'Class and level')?.value
  const sp = fields.find((f) => f.key === 'Species')?.value
  return {
    source: 'PDF sheet',
    name: name || fileName.replace(/\.pdf$/i, ''),
    summary: [sp, cl].filter(Boolean).join(' '),
    fields: cleanFields(fields),
    body: sections(
      ...[...text.entries()].map(([title, parts]) => section(title, parts.join('\n\n'))),
      other.length ? section('Everything else on the sheet', other.join('\n\n')) : '',
    ),
  }
}
