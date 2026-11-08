import { IMPORT_ZIP, openZip } from '../zipSafe'
import { cleanFields, mod, section, sections, signed, spellList, uniq, type Gear, type Sheet } from './parse'

/**
 * Character sheets saved as XML:
 *  - Hero Lab Classic: its portfolio file (.por, a ZIP that keeps an XML statblock of every
 *    character in it) or an XML statblock saved with "Save Custom Output". Pathfinder 1e, Starfinder,
 *    D&D 5e and the other Hero Lab games all write the same shape.
 *  - Fantasy Grounds: a character exported from the character selection screen (Export, .xml).
 * Like the other readers, these forgive what they don't know and leave it out.
 */

const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
const attr = (el: Element | null | undefined, name: string) => (el?.getAttribute(name) ?? '').trim()
const kids = (el: Element | null | undefined, tag?: string) => [...(el?.children ?? [])].filter((c) => !tag || c.tagName.toLowerCase() === tag.toLowerCase())
const kid = (el: Element | null | undefined, tag: string) => kids(el, tag)[0]
const n = (s: string) => (s && isFinite(+s) ? +s : undefined)

/** Reads an XML file the user picked: Hero Lab (one or more characters) or Fantasy Grounds. */
export function parseSheetXml(xml: string): Sheet[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror'))
    throw new Error('That XML file is damaged or isn’t a character. Save it again from the other tool and pick the new file.')
  const root = doc.documentElement
  if (root.tagName === 'document' || root.querySelector('public > character')) {
    const sheets = kids(kid(root, 'public'), 'character').map(heroLab)
    if (sheets.length) return sheets
  }
  if (root.tagName === 'root') {
    const c = kid(root, 'character')
    if (c) return [fantasyGrounds(c)]
  }
  throw new Error('The app doesn’t recognise that XML file. It reads Hero Lab statblocks and Fantasy Grounds character exports.')
}

/** A Hero Lab portfolio (.por): every character's XML statblock inside it. */
export async function readHeroLabPortfolio(file: Blob): Promise<Sheet[]> {
  let zip
  try {
    zip = openZip(new Uint8Array(await file.arrayBuffer()), IMPORT_ZIP)
  } catch {
    throw new Error('The app couldn’t open that portfolio. Save it again in Hero Lab and pick the new .por file.')
  }
  const statblocks = zip.entries.filter((e) => /(^|\/)statblocks_xml\/.+\.xml$/i.test(e.name))
  if (!statblocks.length)
    throw new Error(
      'That portfolio has no XML statblocks in it (Hero Lab Online and some older versions leave them out). In Hero Lab, use File › Save Custom Output and choose XML, or copy the statblock text and paste it instead.',
    )
  const out: Sheet[] = []
  for (const e of statblocks) {
    try {
      out.push(...parseSheetXml(new TextDecoder().decode(zip.read(e))))
    } catch {
      // One damaged statblock shouldn't stop the others.
    }
  }
  if (!out.length) throw new Error('The app couldn’t read the characters in that portfolio. Try Save Custom Output as XML in Hero Lab instead.')
  // A portfolio keeps one statblock per character, but older versions sometimes wrote two.
  const seen = new Set<string>()
  return out.filter((s) => (seen.has(s.name) ? false : (seen.add(s.name), true)))
}

// ---------- Hero Lab ----------

/** "Strength" as "Str". */
const short = (name: string) => name.slice(0, 3).replace(/^./, (c) => c.toUpperCase())

function heroLab(c: Element): Sheet {
  const race = attr(kid(c, 'race'), 'racetext') || attr(kid(c, 'race'), 'name')
  const classesEl = kid(c, 'classes')
  const classes =
    attr(classesEl, 'summary') ||
    kids(classesEl, 'class')
      .map((k) => `${attr(k, 'name')} ${attr(k, 'level')}`.trim())
      .join(' / ')
  const level = attr(classesEl, 'level')
  // Pathfinder and Starfinder write <attributes><attribute>; D&D 5e writes <abilityscores><abilityscore>.
  const abilities = [...kids(kid(c, 'attributes'), 'attribute'), ...kids(kid(c, 'abilityscores'), 'abilityscore')].map((a) => {
    const value = kid(a, 'attrvalue') ?? kid(a, 'abilvalue')
    const bonus = kid(a, 'attrbonus') ?? kid(a, 'abilbonus')
    const v = attr(value, 'modified') || attr(value, 'text') || attr(value, 'base')
    const b = attr(bonus, 'text') || attr(bonus, 'modified') || (n(v) !== undefined ? signed(mod(n(v)!)) : '')
    return {
      key: short(attr(a, 'name')),
      value: v ? `${v}${b ? ` (${b.startsWith('-') || b.startsWith('+') ? b : `+${b}`})` : ''}` : '',
    }
  })
  const saves = kids(kid(c, 'saves'), 'save')
    .map((s) => `${attr(s, 'abbr') || attr(s, 'name').replace(/ save$/i, '')} ${attr(s, 'save') || attr(s, 'value')}`.trim())
    .join(', ')
  const health = kid(c, 'health')
  const speed = attr(kid(kid(c, 'movement'), 'speed'), 'text') || attr(kid(kid(c, 'movement'), 'speed'), 'value')
  const named = (parent: string, child: string) =>
    kids(kid(c, parent), child)
      .map((x) => attr(x, 'name'))
      .filter(Boolean)
  const described = (parent: string, child: string) =>
    kids(kid(c, parent), child).map((x) => {
      const d = text(kid(x, 'description'))
      return d ? `**${attr(x, 'name')}.** ${d}` : attr(x, 'name')
    })
  const skills = kids(kid(c, 'skills'), 'skill')
    .filter((s) => (n(attr(s, 'ranks')) ?? 1) > 0 || attr(s, 'proficient') === 'yes')
    .map((s) => `${attr(s, 'name')} ${attr(s, 'value')}`.trim())
  const spells = ['spellsknown', 'spellsmemorized', 'spellbook', 'spellsprepared'].flatMap((p) =>
    kids(kid(c, p), 'spell').map((s) => ({
      name: attr(s, 'name'),
      level: n(attr(s, 'level')) ?? 0,
    })),
  )
  const gearOf = (parent: string, child: string, equipped = false): Gear[] =>
    kids(kid(c, parent), child).map((g) => ({
      name: attr(g, 'name'),
      quantity: n(attr(g, 'quantity')) ?? 1,
      equipped: equipped || attr(g, 'equipped') === 'yes' || attr(g, 'equipped') === 'container' ? true : undefined,
      description: text(kid(g, 'description')) || undefined,
    }))
  const money = kid(c, 'money')
  const coins = ['pp', 'gp', 'sp', 'cp']
    .map((k) => [k, n(attr(money, k))] as const)
    .filter(([, v]) => v)
    .map(([k, v]) => `${v} ${k}`)
    .join(', ')
  const personal = kid(c, 'personal')
  return {
    source: 'Hero Lab',
    name: attr(c, 'name') || 'Unnamed character',
    summary: [level ? `Level ${level}` : '', race, classes].filter(Boolean).join(' '),
    fields: cleanFields([
      { key: 'Class', value: classes },
      { key: 'Level', value: level },
      { key: 'Species', value: race },
      { key: 'Alignment', value: attr(kid(c, 'alignment'), 'name') },
      { key: 'Deity', value: attr(kid(c, 'deity'), 'name') },
      ...abilities,
      { key: 'HP', value: attr(health, 'hitpoints') || attr(health, 'hp') },
      {
        key: 'AC',
        value: attr(kid(c, 'armorclass'), 'ac') || attr(kid(c, 'armorclass'), 'value'),
      },
      { key: 'Initiative', value: attr(kid(c, 'initiative'), 'total') },
      { key: 'Speed', value: speed },
      { key: 'Saves', value: saves },
      { key: 'Languages', value: named('languages', 'language').join(', ') },
      { key: 'XP', value: attr(kid(c, 'xp'), 'total') },
    ]),
    body: sections(
      section('Skills', skills.length ? skills.join(', ') : ''),
      section('Feats', described('feats', 'feat')),
      section('Traits', described('traits', 'trait')),
      section('Special abilities', [...described('otherspecials', 'special'), ...described('specialabilities', 'special')]),
      section('Spells', spellList(spells.filter((s) => s.name))),
      section('Money', coins || (attr(money, 'total') ? `${attr(money, 'total')} gp` : '')),
      section('Description', text(kid(personal, 'description'))),
    ),
    gear: [
      ...gearOf('melee', 'weapon', true),
      ...gearOf('ranged', 'weapon', true),
      ...gearOf('defenses', 'armor'),
      ...gearOf('magicitems', 'item'),
      ...gearOf('gear', 'item'),
    ].filter((g, i, all) => g.name && all.findIndex((x) => x.name === g.name) === i),
  }
}

// ---------- Fantasy Grounds ----------

/** A list in Fantasy Grounds: <inventorylist><id-00001>…</id-00001></inventorylist>. */
const list = (c: Element, tag: string) => kids(kid(c, tag)).filter((x) => /^id-\d+/.test(x.tagName))
const val = (el: Element | null | undefined, path: string) => text(path.split('.').reduce<Element | undefined>((x, t) => kid(x, t), el ?? undefined))

function fantasyGrounds(c: Element): Sheet {
  const classes = list(c, 'classes').map((k) => `${val(k, 'name')} ${val(k, 'level')}`.trim())
  const level = list(c, 'classes').reduce((s, k) => s + (n(val(k, 'level')) ?? 0), 0) || n(val(c, 'level'))
  const race = val(c, 'race')
  const ABILS: [string, string][] = [
    ['strength', 'Str'],
    ['dexterity', 'Dex'],
    ['constitution', 'Con'],
    ['intelligence', 'Int'],
    ['wisdom', 'Wis'],
    ['charisma', 'Cha'],
  ]
  const named = (tag: string) => list(c, tag).map((x) => val(x, 'name'))
  const described = (tag: string) =>
    list(c, tag).map((x) => {
      const d = val(x, 'text') || val(x, 'description')
      return d ? `**${val(x, 'name')}.** ${d}` : val(x, 'name')
    })
  const coins = list(c, 'coins')
    .filter((x) => n(val(x, 'amount')))
    .map((x) => `${val(x, 'amount')} ${val(x, 'name')}`)
    .join(', ')
  return {
    source: 'Fantasy Grounds',
    name: val(c, 'name') || 'Unnamed character',
    summary: [level ? `Level ${level}` : '', race, classes.join(' / ')].filter(Boolean).join(' '),
    fields: cleanFields([
      { key: 'Class', value: classes.join(' / ') },
      { key: 'Level', value: level ? String(level) : '' },
      { key: 'Species', value: race },
      { key: 'Background', value: val(c, 'background') },
      { key: 'Alignment', value: val(c, 'alignment') },
      { key: 'Deity', value: val(c, 'deity') },
      ...ABILS.map(([k, label]) => {
        const score = val(c, `abilities.${k}.score`)
        const bonus = val(c, `abilities.${k}.bonus`)
        return {
          key: label,
          value: score ? `${score} (${bonus ? signed(+bonus) : signed(mod(+score))})` : '',
        }
      }),
      { key: 'HP', value: val(c, 'hp.total') },
      { key: 'AC', value: val(c, 'defenses.ac.total') },
      { key: 'Speed', value: val(c, 'speed.total') || val(c, 'speed.base') },
      { key: 'Languages', value: uniq(named('languagelist')).join(', ') },
      { key: 'XP', value: val(c, 'exp') },
    ]),
    body: sections(
      section(
        'Skills',
        list(c, 'skilllist')
          .filter((x) => (n(val(x, 'prof')) ?? 0) > 0)
          .map((x) => val(x, 'name')),
      ),
      section('Features', described('featurelist')),
      section('Traits', described('traitlist')),
      section('Feats', described('featlist')),
      section(
        'Spells and powers',
        spellList(
          list(c, 'powers')
            .map((x) => ({
              name: val(x, 'name'),
              level: n(val(x, 'level')) ?? 0,
            }))
            .filter((s) => s.name),
        ),
      ),
      section('Money', coins),
      section('Personality', [val(c, 'personalitytraits'), val(c, 'ideals'), val(c, 'bonds'), val(c, 'flaws')].filter(Boolean)),
      section('Appearance', val(c, 'appearance')),
      section('Notes', val(c, 'notes')),
    ),
    gear: list(c, 'inventorylist')
      // Fantasy Grounds: 0 not carried (left at home), 1 carried, 2 equipped.
      .filter((x) => val(x, 'carried') !== '0')
      .map((x) => ({
        name: val(x, 'name'),
        quantity: n(val(x, 'count')) ?? 1,
        equipped: val(x, 'carried') === '2' || undefined,
        description: val(x, 'description') || undefined,
      }))
      .filter((g) => g.name),
  }
}
